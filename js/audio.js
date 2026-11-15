// Efectos de sonido sintetizados con Web Audio API; la música es una canción (assets/musica/musica.mp3).
let ctx = null, master = null, enabled = true, musicOn = false;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = enabled ? 0.5 : 0; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export function setEnabled(v) { enabled = v; if (master) master.gain.value = v ? 0.5 : 0; }
export function isEnabled() { return enabled; }
export function unlock() { try { ac(); if (musicOn) startMusic(); } catch (e) {} }
// ---------- música del juego (canción en bucle; solo se descarga cuando se activa la música) ----------
const MUSIC_URL = new URL('../assets/musica/musica.mp3', import.meta.url).href;
let track = null;
function startMusic() {
  if (!track) { track = new Audio(MUSIC_URL); track.loop = true; track.preload = 'auto'; track.volume = 0.45; }
  if (track.paused) track.play().catch(() => {});   // si el navegador lo bloquea, sonará al siguiente toque
}
function stopMusic() { if (track) track.pause(); }
export function setMusic(v) { musicOn = v; if (v) startMusic(); else stopMusic(); }
export function isMusicOn() { return musicOn; }

function tone({ f = 440, f2 = null, type = 'sine', t = 0.15, vol = 0.4, delay = 0, attack = 0.005 }) {
  const c = ac(), o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + t);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + t + 0.05);
}
function noise({ t = 0.2, vol = 0.4, filter = 1200, q = 1, delay = 0, type = 'lowpass', sweep = null }) {
  const c = ac(), len = Math.floor(c.sampleRate * t), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = filter; f.Q.value = q;
  const t0 = c.currentTime + delay;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t0 + t);
  const g = c.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
  s.connect(f); f.connect(g); g.connect(master); s.start(t0);
}

export const SFX = {
  click() { if (!enabled) return; tone({ f: 900, f2: 600, type: 'square', t: 0.05, vol: 0.12 }); },
  tomato() { if (!enabled) return; [523, 659, 784, 1047].forEach((f, i) => tone({ f, type: 'triangle', t: 0.18, vol: 0.3, delay: i * 0.07 })); },
  throwStart() { if (!enabled) return; noise({ t: 0.35, vol: 0.25, filter: 400, sweep: 3000, type: 'bandpass', q: 2 }); },
  stop() { if (!enabled) return; tone({ f: 1200, type: 'square', t: 0.06, vol: 0.2 }); tone({ f: 800, type: 'square', t: 0.08, vol: 0.15, delay: 0.06 }); },
  whoosh() { if (!enabled) return; noise({ t: 0.3, vol: 0.3, filter: 3000, sweep: 300, type: 'bandpass', q: 1.5 }); },
  splat() { if (!enabled) return; noise({ t: 0.25, vol: 0.6, filter: 500, sweep: 120 }); tone({ f: 180, f2: 60, type: 'sine', t: 0.2, vol: 0.4 }); },
  clank() { if (!enabled) return; tone({ f: 1800, f2: 900, type: 'square', t: 0.12, vol: 0.2 }); noise({ t: 0.1, vol: 0.2, filter: 4000, type: 'highpass' }); },
  fall() { if (!enabled) return; tone({ f: 800, f2: 120, type: 'sawtooth', t: 0.9, vol: 0.25 }); },
  splash() { if (!enabled) return; noise({ t: 0.7, vol: 0.7, filter: 1800, sweep: 300 }); noise({ t: 0.5, vol: 0.4, filter: 600, delay: 0.1 }); tone({ f: 200, f2: 50, t: 0.4, vol: 0.3 }); },
  laugh() { if (!enabled) return; [0, 0.16, 0.3, 0.42, 0.52].forEach((d, i) => tone({ f: 330 - i * 18, f2: 260 - i * 14, type: 'sawtooth', t: 0.14, vol: 0.18, delay: d, attack: 0.02 })); },
  miss() { if (!enabled) return; tone({ f: 400, f2: 300, type: 'triangle', t: 0.25, vol: 0.3 }); tone({ f: 300, f2: 180, type: 'triangle', t: 0.4, vol: 0.3, delay: 0.25 }); },
  near() { if (!enabled) return; tone({ f: 600, f2: 500, type: 'triangle', t: 0.2, vol: 0.3 }); tone({ f: 700, type: 'triangle', t: 0.2, vol: 0.3, delay: 0.18 }); },
  win() { if (!enabled) return; [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, type: 'square', t: 0.25, vol: 0.2, delay: i * 0.09 })); tone({ f: 1568, type: 'square', t: 0.5, vol: 0.2, delay: 0.5 }); },
  angry() { if (!enabled) return; [0, 0.12, 0.24].forEach(d => tone({ f: 150, f2: 110, type: 'sawtooth', t: 0.12, vol: 0.25, delay: d })); },
  ui() { if (!enabled) return; tone({ f: 700, f2: 900, type: 'sine', t: 0.08, vol: 0.15 }); },
  coin() { if (!enabled) return; tone({ f: 1760, type: 'square', t: 0.08, vol: 0.18 }); tone({ f: 2349, type: 'square', t: 0.3, vol: 0.18, delay: 0.08 }); },
  chestOpen() { if (!enabled) return; noise({ t: 0.3, vol: 0.3, filter: 300, sweep: 900, type: 'bandpass', q: 3 }); [392, 523, 659, 784].forEach((f, i) => tone({ f, type: 'triangle', t: 0.3, vol: 0.25, delay: 0.3 + i * 0.08 })); },
  reward(rar = 0) { if (!enabled) return; const b = [523, 659, 784, 1047][rar] || 523; [b, b * 1.25, b * 1.5].forEach((f, i) => tone({ f, type: 'triangle', t: 0.25, vol: 0.22, delay: i * 0.07 })); },
  upgrade() { if (!enabled) return; [440, 554, 659, 880, 1109].forEach((f, i) => tone({ f, type: 'square', t: 0.18, vol: 0.16, delay: i * 0.06 })); noise({ t: 0.4, vol: 0.15, filter: 5000, type: 'highpass', delay: 0.3 }); },
  cheer() { if (!enabled) return; [0, 0.1, 0.25, 0.4].forEach(d => noise({ t: 0.6, vol: 0.18, filter: 1500, q: 0.7, type: 'bandpass', delay: d })); [660, 880, 990].forEach((f, i) => tone({ f, type: 'sawtooth', t: 0.4, vol: 0.06, delay: i * 0.1 + 0.1 })); },
  falcon() { if (!enabled) return; noise({ t: 1.6, vol: 0.4, filter: 200, sweep: 4000, type: 'bandpass', q: 2 }); tone({ f: 120, f2: 900, type: 'sawtooth', t: 1.4, vol: 0.12 }); },
  error() { if (!enabled) return; tone({ f: 220, f2: 180, type: 'square', t: 0.2, vol: 0.15 }); },
  // ---------- niveles y ruleta ----------
  xp() { if (!enabled) return; tone({ f: 1320, f2: 1980, type: 'triangle', t: 0.12, vol: 0.14 }); tone({ f: 2640, type: 'sine', t: 0.18, vol: 0.08, delay: 0.08 }); },
  xpFill() { if (!enabled) return; [880, 1047, 1175, 1319, 1568].forEach((f, i) => tone({ f, type: 'triangle', t: 0.09, vol: 0.09, delay: i * 0.05 })); },
  drumroll(t = 0.9) { if (!enabled) return; for (let i = 0, n = Math.round(t / 0.045); i < n; i++) noise({ t: 0.06, vol: 0.12 + 0.3 * i / n, filter: 260 + 500 * i / n, q: 1.2, type: 'bandpass', delay: i * 0.045 }); },
  levelUp() {
    if (!enabled) return;
    [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36]].forEach(([f, d]) => { tone({ f, type: 'square', t: 0.16, vol: 0.16, delay: d }); tone({ f: f / 2, type: 'triangle', t: 0.16, vol: 0.2, delay: d }); });
    [1047, 1319, 1568, 2093].forEach(f => tone({ f, type: 'sawtooth', t: 1.3, vol: 0.06, delay: 0.5, attack: 0.03 }));
    [262, 392].forEach(f => tone({ f, type: 'triangle', t: 1.3, vol: 0.22, delay: 0.5, attack: 0.02 }));
    noise({ t: 1.4, vol: 0.32, filter: 5000, type: 'highpass', delay: 0.5 });                 // platillo
    noise({ t: 0.35, vol: 0.5, filter: 180, delay: 0.5 }); tone({ f: 110, f2: 45, t: 0.4, vol: 0.5, delay: 0.5 });   // bombo
  },
  stamp() { if (!enabled) return; tone({ f: 150, f2: 45, type: 'sine', t: 0.3, vol: 0.55 }); noise({ t: 0.18, vol: 0.45, filter: 900 }); },
  tick() { if (!enabled) return; tone({ f: 1900, f2: 1200, type: 'square', t: 0.03, vol: 0.1 }); },
  spin() { if (!enabled) return; noise({ t: 0.8, vol: 0.3, filter: 300, sweep: 2500, type: 'bandpass', q: 2 }); tone({ f: 200, f2: 700, type: 'sawtooth', t: 0.6, vol: 0.07 }); },
  prize(big = false) {
    if (!enabled) return;
    [784, 988, 1175, 1568].forEach((f, i) => tone({ f, type: 'square', t: 0.2, vol: 0.16, delay: i * 0.08 }));
    tone({ f: 2093, type: 'triangle', t: 0.7, vol: 0.18, delay: 0.34 });
    if (big) { for (let i = 0; i < 12; i++) { tone({ f: 1760, type: 'square', t: 0.06, vol: 0.12, delay: 0.5 + i * 0.07 }); tone({ f: 2349, type: 'square', t: 0.12, vol: 0.12, delay: 0.54 + i * 0.07 }); } noise({ t: 1.5, vol: 0.25, filter: 5000, type: 'highpass', delay: 0.4 }); }
  },
};

document.addEventListener('visibilitychange', () => { if (!track) return; if (document.hidden) track.pause(); else if (musicOn) startMusic(); });

// Efectos de sonido sintetizados con Web Audio API (sin archivos externos).
let ctx = null, master = null, musicGain = null, enabled = true, musicOn = false, musicTimer = null, nextNote = 0, step = 0;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = enabled ? 0.5 : 0; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.5; musicGain.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export function setEnabled(v) { enabled = v; if (master) master.gain.value = v ? 0.5 : 0; }
export function isEnabled() { return enabled; }
export function unlock() { try { ac(); if (musicOn && !musicTimer) startMusic(); } catch (e) {} }
// ---------- música de feria (organillo sintetizado, vals en bucle) ----------
const N = { C3: 130.8, G2: 98, F2: 87.3, A2: 110, C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, F5: 698.5, G5: 784 };
// cada compás: [bajo, acorde, melodía de 3 tiempos]
const BARS = [['C3', ['E4', 'G4'], ['E5', 'G5', 'E5']], ['C3', ['E4', 'G4'], ['C5', 'E5', 'C5']], ['G2', ['D4', 'G4'], ['D5', 'F5', 'D5']], ['G2', ['D4', 'G4'], ['B4', 'D5', 'B4']],
  ['F2', ['F4', 'A4'], ['A4', 'C5', 'F5']], ['F2', ['F4', 'A4'], ['E5', 'D5', 'C5']], ['G2', ['D4', 'G4'], ['B4', 'D5', 'G5']], ['C3', ['E4', 'G4'], ['E5', 'C5', 'C5']]];
function mnote(f, t0, dur, vol, type = 'triangle') {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(musicGain); o.start(t0); o.stop(t0 + dur + 0.05);
}
function schedule() {
  const beat = 0.34;
  while (nextNote < ctx.currentTime + 0.5) {
    const bar = BARS[Math.floor(step / 3) % BARS.length], b = step % 3;
    if (b === 0) mnote(N[bar[0]], nextNote, beat * 1.4, 0.10, 'sine'); else bar[1].forEach(n => mnote(N[n], nextNote, beat * 0.5, 0.035));
    mnote(N[bar[2][b]], nextNote, beat * 0.9, 0.06, 'square'); mnote(N[bar[2][b]] * 2, nextNote, beat * 0.5, 0.015);
    nextNote += beat; step++;
  }
}
function startMusic() { ac(); nextNote = ctx.currentTime + 0.1; clearInterval(musicTimer); musicTimer = setInterval(schedule, 150); }
function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
export function setMusic(v) { musicOn = v; if (v) { if (ctx) startMusic(); } else stopMusic(); }
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
};

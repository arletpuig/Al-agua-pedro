// Anti-autoclicker. Una persona varía el ritmo, mueve un poco el dedo, se cansa y hace pausas; un programa pulsa
// siempre igual: mismo intervalo, mismo punto y sin parar. Si el botón ¡DALE! se pulsa así, sale «¿Sigues ahí?»
// con 3 tomates que cambian de sitio: hasta tocarlos, los toques no cuentan. Un jugador normal casi nunca lo verá.
import { SFX } from './audio.js';

export const GUARD = {
  window: 40,        // toques que se miran a la vez
  fast: 300,         // solo cuenta si pulsa deprisa: intervalo medio por debajo de 300 ms (más de 3 toques por segundo)
  cvRobot: 0.035,    // ritmo casi perfecto (variación < 3,5 %): ninguna persona pulsa así
  cvSpot: 0.08,      // ritmo muy regular (< 8 %) y además siempre en el mismo píxel
  spotPx: 1.5,       // «mismo punto»: todos los toques dentro de 1,5 píxeles
  nonstopMs: 8 * 60e3, // 8 minutos pulsando sin una pausa de 3 segundos
  pauseMs: 3000,
  goal: 3,           // tomates que hay que tocar
};
const $ = s => document.querySelector(s);
let taps = [], runStart = 0, lastTap = 0, active = false, got = 0, ui = null;
// pruebas automáticas (?debug): apagado salvo que la prueba lo encienda
export const guardTest = { on: !/[?&]debug\b/.test(location.search) };
export const guardActive = () => active;

export function initGuard(uiRef) {
  ui = uiRef;
  const t = $('#guard-target');
  t?.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (!active || (!e.isTrusted && guardTest.on && !guardTest.synthetic)) return; hit(); });
}

const stats = xs => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); return { m, cv: m ? sd / m : 0 }; };

// Cada toque del botón ¡DALE!: true si cuenta, false si no (prueba pendiente o toque falso)
export function allowTap(e) {
  if (!guardTest.on) return true;
  if (active) return false;
  if (e && e.isTrusted === false && !guardTest.synthetic) return false;   // toques lanzados por un programa desde la página
  const now = performance.now(), x = e?.clientX || 0, y = e?.clientY || 0;
  if (now - lastTap > GUARD.pauseMs) { runStart = now; taps = []; }   // tras una pausa se empieza a mirar de cero
  lastTap = now;
  taps.push({ t: now, x, y }); if (taps.length > GUARD.window) taps.shift();
  const why = check(now);
  if (why) { challenge(why); return false; }
  return true;
}
function check(now) {
  if (now - runStart > GUARD.nonstopMs) return 'nonstop';
  if (taps.length < GUARD.window) return '';
  const gaps = taps.slice(1).map((p, i) => p.t - taps[i].t), { m, cv } = stats(gaps);
  if (m > GUARD.fast) return '';
  if (cv < GUARD.cvRobot) return 'rhythm';
  const x0 = taps[0].x, y0 = taps[0].y, spot = taps.every(p => Math.abs(p.x - x0) <= GUARD.spotPx && Math.abs(p.y - y0) <= GUARD.spotPx);
  if (spot && cv < GUARD.cvSpot) return 'spot';
  return '';
}
function place() {
  const t = $('#guard-target'), a = $('#guard-area').getBoundingClientRect(), s = t.offsetWidth || 72;
  t.style.left = Math.round(Math.random() * Math.max(0, a.width - s)) + 'px';
  t.style.top = Math.round(Math.random() * Math.max(0, a.height - s)) + 'px';
  t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop');
}
function challenge(why) {
  active = true; got = 0; taps = [];
  const ov = $('#guard-overlay'); if (!ov) { active = false; return; }
  ov.dataset.why = why; $('#guard-count').textContent = `0 / ${GUARD.goal}`;
  $('#guard-sub').innerHTML = (why === 'nonstop' ? 'Llevas muchísimo rato pulsando sin parar ni un segundo.' : 'Pulsas con un ritmo de máquina.') + ` Toca los <b>${GUARD.goal} tomates</b> para seguir sumando.`;
  ov.classList.add('open'); SFX.ui?.();
  requestAnimationFrame(place);
}
function hit() {
  got++; SFX.click?.(); $('#guard-count').textContent = `${got} / ${GUARD.goal}`;
  if (got < GUARD.goal) { place(); return; }
  active = false; taps = []; runStart = performance.now(); lastTap = runStart;
  $('#guard-overlay').classList.remove('open'); SFX.prize?.(false);
  ui?.showToast('👍 ¡Perfecto! Sigue dándole', 1800);
}

// Controlador de juego: clics, lanzamientos (simples y múltiples), decisiones de caída y recompensas.
import { CONFIG } from './config.js';
import { state, addClicks, useTomatoes, registerThrow, falconActive } from './state.js';
import * as E from './economy.js';
import { SFX, unlock } from './audio.js';
import { LINES, pick } from './game/arena.js';

let scene, ui, hooks, busy = false, taps = 0, idleTimer = null;
export function isBusy() { return busy; }
export function initPlay(sceneRef, uiRef, hooksRef = {}) {
  scene = sceneRef; ui = uiRef; hooks = hooksRef;
  const btn = document.querySelector('#btn-click');
  btn.addEventListener('pointerdown', onTap);
  btn.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); onTap(e); } });
  scheduleIdle();
}
function scheduleIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!busy && document.visibilityState === 'visible') scene.tauntIdle(pick(LINES.idle)); scheduleIdle(); }, 20000 + Math.random() * 10000);
}
// ---------- clics ----------
function onTap(e) {
  unlock(); SFX.click(); taps++;
  const n = E.clicksPerTap(state.cards, falconActive()), earned = addClicks(n);
  const b = e.currentTarget; b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 90);
  ui.floater('+' + n, e.clientX || null, e.clientY || null); ui.hud(true);
  if (taps % 10 === 0) scene.peek();
  if (earned) { SFX.tomato(); ui.flyTomato(earned); scene.tomatoEarned(pick(LINES.tomato)); }
  scheduleIdle();
}
// ---------- decisión de un lanzamiento ----------
// Perfecto: siempre cae. Cercano: solo puede caer con la carta Apagón, con más probabilidad cuanto más cerca del centro. Fallo: nunca.
export const testRng = { fn: null };   // solo para pruebas automáticas (modo ?debug)
export function decide(res, rng = testRng.fn || Math.random) {
  let fall = false;
  if (res.kind === 'perfect') fall = true;
  else if (res.kind === 'near') fall = rng() < E.nearFallChance(state.cards, res.dist, CONFIG.PERFECT_RADIUS, CONFIG.NEAR_RADIUS);
  return { fall, pesetas: fall ? E.rollFallPesetas(state.cards, rng) : 0 };
}
function speedMult() { return Math.min(CONFIG.MAX_SPEED_MULT, 1 + CONFIG.SPEED_PER_FALL * state.stats.falls); }
// ---------- lanzamiento de n tomates ----------
export async function throwTomatoes(n) {
  if (busy || !scene.ready || n < 1 || state.tomatoes < n) return false;
  if (!state.tutorialSeen) { ui.showTutorial(() => throwTomatoes(n)); return false; }
  unlock();
  if (!useTomatoes(n)) return false;                 // descuenta exactamente n
  busy = true; ui.setBusy(true); ui.closeAll();
  const results = []; let pesetas = 0;
  try {
    for (let i = 0; i < n; i++) {
      ui.volleyProgress(i + 1, n); ui.showStop(true);
      const res = await scene.startAim(speedMult());
      ui.showStop(false);
      const d = decide(res);
      registerThrow(res.kind, d); ui.hud();          // cada tomate cuenta por separado: sin recompensas duplicadas
      await scene.resolveThrow(res, d, i === n - 1);
      results.push({ ...res, ...d }); pesetas += d.pesetas;
    }
  } finally { busy = false; ui.volleyProgress(0, 0); ui.showStop(false); ui.setBusy(false); }
  if (n > 1) ui.volleySummary(results, pesetas);
  else { const r = results[0], pct = Math.round(r.precision * 100); void pct; }
  hooks.onVolleyEnd?.(results, pesetas); scheduleIdle();
  return results;
}
export function stopNow() { scene.stopAim(); }

// Controlador de juego: pulsaciones (con multiplicador por racha), lanzamientos y recompensas.
// El botón grande sirve para las dos cosas: pulsar para conseguir tomates y, mientras apuntas, lanzar.
// Lanzar ×N es UN solo tiro que vale por N tomates: si cae Pedro cuenta N caídas y N pagas de pesetas.
import { CONFIG } from './config.js';
import { state, addClicks, useTomatoes, registerThrow, falconActive } from './state.js';
import * as E from './economy.js';
import { SFX, unlock } from './audio.js';
import { LINES, pick } from './game/arena.js';

let scene, ui, hooks, busy = false, taps = 0, idleTimer = null;
const combo = { heat: 0, last: 0, mult: 1 };
export function isBusy() { return busy; }
export function comboMult() { return combo.mult; }
export function initPlay(sceneRef, uiRef, hooksRef = {}) {
  scene = sceneRef; ui = uiRef; hooks = hooksRef;
  const btn = document.querySelector('#btn-click');
  btn.addEventListener('pointerdown', onPress);
  btn.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); onPress(e); } });
  // el multiplicador se enfría si dejas de pulsar
  setInterval(tickCombo, 100);
  scheduleIdle();
}
function scheduleIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!busy && document.visibilityState === 'visible') scene.tauntIdle(pick(LINES.idle)); scheduleIdle(); }, 20000 + Math.random() * 10000);
}
// ---------- multiplicador por racha ----------
function levelFor(heat) { let m = 1; for (const l of CONFIG.COMBO.levels) if (heat >= l.heat) m = l.mult; return m; }
function tickCombo() {
  const C = CONFIG.COMBO, now = performance.now() / 1000;
  if (combo.heat > 0 && now - combo.last > C.graceSec) combo.heat = Math.max(0, combo.heat - C.decayPerSec * 0.1);
  const m = levelFor(combo.heat);
  if (m !== combo.mult) { if (m < combo.mult) SFX.ui(); combo.mult = m; }
  ui.combo(combo.mult, combo.heat, nextHeat());
}
function nextHeat() { const C = CONFIG.COMBO; const nx = C.levels.find(l => l.heat > combo.heat); return nx ? nx.heat : C.max; }
// ---------- botón grande ----------
function onPress(e) {
  unlock();
  if (scene.aim) { e.preventDefault?.(); scene.stopAim(); return; }   // apuntando: el mismo botón lanza
  onTap(e);
}
function onTap(e) {
  SFX.click(); taps++;
  const C = CONFIG.COMBO;
  combo.heat = Math.min(C.max, combo.heat + C.perTap); combo.last = performance.now() / 1000;
  const before = combo.mult; combo.mult = levelFor(combo.heat);
  if (combo.mult > before) { SFX.near(); ui.comboUp(combo.mult); }
  const n = E.clicksPerTap(state.cards, falconActive()) * combo.mult, earned = addClicks(n);
  const b = e.currentTarget; b.classList.add('pressed'); setTimeout(() => b.classList.remove('pressed'), 90);
  ui.floater('+' + n, e.clientX || null, e.clientY || null); ui.hud(true); ui.combo(combo.mult, combo.heat, nextHeat());
  if (taps % 10 === 0) scene.peek();
  if (earned) { SFX.tomato(); ui.flyTomato(earned); scene.tomatoEarned(); }
  scheduleIdle();
}
// ---------- decisión de un lanzamiento ----------
// Perfecto: siempre cae. Cercano: solo puede caer con la carta Apagón, con más probabilidad cuanto más cerca del centro. Fallo: nunca.
export const testRng = { fn: null };   // solo para pruebas automáticas (modo ?debug)
export function decide(res, n = 1, rng = testRng.fn || Math.random) {
  let fall = false;
  if (res.kind === 'perfect') fall = true;
  else if (res.kind === 'near') fall = rng() < E.nearFallChance(state.cards, res.dist, CONFIG.PERFECT_RADIUS, CONFIG.NEAR_RADIUS);
  let pesetas = 0; if (fall) for (let i = 0; i < n; i++) pesetas += E.rollFallPesetas(state.cards, rng);
  return { fall, pesetas };
}
function speedMult() {
  const begin = state.stats.tomatoesThrown < CONFIG.BEGINNER_THROWS ? CONFIG.BEGINNER_SPEED : 1;
  return begin * Math.min(CONFIG.MAX_SPEED_MULT, 1 + CONFIG.SPEED_PER_FALL * state.stats.falls);
}
// ---------- lanzamiento: un tiro que vale por n tomates ----------
export async function throwTomatoes(n) {
  if (busy || !scene.ready || n < 1 || state.tomatoes < n) return false;
  if (!state.tutorialSeen) { ui.showTutorial(() => throwTomatoes(n)); return false; }
  unlock();
  if (!useTomatoes(n)) return false;                 // descuenta exactamente n
  busy = true; ui.setBusy(true); ui.closeAll();
  let result;
  try {
    ui.showStop(true);
    const res = await scene.startAim(speedMult(), n);
    ui.showStop(false);
    const d = decide(res, n);
    registerThrow(res.kind, d, n); ui.hud();
    await scene.resolveThrow(res, d, true, n);
    result = { ...res, ...d, n };
  } finally { busy = false; ui.showStop(false); ui.setBusy(false); }
  hooks.onVolleyEnd?.([result], result.pesetas); scheduleIdle();
  return [result];
}
export function stopNow() { scene.stopAim(); }

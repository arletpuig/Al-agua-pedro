// Regalo de bienvenida: la primera vez que Pedro cae al agua baja un cofre en paracaídas.
// Se abre viendo un vídeo; si no, se queda a la izquierda (debajo de los tomates) con una cuenta atrás de 10 minutos y luego desaparece.
// El servidor guarda cuándo se ofreció y solo deja abrirlo una vez y antes de que caduque (schema_v9.sql).
import { state } from './state.js';
import { backend } from './backend.js';
import { showVideo, PLACEMENTS } from './ads.js';
import { SFX } from './audio.js';

const $ = s => document.querySelector(s);
let ui, fail, busy = false;
export const giftTest = { off: false };       // las pruebas automáticas lo desactivan mientras prueban otras cosas
const mmss = ms => { const t = Math.ceil(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const open = () => $('#gift-overlay').classList.contains('open');
const dropping = () => !$('#gift-drop').classList.contains('hidden');

export function initGift(uiRef, failFn) {
  ui = uiRef; fail = failFn;
  $('#gift-watch').addEventListener('click', watch);
  $('#gift-later').addEventListener('click', later);
  $('#gift-slot').addEventListener('click', openModal);
  setInterval(tick, 500);
}
// Tras un lanzamiento en el que Pedro ha caído
export async function maybeOffer() {
  if (giftTest.off || state.welcomeClaimed || state.welcomeOfferedAt || state.stats.falls < 1 || ui.gated()) return;
  try { await backend.offerWelcome(); } catch (e) { return; }
  if (backend.welcomeLeftMs() > 0) drop();
}
// Al entrar o recargar: si queda un regalo pendiente, vuelve a su sitio con el tiempo que le queda
export function restoreGift() {
  if (backend.welcomeLeftMs() > 0) { if (!open() && !dropping()) park(); }
  else { $('#gift-slot').classList.add('hidden'); $('#gift-overlay').classList.remove('open'); }
}
function drop() {
  const d = $('#gift-drop'), g = d.querySelector('.gd');
  ui.closeAll(); d.classList.remove('hidden', 'landed'); g.style.animation = 'none'; void g.getBoundingClientRect(); g.style.animation = '';
  SFX.near?.();
  setTimeout(() => { d.classList.add('landed'); SFX.chestOpen?.(); setTimeout(() => { d.classList.add('hidden'); openModal(); }, 450); }, 3000);
}
function openModal() { if (!backend.welcomeLeftMs()) return; $('#gift-slot').classList.add('hidden'); $('#gift-overlay').classList.add('open'); SFX.ui(); tick(); }
function later() { $('#gift-overlay').classList.remove('open'); park(); SFX.ui(); }
function park() { $('#gift-slot').classList.remove('hidden'); tick(); }
async function watch() {
  if (busy) return; busy = true; const b = $('#gift-watch'); b.disabled = true;
  try {
    const v = await showVideo(PLACEMENTS.WELCOME);
    if (!v.completed) throw new Error('No has completado el vídeo');
    const reward = await backend.claimWelcome();
    $('#gift-overlay').classList.remove('open'); $('#gift-slot').classList.add('hidden');
    await ui.chestOpening('welcome', reward); ui.hud();
  } catch (e) {
    fail(e);
    if (!backend.welcomeLeftMs()) { $('#gift-overlay').classList.remove('open'); $('#gift-slot').classList.add('hidden'); }
  }
  busy = false; b.disabled = false;
}
function tick() {
  const left = backend.welcomeLeftMs(), slot = $('#gift-slot');
  $('#gift-left').textContent = mmss(left); $('#gift-timer').textContent = mmss(left);
  slot.classList.toggle('urgent', left > 0 && left < 60000);
  if (!left && !busy && (!slot.classList.contains('hidden') || open())) {
    slot.classList.add('hidden'); $('#gift-overlay').classList.remove('open');
    if (!state.welcomeClaimed) ui.showToast('💨 El regalo de bienvenida ha caducado', 2800);
  }
}

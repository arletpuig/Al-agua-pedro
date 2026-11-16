// Instalar el juego como app (sin tiendas): en Android, el aviso propio del navegador; en iPhone, los pasos de Safari.
// Regalo: la primera vez que se abre el juego desde la app instalada (cofre de diamante + 150 pesetas, una sola vez por cuenta).
import { state } from './state.js';
import { backend } from './backend.js';
import { SFX } from './audio.js';

const $ = s => document.querySelector(s);
const LATER_KEY = 'alaguapedro.installLater';
let ui, fail, isBusy, deferred = null, offered = false, claiming = false;
export const installTest = { off: !!window.__AAP_NOINSTALL };
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function initInstall(uiRef, busyFn, failFn) {
  ui = uiRef; isBusy = busyFn; fail = failFn;
  // Android (Chrome, Edge, Samsung...): el navegador avisa de que se puede instalar; se guarda para lanzarlo con nuestro botón
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; refresh(); });
  addEventListener('appinstalled', () => { deferred = null; close(); SFX.upgrade(); ui.showToast('📲 ¡App instalada! Ábrela desde tu pantalla de inicio para recoger tu regalo', 4500); });
  $('#install-go').addEventListener('click', go);
  $('#install-later').addEventListener('click', later);
  $('#btn-install').addEventListener('click', () => { ui.closeAll(); open(); });
  if ('serviceWorker' in navigator && !window.__AAP_NOSW) navigator.serviceWorker.register('./sw.js').catch(() => {});
  refresh();
}
// fila de Ajustes: solo si se puede instalar y no se ha recogido el regalo
export function refresh() { $('#btn-install')?.classList.toggle('hidden', isStandalone() || !!state.installClaimed); }

const screenBusy = () => !!document.querySelector('.panel.open, .overlay.open, .gift-drop:not(.hidden), #tour') || isBusy?.() || ui.gated();
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function whenFree() { let ok = 0; while (ok < 3) { await sleep(400); ok = screenBusy() ? 0 : ok + 1; } }
// Tras jugar un poco (desde el nivel 2), una vez por sesión y no antes de 3 días si dijo «Ahora no»
export async function maybeOffer(level) {
  if (installTest.off || offered || isStandalone() || state.installClaimed || level < 2) return;
  let later = 0; try { later = +localStorage.getItem(LATER_KEY) || 0; } catch (e) {}
  if (Date.now() - later < 3 * 86400e3) return;
  offered = true; await whenFree(); open();
}
export function open() {
  const mode = deferred ? 'android' : isIOS() ? 'ios' : 'other';
  const ov = $('#install-overlay'); ov.dataset.mode = mode;
  $('#install-ios').classList.toggle('hidden', mode !== 'ios');
  $('#install-other').classList.toggle('hidden', mode !== 'other');
  $('#install-go span').textContent = mode === 'android' ? '¡INSTALAR!' : '¡ENTENDIDO!';
  ov.classList.add('open'); SFX.chestOpen?.();
}
function close() { $('#install-overlay').classList.remove('open'); }
async function go() {
  if (!deferred) { close(); return; }
  try { deferred.prompt(); const r = await deferred.userChoice; if (r?.outcome !== 'accepted') ui.showToast('Cuando quieras, en Ajustes → Instalar la app', 2600); }
  catch (e) {}
  deferred = null; close();
}
function later() { try { localStorage.setItem(LATER_KEY, String(Date.now())); } catch (e) {} close(); SFX.ui(); }
// Abierto desde la app instalada: el regalo (una sola vez por cuenta)
export async function checkReward() {
  if (installTest.off || claiming || !isStandalone() || state.installClaimed) return;
  claiming = true;
  try {
    await whenFree();
    const reward = await backend.claimInstall();
    ui.showToast('📲 ¡Gracias por instalar la app! Aquí tienes tu regalo', 3200); SFX.levelUp?.();
    await ui.chestOpening('diamond', reward); ui.hud();
    if (reward.extra) ui.pesetaGain(reward.extra);
  } catch (e) { if (!/Ya has recogido/.test(e.message)) fail?.(e); }
  claiming = false; refresh();
}

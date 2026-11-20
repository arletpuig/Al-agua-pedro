// Avisos (notificaciones push): «tu cofre diario está listo» por la mañana y un recordatorio por la tarde si no has jugado.
// Los manda el servidor (función «avisos», cada hora); aquí se piden los permisos y se guarda la suscripción de este aparato.
import { state } from './state.js';
import * as sb from './supabase.js';
import { SFX } from './audio.js';

const $ = s => document.querySelector(s);
const ASKED_KEY = 'alaguapedro.pushAsked';
let ui, fail, busy = false;
export const pushTest = { off: false };

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const b64 = s => { const p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };
async function currentSub() { try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch (e) { return null; } }
export async function enabled() { return supported() && Notification.permission === 'granted' && !!(await currentSub()); }

export function initPush(uiRef, failFn) {
  ui = uiRef; fail = failFn;
  $('#btn-push')?.addEventListener('click', () => { SFX.ui(); toggle(); });
  $('#push-yes')?.addEventListener('click', async () => { SFX.ui(); close(); await turnOn(); });
  $('#push-no')?.addEventListener('click', () => { SFX.ui(); close(); });
  refresh();
}
export async function refresh() {
  const on = await enabled(); $('#sw-push')?.classList.toggle('on', on);
  const sm = $('#btn-push small'); if (sm) sm.textContent = on ? 'Activados' : !supported() ? (isIOS() && !standalone() ? 'Instala la app para recibirlos' : 'Este navegador no los admite') : Notification.permission === 'denied' ? 'Bloqueados en el navegador' : 'Cofre diario y recordatorios';
}
async function toggle() { if (busy) return; if (await enabled()) await turnOff(); else await turnOn(); }

export async function turnOn() {
  if (busy) return false; busy = true;
  try {
    if (!supported()) { ui.showToast(isIOS() && !standalone() ? '📲 En iPhone, los avisos llegan con la app instalada: añádela a la pantalla de inicio' : 'Este navegador no admite avisos', 4200); return false; }
    if (!sb.auth.user) { ui.showToast('Entra con tu cuenta para recibir avisos', 3000); return false; }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { ui.showToast(perm === 'denied' ? '🔕 Los avisos están bloqueados: actívalos en los ajustes del navegador' : 'Sin avisos por ahora', 4000); return false; }
    const key = await sb.pushPublicKey(); if (!key) throw new Error('Los avisos aún no están listos en el servidor');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
    await save(sub);
    ui.showToast('🔔 ¡Avisos activados! Te diremos cuándo está listo tu cofre', 3400); SFX.upgrade?.();
    return true;
  } catch (e) { fail?.(e); return false; }
  finally { busy = false; refresh(); }
}
async function turnOff() {
  busy = true;
  try { const sub = await currentSub(); if (sub) { try { await sb.deletePushSub(sub.endpoint); } catch (e) {} await sub.unsubscribe(); } ui.showToast('🔕 Avisos desactivados', 2400); }
  catch (e) { fail?.(e); }
  finally { busy = false; refresh(); }
}
async function save(sub) { const j = sub.toJSON(); await sb.savePushSub(j.endpoint, j.keys.p256dh, j.keys.auth); }
// al entrar con la cuenta: si este aparato ya tenía los avisos, se vuelven a guardar a su nombre
export async function afterLogin() { try { if (supported() && Notification.permission === 'granted') { const sub = await currentSub(); if (sub) await save(sub); } } catch (e) {} refresh(); }

// después de abrir el cofre diario: «¿Te aviso mañana?» (como mucho una vez cada 3 días; nunca si ya están o están bloqueados)
export async function offer() {
  if (pushTest.off || !supported() || !sb.auth.user || Notification.permission !== 'default' || await enabled()) return;
  let last = 0; try { last = +localStorage.getItem(ASKED_KEY) || 0; } catch (e) {}
  if (Date.now() - last < 3 * 86400e3) return;
  try { localStorage.setItem(ASKED_KEY, String(Date.now())); } catch (e) {}
  $('#push-overlay').classList.add('open'); SFX.ui();
}
function close() { $('#push-overlay').classList.remove('open'); }

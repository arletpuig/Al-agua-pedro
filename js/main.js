// Punto de entrada: une estado, juego, interfaz y cuenta.
import { CONFIG } from './config.js';
import { state, load, onChange, applyServer } from './state.js';
import * as ui from './ui.js';
import * as game from './game.js';
import * as sb from './supabase.js';
import { setEnabled } from './audio.js';

const $ = s => document.querySelector(s);
let username = null, saveTimer = null, saving = false, pendingSave = false, lastSent = null;

load();
setEnabled(state.sound); ui.setSoundUI(state.sound);
ui.bindStatic(); ui.updateCounters();
game.init(ui);

// ---------- sincronización con la nube ----------
function derive() { // mantiene las invariantes: tomates = conseguidos - lanzados
  state.stats.tomatoesEarned = Math.floor(state.stats.totalClicks / CONFIG.CLICKS_PER_TOMATO);
  state.clicks = state.stats.totalClicks % CONFIG.CLICKS_PER_TOMATO;
  state.tomatoes = state.stats.tomatoesEarned - state.stats.tomatoesThrown;
}
function mergeServer(row, sent) {
  // Aplica los valores del servidor sumando lo que ha pasado localmente desde que se envió.
  const s = state.stats, d = sent || s;
  s.totalClicks = row.total_clicks + (s.totalClicks - d.totalClicks);
  s.tomatoesThrown = row.tomatoes_thrown + (s.tomatoesThrown - d.tomatoesThrown);
  s.hits = row.hits + (s.hits - d.hits); s.falls = row.falls + (s.falls - d.falls);
  derive(); applyServer({ total_clicks: s.totalClicks, tomatoes_earned: s.tomatoesEarned, tomatoes_thrown: s.tomatoesThrown, hits: s.hits, falls: s.falls, tomatoes: state.tomatoes, clicks_progress: state.clicks });
  ui.updateCounters();
}
async function pushNow(keepalive = false) {
  if (!sb.auth.user) return;
  if (saving) { pendingSave = true; return; }
  saving = true; const sent = { ...state.stats };
  try {
    const row = await sb.saveProgress(sent, keepalive);
    if (row) mergeServer(row, sent);
    ui.saveStatus('☁️ Guardado en la nube'); setTimeout(() => ui.saveStatus(''), 2000);
  } catch (e) { ui.saveStatus('⚠️ No se pudo guardar: ' + e.message); }
  saving = false;
  if (pendingSave) { pendingSave = false; pushNow(); }
}
onChange(() => { if (sb.auth.user) { clearTimeout(saveTimer); saveTimer = setTimeout(() => pushNow(), CONFIG.AUTOSAVE_MS); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && sb.auth.user && state.dirty) pushNow(true); });

async function afterLogin(user) {
  try {
    let row = await sb.getProfile();
    username = row?.username || user.user_metadata?.username || null;
    ui.setAccountUI(user, username);
    if (row && row.total_clicks >= state.stats.totalClicks) { lastSent = null; mergeServer(row, state.stats); ui.showToast('☁️ Progreso cargado de tu cuenta'); }
    else { await pushNow(); ui.showToast('☁️ Progreso local guardado en tu cuenta'); }
  } catch (e) { ui.showToast('⚠️ No se pudo cargar tu progreso: ' + e.message, 4000); }
}

// ---------- cuenta ----------
const hasBackend = sb.hasBackend();
$('#btn-account').addEventListener('click', () => { ui.openModal('#modal-account'); if (!hasBackend) ui.accMsg('Las cuentas no están configuradas en esta versión.', 'err'); });
$('#btn-rank').addEventListener('click', async () => {
  ui.openModal('#modal-rank'); ui.renderRank([], 'Cargando...');
  try { ui.renderRank(await sb.leaderboard()); } catch (e) { ui.renderRank([], 'No se pudo cargar el ranking: ' + e.message); }
});
function busyForm(form, v) { form.querySelectorAll('button,input').forEach(el => el.disabled = v); }
$('#form-register').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target; busyForm(f, true); ui.accMsg('Creando cuenta...');
  try {
    const r = await sb.signUp(f.email.value.trim(), f.password.value, f.username.value.trim());
    if (r.needsConfirm) ui.accMsg('✅ Cuenta creada. Revisa tu correo y confirma el enlace; después inicia sesión.', 'ok');
    else { ui.accMsg('✅ ¡Cuenta creada!', 'ok'); await afterLogin(r.user); }
    f.reset();
  } catch (err) { ui.accMsg('❌ ' + traducir(err.message), 'err'); }
  busyForm(f, false);
});
$('#form-login').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target; busyForm(f, true); ui.accMsg('Entrando...');
  try { const u = await sb.signIn(f.email.value.trim(), f.password.value); ui.accMsg('✅ Sesión iniciada', 'ok'); f.reset(); await afterLogin(u); }
  catch (err) { ui.accMsg('❌ ' + traducir(err.message), 'err'); }
  busyForm(f, false);
});
$('#form-recover').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target; busyForm(f, true); ui.accMsg('Enviando...');
  try { await sb.recover(f.email.value.trim()); ui.accMsg('✅ Si el correo existe, recibirás un enlace para cambiar la contraseña.', 'ok'); }
  catch (err) { ui.accMsg('❌ ' + traducir(err.message), 'err'); }
  busyForm(f, false);
});
$('#form-newpass').addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target; busyForm(f, true); ui.accMsg('Guardando...');
  try { await sb.updatePassword(f.password.value); const u = await sb.fetchUser(); f.reset(); ui.showTab('login'); ui.accMsg('✅ Contraseña cambiada', 'ok'); await afterLogin(u); }
  catch (err) { ui.accMsg('❌ ' + traducir(err.message), 'err'); }
  busyForm(f, false);
});
$('#btn-logout').addEventListener('click', async () => {
  if (state.dirty) await pushNow();
  await sb.signOut(); username = null; ui.setAccountUI(null); ui.showTab('login'); ui.showToast('Sesión cerrada. El progreso sigue en este navegador.');
});
function traducir(m) {
  const t = { 'Invalid login credentials': 'Correo o contraseña incorrectos', 'User already registered': 'Ese correo ya tiene cuenta', 'Email not confirmed': 'Confirma tu correo antes de entrar', 'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres', 'Failed to fetch': 'Sin conexión con el servidor' };
  for (const k in t) if (m.includes(k)) return t[k];
  return m;
}

// ---------- arranque de sesión ----------
(async () => {
  if (!hasBackend) return;
  try {
    if (sb.consumeRecoveryHash()) { ui.openModal('#modal-account'); ui.showTab('newpass'); ui.accMsg('Escribe tu nueva contraseña'); return; }
  } catch (e) { ui.openModal('#modal-account'); ui.accMsg('❌ ' + e.message, 'err'); }
  const user = await sb.restoreSession();
  if (user) afterLogin(user);
})();

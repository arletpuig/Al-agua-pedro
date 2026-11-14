// Punto de entrada: une estado, escena Phaser, interfaz, economía y cuenta.
import { CONFIG } from './config.js';
import { state, load, onChange, applyServer, snapshot, hasProgress, resetProgress, falconActive } from './state.js';
import * as ui from './ui.js';
import * as sb from './supabase.js';
import * as E from './economy.js';
import { backend } from './backend.js';
import { createGame } from './game/boot.js';
import { initPlay, throwTomatoes, stopNow, isBusy, testRng } from './play.js';
import { setEnabled, SFX, unlock } from './audio.js';
import * as Shop from './shop.js';

const $ = s => document.querySelector(s);
let username = null, saveTimer = null, saving = null, falconWas = false, opening = false, inShop = false, switching = false, itemBusy = false;

load();
setEnabled(state.sound);
const { scene, shop } = createGame('game');
ui.init({ onThrow: n => throwTomatoes(n), onStop: stopNow, onBuyChest: buyChest, onClaimDaily: claimDaily, onUpgrade: upgrade, onAd: watchAd, onRank: showRank,
  onEnterShop: enterShop, onLeaveShop: () => leaveShop(), onPickItem: id => shop.ready ? shop.select(id) : ui.renderShopDock(id), onBuyItem: buyItem, onUseItem: useItem });
ui.setSoundUI(state.sound, state.music); ui.hud();
const start = () => { ui.loadingOff(); initPlay(scene, ui, { onVolleyEnd: () => pushNow() }); };
scene.ready ? start() : scene.bus.once('ready', start);
onChange(() => ui.hud());
backend.syncTime().then(() => ui.hud());
setInterval(() => {                       // reloj: Falcón, punto de cofre diario
  const on = falconActive(); if (on && !falconWas) { scene.falconFly?.(); ui.showToast('✈️ ¡El Falcón despega! Clics ×5'); } falconWas = on;
  ui.hud(); if ($('#panel-shop').classList.contains('open')) ui.renderShop();
}, 1000);
if (location.search.includes('debug')) window.AAP = { state, scene, shop, backend, E, ui, testRng, Shop, enterShop, leaveShop, useItem };

// ---------- economía ----------
const fail = e => { SFX.error(); ui.showToast(traducir(e.message), 2600, true); };
async function buyChest(kind) {
  if (opening || isBusy()) return; opening = true;
  try { const reward = await backend.openChest(kind); ui.closeAll(); await ui.chestOpening(kind, reward); ui.openPanel('#panel-chests'); } catch (e) { fail(e); ui.renderChests(); }
  opening = false;
}
async function claimDaily() {
  if (opening || isBusy()) return; opening = true;
  try { await backend.syncTime(); const reward = await backend.claimDaily(); ui.closeAll(); await ui.chestOpening('wood', reward); ui.openPanel('#panel-chests'); } catch (e) { fail(e); ui.renderChests(); }
  opening = false;
}
async function upgrade(id) {
  if (opening) return; opening = true;
  try { await backend.upgradeCard(id); SFX.upgrade(); ui.renderCards(id); ui.showToast(`⬆️ ${E.CARDS[id].name} sube a nivel ${E.level(state.cards, id)}`); } catch (e) { fail(e); ui.renderCards(); }
  opening = false;
}
async function watchAd(placement) { try { await backend.watchAd(placement); ui.renderShop(); } catch (e) { fail(e); } }
async function showRank() {
  ui.renderRank([], 'Cargando...');
  try { ui.renderRank(await sb.leaderboard(), null, username); } catch (e) { ui.renderRank([], 'No se pudo cargar el ranking. Inténtalo más tarde.'); }
}

// ---------- La Trastienda ----------
shop.bus.on('select', id => ui.renderShopDock(id));
function enterShop() {
  if (inShop || switching) return;
  if (!Shop.isUnlocked()) { SFX.error(); ui.showToast(`🕶️ Psst... vuelve cuando hayas tirado a Pedro ${Shop.SHOP.UNLOCK_FALLS} veces (${Shop.unlockProgress()}/${Shop.SHOP.UNLOCK_FALLS})`, 3000); return; }
  if (isBusy() || scene.busy || scene.aim) return;
  unlock(); ui.closeAll(); inShop = true; switching = true;
  document.body.classList.add('in-shop'); ui.renderShopDock(null); SFX.ui();
  scene.cameras.main.fadeOut(220, 5, 3, 10);
  scene.cameras.main.once('camerafadeoutcomplete', () => { scene.scene.switch('shop'); scene.cameras.main.resetFX(); switching = false; });
}
function leaveShop() {
  if (!inShop || switching) return Promise.resolve();
  switching = true; shop.leave(); SFX.ui();
  return new Promise(res => {
    shop.cameras.main.fadeOut(220, 5, 3, 10);
    shop.cameras.main.once('camerafadeoutcomplete', () => {
      shop.cameras.main.resetFX(); shop.scene.switch('main'); scene.cameras.main.fadeIn(260, 5, 3, 10);
      inShop = false; switching = false; document.body.classList.remove('in-shop'); ui.hud(); res();
    });
  });
}
async function buyItem(id) {
  if (opening) return; const it = Shop.ITEM[id];
  if (!it.premium && !Shop.isOwned(id) && state.pesetas < it.price) { SFX.error(); shop.refuse(); ui.showToast(`Te faltan ${it.price - state.pesetas} pesetas`, 2200, true); return; }
  opening = true;
  try { await backend.buyShopItem(id); SFX.kaching(); await shop.sold(id); ui.renderShopDock(id); ui.showToast(`🕶️ ${it.name} es tuyo para siempre`); }
  catch (e) { fail(e); }
  opening = false;
}
// Lanza un objeto a Pedro (propio o de prueba). Desde el puesto, primero vuelve a la feria.
async function useItem(id, demo) {
  if (itemBusy || isBusy() || scene.busy || scene.aim) return;
  if (!demo && !Shop.isOwned(id)) return;
  if (demo && !Shop.SHOP.FREE_TRY) return;
  itemBusy = true; ui.setBusy(true);
  try {
    if (inShop) { await leaveShop(); await new Promise(r => setTimeout(r, 300)); }
    if (demo) ui.demoBadge(true, Shop.ITEM[id].name);
    await scene.useItem(id);
  } finally { ui.demoBadge(false); itemBusy = false; ui.setBusy(false); }
}

// ---------- sincronización con la nube ----------
function pushNow(keepalive = false) {
  if (!sb.auth.user) return Promise.resolve();
  if (saving) return saving.then(() => state.dirty ? pushNow(keepalive) : null);
  const sent = snapshot();
  saving = sb.saveProgress(sent, keepalive)
    .then(row => { applyServer(row, sent); ui.saveStatus('☁️ Guardado en la nube'); setTimeout(() => ui.saveStatus(''), 2000); })
    .catch(() => ui.saveStatus('⚠️ Sin conexión: se guardará más tarde'))
    .finally(() => { saving = null; });
  return saving;
}
backend.setFlush(() => state.dirty ? pushNow() : Promise.resolve());
onChange(() => { if (sb.auth.user && state.dirty) { clearTimeout(saveTimer); saveTimer = setTimeout(() => pushNow(), CONFIG.AUTOSAVE_MS); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && sb.auth.user && state.dirty) pushNow(true); });

async function afterLogin(user) {
  try {
    let row = await sb.getProfile();
    username = row?.username || user.user_metadata?.username || null; ui.setAccountUI(user, username);
    const serverEmpty = !row || (+row.total_clicks === 0 && row.chests_opened === 0 && row.tomatoes_thrown === 0);
    state.updatedAt = null;
    if (serverEmpty && hasProgress()) {       // primera vez: se sube el progreso de invitado (una sola vez, validado y con topes)
      const s = state.stats;
      row = await sb.importGuest({ totalClicks: s.totalClicks, tomatoesThrown: s.tomatoesThrown, hits: s.hits, perfects: s.perfects, falls: s.falls, pesetasEarned: s.pesetasEarned, chestTomatoes: s.chestTomatoes, chestPesetas: s.chestPesetas, pesetasSpent: s.pesetasSpent, chestsOpened: s.chestsOpened, cards: state.cards, dailyClaimedOn: state.dailyClaimedOn });
      applyServer(row); ui.showToast('☁️ Tu progreso se ha guardado en tu cuenta');
    } else if (row) { applyServer(row); ui.showToast('☁️ Progreso cargado de tu cuenta'); }
    if (row) Shop.applyServerItems(row.shop_items);
    ui.hud();
  } catch (e) { ui.showToast('No se pudo cargar tu progreso. Inténtalo más tarde.', 3500, true); }
}

// ---------- cuenta ----------
const hasBackend = sb.hasBackend();
$('#btn-account').addEventListener('click', () => { ui.openPanel('#panel-account'); if (!hasBackend) ui.accMsg('Las cuentas no están disponibles en esta versión.', 'err'); });
function busyForm(form, v) { form.querySelectorAll('button,input').forEach(el => el.disabled = v); }
function onForm(id, fn) { $(id).addEventListener('submit', async e => { e.preventDefault(); const f = e.target; busyForm(f, true); try { await fn(f); } catch (err) { ui.accMsg('❌ ' + traducir(err.message), 'err'); } busyForm(f, false); }); }
onForm('#form-register', async f => {
  ui.accMsg('Creando cuenta...');
  const r = await sb.signUp(f.email.value.trim(), f.password.value, f.username.value.trim()); f.reset();
  if (r.needsConfirm) ui.accMsg('✅ Cuenta creada. Revisa tu correo y confirma el enlace; después inicia sesión.', 'ok');
  else { ui.accMsg('✅ ¡Cuenta creada!', 'ok'); await afterLogin(r.user); }
});
onForm('#form-login', async f => { ui.accMsg('Entrando...'); const u = await sb.signIn(f.email.value.trim(), f.password.value); f.reset(); ui.accMsg('✅ Sesión iniciada', 'ok'); await afterLogin(u); });
onForm('#form-recover', async f => { ui.accMsg('Enviando...'); await sb.recover(f.email.value.trim()); ui.accMsg('✅ Si el correo existe, recibirás un enlace para cambiar la contraseña.', 'ok'); });
onForm('#form-newpass', async f => { ui.accMsg('Guardando...'); await sb.updatePassword(f.password.value); const u = await sb.fetchUser(); f.reset(); ui.showTab('login'); ui.accMsg('✅ Contraseña cambiada', 'ok'); await afterLogin(u); });
$('#btn-logout').addEventListener('click', async () => {
  if (state.dirty) await pushNow();
  await sb.signOut(); username = null; resetProgress(); Shop.resetShop(); ui.setAccountUI(null); ui.showTab('login'); ui.hud(); ui.showToast('Sesión cerrada. Tu progreso queda guardado en tu cuenta.');
});
function traducir(m = '') {
  const t = { 'Invalid login credentials': 'Correo o contraseña incorrectos', 'User already registered': 'Ese correo ya tiene cuenta', 'Email not confirmed': 'Confirma tu correo antes de entrar', 'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres', 'Failed to fetch': 'Sin conexión con el servidor', 'NetworkError': 'Sin conexión con el servidor', 'rate limit': 'Demasiados intentos. Espera un momento.', 'Could not find the function': 'El servidor todavía no está actualizado. Inténtalo más tarde.', 'schema cache': 'El servidor todavía no está actualizado. Inténtalo más tarde.', 'weak': 'La contraseña es demasiado débil', 'invalid format': 'El correo no es válido', 'security purposes': 'Demasiados intentos. Espera un momento.' };
  for (const k in t) if (m.includes(k)) return t[k];
  // solo se muestran tal cual los mensajes propios del juego (en castellano); cualquier otro error técnico se sustituye
  return /^(No |Ya |Te faltan|La carta|Los anuncios|Necesitas|El perfil|Cofre|Carta|Si el correo|Los pagos|Ese objeto|La trastienda)/.test(m) ? m : 'No se ha podido completar la acción. Inténtalo de nuevo.';
}
// ---------- arranque de sesión ----------
(async () => {
  if (!hasBackend) return;
  try { if (sb.consumeRecoveryHash()) { ui.openPanel('#panel-account'); ui.showTab('newpass'); ui.accMsg('Escribe tu nueva contraseña'); return; } }
  catch (e) { ui.openPanel('#panel-account'); ui.accMsg('❌ ' + traducir(e.message), 'err'); }
  const user = await sb.restoreSession();
  if (user) afterLogin(user);
})();

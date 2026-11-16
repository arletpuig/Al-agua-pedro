// Punto de entrada: une estado, escena (canvas), interfaz, economía y cuenta.
import './nozoom.js';
import { applyDarkFix, maybeWarnDark } from './darkfix.js';
import { checkVersion } from './update.js';
import { initGuard, guardTest } from './guard.js';
applyDarkFix();   // Samsung Internet en modo oscuro: contornos de las letras que el navegador no puede aclarar   // iPhone: sin zoom ni movimientos al pulsar rápido
import { CONFIG } from './config.js';
import { state, load, onChange, applyServer, snapshot, hasProgress, resetProgress, falconActive } from './state.js';
import * as ui from './ui.js';
import * as sb from './supabase.js';
import * as E from './economy.js';
import { backend } from './backend.js';
import { createArena } from './game/arena.js';
import { initPlay, throwTomatoes, stopNow, isBusy, testRng, paguitaTest, CHAT, streakTest } from './play.js';
import { setEnabled, SFX } from './audio.js';
import { DEFAULT_AVATAR } from './avatars.js';
import { renderShareCard, canvasBlob, defaultTitle } from './share.js';
import { initGift, maybeOffer, restoreGift, giftTest } from './gift.js';
import { showVideo, PLACEMENTS, videosOn } from './ads.js';
import { initPayments, openPack, consumeReturn, awaitPurchase } from './payments.js';
import { maybeTour, startTour, tourTest } from './tour.js';
import { initLevels, afterThrow, syncChip, checkPending, levelTest, openWheelFrom } from './levelup.js';
import { levelName, levelOf } from './levels.js';
import { initInstall, maybeOffer as offerInstall, checkReward as installReward, refresh as installRefresh, installTest, open as openInstall } from './install.js';
import { initArmory, armoryTest } from './armory.js';
const payReturn = consumeReturn();   // vuelta de la página de pago de Stripe

const $ = s => document.querySelector(s);
let saveTimer = null, saving = null, falconWas = false, opening = false, shareFile = null, shareURL = null;
// Hay que jugar con cuenta. Solo las pruebas automáticas pueden jugar sin ella (?debug&guest).
// La versión de pruebas (GitHub) juega sin cuenta y empieza siempre desde cero (index.html borra el progreso local al cargar).
const TEST_HOST = !!window.__AAP_TEST;
const GUEST_OK = TEST_HOST || (location.search.includes('debug') && /[?&]guest\b/.test(location.search));
const PROFILE_KEY = 'alaguapedro.profile';
const profile = { name: null, avatar: null, title: null, region: null, email: '', rank: null };
try { Object.assign(profile, JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}); } catch (e) {}

window.__aapStep?.('Iniciando');
load();
setEnabled(state.sound);
const { scene } = createArena('game', { top: 92, bottom: 252 });   // arriba: barra de nivel y marcador
ui.init({ onThrow: n => throwTomatoes(n), onStop: stopNow, onBuyChest: buyChest, onClaimDaily: claimDaily, onUpgrade: upgrade, onAd: watchAd, onRank: showRank,
  onProfile: showProfile, onAvatar: pickAvatar, onRename: rename, onRegion: saveRegion, onRegions: showRegions, onRegionOpen: showRegionPlayers, onPack: id => openPack(id), onWheel: src => openWheelFrom(src), onHelp: () => startTour(), onShare: share, onShareGo: shareGo, onShareSave: shareSave });
ui.setAccountUI(null, null, profile.avatar || DEFAULT_AVATAR);
// con un panel o una ventana delante, el escenario se dibuja más despacio
new MutationObserver(() => { scene.covered = !!document.querySelector('.panel.open, .overlay.open'); }).observe($('#app'), { subtree: true, attributes: true, attributeFilter: ['class'] });
ui.setSoundUI(state.sound, state.music); ui.hud(); ui.streak();
// Pedro provocando en la pantalla de acceso (un fotograma real de la escena)
function gatePedro() {
  const cv = $('#gate-pedro'); if (!cv) return;
  const big = document.createElement('canvas'); big.width = 1080; big.height = 1920; scene.poster(big.getContext('2d'), 'peineta', 2.4);
  cv.getContext('2d').drawImage(big, 290, 296, 320, 405, 0, 0, 300, 380);
}
const start = () => {
  try { gatePedro(); } catch (e) {}
  window.__aapReady = true; ui.loadingOff(); initPlay(scene, ui, { onVolleyEnd: r => { afterThrow(); pushNow(); if (r?.[0]?.fall) maybeOffer(); offerInstall(levelOf(state.stats)); } });
  initInstall(ui, isBusy, e => fail(e)); if (!ui.gated()) installReward();
  initArmory(ui, scene, isBusy, e => fail(e), openInstall);   // La Armería (nivel 10) y la mochila
  initGuard(ui);     // anti-autoclicker
  maybeWarnDark();   // Samsung Internet en modo oscuro: cómo verlo con sus colores
  // ¿hay una versión nueva publicada? (también al volver a la app tras un rato): se actualiza sola
  checkVersion(); let lastCheck = Date.now();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Date.now() - lastCheck > 300e3) { lastCheck = Date.now(); checkVersion(); } });
  initLevels(ui, isBusy, e => fail(e), async () => { if (!sb.auth.user) return; await pushNow(); const row = await sb.getProfile(); state.updatedAt = null; applyServer(row); ui.hud(); });
  initGift(ui, e => fail(e)); if (!ui.gated()) { restoreGift(); maybeTour(); checkPending(); }
  initPayments(ui, e => fail(e), async () => { const row = await sb.getProfile(); state.updatedAt = null; applyServer(row); ui.hud(); }, pack => { if (pack === 'ruleta') openWheelFrom('legend'); });
  if (state.welcome && !ui.gated()) setTimeout(() => ui.showToast(`🎁 ¡Regalo de bienvenida! ${CONFIG.WELCOME.tomatoes} tomates y ${CONFIG.WELCOME.pesetas} pesetas para empezar`, 4200), 900);
};
scene.ready ? start() : scene.bus.once('ready', start);
onChange(() => { ui.hud(); syncChip('auto'); });
backend.syncTime().then(() => ui.hud());
setInterval(() => {                       // reloj: Falcón, punto de cofre diario
  const on = falconActive(); if (on && !falconWas) { scene.falconFly?.(); ui.showToast('✈️ ¡El Falcón despega! Clics ×5'); } falconWas = on;
  ui.hud(); if ($('#panel-shop').classList.contains('open')) ui.shopTick();
}, 1000);
if (location.search.includes('debug')) import('./ads.js').then(m => { window.AAP = { ...(window.AAP || {}), adsTest: m.adsTest }; });
if (location.search.includes('debug')) window.AAP = { state, scene, backend, E, ui, testRng, giftTest, tourTest, levelTest, paguitaTest, CHAT, streakTest, installTest, guardTest, armoryTest };

// ---------- economía ----------
const fail = e => { SFX.error(); ui.showToast(traducir(e.message), 2600, true); };
// Abrir 1, 3 o 10 cofres seguidos: se enseñan juntos (las cartas repetidas se suman)
function mergeRewards(kind, list) {
  const out = { kind, cards: [], tomatoes: 0, pesetas: 0, refund: 0, count: list.length }, by = new Map();
  for (const r of list) {
    out.tomatoes += r.tomatoes || 0; out.pesetas += r.pesetas || 0; out.refund += r.refund || 0;
    for (const c of r.cards || []) { const p = by.get(c.id); if (!p) by.set(c.id, { ...c }); else { p.frags = (p.frags || 0) + (c.frags || 0); p.isNew = p.isNew || c.isNew; p.locked = c.locked; p.have = c.have; p.need = c.need; } }
  }
  out.cards = [...by.values()]; return out;
}
async function buyChest(kind, n = 1) {
  if (opening || isBusy()) return; opening = true;
  const got = [];
  try {
    for (let i = 0; i < n; i++) got.push(await backend.openChest(kind));
  } catch (e) { fail(e); }
  if (got.length) {
    const reward = got.length > 1 ? mergeRewards(kind, got) : got[0];
    ui.closeAll(); await ui.chestOpening(kind, reward); ui.openPanel('#panel-shop'); if (reward.refund) ui.pesetaGain(reward.refund);
  } else ui.renderShop();
  opening = false;
}
async function claimDaily() {
  if (opening || isBusy()) return; opening = true;
  try { await backend.syncTime(); const reward = await backend.claimDaily(); ui.closeAll(); await ui.chestOpening('wood', reward); ui.openPanel('#panel-shop'); } catch (e) { fail(e); ui.renderShop(); }
  opening = false;
}
async function upgrade(id) {
  if (opening) return; opening = true;
  try {
    const b = await backend.upgradeCard(id); SFX.upgrade(); ui.renderCards(id);
    ui.showToast(`⬆️ ${E.CARDS[id].name} sube a nivel ${E.level(state.cards, id)}`);
    if (b.refund) ui.pesetaGain(b.refund, document.querySelector(`#cards-grid [data-upgrade="${id}"]`) || document.querySelector(`#cards-grid .card[data-id="${id}"]`));
    if (b.tomatoes) setTimeout(() => ui.tomatoGain(b.tomatoes, document.querySelector(`#cards-grid .card[data-id="${id}"]`)), b.refund ? 350 : 0);
  } catch (e) { fail(e); ui.renderCards(); }
  opening = false;
}
let watching = false;
async function watchAd(placement) {
  if (watching) return; watching = true;
  try {
    const spins0 = state.legendSpins;
    await backend.watchAd(placement); ui.renderShop();
    if (placement === 'sobre') { SFX.coin(); ui.pesetaGain(E.SOBRE.pesetas); }
    if (placement === 'ruleta') { if (state.legendSpins > spins0) { SFX.upgrade(); openWheelFrom('legend'); } else { SFX.ui(); ui.showToast(`🎬 Vídeo ${state.legendAds} de 3 para la ruleta legendaria`); } }
  }
  catch (e) { fail(e); ui.renderShop(); }
  watching = false;
}
async function showRegions() {
  ui.renderRegions([], 'Cargando...');
  try { ui.renderRegions(await sb.regionRanking(), null, profile.region); } catch (e) { ui.renderRegions([], 'No se pudo cargar el ranking. Inténtalo más tarde.'); }
}
async function showRegionPlayers(region) {
  ui.renderRegionPlayers(region, [], 'Cargando...');
  try { ui.renderRegionPlayers(region, await sb.regionLeaders(region), null, profile.name); } catch (e) { ui.renderRegionPlayers(region, [], 'No se pudo cargar. Inténtalo más tarde.'); }
}
async function showRank() {
  ui.rankTab('players');
  ui.renderRank([], 'Cargando...');
  try {
    const rows = await sb.leaderboard(); ui.renderRank(rows, null, profile.name);
    if (sb.auth.user && !rows.some(r => r.username === profile.name)) try { profile.rank = await sb.myRank(); ui.renderRank(rows, null, profile.name, profile.rank); } catch (e) {}
  } catch (e) { ui.renderRank([], 'No se pudo cargar el ranking. Inténtalo más tarde.'); }
}

// ---------- sincronización con la nube ----------
function pushNow(keepalive = false) {
  if (!sb.auth.user) return Promise.resolve();
  if (saving) return saving.then(() => state.dirty ? pushNow(keepalive) : null);
  const sent = snapshot();
  saving = sb.saveProgress(sent, keepalive, state.serverStreak)
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
    ui.gate(false);
    let row = await sb.getProfile();
    setProfile({ name: row?.username || user.user_metadata?.username || user.user_metadata?.full_name || null, avatar: row?.avatar || null, title: row?.title || null, region: row?.region || null, email: user.email || '', rank: null }, user);
    // la primera vez se invita a elegir bandera y nombre
    const askKey = 'alaguapedro.askedFlag.' + user.id;
    const regKey = 'alaguapedro.askedRegion.' + user.id, askFlag = row && !row.avatar && !localStorage.getItem(askKey), askReg = row && !row.region && !localStorage.getItem(regKey);
    if (askFlag || askReg) {
      try { if (askFlag) localStorage.setItem(askKey, '1'); if (askReg) localStorage.setItem(regKey, '1'); } catch (e) {}
      setTimeout(() => { ui.openPanel('#panel-profile'); ui.showToast(askFlag ? '🚩 Elige tu nombre, tu comunidad y tu bandera' : '📍 Elige tu comunidad autónoma para el ranking', 3800);
        if (!askFlag) setTimeout(() => $('#region-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300); }, 700);
    }
    const serverEmpty = !row || (+row.total_clicks === 0 && row.chests_opened === 0 && row.tomatoes_thrown === 0);
    state.updatedAt = null;
    if (serverEmpty && hasProgress()) {       // primera vez: se sube el progreso de invitado (una sola vez, validado y con topes)
      const s = state.stats;
      row = await sb.importGuest({ totalClicks: s.totalClicks, legacyClicks: s.legacyClicks, legacyTomatoes: s.legacyTomatoes, tomatoesThrown: s.tomatoesThrown, hits: s.hits, perfects: s.perfects, falls: s.falls, pesetasEarned: s.pesetasEarned, tomatoesRefunded: s.tomatoesRefunded || 0, paguitasPesetas: s.paguitasPesetas || 0, chestTomatoes: s.chestTomatoes, chestPesetas: s.chestPesetas, pesetasSpent: s.pesetasSpent, chestsOpened: s.chestsOpened, cards: state.cards, dailyClaimedOn: state.dailyClaimedOn });
      applyServer(row); ui.showToast('☁️ Tu progreso se ha guardado en tu cuenta');
    } else if (row) { applyServer(row); ui.showToast('☁️ Progreso cargado de tu cuenta'); }
    ui.hud(); restoreGift(); maybeTour();   // jugador nuevo: guía de bienvenida
    await backend.syncWheelCap(); syncChip(); checkPending();        // niveles: si hay tiradas de ruleta pendientes, se ofrecen
    installRefresh(); installReward();  // abierto desde la app instalada: su regalo
    if (payReturn && !payReturn.done) { payReturn.done = true;
      if (payReturn.status === 'ok') awaitPurchase(payReturn.session);
      else ui.showToast('Pago cancelado: no se te ha cobrado nada', 2800); }
  } catch (e) { ui.showToast('No se pudo cargar tu progreso. Inténtalo más tarde.', 3500, true); }
}

// ---------- cuenta ----------
const hasBackend = sb.hasBackend();
$('#btn-account').addEventListener('click', () => { ui.closeAll(); ui.openPanel('#panel-profile'); });
// Botón oficial de Google en alaguapedro.es (Google muestra este dominio, no el de Supabase)
function setupGoogleButton() {
  if (!CONFIG.GOOGLE_CLIENT_ID || TEST_HOST || !hasBackend) return;
  const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
  s.onload = () => {
    try {
      const box = $('#gsi-btn');
      window.google.accounts.id.initialize({ client_id: CONFIG.GOOGLE_CLIENT_ID, callback: onGoogleCredential, ux_mode: 'popup', auto_select: false, itp_support: true, use_fedcm_for_button: true });
      window.google.accounts.id.renderButton(box, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', logo_alignment: 'center', locale: 'es', width: Math.min(360, Math.max(240, (box.parentElement?.clientWidth || 320))) });
      box.classList.remove('hidden'); $('#btn-google').classList.add('hidden'); $('#google-alt').classList.remove('hidden');
    } catch (e) { /* si falla, queda el botón de siempre */ }
  };
  document.head.appendChild(s);
}
async function onGoogleCredential(resp) {
  ui.accMsg('Entrando con Google...');
  try { const u = await sb.signInWithGoogleToken(resp.credential); ui.accMsg(''); await afterLogin(u); ui.showToast('✅ Has entrado con Google'); }
  catch (e) {
    if (/failed to fetch|network/i.test(e.message)) { ui.accMsg(`❌ No se ha podido entrar con Google (${googleWhy(e.message)}). Revisa la conexión e inténtalo otra vez.`, 'err'); return; }
    // el botón oficial no ha funcionado: se prueba enseguida por la página de Google (no depende del botón)
    ui.accMsg('Probando a entrar con Google por otro camino...'); googleRedirect(googleWhy(e.message));
  }
}
// motivo del fallo, en castellano (para saber qué ajustar en Google o en Supabase)
function googleWhy(m = '') {
  if (/signups? not allowed|signup.*disabled/i.test(m)) return 'los registros nuevos están desactivados en Supabase';
  if (/audience|aud/i.test(m)) return 'el ID de cliente de Google no coincide con el de Supabase';
  if (/nonce/i.test(m)) return 'falta activar «Skip nonce checks» de Google en Supabase';
  if (/provider.*not enabled|unsupported provider/i.test(m)) return 'Google no está activado en Supabase';
  if (/database error/i.test(m)) return 'error al crear la cuenta en la base de datos';
  if (/failed to fetch|network/i.test(m)) return 'sin conexión';
  return m ? m.slice(0, 80) : 'error desconocido';
}
// la segunda forma de entrar (por la página de Google, sin el botón oficial)
$('#google-alt').addEventListener('click', () => $('#btn-google').click());
// dentro de Instagram, TikTok, Facebook... Google bloquea el acceso: se avisa
if (/FBAN|FBAV|Instagram|TikTok|musical_ly|Bytedance|Line\/|; wv\)/i.test(navigator.userAgent)) $('#google-inapp')?.classList.remove('hidden');
setupGoogleButton();
$('#btn-google').addEventListener('click', () => googleRedirect());
// Entrar por la página de Google (a través de Supabase). Si el botón oficial falló, se recuerda el motivo para enseñarlo si esto también falla.
async function googleRedirect(why = '') {
  const b = $('#btn-google'); b.disabled = true; if (!why) ui.accMsg('Conectando con Google...');
  try { if (why) sessionStorage.setItem('alaguapedro.gsiWhy', why); } catch (e) {}
  try {
    const st = await sb.authSettings();
    if (!st?.external?.google) throw new Error('El acceso con Google todavía no está activado. De momento, entra con tu correo.');
    location.href = sb.googleURL();
  } catch (e) { ui.accMsg('❌ ' + traducir(e.message), 'err'); b.disabled = false; }
}
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
  await sb.signOut(); resetProgress(); syncChip(); restoreGift(); setProfile({ name: null, avatar: null, title: null, region: null, email: '', rank: null }, null); ui.closeAll(); ui.showTab('login'); ui.hud();
  if (!GUEST_OK) ui.gate(true);
  ui.showToast('Sesión cerrada. Tu progreso queda guardado en tu cuenta.');
});
function traducir(m = '') {
  const t = { 'Invalid login credentials': 'Correo o contraseña incorrectos', 'User already registered': 'Ese correo ya tiene cuenta', 'Email not confirmed': 'Confirma tu correo antes de entrar', 'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres', 'Failed to fetch': 'Sin conexión con el servidor', 'NetworkError': 'Sin conexión con el servidor', 'rate limit': 'Demasiados intentos. Espera un momento.', 'Could not find the function': 'El servidor todavía no está actualizado. Inténtalo más tarde.', 'schema cache': 'El servidor todavía no está actualizado. Inténtalo más tarde.', 'weak': 'La contraseña es demasiado débil', 'invalid format': 'El correo no es válido', 'security purposes': 'Demasiados intentos. Espera un momento.' };
  for (const k in t) if (m.includes(k)) return t[k];
  // solo se muestran tal cual los mensajes propios del juego (en castellano); cualquier otro error técnico se sustituye
  return /^(No |Ya |Te faltan|La carta|La Armería|Ese objeto|Los anuncios|Necesitas|El perfil|Cofre|Carta|Si el correo|El nombre|Ese nombre|Esa bandera|El acceso|El regalo|Todavía|Primero|El título|El Falcón|Esa oferta|Ese pack|No tienes tiradas|No tienes pesetas|Esa comunidad|Solo puedes|Esta tirada|Ya has recogido)/.test(m) ? m : 'No se ha podido completar la acción. Inténtalo de nuevo.';
}
// ---------- arranque de sesión ----------
(async () => {
  if (!hasBackend || TEST_HOST) return;          // pruebas: nunca entra en una cuenta real
  if (!GUEST_OK) ui.gate(true);                 // sin sesión no se juega
  let back = false;
  try { back = sb.consumeAuthHash(); } catch (e) { ui.accMsg(`❌ No se ha podido entrar con Google (${googleWhy(e.message)}). Prueba otra vez o entra con tu correo.`, 'err'); }
  if (back === 'recovery') { ui.showTab('newpass'); ui.accMsg('Escribe tu nueva contraseña'); return; }
  if (back === 'oauth') {                       // vuelta de Google
    try { const u = await sb.fetchUser(); await afterLogin(u); ui.showToast('✅ Has entrado con Google'); }
    catch (e) { await sb.signOut(); if (!GUEST_OK) ui.gate(true); ui.accMsg(`❌ No se ha podido entrar con Google (${googleWhy(e.message)}). Inténtalo de nuevo.`, 'err'); }
    return;
  }
  const user = await sb.restoreSession();
  if (user) afterLogin(user);
})();

// ---------- perfil ----------
function setProfile(p, user = sb.auth.user) {
  Object.assign(profile, p);
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: profile.name, avatar: profile.avatar, title: profile.title, region: profile.region })); } catch (e) {}
  ui.setAccountUI(user, profile.name, profile.avatar || DEFAULT_AVATAR);
  if ($('#panel-profile').classList.contains('open')) ui.renderProfile(view());
}
const view = () => ({ ...profile, hasAvatar: !!profile.avatar, flagVideo: !!profile.avatar && videosOn(), avatar: profile.avatar || DEFAULT_AVATAR, title: profile.title || defaultTitle(sb.auth.user?.id || profile.name || ''), logged: !!sb.auth.user });
async function showProfile() {
  ui.renderProfile(view());
  if (sb.auth.user) try { profile.rank = await sb.myRank(); ui.renderProfile(view()); } catch (e) {}
}
async function saveProfile(name, avatar) {
  name = String(name || '').trim().replace(/\s+/g, ' ');
  if (sb.auth.user) { const row = await sb.updateProfile(name, avatar); setProfile({ name: row.username, avatar: row.avatar }); }
  else {
    if (!name) name = profile.name || 'Jugador';
    else if (name.length < 3 || name.length > 20) throw new Error('El nombre debe tener entre 3 y 20 caracteres');
    setProfile({ name, avatar });
  }
  ui.renderProfile(view());
}
async function pickAvatar(id) {
  if (id === profile.avatar) return;
  // la primera bandera es gratis; para cambiarla después hay que ver un vídeo
  if (profile.avatar) { try { const v = await showVideo(PLACEMENTS.FLAG); if (!v.completed) throw new Error('No has completado el vídeo'); } catch (e) { fail(e); return; } }
  try { await saveProfile(profile.name || '', id); SFX.upgrade(); ui.showToast('🚩 ¡Bandera puesta!'); } catch (e) { fail(e); }
}
// Comunidad autónoma (para el ranking por comunidades)
async function saveRegion(id) {
  if (id === profile.region) return;
  try {
    if (sb.auth.user) { const row = await sb.setRegion(id); setProfile({ region: row.region }); }
    else setProfile({ region: id });
    ui.renderProfile(view()); SFX.upgrade(); ui.showToast('📍 ¡Ya juegas por ' + (ui.REGIONS.find(r => r.id === id)?.name || 'tu comunidad') + '!');
  } catch (e) { fail(e); }
}
async function rename(name) {
  try { await saveProfile(name, profile.avatar); SFX.upgrade(); ui.showToast('✅ Nombre cambiado'); $('#name-input').blur(); } catch (e) { fail(e); }
}
// ---------- imagen para compartir ----------
async function share() {
  ui.showShare();
  try {
    if (sb.auth.user) try { profile.rank = await sb.myRank(); } catch (e) {}
    const cv = await renderShareCard(scene, { name: profile.name || 'Jugador', avatar: profile.avatar || DEFAULT_AVATAR, title: levelName(levelOf(state.stats)), stats: state.stats, rank: profile.rank,
      cardsUnlocked: E.CARD_IDS.filter(id => E.level(state.cards, id) > 0).length, cardsTotal: E.CARD_IDS.length });
    const blob = await canvasBlob(cv);
    shareFile = new File([blob], 'al-agua-pedro.png', { type: 'image/png' });
    if (shareURL) URL.revokeObjectURL(shareURL);
    shareURL = URL.createObjectURL(blob);
    ui.setShareImage(shareURL, !!(navigator.canShare && navigator.canShare({ files: [shareFile] })));
  } catch (e) { ui.hideShare(); fail(new Error('No se ha podido crear la imagen')); }
}
async function shareGo() {
  const f = state.stats.falls, text = `¡He tirado a Pedro al agua ${f} ${f === 1 ? 'vez' : 'veces'}! ¿Te atreves? 🍅 ${location.origin + location.pathname}`;
  try { await navigator.share({ files: [shareFile], title: 'AL AGUA PEDRO', text }); } catch (e) {}
}
function shareSave() { const a = document.createElement('a'); a.href = shareURL; a.download = 'al-agua-pedro-estadisticas.png'; document.body.appendChild(a); a.click(); a.remove(); ui.showToast('📸 Imagen guardada'); }

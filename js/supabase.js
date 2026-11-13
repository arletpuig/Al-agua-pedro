// Cliente mínimo de Supabase (Auth + REST + RPC) con fetch, sin dependencias.
import { CONFIG } from './config.js';
const URL = CONFIG.SUPABASE_URL, KEY = CONFIG.SUPABASE_KEY, SKEY = 'alaguapedro.session';
let session = null;

export const auth = { get user() { return session?.user || null; }, get token() { return session?.access_token || null; } };
export function hasBackend() { return !!(URL && KEY); }

function headers(extra = {}) {
  const h = { apikey: KEY, 'Content-Type': 'application/json', ...extra };
  if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
  return h;
}
async function refresh() {
  const s = await req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token }, auth: false, retry: false });
  setSession(s);
}
async function req(path, { method = 'GET', body, auth: useAuth = true, keepalive = false, extra = {}, retry = true } = {}) {
  // la sesión dura una hora: se renueva sola antes de caducar o si el servidor responde 401
  if (useAuth && retry && session?.refresh_token && session.expires_at * 1000 < Date.now() + 30000) { try { await refresh(); } catch (e) {} }
  const h = headers(extra); if (!useAuth) delete h.Authorization;
  const r = await fetch(URL + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined, keepalive });
  if (r.status === 401 && useAuth && retry && session?.refresh_token) { try { await refresh(); return req(path, { method, body, auth: useAuth, keepalive, extra, retry: false }); } catch (e) {} }
  const text = await r.text(); let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!r.ok) {
    const msg = data?.msg || data?.message || data?.error_description || data?.error || data?.hint || `Error ${r.status}`;
    const err = new Error(msg); err.status = r.status; err.code = data?.error_code || data?.code; throw err;
  }
  return data;
}
const rpc = (name, args = {}, opts = {}) => req(`/rest/v1/rpc/${name}`, { method: 'POST', body: args, ...opts });
function setSession(s) { session = s; try { s ? localStorage.setItem(SKEY, JSON.stringify(s)) : localStorage.removeItem(SKEY); } catch (e) {} }

export async function restoreSession() {
  try { session = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { session = null; }
  if (!session) return null;
  if (session.expires_at * 1000 < Date.now() + 60000) {
    try { await refresh(); } catch (e) { setSession(null); }
  }
  return auth.user;
}
// Vuelta de un enlace de Supabase con la sesión en el hash: recuperación de contraseña (#...&type=recovery) o entrada con Google.
// Devuelve 'recovery', 'oauth' o false.
export function consumeAuthHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('access_token')) {
    setSession({ access_token: h.get('access_token'), refresh_token: h.get('refresh_token'), expires_at: Math.floor(Date.now() / 1000) + Number(h.get('expires_in') || 3600), user: null });
    history.replaceState(null, '', location.pathname + location.search); return h.get('type') === 'recovery' ? 'recovery' : 'oauth';
  }
  if (h.get('error_description')) { history.replaceState(null, '', location.pathname + location.search); throw new Error(decodeURIComponent(h.get('error_description').replace(/\+/g, ' '))); }
  return false;
}
// Entrar con Google: Supabase redirige a Google y vuelve a esta misma página con la sesión en el hash.
export const authSettings = () => req('/auth/v1/settings', { auth: false });
export function googleURL() { return `${URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(location.origin + location.pathname + location.search)}`; }
export async function signUp(email, password, username) {
  const d = await req('/auth/v1/signup', { method: 'POST', body: { email, password, data: { username } }, auth: false });
  if (d?.access_token) { setSession(d); return { user: d.user, needsConfirm: false }; }
  return { user: d, needsConfirm: true };
}
export async function signIn(email, password) { const s = await req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password }, auth: false }); setSession(s); return s.user; }
export async function signOut() { try { await req('/auth/v1/logout', { method: 'POST' }); } catch (e) {} setSession(null); }
export async function recover(email) { await req('/auth/v1/recover', { method: 'POST', body: { email }, auth: false }); }
export async function updatePassword(password) { const u = await req('/auth/v1/user', { method: 'PUT', body: { password } }); if (session) { session.user = u; setSession(session); } return u; }
export async function fetchUser() { const u = await req('/auth/v1/user'); if (session) { session.user = u; setSession(session); } return u; }

export async function getProfile() { const rows = await req(`/rest/v1/profiles?select=*&user_id=eq.${auth.user.id}`); return rows?.[0] || null; }
// Guardado validado en el servidor. Devuelve la fila resultante.
export const saveProgress = (s, keepalive = false) => rpc('save_progress', { p_total_clicks: s.totalClicks, p_tomatoes_thrown: s.tomatoesThrown, p_hits: s.hits, p_perfects: s.perfects, p_falls: s.falls, p_pesetas_earned: s.pesetasEarned, p_tomatoes_refunded: s.tomatoesRefunded || 0, p_paguitas_pesetas: s.paguitasPesetas || 0 }, { keepalive });
export const openChest = kind => rpc('open_chest', { p_kind: kind });          // -> { reward, profile }
export const claimDaily = () => rpc('claim_daily', {});                        // -> { reward, profile }
export const upgradeCard = id => rpc('upgrade_card', { p_card: id });          // -> profile
export const importGuest = payload => rpc('import_guest', { p: payload });     // -> profile
export const claimAdReward = (placement, token) => rpc('claim_ad_reward', { p_placement: placement, p_token: token });
export const serverNow = () => rpc('server_now', {}, { auth: false });         // -> { date, now, next_midnight }
export const updateProfile = (username, avatar) => rpc('update_profile', { p_username: username, p_avatar: avatar });   // -> profile
export const myRank = () => rpc('my_rank', {});
export const setTitle = title => rpc('set_title', { p_title: title });                     // -> profile
export const offerWelcome = () => rpc('offer_welcome', {});                               // -> { offered_at, claimed, now }
export const claimWelcome = () => rpc('claim_welcome', {});                               // -> { reward, profile }
export const leaderboard = () => req('/rest/v1/leaderboard?select=*&order=tomatoes_earned.desc,falls.desc&limit=20', { auth: false });

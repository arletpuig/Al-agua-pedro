// Estado del juego y guardado local. Las cantidades derivadas (tomates, pesetas) se calculan siempre a partir de los totales.
import { CONFIG } from './config.js';
import { emptyCards, CARD_IDS, refund } from './economy.js';
const KEY = 'alaguapedro.v2', OLD_KEY = 'alaguapedro.v1';
const listeners = new Set();

export const state = {
  clicks: 0, tomatoes: 0, pesetas: 0,
  stats: { totalClicks: 0, legacyClicks: 0, legacyTomatoes: 0, tomatoesEarned: 0, tomatoesThrown: 0, hits: 0, perfects: 0, falls: 0, pesetasEarned: 0, chestTomatoes: 0, chestPesetas: 0, pesetasSpent: 0, chestsOpened: 0, tomatoesRefunded: 0, paguitasPesetas: 0 },
  cards: emptyCards(), dailyClaimedOn: null, falconUntil: 0,
  tutorialSeen: false, sound: true, music: false, dirty: false, updatedAt: null, welcome: false,
  welcomeOfferedAt: null, welcomeClaimed: false,   // regalo de bienvenida (cofre en paracaídas)
};
// Los tomates conseguidos cuando costaban 100 clics se conservan (legacy); desde entonces cuestan CLICKS_PER_TOMATO.
export function derive() {
  const s = state.stats, fresh = Math.max(0, s.totalClicks - (s.legacyClicks || 0));
  s.tomatoesEarned = (s.legacyTomatoes || 0) + Math.floor(fresh / CONFIG.CLICKS_PER_TOMATO) + s.chestTomatoes;
  state.clicks = fresh % CONFIG.CLICKS_PER_TOMATO;
  state.tomatoes = Math.max(0, s.tomatoesEarned + (s.tomatoesRefunded || 0) - s.tomatoesThrown);
  state.pesetas = Math.max(0, s.pesetasEarned + s.chestPesetas + (s.paguitasPesetas || 0) - s.pesetasSpent);
}
export function load() {
  try {
    let raw = localStorage.getItem(KEY), d = raw ? JSON.parse(raw) : null;
    if (!d) { const old = localStorage.getItem(OLD_KEY); if (old) { const o = JSON.parse(old); d = { stats: { totalClicks: o.stats?.totalClicks || 0, tomatoesThrown: o.stats?.tomatoesThrown || 0, hits: o.stats?.hits || 0, falls: o.stats?.falls || 0 }, tutorialSeen: o.tutorialSeen, sound: o.sound }; } }
    if (d) {
      Object.assign(state, { tutorialSeen: !!d.tutorialSeen, sound: d.sound !== false, music: !!d.music, dailyClaimedOn: d.dailyClaimedOn || null, falconUntil: d.falconUntil || 0, welcomeOfferedAt: d.welcomeOfferedAt || null, welcomeClaimed: !!d.welcomeClaimed });
      Object.assign(state.stats, d.stats || {});
      // partida guardada cuando un tomate costaba 100 clics: se conserva lo ya ganado
      if (d.cpt !== CONFIG.CLICKS_PER_TOMATO && !state.stats.legacyClicks && state.stats.totalClicks > 0) {
        const t = state.stats.totalClicks; state.stats.legacyClicks = t - (t % 100); state.stats.legacyTomatoes = Math.floor(t / 100);
      }
      const c = emptyCards(); CARD_IDS.forEach(id => { if (d.cards?.[id]) c[id] = { level: d.cards[id].level | 0, frags: d.cards[id].frags | 0 }; }); state.cards = c;
    } else {
      // jugador nuevo: regalo de bienvenida para empezar con tomates y algo de pesetas
      state.stats.chestTomatoes = CONFIG.WELCOME.tomatoes; state.stats.chestPesetas = CONFIG.WELCOME.pesetas; state.welcome = true;
      derive(); save();
    }
  } catch (e) {}
  derive(); return state;
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ cpt: CONFIG.CLICKS_PER_TOMATO, stats: state.stats, cards: state.cards, dailyClaimedOn: state.dailyClaimedOn, falconUntil: state.falconUntil, welcomeOfferedAt: state.welcomeOfferedAt, welcomeClaimed: state.welcomeClaimed, tutorialSeen: state.tutorialSeen, sound: state.sound, music: state.music })); } catch (e) {}
}
export function onChange(fn) { listeners.add(fn); }
export function changed(sync = true) { derive(); if (sync) state.dirty = true; save(); listeners.forEach(f => f(state)); }

export function falconActive() { return state.falconUntil > Date.now(); }
// Suma clics (ya multiplicados). Devuelve cuántos tomates se han conseguido con esta pulsación.
export function addClicks(n) {
  const before = state.stats.tomatoesEarned;
  state.stats.totalClicks += n;
  changed(); return state.stats.tomatoesEarned - before;
}
export function useTomatoes(n) {
  if (n < 1 || state.tomatoes < n) return false;
  state.stats.tomatoesThrown += n; changed(); return true;
}
// Un lanzamiento de n tomates es un solo tiro que vale por n: cuenta n impactos/caídas.
export function registerThrow(kind, decision, n = 1) {
  const s = state.stats;
  if (kind === 'perfect') { s.perfects += n; s.hits += n; } else if (kind === 'near' || decision.fall) s.hits += n;   // un fallo perdonado cuenta como impacto
  if (decision.fall) { s.falls += n; s.pesetasEarned += decision.pesetas; }
  changed();
}
// Plus Ultra: tomates recuperados de un fallo. Paguitas: pesetas que llueven.
export function recoverTomatoes(n) { state.stats.tomatoesRefunded = (state.stats.tomatoesRefunded || 0) + n; changed(); }
export function addPaguita(p) { state.stats.paguitasPesetas = (state.stats.paguitasPesetas || 0) + p; changed(); }
export function applyChestLocal(reward, price) {
  const s = state.stats; s.chestTomatoes += reward.tomatoes; s.chestPesetas += reward.pesetas; s.pesetasSpent += price; s.chestsOpened++;
  changed(false);
}
export function setTutorialSeen() { state.tutorialSeen = true; save(); }
export function setSound(v, music = state.music) { state.sound = v; state.music = music; save(); }
const COUNTERS = ['totalClicks', 'tomatoesThrown', 'hits', 'perfects', 'falls', 'pesetasEarned', 'tomatoesRefunded', 'paguitasPesetas'];
export function snapshot() { return { ...state.stats }; }
// Sustituye el estado por la fila del servidor. Si se pasa `sent` (copia de los contadores enviados),
// se conserva lo que el jugador haya hecho mientras la petición estaba en curso.
export function applyServer(row, sent) {
  if (!row) return;
  if (state.updatedAt && row.updated_at && Date.parse(row.updated_at) < Date.parse(state.updatedAt)) return; // fila antigua
  const s = state.stats, delta = {}; COUNTERS.forEach(k => delta[k] = sent ? Math.max(0, s[k] - sent[k]) : 0);
  s.totalClicks = +row.total_clicks; s.legacyClicks = +(row.legacy_clicks || 0); s.legacyTomatoes = +(row.legacy_tomatoes || 0); s.tomatoesThrown = row.tomatoes_thrown; s.hits = row.hits; s.perfects = row.perfects || 0; s.falls = row.falls;
  s.pesetasEarned = row.pesetas_earned || 0; s.tomatoesRefunded = row.tomatoes_refunded || 0; s.paguitasPesetas = row.paguitas_pesetas || 0; s.chestTomatoes = row.chest_tomatoes || 0; s.chestPesetas = row.chest_pesetas || 0; s.pesetasSpent = row.pesetas_spent || 0; s.chestsOpened = row.chests_opened || 0;
  let pending = false; COUNTERS.forEach(k => { if (delta[k]) { s[k] += delta[k]; pending = true; } });
  const c = emptyCards(); CARD_IDS.forEach(id => { if (row.cards?.[id]) c[id] = { level: row.cards[id].level | 0, frags: row.cards[id].frags | 0 }; }); state.cards = c;
  state.dailyClaimedOn = row.daily_claimed_on || null; state.falconUntil = row.falcon_until ? Date.parse(row.falcon_until) : 0;
  if ('welcome_claimed' in row) { state.welcomeClaimed = !!row.welcome_claimed; state.welcomeOfferedAt = row.welcome_offered_at ? Date.parse(row.welcome_offered_at) : null; }
  state.updatedAt = row.updated_at || null; state.dirty = pending;
  derive(); save(); listeners.forEach(f => f(state));
}
export function hasProgress() { const s = state.stats; return s.totalClicks > 0 || s.chestsOpened > 0 || s.tomatoesThrown > 0; }
// Vacía el progreso local (al cerrar sesión: el progreso queda en la cuenta).
export function resetProgress() {
  Object.keys(state.stats).forEach(k => state.stats[k] = 0); state.cards = emptyCards(); state.dailyClaimedOn = null; state.falconUntil = 0; state.updatedAt = null; state.dirty = false; state.welcomeOfferedAt = null; state.welcomeClaimed = false;
  derive(); save(); listeners.forEach(f => f(state));
}

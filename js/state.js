// Estado del juego y guardado local. Las cantidades derivadas (tomates, pesetas) se calculan siempre a partir de los totales.
import { CONFIG } from './config.js';
import { emptyCards, CARD_IDS } from './economy.js';
const KEY = 'alaguapedro.v2', OLD_KEY = 'alaguapedro.v1';
const listeners = new Set();

export const state = {
  clicks: 0, tomatoes: 0, pesetas: 0,
  stats: { totalClicks: 0, tomatoesEarned: 0, tomatoesThrown: 0, hits: 0, perfects: 0, falls: 0, pesetasEarned: 0, chestTomatoes: 0, chestPesetas: 0, pesetasSpent: 0, chestsOpened: 0 },
  cards: emptyCards(), dailyClaimedOn: null, falconUntil: 0,
  tutorialSeen: false, sound: true, music: false, dirty: false, updatedAt: null,
};
export function derive() {
  const s = state.stats;
  s.tomatoesEarned = Math.floor(s.totalClicks / CONFIG.CLICKS_PER_TOMATO) + s.chestTomatoes;
  state.clicks = s.totalClicks % CONFIG.CLICKS_PER_TOMATO;
  state.tomatoes = Math.max(0, s.tomatoesEarned - s.tomatoesThrown);
  state.pesetas = Math.max(0, s.pesetasEarned + s.chestPesetas - s.pesetasSpent);
}
export function load() {
  try {
    let raw = localStorage.getItem(KEY), d = raw ? JSON.parse(raw) : null;
    if (!d) { const old = localStorage.getItem(OLD_KEY); if (old) { const o = JSON.parse(old); d = { stats: { totalClicks: o.stats?.totalClicks || 0, tomatoesThrown: o.stats?.tomatoesThrown || 0, hits: o.stats?.hits || 0, falls: o.stats?.falls || 0 }, tutorialSeen: o.tutorialSeen, sound: o.sound }; } }
    if (d) {
      Object.assign(state, { tutorialSeen: !!d.tutorialSeen, sound: d.sound !== false, music: !!d.music, dailyClaimedOn: d.dailyClaimedOn || null, falconUntil: d.falconUntil || 0 });
      Object.assign(state.stats, d.stats || {});
      const c = emptyCards(); CARD_IDS.forEach(id => { if (d.cards?.[id]) c[id] = { level: d.cards[id].level | 0, frags: d.cards[id].frags | 0 }; }); state.cards = c;
    }
  } catch (e) {}
  derive(); return state;
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ stats: state.stats, cards: state.cards, dailyClaimedOn: state.dailyClaimedOn, falconUntil: state.falconUntil, tutorialSeen: state.tutorialSeen, sound: state.sound, music: state.music })); } catch (e) {}
}
export function onChange(fn) { listeners.add(fn); }
export function changed(sync = true) { derive(); if (sync) state.dirty = true; save(); listeners.forEach(f => f(state)); }

export function falconActive() { return state.falconUntil > Date.now(); }
// Suma clics (ya multiplicados). Devuelve cuántos tomates se han conseguido con esta pulsación.
export function addClicks(n) {
  const before = Math.floor(state.stats.totalClicks / CONFIG.CLICKS_PER_TOMATO);
  state.stats.totalClicks += n;
  const earned = Math.floor(state.stats.totalClicks / CONFIG.CLICKS_PER_TOMATO) - before;
  changed(); return earned;
}
export function useTomatoes(n) {
  if (n < 1 || state.tomatoes < n) return false;
  state.stats.tomatoesThrown += n; changed(); return true;
}
export function registerThrow(kind, decision) {
  const s = state.stats;
  if (kind === 'perfect') { s.perfects++; s.hits++; } else if (kind === 'near') s.hits++;
  if (decision.fall) { s.falls++; s.pesetasEarned += decision.pesetas; }
  changed();
}
export function applyChestLocal(reward, price) {
  const s = state.stats; s.chestTomatoes += reward.tomatoes; s.chestPesetas += reward.pesetas; s.pesetasSpent += price; s.chestsOpened++;
  changed(false);
}
export function setTutorialSeen() { state.tutorialSeen = true; save(); }
export function setSound(v, music = state.music) { state.sound = v; state.music = music; save(); }
const COUNTERS = ['totalClicks', 'tomatoesThrown', 'hits', 'perfects', 'falls', 'pesetasEarned'];
export function snapshot() { return { ...state.stats }; }
// Sustituye el estado por la fila del servidor. Si se pasa `sent` (copia de los contadores enviados),
// se conserva lo que el jugador haya hecho mientras la petición estaba en curso.
export function applyServer(row, sent) {
  if (!row) return;
  if (state.updatedAt && row.updated_at && Date.parse(row.updated_at) < Date.parse(state.updatedAt)) return; // fila antigua
  const s = state.stats, delta = {}; COUNTERS.forEach(k => delta[k] = sent ? Math.max(0, s[k] - sent[k]) : 0);
  s.totalClicks = +row.total_clicks; s.tomatoesThrown = row.tomatoes_thrown; s.hits = row.hits; s.perfects = row.perfects || 0; s.falls = row.falls;
  s.pesetasEarned = row.pesetas_earned || 0; s.chestTomatoes = row.chest_tomatoes || 0; s.chestPesetas = row.chest_pesetas || 0; s.pesetasSpent = row.pesetas_spent || 0; s.chestsOpened = row.chests_opened || 0;
  let pending = false; COUNTERS.forEach(k => { if (delta[k]) { s[k] += delta[k]; pending = true; } });
  const c = emptyCards(); CARD_IDS.forEach(id => { if (row.cards?.[id]) c[id] = { level: row.cards[id].level | 0, frags: row.cards[id].frags | 0 }; }); state.cards = c;
  state.dailyClaimedOn = row.daily_claimed_on || null; state.falconUntil = row.falcon_until ? Date.parse(row.falcon_until) : 0;
  state.updatedAt = row.updated_at || null; state.dirty = pending;
  derive(); save(); listeners.forEach(f => f(state));
}
export function hasProgress() { const s = state.stats; return s.totalClicks > 0 || s.chestsOpened > 0 || s.tomatoesThrown > 0; }
// Vacía el progreso local (al cerrar sesión: el progreso queda en la cuenta).
export function resetProgress() {
  Object.keys(state.stats).forEach(k => state.stats[k] = 0); state.cards = emptyCards(); state.dailyClaimedOn = null; state.falconUntil = 0; state.updatedAt = null; state.dirty = false;
  derive(); save(); listeners.forEach(f => f(state));
}

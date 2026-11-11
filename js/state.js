// Estado del juego y guardado local.
import { CONFIG } from './config.js';
const KEY = 'alaguapedro.v1';
const listeners = new Set();

export const state = {
  clicks: 0, tomatoes: 0,
  stats: { totalClicks: 0, tomatoesEarned: 0, tomatoesThrown: 0, hits: 0, falls: 0 },
  tutorialSeen: false, sound: true, dirty: false,
};

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      Object.assign(state, d, { stats: { ...state.stats, ...(d.stats || {}) } });
    }
  } catch (e) {}
  return state;
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ clicks: state.clicks, tomatoes: state.tomatoes, stats: state.stats, tutorialSeen: state.tutorialSeen, sound: state.sound })); } catch (e) {}
}
export function onChange(fn) { listeners.add(fn); }
function changed() { state.dirty = true; save(); listeners.forEach(f => f(state)); }

export function addClick() {
  state.clicks++; state.stats.totalClicks++;
  let earned = 0;
  while (state.clicks >= CONFIG.CLICKS_PER_TOMATO) { state.clicks -= CONFIG.CLICKS_PER_TOMATO; state.tomatoes++; state.stats.tomatoesEarned++; earned++; }
  changed();
  return earned;
}
export function useTomato() {
  if (state.tomatoes <= 0) return false;
  state.tomatoes--; state.stats.tomatoesThrown++; changed(); return true;
}
export function registerResult(kind) {
  if (kind === 'perfect') { state.stats.hits++; state.stats.falls++; }
  else if (kind === 'near') state.stats.hits++;
  changed();
}
export function setTutorialSeen() { state.tutorialSeen = true; save(); }
export function setSound(v) { state.sound = v; save(); }
// Sustituye el progreso por los valores del servidor (derivados de los totales).
export function applyServer(row) {
  state.stats.totalClicks = row.total_clicks; state.stats.tomatoesEarned = row.tomatoes_earned;
  state.stats.tomatoesThrown = row.tomatoes_thrown; state.stats.hits = row.hits; state.stats.falls = row.falls;
  state.tomatoes = row.tomatoes; state.clicks = row.clicks_progress; state.dirty = false;
  save(); listeners.forEach(f => f(state));
}

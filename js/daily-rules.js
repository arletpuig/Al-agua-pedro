// Reglas de los logros diarios (las mismas que schema_v30.sql): misiones del día, premios y calendario de 7 días.
// Contadores: t = tomates tirados, f = caídas al agua, k = pulsaciones con el dedo, h = impactos, p = perfectos, o = cofres abiertos.
// Los objetivos son los del nivel 1 y crecen con el nivel que tenías al empezar el día (goalFor).
export const POOLS = [
  [['e_tom', 't', 25], ['e_fall', 'f', 5], ['e_tap', 'k', 500], ['e_hit', 'h', 15]],
  [['m_tom', 't', 60], ['m_fall', 'f', 15], ['m_tap', 'k', 1500], ['m_perf', 'p', 10]],   // en este orden, cada día salen 3 tipos distintos
  [['h_fall', 'f', 40], ['h_tom', 't', 150], ['h_perf', 'p', 30], ['h_chest', 'o', 4]],
];
const MULT = [1, 3, 5];
export const SLOT_NAMES = ['FÁCIL', 'MEDIA', 'DIFÍCIL'];
const STAT = { t: 'tomatoesThrown', f: 'falls', k: 'taps', h: 'hits', p: 'perfects', o: 'chestsOpened' };
export const TEXT = {
  t: n => `Tira ${n} tomates`, f: n => `Tira a Pedro al agua ${n} veces`, k: n => `Pulsa ¡DALE! ${n.toLocaleString('es-ES')} veces`,
  h: n => `Acierta ${n} tomates en la diana`, p: n => `Haz ${n} perfectos en el centro`, o: n => `Abre ${n} cofres`,
};
export const count = (stats, k) => +(stats?.[STAT[k]] || 0);
const dayNum = key => Math.round((Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) - Date.UTC(2026, 0, 1)) / 86400e3);
// objetivo según el nivel: +6 % por nivel, redondeado a una cifra «bonita» (cuentas con enteros, igual que el servidor). Cofres: +1 cada 10 niveles
export function goalFor(base, k, L) {
  L = Math.min(50, Math.max(1, L | 0));
  if (k === 'o') return base + Math.floor((L - 1) / 10);
  const n = base * (100 + 6 * (L - 1)), st = n < 5000 ? 1 : n < 20000 ? 5 : n < 100000 ? 10 : 50;
  return Math.floor((n + st * 50) / (st * 100)) * st;
}
export function missionFor(key, slot, L = 1) { const [id, k, base] = POOLS[slot][((dayNum(key) * MULT[slot] + slot) % 4 + 4) % 4]; return { id, k, goal: goalFor(base, k, L), slot }; }
export function rewardFor(slot, L) {
  L = Math.min(50, Math.max(1, L));
  return slot === 0 ? { tomatoes: 15 + L, pesetas: 0 } : slot === 1 ? { tomatoes: 0, pesetas: 40 + 4 * L } : { tomatoes: 30 + 2 * L, pesetas: 80 + 8 * L };
}
// calendario: premio de cada día (4 y 7, cofres)
export const LOGIN = [
  { tomatoes: 20 }, { pesetas: 50 }, { tomatoes: 40 }, { chest: 'wood' }, { pesetas: 120 }, { tomatoes: 80 }, { chest: 'diamond', pesetas: 200 },
];
export const prevDay = key => { const d = new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10)) - 86400e3); return d.toISOString().slice(0, 10); };
// el estado de hoy: si cambió el día, se empieza con los contadores de ahora
export function todayState(daily, stats, key, level = 1) {
  const lv = Math.min(50, level);
  if (daily?.date === key && daily.base) {
    const d = { ...daily, done: [...(daily.done || [])] };
    if (!('lv' in d)) { d.lv = lv; d.base = { ...d.base, k: count(stats, 'k') }; }   // día empezado con la versión anterior
    return d;
  }
  const base = {}; for (const k in STAT) base[k] = count(stats, k);
  return { date: key, lv, base, done: [], bonus: false, login_date: daily?.login_date ?? null, login_streak: +(daily?.login_streak || 0) };
}
export const progress = (d, stats, m) => Math.max(0, count(stats, m.k) - +(d.base?.[m.k] || 0));
// día del calendario que toca hoy (1..7) y si ya se ha recogido
export function loginDay(d, key) {
  if (d.login_date === key) return { day: +d.login_streak || 1, claimed: true };
  return { day: d.login_date === prevDay(key) ? (+d.login_streak || 0) % 7 + 1 : 1, claimed: false };
}

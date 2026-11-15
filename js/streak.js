// Racha de lanzamientos: cada vez que tiras a Pedro al agua sin fallar entre medias, la racha sube y da pesetas extra.
// Funciones puras (sin DOM). El servidor admite como mucho 15 pesetas de racha por caída (schema_v17.sql); esto da bastante menos.
export const TIERS = [
  { min: 2,  id: 1, name: 'RACHA',              color: '#ff9a1a' },
  { min: 5,  id: 2, name: '¡EN LLAMAS!',         color: '#ff3b2f' },
  { min: 10, id: 3, name: '¡IMPARABLE!',         color: '#a35cff' },
  { min: 20, id: 4, name: '¡LEGENDARIA!',        color: '#ffd23f' },
  { min: 35, id: 5, name: '¡DIOS DEL TOMATE!',   color: '#ff5ad1' },
];
export const tierOf = s => [...TIERS].reverse().find(t => s >= t.min) || null;
// pesetas extra en cada acierto: 1 desde el 4.º seguido, 2 desde el 8.º... como mucho 5
export const perHit = s => (s < 2 ? 0 : Math.min(5, Math.floor(s / 4)));
// premios gordos al llegar a 5, 10, 15, 20, 25 y luego cada 5
export function milestone(s) {
  if (s < 5 || s % 5) return 0;
  return [0, 5, 10, 15, 25, 30][s / 5] ?? 40;
}
export const bonus = s => perHit(s) + milestone(s);
export const nextMilestone = s => (Math.floor(s / 5) + 1) * 5;

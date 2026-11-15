// Racha de lanzamientos: cada vez que tiras a Pedro al agua sin fallar entre medias, la racha sube y da pesetas extra.
// Las pesetas extra son un porcentaje de lo que ganas en ese lanzamiento: lanzar ×100 da 100 veces más que lanzar ×1.
// Funciones puras (sin DOM). El servidor admite como mucho 45 por caída nueva y 15 por caída en total (schema_v17.sql).
export const TIERS = [
  { min: 2,  id: 1, name: 'RACHA',             color: '#ff9a1a', pct: 0.10 },
  { min: 5,  id: 2, name: '¡EN LLAMAS!',        color: '#ff3b2f', pct: 0.25 },
  { min: 10, id: 3, name: '¡IMPARABLE!',        color: '#a35cff', pct: 0.50 },
  { min: 20, id: 4, name: '¡LEGENDARIA!',       color: '#ffd23f', pct: 0.75 },
  { min: 35, id: 5, name: '¡DIOS DEL TOMATE!',  color: '#ff5ad1', pct: 1.00 },
];
export const tierOf = s => [...TIERS].reverse().find(t => s >= t.min) || null;
// % extra sobre las pesetas del lanzamiento
export const pct = s => tierOf(s)?.pct || 0;
// premio al llegar a 5, 10, 15, 20, 25 y luego cada 5
export function milestone(s) {
  if (s < 5 || s % 5) return 0;
  return [0, 5, 10, 15, 25, 30][s / 5] ?? 40;
}
// pesetas extra de un acierto: el % de las pesetas ganadas en ese lanzamiento (al menos 1) + el premio si toca
export const bonus = (s, pesetas = 1) => (pct(s) ? Math.max(1, Math.round(pesetas * pct(s))) : 0) + milestone(s);
export const nextMilestone = s => (Math.floor(s / 5) + 1) * 5;

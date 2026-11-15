// Racha de lanzamientos: cada vez que tiras a Pedro al agua sin fallar entre medias, la racha sube y da pesetas extra.
// Las pesetas extra son un porcentaje de lo que ganas en ese lanzamiento (lanzar ×100 da 100 veces más que ×1), más un premio
// al llegar a 5, 10, 15... Funciones puras (sin DOM). El servidor admite como mucho 45 por caída nueva y 15 por caída en total.
export const TIERS = [
  { min: 2,  id: 1, name: 'RACHA',             color: '#ff9a1a', pct: 0.05 },
  { min: 5,  id: 2, name: '¡EN LLAMAS!',        color: '#ff3b2f', pct: 0.10 },
  { min: 10, id: 3, name: '¡IMPARABLE!',        color: '#a35cff', pct: 0.15 },
  { min: 20, id: 4, name: '¡LEGENDARIA!',       color: '#ffd23f', pct: 0.25 },
  { min: 35, id: 5, name: '¡DIOS DEL TOMATE!',  color: '#ff5ad1', pct: 0.35 },
  { min: 50, id: 6, name: '¡AL AGUA, PEDRO!',   color: '#2fe0ff', pct: 0.50 },
];
export const tierOf = s => [...TIERS].reverse().find(t => s >= t.min) || null;
// % extra sobre las pesetas del lanzamiento
export const pct = s => tierOf(s)?.pct || 0;
// premio al llegar a 5, 10, 15... (el de ×50, el más gordo)
export function milestone(s) {
  if (s < 5 || s % 5) return 0;
  if (s === 50) return 30;
  return [0, 3, 5, 6, 8, 10][s / 5] ?? 12;
}
// pesetas extra de un acierto: el % de las pesetas ganadas en ese lanzamiento + el premio si toca
export const bonus = (s, pesetas = 1) => Math.round(pesetas * pct(s)) + milestone(s);
export const nextMilestone = s => (Math.floor(s / 5) + 1) * 5;

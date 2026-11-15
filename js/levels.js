// Niveles de jugador (1–50) y ruleta de premios. Funciones puras: las mismas reglas están en supabase/schema_v13.sql.
// Experiencia (XP) = 10 por tomate lanzado + 5 por impacto en la diana + 20 por cada vez que Pedro cae al agua.
// Se calcula con los contadores guardados (no se guarda aparte), así el servidor puede comprobarla.
export const LEVEL_NAMES = ['Perroflauta', 'Okupa', 'Anticapitalista', 'Anarquista', 'Marxista', 'Comunista', 'Leninista', 'Bolivariano', 'Sindicalista', 'Republicano',
  'Podemita', 'Ecologista', 'Feminista radical', 'Activista', 'Progresista', 'Sanchista', 'Socialista', 'Separatista', 'Independentista', 'Socialdemócrata',
  'Centrista', 'Moderado', 'Ciudadano', 'Liberal', 'Constitucionalista', 'Popular', 'Pepero', 'Liberal-conservador', 'Conservador', 'Monárquico',
  'Patriota', 'Españolista', 'Derechista', 'Gaviotista', 'Anticomunista', 'Soberanista', 'Tradicionalista', 'Nacional-conservador', 'Voxista', 'Abascalista',
  'Ultrapatriota', 'Ultraderechista', 'Reaccionario', 'Nacionalista radical', 'Falangista', 'Nacional-sindicalista', 'Nacionalcatólico', 'Legionario', 'Franquista', 'Caudillo Supremo'];
export const MAX_LEVEL = LEVEL_NAMES.length;
// XP total para llegar a cada nivel: XP_AT[L - 1]. Subir del nivel k al k+1 cuesta 70·k^1.65 + 30 (redondeado a decenas).
export const XP_AT = [0, 100, 350, 810, 1530, 2560, 3940, 5710, 7900, 10560, 13720, 17410, 21660, 26510, 31990, 38120, 44940, 52470, 60750, 69800, 79640, 90310, 101820,
  114210, 127500, 141710, 156870, 173000, 190130, 208280, 227470, 247720, 269060, 291510, 315090, 339830, 365740, 392850, 421180, 450750, 481580, 513690, 547100,
  581830, 617900, 655330, 694140, 734350, 775990, 819060];
export const XP = { thrown: 10, hit: 5, fall: 20 };
export const xpOf = s => XP.thrown * (s.tomatoesThrown || 0) + XP.hit * (s.hits || 0) + XP.fall * (s.falls || 0);
export function levelOfXp(xp) { let L = 1; while (L < MAX_LEVEL && xp >= XP_AT[L]) L++; return L; }
export const levelOf = stats => levelOfXp(xpOf(stats));
export const levelName = L => LEVEL_NAMES[Math.max(1, Math.min(MAX_LEVEL, L)) - 1];
// Color de la medalla por tramos de 10 niveles (y el 50, especial)
export const tierOf = L => (L >= MAX_LEVEL ? 6 : Math.ceil(L / 10));
export const TIER_NAMES = ['', 'Rojo', 'Morado', 'Azul', 'Verde', 'Oro', 'Leyenda'];
// Progreso dentro del nivel actual
export function levelInfo(stats) {
  const xp = xpOf(stats), L = levelOfXp(xp), max = L >= MAX_LEVEL;
  const from = XP_AT[L - 1], to = max ? from : XP_AT[L];
  return { level: L, name: levelName(L), tier: tierOf(L), xp, into: xp - from, need: to - from, pct: max ? 1 : (xp - from) / (to - from), max, next: max ? null : levelName(L + 1) };
}

// ---------- ruleta: una tirada por cada nivel que subes ----------
// En el orden en que se ven en la ruleta. Las cantidades crecen con el nivel conseguido (L).
export const WHEEL = [
  { id: 'pes_s',   weight: 22, kind: 'pesetas',  amount: L => 10 + 2 * L,  label: 'PESETAS',   color: '#ffb21a', icon: 'ic-coin' },
  { id: 'tom_s',   weight: 20, kind: 'tomatoes', amount: L => 10 + 3 * L,  label: 'TOMATES',   color: '#ff4b3a', icon: 'ic-tomato' },
  { id: 'card',    weight: 14, kind: 'chest',    chest: 'wood',            label: 'CARTA',     color: '#3fa2ff', icon: 'ic-cards' },
  { id: 'x5',      weight: 10, kind: 'falcon',                             label: '×5 CLICS',  color: '#13d1c4', icon: 'ic-plane' },
  { id: 'pes_m',   weight: 12, kind: 'pesetas',  amount: L => 30 + 5 * L,  label: 'PESETAS',   color: '#ffd23f', icon: 'ic-coin' },
  { id: 'tom_l',   weight: 10, kind: 'tomatoes', amount: L => 30 + 8 * L,  label: 'TOMATES',   color: '#e3262c', icon: 'ic-tomato' },
  { id: 'cards3',  weight: 8,  kind: 'chest',    chest: 'diamond',         label: 'CARTAS',    color: '#b163ff', icon: 'ic-chest-dia' },
  { id: 'jackpot', weight: 4,  kind: 'pesetas',  amount: L => 100 + 20 * L, label: '¡BOTE!',   color: '#1b1033', icon: 'ic-coin', jackpot: true },
];
export const WHEEL_TOTAL = WHEEL.reduce((a, s) => a + s.weight, 0);
export const FALCON_MINUTES = 10;
export function wheelIndex(r) { let x = r * WHEEL_TOTAL; for (let i = 0; i < WHEEL.length; i++) { x -= WHEEL[i].weight; if (x < 0) return i; } return WHEEL.length - 1; }
// Texto corto de cada casilla para el nivel L (lo que se ve en la ruleta)
export function segText(seg, L) { return seg.kind === 'falcon' ? `${FALCON_MINUTES} MIN` : seg.kind === 'chest' ? (seg.chest === 'diamond' ? '+3' : '+1') : '+' + seg.amount(L); }

// Niveles de jugador (1–50) y ruleta de premios. Funciones puras: las mismas reglas están en supabase/schema_v13.sql.
// Experiencia (XP) = 10 por tomate lanzado + 5 por impacto en la diana + 20 por cada vez que Pedro cae al agua.
// Se calcula con los contadores guardados (no se guarda aparte), así el servidor puede comprobarla.
export const LEVEL_NAMES = ['Perroflauta', 'Okupa', 'Anticapitalista', 'Anarquista', 'Marxista', 'Comunista', 'Leninista', 'Bolivariano', 'Sindicalista', 'Republicano',
  'Podemita', 'Ecologista', 'Feminista radical', 'Activista', 'Progresista', 'Sanchista', 'Socialista', 'Separatista', 'Independentista', 'Socialdemócrata',
  'Centrista', 'Moderado', 'Ciudadano', 'Liberal', 'Constitucionalista', 'Popular', 'Pepero', 'Liberal-conservador', 'Conservador', 'Monárquico',
  'Patriota', 'Españolista', 'Derechista', 'Carlista', 'Anticomunista', 'Soberanista', 'Tradicionalista', 'Nacional-conservador', 'Voxista', 'Imperialista español',
  'Ultrapatriota', 'Ultraderechista', 'Reaccionario', 'Nacionalista radical', 'Falangista', 'Nacional-sindicalista', 'Nacionalcatólico', 'Legionario', 'Franquista', 'Caudillo Supremo'];
export const MAX_LEVEL = LEVEL_NAMES.length;
// XP total para llegar a cada nivel: XP_AT[L - 1]. Hasta el nivel 10, lento (600, 1.300, 1.700... XP por nivel);
// del 10 en adelante (v59), subir del k al k+1 cuesta 5.750·(k/9)^1,7 XP (redondeado a decenas): crece con suavidad.
// Llegar al 50: unos 1,9 millones de XP (igual que fn_level_of_xp en schema_v26.sql).
export const XP_AT = [0, 600, 1900, 3600, 5850, 8700, 12200, 16450, 21450, 27200, 34080, 42170,
  51550, 62290, 74480, 88180, 103470, 120420, 139100, 159580, 181930, 206210, 232490, 260830,
  291300, 323960, 358870, 396090, 435680, 477710, 522230, 569300, 618980, 671330, 726410, 784270,
  844970, 908560, 975100, 1044640, 1117240, 1192960, 1271840, 1353940, 1439310, 1528010, 1620090, 1715590,
  1814570, 1917090];
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

// ---------- ruletas: una tirada por cada nivel que subes (cada 10 niveles, la legendaria) ----------
// En el orden en que se ven. Las cantidades crecen con el nivel (L). Deben coincidir con fn_wheel_roll (schema_v14.sql).
export const WHEELS = {
  normal: { id: 'normal', name: 'Ruleta', segs: [
    { id: 'pes_s',   weight: 22, kind: 'pesetas',  amount: L => 10 + 2 * L,   label: 'PESETAS',  color: '#ffb21a', icon: 'ic-coin' },
    { id: 'tom_s',   weight: 20, kind: 'tomatoes', amount: L => 8 + 2 * L,    label: 'TOMATES',  color: '#ff4b3a', icon: 'ic-tomato' },
    { id: 'card',    weight: 14, kind: 'chest', chest: 'wood', times: 1,       label: 'CARTA',    color: '#3fa2ff', icon: 'ic-cards', text: '+1' },
    { id: 'x5',      weight: 10, kind: 'falcon', minutes: 2,                   label: '×5 CLICS', color: '#13d1c4', icon: 'ic-plane' },
    { id: 'pes_m',   weight: 12, kind: 'pesetas',  amount: L => 30 + 5 * L,   label: 'PESETAS',  color: '#ffd23f', icon: 'ic-coin' },
    { id: 'tom_l',   weight: 10, kind: 'tomatoes', amount: L => 20 + 6 * L,   label: 'TOMATES',  color: '#e3262c', icon: 'ic-tomato' },
    { id: 'cards3',  weight: 8,  kind: 'chest', chest: 'diamond', times: 1,    label: 'CARTAS',   color: '#b163ff', icon: 'ic-chest-dia', text: '+3' },
    { id: 'jackpot', weight: 4,  kind: 'pesetas',  amount: L => 100 + 20 * L, label: '¡BOTE!',   color: '#1b1033', icon: 'ic-coin', jackpot: true },
  ] },
  legend: { id: 'legend', name: 'Ruleta legendaria', segs: [
    { id: 'l_pes',  weight: 22, kind: 'pesetas',  amount: L => 300 + 10 * L,  label: 'PESETAS',  color: '#ffb21a', icon: 'ic-coin' },
    { id: 'l_tom',  weight: 20, kind: 'tomatoes', amount: L => 250 + 10 * L,  label: 'TOMATES',  color: '#e3262c', icon: 'ic-tomato' },
    { id: 'l_dia',  weight: 14, kind: 'chest', chest: 'diamond', times: 2,     label: 'CARTAS',   color: '#2f7cf0', icon: 'ic-chest-dia', text: '+6' },
    { id: 'l_x5',   weight: 12, kind: 'falcon', minutes: 2,                    label: '×5 CLICS', color: '#0fb5a9', icon: 'ic-plane' },
    { id: 'l_top',  weight: 10, kind: 'chest', chest: 'premium', times: 1,     label: 'ÉPICAS',   color: '#9b3df0', icon: 'ic-cards', text: '+4' },
    { id: 'l_pesx', weight: 10, kind: 'pesetas',  amount: L => 800 + 20 * L,  label: 'PESETAS',  color: '#ffd23f', icon: 'ic-coin' },
    { id: 'l_tomx', weight: 8,  kind: 'tomatoes', amount: L => 800 + 20 * L,  label: 'TOMATES',  color: '#c4121b', icon: 'ic-tomato' },
    { id: 'l_bote', weight: 4,  kind: 'pesetas',  amount: L => 2500 + 50 * L, label: '¡BOTE!',   color: '#120a24', icon: 'ic-crown', jackpot: true },
  ] },
};
export const WHEEL = WHEELS.normal.segs;                // (compatibilidad)
export const WHEEL_TOTAL = WHEEL.reduce((a, s) => a + s.weight, 0);
export const FALCON_MINUTES = 10;
export const isLegendLevel = L => L % 10 === 0;         // los niveles 10, 20, 30, 40 y 50 traen la ruleta legendaria
export const nextLegendLevel = L => Math.min(MAX_LEVEL, (Math.floor(L / 10) + 1) * 10);
// En la tienda: la ruleta normal se paga con pesetas (sube con tu nivel, siempre por encima de lo que da de media);
// la legendaria, viendo 3 vídeos. Ver supabase/schema_v14.sql y schema_v15.sql.
export const shopSpinPrice = L => 40 + 3 * L;
export const LEGEND_ADS = 3;                            // vídeos para una tirada legendaria en la tienda (como mucho una al día)
export function wheelIndex(r, segs = WHEEL) { const t = segs.reduce((a, s) => a + s.weight, 0); let x = r * t; for (let i = 0; i < segs.length; i++) { x -= segs[i].weight; if (x < 0) return i; } return segs.length - 1; }
// Texto corto de cada casilla para el nivel L (lo que se ve en la ruleta)
export function segText(seg, L) { return seg.kind === 'falcon' ? `${seg.minutes} MIN` : seg.kind === 'chest' ? seg.text : '+' + seg.amount(L); }
// Texto largo del premio
export function prizeText(seg, reward) {
  const fmt = n => n.toLocaleString('es-ES');
  if (seg.kind === 'pesetas') return `<b>+${fmt(reward.pesetas)}</b> pesetas`;
  if (seg.kind === 'tomatoes') return `<b>+${fmt(reward.tomatoes)}</b> tomates`;
  if (seg.kind === 'falcon') return `<b>×5 clics</b> durante ${seg.minutes} minutos`;
  if (seg.chest === 'premium') return '<b>4 cartas</b> épicas o legendarias';
  if (seg.chest === 'diamond') return `<b>${3 * seg.times} cartas</b> de diamante`;
  return '<b>1 carta</b> del cofre de madera';
}

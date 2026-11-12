// Economía del juego: cartas, cofres, pesetas. Funciones puras (sin DOM) para poder simularlas.
// Las mismas reglas están replicadas en supabase/schema_v2.sql, schema_v4.sql y schema_v5.sql para los usuarios con cuenta.
export const RARITIES = {
  // unlock: fragmentos para desbloquear (antes de tenerla cada aparición da 1); drop: fragmentos por aparición ya desbloqueada
  common:    { name: 'Común',      color: '#8fa3b5', weightWood: 55, weightDiamond: 30, baseCost: 8,  growth: 1.42, unlock: 2, drop: 3 },
  rare:      { name: 'Rara',       color: '#3fa9f5', weightWood: 15, weightDiamond: 19, baseCost: 12, growth: 1.45, unlock: 3, drop: 3 },
  epic:      { name: 'Épica',      color: '#b163ff', weightWood: 11, weightDiamond: 22, baseCost: 18, growth: 1.5,  unlock: 5, drop: 2 },
  legendary: { name: 'Legendaria', color: '#ffb400', weightWood: 4,  weightDiamond: 10, baseCost: 30, growth: 1.55, unlock: 6, drop: 2 },
};
// Rendimiento decreciente: cada nivel aporta menos que el anterior y nunca se pasa del tope.
const dimin = (cap, k) => L => cap * (1 - Math.exp(-L / k));
const pct = v => `${Math.round(v * 1000) / 10}%`;
export const CARDS = {
  inflacion: { id: 'inflacion', name: 'Inflación', rarity: 'common', max: 30, icon: 'inflacion',
    desc: 'Cada pulsación vale más clics. Todo sube, hasta tus tomates.',
    effect: L => `${1 + L} clics por pulsación`, value: L => 1 + L },
  joyas: { id: 'joyas', name: 'Joyas de Zapatero', rarity: 'rare', max: 25, icon: 'joyas',
    desc: 'Cada caída al agua puede soltar pesetas extra. Cuanto más alto, menos sube cada nivel.',
    effect: L => { const p = CARDS.joyas.value(L); return `${pct(p)} de 2 pesetas · ${pct(p / 3)} de 3`; }, value: dimin(0.45, 9) },
  mariscada: { id: 'mariscada', name: 'Mariscada Sindical', rarity: 'epic', max: 25, icon: 'mariscada',
    desc: 'Descuento en todas las mejoras de cartas. Cuanto más alto, menos descuenta cada nivel nuevo.',
    effect: L => `-${pct(CARDS.mariscada.value(L))} en mejoras`, value: dimin(0.40, 8) },
  apagon: { id: 'apagon', name: 'Apagón', rarity: 'rare', max: 25, icon: 'apagon',
    desc: 'Con la luz a medias la diana parece más grande: el centro que tira a Pedro al agua crece.',
    effect: L => `centro de la diana +${pct(CARDS.apagon.value(L))}`, value: dimin(0.45, 10) },
  plusultra: { id: 'plusultra', name: 'Plus Ultra', rarity: 'common', max: 25, icon: 'plusultra',
    desc: 'Más allá de la diana: si fallas, a veces recuperas los tomates que has lanzado.',
    effect: L => `${pct(CARDS.plusultra.value(L))} de recuperar los tomates al fallar`, value: dimin(0.5, 10) },
  hacienda: { id: 'hacienda', name: 'Hacienda Inversa', rarity: 'rare', max: 20, icon: 'hacienda',
    desc: 'Cada vez que gastas pesetas (cofres o mejoras), Hacienda te devuelve una parte.',
    effect: L => `te devuelve el ${pct(CARDS.hacienda.value(L))} de lo que gastas`, value: dimin(0.30, 8) },
  puerta: { id: 'puerta', name: 'Puerta Giratoria', rarity: 'epic', max: 20, icon: 'puerta',
    desc: 'Cada vez que mejoras una carta sales con un regalito: tomates.',
    effect: L => `${2 * L} tomates por cada mejora`, value: L => 2 * L },
  paguitas: { id: 'paguitas', name: 'Paguitas', rarity: 'legendary', max: 15, icon: 'paguitas',
    desc: 'Cada cierto tiempo llueven 3 pesetas mientras juegas. Cuanto más nivel, más a menudo.',
    effect: L => `3 pesetas cada ${CARDS.paguitas.value(L)} s`, value: L => (L > 0 ? Math.round(120 * Math.pow(0.88, L - 1)) : 0) },
  amnistia: { id: 'amnistia', name: 'Amnistía', rarity: 'legendary', max: 20, icon: 'amnistia',
    desc: 'Tus fallos quedan perdonados: a veces, aunque no aciertes en el centro, Pedro cae igual al agua.',
    effect: L => `${pct(CARDS.amnistia.value(L))} de fallos perdonados`, value: dimin(0.30, 8) },
};
export const CARD_IDS = Object.keys(CARDS);
export const CHESTS = {
  wood:    { id: 'wood', name: 'Cofre de madera', price: 8, cards: 1, tomatoes: [2, 6],   pesetaChance: 0.2, pesetas: [1, 2] },
  diamond: { id: 'diamond', name: 'Cofre de diamante', price: 40, cards: 3, tomatoes: [10, 25], pesetaChance: 0.6, pesetas: [3, 8] },
};
export const FALCON = { mult: 5, minutes: 10 };
export const SOBRE = { pesetas: 5 };

export const level = (cards, id) => cards?.[id]?.level || 0;
export const frags = (cards, id) => cards?.[id]?.frags || 0;
export function emptyCards() { const c = {}; CARD_IDS.forEach(id => c[id] = { level: 0, frags: 0 }); return c; }

export function clicksPerTap(cards, falconActive) { return CARDS.inflacion.value(level(cards, 'inflacion')) * (falconActive ? FALCON.mult : 1); }
// Fragmentos para desbloquear una carta (cuanto más rara, más cuesta)
export const unlockNeed = id => RARITIES[CARDS[id].rarity].unlock;
// Fragmentos necesarios para subir del nivel L al L+1 (L >= 1). Una vez desbloqueada cada aparición da varios.
export function fragsNeeded(id, L) {
  const r = CARDS[id].rarity;
  if (r === 'common') return 2 + L;
  if (r === 'rare') return 2 + Math.ceil(L * 0.7);
  if (r === 'epic') return 2 + Math.ceil(L / 2);
  return 2 + Math.floor(L / 2);
}
// Precio de subir del nivel L al L+1: crece con L^1.5 (muchos niveles sin precios disparatados), con el descuento de Mariscada.
export function upgradeCost(id, L, cards) {
  const r = RARITIES[CARDS[id].rarity], disc = CARDS.mariscada.value(level(cards, 'mariscada'));
  return Math.max(1, Math.round(r.baseCost * Math.pow(L, 1.5) * (1 - disc)));
}
export function canUpgrade(cards, id, pesetas) {
  const L = level(cards, id); if (L < 1 || L >= CARDS[id].max) return false;
  return frags(cards, id) >= fragsNeeded(id, L) && pesetas >= upgradeCost(id, L, cards);
}
// Pesetas por caída (Joyas de Zapatero): 1 normalmente; probabilidad de 2 y de 3.
export function rollFallPesetas(cards, rng = Math.random) {
  const p = CARDS.joyas.value(level(cards, 'joyas')), r = rng();
  if (r < p / 3) return 3; if (r < p) return 2; return 1;
}
export function maxFallPesetas() { return 3; }
// Hacienda Inversa: pesetas devueltas por un gasto. Puerta Giratoria: tomates por mejora.
export function refund(cards, spent) { const L = level(cards, 'hacienda'); return L > 0 && spent > 0 ? Math.max(1, Math.round(spent * CARDS.hacienda.value(L))) : 0; }
export function upgradeTomatoes(cards) { return CARDS.puerta.value(level(cards, 'puerta')); }
// Plus Ultra: probabilidad de recuperar los tomates de un lanzamiento fallado. Paguitas: segundos entre lluvias (0 = sin carta).
export function recoverChance(cards) { return CARDS.plusultra.value(level(cards, 'plusultra')); }
export function paguitasEvery(cards) { return CARDS.paguitas.value(level(cards, 'paguitas')); }
export const PAGUITA = 3;
// Apagón: el centro de la diana (zona que tira a Pedro) es mayor.
export function perfectRadius(cards, base) { return base * (1 + CARDS.apagon.value(level(cards, 'apagon'))); }
// Amnistía: probabilidad de que un fallo (o un casi) se perdone y Pedro caiga igual.
export function forgiveChance(cards) { return CARDS.amnistia.value(level(cards, 'amnistia')); }
export function rarityWeights(kind, cards = {}) {
  const w = {}; for (const r in RARITIES) w[r] = kind === 'wood' ? RARITIES[r].weightWood : RARITIES[r].weightDiamond;
  // las cartas al nivel máximo ya no salen: su rareza desaparece si todas las de esa rareza están al máximo
  for (const r in w) if (CARD_IDS.filter(id => CARDS[id].rarity === r).every(id => level(cards, id) >= CARDS[id].max)) w[r] = 0;
  return w;
}
export function rarityPercents(kind, cards) { const w = rarityWeights(kind, cards), t = Object.values(w).reduce((a, b) => a + b, 0) || 1, o = {}; for (const r in w) o[r] = w[r] / t * 100; return o; }
function pickRarity(w, rng) { const t = Object.values(w).reduce((a, b) => a + b, 0); let x = rng() * t; for (const r in w) { x -= w[r]; if (x < 0) return r; } return 'common'; }
export function rollChest(kind, cards, rng = Math.random) {
  const def = CHESTS[kind], w = rarityWeights(kind, cards), any = Object.values(w).some(v => v > 0);
  const out = { kind, cards: [], tomatoes: 0, pesetas: 0 };
  for (let i = 0; i < def.cards; i++) {
    if (!any) { out.pesetas += 3; continue; }      // colección completa al máximo: cada carta se cambia por 3 pesetas
    const r = pickRarity(w, rng), pool = CARD_IDS.filter(id => CARDS[id].rarity === r && level(cards, id) < CARDS[id].max), id = pool[Math.floor(rng() * pool.length)];
    out.cards.push({ id, rarity: r, bonus: false });
  }
  out.tomatoes = def.tomatoes[0] + Math.floor(rng() * (def.tomatoes[1] - def.tomatoes[0] + 1));
  if (rng() < def.pesetaChance) out.pesetas += def.pesetas[0] + Math.floor(rng() * (def.pesetas[1] - def.pesetas[0] + 1));
  return out;
}
// Aplica un cofre al estado de cartas. Sin desbloquear: +1 fragmento y, al llegar a lo necesario, se desbloquea (isNew).
// Desbloqueada: +drop fragmentos según rareza. Cada carta del premio indica frags ganados, si sigue bloqueada y su progreso.
export function applyChestCards(cards, rolled) {
  rolled.forEach(c => {
    const s = cards[c.id], R = RARITIES[CARDS[c.id].rarity];
    c.isNew = false;
    if (s.level === 0) {
      s.frags += 1; c.frags = 1;
      if (s.frags >= R.unlock) { s.level = 1; s.frags -= R.unlock; c.isNew = true; }
      c.locked = s.level === 0; c.have = s.frags; c.need = R.unlock;
    } else { s.frags += R.drop; c.frags = R.drop; c.locked = false; }
  });
}
export const MAX_IMPORT = { total_clicks: 500000, falls: 20000 };

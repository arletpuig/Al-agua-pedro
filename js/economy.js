// Economía del juego: cartas, cofres, pesetas. Funciones puras (sin DOM) para poder simularlas.
// Las mismas reglas están replicadas en supabase/schema_v2.sql para los usuarios con cuenta.
export const RARITIES = {
  common:    { name: 'Común',      color: '#8fa3b5', weightWood: 55, weightDiamond: 30, baseCost: 8,  growth: 1.42 },
  rare:      { name: 'Rara',       color: '#3fa9f5', weightWood: 15, weightDiamond: 19, baseCost: 12, growth: 1.45 },
  epic:      { name: 'Épica',      color: '#b163ff', weightWood: 11, weightDiamond: 22, baseCost: 18, growth: 1.5 },
  legendary: { name: 'Legendaria', color: '#ffb400', weightWood: 4,  weightDiamond: 10, baseCost: 30, growth: 1.55 },
};
export const CARDS = {
  inflacion: { id: 'inflacion', name: 'Inflación', rarity: 'common', max: 10, icon: 'inflacion',
    desc: 'Cada pulsación vale más clics. Todo sube, hasta tus tomates.',
    effect: L => `${1 + L} clics por pulsación`, value: L => 1 + L },
  joyas: { id: 'joyas', name: 'Joyas de Zapatero', rarity: 'rare', max: 10, icon: 'joyas',
    desc: 'Probabilidad de que cada caída al agua suelte pesetas extra. Como Fortuna, pero con joyas.',
    effect: L => `${Math.round(8 * L)}% de 2 pesetas · ${Math.round(8 * L / 3)}% de 3`, value: L => 0.08 * L },
  mariscada: { id: 'mariscada', name: 'Mariscada Sindical', rarity: 'epic', max: 8, icon: 'mariscada',
    desc: 'Descuento en todas las mejoras de cartas. Alguien tiene que pagar la comida.',
    effect: L => `-${4 * L}% en mejoras`, value: L => Math.min(0.32, 0.04 * L) },
  apagon: { id: 'apagon', name: 'Apagón', rarity: 'rare', max: 10, icon: 'apagon',
    desc: 'Con la luz a medias, Pedro puede caer también con impactos cercanos al centro.',
    effect: L => `hasta ${7 * L}% de caída en impactos cercanos`, value: L => 0.07 * L },
  amnistia: { id: 'amnistia', name: 'Amnistía', rarity: 'legendary', max: 5, icon: 'amnistia',
    desc: 'Los cofres se vuelven generosos: más cartas raras y alguna carta extra.',
    effect: L => `+${6 * L}% rareza · ${6 * L}% carta extra`, value: L => 0.06 * L },
};
export const CARD_IDS = Object.keys(CARDS);
export const CHESTS = {
  wood:    { id: 'wood', name: 'Cofre de madera', price: 15, cards: 1, tomatoes: [2, 6],   pesetaChance: 0.2, pesetas: [1, 2] },
  diamond: { id: 'diamond', name: 'Cofre de diamante', price: 80, cards: 3, tomatoes: [10, 25], pesetaChance: 0.6, pesetas: [3, 8] },
};
export const FALCON = { mult: 5, minutes: 10 };
export const SOBRE = { pesetas: 5 };

export const level = (cards, id) => cards?.[id]?.level || 0;
export const frags = (cards, id) => cards?.[id]?.frags || 0;
export function emptyCards() { const c = {}; CARD_IDS.forEach(id => c[id] = { level: 0, frags: 0 }); return c; }

export function clicksPerTap(cards, falconActive) { return CARDS.inflacion.value(level(cards, 'inflacion')) * (falconActive ? FALCON.mult : 1); }
// Fragmentos necesarios para subir del nivel L al L+1 (L >= 1)
export function fragsNeeded(id, L) {
  const r = CARDS[id].rarity;
  if (r === 'common') return 1 + Math.ceil(L / 2);
  if (r === 'rare') return 1 + Math.ceil(L / 3);
  if (r === 'epic') return 1 + Math.floor(L / 3);
  return 1;
}
export function upgradeCost(id, L, cards) {
  const r = RARITIES[CARDS[id].rarity], disc = CARDS.mariscada.value(level(cards, 'mariscada'));
  return Math.max(1, Math.round(r.baseCost * Math.pow(r.growth, L - 1) * (1 - disc)));
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
// Apagón: probabilidad de caída en impacto cercano, mayor cuanto más cerca del centro.
export function nearFallChance(cards, dist, perfectR, nearR) {
  const closeness = 1 - Math.max(0, (dist - perfectR) / (nearR - perfectR));
  return CARDS.apagon.value(level(cards, 'apagon')) * closeness;
}
export function rarityWeights(kind, cards) {
  const shift = CARDS.amnistia.value(level(cards, 'amnistia')), w = {};
  let common = 0; for (const r in RARITIES) w[r] = kind === 'wood' ? RARITIES[r].weightWood : RARITIES[r].weightDiamond;
  common = w.common * shift; w.common -= common; // reparte lo quitado al común entre las demás
  const rest = w.rare + w.epic + w.legendary;
  ['rare', 'epic', 'legendary'].forEach(r => w[r] += common * (w[r] / rest));
  return w;
}
export function rarityPercents(kind, cards) { const w = rarityWeights(kind, cards), t = Object.values(w).reduce((a, b) => a + b, 0), o = {}; for (const r in w) o[r] = w[r] / t * 100; return o; }
function pickRarity(w, rng) { const t = Object.values(w).reduce((a, b) => a + b, 0); let x = rng() * t; for (const r in w) { x -= w[r]; if (x < 0) return r; } return 'common'; }
export function rollChest(kind, cards, rng = Math.random) {
  const def = CHESTS[kind], w = rarityWeights(kind, cards), extra = rng() < CARDS.amnistia.value(level(cards, 'amnistia')) ? 1 : 0;
  const out = { kind, cards: [], tomatoes: 0, pesetas: 0 };
  for (let i = 0; i < def.cards + extra; i++) {
    const r = pickRarity(w, rng), pool = CARD_IDS.filter(id => CARDS[id].rarity === r), id = pool[Math.floor(rng() * pool.length)];
    out.cards.push({ id, rarity: r, bonus: i >= def.cards });
  }
  out.tomatoes = def.tomatoes[0] + Math.floor(rng() * (def.tomatoes[1] - def.tomatoes[0] + 1));
  if (rng() < def.pesetaChance) out.pesetas = def.pesetas[0] + Math.floor(rng() * (def.pesetas[1] - def.pesetas[0] + 1));
  return out;
}
// Aplica un cofre al estado de cartas; marca cada carta como nueva o fragmento.
export function applyChestCards(cards, rolled) {
  rolled.forEach(c => { const s = cards[c.id]; if (s.level === 0) { s.level = 1; c.isNew = true; } else { s.frags++; c.isNew = false; } });
}
export const MAX_IMPORT = { total_clicks: 500000, falls: 20000 };

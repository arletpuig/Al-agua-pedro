// Simulación de progresión para ajustar la economía. Ejecutar: node tests/sim-economy.mjs
import * as E from '../js/economy.js';
let seed = 7; const rng = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const TAPS_PER_SEC = 6, SESSION_MIN = 25, DAYS = 30, ACC = { perfect: 0.22, near: 0.45 };
const PERFECT_R = 16, NEAR_R = 70, THROW_SEC = 1.8;
function sim(label, policy) {
  const cards = E.emptyCards(); let pes = 0, pesTotal = 0, tomatoes = 0, clicks = 0, hist = 0, falls = 0, throws = 0; const log = [];
  for (let day = 1; day <= DAYS; day++) {
    // cofre diario
    const d = E.rollChest('wood', cards, rng); E.applyChestCards(cards, d.cards); tomatoes += d.tomatoes; pes += d.pesetas; pesTotal += d.pesetas;
    let t = 0;
    while (t < SESSION_MIN * 60) {
      // tocar hasta conseguir 1 tomate
      const cpt = E.clicksPerTap(cards, false); const need = Math.ceil((100 - clicks) / cpt); t += need / TAPS_PER_SEC; clicks += need * cpt;
      while (clicks >= 100) { clicks -= 100; tomatoes++; hist++; }
      // lanzar todos
      while (tomatoes > 0) {
        tomatoes--; throws++; t += THROW_SEC; const r = rng();
        let fall = false;
        if (r < ACC.perfect) fall = true;
        else if (r < ACC.perfect + ACC.near) { const dist = PERFECT_R + rng() * (NEAR_R - PERFECT_R); fall = rng() < E.nearFallChance(cards, dist, PERFECT_R, NEAR_R); }
        if (fall) { falls++; const p = E.rollFallPesetas(cards, rng); pes += p; pesTotal += p; }
      }
      // gastar
      for (let k = 0; k < 3; k++) {
        const up = E.CARD_IDS.filter(id => E.canUpgrade(cards, id, pes)).sort((a, b) => E.upgradeCost(a, E.level(cards, a), cards) - E.upgradeCost(b, E.level(cards, b), cards))[0];
        if (up) { pes -= E.upgradeCost(up, E.level(cards, up), cards); cards[up].level++; continue; }
        const kind = policy(pes, cards); if (!kind) break;
        pes -= E.CHESTS[kind].price; const c = E.rollChest(kind, cards, rng); E.applyChestCards(cards, c.cards); tomatoes += c.tomatoes; pes += c.pesetas; pesTotal += c.pesetas;
      }
    }
    if ([1, 3, 7, 14, 30].includes(day)) log.push(`d${day}: pes=${pes}/${pesTotal} tom.hist=${hist} caídas=${falls} ` + E.CARD_IDS.map(id => id.slice(0, 3) + E.level(cards, id) + '(' + E.frags(cards, id) + ')').join(' '));
  }
  console.log(label); log.forEach(l => console.log('  ' + l));
}
sim('Política: madera siempre', pes => pes >= E.CHESTS.wood.price ? 'wood' : null);
sim('Política: ahorrar para diamante', pes => pes >= E.CHESTS.diamond.price ? 'diamond' : null);
sim('Política: mixta', (pes, c) => pes >= E.CHESTS.diamond.price ? 'diamond' : (pes >= E.CHESTS.wood.price && E.level(c, 'inflacion') < 4 ? 'wood' : null));

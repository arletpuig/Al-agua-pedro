// Prueba completa del juego como invitado (guardado local). Ejecutar con el juego servido en http://localhost:8080:
//   node tests/game.test.mjs
import { launch, devices, check, summary, watchErrors, mockTime, open, tap, S, stopAt, idle, give, madrid, noCombo, URL_LOGIN, SB } from './helpers.mjs';
const browser = await launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage(); const errors = watchErrors(page); await mockTime(page);
const txt = s => page.locator(s).innerText();
const disabled = n => page.locator(`#throws button[data-n="${n}"]`).isDisabled();
// lanza ×n con su ficha; si con tantos tomates esa ficha ya no se ofrece, se lanza directamente
const throwN = async n => { if (await page.locator(`#throws button[data-n="${n}"]`).count()) await page.click(`#throws button[data-n="${n}"]`); else await page.evaluate(n => { import('./js/play.js').then(m => m.throwTomatoes(n)); }, n); };
const shot = n => page.screenshot({ path: `tests/out/${n}.png` });

console.log('1. Carga y regalo de bienvenida'); await open(page);
await page.evaluate(() => { AAP.giftTest.off = true; });   // el cofre en paracaídas se prueba al final (apartado 24)
check('el juego carga y la escena está lista', await page.evaluate(() => !!document.querySelector('#game canvas') && AAP.scene.ready));
let s = await S(page);
check('jugador nuevo: regalo de 5 tomates y 10 pesetas', s.tomatoes === 5 && s.pesetas === 10 && s.chestTomatoes === 5, `(${s.tomatoes} tomates, ${s.pesetas} pesetas)`);
await shot('01-inicio'); await noCombo(page);

console.log('2-5. Clics y tomates (200 por tomate)'); await tap(page, 450); await page.waitForTimeout(900);
s = await S(page);
check('450 clics contabilizados', s.totalClicks === 450, `(${s.totalClicks})`);
check('2 tomates por 450 clics (+5 del regalo)', s.tomatoes === 7 && s.tomatoesEarned === 7);
check('50 clics sobrantes conservados, barra de 200', s.clicks === 50 && (await txt('#bar-text')) === '50' && (await txt('#bar-max')) === '200');
check('HUD muestra tomates', (await txt('#tomato-num')) === '7');

console.log('7. Límites de lanzamiento');
check('con 7 tomates las opciones se adaptan: ×1 ×3 ×5 ×7', (await page.locator('#throws button').evaluateAll(b => b.map(x => x.dataset.n).join())) === '1,3,5,7');
check('opciones inteligentes según los tomates', await page.evaluate(() => { const f = AAP.ui.throwOptions; return f(1).join() === '1' && f(12).join() === '1,3,5,10' && f(20).join() === '5,10,15,20' && f(0).length === 0 && Math.max(...f(80)) <= 80; }));
check('no se pueden lanzar más de los disponibles (llamada directa)', await page.evaluate(async () => (await import('./js/play.js')).throwTomatoes(10)) === false && (await S(page)).tomatoes === 7);

console.log('6, 9, 10, 11. Lanzamiento ×1: tutorial, el mismo botón lanza, perfecto');
await throwN(1); await page.waitForTimeout(300);
check('tutorial la primera vez', await page.locator('#panel-tutorial').evaluate(e => e.classList.contains('open')));
await page.click('#panel-tutorial [data-close]'); await page.waitForTimeout(300);
check('descuenta 1 tomate al lanzar', (await S(page)).tomatoes === 6);
check('el botón grande pasa a ¡LANZA!', await page.locator('#btn-click.aim').isVisible() && (await txt('#mega-lbl')) === '¡LANZA!');
check('los primeros lanzamientos van más despacio', await page.evaluate(async () => AAP.scene.aim.speed < 0.8 * (await import('./js/config.js')).CONFIG.AIM_SPEED));
await stopAt(page, 0, 10); await page.waitForTimeout(1500); await shot('02-caida');
await idle(page); s = await S(page);
check('impacto perfecto: Pedro cae', s.falls === 1 && s.perfects === 1);
check('1 peseta por caída (sin Joyas)', s.pesetas === 11 && s.pesetasEarned === 1);
check('Pedro vuelve al tablón', await page.evaluate(() => !AAP.scene.pose && !AAP.scene.busy && AAP.scene.S.plankAng === 0));

console.log('9. Fallos y cercano con ×1');
await throwN(1); await page.waitForFunction(() => AAP.scene.aim); await page.click('#btn-click');   // el botón grande lanza
check('pulsar el botón grande mientras apuntas lanza (no suma clics)', await page.evaluate(() => !AAP.scene.aim) && (await S(page)).totalClicks === 450);
await idle(page);
await throwN(1); await stopAt(page, 160, 195, 'R'); await page.waitForTimeout(900); await shot('03-fallo-derecha'); await idle(page); s = await S(page);
check('fallo a la derecha: no cae, sin pesetas, tomate gastado', s.falls === 1 && s.pesetas === 11 && s.tomatoesThrown === 3);
await throwN(1); await stopAt(page, 170, 280, 'L'); await page.waitForTimeout(1500); await shot('03b-fallo-izquierda-pedro-lo-coge');
check('fallo a la izquierda: Pedro coge el tomate y se lo pone de nariz', await page.evaluate(() => AAP.scene.clipName === 'catchNose'));
await idle(page); s = await S(page);
check('el tomate cogido cuenta como fallo', s.falls === 1 && s.hits === 1 && s.tomatoesThrown === 4);
await throwN(1); await stopAt(page, 80, 140); await page.waitForTimeout(600); await shot('04-cercano'); await idle(page); s = await S(page);
check('cercano sin Apagón: cuenta como impacto pero no cae', s.hits === 2 && s.falls === 1 && s.perfects === 1);
check('la mancha se queda en la diana', await page.evaluate(() => AAP.scene.splats.length > 0));

console.log('6, 8, 12. Lanzamientos múltiples: un solo tomate que vale por varios');
await tap(page, 200); await page.waitForTimeout(500);
let before = await S(page);
await throwN(3); await page.waitForTimeout(200);
check('×3 descuenta exactamente 3', (await S(page)).tomatoes === before.tomatoes - 3);
check('×3 es un solo tiro', await page.evaluate(() => AAP.scene.aim?.n === 3));
await stopAt(page, 0, 10); await idle(page); s = await S(page);
check('×3 perfecto: cuenta 3 caídas y 3 pesetas', s.falls === before.falls + 3 && s.perfects === before.perfects + 3 && s.pesetas === before.pesetas + 3 && s.tomatoesThrown === before.tomatoesThrown + 3);
check('después no hay más tiros pendientes', await page.evaluate(() => !AAP.scene.aim && !AAP.scene.busy));
await tap(page, 3800); await page.waitForTimeout(900); s = await S(page);
check('19 tomates (sin límite artificial)', s.tomatoes === 19, `(${s.tomatoes})`);
before = await S(page); await throwN(5); await stopAt(page, 160, 195, 'R'); await idle(page); s = await S(page);
check('×5 descuenta 5 y no premia un fallo', s.tomatoes === before.tomatoes - 5 && s.pesetas === before.pesetas && s.falls === before.falls);
before = await S(page); await throwN(10); await stopAt(page, 0, 10); await idle(page); s = await S(page);
check('×10 descuenta 10', s.tomatoes === before.tomatoes - 10 && s.tomatoesThrown === before.tomatoesThrown + 10);
check('×10 perfecto: 10 caídas y 10 pesetas, sin duplicados', s.falls === before.falls + 10 && s.pesetas === before.pesetas + 10, `(caídas +${s.falls - before.falls}, pesetas +${s.pesetas - before.pesetas})`);
check('estado coherente (Pedro en el tablón)', await page.evaluate(() => !AAP.scene.busy && !AAP.scene.pose && AAP.scene.S.plankAng === 0));

console.log('Racha de pulsaciones');
await page.evaluate(() => import('./js/config.js').then(m => { m.CONFIG.COMBO.perTap = 1; }));
before = await S(page);
for (let i = 0; i < 5; i++) { await tap(page, 10); await page.waitForTimeout(120); }
check('la racha tarda en aparecer (50 toques: todavía nada)', await page.evaluate(() => document.querySelector('#combo').classList.contains('hidden')));
for (let i = 0; i < 6; i++) { await tap(page, 10); await page.waitForTimeout(120); }
check('el ×3 tarda más (110 toques: solo ×2)', await page.evaluate(() => document.querySelector('#combo-x').textContent === '×2' && !document.querySelector('#combo').classList.contains('hidden')));
for (let i = 0; i < 14; i++) { await tap(page, 10); await page.waitForTimeout(120); }
s = await S(page); await page.waitForTimeout(150); await shot('04b-racha');
check('pulsando mucho seguido sube el multiplicador (×3)', await page.evaluate(() => document.querySelector('#btn-click').classList.contains('c3') && !document.querySelector('#combo').classList.contains('hidden') && document.querySelector('#combo-x').textContent === '×3'));
check('con racha cada toque vale más', s.totalClicks - before.totalClicks > 250 && s.totalClicks - before.totalClicks <= 750, `(+${s.totalClicks - before.totalClicks} con 250 toques)`);
check('sin mensaje de racha', !(await page.locator('#toast').evaluate(e => e.classList.contains('on') && /RACHA/.test(e.textContent))));
await page.waitForTimeout(1600);
check('si paras, el ×3 se va enseguida', await page.evaluate(() => !document.querySelector('#btn-click').classList.contains('c3')));
await page.waitForTimeout(4500);
check('y la racha desaparece del todo en pocos segundos', await page.evaluate(() => document.querySelector('#combo').classList.contains('hidden') && !document.querySelector('#btn-click').classList.contains('c2') && !document.querySelector('#btn-click').classList.contains('c3')));
await noCombo(page);

console.log('Frases de Pedro');
check('al fallar solo dice que hay que darle al centro; el resto, sus frases típicas', await page.evaluate(() => import('./js/game/arena.js').then(m => {
  const L = m.LINES, centro = '¡Le tienes que dar al centro, eh! ¡Jajajaja!';
  return [L.near, L.miss, L.leftMiss].every(a => a.length === 1 && a[0] === centro) && L.idle.includes('¡No dimitiré!') && L.idle.includes('España va como una moto') && L.wetWater === L.idle;
})));

console.log('19. Ranking: tomates históricos');
s = await S(page);
check('los tomates históricos no bajan al lanzar', s.tomatoesEarned === Math.floor(s.totalClicks / 200) + s.chestTomatoes && s.tomatoes === s.tomatoesEarned - s.tomatoesThrown, `(históricos ${s.tomatoesEarned}, disponibles ${s.tomatoes})`);
check('las estadísticas lo muestran', await page.evaluate(n => { AAP.ui.renderStats(); return document.querySelector('#stats-list').innerText.includes(n.toLocaleString('es-ES')); }, s.tomatoesEarned));

console.log('18. Vídeos recompensados de la tienda');
await page.click('#tabs [data-panel="shop"]'); await page.waitForTimeout(300); await shot('06-tienda');
check('sin anuncios aprobados: El Falcón y el Sobre en «PRONTO»', await page.locator('#btn-falcon').isDisabled() && await page.locator('#btn-sobre').isDisabled() && (await txt('#btn-sobre')).includes('PRONTO'));
check('y no conceden nada', await page.evaluate(() => AAP.backend.watchAd('sobre').then(() => false, e => /no están disponibles/.test(e.message))));
await page.click('#panel-shop [data-close]');
// con los vídeos encendidos (vídeo de muestra), como cuando Google apruebe los anuncios
await page.evaluate(async () => { const m = await import('./js/ads.js'); m.DEMO_AD.seconds = 1; m.adsTest.on = true; });
await page.click('#tabs [data-panel="shop"]'); await page.waitForTimeout(300);
check('botones de vídeo activos', !(await page.locator('#btn-sobre').isDisabled()) && (await txt('#btn-sobre')).includes('VÍDEO'));
before = await S(page);
await page.click('#btn-sobre'); await page.waitForTimeout(300);
check('el Sobre pone un vídeo', await page.evaluate(() => document.querySelector('#ad-overlay').classList.contains('open')));
await page.waitForTimeout(1500); s = await S(page);
check('Sobre de la Moncloa: +25 pesetas tras el vídeo', s.pesetas === before.pesetas + 25, `(${before.pesetas} → ${s.pesetas})`);
await page.evaluate(async () => { AAP.state.stats.chestPesetas -= 25; (await import('./js/state.js')).changed(false); });   // se devuelven para no alterar las pruebas siguientes
await page.click('#btn-falcon'); await page.waitForTimeout(1700); s = await S(page);
check('El Falcón se activa tras el vídeo', s.falcon > Date.now() && await page.locator('#btn-falcon').isDisabled());
await page.evaluate(async () => { AAP.state.falconUntil = 0; (await import('./js/ads.js')).adsTest.on = false; });
await page.click('#panel-shop [data-close]');

console.log('El Falcón: indicador y multiplicador (estado simulado, sin anuncio)');
before = await S(page); await page.evaluate(() => { AAP.state.falconUntil = Date.now() + 61000; }); await page.waitForTimeout(1300); await tap(page, 2); s = await S(page);
check('con El Falcón activo cada pulsación vale ×5', s.totalClicks === before.totalClicks + 10);
check('indicador y cuenta atrás visibles', await page.locator('#falcon-badge').isVisible() && /^0:5\d$/.test(await txt('#falcon-time')) && (await txt('#cpt-badge')).includes('+5'));
await shot('06b-falcon'); await page.evaluate(() => { AAP.state.falconUntil = Date.now() - 1; }); await page.waitForTimeout(1200); before = await S(page); await tap(page, 2);
check('al terminar vuelve a la producción normal', (await S(page)).totalClicks === before.totalClicks + 2 && !(await page.locator('#falcon-badge').isVisible()));
await page.evaluate(() => { AAP.state.falconUntil = 0; });

console.log('13, 14, 15. Cofres');
await page.click('#tabs [data-panel="shop"]'); await page.waitForTimeout(300); await shot('07-cofres');
check('sin pesetas suficientes: comprar diamante desactivado', await page.locator('[data-buy="diamond"]').isDisabled());
check('probabilidades visibles', await page.evaluate(() => { document.querySelector('[data-probs]').click(); return document.querySelector('.probs.open')?.innerText.includes('%'); }));
before = await S(page);
await page.click('[data-daily]'); await page.waitForSelector('#chest-overlay.open'); await page.click('#chest-btn'); await page.waitForFunction(() => document.querySelector('#chest-btn').textContent === 'RECOGER' && !document.querySelector('#chest-btn').disabled, null, { timeout: 15000 }); await shot('08-cofre-abierto');
const nRew = await page.locator('#chest-rewards .reward').count(); await page.click('#chest-btn'); await page.waitForTimeout(400); s = await S(page);
check('cofre diario gratis: da carta y tomates, no cuesta', nRew >= 2 && s.pesetasSpent === before.pesetasSpent && s.chestTomatoes >= 2 && s.chestsOpened === 1);
check('carta guardada (fragmento o desbloqueada)', Object.values(s.cards).some(c => c.level > 0 || c.frags > 0));
check('cofre diario marcado con la fecha del servidor', s.daily === madrid(new Date()));
check('cofre diario no se puede reclamar dos veces (botón)', await page.locator('[data-daily]').isDisabled());
check('cofre diario no se puede reclamar dos veces (llamada directa)', await page.evaluate(() => AAP.backend.claimDaily().then(() => false, e => e.message.includes('Ya has reclamado'))));
await give(page, { pesetas: 300 }); await page.evaluate(() => AAP.ui.renderChests());
before = await S(page);
await page.click('[data-buy="wood"]'); await page.waitForSelector('#chest-overlay.open'); await page.click('#chest-btn'); await page.waitForFunction(() => document.querySelector('#chest-btn').textContent === 'RECOGER' && !document.querySelector('#chest-btn').disabled); await page.click('#chest-btn'); await page.waitForTimeout(400); s = await S(page);
check('cofre de madera: cuesta 8 pesetas (más asequible)', s.pesetasSpent === before.pesetasSpent + 8 && s.chestsOpened === before.chestsOpened + 1);
before = s;
await page.click('[data-buy="diamond"]'); await page.waitForSelector('#chest-overlay.open'); await page.click('#chest-btn'); await page.waitForFunction(() => document.querySelector('#chest-btn').textContent === 'RECOGER' && !document.querySelector('#chest-btn').disabled, null, { timeout: 15000 }); await shot('09-cofre-diamante');
const nCards = await page.locator('#chest-rewards .reward .tag').evaluateAll(els => els.filter(e => !/tomates|pesetas/i.test(e.textContent)).length); await page.click('#chest-btn'); await page.waitForTimeout(400); s = await S(page);
check('cofre de diamante: cuesta 40 pesetas y da 3+ cartas y 10+ tomates', s.pesetasSpent === before.pesetasSpent + 40 && nCards >= 3 && s.chestTomatoes - before.chestTomatoes >= 10, `(${nCards} cartas, +${s.chestTomatoes - before.chestTomatoes} tomates)`);
check('los tomates de cofre cuentan como históricos', s.tomatoesEarned === Math.floor(s.totalClicks / 200) + s.chestTomatoes);
await page.click('#panel-shop [data-close]');

console.log('Cartas: desbloqueo por fragmentos');
check('desbloquear cuesta más cuanto más rara', await page.evaluate(() => { const E = AAP.E; return E.unlockNeed('puerta') < E.unlockNeed('mariscada') && E.unlockNeed('mariscada') < E.unlockNeed('hacienda') && E.unlockNeed('hacienda') < E.unlockNeed('inflacion'); }));
check('rarezas nuevas: legendarias, épicas, poco común y comunes', await page.evaluate(() => { const C = AAP.E.CARDS, r = id => C[id].rarity; return ['inflacion', 'joyas'].every(id => r(id) === 'legendary') && ['hacienda', 'paguitas'].every(id => r(id) === 'epic') && r('mariscada') === 'rare' && AAP.E.RARITIES.rare.name === 'Poco común' && ['puerta', 'plusultra', 'apagon', 'amnistia'].every(id => r(id) === 'common'); }));
check('sin desbloquear da 1 fragmento; al llegar se desbloquea; luego da varios', await page.evaluate(() => {
  const E = AAP.E, c = E.emptyCards(), need = E.unlockNeed('hacienda'); let unlocked = 0;
  for (let i = 0; i < need; i++) { const r = [{ id: 'hacienda' }]; E.applyChestCards(c, r); if (r[0].isNew) unlocked++; if (i < need - 1 && (r[0].frags !== 1 || !r[0].locked)) return false; }
  const r = [{ id: 'hacienda' }]; E.applyChestCards(c, r);
  return unlocked === 1 && c.hacienda.level === 1 && r[0].frags === E.RARITIES.epic.drop && r[0].frags > 1;
}));
console.log('16, 17. Cartas y potenciadores');
await give(page, { cards: { inflacion: { level: 1, frags: 6 }, mariscada: { level: 1, frags: 3 }, joyas: { level: 1, frags: 0 }, apagon: { level: 1, frags: 0 }, amnistia: { level: 1, frags: 0 } } });
await page.click('#tabs [data-panel="cards"]'); await page.waitForTimeout(300); await shot('10-cartas');
check('cartas ordenadas por rareza: comunes primero y legendarias al final, con brillo', await page.evaluate(() => { const r = [...document.querySelectorAll('#cards-grid .card')].map(c => AAP.E.CARDS[c.dataset.id].rarity), o = ['common', 'rare', 'epic', 'legendary']; return r.every((x, i) => i === 0 || o.indexOf(x) >= o.indexOf(r[i - 1])) && r.at(-1) === 'legendary' && document.querySelectorAll('#cards-grid .card.r-legendary').length === 2; }));
check('la colección muestra las 10 cartas (con Chantaje Pegasus)', await page.locator('#cards-grid .card').count() === 10 && /Plus Ultra/.test(await txt('#cards-grid')) && /Paguitas/.test(await txt('#cards-grid')) && /Chantaje Pegasus/.test(await txt('#cards-grid')));
before = await S(page);
const cost = await page.evaluate(() => AAP.E.upgradeCost('inflacion', 1, AAP.state.cards)), needF = await page.evaluate(() => AAP.E.fragsNeeded('inflacion', 1));
await page.click('[data-upgrade="inflacion"]'); await page.waitForTimeout(300); s = await S(page);
check('mejorar Inflación descuenta el precio exacto y los fragmentos', s.pesetas === before.pesetas - cost && s.cards.inflacion.level === 2 && s.cards.inflacion.frags === 6 - needF, `(coste ${cost}, ${needF} fragmentos)`);
check('no se puede mejorar sin fragmentos', await page.locator('[data-upgrade="joyas"]').isDisabled());
const base = await page.evaluate(() => AAP.E.upgradeCost('inflacion', 2, { mariscada: { level: 0 } }));
await page.click('[data-upgrade="mariscada"]'); await page.waitForTimeout(300); s = await S(page);
const disc = await page.evaluate(() => AAP.E.upgradeCost('inflacion', 2, AAP.state.cards));
check('Mariscada Sindical abarata las mejoras', s.cards.mariscada.level === 2 && disc < base && disc >= 1, `(${base} → ${disc})`);
check('precio de mejora: tachado solo con descuento y siempre más caro que el real', await page.evaluate(() => [...document.querySelectorAll('#cards-grid button[data-upgrade]')].every(b => { const d = b.querySelector('del'); return !d || +d.textContent > +b.textContent.replace(d.textContent, '').trim(); })));
check('Mariscada: cada nivel descuenta menos y nunca pasa del 40%', await page.evaluate(() => { const v = AAP.E.CARDS.mariscada.value; return v(2) - v(1) > v(25) - v(24) && v(25) < 0.40 && v(100) <= 0.40 && AAP.E.upgradeCost('inflacion', 1, { mariscada: { level: 25 } }) >= 1; }));
await page.click('#panel-cards [data-close]');
before = await S(page); await tap(page, 10); s = await S(page);
check('Inflación nivel 2: 3 clics por pulsación', s.totalClicks === before.totalClicks + 30 && (await txt('#cpt-badge')).includes('+3'));
check('Joyas de Zapatero: 2 o 3 pesetas, y cada nivel da menos', await page.evaluate(() => { const E = AAP.E, c = { joyas: { level: 10 } }, p = E.CARDS.joyas.value(10), v = E.CARDS.joyas.value; return E.rollFallPesetas(c, () => p / 6) === 3 && E.rollFallPesetas(c, () => p / 2) === 2 && E.rollFallPesetas(c, () => 0.99) === 1 && E.rollFallPesetas({ joyas: { level: 0 } }, () => 0) === 1 && v(2) - v(1) > v(25) - v(24) && v(25) < 0.45; }));
check('muchos más niveles de mejora', await page.evaluate(() => { const C = AAP.E.CARDS; return C.inflacion.max === 30 && C.joyas.max === 25 && C.mariscada.max === 25 && C.apagon.max === 25 && C.amnistia.max === 20 && C.plusultra.max === 25 && C.hacienda.max === 20 && C.puerta.max === 20 && C.paguitas.max === 15; }));
check('Apagón: el centro de la diana crece', await page.evaluate(() => AAP.E.perfectRadius({ apagon: { level: 10 } }, 46) > 46 * 1.2 && AAP.E.perfectRadius({}, 46) === 46));
check('las cartas al máximo ya no salen en los cofres', await page.evaluate(() => { const E = AAP.E, c = E.emptyCards(); c.inflacion = { level: 30, frags: 0 }; for (let i = 0; i < 300; i++) if (E.rollChest('wood', c).cards.some(x => x.id === 'inflacion')) return false; return true; }));
check('con toda la colección al máximo el cofre da pesetas', await page.evaluate(() => { const E = AAP.E, c = {}; E.CARD_IDS.forEach(id => c[id] = { level: E.CARDS[id].max, frags: 0 }); const r = E.rollChest('diamond', c); return r.cards.length === 0 && r.pesetas >= 9; }));
// Amnistía en juego real: con azar forzado perdona un casi y también un fallo (cuenta como impacto); sin suerte, nada.
await give(page, { tomatoes: 3, cards: { amnistia: { level: 10, frags: 0 } } });
await page.evaluate(() => { AAP.testRng.fn = () => 0.01; });
before = await S(page); await throwN(1); await stopAt(page, 80, 120); await idle(page); s = await S(page);
check('Amnistía: un casi puede derribar', s.falls === before.falls + 1 && s.perfects === before.perfects && s.pesetas > before.pesetas);
before = s; await throwN(1); await stopAt(page, 160, 195, 'R'); await idle(page); s = await S(page);
check('Amnistía: un fallo perdonado derriba y cuenta como impacto', s.falls === before.falls + 1 && s.hits === before.hits + 1);
await page.evaluate(() => { AAP.testRng.fn = () => 0.99; });
before = s; await throwN(1); await stopAt(page, 160, 195, 'R'); await idle(page); s = await S(page);
check('sin suerte, el fallo sigue siendo fallo', s.falls === before.falls);
await page.evaluate(() => { AAP.testRng.fn = null; });

console.log('18. Cartas nuevas: Plus Ultra, Hacienda Inversa, Puerta Giratoria y Paguitas');
await give(page, { tomatoes: 2, cards: { amnistia: { level: 0, frags: 0 }, plusultra: { level: 10, frags: 0 } } });
await page.evaluate(() => { AAP.testRng.fn = () => 0.01; });
before = await S(page); await throwN(1); await stopAt(page, 160, 195, 'R'); await idle(page); s = await S(page);
check('Plus Ultra: al fallar recuperas el tomate', s.falls === before.falls && s.tomatoes === before.tomatoes && s.tomatoesRefunded === (before.tomatoesRefunded || 0) + 1);
await page.evaluate(() => { AAP.testRng.fn = () => 0.99; });
before = s; await throwN(1); await stopAt(page, 160, 195, 'R'); await idle(page); s = await S(page);
check('Plus Ultra: sin suerte, el tomate se pierde', s.tomatoes === before.tomatoes - 1 && s.tomatoesRefunded === before.tomatoesRefunded);
await page.evaluate(() => { AAP.testRng.fn = null; });
await give(page, { pesetas: 200, cards: { hacienda: { level: 10, frags: 0 }, puerta: { level: 5, frags: 0 }, inflacion: { level: 3, frags: 40 } } });
const hac = await page.evaluate(async () => { const b = { ...AAP.state.stats }, p0 = AAP.state.pesetas, r = await AAP.backend.openChest('diamond'); return { r, d: AAP.state.pesetas - p0, exp: AAP.E.refund(AAP.state.cards, 40) }; });
check('Hacienda Inversa: el cofre te devuelve pesetas', hac.r.refund > 0 && hac.r.refund === hac.exp && hac.d === -40 + hac.r.refund + hac.r.pesetas, JSON.stringify({ refund: hac.r.refund, d: hac.d }));
const pg = await page.evaluate(async () => { const t0 = AAP.state.tomatoes, p0 = AAP.state.pesetas, cost = AAP.E.upgradeCost('inflacion', AAP.state.cards.inflacion.level, AAP.state.cards), b = await AAP.backend.upgradeCard('inflacion'); return { b, dt: AAP.state.tomatoes - t0, dp: AAP.state.pesetas - p0, cost }; });
check('Puerta Giratoria: 2 tomates por nivel en cada mejora; Hacienda devuelve parte', pg.b.tomatoes === 10 && pg.dt === 10 && pg.b.refund >= 1 && pg.dp === -pg.cost + pg.b.refund, JSON.stringify(pg));
check('Paguitas: 3 monedas cada 75 s; cada moneda vale 3 × nivel (nivel 1: 9 por lluvia... nivel 15: 135)', await page.evaluate(() => { const v = AAP.E.CARDS.paguitas.value, T = AAP.E.paguitaTotal, C = AAP.E.paguitaCoins; return v(0) === 0 && v(1) === 75 && v(15) === 75 && T(1) === 9 && T(2) === 18 && T(3) === 27 && T(15) === 135 && C(4).join() === '12,12,12' && /135 pesetas cada 75 s/.test(AAP.E.CARDS.paguitas.effect(15)); }));
await give(page, { cards: { paguitas: { level: 15, frags: 0 }, hacienda: { level: 0, frags: 0 }, puerta: { level: 0, frags: 0 }, plusultra: { level: 0, frags: 0 } } });
await page.evaluate(() => { AAP.paguitaTest.every = 12; });
before = await S(page); await page.waitForSelector('.pg-coin', { timeout: 30000 }); await page.waitForTimeout(1500);
const pgc = await page.evaluate(() => { const c = document.querySelector(".pg-coin"); return { w: c.offsetWidth, anim: getComputedStyle(c.querySelector('.pg-spin')).animationName, n: document.querySelectorAll('.pg-coin').length, x: c.querySelector('.pg-x')?.textContent }; });
check("Paguitas: caen 3 monedas que giran, marcadas ×45 en el nivel 15", pgc.n === 3 && pgc.w >= 36 && pgc.w <= 48 && pgc.anim === "pgspin" && pgc.x === '×45', JSON.stringify(pgc));
s = await S(page); check('si no las tocas no se cobran', s.paguitasPesetas === (before.paguitasPesetas || 0));
for (const c of await page.locator('.pg-coin').all()) await c.dispatchEvent('pointerdown');
await page.waitForTimeout(300); s = await S(page);
check('tocándolas: +135 pesetas (3 monedas de 45)', s.paguitasPesetas === (before.paguitasPesetas || 0) + 135 && s.pesetas === before.pesetas + 135, `(${before.pesetas} → ${s.pesetas})`);
await give(page, { cards: { paguitas: { level: 0, frags: 0 } } }); await page.evaluate(() => { AAP.paguitaTest.every = 0; });
console.log('19. Pedro habla mientras pulsas');
check('Pedro habla menos: como mucho una frase cada 25 s al pulsar y cada 50–80 s sin pulsar', await page.evaluate(() => AAP.CHAT.gap >= 25000 && AAP.CHAT.taps[0] >= 120 && AAP.CHAT.idle[0] >= 50000));
await page.evaluate(() => { AAP.CHAT.gap = 0; });
await page.waitForFunction(() => !AAP.scene.bubble, null, { timeout: 8000 });
let said = false; for (let i = 0; i < 30 && !said; i++) { await tap(page, 10); await page.waitForTimeout(80); said = await page.evaluate(() => !!AAP.scene.bubble); }
check('al ir pulsando, Pedro suelta alguna frase', said, said ? await page.evaluate(() => AAP.scene.bubble.text) : '');

console.log('20. Persistencia'); before = await S(page);
await page.reload(); await page.waitForFunction(() => window.AAP?.scene?.ready); await page.waitForTimeout(500); s = await S(page);
check('clics, tomates, pesetas, estadísticas y cartas persisten', JSON.stringify(s) === JSON.stringify(before));
await page.click('#btn-settings'); await page.waitForTimeout(300); await page.click('#btn-stats'); await page.waitForTimeout(300); await shot('11-estadisticas');
check('panel de estadísticas completo', /Tomates conseguidos/.test(await txt('#stats-list')) && /Pedro al agua/.test(await txt('#stats-list')) && /Inflación/.test(await txt('#stats-list')));
await page.click('#panel-stats [data-close]');
await page.click('#btn-settings'); await page.waitForTimeout(300);
const snd = async () => page.evaluate(() => [AAP.state.sound, AAP.state.music, document.querySelector('#sw-sound').classList.contains('on'), document.querySelector('#sw-music').classList.contains('on')].join());
const songs = []; page.on('response', r => { if (r.url().includes('assets/musica/musica.mp3')) songs.push(r.status() + ' ' + (r.headers()['content-type'] || '')); });
await page.click('#btn-sound'); const m1 = await snd(); await page.click('#btn-music'); const m2 = await snd(); await page.waitForTimeout(1200);
check('música: al activarla se descarga la canción nueva', songs.length > 0 && /^(200|206)/.test(songs[0]), songs.join(' | ') || 'no se ha pedido');
await page.click('#btn-music'); const m3 = await snd();
check('sonido: silencio, música opcional y vuelta a solo efectos', m1 === 'false,false,false,false' && m2 === 'true,true,true,true' && m3 === 'true,false,true,false', [m1, m2, m3].join(' | '));
await page.click('#panel-settings [data-close]');

console.log('14. Cofre diario y reloj del dispositivo');
const ctx2 = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, storageState: await ctx.storageState() });
await ctx2.addInitScript(() => { const real = Date.now; Date.now = () => real() + 2 * 86400e3; });   // el jugador adelanta el reloj 2 días
const p2 = await ctx2.newPage(); await mockTime(p2); await open(p2); await p2.waitForTimeout(600);
check('adelantar el reloj no desbloquea el cofre diario', await p2.evaluate(() => AAP.backend.dailyAvailable() === false && AAP.backend.claimDaily().then(() => false, () => true)));
await ctx2.close();

console.log('22. Perfil: bandera, nombre e imagen para compartir');
await page.click('#tabs [data-panel="profile"]'); await page.waitForTimeout(400);
check('el perfil enseña las 35 banderas redondas', await page.locator('#flag-grid .flag').count() === 35 && await page.evaluate(() => getComputedStyle(document.querySelector('#flag-grid .av')).borderRadius === '50%'));
await page.click('#flag-grid [data-flag="tercios"]'); await page.waitForTimeout(300);
check('elegir bandera la marca y la pone en la pestaña', await page.locator('#flag-grid .flag.on').getAttribute('data-flag') === 'tercios' && (await page.locator('#tab-av').innerHTML()).includes('#c8102e'));
await page.click('#flag-grid [data-flag="cruz"]'); await page.waitForTimeout(300);
check('sin anuncios aprobados, cambiar de bandera es gratis', !(await page.evaluate(() => document.querySelector('#ad-overlay').classList.contains('open'))) && await page.locator('#flag-grid .flag.on').getAttribute('data-flag') === 'cruz' && !(await page.locator('#flag-note').isVisible()));
await page.evaluate(async () => { const m = await import('./js/ads.js'); m.DEMO_AD.seconds = 1; m.adsTest.on = true; });
await page.click('#flag-grid [data-flag="tercios"]'); await page.waitForTimeout(1600);
await page.click('#flag-grid [data-flag="vox"]'); await page.waitForTimeout(300);
check('cambiar de bandera pide ver un vídeo', await page.evaluate(() => document.querySelector('#ad-overlay').classList.contains('open')) && await page.locator('#flag-note').isVisible());
await page.waitForTimeout(1500);
await page.evaluate(async () => { (await import('./js/ads.js')).adsTest.on = false; });
check('después del vídeo se pone la bandera nueva', await page.locator('#flag-grid .flag.on').getAttribute('data-flag') === 'vox', await page.locator('#flag-grid .flag.on').getAttribute('data-flag') + ' · ' + await page.locator('#toast').innerText());
await page.fill('#name-input', 'Tomatero Pro'); await page.click('#form-name button'); await page.waitForTimeout(300);
check('cambiar el nombre', (await txt('#prof-name')) === 'Tomatero Pro');
await page.fill('#name-input', 'ab'); await page.click('#form-name button'); await page.waitForTimeout(200);
check('nombre demasiado corto rechazado', (await txt('#prof-name')) === 'Tomatero Pro');
check('ya no hay títulos inventados: en su lugar, la comunidad autónoma', await page.locator('#title-chips, #title-input').count() === 0 && /Elige tu comunidad/.test(await page.locator('#prof-title').textContent()));
check('se puede elegir entre las 17 comunidades y Ceuta y Melilla', await page.locator('#region-grid button').count() === 19);
await page.click('#region-grid button[data-region="madrid"]', { force: true }); await page.waitForTimeout(300);
check('elegir comunidad: se ve bajo el nombre', (await page.locator('#prof-title').textContent()) === 'Comunidad de Madrid' && await page.locator('#region-grid button.on').getAttribute('data-region') === 'madrid', await page.locator('#prof-title').textContent());
check('elegida, la lista de comunidades se esconde', !(await page.locator('#region-grid').isVisible()));
await page.click('#prof-title'); await page.waitForTimeout(250);
check('tocando su nombre se vuelve a abrir para cambiarla', await page.locator('#region-grid').isVisible());
await page.click('#region-grid button[data-region="cataluna"]', { force: true }); await page.waitForTimeout(300);
check('y al elegir otra se vuelve a cerrar', (await page.locator('#prof-title').textContent()) === 'Cataluña' && !(await page.locator('#region-grid').isVisible()));
await shot('12-perfil');
await page.click('#btn-share'); await page.waitForFunction(() => document.querySelector('#share-img').naturalWidth > 0, null, { timeout: 15000 });
check('imagen para compartir de 1080×1920', await page.evaluate(() => { const i = document.querySelector('#share-img'); return i.naturalWidth === 1080 && i.naturalHeight === 1920; }));
await shot('13-compartir'); await page.click('#share-close'); await page.click('#panel-profile [data-close]');
check('Hacienda Inversa más moderada: como mucho un 12 %', await page.evaluate(() => { const v = AAP.E.CARDS.hacienda.value; return v(20) <= 0.12 && v(20) > 0.10 && v(1) < 0.02; }));

console.log('23. Acceso obligatorio y Google');
const p3 = await ctx.newPage(); let authorize = null, googleOn = false;
await p3.route(SB, route => { const u = new URL(route.request().url());
  if (u.pathname.endsWith('/auth/v1/settings')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ external: { google: googleOn, email: true } }) });
  if (u.pathname.endsWith('/auth/v1/authorize')) { authorize = u; return route.fulfill({ status: 200, contentType: 'text/html', body: '<p>google</p>' }); }
  if (u.pathname.endsWith('/rpc/server_now')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ date: madrid(new Date()), now: new Date().toISOString(), next_midnight: new Date(Date.now() + 6 * 3600e3).toISOString() }) });
  return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' }); });
await open(p3, URL_LOGIN); await p3.waitForTimeout(300);
check('sin sesión aparece la pantalla de cuenta y no se puede cerrar', await p3.evaluate(() => { const p = document.querySelector('#panel-account'); return p.classList.contains('open') && p.classList.contains('forced') && getComputedStyle(p.querySelector('.close')).display === 'none'; }));
await p3.mouse.click(5, 5); await p3.waitForTimeout(200);
check('tocar fuera no la cierra', await p3.evaluate(() => document.querySelector('#panel-account').classList.contains('open')));
await p3.screenshot({ path: 'tests/out/14-acceso.png' });
await p3.click('#btn-google'); await p3.waitForTimeout(400);
check('Google sin activar en Supabase: aviso claro', (await p3.locator('#acc-msg').innerText()).includes('Google todavía no está activado'));
googleOn = true; await p3.click('#btn-google'); await p3.waitForURL(/authorize/, { timeout: 5000 }).catch(() => {});
check('Google activado: va a Supabase con proveedor google y vuelve al juego', authorize?.searchParams.get('provider') === 'google' && /localhost:8080\//.test(authorize?.searchParams.get('redirect_to') || ''), String(authorize));
await p3.close();

console.log('24. Regalo de bienvenida en paracaídas');
await page.evaluate(async () => { AAP.giftTest.off = false; AAP.state.welcomeClaimed = false; AAP.state.welcomeOfferedAt = null; const m = await import('./js/ads.js'); m.DEMO_AD.seconds = 1; m.adsTest.on = true; });
await give(page, { tomatoes: 2 }); before = await S(page);
await throwN(1); await stopAt(page, 0, 10); await idle(page);
check('al tirar a Pedro baja un cofre en paracaídas', await page.evaluate(() => !document.querySelector('#gift-drop').classList.contains('hidden')));
await page.waitForSelector('#gift-overlay.open', { timeout: 8000 });
check('pantalla del regalo con cuenta atrás de 10 minutos', /^(10:00|9:5\d)$/.test(await txt('#gift-left')), await txt('#gift-left'));
await shot('16-regalo');
await page.click('#gift-later'); await page.waitForTimeout(300);
check('«Más tarde»: el cofre se queda a la izquierda con su cuenta atrás', await page.locator('#gift-slot').isVisible() && /^\d:\d\d$/.test(await txt('#gift-timer')));
before = await S(page);
await page.click('#gift-slot', { force: true }); await page.waitForTimeout(200); await page.click('#gift-watch', { force: true });
check('para abrirlo hay que ver un vídeo', await page.evaluate(() => document.querySelector('#ad-overlay').classList.contains('open')));
await page.waitForSelector('#chest-overlay.open', { timeout: 8000 }); await page.click('#chest-btn');
await page.waitForFunction(() => document.querySelector('#chest-btn').textContent === 'RECOGER' && !document.querySelector('#chest-btn').disabled, null, { timeout: 10000 }); await page.click('#chest-btn'); await page.waitForTimeout(300);
s = await S(page);
check('el regalo da 50–60 pesetas, 30–40 tomates y 2 cartas', s.chestPesetas - before.chestPesetas >= 50 && s.chestPesetas - before.chestPesetas <= 60 && s.chestTomatoes - before.chestTomatoes >= 30 && s.chestTomatoes - before.chestTomatoes <= 40 && !(await page.locator('#gift-slot').isVisible()), `(+${s.chestPesetas - before.chestPesetas} pesetas, +${s.chestTomatoes - before.chestTomatoes} tomates)`);
check('solo se puede abrir una vez', await page.evaluate(() => AAP.backend.claimWelcome().then(() => false, e => /Ya has abierto/.test(e.message))));
await page.evaluate(async () => { AAP.state.welcomeClaimed = false; AAP.state.welcomeOfferedAt = AAP.backend.now() - 11 * 60000; (await import('./js/gift.js')).restoreGift(); });
check('a los 10 minutos caduca y desaparece', !(await page.locator('#gift-slot').isVisible()) && await page.evaluate(() => AAP.backend.claimWelcome().then(() => false, e => /caducado/.test(e.message))));
// sin anuncios aprobados: el regalo se abre directamente, sin vídeo
await page.evaluate(async () => { (await import('./js/ads.js')).adsTest.on = false; AAP.state.welcomeClaimed = false; AAP.state.welcomeOfferedAt = AAP.backend.now(); (await import('./js/gift.js')).restoreGift(); });
await page.click('#gift-slot', { force: true }); await page.waitForTimeout(300);
check('sin anuncios aprobados: botón «¡ABRIR REGALO!» sin vídeo', (await txt('#gift-watch')).includes('ABRIR REGALO'));
await page.click('#gift-watch', { force: true }); await page.waitForTimeout(300);
check('y se abre directamente', !(await page.evaluate(() => document.querySelector('#ad-overlay').classList.contains('open'))) && await page.evaluate(() => document.querySelector('#chest-overlay').classList.contains('open')));
await page.click('#chest-btn'); await page.waitForFunction(() => document.querySelector('#chest-btn').textContent === 'RECOGER' && !document.querySelector('#chest-btn').disabled, null, { timeout: 10000 }); await page.click('#chest-btn'); await page.waitForTimeout(300);

console.log('25. Versión de pruebas: siempre desde cero');
const p4 = await ctx.newPage(); await mockTime(p4);
await open(p4, URL_LOGIN.replace('?debug', '?debug&prueba')); await p4.waitForTimeout(300);
const fresh = await p4.evaluate(() => ({ clicks: AAP.state.stats.totalClicks, falls: AAP.state.stats.falls, gate: document.querySelector('#panel-account').classList.contains('open'), badge: !document.querySelector('#test-badge').classList.contains('hidden'), tom: AAP.state.tomatoes }));
check('la versión de pruebas empieza de cero, sin pedir cuenta y con la marca PRUEBAS', fresh.clicks === 0 && fresh.falls === 0 && !fresh.gate && fresh.badge && fresh.tom === 5, JSON.stringify(fresh));
await p4.close();
check('Sobre de la Moncloa: 25 pesetas', await page.evaluate(() => AAP.E.SOBRE.pesetas === 25));

console.log('26. Packs de pesetas (pago)');
await page.click('#tabs [data-panel="shop"]'); await page.waitForTimeout(400); await shot('17-packs');
const packs = await page.evaluate(() => [...document.querySelectorAll('.pack')].map(p => ({ id: [...p.classList].find(c => AAP.E.PACKS[c]), price: p.querySelector('.pk-buy').textContent, best: p.classList.contains('best'), ribbon: p.querySelector('.ribbon').textContent, coins: p.querySelectorAll('.floor .fc').length })));
check('tres packs: 1,99 €, 3,99 € y 9,95 €, con monedas por el suelo', packs.length === 3 && packs.map(p => p.price).join('|') === '1,99 €|3,99 €|9,95 €' && packs.every(p => p.coins >= 5), JSON.stringify(packs.map(p => p.price)));
check('el de 9,95 € es el de más valor', packs[2].best && /MÁS VALOR/.test(packs[2].ribbon) && packs.slice(0, 2).every(p => /OFERTA/.test(p.ribbon)));
check('cada pack da más pesetas por euro que el anterior', await page.evaluate(() => { const P = Object.values(AAP.E.PACKS), r = P.map(p => p.pesetas / parseFloat(p.price.replace(',', '.'))); return r[0] < r[1] && r[1] < r[2] && P.every(p => p.pesetas > p.base); }));
check('sin cantidades tachadas: «+X% EXTRA»', await page.locator('.pack s').count() === 0 && /EXTRA/.test(await txt('.pack.maletin .pk-was')));
await page.click('.chest-card.wood .probs-btn'); await page.waitForTimeout(2300);
check('las probabilidades se quedan abiertas aunque pase el tiempo', await page.locator('.chest-card.wood .probs.open').count() === 1 && await page.locator('.chest-card.wood .probs').isVisible());
await page.click('.chest-card.wood .probs-btn');
await page.click('.pack.maletin .pk-buy', { force: true }); await page.waitForTimeout(300);
check('sin cuenta no se puede comprar: avisa y no abre nada', /iniciar sesión|muy pronto/.test(await txt('#toast')) && !(await page.evaluate(() => document.querySelector('#pay-overlay').classList.contains('open'))));
await page.click('#panel-shop [data-close]');

console.log('27. Guía de bienvenida para jugadores nuevos');
{
  const c5 = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 }); const p5 = await c5.newPage(); const e5 = watchErrors(p5); await mockTime(p5);
  await open(p5, undefined, { tour: true }); await p5.evaluate(() => { AAP.giftTest.off = true; });
  await p5.waitForSelector('#tour', { timeout: 6000 }).catch(() => {});
  check('jugador nuevo: aparece la guía sola', await p5.locator('#tour').count() === 1);
  const n = await p5.locator('.tour-dots i').count(); check('la guía tiene 8 pasos', n === 8, `(${n})`);
  await p5.screenshot({ path: 'tests/out/27-guia-1.png' });
  const inside = sel => p5.evaluate(sel => { const h = document.querySelector('.tour-hole').getBoundingClientRect(), t = document.querySelector(sel).getBoundingClientRect(); return t.left >= h.left - 1 && t.right <= h.right + 1 && t.top >= h.top - 1 && t.bottom <= h.bottom + 1; }, sel);
  const bubbleOk = () => p5.evaluate(() => { const b = document.querySelector('.tour-bubble').getBoundingClientRect(), a = document.querySelector('#app').getBoundingClientRect(); return b.top >= a.top && b.bottom <= a.bottom && b.left >= a.left && b.right <= a.right; });
  let okAll = true, ok2, dbg;
  const still = () => p5.waitForFunction(() => { const r = document.querySelector('.tour-hole').getBoundingClientRect(), b = document.querySelector('.tour-bubble').getBoundingClientRect(), k = [r.left, r.top, r.width, r.height, b.top].map(Math.round).join(); const same = window.__holeK === k; window.__holeK = k; return same; }, null, { polling: 200, timeout: 8000 }).catch(() => {});
  for (let k = 1; k < n; k++) { await p5.click('.tour-next'); await p5.waitForTimeout(400); await still(); okAll = okAll && await bubbleOk();
    if (k === 1) { ok2 = await inside('#btn-click'); dbg = await p5.evaluate(() => ({ t: document.querySelector('.tour-title')?.textContent, h: JSON.stringify(document.querySelector('.tour-hole').getBoundingClientRect()), b: JSON.stringify(document.querySelector('#btn-click').getBoundingClientRect()), ov: [...document.querySelectorAll('.panel.open,.overlay.open')].map(x => x.id).join() })); await p5.screenshot({ path: 'tests/out/27-guia-2.png' }); }
    if (k === 5) await p5.screenshot({ path: 'tests/out/27-guia-6.png' }); }
  check('señala el botón ¡DALE!', ok2, ok2 ? '' : JSON.stringify(dbg));
  check('el bocadillo siempre cabe en la pantalla', okAll);
  check('el último paso es «¡A POR ÉL!» y señala el Ranking', (await p5.locator('.tour-next').textContent()) === '¡A POR ÉL!' && await inside('#tabs [data-panel="rank"]'));
  const blocked = await p5.evaluate(() => { const b = AAP.state.stats.totalClicks; document.querySelector('#tour').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return AAP.state.stats.totalClicks === b; });
  check('mientras está la guía no se juega sin querer', blocked);
  await p5.click('.tour-next'); await p5.waitForTimeout(300);
  check('al terminar desaparece y una mano invita a pulsar ¡DALE!', await p5.locator('#tour').count() === 0 && await p5.locator('.tap-hint').count() === 1);
  await tap(p5, 1); await p5.waitForTimeout(100);
  check('la mano se va al primer toque', await p5.locator('.tap-hint').count() === 0);
  await p5.reload(); await p5.waitForFunction(() => window.AAP?.scene?.ready); await p5.waitForTimeout(2500);
  check('no vuelve a salir al volver a entrar', await p5.locator('#tour').count() === 0);
  await p5.click('#btn-settings'); await p5.waitForTimeout(300); await p5.click('#btn-help'); await p5.waitForTimeout(400);
  check('se puede volver a ver desde Ajustes → Cómo se juega', await p5.locator('#tour').count() === 1 && !(await p5.locator('#panel-settings.open').count()));
  await p5.click('.tour-skip'); await p5.waitForTimeout(200);
  check('«Saltar» la cierra', await p5.locator('#tour').count() === 0);
  check('guía: sin errores en consola', e5.length === 0, e5.join(' | '));
  await c5.close();
  // un jugador que ya ha jugado (en otro dispositivo, por ejemplo) no la ve
  const c6 = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 }); const p6a = await c6.newPage(); await mockTime(p6a); await open(p6a);
  await tap(p6a, 30); await p6a.waitForTimeout(600); await p6a.close();
  const p6 = await c6.newPage(); await mockTime(p6);
  await open(p6, undefined, { tour: true }); await p6.waitForTimeout(2500);
  check('quien ya ha jugado no ve la guía', await p6.locator('#tour').count() === 0);
  await c6.close();
}

console.log('28. iPhone: sin zoom ni movimientos al pulsar rápido');
{
  check('la pantalla no deja hacer zoom (viewport)', /maximum-scale=1/.test(await page.getAttribute('meta[name=viewport]', 'content')));
  const r = await page.evaluate(async () => {
    const fire = (type, el, n = 1) => { const ts = Array.from({ length: n }, (_, i) => new Touch({ identifier: i + 1, target: el, clientX: 100 + i * 40, clientY: 300 })); const e = new TouchEvent(type, { bubbles: true, cancelable: true, touches: type === 'touchend' ? [] : ts, changedTouches: ts.slice(0, 1) }); el.dispatchEvent(e); return e.defaultPrevented; };
    const game = document.querySelector('#game'), mega = document.querySelector('#btn-click'), tab = document.querySelector('#tabs [data-panel="rank"]');
    const out = { moveGame: fire('touchmove', game), pinch: fire('touchmove', game, 2) };
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g); out.gesture = g.defaultPrevented;
    fire('touchend', mega); out.dblMega = fire('touchend', mega);
    await new Promise(r => setTimeout(r, 450)); fire('touchend', tab); out.dblTab = fire('touchend', tab);
    document.querySelector('#panel-cards').classList.add('open'); const body = document.querySelector('#panel-cards .sheet-body');
    out.scrollList = fire('touchmove', body); out.pinchList = fire('touchmove', body, 2);
    document.querySelector('#panel-cards').classList.remove('open');
    out.ta = getComputedStyle(mega).touchAction + ' / ' + getComputedStyle(body).touchAction;
    return out;
  });
  check('arrastrar en el juego no mueve la página', r.moveGame && r.pinch && r.gesture, JSON.stringify(r));
  check('doble toque rápido en ¡DALE! no hace zoom', r.dblMega);
  check('los botones normales siguen funcionando con toques rápidos', !r.dblTab);
  check('las listas (cartas, tienda...) se pueden desplazar con un dedo, pero no hacer zoom', !r.scrollList && r.pinchList);
  check('¡DALE! sin gestos del navegador; listas solo en vertical', /^none \/ pan-y$/.test(r.ta), r.ta);
  const n0 = await page.evaluate(() => { window.__taps = 0; document.querySelector('#btn-click').addEventListener('pointerdown', () => window.__taps++); return 0; });
  const box = await page.locator('#btn-click').boundingBox();
  for (let k = 0; k < 25; k++) await page.touchscreen.tap(box.x + box.width / 2 + (k % 5) * 6, box.y + box.height / 2);
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ taps: window.__taps, scale: visualViewport.scale, sx: scrollX, sy: scrollY }));
  check('25 toques rapidísimos: cuentan todos y la pantalla no se mueve ni se amplía', after.taps === 25 && after.scale === 1 && after.sx === 0 && after.sy === 0, JSON.stringify(after));
}

console.log('29. Niveles de jugador y ruleta');
{
  const lv = await page.evaluate(async () => { const L = await import('./js/levels.js'); return { n: L.LEVEL_NAMES.length, first: L.LEVEL_NAMES[0], last: L.LEVEL_NAMES[49], l16: L.LEVEL_NAMES[15],
    mono: L.XP_AT.every((v, i) => i < 2 || v - L.XP_AT[i - 1] > L.XP_AT[i - 1] - L.XP_AT[i - 2]), formula: L.XP_AT.every((v, i) => i < 10 || v - L.XP_AT[i - 1] === Math.round(5750 * Math.pow(i / 9, 1.7) / 10) * 10) && L.XP_AT.slice(0, 10).join() === '0,600,1900,3600,5850,8700,12200,16450,21450,27200',
    w: L.WHEEL_TOTAL, xp: L.xpOf({ tomatoesThrown: 3, hits: 2, falls: 1 }), lv: [0, 599, 600, 1899, 1900, 1917089, 1917090, 1e9].map(L.levelOfXp), top: L.levelOfXp(610220) }; });
  check('50 niveles: de Perroflauta a Caudillo Supremo', lv.n === 50 && lv.first === 'Perroflauta' && lv.last === 'Caudillo Supremo' && lv.l16 === 'Sanchista');
  check('experiencia: 10 por tomate, 5 por impacto, 20 por caída; cada nivel cuesta más (progresión pausada)', lv.xp === 30 + 10 + 20 && lv.mono && lv.formula);
  check('límites de nivel exactos y tope en 50 (llegar al 50 cuesta unos 1,9 millones de XP)', lv.lv.join() === '1,1,2,2,3,49,50,50', lv.lv.join());
  check('un jugador con 610.000 XP queda en el nivel 32', lv.top === 32, String(lv.top));
  check('la ruleta suma 100 (probabilidades en %)', lv.w === 100);
  const c7 = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 }); const p7 = await c7.newPage(); const e7 = watchErrors(p7); await mockTime(p7);
  await open(p7, undefined, { levels: true });
  await p7.evaluate(() => { AAP.giftTest.off = true; AAP.levelTest.fast = true; AAP.state.tutorialSeen = true; AAP.state.stats.chestTomatoes += 75; return import('./js/state.js').then(m => m.changed(false)); }); await noCombo(p7);
  const chip0 = await p7.evaluate(() => [document.querySelector('#lvl-num').textContent, document.querySelector('#lvl-name').textContent, document.querySelector('#lvl-xp').textContent].join('|'));
  check('jugador nuevo: barra de nivel 1 «Perroflauta» con 0/600 XP', chip0 === '1|Perroflauta|0 / 600 XP', chip0);
  await p7.evaluate(() => import('./js/play.js').then(m => { m.throwTomatoes(1); })); await stopAt(p7, 0, 8); await idle(p7);
  await p7.waitForSelector('.xp-float', { timeout: 3000 }).catch(() => {});
  const g1 = await p7.evaluate(() => [document.querySelector('.xp-float')?.textContent, document.querySelector('#lvl-xp').textContent, document.querySelector('#lvl-chip').classList.contains('gain')]);
  check('al acertar: «+35 XP» sale volando y la barra sube (35/600)', g1[0] === '+35 XP' && g1[1] === '35 / 600 XP' && g1[2], JSON.stringify(g1));
  check('sin subir de nivel no hay ruleta', await p7.locator('#lvlup-overlay.open').count() === 0);
  await p7.evaluate(() => import('./js/play.js').then(m => { m.throwTomatoes(60); })); await stopAt(p7, 0, 8); await idle(p7);
  await p7.waitForSelector('#lvlup-overlay.open', { timeout: 8000 }).catch(() => {});
  await p7.waitForFunction(() => document.querySelector('#lvlup-overlay').classList.contains('ready'), null, { timeout: 5000 }).catch(() => {});
  const up = await p7.evaluate(() => ({ num: document.querySelector('#lvlup-num').textContent, name: document.querySelector('#lvlup-name').textContent, banner: document.querySelector('#lvlup-banner').textContent, cnt: document.querySelector('#lvlup-cnt').textContent, conf: !!document.querySelector('#lvlup-overlay .fx-canvas') }));
  check('subida de 2 niveles de golpe: celebración del nivel 3 «Anticapitalista» y 2 tiradas', up.num === '3' && up.name === 'Anticapitalista' && up.banner === '¡+2 NIVELES!' && up.cnt === '×2' && up.conf, JSON.stringify(up));
  await p7.screenshot({ path: 'tests/out/29-nivel.png' });
  // si se cierra con la ✕, la tirada no se pierde: tocar la barra la abre y tras el siguiente lanzamiento se vuelve a ofrecer
  await p7.click('#lvlup-spin', { force: true }); await p7.waitForSelector('#wheel-overlay.open'); await p7.click('#wheel-close', { force: true }); await p7.waitForTimeout(300);
  check('cerrar la ruleta con la ✕ no gasta la tirada', await p7.evaluate(() => AAP.state.wheelLevel) === 1 && await p7.locator('#lvl-dot:not(.hidden)').count() === 1);
  await p7.click('#lvl-chip'); await p7.waitForSelector('#wheel-overlay.open', { timeout: 5000 }).catch(() => {});
  check('con una tirada pendiente, tocar la barra de nivel abre la ruleta', await p7.locator('#wheel-overlay.open').count() === 1 && (await p7.locator('#wheel-title').textContent()) === 'RULETA · NIVEL 2');
  await p7.click('#wheel-close', { force: true }); await p7.waitForTimeout(300);
  await p7.evaluate(() => import('./js/levelup.js').then(m => m.levelTestReset?.()));
  await p7.evaluate(() => import('./js/play.js').then(m => { m.throwTomatoes(1); })); await stopAt(p7, 0, 8); await idle(p7);
  await p7.waitForSelector('#wheel-overlay.open', { timeout: 6000 }).catch(() => {});
  check('y tras el siguiente lanzamiento se vuelve a ofrecer sola', await p7.locator('#wheel-overlay.open').count() === 1);
  // ruleta: primer premio pesetas (casilla 0), segundo una carta (casilla 2)
  await p7.evaluate(() => { AAP.levelTest.rng = () => 0.01; });
  let b7 = await S(p7);
  if (!(await p7.locator('#wheel-overlay.open').count())) { await p7.click('#lvl-chip'); await p7.waitForSelector('#wheel-overlay.open'); }
  const wheel = await p7.evaluate(() => ({ segs: document.querySelectorAll('#wheel-svg .seg').length, title: document.querySelector('#wheel-title').textContent, amt: document.querySelector('#wheel-svg .seg[data-i="0"] .amt').textContent, lights: document.querySelectorAll('#wheel-lights i').length }));
  check('ruleta de 8 casillas con luces, para el nivel 2: pesetas +14', wheel.segs === 8 && wheel.title === 'RULETA · NIVEL 2' && wheel.amt === '+14' && wheel.lights === 20, JSON.stringify(wheel));
  const ticks = await p7.evaluate(() => { window.__ticks = 0; const p = document.querySelector('#wheel-pointer'); new MutationObserver(() => { if (p.classList.contains('kick')) window.__ticks++; }).observe(p, { attributes: true }); return 0; });
  await p7.click('#wheel-btn', { force: true }); await p7.waitForSelector('#wheel-prize:not(.hidden)', { timeout: 10000 });
  let s7 = await S(p7);
  const pz = await p7.evaluate(() => ({ txt: document.querySelector('#wheel-prize').textContent, win: document.querySelector('#wheel-svg .seg.win')?.dataset.i, ang: ((-parseFloat(document.querySelector('#wheel').style.transform.replace(/[^-\d.]/g, '')) % 360) + 360) % 360, btn: document.querySelector('#wheel-btn').textContent, ticks: window.__ticks }));
  check('la flecha se para en la casilla ganadora', pz.win === '0' && pz.ang >= 0 && pz.ang < 45, JSON.stringify(pz));
  check('premio: +14 pesetas de verdad y tic-tac al pasar las casillas', /\+14 pesetas/.test(pz.txt) && s7.pesetas === b7.pesetas + 14 && pz.ticks >= 1, `(${b7.pesetas} → ${s7.pesetas}, ticks ${pz.ticks})`);
  check('queda otra tirada', pz.btn === '¡OTRA TIRADA! (1)' && await p7.evaluate(() => AAP.state.wheelLevel) === 2);
  await p7.evaluate(() => { AAP.levelTest.rng = () => 0.45; });   // casilla 2: carta
  await p7.click('#wheel-btn', { force: true }); await p7.waitForFunction(() => document.querySelector('#wheel-title').textContent === 'RULETA · NIVEL 3');
  await p7.click('#wheel-btn', { force: true }); await p7.waitForSelector('#wheel-prize:not(.hidden)', { timeout: 10000 });
  check('premio carta: botón ¡ABRIR! y se abre el cofre con la carta', /1 carta/.test(await p7.locator('#wheel-prize').textContent()) && (await p7.locator('#wheel-btn').textContent()) === '¡ABRIR!');
  await p7.click('#wheel-btn', { force: true }); await p7.waitForSelector('#chest-overlay.open'); await p7.click('#chest-btn');
  await p7.waitForFunction(() => document.querySelector('#chest-btn').textContent === 'RECOGER' && !document.querySelector('#chest-btn').disabled, null, { timeout: 10000 }); await p7.click('#chest-btn'); await p7.waitForTimeout(300);
  s7 = await S(p7);
  check('después de las dos tiradas no quedan pendientes y se vuelve a jugar', await p7.evaluate(() => AAP.state.wheelLevel) === 3 && await p7.locator('.overlay.open').count() === 0 && await p7.locator('#lvl-dot.hidden').count() === 1 && Object.values(s7.cards).some(c => c.frags || c.level));
  check('no se puede girar sin tirada pendiente', await p7.evaluate(() => AAP.backend.spinWheel().then(() => false, e => /No tienes tiradas/.test(e.message))));
  // ×5 durante 2 minutos (casilla 3) y bote (casilla 7)
  const fx = await p7.evaluate(async () => { const L = await import('./js/levels.js'); AAP.state.stats.tomatoesThrown += 400; (await import('./js/state.js')).changed(false);
    const a = await AAP.backend.spinWheel(() => 0.6); const t = AAP.state.falconUntil - Date.now(); const b = await AAP.backend.spinWheel(() => 0.99);
    return { a: L.WHEEL[a.seg].id, falcon: a.reward.falcon, mins: Math.round(t / 60000), b: L.WHEEL[b.seg].id, bp: b.reward.pesetas, lvl: b.reward.level }; });
  check('premio ×5 clics durante 2 minutos (el Falcón)', fx.a === 'x5' && fx.falcon && fx.mins === 2, JSON.stringify(fx));
  check('el bote da 100 + 20 por nivel', fx.b === 'jackpot' && fx.bp === 100 + 20 * fx.lvl, JSON.stringify(fx));
  await p7.evaluate(() => { AAP.state.wheelLevel = AAP.E && 99; }); await p7.evaluate(() => import('./js/state.js').then(m => { AAP.state.wheelLevel = 50; m.changed(false); }));
  await p7.click('#lvl-chip'); await p7.waitForTimeout(400);
  const list = await p7.evaluate(() => ({ rows: document.querySelectorAll('#levels-body .lv').length, cur: document.querySelector('#levels-body .lv.cur .nm')?.textContent, last: document.querySelector('#levels-body .lv:last-child .nm').textContent, head: document.querySelector('.lv-head h3').textContent }));
  check('lista de niveles: los 50, el actual marcado y Caudillo Supremo al final', list.rows === 50 && list.cur === list.head && list.last.startsWith('Caudillo Supremo') && list.last.endsWith('RULETA LEGENDARIA'), JSON.stringify(list));
  await p7.screenshot({ path: 'tests/out/29-niveles.png' }); await p7.click('#panel-levels [data-close]');
  await p7.click('#tabs [data-panel="profile"]'); await p7.waitForTimeout(300);
  check('el perfil enseña el nivel', (await p7.locator('#prof-lvl').textContent()).endsWith(list.head));
  await p7.click('#panel-profile [data-close]'); await p7.waitForTimeout(200);
  check('con el servidor sin actualizar se ven los niveles pero la ruleta espera', await p7.evaluate(async () => { const m = await import('./js/levelup.js'); AAP.state.wheelLevel = 1; const a = m.pending() > 0; AAP.state.noWheel = true; const b = m.pending() === 0; AAP.state.noWheel = false; AAP.state.wheelLevel = 50; return a && b; }));
  // ruleta legendaria en el nivel 10, ruleta de la tienda con pesetas y tirada legendaria comprada
  const lg = await p7.evaluate(async () => { const L = await import('./js/levels.js'), st = AAP.state.stats;
    const legend10 = [1, 9, 10, 11, 20, 50].map(L.isLegendLevel).join(), ids = L.WHEELS.legend.segs.map(s => s.id).join();
    st.tomatoesThrown = 2200; st.hits = 1200; st.falls = 0; AAP.state.wheelLevel = 9; (await import('./js/state.js')).changed(false);
    const a = await AAP.backend.spinWheel(() => 0.01);
    const p0 = AAP.state.pesetas, price = L.shopSpinPrice(L.levelOf(st)); const b = await AAP.backend.buySpin(() => 0.5); const paid = p0 - AAP.state.pesetas;
    const leg0 = AAP.backend.spinLegend(() => 0.1).then(() => 'dejó', e => e.message);
    const noLeg = await leg0; AAP.state.legendSpins = 2; const c = await AAP.backend.spinLegend(() => 0.99);
    const cap = L.shopSpinPrice(1) === 43 && L.shopSpinPrice(28) === 124 && L.shopSpinPrice(50) === 190;
    return { cap, legend10, ids, a: [a.wheel, a.reward.id, a.reward.pesetas], b: [b.wheel, b.reward.id], paid, price, bExtra: b.reward.pesetas, noLeg, c: [c.wheel, c.reward.id, c.reward.pesetas], left: AAP.state.legendSpins }; });
  check('cada 10 niveles toca la ruleta legendaria', lg.legend10 === 'false,false,true,false,true,true' && lg.a[0] === 'legend' && lg.a[1] === 'l_pes' && lg.a[2] === 300 + 10 * 10, JSON.stringify(lg.a));
  check('ruleta de la tienda: cobra 40 + 3 por nivel y da su premio (sin tope)', lg.b[0] === 'normal' && lg.price === 40 + 3 * 10 && lg.cap && lg.paid === lg.price - lg.bExtra, JSON.stringify(lg));
  check('tirada legendaria comprada: solo si la tienes, y se gasta una', /No tienes tiradas legendarias/.test(lg.noLeg) && lg.c[0] === 'legend' && lg.c[1] === 'l_bote' && lg.c[2] === 2500 + 50 * 10 && lg.left === 1, JSON.stringify(lg));
  // todos los premios de las dos ruletas se entregan (cada casilla, en local)
  const all = await p7.evaluate(async () => { const L = await import('./js/levels.js'), st = AAP.state.stats, out = [];
    for (const kind of ['normal', 'legend']) { const segs = L.WHEELS[kind].segs, tot = segs.reduce((a, s) => a + s.weight, 0); let acc = 0;
      for (const s of segs) { const r = (acc + s.weight / 2) / tot; acc += s.weight; AAP.state.legendSpins = 1;
        const b = { p: AAP.state.pesetas, t: st.chestTomatoes, f: AAP.state.falconUntil, c: JSON.stringify(AAP.state.cards) };
        const x = kind === 'legend' ? await AAP.backend.spinLegend(() => r) : (st.chestPesetas += 500, (await import('./js/state.js')).changed(false), b.p = AAP.state.pesetas, await AAP.backend.buySpin(() => r));
        const w = x.reward, ok = x.reward.id === s.id && AAP.state.pesetas === b.p + w.pesetas - (x.cost || 0) && st.chestTomatoes === b.t + w.tomatoes
          && (s.kind !== 'falcon' || AAP.state.falconUntil >= Math.max(Date.now(), b.f) + s.minutes * 60000 - 2000)
          && (s.kind !== 'chest' || (w.cards.length === (s.chest === 'premium' ? 4 : s.chest === 'diamond' ? 3 * s.times : 1) && JSON.stringify(AAP.state.cards) !== b.c));
        out.push(kind + ':' + s.id + (ok ? '' : ':MAL')); } }
    return out; });
  check('todos los premios de las dos ruletas llegan al jugador (16 casillas)', all.length === 16 && all.every(x => !x.endsWith(':MAL')), all.join(' '));
  await p7.evaluate(() => { AAP.state.wheelLevel = 50; AAP.state.legendSpins = 0; });
  // en la tienda: ruleta de la suerte con pesetas (pantalla real)
  await p7.evaluate(async () => { AAP.state.stats.chestPesetas += 300; (await import('./js/state.js')).changed(false); });
  await p7.click('#tabs [data-panel="shop"]'); await p7.waitForTimeout(300);
  const sh = await p7.evaluate(() => ({ cards: document.querySelectorAll('.wheels .wheel-card').length, price: document.querySelector('[data-wheel="shop"]')?.textContent.trim(), leg: document.querySelector('.wheel-card.legend [data-ad="ruleta"]')?.textContent.trim(), legOff: document.querySelector('.wheel-card.legend [data-ad="ruleta"]')?.disabled, dots: document.querySelectorAll('.wheel-card.legend .wc-ads i').length, pay: !!document.querySelector('.wheel-card.legend [data-pack]'), daily: !!document.querySelector('#shop-body [data-daily]') }));
  const lvNow = await p7.evaluate(() => import('./js/levels.js').then(L => L.levelOf(AAP.state.stats)));
  check('tienda: ruleta de la suerte (con pesetas) y legendaria con 3 vídeos (sin pagar, aún «PRONTO»); el cofre diario sigue en la tienda', sh.cards === 2 && sh.price === String(40 + 3 * lvNow) && sh.leg === 'PRONTO' && sh.legOff && sh.dots === 3 && !sh.pay && sh.daily, JSON.stringify(sh));
  const vids = await p7.evaluate(async () => { const m = await import('./js/ads.js'); m.adsTest.on = true; m.DEMO_AD.seconds = 0; AAP.state.legendAds = 0; AAP.state.legendSpins = 0; const r = []; for (let i = 0; i < 3; i++) { await AAP.backend.watchAd('ruleta'); r.push(AAP.state.legendAds + '/' + AAP.state.legendSpins); } m.adsTest.on = false; AAP.state.legendSpins = 0; return r.join(' '); });
  check('con los vídeos activados: 3 vídeos = 1 tirada legendaria', vids === '1/0 2/0 0/1', vids);
  let bp = (await S(p7)).pesetas;
  await p7.evaluate(() => { AAP.levelTest.rng = () => 0.01; }); await p7.click('[data-wheel="shop"]', { force: true }); await p7.waitForSelector('#wheel-overlay.open');
  check('se abre la ruleta de la suerte con su precio en el botón', (await p7.locator('#wheel-title').textContent()) === 'RULETA DE LA SUERTE' && (await p7.locator('#wheel-btn').textContent()).includes(String(40 + 3 * lvNow)));
  await p7.click('#wheel-btn', { force: true }); await p7.waitForSelector('#wheel-prize:not(.hidden)', { timeout: 10000 });
  let sp = await S(p7);
  check('al girar cobra el precio y da el premio', sp.pesetas === bp - (40 + 3 * lvNow) + (10 + 2 * lvNow) && /OTRA/.test(await p7.locator('#wheel-btn').textContent()), `(${bp} → ${sp.pesetas})`);
  await p7.click('#wheel-close', { force: true }); await p7.waitForTimeout(300);
  check('se puede cerrar cuando quieras', await p7.locator('#wheel-overlay.open').count() === 0);
  await p7.evaluate(() => { AAP.state.legendSpins = 1; AAP.levelTest.rng = () => 0.5; }); await p7.click('#tabs [data-panel="shop"]'); await p7.waitForTimeout(300);
  await p7.click('[data-wheel="legend"]', { force: true }); await p7.waitForSelector('#wheel-overlay.open.legend');
  check('con una tirada legendaria comprada, la tienda abre la ruleta legendaria (corona y 32 luces)', (await p7.locator('#wheel-title').textContent()) === 'RULETA LEGENDARIA' && await p7.locator('.wheel-crown').isVisible() && await p7.locator('#wheel-lights i').count() === 32);
  await p7.click('#wheel-btn', { force: true }); await p7.waitForSelector('#wheel-prize:not(.hidden)', { timeout: 10000 });
  check('premio legendario: 6 cartas → se abre el cofre', /6 cartas/.test(await p7.locator('#wheel-prize').textContent()) && (await p7.locator('#wheel-btn').textContent()) === '¡ABRIR!' && await p7.evaluate(() => AAP.state.legendSpins) === 0);
  await p7.click('#wheel-btn', { force: true }); await p7.waitForSelector('#chest-overlay.open'); await p7.click('#chest-btn');
  await p7.waitForFunction(() => document.querySelector('#chest-btn').textContent === 'RECOGER' && !document.querySelector('#chest-btn').disabled, null, { timeout: 10000 });
  check('el cofre enseña las 6 cartas', await p7.locator('#chest-rewards .reward').count() >= 6); await p7.click('#chest-btn'); await p7.waitForTimeout(300);
  await p7.evaluate(() => { AAP.levelTest.rng = null; });
  // ruleta al final de la barra de nivel (la legendaria si el siguiente nivel es múltiplo de 10)
  const pzb = await p7.evaluate(async () => { const st = AAP.state.stats, m = await import('./js/levelup.js'), r = [];
    for (const [t, h] of [[0, 0], [2200, 0]]) { st.tomatoesThrown = t; st.hits = h; st.falls = 0; AAP.state.wheelLevel = 50; m.syncChip(); const L = (await import('./js/levels.js')).levelOf(st), e = document.querySelector('#lvl-prize');
      r.push({ L, vis: e.offsetWidth > 0, href: e.querySelector('use').getAttribute('href'), leg: e.classList.contains('legend') }); }
    return r; });
  check('al final de la barra de nivel se ve la ruleta del premio (legendaria antes del nivel 10)', pzb[0].vis && pzb[0].href === '#ic-wheel' && pzb[1].L === 9 && pzb[1].href === '#ic-wheel-legend' && pzb[1].leg, JSON.stringify(pzb));
  await p7.evaluate(() => { AAP.state.stats.tomatoesThrown = 30000; return import('./js/levelup.js').then(m => m.syncChip()); });
  // ganancias (Hacienda Inversa, Puerta Giratoria...): solo el número, con monedas volando al marcador
  await p7.evaluate(() => { AAP.ui.pesetaGain(7); AAP.ui.tomatoGain(5); }); await p7.waitForTimeout(900);
  const gn = await p7.evaluate(() => ({ tags: [...document.querySelectorAll('.gain-tag')].map(t => t.textContent), toast: document.querySelector('#toast').textContent }));
  check('ganancias: «+7» de pesetas y «+5» de tomates junto al marcador, sin textos', gn.tags.includes('+7') && gn.tags.includes('+5') && !/Hacienda|Puerta/.test(gn.toast), JSON.stringify(gn));
  check('niveles: sin errores en consola', e7.length === 0, e7.join(' | '));
  await c7.close();
}

console.log('30. Abrir varios cofres a la vez');
{
  await page.evaluate(async () => { AAP.state.stats.chestPesetas += 1000; (await import('./js/state.js')).changed(false); });
  await page.click('#tabs [data-panel="shop"]'); await page.waitForTimeout(300);
  const mx = await page.evaluate(() => [...document.querySelectorAll('.chest-card.wood .mx')].map(b => b.dataset.n + ':' + b.textContent.trim()).join(' '));
  check('con pesetas de sobra salen los botones ×3 y ×10 junto al precio', /^3:×3\s*24 10:×10\s*80$/.test(mx), mx);
  const b0 = await S(page);
  await page.click('.chest-card.wood .mx[data-n="3"]', { force: true }); await page.waitForSelector('#chest-overlay.open', { timeout: 10000 });
  check('se abren 3 cofres juntos', (await page.locator('#chest-title').textContent()) === '3 × Cofre de madera' && (await page.locator('.chest-x').textContent()) === '×3');
  await page.click('#chest-btn'); await page.waitForFunction(() => document.querySelector('#chest-btn').textContent === 'RECOGER' && !document.querySelector('#chest-btn').disabled, null, { timeout: 15000 });
  const b1 = await S(page);
  check('cobra los 3 cofres (24 pesetas) y los cuenta', b1.chestsOpened === b0.chestsOpened + 3 && b1.pesetasSpent === b0.pesetasSpent + 24, JSON.stringify({ o: b1.chestsOpened - b0.chestsOpened, sp: b1.pesetasSpent - b0.pesetasSpent }));
  await page.click('#chest-btn'); await page.waitForTimeout(300);
  await page.evaluate(async () => { AAP.state.stats.pesetasSpent += AAP.state.pesetas - 30; (await import('./js/state.js')).changed(false); });
  await page.click('#tabs [data-panel="shop"]').catch(() => {}); await page.evaluate(() => AAP.ui.renderShop()); await page.waitForTimeout(200);
  check('si no llega para 3, no sale el botón', await page.locator('.chest-card.diamond .mx').count() === 0 && await page.locator('.chest-card.wood .mx[data-n="10"]').count() === 0);
  await page.evaluate(() => AAP.ui.closeAll());
}

console.log('31. Racha de lanzamientos y peineta');
{
  const st = await page.evaluate(async () => { const S = await import('./js/streak.js'); return { b: [1, 2, 3, 4, 5, 8, 10, 12, 20, 40, 100].map(s => S.bonus(s, 1)).join(), big: [[2, 100], [10, 100], [10, 1], [35, 300], [10, 250]].map(([s, p]) => S.bonus(s, p)).join(), t: [1, 2, 5, 10, 20, 35, 50].map(s => S.tierOf(s)?.name || '-').join('|'), m50: S.bonus(50, 10),
    // en una racha larga de lanzamientos ×1 nunca se pasa de lo que admite el servidor (15 por caída)
    max: Math.max(...Array.from({ length: 300 }, (_, i) => Array.from({ length: i + 1 }, (_, k) => S.bonus(k + 1, 3)).reduce((a, b) => a + b, 0) / (i + 1))) }; });
  check('pesetas de racha (más moderadas): un % pequeño de lo que ganas y premios a los 5, 10, 15...', st.b === '0,0,0,0,3,0,5,0,8,12,13', st.b);
  check('la racha es un % de lo que ganas: ×100 da 100 veces más (5 % → 15 % → 50 %)', st.big === '5,20,5,117,43', st.big);
  check('la racha cambia de nombre hasta la de ×50: «¡AL AGUA, PEDRO!» (con el premio más gordo)', st.t === '-|RACHA|¡EN LLAMAS!|¡IMPARABLE!|¡LEGENDARIA!|¡DIOS DEL TOMATE!|¡AL AGUA, PEDRO!' && st.m50 === 5 + 30, st.t + ' · ' + st.m50);
  check('nunca da más de lo que admite el servidor (15 por caída)', st.max < 15, st.max.toFixed(2));
  const c8 = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 }); const p8 = await c8.newPage(); const e8 = watchErrors(p8); await mockTime(p8);
  await open(p8, undefined, { streak: true });
  await p8.evaluate(() => { AAP.giftTest.off = true; AAP.state.tutorialSeen = true; AAP.state.stats.chestTomatoes += 30; return import('./js/state.js').then(m => m.changed(false)); }); await noCombo(p8);
  const hit = async () => { await p8.evaluate(() => import('./js/play.js').then(m => { m.throwTomatoes(1); })); await stopAt(p8, 0, 6); await idle(p8); };
  const b8 = await S(p8), p0 = b8.pesetas;
  for (let i = 0; i < 5; i++) await hit();
  let s8 = await S(p8);
  const ui8 = await p8.evaluate(() => ({ x: document.querySelector('#st-x').textContent, name: document.querySelector('#st-name').textContent, cls: document.querySelector('#streak').className, aura: document.querySelector('#app').dataset.streak, ban: !!document.querySelector('.streak-ban') }));
  check('5 aciertos seguidos: racha ×5 «¡EN LLAMAS!», aura roja y cartel', ui8.x === '×5' && ui8.name === '¡EN LLAMAS!' && /t2/.test(ui8.cls) && ui8.aura === '2' && ui8.ban, JSON.stringify(ui8));
  check('y da sus pesetas extra (3 del premio de la 5.ª) además de las de cada caída', s8.streakPesetas === 3 && s8.pesetas === p0 + 3 + (s8.pesetasEarned - b8.pesetasEarned), JSON.stringify({ sp: s8.streakPesetas, p0, p: s8.pesetas }));
  // al fallar: la peineta (siempre) y la racha se pierde
  await p8.evaluate(() => import('./js/play.js').then(m => { m.throwTomatoes(1); })); await stopAt(p8, 120, 220, 'R');
  await p8.waitForFunction(() => AAP.scene.clipName === 'peineta', null, { timeout: 6000 }).catch(() => {});
  const clip = await p8.evaluate(() => AAP.scene.clipName); await idle(p8);
  const lost = await p8.evaluate(() => ({ s: AAP.state.streak, name: document.querySelector('#st-name').textContent, aura: document.querySelector('#app').dataset.streak }));
  check('al fallar, Pedro hace la peineta', clip === 'peineta', clip);
  check('y la racha se pierde («RACHA PERDIDA»)', lost.s === 0 && lost.name === 'RACHA PERDIDA' && lost.aura === '0', JSON.stringify(lost));
  await p8.evaluate(async () => { AAP.state.cards.pegasus = { level: 20, frags: 0 }; AAP.state.streak = 7; (await import('./js/state.js')).changed(false); });
  await p8.evaluate(() => { AAP.testRng.fn = () => 0.01; });   // 1 %: por debajo de la probabilidad de Pegasus (y no lo perdona la Amnistía, que no tiene)
  await p8.evaluate(() => import('./js/play.js').then(m => { m.throwTomatoes(1); })); await stopAt(p8, 120, 220, 'R');
  await p8.waitForSelector('.streak-ban.pegasus', { timeout: 6000 }).catch(() => {}); const peg = await p8.evaluate(() => ({ s: AAP.state.streak, ban: document.querySelector('.streak-ban.pegasus')?.textContent }));
  await idle(p8); await p8.evaluate(() => { AAP.testRng.fn = () => 0.99; });
  check('Chantaje Pegasus: al fallar, a veces salva la racha (con aviso)', peg.s === 7 && /CHANTAJE PEGASUS/.test(peg.ban || ''), JSON.stringify(peg));
  await p8.evaluate(() => import('./js/play.js').then(m => { m.throwTomatoes(1); })); await stopAt(p8, 120, 220, 'R'); await idle(p8);
  check('si no sale la probabilidad, la racha se pierde igual', await p8.evaluate(() => AAP.state.streak) === 0);
  await p8.evaluate(() => { AAP.testRng.fn = null; });
  check('racha: sin errores en consola', e8.length === 0, e8.join(' | '));
  await c8.close();
}

console.log('32. App instalable (sin tiendas)');
{
  const mf = await page.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); const m = await (await fetch(l.href)).json();
    const ok = async u => (await fetch(u)).ok; return { name: m.name, display: m.display, start: m.start_url, icons: m.icons.map(i => i.sizes + ':' + i.purpose).join(), files: (await Promise.all(m.icons.map(i => ok(new URL(i.src, l.href))))).every(Boolean),
      apple: await ok(document.querySelector('link[rel=apple-touch-icon]').href), sw: await ok('./sw.js') }; });
  check('la web se puede instalar: nombre, pantalla completa, iconos 192/256/512/maskable e icono de iPhone', mf.name === 'AL AGUA PEDRO' && mf.display === 'standalone' && mf.icons === '192x192:any,256x256:any,512x512:any,512x512:maskable' && mf.files && mf.apple && mf.sw, JSON.stringify(mf));
  // service worker: tras abrir el juego una vez, vuelve a abrir aunque no haya conexión
  const c9 = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 }); const p9 = await c9.newPage(); const e9 = watchErrors(p9); await mockTime(p9);
  await open(p9, undefined, { install: true });
  const look = await p9.evaluate(async () => ({ scheme: document.querySelector('meta[name=color-scheme]')?.content, css: getComputedStyle(document.documentElement).colorScheme,
    ico: (await fetch('./favicon.ico')).ok, og: (await fetch(document.querySelector('meta[property="og:image"]').content.replace('https://alaguapedro.es/', './'))).ok }));
  check('el modo oscuro del navegador (Samsung, Chrome) no cambia los colores; favicon e imagen de compartir publicados', look.scheme === 'dark' && /dark/.test(look.css) && look.ico && look.og, JSON.stringify(look));
  {
    const pf = await c9.newPage(); await pf.addInitScript(() => { window.__AAP_NOTOUR = 1; window.__AAP_NOSW = 1; });
    await pf.goto('http://localhost:8080/?debug&prueba&fd'); await pf.waitForFunction(() => window.AAP?.scene?.ready, null, { timeout: 20000 });
    const fd = await pf.evaluate(() => { const st = getComputedStyle(document.querySelector('#lvl-name')); return { on: document.documentElement.classList.contains('fd'), rules: document.querySelector('#darkfix')?.sheet.cssRules.length, w: st.webkitTextStrokeWidth, sh: st.textShadow.split('px').length > 8 }; });
    check('Samsung Internet en modo oscuro: los contornos de las letras pasan a sombras que el navegador no aclara', fd.on && fd.rules > 50 && fd.w === '0px' && fd.sh, JSON.stringify(fd));
    await pf.close();
  }
  {
    // versiones: todos los módulos se piden con ?v=N (nada de código viejo guardado) y, si hay una versión nueva publicada, el juego se actualiza solo
    const cu = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 }); const pu = await cu.newPage(); await mockTime(pu);
    await open(pu);
    const mods = await pu.evaluate(() => { const v = new URL(document.querySelector('script[src*="js/main.js"]').src).searchParams.get('v');
      const js = performance.getEntriesByType('resource').map(e => new URL(e.name)).filter(u => u.origin === location.origin && u.pathname.endsWith('.js'));
      return { v, n: js.length, stale: js.filter(u => u.searchParams.get('v') !== v).map(u => u.pathname) }; });
    check('todos los módulos del juego se cargan con su versión (?v=)', +mods.v > 0 && mods.n > 15 && mods.stale.length === 0, JSON.stringify(mods));
    await pu.route(/\?nv=/, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<small class="ver">versión 9999</small>' }));
    const nav = pu.waitForNavigation({ timeout: 15000 }).then(() => true, () => false);
    await pu.evaluate(() => import('./js/update.js').then(m => m.checkVersion()));
    const reloaded = await nav; await pu.waitForFunction(() => window.AAP?.scene?.ready, null, { timeout: 20000 });
    check('si hay una versión nueva publicada, el juego se actualiza solo (y no entra en bucle)', reloaded && await pu.evaluate(() => import('./js/update.js').then(m => m.forceUpdate()).then(r => r === false)), String(reloaded));
    await cu.close();
  }
  {
    // Samsung Internet con modo oscuro: aviso con los pasos para dejar el navegador en modo normal
    const SAMSUNG = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36';
    const cs = await browser.newContext({ ...devices['Galaxy S9+'], userAgent: SAMSUNG, colorScheme: 'dark' }); const ps = await cs.newPage(); const es = watchErrors(ps); await mockTime(ps);
    await open(ps);
    await ps.waitForSelector('#dark-overlay.open', { timeout: 15000 }).catch(() => {});
    const tip = await ps.evaluate(() => ({ open: document.querySelector('#dark-overlay').classList.contains('open'), fd: document.documentElement.classList.contains('fd'), txt: document.querySelector('#dark-overlay').textContent }));
    check('Samsung Internet en modo oscuro: aviso para apagar el modo oscuro del navegador', tip.open && tip.fd && /Modo oscuro/.test(tip.txt) && /Labs/.test(tip.txt), JSON.stringify({ open: tip.open, fd: tip.fd }));
    await ps.screenshot({ path: 'tests/out/33-aviso-modo-oscuro.png' });
    await ps.click('#dark-never'); await ps.waitForTimeout(200);
    await ps.reload(); await ps.waitForFunction(() => window.AAP?.scene?.ready, null, { timeout: 20000 }); await ps.waitForTimeout(2500);
    check('«No volver a mostrar»: no vuelve a salir', await ps.locator('#dark-overlay.open').count() === 0);
    await ps.emulateMedia({ colorScheme: 'light' }); await ps.waitForTimeout(200);
    check('al apagar el modo oscuro, el juego vuelve a sus contornos normales', await ps.evaluate(() => !document.documentElement.classList.contains('fd')));
    check('aviso de modo oscuro: sin errores en consola', es.length === 0, es.join(' | '));
    await cs.close();
    // en otros navegadores, o en modo claro, nada
    const cl = await browser.newContext({ ...devices['Galaxy S9+'], userAgent: SAMSUNG, colorScheme: 'light' }); const pl = await cl.newPage(); await mockTime(pl);
    await open(pl); await pl.waitForTimeout(2500);
    check('Samsung Internet en modo claro: sin aviso', await pl.evaluate(() => !document.querySelector('#dark-overlay').classList.contains('open') && !document.documentElement.classList.contains('fd')));
    await cl.close();
  }
  const sw = await p9.evaluate(() => navigator.serviceWorker.ready.then(r => r.active?.state || 'x'));
  await p9.reload(); await p9.waitForFunction(() => window.AAP?.scene?.ready, null, { timeout: 20000 });
  check('el juego registra su service worker', sw === 'activated' && await p9.evaluate(() => !!navigator.serviceWorker.controller), sw);
  await c9.setOffline(true); await p9.reload().catch(() => {}); const offline = await p9.waitForFunction(() => window.AAP?.scene?.ready, null, { timeout: 20000 }).then(() => true, () => false); await c9.setOffline(false);
  check('sin conexión, el juego abre igual (lo último guardado)', offline);
  // aviso para instalar: en iPhone, los pasos de Safari; «Ahora no» lo deja tranquilo 3 días
  await p9.evaluate(async () => { AAP.giftTest.off = true; const m = await import('./js/install.js'); m.maybeOffer(3); });
  await p9.waitForSelector('#install-overlay.open', { timeout: 8000 }).catch(() => {});
  const ios = await p9.evaluate(() => ({ mode: document.querySelector('#install-overlay').dataset.mode, steps: !document.querySelector('#install-ios').classList.contains('hidden'), gift: document.querySelector('.install-gift').textContent, row: !document.querySelector('#btn-install').classList.contains('hidden') }));
  check('en iPhone: ventana con los 3 pasos de Safari y el regalo (cofre de diamante + 150 pesetas)', ios.mode === 'ios' && ios.steps && /diamante \+ 150 pesetas/.test(ios.gift) && ios.row, JSON.stringify(ios));
  await p9.screenshot({ path: 'tests/out/32-instalar-iphone.png' });
  await p9.click('#install-later'); await p9.waitForTimeout(200);
  // en la pantalla de juego, a la vista: el icono de la app con su regalo, que abre la misma ventana
  const fab = await p9.evaluate(() => { const b = document.querySelector('#install-fab'), r = b.getBoundingClientRect(), g = document.querySelector('#btn-settings').getBoundingClientRect();
    return { shown: !b.classList.contains('hidden') && r.width > 40, right: r.right <= innerWidth, below: r.top >= g.bottom - 2, img: b.querySelector('img').naturalWidth }; });
  check('pantalla de juego: icono de la app con regalo, debajo de Ajustes', fab.shown && fab.right && fab.below && fab.img === 192, JSON.stringify(fab));
  await p9.screenshot({ path: 'tests/out/32b-boton-app.png' });
  await p9.click('#install-fab', { force: true }); await p9.waitForTimeout(200);
  check('al tocarlo se abre la ventana de instalar', await p9.locator('#install-overlay.open').count() === 1);
  await p9.click('#install-later'); await p9.waitForTimeout(200);
  const later = await p9.evaluate(async () => { const m = await import('./js/install.js'); await Promise.race([m.maybeOffer(5), new Promise(r => setTimeout(r, 1500))]); return document.querySelector('#install-overlay').classList.contains('open'); });
  check('«Ahora no»: no vuelve a salir sola', !later);
  // en Android: el aviso del propio navegador al pulsar ¡INSTALAR!
  await p9.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => { window.__prompted = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); dispatchEvent(e); });
  await p9.evaluate(() => import('./js/install.js').then(m => m.open())); await p9.waitForTimeout(200);
  const and = await p9.evaluate(() => document.querySelector('#install-overlay').dataset.mode + '|' + document.querySelector('#install-go').textContent);
  await p9.click('#install-go', { force: true }); await p9.waitForTimeout(300);
  check('en Android: botón ¡INSTALAR! que abre el aviso del navegador', and === 'android|¡INSTALAR!' && await p9.evaluate(() => window.__prompted === true) && await p9.locator('#install-overlay.open').count() === 0, and);
  check('instalar: sin errores en consola', e9.filter(x => !/ERR_INTERNET_DISCONNECTED|Failed to load resource|net::ERR/.test(x)).length === 0, e9.join(' | '));
  await c9.close();
  // abierto desde la app instalada: el regalo, una sola vez
  const c10 = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 }); const p10 = await c10.newPage(); await mockTime(p10);
  await p10.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = q => (/display-mode: standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : mm(q)); });
  await open(p10, undefined, { install: true });
  await p10.evaluate(() => { AAP.giftTest.off = true; });
  await p10.waitForSelector('#chest-overlay.open', { timeout: 10000 }).catch(() => {});
  const g0 = await S(p10);
  const gotChest = await p10.locator('#chest-overlay.open').count() === 1;
  if (gotChest) { await p10.click('#chest-btn'); await p10.waitForFunction(() => document.querySelector('#chest-btn').textContent === 'RECOGER' && !document.querySelector('#chest-btn').disabled, null, { timeout: 15000 }); await p10.click('#chest-btn'); await p10.waitForTimeout(300); }
  const g1 = await p10.evaluate(() => ({ claimed: AAP.state.installClaimed, row: document.querySelector('#btn-install').classList.contains('hidden') && document.querySelector('#install-fab').classList.contains('hidden') }));
  check('abierto desde la app instalada: regalo de cofre de diamante + 150 pesetas', gotChest && g1.claimed && g1.row && g0.chestPesetas >= 150 + 10, JSON.stringify({ g1, cp: g0.chestPesetas }));
  await p10.reload(); await p10.waitForFunction(() => window.AAP?.scene?.ready, null, { timeout: 20000 }); await p10.waitForTimeout(2500);
  check('y solo una vez', await p10.locator('#chest-overlay.open').count() === 0);
  await c10.close();
}

console.log('34. Anti-autoclicker');
{
  const cg = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 }); const pg = await cg.newPage(); const eg = watchErrors(pg); await mockTime(pg);
  await open(pg);
  await pg.evaluate(() => { AAP.giftTest.off = true; AAP.guardTest.on = true; AAP.guardTest.synthetic = true; });
  // toques con un ritmo y una posición dados: [intervalo en ms, dispersión en píxeles]
  // reloj simulado: el ritmo de cada toque es exacto aunque el ordenador vaya cargado
  const burst = (n, gap, jitter, spread) => pg.evaluate(([n, gap, jitter, spread]) => {
    const b = document.querySelector('#btn-click'), r = b.getBoundingClientRect(), G = AAP.guardTest; G.t = G.t ?? performance.now();
    for (let i = 0; i < n; i++) { G.t += gap + (Math.random() - .5) * jitter; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.x + r.width / 2 + (Math.random() - .5) * spread, clientY: r.y + r.height / 2 + (Math.random() - .5) * spread })); }
  }, [n, gap, jitter, spread]);
  const isOpen = () => pg.evaluate(() => document.querySelector('#guard-overlay').classList.contains('open'));
  await burst(120, 110, 90, 24);
  check('persona pulsando deprisa (ritmo y dedo variables): nada', !(await isOpen()));
  await burst(120, 130, 110, 0);
  check('con ratón (siempre el mismo punto) pero ritmo humano: nada', !(await isOpen()));
  const c0 = (await S(pg)).totalClicks;
  await burst(60, 60, 2, 0);
  const why = await pg.evaluate(() => document.querySelector('#guard-overlay').dataset.why);
  check('autoclicker (ritmo de máquina en el mismo punto): «¿Sigues ahí?»', await isOpen() && ['rhythm', 'spot'].includes(why), why);
  await pg.screenshot({ path: 'tests/out/34-autoclicker.png' });
  const c1 = (await S(pg)).totalClicks; await burst(30, 60, 2, 0); const c2 = (await S(pg)).totalClicks;
  check('mientras no la pasa, los toques no cuentan (lo detecta en unos 40 toques)', c1 - c0 <= 60 * 3 && c2 === c1, `${c0} → ${c1} → ${c2}`);
  // un autoclicker pulsando siempre en el mismo sitio de la ventana no la pasa (los tomates cambian de sitio)
  const spot = await pg.evaluate(() => { const a = document.querySelector('#guard-area').getBoundingClientRect(), t = document.querySelector('#guard-target').getBoundingClientRect();
    const x = t.left > a.left + a.width / 2 ? a.left + 20 : a.right - 20, y = t.top > a.top + a.height / 2 ? a.top + 20 : a.bottom - 20; return { x, y }; });
  for (let i = 0; i < 8; i++) await pg.mouse.click(spot.x, spot.y);
  check('tocando siempre el mismo sitio no se pasa', await isOpen() && (await pg.textContent('#guard-count')) === '0 / 3');
  for (let i = 0; i < 3; i++) { await pg.locator('#guard-target').click({ force: true }); await pg.waitForTimeout(150); }
  const c3 = (await S(pg)).totalClicks; await burst(10, 150, 120, 20); const c4 = (await S(pg)).totalClicks;
  check('tocando los 3 tomates: se cierra y los toques vuelven a contar', !(await isOpen()) && c4 > c3, `${c3} → ${c4}`);
  // toques lanzados por un programa desde la página (no son de un dedo): no cuentan
  await pg.evaluate(() => { AAP.guardTest.synthetic = false; }); await burst(10, 150, 120, 20);
  check('toques falsos (lanzados desde código): no cuentan', (await S(pg)).totalClicks === c4);
  // horas pulsando sin parar ni un momento: también pregunta
  await pg.evaluate(async () => { const m = await import('./js/guard.js'); m.GUARD.nonstopMs = 1500; AAP.guardTest.synthetic = true; });
  await burst(20, 120, 100, 20);
  check('pulsando sin ninguna pausa durante mucho rato: «¿Sigues ahí?»', await isOpen() && await pg.evaluate(() => document.querySelector('#guard-overlay').dataset.why) === 'nonstop');
  check('anti-autoclicker: sin errores en consola', eg.length === 0, eg.join(' | '));
  await cg.close();
}

console.log('35. La Armería');
{
  const ca = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 }); const pa = await ca.newPage(); const ea = watchErrors(pa); await mockTime(pa);
  await open(pa);
  await pa.evaluate(() => { AAP.giftTest.off = true; AAP.armoryTest.off = true; });
  const vis = sel => pa.evaluate(s => { const e = document.querySelector(s); return !!e && !e.classList.contains('hidden') && e.offsetWidth > 0; }, sel);
  const lock0 = await pa.evaluate(() => ({ locked: document.querySelector('#armory-btn').classList.contains('locked'), tag: document.querySelector('#armory-tag').textContent }));
  await pa.click('#armory-btn'); await pa.waitForTimeout(200);
  check('jugador nuevo: La Armería cerrada (candado, «NV 10») y aviso de cuándo se abre', lock0.locked && lock0.tag === 'NV 10' && await vis('#armory-tease') && /nivel 10/.test(await pa.textContent('#armory-tease'))
    && !(await pa.evaluate(() => document.querySelector('#panel-armory').classList.contains('open'))), JSON.stringify(lock0));
  check('sin nivel 10 no se puede comprar', await pa.evaluate(() => AAP.backend.buyArmory('slipper', 40000).then(() => false, e => /nivel 10/.test(e.message))));
  const btn = await pa.evaluate(() => { const r = document.querySelector('#armory-btn').getBoundingClientRect(); return { x: r.x, w: r.width, top: r.top }; });
  check('el botón está a un lado (fuera del menú de abajo) y no tapa el juego', btn.x < 20 && btn.w < 80 && btn.top > 150, JSON.stringify(btn));
  // nivel 10 con el sistema de niveles de verdad: se abre sola
  await pa.evaluate(async () => { const st = AAP.state.stats; st.tomatoesThrown = 2200; st.hits = 1200; (await import('./js/state.js')).changed(false); });
  await pa.waitForTimeout(300);
  check('al llegar al nivel 10 se desbloquea sola', await pa.evaluate(() => !document.querySelector('#armory-btn').classList.contains('locked') && (AAP.state.stats.tomatoesThrown * 10 + AAP.state.stats.hits * 5) >= 27200));
  await pa.click('#armory-btn'); await pa.waitForTimeout(400);
  const intro = await pa.evaluate(() => { const e = document.querySelector('#arm-intro'); return !e.classList.contains('hidden') && /Bienvenido a La Armería/.test(e.textContent) && /para siempre/.test(e.textContent); });
  await pa.click('#arm-intro-ok', { force: true }); await pa.waitForTimeout(150);
  check('la primera vez explica qué es La Armería', intro && await pa.evaluate(() => document.querySelector('#arm-intro').classList.contains('hidden')));
  const shop = await pa.evaluate(() => ({ open: document.querySelector('#panel-armory').classList.contains('open'), seller: document.querySelector('.arm-seller').naturalWidth, cards: [...document.querySelectorAll('.arm-card')].map(c => c.dataset.id),
    wide: document.querySelector('.arm-card.wide')?.dataset.id, cols: getComputedStyle(document.querySelector('#arm-grid')).gridTemplateColumns.split(' ').length, prices: [...document.querySelectorAll('.arm-price')].map(b => b.textContent.replace(/\s+/g, ' ').trim()),
    poor: !document.querySelector('[data-buy="slipper"]') && /Te faltan/.test(document.querySelector('[data-id="slipper"] [data-dream]')?.textContent) }));
  check('la tienda: Abascal tras el mostrador y 7 objetos (3 + 3 + el sello a lo ancho)', shop.open && shop.seller > 0 && shop.cards.join() === 'hammer,slipper,goose,bull,vacuum,press,stamp' && shop.wide === 'stamp' && shop.cols === 3, JSON.stringify(shop));
  check('precios: gratis, 40.000, 80.000, 150.000, 250.000, 400.000 y 650.000', shop.prices.join('|') === 'GRATIS al instalar la app|40.000|80.000|150.000|250.000|400.000|650.000', shop.prices.join('|'));
  check('sin pesetas suficientes no se puede comprar', shop.poor);
  // sin pesetas: al tocarlo, bocadillo de sueño con la animación en pequeño (sin sonido)
  const snd0 = await pa.evaluate(() => import('./js/audio.js').then(m => m.isEnabled()));
  await pa.click('[data-dream="bull"]', { force: true }); await pa.waitForTimeout(1600);
  const dr = await pa.evaluate(() => { const cv = document.querySelector('#dream-cv'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 0; i < d.length; i += 400) if (d[i] + d[i + 1] + d[i + 2] > 30) n++;
    return { open: !document.querySelector('#arm-dream').classList.contains('hidden'), txt: document.querySelector('#dream-txt').textContent, drawn: n > 50 }; });
  check('no te llega: «¡Imagínatelo!» con la animación en un bocadillo de sueño', dr.open && dr.drawn && /Te faltan/.test(dr.txt) && /soñar es gratis/.test(dr.txt), JSON.stringify(dr));
  await pa.screenshot({ path: 'tests/out/35-sueno.png' });
  await pa.click('#arm-dream', { force: true }); await pa.waitForTimeout(200);
  check('al tocar, se despierta y el sonido vuelve como estaba', await pa.evaluate(() => document.querySelector('#arm-dream').classList.contains('hidden')) && await pa.evaluate(() => import('./js/audio.js').then(m => m.isEnabled())) === snd0);
  await pa.screenshot({ path: 'tests/out/35-armeria.png' });
  await pa.evaluate(async () => { AAP.state.stats.chestPesetas += 200000; (await import('./js/state.js')).changed(false); }); await pa.waitForTimeout(200);
  const p0 = (await S(pa)).pesetas;
  await pa.click('[data-buy="slipper"]', { force: true }); await pa.waitForTimeout(200);
  const one = await pa.evaluate(() => ({ owned: AAP.state.armory.includes('slipper'), label: document.querySelector('[data-id="slipper"] button')?.textContent }));
  check('un toque no compra: pide confirmación', !one.owned && /SEGURO/.test(one.label), JSON.stringify(one));
  await pa.click('[data-buy="slipper"]', { force: true }); await pa.waitForTimeout(400);
  const win0 = await pa.evaluate(() => document.querySelector('#arm-win').className);
  await pa.waitForTimeout(2200);
  const win = await pa.evaluate(() => ({ cls: document.querySelector('#arm-win').className, name: document.querySelector('#win-name').textContent, tier: document.querySelector('#win-tier').textContent, fx: !!document.querySelector('#arm-win .fx-canvas') }));
  check('al comprar: celebración especial (la caja tiembla, destello, el objeto sale con rayos y confeti)', /s1/.test(win0) && /s2/.test(win.cls) && /s3/.test(win.cls) && win.name === 'Chancla boomerang' && win.tier === 'RARO' && win.fx, JSON.stringify({ win0, win }));
  await pa.screenshot({ path: 'tests/out/35-compra.png' });
  await pa.click('#win-later', { force: true }); await pa.waitForTimeout(200);
  const after = await pa.evaluate(() => ({ owned: AAP.state.armory.filter(x => x === 'slipper').length, own: document.querySelector('[data-id="slipper"] .arm-tick')?.textContent, btn: !!document.querySelector('[data-buy="slipper"]') }));
  const p1 = (await S(pa)).pesetas;
  check('comprar: descuenta 40.000 pesetas y es tuyo (una vez)', after.owned === 1 && p0 - p1 === 40000 && /TUYO/.test(after.own) && !after.btn, JSON.stringify({ after, p0, p1 }));
  check('no se puede comprar dos veces', await pa.evaluate(() => AAP.backend.buyArmory('slipper', 40000).then(() => false, e => /Ya tienes/.test(e.message))) && (await S(pa)).pesetas === p1);
  // lo comprado se usa desde su tarjeta («¡USAR!»): se cierra la tienda y empieza la animación
  const uses = await pa.evaluate(() => [...document.querySelectorAll('#arm-grid [data-use]')].map(b => b.dataset.use).join());
  check('solo lo que tienes tiene el botón ¡USAR!', uses === 'slipper', uses);
  await pa.click('#arm-grid [data-use="slipper"]', { force: true }); await pa.waitForTimeout(450);
  const during = await pa.evaluate(async () => ({ busy: AAP.scene.busy, prop: !!AAP.scene.prop, closed: !document.querySelector('#panel-armory').classList.contains('open'), thr: await (await import('./js/play.js')).throwTomatoes(1) }));
  await pa.waitForFunction(() => !AAP.scene.busy, null, { timeout: 8000 });
  check('al usarla: se cierra la tienda, animación contra Pedro y mientras tanto no se lanza', during.busy && during.prop && during.closed && during.thr === false, JSON.stringify(during));
  check('y no se gasta', await pa.evaluate(() => AAP.state.armory.includes('slipper') && !AAP.scene.wpn && !AAP.scene.prop));
  check('lo que no tienes no se puede usar', await pa.evaluate(() => import('./js/armory.js').then(m => m.use('bull'))) === false);
  // martillo de goma: el regalo de la app, una sola vez
  const ham = await pa.evaluate(() => AAP.backend.claimInstall().then(r => r.item, e => 'err ' + e.message));
  check('martillo de goma: regalo al instalar la app', ham === 'hammer' && await pa.evaluate(() => AAP.state.armory.includes('hammer')));
  check('y solo una vez', await pa.evaluate(() => AAP.backend.claimInstall().then(() => false, e => /Ya has recogido/.test(e.message)) && AAP.state.armory.filter(x => x === 'hammer').length === 1));
  // después de recoger el regalo se puede volver a instalar desde Ajustes (si quitaste la app)
  const re = await pa.evaluate(async () => { const m = await import('./js/install.js'); m.refresh(); m.open(); const r = { row: !document.querySelector('#btn-install').classList.contains('hidden'), txt: document.querySelector('#btn-install small').textContent,
    fab: document.querySelector('#install-fab').classList.contains('hidden'), gift: document.querySelector('#install-overlay .install-gift').classList.contains('hidden'), open: document.querySelector('#install-overlay').classList.contains('open') };
    document.querySelector('#install-overlay').classList.remove('open'); return r; });
  check('con el regalo ya recogido, en Ajustes se puede volver a instalar la app (sin regalo)', re.row && /Vuelve a instalarla/.test(re.txt) && re.fab && re.gift && re.open, JSON.stringify(re));
  // se guarda al cerrar y volver a abrir
  await pa.reload(); await pa.waitForFunction(() => window.AAP?.scene?.ready, null, { timeout: 20000 });
  check('el inventario se conserva al volver a abrir', await pa.evaluate(() => AAP.state.armory.slice().sort().join()) === 'hammer,slipper');
  // las siete animaciones, sin errores
  await pa.evaluate(() => { AAP.giftTest.off = true; AAP.state.armory = ['hammer', 'slipper', 'goose', 'bull', 'vacuum', 'press', 'stamp']; });
  const ok = []; for (const id of ['hammer', 'slipper', 'goose', 'bull', 'vacuum', 'press', 'stamp']) {
    const r = await pa.evaluate(id => import('./js/armory.js').then(m => m.use(id)), id); if (id === 'bull') await pa.screenshot({ path: 'tests/out/35-toro.png' }).catch(() => {});
    ok.push(r === true && await pa.evaluate(() => !AAP.scene.busy && !AAP.scene.wpn && !AAP.scene.tint)); }
  check('las 7 animaciones (martillo, chancla, oca, toro, aspiradora, prensa y sello) terminan bien', ok.every(Boolean), ok.join());
  check('La Armería: sin errores en consola', ea.length === 0, ea.join(' | '));
  await ca.close();
}

console.log('21. Consola'); check('sin errores en consola', errors.length === 0, errors.join(' | '));
await browser.close(); process.exit(summary() ? 1 : 0);

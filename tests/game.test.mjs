// Prueba completa del juego como invitado (guardado local). Ejecutar con el juego servido en http://localhost:8080:
//   node tests/game.test.mjs
import { launch, devices, check, summary, watchErrors, mockTime, open, tap, S, stopAt, idle, give, madrid } from './helpers.mjs';
const browser = await launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage(); const errors = watchErrors(page); await mockTime(page);
const txt = s => page.locator(s).innerText();
const disabled = n => page.locator(`.btn-throw[data-n="${n}"]`).isDisabled();
const shot = n => page.screenshot({ path: `tests/out/${n}.png` });

console.log('1. Carga'); await open(page);
check('el juego carga y Phaser está listo', await page.evaluate(() => !!document.querySelector('#game canvas') && AAP.scene.ready));
await shot('01-inicio');

console.log('2-5. Clics y tomates'); await tap(page, 250); await page.waitForTimeout(900);
let s = await S(page);
check('250 clics contabilizados', s.totalClicks === 250, `(${s.totalClicks})`);
check('2 tomates por 250 clics', s.tomatoes === 2 && s.tomatoesEarned === 2);
check('50 clics sobrantes conservados', s.clicks === 50 && (await txt('#bar-text')).startsWith('50 / 100'));
check('HUD muestra tomates', (await txt('#tomato-num')) === '2');

console.log('7. Límites de lanzamiento');
check('con 2 tomates: ×1 activo, ×3 ×5 ×10 desactivados', !(await disabled(1)) && await disabled(3) && await disabled(5) && await disabled(10));
check('no se pueden lanzar más de los disponibles (llamada directa)', await page.evaluate(async () => (await import('./js/play.js')).throwTomatoes(3)) === false && (await S(page)).tomatoes === 2);

console.log('6, 9, 10, 11. Lanzamiento ×1: tutorial, perfecto');
await page.click('.btn-throw[data-n="1"]'); await page.waitForTimeout(300);
check('tutorial la primera vez', await page.locator('#panel-tutorial').evaluate(e => e.classList.contains('open')));
await page.click('#panel-tutorial [data-close]'); await page.waitForTimeout(300);
check('descuenta 1 tomate al lanzar', (await S(page)).tomatoes === 1);
check('botón ¡AHORA! visible', await page.locator('#btn-stop').isVisible());
await stopAt(page, 0, 10); await page.waitForTimeout(1500); await shot('02-caida');
await idle(page); s = await S(page);
check('impacto perfecto: Pedro cae', s.falls === 1 && s.perfects === 1);
check('1 peseta por caída (sin Joyas)', s.pesetas === 1 && s.pesetasEarned === 1);
check('Pedro vuelve a la silla', await page.evaluate(() => Math.abs(AAP.scene.pedro.x - 380) < 1 && Math.abs(AAP.scene.pedro.y - 298) < 1 && AAP.scene.pedro.alpha === 1));

console.log('9. Fallo y cercano con ×1');
await page.click('.btn-throw[data-n="1"]'); await stopAt(page, 150, 400); await page.waitForTimeout(900); await shot('03-fallo'); await idle(page); s = await S(page);
check('fallo: no cae, sin pesetas, tomate gastado', s.falls === 1 && s.pesetas === 1 && s.tomatoes === 0 && s.tomatoesThrown === 2);
check('todos los botones desactivados sin tomates', await disabled(1));
await tap(page, 100); await page.waitForTimeout(800);
await page.click('.btn-throw[data-n="1"]'); await stopAt(page, 30, 70); await page.waitForTimeout(600); await shot('04-cercano'); await idle(page); s = await S(page);
check('cercano sin Apagón: cuenta como impacto pero no cae', s.hits === 2 && s.falls === 1 && s.perfects === 1);

console.log('6, 8, 12. Lanzamientos múltiples');
await tap(page, 1900); await page.waitForTimeout(900); s = await S(page);
check('19 tomates (sin límite artificial)', s.tomatoes === 19, `(${s.tomatoes})`);
// ×3: perfecto, cercano, fallo
let before = await S(page);
await page.click('.btn-throw[data-n="3"]'); await page.waitForTimeout(200);
check('×3 descuenta exactamente 3', (await S(page)).tomatoes === before.tomatoes - 3);
check('indicador de tomate 1/3', (await txt('#volley-badge')).includes('1 / 3'));
await stopAt(page, 0, 10); await page.waitForFunction(() => document.querySelector('#volley-i').textContent === '2' && AAP.scene.aim, null, { timeout: 30000 });
await stopAt(page, 30, 70); await page.waitForFunction(() => document.querySelector('#volley-i').textContent === '3' && AAP.scene.aim, null, { timeout: 30000 });
await stopAt(page, 150, 400); await page.waitForSelector('#summary:not(.hidden)', { timeout: 30000 }); await shot('05-resumen-x3');
const sum = await txt('#summary'); await idle(page); s = await S(page);
check('×3: 1 perfecto + 1 cercano + 1 fallo registrados', s.perfects === before.perfects + 1 && s.hits === before.hits + 2 && s.tomatoesThrown === before.tomatoesThrown + 3);
check('×3: recompensa solo por el que derriba (+1 ₧)', s.pesetas === before.pesetas + 1 && s.falls === before.falls + 1 && /\+1/.test(sum), sum.replace(/\n/g, ' '));
// ×5: todos fallos -> sin recompensa
before = await S(page); await page.click('.btn-throw[data-n="5"]');
for (let i = 1; i <= 5; i++) { await page.waitForFunction(i => document.querySelector('#volley-i').textContent === String(i) && AAP.scene.aim, i, { timeout: 30000 }); await stopAt(page, 150, 400); }
await idle(page); s = await S(page);
check('×5 descuenta 5 y no premia fallos', s.tomatoes === before.tomatoes - 5 && s.pesetas === before.pesetas && s.falls === before.falls);
// ×10: todos perfectos -> 10 caídas, 10 pesetas
before = await S(page); await page.click('.btn-throw[data-n="10"]');
for (let i = 1; i <= 10; i++) { await page.waitForFunction(i => document.querySelector('#volley-i').textContent === String(i) && AAP.scene.aim, i, { timeout: 30000 }); await stopAt(page, 0, 10); }
await idle(page); s = await S(page);
check('×10 descuenta 10', s.tomatoes === before.tomatoes - 10 && s.tomatoesThrown === before.tomatoesThrown + 10);
check('×10 perfectos: 10 caídas y 10 pesetas, sin duplicados', s.falls === before.falls + 10 && s.pesetas === before.pesetas + 10, `(caídas +${s.falls - before.falls}, pesetas +${s.pesetas - before.pesetas})`);
check('estado coherente tras ráfaga (Pedro en la silla)', await page.evaluate(() => !AAP.scene.busy && Math.abs(AAP.scene.pedro.x - 380) < 1 && Math.abs(AAP.scene.pedro.angle) < 1));

console.log('19. Ranking: tomates históricos');
check('los tomates históricos no bajan al lanzar', s.tomatoesEarned === 22 && s.tomatoes === 1 && s.tomatoesThrown === 21, `(históricos ${s.tomatoesEarned}, disponibles ${s.tomatoes})`);
check('el HUD lo muestra', (await txt('#hist-text')).startsWith('22'));

console.log('18. Anuncios no integrados');
await page.click('.nav [data-panel="shop"]'); await page.waitForTimeout(300); await shot('06-tienda');
check('botones de vídeo desactivados y "Próximamente"', await page.locator('#btn-falcon').isDisabled() && await page.locator('#btn-sobre').isDisabled() && (await txt('#btn-falcon')).includes('Próximamente'));
before = await S(page);
const adErr = await page.evaluate(async () => { const out = []; for (const p of ['falcon', 'sobre']) { try { await AAP.backend.watchAd(p); out.push('CONCEDIDO'); } catch (e) { out.push(e.message); } } return out; });
s = await S(page);
check('los anuncios no conceden recompensas', adErr.every(m => m.includes('no están disponibles')) && s.pesetas === before.pesetas && s.falcon === 0, adErr[0]);
await page.click('#panel-shop [data-close]');

console.log('13, 14, 15. Cofres');
await page.click('.nav [data-panel="chests"]'); await page.waitForTimeout(300); await shot('07-cofres');
check('sin pesetas suficientes: comprar diamante desactivado', await page.locator('[data-buy="diamond"]').isDisabled());
check('probabilidades visibles', await page.evaluate(() => { document.querySelector('[data-probs]').click(); return document.querySelector('.probs.open')?.innerText.includes('%'); }));
before = await S(page);
await page.click('[data-daily]'); await page.waitForSelector('#chest-overlay.open'); await page.click('#chest-btn'); await page.waitForFunction(() => document.querySelector('#chest-btn').textContent === 'Recoger' && !document.querySelector('#chest-btn').disabled, null, { timeout: 15000 }); await shot('08-cofre-abierto');
const nRew = await page.locator('#chest-rewards .reward').count(); await page.click('#chest-btn'); await page.waitForTimeout(400); s = await S(page);
check('cofre diario gratis: da carta y tomates, no cuesta', nRew >= 2 && s.pesetasSpent === before.pesetasSpent && s.chestTomatoes >= 2 && s.chestsOpened === 1);
check('carta guardada (nueva o fragmento)', Object.values(s.cards).some(c => c.level > 0));
check('cofre diario marcado con la fecha del servidor', s.daily === madrid(new Date()));
check('cofre diario no se puede reclamar dos veces (botón)', await page.locator('[data-daily]').isDisabled());
check('cofre diario no se puede reclamar dos veces (llamada directa)', await page.evaluate(() => AAP.backend.claimDaily().then(() => false, e => e.message.includes('Ya has reclamado'))));
await give(page, { pesetas: 300 }); await page.evaluate(() => AAP.ui.renderChests());
before = await S(page);
await page.click('[data-buy="wood"]'); await page.waitForSelector('#chest-overlay.open'); await page.click('#chest-btn'); await page.waitForFunction(() => document.querySelector('#chest-btn').textContent === 'Recoger' && !document.querySelector('#chest-btn').disabled); await page.click('#chest-btn'); await page.waitForTimeout(400); s = await S(page);
check('cofre de madera: cuesta 15 ₧', s.pesetasSpent === before.pesetasSpent + 15 && s.chestsOpened === before.chestsOpened + 1);
before = s;
await page.click('[data-buy="diamond"]'); await page.waitForSelector('#chest-overlay.open'); await page.click('#chest-btn'); await page.waitForFunction(() => document.querySelector('#chest-btn').textContent === 'Recoger' && !document.querySelector('#chest-btn').disabled, null, { timeout: 15000 }); await shot('09-cofre-diamante');
const nCards = await page.locator('#chest-rewards .reward .tag').evaluateAll(els => els.filter(e => /nueva|fragmento/i.test(e.textContent)).length); await page.click('#chest-btn'); await page.waitForTimeout(400); s = await S(page);
check('cofre de diamante: cuesta 80 ₧ y da 3+ cartas y 10+ tomates', s.pesetasSpent === before.pesetasSpent + 80 && nCards >= 3 && s.chestTomatoes - before.chestTomatoes >= 10, `(${nCards} cartas, +${s.chestTomatoes - before.chestTomatoes} tomates)`);
check('los tomates de cofre cuentan como históricos', s.tomatoesEarned === Math.floor(s.totalClicks / 100) + s.chestTomatoes);
await page.click('#panel-chests [data-close]');

console.log('16, 17. Cartas y potenciadores');
await give(page, { cards: { inflacion: { level: 1, frags: 6 }, mariscada: { level: 1, frags: 3 }, joyas: { level: 1, frags: 0 }, apagon: { level: 1, frags: 0 }, amnistia: { level: 1, frags: 0 } } });
await page.click('.nav [data-panel="cards"]'); await page.waitForTimeout(300); await shot('10-cartas');
check('la colección muestra las 5 cartas', await page.locator('#cards-grid .card').count() === 5);
before = await S(page);
const cost = await page.evaluate(() => AAP.E.upgradeCost('inflacion', 1, AAP.state.cards));
await page.click('[data-upgrade="inflacion"]'); await page.waitForTimeout(300); s = await S(page);
check('mejorar Inflación descuenta el precio exacto y los fragmentos', s.pesetas === before.pesetas - cost && s.cards.inflacion.level === 2 && s.cards.inflacion.frags === 6 - 2, `(coste ${cost})`);
check('no se puede mejorar sin fragmentos', await page.locator('[data-upgrade="joyas"]').isDisabled());
const base = await page.evaluate(() => AAP.E.upgradeCost('inflacion', 2, { mariscada: { level: 0 } }));
await page.click('[data-upgrade="mariscada"]'); await page.waitForTimeout(300); s = await S(page);
const disc = await page.evaluate(() => AAP.E.upgradeCost('inflacion', 2, AAP.state.cards));
check('Mariscada Sindical abarata las mejoras', s.cards.mariscada.level === 2 && disc < base && disc >= 1, `(${base} → ${disc})`);
check('Mariscada tiene tope de descuento (32%)', await page.evaluate(() => AAP.E.CARDS.mariscada.value(8) === 0.32 && AAP.E.CARDS.mariscada.value(50) === 0.32 && AAP.E.upgradeCost('inflacion', 1, { mariscada: { level: 8 } }) >= 1));
await page.click('#panel-cards [data-close]');
before = await S(page); await tap(page, 10); s = await S(page);
check('Inflación nivel 2: 3 clics por pulsación', s.totalClicks === before.totalClicks + 30 && (await txt('#cpt-badge')).includes('+3'));
check('Joyas de Zapatero: probabilidad de 2 o 3 pesetas', await page.evaluate(() => { const c = { joyas: { level: 10 } }, E = AAP.E; return E.rollFallPesetas(c, () => 0.1) === 3 && E.rollFallPesetas(c, () => 0.5) === 2 && E.rollFallPesetas(c, () => 0.95) === 1 && E.rollFallPesetas({ joyas: { level: 0 } }, () => 0) === 1; }));
check('Amnistía mejora rarezas sin garantizar legendaria', await page.evaluate(() => { const E = AAP.E, a = E.rarityPercents('wood', { amnistia: { level: 0 } }), b = E.rarityPercents('wood', { amnistia: { level: 5 } }), d = E.rarityPercents('diamond', { amnistia: { level: 5 } }); return b.legendary > a.legendary && b.common < a.common && b.legendary < 20 && d.legendary < 30 && d.legendary > b.legendary; }));
// Apagón en juego real: con nivel 10 y azar forzado, un impacto cercano derriba; un fallo nunca.
await give(page, { tomatoes: 3, cards: { apagon: { level: 10, frags: 0 } } });
await page.evaluate(() => { AAP.testRng.fn = () => 0.01; });
before = await S(page); await page.click('.btn-throw[data-n="1"]'); await stopAt(page, 20, 40); await idle(page); s = await S(page);
check('Apagón: un impacto cercano puede derribar', s.falls === before.falls + 1 && s.perfects === before.perfects && s.pesetas > before.pesetas);
before = s; await page.click('.btn-throw[data-n="1"]'); await stopAt(page, 150, 400); await idle(page); s = await S(page);
check('Apagón no convierte un fallo en caída', s.falls === before.falls);
await page.evaluate(() => { AAP.testRng.fn = null; });

console.log('20. Persistencia'); before = await S(page);
await page.reload(); await page.waitForFunction(() => window.AAP?.scene?.ready); await page.waitForTimeout(500); s = await S(page);
check('clics, tomates, pesetas, estadísticas y cartas persisten', JSON.stringify(s) === JSON.stringify(before));
await page.click('#btn-stats'); await page.waitForTimeout(200); await shot('11-estadisticas');
check('panel de estadísticas completo', /histórico/.test(await txt('#stats-list')) && /Derribos/.test(await txt('#stats-list')) && /Inflación/.test(await txt('#stats-list')));
await page.click('#panel-stats [data-close]');
await page.click('#btn-sound'); check('sonido desactivable', (await txt('#btn-sound')) === '🔇'); await page.click('#btn-sound');

console.log('14. Cofre diario y reloj del dispositivo');
const ctx2 = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, storageState: await ctx.storageState() });
await ctx2.addInitScript(() => { const real = Date.now; Date.now = () => real() + 2 * 86400e3; });   // el jugador adelanta el reloj 2 días
const p2 = await ctx2.newPage(); await mockTime(p2); await open(p2); await p2.waitForTimeout(600);
check('adelantar el reloj no desbloquea el cofre diario', await p2.evaluate(() => AAP.backend.dailyAvailable() === false && AAP.backend.claimDaily().then(() => false, () => true)));
await ctx2.close();

console.log('21. Consola'); check('sin errores en consola', errors.length === 0, errors.join(' | '));
await browser.close(); process.exit(summary() ? 1 : 0);

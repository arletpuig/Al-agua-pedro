// Prueba completa del juego como invitado (guardado local). Ejecutar con el juego servido en http://localhost:8080:
//   node tests/game.test.mjs
import { launch, devices, check, summary, watchErrors, mockTime, open, tap, S, stopAt, idle, give, madrid, noCombo } from './helpers.mjs';
const browser = await launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage(); const errors = watchErrors(page); await mockTime(page);
const txt = s => page.locator(s).innerText();
const disabled = n => page.locator(`#throws button[data-n="${n}"]`).isDisabled();
// lanza ×n con su ficha; si con tantos tomates esa ficha ya no se ofrece, se lanza directamente
const throwN = async n => { if (await page.locator(`#throws button[data-n="${n}"]`).count()) await page.click(`#throws button[data-n="${n}"]`); else await page.evaluate(n => { import('./js/play.js').then(m => m.throwTomatoes(n)); }, n); };
const shot = n => page.screenshot({ path: `tests/out/${n}.png` });

console.log('1. Carga y regalo de bienvenida'); await open(page);
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
check('los primeros lanzamientos van más despacio', await page.evaluate(() => AAP.scene.aim.speed < 300));
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

console.log('18. Anuncios no integrados');
await page.click('#tabs [data-panel="shop"]'); await page.waitForTimeout(300); await shot('06-tienda');
check('botones de vídeo desactivados y "PRONTO"', await page.locator('#btn-falcon').isDisabled() && await page.locator('#btn-sobre').isDisabled() && (await txt('#btn-falcon')).includes('PRONTO'));
before = await S(page);
const adErr = await page.evaluate(async () => { const out = []; for (const p of ['falcon', 'sobre']) { try { await AAP.backend.watchAd(p); out.push('CONCEDIDO'); } catch (e) { out.push(e.message); } } return out; });
s = await S(page);
check('los anuncios no conceden recompensas', adErr.every(m => m.includes('no están disponibles')) && s.pesetas === before.pesetas && s.falcon === 0, adErr[0]);
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
check('desbloquear cuesta más cuanto más rara', await page.evaluate(() => { const E = AAP.E; return E.unlockNeed('inflacion') < E.unlockNeed('joyas') && E.unlockNeed('joyas') < E.unlockNeed('mariscada') && E.unlockNeed('mariscada') < E.unlockNeed('amnistia'); }));
check('sin desbloquear da 1 fragmento; al llegar se desbloquea; luego da varios', await page.evaluate(() => {
  const E = AAP.E, c = E.emptyCards(), need = E.unlockNeed('mariscada'); let unlocked = 0;
  for (let i = 0; i < need; i++) { const r = [{ id: 'mariscada' }]; E.applyChestCards(c, r); if (r[0].isNew) unlocked++; if (i < need - 1 && (r[0].frags !== 1 || !r[0].locked)) return false; }
  const r = [{ id: 'mariscada' }]; E.applyChestCards(c, r);
  return unlocked === 1 && c.mariscada.level === 1 && r[0].frags === E.RARITIES.epic.drop && r[0].frags > 1;
}));
console.log('16, 17. Cartas y potenciadores');
await give(page, { cards: { inflacion: { level: 1, frags: 6 }, mariscada: { level: 1, frags: 3 }, joyas: { level: 1, frags: 0 }, apagon: { level: 1, frags: 0 }, amnistia: { level: 1, frags: 0 } } });
await page.click('#tabs [data-panel="cards"]'); await page.waitForTimeout(300); await shot('10-cartas');
check('la colección muestra las 5 cartas', await page.locator('#cards-grid .card').count() === 5);
before = await S(page);
const cost = await page.evaluate(() => AAP.E.upgradeCost('inflacion', 1, AAP.state.cards));
await page.click('[data-upgrade="inflacion"]'); await page.waitForTimeout(300); s = await S(page);
check('mejorar Inflación descuenta el precio exacto y los fragmentos', s.pesetas === before.pesetas - cost && s.cards.inflacion.level === 2 && s.cards.inflacion.frags === 6 - 3, `(coste ${cost})`);
check('no se puede mejorar sin fragmentos', await page.locator('[data-upgrade="joyas"]').isDisabled());
const base = await page.evaluate(() => AAP.E.upgradeCost('inflacion', 2, { mariscada: { level: 0 } }));
await page.click('[data-upgrade="mariscada"]'); await page.waitForTimeout(300); s = await S(page);
const disc = await page.evaluate(() => AAP.E.upgradeCost('inflacion', 2, AAP.state.cards));
check('Mariscada Sindical abarata las mejoras', s.cards.mariscada.level === 2 && disc < base && disc >= 1, `(${base} → ${disc})`);
check('Mariscada: cada nivel descuenta menos y nunca pasa del 40%', await page.evaluate(() => { const v = AAP.E.CARDS.mariscada.value; return v(2) - v(1) > v(25) - v(24) && v(25) < 0.40 && v(100) <= 0.40 && AAP.E.upgradeCost('inflacion', 1, { mariscada: { level: 25 } }) >= 1; }));
await page.click('#panel-cards [data-close]');
before = await S(page); await tap(page, 10); s = await S(page);
check('Inflación nivel 2: 3 clics por pulsación', s.totalClicks === before.totalClicks + 30 && (await txt('#cpt-badge')).includes('+3'));
check('Joyas de Zapatero: 2 o 3 pesetas, y cada nivel da menos', await page.evaluate(() => { const E = AAP.E, c = { joyas: { level: 10 } }, p = E.CARDS.joyas.value(10), v = E.CARDS.joyas.value; return E.rollFallPesetas(c, () => p / 6) === 3 && E.rollFallPesetas(c, () => p / 2) === 2 && E.rollFallPesetas(c, () => 0.99) === 1 && E.rollFallPesetas({ joyas: { level: 0 } }, () => 0) === 1 && v(2) - v(1) > v(25) - v(24) && v(25) < 0.45; }));
check('muchos más niveles de mejora', await page.evaluate(() => { const C = AAP.E.CARDS; return C.inflacion.max === 30 && C.joyas.max === 25 && C.mariscada.max === 25 && C.apagon.max === 25 && C.amnistia.max === 20; }));
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

console.log('20. Persistencia'); before = await S(page);
await page.reload(); await page.waitForFunction(() => window.AAP?.scene?.ready); await page.waitForTimeout(500); s = await S(page);
check('clics, tomates, pesetas, estadísticas y cartas persisten', JSON.stringify(s) === JSON.stringify(before));
await page.click('#btn-settings'); await page.waitForTimeout(300); await page.click('#btn-stats'); await page.waitForTimeout(300); await shot('11-estadisticas');
check('panel de estadísticas completo', /Tomates conseguidos/.test(await txt('#stats-list')) && /Pedro al agua/.test(await txt('#stats-list')) && /Inflación/.test(await txt('#stats-list')));
await page.click('#panel-stats [data-close]');
await page.click('#btn-settings'); await page.waitForTimeout(300);
const snd = async () => page.evaluate(() => [AAP.state.sound, AAP.state.music, document.querySelector('#sw-sound').classList.contains('on'), document.querySelector('#sw-music').classList.contains('on')].join());
await page.click('#btn-sound'); const m1 = await snd(); await page.click('#btn-music'); const m2 = await snd(); await page.click('#btn-music'); const m3 = await snd();
check('sonido: silencio, música opcional y vuelta a solo efectos', m1 === 'false,false,false,false' && m2 === 'true,true,true,true' && m3 === 'true,false,true,false', [m1, m2, m3].join(' | '));
await page.click('#panel-settings [data-close]');

console.log('14. Cofre diario y reloj del dispositivo');
const ctx2 = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, storageState: await ctx.storageState() });
await ctx2.addInitScript(() => { const real = Date.now; Date.now = () => real() + 2 * 86400e3; });   // el jugador adelanta el reloj 2 días
const p2 = await ctx2.newPage(); await mockTime(p2); await open(p2); await p2.waitForTimeout(600);
check('adelantar el reloj no desbloquea el cofre diario', await p2.evaluate(() => AAP.backend.dailyAvailable() === false && AAP.backend.claimDaily().then(() => false, () => true)));
await ctx2.close();

console.log('21. Consola'); check('sin errores en consola', errors.length === 0, errors.join(' | '));
await browser.close(); process.exit(summary() ? 1 : 0);

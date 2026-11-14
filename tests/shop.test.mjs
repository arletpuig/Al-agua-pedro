// Prueba de La Trastienda (puesto de Abascal y los seis objetos). Con el juego servido en http://localhost:8080:
//   node tests/shop.test.mjs
import { launch, devices, check, summary, watchErrors, mockTime, open } from './helpers.mjs';
const browser = await launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
const page = await ctx.newPage(); const errors = watchErrors(page); await mockTime(page);
const shot = n => page.screenshot({ path: `tests/out/shop-${n}.png` });
const give = (falls, pesetas) => page.evaluate(async ([f, p]) => { AAP.state.stats.falls = f; AAP.state.stats.pesetasEarned = p; (await import('./js/state.js')).changed(false); }, [falls, pesetas]);
const inShop = () => page.evaluate(() => document.body.classList.contains('in-shop') && AAP.shop.scene.isActive());

console.log('1. Puerta cerrada al principio'); await open(page);
await page.evaluate(() => { AAP.Shop.resetShop(); document.querySelectorAll('.panel.open').forEach(p => p.classList.remove('open')); });
check('la puerta se ve y está cerrada', await page.locator('#btn-trastienda.locked').isVisible());
check('muestra el progreso de caídas', (await page.locator('#door-prog').innerText()).includes('0/300'));
await page.click('#btn-trastienda'); await page.waitForTimeout(400);
check('cerrada: no se entra', !(await inShop()));

console.log('2. Se abre tras 300 caídas'); await give(300, 0); await page.waitForTimeout(200);
check('puerta abierta', !(await page.locator('#btn-trastienda').evaluate(e => e.classList.contains('locked'))));
await page.click('#btn-trastienda'); await page.waitForFunction(() => AAP.shop.ready && AAP.shop.scene.isActive(), null, { timeout: 15000 }); await page.waitForTimeout(900);
check('dentro del puesto', await inShop()); await shot('01-puesto');
check('la feria duerme mientras', await page.evaluate(() => AAP.scene.scene.isSleeping()));
check('mandos de la feria ocultos', !(await page.locator('#btn-click').isVisible()) && await page.locator('#sd-back').isVisible());
check('seis objetos en el puesto y en la fila', await page.evaluate(() => Object.keys(AAP.shop.items).length) === 6 && await page.locator('#sd-thumbs button').count() === 6);

console.log('3. Seleccionar y comprar');
await page.click('#sd-thumbs button[data-item="besugo"]'); await page.waitForTimeout(700);
check('ficha del objeto', (await page.locator('#sd-name').innerText()) === 'El Besugo');
check('sin pesetas: botón indica lo que falta', (await page.locator('#sd-buy').innerText()).startsWith('Te faltan 120'));
await page.click('#sd-buy'); await page.waitForTimeout(400);
check('sin pesetas no se compra', !(await page.evaluate(() => AAP.Shop.isOwned('besugo'))));
await give(300, 400); await page.evaluate(() => AAP.ui.renderShopDock('besugo'));
await page.click('#sd-buy'); await page.waitForTimeout(1300); await shot('02-comprado');
check('comprado y guardado', await page.evaluate(() => AAP.Shop.isOwned('besugo') && JSON.parse(localStorage.getItem('alaguapedro.shop.v1')).includes('besugo')));
check('descuenta 120 pesetas', await page.evaluate(() => AAP.state.pesetas) === 280);
check('etiqueta del puesto cambia a ¡TUYO!', await page.evaluate(() => AAP.shop.items.besugo.tagTxt.text) === '¡TUYO!');
await page.click('#sd-thumbs button[data-item="mocion"]'); await page.waitForTimeout(500);
await page.click('#sd-buy'); await page.waitForTimeout(400);
check('la Moción de Censura (pago) no se puede comprar todavía', !(await page.evaluate(() => AAP.Shop.isOwned('mocion'))) && await page.evaluate(() => AAP.state.pesetas) === 280);

console.log('4. Usar un objeto propio y probar uno ajeno');
await page.click('#sd-thumbs button[data-item="besugo"]'); await page.waitForTimeout(400);
await page.click('#sd-buy');                                           // "¡Lánzaselo a Pedro!"
await page.waitForFunction(() => !document.body.classList.contains('in-shop') && AAP.scene.busy, null, { timeout: 10000 });
check('vuelve a la feria y lanza el besugo', true); await page.waitForTimeout(900); await shot('03-besugo');
await page.waitForFunction(() => !AAP.scene.busy, null, { timeout: 30000 });
check('arsenal con el objeto comprado', await page.locator('#arsenal button[data-item="besugo"]').isVisible());
for (const id of ['chancla', 'pollo', 'tarta', 'cubo', 'mocion']) {
  await page.evaluate(id => AAP.useItem(id, true), id);
  await page.waitForTimeout(1500); await shot(`04-${id}`);
  await page.waitForFunction(() => !AAP.scene.busy, null, { timeout: 40000 }); await page.waitForTimeout(300);
  await page.waitForFunction(() => AAP.scene.pedro.list.length === 12, null, { timeout: 8000 }).catch(() => {});   // la marca de la chancla se desvanece sola
  const st = await page.evaluate(() => { const P = AAP.scene.pedro; return { x: P.x, y: P.y, a: P.alpha, ang: P.angle, idle: !!P.idleTweens, extra: P.list.length, chair: AAP.scene.chair.angle }; });
  check(`prueba de ${id}: Pedro vuelve a su sitio`, Math.abs(st.x - 246) < 1 && Math.abs(st.y - 400) < 1 && st.a === 1 && Math.abs(st.ang) <= 1 && st.idle && st.chair === 0, JSON.stringify(st));
  check(`prueba de ${id}: no se queda nada pegado a la cara`, st.extra === 12, `(capas ${st.extra})`);
}
check('las pruebas no regalan el objeto', !(await page.evaluate(() => AAP.Shop.isOwned('cubo'))));
await page.click('#arsenal button[data-item="besugo"]'); await page.waitForTimeout(200);
check('lanzar desde el arsenal', await page.evaluate(() => AAP.scene.busy));
check('no se lanza tomate mientras tanto', await page.locator('.btn-throw[data-n="1"]').isDisabled().catch(() => true));
await page.waitForFunction(() => !AAP.scene.busy, null, { timeout: 30000 });

console.log('5. Persistencia');
await page.reload(); await page.waitForFunction(() => window.AAP?.scene?.ready);
check('el objeto sigue siendo tuyo tras recargar', await page.evaluate(() => AAP.Shop.isOwned('besugo')));
check('sin errores en consola', errors.length === 0, errors.join(' | '));
await browser.close(); process.exit(summary() ? 1 : 0);

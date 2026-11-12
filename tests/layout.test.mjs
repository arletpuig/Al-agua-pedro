// Comprueba la interfaz en distintos tamaños: nada cortado, nada superpuesto, botones utilizables.  node tests/layout.test.mjs
import { launch, devices, check, summary, watchErrors, mockTime, open } from './helpers.mjs';
const browser = await launch();
const cases = [
  ['iPhone SE vertical', { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true }],
  ['iPhone 13 vertical', { ...devices['iPhone 13'] }],
  ['Android Pixel 7 vertical', { ...devices['Pixel 7'] }],
  ['Android pequeño 360x640', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true }],
  ['iPhone 13 apaisado', { ...devices['iPhone 13 landscape'] }],
  ['Pixel 7 apaisado', { ...devices['Pixel 7 landscape'] }],
  ['iPad Mini vertical', { ...devices['iPad Mini'] }],
  ['iPad Mini apaisado', { ...devices['iPad Mini landscape'] }],
  ['Portátil 1366x768', { viewport: { width: 1366, height: 768 } }],
  ['Escritorio 1920x1080', { viewport: { width: 1920, height: 1080 } }],
];
for (const [name, opts] of cases) {
  const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 1 }); const page = await ctx.newPage(); const errors = watchErrors(page); await mockTime(page); await open(page);
  const r = await page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight, box = s => { const b = document.querySelector(s).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
    const main = { click: box('#dome-wrap'), throw: box('#throw'), daily: box('#btn-daily'), nav: box('#tabs'), top: box('.top') };
    const inside = Object.entries(main).filter(([, b]) => b.l < -1 || b.t < -1 || b.r > vw + 1 || b.b > vh + 1).map(([k]) => k);
    const keys = Object.keys(main), overlaps = [];
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) { const a = main[keys[i]], b = main[keys[j]]; if (a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1) overlaps.push(keys[i] + '×' + keys[j]); }
    const small = [...document.querySelectorAll('#seg button,#btn-launch,#tabs .tab,.sq,#btn-click,#btn-daily')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.width < 28 || b.height < 28); }).length;
    const c = document.querySelector('#game canvas').getBoundingClientRect(), g = document.querySelector('#game').getBoundingClientRect();
    return { inside, overlaps, small, scroll: document.documentElement.scrollHeight > vh + 1 || document.documentElement.scrollWidth > vw + 1, canvasFits: Math.abs(c.width - g.width) < 2 && Math.abs(c.height - g.height) < 2, gameW: Math.round(g.width), vw, vh };
  });
  check(`${name} (${r.vw}x${r.vh}): todo dentro de pantalla, sin desplazamiento`, r.inside.length === 0 && !r.scroll, r.inside.join(','));
  check(`${name}: sin elementos superpuestos`, r.overlaps.length === 0, r.overlaps.join(','));
  check(`${name}: botones de tamaño táctil suficiente`, r.small === 0);
  check(`${name}: el escenario ocupa toda la pantalla de juego (${r.gameW}px)`, r.canvasFits && r.gameW >= 300);
  // el panel de cartas y el de cofres caben y se pueden cerrar
  await page.click('#tabs [data-panel="cards"]'); await page.waitForTimeout(250);
  const okPanel = await page.evaluate(() => { const b = document.querySelector('#panel-cards .sheet').getBoundingClientRect(), x = document.querySelector('#panel-cards .close').getBoundingClientRect(); return b.bottom <= innerHeight + 1 && b.right <= innerWidth + 1 && x.top >= 0 && x.right <= innerWidth; });
  await page.screenshot({ path: `tests/out/layout-${name.replace(/[^a-z0-9]+/gi, '-')}-cartas.png` });
  await page.click('#panel-cards .close'); await page.waitForTimeout(150);
  check(`${name}: panel de cartas visible y con cierre accesible`, okPanel);
  await page.screenshot({ path: `tests/out/layout-${name.replace(/[^a-z0-9]+/gi, '-')}.png` });
  check(`${name}: sin errores de consola`, errors.length === 0, errors.join('|'));
  await ctx.close();
}
await browser.close(); process.exit(summary() ? 1 : 0);

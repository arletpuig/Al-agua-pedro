// Utilidades comunes de las pruebas Playwright.
import { createRequire } from 'node:module';
export const { chromium, devices } = createRequire(import.meta.url)('playwright');
export const URL = process.env.GAME_URL || 'http://localhost:8080/?debug';
export const SB = 'https://xfsvruccotcymcvxzymy.supabase.co/**';
export const launch = () => chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
let pass = 0, failN = 0;
export function check(name, cond, detail = '') { if (cond) { pass++; console.log('  ✓', name, detail); } else { failN++; console.log('  ✗ FALLA:', name, detail); } }
export function summary() { console.log(`\n${pass} comprobaciones correctas, ${failN} fallidas`); return failN; }
export function watchErrors(page) {
  const errors = []; page.__errors = errors;
  page.on('console', m => { if (m.type() === 'error' && !/GL Driver|GPU stall/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  return errors;
}
// Supabase simulado mínimo para invitados: solo la hora del servidor.
export async function mockTime(page, nowFn = () => new Date()) {
  await page.route(SB, route => {
    const p = new URL_(route.request().url()).pathname;
    if (p.endsWith('/rpc/server_now')) { const now = nowFn(), d = madrid(now); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ date: d, now: now.toISOString(), next_midnight: new Date(now.getTime() + 6 * 3600e3).toISOString() }) }); }
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"no route"}' });
  });
}
const URL_ = globalThis.URL;
export const madrid = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
export async function open(page) { await page.goto(URL); await page.waitForFunction(() => window.AAP?.scene?.ready && document.querySelector('#loading.off'), null, { timeout: 20000 }); await page.waitForTimeout(300); }
export const tap = (page, n) => page.evaluate(n => { const b = document.querySelector('#btn-click'); for (let i = 0; i < n; i++) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 500 })); }, n);
export const S = page => page.evaluate(() => ({ ...AAP.state.stats, clicks: AAP.state.clicks, tomatoes: AAP.state.tomatoes, pesetas: AAP.state.pesetas, cards: JSON.parse(JSON.stringify(AAP.state.cards)), daily: AAP.state.dailyClaimedOn, falcon: AAP.state.falconUntil }));
// Espera a que el tomate esté apuntando y lo detiene cuando su distancia horizontal al centro de la diana (x = 880) está en [lo, hi].
// side: 'L' solo a la izquierda del centro, 'R' solo a la derecha (por defecto, cualquiera).
export const stopAt = (page, lo, hi, side = '') => page.evaluate(([lo, hi, side]) => new Promise(res => {
  const sc = AAP.scene, f = () => { const a = sc.aim; if (a) { const dx = a.x - 880, d = Math.abs(dx); if (d >= lo && d <= hi && (!side || (side === 'L' ? dx < 0 : dx > 0))) { sc.stopAim(); return res(d); } } requestAnimationFrame(f); }; f();
}), [lo, hi, side]);
// la racha de pulsaciones se desactiva en las pruebas que cuentan clics exactos
export const noCombo = page => page.evaluate(() => import('./js/config.js').then(m => { m.CONFIG.COMBO.perTap = 0; }));
export async function idle(page) {
  try { await page.waitForFunction(() => !AAP.scene.busy && !AAP.scene.aim && !document.querySelector('#btn-click').classList.contains('aim'), null, { timeout: 60000 }); }
  catch (e) { console.log('  estado al agotar la espera:', await page.evaluate(() => ({ busy: AAP.scene.busy, aim: !!AAP.scene.aim, stop: !!document.querySelector('#btn-click').classList.contains('aim'), pose: AAP.scene.pose, clip: AAP.scene.clipName, tweens: AAP.scene.tw.length, panels: [...document.querySelectorAll('.panel.open,.overlay.open')].map(p => p.id), tomatoes: AAP.state.tomatoes })), 'errores:', page.__errors); throw e; }
  await page.waitForTimeout(250);
}
export const give = (page, o) => page.evaluate(o => { const s = AAP.state; if (o.pesetas) s.stats.pesetasEarned += o.pesetas; if (o.tomatoes) s.stats.chestTomatoes += o.tomatoes; if (o.cards) Object.assign(s.cards, o.cards); import('./js/state.js').then(m => m.changed(false)); }, o).then(() => page.waitForTimeout(100));

// Convierte los SVG de assets/pedro y assets/img a PNG al doble de tamaño (assets/png). Ejecutar: node tests/rasterize.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
const browser = await chromium.launch(); const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const dir of ['assets/pedro', 'assets/img']) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.svg'))) {
  const svg = fs.readFileSync(`${dir}/${f}`, 'utf8'); const [, w, h] = /width="(\d+)" height="(\d+)"/.exec(svg);
  await page.setContent(`<html><body style="margin:0;background:transparent"><img id="i" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${w * 2}" height="${h * 2}"></body></html>`);
  await page.locator('#i').screenshot({ path: `assets/png/${f.replace('.svg', '.png')}`, omitBackground: true });
}
await browser.close(); console.log('ok');

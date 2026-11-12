// Genera las imágenes del juego en alta resolución (.build/hi) a partir de:
//  - assets/src/pedro-ref.png  (ilustración de referencia de Pedro): cabeza con 5 expresiones + busto
//  - assets/parts/*.svg y assets/img/*.svg (piezas vectoriales)
// Después ejecutar: python3 tools/build-atlas.py     (crea assets/atlas.png y assets/atlas.json)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = '.build/hi'; fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(); const page = await browser.newPage({ deviceScaleFactor: 1 });
async function shot(name, svg) {
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await page.locator('#o').screenshot({ path: `${OUT}/${name}.png`, omitBackground: true });
}
// ---------- piezas vectoriales: 4 px por unidad (el atlas las reduce a la mitad) ----------
for (const dir of ['assets/parts', 'assets/img']) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.svg'))) {
  const svg = fs.readFileSync(`${dir}/${f}`, 'utf8'); const [, w, h] = /width="([\d.]+)" height="([\d.]+)"/.exec(svg);
  await shot(f.replace('.svg', ''), `<img id="o" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" width="${w * 4}" height="${h * 4}">`);
}
// ---------- Pedro: composición sobre la ilustración de referencia (coordenadas de la imagen original, 1312x1199) ----------
const REF = 'data:image/png;base64,' + fs.readFileSync('assets/src/pedro-ref.png').toString('base64');
const S = 0.8;                                   // 0.8 px por px de referencia (el atlas lo deja en 0.4)
const HEAD_BOX = [350, 15, 600, 800], BUST_BOX = [50, 690, 1175, 500];
// contorno inferior de la cabeza (sigue la mandíbula por fuera de la línea negra)
const HEAD_POLY = '0,0 1312,0 1312,600 894,634 859,680 835,740 810,794 764,808 680,804 600,772 468,722 445,678 443,596 0,596';
const SK = '#fdb17c', SKR = '#f29a67', INK = '#0a0605', BROW = '#221816';
const img = `<image href="${REF}" x="0" y="0" width="1312" height="1199"/>`;
const defs = `<defs><clipPath id="hc"><polygon points="${HEAD_POLY}"/></clipPath>
  <filter id="b4" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter><filter id="b6" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter></defs>`;
const wrap = (box, inner) => `<svg id="o" xmlns="http://www.w3.org/2000/svg" width="${box[2] * S}" height="${box[3] * S}" viewBox="${box.join(' ')}">${defs}${inner}</svg>`;
// parches de piel que tapan rasgos originales
const P = {
  eyes: `<ellipse cx="638" cy="436" rx="70" ry="34" fill="${SK}" filter="url(#b4)"/><ellipse cx="838" cy="452" rx="53" ry="31" fill="${SKR}" filter="url(#b4)"/>`,
  mouth: `<path d="M590,588 Q720,640 846,616" stroke="${SK}" stroke-width="72" fill="none" stroke-linecap="round" filter="url(#b6)"/><path d="M690,660 Q750,672 810,660" stroke="${SK}" stroke-width="30" fill="none" stroke-linecap="round" filter="url(#b6)"/>`,
  brows: `<path d="M552,392 L612,354 L744,408" stroke="${SK}" stroke-width="56" fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#b4)"/><path d="M818,408 L884,386" stroke="${SK}" stroke-width="52" fill="none" stroke-linecap="round" filter="url(#b4)"/>`,
};
const pupil = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#3a2216" stroke="${INK}" stroke-width="5"/><circle cx="${x - r * .35}" cy="${y - r * .35}" r="${r * .3}" fill="#fff"/>`;
const HEADS = {
  head: '',
  headBlink: P.eyes + `<path d="M580,440 Q640,464 698,450 M582,440 l-10,-6 M600,452 l-7,9 M790,458 Q838,476 884,464 M884,464 l10,-5 M868,470 l6,9" stroke="${INK}" stroke-width="8" fill="none" stroke-linecap="round"/>`,
  headLaugh: P.eyes + `<path d="M580,450 Q640,402 700,448 M790,464 Q840,422 886,462" stroke="${INK}" stroke-width="9" fill="none" stroke-linecap="round"/>
    <path d="M586,584 Q715,630 846,602 Q856,702 732,724 Q606,716 586,584Z" fill="#6e1220" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>
    <path d="M604,596 Q716,636 832,610 L828,634 Q716,662 612,628Z" fill="#fff" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M664,700 Q730,664 800,694 Q770,716 732,718 Q694,716 664,700Z" fill="#f26a72" stroke="${INK}" stroke-width="4"/>`,
  headShock: P.brows + P.mouth + `<ellipse cx="640" cy="434" rx="58" ry="38" fill="#fff" stroke="${INK}" stroke-width="8"/><ellipse cx="840" cy="450" rx="46" ry="32" fill="#fff" stroke="${INK}" stroke-width="8"/>${pupil(650, 438, 15)}${pupil(846, 452, 13)}
    <path d="M548,356 Q640,298 742,358 L738,384 Q640,330 556,382Z" fill="${BROW}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M806,378 Q850,334 896,352 L897,378 Q850,362 812,402Z" fill="${BROW}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <ellipse cx="724" cy="652" rx="50" ry="58" fill="#5a0f18" stroke="${INK}" stroke-width="9"/><ellipse cx="724" cy="688" rx="28" ry="16" fill="#f26a72"/>`,
  headAngry: P.brows + P.mouth + `<path d="M545,384 L602,360 L756,420 L750,448 L598,400 L556,406Z" fill="${BROW}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M802,416 L892,366 L899,394 L808,446Z" fill="${BROW}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M606,646 Q720,586 838,646 Q842,676 724,672 Q604,680 606,646Z" fill="#fff" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>
    <path d="M610,650 Q720,626 834,650 M660,618 v52 M720,606 v64 M780,616 v54" stroke="${INK}" stroke-width="4" fill="none"/>
    <ellipse cx="545" cy="560" rx="38" ry="20" fill="#ef4b4b" opacity=".45" filter="url(#b6)"/><ellipse cx="868" cy="575" rx="24" ry="18" fill="#ef4b4b" opacity=".4" filter="url(#b6)"/>`,
};
for (const [name, extra] of Object.entries(HEADS)) await shot(name, wrap(HEAD_BOX, `<g clip-path="url(#hc)">${img}${extra}</g>`));
// busto: todo lo que queda bajo la mandíbula, con relleno de cuello detrás de la cabeza para que no se vean huecos al girarla
await shot('bust', wrap(BUST_BOX, `<polygon points="486,718 495,782 680,882 745,806 836,690 836,640 486,640" fill="#c5633f"/>
  <path clip-rule="evenodd" fill-rule="evenodd" d="M0,0" /><g clip-path="url(#bc)">${img}</g>
  <defs><clipPath id="bc"><path clip-rule="evenodd" d="M0,0 H1312 V1199 H0Z M${HEAD_POLY.split(' ').join(' L')}Z"/></clipPath></defs>`));
// fondo del escenario a 1440x1920 (el atlas builder lo convierte a JPG)
await page.setViewportSize({ width: 1440, height: 1920 });
await shot('../bg', `<img id="o" src="data:image/svg+xml;base64,${fs.readFileSync('assets/src/bg.svg').toString('base64')}" width="1440" height="1920">`);
await browser.close(); console.log('render ok ->', OUT, fs.readdirSync(OUT).length, 'imágenes');

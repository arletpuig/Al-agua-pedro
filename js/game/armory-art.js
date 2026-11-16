// La Armería: ilustraciones de los objetos (SVG con degradados, brillos y sombreado; contorno grueso como el resto del juego).
// Se convierten en imágenes una sola vez y se dibujan en el lienzo (escenario) y en la tienda. Cada pieza tiene su punto de anclaje (ax, ay).
const K = '#0a0b18', SW = 9;
const P = (w, h, ax, ay, defs, body) => ({ w, h, ax, ay, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 2}" height="${h * 2}"><defs>${defs}</defs><g stroke="${K}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>` });
const lg = (id, x1, y1, x2, y2, stops) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
const rg = (id, cx, cy, r, stops, fx = cx, fy = cy) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" fx="${fx}" fy="${fy}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;
const GOLD = lg('gold', 0, 0, 0, 1, [[0, '#fff3b0'], [0.35, '#ffd23f'], [0.7, '#e09a12'], [1, '#8a5200']]);
const CHROME = lg('chrome', 0, 0, 1, 0, [[0, '#5a6478'], [0.18, '#e9eef6'], [0.32, '#ffffff'], [0.5, '#9aa6b8'], [0.8, '#c9d2e0'], [1, '#4a5466']]);
const hl = (x, y, w, h, r = h / 2, o = 0.7) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#fff" opacity="${o}" stroke="none"/>`;

export const ART = {
  // ---------------- martillo de goma: mango (anclado en el extremo) y cabeza (anclada en su centro)
  hammerHandle: P(80, 360, 40, 350, GOLD + lg('wood', 0, 0, 1, 0, [[0, '#8a4f22'], [0.3, '#e7ad6a'], [0.55, '#c98547'], [1, '#6e3a16']]) + lg('grip', 0, 0, 1, 0, [[0, '#2a0806'], [0.4, '#7a2014'], [1, '#2a0806']]), `
    <rect x="22" y="20" width="36" height="300" rx="16" fill="url(#wood)"/>
    <path d="M32 40 C36 90 30 140 34 190 M46 60 C50 110 44 160 48 210" stroke="#7a4218" stroke-width="3" opacity=".6" fill="none"/>
    <rect x="18" y="200" width="44" height="120" rx="14" fill="url(#grip)"/>
    <path d="M20 214 L60 234 M20 244 L60 264 M20 274 L60 294 M20 304 L58 318" stroke="#c45a3a" stroke-width="4" opacity=".8"/>
    <rect x="14" y="318" width="52" height="30" rx="12" fill="url(#gold)"/>${hl(22, 324, 18, 6, 3, 0.8)}
    <rect x="12" y="6" width="56" height="30" rx="10" fill="url(#gold)"/>${hl(20, 11, 30, 6, 3, 0.8)}`),
  hammerHead: P(420, 190, 210, 95, lg('rub', 0, 0, 0, 1, [[0, '#ff9a8a'], [0.25, '#ff4a3a'], [0.62, '#d0141c'], [1, '#6a060c']]) + rg('cap', 0.4, 0.35, 0.7, [[0, '#ff6a5a'], [0.6, '#b10f17'], [1, '#5a0408']]) + GOLD, `
    <rect x="40" y="16" width="340" height="158" rx="58" fill="url(#rub)"/>
    <path d="M70 150 C160 166 260 166 352 150" stroke="#ff8a7a" stroke-width="5" fill="none" opacity=".55"/>
    ${hl(78, 32, 190, 22, 11, 0.75)}${hl(286, 34, 30, 14, 7, 0.6)}
    <ellipse cx="40" cy="95" rx="30" ry="78" fill="url(#cap)"/><ellipse cx="40" cy="95" rx="14" ry="44" fill="#ff5a48" stroke-width="5"/>
    <ellipse cx="380" cy="95" rx="30" ry="78" fill="url(#cap)"/><ellipse cx="380" cy="95" rx="14" ry="44" fill="#ff5a48" stroke-width="5"/>
    <path d="M210 52 l12 26 28 3 -21 19 6 28 -25 -14 -25 14 6 -28 -21 -19 28 -3z" fill="url(#gold)" stroke-width="6"/>
    <rect x="186" y="164" width="48" height="24" rx="6" fill="url(#gold)" stroke-width="6"/>`),
  // ---------------- chancla (anclada en su centro)
  slipper: P(300, 560, 150, 280, lg('sole', 0, 0, 1, 1, [[0, '#8fd0ff'], [0.4, '#3b8cf0'], [1, '#1a4fb8']]) + lg('side', 0, 0, 0, 1, [[0, '#ffffff'], [1, '#c9d6ea']]) + lg('strapR', 0, 0, 1, 0, [[0, '#a8101a'], [0.5, '#ff4a3a'], [1, '#a8101a']]) + GOLD, `
    <path d="M154 36 C228 34 252 120 244 210 C238 290 250 360 246 430 C242 500 206 532 152 532 C96 532 62 500 60 430 C58 360 66 290 58 210 C50 120 80 38 154 36Z" fill="url(#side)" transform="translate(10 14)"/>
    <path d="M154 36 C228 34 252 120 244 210 C238 290 250 360 246 430 C242 500 206 532 152 532 C96 532 62 500 60 430 C58 360 66 290 58 210 C50 120 80 38 154 36Z" fill="url(#sole)"/>
    <path d="M152 70 C206 70 218 140 212 200 C206 270 214 330 210 400 C206 470 186 496 152 496 C118 496 96 470 94 400 C90 330 98 270 92 200 C86 140 100 70 152 70Z" fill="#2563c9" stroke="none" opacity=".55"/>
    <g fill="#bfe4ff" stroke="none" opacity=".55">${Array.from({ length: 18 }, (_, i) => `<circle cx="${112 + (i % 3) * 40}" cy="${250 + Math.floor(i / 3) * 40}" r="5"/>`).join('')}</g>
    ${hl(84, 90, 16, 120, 8, 0.5)}
    <path d="M70 250 C110 170 140 120 152 90 C164 120 194 170 234 250" fill="none" stroke-width="40"/>
    <path d="M70 250 C110 170 140 120 152 90 C164 120 194 170 234 250" fill="none" stroke="url(#strapR)" stroke-width="24"/>
    <path d="M78 240 C114 172 142 126 152 100 C162 126 190 172 226 240" fill="none" stroke="#ffc400" stroke-width="7"/>
    <circle cx="152" cy="92" r="18" fill="url(#gold)" stroke-width="6"/>${hl(142, 82, 10, 6, 3, 0.9)}`),
  // ---------------- oca: cuerpo (anclado entre las patas), ala (anclada en el hombro), cabeza con cuello (anclada en la base del cuello)
  gooseBody: P(420, 300, 220, 240, lg('gw', 0, 0, 0, 1, [[0, '#ffffff'], [0.55, '#eef3f9'], [1, '#a9b8cc']]) + lg('tail', 0, 0, 1, 0, [[0, '#c9d4e2'], [1, '#ffffff']]), `
    <path d="M70 110 L14 70 L40 120 L4 126 L48 150 L30 176 L86 168Z" fill="url(#tail)"/>
    <path d="M60 150 C60 70 170 50 270 66 C350 78 400 120 396 168 C392 230 320 262 220 262 C120 262 60 222 60 150Z" fill="url(#gw)"/>
    <path d="M110 230 C170 250 270 252 340 222" fill="none" stroke="#c9d4e2" stroke-width="5" opacity=".9"/>
    ${hl(250, 84, 90, 16, 8, 0.8)}`),
  gooseWing: P(260, 160, 230, 30, lg('wg', 0, 0, 0, 1, [[0, '#ffffff'], [1, '#c3cfdf']]) + lg('wt', 0, 0, 1, 0, [[0, '#7d8aa0'], [1, '#c3cfdf']]), `
    <path d="M236 26 C160 10 60 30 18 92 C70 96 110 90 140 80 C120 110 80 128 60 144 C130 146 200 110 236 26Z" fill="url(#wg)"/>
    <path d="M30 92 C64 96 100 92 132 82 M70 136 C120 126 160 104 196 70" fill="none" stroke-width="5"/>
    <path d="M18 92 C40 94 50 90 60 86 L44 70 Z M60 144 C74 140 88 134 98 128 L82 116Z" fill="url(#wt)" stroke-width="5"/>`),
  gooseHead: P(260, 320, 50, 300, lg('nk', 0, 0, 1, 0, [[0, '#c9d4e2'], [0.5, '#ffffff'], [1, '#dfe7f2']]) + lg('bk', 0, 0, 0, 1, [[0, '#ffc04a'], [1, '#e86a00']]), `
    <path d="M30 300 C20 220 70 190 70 130 C70 90 60 70 80 52 C104 30 150 34 162 62 C172 86 160 104 130 110 C108 116 112 150 110 190 C108 240 90 280 84 300Z" fill="url(#nk)"/>
    <path d="M150 56 L244 72 L160 98Z" fill="url(#bk)"/><path d="M196 66 l14 3" stroke-width="5"/>
    <ellipse cx="124" cy="66" rx="14" ry="16" fill="#fff" stroke-width="6"/><circle cx="128" cy="68" r="8" fill="${K}" stroke="none"/><circle cx="131" cy="64" r="3" fill="#fff" stroke="none"/>
    <path d="M100 42 L148 56" stroke-width="10"/>${hl(84, 140, 10, 70, 5, 0.6)}`),
  gooseHeadOpen: P(260, 320, 50, 300, lg('nk2', 0, 0, 1, 0, [[0, '#c9d4e2'], [0.5, '#ffffff'], [1, '#dfe7f2']]) + lg('bk2', 0, 0, 0, 1, [[0, '#ffc04a'], [1, '#e86a00']]), `
    <path d="M30 300 C20 220 70 190 70 130 C70 90 60 70 80 52 C104 30 150 34 162 62 C172 86 160 104 130 110 C108 116 112 150 110 190 C108 240 90 280 84 300Z" fill="url(#nk2)"/>
    <path d="M152 70 L238 108 L156 96Z" fill="#ff7a9a"/>
    <path d="M150 50 L248 40 L158 74Z" fill="url(#bk2)"/><path d="M154 92 L236 118 L160 104Z" fill="url(#bk2)"/>
    <path d="M176 50 l8 10 8 -11 8 10 8 -11 8 9 M180 104 l8 -8 8 10 8 -8 8 10" fill="none" stroke="#fff" stroke-width="5"/>
    <ellipse cx="124" cy="66" rx="14" ry="16" fill="#fff" stroke-width="6"/><circle cx="128" cy="68" r="8" fill="${K}" stroke="none"/><circle cx="131" cy="64" r="3" fill="#fff" stroke="none"/>
    <path d="M100 40 L150 54" stroke-width="10"/>${hl(84, 140, 10, 70, 5, 0.6)}`),
  // ---------------- toro de lidia: cuerpo y cabeza (anclado en el suelo, bajo el centro) y una pata (anclada en la cadera)
  bull: P(740, 460, 330, 450, rg('hide', 0.55, 0.25, 0.85, [[0, '#5a4e66'], [0.45, '#241c2c'], [1, '#07050a']]) + lg('horn', 0, 1, 1, 0, [[0, '#3a2a1a'], [0.25, '#d9c497'], [0.6, '#fff8e6'], [1, '#2a1a0a']]) + lg('rimB', 0, 0, 0, 1, [[0, '#9cc0ff', 0.9], [1, '#9cc0ff', 0]]) + GOLD, `<g transform="translate(0 40)">
    <path d="M86 196 C60 210 44 250 52 300" fill="none" stroke-width="11"/><path d="M52 300 c-14 8 -10 30 6 30 c16 0 18 -18 6 -30z" fill="#2a2230" stroke-width="6"/>
    <path d="M80 200 C80 150 130 120 200 118 C260 116 300 70 380 60 C450 52 500 90 512 150 C520 220 500 282 450 300 C380 322 250 320 160 312 C100 306 80 262 80 200Z" fill="url(#hide)"/>
    <path d="M120 290 C200 312 330 316 440 296 C470 286 490 262 500 236 C470 270 420 286 330 290 C240 294 170 290 120 290Z" fill="#000" stroke="none" opacity=".4"/>
    <path d="M140 126 C200 118 260 112 300 80 C330 62 370 56 400 58" fill="none" stroke="url(#rimB)" stroke-width="14"/>
    <path d="M210 160 C230 210 220 260 200 300 M330 120 C360 170 370 230 352 290 M420 110 C450 140 460 190 450 230" fill="none" stroke="#5a4e6a" stroke-width="5" opacity=".9"/>
    <g stroke-width="5"><path d="M352 66 L318 -6" stroke="#f4e3c0" stroke-width="9"/><path d="M318 -6 l-36 14 30 10 -26 18 34 -6 z" fill="#ffc400"/><path d="M396 60 L378 -14" stroke="#f4e3c0" stroke-width="9"/><path d="M378 -14 l-34 22 32 2 -18 24 30 -14z" fill="#e3262c"/></g>
    <path d="M480 150 C540 128 612 160 626 222 C640 284 612 324 570 326 C528 328 498 302 486 262 C476 228 472 190 480 150Z" fill="url(#hide)"/>
    <path d="M600 186 C626 128 670 94 732 98 C692 112 654 144 628 196Z" fill="url(#horn)"/>
    <path d="M516 170 C490 110 512 58 584 34 C560 70 554 112 552 168Z" fill="url(#horn)"/>
    <path d="M530 200 L590 214" stroke-width="12"/>
    <ellipse cx="566" cy="232" rx="20" ry="15" fill="#ff2a1a" stroke-width="6"/><circle cx="572" cy="229" r="6" fill="#ffe0a0" stroke="none"/>
    <ellipse cx="606" cy="300" rx="38" ry="27" fill="#3e3348"/><ellipse cx="594" cy="298" rx="7" ry="10" fill="${K}" stroke="none"/><ellipse cx="620" cy="298" rx="7" ry="10" fill="${K}" stroke="none"/>
    <path d="M590 322 a18 18 0 0 0 34 0" fill="none" stroke="url(#gold)" stroke-width="9"/>
    ${hl(220, 132, 90, 14, 7, 0.22)}</g>`),
  bullLeg: P(90, 220, 45, 14, lg('leg', 0, 0, 1, 0, [[0, '#07050a'], [0.45, '#3a3044'], [1, '#07050a']]), `
    <path d="M18 10 C10 60 26 110 26 150 L24 190 L66 190 L64 150 C66 110 80 60 72 10Z" fill="url(#leg)"/>
    <path d="M18 188 L72 188 L76 214 L14 214Z" fill="#6a5a48"/>`),
  // ---------------- aspiradora monstruosa (mira a la izquierda; anclada en el suelo) y su boquilla (anclada en la manguera)
  vacuum: P(480, 380, 250, 368, lg('vr', 0, 0, 0, 1, [[0, '#ff8a7a'], [0.18, '#ff3b2f'], [0.6, '#b3101a'], [1, '#5a0408']]) + CHROME + rg('eye', 0.5, 0.45, 0.6, [[0, '#ffffb0'], [0.5, '#ffd23f'], [1, '#ff8a1a']]) + rg('tire', 0.5, 0.5, 0.5, [[0, '#4a5466'], [1, '#14161c']]), `
    <rect x="120" y="20" width="240" height="40" rx="18" fill="url(#chrome)"/>
    <path d="M60 300 C40 230 50 120 120 70 C180 30 300 30 360 70 C430 120 440 230 420 300Z" fill="url(#vr)"/>
    <path d="M90 120 C150 80 330 80 390 120" fill="none" stroke="#fff" stroke-width="10" opacity=".55"/>
    <rect x="50" y="288" width="380" height="34" rx="14" fill="url(#chrome)"/>
    <path d="M110 150 L200 182 L200 214 L106 196Z" fill="#2a0a10"/><path d="M370 150 L280 182 L280 214 L374 196Z" fill="#2a0a10"/>
    <ellipse cx="160" cy="210" rx="36" ry="30" fill="url(#eye)"/><circle cx="150" cy="212" r="12" fill="${K}" stroke="none"/>
    <ellipse cx="320" cy="210" rx="36" ry="30" fill="url(#eye)"/><circle cx="310" cy="212" r="12" fill="${K}" stroke="none"/>
    <path d="M140 244 C190 296 290 296 340 244 C300 262 180 262 140 244Z" fill="#1a0408"/>
    <path d="M150 248 l16 22 14 -18 16 24 16 -22 16 24 16 -22 16 22 14 -20 16 18" fill="#fff" stroke-width="5"/>
    <path d="M200 272 C220 290 260 290 280 272" fill="#ff5a7a" stroke-width="5"/>
    <circle cx="110" cy="340" r="34" fill="url(#tire)"/><circle cx="110" cy="340" r="14" fill="url(#chrome)" stroke-width="5"/>
    <circle cx="370" cy="340" r="34" fill="url(#tire)"/><circle cx="370" cy="340" r="14" fill="url(#chrome)" stroke-width="5"/>
    <rect x="30" y="170" width="44" height="60" rx="12" fill="url(#chrome)"/>`),
  nozzle: P(240, 150, 220, 75, CHROME + lg('nz', 0, 0, 0, 1, [[0, '#8a96aa'], [1, '#3a4454']]), `
    <path d="M220 50 L120 40 L20 10 L20 140 L120 110 L220 100Z" fill="url(#nz)"/>
    <rect x="6" y="4" width="34" height="142" rx="10" fill="url(#chrome)"/>
    <path d="M60 30 L60 120 M100 38 L100 112" stroke="#1a2030" stroke-width="5"/>${hl(70, 30, 120, 8, 4, 0.5)}`),
  // ---------------- prensa hidráulica: placa (anclada en el centro de la cara de abajo)
  pressPlate: P(600, 150, 300, 146, lg('st', 0, 0, 0, 1, [[0, '#eef2f8'], [0.25, '#b3bdcc'], [0.7, '#6d788c'], [1, '#3a4454']]) + CHROME, `
    <rect x="10" y="10" width="580" height="90" rx="14" fill="url(#st)"/>
    <rect x="10" y="96" width="580" height="44" rx="8" fill="#ffd23f"/>
    <g stroke="none" fill="${K}">${Array.from({ length: 15 }, (_, i) => `<path d="M${10 + i * 42} 140 L${38 + i * 42} 96 L${60 + i * 42} 96 L${32 + i * 42} 140Z"/>`).join('')}</g>
    <rect x="10" y="96" width="580" height="44" rx="8" fill="none"/>
    ${[60, 180, 420, 540].map(x => `<circle cx="${x}" cy="54" r="15" fill="url(#chrome)" stroke-width="6"/><path d="M${x - 8} 54 h16" stroke-width="4"/>`).join('')}
    <text x="300" y="72" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="44" fill="#3a4454" stroke="none">50 T</text>
    ${hl(30, 20, 540, 10, 5, 0.6)}`),
  // ---------------- sello «CORRUPTO» (anclado en el centro de la goma)
  stamp: P(520, 600, 260, 584, rg('knob', 0.4, 0.3, 0.7, [[0, '#ffd8a0'], [0.4, '#c7782e'], [1, '#4a2208']]) + lg('neck', 0, 0, 1, 0, [[0, '#5a2a0a'], [0.4, '#d18a46'], [1, '#4a2208']]) + lg('blk', 0, 0, 0, 1, [[0, '#c98547'], [1, '#5a2a0a']]) + GOLD + lg('ink', 0, 0, 0, 1, [[0, '#ff3b2f'], [1, '#8a0610']]), `
    <circle cx="260" cy="90" r="78" fill="url(#knob)"/>${hl(214, 46, 50, 22, 11, 0.7)}
    <path d="M226 160 C226 200 214 230 214 280 L306 280 C306 230 294 200 294 160Z" fill="url(#neck)"/>
    <path d="M220 210 h80 M216 246 h88" stroke-width="5"/>
    <rect x="196" y="272" width="128" height="40" rx="10" fill="url(#gold)"/>${hl(206, 278, 60, 8, 4, 0.8)}
    <rect x="30" y="306" width="460" height="180" rx="22" fill="url(#blk)"/>
    <rect x="150" y="350" width="220" height="80" rx="10" fill="url(#gold)" stroke-width="7"/>
    <text x="260" y="404" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="38" fill="#6a3a0a" stroke="none">OFICIAL</text>
    ${hl(50, 316, 380, 12, 6, 0.4)}
    <rect x="20" y="480" width="480" height="110" rx="16" fill="url(#ink)"/>
    <path d="M60 590 c4 16 -4 30 4 40 M430 590 c-2 12 4 22 0 34" stroke="#c4101a" stroke-width="10" fill="none"/>
    ${hl(40, 492, 440, 10, 5, 0.35)}`),
};

const IMG = {};
let loading = null;
export function loadArt() {
  if (loading) return loading;
  loading = Promise.all(Object.entries(ART).map(([k, a]) => new Promise(res => {
    const im = new Image(); im.onload = () => res(); im.onerror = () => res();
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(a.svg); IMG[k] = im;
  })));
  return loading;
}
// dibuja una pieza: el punto de anclaje queda en (x, y); s = escala, r = giro, sx/sy = estirar
export function art(c, k, x = 0, y = 0, s = 1, r = 0, sx = 1, sy = 1) {
  const a = ART[k], im = IMG[k]; if (!a || !im?.complete || !im.naturalWidth) return;
  c.save(); c.translate(x, y); if (r) c.rotate(r); c.scale(s * sx, s * sy); c.drawImage(im, -a.ax, -a.ay, a.w, a.h); c.restore();
}

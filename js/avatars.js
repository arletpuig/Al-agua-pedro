// Fotos de perfil: banderas redondas dibujadas en SVG (sin imágenes externas, se ven igual en la interfaz y en la imagen para compartir).
// Cada bandera ocupa un cuadrado 100×100; se recorta en círculo al mostrarla. Los identificadores se validan también en el servidor (schema_v7.sql).
const R = (x, y, w, h, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`;
const hs = (cols, ws = cols.map(() => 1)) => { const t = ws.reduce((a, b) => a + b, 0); let y = 0; return cols.map((c, i) => { const h = 100 * ws[i] / t, r = R(0, y.toFixed(2), 100, (h + 0.3).toFixed(2), c); y += h; return r; }).join(''); };
const vs = (cols, ws = cols.map(() => 1)) => { const t = ws.reduce((a, b) => a + b, 0); let x = 0; return cols.map((c, i) => { const w = 100 * ws[i] / t, r = R(x.toFixed(2), 0, (w + 0.3).toFixed(2), 100, c); x += w; return r; }).join(''); };
const at = (x, y, s, body) => `<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;
const GOLD = '#f6c400', RED = '#c60b1e', CRIMSON = '#9b1b30', PURPLE = '#6b2c8f';
const senyera = (y = '#fcdd09', r = '#da121a') => hs([y, r, y, r, y, r, y, r, y]);
// figuras heráldicas sencillas (centradas en 0,0; unas 40 unidades de alto)
const castle = (fill = GOLD, door = '#1d4fa8') => `<g fill="${fill}" stroke="#00000055" stroke-width=".8">${R(-18, -8, 10, 28, fill)}${R(8, -8, 10, 28, fill)}${R(-6, -20, 12, 22, fill)}${R(-10, 0, 20, 20, fill)}
  ${[-18, -14.5, -11, 8, 11.5, 15].map(x => R(x, -12, 3, 4.5, fill)).join('')}${[-6, -1.5, 3].map(x => R(x, -24, 3, 4.5, fill)).join('')}</g>
  <path d="M-4 20 V12 A4 4 0 0 1 4 12 V20Z" fill="${door}"/>${R(-1.3, -15, 2.6, 6, door)}${R(-14.5, 2, 2.6, 6, door)}${R(11.9, 2, 2.6, 6, door)}`;
const lion = (fill = PURPLE) => `<path d="M-4,-18 C2,-21 9,-17 8,-11 L12,-12 L10,-7 C14,-4 14,3 9,6 L13,12 L15,19 L9,19 L7,11 L1,9 L-2,19 L-8,19 L-5,9 C-11,6 -12,-2 -8,-6 L-14,-9 L-9,-11 L-12,-15 L-6,-14 Z" fill="${fill}" stroke="#00000055" stroke-width=".8"/>
  <path d="M-8,4 C-16,2 -19,-6 -15,-11" fill="none" stroke="${fill}" stroke-width="2.6" stroke-linecap="round"/><path d="M-4,-20 L-3,-25 L0,-22 L2,-26 L4,-22 L7,-25 L7,-19 Z" fill="${GOLD}"/><circle cx="4" cy="-14" r="1.2" fill="#fff"/>`;
const crown = (fill = GOLD) => `<path d="M-10,4 L-12,-6 L-5,-1 L0,-9 L5,-1 L12,-6 L10,4 Z" fill="${fill}" stroke="#00000066" stroke-width=".8"/>${R(-10, 4, 20, 4, fill)}<circle cx="0" cy="-10" r="2" fill="${fill}"/><circle cx="-6" cy="1" r="1.3" fill="#c8102e"/><circle cx="6" cy="1" r="1.3" fill="#1d4fa8"/>`;
const pales = (a = GOLD, b = '#d0102a', n = 9, w = 24, h = 16) => Array.from({ length: n }, (_, i) => R((i * w / n).toFixed(2), 0, (w / n + 0.2).toFixed(2), h, i % 2 ? b : a)).join('');
const shieldPath = 'M-12,-14 H12 V2 C12,10 6,14 0,16 C-6,14 -12,10 -12,2 Z';
// escudo de España muy simplificado: cuarteles, Granada, columnas de Hércules y corona
const spainArms = () => `
  ${[-24, 24].map(x => `${R(x - 3, -8, 6, 24, '#e9edf3')}${R(x - 5, -11, 10, 3.5, GOLD)}${R(x - 5, 15, 10, 3.5, GOLD)}<path d="M${x - 9},4 h18" stroke="#c8102e" stroke-width="3"/>`).join('')}
  ${R(-12, -14, 12, 8, '#c8102e')}${R(0, -14, 12, 8, '#f4f4f4')}${R(-12, -6, 12, 8, GOLD)}${R(0, -6, 12, 8, '#c8102e')}
  ${at(-6, -10, 0.17, castle())}${at(6, -10, 0.17, lion())}${at(-12, -6, 1, pales(GOLD, '#c8102e', 7, 12, 8))}
  <path d="M2,-2 h8 M6,-5 v6" stroke="${GOLD}" stroke-width="1.4"/>
  <path d="M-12,2 H12 C12,10 6,14 0,16 C-6,14 -12,10 -12,2Z" fill="#f4f4f4"/><circle cx="0" cy="8" r="2.6" fill="#c8102e"/><path d="M0,5 v-2" stroke="#2f8a3a" stroke-width="1.4"/>
  <path d="${shieldPath}" fill="none" stroke="#5a3a00" stroke-width="1.4"/><ellipse cx="0" cy="-6" rx="3.6" ry="4" fill="#1d4fa8" stroke="${GOLD}" stroke-width="1"/>
  ${at(0, -21, 0.8, crown())}`;
const star = (cx, cy, r, fill = '#fff') => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(2) + ',' + (cy + rr * Math.sin(a)).toFixed(2); } return `<path d="${d}Z" fill="${fill}"/>`; };
const gyronny = () => Array.from({ length: 8 }, (_, i) => { const a1 = i * Math.PI / 4 - Math.PI / 2, a2 = a1 + Math.PI / 4, p = a => `${(50 + 90 * Math.cos(a)).toFixed(1)},${(50 + 90 * Math.sin(a)).toFixed(1)}`; return `<path d="M50,50 L${p(a1)} L${p(a2)}Z" fill="${i % 2 ? '#111' : '#fff'}"/>`; }).join('');

export const AVATARS = [
  // ---- patrióticas
  { id: 'espana', name: 'España', group: 'p', svg: hs([RED, '#ffc400', RED], [1, 2, 1]) },
  { id: 'espana-escudo', name: 'España con escudo', group: 'p', svg: hs([RED, '#ffc400', RED], [1, 2, 1]) + at(50, 52, 1.35, spainArms()) },
  { id: 'tercios', name: 'Tercios (Cruz de Borgoña)', group: 'p', svg: R(0, 0, 100, 100, '#f7f3e8') + `<g stroke="#c8102e" stroke-linecap="round"><path d="M14,14 L86,86 M86,14 L14,86" stroke-width="11"/>
    <path d="M28,28 l-7,7 M44,44 l7,-7 M62,62 l-7,7 M74,74 l7,-7 M72,28 l7,7 M56,44 l-7,-7 M38,62 l7,7 M26,74 l-7,-7" stroke-width="6"/></g>` },
  { id: 'cruz', name: 'Cruz cristiana', group: 'p', svg: R(0, 0, 100, 100, '#f7f3e8') + `<circle cx="50" cy="46" r="34" fill="#ffd54a" opacity=".35"/>` + R(43, 14, 14, 74, '#c8102e') + R(24, 32, 52, 14, '#c8102e') + `<path d="M43,14 h14 v74 h-14Z M24,32 h52 v14 h-52Z" fill="none" stroke="#7a0010" stroke-width="1.5"/>` },
  { id: 'santiago', name: 'Cruz de Santiago', group: 'p', svg: R(0, 0, 100, 100, '#f7f3e8') + `<g fill="#c8102e"><path d="M46,30 H54 V76 L50,92 L46,76Z"/>${R(26, 40, 48, 7, '#c8102e')}
    <circle cx="50" cy="22" r="7"/><circle cx="44" cy="27" r="4"/><circle cx="56" cy="27" r="4"/><circle cx="22" cy="43.5" r="7"/><circle cx="26" cy="37" r="4"/><circle cx="26" cy="50" r="4"/><circle cx="78" cy="43.5" r="7"/><circle cx="74" cy="37" r="4"/><circle cx="74" cy="50" r="4"/></g>` },
  { id: 'castilla', name: 'Castilla', group: 'p', svg: R(0, 0, 100, 100, CRIMSON) + at(50, 52, 1.5, castle()) },
  { id: 'castilla-aragon', name: 'Castilla y Aragón (antigua)', group: 'p', svg: R(0, 0, 50, 50, '#c8102e') + R(50, 0, 50, 50, '#f4f4f4') + R(50, 50, 50, 50, '#c8102e') + at(0, 50, 1, pales(GOLD, '#c8102e', 9, 50, 50)) + at(26, 27, 0.8, castle()) + at(75, 27, 0.85, lion()) + at(75, 77, 0.8, castle()) + `<path d="M50,0 V100 M0,50 H100" stroke="#5a3a00" stroke-width="1.6"/>` },
  { id: 'leon', name: 'Reino de León', group: 'p', svg: R(0, 0, 100, 100, '#f7f3e8') + at(52, 54, 1.75, lion()) },
  { id: 'toro', name: 'España con toro', group: 'p', svg: hs([RED, '#ffc400', RED], [1, 2, 1]) + `<g fill="#111"><path d="M22,48 C24,40 34,38 44,40 L62,39 C66,36 70,35 72,32 L70,28 L74,31 L78,29 L76,33 C80,35 82,39 80,42 L76,42 L74,46 L72,54 L74,64 L70,64 L68,55 L62,54 L60,64 L56,64 L57,54 L40,54 L38,64 L34,64 L34,55 L28,54 L26,64 L22,64 L23,54 C20,52 20,49 22,48Z"/>
    <path d="M22,48 C17,50 16,56 18,60" fill="none" stroke="#111" stroke-width="2"/><path d="M72,31 C70,25 66,23 62,24 M77,30 C80,24 84,24 87,26" fill="none" stroke="#111" stroke-width="2.4" stroke-linecap="round"/></g>` },
  { id: 'falange', name: 'Falange', group: 'p', svg: vs(['#c8102e', '#111', '#c8102e']) },
  { id: 'vox', name: 'VOX', group: 'p', svg: R(0, 0, 100, 100, '#63be21') + `<text x="50" y="63" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="33" fill="#fff" letter-spacing="-1">VOX</text>` },
  { id: 'gadsden', name: "Don't Tread On Me", group: 'p', svg: R(0, 0, 100, 100, '#f7d117') + `<g fill="none" stroke="#3d6b1f" stroke-linecap="round" stroke-width="7"><path d="M40,66 C24,66 22,48 40,46 C56,44 62,60 48,60 C40,60 40,52 46,52"/><path d="M58,52 C64,44 64,34 70,30"/></g>
    <path d="M28,66 l-6,4 l1,-6 l-6,2" fill="none" stroke="#c49a00" stroke-width="3"/><ellipse cx="73" cy="28" rx="7" ry="5" fill="#3d6b1f" transform="rotate(-25 73 28)"/><path d="M79,25 l6,-2 m-6,4 l6,1" stroke="#c8102e" stroke-width="1.4"/>
    <text x="50" y="80" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="7" fill="#111">DONT TREAD ON ME</text>` },
  // ---- comunidades y ciudades autónomas
  { id: 'andalucia', name: 'Andalucía', group: 'c', svg: hs(['#007a3d', '#fff', '#007a3d']) },
  { id: 'aragon', name: 'Aragón', group: 'c', svg: senyera('#fcdd09', '#da121a') + at(50, 50, 1.4, `<path d="${shieldPath}" fill="#f4f4f4" stroke="#5a3a00" stroke-width="1"/>${R(-12, -14, 12, 8, '#3a7d2c')}${R(0, -14, 12, 8, '#1d4fa8')}${R(-12, -6, 12, 8, '#f4f4f4')}${at(0, -6, 1, pales(GOLD, '#c8102e', 7, 12, 8))}<path d="M-6,-2 h0 M-9,-2 h6 M-6,-5 v6" stroke="#c8102e" stroke-width="2"/><path d="M-6,-12 l2,4 h-4z" fill="#a8d08d"/><path d="M6,-12 v6 M3,-9 h6" stroke="#fff" stroke-width="1.6"/>${at(0, -20, 0.7, crown())}`) },
  { id: 'asturias', name: 'Asturias', group: 'c', svg: R(0, 0, 100, 100, '#0066ce') + `<g fill="#ffd400">${R(46, 18, 8, 64, '#ffd400')}${R(28, 34, 44, 8, '#ffd400')}<path d="M44,18 h12 l-2,4 h-8Z M44,82 h12 l-2,-4 h-8Z M28,32 v12 l4,-2 v-8Z M72,32 v12 l-4,-2 v-8Z"/>
    <text x="34" y="60" font-family="Georgia, serif" font-size="13" font-weight="700" text-anchor="middle">A</text><text x="66" y="60" font-family="Georgia, serif" font-size="13" font-weight="700" text-anchor="middle">Ω</text></g>` },
  { id: 'baleares', name: 'Islas Baleares', group: 'c', svg: senyera('#fcdd09', '#da121a') + R(0, 0, 52, 52, '#6b2c8f') + at(30, 30, 0.75, castle('#f4f4f4', '#6b2c8f')) },
  { id: 'canarias', name: 'Canarias', group: 'c', svg: vs(['#fff', '#0768a9', '#fedf00']) },
  { id: 'cantabria', name: 'Cantabria', group: 'c', svg: hs(['#fff', '#ed1c24']) },
  { id: 'castilla-la-mancha', name: 'Castilla-La Mancha', group: 'c', svg: R(0, 0, 50, 100, '#a6192e') + R(50, 0, 50, 100, '#fff') + at(27, 50, 0.95, castle()) },
  { id: 'castilla-y-leon', name: 'Castilla y León', group: 'c', svg: R(0, 0, 50, 50, '#c8102e') + R(50, 0, 50, 50, '#f4f4f4') + R(0, 50, 50, 50, '#f4f4f4') + R(50, 50, 50, 50, '#c8102e') + at(27, 28, 0.85, castle()) + at(75, 28, 0.85, lion()) + at(26, 77, 0.85, lion()) + at(75, 77, 0.85, castle()) },
  { id: 'cataluna', name: 'Cataluña', group: 'c', svg: senyera('#fcdd09', '#da121a') },
  { id: 'valencia', name: 'Comunidad Valenciana', group: 'c', svg: senyera('#fcdd09', '#da121a') + R(0, 0, 32, 100, '#0039a6') + `<path d="M32,0 V100" stroke="#c8102e" stroke-width="3"/>` + at(19, 32, 0.9, crown()) },
  { id: 'extremadura', name: 'Extremadura', group: 'c', svg: hs(['#00a650', '#fff', '#111']) },
  { id: 'galicia', name: 'Galicia', group: 'c', svg: R(0, 0, 100, 100, '#fff') + `<path d="M0,0 L20,0 L100,80 L100,100 L80,100 L0,20Z" fill="#0099d6"/>` },
  { id: 'madrid', name: 'Comunidad de Madrid', group: 'c', svg: R(0, 0, 100, 100, '#d10a11') + [26, 42, 58, 74].map(x => star(x, 40, 7.5)).join('') + [34, 50, 66].map(x => star(x, 60, 7.5)).join('') },
  { id: 'murcia', name: 'Región de Murcia', group: 'c', svg: R(0, 0, 100, 100, CRIMSON) + [[22, 30], [40, 30], [22, 50], [40, 50]].map(([x, y]) => at(x, y, 0.38, castle())).join('') + [[62, 24], [80, 24], [62, 42], [80, 42], [62, 60], [80, 60], [71, 77]].map(([x, y]) => at(x, y, 0.5, crown())).join('') },
  { id: 'navarra', name: 'Navarra', group: 'c', svg: R(0, 0, 100, 100, '#d50032') + `<g fill="none" stroke="${GOLD}" stroke-width="3.2" stroke-dasharray="5 2"><rect x="30" y="34" width="40" height="40"/><path d="M30,54 H70 M50,34 V74 M30,34 L70,74 M70,34 L30,74"/></g><circle cx="50" cy="54" r="4" fill="#1f9d55" stroke="${GOLD}" stroke-width="1.5"/>` + at(50, 24, 1, crown()) },
  { id: 'pais-vasco', name: 'País Vasco', group: 'c', svg: R(0, 0, 100, 100, '#d52b1e') + `<path d="M0,0 L100,100 M100,0 L0,100" stroke="#009b48" stroke-width="13"/><path d="M50,0 V100 M0,50 H100" stroke="#fff" stroke-width="11"/>` },
  { id: 'rioja', name: 'La Rioja', group: 'c', svg: hs(['#e30613', '#fff', '#009640', '#ffd700']) },
  { id: 'ceuta', name: 'Ceuta', group: 'c', svg: gyronny() + at(50, 50, 1.25, `<path d="${shieldPath}" fill="#f4f4f4" stroke="#c8102e" stroke-width="2.4"/>${[[0, -6], [-5, 0], [0, 0], [5, 0], [0, 6]].map(([x, y]) => R(x - 2, y - 2.5, 4, 5, '#1d4fa8')).join('')}${at(0, -20, 0.7, crown())}`) },
  { id: 'melilla', name: 'Melilla', group: 'c', svg: R(0, 0, 100, 100, '#7cc2ec') + at(50, 52, 1.45, `<path d="${shieldPath}" fill="#c8102e" stroke="${GOLD}" stroke-width="1.6"/>${R(-12, -14, 24, 9, '#1d4fa8')}<path d="M-7,-2 h14 v8 h-14Z" fill="${GOLD}"/><path d="M-12,8 C-4,4 4,12 12,8" stroke="#fff" stroke-width="1.6" fill="none"/>${at(0, -21, 0.75, crown())}`) },
];
export const AVATAR_IDS = AVATARS.map(a => a.id);
export const DEFAULT_AVATAR = 'espana';
const byId = Object.fromEntries(AVATARS.map(a => [a.id, a]));
export const avatarOf = id => byId[id] || byId[DEFAULT_AVATAR];
export function avatarSVG(id, size = 48) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">${avatarOf(id).svg}</svg>`;
}
// Imagen (para dibujar en canvas)
export function avatarImage(id) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(avatarSVG(id, 400)); });
}

// Imagen para presumir de estadísticas (1080×1920, formato historia): la escena real del juego con Pedro haciendo la peineta,
// tu bandera, tu nombre y tus números, y una invitación a jugar.
import { avatarImage } from './avatars.js';

const fmt = n => Math.round(n).toLocaleString('es-ES');
export const TITLES = [[1000, 'Leyenda de la pecera'], [200, 'Terror de la Moncloa'], [50, 'Azote de Ferraz'], [10, 'Lanzador de feria'], [1, 'Tomatero'], [0, 'Recién llegado']];
export const titleFor = falls => TITLES.find(([n]) => falls >= n)[1];
export const gameURL = () => (location.host + location.pathname).replace(/\/index\.html$/, '').replace(/\/$/, '');

// Los iconos del juego (símbolos SVG de index.html) como imágenes para el canvas
function iconImage(id) {
  const defs = document.querySelector('svg defs')?.outerHTML || '';
  const src = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64" width="160" height="160">${defs}<use href="#${id}" xlink:href="#${id}" width="64" height="64"/></svg>`;
  return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src); });
}
function text(c, s, x, y, { size = 60, font = 'Titan One', weight = '', fill = '#fff', stroke = '#0a0b18', lw = 12, align = 'center', shadow = 7, maxW = 0 } = {}) {
  c.save(); c.font = `${weight} ${size}px "${font}", "Arial Black", sans-serif`.trim(); c.textAlign = align; c.textBaseline = 'middle'; c.lineJoin = 'round';
  if (maxW) { const w = c.measureText(s).width; if (w > maxW) { c.font = `${weight} ${Math.floor(size * maxW / w)}px "${font}", "Arial Black", sans-serif`.trim(); } }
  if (shadow) { c.lineWidth = lw; c.strokeStyle = stroke; c.strokeText(s, x, y + shadow); c.fillStyle = stroke; c.fillText(s, x, y + shadow); }
  if (lw) { c.lineWidth = lw; c.strokeStyle = stroke; c.strokeText(s, x, y); }
  c.fillStyle = fill; c.fillText(s, x, y); c.restore();
}
const grad = (c, y0, y1, a, b) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
function panel(c, x, y, w, h, r, fill = 'rgba(9,14,48,.86)') {
  c.save(); c.beginPath(); c.roundRect(x, y + 8, w, h, r); c.fillStyle = '#0a0b18'; c.fill();
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = fill; c.fill(); c.lineWidth = 6; c.strokeStyle = '#0a0b18'; c.stroke();
  c.beginPath(); c.roundRect(x + 8, y + 8, w - 16, h - 16, r - 6); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.14)'; c.stroke(); c.restore();
}
function starburst(c, x, y, r, n, rot, fillA, fillB) {
  c.save(); c.translate(x, y); c.rotate(rot); c.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n, rr = i % 2 ? r * 0.84 : r; c.lineTo(rr * Math.cos(a), rr * Math.sin(a)); }
  c.closePath(); const g = c.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r); g.addColorStop(0, fillA); g.addColorStop(1, fillB);
  c.fillStyle = '#0a0b18'; c.translate(0, 10); c.fill(); c.translate(0, -10); c.fillStyle = g; c.fill(); c.lineWidth = 7; c.strokeStyle = '#0a0b18'; c.stroke(); c.restore();
}

// d = { name, avatar, stats, rank, cardsUnlocked, cardsTotal }
export async function renderShareCard(scene, d) {
  await Promise.all(['100px "Titan One"', '800 40px "Baloo 2"'].map(f => document.fonts?.load(f).catch(() => null)));
  const [av, iTom, iCoin, iTarget, iTrophy] = await Promise.all([avatarImage(d.avatar).catch(() => null), iconImage('ic-tomato'), iconImage('ic-coin'), iconImage('ic-target'), iconImage('ic-trophy')]);
  const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920; const c = cv.getContext('2d');
  // la escena del juego, con Pedro provocando
  scene.poster(c, 'peineta', 2.4);
  c.fillStyle = grad(c, 0, 470, 'rgba(4,7,26,.92)', 'rgba(4,7,26,0)'); c.fillRect(0, 0, 1080, 470);
  c.fillStyle = grad(c, 1700, 1920, 'rgba(4,7,26,0)', 'rgba(4,7,26,.95)'); c.fillRect(0, 1700, 1080, 220);

  // logo
  c.save(); c.translate(540, 92); c.rotate(-0.025);
  text(c, '¡AL AGUA PEDRO!', 0, 0, { size: 112, fill: grad(c, -50, 50, '#fff36b', '#ff9d1a'), lw: 18, shadow: 10, maxW: 980 });
  c.restore();

  // jugador: bandera + nombre + título
  const s = d.stats, py = 250;
  panel(c, 40, py - 78, 1000, 156, 78, 'rgba(14,22,70,.9)');
  c.save(); c.beginPath(); c.arc(130, py, 96, 0, Math.PI * 2); c.fillStyle = '#0a0b18'; c.fill();
  c.beginPath(); c.arc(130, py, 88, 0, Math.PI * 2); c.fillStyle = grad(c, py - 90, py + 90, '#fff6c0', '#c47a00'); c.fill();
  c.beginPath(); c.arc(130, py, 78, 0, Math.PI * 2); c.clip(); if (av) c.drawImage(av, 52, py - 78, 156, 156);
  const gl = c.createRadialGradient(100, py - 40, 0, 130, py, 80); gl.addColorStop(0, 'rgba(255,255,255,.45)'); gl.addColorStop(0.5, 'rgba(255,255,255,.05)'); gl.addColorStop(1, 'rgba(0,0,0,.2)'); c.fillStyle = gl; c.fillRect(40, py - 90, 180, 180);
  c.restore(); c.beginPath(); c.arc(130, py, 78, 0, Math.PI * 2); c.lineWidth = 6; c.strokeStyle = '#0a0b18'; c.stroke();
  text(c, d.name || 'Jugador', 250, py - 24, { size: 66, align: 'left', lw: 11, shadow: 6, maxW: 760 });
  text(c, titleFor(s.falls).toUpperCase(), 252, py + 44, { size: 38, font: 'Baloo 2', weight: '800', fill: '#ffd23f', align: 'left', lw: 8, shadow: 4, maxW: 760 });

  // pegatina: veces que ha tirado a Pedro al agua
  const sx = 175, sy = 640;
  starburst(c, sx, sy, 158, 16, 0.1, '#ff6b55', '#c4101c');
  c.save(); c.translate(sx, sy); c.rotate(-0.12);
  text(c, 'PEDRO AL AGUA', 0, -70, { size: 30, lw: 7, shadow: 3, maxW: 230 });
  text(c, fmt(s.falls), 0, 2, { size: s.falls >= 10000 ? 70 : s.falls >= 1000 ? 84 : 104, fill: grad(c, -50, 50, '#fff36b', '#ffb21a'), lw: 14, shadow: 8, maxW: 250 });
  text(c, s.falls === 1 ? 'VEZ' : 'VECES', 0, 74, { size: 34, lw: 7, shadow: 3 });
  c.restore();

  // fila de estadísticas, entre el tablón y la pecera
  const thrown = s.tomatoesThrown, aim = thrown ? Math.round(100 * s.perfects / thrown) : 0;
  const pes = (s.pesetasEarned || 0) + (s.chestPesetas || 0) + (s.paguitasPesetas || 0);
  const tiles = [
    [iTom, fmt(thrown), 'TOMATES', 'lanzados'],
    [iTarget, thrown ? aim + '%' : '—', 'PUNTERÍA', 'al centro'],
    [iCoin, fmt(pes), 'PESETAS', 'ganadas'],
    [iTrophy, d.rank ? '#' + fmt(d.rank) : '—', 'RANKING', d.cardsTotal ? `${d.cardsUnlocked}/${d.cardsTotal} cartas` : ''],
  ];
  const ty = 1112, tw = 238, th = 236, gap = 16, tx0 = (1080 - (tw * 4 + gap * 3)) / 2;
  tiles.forEach(([img, val, lbl, sub], i) => {
    const x = tx0 + i * (tw + gap);
    panel(c, x, ty, tw, th, 34);
    if (img) c.drawImage(img, x + tw / 2 - 38, ty + 14, 76, 76);
    text(c, val, x + tw / 2, ty + 124, { size: 56, fill: i === 2 ? '#ffd23f' : '#fff', lw: 10, shadow: 5, maxW: tw - 26 });
    text(c, lbl, x + tw / 2, ty + 178, { size: 28, font: 'Baloo 2', weight: '800', fill: '#9fb3ff', lw: 0, shadow: 0 });
    if (sub) text(c, sub, x + tw / 2, ty + 208, { size: 24, font: 'Baloo 2', weight: '700', fill: '#c9d4ff', lw: 0, shadow: 0, maxW: tw - 20 });
  });

  // invitación a jugar
  const cy = 1792;
  c.save(); c.translate(540, cy - 40); c.rotate(-0.02);
  text(c, '¿TE ATREVES? ¡TÍRALE TÚ!', 0, 0, { size: 66, fill: grad(c, -40, 40, '#ffffff', '#ffe08a'), lw: 13, shadow: 7, maxW: 1000 });
  c.restore();
  const url = gameURL(); c.save(); c.font = '800 40px "Baloo 2", sans-serif'; const uw = Math.min(980, c.measureText(url).width + 90); c.restore();
  c.save(); c.beginPath(); c.roundRect(540 - uw / 2, cy + 20 + 7, uw, 76, 38); c.fillStyle = '#0a0b18'; c.fill();
  c.beginPath(); c.roundRect(540 - uw / 2, cy + 20, uw, 76, 38); c.fillStyle = grad(c, cy + 20, cy + 96, '#ffe766', '#ff9d1a'); c.fill(); c.lineWidth = 6; c.strokeStyle = '#0a0b18'; c.stroke(); c.restore();
  text(c, url, 540, cy + 58, { size: 40, font: 'Baloo 2', weight: '800', fill: '#3a1d00', lw: 0, shadow: 0, maxW: uw - 50 });
  return cv;
}
export const canvasBlob = cv => new Promise(res => cv.toBlob(res, 'image/png'));

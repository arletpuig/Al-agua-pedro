// Escenario del juego (Canvas 2D): fondo de plató, foco, torre, trampolín, diana y pecera con pirañas.
// Pantalla de referencia: 1080x1920 (móvil vertical). Todo vectorial, animado con el tiempo t (segundos).
// Estilo: cartoon con volumen (degradados, brillos especulares, sombras suaves) y contorno oscuro.

export const W = 1080, H = 1920;
export const PLANK = { x0: 140, x1: 885, y: 1046, h: 42 };     // y = superficie donde pisa Pedro
export const TANK = { x0: 150, x1: 630, y0: 1370, y1: 1742, water: 1440 };
export const TOWER = { x0: 700, x1: 868, top: 1060, bottom: 1742 };
export const TARGET = { x: 880, y: 640, r: 185 };
export const FLOOR = 1742;
const INK = '#0a0b18';

const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(rx, 0.1), Math.max(ry, 0.1), rot, 0, Math.PI * 2); };
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
function steelV(c, x0, x1) {                         // cilindro vertical de acero
  const g = c.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, '#4b5470'); g.addColorStop(0.28, '#c9d1e6'); g.addColorStop(0.42, '#ffffff'); g.addColorStop(0.62, '#9aa4bf'); g.addColorStop(1, '#3d4560');
  return g;
}
function steelH(c, y0, y1) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#f2f5fc'); g.addColorStop(0.35, '#b9c2d9'); g.addColorStop(0.75, '#7c86a3'); g.addColorStop(1, '#4b5470');
  return g;
}
function bolt(c, x, y, r = 6) {
  c.fillStyle = INK; ell(c, x, y, r + 2, r + 2); c.fill();
  const g = c.createRadialGradient(x - r * 0.4, y - r * 0.4, 0.5, x, y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#6d7690');
  c.fillStyle = g; ell(c, x, y, r, r); c.fill();
}
// mancha difuminada con degradado radial (mucho más rápida que ctx.filter = 'blur')
function soft(c, cx, cy, rx, ry, color, alpha, b) {
  const m = Math.min(rx, ry), k = Math.max(0.05, Math.min(0.92, m / (m + b * 2)));
  c.save(); c.globalAlpha *= alpha; c.translate(cx, cy); c.scale(rx + b, ry + b);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, color); g.addColorStop(k, color); g.addColorStop(1, color + '00');
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1, 0, Math.PI * 2); c.fill(); c.restore();
}
export { soft as softBlob };
// ruido determinista
const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------------------------------------------------------------- fondo
function backgroundStatic(c) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#070c2e'); g.addColorStop(0.35, '#13226a'); g.addColorStop(0.7, '#1a2f86'); g.addColorStop(1, '#0a1238');
  c.fillStyle = g; c.fillRect(-400, -400, W + 800, H + 800);
  // pared con paneles verticales muy sutiles
  c.save(); c.globalAlpha = 0.18;
  for (let i = 0; i < 9; i++) {
    const x = i * 130 - 20, pg = c.createLinearGradient(x, 0, x + 130, 0);
    pg.addColorStop(0, 'rgba(0,0,0,0.5)'); pg.addColorStop(0.5, 'rgba(120,150,255,0.25)'); pg.addColorStop(1, 'rgba(0,0,0,0.5)');
    c.fillStyle = pg; c.fillRect(x, 0, 130, FLOOR);
  }
  c.restore();
}

function lights(c, t, spotX) {
  // halo del foco en la pared
  c.save(); c.globalCompositeOperation = 'lighter';
  const halo = c.createRadialGradient(spotX, 560, 30, spotX, 640, 620);
  halo.addColorStop(0, 'rgba(120,160,255,0.35)'); halo.addColorStop(0.5, 'rgba(70,110,230,0.12)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = halo; c.fillRect(0, 0, W, H);
  // bokeh
  for (let i = 0; i < 18; i++) {
    const x = rnd(i) * W, y = 120 + rnd(i + 50) * 1250, r = 10 + rnd(i + 99) * 34;
    const warm = rnd(i + 7) > 0.7;
    const a = 0.05 + 0.06 * (0.5 + 0.5 * Math.sin(t * (0.5 + rnd(i + 3)) + i));
    const bg = c.createRadialGradient(x, y, 0, x, y, r);
    bg.addColorStop(0, warm ? `rgba(255,220,150,${a * 1.6})` : `rgba(160,190,255,${a * 1.6})`);
    bg.addColorStop(0.75, warm ? `rgba(255,210,140,${a})` : `rgba(150,180,255,${a})`); bg.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = bg; ell(c, x + Math.sin(t * 0.15 + i) * 12, y + Math.cos(t * 0.12 + i) * 8, r, r); c.fill();
  }
  c.restore();
}
function floor(c, t) {
  const g = c.createLinearGradient(0, FLOOR, 0, H);
  g.addColorStop(0, '#24315f'); g.addColorStop(0.15, '#18224a'); g.addColorStop(1, '#070b1f');
  c.fillStyle = g; c.fillRect(-400, FLOOR, W + 800, H - FLOOR + 600);
  // tablas en perspectiva
  c.save(); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 3;
  const vx = W / 2, vy = FLOOR - 900;
  for (let i = -8; i <= 8; i++) {
    const xb = W / 2 + i * 150, k = (FLOOR - vy) / (H - vy);
    c.beginPath(); c.moveTo(vx + (xb - vx) * k, FLOOR); c.lineTo(xb, H); c.stroke();
  }
  for (const y of [1790, 1850]) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.restore();
  // borde iluminado del escenario
  c.save(); c.globalCompositeOperation = 'lighter';
  const eg = c.createLinearGradient(0, FLOOR - 6, 0, FLOOR + 30);
  eg.addColorStop(0, 'rgba(140,170,255,0)'); eg.addColorStop(0.25, 'rgba(160,190,255,0.45)'); eg.addColorStop(1, 'rgba(140,170,255,0)');
  c.fillStyle = eg; c.fillRect(-400, FLOOR - 6, W + 800, 36);
  const pool = c.createRadialGradient(420, FLOOR + 20, 10, 420, FLOOR + 20, 520);
  pool.addColorStop(0, 'rgba(255,230,170,0.28)'); pool.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = pool; c.fillRect(0, FLOOR - 40, W, 260);
  c.restore();
  // sombras de pecera y torre
  soft(c, (TANK.x0 + TANK.x1) / 2, FLOOR + 10, (TANK.x1 - TANK.x0) / 2 + 30, 22, '#000000', 0.55, 14);
  soft(c, (TOWER.x0 + TOWER.x1) / 2, FLOOR + 8, 120, 16, '#000000', 0.55, 14);
}

// ---------------------------------------------------------------- pecera con pirañas
function piranha(c, x, y, s, dir, t, seed) {
  c.save(); c.translate(x, y); c.scale(s * dir, s);
  const wag = Math.sin(t * 9 + seed) * 0.28;
  const chomp = Math.max(0, Math.sin(t * 3.2 + seed * 2)) ** 6;          // muerde de vez en cuando
  c.lineJoin = 'round'; c.lineCap = 'round';
  // cola
  c.save(); c.translate(-62, 0); c.rotate(wag);
  c.beginPath(); c.moveTo(4, 0); c.lineTo(-44, -34); c.quadraticCurveTo(-30, 0, -44, 34); c.closePath();
  c.lineWidth = 8; c.strokeStyle = INK; c.stroke(); c.fillStyle = '#4f7f93'; c.fill();
  c.restore();
  // aletas
  c.beginPath(); c.moveTo(-20, -40); c.quadraticCurveTo(0, -78, 26, -46); c.closePath();
  c.lineWidth = 7; c.strokeStyle = INK; c.stroke(); c.fillStyle = '#4f7f93'; c.fill();
  // cuerpo
  const body = new Path2D();
  body.moveTo(-66, 0); body.bezierCurveTo(-58, -46, 20, -60, 62, -18); body.lineTo(70, 6 + chomp * 8);
  body.bezierCurveTo(40, 52, -40, 50, -66, 0); body.closePath();
  c.lineWidth = 8; c.strokeStyle = INK; c.stroke(body);
  const bg = c.createLinearGradient(0, -55, 0, 50); bg.addColorStop(0, '#6f9fb4'); bg.addColorStop(0.55, '#9cc2cf'); bg.addColorStop(1, '#e2eef2');
  c.fillStyle = bg; c.fill(body);
  c.save(); c.clip(body);
  c.fillStyle = '#e8473f'; ell(c, 10, 34, 46, 20); c.fill();                       // vientre rojo
  c.fillStyle = 'rgba(255,255,255,0.55)'; ell(c, -10, -26, 34, 9, -0.1); c.fill();  // brillo
  c.fillStyle = 'rgba(30,60,80,0.35)'; for (let i = 0; i < 9; i++) { ell(c, -40 + (i % 3) * 22 + (i > 2 ? 8 : 0), -18 + Math.floor(i / 3) * 12, 3, 3); c.fill(); }
  c.restore();
  // mandíbula con dientes
  c.save(); c.translate(54, 14); c.rotate(0.15 + chomp * 0.45);
  const jaw = new Path2D(); jaw.moveTo(-26, -6); jaw.lineTo(22, -2); jaw.quadraticCurveTo(14, 20, -24, 14); jaw.closePath();
  c.lineWidth = 7; c.strokeStyle = INK; c.stroke(jaw); c.fillStyle = '#d5e4ea'; c.fill(jaw);
  c.fillStyle = '#fff'; c.lineWidth = 2.5;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-20 + i * 11, -5); c.lineTo(-15 + i * 11, -16); c.lineTo(-10 + i * 11, -5); c.fill(); c.stroke(); }
  c.restore();
  c.fillStyle = '#fff'; c.strokeStyle = INK; c.lineWidth = 2.5;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(28 + i * 10, 2); c.lineTo(33 + i * 10, 14); c.lineTo(38 + i * 10, 2); c.fill(); c.stroke(); }
  // ojo enfadado
  c.fillStyle = '#fff'; ell(c, 30, -16, 13, 12); c.fill(); c.lineWidth = 4; c.stroke();
  c.fillStyle = '#c9171e'; ell(c, 34, -15, 6.5, 7); c.fill(); c.fillStyle = '#000'; ell(c, 35, -15, 3, 3.5); c.fill();
  c.fillStyle = '#fff'; ell(c, 32, -18, 1.8, 1.8); c.fill();
  c.lineWidth = 7; c.beginPath(); c.moveTo(14, -32); c.lineTo(44, -22); c.stroke();
  c.restore();
}

function tank(c, t, S = {}) {
  const { x0, x1, y0, y1, water } = TANK;
  const ix0 = x0 + 26, ix1 = x1 - 26, iy1 = y1 - 40;
  // interior
  c.fillStyle = '#0b2a52'; c.fillRect(ix0, y0 + 20, ix1 - ix0, iy1 - y0 - 20);
  // agua (el recorte se abre por arriba: lo que hay dentro de la pecera puede asomar por encima)
  c.save(); c.beginPath(); c.rect(ix0, y0 - 2000, ix1 - ix0, iy1 - y0 + 2000); c.clip();
  const wy = x => water + Math.sin(x * 0.025 + t * 2.2) * 5 + Math.sin(x * 0.06 - t * 3.1) * 2.5;
  const wp = new Path2D(); wp.moveTo(ix0, iy1); for (let x = ix0; x <= ix1; x += 6) wp.lineTo(x, wy(x)); wp.lineTo(ix1, iy1); wp.closePath();
  const wg = c.createLinearGradient(0, water, 0, iy1);
  wg.addColorStop(0, '#58d2ea'); wg.addColorStop(0.35, '#2aa2d4'); wg.addColorStop(1, '#0f5594');
  c.fillStyle = wg; c.fill(wp);
  c.save(); c.clip(wp);
  // cáusticas
  c.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 10; i++) {
    const cx = ix0 + ((rnd(i) * (ix1 - ix0) + t * (14 + rnd(i + 3) * 18)) % (ix1 - ix0));
    const cy = water + 40 + rnd(i + 9) * 200;
    soft(c, cx, cy, 30 + rnd(i + 4) * 30, 8 + rnd(i + 5) * 6, '#a0f0ff', 0.2, 6);
  }
  // rayos de luz bajo el agua
  for (let i = 0; i < 4; i++) {
    const x = ix0 + 60 + i * 110 + Math.sin(t * 0.7 + i) * 18;
    const rg = c.createLinearGradient(0, water, 0, iy1); rg.addColorStop(0, 'rgba(200,250,255,0.18)'); rg.addColorStop(1, 'rgba(200,250,255,0)');
    c.fillStyle = rg; c.beginPath(); c.moveTo(x, water); c.lineTo(x + 34, water); c.lineTo(x + 90, iy1); c.lineTo(x + 20, iy1); c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  // arena
  const sand = new Path2D(); sand.moveTo(ix0, iy1);
  for (let x = ix0; x <= ix1; x += 10) sand.lineTo(x, iy1 - 34 - Math.sin(x * 0.03) * 8 - Math.sin(x * 0.011 + 1) * 6);
  sand.lineTo(ix1, iy1); sand.closePath();
  const sg = c.createLinearGradient(0, iy1 - 50, 0, iy1); sg.addColorStop(0, '#f2dca2'); sg.addColorStop(1, '#b8924f');
  c.fillStyle = sg; c.fill(sand);
  for (let i = 0; i < 16; i++) { c.fillStyle = rnd(i + 20) > 0.5 ? '#9c7a45' : '#e9e2cf'; ell(c, ix0 + rnd(i + 30) * (ix1 - ix0), iy1 - 8 - rnd(i + 40) * 20, 5 + rnd(i) * 6, 3 + rnd(i) * 3); c.fill(); }
  // algas
  for (const [ax, h, k] of [[ix0 + 30, 120, 0], [ix0 + 55, 90, 1], [ix1 - 40, 140, 2], [ix1 - 70, 100, 3]]) {
    c.strokeStyle = INK; c.lineWidth = 16; c.lineCap = 'round';
    const path = () => { c.beginPath(); c.moveTo(ax, iy1 - 20); for (let s = 1; s <= 6; s++) c.lineTo(ax + Math.sin(t * 1.6 + s * 0.8 + k) * s * 3, iy1 - 20 - (h * s) / 6); };
    path(); c.stroke(); c.strokeStyle = '#3aa64a'; c.lineWidth = 10; path(); c.stroke();
  }
  // lata roja tirada en el fondo
  c.save(); c.translate(ix0 + 135, iy1 - 34); c.rotate(-0.35);
  rr(c, -14, -26, 28, 46, 6); c.fillStyle = '#d42a2a'; c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
  c.fillStyle = '#ffd7d0'; c.fillRect(-14, -8, 28, 7); c.restore();
  // hueso
  c.save(); c.translate(ix1 - 150, iy1 - 30); c.rotate(0.2); c.fillStyle = '#f1ead8'; c.strokeStyle = INK; c.lineWidth = 4;
  rr(c, -24, -5, 48, 10, 5); c.fill(); c.stroke(); for (const sx of [-24, 24]) for (const sy of [-6, 6]) { ell(c, sx, sy, 7, 7); c.fill(); c.stroke(); }
  c.restore();
  // pirañas
  const fish = [[0.25, 1560, 1.0, 0], [0.62, 1620, 0.85, 1.7], [0.45, 1670, 0.75, 3.3]];
  for (const [p, fy, s, seed] of fish) {
    const span = ix1 - ix0 - 150, ph = (S.fishT ?? t) * (0.12 + seed * 0.01) + p;
    const tri = 2 * Math.abs((ph % 1) - 0.5);                         // 0..1..0 (va y viene)
    const fx = ix0 + 75 + tri * span;
    const dir = ((ph % 1) < 0.5) ? -1 : 1;
    piranha(c, fx, fy + Math.sin(t * 1.4 + seed) * 10, s * 0.82, dir, S.fishT ?? t, seed);
  }
  // burbujas
  for (let i = 0; i < 14; i++) {
    const sp = 40 + rnd(i) * 50, life = (iy1 - water) / sp, k = ((t + rnd(i + 5) * life) % life) / life;
    const bx = ix0 + 40 + rnd(i + 2) * (ix1 - ix0 - 80) + Math.sin(t * 3 + i) * 6, by = iy1 - 30 - k * (iy1 - water - 30), r = 4 + rnd(i + 6) * 7;
    c.strokeStyle = 'rgba(230,255,255,0.8)'; c.lineWidth = 2.5; ell(c, bx, by, r, r); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.8)'; ell(c, bx - r * 0.35, by - r * 0.35, r * 0.25, r * 0.25); c.fill();
  }
  c.restore();
  // Pedro (u otro objeto) dentro del agua: se dibuja aquí y se tiñe de agua por debajo de la superficie
  if (S.inside) {
    S.inside(c);
    c.save(); c.clip(wp); c.fillStyle = 'rgba(40,150,215,0.38)'; c.fillRect(ix0, water - 20, ix1 - ix0, iy1 - water + 20); c.restore();
  }
  // superficie: línea de espuma
  c.strokeStyle = 'rgba(220,255,255,0.9)'; c.lineWidth = 4; c.beginPath();
  for (let x = ix0; x <= ix1; x += 6) (x === ix0 ? c.moveTo(x, wy(x)) : c.lineTo(x, wy(x))); c.stroke();
  c.restore();
  // cristal: reflejos
  c.save(); c.beginPath(); c.rect(ix0, y0, ix1 - ix0, iy1 - y0); c.clip();
  c.fillStyle = 'rgba(255,255,255,0.10)';
  c.beginPath(); c.moveTo(ix0 + 40, y0); c.lineTo(ix0 + 120, y0); c.lineTo(ix0 - 60, iy1); c.lineTo(ix0 - 140, iy1); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.07)';
  c.beginPath(); c.moveTo(ix0 + 150, y0); c.lineTo(ix0 + 175, y0); c.lineTo(ix0 + 5, iy1); c.lineTo(ix0 - 20, iy1); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.08)';
  c.beginPath(); c.moveTo(ix1 - 40, y0); c.lineTo(ix1 - 10, y0); c.lineTo(ix1 - 120, iy1); c.lineTo(ix1 - 150, iy1); c.fill();
  c.restore();
  // marco de acero
  c.lineJoin = 'round';
  const post = (x) => { rr(c, x - 4, y0 - 4, 34, iy1 - y0 + 8, 8); c.fillStyle = INK; c.fill(); rr(c, x, y0, 26, iy1 - y0, 6); c.fillStyle = steelV(c, x, x + 26); c.fill(); };
  post(x0 + 2); post(x1 - 28);
  rr(c, x0 - 6, y0 - 12, x1 - x0 + 12, 36, 10); c.fillStyle = INK; c.fill();
  rr(c, x0 - 2, y0 - 8, x1 - x0 + 4, 28, 8); c.fillStyle = steelH(c, y0 - 8, y0 + 20); c.fill();
  rr(c, x0 - 14, iy1 - 4, x1 - x0 + 28, y1 - iy1 + 4, 12); c.fillStyle = INK; c.fill();
  rr(c, x0 - 10, iy1, x1 - x0 + 20, y1 - iy1 - 4, 10); c.fillStyle = steelH(c, iy1, y1); c.fill();
  for (const bx of [x0 + 20, x0 + 110, x1 - 110, x1 - 20]) bolt(c, bx, iy1 + 18, 6);
  for (const bx of [x0 + 15, x1 - 15]) { bolt(c, bx, y0 + 6, 5); }
  // placa
  const px = (x0 + x1) / 2;
  rr(c, px - 100, iy1 + 4, 200, 34, 6); c.fillStyle = INK; c.fill();
  const pg = c.createLinearGradient(0, iy1 + 8, 0, iy1 + 34); pg.addColorStop(0, '#ffe58a'); pg.addColorStop(0.5, '#e2b23c'); pg.addColorStop(1, '#a8761c');
  rr(c, px - 96, iy1 + 8, 192, 26, 4); c.fillStyle = pg; c.fill();
  c.fillStyle = '#3a2405'; c.font = '26px "Titan One", "Arial Black", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('PIRAÑAS', px, iy1 + 22);
}

// ---------------------------------------------------------------- torre, tablón, diana
function tower(c) {
  const { x0, x1, top, bottom } = TOWER;
  const cw = 30, cA = x0 + 6, cB = x1 - 6 - cw;
  // tirantes de madera en X
  const wood = (ax, ay, bx, by) => {
    c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 30; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    const g = c.createLinearGradient(ax - 12, ay, ax + 12, ay); g.addColorStop(0, '#9a5f25'); g.addColorStop(0.5, '#e0a35a'); g.addColorStop(1, '#8a521c');
    c.strokeStyle = '#c98a44'; c.lineWidth = 20; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    c.strokeStyle = 'rgba(255,220,160,0.6)'; c.lineWidth = 4; c.beginPath(); c.moveTo(ax - 4, ay - 3); c.lineTo(bx - 4, by - 3); c.stroke();
  };
  const mid = (top + bottom) / 2;
  for (const [ya, yb] of [[top + 30, mid - 10], [mid + 10, bottom - 30]]) { wood(cA + cw, ya, cB, yb); wood(cB, ya, cA + cw, yb); }
  for (const x of [cA, cB]) { rr(c, x - 4, top - 4, cw + 8, bottom - top + 8, 6); c.fillStyle = INK; c.fill(); rr(c, x, top, cw, bottom - top, 4); c.fillStyle = steelV(c, x, x + cw); c.fill(); }
  for (const y of [top + 8, mid, bottom - 16]) {
    rr(c, x0 - 10, y - 16, x1 - x0 + 20, 32, 6); c.fillStyle = INK; c.fill();
    rr(c, x0 - 6, y - 12, x1 - x0 + 12, 24, 5); c.fillStyle = steelH(c, y - 12, y + 12); c.fill();
    for (const bx of [x0 + 12, (x0 + x1) / 2, x1 - 12]) bolt(c, bx, y, 5);
  }
  // pies
  for (const x of [cA + cw / 2, cB + cw / 2]) { rr(c, x - 34, bottom - 6, 68, 18, 5); c.fillStyle = INK; c.fill(); rr(c, x - 30, bottom - 3, 60, 12, 4); c.fillStyle = steelH(c, bottom - 3, bottom + 9); c.fill(); }
}

function strut(c) {
  // jabalcón de acero: de la torre a la parte de abajo del tablón
  const a = [TOWER.x0 + 10, 1300], b = [520, PLANK.y + PLANK.h + 6];
  c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 30; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke();
  const g = c.createLinearGradient(a[0], a[1] - 15, a[0] + 12, a[1] + 15); g.addColorStop(0, '#eef2fb'); g.addColorStop(0.5, '#a7b0c8'); g.addColorStop(1, '#58617c');
  c.strokeStyle = g; c.lineWidth = 20; c.beginPath(); c.moveTo(...a); c.lineTo(...b); c.stroke();
  bolt(c, ...b, 7); bolt(c, a[0] + 4, a[1] - 4, 7);
}

function pole(c) {
  const x = 762, y0 = 470, y1 = PLANK.y;
  rr(c, x - 15, y0, 30, y1 - y0, 8); c.fillStyle = INK; c.fill();
  rr(c, x - 11, y0 + 4, 22, y1 - y0 - 4, 6); c.fillStyle = steelV(c, x - 11, x + 11); c.fill();
  // bola roja
  c.fillStyle = INK; ell(c, x, y0 - 4, 20, 20); c.fill();
  const g = c.createRadialGradient(x - 6, y0 - 10, 2, x, y0 - 4, 17); g.addColorStop(0, '#ff9a8a'); g.addColorStop(0.5, '#e2262c'); g.addColorStop(1, '#8a0d12');
  c.fillStyle = g; ell(c, x, y0 - 4, 16, 16); c.fill();
  // brazo que sujeta la diana
  rr(c, x, TARGET.y - 14, TARGET.x - x, 28, 6); c.fillStyle = INK; c.fill();
  rr(c, x, TARGET.y - 10, TARGET.x - x, 20, 5); c.fillStyle = steelH(c, TARGET.y - 10, TARGET.y + 10); c.fill();
}

function target(c, t, S = {}) {
  const { x, y, r } = TARGET, hit = S.party ? 0.5 + 0.5 * Math.sin(t * 22) : 0;
  c.save(); c.translate(x, y); c.rotate(S.targetRot || 0); c.scale(1 + (S.targetBump || 0), 1 + (S.targetBump || 0));
  // sombra proyectada
  soft(c, 18, 24, r + 6, r + 6, '#00000a', 0.55, 18);
  c.fillStyle = INK; ell(c, 0, 0, r + 6, r + 6); c.fill();
  const rim = c.createLinearGradient(0, -r, 0, r); rim.addColorStop(0, '#f6f8ff'); rim.addColorStop(0.45, '#a8b1c9'); rim.addColorStop(1, '#4c5571');
  c.fillStyle = rim; ell(c, 0, 0, r, r); c.fill();
  c.fillStyle = INK; ell(c, 0, 0, r - 28, r - 28); c.fill();
  const rings = ['#e5262d', '#fff4e4', '#e5262d', '#fff4e4', '#e5262d'];
  const R = r - 32;
  rings.forEach((col, i) => {
    const rad = R * (1 - i * 0.19);
    const g = c.createRadialGradient(-rad * 0.3, -rad * 0.3, rad * 0.1, 0, 0, rad);
    const dark = col === '#e5262d' ? '#a3141b' : '#e0cdb2';
    g.addColorStop(0, col); g.addColorStop(0.85, col); g.addColorStop(1, dark);
    c.fillStyle = g; ell(c, 0, 0, rad, rad); c.fill();
    c.strokeStyle = INK; c.lineWidth = 4; c.stroke();
  });
  // estrella central
  const st = R * 0.15;
  c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? st * 0.45 : st; c.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } c.closePath();
  c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 3; c.strokeStyle = '#7a4a00'; c.stroke();
  // brillo de cristal
  c.save(); ell(c, 0, 0, R, R); c.clip();
  const gl = c.createLinearGradient(-R, -R, R * 0.2, R * 0.2); gl.addColorStop(0, 'rgba(255,255,255,0.45)'); gl.addColorStop(0.5, 'rgba(255,255,255,0.05)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gl; ell(c, -R * 0.15, -R * 0.2, R * 0.95, R * 0.75, -0.6); c.fill();
  c.restore();
  // manchas de tomate pegadas a la diana (coordenadas relativas al centro)
  if (S.targetSplats) { c.save(); ell(c, 0, 0, r - 4, r - 4); c.clip(); S.targetSplats(c); c.restore(); }
  // bombillas (persecución de luces)
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, bx = Math.cos(a) * (r - 14), by = Math.sin(a) * (r - 14);
    const on = 0.5 + 0.5 * Math.sin(t * 6 - i * 0.9);
    const lit = Math.max(on, hit);
    c.save(); c.globalCompositeOperation = 'lighter';
    const gw = c.createRadialGradient(bx, by, 0, bx, by, 34); gw.addColorStop(0, `rgba(255,230,140,${0.55 * lit})`); gw.addColorStop(1, 'rgba(255,200,80,0)');
    c.fillStyle = gw; ell(c, bx, by, 34, 34); c.fill(); c.restore();
    c.fillStyle = INK; ell(c, bx, by, 11, 11); c.fill();
    const bg = c.createRadialGradient(bx - 3, by - 3, 1, bx, by, 9);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.5, lit > 0.5 ? '#fff1b0' : '#c9b98a'); bg.addColorStop(1, lit > 0.5 ? '#ffc93d' : '#7d6c45');
    c.fillStyle = bg; ell(c, bx, by, 9, 9); c.fill();
  }
  c.restore();
}

function plank(c, S = {}) {
  const { x0, x1, y, h } = PLANK, top = 14;
  c.save(); if (S.plankAng) { c.translate(TOWER.x0 + 6, y); c.rotate(-S.plankAng); c.translate(-(TOWER.x0 + 6), -y); }
  // cara superior (se ve un poco: perspectiva)
  c.lineJoin = 'round';
  c.fillStyle = INK; rr(c, x0 - 5, y - top - 5, x1 - x0 + 10, h + top + 10, 12); c.fill();
  const tg = c.createLinearGradient(0, y - top, 0, y); tg.addColorStop(0, '#f6cf8e'); tg.addColorStop(1, '#e2ad62');
  c.fillStyle = tg; rr(c, x0, y - top, x1 - x0, top + 4, [8, 8, 0, 0]); c.fill();
  const fg = c.createLinearGradient(0, y, 0, y + h); fg.addColorStop(0, '#d39246'); fg.addColorStop(0.6, '#a96a2b'); fg.addColorStop(1, '#6e4116');
  c.fillStyle = fg; rr(c, x0, y + 2, x1 - x0, h - 2, [0, 0, 8, 8]); c.fill();
  // vetas
  c.save(); c.beginPath(); c.rect(x0, y - top, x1 - x0, h + top); c.clip();
  c.strokeStyle = 'rgba(80,40,10,0.45)'; c.lineWidth = 2.5;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(x0, y + 10 + i * 8); for (let x = x0; x <= x1; x += 40) c.lineTo(x, y + 10 + i * 8 + Math.sin(x * 0.02 + i * 2) * 3); c.stroke(); }
  c.strokeStyle = 'rgba(70,35,8,0.7)'; c.lineWidth = 3;
  for (const x of [330, 560]) { c.beginPath(); c.moveTo(x, y - top); c.lineTo(x, y + h); c.stroke(); }
  // franjas de peligro en la punta
  c.beginPath(); c.rect(x0, y - top, 84, h + top); c.clip();
  c.fillStyle = '#ffcf2e'; c.fillRect(x0, y - top, 84, h + top);
  c.fillStyle = '#16161c';
  for (let i = -3; i < 6; i++) { c.beginPath(); c.moveTo(x0 + i * 26, y + h); c.lineTo(x0 + i * 26 + 13, y + h); c.lineTo(x0 + i * 26 + 13 + h + top, y - top); c.lineTo(x0 + i * 26 + h + top, y - top); c.fill(); }
  c.restore();
  c.strokeStyle = 'rgba(255,240,200,0.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0 + 6, y - top + 3); c.lineTo(x1 - 6, y - top + 3); c.stroke();
  c.restore();
  // abrazadera sobre la torre
  const bx0 = TOWER.x0 - 6, bx1 = TOWER.x1 + 6;
  rr(c, bx0 - 4, y - top - 16, bx1 - bx0 + 8, h + top + 32, 8); c.fillStyle = INK; c.fill();
  rr(c, bx0, y - top - 12, bx1 - bx0, h + top + 24, 6); c.fillStyle = steelH(c, y - top - 12, y + h + 12); c.fill();
  for (const bx of [bx0 + 20, bx1 - 20]) for (const by of [y - top - 2, y + h - 2]) bolt(c, bx, by, 6);
  bolt(c, (bx0 + bx1) / 2, y + h / 2 - 6, 9);
}

// foco: cono de luz que sigue a Pedro, polvo en suspensión y viñeta
function spotlight(c, t, sx) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(0, 0, 0, PLANK.y + 80);
  g.addColorStop(0, 'rgba(170,200,255,0.20)'); g.addColorStop(0.55, 'rgba(170,200,255,0.06)'); g.addColorStop(1, 'rgba(170,200,255,0.02)');
  c.fillStyle = g; c.beginPath(); c.moveTo(sx - 70, -10); c.lineTo(sx + 70, -10); c.lineTo(sx + 300, PLANK.y + 60); c.lineTo(sx - 300, PLANK.y + 60); c.closePath(); c.fill();
  for (let i = 0; i < 40; i++) {
    const k = ((t * (0.02 + rnd(i) * 0.03) + rnd(i + 9)) % 1);
    const y = k * PLANK.y, spread = 70 + (y / PLANK.y) * 220;
    const x = sx + (rnd(i + 3) * 2 - 1) * spread + Math.sin(t * 0.7 + i) * 10;
    c.fillStyle = `rgba(220,235,255,${0.25 * Math.sin(k * Math.PI)})`; ell(c, x, y, 2.2, 2.2); c.fill();
  }
  c.restore();
}
function plankPool(c, sx) {
  c.save(); c.globalCompositeOperation = 'lighter';
  const pool = c.createRadialGradient(sx, PLANK.y, 10, sx, PLANK.y, 340);
  pool.addColorStop(0, 'rgba(255,240,200,0.25)'); pool.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = pool; ell(c, sx, PLANK.y, 340, 120); c.fill();
  c.restore();
}
function vignette(c) {
  const g = c.createRadialGradient(W / 2, H * 0.45, H * 0.25, W / 2, H * 0.5, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,12,0.6)');
  c.fillStyle = g; c.fillRect(-400, -400, W + 800, H + 800);
}
export function pedroShadow(c, x, spread = 1) {
  soft(c, x, PLANK.y - 4, 120 * spread, 12, '#140800', 0.45, 8);
}

// escena detrás de Pedro
// partes que no cambian nunca: se pueden pintar una vez y reutilizar (ver arena.js)
export function drawStatic(c) {
  backgroundStatic(c);
  floor(c, 0);
  tower(c);
  strut(c);
  pole(c);
}
export function drawStageBack(c, t, spotX, S = {}) {
  if (!S.noStatic) drawStatic(c);
  lights(c, t, spotX);
  tank(c, t, S);
  target(c, t, S);
  plank(c, S);
  if (!S.plankAng) plankPool(c, spotX);
}
// capas por delante de Pedro
export function drawStageFront(c, t, spotX) {
  spotlight(c, t, spotX);
  vignette(c);
}

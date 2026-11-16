// La Armería: dibujos de los objetos (mismo estilo que el juego: contorno grueso y colores planos con brillo)
// y la animación de cada uno contra Pedro. Todo en coordenadas del escenario (1080 de ancho; Pedro pisa en y = 1050).
import { SFX } from '../audio.js';

const INK = '#0a0b18';
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const el = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); };
const fillStroke = (c, fill, lw = 7) => { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(); };
const grad = (c, y0, y1, a, b) => { const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; };
const shine = (c, x, y, w, h, rot = 0) => { c.save(); c.globalAlpha = 0.55; c.fillStyle = '#fff'; el(c, x, y, w, h, rot); c.fill(); c.restore(); };

// ---------------------------------------------------------------- dibujos (origen indicado en cada uno)
// Martillo de goma: origen en el extremo del mango; la cabeza queda en (0, -290). squash: aplasta la goma al golpear
function hammer(c, squash = 0) {
  rr(c, -13, -260, 26, 262, 12); fillStroke(c, grad(c, -260, 0, '#d79a55', '#8a5326'));
  c.save(); c.translate(0, -290); c.scale(1 + squash * 0.35, 1 - squash * 0.3);
  rr(c, -105, -52, 210, 104, 34); fillStroke(c, grad(c, -52, 52, '#ff6b5a', '#b9141b'), 8);
  el(c, -105, 0, 16, 50); fillStroke(c, '#8f0f15', 6); el(c, 105, 0, 16, 50); fillStroke(c, '#8f0f15', 6);
  shine(c, -20, -28, 60, 10);
  c.restore();
}
// Chancla: origen en el centro
function slipper(c) {
  c.beginPath(); c.moveTo(0, -120); c.bezierCurveTo(58, -120, 62, -40, 50, 10); c.bezierCurveTo(44, 70, 52, 118, 0, 120); c.bezierCurveTo(-52, 118, -44, 70, -50, 10); c.bezierCurveTo(-62, -40, -58, -120, 0, -120);
  fillStroke(c, grad(c, -120, 120, '#4aa3ff', '#1d5fd1'), 8);
  c.beginPath(); c.moveTo(0, -90); c.bezierCurveTo(30, -88, 34, -30, 28, 6); c.bezierCurveTo(22, 60, 26, 90, 0, 92); c.bezierCurveTo(-26, 90, -22, 60, -28, 6); c.bezierCurveTo(-34, -30, -30, -88, 0, -90); c.fillStyle = '#8fd0ff'; c.fill();
  c.lineCap = 'round'; c.strokeStyle = INK; c.lineWidth = 16; c.beginPath(); c.moveTo(-46, 10); c.quadraticCurveTo(0, -60, 0, -86); c.quadraticCurveTo(0, -60, 46, 10); c.stroke();
  c.strokeStyle = '#ffd23f'; c.lineWidth = 9; c.stroke(); c.fillStyle = '#ffd23f'; el(c, 0, -84, 9, 9); c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke();
}
// Oca: mira a la derecha; origen en el suelo entre las patas. ph: fase de las patas, peck: 0..1 cuello estirado, open: pico abierto
function goose(c, ph = 0, peck = 0, open = 0) {
  const step = Math.sin(ph) * 16;
  c.lineCap = 'round';
  for (const [x, s] of [[-18, step], [18, -step]]) { c.strokeStyle = INK; c.lineWidth = 14; c.beginPath(); c.moveTo(x, -70); c.lineTo(x + s, -8); c.stroke(); c.strokeStyle = '#ff9d1a'; c.lineWidth = 7; c.stroke();
    c.beginPath(); c.moveTo(x + s - 6, -6); c.lineTo(x + s + 28, -2); c.lineTo(x + s - 4, 4); c.closePath(); fillStroke(c, '#ff9d1a', 4); }
  el(c, -10, -112, 95, 58, -0.12); fillStroke(c, grad(c, -170, -55, '#ffffff', '#d7dee8'));
  c.beginPath(); c.moveTo(-90, -120); c.quadraticCurveTo(-130, -150, -118, -96); c.closePath(); fillStroke(c, '#eef2f7', 6);   // cola
  el(c, -22, -118, 52, 28, -0.25); fillStroke(c, '#c8d1dd', 5);                                                             // ala
  const nx = 52 + peck * 70, ny = -150 + peck * 46, hx = 70 + peck * 120, hy = -220 + peck * 110;
  c.lineWidth = 34; c.strokeStyle = INK; c.beginPath(); c.moveTo(40, -130); c.quadraticCurveTo(nx, ny, hx, hy); c.stroke();
  c.lineWidth = 22; c.strokeStyle = '#ffffff'; c.stroke();
  c.save(); c.translate(hx, hy); c.rotate(peck * 0.7);
  el(c, 0, 0, 30, 26); fillStroke(c, '#ffffff', 6);
  c.beginPath(); c.moveTo(20, -8 - open * 10); c.lineTo(66, -2 - open * 6); c.lineTo(22, 4); c.closePath(); fillStroke(c, '#ff9d1a', 5);
  c.beginPath(); c.moveTo(22, 6); c.lineTo(60, 6 + open * 16); c.lineTo(20, 14); c.closePath(); fillStroke(c, '#f07c00', 5);
  el(c, 4, -6, 6, 7); c.fillStyle = INK; c.fill();
  c.lineWidth = 6; c.strokeStyle = INK; c.beginPath(); c.moveTo(-10, -22); c.lineTo(16, -12); c.stroke();             // ceja de enfado
  c.restore();
}
// Toro: mira a la derecha; origen en el suelo
function bull(c, ph = 0) {
  const step = Math.sin(ph) * 22; c.lineCap = 'round';
  for (const [x, s] of [[-110, step], [-70, -step], [70, -step], [110, step]]) { c.strokeStyle = INK; c.lineWidth = 30; c.beginPath(); c.moveTo(x, -110); c.lineTo(x + s, -10); c.stroke(); c.strokeStyle = '#2a2230'; c.lineWidth = 18; c.stroke(); el(c, x + s, -6, 16, 9); fillStroke(c, '#5a4a3a', 5); }
  c.lineWidth = 9; c.strokeStyle = INK; c.beginPath(); c.moveTo(-150, -170); c.quadraticCurveTo(-200, -150, -195, -90); c.stroke(); el(c, -195, -84, 10, 14); fillStroke(c, '#2a2230', 4);
  el(c, 0, -160, 165, 85); fillStroke(c, grad(c, -245, -75, '#4b3f55', '#15111c'), 8);
  shine(c, -40, -210, 70, 14, -0.1);
  c.save(); c.translate(165, -175); c.rotate(0.25);
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(-10, -40 * s); c.quadraticCurveTo(40, -110 * s, 90, -80 * s); c.quadraticCurveTo(50, -70 * s, 20, -26 * s); c.closePath(); fillStroke(c, '#f4ead2', 6); }
  el(c, 20, 0, 70, 58); fillStroke(c, grad(c, -58, 58, '#4b3f55', '#15111c'), 8);
  el(c, 70, 18, 34, 28); fillStroke(c, '#c9879a', 6);
  el(c, 62, 12, 6, 8); el(c, 82, 12, 6, 8); c.fillStyle = INK; c.fill();
  c.lineWidth = 6; c.strokeStyle = '#ffd23f'; c.beginPath(); c.arc(72, 38, 14, 0.2, Math.PI - 0.2); c.stroke();
  el(c, 24, -22, 13, 11); fillStroke(c, '#ff3b2f', 5); el(c, 27, -22, 5, 5); c.fillStyle = INK; c.fill();
  c.lineWidth = 7; c.beginPath(); c.moveTo(4, -42); c.lineTo(44, -30); c.stroke();
  c.restore();
}
// Aspiradora monstruosa: mira a la izquierda (a Pedro); origen en el suelo. Devuelve dónde está la boquilla.
function vacuum(c, suck = 0, bulge = 0) {
  c.save(); c.scale(1 + bulge * 0.18, 1 - bulge * 0.08);
  for (const x of [-70, 70]) { el(c, x, -24, 26, 26); fillStroke(c, '#333a4a', 6); el(c, x, -24, 9, 9); c.fillStyle = '#aab'; c.fill(); }
  rr(c, -120, -230, 240, 190, 60); fillStroke(c, grad(c, -230, -40, '#ff5a48', '#a80f16'), 8);
  shine(c, -50, -200, 50, 12, -0.2);
  for (const x of [-52, 18]) { el(c, x, -168, 30, 26); fillStroke(c, '#fff', 6); el(c, x - 8 + suck * 4, -164, 10, 12); c.fillStyle = INK; c.fill(); }
  c.lineWidth = 9; c.strokeStyle = INK; c.beginPath(); c.moveTo(-88, -206); c.lineTo(-24, -190); c.moveTo(48, -194); c.lineTo(-12, -186); c.stroke();
  rr(c, -78, -126, 120, 46, 20); fillStroke(c, '#2a0a10', 6);
  c.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-70 + i * 22, -126); c.lineTo(-59 + i * 22, -108); c.lineTo(-48 + i * 22, -126); c.fill(); }
  c.restore();
  c.lineCap = 'round'; c.lineWidth = 40; c.strokeStyle = INK; c.beginPath(); c.moveTo(-110, -120); c.bezierCurveTo(-200, -140, -190, -320, -300, -320); c.stroke();
  c.lineWidth = 26; c.strokeStyle = '#7a8496'; c.stroke();
  c.lineWidth = 4; c.strokeStyle = '#4a5466'; for (let i = 1; i < 8; i++) { const u = i / 8, x = (1 - u) ** 3 * -110 + 3 * (1 - u) ** 2 * u * -200 + 3 * (1 - u) * u * u * -190 + u ** 3 * -300, y = (1 - u) ** 3 * -120 + 3 * (1 - u) ** 2 * u * -140 + 3 * (1 - u) * u * u * -320 + u ** 3 * -320; el(c, x, y, 13, 13); c.stroke(); }
  c.save(); c.translate(-300, -320); rr(c, -70, -40, 70, 80, 14); fillStroke(c, '#555f72', 7); rr(c, -82, -48, 22, 96, 8); fillStroke(c, '#333a4a', 6); c.restore();
  return { x: -380, y: -320 };
}
// Prensa hidráulica: origen en el centro de la cara de abajo de la placa
function press(c) {
  c.lineCap = 'butt';
  for (const x of [-140, 140]) { rr(c, x - 26, -1400, 52, 1340, 6); fillStroke(c, grad(c, -1400, 0, '#c9d2e0', '#7b8699'), 7); rr(c, x - 40, -110, 80, 50, 10); fillStroke(c, '#5a6478', 6); }
  rr(c, -230, -64, 460, 64, 12); fillStroke(c, grad(c, -64, 0, '#aeb9cb', '#5d687c'), 8);
  c.save(); rr(c, -230, -26, 460, 26, 6); c.clip(); for (let x = -260; x < 240; x += 44) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 22, -26); c.lineTo(x + 44, -26); c.lineTo(x + 22, 0); c.fillStyle = '#ffd23f'; c.fill(); } c.restore();
  rr(c, -230, -26, 460, 26, 6); c.lineWidth = 6; c.strokeStyle = INK; c.stroke();
}
// Sello «CORRUPTO»: origen en el centro de la base
function stamp(c) {
  rr(c, -24, -300, 48, 160, 14); fillStroke(c, grad(c, -300, -140, '#c78a4a', '#7a4a1c'));
  el(c, 0, -320, 62, 50); fillStroke(c, grad(c, -370, -270, '#e0a560', '#7a4a1c'));
  shine(c, -18, -340, 22, 10, -0.3);
  rr(c, -220, -150, 440, 100, 18); fillStroke(c, grad(c, -150, -50, '#9a6a3a', '#5a3a1a'), 8);
  rr(c, -230, -56, 460, 56, 10); fillStroke(c, '#d11a25', 8);
}
// texto del sello estampado (rojo, con marco y algo gastado)
function stampMark(c, x, y, rot, a = 1, s = 1) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.globalAlpha = a;
  c.strokeStyle = '#e0141f'; c.lineWidth = 12; rr(c, -260, -70, 520, 140, 16); c.stroke(); c.lineWidth = 5; rr(c, -244, -56, 488, 112, 10); c.stroke();
  c.font = '92px "Titan One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e0141f'; c.fillText('CORRUPTO', 0, 6);
  c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; for (let i = 0; i < 26; i++) { el(c, ((i * 97) % 500) - 250, ((i * 61) % 120) - 60, 3 + i % 4, 2 + i % 3); c.fill(); }
  c.restore();
}

// ---------------------------------------------------------------- iconos para la tienda y la mochila
const ICON = {
  hammer: [c => { c.rotate(-0.6); hammer(c); }, 0.5, 70, 290],
  slipper: [c => { c.rotate(0.5); slipper(c); }, 0.62, 0, 0],
  goose: [c => goose(c, 0.6, 0, 1), 0.66, -10, 120],
  bull: [c => bull(c, 0.5), 0.5, -30, 150],
  vacuum: [c => vacuum(c), 0.46, 100, 180],
  press: [c => { press(c); c.fillStyle = INK; }, 0.42, 0, 150],
  stamp: [c => { stamp(c); stampMark(c, 0, 90, -0.12, 1, 0.5); }, 0.44, 0, 110],
};
export function drawIcon(cv, id) {
  const c = cv.getContext('2d'), n = cv.width, [fn, k, ox, oy] = ICON[id];
  c.clearRect(0, 0, n, n); c.save(); c.translate(n / 2, n / 2); c.scale(n / 256 * k * 1.25, n / 256 * k * 1.25); c.translate(ox, oy); fn(c); c.restore();
}

// ---------------------------------------------------------------- animaciones
// La escena aporta: tween, wait, burst, doShake, bigText, play, say, P (posición de Pedro), wpn (transformación de Pedro), prop (capa de dibujo), tint
const FEET = 1050, HEAD = 480;
export async function runWeapon(sc, id) {
  const px = sc.pedX(), W = sc.wpn = { sx: 1, sy: 1, dx: 0, dy: 0, rot: 0, alpha: 1, hide: false };
  const prop = { draw: null }; sc.prop = prop;
  const stars = (x, y, n = 10) => sc.burst(x, y, n, 'star', { min: 300, max: 800, g: 1400, r: [10, 18], life: [0.5, 0.9] });
  try {
    if (id === 'hammer') {
      const H = { a: 0.6, sq: 0, x: px + 250, y: 610, al: 0 }; prop.draw = c => { c.save(); c.globalAlpha = H.al; c.translate(H.x, H.y); c.rotate(H.a); hammer(c, H.sq); c.restore(); };
      sc.play('shock'); await sc.tween(H, { al: 1, a: 0.9 }, 0.35, 'o');
      SFX.whoosh(); await sc.tween(H, { a: -1.09 }, 0.16, 'i');
      SFX.bonk(); SFX.squeak(); sc.doShake(14, 0.3); sc.bigText('¡BONK!', '#ff5a48', 330, 110); stars(px, HEAD - 60, 12);
      H.sq = 1; W.sy = 0.5; W.sx = 1.45;
      sc.tween(H, { sq: 0 }, 0.4, 'b'); sc.play('wobble');
      await sc.tween(W, { sy: 1.18, sx: 0.88 }, 0.18, 'o'); await sc.tween(W, { sy: 1, sx: 1 }, 0.5, 'b');
      sc.tween(H, { a: 0.7, al: 0 }, 0.4, 'o'); sc.say('¡Esto es un ataque a la democracia!', 2.2); await sc.wait(0.6);
    } else if (id === 'slipper') {
      const S = { u: 0, back: false, rot: 0 }, p0 = [930, 1950], p1 = [1100, 300], p2 = [px + 20, HEAD - 20];
      const bez = (a, b, d, u) => [(1 - u) ** 2 * a[0] + 2 * (1 - u) * u * b[0] + u * u * d[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * b[1] + u * u * d[1]];
      prop.draw = c => { const [x, y] = S.back ? bez(p2, [-80, 500], [p0[0] - 60, 2050], S.u) : bez(p0, p1, p2, S.u); c.save(); c.translate(x, y); c.rotate(S.rot); c.scale(0.9, 0.9); slipper(c); c.restore(); };
      SFX.whoosh(); sc.tween(S, { rot: 14 }, 0.5, 'l'); await sc.tween(S, { u: 1 }, 0.5, 'i');
      SFX.slap(); sc.doShake(12, 0.25); sc.bigText('¡PLAS!', '#4aa3ff', 330, 110); stars(px, HEAD - 40, 10);
      sc.play('wobble'); W.rot = -0.18; W.sx = 1.1; W.sy = 0.92; sc.tween(W, { rot: 0, sx: 1, sy: 1 }, 0.6, 'b');
      S.back = true; S.u = 0; SFX.whoosh(); sc.tween(S, { rot: 30 }, 0.8, 'l'); await sc.tween(S, { u: 1 }, 0.8, 'o');
      sc.say('¡La chancla de mi madre no!', 2.0); await sc.wait(0.5);
    } else if (id === 'goose') {
      const G = { x: 1250, ph: 0, peck: 0, open: 0, flip: 1 }; prop.draw = c => { c.save(); c.translate(G.x, FEET); c.scale(-1.6 * G.flip, 1.6); goose(c, G.ph, G.peck, G.open); c.restore(); };
      const run = sc.tween(G, { ph: 40 }, 1.4, 'l');
      SFX.honk(); sc.play('shock'); sc.say('¡Socorro! ¡Una oca!', 1.6);
      sc.tween(W, { dx: -150 }, 1.0, 'o');
      await sc.tween(G, { x: px - 150 + 330 }, 1.0, 'o'); await run;
      for (let i = 0; i < 4; i++) {
        SFX.honk(); await sc.tween(G, { peck: 1, open: 1 }, 0.1, 'i');
        SFX.peck(); W.rot = (i % 2 ? 0.1 : -0.1); W.dx -= 14; sc.doShake(6, 0.12); stars(px + W.dx + 60, FEET - 300, 4);
        sc.burst(px + W.dx + 120, FEET - 260, 5, 'feather', { min: 120, max: 380, g: 300, r: [9, 15], life: [0.9, 1.4] });
        sc.tween(W, { rot: 0 }, 0.18, 'o'); await sc.tween(G, { peck: 0, open: 0 }, 0.16, 'o');
      }
      sc.bigText('¡HONK! ¡HONK!', '#ffffff', 320, 90); sc.play('wobble');
      G.flip = -1; sc.tween(G, { ph: 80 }, 1.0, 'l'); sc.tween(W, { dx: 0 }, 0.8, 'io'); await sc.tween(G, { x: 1350 }, 1.0, 'i');
    } else if (id === 'bull') {
      const B = { x: -360, ph: 0, steam: 0 }; prop.draw = c => { c.save(); c.translate(B.x, FEET); c.scale(1.5, 1.5); bull(c, B.ph); c.restore(); };
      sc.play('shock'); sc.say('¿Eso es un toro?', 1.4); SFX.moo();
      await sc.tween(B, { x: -120 }, 0.5, 'o');
      for (let i = 0; i < 3; i++) { SFX.hoof(); sc.burst(B.x - 100, FEET - 10, 6, 'dust', { angle: -Math.PI / 2 - 0.6, spread: 0.6, min: 80, max: 220, g: 100, r: [16, 30], life: [0.5, 0.8] }); await sc.wait(0.18); }
      sc.tween(B, { ph: 30 }, 0.5, 'l'); SFX.charge();
      await sc.tween(B, { x: px - 400 }, 0.42, 'i');
      // ¡embestida! el coro grita «¡OLÉ!» justo en el impacto
      SFX.ole(); SFX.bonk(); sc.doShake(24, 0.45); sc.bigText('¡OLÉÉÉ!', '#ffd23f', 330, 120); stars(px, FEET - 300, 14);
      sc.burst(px - 40, FEET - 20, 14, 'dust', { angle: -Math.PI / 2, spread: 1.2, min: 150, max: 450, g: 200, r: [18, 34], life: [0.6, 1.0] });
      sc.play('fall'); sc.tween(B, { x: 1500, ph: 70 }, 0.8, 'l');
      sc.tween(W, { rot: 7.5 }, 1.0, 'l'); sc.tween(W, { dx: 320 }, 1.0, 'l');
      await sc.tween(W, { dy: -1300 }, 0.6, 'o'); await sc.wait(0.35);
      W.dx = 0; W.rot = 0; sc.play('landed');
      await sc.tween(W, { dy: 0 }, 0.55, 'bounce'); sc.doShake(10, 0.25); sc.say('¡Esto es acoso de la fachosfera!', 2.2); await sc.wait(0.4);
    } else if (id === 'vacuum') {
      const V = { x: 1400, suck: 0, bulge: 0, al: 1 }, K = 1.45, vx = () => px + 700; prop.draw = c => { c.save(); c.translate(V.x, FEET); c.scale(K, K); vacuum(c, V.suck, V.bulge); c.restore();
        if (V.suck > 0.2) { c.save(); c.globalAlpha = V.suck * 0.7; c.strokeStyle = '#ffffff'; c.lineWidth = 6; c.lineCap = 'round'; const nx = V.x - 380 * K, ny = FEET - 320 * K;
          for (let i = 0; i < 6; i++) { const u = (sc.now * 2.5 + i / 6) % 1, d = 260 * (1 - u); c.beginPath(); c.arc(nx, ny, d, Math.PI - 0.5, Math.PI + 0.5); c.stroke(); } c.restore(); } };
      SFX.vacuumOn(); sc.play('shock'); await sc.tween(V, { x: vx() }, 0.7, 'o');
      sc.say('¡Eh! ¡Que me lleva!', 1.4); V.suck = 1; SFX.suck();
      await sc.tween(W, { rot: 0.35, sx: 0.7, sy: 1.25, dx: 80 }, 0.7, 'i');
      const nozzle = [vx() - 380 * K - px, -320 * K];
      await sc.tween(W, { dx: nozzle[0], dy: nozzle[1] + 120, sx: 0.05, sy: 0.05, rot: 3 }, 0.35, 'i');
      W.hide = true; SFX.gulp(); sc.bigText('¡SLURP!', '#7fdfff', 330, 110);
      for (let i = 0; i < 3; i++) { await sc.tween(V, { bulge: 1 }, 0.14, 'o'); await sc.tween(V, { bulge: 0 }, 0.14, 'i'); }
      await sc.wait(0.25); SFX.spit(); V.suck = 0; sc.doShake(14, 0.3);
      W.hide = false; W.rot = -4; sc.bigText('¡PTUI!', '#ffd23f', 330, 100);
      sc.burst(px + nozzle[0], FEET + nozzle[1], 10, 'dust', { angle: Math.PI, spread: 0.6, min: 200, max: 500, g: 200, r: [14, 26], life: [0.5, 0.9] });
      sc.play('landed'); sc.tween(W, { rot: 0 }, 0.6, 'o'); await sc.tween(W, { dx: 0, dy: 0, sx: 1, sy: 1 }, 0.6, 'b');
      sc.say('¡Esto es lawfare!', 1.8); await sc.tween(V, { x: 1600 }, 0.6, 'i');
    } else if (id === 'press') {
      const Pr = { y: -150 }; let acc = 0;
      prop.draw = c => { c.save(); c.translate(px + W.dx, Pr.y); press(c); c.restore(); };
      SFX.hiss(); sc.play('shock'); sc.say('¿Y esto qué es?', 1.2);
      await sc.tween(Pr, { y: FEET - 690 }, 0.8, 'io');
      SFX.clunk(); SFX.accordion(); sc.doShake(10, 0.3);
      const squeeze = { k: 0 };
      sc.tween(squeeze, { k: 1 }, 1.1, 'o'); const t0 = sc.now;
      prop.step = () => { const k = squeeze.k; Pr.y = FEET - 690 + k * 520; W.sy = (FEET - Pr.y) / 690; acc = Math.sin((sc.now - t0) * 18) * 0.06 * k; W.sx = 1 + (1 - W.sy) * 0.9 + acc; };
      await sc.wait(1.1); sc.bigText('¡CRUNCH!', '#c9d2e0', 330, 110); await sc.wait(0.6);
      prop.step = null; SFX.hiss(); SFX.boing();
      sc.tween(Pr, { y: -200 }, 0.5, 'i'); await sc.tween(W, { sy: 1.35, sx: 0.85 }, 0.18, 'o'); sc.play('wobble'); await sc.tween(W, { sy: 1, sx: 1 }, 0.6, 'b');
      sc.say('¡Me habéis dejado hecho un acordeón!', 2.0); await sc.wait(0.4);
    } else if (id === 'stamp') {
      const St = { y: -200, rot: 0 }, mark = { a: 0, s: 1.6 };
      prop.draw = c => { c.save(); c.translate(px, St.y); c.rotate(St.rot); c.scale(1.15, 1.15); stamp(c); c.restore(); };
      prop.over = c => { if (mark.a > 0) stampMark(c, px + W.dx, FEET - 330, -0.22, mark.a, mark.s * 0.78); };
      sc.play('shock'); sc.say('No, no, no...', 1.0); SFX.drumroll(0.8);
      await sc.tween(St, { y: 150, rot: 0.08 }, 0.8, 'o');
      await sc.tween(St, { y: FEET - 40, rot: 0 }, 0.16, 'i');
      SFX.stampBig(); sc.doShake(22, 0.4); W.sy = 0.86; W.sx = 1.08; sc.tint = { a: 0.5 }; mark.a = 1; mark.s = 1;
      sc.burst(px, FEET - 10, 12, 'dust', { angle: -Math.PI / 2, spread: 1.4, min: 150, max: 400, g: 200, r: [14, 26], life: [0.5, 0.9] });
      await sc.wait(0.25); sc.tween(W, { sx: 1, sy: 1 }, 0.4, 'b'); await sc.tween(St, { y: -400 }, 0.5, 'i');
      sc.bigText('¡CORRUPTO!', '#ff3b2f', 330, 110); sc.play('landed'); sc.say('¡Todo es mentira!', 2.0);
      await sc.wait(2.6); sc.tween(sc.tint, { a: 0 }, 0.8, 'o'); await sc.tween(mark, { a: 0 }, 0.8, 'o');
    }
  } finally { sc.wpn = null; sc.prop = null; sc.tint = null; }
}

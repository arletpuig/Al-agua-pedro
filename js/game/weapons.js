// La Armería: dibujo de cada objeto en el escenario (con las ilustraciones de armory-art.js) y su animación contra Pedro.
// Coordenadas del escenario: 1080 de ancho; Pedro pisa en y = 1050.
import { SFX } from '../audio.js';
import { art, loadArt } from './armory-art.js';

const INK = '#0a0b18';
const el = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); };
loadArt();

// ---------------------------------------------------------------- piezas (mismo origen que usan las animaciones)
// martillo: origen en el extremo del mango; la cabeza queda a 300 por encima
function hammer(c, sq = 0) { art(c, 'hammerHandle', 0, 0, 0.82); art(c, 'hammerHead', 0, -300, 0.62, 0, 1 + sq * 0.35, 1 - sq * 0.3); }
function slipper(c) { art(c, 'slipper', 0, 0, 0.46); }
// oca (mira a la derecha): origen en el suelo entre las patas
function goose(c, ph = 0, peck = 0, open = 0, flap = 0) {
  const step = Math.sin(ph) * 18; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [x, s] of [[-14, step], [24, -step]]) {
    c.strokeStyle = INK; c.lineWidth = 15; c.beginPath(); c.moveTo(x, -78); c.lineTo(x + s * 0.5, -40); c.lineTo(x + s, -6); c.stroke();
    c.strokeStyle = '#ff9d1a'; c.lineWidth = 8; c.stroke();
    c.beginPath(); c.moveTo(x + s - 8, -8); c.quadraticCurveTo(x + s + 16, -18, x + s + 34, -4); c.lineTo(x + s + 22, 2); c.lineTo(x + s + 10, -2); c.lineTo(x + s - 2, 4); c.closePath();
    c.fillStyle = '#ff9d1a'; c.fill(); c.lineWidth = 5; c.strokeStyle = INK; c.stroke();
  }
  art(c, peck > 0.5 || open > 0.5 ? 'gooseHeadOpen' : 'gooseHead', 62, -120, 0.58, peck * 1.1 - 0.05);   // el cuello sale de detrás del cuerpo
  art(c, 'gooseBody', 0, -62, 0.52);
  art(c, 'gooseWing', 34, -132, 0.46, 0.08 - flap * 0.8);
}
// toro (mira a la derecha): origen en el suelo
const BULL_S = 0.6;
function bull(c, ph = 0) {
  const s = BULL_S, leg = (x, a) => art(c, 'bullLeg', x * s, -200 * s, s, a);
  leg(-190, Math.sin(ph) * 0.4); leg(110, -Math.sin(ph) * 0.4);
  leg(-140, -Math.sin(ph) * 0.4); art(c, 'bull', 0, 0, s); leg(150, Math.sin(ph) * 0.4);
}
// aspiradora (mira a Pedro, a la izquierda): origen en el suelo. La boca de la boquilla queda en NOZ.
const NOZ = { x: -430, y: -330 };
function vacuum(c, suck = 0, bulge = 0) {
  // manguera corrugada
  const p0 = [-150, -130], p1 = [-250, -140], p2 = [-230, -330], p3 = [-300, -330];
  const bz = u => [0, 1].map(i => (1 - u) ** 3 * p0[i] + 3 * (1 - u) ** 2 * u * p1[i] + 3 * (1 - u) * u * u * p2[i] + u ** 3 * p3[i]);
  c.lineCap = 'round'; c.beginPath(); c.moveTo(...p0); c.bezierCurveTo(...p1, ...p2, ...p3);
  c.strokeStyle = INK; c.lineWidth = 46; c.stroke(); c.strokeStyle = '#6d788c'; c.lineWidth = 32; c.stroke(); c.strokeStyle = '#c9d2e0'; c.lineWidth = 10; c.stroke();
  c.strokeStyle = '#3a4454'; c.lineWidth = 4; for (let i = 1; i < 12; i++) { const [x, y] = bz(i / 12); el(c, x, y, 16, 16); c.stroke(); }
  art(c, 'nozzle', p3[0], p3[1], 0.6, suck ? Math.sin(performance.now() / 40) * 0.04 : 0);
  art(c, 'vacuum', 0, 0, 0.78, 0, 1 + bulge * 0.16, 1 - bulge * 0.06);
}
function press(c) {
  for (const x of [-170, 170]) {
    const g = c.createLinearGradient(x - 28, 0, x + 28, 0); g.addColorStop(0, '#5a6478'); g.addColorStop(0.3, '#ffffff'); g.addColorStop(0.55, '#9aa6b8'); g.addColorStop(1, '#4a5466');
    c.fillStyle = g; c.strokeStyle = INK; c.lineWidth = 7; c.beginPath(); c.roundRect(x - 26, -1500, 52, 1430, 8); c.fill(); c.stroke();
    c.fillStyle = '#3a4454'; c.beginPath(); c.roundRect(x - 46, -150, 92, 70, 12); c.fill(); c.stroke();
  }
  art(c, 'pressPlate', 0, 0, 0.82);
}
function stamp(c) { art(c, 'stamp', 0, 0, 0.88); }
// marca del sello: «CORRUPTO» rojo con doble marco y desgastado
function stampMark(c, x, y, rot, a = 1, s = 1) {
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.globalAlpha = a;
  c.strokeStyle = '#e0141f'; c.lineWidth = 14; c.beginPath(); c.roundRect(-270, -78, 540, 156, 18); c.stroke(); c.lineWidth = 6; c.beginPath(); c.roundRect(-250, -60, 500, 120, 10); c.stroke();
  c.font = '100px "Titan One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e0141f'; c.fillText('CORRUPTO', 0, 8);
  c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; for (let i = 0; i < 40; i++) { el(c, ((i * 97) % 540) - 270, ((i * 61) % 150) - 75, 2 + i % 5, 1.5 + i % 3, i); c.fill(); }
  c.restore();
}

// ---------------------------------------------------------------- iconos para la tienda (canvas cuadrado)
const ICON = {
  hammer: [c => { c.rotate(-0.55); hammer(c); }, 0.55, 80, 300],
  slipper: [c => { c.rotate(0.45); slipper(c); }, 0.78, 0, 0],
  goose: [c => goose(c, 0.6, 0.15, 1, 0.3), 0.78, -20, 130],
  bull: [c => bull(c, 0.5), 0.6, -30, 150],
  vacuum: [c => vacuum(c), 0.52, 130, 200],
  press: [c => press(c), 0.48, 0, 130],
  stamp: [c => stamp(c), 0.44, 0, 270],
};
export async function drawIcon(cv, id) {
  await loadArt();
  const c = cv.getContext('2d'), n = cv.width, [fn, k, ox, oy] = ICON[id];
  c.clearRect(0, 0, n, n); c.save(); c.translate(n / 2, n / 2); c.scale(n / 256 * k * 1.25, n / 256 * k * 1.25); c.translate(ox, oy); fn(c); c.restore();
}

// ---------------------------------------------------------------- efectos: destello de impacto, estela y líneas de velocidad
function impactFx(list, x, y, col = '#fff', size = 1) { list.push({ kind: 'hit', x, y, col, size, t0: performance.now() / 1000 }); }
function drawFxList(c, list, now) {
  for (let i = list.length - 1; i >= 0; i--) {
    const f = list[i], u = (now - f.t0) / 0.32; if (u > 1) { list.splice(i, 1); continue; }
    c.save(); c.translate(f.x, f.y); c.globalAlpha = 1 - u;
    const R = (90 + 160 * u) * f.size; c.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, r = k % 2 ? R * 0.45 : R; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath();
    c.fillStyle = f.col; c.fill(); c.lineWidth = 6; c.strokeStyle = INK; c.stroke();
    c.globalAlpha = (1 - u) * 0.9; c.fillStyle = '#fff'; el(c, 0, 0, R * 0.35, R * 0.35); c.fill(); c.restore();
  }
}
function speedLines(c, x0, x1, y, n = 7, dir = 1) {
  c.save(); c.lineCap = 'round'; for (let i = 0; i < n; i++) { const yy = y - 40 - i * 34, len = 120 + (i * 53 % 90); const g = c.createLinearGradient(x0, 0, x0 - dir * len, 0); g.addColorStop(0, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.strokeStyle = g; c.lineWidth = 7; c.beginPath(); c.moveTo(x0 - dir * (i % 3) * 20, yy); c.lineTo(x0 - dir * len, yy); c.stroke(); } c.restore();
}

// ---------------------------------------------------------------- animaciones
const FEET = 1050, HEAD = 480;
export async function runWeapon(sc, id) {
  await loadArt();
  const px = sc.pedX(), W = sc.wpn = { sx: 1, sy: 1, dx: 0, dy: 0, rot: 0, alpha: 1, hide: false };
  const fx = [], prop = { draw: null }; sc.prop = prop;
  const overFx = c => drawFxList(c, fx, performance.now() / 1000);
  const stars = (x, y, n = 10) => sc.burst(x, y, n, 'star', { min: 300, max: 850, g: 1400, r: [10, 20], life: [0.5, 1.0] });
  const hit = (x, y, col, size) => { impactFx(fx, x, y, col, size); stars(x, y, 12); };
  prop.over = overFx;
  try {
    if (id === 'hammer') {
      const H = { a: 0.75, sq: 0, x: px + 250, y: 630, al: 0 };
      prop.draw = c => { c.save(); c.globalAlpha = H.al; c.translate(H.x, H.y); c.rotate(H.a); hammer(c, H.sq); c.restore(); };
      sc.play('shock'); await sc.tween(H, { al: 1, a: 1.05 }, 0.4, 'o');            // coge impulso
      SFX.whoosh(); await sc.tween(H, { a: -1.1 }, 0.14, 'i');
      SFX.bonk(); SFX.squeak(); sc.doShake(16, 0.35); sc.bigText('¡BONK!', '#ff5a48', 330, 120); hit(px, HEAD - 40, '#ffe766', 1);
      H.sq = 1; W.sy = 0.42; W.sx = 1.55;
      sc.tween(H, { sq: 0 }, 0.45, 'b'); sc.play('wobble');
      await sc.tween(W, { sy: 1.22, sx: 0.84 }, 0.16, 'o'); await sc.tween(W, { sy: 0.92, sx: 1.06 }, 0.14, 'io'); await sc.tween(W, { sy: 1, sx: 1 }, 0.45, 'b');
      sc.tween(H, { a: 0.8, al: 0 }, 0.4, 'o'); sc.say('¡Esto es un ataque a la democracia!', 2.2); await sc.wait(0.6);
    } else if (id === 'slipper') {
      const S = { u: 0, back: false, rot: 0 }, p0 = [930, 1950], p1 = [1150, 260], p2 = [px + 20, HEAD - 20], trail = [];
      const bez = (a, b, d, u) => [(1 - u) ** 2 * a[0] + 2 * (1 - u) * u * b[0] + u * u * d[0], (1 - u) ** 2 * a[1] + 2 * (1 - u) * u * b[1] + u * u * d[1]];
      prop.draw = c => {
        const [x, y] = S.back ? bez(p2, [-120, 420], [p0[0] - 60, 2050], S.u) : bez(p0, p1, p2, S.u);
        trail.push([x, y, S.rot]); if (trail.length > 7) trail.shift();
        trail.forEach(([tx, ty, tr], i) => { c.save(); c.globalAlpha = (i + 1) / trail.length * 0.28; c.translate(tx, ty); c.rotate(tr); slipper(c); c.restore(); });
        c.save(); c.translate(x, y); c.rotate(S.rot); slipper(c); c.restore();
      };
      SFX.whoosh(); sc.tween(S, { rot: 14 }, 0.5, 'l'); await sc.tween(S, { u: 1 }, 0.5, 'i');
      SFX.slap(); sc.doShake(14, 0.3); sc.bigText('¡PLAS!', '#4aa3ff', 330, 120); hit(px + 10, HEAD - 30, '#bfe4ff', 0.9);
      sc.play('wobble'); W.rot = -0.22; W.sx = 1.12; W.sy = 0.9; sc.tween(W, { rot: 0, sx: 1, sy: 1 }, 0.7, 'b');
      S.back = true; S.u = 0; SFX.whoosh(); sc.tween(S, { rot: 30 }, 0.8, 'l'); await sc.tween(S, { u: 1 }, 0.8, 'o');
      sc.say('¡La chancla de mi madre no!', 2.0); await sc.wait(0.5);
    } else if (id === 'goose') {
      const G = { x: 1300, ph: 0, peck: 0, open: 0, flip: 1, flap: 0 }, GS = 1.25;
      prop.draw = c => { c.save(); c.translate(G.x, FEET + Math.abs(Math.sin(G.ph)) * -8); c.scale(-GS * G.flip, GS); goose(c, G.ph, G.peck, G.open, G.flap); c.restore(); };
      const flap = sc.tween(G, { ph: 44 }, 1.4, 'l'); const t0 = sc.now; prop.step = () => { G.flap = (Math.sin((sc.now - t0) * 22) + 1) / 2; };
      SFX.honk(); sc.play('shock'); sc.say('¡Socorro! ¡Una oca!', 1.6);
      sc.tween(W, { dx: -150 }, 1.0, 'o');
      await sc.tween(G, { x: px + 200 }, 1.0, 'o'); await flap; prop.step = null; G.flap = 0.2;
      for (let i = 0; i < 4; i++) {
        SFX.honk(); G.flap = 1; await sc.tween(G, { peck: 1, open: 1 }, 0.09, 'i');
        SFX.peck(); W.rot = (i % 2 ? 0.12 : -0.12); W.dx -= 14; sc.doShake(7, 0.12); hit(px + W.dx + 60, FEET - 330 + (i % 2) * 60, '#ffffff', 0.45);
        sc.burst(px + W.dx + 110, FEET - 280, 6, 'feather', { min: 120, max: 380, g: 300, r: [10, 16], life: [0.9, 1.5] });
        sc.tween(W, { rot: 0 }, 0.18, 'o'); G.flap = 0.3; await sc.tween(G, { peck: 0, open: 0 }, 0.15, 'o');
      }
      sc.bigText('¡HONK! ¡HONK!', '#ffffff', 320, 96); sc.play('wobble');
      G.flip = -1; prop.step = () => { G.flap = (Math.sin((sc.now - t0) * 22) + 1) / 2; }; sc.tween(G, { ph: 90 }, 1.0, 'l'); sc.tween(W, { dx: 0 }, 0.8, 'io'); await sc.tween(G, { x: 1400 }, 1.0, 'i');
    } else if (id === 'bull') {
      const B = { x: -380, ph: 0, run: 0 };
      prop.draw = c => { if (B.run) speedLines(c, B.x - 300, B.x + 300, FEET - 60, 7, 1); c.save(); c.translate(B.x, FEET); c.scale(1.4, 1.4); bull(c, B.ph); c.restore(); };
      sc.play('shock'); sc.say('¿Eso es un toro?', 1.4); SFX.moo();
      await sc.tween(B, { x: -150 }, 0.5, 'o');
      for (let i = 0; i < 3; i++) { SFX.hoof(); B.ph += 0.6; sc.burst(B.x - 140, FEET - 10, 7, 'dust', { angle: -Math.PI / 2 - 0.6, spread: 0.6, min: 80, max: 240, g: 100, r: [16, 30], life: [0.5, 0.8] }); await sc.wait(0.18); }
      B.run = 1; sc.tween(B, { ph: 30 }, 0.45, 'l'); SFX.charge();
      await sc.tween(B, { x: px - 430 }, 0.42, 'i');
      // ¡embestida! el coro grita «¡OLÉ!» justo en el impacto
      SFX.ole(); SFX.bonk(); sc.doShake(26, 0.5); sc.bigText('¡OLÉÉÉ!', '#ffd23f', 330, 130); hit(px - 60, FEET - 260, '#ffd23f', 1.3);
      sc.burst(px - 40, FEET - 20, 16, 'dust', { angle: -Math.PI / 2, spread: 1.2, min: 150, max: 480, g: 200, r: [18, 36], life: [0.6, 1.0] });
      sc.play('fall'); sc.tween(B, { x: 1600, ph: 75 }, 0.8, 'l');
      sc.tween(W, { rot: 7.5 }, 1.0, 'l'); sc.tween(W, { dx: 320 }, 1.0, 'l');
      await sc.tween(W, { dy: -1300 }, 0.6, 'o'); await sc.wait(0.35); B.run = 0;
      W.dx = 0; W.rot = 0; sc.play('landed');
      await sc.tween(W, { dy: 0 }, 0.55, 'bounce'); sc.doShake(10, 0.25); sc.say('¡Esto es acoso de la fachosfera!', 2.2); await sc.wait(0.4);
    } else if (id === 'vacuum') {
      const V = { x: 1450, suck: 0, bulge: 0 }, K = 1.15, vx = () => px + 660;
      prop.draw = c => { c.save(); c.translate(V.x, FEET); c.scale(K, K); vacuum(c, V.suck, V.bulge); c.restore();
        if (V.suck > 0.2) { c.save(); c.globalAlpha = V.suck * 0.75; c.strokeStyle = '#ffffff'; c.lineWidth = 7; c.lineCap = 'round'; const nx = V.x + NOZ.x * K, ny = FEET + NOZ.y * K;
          for (let i = 0; i < 7; i++) { const u = (sc.now * 2.5 + i / 7) % 1, d = 300 * (1 - u); c.beginPath(); c.arc(nx, ny, d, Math.PI - 0.55, Math.PI + 0.55); c.stroke(); } c.restore(); } };
      SFX.vacuumOn(); sc.play('shock'); await sc.tween(V, { x: vx() }, 0.7, 'o');
      sc.say('¡Eh! ¡Que me lleva!', 1.4); V.suck = 1; SFX.suck();
      await sc.tween(W, { rot: 0.38, sx: 0.66, sy: 1.3, dx: 90 }, 0.7, 'i');
      const nozzle = [vx() + NOZ.x * K - px, NOZ.y * K];
      await sc.tween(W, { dx: nozzle[0], dy: nozzle[1] + 120, sx: 0.04, sy: 0.04, rot: 3 }, 0.35, 'i');
      W.hide = true; SFX.gulp(); sc.bigText('¡SLURP!', '#7fdfff', 330, 120);
      for (let i = 0; i < 3; i++) { await sc.tween(V, { bulge: 1 }, 0.13, 'o'); await sc.tween(V, { bulge: 0 }, 0.13, 'i'); }
      await sc.wait(0.25); SFX.spit(); V.suck = 0; sc.doShake(16, 0.3);
      W.hide = false; W.rot = -4; sc.bigText('¡PTUI!', '#ffd23f', 330, 110); hit(px + nozzle[0], FEET + nozzle[1], '#bff3ff', 0.8);
      sc.burst(px + nozzle[0], FEET + nozzle[1], 12, 'dust', { angle: Math.PI, spread: 0.6, min: 200, max: 520, g: 200, r: [14, 26], life: [0.5, 0.9] });
      sc.play('landed'); sc.tween(W, { rot: 0 }, 0.6, 'o'); await sc.tween(W, { dx: 0, dy: 0, sx: 1, sy: 1 }, 0.6, 'b');
      sc.say('¡Esto es lawfare!', 1.8); await sc.tween(V, { x: 1700 }, 0.6, 'i');
    } else if (id === 'press') {
      const Pr = { y: -150 };
      prop.draw = c => { c.save(); c.translate(px + W.dx, Pr.y); press(c); c.restore(); };
      SFX.hiss(); sc.play('shock'); sc.say('¿Y esto qué es?', 1.2);
      await sc.tween(Pr, { y: FEET - 690 }, 0.8, 'io');
      SFX.clunk(); SFX.accordion(); sc.doShake(12, 0.3); hit(px, FEET - 700, '#c9d2e0', 0.7);
      const squeeze = { k: 0 }; sc.tween(squeeze, { k: 1 }, 1.1, 'o'); const t0 = sc.now;
      prop.step = () => { const k = squeeze.k; Pr.y = FEET - 690 + k * 520; W.sy = (FEET - Pr.y) / 690; W.sx = 1 + (1 - W.sy) * 0.9 + Math.sin((sc.now - t0) * 18) * 0.06 * k; };
      await sc.wait(1.1); sc.bigText('¡CRUNCH!', '#c9d2e0', 330, 120); await sc.wait(0.6);
      prop.step = null; SFX.hiss(); SFX.boing();
      sc.tween(Pr, { y: -200 }, 0.5, 'i'); await sc.tween(W, { sy: 1.4, sx: 0.82 }, 0.18, 'o'); sc.play('wobble'); await sc.tween(W, { sy: 1, sx: 1 }, 0.6, 'b');
      sc.say('¡Me habéis dejado hecho un acordeón!', 2.0); await sc.wait(0.4);
    } else if (id === 'stamp') {
      const St = { y: -250, rot: 0 }, mark = { a: 0, s: 1.6 };
      prop.draw = c => { c.save(); c.translate(px, St.y); c.rotate(St.rot); stamp(c); c.restore(); };
      prop.over = c => { if (mark.a > 0) stampMark(c, px + W.dx, FEET - 330, -0.22, mark.a, mark.s * 0.74); overFx(c); };
      sc.play('shock'); sc.say('No, no, no...', 1.0); SFX.drumroll(0.8);
      await sc.tween(St, { y: 230, rot: 0.08 }, 0.8, 'o');
      await sc.tween(St, { y: FEET - 30, rot: 0 }, 0.15, 'i');
      SFX.stampBig(); sc.doShake(24, 0.45); W.sy = 0.84; W.sx = 1.1; sc.tint = { a: 0.5 }; mark.a = 1; mark.s = 1; hit(px, FEET - 40, '#ff5a48', 1.2);
      sc.burst(px, FEET - 10, 14, 'dust', { angle: -Math.PI / 2, spread: 1.4, min: 150, max: 420, g: 200, r: [14, 26], life: [0.5, 0.9] });
      await sc.wait(0.25); sc.tween(W, { sx: 1, sy: 1 }, 0.4, 'b'); await sc.tween(St, { y: -500 }, 0.5, 'i');
      sc.bigText('¡CORRUPTO!', '#ff3b2f', 330, 120); sc.play('landed'); sc.say('¡Todo es mentira!', 2.0);
      await sc.wait(2.6); sc.tween(sc.tint, { a: 0 }, 0.8, 'o'); await sc.tween(mark, { a: 0 }, 0.8, 'o');
    }
  } finally { sc.wpn = null; sc.prop = null; sc.tint = null; }
}

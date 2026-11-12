// Pedro animable (Canvas 2D, sin dependencias).
// Cabeza y busto salen de la ilustración (assets/pedro/*.png, tools/pedro-parts.py); ojos, boca, brazos,
// manos, piernas y tomate se dibujan con el mismo estilo (contorno negro grueso + sombreado suave).
// Unidades: píxeles de la ilustración original (1312x1199). ROOT = punto de asiento sobre el tablón.

export const ROOT = [642, 1310];
const DROP = 150;                                       // cintura: separa el busto de las piernas
const NECK = [690, 790];
const SH_L = [300, 985], SH_R = [985, 985];            // hombros (espacio del torso)
const UPPER = 225, FORE = 215;                          // longitud de brazo y antebrazo
const SLEEVE = 132;                                     // grosor de la manga
export const NOSE = [748, 540];                         // punta de la nariz (espacio de la cabeza)
const OL = 9;                                           // grosor del contorno
const HS = 1.22;                                        // tamaño de las manos
const GRIP = 92;                                        // del puño de la camisa al centro de la mano

export const C = {
  ink: '#120b0a', skin: '#fbaa77', skinSh: '#df7f52', skinHi: '#ffd2ad',
  navy: '#26325e', navySh: '#161d3a', navyHi: '#41538f',
  shirt: '#fbfbfd', shirtSh: '#c3c8e4',
  shoe: '#18171c', shoeHi: '#7b8098',
  tom: '#e3312a', tomSh: '#9e1218', tomHi: '#ff9d88', leaf: '#46a63a', leafSh: '#256b26',
  mouth: '#4e0c14', mouthHi: '#7a1a24', tongue: '#f06a77', tongueSh: '#c2404f',
  eyeW: '#f8f4f3', eyeSh: '#c9cbe4', iris: '#3a1c0f', irisHi: '#7a4528',
};

// ---------------------------------------------------------------- pose por defecto (sentado, chulesco)
export const HAND = {
  rest: { c: [0.25, 0.04, 0.06, 0.1, 0.16], sp: 0.25 },
  open: { c: [0, 0, 0, 0, 0], sp: 1 },
  catch: { c: [0.15, 0.25, 0.3, 0.35, 0.4], sp: 0.7 },
  hold: { c: [0.45, 0.55, 0.6, 0.65, 0.7], sp: 0.3 },
  pinch: { c: [0.55, 0.45, 0.8, 0.9, 0.95], sp: 0.1 },
  fist: { c: [0.85, 1, 1, 1, 1], sp: 0 },
  middle: { c: [0.9, 1, 0, 1, 1], sp: 0 },
  point: { c: [0.8, 0, 1, 1, 1], sp: 0 },
};
const handParams = (s, name) => {
  const h = HAND[name], o = {};
  h.c.forEach((v, i) => (o[`h${s}${i}`] = v));
  o[`h${s}sp`] = h.sp;
  return o;
};
export const hand = (side, name) => handParams(side, name);

export const DEFAULT = {
  bx: 0, by: 0, lean: 0, sq: 1,
  hx: 0, hy: 0, hr: 0,
  lookX: 0.15, lookY: 0.1, cross: 0, lidL: 1, lidR: 1, happy: 0, eyeBig: 0, blinkOff: 0,
  bLy: 0, bLr: 0, bRy: 0, bRr: 0,
  mOpen: 0, mSmile: 1, mWide: 1, mSmirk: 0, mTongue: 0, mTeeth: 1, mRound: 0,
  blush: 0,
  aLx: 415, aLy: 1300, aLh: 0, aLhx: 380, aLhy: 520, aLb: 1, aLg: 0, aLk: 0.85, hLr: 0.75, hLs: 1, hLf: 0, hLw: 0,
  aRx: 870, aRy: 1300, aRh: 0, aRhx: 950, aRhy: 500, aRb: 1, aRg: 0, aRk: 0.85, hRr: -0.75, hRs: 1, hRf: 0, hRw: 0,
  ...handParams('L', 'rest'), ...handParams('R', 'rest'),
  legAmp: 1, legSpeed: 1, legOut: 0,
  tom: 0, tomX: 0, tomY: 0, tomS: 1, tomSqx: 1, tomSqy: 1, tomR: 0, tomHx: 0, tomHy: -10,
  breath: 1,
};
// parámetros que cambian de golpe (no se interpolan)
export const DISCRETE = new Set(['tom']);

// ---------------------------------------------------------------- utilidades geométricas
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = a => Math.hypot(a[0], a[1]);
const lerp = (a, b, t) => a + (b - a) * t;
const lerp2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
function xf(m, p) { return [m.a * p[0] + m.c * p[1] + m.e, m.b * p[0] + m.d * p[1] + m.f]; }

function ik(S, T, L1, L2, out, flip = 1) {
  const d = sub(T, S); let dist = len(d);
  let k = 1;
  const max = (L1 + L2) * 0.995;
  if (dist > max) { k = Math.min(dist / max, 1.25); }           // brazos de goma: estiran un poco
  const l1 = L1 * k, l2 = L2 * k;
  dist = Math.min(Math.max(dist, Math.abs(l1 - l2) + 1), (l1 + l2) * 0.999);
  const base = Math.atan2(d[1], d[0]);
  const a = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist))));
  // de las dos soluciones, el codo hacia fuera y hacia abajo (flip < 0 elige la otra)
  const cand = [base + a, base - a].map(g => [S[0] + Math.cos(g) * l1, S[1] + Math.sin(g) * l1]);
  const score = E => (E[0] - S[0]) * out + (E[1] - S[1]) * 0.7;
  const E = (score(cand[0]) >= score(cand[1])) === (flip > 0) ? cand[0] : cand[1];
  const fa = Math.atan2(T[1] - E[1], T[0] - E[0]);
  const W = [E[0] + Math.cos(fa) * l2, E[1] + Math.sin(fa) * l2];
  return { E, W, fa };
}

// línea gruesa con contorno: primero negro ancho, luego color
function tube(ctx, pts, w, color, cap = 'round') {
  const path = new Path2D(); path.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) path.lineTo(...pts[i]);
  ctx.lineCap = cap; ctx.lineJoin = 'round';
  ctx.strokeStyle = C.ink; ctx.lineWidth = w + OL * 2; ctx.stroke(path);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke(path);
  return path;
}
// sombra/brillo dentro de un tubo: misma línea desplazada hacia un lado
function tubeShade(ctx, pts, w, color, side, width, alpha = 1, blur = 3) {
  const off = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const t = sub(b, a), l = len(t) || 1, n = [-t[1] / l, t[0] / l];
    const d = (w / 2 - width / 2 - 2) * side;
    off.push([pts[i][0] + n[0] * d, pts[i][1] + n[1] * d]);
  }
  ctx.save(); ctx.globalAlpha = alpha; ctx.filter = `blur(${blur}px)`;
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(...off[0]); for (let i = 1; i < off.length; i++) ctx.lineTo(...off[i]); ctx.stroke();
  ctx.restore();
}
function blob(ctx, path, color) {
  ctx.lineJoin = 'round'; ctx.strokeStyle = C.ink; ctx.lineWidth = OL * 2; ctx.stroke(path);
  ctx.fillStyle = color; ctx.fill(path);
}
function ellipse(cx, cy, rx, ry, rot = 0) { const p = new Path2D(); p.ellipse(cx, cy, Math.max(rx, 0.1), Math.max(ry, 0.1), rot, 0, Math.PI * 2); return p; }

// ---------------------------------------------------------------- el personaje
export class PedroRig {
  constructor(imgs, parts) { this.img = imgs; this.parts = parts; }

  draw(ctx, P, t) {
    // capas procedimentales: respiración, parpadeo y piernas
    const br = Math.sin(t * Math.PI * 2 / 3.4) * P.breath;
    const sq = P.sq * (1 + br * 0.012);
    const blink = P.blink ?? (P.blinkOff ? 0 : blinkAt(t));
    const lid = v => Math.max(0, v * (1 - blink));
    P = { ...P, lidL: lid(P.lidL), lidR: lid(P.lidR), hy: P.hy + br * 3 };

    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.save(); ctx.translate(0, DROP); this.legs(ctx, P, t); ctx.restore();

    // ---- torso (busto de la ilustración), inclinado sobre el punto de asiento
    ctx.save();
    ctx.translate(ROOT[0] + P.bx, ROOT[1] + P.by); ctx.rotate(P.lean); ctx.scale(1, sq); ctx.translate(-ROOT[0], -ROOT[1]);
    const torsoM = ctx.getTransform();
    this.waist(ctx);
    const b = this.parts.bust; ctx.drawImage(this.img.bust, b.x, b.y, b.w, b.h);

    // ---- cabeza
    ctx.save();
    ctx.translate(NECK[0] + P.hx, NECK[1] + P.hy); ctx.rotate(P.hr); ctx.translate(-NECK[0], -NECK[1]);
    const headM = ctx.getTransform();
    const h = this.parts.head; ctx.drawImage(this.img.head, h.x, h.y, h.w, h.h);
    this.face(ctx, P, t);
    ctx.restore();
    ctx.restore();

    ctx.save(); ctx.translate(0, DROP); this.lap(ctx); ctx.restore();
    // ---- brazos: hombros en espacio del torso, objetivos en torso o en cabeza
    const inv = ctx.getTransform().inverse();
    const toLocal = m => p => xf(inv, xf(m, p));                     // de torso/cabeza a espacio actual
    const torsoP = toLocal(torsoM), headP = toLocal(headM);
    let grip = null;
    for (const s of ['L', 'R']) {
      const Tt = torsoP([P[`a${s}x`], P[`a${s}y`]]);
      const Th = headP([P[`a${s}hx`], P[`a${s}hy`]]);
      const T = lerp2(Tt, Th, P[`a${s}h`]);
      // el hombro sube un poco cuando la mano va por encima de él
      const sh = s === 'L' ? SH_L : SH_R;
      const S0 = torsoP(sh);
      const lift = Math.min(1, Math.max(0, (S0[1] - T[1] - 250) / 200)) * 40;
      const S = torsoP([sh[0], sh[1] - lift]);
      const gp = this.arm(ctx, s, S, T, P, t, s === 'R' && P.tom === 2);
      if (gp) grip = gp;
    }
    if (P.tom === 1) this.tomato(ctx, [P.tomX, P.tomY], 62 * P.tomS, P.tomSqx, P.tomSqy, P.tomR);
    // tomate en la mano: al acercarlo a la cara se va pegando a la nariz, así el paso a la nariz no salta
    const nose = headP(add(NOSE, [P.tomHx, P.tomHy]));
    if (P.tom === 2 && grip) this.tomato(ctx, lerp2(grip, nose, P.aRh ** 3), 62 * P.tomS, P.tomSqx, P.tomSqy, P.tomR + P.hr * P.aRh);
    if (P.tom === 3) this.tomato(ctx, nose, 62 * P.tomS, P.tomSqx, P.tomSqy, P.tomR + P.hr + P.lean);
    ctx.restore();
  }

  // ------------------------------------------------ cara: cejas, ojos, boca
  face(ctx, P, t) {
    const pv = this.parts.pivots;
    // mejillas sonrojadas (risa)
    if (P.blush > 0) {
      ctx.save(); ctx.globalAlpha = 0.35 * P.blush; ctx.filter = 'blur(14px)'; ctx.fillStyle = '#ff4a4a';
      ctx.fill(ellipse(560, 545, 55, 30)); ctx.fill(ellipse(870, 565, 30, 26)); ctx.restore();
    }
    // ojos
    eye(ctx, EYE_L, P.lidL, P, 1);
    eye(ctx, EYE_R, P.lidR, P, -1);
    // cejas (la ilustración original, movida y girada)
    for (const [k, y, r] of [['browL', P.bLy, P.bLr], ['browR', P.bRy, P.bRr]]) {
      const p = this.parts[k], c = pv[k];
      ctx.save(); ctx.translate(c[0], c[1] + y); ctx.rotate(r); ctx.translate(-c[0], -c[1]);
      ctx.drawImage(this.img[k], p.x, p.y, p.w, p.h); ctx.restore();
    }
    mouth(ctx, P, t);
  }

  // ------------------------------------------------ brazo + puño de camisa + mano
  arm(ctx, s, S, T, P, t, holding) {
    const sign = s === 'L' ? 1 : -1;
    // con agarre, el objetivo es el centro de la mano (donde va el tomate), no la muñeca
    // largo aparente del brazo: en reposo apunta hacia la cámara y se ve más corto (escorzo)
    const k = P[`a${s}k`], L1 = UPPER * k, L2 = FORE * (0.25 + 0.75 * k);
    let sol = ik(S, T, L1, L2, -sign, P[`a${s}b`]);
    const g = P[`a${s}g`];
    if (g > 0) for (let k = 0; k < 3; k++) {
      const a = sol.fa + P[`h${s}r`], d = GRIP * HS * P[`h${s}s`] * g;
      sol = ik(S, [T[0] - Math.cos(a) * d, T[1] - Math.sin(a) * d], L1, L2, -sign, P[`a${s}b`]);
    }
    const { E, W, fa } = sol;
    // mano (antes que la manga: el puño la tapa)
    const hs = P[`h${s}s`];
    const handAng = fa - Math.PI / 2 + P[`h${s}r`];
    const fingers = [0, 1, 2, 3, 4].map(i => P[`h${s}${i}`]);
    const facing = P[`h${s}f`] > 0.5;
    ctx.save(); ctx.translate(...W); ctx.rotate(handAng); ctx.scale(hs * HS, hs * HS);
    const mir = (s === 'L' ? 1 : -1) * (facing ? -1 : 1);
    drawHand(ctx, fingers, P[`h${s}sp`], mir, facing, P[`h${s}w`], t + (s === 'L' ? 0 : 0.37));
    ctx.restore();
    // manga: hombro -> codo -> muñeca (termina antes de la muñeca para dejar ver el puño)
    const dirW = [Math.cos(fa), Math.sin(fa)];
    const cuffEnd = W, cuffStart = sub(W, [dirW[0] * 26, dirW[1] * 26]);
    tube(ctx, [cuffStart, cuffEnd], 90, C.shirt, 'butt');
    const sleeveEnd = sub(W, [dirW[0] * 22, dirW[1] * 22]);
    const pts = [S, E, sleeveEnd];
    const W1 = SLEEVE, W2 = SLEEVE * 0.84;
    ctx.save();
    // contorno sin el casquete del hombro (queda dentro del busto)
    const clip = new Path2D(); clip.rect(-5000, -5000, 10000, 10000); clip.arc(S[0], S[1], SLEEVE * 0.42, 0, Math.PI * 2, true);
    ctx.clip(clip, 'nonzero');
    ctx.strokeStyle = C.ink; ctx.lineCap = 'round';
    ctx.lineWidth = W1 + OL * 2; ctx.beginPath(); ctx.moveTo(...S); ctx.lineTo(...E); ctx.stroke();
    ctx.lineCap = 'butt'; ctx.lineWidth = W2 + OL * 2; ctx.beginPath(); ctx.moveTo(...E); ctx.lineTo(...sleeveEnd); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = C.navy; ctx.beginPath(); ctx.arc(...S, W1 / 2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(...E, W1 / 2, 0, 7); ctx.fill();
    ctx.strokeStyle = C.navy; ctx.lineCap = 'butt';
    ctx.lineWidth = W1; ctx.beginPath(); ctx.moveTo(...S); ctx.lineTo(...E); ctx.stroke();
    ctx.lineWidth = W2; ctx.beginPath(); ctx.moveTo(...E); ctx.lineTo(...sleeveEnd); ctx.stroke();
    tubeShade(ctx, pts, W2, C.navySh, sign, W2 * 0.4, 0.9, 4);
    tubeShade(ctx, pts, W2, C.navyHi, -sign, W2 * 0.16, 0.55, 3);
    const SLEEVE_END = W2;
    // remate de la bocamanga
    const n = [-dirW[1], dirW[0]];
    ctx.strokeStyle = C.ink; ctx.lineWidth = OL; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sleeveEnd[0] + n[0] * (SLEEVE_END / 2 + OL / 2), sleeveEnd[1] + n[1] * (SLEEVE_END / 2 + OL / 2));
    ctx.lineTo(sleeveEnd[0] - n[0] * (SLEEVE_END / 2 + OL / 2), sleeveEnd[1] - n[1] * (SLEEVE_END / 2 + OL / 2));
    ctx.stroke();
    // arruga del codo
    const toE = sub(E, S), el = len(toE);
    const ang = Math.atan2(toE[1], toE[0]);
    ctx.save(); ctx.translate(...E); ctx.rotate(ang); ctx.strokeStyle = C.navySh; ctx.lineWidth = 5; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(-28, -sign * 30); ctx.quadraticCurveTo(-8, -sign * 12, -20, sign * 10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -sign * 40); ctx.quadraticCurveTo(14, -sign * 22, 6, -sign * 4); ctx.stroke();
    ctx.restore();
    void el;
    return holding ? [W[0] - Math.sin(handAng) * GRIP * HS * hs, W[1] + Math.cos(handAng) * GRIP * HS * hs] : null;
  }

  // ------------------------------------------------ cintura: chaqueta abrochada bajo el busto (detrás del busto)
  waist(ctx) {
    const T = 1095, X = 724;                       // X: centro de la chaqueta (la cara mira a 3/4)
    const body = new Path2D();
    body.moveTo(352, T); body.lineTo(1012, T);
    body.bezierCurveTo(1016, 1170, 990, 1215, 996, 1290);
    body.bezierCurveTo(1000, 1350, 900, 1372, X, 1372);
    body.bezierCurveTo(520, 1372, 330, 1352, 334, 1290);
    body.bezierCurveTo(338, 1215, 350, 1170, 352, T); body.closePath();
    blob(ctx, body, C.navy);
    ctx.save(); ctx.clip(body);
    // volumen: costados oscuros, centro algo más claro
    ctx.filter = 'blur(16px)';
    ctx.fillStyle = C.navySh; ctx.globalAlpha = 0.85; ctx.fill(ellipse(345, 1240, 70, 170)); ctx.fill(ellipse(1005, 1240, 60, 170));
    ctx.globalAlpha = 0.5; ctx.fill(ellipse(X, 1380, 330, 40));
    ctx.fillStyle = C.navyHi; ctx.globalAlpha = 0.35; ctx.fill(ellipse(560, 1200, 70, 110));
    ctx.filter = 'none'; ctx.globalAlpha = 1;
    // camisa y corbata en la abertura de la chaqueta
    const vee = new Path2D(); vee.moveTo(633, T - 2); vee.lineTo(809, T - 2); vee.lineTo(X, 1240); vee.closePath();
    ctx.fillStyle = C.shirt; ctx.fill(vee);
    ctx.save(); ctx.clip(vee);
    ctx.filter = 'blur(5px)'; ctx.fillStyle = C.shirtSh; ctx.globalAlpha = 0.8;
    ctx.fill(ellipse(640, 1120, 16, 80, -0.4)); ctx.fill(ellipse(805, 1120, 16, 80, 0.4)); ctx.filter = 'none'; ctx.globalAlpha = 1;
    const tie = new Path2D(); tie.moveTo(664, T - 4); tie.lineTo(788, T - 4); tie.lineTo(758, 1196); tie.lineTo(X + 2, 1232); tie.lineTo(694, 1196); tie.closePath();
    ctx.lineWidth = 8; ctx.strokeStyle = C.ink; ctx.stroke(tie);
    const tg = ctx.createLinearGradient(664, 0, 788, 0); tg.addColorStop(0, '#f02a2c'); tg.addColorStop(0.6, '#e01b22'); tg.addColorStop(1, '#a8121a');
    ctx.fillStyle = tg; ctx.fill(tie);
    ctx.restore();
    // solapas que bajan hasta el botón
    ctx.strokeStyle = C.ink; ctx.lineCap = 'round'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(634, T - 4); ctx.lineTo(X, 1242); ctx.lineTo(809, T - 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(509, T - 4); ctx.quadraticCurveTo(560, 1200, X - 2, 1250); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(894, T - 4); ctx.quadraticCurveTo(858, 1196, X + 4, 1250); ctx.stroke();
    // borde delantero bajo el botón
    ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(X, 1270); ctx.quadraticCurveTo(X - 8, 1330, X - 34, 1372); ctx.stroke();
    // bolsillos y pinzas
    ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(418, 1282); ctx.quadraticCurveTo(490, 1274, 566, 1280); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(850, 1278); ctx.quadraticCurveTo(912, 1272, 972, 1278); ctx.stroke();
    ctx.strokeStyle = C.navySh; ctx.lineWidth = 6; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(472, 1150); ctx.quadraticCurveTo(478, 1210, 476, 1270); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(918, 1150); ctx.quadraticCurveTo(914, 1210, 916, 1268); ctx.stroke();
    // arrugas de tensión desde el botón
    ctx.lineWidth = 5; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(X - 18, 1262); ctx.quadraticCurveTo(X - 70, 1250, X - 120, 1258); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X + 18, 1262); ctx.quadraticCurveTo(X + 60, 1252, X + 105, 1260); ctx.stroke();
    ctx.globalAlpha = 1;
    // botón
    ctx.fillStyle = '#121729'; ctx.strokeStyle = C.ink; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(X, 1258, 14, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#5d6890'; ctx.beginPath(); ctx.arc(X - 4, 1253, 4, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ------------------------------------------------ regazo y rodillas (tapan el borde inferior del busto)
  lap(ctx) {
    // muslos vistos de frente (escorzo): dos rodillas grandes unidas por la entrepierna
    const knees = [ellipse(526, 1196, 132, 84, 0.04), ellipse(760, 1196, 132, 84, -0.04)];
    const crotch = new Path2D(); crotch.roundRect(560, 1120, 170, 120, 30);
    ctx.lineJoin = 'round'; ctx.strokeStyle = C.ink; ctx.lineWidth = OL * 2;
    for (const k of knees) ctx.stroke(k);
    ctx.fillStyle = C.navy; ctx.fill(crotch); for (const k of knees) ctx.fill(k);
    ctx.save();
    for (const [i, k] of knees.entries()) {
      ctx.save(); ctx.clip(k); ctx.filter = 'blur(9px)';
      ctx.fillStyle = C.navySh; ctx.globalAlpha = 0.9; ctx.fill(ellipse(i ? 790 : 496, 1262, 150, 40));
      ctx.fillStyle = C.navyHi; ctx.globalAlpha = 0.55; ctx.fill(ellipse(i ? 742 : 510, 1170, 70, 30));
      ctx.restore();
    }
    ctx.restore();
    // pliegue entre las rodillas
    ctx.strokeStyle = C.ink; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(640, 1140); ctx.quadraticCurveTo(646, 1215, 642, 1262); ctx.stroke();
    ctx.strokeStyle = C.navySh; ctx.lineWidth = 5; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(440, 1150); ctx.quadraticCurveTo(500, 1135, 560, 1150); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(724, 1150); ctx.quadraticCurveTo(784, 1135, 844, 1150); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------ espinillas y zapatos, balanceándose
  legs(ctx, P, t) {
    const ph = t * Math.PI * 2 * 0.8 * P.legSpeed;
    for (const [s, kx, off] of [['L', 520, 0], ['R', 765, Math.PI * 0.85]]) {
      const phi = Math.sin(ph + off) * 0.55 * P.legAmp;          // ángulo de balanceo (adelante/atrás)
      const knee = [kx, 1225];
      const L = 205 * Math.cos(phi * 0.9) ;
      const out = (s === 'L' ? -1 : 1) * (P.legOut * 40 + 8);
      const ank = [kx + out + Math.sin(ph * 0.5 + off) * 6 * P.legAmp, knee[1] + L];
      const sc = 1 + Math.sin(phi) * 0.16;                          // hacia delante = más cerca = más grande
      const w = 118 * (1 + Math.sin(phi) * 0.05);
      tube(ctx, [knee, ank], w, C.navy, 'butt');
      tubeShade(ctx, [knee, ank], w, C.navySh, s === 'L' ? -1 : 1, w * 0.4, 0.85, 4);
      // zapato visto de frente
      ctx.save(); ctx.translate(ank[0], ank[1] + 18 * sc); ctx.scale(sc, sc); ctx.rotate((s === 'L' ? -1 : 1) * 0.08);
      const shoe = new Path2D();
      shoe.moveTo(-62, -10); shoe.bezierCurveTo(-70, 30, -52, 58, 0, 60); shoe.bezierCurveTo(52, 58, 70, 30, 62, -10);
      shoe.bezierCurveTo(40, -24, -40, -24, -62, -10); shoe.closePath();
      blob(ctx, shoe, C.shoe);
      ctx.save(); ctx.clip(shoe); ctx.filter = 'blur(3px)'; ctx.fillStyle = C.shoeHi; ctx.globalAlpha = 0.75;
      ctx.fill(ellipse(-18, 20, 24, 12, -0.3)); ctx.globalAlpha = 0.4; ctx.fill(ellipse(20, 8, 12, 6)); ctx.restore();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-58, 40); ctx.quadraticCurveTo(0, 66, 58, 40); ctx.stroke();
      ctx.restore();
      // bajo del pantalón sobre el zapato
      ctx.strokeStyle = C.ink; ctx.lineWidth = OL; ctx.beginPath();
      ctx.moveTo(ank[0] - w / 2 - 2, ank[1] - 4); ctx.quadraticCurveTo(ank[0], ank[1] + 10, ank[0] + w / 2 + 2, ank[1] - 4); ctx.stroke();
    }
  }

  // ------------------------------------------------ tomate
  tomato(ctx, c, r, sqx = 1, sqy = 1, rot = 0) {
    ctx.save(); ctx.translate(...c); ctx.rotate(rot); ctx.scale(sqx, sqy);
    const body = new Path2D();
    body.moveTo(0, -r * 0.82);
    body.bezierCurveTo(r * 0.55, -r * 1.02, r * 1.08, -r * 0.55, r * 1.02, r * 0.05);
    body.bezierCurveTo(r * 0.98, r * 0.72, r * 0.5, r * 0.98, 0, r * 0.96);
    body.bezierCurveTo(-r * 0.5, r * 0.98, -r * 0.98, r * 0.72, -r * 1.02, r * 0.05);
    body.bezierCurveTo(-r * 1.08, -r * 0.55, -r * 0.55, -r * 1.02, 0, -r * 0.82); body.closePath();
    ctx.lineJoin = 'round'; ctx.strokeStyle = C.ink; ctx.lineWidth = OL * 1.6; ctx.stroke(body);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r * 1.1);
    g.addColorStop(0, '#ff6a52'); g.addColorStop(0.55, C.tom); g.addColorStop(1, C.tomSh);
    ctx.fillStyle = g; ctx.fill(body);
    ctx.save(); ctx.clip(body);
    ctx.strokeStyle = C.tomSh; ctx.globalAlpha = 0.45; ctx.lineWidth = r * 0.08;
    ctx.beginPath(); ctx.moveTo(-r * 0.12, -r * 0.7); ctx.quadraticCurveTo(-r * 0.45, 0, -r * 0.18, r * 0.9); ctx.stroke();
    ctx.globalAlpha = 1; ctx.filter = 'blur(2px)'; ctx.fillStyle = '#fff';
    ctx.fill(ellipse(-r * 0.45, -r * 0.4, r * 0.2, r * 0.11, -0.7)); ctx.globalAlpha = 0.7; ctx.fill(ellipse(-r * 0.22, -r * 0.6, r * 0.06, r * 0.04));
    ctx.restore();
    // hojas
    const leaf = new Path2D();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.62 + Math.PI;
      const tip = [Math.cos(a) * r * 0.5, -r * 0.8 + Math.sin(a) * r * 0.26 + r * 0.12];
      leaf.moveTo(0, -r * 0.8);
      leaf.quadraticCurveTo((tip[0] + 0) / 2 + Math.sin(a) * r * 0.1, (tip[1] - r * 0.8) / 2 - r * 0.06, tip[0], tip[1]);
      leaf.quadraticCurveTo(tip[0] / 2 - Math.sin(a) * r * 0.1, (tip[1] - r * 0.8) / 2 + r * 0.06, 0, -r * 0.8);
    }
    ctx.lineWidth = OL; ctx.strokeStyle = C.ink; ctx.stroke(leaf); ctx.fillStyle = C.leaf; ctx.fill(leaf);
    tube(ctx, [[0, -r * 0.8], [r * 0.06, -r * 1.05]], r * 0.1, C.leafSh);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- parpadeo determinista
const BLINKS = []; { let s = 7, x = 0.9; while (x < 600) { BLINKS.push(x); s = (s * 9301 + 49297) % 233280; x += 2.2 + (s / 233280) * 2.8; } }
export function blinkAt(t) {
  for (const b of BLINKS) { if (b > t + 0.2) break; const d = t - b; if (d >= 0 && d < 0.17) return d < 0.06 ? d / 0.06 : 1 - (d - 0.06) / 0.11; }
  return 0;
}

// ---------------------------------------------------------------- ojos
// esquina exterior, esquina interior, control del párpado superior e inferior, centro del iris, radio
const EYE_L = { o: [571, 440], i: [697, 451], up: [626, 382], lo: [636, 466], c: [632, 436], r: 22 };
const EYE_R = { o: [886, 466], i: [792, 457], up: [834, 404], lo: [840, 484], c: [827, 454], r: 21 };
function eye(ctx, E, open, P, side) {
  const big = P.eyeBig, happy = P.happy;
  const up = [E.up[0], E.up[1] - big * 22], lo = [E.lo[0], E.lo[1] + big * 10];
  const o = [E.o[0] - side * big * 4, E.o[1]], i = [E.i[0] + side * big * 4, E.i[1]];
  // ojo cerrado: línea hacia abajo, o arco hacia arriba al reír. Abrir es interpolar desde ahí,
  // así el paso de abierto a cerrado es continuo (sin saltos de dibujo).
  const C0 = [lo[0], lo[1] - 6 - happy * 74];
  const u = lerp2(C0, up, open);
  const lw = lerp2(C0, [lo[0], lo[1] - happy * 18], Math.min(1, open * 2.5));
  const a = Math.min(1, open * 6);
  if (open > 0.004) {
    const w = new Path2D(); w.moveTo(...o); w.quadraticCurveTo(...u, ...i); w.quadraticCurveTo(...lw, ...o); w.closePath();
    ctx.save(); ctx.fillStyle = C.eyeW; ctx.fill(w); ctx.clip(w);
    // iris
    const lx = P.lookX + P.cross * side * -1, ly = P.lookY;
    const cx = E.c[0] + lx * 15 - (side === -1 ? 2 : 0), cy = E.c[1] + ly * 9 - big * 4;
    const r = E.r * (1 - big * 0.22);
    ctx.fillStyle = '#1a0b07'; ctx.beginPath(); ctx.arc(cx, cy, r + 1.5, 0, 7); ctx.fill();
    const g = ctx.createRadialGradient(cx, cy + r * 0.3, r * 0.2, cx, cy, r);
    g.addColorStop(0, C.irisHi); g.addColorStop(0.7, C.iris); g.addColorStop(1, '#1d0d07');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#080404'; ctx.beginPath(); ctx.arc(cx, cy, r * 0.45, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx - r * 0.38, cy - r * 0.32, r * 0.2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.42, cy - r * 0.3, r * 0.14, 0, 7); ctx.fill();
    // sombra del párpado sobre el blanco
    ctx.filter = 'blur(4px)'; ctx.strokeStyle = C.eyeSh; ctx.lineWidth = 14; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.moveTo(...o); ctx.quadraticCurveTo(u[0], u[1] + 8, ...i); ctx.stroke();
    ctx.restore();
    // línea del párpado inferior
    ctx.save(); ctx.globalAlpha = a;
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(...lerp2(o, i, 0.12)); ctx.quadraticCurveTo(...lw, ...lerp2(i, o, 0.04)); ctx.stroke();
    ctx.restore();
  }
  // párpado superior: trazo grueso con pestaña exterior
  ctx.strokeStyle = C.ink; ctx.lineWidth = 8 + a; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(...o); ctx.quadraticCurveTo(...u, ...i); ctx.stroke();
  ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(...o); ctx.lineTo(o[0] - side * 13, o[1] - 6 - happy * 4); ctx.stroke();
  if (a > 0) { ctx.save(); ctx.globalAlpha = a; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(...lerp2(o, u, 0.15)); ctx.lineTo(o[0] - side * 10, o[1] - 16); ctx.stroke(); ctx.restore(); }
}

// ---------------------------------------------------------------- boca
const ML = [598, 589], MR = [830, 617];
function mouth(ctx, P, t) {
  const w = P.mWide, sm = P.mSmile, op = P.mOpen, rd = P.mRound;
  const mid = lerp2(ML, MR, 0.5);
  // las esquinas se cierran hacia el centro con la boca redonda y se abren con la sonrisa
  const shrink = 1 - rd * 0.55;
  const L = [mid[0] + (ML[0] - mid[0]) * w * shrink, ML[1] - sm * 6 + rd * 10 + op * 6];
  const R = [mid[0] + (MR[0] - mid[0]) * w * shrink, MR[1] - sm * 6 - P.mSmirk * 22 + rd * 4 + op * 4];
  const sag = 30 * sm;                          // la sonrisa hunde el centro de la línea
  const m2 = lerp2(L, R, 0.55);
  const upC = [m2[0], m2[1] + sag - op * 34 - rd * 22];
  const loC = [m2[0], m2[1] + sag + op * 120 + rd * 40];
  const k = Math.min(1, (op + rd) / 0.12);               // 0 cerrada ... 1 abierta (fundido entre las dos)
  if (k < 1) {
    ctx.save(); ctx.globalAlpha = 1 - k;
    // boca cerrada: trazo cónico (como en la ilustración) con hoyuelos en las comisuras
    const p = new Path2D();
    p.moveTo(...L); p.quadraticCurveTo(upC[0], upC[1] - 5, ...R); p.quadraticCurveTo(upC[0], upC[1] + 7, ...L);
    ctx.fillStyle = C.ink; ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.fill(p); ctx.stroke(p);
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(...L); ctx.quadraticCurveTo(L[0] - 8, L[1] - 6, L[0] - 3, L[1] - 15); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(...R); ctx.quadraticCurveTo(R[0] + 10, R[1] - 2, R[0] + 6, R[1] - 12); ctx.stroke();
    // labio inferior: sombra suave
    ctx.save(); ctx.filter = 'blur(5px)'; ctx.globalAlpha = 0.35; ctx.fillStyle = C.skinSh;
    ctx.fill(ellipse(upC[0] - 5, upC[1] / 2 + (L[1] + R[1]) / 4 + 22, 70, 9)); ctx.restore();
    ctx.restore();
  }
  if (op + rd > 0.003) {
    ctx.save(); ctx.globalAlpha = Math.min(1, (op + rd) / 0.04);
    const p = new Path2D();
    p.moveTo(...L); p.quadraticCurveTo(...upC, ...R); p.quadraticCurveTo(...loC, ...L); p.closePath();
    ctx.save();
    ctx.fillStyle = C.mouth; ctx.fill(p); ctx.clip(p);
    // dientes de arriba
    if (P.mTeeth > 0) {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(L[0] - 10, L[1] - 30);
      ctx.quadraticCurveTo(upC[0], upC[1] - 30, R[0] + 10, R[1] - 30);
      ctx.lineTo(R[0] + 10, R[1] + 4); ctx.quadraticCurveTo(upC[0], upC[1] + 52 * P.mTeeth * Math.min(1, op * 2), L[0] - 10, L[1] + 4); ctx.fill();
      ctx.strokeStyle = '#d8d6e6'; ctx.lineWidth = 3; ctx.globalAlpha = 0.8;
      for (const f of [0.3, 0.5, 0.7]) { const x = lerp(L[0], R[0], f); ctx.beginPath(); ctx.moveTo(x, upC[1] / 2 + L[1] / 2 - 10); ctx.lineTo(x, upC[1] / 2 + L[1] / 2 + 20); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    // lengua al fondo
    if (op > 0.3) { ctx.fillStyle = C.tongue; ctx.fill(ellipse(loC[0] - 4, loC[1] - (loC[1] - upC[1]) * 0.12, (R[0] - L[0]) * 0.26, (loC[1] - upC[1]) * 0.22 * Math.min(1, (op - 0.3) * 2))); }
    ctx.restore();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 8; ctx.lineJoin = 'round'; ctx.stroke(p);
    ctx.restore();
  }
  // lengua fuera (burla)
  if (P.mTongue > 0.02) {
    const tg = P.mTongue, base = [lerp(L[0], R[0], 0.52), (upC[1] + loC[1]) / 2 + 10];
    const wig = Math.sin(t * 22) * 6 * tg;
    const tp = new Path2D();
    tp.moveTo(base[0] - 46, base[1] - 4);
    tp.bezierCurveTo(base[0] - 54 + wig, base[1] + 70 * tg, base[0] + 54 + wig, base[1] + 70 * tg, base[0] + 46, base[1] - 4);
    tp.closePath();
    blob(ctx, tp, C.tongue);
    ctx.strokeStyle = C.tongueSh; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(base[0] + wig * 0.3, base[1] + 4); ctx.lineTo(base[0] + wig * 0.6, base[1] + 34 * tg); ctx.stroke();
    // labio inferior por encima de la base de la lengua
    ctx.strokeStyle = C.ink; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(base[0] - 50, base[1] - 6); ctx.quadraticCurveTo(base[0], base[1] + 6, base[0] + 50, base[1] - 6); ctx.stroke();
  }
}

// ---------------------------------------------------------------- mano procedimental
// origen en la muñeca, +y hacia los dedos. c[0]=pulgar, c[1..4]=índice..meñique (0 estirado, 1 cerrado).
const FING = [ // x base, longitud, grosor, abanico
  [31, 70, 26, 0.16], [10, 80, 27, 0.04], [-11, 73, 26, -0.07], [-31, 58, 23, -0.2],
];
function drawHand(ctx, c, spread, mir, palm, wig, t) {
  ctx.save(); ctx.scale(mir, 1);
  const palmP = new Path2D(); palmP.roundRect(-47, 0, 94, 92, [26, 26, 34, 34]);
  const fingerPts = FING.map(([x, L, w, fan], k) => {
    const cu = c[k + 1];
    const a = fan * (0.4 + spread * 1.4) + Math.sin(t * 18 + k * 1.3) * 0.22 * wig;
    const l = L * (1 - cu * 0.78);
    const b = [x * (1 + spread * 0.08), 82];
    return { b, tip: [b[0] + Math.sin(a) * l, b[1] + Math.cos(a) * l], w, cu };
  });
  // pulgar: estirado hacia fuera, cerrado cruzando la palma
  const tc = c[0], ta = lerp(-0.85, 0.55, tc) - spread * 0.25 + Math.sin(t * 15) * 0.15 * wig;
  const tb = [40, 34], tl = 62 * (1 - tc * 0.35);
  const thumbTip = [tb[0] + Math.sin(-ta) * tl * -1, tb[1] + Math.cos(ta) * tl];
  const drawThumb = () => {
    ctx.strokeStyle = C.ink; ctx.lineWidth = 30 + OL * 2; ctx.beginPath(); ctx.moveTo(...tb); ctx.lineTo(...thumbTip); ctx.stroke();
    ctx.strokeStyle = C.skin; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(...tb); ctx.lineTo(...thumbTip); ctx.stroke();
  };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (!palm) drawThumb();                          // dorso: el pulgar queda detrás
  // dedos (del meñique al índice, el corazón al final si está estirado y el resto cerrado)
  const order = [3, 2, 0, 1].sort((a, b) => (fingerPts[a].cu < 0.5 && fingerPts[b].cu >= 0.5 ? 1 : 0) - (fingerPts[b].cu < 0.5 && fingerPts[a].cu >= 0.5 ? 1 : 0));
  ctx.strokeStyle = C.ink; ctx.lineWidth = OL * 2; ctx.stroke(palmP);
  for (const k of order) {
    const f = fingerPts[k];
    ctx.strokeStyle = C.ink; ctx.lineWidth = f.w + OL * 2; ctx.beginPath(); ctx.moveTo(...f.b); ctx.lineTo(...f.tip); ctx.stroke();
    ctx.strokeStyle = C.skin; ctx.lineWidth = f.w; ctx.beginPath(); ctx.moveTo(...f.b); ctx.lineTo(...f.tip); ctx.stroke();
  }
  ctx.fillStyle = C.skin; ctx.fill(palmP);
  // sombreado de la palma/dorso
  ctx.save(); ctx.clip(palmP); ctx.filter = 'blur(6px)'; ctx.fillStyle = C.skinSh; ctx.globalAlpha = 0.55;
  ctx.fill(ellipse(-40, 50, 22, 60)); ctx.fillStyle = C.skinHi; ctx.globalAlpha = 0.5; ctx.fill(ellipse(10, 35, 26, 18)); ctx.restore();
  // nudillos de los dedos cerrados sobre la palma
  for (const k of order) {
    const f = fingerPts[k];
    if (f.cu > 0.5) {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.beginPath();
      ctx.moveTo(f.b[0] - f.w / 2 + 3, f.b[1] + 4); ctx.quadraticCurveTo(f.b[0], f.b[1] + 10, f.b[0] + f.w / 2 - 3, f.b[1] + 4); ctx.stroke();
    } else {
      // dedo estirado: tapar la unión con la palma y marcar la uña en el dorso
      ctx.strokeStyle = C.skin; ctx.lineWidth = f.w; ctx.beginPath(); ctx.moveTo(f.b[0], f.b[1] - 18); ctx.lineTo(...lerp2(f.b, f.tip, 0.15)); ctx.stroke();
      if (!palm) {
        // pliegues de los nudillos
        ctx.strokeStyle = C.skinSh; ctx.lineWidth = 3; ctx.globalAlpha = 0.75;
        for (const q of [0.38, 0.68]) { const m = lerp2(f.b, f.tip, q); ctx.beginPath(); ctx.moveTo(m[0] - f.w * 0.22, m[1]); ctx.quadraticCurveTo(m[0], m[1] + 3, m[0] + f.w * 0.22, m[1]); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
    }
  }
  if (palm) {
    drawThumb();
    ctx.strokeStyle = C.skinSh; ctx.lineWidth = 4; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(-30, 62); ctx.quadraticCurveTo(0, 48, 28, 30); ctx.stroke(); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- carga de imágenes
export async function loadPedro(base = 'assets/pedro/') {
  const parts = await (await fetch(base + 'parts.json')).json();
  const names = ['head', 'browL', 'browR', 'bust'];
  const imgs = {};
  await Promise.all(names.map(n => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(imgs[n] = i); i.onerror = rej; i.src = base + n + '.png'; })));
  return new PedroRig(imgs, parts);
}

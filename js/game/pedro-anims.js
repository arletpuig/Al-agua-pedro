// Animaciones de Pedro: fotogramas clave sobre los parámetros de pose de pedro-rig.js.
// Cada clave dice "en el instante t estos parámetros valen esto" y `d` es cuánto dura el movimiento
// que lleva hasta ahí (por defecto 0.3 s). Antes de empezar ese movimiento el valor se mantiene.
// `e` es la curva: io (suave), o (frena), i (acelera), b (se pasa y vuelve), el (elástico), l (lineal).
//
// Para que el movimiento no sea robótico, encima de las claves se aplica:
//  - retraso: la cabeza y las muñecas siguen al cuerpo unas centésimas tarde (acción superpuesta)
//  - pose viva: nada se queda congelado del todo entre claves (ligera deriva de cabeza, tronco y brazos)
//  - parpadeos colocados a mano en las acciones (los automáticos solo en la espera)
//  - `fx` añade movimiento procedimental propio de cada animación
import { DEFAULT, DISCRETE, hand, blinkAt, STRIDE } from './pedro-rig.js';

const EASE = {
  l: x => x,
  io: x => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  s: x => 0.5 - Math.cos(Math.PI * x) / 2,
  o: x => 1 - (1 - x) ** 3,
  i: x => x ** 3,
  b: x => { const c = 1.7; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; },
  el: x => (x === 0 || x === 1 ? x : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
};
// parámetros que van con retraso respecto al resto (segundos)
const LAG = { hr: 0.07, hx: 0.07, hy: 0.06, hLr: 0.08, hRr: 0.08, bLy: -0.03, bRy: -0.03, tomR: 0.05 };

function compile(clip) {
  const tracks = {};
  for (const k of clip.keys) for (const [p, v] of Object.entries(k)) {
    if (p === 't' || p === 'e' || p === 'd') continue;
    if (!(p in DEFAULT)) throw new Error(`parámetro desconocido: ${p}`);
    (tracks[p] ||= []).push({ t: k.t, v, e: k.e || 'io', d: k.d ?? 0.3 });
  }
  for (const tr of Object.values(tracks)) tr.sort((a, b) => a.t - b.t);
  clip.tracks = tracks;
  return clip;
}
function track(tr, p, t) {
  let v = DEFAULT[p], prevT = -1e9;
  for (const k of tr) {
    const start = Math.max(prevT, k.t - k.d);
    if (t >= k.t) { v = k.v; prevT = k.t; continue; }
    if (t > start && !DISCRETE.has(p)) v = v + (k.v - v) * EASE[k.e]((t - start) / (k.t - start));
    break;
  }
  return v;
}
function blinkList(list, t) {
  for (const b of list) { const d = t - b; if (d >= 0 && d < 0.2) return d < 0.07 ? EASE.s(d / 0.07) : 1 - EASE.s((d - 0.07) / 0.13); }
  return 0;
}

export function sample(clip, t) {
  const P = { ...DEFAULT };
  for (const [p, tr] of Object.entries(clip.tracks)) P[p] = track(tr, p, LAG[p] ? Math.max(0, t - LAG[p]) : t);
  // pose viva
  const n = (f, ph) => Math.sin(t * f + ph);
  P.hr += 0.014 * n(1.3, 0.4) + 0.008 * n(2.9, 1.7);
  P.hx += 3 * n(0.9, 2.1); P.hy += 2 * n(1.7, 0.3);
  P.lean += 0.006 * n(0.7, 1.1);
  P.aLx += 3 * n(1.1, 0.2); P.aLy += 2.5 * n(1.6, 2.4); P.aRx += 3 * n(1.0, 1.4); P.aRy += 2.5 * n(1.5, 0.9);
  P.bLy += 1.5 * n(0.8, 0.5); P.bRy += 1.5 * n(0.75, 2.5);
  P.blink = clip.blinks ? blinkList(clip.blinks, t) : blinkAt(t);
  // paso: la fase sale de la posición (los pies no patinan) y la intensidad, de la velocidad
  if (clip.tracks.px) {
    const dt = 0.05, v = (P.px - track(clip.tracks.px, 'px', Math.max(0, t - dt))) / dt;
    const k = Math.min(1, Math.abs(v) / 240);
    P.walkAmt = k * k * (3 - 2 * k); P.walkPh = P.px / STRIDE; P.walkDir = Math.sign(v) || 1;
  }
  clip.fx?.(P, t);
  return P;
}
const win = (t, a, b, ramp = 0.25) => Math.max(0, Math.min(1, (t - a) / ramp, (b - t) / ramp));
const bez = (a, c, b, u) => (1 - u) ** 2 * a + 2 * (1 - u) * u * c + u * u * b;
// vuelta al reposo: todo lo que tocan las animaciones vuelve al valor por defecto
const REST = {
  bx: 0, by: 0, lean: 0, sq: 1, hx: 0, hy: 0, hr: 0, lookX: DEFAULT.lookX, lookY: DEFAULT.lookY, cross: 0,
  lidL: 1, lidR: 1, happy: 0, eyeBig: 0, bLy: 0, bLr: 0, bRy: 0, bRr: 0, mOpen: 0, mSmile: 1, mWide: 1,
  mSmirk: 0, mTongue: 0, mRound: 0, mTeeth: 1, blush: 0, stance: 0,
  aLx: DEFAULT.aLx, aLy: DEFAULT.aLy, aLh: 0, aLg: 0, aLk: DEFAULT.aLk, aRx: DEFAULT.aRx, aRy: DEFAULT.aRy, aRh: 0, aRg: 0, aRk: DEFAULT.aRk,
  hLr: DEFAULT.hLr, hRr: DEFAULT.hRr, hLs: 1, hRs: 1, hLf: 0, hRf: 0, hLw: 0, hRw: 0,
  ...hand('L', 'rest'), ...hand('R', 'rest'),
};
const rest = (t, d = 0.6, keep = {}) => ({ t, d, ...REST, ...keep });
const AX = DEFAULT.aRx, AY = DEFAULT.aRy, LY = DEFAULT.aLy;

// ------------------------------------------------------------------ esperando de pie: pasea por el trampolín (bucle)
export const idle = compile({
  dur: 13, loop: true,
  keys: [
    // mira a la izquierda (los ojos primero, la cabeza después) y echa a andar hacia la punta
    { t: 0.8, d: 0.18, lookX: -0.95, lookY: 0.3 },
    { t: 1.1, d: 0.45, hr: -0.05, hx: -6 },
    { t: 3.4, d: 2.2, px: -560 },
    // se asoma a la pecera: las pirañas
    { t: 3.7, d: 0.3, lookX: -0.4, lookY: 1, hr: -0.08, hy: 10, lean: -0.03 },
    { t: 3.85, d: 0.25, e: 'o', bLy: -16, bRy: -16, eyeBig: 0.35, mRound: 0.35, mSmile: 0.1 },
    { t: 4.9, d: 0.2, bLy: -16, bRy: -16, eyeBig: 0.35, mRound: 0.35, mSmile: 0.1, lookY: 1 },
    // mira a cámara, chulesco: «a mí no me tiras»
    { t: 5.15, d: 0.2, lookX: 0.1, lookY: 0.05 },
    { t: 5.5, d: 0.45, hr: 0.06, hx: 0, hy: 0, lean: 0, eyeBig: 0, mRound: 0, mSmile: 1, bLy: 0 },
    { t: 5.55, d: 0.3, e: 'o', bRy: -18, bRr: -0.07, mSmirk: 0.8, lidL: 0.82, lidR: 0.82 },
    { t: 6.4, d: 0.4, bRy: 0, bRr: 0, mSmirk: 0, lidL: 1, lidR: 1, hr: 0 },
    // vuelve hacia la torre mirando la diana
    { t: 6.6, d: 0.2, lookX: 0.95, lookY: -0.5 },
    { t: 9.0, d: 2.4, px: 380 },
    { t: 7.0, d: 0.45, hr: 0.05 },
    // silba mirando la diana
    { t: 9.3, d: 0.3, mRound: 0.5, mSmile: 0.3, bLy: -6, bRy: -6, lookX: 0.95, lookY: -0.75, hr: 0.08 },
    { t: 10.2, d: 0.3, mRound: 0, mSmile: 1, bLy: 0, bRy: 0 },
    // se encoge de hombros y vuelve al centro
    { t: 10.6, d: 0.35, e: 'o', by: -16, sq: 1.02, aLy: DEFAULT.aLy - 40, aRy: DEFAULT.aRy - 40, aLx: DEFAULT.aLx - 20, aRx: DEFAULT.aRx + 20, hy: -10, bLy: -10, bRy: -12, hr: -0.04, mSmile: 0.6, lookX: 0.1, lookY: 0.05, ...hand('L', 'open'), ...hand('R', 'open'), hLf: 1, hRf: 1 },
    { t: 11.2, d: 0.5, by: 0, sq: 1, aLy: DEFAULT.aLy, aRy: DEFAULT.aRy, aLx: DEFAULT.aLx, aRx: DEFAULT.aRx, hy: 0, bLy: 0, bRy: 0, hr: 0, mSmile: 1, ...hand('L', 'rest'), ...hand('R', 'rest'), hLf: 0, hRf: 0 },
    { t: 12.8, d: 1.5, px: 0 },
    rest(12.9, 0.5),
  ],
});

// ------------------------------------------------------------------ atrapa el tomate, se lo pone de nariz y se burla
const START = [1390, 5245], CTRL = [1560, 1500], CATCH = [1235, 790];
const T0 = 0.3, T1 = 0.97;                                         // vuelo del tomate
const THIGH_L = [470, 1580], THIGH_R = [910, 1580];
export const catchNose = compile({
  dur: 8.8,
  blinks: [0.15, 1.75, 2.7, 3.75, 7.8],
  keys: [
    // el tomate sale desde el jugador; Pedro lo ve venir
    { t: T0, d: 0, tom: 1 },
    { t: 0.45, d: 0.15, lookX: 0.5, lookY: 0.95 },
    { t: 0.6, d: 0.25, e: 'o', eyeBig: 0.45, bLy: -14, bRy: -16, mRound: 0.3, mSmile: 0.2, lean: -0.03 },
    { t: T1, d: 0.5, e: 's', lookX: 0.95, lookY: -0.35 },
    // estira el brazo con la mano abierta
    { t: 0.6, d: 0.2, ...hand('R', 'open'), hRf: 1 },
    { t: 0.94, d: 0.42, aRx: CATCH[0], aRy: CATCH[1], aRg: 1, hRr: -0.1, lean: 0.07, hr: 0.08 },
    // ¡atrapado! la mano cede con el golpe
    { t: T1, d: 0, tom: 2, tomSqx: 1.3, tomSqy: 0.72 },
    { t: 1.05, d: 0.08, ...hand('R', 'catch') },
    { t: 1.14, d: 0.17, e: 'o', aRx: CATCH[0] + 45, aRy: CATCH[1] + 45, lean: 0.1, sq: 0.97, eyeBig: 0.6 },
    { t: 1.5, d: 0.5, e: 'el', tomSqx: 1, tomSqy: 1 },
    // lo mira
    { t: 1.7, d: 0.55, aRx: 1090, aRy: 840, lean: 0.03, sq: 1, ...hand('R', 'hold'), eyeBig: 0, mRound: 0, mSmile: 1, bLy: 0, bRy: 0, hr: 0.06 },
    { t: 1.45, d: 0.2, lookX: 0.8, lookY: -0.1 },
    // mira a cámara con picardía y sube y baja las cejas
    { t: 2.05, d: 0.16, lookX: 0, lookY: 0 },
    { t: 2.2, d: 0.35, mSmirk: 0.9, lidL: 0.8, lidR: 0.8, hr: 0.04 },
    { t: 2.32, d: 0.12, e: 's', bLy: -16, bRy: -16 }, { t: 2.45, d: 0.13, e: 's', bLy: 0, bRy: 0 },
    { t: 2.57, d: 0.12, e: 's', bLy: -16, bRy: -16 }, { t: 2.72, d: 0.15, e: 's', bLy: 0, bRy: 0 },
    // se lo lleva a la nariz (bizquea al acercarlo)
    { t: 2.7, d: 0, aRhx: 748, aRhy: 548 },
    { t: 3.2, d: 0.48, aRh: 1, hRr: -0.25, hr: -0.04, hy: -4, mSmirk: 0.3, eyeBig: 0.25, lidL: 1, lidR: 1 },
    { t: 3.15, d: 0.3, cross: 1, lookY: 0.6, lookX: 0 },
    // ¡plof! se queda pegado
    { t: 3.22, d: 0, tom: 3, tomSqx: 1.35, tomSqy: 0.72 },
    { t: 3.28, d: 0.06, hy: 6 },
    { t: 3.7, d: 0.42, e: 'el', tomSqx: 1, tomSqy: 1, hy: 0 },
    // la mano se aparta hacia fuera y baja
    { t: 3.48, d: 0.26, e: 's', aRhx: 930, aRhy: 640, aRg: 0, ...hand('R', 'open') },
    { t: 4.0, d: 0.52, aRh: 0, aRx: AX, aRy: AY, ...hand('R', 'rest'), hRf: 0, hRr: DEFAULT.hRr },
    { t: 3.65, d: 0.25, cross: 0, lookX: 0.05, lookY: 0.05, eyeBig: 0, mSmirk: 0.5 },
    // burla: manos a las sienes con los dedos meneándose y la lengua fuera
    { t: 4.01, d: 0, aLhx: 285, aLhy: 520, aRhx: 1035, aRhy: 500 },
    { t: 4.55, d: 0.5, aLh: 1, aRh: 1, ...hand('L', 'open'), ...hand('R', 'open'), hLf: 1, hRf: 1, hLr: -0.3, hRr: 0.3 },
    { t: 4.6, d: 0.2, hLw: 1, hRw: 1 },
    { t: 4.45, d: 0.3, e: 'o', mTongue: 1, mOpen: 0.22, mSmile: 0.6, mSmirk: 0, mTeeth: 0, lidL: 0, lidR: 0, happy: 1, bLy: -12, bRy: -12 },
    // carcajada dándose palmadas en los muslos
    { t: 6.15, d: 0.2, hLw: 0, hRw: 0 },
    { t: 6.6, d: 0.45, aLh: 0, aRh: 0, aLx: THIGH_L[0], aLy: THIGH_L[1], aRx: THIGH_R[0], aRy: THIGH_R[1], ...hand('L', 'rest'), ...hand('R', 'rest'), hLf: 0, hRf: 0, hLr: -0.5, hRr: 0.5 },
    { t: 6.45, d: 0.3, e: 'o', mTongue: 0, mOpen: 1, mTeeth: 1, mSmile: 1.2, blush: 1, hr: -0.09, hy: -10, bLy: -6, bRy: -6 },
    rest(8.3, 0.7, { mSmirk: 0.3 }),
  ],
  fx(P, t) {
    // vuelo del tomate: parábola que se aleja de la cámara (se hace pequeño) girando
    if (P.tom === 1) {
      const u = Math.min(1, (t - T0) / (T1 - T0)), e = 1 - (1 - u) ** 1.6;
      P.tomX = bez(START[0], CTRL[0], CATCH[0], e); P.tomY = bez(START[1], CTRL[1], CATCH[1], e);
      P.tomS = 2.6 - 1.6 * e; P.tomR = u * 5;
    }
    const w = win(t, 4.55, 6.2, 0.3);
    const wob = Math.sin((t - 4.55) * 8.5);
    P.hr += wob * 0.09 * w; P.bx += wob * 10 * w; P.hx += Math.sin((t - 4.62) * 8.5) * 7 * w;
    P.aLhy += wob * 10 * w; P.aRhy -= wob * 10 * w;
    // la burla con saltitos: dobla las rodillas al ritmo
    P.by += Math.abs(wob) * 14 * w;
    const l = win(t, 6.45, 7.7, 0.2);
    const k = Math.abs(Math.sin((t - 6.45) * 12));
    P.by -= k * 14 * l; P.sq += (k - 0.5) * 0.03 * l; P.hy -= k * 8 * l; P.mOpen -= (1 - k) * 0.35 * l; P.lean -= 0.05 * l;
    P.aLy -= Math.max(0, Math.sin((t - 6.45) * 12)) * 60 * l; P.aRy -= Math.max(0, Math.sin((t - 6.45) * 12 + 1.2)) * 60 * l;
    if (P.tom === 3 && t > 3.7) P.tomR += Math.sin(t * 9) * 0.06;
  },
});

// ------------------------------------------------------------------ peineta (con la otra mano en la cadera)
export const peineta = compile({
  dur: 5.8,
  blinks: [0.1, 3.35, 5.2],
  keys: [
    { t: 0.2, d: 0.15, lookX: 0, lookY: 0 },
    { t: 0.45, d: 0.35, e: 'o', lidL: 0.68, lidR: 0.68, bRy: -18, bRr: -0.08, bLy: 4, mSmirk: 0.9, hr: 0.05 },
    // mano izquierda a la cadera
    { t: 0.7, d: 0.4, aLx: 440, aLy: 1330, ...hand('L', 'hip'), hLr: -1.5, stance: 0.6 },
    // anticipación: se echa atrás y baja el brazo
    { t: 0.85, d: 0.4, lean: -0.05, sq: 0.98, aRx: 990, aRy: 1530, ...hand('R', 'fist'), hRr: 0.3 },
    // ¡arriba!
    { t: 1.15, d: 0.3, e: 'b', lean: 0.03, sq: 1.01, aRx: 1180, aRy: 640, hRr: 0.4, hRs: 1.2, hr: -0.03 },
    { t: 1.1, d: 0.2, ...hand('R', 'middle') },
    { t: 1.2, d: 0.25, e: 'o', mOpen: 0.18, mSmile: 1.3, mSmirk: 0.6 },
    { t: 1.45, d: 0.15, e: 'o', hRs: 1.45, aRy: 615, by: -8 }, { t: 1.68, d: 0.23, hRs: 1.2, aRy: 640, by: 0 },
    { t: 1.9, d: 0.15, e: 'o', hRs: 1.5, aRy: 610, by: -10 }, { t: 2.13, d: 0.23, hRs: 1.2, aRy: 640, by: 0 },
    // guiño
    { t: 2.42, d: 0.12, e: 'o', lidR: 0 }, { t: 2.95, d: 0.16, lidR: 0.68, mOpen: 0 },
    // baja el brazo, satisfecho
    { t: 3.7, d: 0.55, aRx: AX, aRy: AY, ...hand('R', 'rest'), hRr: DEFAULT.hRr, hRs: 1, lean: 0, sq: 1 },
    { t: 3.65, d: 0.35, lidL: 0, lidR: 0, happy: 1, mSmile: 1.25, mSmirk: 0.2, bRy: -8, bLy: -8, bRr: 0, hr: -0.05 },
    rest(5.2, 0.65, { stance: 0 }),
  ],
  fx(P, t) {
    P.aRx += Math.sin(t * 31) * 2.5 * win(t, 1.2, 3.1, 0.1);
  },
});

export const CLIPS = { idle, catchNose, peineta };

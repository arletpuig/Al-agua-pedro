// Animaciones de Pedro: fotogramas clave sobre los parámetros de pose de pedro-rig.js.
// Cada clave dice "en el instante t estos parámetros valen esto" y `d` es cuánto dura el movimiento
// que lleva hasta ahí (por defecto 0.3 s). Antes de empezar ese movimiento el valor se mantiene.
// `e` es la curva: io (suave), o (frena), i (acelera), b (se pasa y vuelve), el (elástico), l (lineal).
// `fx` añade movimiento procedimental encima (risas, meneos...).
import { DEFAULT, DISCRETE, hand } from './pedro-rig.js';

const EASE = {
  l: x => x,
  io: x => 0.5 - Math.cos(Math.PI * x) / 2,
  o: x => 1 - (1 - x) ** 3,
  i: x => x ** 3,
  b: x => { const c = 1.9; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; },
  el: x => (x === 0 || x === 1 ? x : 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
};

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

export function sample(clip, t) {
  const P = { ...DEFAULT };
  for (const [p, tr] of Object.entries(clip.tracks)) {
    let v = DEFAULT[p], prevT = -1e9;
    for (const k of tr) {
      const start = Math.max(prevT, k.t - k.d);
      if (t >= k.t || DISCRETE.has(p) && t >= k.t) { v = k.v; prevT = k.t; continue; }
      if (t > start && !DISCRETE.has(p)) v = v + (k.v - v) * EASE[k.e]((t - start) / (k.t - start));
      break;
    }
    P[p] = v;
  }
  clip.fx?.(P, t);
  return P;
}
const win = (t, a, b, ramp = 0.25) => Math.max(0, Math.min(1, (t - a) / ramp, (b - t) / ramp));
// vuelta al reposo: todo lo que tocan las animaciones vuelve al valor por defecto
const REST = {
  bx: 0, by: 0, lean: 0, sq: 1, hx: 0, hy: 0, hr: 0, lookX: DEFAULT.lookX, lookY: DEFAULT.lookY, cross: 0,
  lidL: 1, lidR: 1, happy: 0, eyeBig: 0, bLy: 0, bLr: 0, bRy: 0, bRr: 0, mOpen: 0, mSmile: 1, mWide: 1,
  mSmirk: 0, mTongue: 0, mRound: 0, mTeeth: 1, blush: 0,
  aLx: DEFAULT.aLx, aLy: DEFAULT.aLy, aLh: 0, aLg: 0, aLk: DEFAULT.aLk, aRx: DEFAULT.aRx, aRy: DEFAULT.aRy, aRh: 0, aRg: 0, aRk: DEFAULT.aRk,
  hLr: DEFAULT.hLr, hRr: DEFAULT.hRr, hLs: 1, hRs: 1, hLf: 0, hRf: 0, hLw: 0, hRw: 0,
  ...hand('L', 'rest'), ...hand('R', 'rest'),
};
const rest = (t, d = 0.6, keep = {}) => ({ t, d, ...REST, ...keep });
const AX = DEFAULT.aRx, AY = DEFAULT.aRy, LX = DEFAULT.aLx, LY = DEFAULT.aLy;

// ------------------------------------------------------------------ esperando sentado (bucle)
export const idle = compile({
  dur: 8, loop: true,
  keys: [
    // mira a un lado
    { t: 1.2, d: 0.35, lookX: -0.95, lookY: 0.25, hr: -0.05, hx: -4 },
    // vuelve a cámara y levanta una ceja, chulesco
    { t: 2.5, d: 0.35, lookX: 0.1, lookY: 0.05, hr: 0.06, hx: 0 },
    { t: 2.65, d: 0.25, e: 'o', bRy: -16, bRr: -0.06, mSmirk: 0.7, lidL: 0.85, lidR: 0.85 },
    { t: 3.9, d: 0.35, bRy: 0, bRr: 0, mSmirk: 0, hr: 0, lidL: 1, lidR: 1 },
    // se encoge de hombros
    { t: 4.6, d: 0.3, e: 'o', by: -14, sq: 1.025, aLy: LY - 22, aRy: AY - 22, hy: -10, bLy: -10, bRy: -12, hr: -0.04, mSmile: 0.6 },
    { t: 5.2, d: 0.45, by: 0, sq: 1, aLy: LY, aRy: AY, hy: 0, bLy: 0, bRy: 0, hr: 0, mSmile: 1 },
    // mira la diana y silba
    { t: 5.8, d: 0.4, lookX: 0.95, lookY: -0.7, hr: 0.07 },
    { t: 6.1, d: 0.25, mRound: 0.5, mSmile: 0.3, bLy: -6, bRy: -6 },
    rest(7.6, 0.5),
  ],
});

// ------------------------------------------------------------------ atrapa el tomate, se lo pone de nariz y se burla
const START = [960, 2200], CATCH = [1175, 800];
export const catchNose = compile({
  dur: 8.6,
  keys: [
    // el tomate sale desde el jugador; Pedro lo sigue con la mirada
    { t: 0.3, d: 0, tom: 1, tomX: START[0], tomY: START[1], tomS: 2.4, tomR: 0 },
    { t: 0.5, d: 0.2, lookX: 0.4, lookY: 0.9 },
    { t: 0.55, d: 0.22, e: 'o', eyeBig: 0.45, bLy: -14, bRy: -16, mRound: 0.3, mSmile: 0.2, lean: -0.03 },
    { t: 0.95, d: 0.65, e: 'o', tomX: CATCH[0], tomY: CATCH[1], tomS: 1, tomR: 4 },
    { t: 0.95, d: 0.45, e: 'l', lookX: 0.95, lookY: -0.4 },
    // estira el brazo con la mano abierta
    { t: 0.92, d: 0.38, e: 'o', aRx: CATCH[0], aRy: CATCH[1], aRg: 1, aRk: 1, ...hand('R', 'open'), hRf: 1, hRr: -0.1, lean: 0.07, hr: 0.08 },
    // ¡atrapado! la mano cede con el golpe
    { t: 0.97, d: 0, tom: 2, tomSqx: 1.3, tomSqy: 0.72 },
    { t: 1.05, d: 0.08, ...hand('R', 'catch') },
    { t: 1.12, d: 0.15, e: 'o', aRx: CATCH[0] + 45, aRy: CATCH[1] + 45, lean: 0.1, sq: 0.97, eyeBig: 0.6 },
    { t: 1.45, d: 0.45, e: 'el', tomSqx: 1, tomSqy: 1 },
    // lo mira
    { t: 1.65, d: 0.5, aRx: 1060, aRy: 790, lean: 0.03, sq: 1, ...hand('R', 'hold'), lookX: 0.8, lookY: -0.1, eyeBig: 0, mRound: 0, mSmile: 1, bLy: 0, bRy: 0, hr: 0.06 },
    // mira a cámara con picardía y sube y baja las cejas
    { t: 2.1, d: 0.3, lookX: 0, lookY: 0, mSmirk: 0.9, lidL: 0.8, lidR: 0.8, hr: 0.04 },
    { t: 2.22, d: 0.12, bLy: -16, bRy: -16 }, { t: 2.34, d: 0.12, bLy: 0, bRy: 0 },
    { t: 2.46, d: 0.12, bLy: -16, bRy: -16 }, { t: 2.6, d: 0.14, bLy: 0, bRy: 0 },
    // se lo lleva a la nariz (bizquea al acercarlo)
    { t: 2.6, d: 0, aRhx: 748, aRhy: 548 },
    { t: 3.15, d: 0.42, aRh: 1, hRr: -0.25, cross: 1, lookY: 0.6, lookX: 0, lidL: 1, lidR: 1, hr: -0.04, hy: -4, mSmirk: 0.3, eyeBig: 0.25 },
    // ¡plof! se queda pegado
    { t: 3.2, d: 0, tom: 3, tomSqx: 1.35, tomSqy: 0.72 },
    { t: 3.26, d: 0.06, hy: 5 },
    { t: 3.65, d: 0.4, e: 'el', tomSqx: 1, tomSqy: 1, hy: 0 },
    { t: 3.62, d: 0.4, e: 'o', aRh: 0, aRx: AX, aRy: AY, aRg: 0, aRk: DEFAULT.aRk, ...hand('R', 'rest'), hRf: 0, hRr: DEFAULT.hRr, cross: 0, lookX: 0.05, lookY: 0.05, eyeBig: 0, mSmirk: 0.5 },
    // burla: manos a las sienes con los dedos meneándose y la lengua fuera
    { t: 3.8, d: 0, aLhx: 285, aLhy: 520, aRhx: 1035, aRhy: 500 },
    { t: 4.25, d: 0.3, e: 'o', aLh: 1, aRh: 1, aLk: 1, aRk: 1, ...hand('L', 'open'), ...hand('R', 'open'), hLf: 1, hRf: 1, hLr: 0.15, hRr: -0.15, hLw: 1, hRw: 1,
      mTongue: 1, mOpen: 0.22, mSmile: 0.6, mSmirk: 0, mTeeth: 0, lidL: 0, lidR: 0, happy: 1, bLy: -12, bRy: -12 },
    // carcajada sujetándose la barriga
    { t: 6.35, d: 0.35, e: 'o', aLh: 0, aRh: 0, aLk: DEFAULT.aLk, aRk: DEFAULT.aRk, aLx: LX, aLy: LY, aRx: AX, aRy: AY, ...hand('L', 'rest'), ...hand('R', 'rest'), hLf: 0, hRf: 0, hLw: 0, hRw: 0,
      hLr: DEFAULT.hLr, hRr: DEFAULT.hRr, mTongue: 0, mOpen: 1, mTeeth: 1, mSmile: 1.2, blush: 1, hr: -0.09, hy: -10, bLy: -6, bRy: -6 },
    rest(8.1, 0.6, { mSmirk: 0.3 }),
  ],
  fx(P, t) {
    const w = win(t, 4.3, 6.05);
    P.hr += Math.sin(t * 8.5) * 0.09 * w; P.bx += Math.sin(t * 8.5) * 8 * w; P.hx += Math.sin(t * 8.5) * 6 * w;
    const l = win(t, 6.35, 7.5, 0.15);
    const k = Math.abs(Math.sin(t * 13));
    P.by -= k * 12 * l; P.sq += (k - 0.5) * 0.03 * l; P.hy -= k * 8 * l; P.mOpen -= (1 - k) * 0.35 * l;
    // se da palmadas en las rodillas al ritmo de la risa
    const slap = Math.max(0, Math.sin(t * 13)) * l;
    P.aLy -= slap * 60; P.aRy -= Math.max(0, Math.sin(t * 13 + 1.2)) * l * 60; P.lean -= 0.05 * l;
    // el tomate de la nariz se bambolea
    if (P.tom === 3 && t > 3.6) P.tomR = Math.sin(t * 9) * 0.06;
  },
});

// ------------------------------------------------------------------ peineta
export const peineta = compile({
  dur: 5.6,
  keys: [
    { t: 0.35, d: 0.3, e: 'o', lookX: 0, lookY: 0, lidL: 0.68, lidR: 0.68, bRy: -18, bRr: -0.08, bLy: 4, mSmirk: 0.9, hr: 0.05 },
    // anticipación: se echa atrás y baja el brazo
    { t: 0.75, d: 0.35, lean: -0.05, sq: 0.98, aRx: 905, aRy: 1195, ...hand('R', 'fist'), hRr: 0.3 },
    // ¡arriba!
    { t: 1.05, d: 0.3, e: 'b', lean: 0.03, sq: 1.01, aRx: 1120, aRy: 660, aRk: 1, ...hand('R', 'middle'), hRr: 0.45, hRs: 1.2, hr: -0.03, mOpen: 0.18, mSmile: 1.3, mSmirk: 0.6 },
    { t: 1.35, d: 0.15, e: 'o', hRs: 1.45, aRy: 635, by: -6 }, { t: 1.55, d: 0.2, hRs: 1.2, aRy: 660, by: 0 },
    { t: 1.8, d: 0.15, e: 'o', hRs: 1.5, aRy: 630, by: -8 }, { t: 2.0, d: 0.2, hRs: 1.2, aRy: 660, by: 0 },
    // guiño
    { t: 2.3, d: 0.12, e: 'o', lidR: 0 }, { t: 2.85, d: 0.15, lidR: 0.68, mOpen: 0 },
    // baja el brazo, satisfecho
    { t: 3.55, d: 0.5, aRx: AX, aRy: AY, aRk: DEFAULT.aRk, ...hand('R', 'rest'), hRr: DEFAULT.hRr, hRs: 1, lean: 0, sq: 1,
      lidL: 0, lidR: 0, happy: 1, mSmile: 1.25, mSmirk: 0.2, bRy: -8, bLy: -8, bRr: 0, hr: -0.05 },
    rest(5.0, 0.6),
  ],
  fx(P, t) {
    // la mano tiembla un pelín mientras la mantiene arriba
    P.aRx += Math.sin(t * 31) * 2.5 * win(t, 1.1, 3.0, 0.1);
  },
});

export const CLIPS = { idle, catchNose, peineta };

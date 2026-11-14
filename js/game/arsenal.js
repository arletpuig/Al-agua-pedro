// Animaciones de los objetos de La Trastienda contra Pedro (escena principal).
// Cada objeto: vuelo, impacto, reacción de Pedro y vuelta a la normalidad. No dan pesetas: son de exhibición.
import { L } from './stage.js';
import { TEX_SCALE } from './pedro.js';
import { SFX } from '../audio.js';

export const ITEM_LINES = {
  besugo: ['¡Huele a lonja!', '¡Me has dado con un besugo!', '¡Ahora huelo a pescadería!'],
  chancla: ['¡Ni mi madre me daba así!', '¡La chancla no, por favor!', '¡Eso ha dolido en el alma!'],
  pollo: ['¿Me has tirado un pollo? ¿EN SERIO?', 'Esto es una gallinada.', '¡Ñiic! Digo... ¡ay!'],
  tarta: ['¡Esto es merengue de la oposición!', '¡Mi pelo! ¡Mi precioso pelo!', 'Mmm... ¿lleva nata de la buena?'],
  cubo: ['¡B-b-brrr! ¡Esto es c-c-cambio climático!', '¡Qué f-f-frío! ¡Que venga el Falcon!', '¡Me he quedado h-h-helado!'],
  mocion: ['¡Pienso recurrir al Constitucional!', '¡Esto no quedará así!', '¡No dimito! ¡Ni mojado!'],
};
const pick = a => a[Math.floor(Math.random() * a.length)];
const T = TEX_SCALE;
// puntos de Pedro en el mundo (Pedro: contenedor en el asiento, escala 1)
const FACE = () => ({ x: L.SEAT_X + 12, y: L.SEAT_Y - 135 }), TOP = () => ({ x: L.SEAT_X, y: L.SEAT_Y - 222 });

export async function playItem(sc, id) {
  if (sc.busy || sc.aim || !ANIMS[id]) return false;
  sc.busy = true; sc.hush(); const P = sc.pedro;
  P.stopIdle(); P.setGesture(null); P.setMood('smile');
  try { await ANIMS[id](sc, P); }
  finally {
    P.setGesture(null); P.resetHead(); P.restArms(); P.setAngle(0); P.p.head.setScale(1 / T);
    if (!P.idleTweens) P.idle();
    sc.busy = false;
  }
  return true;
}

// ---------- utilidades ----------
const wait = (sc, ms) => new Promise(r => sc.time.delayedCall(ms, r));
const tw = (sc, cfg) => new Promise(r => sc.tweens.add({ ...cfg, onComplete: r }));
// vuelo por una curva de Bézier cuadrática con giro y cambio de escala
function arc(sc, o, from, to, ctrl, ms, { spin = 0, scaleTo = o.scale, ease = 'Sine.In' } = {}) {
  const s0 = o.scale, a0 = o.angle, k = { t: 0 };
  return tw(sc, { targets: k, t: 1, duration: ms, ease, onUpdate: () => {
    const t = k.t, u = 1 - t;
    o.setPosition(u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x, u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y);
    o.setAngle(a0 + spin * t).setScale(s0 + (scaleTo - s0) * t);
  } });
}
// estrellas y pajarito girando sobre la cabeza
function dizzy(sc, P, ms) {
  const top = TOP(), list = ['star', 'dizzyBird', 'star', 'star'].map(f => sc.add.image(top.x, top.y, 'atlas', f).setScale(f === 'star' ? .7 : .55));
  const k = { t: 0 };
  sc.tweens.add({ targets: k, t: 1, duration: ms, onUpdate: () => list.forEach((s, i) => {
    const a = k.t * Math.PI * 2 * (ms / 650) + i * Math.PI / 2;
    s.setPosition(top.x + 6 + Math.cos(a) * 56, top.y + 4 + Math.sin(a) * 14).setDepth(Math.sin(a) > 0 ? 7 : 4.9).setAngle(s.frame.name === 'star' ? k.t * 720 : 0).setFlipX(Math.sin(a) > 0);
  }), onComplete: () => list.forEach(s => sc.tweens.add({ targets: s, alpha: 0, scale: 0, duration: 200, onComplete: () => s.destroy() })) });
}
function popText(sc, frame, x, y, angle = -10) {
  const s = sc.add.image(x, y, 'atlas', frame).setDepth(9).setScale(0).setAngle(angle);
  sc.tweens.add({ targets: s, scale: .75, duration: 160, ease: 'Back.Out' });
  sc.tweens.add({ targets: s, alpha: 0, y: y - 30, delay: 450, duration: 300, onComplete: () => s.destroy() });
}
// el objeto cae en la pecera y las pirañas se lo comen
async function intoTank(sc, o, x, ms = 520) {
  const from = { x: o.x, y: o.y };
  await arc(sc, o, from, { x, y: L.WATER_Y + 10 }, { x: (from.x + x) / 2, y: from.y - 80 }, ms, { spin: 260, ease: 'Quad.In' });
  SFX.splash(); sc.splash.explode(22, x, L.WATER_Y + 4); sc.ripple(x, L.WATER_Y + 12);
  o.setDepth(3); sc.sc.frenzy(true); sc.time.delayedCall(1500, () => sc.sc.frenzy(false));
  sc.tweens.add({ targets: o, y: o.y + 70, alpha: 0, angle: o.angle + 40, duration: 900, onComplete: () => o.destroy() });
}

// ---------- 1. El Besugo ----------
async function besugo(sc, P) {
  const face = FACE(), f = sc.add.image(420, 1010, 'atlas', 'itBesugo').setScale(.45).setDepth(8);
  SFX.whoosh();
  await arc(sc, f, { x: 420, y: 1010 }, face, { x: 600, y: 320 }, 560, { spin: -1080, scaleTo: .62 });
  SFX.slap(); sc.fxText('¡PLAF!', 400, 62, '#3fa9f5'); sc.cameras.main.shake(140, .007);
  sc.splash.explode(14, face.x, face.y);
  P.setMood('dizzy');
  P.headTween({ angle: -24, x: -7, duration: 80, ease: 'Quad.Out' }); sc.tweens.add({ targets: P, angle: -5, duration: 90, yoyo: true });
  f.setPosition(face.x + 8, face.y + 4).setAngle(-172).setFlipY(true);
  await wait(sc, 360);
  P.headTween({ angle: 0, x: 0, duration: 900, ease: 'Elastic.Out' });
  dizzy(sc, P, 2600); sc.say(pick(ITEM_LINES.besugo), 2200);
  // resbala por la cara, cae al tablón y coletea
  await tw(sc, { targets: f, x: face.x + 92, y: L.SEAT_Y - 12, angle: -180, duration: 360, ease: 'Quad.In' }); f.setFlipY(false).setAngle(0).setFlipX(true);
  SFX.flop();
  for (let i = 0; i < 4; i++) { SFX.flop(); await tw(sc, { targets: f, y: f.y - 16, angle: i % 2 ? 16 : -16, duration: 120, yoyo: true, ease: 'Quad.Out' }); }
  await intoTank(sc, f, 330);
  await wait(sc, 900);
  P.setMood('smile');
}

// ---------- 2. La Chancla ----------
async function chancla(sc, P) {
  const cheek = { x: L.SEAT_X + 44, y: L.SEAT_Y - 122 }, c = sc.add.image(820, 760, 'atlas', 'itChancla').setScale(.42).setDepth(8);
  SFX.whoosh();
  await arc(sc, c, { x: 820, y: 760 }, cheek, { x: 700, y: 60 }, 520, { spin: 1260, scaleTo: .5 });
  SFX.slap(); sc.fxText('¡ZAS!', 400, 62, '#e3262e'); sc.cameras.main.shake(120, .006);
  P.setMood('shock');
  P.headTween({ angle: -22, x: -9, duration: 70, ease: 'Quad.Out' }); sc.tweens.add({ targets: P, x: P.x - 6, duration: 70, yoyo: true });
  const mark = P.overlay('slapMark', 34, -124); mark.setAlpha(0); mark.base.angle = 14; P.applyHead();
  sc.tweens.add({ targets: mark, alpha: .95, duration: 120 });
  // vuelve como un bumerán
  SFX.whoosh();
  arc(sc, c, { x: cheek.x, y: cheek.y }, { x: 820, y: 1000 }, { x: 640, y: 40 }, 640, { spin: 1260, scaleTo: .42, ease: 'Sine.InOut' }).then(() => c.destroy());
  await wait(sc, 200);
  P.headTween({ angle: 0, x: 0, duration: 600, ease: 'Elastic.Out' });
  await wait(sc, 300);
  // se frota la mejilla, ofendido
  P.setMood('angry'); P.setGesture('armNose'); P.p.noseTomato.setVisible(false); SFX.angry();
  sc.say(pick(ITEM_LINES.chancla), 2200);
  await tw(sc, { targets: P.p.armNose, angle: { from: -16, to: -6 }, duration: 110, yoyo: true, repeat: 5 });
  P.setGesture(null); P.p.armNose.angle = -31;
  await P.angryShake(700); P.setMood('smile');
  sc.tweens.add({ targets: mark, alpha: 0, delay: 2200, duration: 1200, onComplete: () => P.dropOverlay(mark) });
}

// ---------- 3. El Pollo de Goma ----------
async function pollo(sc, P) {
  const top = TOP(), c = sc.add.image(440, 1010, 'atlas', 'itPollo').setScale(.42).setDepth(8);
  SFX.whoosh();
  await arc(sc, c, { x: 440, y: 1010 }, { x: top.x + 6, y: top.y - 20 }, { x: 420, y: -40 }, 620, { spin: 900, scaleTo: .5 });
  P.setMood('dizzy'); dizzy(sc, P, 3400);
  const H = P.p.head;
  for (const [i, h] of [140, 90, 50].entries()) {
    SFX.squeak(); popText(sc, 'squeak', top.x + (i % 2 ? 70 : -70), top.y - 30, i % 2 ? 10 : -10); sc.cameras.main.shake(80, .003);
    sc.tweens.add({ targets: H, scaleY: .74 / T, scaleX: 1.14 / T, duration: 70, yoyo: true, ease: 'Quad.Out' });
    sc.tweens.add({ targets: P, scaleY: .94, duration: 70, yoyo: true });
    await tw(sc, { targets: c, y: c.y - h, angle: c.angle + 200 + i * 40, duration: 240 - i * 40, yoyo: true, ease: 'Quad.Out' });
  }
  // se le queda de sombrero
  SFX.squeak(); c.setAngle(-78).setPosition(top.x + 4, top.y - 2);
  await tw(sc, { targets: H, scaleY: .86 / T, duration: 80, yoyo: true });
  P.setMood('shock'); P.headTween({ angle: 6, duration: 300 });
  sc.say(pick(ITEM_LINES.pollo), 2400);
  await tw(sc, { targets: c, angle: -70, duration: 160, yoyo: true, repeat: 3 });
  await wait(sc, 600);
  P.setMood('angry'); P.headTween({ angle: -10, duration: 120, yoyo: true, repeat: 1 });
  await wait(sc, 300); SFX.squeak();
  await intoTank(sc, c, 210, 600);
  await wait(sc, 600); P.setMood('smile');
}

// ---------- 4. El Tartazo ----------
async function tarta(sc, P) {
  const face = FACE(), c = sc.add.image(380, 1020, 'atlas', 'itTarta').setScale(.28).setDepth(8);
  SFX.whoosh();
  await arc(sc, c, { x: 380, y: 1020 }, face, { x: 380, y: 420 }, 520, { spin: -20, scaleTo: .8 });
  SFX.splat(); SFX.flop(); sc.fxText('¡PLOF!', 400, 62, '#ff8fb0'); sc.cameras.main.shake(150, .008);
  const blobs = sc.add.particles(0, 0, 'atlas', { frame: 'creamBlob', speed: { min: 120, max: 320 }, angle: { min: 0, max: 360 }, gravityY: 700, lifespan: 900, scale: { start: .9, end: .4 }, emitting: false }).setDepth(8);
  blobs.explode(30, face.x, face.y);
  P.setMood('angry');
  const mask = P.overlay('creamMask', 4, -134, 0), eyes = P.overlay('creamEyes', 12, -147, 0), straw = P.overlay('strawberry', -2, -202, 1);
  sc.tweens.add({ targets: mask, scale: 1.04 / T, duration: 220, ease: 'Back.Out' });
  sc.tweens.add({ targets: P, angle: -4, y: P.y + 4, duration: 100, yoyo: true });
  // el plato se queda pegado un instante y se cae
  c.setPosition(face.x, face.y + 4);
  await wait(sc, 300);
  intoTank(sc, c, 300, 600);
  // ojos parpadeando entre la nata y goterones
  eyes.setScale(1.35 / T, 1 / T);
  const drip = sc.add.particles(0, 0, 'atlas', { frame: 'creamBlob', x: { min: face.x - 40, max: face.x + 40 }, y: face.y + 52, speedY: { min: 40, max: 120 }, gravityY: 500, lifespan: 700, scale: { start: .6, end: .3 }, frequency: 120 }).setDepth(7);
  for (let i = 0; i < 2; i++) { await wait(sc, 380); await tw(sc, { targets: eyes, scaleY: .1 / T, duration: 70, yoyo: true }); }
  sc.say(pick(ITEM_LINES.tarta), 2400);
  // se limpia la cara a manotazos
  P.setGesture('armNose'); P.p.noseTomato.setVisible(false);
  for (const a of [.62, .3, 0]) {
    await tw(sc, { targets: P.p.armNose, angle: { from: -44, to: -14 }, duration: 160, yoyo: true });
    mask.base.y += 7; P.applyHead(); sc.tweens.add({ targets: mask, alpha: a, duration: 150 }); blobs.explode(6, face.x - 20, face.y + 10);
    if (a < .5) eyes.setVisible(false);
  }
  P.setGesture(null); P.p.armNose.angle = -31; drip.stop();
  await tw(sc, { targets: straw.base, y: -128, x: 14, duration: 500, ease: 'Bounce.Out', onUpdate: () => P.applyHead() });
  await wait(sc, 300);
  sc.tweens.add({ targets: straw, alpha: 0, duration: 300, onComplete: () => P.dropOverlay(straw) });
  P.dropOverlay(mask); P.dropOverlay(eyes);
  await P.angryShake(700); P.setMood('smile');
  sc.time.delayedCall(1500, () => { drip.destroy(); blobs.destroy(); });
}

// ---------- 5. El Cubo Helado ----------
async function cubo(sc, P) {
  const top = TOP(), bx = top.x + 20, b = sc.add.image(bx, -80, 'atlas', 'itCubo').setScale(.95).setDepth(8);
  const rope = sc.add.graphics().setDepth(8), drawRope = () => { rope.clear(); rope.lineStyle(3, 0x0a0605, 1); rope.lineBetween(bx, 40, b.x, b.y - 44); };
  SFX.boing();
  await tw(sc, { targets: b, y: top.y - 82, duration: 700, ease: 'Back.Out', onUpdate: drawRope });
  P.setMood('shock'); P.headTween({ angle: -6, y: -3, duration: 200 });   // mira hacia arriba
  await tw(sc, { targets: b, angle: { from: -6, to: 6 }, duration: 140, yoyo: true, repeat: 1, onUpdate: drawRope });
  await tw(sc, { targets: b, angle: 125, x: bx - 18, duration: 320, ease: 'Quad.In', onUpdate: drawRope });
  SFX.pour();
  const water = sc.add.particles(0, 0, 'atlas', { frame: 'drop', x: { min: bx - 52, max: bx - 20 }, y: top.y - 70, speedY: { min: 260, max: 460 }, speedX: { min: -50, max: 50 }, gravityY: 800, lifespan: 600, scale: { start: 1.2, end: .7 }, frequency: 12, quantity: 2 }).setDepth(7);
  const ice = sc.add.particles(0, 0, 'atlas', { frame: 'iceCube', speedY: { min: 80, max: 220 }, speedX: { min: -140, max: 140 }, gravityY: 900, lifespan: 1200, rotate: { min: 0, max: 360 }, scale: .9, emitting: false }).setDepth(8);
  ice.explode(12, bx - 34, top.y - 60);
  P.setWet(true);
  await wait(sc, 700); water.stop();
  // se congela dentro de un bloque de hielo
  SFX.freeze();
  P.setTintAll(0x9fd8ff); P.drips.stop();
  const blk = sc.add.image(L.SEAT_X - 2, L.SEAT_Y - 58, 'atlas', 'iceBlock').setDepth(5.5).setScale(.3, .3).setAlpha(0);
  await tw(sc, { targets: blk, scaleX: .96, scaleY: .98, alpha: 1, duration: 360, ease: 'Back.Out' });
  const frost = sc.add.particles(0, 0, 'atlas', { frame: 'star', x: { min: L.SEAT_X - 110, max: L.SEAT_X + 110 }, y: { min: L.SEAT_Y - 180, max: L.SEAT_Y + 60 }, lifespan: 600, scale: { start: .45, end: 0 }, tint: 0xe8fbff, frequency: 90 }).setDepth(6);
  sc.tweens.add({ targets: b, y: -120, angle: 0, duration: 800, delay: 200, ease: 'Quad.In', onUpdate: drawRope, onComplete: () => { b.destroy(); rope.destroy(); } });
  const chatter = sc.tweens.add({ targets: P, x: { from: L.SEAT_X - 1.5, to: L.SEAT_X + 1.5 }, duration: 50, yoyo: true, repeat: -1 });
  sc.say('¡B-b-b-brrr!', 1500);
  await wait(sc, 1100);
  const cr1 = sc.add.image(blk.x, blk.y, 'atlas', 'iceCrack').setDepth(5.6).setScale(.5).setAlpha(0); SFX.crack(); sc.tweens.add({ targets: cr1, alpha: 1, duration: 60 });
  await wait(sc, 450);
  const cr2 = sc.add.image(blk.x + 10, blk.y, 'atlas', 'iceCrack').setDepth(5.6).setScale(-.5, .5).setAngle(18); SFX.crack();
  await wait(sc, 400);
  // ¡CRASH!
  chatter.stop(); P.x = L.SEAT_X; frost.stop();
  SFX.shatter(); sc.cameras.main.shake(160, .009);
  const shards = sc.add.particles(0, 0, 'atlas', { frame: 'iceShard', speed: { min: 160, max: 420 }, angle: { min: 180, max: 360 }, gravityY: 900, lifespan: 1100, rotate: { min: 0, max: 360 }, scale: { min: .7, max: 1.3 }, emitting: false }).setDepth(8);
  shards.explode(36, blk.x, blk.y);
  [blk, cr1, cr2].forEach(o => o.destroy());
  P.setWet(true);
  sc.say(pick(ITEM_LINES.cubo), 2400);
  await tw(sc, { targets: P, angle: { from: -2, to: 2 }, duration: 60, yoyo: true, repeat: 12 });
  P.setAngle(0); P.setMood('angry'); await wait(sc, 800); P.setMood('smile');
  sc.time.delayedCall(2500, () => { P.setWet(false); water.destroy(); ice.destroy(); frost.destroy(); shards.destroy(); });
}

// ---------- 6. La Moción de Censura (objeto de pago) ----------
async function mocion(sc, P) {
  const dark = sc.add.rectangle(360, 480, 720, 960, 0x02030f, 0).setDepth(8.5);
  sc.tweens.add({ targets: dark, alpha: .6, duration: 350 });
  SFX.drumroll(1.7);
  const title = sc.add.text(380, 560, 'MOCIÓN DE\nCENSURA', { fontFamily: 'Titan One, Arial Black, Arial', fontSize: 54, color: '#ffd23f', stroke: '#5a2a00', strokeThickness: 10, align: 'center', resolution: 2 }).setOrigin(.5).setDepth(9.5).setScale(.4).setAlpha(0);
  sc.tweens.add({ targets: title, scale: 1, alpha: 1, duration: 500, ease: 'Back.Out' });
  const end = { x: L.HINGE_X + 58, y: L.HINGE_Y - 40 };
  const beam = sc.add.triangle(0, 0, end.x - 26, 60, end.x + 26, 60, end.x, end.y + 40, 0xfff1b0, .22).setOrigin(0).setDepth(8.6).setBlendMode('ADD');
  const halo = sc.add.image(end.x, -120, 'atlas', 'lampGlow').setDepth(8.9).setScale(2.4).setTint(0xffd23f).setBlendMode('ADD');
  const u = sc.add.image(end.x, -120, 'atlas', 'itUrna').setDepth(9).setScale(.9);
  P.setMood('shock'); P.headTween({ angle: 8, duration: 300 });
  await tw(sc, { targets: [u, halo], y: 170, angle: { from: -20, to: 0 }, duration: 1000, ease: 'Sine.InOut' });
  sc.stars.explode(10, u.x, u.y);
  await wait(sc, 400);
  sc.tweens.add({ targets: title, alpha: 0, y: 600, duration: 300 });
  // ¡PUM! sobre el extremo corto del tablón
  await tw(sc, { targets: [u, halo], y: end.y, duration: 200, ease: 'Quad.In' });
  SFX.thud(); SFX.clank(); sc.cameras.main.shake(260, .008); beam.destroy();
  const ballots = sc.add.particles(0, 0, 'atlas', { frame: 'ballot', speedY: { min: -560, max: -260 }, speedX: { min: -260, max: 260 }, gravityY: 500, lifespan: 2400, rotate: { min: -180, max: 180 }, scale: { min: .8, max: 1.2 }, emitting: false }).setDepth(9);
  ballots.explode(34, u.x, u.y - 20);
  sc.tweens.add({ targets: sc.chair, angle: 22, duration: 120, ease: 'Quad.Out' });
  sc.tweens.add({ targets: [u, halo], y: end.y + 26, duration: 120, ease: 'Quad.Out' });
  sc.sc.seatShadow.setVisible(false); SFX.fall();
  sc.say('¡¡AAAAAH!!', 900);
  await tw(sc, { targets: P, y: -260, x: L.SEAT_X + 40, angle: 720, duration: 720, ease: 'Quad.Out' });
  sc.tweens.add({ targets: dark, alpha: .3, duration: 300 });
  // ¡APROBADA! + fuegos artificiales y confeti
  const stamp = sc.add.text(380, 300, '¡APROBADA!', { fontFamily: 'Titan One, Arial Black, Arial', fontSize: 64, color: '#ffffff', stroke: '#c60b1e', strokeThickness: 14, resolution: 2 }).setOrigin(.5).setDepth(9.6).setAngle(-12).setScale(3).setAlpha(0);
  SFX.stamp(); sc.tweens.add({ targets: stamp, scale: 1, alpha: 1, duration: 200, ease: 'Back.Out' });
  const conf = sc.add.particles(0, 0, 'atlas', { frame: 'confetti', x: { min: 0, max: 720 }, y: 40, speedY: { min: 140, max: 300 }, speedX: { min: -60, max: 60 }, lifespan: 2600, rotate: { min: 0, max: 360 }, scale: { min: .9, max: 1.6 }, tint: [0xffd23f, 0xe3262e, 0x3fa9f5, 0x7ed957, 0xff8fb0, 0xffffff], frequency: 18, quantity: 2 }).setDepth(9.4);
  const fire = sc.add.particles(0, 0, 'atlas', { frame: 'spark', speed: { min: 120, max: 300 }, angle: { min: 0, max: 360 }, gravityY: 160, lifespan: 1000, scale: { start: .9, end: 0 }, blendMode: 'ADD', emitting: false }).setDepth(9.3);
  [[170, 170, 0xffd23f], [560, 120, 0xff5d8f], [380, 210, 0x7fdfff], [250, 90, 0x7ed957]].forEach(([x, y, c], i) => sc.time.delayedCall(i * 260, () => { SFX.firework(); fire.setParticleTint(c); fire.explode(40, x, y); }));
  SFX.win(); await wait(sc, 1200);
  sc.tweens.add({ targets: stamp, alpha: 0, scale: 1.3, duration: 300 });
  // cae de cabeza a la pecera
  P.setMood('shock'); P.setPosition(L.TANK_X + 92, -260).setAngle(180);
  await tw(sc, { targets: P, y: L.WATER_Y + 60, angle: 200, duration: 620, ease: 'Quad.In' });
  SFX.splash(); SFX.splash(); sc.splash.explode(110, P.x, L.WATER_Y + 6); sc.ripple(P.x, L.WATER_Y + 12); sc.cameras.main.shake(320, .01);
  sc.sc.frenzy(true); sc.sc.setBulbs('party'); SFX.cheer();
  await tw(sc, { targets: P, y: P.y + 70, alpha: 0, duration: 300, ease: 'Quad.In' });
  conf.stop();
  P.setMood('angry'); P.setWet(true); P.setAngle(0);
  await tw(sc, { targets: P, y: L.WATER_Y + 42, alpha: 1, duration: 800, ease: 'Quad.Out' });
  SFX.angry(); sc.say(pick(ITEM_LINES.mocion), 2200, 'water'); await P.angryShake(2000); sc.hush();
  await tw(sc, { targets: P, y: P.y + 110, alpha: 0, duration: 450, ease: 'Quad.In' });
  sc.sc.frenzy(false); sc.sc.setBulbs('chase');
  // la urna se esfuma y todo vuelve a su sitio
  sc.stars.explode(16, u.x, u.y);
  sc.tweens.add({ targets: [u, halo], alpha: 0, scale: 1.3, duration: 400, onComplete: () => { u.destroy(); halo.destroy(); } });
  sc.tweens.add({ targets: sc.chair, angle: 0, x: sc.chairHome.x, y: sc.chairHome.y, duration: 400, ease: 'Back.Out' });
  sc.tweens.add({ targets: dark, alpha: 0, duration: 400, onComplete: () => dark.destroy() });
  P.setPosition(L.SEAT_X, L.SEAT_Y - 140).setAlpha(0);
  await tw(sc, { targets: P, y: L.SEAT_Y, alpha: 1, duration: 550, ease: 'Bounce.Out' });
  sc.sc.seatShadow.setVisible(true); P.setMood('angry');
  sc.say('Mojado, pero sigo aquí.', 2200);
  sc.time.delayedCall(2600, () => { ballots.destroy(); conf.destroy(); fire.destroy(); title.destroy(); stamp.destroy(); });
  sc.time.delayedCall(4000, () => { P.setWet(false); if (!sc.busy) P.setMood('smile'); });
  await wait(sc, 600);
}

const ANIMS = { besugo, chancla, pollo, tarta, cubo, mocion };

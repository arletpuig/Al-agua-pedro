// Escenario: fondo con foco, torre de acero y madera, tablón abatible, pecera con pirañas y diana con bombillas.
// Mundo de 720x960. Devuelve los objetos que la escena anima.
export const L = { W: 720, H: 960, FLOOR: 890, SEAT_X: 246, SEAT_Y: 400, HINGE_X: 454, HINGE_Y: 411, TOWER_X: 481, VIEW_Y: 60, VIEW_H: 900,
  TARGET_X: 576, TARGET_Y: 250, TARGET_R: 88, BULL_R: 33, TANK_X: 116, TANK_Y: 690, TANK_W: 260, TANK_H: 200, WATER_Y: 720, AIM_Y: 250 };
const T = 2; // píxeles de textura por unidad
const img = (scene, x, y, f, vb, pv) => scene.add.image(x, y, 'atlas', f).setOrigin((pv[0] - vb[0]) / vb[2], (pv[1] - vb[1]) / vb[3]).setScale(1 / T);

class Piranha {
  constructor(scene, x, y, s, depth) {
    this.scene = scene; this.s = s; this.dir = 1; this.x = x; this.y = y; this.home = y; this.speed = 22 + Math.random() * 16; this.t = Math.random() * 6; this.frenzy = false;
    this.tail = img(scene, x, y, 'fishTail', [-26, -20, 30, 40], [0, 0]).setDepth(depth);
    this.body = img(scene, x, y, 'fishBody', [-40, -44, 88, 70], [0, 0]).setDepth(depth);
    this.jaw = img(scene, x, y, 'fishJaw', [-6, -9, 36, 26], [0, 0]).setDepth(depth);
    [this.tail, this.body, this.jaw].forEach(o => o.setScale(s / T));
    this.chompT = 2 + Math.random() * 4; this.jawA = 0;
  }
  update(dt, minX, maxX) {
    const k = dt / 1000, sp = this.frenzy ? this.speed * 5 : this.speed; this.t += k * (this.frenzy ? 4 : 1);
    this.x += this.dir * sp * k; if (this.x > maxX) { this.x = maxX; this.dir = -1; } if (this.x < minX) { this.x = minX; this.dir = 1; }
    const y = this.y = this.home + Math.sin(this.t * 1.3) * (this.frenzy ? 14 : 6), d = this.dir, s = this.s;
    this.chompT -= k; if (this.chompT < 0) { this.chompT = this.frenzy ? .18 : 2.5 + Math.random() * 5; this.scene.tweens.add({ targets: this, jawA: 24, duration: 90, yoyo: true, repeat: this.frenzy ? 0 : 1 }); }
    const tilt = Math.cos(this.t * 1.3) * 5 * d;
    this.body.setPosition(this.x, y).setFlipX(d < 0).setAngle(tilt);
    this.tail.setPosition(this.x - 33 * s * d, y).setFlipX(d < 0).setAngle(tilt + Math.sin(this.t * (this.frenzy ? 22 : 9)) * 22 * d);
    this.jaw.setPosition(this.x + 17 * s * d, y + 7 * s).setFlipX(d < 0).setAngle(tilt + this.jawA * d);
  }
}

export function buildStage(scene) {
  scene.add.image(360, 480, 'bg').setDisplaySize(720, 960).setDepth(0);
  // reflejo cálido que respira bajo el foco
  const glow = scene.add.ellipse(L.SEAT_X, 330, 380, 420, 0xffe2a0, .07).setDepth(0);
  scene.tweens.add({ targets: glow, alpha: .11, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  // pecera: fondo, pirañas y burbujas, cristal delante
  scene.add.image(L.TANK_X, L.TANK_Y, 'atlas', 'tankBack').setOrigin(0, 0).setScale(1 / T).setDepth(2);
  const fish = [new Piranha(scene, L.TANK_X + 60, 772, .95, 3), new Piranha(scene, L.TANK_X + 180, 812, .8, 3), new Piranha(scene, L.TANK_X + 110, 846, .66, 3)]; fish[1].dir = -1;
  const bubbles = scene.add.particles(0, 0, 'atlas', { frame: 'bubble', x: { min: L.TANK_X + 24, max: L.TANK_X + L.TANK_W - 24 }, y: L.TANK_Y + 168, speedY: { min: -46, max: -22 }, speedX: { min: -5, max: 5 }, lifespan: { min: 2200, max: 4200 }, scale: { start: .35, end: .9 }, alpha: { start: .9, end: 0 }, frequency: 420, maxParticles: 40 }).setDepth(3);
  // superficie del agua
  const wg = scene.add.graphics(); wg.fillStyle(0xbff3ff, .85); wg.beginPath(); wg.moveTo(0, 16); for (let x = 0; x <= 120; x += 3) wg.lineTo(x, 7 + Math.sin(x / 120 * Math.PI * 2) * 3); wg.lineTo(120, 16); wg.closePath(); wg.fillPath(); wg.fillStyle(0x3fd6e6, 1); wg.fillRect(0, 12, 120, 4); wg.generateTexture('surf', 120, 16); wg.destroy();
  const surf = scene.add.tileSprite(L.TANK_X + 130, L.WATER_Y - 2, 244, 16, 'surf').setDepth(3).setAlpha(.9);
  const tankFront = scene.add.image(L.TANK_X - 8, L.TANK_Y - 2, 'atlas', 'tankFront').setOrigin(0, 0).setScale(1 / T).setDepth(6);
  // torre, puntal y tablón
  scene.add.image(L.TOWER_X, L.FLOOR, 'atlas', 'tower').setOrigin(84 / 190, 758 / 764).setScale(1 / T).setDepth(1);
  const strut = img(scene, L.TOWER_X - 32, 560, 'strut', [-10, -10, 214, 20], [0, 0]).setDepth(1).setAngle(-134);
  const plank = img(scene, L.HINGE_X, L.HINGE_Y, 'plank', [-338, -17, 424, 34], [0, 0]).setDepth(4);
  // reflejos tenues sobre el suelo brillante
  scene.add.image(L.TANK_X - 8, L.FLOOR + 106, 'atlas', 'tankFront').setOrigin(0, 0).setScale(1 / T, -1 / T).setDepth(1).setAlpha(.16);
  scene.add.image(L.TOWER_X, L.FLOOR - 2, 'atlas', 'tower').setOrigin(84 / 190, 758 / 764).setScale(1 / T, -1 / T).setDepth(1).setAlpha(.13);
  // diana con bombillas en carrusel
  const target = scene.add.image(L.TARGET_X, L.TARGET_Y, 'atlas', 'target').setScale(1 / T).setDepth(2);
  const bulbs = []; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 - Math.PI / 2; bulbs.push(scene.add.image(L.TARGET_X + Math.cos(a) * 92.5, L.TARGET_Y + Math.sin(a) * 92.5, 'atlas', 'bulb').setScale(.42).setDepth(2).setBlendMode('ADD')); }
  let bt = 0, mode = 'chase';
  return {
    fish, bubbles, tankFront, strut, plank, target, bulbs,
    setBulbs(m) { mode = m; },
    update(dt) {
      surf.tilePositionX += dt * .03; fish.forEach(f => f.update(dt, L.TANK_X + 52, L.TANK_X + L.TANK_W - 52));
      bt += dt; const step = Math.floor(bt / (mode === 'party' ? 70 : 160));
      bulbs.forEach((b, i) => { const on = mode === 'party' ? (i + step) % 2 === 0 : (i + step) % 7 < 3; b.setAlpha(on ? 1 : .28).setScale(on ? .46 : .36); });
    },
    frenzy(v) { fish.forEach(f => { f.frenzy = v; }); bubbles.frequency = v ? 40 : 420; },
  };
}

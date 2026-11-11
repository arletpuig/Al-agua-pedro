// Pedro: contenedor Phaser con capas independientes (cabeza, brazos, bocas...) y sus animaciones.
const LAYERS = { // clave: [vbX, vbY, vbW, vbH, pivotX, pivotY]  (unidades de diseño; cadera = 0,0)
  legs: [-45, -8, 90, 132, 0, 0], body: [-62, -74, 124, 84, 0, 6],
  armL: [-78, -68, 54, 126, -50, -56], armR: [24, -68, 54, 126, 50, -56],
  armUp: [38, -184, 54, 142, 50, -56], armNose: [-14, -126, 78, 80, 50, -56], armPoint: [40, -110, 76, 62, 50, -56],
  head: [-56, -200, 112, 152, 0, -62], pupils: [-24, -128, 48, 14, 0, -121], eyelids: [-30, -130, 60, 20, 0, -129],
  browL: [-37, -150, 34, 22, -7, -135], browR: [3, -150, 34, 22, 7, -135],
  mouthSmile: [-26, -92, 52, 44, 0, -80], mouthLaugh: [-26, -92, 52, 44, 0, -80], mouthShock: [-26, -92, 52, 44, 0, -80],
  mouthAngry: [-26, -92, 52, 44, 0, -80], mouthSmug: [-26, -92, 52, 44, 0, -80],
  sweat: [40, -138, 18, 24, 48, -134], blush: [-38, -106, 76, 12, 0, -100], chair: [-58, -102, 116, 224, 50, 120],
};
export const PEDRO_KEYS = Object.keys(LAYERS);
export const TEX_SCALE = 2; // los SVG se rasterizan al doble para que se vean nítidos
const HEAD_PARTS = ['head', 'pupils', 'eyelids', 'browL', 'browR', 'mouthSmile', 'mouthLaugh', 'mouthShock', 'mouthAngry', 'mouthSmug', 'sweat', 'blush'];
const MOUTHS = ['mouthSmile', 'mouthLaugh', 'mouthShock', 'mouthAngry', 'mouthSmug'];
const GESTURES = ['armUp', 'armNose', 'armPoint'];

export class Pedro extends Phaser.GameObjects.Container {
  constructor(scene, x, y, s = 0.85) {
    super(scene, x, y);
    this.s = s; this.setScale(s); scene.add.existing(this);
    this.p = {};
    const mk = (key, parent, dx = 0, dy = 0) => {
      const [vx, vy, vw, vh, px, py] = LAYERS[key];
      const sp = scene.add.image(px - dx, py - dy, 'atlas', key).setOrigin((px - vx) / vw, (py - vy) / vh).setScale(1 / TEX_SCALE);
      parent.add(sp); this.p[key] = sp; return sp;
    };
    ['legs', 'body', 'armL', 'armR', 'armUp', 'armNose', 'armPoint'].forEach(k => mk(k, this));
    // Las piezas de la cabeza van directamente en el contenedor (los contenedores anidados fallan en WebGL):
    // se giran alrededor del cuello (0,-62) por cálculo mediante applyHead().
    this.NECK = { x: 0, y: -62 }; this.head = { angle: 0, x: 0, y: 0 }; this.headParts = [];
    HEAD_PARTS.forEach(k => { const sp = mk(k, this); const [, , , , px, py] = LAYERS[k]; sp.base = { x: px, y: py, angle: 0 }; this.headParts.push(sp); });
    this.p.eyelids.setScale(1 / TEX_SCALE).setVisible(false);
    this.setMood('smile'); this.setGesture(null);
    // El emisor va fuera del contenedor (un emisor dentro de un contenedor corrompe el dibujado en WebGL)
    this.drips = scene.add.particles(0, 0, 'atlas', { frame: 'drop', follow: this, followOffset: { x: 0, y: -70 }, speedY: { min: 40, max: 90 }, speedX: { min: -10, max: 10 }, lifespan: 700, scale: { start: .7, end: .3 }, alpha: { start: 1, end: 0 }, frequency: 90, quantity: 1, emitting: false, maxParticles: 40 });
    this.drips.addEmitZone({ type: 'random', source: new Phaser.Geom.Rectangle(-34, -10, 68, 40) });
    this.idle();
  }
  applyHead() {
    const { angle, x, y } = this.head, r = Phaser.Math.DegToRad(angle), c = Math.cos(r), sn = Math.sin(r), N = this.NECK;
    for (const sp of this.headParts) { const dx = sp.base.x - N.x, dy = sp.base.y - N.y; sp.x = N.x + x + dx * c - dy * sn; sp.y = N.y + y + dx * sn + dy * c; sp.angle = angle + sp.base.angle; }
  }
  headTween(cfg) { return this.scene.tweens.add({ targets: this.head, ...cfg, onUpdate: () => this.applyHead() }); }
  resetHead() { this.head.angle = 0; this.head.x = 0; this.head.y = 0; this.applyHead(); }
  idle() {
    const t = this.scene.tweens;
    this.idleTweens = [
      t.add({ targets: this.p.body, scaleY: (1 / TEX_SCALE) * 1.025, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      this.headTween({ angle: { from: -2, to: 2 }, duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      t.add({ targets: this.p.armL, angle: { from: -2, to: 3 }, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      t.add({ targets: this.p.armR, angle: { from: 2, to: -3 }, duration: 2300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      t.add({ targets: this.p.pupils.base, x: { from: -3, to: 3 }, duration: 3500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 500, onUpdate: () => this.applyHead() }),
    ];
    this.blinkEv = this.scene.time.addEvent({ delay: 3800, loop: true, callback: () => this.blink() });
  }
  blink() { if (this.mood === 'laugh') return; const e = this.p.eyelids; e.setVisible(true); this.scene.tweens.add({ targets: e, scaleY: { from: .1 / TEX_SCALE, to: 1 / TEX_SCALE }, duration: 70, yoyo: true, onComplete: () => { if (this.mood !== 'laugh') e.setVisible(false); } }); }
  stopIdle() { this.idleTweens?.forEach(t => t.stop()); this.blinkEv?.remove(); this.resetHead(); this.p.armL.angle = 0; this.p.armR.angle = 0; }
  setMood(m) {
    this.mood = m;
    MOUTHS.forEach(k => this.p[k].setVisible(false));
    this.p['mouth' + m[0].toUpperCase() + m.slice(1)].setVisible(true);
    const dy = m === 'laugh' ? -4 : m === 'shock' ? -7 : m === 'smug' ? -2 : 0;
    this.p.browL.base.y = this.p.browR.base.y = LAYERS.browL[5] + dy;
    this.p.browL.base.angle = m === 'angry' ? 18 : m === 'smug' ? -5 : 0; this.p.browR.base.angle = m === 'angry' ? -18 : m === 'smug' ? 5 : 0;
    this.p.eyelids.setVisible(m === 'laugh'); this.p.eyelids.scaleY = (m === 'laugh' ? 0.5 : 1) / TEX_SCALE;
    this.p.sweat.setVisible(m === 'shock'); this.p.blush.setVisible(m === 'angry');
    this.p.pupils.setScale(m === 'shock' ? 1.3 / TEX_SCALE : 1 / TEX_SCALE);
    this.applyHead();
  }
  setGesture(g) { GESTURES.forEach(k => this.p[k].setVisible(k === g)); this.p.armR.setVisible(!g); }
  setWet(v) { this.wet = v; const tint = v ? 0x9fc3e6 : 0xffffff; ['head', 'body', 'armL', 'armR', 'legs'].forEach(k => this.p[k].setTint(tint)); v ? this.drips.start() : this.drips.stop(); }
  tween(cfg) { return new Promise(r => this.scene.tweens.add({ ...cfg, onComplete: r })); }
  wait(ms) { return new Promise(r => this.scene.time.delayedCall(ms, r)); }
  // --- reacciones ---
  peek() { return new Promise(r => this.headTween({ angle: -7, y: -4, duration: 120, yoyo: true, onComplete: r })); }
  async wobble(ms = 900) {
    this.setMood('shock');
    const a = this.scene.tweens.add({ targets: [this.p.armL], angle: { from: -60, to: -120 }, duration: 120, yoyo: true, repeat: Math.floor(ms / 240) });
    const b = this.scene.tweens.add({ targets: [this.p.armR], angle: { from: 60, to: 120 }, duration: 120, yoyo: true, repeat: Math.floor(ms / 240) });
    await this.tween({ targets: this, angle: { from: -9, to: 8 }, x: this.x - 6, duration: ms / 4, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
    a.stop(); b.stop(); this.angle = 0; this.p.armL.angle = 0; this.p.armR.angle = 0;
  }
  async laugh(gesture, ms = 1800) {
    this.setMood('laugh'); this.setGesture(gesture);
    if (gesture === 'armUp') this.p.armUp.angle = 60, this.scene.tweens.add({ targets: this.p.armUp, angle: 0, duration: 300, ease: 'Back.easeOut' });
    const h = this.headTween({ angle: { from: -6, to: 4 }, y: { from: -4, to: 2 }, duration: 160, yoyo: true, repeat: -1 });
    const b = this.scene.tweens.add({ targets: this.p.body, y: { from: 6, to: 3 }, duration: 90, yoyo: true, repeat: -1 });
    const l = this.scene.tweens.add({ targets: this.p.armL, angle: { from: -14, to: 10 }, duration: 200, yoyo: true, repeat: -1 });
    await this.wait(ms); h.stop(); b.stop(); l.stop(); this.resetHead(); this.p.body.y = 6; this.p.armL.angle = 0;
    this.setGesture(null); this.setMood('smile');
  }
  async angryShake(ms = 1200) {
    this.setMood('angry');
    const a = this.scene.tweens.add({ targets: this.p.armL, angle: { from: -100, to: -112 }, duration: 100, yoyo: true, repeat: -1 });
    const h = this.headTween({ x: { from: -1.5, to: 1.5 }, duration: 60, yoyo: true, repeat: -1 });
    await this.wait(ms); a.stop(); h.stop(); this.p.armL.angle = 0; this.resetHead();
  }
}

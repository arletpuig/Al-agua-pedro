// Abascal, el tendero de La Trastienda: personaje por capas como Pedro (tools/art-shop.py).
// Origen (0,0) = base del cuello. Unidades = píxeles del mundo; texturas a 2 px por unidad.
const T = 2;
const SH_L = [-98, 30], SH_R = [98, 30];                // hombros
// clave: { f: frame, vb: caja de la textura en unidades locales, pv: pivote, at: posición del pivote }
const PARTS = {
  armL:     { f: 'abArm', vb: [-38, -20, 76, 236], pv: [0, 0], at: SH_L },
  armR:     { f: 'abArm', vb: [-38, -20, 76, 236], pv: [0, 0], at: SH_R, flip: true },
  torso:    { f: 'abTorso', vb: [-130, -50, 260, 284], pv: [0, 0], at: [0, 0] },
  head:     { f: 'abHead', vb: [-78, -200, 156, 204], pv: [0, -20], at: [0, -20] },
  shades:   { f: 'abShades', vb: [-46, -14, 92, 26], pv: [0, 0], at: [0, -168] },
  armBentL: { f: 'abArmBent', vb: [-104, -30, 140, 132], pv: [0, 0], at: SH_L, flip: true },
  armBentR: { f: 'abArmBent', vb: [-104, -30, 140, 132], pv: [0, 0], at: SH_R },
};
const HEAD = ['head', 'shades'], NECK = [0, -20];
const REST_L = 14, REST_R = -14;                        // brazos hacia abajo, manos tras el mostrador
const rnd = (a, b) => a + Math.random() * (b - a);

export class Abascal extends Phaser.GameObjects.Container {
  constructor(scene, x, y, s = 1) {
    super(scene, x, y); this.setScale(s); scene.add.existing(this);
    this.p = {}; this.h = { angle: 0, x: 0, y: 0 }; this.headParts = [];
    for (const [k, { f, vb, pv, at, flip }] of Object.entries(PARTS)) {
      let ox = (pv[0] - vb[0]) / vb[2]; if (flip) ox = 1 - ox;   // al voltear, el pivote se refleja
      const sp = scene.add.image(at[0], at[1], 'atlas', f).setOrigin(ox, (pv[1] - vb[1]) / vb[3]).setScale(1 / T).setFlipX(!!flip);
      sp.base = { x: at[0], y: at[1], angle: 0 }; this.add(sp); this.p[k] = sp;
      if (HEAD.includes(k)) this.headParts.push(sp);
    }
    this.p.armBentL.setVisible(false); this.p.armBentR.setVisible(false);
    this.p.armL.angle = REST_L; this.p.armR.angle = REST_R;
    this.shadesDown = false; this.face = 'abHead';
    this.idle();
  }
  // la cabeza (y las gafas) giran alrededor del cuello por cálculo, igual que en Pedro
  applyHead() {
    const { angle, x, y } = this.h, r = Phaser.Math.DegToRad(angle), c = Math.cos(r), sn = Math.sin(r);
    for (const sp of this.headParts) { const dx = sp.base.x - NECK[0], dy = sp.base.y - NECK[1]; sp.x = NECK[0] + x + dx * c - dy * sn; sp.y = NECK[1] + y + dx * sn + dy * c; sp.angle = angle + sp.base.angle; }
  }
  headTween(cfg) { return this.scene.tweens.add({ targets: this.h, ...cfg, onUpdate: () => this.applyHead() }); }
  setFace(f) { this.face = f; this.p.head.setFrame(f); }
  tw(cfg) { return new Promise(r => this.scene.tweens.add({ ...cfg, onComplete: r })); }
  wait(ms) { return new Promise(r => this.scene.time.delayedCall(ms, r)); }

  // ---------- espera ----------
  idle() {
    const t = this.scene.tweens; this.stopIdle(); this.locked = false;
    this.loops = [
      t.add({ targets: this.p.torso, scaleY: 1.025 / T, duration: 1900, yoyo: true, repeat: -1, ease: 'Sine.InOut' }),
      this.headTween({ angle: { from: -1.5, to: 1.5 }, y: { from: 0, to: -1.5 }, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.InOut' }),
      t.add({ targets: this.p.armL, angle: { from: REST_L - 1, to: REST_L + 2 }, duration: 2100, yoyo: true, repeat: -1, ease: 'Sine.InOut' }),
      t.add({ targets: this.p.armR, angle: { from: REST_R + 1, to: REST_R - 2 }, duration: 2300, yoyo: true, repeat: -1, ease: 'Sine.InOut' }),
    ];
    this.blinkEv = this.scene.time.addEvent({ delay: 3100, loop: true, callback: () => this.blink() });
    this.beatEv = this.scene.time.addEvent({ delay: 4200, loop: true, callback: () => { if (!this.locked && !this.inBeat) this.beat(); } });
  }
  // pausa los bucles de cabeza y brazos mientras hace un gesto (la respiración sigue)
  hold(on) { this.loops?.forEach((l, i) => { if (i) on ? l.pause() : l.resume(); }); if (on) { this.p.armL.angle = REST_L; this.p.armR.angle = REST_R; } }
  stopIdle() { this.loops?.forEach(l => l.stop()); this.loops = null; this.blinkEv?.remove(); this.beatEv?.remove(); this.h.angle = 0; this.h.x = 0; this.h.y = 0; this.applyHead(); this.p.torso.scaleY = 1 / T; }
  blink() { if (this.locked || this.inBeat || this.face !== 'abHead') return; this.p.head.setFrame('abHeadBlink'); this.scene.time.delayedCall(130, () => this.p.head.setFrame(this.face)); }
  // gestos sueltos de tendero clandestino
  async beat(name) {
    if (this.locked || this.inBeat) return;
    const beats = ['look', 'shades', 'beard', 'wink', 'rub'], pick = name || beats.filter(b => b !== this.lastBeat)[Math.floor(rnd(0, 4))];
    this.lastBeat = pick; this.inBeat = true; this.hold(true); const P = this.p;
    try {
      if (pick === 'look') {                 // vigila el callejón: a un lado, al otro
        this.setFace('abHeadSide'); await this.tw({ targets: this.h, x: -4, angle: -4, duration: 260, onUpdate: () => this.applyHead() }); await this.wait(650);
        this.setFace('abHeadRight'); await this.tw({ targets: this.h, x: 4, angle: 4, duration: 320, onUpdate: () => this.applyHead() }); await this.wait(650);
        await this.tw({ targets: this.h, x: 0, angle: 0, duration: 260, onUpdate: () => this.applyHead() }); this.setFace('abHead');
      } else if (pick === 'shades') {        // baja las gafas de sol, mira por encima y las sube
        await this.shades(true); this.setFace('abHeadBrow'); await this.wait(1100); await this.shades(false); this.setFace('abHead');
      } else if (pick === 'beard') {         // se acaricia la barba pensativo
        this.setFace('abHeadSide'); P.armR.setVisible(false); P.armBentR.setVisible(true).setAngle(-10);
        await this.tw({ targets: P.armBentR, angle: { from: -10, to: 13 }, duration: 280, ease: 'Back.Out' });
        await this.tw({ targets: P.armBentR, angle: { from: 13, to: 21 }, duration: 240, yoyo: true, repeat: 2, ease: 'Sine.InOut' });
        P.armBentR.setVisible(false); P.armR.setVisible(true); this.setFace('abHead');
      } else if (pick === 'wink') {          // guiño cómplice al jugador
        this.setFace('abHeadWink'); this.sparkle(22, -112); await this.tw({ targets: this.h, angle: 6, duration: 160, yoyo: true, hold: 700, onUpdate: () => this.applyHead() }); this.setFace('abHead');
      } else {                               // se frota las manos
        await this.rub(1300);
      }
    } finally { this.inBeat = false; if (!this.locked) this.hold(false); }
  }
  async shades(down) {
    if (this.shadesDown === down) return; this.shadesDown = down;
    await this.tw({ targets: this.p.shades.base, y: down ? -110 : -168, duration: 260, ease: down ? 'Bounce.Out' : 'Back.In', onUpdate: () => this.applyHead() });
  }
  async rub(ms) {
    const P = this.p; this.setFace('abHeadBrow');
    P.armL.setVisible(false); P.armR.setVisible(false); P.armBentL.setVisible(true).setAngle(0); P.armBentR.setVisible(true).setAngle(0);
    // codos fuera y manos juntas delante del pecho
    P.armBentL.setAngle(42); P.armBentR.setAngle(-42);
    const a = this.scene.tweens.add({ targets: P.armBentL, angle: { from: 40, to: 47 }, duration: 110, yoyo: true, repeat: -1 });
    const b = this.scene.tweens.add({ targets: P.armBentR, angle: { from: -47, to: -40 }, duration: 110, yoyo: true, repeat: -1 });
    await this.wait(ms); a.stop(); b.stop();
    P.armBentL.setVisible(false); P.armBentR.setVisible(false); P.armL.setVisible(true); P.armR.setVisible(true); this.setFace('abHead');
  }
  sparkle(x, y) {
    const s = this.scene.add.image(this.x + x * this.scaleX, this.y + y * this.scaleY, 'atlas', 'star').setDepth(this.depth + 1).setScale(0);
    this.scene.tweens.add({ targets: s, scale: .9, angle: 180, duration: 300, yoyo: true, onComplete: () => s.destroy() });
  }
  // ---------- reacciones de venta ----------
  // Señala un objeto con la palma abierta: brazo del lado del objeto, girado desde el hombro hacia él.
  async present(wx, wy) {
    this.locked = true; await this.untilFree(); this.hold(true); this.release();
    const left = wx < this.x, arm = left ? this.p.armL : this.p.armR, sh = left ? SH_L : SH_R;
    const dx = (wx - this.x) / this.scaleX - sh[0], dy = (wy - this.y) / this.scaleY - sh[1];
    const ang = Phaser.Math.RadToDeg(Math.atan2(-dx, dy)), reach = Phaser.Math.Clamp(ang, -165, 165);
    this.setFace(left ? 'abHeadSide' : 'abHeadRight');
    this.scene.tweens.add({ targets: this.h, angle: left ? -5 : 5, duration: 250, onUpdate: () => this.applyHead() });
    this.presenting = arm;
    await this.tw({ targets: arm, angle: reach, duration: 340, ease: 'Back.Out' });
    this.setFace('abHeadBrow');
  }
  release() {
    const P = this.p; P.armBentL.setVisible(false); P.armBentR.setVisible(false); P.armL.setVisible(true).setFrame('abArm'); P.armR.setVisible(true).setFrame('abArm');
    if (this.presenting) { this.scene.tweens.add({ targets: this.presenting, angle: this.presenting === P.armL ? REST_L : REST_R, duration: 300, ease: 'Sine.InOut' }); this.presenting = null; }
  }
  untilFree() { return new Promise(r => { const f = () => this.inBeat ? this.scene.time.delayedCall(60, f) : r(); f(); }); }
  async relax() { this.release(); this.h.angle = 0; this.applyHead(); await this.shades(false); this.setFace('abHead'); this.locked = false; this.hold(false); }
  // Venta cerrada: puño, carcajada y gafas abajo
  async deal() {
    this.locked = true; await this.untilFree(); this.hold(true); this.release();
    const P = this.p; P.armR.setFrame('abFist');
    await this.tw({ targets: P.armR, angle: 150, duration: 260, ease: 'Back.Out' });
    this.setFace('abHeadLaugh'); this.shades(true);
    const s = this.scene.tweens.add({ targets: P.torso, y: { from: 0, to: -4 }, duration: 90, yoyo: true, repeat: -1 });
    const h = this.headTween({ angle: { from: -4, to: 4 }, y: { from: 0, to: -4 }, duration: 110, yoyo: true, repeat: -1 });
    const a = this.scene.tweens.add({ targets: P.armR, angle: { from: 150, to: 140 }, duration: 110, yoyo: true, repeat: -1 });
    await this.wait(1400); s.stop(); h.stop(); a.stop(); P.torso.y = 0;
    P.armR.setFrame('abArm'); await this.tw({ targets: P.armR, angle: REST_R, duration: 300 });
    await this.relax();
  }
  // Sin dinero: niega con la cabeza
  async refuse() {
    this.locked = true; await this.untilFree(); this.hold(true); this.release(); this.setFace('abHeadNo');
    await this.tw({ targets: this.h, angle: { from: -6, to: 6 }, duration: 130, yoyo: true, repeat: 2, onUpdate: () => this.applyHead() });
    this.h.angle = 0; this.applyHead(); await this.wait(400); this.setFace('abHead'); this.locked = false;
  }
  // Para la demostración: risa sin más
  async laugh(ms = 1200) {
    this.locked = true; await this.untilFree(); this.hold(true); this.setFace('abHeadLaugh');
    const h = this.headTween({ angle: { from: -4, to: 4 }, duration: 110, yoyo: true, repeat: -1 });
    await this.wait(ms); h.stop(); this.h.angle = 0; this.applyHead(); this.setFace('abHead'); this.locked = false;
  }
}

// Pedro: contenedor Phaser con capas independientes generadas a partir de la ilustración de referencia
// (tools/render.mjs): cabeza con 5 expresiones, busto, piernas, antebrazos y gestos.
// Unidades de diseño: 1 unidad = 5 px de la ilustración original; origen (0,0) = cadera/asiento. Texturas a 2 px por unidad.
export const TEX_SCALE = 2;
const ELBOW_L = [-87, -6], ELBOW_R = [89, -8], NECK = [-1.6, -80], KNEE_L = [-35, 20], KNEE_R = [35, 20];
// clave: { f: frame, vb: [x,y,w,h] caja de la textura en unidades locales, pv: pivote local, at: posición del pivote en el personaje }
const PARTS = {
  shinL:     { f: 'shin', vb: [-26, -10, 52, 122], pv: [0, 0], at: KNEE_L },
  shinR:     { f: 'shin', vb: [-26, -10, 52, 122], pv: [0, 0], at: KNEE_R },
  hips:      { f: 'hips', vb: [-72, -16, 144, 56], pv: [0, 0], at: [0, 0] },
  bust:      { f: 'bust', vb: [-126, -97, 235, 100], pv: [0, 3], at: [0, 3] },
  armL:      { f: 'forearm', vb: [-24, -18, 48, 116], pv: [0, 0], at: ELBOW_L },
  armR:      { f: 'forearm', vb: [-24, -18, 48, 116], pv: [0, 0], at: ELBOW_R },
  armUp:     { f: 'armUp', vb: [-28, -150, 56, 168], pv: [0, 0], at: ELBOW_R },
  armNose:   { f: 'armReach', vb: [-24, -140, 48, 156], pv: [0, 0], at: ELBOW_R },
  armPoint:  { f: 'armPoint', vb: [-60, -96, 92, 112], pv: [0, 0], at: ELBOW_R },
  head:      { f: 'head', vb: [-66, -232, 120, 160], pv: NECK, at: NECK },
  noseTomato:{ f: 'noseTomato', vb: [-20, -22, 40, 42], pv: [0, 0], at: [17, -127] },
  sweat:     { f: 'sweat', vb: [-9, -13, 18, 26], pv: [0, 0], at: [47, -178] },
};
const HEAD_PARTS = ['head', 'noseTomato', 'sweat'];
const GESTURES = ['armUp', 'armNose', 'armPoint'];
const HEAD_FRAME = { smile: 'head', smug: 'head', laugh: 'headLaugh', shock: 'headShock', angry: 'headAngry' };
const rnd = (a, b) => a + Math.random() * (b - a);
const REST_L = -52, REST_R = 51;

export class Pedro extends Phaser.GameObjects.Container {
  constructor(scene, x, y, s = 0.8) {
    super(scene, x, y);
    this.s = s; this.setScale(s); scene.add.existing(this);
    this.p = {}; this.head = { angle: 0, x: 0, y: 0 }; this.headParts = [];
    for (const key of ['shinL', 'shinR', 'hips', 'bust', 'armL', 'armR', 'armUp', 'armNose', 'armPoint', 'head', 'noseTomato', 'sweat']) {
      const { f, vb, pv, at } = PARTS[key];
      const sp = scene.add.image(at[0], at[1], 'atlas', f).setOrigin((pv[0] - vb[0]) / vb[2], (pv[1] - vb[1]) / vb[3]).setScale(1 / TEX_SCALE);
      sp.base = { x: at[0], y: at[1], angle: 0 }; this.add(sp); this.p[key] = sp;
      if (HEAD_PARTS.includes(key)) this.headParts.push(sp);
    }
    this.p.shinR.setFlipX(true); this.p.armR.setFlipX(true);
    this.p.armL.angle = REST_L; this.p.armR.angle = REST_R; this.p.armNose.angle = -31; this.p.armUp.angle = 5;
    // El emisor va fuera del contenedor (dentro de un contenedor corrompe el dibujado en WebGL)
    this.drips = scene.add.particles(0, 0, 'atlas', { frame: 'drop', follow: this, followOffset: { x: 0, y: -90 * s }, speedY: { min: 40, max: 90 }, speedX: { min: -10, max: 10 }, lifespan: 700, scale: { start: .7, end: .3 }, alpha: { start: 1, end: 0 }, frequency: 80, quantity: 1, emitting: false, maxParticles: 40 });
    this.drips.addEmitZone({ type: 'random', source: new Phaser.Geom.Rectangle(-70 * s, -40 * s, 140 * s, 90 * s) });
    this.setMood('smile'); this.setGesture(null);
    this.idle();
  }
  // La cabeza y lo que lleva encima giran alrededor del cuello por cálculo (los contenedores anidados fallan en WebGL)
  applyHead() {
    const { angle, x, y } = this.head, r = Phaser.Math.DegToRad(angle), c = Math.cos(r), sn = Math.sin(r);
    for (const sp of this.headParts) { const dx = sp.base.x - NECK[0], dy = sp.base.y - NECK[1]; sp.x = NECK[0] + x + dx * c - dy * sn; sp.y = NECK[1] + y + dx * sn + dy * c; sp.angle = angle + sp.base.angle; }
  }
  headTween(cfg) { return this.scene.tweens.add({ targets: this.head, ...cfg, onUpdate: () => this.applyHead() }); }
  resetHead() { this.head.angle = 0; this.head.x = 0; this.head.y = 0; this.applyHead(); }
  restArms() { this.p.armL.angle = REST_L; this.p.armR.angle = REST_R; }
  // ---------- espera: bucles de base + gestos sueltos encadenados ----------
  // Estado 'idle' = puede hacer gestos; cualquier reacción (setMood distinto de smile) lo bloquea, como un "modo cinemático".
  idle() {
    const t = this.scene.tweens; this.stopIdle(); this.locked = false;
    this.idleTweens = [
      t.add({ targets: this.p.bust, scaleY: (1 / TEX_SCALE) * 1.035, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      t.add({ targets: this, angle: { from: -0.9, to: 0.9 }, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      this.headTween({ angle: { from: -2.5, to: 2.5 }, y: { from: 0, to: -1.5 }, duration: 2300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      t.add({ targets: this.p.armL, angle: { from: REST_L - 2, to: REST_L + 3 }, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      t.add({ targets: this.p.armR, angle: { from: REST_R + 2, to: REST_R - 3 }, duration: 2300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      t.add({ targets: this.p.shinL, angle: { from: 8, to: -7 }, duration: 1250, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }),
      t.add({ targets: this.p.shinR, angle: { from: -7, to: 8 }, duration: 1250, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 380 }),
    ];
    this.blinkEv = this.scene.time.addEvent({ delay: 3300, loop: true, callback: () => this.blink() });
    this.scheduleBeat();
  }
  scheduleBeat() { this.beatEv?.remove(); this.beatEv = this.scene.time.delayedCall(rnd(2600, 5200), () => { if (!this.locked && this.idleTweens) this.playBeat(); this.scheduleBeat(); }); }
  playBeat(name) {
    const beats = ['glanceDown', 'glanceTarget', 'tie', 'tap', 'kick'], pick = name || beats.filter(b => b !== this.lastBeat)[Math.floor(Math.random() * 4)];
    this.lastBeat = pick; this.stopBeat(); this.inBeat = true;
    const P = this.p, done = () => { this.inBeat = false; if (!this.locked) { P.head.setFrame('head'); P.sweat.setVisible(false); } };
    const pause = on => this.idleTweens?.forEach((tw, i) => { if (i >= 3) on ? tw.pause() : tw.resume(); });   // brazos y piernas
    const chain = tweens => { this.beat = this.scene.tweens.chain({ tweens, onComplete: () => { pause(false); done(); } }); };
    const H = this.head, upd = () => this.applyHead();
    if (pick === 'glanceDown') {          // mira a las pirañas, traga saliva, recoge las piernas
      pause(true); P.head.setFrame('headDown'); P.sweat.setVisible(true); P.sweat.base.y = -178;
      this.scene.tweens.add({ targets: P.sweat.base, y: -150, duration: 1300, onUpdate: upd });
      chain([{ targets: [P.shinL, P.shinR], angle: 0, duration: 200, ease: 'Quad.Out' },
        { targets: P.shinL, angle: 16, duration: 260, ease: 'Back.Out' }, { targets: P.shinR, angle: -16, duration: 220, ease: 'Back.Out', offset: '-=200' },
        { targets: P.bust, y: 1, duration: 120, yoyo: true, repeat: 1, delay: 500 },                                  // trago
        { targets: [P.shinL, P.shinR], angle: 0, duration: 350, ease: 'Sine.InOut', delay: 250 }]);
    } else if (pick === 'glanceTarget') { // mira la diana de reojo y suelta una risita
      P.head.setFrame('headSide');
      chain([{ targets: P.bust, x: 2, duration: 500, ease: 'Sine.Out', hold: 500, yoyo: true },
        { targets: P.bust, y: { from: 3, to: 0.5 }, duration: 80, yoyo: true, repeat: 3, onStart: () => P.head.setFrame('head') }]);
    } else if (pick === 'tie') {          // se ajusta la corbata con suficiencia
      pause(true);
      chain([{ targets: P.armR, angle: 124, duration: 380, ease: 'Back.Out' },
        { targets: P.armR, angle: { from: 124, to: 116 }, duration: 110, yoyo: true, repeat: 3 },
        { targets: P.armR, angle: REST_R, duration: 420, ease: 'Sine.InOut', delay: 150 }]);
    } else if (pick === 'tap') {          // tamborilea con los dedos en la rodilla
      pause(true);
      chain([{ targets: P.armL, angle: { from: REST_L, to: REST_L - 6 }, duration: 75, yoyo: true, repeat: 7 }, { targets: P.armL, angle: REST_L, duration: 120 }]);
    } else {                              // patalea
      pause(true);
      chain([{ targets: P.shinL, angle: -20, duration: 170, ease: 'Quad.Out' }, { targets: P.shinR, angle: 20, duration: 170, ease: 'Quad.Out', offset: '-=90' },
        { targets: [P.shinL, P.shinR], angle: 0, duration: 520, ease: 'Bounce.Out' }]);
    }
  }
  stopBeat() { if (this.beat) { this.beat.stop(); this.beat = null; } if (this.inBeat) { this.inBeat = false; this.idleTweens?.forEach(tw => tw.resume()); this.p.bust.x = 0; this.p.bust.y = 3; this.p.sweat.base.y = -178; } }
  blink() { if (this.locked || this.inBeat || HEAD_FRAME[this.mood] !== 'head') return; this.p.head.setFrame('headBlink'); this.scene.time.delayedCall(120, () => { if (!this.locked && !this.inBeat && HEAD_FRAME[this.mood] === 'head') this.p.head.setFrame('head'); }); }
  stopIdle() { this.stopBeat(); this.beatEv?.remove(); this.idleTweens?.forEach(t => t.stop()); this.idleTweens = null; this.blinkEv?.remove(); this.resetHead(); this.restArms(); this.angle = 0; this.p.bust.scaleY = 1 / TEX_SCALE; this.p.shinL.angle = 0; this.p.shinR.angle = 0; }
  setMood(m) { this.locked = m !== 'smile'; if (this.locked) this.stopBeat(); this.mood = m; this.p.head.setFrame(HEAD_FRAME[m] || 'head'); this.p.sweat.setVisible(m === 'shock'); }
  setGesture(g) { GESTURES.forEach(k => this.p[k].setVisible(k === g)); this.p.armR.setVisible(!g); this.p.noseTomato.setVisible(g === 'armNose'); }
  setWet(v) { this.wet = v; const tint = v ? 0xdcecfa : 0xffffff; ['head', 'bust', 'hips', 'shinL', 'shinR', 'armL', 'armR', 'armUp', 'armNose', 'armPoint'].forEach(k => this.p[k].setTint(tint)); v ? this.drips.start() : this.drips.stop(); }
  tween(cfg) { return new Promise(r => this.scene.tweens.add({ ...cfg, onComplete: r })); }
  wait(ms) { return new Promise(r => this.scene.time.delayedCall(ms, r)); }
  // --- reacciones ---
  peek() { return new Promise(r => this.headTween({ angle: -8, y: -5, duration: 120, yoyo: true, onComplete: r })); }
  async wobble(ms = 900) {
    this.setMood('shock');
    const a = this.scene.tweens.add({ targets: this.p.armL, angle: { from: 120, to: 170 }, duration: 110, yoyo: true, repeat: -1 });
    const b = this.scene.tweens.add({ targets: this.p.armR, angle: { from: -120, to: -170 }, duration: 110, yoyo: true, repeat: -1 });
    const h = this.headTween({ angle: { from: -7, to: 7 }, duration: 140, yoyo: true, repeat: -1 });
    const x0 = this.x;
    await this.tween({ targets: this, angle: { from: -9, to: 8 }, x: { from: x0 - 6, to: x0 + 6 }, duration: ms / 4, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
    a.stop(); b.stop(); h.stop(); this.angle = 0; this.x = x0; this.restArms(); this.resetHead();
  }
  async laugh(gesture, ms = 1800) {
    this.setMood('laugh'); this.setGesture(gesture);
    const g = this.p[gesture], a0 = g.angle; g.angle = a0 + 50; this.scene.tweens.add({ targets: g, angle: a0, duration: 300, ease: 'Back.easeOut' });
    const h = this.headTween({ angle: { from: -6, to: 5 }, y: { from: -5, to: 2 }, duration: 160, yoyo: true, repeat: -1 });
    const b = this.scene.tweens.add({ targets: this.p.bust, y: { from: 3, to: 0 }, duration: 90, yoyo: true, repeat: -1 });
    const l = this.scene.tweens.add({ targets: this.p.armL, angle: { from: REST_L - 12, to: REST_L + 10 }, duration: 200, yoyo: true, repeat: -1 });
    const w = gesture === 'armPoint' ? this.scene.tweens.add({ targets: g, scale: { from: 1 / TEX_SCALE, to: 1.15 / TEX_SCALE }, duration: 180, yoyo: true, repeat: -1 }) : null;
    await this.wait(ms); h.stop(); b.stop(); l.stop(); w?.stop(); g.setScale(1 / TEX_SCALE).setAngle(a0); this.resetHead(); this.p.bust.y = 3; this.restArms();
    this.setGesture(null); this.setMood('smile');
  }
  async angryShake(ms = 1200) {
    this.setMood('angry');
    const a = this.scene.tweens.add({ targets: this.p.armL, angle: { from: 146, to: 158 }, duration: 100, yoyo: true, repeat: -1 });
    const h = this.headTween({ x: { from: -1.5, to: 1.5 }, duration: 60, yoyo: true, repeat: -1 });
    await this.wait(ms); a.stop(); h.stop(); this.restArms(); this.resetHead();
  }
}

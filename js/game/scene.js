// Escena principal: Pedro, diana, lanzamiento, resultados y efectos.
import { Pedro, TEX_SCALE, CHAIR } from './pedro.js';
import { buildScenery, L } from './scenery.js';
import { CONFIG } from '../config.js';
import { SFX } from '../audio.js';

export class MainScene extends Phaser.Scene {
  constructor() { super('main'); this.busy = false; this.aim = null; this.bus = new Phaser.Events.EventEmitter(); }
  preload() {
    // Atlas único (tests/rasterize.mjs + tests/build-atlas.py): una sola textura evita fallos del lote multi-textura en WebGL
    this.load.atlas('atlas', `${this.assetBase || ''}assets/atlas.png`, `${this.assetBase || ''}assets/atlas.json`);
  }
  create() {
    this.cameras.main.setZoom(this.res || 1).centerOn(400, 300);
    this.sc = buildScenery(this);
    const PS = 0.8; this.chairHome = { x: L.SEAT_X + CHAIR.pv[0] * PS, y: L.SEAT_Y + CHAIR.pv[1] * PS };
    this.chair = this.add.image(this.chairHome.x, this.chairHome.y, 'atlas', 'chair').setOrigin((CHAIR.pv[0] - CHAIR.vb[0]) / CHAIR.vb[2], (CHAIR.pv[1] - CHAIR.vb[1]) / CHAIR.vb[3]).setScale(PS / TEX_SCALE).setDepth(3);
    this.pedro = new Pedro(this, L.SEAT_X, L.SEAT_Y, PS).setDepth(4); this.pedro.drips.setDepth(4);
    this.target = this.add.image(L.TARGET_X, L.TARGET_Y, 'atlas', 'target').setScale(.5).setDepth(2);
    this.track = this.add.graphics().setDepth(6).setAlpha(0); this.track.lineStyle(3, 0xffffff, .6); for (let x = CONFIG.AIM_MIN; x < CONFIG.AIM_MAX; x += 18) this.track.lineBetween(x, L.TARGET_Y, x + 9, L.TARGET_Y);
    this.tomato = this.add.image(0, 0, 'atlas', 'tomato').setScale(.55).setDepth(7).setVisible(false);
    this.splats = this.add.container(0, 0).setDepth(6);
    this.juice = this.add.particles(0, 0, 'atlas', { frame: 'spark',  speed: { min: 60, max: 220 }, angle: { min: 0, max: 360 }, gravityY: 500, lifespan: 600, scale: { start: .5, end: 0 }, tint: [0xe02b2b, 0xff6b5b, 0x9c1414], emitting: false, maxParticles: 120 }).setDepth(7);
    this.splash = this.add.particles(0, 0, 'atlas', { frame: 'spark',  speedY: { min: -420, max: -160 }, speedX: { min: -220, max: 220 }, gravityY: 900, lifespan: { min: 600, max: 1100 }, scale: { start: .9, end: .2 }, alpha: { start: 1, end: 0 }, tint: [0xffffff, 0xbdf0ff, 0x7fdfff], emitting: false, maxParticles: 160 }).setDepth(7);
    this.stars = this.add.particles(0, 0, 'atlas', { frame: 'star',  speed: { min: 80, max: 260 }, angle: { min: 0, max: 360 }, lifespan: 900, scale: { start: 1, end: 0 }, rotate: { start: 0, end: 360 }, gravityY: 200, emitting: false, maxParticles: 80 }).setDepth(8);
    this.coins = this.add.particles(0, 0, 'atlas', { frame: 'peseta',  speedY: { min: -360, max: -200 }, speedX: { min: -120, max: 120 }, gravityY: 700, lifespan: 1300, scale: { start: .8, end: .5 }, alpha: { start: 1, end: 0 }, rotate: { start: 0, end: 540 }, emitting: false, maxParticles: 40 }).setDepth(8);
    this.bubble = this.add.container(0, 0).setDepth(9).setVisible(false);
    this.bubbleBg = this.add.graphics(); this.bubbleTxt = this.add.text(0, 0, '', { fontFamily: 'Arial', fontSize: 16, fontStyle: 'bold', color: '#222', align: 'center', wordWrap: { width: 170 }, resolution: 2 }).setOrigin(.5);
    this.bubble.add([this.bubbleBg, this.bubbleTxt]);
    this.input.on('pointerdown', () => { if (this.aim) this.stopAim(); });
    this.input.keyboard?.on('keydown-SPACE', () => { if (this.aim) this.stopAim(); });
    this.ready = true; this.bus.emit('ready');
  }
  update(t, dt) {
    this.sc.waves[0].tilePositionX += dt * .03; this.sc.waves[1].tilePositionX -= dt * .025; this.sc.waves[2].tilePositionX += dt * .04;
    if (this.aim) {
      const a = this.aim; a.x += a.dir * a.speed * dt; a.t += dt;
      if (a.x >= CONFIG.AIM_MAX) { a.x = CONFIG.AIM_MAX; a.dir = -1; } if (a.x <= CONFIG.AIM_MIN) { a.x = CONFIG.AIM_MIN; a.dir = 1; }
      a.y = L.TARGET_Y + Math.sin(a.t / 260) * CONFIG.AIM_WOBBLE;
      this.tomato.setPosition(a.x, a.y).setAngle(a.t * .4);
    }
  }
  wait(ms) { return new Promise(r => this.time.delayedCall(ms, r)); }
  tween(cfg) { return new Promise(r => this.tweens.add({ ...cfg, onComplete: r })); }

  // ---------- bocadillo y textos ----------
  say(text, ms = 2200, pos = 'head') {
    const p = pos === 'water' ? { x: 470, y: 455 } : { x: 535, y: 135 }, tail = pos === 'water' ? 'left' : 'left';
    this.bubbleTxt.setText(text); const w = Math.max(90, this.bubbleTxt.width + 26), h = this.bubbleTxt.height + 20;
    this.bubbleBg.clear(); this.bubbleBg.fillStyle(0xffffff, 1); this.bubbleBg.lineStyle(2.5, 0x333333, 1);
    this.bubbleBg.fillRoundedRect(-w / 2, -h / 2, w, h, 12); this.bubbleBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    this.bubbleBg.fillTriangle(-w / 2 + 10, h / 2 - 2, -w / 2 - 14, h / 2 + 16, -w / 2 + 34, h / 2 - 2); this.bubbleBg.lineBetween(-w / 2 + 10, h / 2 - 1, -w / 2 - 14, h / 2 + 16); this.bubbleBg.lineBetween(-w / 2 - 14, h / 2 + 16, -w / 2 + 34, h / 2 - 1);
    this.bubble.setPosition(p.x, p.y).setVisible(true).setScale(.5); this.tweens.add({ targets: this.bubble, scale: 1, duration: 250, ease: 'Back.easeOut' });
    clearTimeout(this.bubbleTimer); this.bubbleTimer = setTimeout(() => this.bubble.setVisible(false), ms);
  }
  hush() { clearTimeout(this.bubbleTimer); this.bubble.setVisible(false); }
  fxText(text, x, y, color = '#e63946', size = 44) {
    const t = this.add.text(x, y, text, { fontFamily: 'Arial Black, Arial', fontSize: size, color, stroke: '#fff', strokeThickness: 8, fontStyle: 'bold', resolution: 2 }).setOrigin(.5).setDepth(9).setScale(.5).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1.1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, duration: 900, delay: 500, onComplete: () => t.destroy() });
  }
  // ---------- reacciones a clics ----------
  peek() { if (!this.busy) this.pedro.peek(); }
  tomatoEarned(line) { if (this.busy) return; this.pedro.setMood('shock'); this.say(line, 1600); this.time.delayedCall(1500, () => { if (!this.busy) this.pedro.setMood('smile'); }); }
  tauntIdle(line) { if (this.busy || this.aim) return; this.pedro.setMood('smug'); this.say(line, 2400); this.time.delayedCall(2400, () => { if (!this.busy) this.pedro.setMood('smile'); }); }

  // ---------- lanzamiento ----------
  startAim(speedMult = 1) {
    this.hush(); this.pedro.setMood('smile');
    this.aim = { x: CONFIG.AIM_MIN, y: L.TARGET_Y, dir: 1, t: 0, speed: CONFIG.TOMATO_SPEED * speedMult };
    this.tomato.setVisible(true).setScale(.55).setPosition(this.aim.x, this.aim.y); this.track.setAlpha(1);
    SFX.throwStart();
    return new Promise(res => { this.aimResolve = res; });
  }
  stopAim() {
    if (!this.aim) return;
    const { x, y } = this.aim; this.aim = null; SFX.stop();
    const dist = Phaser.Math.Distance.Between(x, y, L.TARGET_X, L.TARGET_Y);
    const kind = dist <= CONFIG.PERFECT_RADIUS ? 'perfect' : dist <= CONFIG.NEAR_RADIUS ? 'near' : 'miss';
    const onPedro = kind === 'miss' && x > L.SEAT_X - 60 && x < L.SEAT_X + 60 && y > 120 && y < 340;
    const precision = Math.max(0, 1 - dist / (CONFIG.AIM_MAX - L.TARGET_X));
    this.aimResolve({ x, y, dist, kind, onPedro, precision });
  }
  // Anima el vuelo e impacto de un tomate ya decidido. decision: {fall:boolean, pesetas:number}
  async resolveThrow(res, decision, last) {
    this.busy = true; this.track.setAlpha(0);
    SFX.whoosh();
    await this.tween({ targets: this.tomato, scale: { from: .55, to: 1 }, y: res.y - 40, duration: 160, ease: 'Quad.easeOut' });
    await this.tween({ targets: this.tomato, scale: .45, y: res.y, duration: 150, ease: 'Quad.easeIn' });
    this.tomato.setVisible(false);
    SFX.splat(); this.juice.explode(18, res.x, res.y); this.addSplat(res.x, res.y, res.kind === 'perfect' ? 1.2 : .9);
    if (res.kind === 'perfect' || res.kind === 'near') this.tweens.add({ targets: this.target, scale: { from: .42, to: .5 }, angle: { from: res.kind === 'perfect' ? -12 : -8, to: 0 }, duration: 450, ease: 'Elastic.easeOut' });
    this.cameras.main.shake(120, decision.fall ? .008 : .003);
    try {
      if (decision.fall) await this.fall(res, decision, last);
      else if (res.kind === 'near') await this.near(last);
      else if (res.onPedro) await this.hitPedro(last);
      else await this.miss(last);
    } finally { this.busy = false; }
  }
  addSplat(x, y, s) {
    const sp = this.add.image(x, y, 'atlas', 'splat').setScale(0).setAngle(Phaser.Math.Between(-30, 30)); this.splats.add(sp);
    this.tweens.add({ targets: sp, scale: s * .5, duration: 250, ease: 'Back.easeOut' });
    this.tweens.add({ targets: sp, y: y + 25, scaleY: s * .6, alpha: 0, duration: 2600, delay: 600, ease: 'Quad.easeIn', onComplete: () => sp.destroy() });
    if (this.splats.length > 14) this.splats.first.destroy();
  }
  async fall(res, decision, last) {
    const P = this.pedro; P.stopIdle(); SFX.clank(); SFX.win();
    this.fxText(res.kind === 'perfect' ? '¡PERFECTO!' : '¡AL AGUA!', 400, 62);
    P.setMood('shock'); this.say(['¡¿QUÉ?! ¡NOOO!', '¡Esto es un golpe de Estado!', '¡Aaaaah!'][Phaser.Math.Between(0, 2)], 1200);
    this.tweens.add({ targets: this.chair, angle: -75, x: this.chair.x - 18, y: this.chair.y + 8, duration: 650, ease: 'Quad.easeIn' });
    await this.wait(300); this.hush(); SFX.fall();
    await this.tween({ targets: P, x: L.SEAT_X - 95, y: L.WATER_Y + 60, angle: -130, duration: 900, ease: 'Quad.easeIn' });
    SFX.splash(); this.splash.explode(60, P.x, L.WATER_Y + 10); this.cameras.main.shake(300, .012); this.ripple(P.x, L.WATER_Y + 12); this.sc.cheer(true); this.sc.balloons(); SFX.cheer();
    if (decision.pesetas) { this.coins.explode(decision.pesetas * 4, P.x, L.WATER_Y); this.fxText(`+${decision.pesetas} ₧`, P.x, L.WATER_Y - 40, '#ffb400', 40); SFX.coin(); }
    await this.tween({ targets: P, y: P.y + 60, alpha: 0, duration: 300, ease: 'Quad.easeIn' });
    P.setMood('angry'); P.setWet(true); P.setAngle(0);
    if (last) {
      await this.tween({ targets: P, y: L.WATER_Y + 42, alpha: 1, duration: 900, ease: 'Quad.easeOut' });
      SFX.angry(); this.say(LINES.wetWater[Phaser.Math.Between(0, LINES.wetWater.length - 1)], 2000, 'water'); await P.angryShake(2000); this.hush();
      await this.tween({ targets: P, y: P.y + 110, alpha: 0, duration: 450, ease: 'Quad.easeIn' });
    } else await this.wait(250);
    this.tweens.add({ targets: this.chair, angle: 0, x: this.chairHome.x, y: this.chairHome.y, duration: 400, ease: 'Back.easeOut' });
    P.setPosition(L.SEAT_X, L.SEAT_Y - 140).setAlpha(0).setAngle(0);
    await this.tween({ targets: P, y: L.SEAT_Y, alpha: 1, duration: 550, ease: 'Bounce.easeOut' });
    P.idle();
    if (last) { this.say(LINES.wetChair[Phaser.Math.Between(0, LINES.wetChair.length - 1)], 2400); }
    this.time.delayedCall(last ? 4500 : 2500, () => { P.setWet(false); if (!this.busy) P.setMood('smile'); });
  }
  ripple(x, y) { for (let i = 0; i < 3; i++) { const r = this.add.ellipse(x, y, 40, 12).setStrokeStyle(3, 0xffffff, .9).setDepth(5).setScale(.2); this.tweens.add({ targets: r, scaleX: 3.2, scaleY: 3.2, alpha: 0, duration: 1300, delay: i * 220, ease: 'Quad.easeOut', onComplete: () => r.destroy() }); } }
  async near(last) {
    SFX.near(); this.fxText('¡CASI!', 400, 62, '#ff8a00');
    this.tweens.add({ targets: this.chair, angle: { from: -6, to: 5 }, duration: 120, yoyo: true, repeat: 2 });
    await this.pedro.wobble(last ? 900 : 500);
    this.pedro.setMood('smug');
    if (last) { this.say(LINES.near[Phaser.Math.Between(0, LINES.near.length - 1)], 2200); await this.wait(700); }
    this.time.delayedCall(1200, () => { if (!this.busy) this.pedro.setMood('smile'); });
  }
  async miss(last) {
    SFX.miss(); this.fxText('FALLO', 400, 62, '#1f2d55');
    const g = ['armUp', 'armNose', 'armPoint'][Phaser.Math.Between(0, 2)];
    SFX.laugh(); if (last) this.say(LINES.miss[Phaser.Math.Between(0, LINES.miss.length - 1)], 2400);
    await this.pedro.laugh(g, last ? 1800 : 700);
  }
  async hitPedro(last) {
    SFX.angry(); this.fxText('¡EN LA CARA!', 400, 62, '#1f2d55', 36);
    if (last) this.say(LINES.face[Phaser.Math.Between(0, LINES.face.length - 1)], 2200);
    await this.pedro.angryShake(last ? 1600 : 600); this.pedro.setMood('smile');
  }
  // efecto Falcón: avión cruzando
  falconFly() {
    const f = this.add.container(-80, 120).setDepth(8), g = this.add.graphics();
    g.fillStyle(0xffffff, 1); g.fillTriangle(0, 0, -50, 14, -50, -14); g.fillRect(-60, -6, 40, 12); g.fillStyle(0xe63946, 1); g.fillTriangle(-50, -6, -62, -22, -40, -6); g.fillStyle(0xffd400, 1); g.fillRect(-30, -3, 10, 6);
    f.add(g); const trail = this.add.particles(0, 0, 'atlas', { frame: 'spark',  follow: f, followOffset: { x: -62, y: 0 }, speedX: { min: -80, max: -40 }, lifespan: 500, scale: { start: .6, end: 0 }, alpha: { start: .8, end: 0 }, frequency: 20, maxParticles: 60 }).setDepth(7);
    this.tweens.add({ targets: f, x: 900, y: 80, duration: 1800, ease: 'Sine.easeIn', onComplete: () => { trail.destroy(); f.destroy(); } });
    this.stars.explode(20, 400, 120); SFX.falcon();
  }
}
export const LINES = {
  miss: ['JAJAJA, ¿eso es todo?', '¡Ni me has rozado!', 'Con esa puntería no entras ni en el Congreso', '¿Eso era un tomate o una disculpa?', 'Tranquilo, yo también fallo... promesas', 'Lanzas peor que la oposición', '¡Sigue practicando, campeón!', 'Esto va al Falcon directo', 'Mira, un tomate nuevo para mi nariz'],
  near: ['¡Uy! Eso ha estado cerca...', '¡Casi me caigo! Pero no.', 'Resisto más que una legislatura', '¡Me has despeinado!', 'Aún sigo aquí, como siempre'],
  face: ['¡Mi cara! ¡Mi preciosa cara!', '¡Eso no vale, la diana está al lado!', '¡Juego sucio!', 'Esto lo pagarás en impuestos'],
  wetWater: ['¡GLUB! ¡Esto es un ataque!', '¡Mi traje! ¡Era de Moncloa!', '¡No sé nadar en esto!', '¡Pido una comisión de investigación!', '¡Que venga el Falcon a por mí!'],
  wetChair: ['Mojado, pero no derrotado', 'Vale, esa te la concedo', 'Esto lo vas a pagar', 'Tengo frío. Me quejaré en rueda de prensa', 'No dimito. Ni mojado.'],
  tomato: ['¿Otro tomate? Qué miedo...', 'Eso es un huerto, no un arma', 'Ya puedes apuntar bien', 'Hmm... prefiero las croquetas'],
  idle: ['¿Te vas a quedar ahí mirando?', 'Puedes seguir clicando, no tengo prisa', 'Qué bien se está aquí sentado', 'Nadie me mueve de esta silla', 'La piscina está muy lejos, ¿no?'],
};
export const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// Escena del juego (Canvas 2D): escenario, Pedro animado, puntería, lanzamientos, reacciones y caída al agua.
// Sustituye a la escena Phaser anterior con la misma interfaz que usan play.js y main.js:
//   ready, bus, peek(), tomatoEarned(line), tauntIdle(line), startAim(mult) -> Promise<res>, stopAim(),
//   resolveThrow(res, decision, last) -> Promise, falconFly()
import { loadPedro, ROOT } from './pedro-rig.js';
import { CLIPS, sample } from './pedro-anims.js';
import { drawStageBack, drawStageFront, drawStatic, pedroShadow, softBlob, PLANK, TANK, TARGET, W } from './stage-art.js';
import { CONFIG } from '../config.js';
import { SFX } from '../audio.js';

// Al fallar dice siempre lo mismo; en el resto de momentos, una de sus frases típicas al azar.
const CENTRO = ['¡Le tienes que dar al centro, eh! ¡Jajajaja!'];
const TIPICAS = ['No pactaré con Bildu', 'Son las cinco y no he comido', 'Yo estoy bien', 'No habrá amnistía', 'España va como una moto', '¡Son bulos de la ultraderecha!', '¡No dimitiré!', '¡Facha!'];
export const LINES = { near: CENTRO, miss: CENTRO, leftMiss: CENTRO, catch: TIPICAS, wetWater: TIPICAS, wetChair: TIPICAS, tomato: TIPICAS, idle: TIPICAS };
let lastLine = '';
// elige al azar sin repetir la última frase
export const pick = arr => { let x; do { x = arr[Math.floor(Math.random() * arr.length)]; } while (arr.length > 1 && x === lastLine); return (lastLine = x); };

const PED = { s: 0.3, x: 430 };                         // escala de Pedro y posición en el tablón
const ROI = { x0: 20, x1: 1080, y0: 215, y1: 1770 };   // parte del escenario que siempre se ve (con sitio para los bocadillos)
const AIM = { y: TARGET.y };
const EASE = {
  l: x => x, i: x => x * x, o: x => 1 - (1 - x) ** 3, io: x => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  b: x => { const c = 1.7; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; },
  bounce: x => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; },
};
const rand = (a, b) => a + Math.random() * (b - a);
const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, Math.max(rx, 0.1), Math.max(ry, 0.1), rot, 0, Math.PI * 2); };

class Bus { constructor() { this.h = {}; } on(e, f) { (this.h[e] ||= []).push(f); } once(e, f) { const g = (...a) => { this.off(e, g); f(...a); }; this.on(e, g); } off(e, f) { this.h[e] = (this.h[e] || []).filter(x => x !== f); } emit(e, ...a) { (this.h[e] || []).slice().forEach(f => f(...a)); } }

export class Arena {
  constructor(el, insets) {
    this.el = el; this.insets = insets; this.bus = new Bus(); this.ready = false; this.busy = false; this.aim = null;
    this.cv = document.createElement('canvas'); this.cv.className = 'arena'; el.appendChild(this.cv); this.ctx = this.cv.getContext('2d');
    this.S = {};                                 // estado del escenario (tablón, diana, pecera)
    this.tw = []; this.parts = []; this.fx = []; this.splats = []; this.wall = []; this.bubble = null; this.shake = { until: 0, amp: 0 };
    this.clip = null; this.clipT0 = 0; this.carry = 0; this.carryT0 = 0; this.prevPx = 0; this.walkPh = 0;
    this.pose = null;                            // transformación especial (caída, dentro del agua, aterrizaje)
    this.fishT = 0; this.frenzy = 0; this.wetUntil = 0; this.lookOverride = null; this.plane = null;
    this.now = performance.now() / 1000; this.last = this.now;
    const onDown = e => { if (this.aim) { e.preventDefault?.(); this.stopAim(); } };
    this.cv.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', e => { if (e.code === 'Space' && this.aim) { e.preventDefault(); this.stopAim(); } });
    new ResizeObserver(() => this.resize()).observe(el); this.resize();
    this.init();
  }
  async init() {
    // fuentes: como mucho 2,5 s de espera (algunos Safari no terminan nunca de avisar)
    window.__aapStep?.('Cargando las letras');
    try { await Promise.race([Promise.all([document.fonts.load('30px "Titan One"'), document.fonts.load('800 30px "Baloo 2"')]), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
    window.__aapStep?.('Cargando a Pedro');
    try { this.rig = await loadPedro(this.el.dataset.assets || 'assets/pedro/'); }
    catch (e) { window.__aapFail?.('No se han podido cargar las imágenes de Pedro'); throw e; }
    window.__aapStep?.('Montando el escenario');
    this.play('idle');
    const loop = () => { this.frame(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    this.ready = true; this.bus.emit('ready');
  }
  resize() {
    const r = this.el.getBoundingClientRect(), dpr = Math.min(this.maxDpr || 2, window.devicePixelRatio || 1);
    this.cw = r.width; this.ch = r.height; this.dpr = dpr;
    this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
    const top = this.insets.top, bottom = this.insets.bottom, avail = Math.max(100, r.height - top - bottom);
    const k = Math.min(r.width / (ROI.x1 - ROI.x0), avail / (ROI.y1 - ROI.y0));
    this.k = k; this.tx = (r.width - (ROI.x1 - ROI.x0) * k) / 2 - ROI.x0 * k;
    this.ty = top + Math.max(0, (avail - (ROI.y1 - ROI.y0) * k) * 0.45) - ROI.y0 * k;
    this.cacheDirty = true;
  }
  // capa fija del escenario (fondo, suelo, torre): se pinta una vez por tamaño de pantalla
  staticLayer() {
    if (!this.cache) this.cache = document.createElement('canvas');
    const cc = this.cache; cc.width = this.cv.width; cc.height = this.cv.height;
    const x = cc.getContext('2d'), d = this.dpr;
    x.fillStyle = '#04071a'; x.fillRect(0, 0, cc.width, cc.height);
    x.setTransform(d * this.k, 0, 0, d * this.k, d * this.tx, d * this.ty);
    drawStatic(x);
    this.cacheDirty = false;
  }

  // ------------------------------------------------ utilidades de tiempo
  tween(obj, props, dur, ease = 'io') {
    const from = {}; for (const k in props) from[k] = obj[k] ?? 0;
    return new Promise(res => this.tw.push({ obj, props, from, t0: this.now, dur, ease, res }));
  }
  wait(s) { return new Promise(res => this.tw.push({ obj: {}, props: {}, from: {}, t0: this.now, dur: s, ease: 'l', res })); }
  play(name, opts = {}) {
    // al cambiar de animación se conserva dónde estaba Pedro y vuelve andando al centro
    const cur = this.P ? this.P.px : 0;
    this.clip = CLIPS[name]; this.clipName = name; this.clipT0 = this.now;
    this.carry = opts.keepPlace ? 0 : cur; this.carryT0 = this.now;
    return new Promise(res => { this.clipDone = res; });
  }
  say(text, secs = 2.4, where = 'head') { this.bubble = { text, t0: this.now, until: this.now + secs, where }; }
  hush() { this.bubble = null; }
  bigText(text, color, y = 300, size = 96) { this.fx.push({ text, color, t0: this.now, y, size }); }
  doShake(amp, dur) { this.shake = { amp, until: this.now + dur, dur }; }

  // ------------------------------------------------ partículas
  burst(x, y, n, kind, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = o.angle != null ? o.angle + rand(-o.spread, o.spread) : rand(0, Math.PI * 2), sp = rand(o.min ?? 200, o.max ?? 700);
      this.parts.push({ kind, x: x + rand(-(o.w || 0), o.w || 0), y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.g ?? 1600, life: rand(o.life?.[0] ?? 0.5, o.life?.[1] ?? 1.1), t: 0, r: rand(o.r?.[0] ?? 6, o.r?.[1] ?? 14), rot: rand(0, 6), vr: rand(-8, 8) });
    }
  }

  // ------------------------------------------------ reacciones a los clics
  peek() { if (!this.busy && !this.aim && this.clipName === 'idle') this.lookOverride = { lookX: -0.3, lookY: 1, until: this.now + 0.9 }; }
  tomatoEarned() { if (this.busy || this.aim) return; if (this.clipName === 'idle') this.play('shock'); }
  // frases mientras el jugador pulsa: solo si Pedro está tranquilo
  chatter(line) { if (this.busy || this.aim || this.bubble) return; if (this.clipName === 'idle') this.play('smug'); this.say(line, 2.4); }
  // Paguitas: llueven pesetas desde arriba
  rainCoins(n = 3) {
    for (let i = 0; i < n; i++) this.tw.push({ obj: {}, props: {}, from: {}, t0: this.now, dur: i * 0.18, ease: 'l', res: () => this.burst(rand(300, 900), 220, 1, 'coin', { angle: Math.PI / 2, spread: 0.25, min: 150, max: 350, g: 900, r: [26, 32], life: [1.6, 2.0] }) });
    this.bigText(`+${n} PAGUITA`, '#ffd23f', 1290, 64);
  }
  tauntIdle(line) { if (this.busy || this.aim || this.clipName !== 'idle') return; this.play('smug'); this.say(line, 2.6); }

  // ------------------------------------------------ puntería: el tomate va de lado a lado, solo en horizontal
  startAim(mult = 1, n = 1, perfectR = CONFIG.PERFECT_RADIUS) {
    this.hush();
    if (this.clipName === 'idle') this.play('idle');        // deja de pasear y vuelve al centro
    this.aim = { x: CONFIG.AIM_MIN, dir: 1, speed: CONFIG.AIM_SPEED * mult, t0: this.now, n, perfectR };
    SFX.throwStart();
    return new Promise(res => { this.aimResolve = res; });
  }
  stopAim() {
    if (!this.aim) return;
    const x = this.aim.x, pr = this.aim.perfectR; this.aim = null; SFX.stop();
    const dist = Math.abs(x - TARGET.x);
    const kind = dist <= pr ? 'perfect' : dist <= CONFIG.NEAR_RADIUS ? 'near' : 'miss';
    const precision = Math.max(0, 1 - dist / Math.max(TARGET.x - CONFIG.AIM_MIN, CONFIG.AIM_MAX - TARGET.x));
    this.aimResolve({ x, y: AIM.y, dist, kind, onPedro: false, precision });
  }

  // ------------------------------------------------ resultado de un lanzamiento
  async resolveThrow(res, decision, last, n = 1) {
    this.busy = true;
    try {
      // a veces, en un fallo, Pedro atrapa el tomate al vuelo y se lo pone de nariz
      // si fallas por la izquierda el tomate va hacia Pedro: lo atrapa y se lo pone de nariz
      if (res.kind === 'miss' && res.x < TARGET.x && !decision.fall) { const r = await this.catchIt(res); if (decision.recovered) { this.bigText(`¡PLUS ULTRA! +${decision.recovered}`, '#7fdfff', 420, 64); SFX.tomato(); } return r; }
      SFX.whoosh();
      const big = 0.9 + Math.min(0.3, (n - 1) * 0.04);
      const fly = { x: res.x, y: AIM.y, s: big, rot: 0, n }; this.flying = fly;
      await this.tween(fly, { s: 0.55, y: AIM.y - 16, rot: 4 }, 0.28, 'o');
      this.flying = null;
      SFX.splat(); this.burst(res.x, AIM.y, 18, 'juice', { min: 150, max: 520, g: 1400, r: [5, 11] });
      if (res.kind === 'miss') { this.wall.push({ x: res.x, y: AIM.y, rot: rand(0, 6), t0: this.now }); if (this.wall.length > 6) this.wall.shift(); }
      else {
        this.splats.push({ x: res.x - TARGET.x, y: rand(-8, 8), rot: rand(0, 6), s: (res.kind === 'perfect' ? 0.85 : 0.7) * (1 + Math.min(0.3, (n - 1) * 0.04)), t0: this.now, tr: rand(-0.4, 0.4) }); if (this.splats.length > 8) this.splats.shift();
        this.S.targetBump = 0.09; this.S.targetRot = res.kind === 'perfect' ? -0.16 : -0.09;
        this.tween(this.S, { targetBump: 0, targetRot: 0 }, 0.6, 'b');
      }
      this.doShake(decision.fall ? 14 : 5, 0.25);
      if (decision.fall) await this.fallSequence(res, decision, last, n);
      else if (res.kind === 'near') await this.nearMiss(last);
      else await this.miss(last);
      if (decision.recovered) { this.bigText(`¡PLUS ULTRA! +${decision.recovered}`, '#7fdfff', 420, 64); SFX.tomato(); }
    } finally { this.busy = false; }
  }
  async nearMiss(last) {
    SFX.near(); this.bigText('¡CASI!', '#ff9d1a');
    this.S.plankAng = 0;
    const shake = { a: 0.05 }; this.tween(shake, { a: 0 }, 0.9, 'o');
    const t0 = this.now; this.plankWobble = () => Math.sin((this.now - t0) * 30) * shake.a;
    this.play('wobble', { keepPlace: false });
    await this.wait(0.9); this.plankWobble = null;
    if (!last && Math.random() < 0.5) return;
    // provocación: peineta, burla o carcajada, con frase
    const r = Math.random();
    const clip = r < 0.4 ? 'peineta' : r < 0.75 ? 'mock' : 'laugh';
    this.play(clip); SFX.laugh();
    this.say(pick(LINES.near), clip === 'peineta' ? 3.2 : 2.6);
    await this.wait(last ? (clip === 'peineta' ? 2.6 : 1.8) : 0.8);
  }
  async miss(last) {
    SFX.miss(); this.bigText('¡FALLO!', '#9fb0ff');
    const clip = Math.random() < 0.55 ? 'laugh' : Math.random() < 0.5 ? 'mock' : 'peineta';
    this.play(last ? clip : 'laugh'); SFX.laugh();
    if (last) this.say(pick(LINES.miss), 2.6);
    await this.wait(last ? 1.6 : 0.7);
  }
  async catchIt(res) {
    // el tomate sale del punto donde apuntabas hacia la mano de Pedro
    const P = this.P, wx = PED.x + P.px * PED.s;
    CLIPS.catchNose.start = [(res.x - wx) / PED.s + ROOT[0], (AIM.y - (PLANK.y + 4)) / PED.s + ROOT[1]];
    this.play('catchNose', { keepPlace: false });
    this.clipT0 -= 0.3;                           // el vuelo empieza ya
    SFX.whoosh(); this.bigText('¡FALLO!', '#9fb0ff');
    await this.wait(0.8); this.say(pick(LINES.catch), 2.2);
    await this.wait(1.0); CLIPS.catchNose.start = null;
    await this.wait(2.6); this.say(pick(LINES.leftMiss), 2.6); SFX.laugh();
    await this.wait(0.8);                          // se puede volver a lanzar mientras sigue burlándose
  }

  // ------------------------------------------------ ¡al agua!
  async fallSequence(res, decision, last, n = 1) {
    SFX.clank(); SFX.win();
    this.bigText((res.kind === 'perfect' ? '¡PERFECTO!' : decision.forgiven ? '¡AMNISTÍA!' : '¡AL AGUA!') + (n > 1 ? ` ×${n}` : ''), '#ffd23f');
    this.S.party = true;
    // el tablón se abre y Pedro cae
    const px = this.P.px, sx = PED.x + px * PED.s;
    this.play('fall', { keepPlace: true }); this.carry = 0; this.fallPx = px;
    this.pose = { x: sx, y: PLANK.y + 4, rot: 0, s: PED.s, inside: false };
    this.hush();
    this.S.plankAng = 0; this.tween(this.S, { plankAng: 0.5 }, 0.22, 'i');
    await this.tween(this.pose, { rot: -0.25, y: PLANK.y + 40 }, 0.2, 'i');
    SFX.fall();
    const wx = (TANK.x0 + TANK.x1) / 2 - 20, wy = TANK.water + 120;
    const fx = { u: 0 };
    const x0 = this.pose.x, y0 = this.pose.y;
    this.tw.push({ obj: fx, props: { u: 1 }, from: { u: 0 }, t0: this.now, dur: 0.62, ease: 'l', res: () => {} , step: () => {
      const u = fx.u; this.pose.x = x0 + (wx - x0) * u; this.pose.y = y0 + (wy - y0) * (u * u) - Math.sin(u * Math.PI) * 60; this.pose.rot = -0.25 + u * 0.55;
    } });
    await this.wait(0.62);
    // ¡chof!
    this.hush(); SFX.splash(); SFX.cheer();
    this.burst(wx, TANK.water, 60, 'drop', { angle: -Math.PI / 2, spread: 1.0, min: 500, max: 1300, g: 2600, r: [6, 15], life: [0.6, 1.2], w: 60 });
    this.ripples = { x: wx, t0: this.now };
    this.doShake(18, 0.4); this.frenzy = 1;
    if (decision.pesetas) { this.burst(wx, TANK.water - 40, Math.min(24, decision.pesetas * 4), 'coin', { angle: -Math.PI / 2, spread: 0.8, min: 500, max: 1000, g: 1800, r: [14, 18], life: [1.0, 1.5] }); this.bigText(`+${decision.pesetas} PESETA${decision.pesetas > 1 ? 'S' : ''}`, '#ffd23f', 420); SFX.coin(); }
    // el tablón vuelve a su sitio y Pedro asoma dentro de la pecera, empapado y enfadado
    this.tween(this.S, { plankAng: 0 }, 0.5, 'b');
    this.pose = { x: wx, y: TANK.water + 800, rot: 0, s: PED.s, inside: true };
    this.play('inWater', { keepPlace: true }); this.carry = 0;
    await this.tween(this.pose, { y: TANK.water + 300 }, 0.45, 'b');
    SFX.angry(); this.wetUntil = this.now + 8;
    if (last) this.say(pick(LINES.wetWater), 2.0, 'water');
    await this.wait(last ? 2.0 : 0.7);
    this.hush();
    await this.tween(this.pose, { y: TANK.water + 820 }, 0.35, 'i');
    this.frenzy = 0; this.S.party = false;
    // Pedro cae desde arriba sobre el tablón
    this.pose = { x: PED.x, y: PLANK.y + 4 - 1100, rot: 0, s: PED.s, inside: false };
    this.play('landed', { keepPlace: true }); this.carry = 0;
    await this.tween(this.pose, { y: PLANK.y + 4 }, 0.55, 'bounce');
    this.pose = null; this.doShake(6, 0.2);
    if (last) this.say(pick(LINES.wetChair), 2.4);
  }

  // ------------------------------------------------ el Falcón cruza el cielo
  falconFly() { this.plane = { t0: this.now }; SFX.falcon(); }

  // ------------------------------------------------ bucle de dibujo
  frame() {
    const now = performance.now() / 1000, raw = now - this.last, dt = Math.min(0.05, raw); this.last = now; this.now = now;
    // si el dispositivo va justo, se baja la resolución interna del lienzo
    this.ft = (this.ft ?? 0.016) * 0.95 + raw * 0.05;
    if (this.ft > 0.034 && (this.maxDpr || 2) > 1 && now - (this.dprAt || 0) > 2) { this.maxDpr = Math.max(1, (this.maxDpr || 2) - 0.5); this.dprAt = now; this.resize(); }
    // interpolaciones
    for (const w of this.tw.slice()) {
      const x = Math.min(1, (now - w.t0) / w.dur), e = EASE[w.ease](x);
      for (const k in w.props) w.obj[k] = w.from[k] + (w.props[k] - w.from[k]) * e;
      w.step?.();
      if (x >= 1) { this.tw.splice(this.tw.indexOf(w), 1); w.res(); }
    }
    // pirañas: se alborotan tras una caída
    this.fishT += dt * (1 + this.frenzy * 3.5);
    // puntería
    if (this.aim) {
      const a = this.aim; a.x += a.dir * a.speed * dt;
      if (a.x >= CONFIG.AIM_MAX) { a.x = CONFIG.AIM_MAX; a.dir = -1; } if (a.x <= CONFIG.AIM_MIN) { a.x = CONFIG.AIM_MIN; a.dir = 1; }
    }
    // animación de Pedro
    let ct = now - this.clipT0;
    if (!this.clip.loop && ct >= this.clip.dur) { const done = this.clipDone; this.play('idle', { keepPlace: false }); done?.(); ct = 0; }
    if (this.clip.loop && this.clipName === 'idle' && (this.busy || this.aim)) ct = Math.min(ct, 0.6);   // mientras apuntas no se pasea
    const P = sample(this.clip, this.clip.loop ? ct % this.clip.dur : ct);
    const ce = Math.min(1, (now - this.carryT0) / 0.9), carry = this.carry * (1 - EASE.io(ce));
    P.px += carry;
    const v = (P.px - this.prevPx) / Math.max(dt, 1e-3); this.prevPx = P.px;
    const wk = Math.min(1, Math.abs(v) / 240); P.walkAmt = this.pose ? 0 : wk * wk * (3 - 2 * wk); P.walkPh = P.px / 150; P.walkDir = Math.sign(v) || 1;
    if (this.lookOverride && now < this.lookOverride.until) { P.lookX = this.lookOverride.lookX; P.lookY = this.lookOverride.lookY; }
    if (this.aim && !this.busy) { P.lookX = 0.95; P.lookY = -0.35; }       // mira el tomate mientras apuntas
    this.P = P;

    const c = this.ctx, d = this.dpr;
    c.setTransform(1, 0, 0, 1, 0, 0); c.filter = 'none'; c.globalAlpha = 1;
    c.fillStyle = '#04071a'; c.fillRect(0, 0, this.cv.width, this.cv.height);
    let sx = 0, sy = 0;
    if (now < this.shake.until) { const a = this.shake.amp * ((this.shake.until - now) / this.shake.dur); sx = rand(-a, a); sy = rand(-a, a); }
    if (this.cacheDirty) this.staticLayer();
    c.drawImage(this.cache, Math.round(sx * this.k * d), Math.round(sy * this.k * d));
    c.setTransform(d * this.k, 0, 0, d * this.k, d * (this.tx + sx * this.k), d * (this.ty + sy * this.k));
    const pedX = PED.x + P.px * PED.s;
    const S = this.S; S.fishT = this.fishT;
    S.plankAng = (S.plankAng || 0) + (this.plankWobble ? this.plankWobble() : 0);
    S.targetSplats = cc => this.drawSplats(cc);
    S.inside = this.pose?.inside ? cc => this.drawPedro(cc, P, now) : null;
    S.noStatic = true;
    drawStageBack(c, now, this.pose ? (this.pose.inside ? (TANK.x0 + TANK.x1) / 2 : this.pose.x) : pedX, S);
    if (this.plankWobble) S.plankAng -= this.plankWobble();
    this.drawWall(c);
    if (!this.pose) pedroShadow(c, pedX, 1 - P.walkAmt * 0.15);
    if (!this.pose?.inside) this.drawPedro(c, P, now);
    this.drawRipples(c);
    this.drawAim(c);
    this.drawParts(c, dt);
    c.filter = 'none'; c.globalAlpha = 1;
    drawStageFront(c, now, this.pose ? this.pose.x : pedX);
    this.drawPlane(c);
    this.drawFx(c);
    this.drawBubble(c, pedX);
    // gotas cayendo cuando está mojado
    if (now < this.wetUntil && !this.pose && Math.random() < dt * 14) this.burst(pedX + rand(-60, 60), PLANK.y - 560 + rand(0, 200), 1, 'drop', { angle: Math.PI / 2, spread: 0.2, min: 50, max: 150, g: 1800, r: [4, 7], life: [0.5, 0.8] });
  }
  drawPedro(c, P, t) {
    c.save();
    if (this.pose) { c.translate(this.pose.x, this.pose.y); c.rotate(this.pose.rot); c.scale(this.pose.s, this.pose.s); c.translate(-ROOT[0], -ROOT[1]); P = { ...P, px: 0 }; }
    else {
      c.translate(PED.x, PLANK.y + 4);
      if (this.S.plankAng) { /* el tablón gira sobre la torre */ }
      c.scale(PED.s, PED.s); c.translate(-ROOT[0], -ROOT[1]);
    }
    this.rig.draw(c, P, t);
    c.restore();
  }
  // Escena completa (1080×1920) con Pedro en una pose fija: para la imagen de compartir estadísticas.
  poster(c, clip = 'peineta', t = 2.6) {
    const P = sample(CLIPS[clip] || CLIPS.peineta, t), pose = this.pose; this.pose = null;
    drawStageBack(c, t, PED.x, { fishT: t });
    pedroShadow(c, PED.x);
    this.drawPedro(c, { ...P, px: 0, walkAmt: 0, blink: 0 }, t);
    drawStageFront(c, t, PED.x);
    this.pose = pose;
  }
  label(c, text, x, y) {
    c.save(); c.font = '54px "Titan One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.strokeStyle = '#0a0b18'; c.lineWidth = 14; c.strokeText(text, x, y); c.fillStyle = '#ffe766'; c.fillText(text, x, y); c.restore();
  }
  // el tomate se queda pegado en la diana un momento, resbala un poco y cae; la mancha dura más
  drawSplats(c) {
    for (const s of this.splats) {
      const age = this.now - s.t0, a = Math.max(0, 1 - Math.max(0, age - 5) / 1.5); if (a <= 0) continue;
      const slide = Math.min(1, age / 2.2) ** 2 * 26;
      c.save(); c.globalAlpha = a; c.translate(s.x, s.y + Math.min(40, age * 5)); c.rotate(s.rot); const k = s.s * Math.min(1, age * 8);
      splatShape(c, 36 * k);
      c.restore();
      if (age < 2.6) {
        const out = age > 2.2 ? (age - 2.2) / 0.4 : 0, imp = Math.min(1, age / 0.12);
        c.save(); c.globalAlpha = 1 - out; c.translate(0, slide + out * 60);
        this.rig.tomato(c, [s.x, s.y], 46 * s.s, 1.25 - 0.1 * imp, 0.78 + 0.07 * imp, s.tr);
        c.restore();
      }
    }
    this.splats = this.splats.filter(s => this.now - s.t0 < 6.5);
  }
  drawWall(c) {
    for (const s of this.wall) {
      const age = this.now - s.t0, a = Math.max(0, 1 - Math.max(0, age - 2.5) / 1.5); if (a <= 0) continue;
      c.save(); c.globalAlpha = a * 0.9; c.translate(s.x, s.y + Math.min(40, age * 8)); c.rotate(s.rot); splatShape(c, 30 * Math.min(1, age * 8)); c.restore();
    }
    this.wall = this.wall.filter(s => this.now - s.t0 < 4);
  }
  drawAim(c) {
    const fly = this.flying;
    if (!this.aim && !fly) return;
    if (this.aim) {
      // guía: recorrido horizontal y marca sobre la diana
      c.save(); c.setLineDash([16, 14]); c.lineCap = 'round'; c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(CONFIG.AIM_MIN, AIM.y); c.lineTo(CONFIG.AIM_MAX, AIM.y); c.stroke(); c.restore();
      const pulse = 0.5 + 0.5 * Math.sin(this.now * 8);
      c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,220,90,${0.18 + pulse * 0.12})`; ell(c, TARGET.x, TARGET.y, this.aim.perfectR, this.aim.perfectR); c.fill(); c.restore();
      const x = this.aim.x; softBlob(c, x + 10, AIM.y + 60, 50, 14, '#000000', 0.35, 6);
      const big = 0.9 + Math.min(0.3, (this.aim.n - 1) * 0.04);
      this.rig.tomato(c, [x, AIM.y], 50 * big, 1, 1, Math.sin(this.now * 6) * 0.15);
      if (this.aim.n > 1) this.label(c, '×' + this.aim.n, x + 46 * big, AIM.y - 46 * big);
    }
    if (fly) { this.rig.tomato(c, [fly.x, fly.y], 50 * fly.s, 1, 1, fly.rot); if (fly.n > 1) this.label(c, '×' + fly.n, fly.x + 46 * fly.s, fly.y - 46 * fly.s); }
  }
  drawRipples(c) {
    if (!this.ripples) return;
    const age = this.now - this.ripples.t0; if (age > 1.6) { this.ripples = null; return; }
    for (let i = 0; i < 3; i++) {
      const a = age - i * 0.2; if (a < 0) continue; const k = a / 1.4;
      c.save(); c.globalAlpha = Math.max(0, 1 - k); c.strokeStyle = '#e8fbff'; c.lineWidth = 6;
      ell(c, this.ripples.x, TANK.water + 4, 30 + k * 200, 8 + k * 20); c.stroke(); c.restore();
    }
  }
  drawParts(c, dt) {
    for (const p of this.parts) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const p of this.parts) {
      const a = Math.min(1, (p.life - p.t) / 0.25);
      c.save(); c.globalAlpha = a; c.translate(p.x, p.y);
      if (p.kind === 'drop') { c.rotate(Math.atan2(p.vy, p.vx) - Math.PI / 2); c.fillStyle = '#bff0ff'; c.strokeStyle = '#2a8fc4'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, -p.r * 1.6); c.quadraticCurveTo(p.r, 0, 0, p.r); c.quadraticCurveTo(-p.r, 0, 0, -p.r * 1.6); c.fill(); c.stroke(); c.fillStyle = '#fff'; ell(c, -p.r * 0.3, -p.r * 0.2, p.r * 0.25, p.r * 0.35); c.fill(); }
      else if (p.kind === 'juice') { c.fillStyle = p.r > 8 ? '#e3312a' : '#ff6b55'; ell(c, 0, 0, p.r, p.r * 0.8, p.rot); c.fill(); }
      else if (p.kind === 'coin') {
        // halo dorado
        c.save(); c.globalCompositeOperation = 'lighter'; const halo = c.createRadialGradient(0, 0, 0, 0, 0, p.r * 2.6); halo.addColorStop(0, 'rgba(255,220,90,0.55)'); halo.addColorStop(1, 'rgba(255,200,60,0)'); c.fillStyle = halo; ell(c, 0, 0, p.r * 2.6, p.r * 2.6); c.fill(); c.restore();
        c.save(); c.rotate(p.rot * 0.3); c.scale(Math.cos(p.rot), 1); c.fillStyle = '#0a0b18'; ell(c, 0, 0, p.r + 3, p.r + 3); c.fill();
        const g = c.createRadialGradient(-4, -4, 1, 0, 0, p.r); g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#fff3b0'); g.addColorStop(1, '#e09a12'); c.fillStyle = g; ell(c, 0, 0, p.r, p.r); c.fill();
        c.fillStyle = '#8a5200'; c.font = `${p.r * 1.3}px "Titan One"`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('P', 0, 1); c.restore();
        // destello en cruz que parpadea
        const tw = Math.max(0, Math.sin(this.now * 14 + p.rot * 3)); if (tw > 0.4) { c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = `rgba(255,255,255,${tw})`; const k = p.r * 1.4 * tw; c.translate(p.r * 0.45, -p.r * 0.45); c.beginPath(); c.moveTo(0, -k); c.lineTo(k * 0.18, -k * 0.18); c.lineTo(k, 0); c.lineTo(k * 0.18, k * 0.18); c.lineTo(0, k); c.lineTo(-k * 0.18, k * 0.18); c.lineTo(-k, 0); c.lineTo(-k * 0.18, -k * 0.18); c.closePath(); c.fill(); c.restore(); }
      }
      else if (p.kind === 'star') { c.rotate(p.rot); c.fillStyle = '#ffd23f'; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? p.r * 0.45 : p.r, an = i * Math.PI / 5; c.lineTo(Math.cos(an) * r, Math.sin(an) * r); } c.fill(); }
      c.restore();
    }
  }
  drawFx(c) {
    for (const f of this.fx) {
      const age = this.now - f.t0; if (age > 1.5) continue;
      const pop = age < 0.25 ? EASE.b(age / 0.25) : 1, a = age > 1.0 ? 1 - (age - 1.0) / 0.5 : 1;
      c.save(); c.globalAlpha = Math.max(0, a); c.translate(560, f.y - age * 40); c.scale(pop, pop); c.rotate(-0.05);
      c.font = `${f.size || 96}px "Titan One", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      c.strokeStyle = '#0a0b18'; c.lineWidth = 22 * (f.size || 96) / 96; c.strokeText(f.text, 0, 0);
      const g = c.createLinearGradient(0, -40, 0, 40); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, f.color); g.addColorStop(1, f.color);
      c.fillStyle = g; c.fillText(f.text, 0, 0);
      c.restore();
    }
    this.fx = this.fx.filter(f => this.now - f.t0 < 1.5);
  }
  drawBubble(c, pedX) {
    const b = this.bubble; if (!b) return;
    if (this.now > b.until) { this.bubble = null; return; }
    const age = this.now - b.t0, pop = age < 0.25 ? EASE.b(age / 0.25) : 1, out = b.until - this.now < 0.2 ? (b.until - this.now) / 0.2 : 1;
    c.save(); c.font = '800 36px "Baloo 2", sans-serif';
    const words = b.text.split(' '), lines = []; let line = '';
    for (const w of words) { const tst = line ? line + ' ' + w : w; if (c.measureText(tst).width > 460 && line) { lines.push(line); line = w; } else line = tst; }
    lines.push(line);
    const lw = Math.max(...lines.map(l => c.measureText(l).width)), bw = lw + 56, bh = lines.length * 42 + 32;
    let ax, ay;                                            // punta de la cola
    if (b.where === 'water') { ax = (TANK.x0 + TANK.x1) / 2 + 40; ay = TANK.water - 330; }
    else { ax = pedX + 60; ay = PLANK.y - 690; }
    const bx = Math.min(W - bw - 16, Math.max(16, ax - 40)), by = ay - bh - 34;
    c.translate(ax, ay); c.scale(pop * out, pop * out); c.translate(-ax, -ay);
    c.globalAlpha = 0.35; c.fillStyle = '#000'; c.beginPath(); c.roundRect(bx + 6, by + 10, bw, bh, 26); c.fill(); c.globalAlpha = 1;
    const path = new Path2D(); path.roundRect(bx, by, bw, bh, 26);
    const tail = new Path2D(); tail.moveTo(ax + 6, by + bh - 4); tail.lineTo(ax - 20, ay); tail.lineTo(ax + 44, by + bh - 4); tail.closePath();
    c.lineJoin = 'round'; c.strokeStyle = '#0a0b18'; c.lineWidth = 12; c.stroke(path); c.stroke(tail);
    c.fillStyle = '#ffffff'; c.fill(path); c.fill(tail);
    c.fillStyle = '#0d1849'; c.textAlign = 'left'; c.textBaseline = 'top';
    lines.forEach((l, i) => c.fillText(l, bx + 28, by + 17 + i * 42));
    c.restore();
  }
  drawPlane(c) {
    if (!this.plane) return;
    const u = (this.now - this.plane.t0) / 2; if (u > 1) { this.plane = null; return; }
    const x = -200 + u * 1500, y = 420 - Math.sin(u * Math.PI) * 120;
    if (Math.random() < 0.6) this.burst(x - 90, y, 1, 'star', { min: 20, max: 80, g: 0, r: [6, 12], life: [0.4, 0.7] });
    c.save(); c.translate(x, y); c.rotate(-0.12);
    c.strokeStyle = '#0a0b18'; c.lineWidth = 6; c.lineJoin = 'round'; c.fillStyle = '#ffffff';
    c.beginPath(); c.moveTo(90, 0); c.quadraticCurveTo(60, -22, -70, -14); c.lineTo(-90, -40); c.lineTo(-104, -40); c.lineTo(-96, -6); c.lineTo(-96, 10); c.quadraticCurveTo(0, 22, 90, 0); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-10, 4); c.lineTo(-50, 50); c.lineTo(-30, 52); c.lineTo(30, 6); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#3567f0'; c.fillRect(-60, -8, 110, 8);
    c.fillStyle = '#e3262c'; c.beginPath(); c.moveTo(-90, -40); c.lineTo(-104, -40); c.lineTo(-98, -18); c.closePath(); c.fill();
    c.restore();
  }
}

// mancha de tomate con goterones
function splatShape(c, r) {
  c.fillStyle = '#c8181e'; c.strokeStyle = '#0a0b18'; c.lineWidth = 3;
  c.beginPath();
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, rr = r * (i % 2 ? 0.62 : 1) * (0.85 + ((i * 37) % 10) / 30); c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#ff5a48'; ell(c, -r * 0.2, -r * 0.2, r * 0.35, r * 0.25); c.fill();
  c.fillStyle = '#c8181e'; for (const [dx, dy, s] of [[r * 1.2, r * 0.3, 0.22], [-r * 1.1, r * 0.6, 0.18], [r * 0.4, -r * 1.2, 0.15]]) { ell(c, dx, dy, r * s, r * s); c.fill(); }
}

export function createArena(id, insets) {
  const el = document.getElementById(id);
  const scene = new Arena(el, insets);
  return { scene };
}

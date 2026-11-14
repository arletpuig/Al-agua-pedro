// La Trastienda: puesto clandestino en un callejón detrás de la feria. Abascal atiende tras el mostrador
// con seis objetos: dos colgados del toldo y cuatro sobre el mostrador. Emite 'select', 'ready' por this.bus.
import { Abascal } from './abascal.js';
import { ITEMS, isOwned } from '../shop.js';
import { SFX } from '../audio.js';

export const SHOP_LINES = {
  hello: ['Psst... ¿buscas algo especial?', 'Aquí no hay cámaras. Pasa, pasa.', 'Si preguntan, tú no me conoces.', 'Género de primera. Sin factura.'],
  idle: ['Esto no lo encuentras en la feria.', 'Todo legal. Más o menos.', 'Precio de amigo. Bueno, de conocido.', 'Yo no he visto nada.'],
  deal: ['Trato hecho. Aquí no ha pasado nada.', 'Buena elección. Úsalo con cabeza.', 'Un placer. Ni una palabra a nadie.'],
  poor: ['Sin pesetas no hay género.', 'Vuelve cuando tengas con qué pagar.', 'Esto no es una ONG, amigo.'],
  owned: ['Eso ya es tuyo. Ve a usarlo.', 'Ya te lo vendí. No hay devoluciones.'],
};
const pick = a => a[Math.floor(Math.random() * a.length)];

export class ShopScene extends Phaser.Scene {
  constructor() { super('shop'); this.bus = new Phaser.Events.EventEmitter(); this.sel = null; }
  preload() {
    const b = this.assetBase || '';
    this.load.image('bgShop', `${b}assets/bg-shop.jpg`); this.load.image('fgShop', `${b}assets/fg-shop.png`);
  }
  create() {
    this.cameras.main.setZoom(this.res || 1).centerOn(360, 60 + 450);
    this.add.image(360, 480, 'bgShop').setDisplaySize(720, 960).setDepth(0);
    // cartel de neón con parpadeo de tubo viejo
    this.neon = this.add.image(360, 100, 'atlas', 'neonSign').setScale(.5).setDepth(1);
    this.time.addEvent({ delay: 2600, loop: true, callback: () => this.flicker(this.neon, 3) });
    // bombilla colgada del toldo: luz cálida que respira y titila
    this.add.line(0, 0, 462, 286, 462, 300, 0x0a0605).setOrigin(0).setLineWidth(1.5).setDepth(9);
    this.glow = this.add.image(462, 318, 'atlas', 'lampGlow').setScale(2.6).setDepth(2).setBlendMode('ADD').setAlpha(.55);
    this.bulb = this.add.image(462, 300, 'atlas', 'lampBulb').setScale(.5).setDepth(9).setOrigin(.5, .1);
    this.tweens.add({ targets: this.glow, alpha: .7, scale: 2.75, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tweens.add({ targets: this.bulb, angle: { from: -4, to: 4 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.time.addEvent({ delay: 5200, loop: true, callback: () => this.flicker(this.glow, 2) });
    // Abascal entre la trasera y el mostrador
    this.ab = new Abascal(this, 360, 566, 1.02).setDepth(5);
    this.add.image(360, 480, 'fgShop').setDisplaySize(720, 960).setDepth(10);
    // objetos
    this.items = {};
    for (const it of ITEMS) this.items[it.id] = this.buildItem(it);
    // efectos y bocadillo
    this.coins = this.add.particles(0, 0, 'atlas', { frame: 'peseta', speed: { min: 120, max: 260 }, angle: { min: 220, max: 320 }, gravityY: 600, lifespan: 1000, scale: { start: .7, end: .4 }, rotate: { start: 0, end: 540 }, emitting: false }).setDepth(14);
    this.stars = this.add.particles(0, 0, 'atlas', { frame: 'star', speed: { min: 60, max: 200 }, angle: { min: 0, max: 360 }, lifespan: 800, scale: { start: .9, end: 0 }, rotate: { start: 0, end: 360 }, emitting: false }).setDepth(14);
    this.dust = this.add.particles(0, 0, 'atlas', { frame: 'spark', x: { min: 80, max: 640 }, y: { min: 300, max: 640 }, speedY: { min: -8, max: 8 }, speedX: { min: -6, max: 6 }, lifespan: 5000, scale: { start: .12, end: .25 }, alpha: { start: 0, end: .35, ease: 'Sine.InOut' }, tint: 0xffe2a0, frequency: 350, blendMode: 'ADD' }).setDepth(3);
    this.bubble = this.add.container(0, 0).setDepth(15).setVisible(false);
    this.bubbleBg = this.add.graphics();
    this.bubbleTxt = this.add.text(0, 0, '', { fontFamily: 'Arial', fontSize: 17, fontStyle: 'bold', color: '#222', align: 'center', wordWrap: { width: 230 }, resolution: 2 }).setOrigin(.5);
    this.bubble.add([this.bubbleBg, this.bubbleTxt]);
    this.events.on('wake', () => this.enter());
    this.ready = true; this.bus.emit('ready'); this.enter();
  }
  flicker(o, n) { const a = o.alpha; this.tweens.add({ targets: o, alpha: a * .25, duration: 45, yoyo: true, repeat: n, onComplete: () => o.setAlpha(a) }); }

  buildItem(it) {
    const { x, y, hang, angle = 0, scale = 1 } = it.slot, depth = hang ? 4 : 11;
    const o = { it, x, y, hang };
    if (hang) {                           // cuelga de un cordel desde el toldo y se balancea desde el punto de cuelgue
      const H = it.id === 'besugo' ? { ox: .03, oy: .53, a: 90, len: 64, fy: false } : { ox: .5, oy: .02, a: 0, len: 80, fy: true }, top = y - H.len * scale;
      o.rope = this.add.line(0, 0, x, 288, x, top, 0x0a0605).setOrigin(0).setLineWidth(2).setDepth(depth);
      o.sp = this.add.image(x, top, 'atlas', it.frame).setOrigin(H.ox, H.oy).setFlipY(H.fy).setScale(scale / 2).setDepth(depth).setAngle(H.a);
      this.tweens.add({ targets: o.sp, angle: H.a + 6, duration: 1600 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    } else {
      o.shadow = this.add.ellipse(x, 648, 90 * scale, 10, 0x000000, .35).setDepth(depth);
      o.sp = this.add.image(x, y, 'atlas', it.frame).setScale(scale / 2).setAngle(angle).setDepth(depth);
    }
    o.base = { x: o.sp.x, y: o.sp.y, scale: o.sp.scale };
    if (it.premium) {                     // la urna brilla en su peana de terciopelo
      o.halo = this.add.image(x, y - 6, 'atlas', 'lampGlow').setScale(1.9).setBlendMode('ADD').setAlpha(.45).setDepth(depth - 1).setTint(0xffd23f);
      this.tweens.add({ targets: o.halo, alpha: .8, scale: 2.1, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.time.addEvent({ delay: 900, loop: true, callback: () => { const s = this.add.image(x + Phaser.Math.Between(-40, 40), y + Phaser.Math.Between(-55, 30), 'atlas', 'star').setScale(0).setDepth(depth + 1); this.tweens.add({ targets: s, scale: .5, angle: 90, duration: 350, yoyo: true, onComplete: () => s.destroy() }); } });
    }
    // etiqueta de precio con cordel
    const ty = hang ? y + 62 : 704, tx = hang ? x : x + (it.premium ? 0 : 6);
    o.tag = this.add.image(tx, ty, 'atlas', it.premium ? 'tagPremium' : 'tag').setScale(.9).setDepth(12).setAngle(hang ? 0 : Phaser.Math.Between(-6, 6));
    o.tagTxt = this.add.text(tx - 4, ty, '', { fontFamily: 'Titan One, Arial Black, Arial', fontSize: 16, color: '#3a2410', resolution: 2 }).setOrigin(.5).setDepth(12.1).setAngle(o.tag.angle);
    this.refreshTag(o);
    // zona de toque generosa
    const hit = this.add.zone(x, hang ? y + 10 : y - 6, 120, hang ? 170 : 120).setInteractive({ useHandCursor: true }).setDepth(16);
    hit.on('pointerdown', () => this.select(it.id));
    hit.on('pointerover', () => { if (this.sel !== it.id) this.tweens.add({ targets: o.sp, scale: o.base.scale * 1.08, duration: 120 }); });
    hit.on('pointerout', () => { if (this.sel !== it.id) this.tweens.add({ targets: o.sp, scale: o.base.scale, duration: 120 }); });
    return o;
  }
  refreshTag(o) {
    const own = isOwned(o.it.id);
    o.tag.setFrame(own ? 'tagOwned' : o.it.premium ? 'tagPremium' : 'tag');
    o.tagTxt.setText(own ? '¡TUYO!' : o.it.premium ? o.it.priceLabel : `${o.it.price} ₧`).setColor(own ? '#173d07' : '#3a2410');
  }
  refreshAll() { Object.values(this.items).forEach(o => this.refreshTag(o)); }

  enter() {
    this.cameras.main.fadeIn(350, 5, 3, 10); this.refreshAll();
    this.time.delayedCall(450, () => { this.ab.beat('shades'); this.say(pick(SHOP_LINES.hello), 2600); });
    clearInterval(this.chatter); this.chatter = setInterval(() => { if (!this.sel && this.scene.isActive()) this.say(pick(SHOP_LINES.idle), 2400); }, 14000);
  }
  leave() { clearInterval(this.chatter); this.hush(); this.select(null, true); }

  // ---------- selección ----------
  select(id, silent = false) {
    if (this.sel === id) return;
    const prev = this.items[this.sel];
    if (prev) { prev.bob?.stop(); prev.ring?.destroy(); this.tweens.add({ targets: prev.sp, x: prev.base.x, y: prev.base.y, scale: prev.base.scale, duration: 220 }); }
    this.sel = id;
    if (!id) { this.ab.relax(); if (!silent) this.bus.emit('select', null); return; }
    const o = this.items[id];
    SFX.ui();
    o.ring = this.add.image(o.x, o.y, 'atlas', 'lampGlow').setScale(1.7).setBlendMode('ADD').setDepth(o.sp.depth - 1).setAlpha(0).setTint(0xfff1b0);
    this.tweens.add({ targets: o.ring, alpha: .8, duration: 200 });
    this.tweens.add({ targets: o.sp, scale: o.base.scale * 1.18, duration: 220, ease: 'Back.Out' });
    o.bob = this.tweens.add({ targets: o.sp, y: o.base.y - 8, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: 220 });
    this.ab.present(o.x, o.y);
    this.say(isOwned(id) ? pick(SHOP_LINES.owned) : o.it.pitch, 3200);
    if (!silent) this.bus.emit('select', id);
  }
  // compra completada: monedas hacia el tendero, sello en la etiqueta, objeto contento
  async sold(id) {
    const o = this.items[id]; SFX.coin();
    this.coins.explode(14, 360, 860);
    this.time.delayedCall(250, () => SFX.coin());
    this.say(pick(SHOP_LINES.deal), 2800);
    this.ab.deal();
    await new Promise(r => this.time.delayedCall(500, r));
    this.refreshTag(o); o.tag.setScale(1.6); this.tweens.add({ targets: [o.tag], scale: .9, duration: 360, ease: 'Bounce.Out' });
    this.stars.explode(18, o.x, o.y); SFX.upgrade();
    this.tweens.add({ targets: o.sp, angle: o.sp.angle + 360, duration: 600, ease: 'Back.Out' });
  }
  refuse() { this.say(pick(SHOP_LINES.poor), 2400); this.ab.refuse(); }

  // ---------- bocadillo ----------
  say(text, ms = 2400) {
    this.bubbleTxt.setText(text); const w = Math.max(100, this.bubbleTxt.width + 30), h = this.bubbleTxt.height + 22;
    const g = this.bubbleBg; g.clear(); g.fillStyle(0xfff8ea, 1); g.lineStyle(3, 0x0a0605, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 14); g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    g.fillTriangle(-18, h / 2 - 2, 8, h / 2 - 2, -30, h / 2 + 22); g.lineBetween(-18, h / 2, -30, h / 2 + 22); g.lineBetween(-30, h / 2 + 22, 8, h / 2);
    const x = Phaser.Math.Clamp(430, w / 2 + 12, 708 - w / 2);
    this.bubble.setPosition(x, 330 - h / 2).setVisible(true).setScale(.5);
    this.tweens.add({ targets: this.bubble, scale: 1, duration: 240, ease: 'Back.Out' });
    clearTimeout(this.bubbleTimer); this.bubbleTimer = setTimeout(() => this.bubble.setVisible(false), ms);
  }
  hush() { clearTimeout(this.bubbleTimer); this.bubble?.setVisible(false); }
}

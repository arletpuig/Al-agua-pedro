// Escenario de feria: cielo, noria, luces, banderines, caseta, piscina, público. Devuelve controles para animarlo.
export const L = { W: 800, H: 600, WATER_Y: 440, PLATFORM_Y: 400, SEAT_X: 380, SEAT_Y: 298, TARGET_X: 640, TARGET_Y: 250, POOL_X1: 60, POOL_X2: 740 };

export function buildScenery(scene) {
  const g = scene.add.graphics().setDepth(0);
  // cielo nocturno-atardecer de feria
  g.fillGradientStyle(0x1b2a6b, 0x1b2a6b, 0x6f3fa0, 0xff7a59, 1); g.fillRect(0, 0, L.W, 330);
  g.fillGradientStyle(0xff7a59, 0xff7a59, 0xffc46b, 0xffc46b, 1); g.fillRect(0, 330, L.W, 110);
  // estrellas
  for (let i = 0; i < 40; i++) { const s = scene.add.circle(Phaser.Math.Between(0, 800), Phaser.Math.Between(5, 180), Phaser.Math.FloatBetween(.8, 1.8), 0xffffff, Phaser.Math.FloatBetween(.3, .9)).setDepth(0); scene.tweens.add({ targets: s, alpha: .1, duration: Phaser.Math.Between(900, 2500), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 2000) }); }
  // luna
  scene.add.circle(720, 70, 26, 0xfff3c4).setDepth(0); scene.add.circle(730, 62, 22, 0x4a2e7a, 0).setDepth(0);
  // noria al fondo
  const wheel = scene.add.container(110, 190).setDepth(0);
  const wg = scene.add.graphics(); wg.lineStyle(5, 0xffd166, 1); wg.strokeCircle(0, 0, 80); wg.lineStyle(3, 0xffd166, .8);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; wg.lineBetween(0, 0, Math.cos(a) * 80, Math.sin(a) * 80); }
  wheel.add(wg);
  const gondolas = [];
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, c = scene.add.rectangle(Math.cos(a) * 80, Math.sin(a) * 80, 16, 12, [0xe63946, 0x2bb3e8, 0xffd400, 0x3ddc84][i % 4]); wheel.add(c); gondolas.push(c); }
  const stand = scene.add.graphics().setDepth(0); stand.lineStyle(8, 0x8a5a2b, 1); stand.lineBetween(110, 190, 80, 330); stand.lineBetween(110, 190, 140, 330);
  scene.tweens.add({ targets: wheel, angle: 360, duration: 40000, repeat: -1 });
  scene.tweens.add({ targets: gondolas, angle: -360, duration: 40000, repeat: -1 });
  // focos giratorios
  [[0, 0, 20], [800, 0, -20]].forEach(([x, y, a]) => { const f = scene.add.triangle(x, y, 0, 0, -60, 420, 60, 420, 0xffffff, .07).setOrigin(0, 0).setDepth(0).setAngle(a); scene.tweens.add({ targets: f, angle: a + (x ? 30 : -30), duration: 6000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }); });
  // guirnalda de luces
  const bulbs = []; const colors = [0xff4d6d, 0xffd400, 0x3ddc84, 0x2bb3e8, 0xff8a00];
  const lg = scene.add.graphics().setDepth(0); lg.lineStyle(2, 0x222222, .8);
  for (let x = 0; x <= 800; x += 4) { const y = 28 + Math.sin(x / 800 * Math.PI) * 26; if (x === 0) lg.moveTo(x, y); else lg.lineTo(x, y); } lg.strokePath();
  for (let x = 20; x < 800; x += 40) { const y = 28 + Math.sin(x / 800 * Math.PI) * 26 + 8, b = scene.add.circle(x, y, 6, colors[(x / 40) % 5]).setDepth(0); bulbs.push(b); scene.tweens.add({ targets: b, alpha: .35, duration: 500, yoyo: true, repeat: -1, delay: (x / 40 % 3) * 170 }); }
  // banderines
  const fg = scene.add.graphics().setDepth(0);
  for (let x = 0; x < 800; x += 36) { const y = 74 + Math.sin((x + 18) / 800 * Math.PI) * 22; fg.fillStyle([0xe63946, 0xffffff, 0xffd400][(x / 36) % 3], 1); fg.fillTriangle(x, y, x + 36, y, x + 18, y + 26); }
  // caseta
  const bg = scene.add.graphics().setDepth(0);
  bg.fillStyle(0xfdf1dc, 1); bg.fillRect(190, 110, 370, 300); bg.lineStyle(4, 0xb5884f, 1); bg.strokeRect(190, 110, 370, 300);
  for (let x = 190; x < 560; x += 40) { bg.fillStyle(0xe63946, .14); bg.fillRect(x, 110, 20, 300); }
  bg.fillStyle(0xe63946, 1); bg.fillRect(178, 98, 394, 26);
  for (let x = 178; x < 572; x += 40) { bg.fillStyle(0xfff5f0, 1); bg.fillRect(x + 20, 98, 20, 26); }
  bg.lineStyle(3, 0x9a2a2a, 1); bg.strokeRect(178, 98, 394, 26);
  for (let x = 178; x < 572; x += 20) { bg.fillStyle(0xe63946, 1); bg.fillTriangle(x, 124, x + 20, 124, x + 10, 142); }
  // cartel colgante
  const sign = scene.add.container(270, 150).setDepth(0);
  const sg = scene.add.graphics(); sg.lineStyle(2, 0x6b4f3a); sg.lineBetween(-45, 0, -36, 26); sg.lineBetween(45, 0, 36, 26); sg.fillStyle(0x8d4f21); sg.fillRoundedRect(-62, 26, 124, 46, 6); sg.lineStyle(3, 0x5a3010); sg.strokeRoundedRect(-62, 26, 124, 46, 6);
  sign.add([sg, scene.add.text(0, 49, '¡TÍRALO\nAL AGUA!', { fontFamily: 'Arial Black, Arial', fontSize: 15, color: '#ffe9a8', align: 'center', fontStyle: 'bold', resolution: 2 }).setOrigin(.5)]);
  scene.tweens.add({ targets: sign, angle: { from: -2, to: 2 }, duration: 2500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  // poste de la diana
  const pg = scene.add.graphics().setDepth(1); pg.fillStyle(0x5c6670, 1); pg.fillRect(L.TARGET_X - 5, L.TARGET_Y, 10, L.PLATFORM_Y - L.TARGET_Y); pg.fillRect(L.TARGET_X - 5, L.TARGET_Y - 4, 10, 8);
  pg.fillStyle(0x3c444c, 1); pg.fillRect(L.TARGET_X - 60, L.TARGET_Y + 116, 120, 10); // barra mecanismo hacia la silla
  // piscina: borde, postes, agua trasera
  const pool = scene.add.graphics().setDepth(1);
  pool.fillStyle(0xdfe9ee, 1); pool.fillRoundedRect(30, 420, 740, 180, 6); pool.fillStyle(0x9fc9dc, 1); pool.fillRect(30, 420, 740, 20);
  pool.lineStyle(2, 0xffffff, .6); for (let x = 60; x < 770; x += 40) pool.lineBetween(x, 420, x, 440);
  pool.fillGradientStyle(0x2bb3e8, 0x2bb3e8, 0x0d6fb3, 0x0d6fb3, 1); pool.fillRect(L.POOL_X1, L.WATER_Y, L.POOL_X2 - L.POOL_X1, 160);
  const posts = scene.add.graphics().setDepth(1); posts.fillStyle(0xa86c33, 1); posts.fillRect(305, L.PLATFORM_Y, 22, 200); posts.fillRect(672, L.PLATFORM_Y, 22, 200); posts.lineStyle(2, 0x6b3f17); posts.strokeRect(305, L.PLATFORM_Y, 22, 200); posts.strokeRect(672, L.PLATFORM_Y, 22, 200);
  // olas (texturas generadas) y agua frontal
  const mkWave = (key, color, alpha, amp) => { const w = scene.add.graphics(); w.fillStyle(color, alpha); w.beginPath(); w.moveTo(0, 30); for (let x = 0; x <= 200; x += 4) w.lineTo(x, 12 + Math.sin(x / 200 * Math.PI * 2) * amp); w.lineTo(200, 30); w.closePath(); w.fillPath(); w.generateTexture(key, 200, 30); w.destroy(); };
  mkWave('wave1', 0x7fdfff, .55, 5); mkWave('wave2', 0xb9f0ff, .35, 4); mkWave('wave3', 0x2bb3e8, .75, 5);
  const w1 = scene.add.tileSprite(400, L.WATER_Y + 8, 680, 30, 'wave1').setDepth(1), w2 = scene.add.tileSprite(400, L.WATER_Y + 14, 680, 30, 'wave2').setDepth(1);
  const waterFront = scene.add.container(0, 0).setDepth(5);
  const wf = scene.add.graphics(); wf.fillStyle(0x2bb3e8, .78); wf.fillRect(L.POOL_X1, L.WATER_Y + 30, L.POOL_X2 - L.POOL_X1, 130); waterFront.add(wf);
  const w3 = scene.add.tileSprite(400, L.WATER_Y + 24, 680, 30, 'wave3'); waterFront.add(w3);
  const duck = scene.add.image(150, 500, 'atlas', 'duck').setDepth(1).setScale(.9), flt = scene.add.image(660, 520, 'atlas', 'float').setDepth(1);
  scene.tweens.add({ targets: duck, y: 506, angle: { from: -5, to: 5 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  scene.tweens.add({ targets: flt, y: 526, angle: { from: 4, to: -4 }, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  // plataforma
  const plat = scene.add.graphics().setDepth(3); plat.fillStyle(0xb8793f, 1); plat.fillRoundedRect(285, L.PLATFORM_Y - 18, 430, 18, 4); plat.lineStyle(2, 0x6b3f17); plat.strokeRoundedRect(285, L.PLATFORM_Y - 18, 430, 18, 4); plat.lineStyle(2, 0x6b3f17, .5); plat.lineBetween(300, L.PLATFORM_Y - 9, 380, L.PLATFORM_Y - 9); plat.lineBetween(430, L.PLATFORM_Y - 9, 540, L.PLATFORM_Y - 9); plat.lineBetween(600, L.PLATFORM_Y - 9, 690, L.PLATFORM_Y - 9);
  // público
  const crowd = []; const skins = [0xf1c7a3, 0xd9a177, 0x8d5a3a, 0xf5d6c0], shirts = [0xe63946, 0x2bb3e8, 0x3ddc84, 0xffd400, 0xb163ff, 0xff8a00, 0xffffff];
  const spots = [[45, 392], [85, 405], [125, 395], [160, 410], [60, 430], [110, 432], [150, 440], [725, 395], [760, 410], [700, 432], [745, 440], [775, 395]];
  spots.forEach(([x, y], i) => {
    const c = scene.add.container(x, y).setDepth(y > 425 ? 2 : 1), gg = scene.add.graphics();
    const skin = skins[i % 4], shirt = shirts[i % 7];
    gg.fillStyle(shirt, 1); gg.fillRoundedRect(-13, -14, 26, 34, 6); gg.fillStyle(skin, 1); gg.fillCircle(0, -24, 11);
    if (i % 3 === 0) { gg.fillStyle(0x222222, 1); gg.fillRect(-12, -40, 24, 7); gg.fillRect(-7, -48, 14, 10); } else if (i % 3 === 1) { gg.fillStyle(0x4a2e14, 1); gg.fillEllipse(0, -32, 22, 10); } else { gg.fillStyle(0xe63946, 1); gg.fillRoundedRect(-11, -38, 22, 8, 3); }
    gg.fillStyle(0x222222, 1); gg.fillCircle(-4, -25, 1.6); gg.fillCircle(4, -25, 1.6);
    const arms = scene.add.graphics().setVisible(false); arms.lineStyle(6, skin, 1); arms.lineBetween(-13, -8, -24, -34); arms.lineBetween(13, -8, 24, -34);
    c.add([gg, arms]); c.arms = arms; crowd.push(c);
    scene.tweens.add({ targets: c, y: y + 2, duration: 700 + i * 60, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  });
  const cheer = (big = true) => crowd.forEach((c, i) => { c.arms.setVisible(true); scene.tweens.add({ targets: c, y: c.y - (big ? 22 : 10), duration: 180, yoyo: true, repeat: big ? 3 : 1, delay: i * 40, onComplete: () => c.arms.setVisible(false) }); });
  const balloons = () => { for (let i = 0; i < 5; i++) { const b = scene.add.image(Phaser.Math.Between(40, 760), 460, 'atlas', 'balloon').setDepth(6).setScale(.7).setTint([0xe63946, 0x2bb3e8, 0xffd400, 0x3ddc84, 0xb163ff][i]); scene.tweens.add({ targets: b, y: -60, x: b.x + Phaser.Math.Between(-60, 60), duration: Phaser.Math.Between(2500, 4000), delay: i * 150, ease: 'Sine.easeIn', onComplete: () => b.destroy() }); } };
  return { bulbs, waves: [w1, w2, w3], cheer, balloons, waterFront };
}

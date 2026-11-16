// Imagen para TikTok (1080×1920): Pedro cayendo a la pecera, tomates volando y llamada a jugar
import { createRequire } from 'node:module'; import fs from 'node:fs';
const { chromium } = createRequire('/home/user/Al-agua-pedro/tests/helpers.mjs')('playwright');
const D = '/tmp/claude-0/-home-user-Al-agua-pedro/2ef7cd7a-2740-5ea4-a50f-eb638b842f19/scratchpad/', T = D + 'tt/', R = '/home/user/Al-agua-pedro/';
const b64 = f => fs.readFileSync(f).toString('base64'), img = f => `data:image/png;base64,${b64(f)}`;
const titan = b64(R + 'assets/fonts/titan-one-latin-400-normal.woff2'), baloo = b64(R + 'assets/fonts/baloo-2-latin-800-normal.woff2');
const idx = fs.readFileSync(R + 'index.html', 'utf8');
const sym = id => { const m = new RegExp(`<symbol id="${id}" viewBox="([^"]+)">([\\s\\S]*?)</symbol>`).exec(idx); return m; };
const defs = (/<defs>([\s\S]*?)<\/defs>/.exec(idx) || [])[1] || '';
const tom = sym('ic-tomato');
const tomato = (x, y, s, r = 0, extra = '') => `<svg class="tom" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px;transform:rotate(${r}deg);${extra}" viewBox="${tom[1]}"><defs>${defs}</defs>${tom[2]}</svg>`;
// salpicadura de agua: corona en la superficie y gotas saltando alrededor
const drops = Array.from({ length: 26 }, (_, i) => { const side = i % 2 ? 1 : -1, k = Math.floor(i / 2) / 13, x = 450 + side * (230 + k * 300 + (i * 29 % 40)), y = 300 - (60 + (i * 53 % 220)) * (1 - k * 0.5), s = 9 + (i * 13 % 16);
  return `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${s}" ry="${(s * 1.3).toFixed(0)}" fill="url(#gw)" stroke="#0a0b18" stroke-width="4.5"/><ellipse cx="${(x - s * 0.3).toFixed(0)}" cy="${(y - s * 0.45).toFixed(0)}" rx="${(s * 0.28).toFixed(0)}" ry="${(s * 0.38).toFixed(0)}" fill="#fff" opacity=".85"/>`; }).join('');
const crown = side => `<path d="M${side === 'L' ? '450 340 C380 330 300 300 250 230 C262 250 245 300 205 245 C215 285 190 300 150 270 C170 320 120 330 60 330 L60 360 L450 360 Z' : '450 340 C520 330 600 300 650 230 C638 250 655 300 695 245 C685 285 710 300 750 270 C730 320 780 330 840 330 L840 360 L450 360 Z'}" fill="url(#gw)" stroke="#0a0b18" stroke-width="7" stroke-linejoin="round"/>`;
const splash = `<svg class="splash" viewBox="0 0 900 380"><defs><linearGradient id="gw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8f8ff"/><stop offset="1" stop-color="#36b4ef"/></linearGradient></defs>
  ${crown('L')}${crown('R')}
  <path d="M120 330 C220 345 330 352 450 352 C570 352 680 345 780 330" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" opacity=".8"/>${drops}</svg>`;
// tomate reventado (como en el logo)
const splat = (x, y, s, r) => `<svg class="splat" style="left:${x}px;top:${y}px;width:${s}px;height:${s * 1.3}px;transform:rotate(${r}deg)" viewBox="0 0 100 130">
  <g stroke="#0a0b18" stroke-width="3.5" stroke-linejoin="round"><rect x="28" y="40" width="11" height="52" rx="5.5" fill="#c8181e"/><circle cx="33.5" cy="92" r="7.5" fill="#c8181e"/><rect x="52" y="40" width="14" height="78" rx="7" fill="#c8181e"/><circle cx="59" cy="118" r="9" fill="#c8181e"/>
  <path d="M50 8 C58 2 64 14 72 10 C80 8 80 22 90 24 C98 30 88 40 94 48 C98 58 84 60 82 68 C78 78 64 72 56 78 C46 82 40 72 30 72 C18 72 18 60 10 54 C2 46 14 38 10 30 C8 20 22 20 26 12 C32 4 42 12 50 8 Z" fill="#e3262c"/></g>
  <path d="M40 22 C46 18 56 18 62 22 C70 28 70 40 62 46 C54 52 40 50 34 42 C30 34 34 26 40 22 Z" fill="#ff5a48"/>
  <g fill="#ffe9a0" stroke="#b5121b" stroke-width="1"><ellipse cx="44" cy="34" rx="4" ry="2.5" transform="rotate(20 44 34)"/><ellipse cx="58" cy="30" rx="4" ry="2.5" transform="rotate(-20 58 30)"/><ellipse cx="54" cy="44" rx="4" ry="2.5"/></g>
  <ellipse cx="34" cy="22" rx="7" ry="3.5" fill="#fff" opacity=".8" transform="rotate(-30 34 22)"/><path d="M66 6 C74 -2 86 4 84 10 C76 12 72 8 66 6 Z" fill="#3fa34d" stroke="#0a0b18" stroke-width="3"/></svg>`;
// líneas de velocidad (cae a toda pastilla)
const speed = Array.from({ length: 9 }, (_, i) => `<i style="left:${300 + i * 60 + (i % 2) * 18}px;top:${300 + (i * 47 % 120)}px;height:${150 + (i * 53 % 140)}px"></i>`).join('');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: T; src: url(data:font/woff2;base64,${titan}); }
@font-face { font-family: B; src: url(data:font/woff2;base64,${baloo}); font-weight: 800; }
* { margin: 0; box-sizing: border-box; }
body { width: 1080px; height: 1920px; overflow: hidden; position: relative; background: #050a2e; font-family: B; }
.bg { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 46%, #3a73ff 0, #1a3bc4 30%, #0b1a6b 62%, #040822 100%); }
.rays { position: absolute; left: 540px; top: 900px; }
.rays i { position: absolute; left: -90px; bottom: 0; width: 180px; height: 1500px; transform-origin: 50% 100%; background: linear-gradient(rgba(255,255,255,.0), rgba(160,200,255,.13)); clip-path: polygon(50% 100%, 0 0, 100% 0); }
.spot { position: absolute; left: 190px; top: -40px; width: 700px; height: 1500px; background: linear-gradient(rgba(255,255,255,.22), rgba(255,255,255,0)); clip-path: polygon(38% 0, 62% 0, 100% 100%, 0 100%); filter: blur(6px); }
.badge { position: absolute; left: 50%; top: 78px; transform: translateX(-50%) rotate(-2deg); padding: 10px 34px 12px; border-radius: 40px; border: 5px solid #0a0b18; background: linear-gradient(#ff5a48, #c4161c);
  font: 40px T; color: #fff; letter-spacing: 1px; white-space: nowrap; -webkit-text-stroke: 7px #0a0b18; paint-order: stroke fill; box-shadow: 0 8px 0 #0009, 0 0 40px #ff3b2f99; }
h1 { position: absolute; left: 0; right: 0; top: 168px; text-align: center; font: 200px/0.9 T; transform: rotate(-4deg);
  background: linear-gradient(#fff6b0, #ffd23f 42%, #ff8a1a); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 3px #0a0b18) drop-shadow(0 0 3px #0a0b18) drop-shadow(0 0 3px #0a0b18) drop-shadow(0 0 3px #0a0b18) drop-shadow(0 12px 0 #0a0b18) drop-shadow(0 0 50px #ffb21a88); }
.sub { position: absolute; left: 0; right: 0; top: 560px; text-align: center; font: 800 44px/1.15 B; color: #fff; text-shadow: 0 4px 0 #0009; transform: rotate(-2deg); }
.sub b { color: #ffe766; }
.target { position: absolute; right: -70px; top: 690px; width: 360px; height: 376px; transform: rotate(10deg); filter: drop-shadow(0 18px 20px #000a); }
.target img { width: 100%; height: 100%; clip-path: circle(46.5% at 51.5% 48.6%); }
.speed i { position: absolute; width: 10px; border-radius: 6px; background: linear-gradient(rgba(255,255,255,0), rgba(255,255,255,.85)); }
.water-cut { position: absolute; left: 0; top: 0; width: 1080px; height: 1262px; overflow: hidden; }
.pedro { position: absolute; left: 215px; top: 672px; width: 640px; transform: rotate(-8deg); filter: drop-shadow(0 26px 26px #0009); }
.splat { position: absolute; filter: drop-shadow(0 6px 0 #0007); }
.tank { position: absolute; left: 140px; top: 1140px; width: 800px; filter: drop-shadow(0 26px 30px #000c); }
.tank img { width: 100%; display: block; border-radius: 26px; }
.splash { position: absolute; left: 90px; top: 905px; width: 900px; height: 380px; }
.tom { position: absolute; filter: drop-shadow(0 8px 0 #0008); }
.trail { position: absolute; height: 26px; border-radius: 20px; background: linear-gradient(90deg, rgba(255,90,72,0), rgba(255,90,72,.7)); transform-origin: right center; }
.boom { position: absolute; font: 74px T; color: #fff; -webkit-text-stroke: 12px #0a0b18; paint-order: stroke fill; text-shadow: 0 8px 0 #0a0b18; }
.cta { position: absolute; left: 70px; right: 70px; top: 1752px; height: 140px; border-radius: 80px; border: 7px solid #0a0b18; background: linear-gradient(#7af585, #1fa83a 60%, #127a28);
  box-shadow: inset 0 6px 0 #ffffff90, 0 12px 0 #0a0b18, 0 0 60px #4dff6a88; display: flex; align-items: center; justify-content: center; gap: 22px; }
.cta img { width: 96px; height: 96px; border-radius: 24px; border: 5px solid #0a0b18; }
.cta span { display: flex; flex-direction: column; line-height: 1; }
.cta b { font: 62px T; color: #fff; -webkit-text-stroke: 11px #0a0b18; paint-order: stroke fill; }
.cta small { font: 800 38px B; color: #0a3d14; margin-top: 6px; letter-spacing: .5px; }
.chips { position: absolute; left: 0; right: 0; top: 1640px; display: flex; justify-content: center; gap: 16px; }
.chips span { padding: 8px 20px 10px; border-radius: 30px; background: #0a1442e0; border: 4px solid #0a0b18; font: 800 30px B; color: #fff; box-shadow: 0 5px 0 #0008; white-space: nowrap; }
</style></head><body>
<div class="bg"></div><div class="rays">${Array.from({ length: 24 }, (_, i) => `<i style="transform:rotate(${i * 15}deg)"></i>`).join('')}</div><div class="spot"></div>
<div class="target"><img src="${img(T + 'target.png')}"></div>
${tomato(845, 820, 64, 20)}
<div class="tank"><img src="${img(T + 'tank.png')}"></div>
<div class="water-cut"><img class="pedro" src="${img(T + 'fall-crop.png')}"></div>
${splat(318, 760, 150, -28)}
${splash}
<div class="trail" style="left:-20px;top:840px;width:250px;transform:rotate(-12deg)"></div>${tomato(200, 790, 112, -20)}
<div class="trail" style="left:-30px;top:1060px;width:200px;transform:rotate(-20deg)"></div>${tomato(140, 1000, 96, 15)}
<div class="boom" style="left:40px;top:690px;transform:rotate(-14deg);font-size:72px">¡PLAF!</div>
<div class="boom" style="left:705px;top:1080px;transform:rotate(10deg);font-size:70px">¡AL AGUA!</div>
<div class="badge">🎮 NUEVO JUEGO GRATIS</div>
<h1>¡AL AGUA<br>PEDRO!</h1>
<p class="sub">Lánzale tomates a la diana<br>y <b>tíralo a la pecera de las pirañas</b> 🦈</p>
<div class="cta"><img src="${img(R + 'assets/icons/icon-192.png')}"><span><b>¡JUEGA GRATIS!</b><small>alaguapedro.es</small></span></div>
</body></html>`;
const br = await chromium.launch(); const p = await br.newPage({ viewport: { width: 1080, height: 1920 } });
await p.setContent(html); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
await p.screenshot({ path: process.argv[2] || D + 'tt/tiktok.png' });
await br.close(); console.log('ok');

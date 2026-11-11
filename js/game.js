// Mecánica: clics, tomates, lanzamiento y resultados.
import { CONFIG } from './config.js';
import { state, addClick, useTomato, registerResult } from './state.js';
import { SFX, unlock } from './audio.js';
import * as P from './pedro.js';

const $ = s => document.querySelector(s);
const scene = $('#scene'), tomato = $('#tomato'), tomatoUse = tomato.querySelector('use'), track = $('#track'), target = $('#target'), platform = $('#platform');
const splats = $('#splats'), fx = $('#fx-text'), ripples = $('#ripples'), tapLayer = $('#tap-layer');
const btnClick = $('#btn-click'), btnThrow = $('#btn-throw'), btnThrowText = $('#btn-throw-text');
const NS = 'http://www.w3.org/2000/svg';
let throwing = null, busy = false, raf = 0, ui = null, idleTimer = null;
const wait = ms => new Promise(r => setTimeout(r, ms));

export function init(uiRef) {
  ui = uiRef;
  btnClick.addEventListener('pointerdown', onClickZone);
  btnClick.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClickZone(e); } });
  btnThrow.addEventListener('click', () => throwing ? stopThrow() : startThrow());
  tapLayer.addEventListener('pointerdown', e => { if (throwing) { e.preventDefault(); stopThrow(); } });
  document.addEventListener('keydown', e => { if (e.code === 'Space' && throwing && !e.repeat) { e.preventDefault(); stopThrow(); } });
  scheduleIdle();
}
export function isBusy() { return busy; }

function scheduleIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!busy && !throwing && document.visibilityState === 'visible') { P.mood('smug'); P.say(P.pick(P.LINES.idle), 2500); setTimeout(() => { if (!busy) P.mood(null); }, 2500); }
    scheduleIdle();
  }, 22000 + Math.random() * 10000);
}

// ---------- CLICS ----------
function onClickZone(e) {
  unlock(); SFX.click();
  const earned = addClick();
  btnClick.classList.add('pressed'); setTimeout(() => btnClick.classList.remove('pressed'), 90);
  ui.floater('+1', e.clientX || null, e.clientY || null);
  ui.updateCounters(true);
  if (state.stats.totalClicks % 10 === 0 && !busy) P.oneShot('click-react', 320);
  if (earned) tomatoEarned(earned);
  scheduleIdle();
}
function tomatoEarned(n) {
  SFX.tomato(); ui.flyTomatoToBasket(btnClick);
  if (!busy) { P.mood('shock'); P.say(P.pick(P.LINES.tomato), 1800); setTimeout(() => { if (!busy) P.mood(null); }, 1500); }
}

// ---------- LANZAMIENTO ----------
function speed() { return CONFIG.TOMATO_SPEED * Math.min(CONFIG.MAX_SPEED_MULT, 1 + CONFIG.SPEED_PER_FALL * state.stats.falls); }
export function startThrow() {
  if (busy || throwing || state.tomatoes <= 0) return;
  if (!state.tutorialSeen) { ui.showTutorial(startThrow); return; }
  unlock();
  if (!useTomato()) return;
  ui.updateCounters();
  SFX.throwStart(); P.hush(); P.mood(null);
  throwing = { x: CONFIG.TRACK_MIN, dir: 1, last: performance.now(), rot: 0, speed: speed() };
  track.classList.add('on'); tomato.classList.add('on'); tomatoUse.classList.remove('fly'); tomato.classList.remove('fly');
  btnThrow.classList.add('stop-mode'); btnThrowText.textContent = '¡AHORA!'; $('#btn-throw-sub').textContent = 'Toca para detener';
  raf = requestAnimationFrame(loop);
}
function loop(ts) {
  if (!throwing) return;
  const dt = Math.min(50, ts - throwing.last); throwing.last = ts;
  throwing.x += throwing.dir * throwing.speed * dt; throwing.rot += dt * 0.45 * throwing.dir;
  if (throwing.x >= CONFIG.TRACK_MAX) { throwing.x = CONFIG.TRACK_MAX; throwing.dir = -1; }
  if (throwing.x <= CONFIG.TRACK_MIN) { throwing.x = CONFIG.TRACK_MIN; throwing.dir = 1; }
  tomato.setAttribute('transform', `translate(${throwing.x.toFixed(1)},${CONFIG.TRACK_Y}) rotate(${throwing.rot.toFixed(1)})`);
  raf = requestAnimationFrame(loop);
}
// Precisión: distancia del tomate al centro de la diana. Sin azar.
export function evaluate(x) {
  const dist = Math.abs(x - CONFIG.TARGET_X);
  const precision = Math.max(0, 1 - dist / (CONFIG.TRACK_MAX - CONFIG.TARGET_X));
  const kind = dist <= CONFIG.PERFECT_RADIUS ? 'perfect' : dist <= CONFIG.NEAR_RADIUS ? 'near' : 'miss';
  return { dist, precision, kind };
}
async function stopThrow() {
  if (!throwing) return;
  cancelAnimationFrame(raf);
  const x = throwing.x; throwing = null; busy = true;
  SFX.stop();
  btnThrow.classList.remove('stop-mode'); btnThrow.disabled = true;
  const res = evaluate(x);
  await wait(150);
  SFX.whoosh(); tomato.classList.add('fly'); tomatoUse.classList.add('fly');
  await wait(300);
  tomato.classList.remove('on'); track.classList.remove('on');
  SFX.splat(); splat(x, CONFIG.TRACK_Y, res.kind === 'perfect' ? 1.3 : 1);
  registerResult(res.kind); ui.updateCounters();
  ui.onResult(res);
  if (res.kind === 'perfect') await perfect(); else if (res.kind === 'near') await near(); else await miss();
  busy = false; ui.updateCounters(); scheduleIdle();
}

function splat(x, y, s = 1) {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('transform', `translate(${x},${y}) scale(${s})`);
  g.innerHTML = `<g class="splat"><use href="#splat-sym" x="-30" y="-30" width="60" height="60"/></g>`;
  splats.appendChild(g);
  setTimeout(() => g.firstChild.classList.add('drip'), 400); setTimeout(() => g.remove(), 3500);
}
export function fxText(text, x, y, big = false) {
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('x', x); t.setAttribute('y', y); t.setAttribute('class', 'fx' + (big ? ' big' : '')); t.setAttribute('fill', big ? '#e63946' : '#1f2d55');
  t.setAttribute('font-size', big ? 48 : 26); t.textContent = text; fx.appendChild(t); setTimeout(() => t.remove(), 1400);
}
function shake(el, cls, ms) { el.classList.remove(cls); void el.getBoundingClientRect(); el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); }

function splash(x, y) {
  for (let i = 0; i < 26; i++) {
    const c = document.createElementNS(NS, 'circle');
    const r = 3 + Math.random() * 6; c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', r); c.setAttribute('fill', i % 3 ? '#bdf0ff' : '#fff');
    fx.appendChild(c);
    const vx = (Math.random() - .5) * 260, vy = -(120 + Math.random() * 220), t = 700 + Math.random() * 400;
    c.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${vx * .5}px,${vy * .6}px)`, opacity: 1, offset: .45 }, { transform: `translate(${vx}px,${40}px)`, opacity: 0 }], { duration: t, easing: 'ease-out' }).onfinish = () => c.remove();
  }
  for (let i = 0; i < 3; i++) {
    const e = document.createElementNS(NS, 'ellipse');
    e.setAttribute('cx', x); e.setAttribute('cy', y); e.setAttribute('rx', 20); e.setAttribute('ry', 40); e.setAttribute('fill', '#e8fbff'); e.setAttribute('opacity', '.9');
    fx.appendChild(e);
    e.animate([{ transform: 'scale(.2,.1)', opacity: .9 }, { transform: `scale(${1.2 + i * .4},${1.6 - i * .3})`, opacity: .8, offset: .4 }, { transform: `scale(${2 + i * .5},.2) translate(0,10px)`, opacity: 0 }], { duration: 900 + i * 150, easing: 'ease-out', delay: i * 60 }).onfinish = () => e.remove();
  }
  for (let i = 0; i < 3; i++) {
    const r = document.createElementNS(NS, 'ellipse');
    r.setAttribute('cx', x); r.setAttribute('cy', y + 6); r.setAttribute('rx', 40); r.setAttribute('ry', 10); r.setAttribute('class', 'ripple'); r.style.transformOrigin = `${x}px ${y + 6}px`; r.style.animationDelay = `${i * 0.25}s`;
    ripples.appendChild(r); setTimeout(() => r.remove(), 1800 + i * 250);
  }
}

async function perfect() {
  shake(target, 'hit', 600); await wait(80); SFX.clank(); SFX.win();
  fxText('¡PERFECTO!', CONFIG.TARGET_X, 130, true);
  P.mood('shock'); P.say('¡¿QUÉ?! ¡NOOO!', 1400);
  shake(platform, 'shake', 500); P.seat.tilt();
  await wait(350); P.body.fall(); SFX.fall(); P.hush();
  await wait(900); splash(337, 470); SFX.splash(); shake(scene, 'quake', 400);
  P.body.sink(); await wait(400);
  P.mood('angry'); P.wet(true); P.body.surface(); await wait(600); SFX.angry(); P.say(P.pick(P.LINES.wetWater), 2200, P.WATER_POS);
  await wait(2300); P.hush(); P.body.dive(); await wait(500);
  P.seat.reset(); await wait(400);
  P.body.respawn(); await wait(700); P.body.reset();
  P.say(P.pick(P.LINES.wetChair), 2400);
  setTimeout(() => { P.wet(false); if (!busy) P.mood(null); }, 5000);
}
async function near() {
  shake(target, 'wobble', 600); SFX.near();
  fxText('¡CASI!', CONFIG.TARGET_X, 130, true);
  P.mood('shock'); P.oneShot('wobble', 900); P.seat.shake(); shake(platform, 'shake', 500);
  await wait(950);
  P.mood('smug'); P.say(P.pick(P.LINES.near), 2200);
  await wait(1200); setTimeout(() => { if (!busy) P.mood(null); }, 1200);
}
async function miss() {
  SFX.miss(); fxText('FALLO', CONFIG.TARGET_X, 130, true);
  await wait(250);
  P.mood('laugh'); SFX.laugh(); P.say(P.pick(P.LINES.miss), 2400); P.oneShot('hit-small', 400);
  await wait(1400); setTimeout(() => { if (!busy) P.mood(null); }, 1200);
}

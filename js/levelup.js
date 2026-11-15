// Niveles en pantalla: barra de experiencia, celebración al subir de nivel, ruleta de premios y lista de niveles.
import { state } from './state.js';
import * as LV from './levels.js';
import { backend } from './backend.js';
import { SFX } from './audio.js';
import { createFx } from './fx.js';

const $ = s => document.querySelector(s);
const fmt = n => n.toLocaleString('es-ES');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TIERS = ['t1', 't2', 't3', 't4', 't5', 't6'];
const setTier = (el, L) => { el.classList.remove(...TIERS); el.classList.add('t' + LV.tierOf(L)); };
const INTRO_KEY = 'alaguapedro.levelsIntro';
let ui, isBusy, fail, fxUp = null, fxWheel = null, shownXp = null, queue = Promise.resolve(), running = false, spinning = false, waitingSpin = null;
export const levelTest = { rng: null, fast: false, off: !!window.__AAP_NOLEVELUP };   // pruebas automáticas: premio fijo, animaciones rápidas o sin celebraciones
export const pending = () => (state.noWheel ? 0 : Math.max(0, LV.levelOf(state.stats) - state.wheelLevel));
export const celebrating = () => running;

export function initLevels(uiRef, busyFn, failFn) {
  ui = uiRef; isBusy = busyFn; fail = failFn;
  fxUp = createFx($('#lvlup-overlay')); fxWheel = createFx($('#wheel-overlay'));
  $('#lvl-chip').addEventListener('click', () => { SFX.ui(); openLevels(); });
  $('#levels-body').addEventListener('click', e => { if (e.target.closest('[data-spin]')) { ui.closeAll(); queueCelebrate({ mode: 'wheel' }); } });
  $('#wheel-close').addEventListener('click', () => { if (!spinning) closeWheel(); });
  buildLights();
  syncChip();
}

// ---------- barra de nivel (arriba a la izquierda) ----------
// mode: 'auto' (cada cambio del juego: la experiencia nueva espera al final del lanzamiento, para celebrarla) o true (actualizar ya)
export function syncChip(mode = true) {
  const info = LV.levelInfo(state.stats), chip = $('#lvl-chip');
  if (mode === 'auto' && shownXp !== null && info.xp > shownXp) return;
  setTier(chip, info.level);
  $('#lvl-num').textContent = info.level; $('#lvl-name').textContent = info.name;
  $('#lvl-fill').style.width = (info.pct * 100).toFixed(1) + '%';
  $('#lvl-xp').textContent = info.max ? 'NIVEL MÁXIMO' : `${fmt(info.into)} / ${fmt(info.need)} XP`;
  const p = pending(); $('#lvl-dot').classList.toggle('hidden', !p); $('#lvl-dot').textContent = p;
  chip.classList.toggle('ready', !!p);
  shownXp = info.xp;
}
// Al terminar un lanzamiento: «+XP» volando a la barra y, si toca, celebración
export function afterThrow() {
  const before = shownXp ?? LV.xpOf(state.stats), now = LV.xpOf(state.stats), gained = now - before;
  if (gained <= 0) { syncChip(); return; }
  const L0 = LV.levelOfXp(before), L1 = LV.levelOfXp(now), chip = $('#lvl-chip');
  xpFloater(gained); SFX.xp();
  chip.classList.remove('gain'); void chip.offsetWidth; chip.classList.add('gain');
  if (L1 > L0) {
    $('#lvl-fill').style.width = '100%'; SFX.xpFill();                     // la barra se llena del todo y estalla
    shownXp = now; chip.classList.add('full');
    setTimeout(() => { chip.classList.remove('full'); syncChip(true); }, 700);
    queueCelebrate({ mode: 'up', from: L0, to: L1 });
  } else syncChip(true);
}
function xpFloater(n) {
  const r = $('#lvl-chip .lvl-bar').getBoundingClientRect(), el = document.createElement('div');
  el.className = 'xp-float'; el.textContent = `+${fmt(n)} XP`;
  el.style.left = (r.left + r.width / 2) + 'px'; el.style.top = (r.bottom + 4) + 'px';
  document.body.appendChild(el); setTimeout(() => el.remove(), 1300);
}
// Al entrar: si hay tiradas pendientes, se ofrecen (la primera vez, presentando los niveles)
export function checkPending() { if (pending() > 0) queueCelebrate({ mode: 'pending' }); }

// ---------- celebración (en cola, cuando no haya nada delante) ----------
const screenBusy = () => !!document.querySelector('.panel.open, .overlay.open, .gift-drop:not(.hidden), #tour') || isBusy?.() || ui.gated();
async function whenFree() { let ok = 0; while (ok < 2) { await sleep(levelTest.fast ? 50 : 300); ok = screenBusy() ? 0 : ok + 1; } }
function queueCelebrate(opts) {
  if (levelTest.off) return queue;
  queue = queue.then(async () => {
    if (opts.mode !== 'up' && !pending()) return;
    await whenFree(); running = true;
    try { if (opts.mode === 'wheel') await wheelSession(); else await celebrate(opts); } catch (e) { fail?.(e); }
    running = false; syncChip();
  });
  return queue;
}
async function celebrate({ mode, from, to }) {
  const L = to || LV.levelOf(state.stats), ov = $('#lvlup-overlay'), fast = levelTest.fast;
  let intro = false; try { intro = mode === 'pending' && !localStorage.getItem(INTRO_KEY); localStorage.setItem(INTRO_KEY, '1'); } catch (e) {}
  const start = mode === 'up' ? from : L;
  setTier(ov, start); ov.classList.remove('go', 'named', 'ready', 'legend');
  $('#lvlup-num').textContent = start;
  $('#lvlup-banner').textContent = intro ? '¡NUEVO: NIVELES!' : mode === 'up' ? (to - from > 1 ? `¡+${to - from} NIVELES!` : '¡SUBES DE NIVEL!') : '¡PREMIO PENDIENTE!';
  $('#lvlup-name').textContent = LV.levelName(L);
  $('#lvlup-sub').textContent = `Nivel ${L} de ${LV.MAX_LEVEL}`;
  $('#lvlup-next').innerHTML = intro ? 'Cada tomate te da experiencia.<br>¡Cada nivel, <b>un giro de ruleta</b>!' : L < LV.MAX_LEVEL ? `Siguiente: <b>${esc(LV.levelName(L + 1))}</b>` : '¡Has llegado a lo más alto!';
  const p = pending(); $('#lvlup-cnt').textContent = '×' + p; $('#lvlup-cnt').classList.toggle('hidden', p < 2);
  $('#lvlup-spin span').textContent = p ? '¡GIRAR LA RULETA!' : '¡SEGUIR!';
  ov.classList.add('open');
  // redoble y la medalla gira; luego el número nuevo con fanfarria y confeti
  SFX.drumroll(fast ? 0.1 : 0.9);
  if (mode === 'up' && to - from > 1) for (let n = from + 1; n < to; n++) { await sleep(fast ? 10 : 260); $('#lvlup-num').textContent = n; setTier(ov, n); SFX.tick(); }
  await sleep(fast ? 30 : mode === 'up' && to - from > 1 ? 250 : 900);
  $('#lvlup-num').textContent = L; setTier(ov, L); ov.classList.toggle('legend', L >= LV.MAX_LEVEL);
  ov.classList.add('go'); SFX.levelUp();
  const r = $('#lvlup-medal').getBoundingClientRect(), o = ov.getBoundingClientRect();
  fxUp.resize(); fxUp.burst(r.left - o.left + r.width / 2, r.top - o.top + r.height / 2, 140); setTimeout(() => fxUp.rain(70), 300);
  if (navigator.vibrate) try { navigator.vibrate([30, 40, 80]); } catch (e) {}
  await sleep(fast ? 20 : 550); ov.classList.add('named'); SFX.stamp();
  await sleep(fast ? 20 : 700); ov.classList.add('ready');
  await new Promise(res => { $('#lvlup-spin').onclick = () => { SFX.ui(); res(); }; });
  ov.classList.remove('open'); fxUp.clear();
  if (pending()) await wheelSession();
}

// ---------- ruleta ----------
const N = LV.WHEEL.length, SEG = 360 / N;
let angle = 0;
function wedge(i, r) { const a0 = (i * SEG - 90) * Math.PI / 180, a1 = ((i + 1) * SEG - 90) * Math.PI / 180; return `M0 0 L${(r * Math.cos(a0)).toFixed(2)} ${(r * Math.sin(a0)).toFixed(2)} A${r} ${r} 0 0 1 ${(r * Math.cos(a1)).toFixed(2)} ${(r * Math.sin(a1)).toFixed(2)}Z`; }
function buildWheel(L) {
  const segs = LV.WHEEL.map((s, i) => {
    const mid = i * SEG + SEG / 2, txt = LV.segText(s, L);
    return `<g class="seg${s.jackpot ? ' jackpot' : ''}" data-i="${i}">
      <path d="${wedge(i, 180)}" fill="${s.color}" class="fill"/>
      <path d="${wedge(i, 180)}" fill="url(#wShade)" class="shade"/>
      <g transform="rotate(${mid})">
        <use href="#${s.icon}" x="-23" y="-172" width="46" height="46"/>
        <text y="-108" class="lbl" style="font-size:${Math.min(16, Math.floor(120 / s.label.length))}px">${s.label}</text>
        <text y="-80" class="amt" style="font-size:${Math.min(24, Math.floor(118 / Math.max(3, txt.length)))}px">${txt}</text>
      </g></g>`;
  }).join('');
  $('#wheel-svg').innerHTML = `<defs><radialGradient id="wShade" cx="0" cy="0" r="180" gradientUnits="userSpaceOnUse"><stop offset=".25" stop-color="#000" stop-opacity=".35"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset=".97" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient>
    <linearGradient id="wRim" x1="0" y1="-1" x2="0" y2="1"><stop offset="0" stop-color="#fff3a0"/><stop offset=".5" stop-color="#ffb21a"/><stop offset="1" stop-color="#9a5600"/></linearGradient></defs>
    <circle r="196" fill="url(#wRim)" stroke="#0a0b18" stroke-width="5"/>
    ${segs}
    ${LV.WHEEL.map((_, i) => `<line x1="0" y1="0" x2="0" y2="-180" transform="rotate(${i * SEG})" stroke="#0a0b18" stroke-width="4"/>`).join('')}
    <circle r="180" fill="none" stroke="#0a0b18" stroke-width="5"/>`;
}
function buildLights() { $('#wheel-lights').innerHTML = Array.from({ length: 20 }, (_, i) => `<i style="transform:rotate(${i * 18}deg) translateY(calc(var(--wr) * -1))"></i>`).join(''); }
function setAngle(a) { angle = a; $('#wheel').style.transform = `rotate(${a}deg)`; }
function openWheel() {
  const L = state.wheelLevel + 1, ov = $('#wheel-overlay');
  buildWheel(L); setAngle(angle % 360);
  $('#wheel-title').textContent = `RULETA · NIVEL ${L}`;
  const p = pending(); $('#wheel-sub').textContent = p > 1 ? `Tienes ${p} tiradas: ¡a por todas!` : '¡Gira y llévate un premio!';
  $('#wheel-prize').classList.add('hidden'); $('#wheel-prize').innerHTML = '';
  ov.classList.remove('spinning', 'won'); $$('#wheel-svg .seg').forEach(g => g.classList.remove('win'));
  const btn = $('#wheel-btn'); btn.disabled = false; btn.classList.remove('hidden'); $('#wheel-btn span').textContent = '¡GIRAR!';
  ov.classList.add('open'); fxWheel.resize();
}
const $$ = s => [...document.querySelectorAll(s)];
function closeWheel() { $('#wheel-overlay').classList.remove('open'); fxWheel.clear(); if (waitingSpin) { const w = waitingSpin; waitingSpin = null; w('close'); } }
// Una sesión de ruleta: gira tantas veces como tiradas haya; se puede cerrar y seguir luego desde la barra de nivel
async function wheelSession() {
  while (pending()) {
    openWheel();
    const act = await new Promise(res => { waitingSpin = res; $('#wheel-btn').onclick = () => res('spin'); $('#wheel-hub').onclick = () => res('spin'); });
    waitingSpin = null;
    if (act === 'close') return;
    const out = await spin();
    if (!out) { closeWheel(); return; }
    const next = await showPrize(out);
    if (next === 'close') { closeWheel(); return; }
    if (out.reward.cards?.length || out.reward.kind === 'wood' || out.reward.kind === 'diamond') { closeWheel(); await ui.chestOpening(out.reward.kind, out.reward); ui.hud(); }
  }
  closeWheel(); ui.hud();
}
// Gira: arranca enseguida y, cuando el servidor dice el premio, frena justo en esa casilla
async function spin() {
  const ov = $('#wheel-overlay'), btn = $('#wheel-btn'); btn.disabled = true; spinning = true; ov.classList.add('spinning');
  SFX.spin(); if (navigator.vibrate) try { navigator.vibrate(20); } catch (e) {}
  let result = null, error = null;
  const req = backend.spinWheel(levelTest.rng).then(r => { result = r; }, e => { error = e; });
  const fast = levelTest.fast, MAXV = 900;              // grados por segundo
  let v = 0, t0 = performance.now(), last = t0, lastSeg = Math.floor(angle / SEG);
  const tick = a => { const s = Math.floor(a / SEG); if (s !== lastSeg) { lastSeg = s; SFX.tick(); const p = $('#wheel-pointer'); p.classList.remove('kick'); void p.offsetWidth; p.classList.add('kick'); } };
  // 1) acelera y gira mientras llega el premio (mínimo 1,2 s)
  await new Promise(res => {
    const step = now => {
      const dt = (now - last) / 1000; last = now; v = Math.min(MAXV, v + 2400 * dt); setAngle(angle + v * dt); tick(angle);
      if ((result || error) && now - t0 > (fast ? 50 : 1200)) return res();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  await req;
  if (error) {                                            // sin premio: frena y avisa
    await decel(angle + 200, 1.2, tick); spinning = false; ov.classList.remove('spinning'); btn.disabled = false; fail?.(error); return null;
  }
  // 2) frena con suavidad hasta la casilla ganadora (con un poco de suspense al final)
  const i = result.seg, within = (0.18 + Math.random() * 0.64) * SEG;
  const target = -(i * SEG + within);                     // ángulo final (módulo 360) para que la flecha quede en esa casilla
  let end = target + 360 * Math.ceil((angle - target) / 360); end += 360 * (fast ? 0 : 3);
  await decel(end, fast ? 0.05 : Math.max(3.2, 3 * (end - angle) / MAXV), tick);
  spinning = false; ov.classList.remove('spinning');
  return result;
}
function decel(end, T, tick) {
  const a0 = angle, d = end - a0, t0 = performance.now();
  return new Promise(res => {
    const step = now => {
      const t = Math.min(1, (now - t0) / 1000 / T), e = 1 - Math.pow(1 - t, 3);
      setAngle(a0 + d * e); tick(angle);
      if (t < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}
// Premio: casilla brillando, explosión, monedas o tomates saltando y el cartel
async function showPrize(out) {
  const { seg, reward } = out, s = LV.WHEEL[seg], ov = $('#wheel-overlay'), box = $('#wheel-prize'), p = out.pending;
  $(`#wheel-svg .seg[data-i="${seg}"]`)?.classList.add('win'); ov.classList.add('won');
  const big = !!s.jackpot || s.kind === 'falcon' || s.chest === 'diamond';
  SFX.prize(big); if (navigator.vibrate) try { navigator.vibrate(big ? [40, 60, 120] : 40); } catch (e) {}
  const w = $('#wheel-wrap').getBoundingClientRect(), o = ov.getBoundingClientRect(), cx = w.left - o.left + w.width / 2, cy = w.top - o.top + w.height / 2;
  fxWheel.resize(); fxWheel.burst(cx, cy, big ? 160 : 90);
  if (reward.pesetas && s.kind === 'pesetas') fxWheel.fountain(cx, cy, s.jackpot ? 60 : 26, 'coin');
  if (reward.tomatoes && s.kind === 'tomatoes') fxWheel.fountain(cx, cy, 24, 'tomato');
  if (s.jackpot) setTimeout(() => fxWheel.rain(90, 'coin'), 400);
  const line = s.kind === 'pesetas' ? `<b>+${fmt(reward.pesetas)}</b> pesetas` : s.kind === 'tomatoes' ? `<b>+${fmt(reward.tomatoes)}</b> tomates`
    : s.kind === 'falcon' ? '<b>×5 clics</b> durante 10 minutos' : s.chest === 'diamond' ? '<b>3 cartas</b> del cofre de diamante' : '<b>1 carta</b> del cofre de madera';
  box.className = 'wheel-prize' + (big ? ' big' : ''); box.style.setProperty('--pc', s.color);
  box.innerHTML = `<span class="tag">${s.jackpot ? '¡¡BOTE!!' : '¡PREMIO!'}</span><svg><use href="#${s.icon}"/></svg><p>${line}</p>`;
  ui.hud(); syncChip();
  const btn = $('#wheel-btn'); await sleep(levelTest.fast ? 10 : 600); btn.disabled = false;
  const chest = s.kind === 'chest';
  $('#wheel-btn span').textContent = chest ? '¡ABRIR!' : p ? `¡OTRA TIRADA! (${p})` : '¡A JUGAR!';
  return new Promise(res => { waitingSpin = res; btn.onclick = () => { waitingSpin = null; SFX.ui(); res(chest || p ? 'next' : 'close'); }; $('#wheel-hub').onclick = null; });
}

// ---------- lista de niveles ----------
function openLevels() { renderLevels(); ui.openPanel('#panel-levels'); setTimeout(() => $('#levels-body .lv.cur')?.scrollIntoView({ block: 'center' }), 60); }
export function renderLevels() {
  const info = LV.levelInfo(state.stats), p = pending();
  const head = `<div class="lv-head t${info.tier}">
      <span class="lvl-medal xl"><svg><use href="#ic-medal"/></svg><b>${info.level}</b></span>
      <div><small>NIVEL ${info.level} DE ${LV.MAX_LEVEL}</small><h3>${esc(info.name)}</h3>
        <div class="lvl-bar big"><i style="width:${(info.pct * 100).toFixed(1)}%"></i><small>${info.max ? 'NIVEL MÁXIMO' : `${fmt(info.into)} / ${fmt(info.need)} XP`}</small></div></div></div>
    ${p ? `<button class="btn-gold spin-cta" data-spin><span>¡TIENES ${p} TIRADA${p > 1 ? 'S' : ''} DE RULETA!</span></button>` : ''}
    <p class="lv-how"><b>Experiencia:</b> +${LV.XP.thrown} por tomate lanzado · +${LV.XP.hit} por impacto · +${LV.XP.fall} cada vez que Pedro cae al agua. <b>Cada nivel = un giro de ruleta.</b></p>`;
  const rows = LV.LEVEL_NAMES.map((n, k) => { const L = k + 1, st = L < info.level ? 'done' : L === info.level ? 'cur' : 'lock';
    return `<li class="lv ${st} t${LV.tierOf(L)}"><span class="lvl-medal"><svg><use href="#ic-medal"/></svg><b>${L}</b></span><span class="nm">${esc(n)}</span><span class="xp">${st === 'done' ? '✔' : fmt(LV.XP_AT[k]) + ' XP'}</span></li>`; }).join('');
  $('#levels-body').innerHTML = head + `<ol class="lv-list">${rows}</ol>`;
}

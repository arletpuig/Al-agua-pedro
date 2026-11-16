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
let ui, isBusy, fail, reload = null, lastOffer = 0, fxUp = null, fxWheel = null, shownXp = null, queue = Promise.resolve(), running = false, spinning = false, waitingSpin = null;
export const levelTest = { rng: null, fast: false, off: !!window.__AAP_NOLEVELUP };   // pruebas automáticas: premio fijo, animaciones rápidas o sin celebraciones
export function levelTestReset() { lastOffer = 0; }
export const pending = () => (state.noWheel ? 0 : Math.max(0, Math.min(LV.levelOf(state.stats), state.wheelCap ?? 99) - state.wheelLevel));
export const celebrating = () => running;

export function initLevels(uiRef, busyFn, failFn, reloadFn) {
  ui = uiRef; isBusy = busyFn; fail = failFn; reload = reloadFn;
  fxUp = createFx($('#lvlup-overlay')); fxWheel = createFx($('#wheel-overlay'));
  $('#lvl-chip').addEventListener('click', () => { SFX.ui(); if (pending() > 0 && !running) openWheelFrom('level'); else openLevels(); });
  $('#levels-body').addEventListener('click', e => { if (e.target.closest('[data-spin]')) openWheelFrom('level'); else if (e.target.closest('[data-legend]')) openWheelFrom('legend'); });
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
  // al final de la barra: la ruleta que te espera al subir (la legendaria si el siguiente nivel es múltiplo de 10)
  const pz = $('#lvl-prize'), legNext = LV.isLegendLevel(info.level + 1) || (p > 0 && LV.isLegendLevel(state.wheelLevel + 1));
  pz.classList.toggle('hidden', info.max && !p); pz.classList.toggle('legend', legNext); pz.classList.toggle('ready', !!p);
  pz.querySelector('use').setAttribute('href', legNext ? '#ic-wheel-legend' : '#ic-wheel');
  pz.title = p ? '¡Tienes una tirada de ruleta!' : legNext ? 'Al subir de nivel: ¡ruleta legendaria!' : 'Al subir de nivel: ruleta de premios';
  chip.classList.toggle('ready', !!p);
  shownXp = info.xp;
}
// Al terminar un lanzamiento: «+XP» volando a la barra y, si toca, celebración
export function afterThrow() {
  const before = shownXp ?? LV.xpOf(state.stats), now = LV.xpOf(state.stats), gained = now - before;
  if (gained <= 0) { syncChip(); reoffer(); return; }
  const L0 = LV.levelOfXp(before), L1 = LV.levelOfXp(now), chip = $('#lvl-chip');
  xpFloater(gained); SFX.xp();
  chip.classList.remove('gain'); void chip.offsetWidth; chip.classList.add('gain');
  if (L1 > L0) {
    $('#lvl-fill').style.width = '100%'; SFX.xpFill();                     // la barra se llena del todo y estalla
    shownXp = now; chip.classList.add('full');
    setTimeout(() => { chip.classList.remove('full'); syncChip(true); }, 700);
    queueCelebrate({ mode: 'up', from: L0, to: L1 });
  } else { syncChip(true); reoffer(); }
}
function reoffer() { if (!levelTest.off && pending() > 0 && !running && Date.now() - lastOffer > 120000) { lastOffer = Date.now(); queueCelebrate({ mode: 'wheel', src: 'level' }); } }
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
  if (levelTest.off && opts.mode !== 'wheel') return queue;
  queue = queue.then(async () => {
    if (opts.mode === 'wheel' ? !SOURCES[opts.src || 'level'].can() : opts.mode !== 'up' && !pending()) return;
    await whenFree(); running = true;
    try { if (opts.mode === 'wheel') await wheelSession(opts.src || 'level'); else await celebrate(opts); } catch (e) { fail?.(e); }
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
  const p = pending(), legNext = p > 0 && LV.isLegendLevel(state.wheelLevel + 1), legAny = Array.from({ length: p }, (_, i) => state.wheelLevel + 1 + i).some(LV.isLegendLevel);
  $('#lvlup-cnt').textContent = '×' + p; $('#lvlup-cnt').classList.toggle('hidden', p < 2);
  $('#lvlup-spin span').textContent = !p ? '¡SEGUIR!' : legNext ? '¡GIRAR LA LEGENDARIA!' : '¡GIRAR LA RULETA!';
  $('#lvlup-spin').classList.toggle('legend', legNext);
  if (legAny && !intro) $('#lvlup-next').innerHTML = '¡Este nivel trae la <b>RULETA LEGENDARIA</b>!';
  ov.classList.toggle('has-legend', legAny);
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
  if (pending()) await wheelSession('level');
}

// ---------- ruletas ----------
// Tres formas de girar: por subir de nivel (los múltiplos de 10, legendaria), en la tienda pagando pesetas y la legendaria comprada.
const SOURCES = {
  level:  { wheel: () => (LV.isLegendLevel(state.wheelLevel + 1) ? 'legend' : 'normal'), L: () => state.wheelLevel + 1, can: () => pending() > 0, left: () => pending(), go: rng => backend.spinWheel(rng) },
  shop:   { wheel: () => 'normal', L: () => LV.levelOf(state.stats), can: () => state.pesetas >= LV.shopSpinPrice(LV.levelOf(state.stats)), left: () => Math.floor(state.pesetas / LV.shopSpinPrice(LV.levelOf(state.stats))), go: rng => backend.buySpin(rng) },
  legend: { wheel: () => 'legend', L: () => LV.levelOf(state.stats), can: () => state.legendSpins > 0, left: () => state.legendSpins, go: rng => backend.spinLegend(rng) },
};
// Abrir una ruleta desde la tienda o la lista de niveles
export function openWheelFrom(src) {
  if (!SOURCES[src].can()) { if (src === 'shop') fail?.(new Error('No tienes pesetas suficientes')); return; }
  ui.closeAll(); queueCelebrate({ mode: 'wheel', src });
}
const N = 8, SEG = 360 / N;
let angle = 0;
function wedge(i, r) { const a0 = (i * SEG - 90) * Math.PI / 180, a1 = ((i + 1) * SEG - 90) * Math.PI / 180; return `M0 0 L${(r * Math.cos(a0)).toFixed(2)} ${(r * Math.sin(a0)).toFixed(2)} A${r} ${r} 0 0 1 ${(r * Math.cos(a1)).toFixed(2)} ${(r * Math.sin(a1)).toFixed(2)}Z`; }
function buildWheel(kind, L) {
  const W = LV.WHEELS[kind].segs, leg = kind === 'legend';
  const segs = W.map((s, i) => {
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
  const rim = leg ? '<stop offset="0" stop-color="#fffbe0"/><stop offset=".25" stop-color="#ffd23f"/><stop offset=".5" stop-color="#ff9a1a"/><stop offset=".75" stop-color="#ffe766"/><stop offset="1" stop-color="#8a4a00"/>'
    : '<stop offset="0" stop-color="#fff3a0"/><stop offset=".5" stop-color="#ffb21a"/><stop offset="1" stop-color="#9a5600"/>';
  const gems = leg ? W.map((_, i) => { const a = (i * SEG - 90) * Math.PI / 180; return `<circle cx="${(188 * Math.cos(a)).toFixed(1)}" cy="${(188 * Math.sin(a)).toFixed(1)}" r="7" fill="${['#ff3b6b', '#3fd2ff', '#8dff6a', '#d18bff'][i % 4]}" stroke="#0a0b18" stroke-width="2.5"/>`; }).join('') : '';
  $('#wheel-svg').innerHTML = `<defs><radialGradient id="wShade" cx="0" cy="0" r="180" gradientUnits="userSpaceOnUse"><stop offset=".25" stop-color="#000" stop-opacity=".35"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset=".97" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient>
    <linearGradient id="wRim" x1="0" y1="-1" x2="1" y2="1">${rim}</linearGradient></defs>
    <circle r="198" fill="url(#wRim)" stroke="#0a0b18" stroke-width="5"/>
    ${segs}
    ${W.map((_, i) => `<line x1="0" y1="0" x2="0" y2="-180" transform="rotate(${i * SEG})" stroke="#0a0b18" stroke-width="${leg ? 7 : 4}"/>${leg ? `<line x1="0" y1="-30" x2="0" y2="-178" transform="rotate(${i * SEG})" stroke="#ffd23f" stroke-width="2.5"/>` : ''}`).join('')}
    <circle r="180" fill="none" stroke="#0a0b18" stroke-width="5"/>${gems}`;
}
function buildLights(n) { $('#wheel-lights').innerHTML = Array.from({ length: n }, (_, i) => `<i style="transform:rotate(${i * 360 / n}deg) translateY(calc(var(--wr) * -1))"></i>`).join(''); }
function setAngle(a) { angle = a; $('#wheel').style.transform = `rotate(${a}deg)`; }
const coin = '<svg class="ci"><use href="#ic-coin"/></svg>';
function openWheel(src) {
  if (src === 'level') lastOffer = Date.now();
  const S = SOURCES[src], kind = S.wheel(), L = S.L(), ov = $('#wheel-overlay'), leg = kind === 'legend', price = LV.shopSpinPrice(L);
  ov.classList.toggle('legend', leg); buildWheel(kind, L); buildLights(leg ? 32 : 20); setAngle(angle % 360);
  $('#wheel-title').textContent = src === 'level' ? `${leg ? 'RULETA LEGENDARIA' : 'RULETA'} · NIVEL ${L}` : src === 'shop' ? 'RULETA DE LA SUERTE' : 'RULETA LEGENDARIA';
  const n = S.left();
  $('#wheel-sub').textContent = src === 'shop' ? `Premios de nivel ${L} · ${price} pesetas la tirada` : n > 1 ? `Tienes ${n} tiradas: ¡a por todas!` : leg ? '¡Los mejores premios del juego!' : '¡Gira y llévate un premio!';
  $('#wheel-prize').classList.add('hidden'); $('#wheel-prize').innerHTML = '';
  ov.classList.remove('spinning', 'won'); $$('#wheel-svg .seg').forEach(g => g.classList.remove('win'));
  const btn = $('#wheel-btn'); btn.disabled = false; btn.classList.remove('hidden');
  $('#wheel-btn span').innerHTML = src === 'shop' ? `¡GIRAR! · ${coin}${price}` : '¡GIRAR!';
  ov.classList.add('open'); fxWheel.resize();
  if (leg) { SFX.chestOpen(); fxWheel.rain(40, 'star', ['#ffe766', '#ffffff', '#ffb21a']); }
}
const $$ = s => [...document.querySelectorAll(s)];
function closeWheel() { $('#wheel-overlay').classList.remove('open', 'legend'); fxWheel.clear(); if (waitingSpin) { const w = waitingSpin; waitingSpin = null; w('close'); } }
// Una sesión de ruleta: gira mientras queden tiradas (o pesetas); se puede cerrar cuando quieras
async function wheelSession(src = 'level') {
  const S = SOURCES[src];
  while (S.can()) {
    openWheel(src);
    const act = await new Promise(res => { waitingSpin = res; $('#wheel-btn').onclick = () => res('spin'); $('#wheel-hub').onclick = () => res('spin'); });
    waitingSpin = null;
    if (act === 'close') return;
    const out = await spin(src);
    if (!out) { closeWheel(); return; }
    const next = await showPrize(out, src);
    const chest = out.reward.cards?.length || ['wood', 'diamond', 'premium'].includes(out.reward.kind);
    if (chest && next !== 'close') { closeWheel(); await ui.chestOpening(out.reward.kind, out.reward); ui.hud(); }
    if (next === 'close') { closeWheel(); return; }
  }
  closeWheel(); ui.hud();
}
// Gira: arranca enseguida y, cuando el servidor dice el premio, frena justo en esa casilla
async function spin(src) {
  const ov = $('#wheel-overlay'), btn = $('#wheel-btn'), leg = ov.classList.contains('legend'); btn.disabled = true; spinning = true; ov.classList.add('spinning');
  SFX.spin(); if (leg) SFX.drumroll(1.6); if (navigator.vibrate) try { navigator.vibrate(20); } catch (e) {}
  let result = null, error = null;
  const go = () => SOURCES[src].go(levelTest.rng);
  const req = go().catch(async e => {
    if (src !== 'level' || !reload || !/No tienes tiradas/.test(e.message)) throw e;
    await reload(); if (!pending()) throw new Error('Esta tirada ya estaba girada');
    return go().catch(async e2 => {
      // el servidor y el juego no cuentan igual los niveles: este móvil tiene una versión vieja del juego guardada
      if (!/No tienes tiradas/.test(e2.message)) throw e2;
      // ¿el servidor cuenta otro nivel? entonces las tiradas esperan a que suba allí también
      const sL = await backend.syncWheelCap(); if (sL != null && sL < LV.levelOf(state.stats)) { syncChip(); throw new Error('Tus tiradas llegarán en cuanto el servidor termine de contar tu nivel'); }
      ui.showToast('🔄 Actualizando el juego a la última versión…', 4000);
      const { forceUpdate } = await import('./update.js'); if (await forceUpdate()) await new Promise(() => {});
      throw e2;
    });
  }).then(r => { result = r; }, e => { error = e; });
  const fast = levelTest.fast, MAXV = leg ? 1100 : 900;   // grados por segundo
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
  if (error) {                                            // sin premio (y sin cobrar): frena y avisa
    await decel(angle + 200, fast ? 0.05 : 1.2, tick); spinning = false; ov.classList.remove('spinning'); btn.disabled = false; fail?.(error); return null;
  }
  // 2) frena con suavidad hasta la casilla ganadora (con suspense al final; la legendaria, más vueltas)
  const i = result.seg, within = (0.18 + Math.random() * 0.64) * SEG;
  const target = -(i * SEG + within);                     // ángulo final (módulo 360) para que la flecha quede en esa casilla
  let end = target + 360 * Math.ceil((angle - target) / 360); end += 360 * (fast ? 0 : leg ? 4 : 3);
  await decel(end, fast ? 0.05 : Math.max(leg ? 4.2 : 3.2, 3 * (end - angle) / MAXV), tick);
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
async function showPrize(out, src) {
  const kind = out.wheel || SOURCES[src].wheel(), { seg, reward } = out, s = LV.WHEELS[kind].segs[seg], ov = $('#wheel-overlay'), box = $('#wheel-prize'), leg = kind === 'legend';
  $(`#wheel-svg .seg[data-i="${seg}"]`)?.classList.add('win'); ov.classList.add('won');
  const big = leg || !!s.jackpot || s.kind === 'falcon' || s.chest === 'diamond';
  if (leg) SFX.levelUp(); SFX.prize(big); if (navigator.vibrate) try { navigator.vibrate(big ? [40, 60, 120] : 40); } catch (e) {}
  const w = $('#wheel-wrap').getBoundingClientRect(), o = ov.getBoundingClientRect(), cx = w.left - o.left + w.width / 2, cy = w.top - o.top + w.height / 2;
  fxWheel.resize(); fxWheel.burst(cx, cy, big ? 170 : 90, leg ? { colors: ['#ffe766', '#ffffff', '#ffb21a', '#ff5ad1', '#3fd2ff'] } : {});
  if (reward.pesetas && s.kind === 'pesetas') fxWheel.fountain(cx, cy, s.jackpot ? 70 : leg ? 45 : 26, 'coin');
  if (reward.tomatoes && s.kind === 'tomatoes') fxWheel.fountain(cx, cy, leg ? 40 : 24, 'tomato');
  if (s.jackpot || leg) setTimeout(() => fxWheel.rain(s.jackpot ? 110 : 60, s.jackpot ? 'coin' : 'star', ['#ffe766', '#ffffff', '#ffb21a']), 400);
  box.className = 'wheel-prize' + (big ? ' big' : '') + (leg ? ' legend' : ''); box.style.setProperty('--pc', s.color);
  box.innerHTML = `<span class="tag">${s.jackpot ? '¡¡BOTE!!' : leg ? '¡LEGENDARIO!' : '¡PREMIO!'}</span><svg><use href="#${s.icon}"/></svg><p>${LV.prizeText(s, reward)}</p>`;
  ui.hud(); syncChip();
  const btn = $('#wheel-btn'); await sleep(levelTest.fast ? 10 : 600); btn.disabled = false;
  const S = SOURCES[src], chest = s.kind === 'chest', more = S.can(), n = S.left();
  $('#wheel-btn span').innerHTML = chest ? '¡ABRIR!' : !more ? (src === 'level' ? '¡A JUGAR!' : '¡GENIAL!') : src === 'shop' ? `OTRA · ${coin}${LV.shopSpinPrice(S.L())}` : `¡OTRA TIRADA! (${n})`;
  return new Promise(res => { waitingSpin = res; btn.onclick = () => { waitingSpin = null; SFX.ui(); res(chest || more ? 'next' : 'close'); }; $('#wheel-hub').onclick = null; });
}

// ---------- lista de niveles ----------
function openLevels() { renderLevels(); ui.openPanel('#panel-levels'); setTimeout(() => $('#levels-body .lv.cur')?.scrollIntoView({ block: 'center' }), 60); }
export function renderLevels() {
  const info = LV.levelInfo(state.stats), p = pending(), nl = LV.nextLegendLevel(info.level), ls = state.legendSpins;
  const crown = '<svg><use href="#ic-crown"/></svg>';
  const head = `<div class="lv-head t${info.tier}">
      <span class="lvl-medal xl"><svg><use href="#ic-medal"/></svg><b>${info.level}</b></span>
      <div><small>NIVEL ${info.level} DE ${LV.MAX_LEVEL}</small><h3>${esc(info.name)}</h3>
        <div class="lvl-bar big"><i style="width:${(info.pct * 100).toFixed(1)}%"></i><small>${info.max ? 'NIVEL MÁXIMO' : `${fmt(info.into)} / ${fmt(info.need)} XP`}</small></div></div></div>
    ${p ? `<button class="btn-gold spin-cta" data-spin><span>¡TIENES ${p} TIRADA${p > 1 ? 'S' : ''} DE RULETA!</span></button>` : ''}
    ${ls ? `<button class="btn-gold spin-cta legend" data-legend><span>¡${ls} TIRADA${ls > 1 ? 'S' : ''} LEGENDARIA${ls > 1 ? 'S' : ''}!</span></button>` : ''}
    ${info.level < LV.MAX_LEVEL || !LV.isLegendLevel(info.level) ? `<div class="lv-next-leg">${crown}<span>Próxima <b>ruleta legendaria</b>: nivel ${nl}${nl > info.level ? ` · faltan ${nl - info.level}` : ''}</span></div>` : ''}
    <p class="lv-how"><b>Experiencia:</b> +${LV.XP.thrown} por tomate lanzado · +${LV.XP.hit} por impacto · +${LV.XP.fall} cada vez que Pedro cae al agua. <b>Cada nivel = un giro de ruleta; cada 10, la legendaria.</b></p>`;
  const rows = LV.LEVEL_NAMES.map((n, k) => { const L = k + 1, st = L < info.level ? 'done' : L === info.level ? 'cur' : 'lock', leg = LV.isLegendLevel(L);
    return `<li class="lv ${st} t${LV.tierOf(L)}${leg ? ' leg' : ''}"><span class="lvl-medal"><svg><use href="#ic-medal"/></svg><b>${L}</b></span><span class="nm">${esc(n)}${leg ? `<em class="lv-leg">${crown}RULETA LEGENDARIA</em>` : ''}</span><span class="xp">${st === 'done' ? '✔' : fmt(LV.XP_AT[k]) + ' XP'}</span></li>`; }).join('');
  $('#levels-body').innerHTML = head + `<ol class="lv-list">${rows}</ol>`;
}

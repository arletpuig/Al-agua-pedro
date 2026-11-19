// Logros diarios e invitaciones: el panel «LOGROS» (calendario de 7 días, 3 misiones y el cofre de la jornada) y «Invita y gana».
import { state, onChange } from './state.js';
import { backend } from './backend.js';
import { levelOf } from './levels.js';
import { SFX } from './audio.js';
import * as D from './daily-rules.js';
import { createFx } from './fx.js';

const $ = s => document.querySelector(s);
const fmt = n => (+n || 0).toLocaleString('es-ES');
const INVITE_KEY = 'alaguapedro.invite';
const ICON = { t: 'ic-tomato', f: 'ic-target', c: 'ic-play', h: 'ic-target', p: 'ic-crown', o: 'ic-chest' };
const svg = id => `<svg><use href="#${id}"/></svg>`;
let ui, fail, busy = false, tab = 'day', fxPop = null, lastKey = '', timer = 0;
export const dailyTest = { off: false };

export function initDaily(uiRef, failFn) {
  ui = uiRef; fail = failFn;
  $('#daily-btn').addEventListener('click', () => { SFX.ui(); open(); });
  document.querySelectorAll('#panel-daily [data-dtab]').forEach(b => b.addEventListener('click', () => { SFX.ui(); setTab(b.dataset.dtab); }));
  $('#panel-daily .sheet-body').addEventListener('click', onClick);
  $('#inv-share').addEventListener('click', share);
  $('#inv-copy').addEventListener('click', copy);
  $('#rpop-ok').addEventListener('click', () => { $('#reward-pop').classList.remove('open'); fxPop?.clear?.(); });
  fxPop = createFx($('#reward-pop'));
  onChange(() => { badge(); if ($('#panel-daily').classList.contains('open') && key() !== lastKey) render(); });
  setInterval(tick, 1000); badge();
}
// el enlace de un amigo (alaguapedro.es/?amigo=CODIGO): se guarda hasta que el jugador entra con su cuenta
export function captureInvite() {
  const q = new URLSearchParams(location.search), code = q.get('amigo');
  if (!code) return;
  try { localStorage.setItem(INVITE_KEY, code.trim().toUpperCase().slice(0, 12)); } catch (e) {}
  q.delete('amigo'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
}
// al entrar con la cuenta: invitación pendiente, logros del día y amigos que ya han jugado
export async function afterLogin() {
  let code = null; try { code = localStorage.getItem(INVITE_KEY); } catch (e) {}
  if (code) {
    try { localStorage.removeItem(INVITE_KEY); } catch (e) {}
    try { const r = await backend.redeemInvite(code); ui.hud(); pop('🎁 ¡REGALO POR INVITACIÓN!', `<b>${esc(r.inviter || 'Un amigo')}</b> te ha invitado a AL AGUA PEDRO`, r.reward, 'Este regalo es por unirte con el enlace de un amigo. ¡Invita tú también y gana 700 pesetas por cada uno!'); }
    catch (e) { if (!/cuentas nuevas|Ya has usado|ti mismo|no existe/.test(e.message)) fail?.(e); }
  }
  try { await backend.dailySync(); } catch (e) {}
  await checkInvites(); badge();
}
async function checkInvites() {
  try {
    const r = await backend.claimInvites(); inv = r;
    const n = state.invite.paid - state.invite.seen;
    if (n > 0) { ui.hud(); pop(n > 1 ? `🎉 ¡${n} AMIGOS SE HAN UNIDO!` : '🎉 ¡TU AMIGO SE HA UNIDO!', 'Han jugado sus primeros tomates gracias a tu invitación', { pesetas: 700 * n }, '¡Sigue invitando: 700 pesetas por cada amigo!'); backend.ackInvites().catch(() => {}); }
    if ($('#panel-daily').classList.contains('open')) renderInvite();
  } catch (e) {}
}
let inv = { total: 0, pending: 0 };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ---------- estado de hoy
const today = () => D.todayState(state.daily, state.stats, backend.todayKey());
const missions = d => [0, 1, 2].map(i => { const m = D.missionFor(d.date, i); return { ...m, prog: Math.min(m.goal, D.progress(d, state.stats, m)), done: d.done.includes(String(i)) }; });
const key = () => { const d = today(); return [d.date, d.done.join(), d.bonus, d.login_date, ...missions(d).map(m => m.prog), state.pesetas].join('|'); };
export function claimable() {
  const d = today(), ms = missions(d);
  return (D.loginDay(d, d.date).claimed ? 0 : 1) + ms.filter(m => !m.done && m.prog >= m.goal).length + (ms.every(m => m.done) && !d.bonus ? 1 : 0);
}
function badge() { const n = claimable(), b = $('#daily-count'); if (!b) return; b.textContent = n; b.classList.toggle('hidden', !n); $('#daily-btn').classList.toggle('ready', n > 0); }
// cuenta atrás hasta medianoche (hora de España); al cambiar el día se empieza de cero
function tick() {
  const ms = backend.msToNextDaily(), el = $('#dl-timer');
  if (el) { const h = Math.floor(ms / 3600e3), m = Math.floor(ms / 60e3) % 60, s = Math.floor(ms / 1e3) % 60; el.textContent = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
  if (++timer % 30 === 0 && state.daily?.date && state.daily.date !== backend.todayKey()) backend.dailySync().then(() => { badge(); if ($('#panel-daily').classList.contains('open')) render(); }).catch(() => {});
}

// ---------- panel
function open() { setTab('day'); render(); ui.openPanel('#panel-daily'); backend.dailySync().then(render).catch(() => {}); checkInvites(); }
function setTab(t) {
  tab = t; document.querySelectorAll('#panel-daily [data-dtab]').forEach(b => b.classList.toggle('on', b.dataset.dtab === t));
  $('#dl-day').classList.toggle('hidden', t !== 'day'); $('#dl-inv').classList.toggle('hidden', t !== 'inv');
  if (t === 'inv') renderInvite();
}
const chip = (r = {}) => [r.tomatoes ? `<span class="dl-chip t">${svg('ic-tomato')}+${fmt(r.tomatoes)}</span>` : '', r.pesetas ? `<span class="dl-chip p">${svg('ic-coin')}+${fmt(r.pesetas)}</span>` : '',
  r.chest ? `<span class="dl-chip c">${svg(r.chest === 'diamond' ? 'ic-chest-dia' : 'ic-chest')}COFRE</span>` : ''].join('');
function render() {
  lastKey = key();
  const d = today(), L = D.loginDay(d, d.date), lvl = levelOf(state.stats);
  // calendario de 7 días
  $('#dl-streak').textContent = L.claimed ? `Día ${L.day} de 7 · ¡vuelve mañana!` : `Hoy toca el día ${L.day} de 7`;
  $('#dl-cal').innerHTML = D.LOGIN.map((g, i) => {
    const n = i + 1, st = n < L.day || (n === L.day && L.claimed) ? 'got' : n === L.day ? 'now' : 'next', big = n === 7;
    const ic = g.chest ? (g.chest === 'diamond' ? 'ic-chest-dia' : 'ic-chest') : g.pesetas ? 'ic-coin' : 'ic-tomato';
    return `<button class="dl-day ${st}${big ? ' big' : ''}" ${st === 'now' ? 'data-login="1"' : 'disabled'}><small>DÍA ${n}</small>${svg(ic)}<b>${g.chest ? (big ? 'COFRE ★' : 'COFRE') : '+' + fmt(g.tomatoes || g.pesetas)}</b>${st === 'got' ? '<i class="dl-tick">✔</i>' : ''}${st === 'now' ? '<em>¡RECOGER!</em>' : ''}</button>`;
  }).join('');
  // misiones
  const ms = missions(d);
  $('#dl-missions').innerHTML = ms.map(m => {
    const rw = D.rewardFor(m.slot, lvl), pct = Math.round(m.prog / m.goal * 100), ready = !m.done && m.prog >= m.goal;
    return `<div class="dl-mis s${m.slot}${m.done ? ' done' : ''}${ready ? ' ready' : ''}"><div class="dl-ic">${svg(ICON[m.k])}</div>
      <div class="dl-txt"><span class="dl-lvl">${D.SLOT_NAMES[m.slot]}</span><b>${D.TEXT[m.k](m.goal)}</b>
      <div class="dl-bar"><i style="width:${pct}%"></i><small>${fmt(m.prog)} / ${fmt(m.goal)}</small></div><div class="dl-rw">${chip(rw)}</div></div>
      ${m.done ? '<span class="dl-ok">✔</span>' : `<button class="dl-claim" data-mission="${m.slot}" ${ready ? '' : 'disabled'}>${ready ? '¡RECOGER!' : `${pct}%`}</button>`}</div>`;
  }).join('');
  // cofre de la jornada
  const n = ms.filter(m => m.done).length, bonusReady = n === 3 && !d.bonus;
  $('#dl-bonus').className = 'dl-bonus' + (bonusReady ? ' ready' : '') + (d.bonus ? ' got' : '');
  $('#dl-bonus').innerHTML = `<div class="dl-chest">${svg('ic-chest-dia')}</div><div class="dl-txt"><b>COFRE DE LA JORNADA</b><span>${d.bonus ? '¡Recogido! Mañana, otro' : 'Completa las 3 misiones de hoy'}</span>
    <div class="dl-dots">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div></div>${bonusReady ? '<button class="dl-claim gold" data-bonus="1">¡ABRIR!</button>' : d.bonus ? '<span class="dl-ok">✔</span>' : `<span class="dl-cnt">${n}/3</span>`}`;
}
async function onClick(e) {
  const b = e.target.closest('button'); if (!b || b.disabled || busy) return;
  const run = async fn => { busy = true; b.disabled = true; try { await fn(); } catch (err) { fail?.(err); } busy = false; render(); badge(); };
  if (b.dataset.login) return run(async () => { const r = await backend.claimLoginDay(); await reward(r, `¡Día ${r.day} de 7!`); });
  if (b.dataset.mission) return run(async () => { const r = await backend.claimMission(+b.dataset.mission); await reward(r, '¡Misión cumplida!'); });
  if (b.dataset.bonus) return run(async () => { const r = await backend.claimDailyBonus(); await reward({ ...r, chest: 'diamond' }, '¡Cofre de la jornada!'); });
}
async function reward(r, title) {
  if (r.chest || r.cards?.length) { ui.closeAll(); await ui.chestOpening(r.chest || 'diamond', r); ui.hud(); setTimeout(() => ui.openPanel('#panel-daily'), 200); return; }
  SFX.prize?.(false); ui.showToast(`🏆 ${title}`, 2000);
  if (r.pesetas) ui.pesetaGain(r.pesetas); if (r.tomatoes) ui.tomatoGain(r.tomatoes); ui.hud();
}

// ---------- invitaciones
const link = c => `https://alaguapedro.es/?amigo=${c}`;
async function renderInvite() {
  $('#inv-total').textContent = fmt(inv.total || 0); $('#inv-pending').textContent = fmt(inv.pending || 0); $('#inv-earned').textContent = fmt(700 * (state.invite.paid || 0));
  if (!backend.cloud) { $('#inv-code').textContent = '— — —'; $('#inv-note').textContent = 'Entra con tu cuenta para invitar a tus amigos.'; return; }
  try { const c = await backend.inviteCode(); $('#inv-code').textContent = c; $('#inv-link').textContent = link(c).replace('https://', ''); $('#inv-note').textContent = ''; }
  catch (e) { $('#inv-note').textContent = 'No se ha podido crear tu código. Inténtalo más tarde.'; }
}
const shareText = c => `¡Juega conmigo a AL AGUA PEDRO! 🍅 Lánzale tomates a Pedro y tíralo a la pecera de las pirañas. Con mi enlace te llevas 300 pesetas y 150 tomates de regalo: ${link(c)}`;
async function share() {
  SFX.ui();
  try {
    const c = await backend.inviteCode();
    if (navigator.share) { await navigator.share({ title: 'AL AGUA PEDRO', text: shareText(c) }); return; }
    window.open('https://wa.me/?text=' + encodeURIComponent(shareText(c)), '_blank');
  } catch (e) { if (e?.name !== 'AbortError') fail?.(e); }
}
async function copy() {
  try { const c = await backend.inviteCode(); await navigator.clipboard.writeText(link(c)); ui.showToast('🔗 Enlace copiado: pégalo donde quieras', 2200); }
  catch (e) { fail?.(e); }
}

// ---------- ventana de regalo (invitaciones)
function pop(title, sub, r, foot) {
  $('#rpop-title').textContent = title; $('#rpop-sub').innerHTML = sub; $('#rpop-foot').textContent = foot || '';
  $('#rpop-list').innerHTML = chip(r).replace(/dl-chip/g, 'rpop-chip');
  const ov = $('#reward-pop'); ov.classList.add('open'); SFX.levelUp?.();
  const rc = ov.getBoundingClientRect(); fxPop?.resize?.(); fxPop?.burst?.(rc.width / 2, rc.height * 0.4, 120); setTimeout(() => fxPop?.rain?.(24, 'coin'), 250);
}

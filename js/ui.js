// Interfaz HTML: HUD, paneles (tienda, cofres, cartas, ranking, estadísticas, cuenta) y animaciones de recompensa.
import { CONFIG } from './config.js';
import { state, setTutorialSeen, setSound, falconActive } from './state.js';
import { SFX, setEnabled, setMusic, unlock } from './audio.js';
import * as E from './economy.js';
import { CARD_ART, chestSvg } from './cards-art.js';
import { backend } from './backend.js';
import { adProvider, PLACEMENTS } from './ads.js';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const fmt = n => n.toLocaleString('es-ES');
let H = {}, busy = false, toastTimer = null, tutorialCb = null;

export function init(handlers) {
  H = handlers;
  $$('[data-close]').forEach(b => b.addEventListener('click', () => closePanel(b.closest('.panel'))));
  $$('.panel').forEach(m => m.addEventListener('click', e => { if (e.target === m && m.id !== 'panel-tutorial') closePanel(m); }));
  $$('.tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
  $$('.nav button').forEach(b => b.addEventListener('click', () => openPanel('#panel-' + b.dataset.panel)));
  $$('[data-goto]').forEach(b => b.addEventListener('click', () => { closePanel(b.closest('.panel')); openPanel('#panel-' + b.dataset.goto); }));
  $('#btn-stats').addEventListener('click', () => { renderStats(); openPanel('#panel-stats'); });
  $('#btn-sound').addEventListener('click', () => { unlock(); const m = !state.sound ? [true, false] : !state.music ? [true, true] : [false, false]; setSoundUI(m[0], m[1]); showToast(m[1] ? '🎵 Efectos y música' : m[0] ? '🔊 Solo efectos' : '🔇 Sin sonido', 1200); });
  $('#pill-pesetas').addEventListener('click', () => openPanel('#panel-chests'));
  $('#btn-falcon').addEventListener('click', () => H.onAd(PLACEMENTS.FALCON));
  $('#btn-sobre').addEventListener('click', () => H.onAd(PLACEMENTS.SOBRE));
  $$('.btn-throw').forEach(b => b.addEventListener('click', () => H.onThrow(+b.dataset.n)));
  $('#btn-stop').addEventListener('click', () => H.onStop());
  $('#chests-body').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.buy) H.onBuyChest(b.dataset.buy); else if ('daily' in b.dataset) H.onClaimDaily(); else if ('probs' in b.dataset) { b.closest('.chest-card').querySelector('.probs').classList.toggle('open'); }
  });
  $('#cards-grid').addEventListener('click', e => { const b = e.target.closest('button[data-upgrade]'); if (b) H.onUpgrade(b.dataset.upgrade); });
}
// ---------- HUD ----------
export function hud(pop = false) {
  const s = state.stats, cpt = E.clicksPerTap(state.cards, falconActive());
  $('#clicks-num').textContent = fmt(s.totalClicks);
  if (pop) popEl($('#clicks-num'));
  $('#btn-click').style.setProperty('--p', state.clicks / CONFIG.CLICKS_PER_TOMATO * 100);
  $('#bar-text').textContent = `${state.clicks} de ${CONFIG.CLICKS_PER_TOMATO}`;
  setNum('#tomato-num', state.tomatoes); setNum('#pesetas-num', state.pesetas, '#pill-pesetas');
  $('#hist-num').textContent = fmt(s.tomatoesEarned);
  $('#cpt-badge').textContent = `+${cpt}`;
  $('#btn-click').classList.toggle('falcon', falconActive());
  $$('.btn-throw').forEach(b => { b.disabled = busy || state.tomatoes < +b.dataset.n; });
  const fb = $('#falcon-badge'); fb.classList.toggle('hidden', !falconActive());
  if (falconActive()) { const ms = state.falconUntil - Date.now(), m = Math.floor(ms / 60000), sec = Math.floor(ms % 60000 / 1000); $('#falcon-time').textContent = `${m}:${String(sec).padStart(2, '0')}`; }
  $('#chest-dot').classList.toggle('hidden', !backend.dailyAvailable());
}
function setNum(sel, v, popSel) { const el = $(sel); if (el.textContent !== fmt(v)) { el.textContent = fmt(v); popEl(popSel ? $(popSel) : el); } }
function popEl(el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
export function setBusy(b) { busy = b; hud(); }
export function showStop(v) { $('#btn-stop').classList.toggle('hidden', !v); $('#throw-row').classList.toggle('hidden', v); if (!v) $('#volley-badge').classList.add('hidden'); }
export function volleyProgress(i, n) { $('#volley-badge').classList.toggle('hidden', !n); if (n) { $('#volley-i').textContent = i; $('#volley-n').textContent = n; } }
export function floater(text, x, y) {
  const r = $('#btn-click').getBoundingClientRect(), el = document.createElement('div'); el.className = 'floater'; el.textContent = text;
  el.style.left = ((x ?? r.left + r.width / 2) + (Math.random() - .5) * 40) + 'px'; el.style.top = ((y ?? r.top + 20) - 24) + 'px';
  document.body.appendChild(el); setTimeout(() => el.remove(), 800);
}
export function flyTomato(n = 1) {
  const a = $('#btn-click').getBoundingClientRect(), b = $('.ico-tomato').getBoundingClientRect();
  for (let i = 0; i < Math.min(n, 5); i++) {
    const el = document.createElement('div'); el.className = 'flying'; el.innerHTML = '<svg viewBox="0 0 44 48" width="34" height="37"><use href="#svg-tomato" width="44" height="48"/></svg>';
    el.style.left = (a.left + a.width / 2 - 17 + i * 8) + 'px'; el.style.top = (a.top + 10) + 'px'; document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.transform = `translate(${b.left + b.width / 2 - 17 - (a.left + a.width / 2 - 17 + i * 8)}px,${b.top + b.height / 2 - 17 - (a.top + 10)}px) rotate(540deg) scale(.8)`; });
    setTimeout(() => { el.remove(); if (!i) { const bk = $('#basket'); bk.classList.remove('bounce'); void bk.offsetWidth; bk.classList.add('bounce'); hud(); } }, 700);
  }
}
// ---------- paneles ----------
export function openPanel(id) {
  const p = $(id); if (!p) return;
  if (id === '#panel-shop') renderShop(); if (id === '#panel-chests') renderChests(); if (id === '#panel-cards') renderCards(); if (id === '#panel-rank') H.onRank?.();
  p.classList.add('open'); SFX.ui();
}
export function closePanel(el) { el.classList.remove('open'); if (el.id === 'panel-tutorial' && tutorialCb) { const cb = tutorialCb; tutorialCb = null; setTutorialSeen(); cb(); } }
export function closeAll() { $$('.panel.open').forEach(p => p.classList.remove('open')); }
export function showTutorial(cb) { tutorialCb = cb || null; openPanel('#panel-tutorial'); }
export function showToast(msg, ms = 2400, err = false) { const t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (err ? ' err' : ''); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms); }

const rarTag = r => `<span class="rar" style="background:${E.RARITIES[r].color}">${E.RARITIES[r].name}</span>`;
export function renderShop() {
  const avail = adProvider.isAvailable(PLACEMENTS.FALCON);
  $('#btn-falcon').disabled = !avail || falconActive(); $('#btn-sobre').disabled = !adProvider.isAvailable(PLACEMENTS.SOBRE);
  $('#btn-falcon').textContent = avail ? '📺 Ver vídeo' : '⏳ Próximamente'; $('#btn-sobre').textContent = avail ? '📺 Ver vídeo' : '⏳ Próximamente';
  const fs = $('#falcon-state');
  if (falconActive()) { fs.className = 'shop-state on'; fs.textContent = '✈️ ACTIVO · ' + $('#falcon-time').textContent + ' restantes'; }
  else { fs.className = 'shop-state'; fs.textContent = 'Inactivo'; }
}
export function renderChests() {
  const daily = backend.dailyAvailable(), ms = backend.msToNextDaily(), h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000);
  const probs = kind => { const p = E.rarityPercents(kind, state.cards), d = E.CHESTS[kind]; return `<div class="probs"><table>
    ${Object.keys(p).map(r => `<tr><td>${rarTag(r)} ${E.CARD_IDS.filter(id => E.CARDS[id].rarity === r).map(id => E.CARDS[id].name).join(' / ')}</td><td>${p[r].toFixed(1)}%</td></tr>`).join('')}
    <tr><td>Cartas por cofre</td><td>${d.cards}${E.level(state.cards, 'amnistia') ? ` (+1 con ${Math.round(E.CARDS.amnistia.value(E.level(state.cards, 'amnistia')) * 100)}%)` : ''}</td></tr>
    <tr><td>Tomates</td><td>${d.tomatoes[0]}–${d.tomatoes[1]}</td></tr>
    <tr><td>Pesetas extra</td><td>${Math.round(d.pesetaChance * 100)}% de ${d.pesetas[0]}–${d.pesetas[1]} ₧</td></tr></table></div>`; };
  $('#chests-body').innerHTML = `
    <div class="chest-card wood"><div class="chest-head">${chestSvg('wood')}<div><h3>Cofre de madera</h3><p>Uno gratis cada día. Una carta, tomates y a veces alguna peseta.</p></div></div>
      <div class="chest-actions">
        <button class="btn gold" data-daily ${daily ? '' : 'disabled'}>${daily ? '🎁 Reclamar gratis' : `⏰ Gratis en ${h}h ${String(m).padStart(2, '0')}m`}</button>
        <button class="btn primary" data-buy="wood" ${state.pesetas < E.CHESTS.wood.price ? 'disabled' : ''}>Comprar · ${E.CHESTS.wood.price} ₧</button>
      </div>
      <button class="btn link" data-probs>Ver probabilidades</button>${probs('wood')}</div>
    <div class="chest-card diamond"><div class="chest-head">${chestSvg('diamond')}<div><h3>Cofre de diamante</h3><p>Tres cartas, muchos tomates y más posibilidades de cartas raras.</p></div></div>
      <div class="chest-actions"><button class="btn primary single" data-buy="diamond" ${state.pesetas < E.CHESTS.diamond.price ? 'disabled' : ''}>Comprar · ${E.CHESTS.diamond.price} ₧</button></div>
      <button class="btn link" data-probs>Ver probabilidades</button>${probs('diamond')}</div>
    <p class="muted small">Tienes <b>${fmt(state.pesetas)} ₧</b>. Las pesetas se consiguen tirando a Pedro al agua. El cofre diario se reinicia a las 00:00 (hora peninsular).</p>`;
}
export function renderCards(upgradedId) {
  $('#cards-grid').innerHTML = E.CARD_IDS.map(id => {
    const c = E.CARDS[id], r = E.RARITIES[c.rarity], L = E.level(state.cards, id), owned = L > 0, max = L >= c.max;
    const need = owned && !max ? E.fragsNeeded(id, L) : 0, have = E.frags(state.cards, id), cost = owned && !max ? E.upgradeCost(id, L, state.cards) : 0;
    const base = owned && !max ? Math.round(r.baseCost * Math.pow(r.growth, L - 1)) : 0, can = owned && !max && have >= need && state.pesetas >= cost;
    return `<div class="card ${owned ? '' : 'locked'} ${upgradedId === id ? 'upgraded' : ''}" style="--rc:${r.color}">
      <div class="card-top"><div class="card-art">${CARD_ART[id]}</div><div><h3>${c.name}</h3><div class="lvl">${rarTag(c.rarity)} · ${owned ? `Nivel ${L}/${c.max}` : 'No conseguida'}</div></div></div>
      <p>${c.desc}</p>
      ${owned ? `<div class="eff">Ahora: ${c.effect(L)}${max ? '<span>Nivel máximo</span>' : `<span>Siguiente: ${c.effect(L + 1)}</span>`}</div>
        ${max ? '' : `<div class="frag">Fragmentos ${Math.min(have, need)}/${need}<div class="bar"><div class="bar-fill" style="width:${Math.min(100, have / need * 100)}%"></div></div></div>
        <button class="btn ${can ? 'primary' : ''}" data-upgrade="${id}" ${can ? '' : 'disabled'}>Mejorar · <span class="price">${base !== cost ? `<del>${base}</del>` : ''}${cost} ₧</span></button>`}`
      : `<div class="eff">Consíguela en los cofres<span>Nivel 1: ${c.effect(1)}</span></div>`}
    </div>`;
  }).join('');
}
export function renderRank(rows, err, myName) {
  const list = $('#rank-list');
  if (err) { list.innerHTML = `<li class="muted">${err}</li>`; return; }
  list.innerHTML = rows.length ? rows.map(r => `<li class="${r.username === myName ? 'me' : ''}"><span>${esc(r.username || 'Anónimo')}</span><span><b>${fmt(r.tomatoes_earned)}</b> 🍅 · ${r.falls} caídas</span></li>`).join('') : '<li class="muted">Todavía no hay nadie. ¡Sé el primero!</li>';
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function renderStats() {
  const s = state.stats, rows = [['Tomates conseguidos (total histórico)', s.tomatoesEarned], ['Tomates disponibles', state.tomatoes], ['Clics totales', s.totalClicks], ['Lanzamientos', s.tomatoesThrown], ['Impactos perfectos', s.perfects], ['Impactos válidos', s.hits], ['Derribos (caídas al agua)', s.falls], ['Pesetas acumuladas', s.pesetasEarned + s.chestPesetas], ['Pesetas disponibles', state.pesetas], ['Cofres abiertos', s.chestsOpened], ['Cartas desbloqueadas', E.CARD_IDS.filter(id => E.level(state.cards, id) > 0).length + ' / 5']];
  $('#stats-list').innerHTML = rows.map(([k, v]) => `<li><span>${k}</span><b>${fmt(v)}</b></li>`).join('') + E.CARD_IDS.map(id => `<li class="sub"><span>${E.CARDS[id].name}</span><span>Nivel ${E.level(state.cards, id)}</span></li>`).join('');
}
// ---------- apertura de cofre ----------
export function chestOpening(kind, reward) {
  return new Promise(res => {
    const ov = $('#chest-overlay'), art = $('#chest-art'), rw = $('#chest-rewards'), btn = $('#chest-btn');
    $('#chest-title').textContent = E.CHESTS[kind].name; art.innerHTML = chestSvg(kind); art.className = 'chest-art'; rw.innerHTML = ''; btn.textContent = '¡ABRIR!'; btn.disabled = false;
    ov.classList.add('open'); SFX.ui();
    btn.onclick = () => {
      btn.disabled = true; art.classList.add('shake'); SFX.chestOpen();
      setTimeout(() => {
        art.classList.add('opened');
        const items = [...reward.cards.map(c => ({ kind: 'card', ...c })), { kind: 'tomatoes', n: reward.tomatoes }, ...(reward.pesetas ? [{ kind: 'pesetas', n: reward.pesetas }] : [])];
        items.forEach((it, i) => setTimeout(() => {
          const d = document.createElement('div');
          if (it.kind === 'card') { const c = E.CARDS[it.id], r = E.RARITIES[c.rarity]; d.className = 'reward' + (it.isNew ? ' new' : ''); d.style.setProperty('--rc', r.color); d.innerHTML = `<span class="tag">${it.isNew ? '¡NUEVA!' : it.bonus ? 'extra · fragmento' : 'fragmento'}</span>${CARD_ART[it.id]}<div>${c.name}</div>`; SFX.reward(['common', 'rare', 'epic', 'legendary'].indexOf(c.rarity)); }
          else if (it.kind === 'tomatoes') { d.className = 'reward'; d.style.setProperty('--rc', '#e63946'); d.innerHTML = `<span class="tag">tomates</span><div class="big">🍅</div><div>+${it.n}</div>`; SFX.tomato(); }
          else { d.className = 'reward'; d.style.setProperty('--rc', '#b8860b'); d.innerHTML = `<span class="tag">pesetas</span><div class="big">₧</div><div>+${it.n}</div>`; SFX.coin(); }
          rw.appendChild(d);
        }, 500 + i * 380));
        setTimeout(() => { btn.textContent = 'Recoger'; btn.disabled = false; btn.onclick = () => { ov.classList.remove('open'); hud(); res(); }; }, 500 + items.length * 380);
      }, 600);
    };
  });
}
export function volleySummary(results, pesetas) {
  const n = results.length, c = k => results.filter(r => r.kind === k).length, falls = results.filter(r => r.fall).length;
  const el = $('#summary'); el.innerHTML = `<h3>Lanzamiento ×${n}</h3><div class="row"><span>🎯 Perfectos</span><b>${c('perfect')}</b></div><div class="row"><span>😅 Cercanos</span><b>${c('near')}</b></div><div class="row"><span>❌ Fallos</span><b>${c('miss')}</b></div><div class="row"><span>💦 Caídas</span><b>${falls}</b></div><div class="pes">+${pesetas} ₧</div>`;
  el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 2600);
}
export function setSoundUI(on, music = state.music) { music = on && music; $('#btn-sound use').setAttribute('href', !on ? '#i-sound-off' : music ? '#i-music' : '#i-sound'); $('#btn-sound').dataset.mode = !on ? 'off' : music ? 'music' : 'sfx'; setEnabled(on); setMusic(music); setSound(on, music); }
export function setAccountUI(user, username) {
  const logged = !!user; $('#acc-logged').classList.toggle('hidden', !logged); $('#acc-forms').classList.toggle('hidden', logged); $('#btn-account').classList.toggle('logged', logged);
  if (logged) $('#acc-name').textContent = username || user.email;
}
export function accMsg(msg, type = '') { const el = $('#acc-msg'); el.textContent = msg; el.className = 'acc-msg ' + type; }
export function showTab(name) { $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name)); $$('.tabpane').forEach(p => p.classList.toggle('active', p.id === 'form-' + name)); accMsg(''); }
export function saveStatus(msg) { $('#save-status').textContent = msg; }
export function loadingOff() { $('#loading').classList.add('off'); }

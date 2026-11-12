// Interfaz HTML: marcador, pulsador, lanzamiento, navegación, paneles y animaciones de recompensa.
import { CONFIG } from './config.js';
import { state, setTutorialSeen, setSound, falconActive } from './state.js';
import { SFX, setEnabled, setMusic, unlock } from './audio.js';
import * as E from './economy.js';
import { CARD_ART } from './cards-art.js';
import { backend } from './backend.js';
import { adProvider, PLACEMENTS } from './ads.js';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const fmt = n => n.toLocaleString('es-ES');
const icon = (id, cls = '') => `<svg class="${cls}"><use href="#${id}"/></svg>`;
let H = {}, busy = false, aiming = false, toastTimer = null, tutorialCb = null;

export function init(handlers) {
  H = handlers;
  $$('[data-close]').forEach(b => b.addEventListener('click', () => closePanel(b.closest('.panel'))));
  $$('.panel').forEach(m => m.addEventListener('click', e => { if (e.target === m && m.id !== 'panel-tutorial') closePanel(m); }));
  $$('.tab-s').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
  $$('#tabs .tab').forEach(b => b.addEventListener('click', () => { unlock(); if (b.dataset.panel === 'play') { closeAll(); SFX.ui(); } else { closeAll(); openPanel('#panel-' + b.dataset.panel); } }));
  $$('[data-goto]').forEach(b => b.addEventListener('click', () => { closePanel(b.closest('.panel')); openPanel('#panel-' + b.dataset.goto); }));
  $('#btn-settings').addEventListener('click', () => { unlock(); openPanel('#panel-settings'); });
  $('#btn-sound').addEventListener('click', () => { unlock(); setSoundUI(!state.sound, state.music); SFX.ui(); });
  $('#btn-music').addEventListener('click', () => { unlock(); setSoundUI(state.music ? state.sound : true, !state.music); });
  $('#btn-stats').addEventListener('click', () => { renderStats(); closePanel($('#panel-settings')); openPanel('#panel-stats'); });
  $('#btn-help').addEventListener('click', () => { closePanel($('#panel-settings')); showTutorial(null); });
  $('#pill-pesetas').addEventListener('click', () => openPanel('#panel-shop'));
  $$('#throws button').forEach(b => b.addEventListener('click', () => { unlock(); H.onThrow(+b.dataset.n); }));
  $('#btn-daily').addEventListener('click', () => { unlock(); backend.dailyAvailable() ? H.onClaimDaily() : openPanel('#panel-shop'); });
  $('#shop-body').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.buy) H.onBuyChest(b.dataset.buy); else if ('daily' in b.dataset) H.onClaimDaily(); else if (b.dataset.ad) H.onAd(b.dataset.ad);
    else if ('probs' in b.dataset) b.parentElement.querySelector('.probs').classList.toggle('open');
  });
  $('#cards-grid').addEventListener('click', e => {
    const b = e.target.closest('button[data-upgrade]'); if (b) { H.onUpgrade(b.dataset.upgrade); return; }
    const card = e.target.closest('.card[data-id]'); if (card && isNewCard(card.dataset.id)) { seenCard(card.dataset.id); renderCards(); hud(); }
  });
}

// ---------- marcador ----------
export function hud(pop = false) {
  const cpt = E.clicksPerTap(state.cards, falconActive());
  $('#prog-fill').style.width = (state.clicks / CONFIG.CLICKS_PER_TOMATO * 100) + '%';
  $('#bar-text').textContent = state.clicks; $('#bar-max').textContent = CONFIG.CLICKS_PER_TOMATO;
  setNum('#tomato-num', state.tomatoes, '#basket'); setNum('#pesetas-num', state.pesetas, '#pill-pesetas');
  $('#btn-click').classList.toggle('falcon', falconActive());
  const none = state.tomatoes < 1;
  $$('#throws button').forEach(b => { b.disabled = busy || state.tomatoes < +b.dataset.n; });
  $('#throws').classList.toggle('hidden', aiming || none);
  $('#throw-empty').classList.toggle('hidden', aiming || !none || busy);
  $('#btn-click').classList.toggle('aim', aiming);
  $('#mega-lbl').textContent = aiming ? '¡LANZA!' : '¡DALE!';
  $('#mega-sub').innerHTML = aiming ? 'cuando esté en el <b>centro</b>' : `<i id="cpt-badge">+${cpt * comboX}</i> por toque`;
  const fb = $('#falcon-badge'); fb.classList.toggle('hidden', !falconActive());
  if (falconActive()) { const ms = state.falconUntil - Date.now(), m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000); $('#falcon-time').textContent = `${m}:${String(s).padStart(2, '0')}`; }
  const daily = backend.dailyAvailable();
  $('#chest-dot').classList.toggle('hidden', !daily);
  $('#cards-dot').classList.toggle('hidden', !newCards().length);
  $('#btn-daily').classList.toggle('off', !daily);
  if (daily) $('#daily-rib').textContent = 'GRATIS';
  else { const ms = backend.msToNextDaily(), h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000); $('#daily-rib').textContent = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
  void pop;
}
function setNum(sel2, v, bumpSel) { const el = $(sel2); if (el.textContent !== fmt(v)) { el.textContent = fmt(v); const b = $(bumpSel); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } }
export function setBusy(b) { busy = b; $('#btn-click').disabled = false; hud(); }
export function showStop(v) { aiming = v; hud(); }
export function volleyProgress() {}
// racha de pulsaciones: insignia ×2/×3 y color del botón
let comboX = 1;
export function combo(mult, heat, next) {
  const el = $('#combo'), b = $('#btn-click');
  if (mult !== comboX) { comboX = mult; hud(); }
  el.classList.toggle('hidden', mult < 2 || aiming); el.classList.toggle('c3', mult >= 3);
  $('#combo-x').textContent = '×' + mult;
  $('#heat-fill').style.width = Math.min(100, heat / next * 100) + '%';
  b.classList.toggle('c2', mult === 2 && !aiming); b.classList.toggle('c3', mult >= 3 && !aiming);
}
export function comboUp() { const el = $('#combo'); el.classList.remove('up'); void el.offsetWidth; el.classList.add('up'); }
export function floater(text, x, y) {
  const r = $('#btn-click').getBoundingClientRect(), el = document.createElement('div'); el.className = 'floater'; el.textContent = text;
  el.style.left = ((x ?? r.left + r.width / 2) - 18 + (Math.random() - .5) * 40) + 'px'; el.style.top = ((y ?? r.top + 10) - 34) + 'px';
  document.body.appendChild(el); setTimeout(() => el.remove(), 800);
}
export function flyTomato(n = 1) {
  const a = $('#btn-click').getBoundingClientRect(), b = $('#basket .ri').getBoundingClientRect();
  for (let i = 0; i < Math.min(n, 5); i++) {
    const el = document.createElement('div'); el.className = 'flying'; el.innerHTML = '<svg viewBox="0 0 64 64" width="40" height="40"><use href="#ic-tomato"/></svg>';
    const sx = a.left + a.width / 2 - 20 + i * 8, sy = a.top + 10;
    el.style.left = sx + 'px'; el.style.top = sy + 'px'; document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = `translate(${b.left + b.width / 2 - 20 - sx}px,${b.top + b.height / 2 - 20 - sy}px) rotate(540deg) scale(.9)`; }));
    setTimeout(() => { el.remove(); if (!i) hud(); }, 720);
  }
}

// ---------- paneles ----------
export function openPanel(id) {
  if (id === '#panel-chests') id = '#panel-shop';
  const p = $(id); if (!p) return;
  if (id === '#panel-shop') renderShop(); if (id === '#panel-cards') renderCards(); if (id === '#panel-rank') H.onRank?.(); if (id === '#panel-settings') setSoundUI(state.sound, state.music, false);
  p.classList.add('open'); SFX.ui();
}
export function closePanel(el) { if (!el) return; el.classList.remove('open'); if (el.id === 'panel-tutorial') { setTutorialSeen(); if (tutorialCb) { const cb = tutorialCb; tutorialCb = null; cb(); } } }
export function closeAll() { $$('.panel.open').forEach(p => p.classList.remove('open')); }
export function showTutorial(cb) { tutorialCb = cb || null; openPanel('#panel-tutorial'); }
export function showToast(msg, ms = 2400, err = false) { const t = $('#toast'); t.textContent = msg; t.className = 'toast on' + (err ? ' err' : ''); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), ms); }

const rarTag = r => `<span class="rar" style="background:${E.RARITIES[r].color}">${E.RARITIES[r].name}</span>`;
// cartas nuevas sin ver (puntito en la pestaña y en la carta)
const NEW_KEY = 'alaguapedro.newcards';
function newCards() { try { return JSON.parse(localStorage.getItem(NEW_KEY)) || []; } catch (e) { return []; } }
function setNewCards(a) { try { localStorage.setItem(NEW_KEY, JSON.stringify(a)); } catch (e) {} }
const isNewCard = id => newCards().includes(id);
function seenCard(id) { setNewCards(newCards().filter(x => x !== id)); }
export function markNewCards(ids) { if (ids.length) setNewCards([...new Set([...newCards(), ...ids])]); hud(); }

// ---------- tienda: cofre diario, cofres y ofertas ----------
export function renderShop() {
  const daily = backend.dailyAvailable(), ms = backend.msToNextDaily(), h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000);
  const probs = kind => { const p = E.rarityPercents(kind, state.cards), d = E.CHESTS[kind]; return `<div class="probs">
    ${Object.keys(p).map(r => `<div><span><i class="gem" style="background:${E.RARITIES[r].color}"></i>${E.RARITIES[r].name}</span><b>${p[r].toFixed(1)}%</b></div>`).join('')}
    <div><span>Pesetas extra</span><b>${Math.round(d.pesetaChance * 100)}% · ${d.pesetas[0]}–${d.pesetas[1]}</b></div></div>`; };
  const gems = kind => { const p = E.rarityPercents(kind, state.cards); return `<div class="gems">${Object.keys(p).map(r => `<i class="gem" style="background:${E.RARITIES[r].color};opacity:${0.35 + Math.min(1, p[r] / 30) * 0.65}" title="${E.RARITIES[r].name}"></i>`).join('')}</div>`; };
  const card = (kind, ribbon) => { const d = E.CHESTS[kind], ok = state.pesetas >= d.price; return `<div class="chest-card ${kind}">
      <i class="ribbon">${ribbon}</i>${kind === 'diamond' ? '<i class="sparkle s1"></i><i class="sparkle s2"></i><i class="sparkle s3"></i>' : ''}
      <h3>${d.name.replace(' de ', ' de<br>')}</h3>${icon(kind === 'diamond' ? 'ic-chest-dia' : 'ic-chest', 'c')}
      ${gems(kind)}
      <ul><li>${icon('ic-cards')}<b>${d.cards}</b> carta${d.cards > 1 ? 's' : ''}</li><li>${icon('ic-tomato')}<b>${d.tomatoes[0]}–${d.tomatoes[1]}</b> tomates</li><li>${icon('ic-coin')}<b>${Math.round(d.pesetaChance * 100)}%</b> pesetas extra</li></ul>
      <button class="price" data-buy="${kind}" ${ok ? '' : 'disabled'}>${icon('ic-coin')}<b>${d.price}</b></button>
      <button class="probs-btn" data-probs>Probabilidades</button>${probs(kind)}</div>`; };
  const adOk = p => adProvider.isAvailable(p), fal = falconActive();
  $('#shop-body').innerHTML = `
    <div class="free ${daily ? '' : 'off'}"><i class="rays"></i><span class="tag">COFRE DIARIO</span><span class="sub">${daily ? '¡Gratis! Uno cada día' : `Vuelve en ${h} h ${String(m).padStart(2, '0')} min`}</span>
      ${icon('ic-chest', 'big')}<button class="btn-g" data-daily ${daily ? '' : 'disabled'}>${daily ? 'ABRIR GRATIS' : 'MAÑANA'}</button></div>
    <h4 class="sec"><span>COFRES</span></h4>
    <div class="grid2">${card('wood', 'POPULAR')}${card('diamond', 'MEJOR VALOR')}</div>
    <h4 class="sec"><span>OFERTAS ESPECIALES</span></h4>
    <div class="offer falcon"><i class="ribbon">GRATIS</i><div class="offer-art"><svg><use href="#ic-plane"/></svg></div>
      <div class="offer-info"><h3>El Falcón</h3><p>Cada pulsación vale <b>×5</b> durante <b>10 minutos</b>.</p><div id="falcon-state" class="offer-state ${fal ? 'on' : ''}">${fal ? 'ACTIVO · ' + $('#falcon-time').textContent : 'Con un vídeo'}</div></div>
      <button id="btn-falcon" class="btn-g sm" data-ad="${PLACEMENTS.FALCON}" ${adOk(PLACEMENTS.FALCON) && !fal ? '' : 'disabled'}>${adOk(PLACEMENTS.FALCON) ? 'VER VÍDEO' : 'PRONTO'}</button></div>
    <div class="offer sobre"><i class="ribbon">GRATIS</i><div class="offer-art"><svg><use href="#ic-envelope"/></svg></div>
      <div class="offer-info"><h3>Sobre de la Moncloa</h3><p><b>5 pesetas</b> por ver un vídeo. Nadie preguntará de dónde salen.</p><div class="offer-state">Con un vídeo</div></div>
      <button id="btn-sobre" class="btn-g sm" data-ad="${PLACEMENTS.SOBRE}" ${adOk(PLACEMENTS.SOBRE) ? '' : 'disabled'}>${adOk(PLACEMENTS.SOBRE) ? 'VER VÍDEO' : 'PRONTO'}</button></div>
    <div class="wallet">${icon('ic-coin')}<div><b>${fmt(state.pesetas)}</b> pesetas<small>Gana más tirando a Pedro al agua</small></div></div>`;
}
export const renderChests = renderShop;
export function renderCards(upgradedId) {
  $('#cards-grid').innerHTML = E.CARD_IDS.map(id => {
    const c = E.CARDS[id], r = E.RARITIES[c.rarity], L = E.level(state.cards, id), owned = L > 0, max = L >= c.max;
    const need = owned && !max ? E.fragsNeeded(id, L) : 0, have = E.frags(state.cards, id), cost = owned && !max ? E.upgradeCost(id, L, state.cards) : 0;
    const base = owned && !max ? Math.round(r.baseCost * Math.pow(r.growth, L - 1)) : 0, can = owned && !max && have >= need && state.pesetas >= cost;
    const un = E.unlockNeed(id), fresh = isNewCard(id);
    return `<div class="card ${owned ? '' : 'locked'} ${upgradedId === id ? 'upgraded' : ''} ${fresh ? 'fresh' : ''}" data-id="${id}" style="--rc:${r.color}">
      ${fresh ? '<i class="dot"></i><i class="new-tag">¡NUEVA!</i>' : ''}
      <div class="card-art">${CARD_ART[id]}</div><h3>${c.name}</h3>
      <div class="lvl">${rarTag(c.rarity)}<span>${owned ? `Nv ${L}/${c.max}` : ''}</span></div>
      <p>${c.desc}</p>
      ${owned ? `<div class="eff">${c.effect(L)}${max ? '<span>Nivel máximo</span>' : `<span>Siguiente: ${c.effect(L + 1)}</span>`}</div>
        ${max ? '' : `<div class="frag">Fragmentos ${Math.min(have, need)}/${need}<div class="bar"><div class="bar-fill" style="width:${Math.min(100, have / need * 100)}%"></div></div></div>
        <button class="btn-g" data-upgrade="${id}" ${can ? '' : 'disabled'}>${icon('ic-coin', 'ci')}${base !== cost ? `<del>${base}</del>` : ''}${cost}</button>`}`
      : `<div class="frag unlock">Para desbloquear ${Math.min(have, un)}/${un}<div class="bar"><div class="bar-fill" style="width:${Math.min(100, have / un * 100)}%"></div></div></div>
        <div class="eff">Consigue fragmentos en los cofres<span>Nivel 1: ${c.effect(1)}</span></div>`}
    </div>`;
  }).join('');
}
export function renderRank(rows, err, myName) {
  const list = $('#rank-list');
  if (err) { list.innerHTML = `<li class="empty">${err}</li>`; return; }
  list.innerHTML = rows.length ? rows.map(r => `<li class="${r.username === myName ? 'me' : ''}"><span class="nm">${esc(r.username || 'Anónimo')}</span><span class="sc">${fmt(r.tomatoes_earned)}</span>${icon('ic-tomato').replace('<svg', '<svg width="22" height="22"')}</li>`).join('') : '<li class="empty">Todavía no hay nadie. ¡Sé el primero!</li>';
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function renderStats() {
  const s = state.stats, rows = [['Tomates conseguidos', s.tomatoesEarned], ['Tomates disponibles', state.tomatoes], ['Pulsaciones totales', s.totalClicks], ['Lanzamientos', s.tomatoesThrown], ['Impactos perfectos', s.perfects], ['Impactos en la diana', s.hits], ['Pedro al agua', s.falls], ['Pesetas ganadas', s.pesetasEarned + s.chestPesetas], ['Pesetas disponibles', state.pesetas], ['Cofres abiertos', s.chestsOpened], ['Cartas desbloqueadas', E.CARD_IDS.filter(id => E.level(state.cards, id) > 0).length + ' / 5']];
  $('#stats-list').innerHTML = rows.map(([k, v]) => `<li><span>${k}</span><b>${typeof v === 'number' ? fmt(v) : v}</b></li>`).join('') + E.CARD_IDS.map(id => `<li class="sub"><span>${E.CARDS[id].name}</span><span>Nivel ${E.level(state.cards, id)}</span></li>`).join('');
}

// ---------- apertura de cofre ----------
export function chestOpening(kind, reward) {
  return new Promise(res => {
    const ov = $('#chest-overlay'), art = $('#chest-art'), rw = $('#chest-rewards'), btn = $('#chest-btn');
    $('#chest-title').textContent = E.CHESTS[kind].name; art.innerHTML = icon(kind === 'diamond' ? 'ic-chest-dia' : 'ic-chest'); art.className = 'chest-art'; rw.innerHTML = ''; btn.textContent = '¡ABRIR!'; btn.disabled = false;
    ov.classList.add('open'); SFX.ui();
    btn.onclick = () => {
      btn.disabled = true; art.classList.add('shake'); SFX.chestOpen();
      setTimeout(() => {
        art.classList.remove('shake'); art.classList.add('opened');
        const items = [...reward.cards.map(c => ({ kind: 'card', ...c })), { kind: 'tomatoes', n: reward.tomatoes }, ...(reward.pesetas ? [{ kind: 'pesetas', n: reward.pesetas }] : [])];
        items.forEach((it, i) => setTimeout(() => {
          const d = document.createElement('div');
          if (it.kind === 'card') { const c = E.CARDS[it.id], r = E.RARITIES[c.rarity]; d.className = 'reward' + (it.isNew ? ' new' : ''); d.style.setProperty('--rc', r.color); const tag = it.isNew ? '¡NUEVA!' : it.locked && it.need ? `${it.have}/${it.need}` : it.frags ? `+${it.frags} FRAG.` : it.bonus ? 'EXTRA' : 'FRAGMENTO';
            d.innerHTML = `<span class="tag">${tag}</span>${CARD_ART[it.id]}<div>${c.name}</div>${it.locked && it.need ? '<small>para desbloquear</small>' : ''}`; SFX.reward(['common', 'rare', 'epic', 'legendary'].indexOf(c.rarity)); }
          else if (it.kind === 'tomatoes') { d.className = 'reward'; d.style.setProperty('--rc', '#e3312a'); d.innerHTML = `<span class="tag">TOMATES</span>${icon('ic-tomato')}<div>+${it.n}</div>`; SFX.tomato(); }
          else { d.className = 'reward'; d.style.setProperty('--rc', '#e0a012'); d.innerHTML = `<span class="tag">PESETAS</span>${icon('ic-coin')}<div>+${it.n}</div>`; SFX.coin(); }
          rw.appendChild(d);
        }, 450 + i * 380));
        markNewCards(reward.cards.filter(c => c.isNew).map(c => c.id));
        setTimeout(() => { btn.textContent = 'RECOGER'; btn.disabled = false; btn.onclick = () => { ov.classList.remove('open'); hud(); res(); }; }, 450 + items.length * 380);
      }, 650);
    };
  });
}
export function volleySummary(results, pesetas) {
  const n = results.length, c = k => results.filter(r => r.kind === k).length, falls = results.filter(r => r.fall).length;
  const el = $('#summary'); el.innerHTML = `<h3>LANZAMIENTO ×${n}</h3><div class="row"><span>En el centro</span><b>${c('perfect')}</b></div><div class="row"><span>Casi</span><b>${c('near')}</b></div><div class="row"><span>Fallos</span><b>${c('miss')}</b></div><div class="row"><span>Pedro al agua</span><b>${falls}</b></div><div class="pes">${icon('ic-coin')}+${pesetas}</div>`;
  el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 2800);
}
export function setSoundUI(on, music = state.music, apply = true) {
  music = on && music;
  $('#sw-sound').classList.toggle('on', on); $('#sw-music').classList.toggle('on', music);
  if (apply) { setEnabled(on); setMusic(music); setSound(on, music); }
}
export function setAccountUI(user, username) {
  const logged = !!user; $('#acc-logged').classList.toggle('hidden', !logged); $('#acc-forms').classList.toggle('hidden', logged);
  if (logged) $('#acc-name').textContent = username || user.email;
  $('#acc-short').textContent = logged ? (username || user.email) : 'Invitado';
}
export function accMsg(msg, type = '') { const el = $('#acc-msg'); el.textContent = msg; el.className = 'acc-msg ' + type; }
export function showTab(name) { $$('.tab-s').forEach(t => t.classList.toggle('active', t.dataset.tab === name)); $$('.tabpane').forEach(p => p.classList.toggle('active', p.id === 'form-' + name)); accMsg(''); }
export function saveStatus(msg) { $('#save-status').textContent = msg; }
export function loadingOff() { $('#loading').classList.add('off'); }

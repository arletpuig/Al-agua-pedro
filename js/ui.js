// Interfaz: contadores, modales, cuenta y avisos.
import { CONFIG } from './config.js';
import { state, setTutorialSeen, setSound } from './state.js';
import { SFX, setEnabled } from './audio.js';
const $ = s => document.querySelector(s);
const clicksNum = $('#clicks-num'), tomatoNum = $('#tomato-num'), barFill = $('#bar-fill'), barText = $('#bar-text'), basket = $('#basket');
const btnThrow = $('#btn-throw'), btnThrowText = $('#btn-throw-text'), btnThrowSub = $('#btn-throw-sub'), toast = $('#toast');
let toastTimer = null, tutorialCb = null;

export function updateCounters(pop = false) {
  clicksNum.textContent = state.stats.totalClicks;
  if (pop) { clicksNum.classList.remove('pop'); void clicksNum.offsetWidth; clicksNum.classList.add('pop'); }
  barFill.style.width = (state.clicks / CONFIG.CLICKS_PER_TOMATO * 100) + '%';
  barText.textContent = `${state.clicks} / ${CONFIG.CLICKS_PER_TOMATO} para el siguiente tomate`;
  if (tomatoNum.textContent !== String(state.tomatoes)) { tomatoNum.textContent = state.tomatoes; tomatoNum.classList.remove('pop'); void tomatoNum.offsetWidth; tomatoNum.classList.add('pop'); }
  const canThrow = state.tomatoes > 0 && !btnThrow.classList.contains('stop-mode');
  if (!btnThrow.classList.contains('stop-mode')) {
    btnThrow.disabled = !canThrow; btnThrowText.textContent = 'LANZAR TOMATE';
    btnThrowSub.textContent = canThrow ? `Tienes ${state.tomatoes}` : 'Necesitas 1 tomate';
  }
}
export function floater(text, x, y) {
  const r = $('#btn-click').getBoundingClientRect();
  const el = document.createElement('div'); el.className = 'floater'; el.textContent = text;
  el.style.left = ((x ?? r.left + r.width / 2) + (Math.random() - .5) * 30) + 'px'; el.style.top = ((y ?? r.top + 20) - 20) + 'px';
  document.body.appendChild(el); setTimeout(() => el.remove(), 800);
}
export function flyTomatoToBasket(from) {
  const a = from.getBoundingClientRect(), b = $('.basket-icon').getBoundingClientRect();
  const el = document.createElement('div'); el.className = 'flying-tomato';
  el.innerHTML = '<svg viewBox="-20 -20 40 40" width="34" height="34"><use href="#tomato-sym" x="-20" y="-20" width="40" height="40"/></svg>';
  el.style.left = (a.left + a.width / 2 - 17) + 'px'; el.style.top = (a.top + 10) + 'px';
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.transform = `translate(${b.left + b.width / 2 - 17 - (a.left + a.width / 2 - 17)}px,${b.top + b.height / 2 - 17 - (a.top + 10)}px) rotate(540deg) scale(.8)`; });
  setTimeout(() => { el.remove(); basket.classList.remove('bounce'); void basket.offsetWidth; basket.classList.add('bounce'); updateCounters(); }, 700);
}
export function onResult(res) {
  const pct = Math.round(res.precision * 100);
  showToast(res.kind === 'perfect' ? `🎯 ¡Perfecto! Precisión ${pct}%` : res.kind === 'near' ? `😅 Casi... precisión ${pct}%` : `❌ Fallo. Precisión ${pct}%`);
}

// ---------- modales ----------
export function openModal(id) { $(id).classList.add('open'); SFX.ui(); }
export function closeModal(el) { el.classList.remove('open'); if (el.id === 'modal-tutorial' && tutorialCb) { const cb = tutorialCb; tutorialCb = null; setTutorialSeen(); cb(); } }
export function showTutorial(cb) { tutorialCb = cb || null; openModal('#modal-tutorial'); }
export function showToast(msg, ms = 2200) { toast.textContent = msg; toast.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('on'), ms); }
export function renderStats() {
  const s = state.stats;
  $('#stats-list').innerHTML = [['Clics totales', s.totalClicks], ['Tomates conseguidos', s.tomatoesEarned], ['Tomates lanzados', s.tomatoesThrown], ['Aciertos', s.hits], ['Caídas provocadas', s.falls], ['Tomates disponibles', state.tomatoes]]
    .map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('');
}
export function renderRank(rows, err) {
  const list = $('#rank-list');
  if (err) { list.innerHTML = `<li class="muted">${err}</li>`; return; }
  list.innerHTML = rows.length ? rows.map(r => `<li><span>${escape(r.username || 'Anónimo')}</span><span><b>${r.falls}</b> caídas · ${r.hits} aciertos</span></li>`).join('') : '<li class="muted">Todavía no hay nadie. ¡Sé el primero!</li>';
}
const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function setSoundUI(on) { $('#btn-sound').textContent = on ? '🔊' : '🔇'; setEnabled(on); setSound(on); }
export function setAccountUI(user, username) {
  const logged = !!user;
  $('#acc-logged').classList.toggle('hidden', !logged); $('#acc-forms').classList.toggle('hidden', logged);
  $('#btn-account').classList.toggle('logged', logged);
  if (logged) $('#acc-name').textContent = username || user.email;
}
export function accMsg(msg, type = '') { const el = $('#acc-msg'); el.textContent = msg; el.className = 'acc-msg ' + type; }
export function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tabpane').forEach(p => p.classList.toggle('active', p.id === 'form-' + name));
  accMsg('');
}
export function saveStatus(msg) { $('#save-status').textContent = msg; }

export function bindStatic() {
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.closest('.modal'))));
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => { if (e.target === m && m.id !== 'modal-tutorial') closeModal(m); }));
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));
  $('#btn-stats').addEventListener('click', () => { renderStats(); openModal('#modal-stats'); });
  $('#btn-sound').addEventListener('click', () => setSoundUI(!state.sound));
}

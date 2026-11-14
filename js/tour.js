// Guía de bienvenida: la primera vez que entra un jugador nuevo, un recorrido corto que señala cada parte de la pantalla.
// Se puede saltar y volver a ver desde Ajustes → «Cómo se juega».
import { state } from './state.js';
import { SFX } from './audio.js';

const $ = s => document.querySelector(s);
const KEY = 'alaguapedro.tourDone';
const AREA = 'area';   // la zona del escenario (Pedro, la diana y la pecera)
const STEPS = [
  { at: AREA, title: '¡Bienvenido a AL AGUA PEDRO!', text: 'Pedro está sentado encima de una <b>pecera llena de pirañas</b> 🐟. Tu misión: darle a la <b>diana</b> con tomates para que se caiga <b>¡AL AGUA!</b>' },
  { at: ['#btn-click'], title: '1 · Consigue tomates', text: 'Pulsa <b>¡DALE!</b> sin parar. Cada <b>200 toques</b> llenas la barra y ganas <b>1 tomate</b> 🍅. Si pulsas muy seguido haces <b>racha</b> y cada toque vale el doble o el triple.' },
  { at: ['#basket'], title: '2 · Tus tomates', text: 'Aquí ves los tomates que tienes. Cuando tengas, aparecen los botones <b>×1, ×3, ×5…</b> para elegir cuántos lanzar de golpe.' },
  { at: AREA, title: '3 · Apunta al centro', text: 'El tomate va <b>de lado a lado</b> por delante de la diana. Pulsa el botón grande cuando esté en el <b>centro</b>: cuanto más centrado, más pesetas. ¡Y Pedro, al agua!' },
  { at: ['#pill-pesetas'], title: '4 · Gana pesetas', text: 'Cada vez que Pedro cae al agua ganas <b>pesetas</b> 🪙, el dinero del juego.' },
  { at: ['#tabs [data-panel="shop"]', '#tabs [data-panel="cards"]'], title: '5 · Cofres y cartas', text: 'En la <b>Tienda</b> gastas pesetas en cofres. Dentro hay <b>cartas con poderes</b>: más tomates por toque, pesetas que caen del cielo, el Falcón… Mejóralas en <b>Cartas</b>.' },
  { at: ['#btn-daily'], title: '6 · Cofre diario gratis', text: 'Cada día tienes aquí un <b>cofre gratis</b>. ¡Vuelve mañana a por otro!' },
  { at: ['#tabs [data-panel="rank"]'], title: '7 · Ranking', text: 'Compite con toda España a ver quién tira más veces a Pedro al agua. ¿Listo?', last: true },
];
let el = null, i = 0, waiting = null;
export const tourTest = { off: !!window.__AAP_NOTOUR };   // las pruebas automáticas la desactivan
export const tourOpen = () => !!el;

const done = () => { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } };
const markDone = () => { try { localStorage.setItem(KEY, '1'); } catch (e) {} };
const busyScreen = () => !!document.querySelector('.panel.open, .overlay.open, .gift-drop:not(.hidden), #toast.on');

// Jugador totalmente nuevo (sin ningún toque): espera a que no haya ventanas delante (bandera, regalo...) y empieza
export function maybeTour() {
  if (tourTest.off || done() || el || waiting) return;
  let clear = 0;
  waiting = setInterval(() => {
    if (state.stats.totalClicks > 0 || done()) { clearInterval(waiting); waiting = null; return; }   // ya está jugando: no se le interrumpe
    clear = busyScreen() ? 0 : clear + 1;
    if (clear >= 3) { clearInterval(waiting); waiting = null; startTour(); }
  }, 400);
}

export function startTour() {
  if (el) return;
  i = 0; el = document.createElement('div'); el.id = 'tour'; el.className = 'tour';
  el.innerHTML = `<i class="tour-hole"></i><i class="tour-hand">👆</i>
    <div class="tour-bubble" role="dialog" aria-live="polite"><b class="tour-title"></b><p class="tour-text"></p>
      <div class="tour-foot"><span class="tour-dots"></span><button class="tour-skip" type="button">Saltar</button><button class="btn-g tour-next" type="button"></button></div></div>`;
  $('#app').appendChild(el);
  el.addEventListener('pointerdown', e => e.stopPropagation());
  el.querySelector('.tour-next').addEventListener('click', next);
  el.querySelector('.tour-skip').addEventListener('click', finish);
  el.querySelector('.tour-hole').addEventListener('click', next);
  addEventListener('resize', place);
  show();
}

function next() { SFX.ui(); if (i >= STEPS.length - 1) return finish(); i++; show(); }
function finish() {
  if (!el) return;
  markDone(); removeEventListener('resize', place); el.remove(); el = null;
  hintTap();
}
function show() {
  const st = STEPS[i];
  el.querySelector('.tour-title').textContent = st.title;
  el.querySelector('.tour-text').innerHTML = st.text;
  el.querySelector('.tour-next').textContent = st.last ? '¡A POR ÉL!' : 'SIGUIENTE ›';
  el.querySelector('.tour-skip').classList.toggle('hidden', !!st.last);
  el.querySelector('.tour-dots').innerHTML = STEPS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
  const b = el.querySelector('.tour-bubble'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  place();
}
// rectángulo (relativo a #app) de lo que se señala
function targetRect(at) {
  const app = $('#app').getBoundingClientRect();
  if (at === AREA) {
    const top = $('.top').getBoundingClientRect().bottom, bot = $('.action').getBoundingClientRect().top;
    return { x: 10, y: top - app.top + 8, w: app.width - 20, h: Math.max(80, bot - top - 16) };
  }
  const rs = at.map(s => $(s)?.getBoundingClientRect()).filter(r => r && r.width);
  if (!rs.length) return { x: app.width / 2 - 40, y: app.height / 2 - 40, w: 80, h: 80 };
  const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top)), r = Math.max(...rs.map(r => r.right)), bt = Math.max(...rs.map(r => r.bottom));
  return { x: l - app.left - 6, y: t - app.top - 6, w: r - l + 12, h: bt - t + 12 };
}
function place() {
  if (!el) return;
  const st = STEPS[i], r = targetRect(st.at), app = $('#app'), W = app.clientWidth, Hh = app.clientHeight;
  const hole = el.querySelector('.tour-hole'), hand = el.querySelector('.tour-hand'), b = el.querySelector('.tour-bubble');
  Object.assign(hole.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
  hole.classList.toggle('big', st.at === AREA);
  // el bocadillo va debajo si lo señalado está arriba; encima si está abajo; en medio si es el escenario
  const bw = Math.min(340, W - 24), bh = b.offsetHeight || 170;
  let top;
  if (st.at === AREA) top = r.y + r.h - bh - 14;
  else if (r.y + r.h / 2 < Hh / 2) top = r.y + r.h + 48;   // deja sitio a la mano
  else top = r.y - bh - 48;
  top = Math.max(12, Math.min(Hh - bh - 12, top));
  const left = Math.max(12, Math.min(W - bw - 12, r.x + r.w / 2 - bw / 2));
  Object.assign(b.style, { width: bw + 'px', left: left + 'px', top: top + 'px' });
  // la mano señala lo marcado (no en el escenario)
  hand.classList.toggle('hidden', st.at === AREA);
  const up = r.y + r.h / 2 < Hh / 2;
  hand.classList.toggle('up', up);
  Object.assign(hand.style, { left: (r.x + r.w / 2 - 18) + 'px', top: (up ? r.y + r.h - 6 : r.y - 40) + 'px' });
}
// después de la guía, una mano invita a pulsar ¡DALE! hasta el primer toque
function hintTap() {
  const btn = $('#btn-click'); if (!btn || state.stats.totalClicks > 0) return;
  const h = document.createElement('div'); h.className = 'tap-hint'; h.innerHTML = '<i>👆</i><b>¡PULSA!</b>';
  $('.action').appendChild(h);
  const off = () => { h.remove(); btn.removeEventListener('pointerdown', off); };
  btn.addEventListener('pointerdown', off); setTimeout(off, 20000);
}

// La Armería: puesto de feria de Abascal (desde el nivel 10). Aquí se compran los objetos y, una vez tuyos, se usan contra Pedro
// directamente desde su tarjeta («¡USAR!»). Los objetos no se gastan.
import { state, onChange } from './state.js';
import { backend } from './backend.js';
import { levelOf } from './levels.js';
import { SFX } from './audio.js';
import { drawIcon } from './game/weapons.js';
import { dream } from './game/preview.js';
import { createFx } from './fx.js';

export const UNLOCK_LEVEL = 10;
// c1/c2: colores de la tarjeta de cada objeto (cada uno con su estilo de «exclusivo»)
export const ARMORY = [
  { id: 'hammer', name: 'Martillo de goma', price: 0, desc: '¡BONK! Un golpe de juguete', tier: 'REGALO', c1: '#36f0b0', c2: '#0a7a5a' },
  { id: 'slipper', name: 'Chancla boomerang', price: 30000, desc: 'Sale disparada, le da y vuelve', tier: 'RARO', c1: '#4ab4ff', c2: '#1a3fa8' },
  { id: 'goose', name: 'Oca furiosa', price: 60000, desc: 'Lo persigue a picotazos', tier: 'ÉPICO', c1: '#c07bff', c2: '#5a1ab8' },
  { id: 'bull', name: 'Toro de lidia', price: 110000, desc: 'Embestida con coro de ¡OLÉ!', tier: 'LEGENDARIO', c1: '#ff9a1a', c2: '#b3101a' },
  { id: 'vacuum', name: 'Aspiradora monstruosa', price: 180000, desc: 'Lo succiona y lo escupe', tier: 'LEGENDARIO', c1: '#ff4fa3', c2: '#8a0f5a' },
  { id: 'press', name: 'Prensa hidráulica', price: 290000, desc: 'Lo deja hecho un acordeón', tier: 'MÍTICO', c1: '#6ff3ff', c2: '#145a8a' },
  { id: 'stamp', name: 'Sello «CORRUPTO»', price: 480000, desc: 'Lo marca de rojo de la cabeza a los pies', tier: 'DEFINITIVO', c1: '#ffd23f', c2: '#c4161c' },
];
const $ = s => document.querySelector(s);
const fmt = n => n.toLocaleString('es-ES');
const SEEN_KEY = 'alaguapedro.armorySeen', INTRO_KEY = 'alaguapedro.armoryIntro';
export const armoryTest = { off: false, noIntro: false };
let ui, scene, isBusy, fail, openInstall, wasUnlocked = null, confirmId = null, confirmTimer = 0, buying = false, shopKey = '', stopDream = null, fxWin = null, winId = null;

export const unlocked = () => levelOf(state.stats) >= UNLOCK_LEVEL;
const owned = id => state.armory.includes(id);
const seen = () => { try { return !!localStorage.getItem(SEEN_KEY); } catch (e) { return true; } };

export function initArmory(uiRef, sceneRef, busyFn, failFn, installFn) {
  ui = uiRef; scene = sceneRef; isBusy = busyFn; fail = failFn; openInstall = installFn;
  $('#armory-btn').addEventListener('click', () => { SFX.ui(); if (unlocked() || state.armory.length) openArmory(); else tease(); });
  document.addEventListener('pointerdown', e => { if (!e.target.closest?.('#armory-tease, #armory-btn')) $('#armory-tease').classList.add('hidden'); });
  $('#arm-grid').addEventListener('click', onCard);
  $('#panel-armory .sheet').append($('#arm-intro'), $('#arm-dream'), $('#arm-win'));
  fxWin = createFx($('#arm-win'));
  $('#win-use').addEventListener('click', () => { const id = winId; closeWin(); ui.closeAll(); setTimeout(() => use(id), 250); });
  $('#win-later').addEventListener('click', () => { SFX.ui(); closeWin(); });   // fuera de la parte que se desliza: siempre a la vista
  $('#arm-dream').addEventListener('click', wake);
  $('#arm-intro-ok').addEventListener('click', () => { SFX.ui(); $('#arm-intro').classList.add('hidden'); try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) {} });
  new MutationObserver(() => { if (!$('#panel-armory').classList.contains('open')) wake(); }).observe($('#panel-armory'), { attributes: true, attributeFilter: ['class'] });
  buildBooth();
  onChange(refresh); refresh();
}
// banderines de España colgando del techo del puesto
function buildBooth() {
  const n = 13, W = 400, flags = Array.from({ length: n }, (_, i) => { const x = 10 + i * (W - 20) / (n - 1), y = 8 + Math.sin(i / (n - 1) * Math.PI) * 18;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${((i % 2) * 2 - 1) * 3})"><clipPath id="pf${i}"><path d="M-12 0 L12 0 L0 30Z"/></clipPath><g clip-path="url(#pf${i})"><rect x="-12" y="0" width="24" height="9" fill="#c60b1e"/><rect x="-12" y="9" width="24" height="12" fill="#ffc400"/><rect x="-12" y="21" width="24" height="9" fill="#c60b1e"/></g><path d="M-12 0 L12 0 L0 30Z" fill="none" stroke="#0a0b18" stroke-width="2.2" stroke-linejoin="round"/></g>`; }).join('');
  $('#arm-bunting').innerHTML = `<path d="M0 6 Q200 44 400 6" fill="none" stroke="#0a0b18" stroke-width="3"/>${flags}`;
  // estanterías del puesto con los objetos expuestos
  const shelf = ids => ids.map(id => `<div class="arm-slot"><canvas width="120" height="120" data-icon="${id}"></canvas></div>`).join('');
  $('#arm-shelf-l').innerHTML = shelf(['hammer', 'slipper', 'goose']); $('#arm-shelf-r').innerHTML = shelf(['bull', 'vacuum', 'press']);
  document.querySelectorAll('.arm-shelf canvas[data-icon]').forEach(cv => drawIcon(cv, cv.dataset.icon));
  // nube del bocadillo de sueño (contorno de bultos)
  const nb = 22, pts = Array.from({ length: nb }, (_, i) => { const a = i / nb * Math.PI * 2; return [200 + Math.cos(a) * 186, 150 + Math.sin(a) * 132]; });
  const d = pts.map((p, i) => { const q = pts[(i + 1) % nb], m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], o = [(m[0] - 200) * 0.13, (m[1] - 150) * 0.15]; return `${i ? '' : `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`} Q${(m[0] + o[0]).toFixed(1)} ${(m[1] + o[1]).toFixed(1)} ${q[0].toFixed(1)} ${q[1].toFixed(1)}`; }).join(' ') + 'Z';
  $('#dream-cloud').innerHTML = `<path d="${d}" fill="#fff" stroke="#0a0b18" stroke-width="6" stroke-linejoin="round"/>`;
}

// botón de la pantalla de juego (y aviso al desbloquearla)
export function refresh() {
  const on = unlocked(), b = $('#armory-btn'); if (!b) return;
  b.classList.toggle('locked', !on && !state.armory.length); b.classList.toggle('fresh', on && !seen());
  $('#armory-tag').textContent = on || state.armory.length ? 'ARMERÍA' : `NV ${UNLOCK_LEVEL}`;
  if (wasUnlocked === false && on && !armoryTest.off) { SFX.levelUp?.(); ui.showToast('🔓 ¡LA ARMERÍA ESTÁ ABIERTA! Abascal te espera con su arsenal', 4200); }
  wasUnlocked = on;
  if (on) $('#armory-tease').classList.add('hidden');
  // la tienda solo se redibuja si cambia algo suyo (redibujar a cada momento se comía los toques)
  if ($('#panel-armory')?.classList.contains('open') && key() !== shopKey) renderShop();
}
const key = () => [state.pesetas, state.armory.join(), unlocked(), confirmId].join('|');
function tease() {
  const L = levelOf(state.stats), t = $('#armory-tease');
  $('#tease-lvl').textContent = `Nivel ${L} de ${UNLOCK_LEVEL}`; $('#tease-fill').style.width = `${Math.min(100, L / UNLOCK_LEVEL * 100)}%`;
  t.classList.remove('hidden'); clearTimeout(tease.t); tease.t = setTimeout(() => t.classList.add('hidden'), 3800);
}

// ---------- el puesto
function openArmory() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
  let intro = true; try { intro = !localStorage.getItem(INTRO_KEY); } catch (e) {}
  $('#arm-intro').classList.toggle('hidden', !intro || armoryTest.noIntro);       // la primera vez: qué es La Armería
  confirmId = null; renderShop(); ui.openPanel('#panel-armory'); refresh();
}
// «¡Imagínatelo!»: lo que no puedes comprar todavía se ve en un bocadillo de sueño, con su animación en pequeño
function showDream(id) {
  const it = ARMORY.find(x => x.id === id); wake();
  $('#dream-txt').innerHTML = !unlocked() ? `<b>${it.name}</b><br>Se desbloquea en el nivel ${UNLOCK_LEVEL}… ¡pero soñar es gratis!` : `<b>${it.name}</b><br>Te faltan ${fmt(it.price - state.pesetas)} pesetas… ¡pero soñar es gratis!`;
  $('#arm-dream').classList.remove('hidden'); SFX.ui();
  stopDream = dream($('#dream-cv'), scene, id);
}
function wake() { stopDream?.(); stopDream = null; $('#arm-dream')?.classList.add('hidden'); }
function cardHTML(it, i) {
  const have = owned(it.id), gift = !it.price, short = it.price - state.pesetas;
  let btn;
  if (have) btn = `<button class="arm-btn use" data-use="${it.id}">¡USAR!</button>`;
  else if (gift) btn = `<button class="arm-btn gift" data-gift="1">🎁 INSTALA LA APP</button>`;
  else if (!unlocked()) btn = `<button class="arm-btn dream" data-dream="${it.id}">🔒 Nivel ${UNLOCK_LEVEL} · 💭 Imagínatelo</button>`;
  else if (short > 0) btn = `<button class="arm-btn dream" data-dream="${it.id}">Te faltan ${fmt(short)} · 💭 Imagínatelo</button>`;
  else btn = `<button class="arm-btn buy${confirmId === it.id ? ' sure' : ''}" data-buy="${it.id}">${confirmId === it.id ? '¿SEGURO? ¡COMPRAR!' : 'COMPRAR'}</button>`;
  const price = have ? '' : gift ? '<div class="arm-price free">GRATIS <small>al instalar la app</small></div>' : `<div class="arm-price"><svg class="ri"><use href="#ic-coin"/></svg>${fmt(it.price)}</div>`;
  return `<div class="arm-card${have ? ' have' : ''}${it.id === 'stamp' ? ' wide' : ''}" data-id="${it.id}" style="--c1:${it.c1};--c2:${it.c2};--d:${(i * 0.6).toFixed(1)}s">
    <i class="arm-rays"></i><i class="arm-shine"></i><span class="arm-rar">${it.tier}</span>${have ? '<span class="arm-tick">✔ TUYO</span>' : ''}
    <div class="arm-art"><canvas width="240" height="240" data-icon="${it.id}"></canvas></div>
    <div class="arm-info"><h4>${it.name}</h4><p>${it.desc}</p>${price}${btn}</div></div>`;
}
function renderShop() {
  shopKey = key();
  $('#arm-pes').textContent = fmt(state.pesetas);
  $('#arm-grid').innerHTML = ARMORY.map(cardHTML).join('');
  $('#arm-grid').querySelectorAll('canvas[data-icon]').forEach(cv => drawIcon(cv, cv.dataset.icon));
}
async function onCard(e) {
  const b = e.target.closest('button') || e.target.closest('.arm-card')?.querySelector('[data-dream]'); if (!b || b.disabled) return;   // la tarjeta entera abre el sueño
  if (b.dataset.gift) { ui.closeAll(); openInstall?.(); return; }
  if (b.dataset.use) { ui.closeAll(); setTimeout(() => use(b.dataset.use), 250); return; }
  if (b.dataset.dream) { showDream(b.dataset.dream); return; }
  const id = b.dataset.buy; if (!id || buying) return;
  // dos toques para comprar: así no se compra nada sin querer
  if (confirmId !== id) { confirmId = id; SFX.ui(); clearTimeout(confirmTimer); confirmTimer = setTimeout(() => { confirmId = null; renderShop(); }, 5000); renderShop(); return; }
  const it = ARMORY.find(x => x.id === id); buying = true; confirmId = null; clearTimeout(confirmTimer);
  $('#arm-grid').querySelectorAll('button').forEach(x => x.disabled = true);
  try {
    await backend.buyArmory(id, it.price);
    ui.hud(); celebrate(it);
  } catch (err) { fail?.(err); }
  buying = false; renderShop(); refresh();
  $(`.arm-card[data-id="${id}"]`)?.classList.add('just');
}
// ---------- compra: celebración especial (redoble y caja que tiembla → destello → el objeto sale con rayos, confeti y lluvia de monedas)
const wait = ms => new Promise(r => setTimeout(r, ms));
async function celebrate(it) {
  const w = $('#arm-win'); winId = it.id;
  w.style.setProperty('--c1', it.c1); w.style.setProperty('--c2', it.c2);
  $('#win-tier').textContent = it.tier; $('#win-name').textContent = it.name;
  drawIcon($('#win-cv'), it.id);
  w.className = 'arm-win s1'; SFX.drumroll?.(1.0);
  await wait(armoryTest.fast ? 30 : 1050);
  w.className = 'arm-win s2'; SFX.levelUp?.(); SFX.prize?.(true); navigator.vibrate?.([40, 60, 140]);
  const r = w.getBoundingClientRect(); fxWin.resize?.(); fxWin.burst?.(r.width / 2, r.height * 0.42, 160); setTimeout(() => { fxWin.rain?.(70); fxWin.rain?.(28, 'coin'); }, 250);
  await wait(armoryTest.fast ? 30 : 900);
  w.classList.add('s3');
}
function closeWin() { $('#arm-win').className = 'arm-win hidden'; fxWin?.clear?.(); }
// usar un objeto contra Pedro (solo si es tuyo y no está pasando otra cosa)
export async function use(id) {
  if (!owned(id)) { ui.showToast('Ese objeto no lo tienes: cómpralo en La Armería', 2400, true); return false; }
  if (isBusy?.() || !scene.canUseWeapon()) { ui.showToast('Espera a que termine lo que está pasando', 2000); return false; }
  return scene.useWeapon(id);
}

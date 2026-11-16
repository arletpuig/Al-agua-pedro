// La Armería: puesto de feria de Abascal (desde el nivel 10). Aquí se compran los objetos y, una vez tuyos, se usan contra Pedro
// directamente desde su tarjeta («¡USAR!»). Los objetos no se gastan.
import { state, onChange } from './state.js';
import { backend } from './backend.js';
import { levelOf } from './levels.js';
import { SFX } from './audio.js';
import { drawIcon } from './game/weapons.js';

export const UNLOCK_LEVEL = 10;
// c1/c2: colores de la tarjeta de cada objeto (cada uno con su estilo de «exclusivo»)
export const ARMORY = [
  { id: 'hammer', name: 'Martillo de goma', price: 0, desc: '¡BONK! Un golpe de juguete', tier: 'REGALO', c1: '#36f0b0', c2: '#0a7a5a' },
  { id: 'slipper', name: 'Chancla boomerang', price: 60000, desc: 'Sale disparada, le da y vuelve', tier: 'RARO', c1: '#4ab4ff', c2: '#1a3fa8' },
  { id: 'goose', name: 'Oca furiosa', price: 125000, desc: 'Lo persigue a picotazos', tier: 'ÉPICO', c1: '#c07bff', c2: '#5a1ab8' },
  { id: 'bull', name: 'Toro de lidia', price: 250000, desc: 'Embestida con coro de ¡OLÉ!', tier: 'LEGENDARIO', c1: '#ff9a1a', c2: '#b3101a' },
  { id: 'vacuum', name: 'Aspiradora monstruosa', price: 400000, desc: 'Lo succiona y lo escupe', tier: 'LEGENDARIO', c1: '#ff4fa3', c2: '#8a0f5a' },
  { id: 'press', name: 'Prensa hidráulica', price: 650000, desc: 'Lo deja hecho un acordeón', tier: 'MÍTICO', c1: '#6ff3ff', c2: '#145a8a' },
  { id: 'stamp', name: 'Sello «CORRUPTO»', price: 1000000, desc: 'Lo marca de rojo de la cabeza a los pies', tier: 'DEFINITIVO', c1: '#ffd23f', c2: '#c4161c' },
];
const SELLER = ['¡Pasen y vean, que me lo quitan de las manos!', '¡Género de primera, recién traído!', '¡Hoy la chancla sale volando!', '¡El toro no se devuelve!', '¡Aquí se viene a disfrutar!'];
const $ = s => document.querySelector(s);
const fmt = n => n.toLocaleString('es-ES');
const SEEN_KEY = 'alaguapedro.armorySeen';
export const armoryTest = { off: false };
let ui, scene, isBusy, fail, openInstall, wasUnlocked = null, confirmId = null, confirmTimer = 0, buying = false, shopKey = '';

export const unlocked = () => levelOf(state.stats) >= UNLOCK_LEVEL;
const owned = id => state.armory.includes(id);
const seen = () => { try { return !!localStorage.getItem(SEEN_KEY); } catch (e) { return true; } };

export function initArmory(uiRef, sceneRef, busyFn, failFn, installFn) {
  ui = uiRef; scene = sceneRef; isBusy = busyFn; fail = failFn; openInstall = installFn;
  $('#armory-btn').addEventListener('click', () => { SFX.ui(); if (unlocked() || state.armory.length) openArmory(); else tease(); });
  document.addEventListener('pointerdown', e => { if (!e.target.closest?.('#armory-tease, #armory-btn')) $('#armory-tease').classList.add('hidden'); });
  $('#arm-grid').addEventListener('click', onCard);
  buildBooth();
  onChange(refresh); refresh();
}
// banderines de España colgando del techo del puesto
function buildBooth() {
  const n = 13, W = 400, flags = Array.from({ length: n }, (_, i) => { const x = 10 + i * (W - 20) / (n - 1), y = 8 + Math.sin(i / (n - 1) * Math.PI) * 18;
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${((i % 2) * 2 - 1) * 3})"><clipPath id="pf${i}"><path d="M-12 0 L12 0 L0 30Z"/></clipPath><g clip-path="url(#pf${i})"><rect x="-12" y="0" width="24" height="9" fill="#c60b1e"/><rect x="-12" y="9" width="24" height="12" fill="#ffc400"/><rect x="-12" y="21" width="24" height="9" fill="#c60b1e"/></g><path d="M-12 0 L12 0 L0 30Z" fill="none" stroke="#0a0b18" stroke-width="2.2" stroke-linejoin="round"/></g>`; }).join('');
  $('#arm-bunting').innerHTML = `<path d="M0 6 Q200 44 400 6" fill="none" stroke="#0a0b18" stroke-width="3"/>${flags}`;
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
  $('#arm-bubble').textContent = unlocked() ? SELLER[Math.floor(Math.random() * SELLER.length)] : `¡Vuelve en el nivel ${UNLOCK_LEVEL} y te vendo de todo!`;
  confirmId = null; renderShop(); ui.openPanel('#panel-armory'); refresh();
}
function cardHTML(it, i) {
  const have = owned(it.id), gift = !it.price, short = it.price - state.pesetas;
  let btn;
  if (have) btn = `<button class="arm-btn use" data-use="${it.id}">¡USAR!</button>`;
  else if (gift) btn = `<button class="arm-btn gift" data-gift="1">🎁 INSTALA LA APP</button>`;
  else if (!unlocked()) btn = `<span class="arm-short">🔒 Nivel ${UNLOCK_LEVEL}</span>`;
  else if (short > 0) btn = `<span class="arm-short">Te faltan ${fmt(short)}</span>`;
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
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.gift) { ui.closeAll(); openInstall?.(); return; }
  if (b.dataset.use) { ui.closeAll(); setTimeout(() => use(b.dataset.use), 250); return; }
  const id = b.dataset.buy; if (!id || buying) return;
  // dos toques para comprar: así no se compra nada sin querer
  if (confirmId !== id) { confirmId = id; SFX.ui(); clearTimeout(confirmTimer); confirmTimer = setTimeout(() => { confirmId = null; renderShop(); }, 5000); renderShop(); return; }
  const it = ARMORY.find(x => x.id === id); buying = true; confirmId = null; clearTimeout(confirmTimer);
  $('#arm-grid').querySelectorAll('button').forEach(x => x.disabled = true);
  try {
    await backend.buyArmory(id, it.price);
    SFX.prize?.(true); ui.showToast(`🛒 ¡${it.name} es tuyo! Pulsa ¡USAR! cuando quieras`, 3200); ui.hud();
    $('#arm-bubble').textContent = '¡Gran elección! Úsalo con cariño.';
  } catch (err) { fail?.(err); }
  buying = false; renderShop(); refresh();
  $(`.arm-card[data-id="${id}"]`)?.classList.add('just');
}
// usar un objeto contra Pedro (solo si es tuyo y no está pasando otra cosa)
export async function use(id) {
  if (!owned(id)) { ui.showToast('Ese objeto no lo tienes: cómpralo en La Armería', 2400, true); return false; }
  if (isBusy?.() || !scene.canUseWeapon()) { ui.showToast('Espera a que termine lo que está pasando', 2000); return false; }
  return scene.useWeapon(id);
}

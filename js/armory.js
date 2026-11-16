// La Armería: tienda de objetos para usar contra Pedro (desde el nivel 10) y mochila con lo comprado.
// Comprar: aquí (pesetas, validado por el servidor). Usar: desde la mochila de la pantalla de juego. Los objetos no se gastan.
import { state, onChange } from './state.js';
import { backend } from './backend.js';
import { levelOf } from './levels.js';
import { SFX } from './audio.js';
import { drawIcon } from './game/weapons.js';

export const UNLOCK_LEVEL = 10;
export const ARMORY = [
  { id: 'hammer', name: 'Martillo de goma', price: 0, desc: '¡BONK! Golpe de juguete' },
  { id: 'slipper', name: 'Chancla boomerang', price: 60000, desc: 'Sale, le da y vuelve' },
  { id: 'goose', name: 'Oca furiosa', price: 125000, desc: 'Lo persigue a picotazos' },
  { id: 'bull', name: 'Toro de lidia', price: 250000, desc: 'Embestida con ¡OLÉ!' },
  { id: 'vacuum', name: 'Aspiradora monstruosa', price: 400000, desc: 'Lo succiona y lo escupe' },
  { id: 'press', name: 'Prensa hidráulica', price: 650000, desc: 'Lo deja hecho un acordeón' },
  { id: 'stamp', name: 'Sello «CORRUPTO»', price: 1000000, desc: 'Marcado de rojo para siempre (casi)' },
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
  $('#armory-btn').addEventListener('click', () => { SFX.ui(); if (unlocked()) openArmory(); else tease(); });
  $('#bag-btn').addEventListener('click', e => { e.stopPropagation(); SFX.ui(); $('#armory-tease').classList.add('hidden'); toggleBag(); });
  document.addEventListener('pointerdown', e => { if (!e.target.closest?.('#bag-menu, #bag-btn')) $('#bag-menu').classList.add('hidden'); if (!e.target.closest?.('#armory-tease, #armory-btn')) $('#armory-tease').classList.add('hidden'); });
  $('#arm-grid').addEventListener('click', onCard);
  onChange(refresh); refresh();
}

// botones de la pantalla de juego (y aviso al desbloquearla)
export function refresh() {
  const on = unlocked(), b = $('#armory-btn'); if (!b) return;
  b.classList.toggle('locked', !on); b.classList.toggle('fresh', on && !seen());
  $('#armory-tag').textContent = on ? 'ARMERÍA' : `NV ${UNLOCK_LEVEL}`;
  const n = state.armory.length; $('#bag-btn').classList.toggle('hidden', !n && !on); $('#bag-count').textContent = n; $('#bag-count').classList.toggle('hidden', !n);
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

// ---------- la tienda
function openArmory() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
  $('#arm-bubble').textContent = SELLER[Math.floor(Math.random() * SELLER.length)];
  confirmId = null; renderShop(); ui.openPanel('#panel-armory'); refresh();
}
function cardHTML(it) {
  const have = owned(it.id), gift = !it.price, short = it.price - state.pesetas;
  let btn;
  if (have) btn = '<span class="arm-own">✔ EN TU MOCHILA</span>';
  else if (gift) btn = `<button class="arm-buy gift" data-gift="1">🎁 INSTALA LA APP</button>`;
  else if (short > 0) btn = `<button class="arm-buy" disabled>Te faltan ${fmt(short)}</button>`;
  else btn = `<button class="arm-buy${confirmId === it.id ? ' sure' : ''}" data-buy="${it.id}">${confirmId === it.id ? '¿SEGURO? ¡COMPRAR!' : 'COMPRAR'}</button>`;
  const price = gift ? '<b class="arm-free">GRATIS</b><small>regalo al instalar la app</small>' : `<b><svg class="ri"><use href="#ic-coin"/></svg>${fmt(it.price)}</b>`;
  return `<div class="arm-card${have ? ' have' : ''}${it.id === 'stamp' ? ' wide' : ''}" data-id="${it.id}"><canvas width="160" height="160" data-icon="${it.id}"></canvas>
    <div class="arm-info"><h4>${it.name}</h4><p>${it.desc}</p><div class="arm-price">${price}</div>${btn}</div></div>`;
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
  const id = b.dataset.buy; if (!id || buying) return;
  // dos toques para comprar: así no se compra nada sin querer
  if (confirmId !== id) { confirmId = id; SFX.ui(); clearTimeout(confirmTimer); confirmTimer = setTimeout(() => { confirmId = null; renderShop(); }, 5000); renderShop(); return; }
  const it = ARMORY.find(x => x.id === id); buying = true; confirmId = null; clearTimeout(confirmTimer);
  $('#arm-grid').querySelectorAll('button').forEach(x => x.disabled = true);
  try {
    await backend.buyArmory(id, it.price);
    SFX.prize?.(true); ui.showToast(`🛒 ¡${it.name} comprado! Está en tu mochila`, 3200); ui.hud();
    $('#arm-bubble').textContent = '¡Gran elección! Úsalo con cariño.';
  } catch (err) { fail?.(err); }
  buying = false; renderShop(); refresh();
}

// ---------- la mochila: elegir un objeto y usarlo contra Pedro
function toggleBag() {
  const m = $('#bag-menu');
  if (!m.classList.contains('hidden')) { m.classList.add('hidden'); return; }
  const items = ARMORY.filter(it => owned(it.id));
  m.innerHTML = items.length ? `<p class="bag-title">TUS OBJETOS</p>` + items.map(it => `<button class="bag-item" data-use="${it.id}"><canvas width="96" height="96" data-icon="${it.id}"></canvas><span>${it.name}</span></button>`).join('')
    : `<p class="bag-empty">Aún no tienes objetos.<br>${unlocked() ? 'Cómpralos en <b>La Armería</b>.' : `Instala la app para el <b>martillo de goma</b> o llega al <b>nivel ${UNLOCK_LEVEL}</b>.`}</p>`;
  m.querySelectorAll('canvas[data-icon]').forEach(cv => drawIcon(cv, cv.dataset.icon));
  m.querySelectorAll('[data-use]').forEach(x => x.addEventListener('click', () => { m.classList.add('hidden'); use(x.dataset.use); }));
  m.classList.remove('hidden');
}
export async function use(id) {
  if (!owned(id)) { ui.showToast('Ese objeto no lo tienes: cómpralo en La Armería', 2400, true); return false; }
  if (isBusy?.() || !scene.canUseWeapon()) { ui.showToast('Espera a que termine lo que está pasando', 2000); return false; }
  $('#bag-btn').disabled = true;
  try { return await scene.useWeapon(id); } finally { $('#bag-btn').disabled = false; }
}

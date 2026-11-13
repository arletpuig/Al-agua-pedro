// Packs de pesetas de pago con Stripe Checkout.
// 1. El jugador elige un pack y acepta las condiciones (contenido digital: pierde el desistimiento al recibirlo).
// 2. La función «crear-pago» (Supabase) crea la página de pago de Stripe y el juego va allí.
// 3. Stripe avisa a «stripe-webhook», que es lo ÚNICO que entrega las pesetas (una vez por pago).
// 4. Al volver al juego (?pago=ok&sesion=...) se espera a que la compra aparezca y se recarga el saldo.
import { CONFIG } from './config.js';
import * as sb from './supabase.js';
import * as E from './economy.js';
import { SFX } from './audio.js';

const $ = s => document.querySelector(s);
const fmt = n => n.toLocaleString('es-ES');
const icon = id => `<svg><use href="#${id}"/></svg>`;
let ui, fail, refresh, current = null;

export function initPayments(uiRef, failFn, refreshFn) {
  ui = uiRef; fail = failFn; refresh = refreshFn;
  $('#pay-ok').addEventListener('change', e => { $('#pay-go').disabled = !e.target.checked; });
  $('#pay-cancel').addEventListener('click', () => $('#pay-overlay').classList.remove('open'));
  $('#pay-go').addEventListener('click', go);
  $('#paid-ok').addEventListener('click', () => $('#paid-overlay').classList.remove('open'));
}
const list = p => `<li>${icon('ic-coin')}<b>+${fmt(p.pesetas)}</b><span>pesetas</span></li><li>${icon('ic-tomato')}<b>+${fmt(p.tomatoes)}</b><span>tomates</span></li>`
  + (p.cards ? `<li>${icon('ic-cards')}<b>+${p.cards}</b><span>cartas top</span></li>` : '');

export function openPack(id) {
  const p = E.PACKS[id]; if (!p) return;
  if (window.__AAP_TEST) return ui.showToast('En la versión de pruebas no se puede comprar', 2600);
  if (!CONFIG.PAYMENTS) return ui.showToast('🛠️ Los pagos estarán disponibles muy pronto', 2600);
  if (!sb.auth.user) return ui.showToast('Necesitas iniciar sesión para comprar', 2600, true);
  current = p;
  $('#pay-art').innerHTML = `<i class="glow"></i>${icon(p.icon)}`;
  $('#pay-title').textContent = p.name;
  $('#pay-list').innerHTML = list(p);
  $('#pay-price').textContent = p.price + ' €';
  $('#pay-ok').checked = false; $('#pay-go').disabled = true;
  $('#pay-overlay').classList.add('open'); SFX.ui();
}
async function go() {
  const b = $('#pay-go'), label = b.innerHTML; b.disabled = true; b.textContent = 'Abriendo el pago…';
  try { location.href = await sb.createCheckout(current.id, location.origin + location.pathname); }
  catch (e) { fail(e); b.innerHTML = label; b.disabled = !$('#pay-ok').checked; }
}

// Vuelta de Stripe. Se lee al arrancar y se limpia la dirección.
export function consumeReturn() {
  const q = new URLSearchParams(location.search), status = q.get('pago');
  if (!status) return null;
  const session = q.get('sesion'); q.delete('pago'); q.delete('sesion');
  history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
  return { status, session };
}
// Tras volver de un pago correcto: espera a que el webhook entregue (normalmente unos segundos)
export async function awaitPurchase(session) {
  const ov = $('#paid-overlay'), ok = $('#paid-ok');
  $('#paid-title').textContent = '¡GRACIAS!'; $('#paid-sub').textContent = 'Recibiendo tus pesetas…';
  $('#paid-art').innerHTML = `<i class="glow"></i>${icon('ic-pack-vault')}`; $('#paid-list').innerHTML = ''; ok.classList.add('hidden');
  ov.classList.add('open');
  for (let i = 0; i < 30 && session; i++) {
    let row = null; try { row = await sb.getPurchase(session); } catch (e) {}
    if (row) {
      const p = E.PACKS[row.pack] || { name: 'Pack', icon: 'ic-pack-coins' };
      try { await refresh(); } catch (e) {}
      $('#paid-art').innerHTML = `<i class="glow"></i>${icon(p.icon)}`;
      $('#paid-title').textContent = '¡YA ES TUYO!'; $('#paid-sub').textContent = p.name;
      const won = row.reward?.cards || [];
      $('#paid-list').innerHTML = list({ pesetas: row.reward?.pesetas ?? row.pesetas, tomatoes: row.tomatoes, cards: won.length })
        + won.map(c => `<li class="won" style="--rc:${E.RARITIES[E.CARDS[c.id]?.rarity]?.color || '#fff'}"><span>${E.CARDS[c.id]?.name || c.id}</span><em>${c.isNew ? '¡NUEVA!' : c.locked ? `${c.have}/${c.need}` : `+${c.frags} frag.`}</em></li>`).join('');
      if (won.length) ui.markNewCards?.(won.filter(c => c.isNew).map(c => c.id));
      ok.classList.remove('hidden'); SFX.chestOpen?.(); SFX.coin?.(); ui.hud();
      return true;
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  $('#paid-title').textContent = 'PAGO RECIBIDO';
  $('#paid-sub').textContent = 'Tus pesetas pueden tardar unos minutos. Si no llegan, escríbenos (Ajustes → Compras) y lo solucionamos.';
  ok.textContent = 'VALE'; ok.classList.remove('hidden');
  return false;
}

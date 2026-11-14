// La Trastienda: puesto clandestino de Abascal con seis objetos permanentes para lanzar a Pedro.
// Objetivo de mitad/final de partida: se desbloquea tras muchas caídas y los precios están pensados
// para unos 10-12 días de juego a mitad de partida (~200 ₧/día según tests/sim-economy.mjs).
// Invitado: la propiedad se guarda en local (alaguapedro.shop.v1). Con cuenta: supabase/schema_v3.sql (buy_shop_item).
import { state, changed } from './state.js';

export const SHOP = {
  UNLOCK_FALLS: 300,     // caídas de Pedro necesarias para encontrar el puesto
  FREE_TRY: true,        // "Probar": demostración gratuita de cualquier objeto (útil para revisar el arte)
};
// slot: posición en el puesto (coordenadas del mundo de 720x960) · hang: cuelga del toldo
export const ITEMS = [
  { id: 'besugo', name: 'El Besugo', price: 120, frame: 'itBesugo', slot: { x: 150, y: 372, hang: true, scale: 1.05 },
    desc: 'Besugo de lonja que vuela girando y se estampa en la cara de Pedro. Lo deja mareado y acaba de merienda para las pirañas.',
    pitch: 'Fresco, fresco... de ayer. Pero pega igual.' },
  { id: 'chancla', name: 'La Chancla', price: 200, frame: 'itChancla', slot: { x: 112, y: 596, angle: -18, scale: .82 },
    desc: 'La chancla de la abuela. Sale en curva, cruza la cara de Pedro y vuelve sola a tu mano. Deja marca.',
    pitch: 'La de mi abuela. En cuarenta años no ha fallado una.' },
  { id: 'pollo', name: 'El Pollo de Goma', price: 320, frame: 'itPollo', slot: { x: 575, y: 380, hang: true, scale: .9 },
    desc: 'Rebota tres veces en la cabeza de Pedro haciendo ¡ÑIIC! y se le queda de sombrero.',
    pitch: 'Hace ñiiic. Nadie sabe por qué funciona, pero funciona.' },
  { id: 'tarta', name: 'El Tartazo', price: 480, frame: 'itTarta', slot: { x: 232, y: 622, scale: .95 },
    desc: 'Tarta de nata con fresa directa a la cara. Pedro se queda con careta de merengue hasta que se limpia.',
    pitch: 'Nata montada a mano. Para la cara, no para comer.' },
  { id: 'cubo', name: 'El Cubo Helado', price: 700, frame: 'itCubo', slot: { x: 492, y: 612, scale: .95 },
    desc: 'Baja del cielo y vuelca agua de deshielo con cubitos. Pedro se queda congelado en un bloque de hielo.',
    pitch: 'Agua de deshielo de los Picos. Recién traída.' },
  { id: 'mocion', name: 'La Moción de Censura', premium: true, priceLabel: '1,99 €', frame: 'itUrna', slot: { x: 616, y: 580, scale: .95 },
    desc: 'La urna dorada cae sobre el tablón, catapulta a Pedro al cielo y lo devuelve de cabeza a la pecera entre papeletas y fuegos artificiales.',
    pitch: 'Esto ya son palabras mayores. Solo para clientes especiales.' },
];
export const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]));

const KEY = 'alaguapedro.shop.v1';
let owned = new Set();
try { owned = new Set(JSON.parse(localStorage.getItem(KEY) || '[]').filter(id => ITEM[id])); } catch (e) {}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify([...owned])); } catch (e) {} };

export const isOwned = id => owned.has(id);
export const ownedItems = () => ITEMS.filter(i => owned.has(i.id));
export const isUnlocked = () => state.stats.falls >= SHOP.UNLOCK_FALLS || /[?&]trastienda\b/.test(location.search);
export const unlockProgress = () => Math.min(state.stats.falls, SHOP.UNLOCK_FALLS);

// Compra con pesetas. Devuelve el objeto o lanza un error con mensaje para el jugador.
export function buy(id) {
  const it = ITEM[id];
  if (!it) throw new Error('Ese objeto no existe');
  if (owned.has(id)) throw new Error('Ya tienes este objeto');
  if (it.premium) throw new Error('Los pagos llegarán próximamente');
  if (state.pesetas < it.price) throw new Error(`Te faltan ${it.price - state.pesetas} pesetas`);
  state.stats.pesetasSpent += it.price; owned.add(id); persist(); changed(false);
  return it;
}
// Con cuenta, el servidor manda: lista de objetos de la fila del perfil.
export function applyServerItems(list) { if (Array.isArray(list)) { owned = new Set(list.filter(id => ITEM[id])); persist(); } }
// Solo pruebas (?debug) y la futura verificación del pago del objeto premium.
export function grant(id) { if (ITEM[id]) { owned.add(id); persist(); changed(false); } }
export function resetShop() { owned.clear(); persist(); }

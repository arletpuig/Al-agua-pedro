// Nivel 50: la gran celebración. Medalla gigante con el «50», las puertas de La Armería se abren con Abascal detrás,
// los 7 objetos aparecen uno a uno y fuegos artificiales. Se ve una sola vez por jugador (también si ya estaba en el 50).
import { SFX } from './audio.js';
import { createFx } from './fx.js';
import { drawIcon } from './game/weapons.js';

const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const KEY = 'alaguapedro.armory50';
const ITEMS = ['hammer', 'slipper', 'goose', 'bull', 'vacuum', 'press', 'stamp'];
export const unlockTest = { fast: false };
let fx = null, playing = false;

export const unlockSeen = () => { try { return !!localStorage.getItem(KEY); } catch (e) { return true; } };
const markSeen = () => { try { localStorage.setItem(KEY, '1'); } catch (e) {} };

// Cuando no haya nada delante (celebración del nivel, ruleta, cofres…), se juega la animación. Devuelve true si se abrió La Armería.
export async function playUnlock({ busy, onEnter }) {
  if (playing) return false; playing = true;
  try {
    let ok = 0; while (ok < 3) { await sleep(unlockTest.fast ? 40 : 400); ok = busy() ? 0 : ok + 1; }
    const r = await run(onEnter);
    markSeen();          // solo cuando se ha visto entera (si cierras el juego a medias, se vuelve a ver)
    return r;
  } finally { playing = false; }
}

async function run(onEnter) {
  const ov = $('#a50-overlay'), f = unlockTest.fast ? 0.05 : 1, w = ms => sleep(ms * f);
  if (!fx) fx = createFx(ov);
  // preparar: los 7 objetos dibujados (aún invisibles)
  $('#a50-items').innerHTML = ITEMS.map((id, i) => `<span style="--i:${i}"><canvas width="96" height="96" data-icon="${id}"></canvas></span>`).join('');
  $('#a50-items').querySelectorAll('canvas').forEach(cv => { try { drawIcon(cv, cv.dataset.icon); } catch (e) {} });
  ov.className = 'overlay a50-ov open s0'; document.body.classList.add('a50-on'); fx.resize();   // nada se pone encima ni la corta
  const center = () => { const r = ov.getBoundingClientRect(); return [r.width / 2, r.height * 0.32]; };
  // 1) oscuridad y redoble
  SFX.drumroll?.(1.8); await w(1700);
  // 2) ¡50! la medalla cae con un golpe, la pantalla tiembla y estalla el confeti
  ov.classList.add('s1'); SFX.stamp?.(); SFX.levelUp?.(); if (navigator.vibrate) try { navigator.vibrate([60, 40, 160]); } catch (e) {}
  const [cx, cy] = center(); fx.burst(cx, cy, 180, { colors: ['#ffe766', '#ffffff', '#ffb21a', '#ff4b3a'] });
  await w(1500);
  // 3) las puertas de la feria se cierran delante… y se abren: ¡Abascal!
  ov.classList.add('s2'); SFX.whoosh?.(); await w(900);
  ov.classList.add('s3'); SFX.chestOpen?.(); SFX.ole?.(); await w(700);
  ov.classList.add('s4'); SFX.stamp?.(); fx.rain(110, 'paper'); await w(500);
  // 4) los 7 objetos, uno a uno
  for (let i = 0; i < ITEMS.length; i++) { $('#a50-items').children[i]?.classList.add('in'); SFX.tick?.(); await w(170); }
  // fuegos artificiales
  const r = ov.getBoundingClientRect();
  [[0.2, 0.18], [0.8, 0.22], [0.5, 0.1], [0.3, 0.3], [0.72, 0.34]].forEach(([x, y], k) => setTimeout(() => { fx.burst(r.width * x, r.height * y, 70, { min: 150, max: 420, up: 120 }); SFX.prize?.(k === 2); }, k * 420 * f));
  SFX.cheer?.();
  await w(900);
  ov.classList.add('s5');
  // 5) solo se sale entrando en La Armería
  await new Promise(res => { $('#a50-go').onclick = () => res(); });
  SFX.ui?.(); ov.className = 'overlay a50-ov'; document.body.classList.remove('a50-on'); fx.clear();
  onEnter?.();
  return true;
}

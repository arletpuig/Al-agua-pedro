import { CONFIG } from './config.js';
// Anuncios recompensados: integración modular. Todavía NO hay proveedor.
// Para integrar uno (AdMob, Unity Ads, AppLovin, etc.): crea una clase con la misma interfaz y llama a setAdProvider(new MiProveedor()).
// showRewarded debe devolver { completed: true, token } SOLO cuando el proveedor confirme el visionado completo;
// el token se verifica en el servidor (supabase/schema_v2.sql, función claim_ad_reward) antes de dar la recompensa.
export class NoAdProvider {
  get name() { return 'ninguno'; }
  isAvailable(placement) { return false; }
  async showRewarded(placement) { return { completed: false, reason: 'unavailable' }; }
}
export let adProvider = new NoAdProvider();
export function setAdProvider(p) { adProvider = p; }
export const PLACEMENTS = { FALCON: 'falcon', SOBRE: 'sobre', WELCOME: 'welcome', FLAG: 'flag' };

// Mientras no haya proveedor: vídeo de muestra de unos segundos (regalo de bienvenida, El Falcón, Sobre de la Moncloa y cambiar de bandera).
// Cuando se integre un proveedor real, showVideo usará ese proveedor.
export const DEMO_AD = { seconds: 5 };
export const adsTest = { on: false };             // solo pruebas automáticas: fuerza los vídeos aunque estén apagados
export const videosOn = () => !!(CONFIG.REWARDED_ADS || adsTest.on);
export const canShowVideo = placement => videosOn();   // con proveedor real: videosOn() && adProvider.isAvailable(placement)
export async function showVideo(placement) {
  if (!videosOn()) return { completed: true, skipped: true };   // sin anuncios todavía: no hay vídeo
  if (adProvider.isAvailable(placement)) return adProvider.showRewarded(placement);
  const ov = document.querySelector('#ad-overlay'), cnt = document.querySelector('#ad-count');
  ov.classList.add('open');
  for (let s = DEMO_AD.seconds; s > 0; s--) { cnt.textContent = `El cofre se abre en ${s}…`; await new Promise(r => setTimeout(r, 1000)); }
  ov.classList.remove('open');
  return { completed: true, demo: true };
}

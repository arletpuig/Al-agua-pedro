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
export const canShowVideo = placement => true;     // con proveedor real: adProvider.isAvailable(placement)
export async function showVideo(placement) {
  if (adProvider.isAvailable(placement)) return adProvider.showRewarded(placement);
  const ov = document.querySelector('#ad-overlay'), cnt = document.querySelector('#ad-count');
  ov.classList.add('open');
  for (let s = DEMO_AD.seconds; s > 0; s--) { cnt.textContent = `El cofre se abre en ${s}…`; await new Promise(r => setTimeout(r, 1000)); }
  ov.classList.remove('open');
  return { completed: true, demo: true };
}

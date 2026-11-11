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
export const PLACEMENTS = { FALCON: 'falcon', SOBRE: 'sobre' };

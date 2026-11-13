// Operaciones de economía: en local (invitado) o en el servidor (usuario con cuenta). Misma interfaz.
import * as sb from './supabase.js';
import * as E from './economy.js';
import { state, applyServer, applyChestLocal, changed, snapshot } from './state.js';
import { adProvider } from './ads.js';

let timeOffset = 0, nextMidnight = null, serverChecked = false, flush = async () => {};
// Antes de una operación en la nube se envía el progreso pendiente, para que el servidor conozca las pesetas ganadas.
async function cloudOp(fn) { await flush(); const sent = snapshot(); const r = await fn(); return { r, sent }; }
const madridDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

export const backend = {
  get cloud() { return !!sb.auth.user; },
  setFlush(fn) { flush = fn; },
  // Hora del servidor (para el cofre diario). Si no hay conexión se usa la hora local, en zona Europe/Madrid.
  async syncTime() {
    if (serverChecked || !sb.hasBackend()) return;
    try { const t = await sb.serverNow(); timeOffset = Date.parse(t.now) - Date.now(); nextMidnight = Date.parse(t.next_midnight); serverChecked = true; } catch (e) {}
  },
  now() { return Date.now() + timeOffset; },
  todayKey() { return madridDate(this.now()); },
  msToNextDaily() {
    const now = this.now();
    if (nextMidnight && nextMidnight > now) return nextMidnight - now;
    const d = new Date(now); let t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0).getTime(); // medianoche local aproximada
    while (madridDate(t - 1) !== madridDate(now)) t -= 3600000; while (madridDate(t) === madridDate(now)) t += 3600000;
    return t - now;
  },
  dailyAvailable() { return !state.dailyClaimedOn || state.dailyClaimedOn < this.todayKey(); },

  async openChest(kind) {
    const def = E.CHESTS[kind];
    if (this.cloud) { const { r, sent } = await cloudOp(() => sb.openChest(kind)); applyServer(r.profile, sent); return r.reward; }
    if (state.pesetas < def.price) throw new Error('No tienes pesetas suficientes');
    const back = E.refund(state.cards, def.price);                       // Hacienda Inversa, con las cartas de antes de abrir
    const reward = E.rollChest(kind, state.cards); E.applyChestCards(state.cards, reward.cards);
    reward.refund = back; state.stats.chestPesetas += back; applyChestLocal(reward, def.price); return reward;
  },
  async claimDaily() {
    if (this.cloud) { const { r, sent } = await cloudOp(() => sb.claimDaily()); applyServer(r.profile, sent); return r.reward; }
    if (!this.dailyAvailable()) throw new Error('Ya has reclamado el cofre de hoy');
    const reward = E.rollChest('wood', state.cards); E.applyChestCards(state.cards, reward.cards); state.dailyClaimedOn = this.todayKey(); applyChestLocal(reward, 0); return reward;
  },
  // Devuelve lo que dan Hacienda Inversa y Puerta Giratoria (calculado con las cartas de antes de mejorar, igual que el servidor).
  async upgradeCard(id) {
    const L0 = E.level(state.cards, id), bonus = { refund: E.refund(state.cards, E.upgradeCost(id, L0, state.cards)), tomatoes: E.upgradeTomatoes(state.cards) };
    if (this.cloud) { const { r, sent } = await cloudOp(() => sb.upgradeCard(id)); applyServer(r, sent); return bonus; }
    if (!E.canUpgrade(state.cards, id, state.pesetas)) throw new Error('No puedes mejorar esta carta todavía');
    const L = E.level(state.cards, id), cost = E.upgradeCost(id, L, state.cards);
    state.cards[id].frags -= E.fragsNeeded(id, L); state.cards[id].level++; state.stats.pesetasSpent += cost;
    state.stats.chestPesetas += bonus.refund; state.stats.chestTomatoes += bonus.tomatoes; changed(false); return bonus;
  },
  // Regalo de bienvenida: se ofrece la primera vez que Pedro cae (el servidor necesita la caída guardada) y caduca a los 10 minutos.
  async offerWelcome() {
    if (state.welcomeClaimed || state.welcomeOfferedAt) return;
    if (this.cloud) {
      const { r } = await cloudOp(() => sb.offerWelcome());
      timeOffset = Date.parse(r.now) - Date.now();
      state.welcomeClaimed = !!r.claimed; state.welcomeOfferedAt = r.offered_at ? Date.parse(r.offered_at) : null;
    } else { if (state.stats.falls < 1) return; state.welcomeOfferedAt = this.now(); }
    changed(false);
  },
  welcomeLeftMs() {
    if (state.welcomeClaimed || !state.welcomeOfferedAt) return 0;
    return Math.max(0, state.welcomeOfferedAt + E.WELCOME_MINUTES * 60000 - this.now());
  },
  async claimWelcome() {
    if (this.cloud) { const { r, sent } = await cloudOp(() => sb.claimWelcome()); applyServer(r.profile, sent); return r.reward; }
    if (state.welcomeClaimed) throw new Error('Ya has abierto el regalo de bienvenida');
    if (!this.welcomeLeftMs()) throw new Error('El regalo de bienvenida ha caducado');
    const reward = E.rollChest('welcome', state.cards); E.applyChestCards(state.cards, reward.cards); state.welcomeClaimed = true; applyChestLocal(reward, 0); return reward;
  },
  // Anuncio recompensado: solo da recompensa con verificación real del proveedor y del servidor.
  async watchAd(placement) {
    if (!adProvider.isAvailable(placement)) throw new Error('Los anuncios todavía no están disponibles');
    const r = await adProvider.showRewarded(placement);
    if (!r.completed) throw new Error('No has completado el vídeo');
    if (!this.cloud) throw new Error('Necesitas una cuenta para recibir recompensas de vídeo');
    const { r: row, sent } = await cloudOp(() => sb.claimAdReward(placement, r.token)); applyServer(row, sent);
  },
};

// Operaciones de economía: en local (invitado) o en el servidor (usuario con cuenta). Misma interfaz.
import * as sb from './supabase.js';
import * as E from './economy.js';
import { state, applyServer, applyChestLocal, changed, snapshot, falconActive } from './state.js';
import { showVideo, videosOn } from './ads.js';
import * as LV from './levels.js';
import * as D from './daily-rules.js';

let timeOffset = 0, nextMidnight = null, serverChecked = false, flush = async () => {};
// Antes de una operación en la nube se envía el progreso pendiente, para que el servidor conozca las pesetas ganadas.
async function cloudOp(fn) { await flush(); const sent = snapshot(); const r = await fn(); return { r, sent }; }
const madridDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

async function cloudSpin(fn) { const { r, sent } = await cloudOp(fn); applyServer(r.profile, sent); return { seg: r.seg, wheel: r.wheel, reward: r.reward, pending: r.pending, cost: r.cost }; }
// Tirada en local (invitado): mismas reglas que fn_wheel_roll
function localSpin(wheel, L, cost, rng, use = () => {}) {
  rng = rng || Math.random;
  const segs = LV.WHEELS[wheel].segs, seg = LV.wheelIndex(rng(), segs), s = segs[seg], st = state.stats;
  const reward = { kind: 'wheel', id: s.id, wheel, level: L, pesetas: 0, tomatoes: 0, cards: [], falcon: false, minutes: 0 };
  if (s.kind === 'pesetas') reward.pesetas = s.amount(L);
  else if (s.kind === 'tomatoes') reward.tomatoes = s.amount(L);
  else if (s.kind === 'falcon') { state.falconUntil = Math.max(Date.now(), state.falconUntil) + s.minutes * 60000; reward.falcon = true; reward.minutes = s.minutes; }
  else for (let i = 0; i < s.times; i++) { const c = E.rollChest(s.chest, state.cards); E.applyChestCards(state.cards, c.cards); reward.kind = s.chest; reward.cards.push(...c.cards); reward.pesetas += c.pesetas; reward.tomatoes += c.tomatoes; }
  use();                                                  // la tirada se gasta solo si todo ha ido bien
  st.chestPesetas += reward.pesetas; st.chestTomatoes += reward.tomatoes; st.pesetasSpent += cost; changed(false);
  return { seg, wheel, reward, pending: Math.max(0, LV.levelOf(st) - state.wheelLevel), cost };
}
export const INSTALL_PESETAS = 150;
export const backend = {
  get cloud() { return !!sb.auth.user; },
  setFlush(fn) { flush = fn; },
  // Hora del servidor (para el cofre diario). Si no hay conexión se usa la hora local, en zona Europe/Madrid.
  async syncTime() {
    if (serverChecked || !sb.hasBackend()) return;
    try { const t = await sb.serverNow(); timeOffset = state.timeOffset = Date.parse(t.now) - Date.now(); nextMidnight = Date.parse(t.next_midnight); serverChecked = true; } catch (e) {}
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
      timeOffset = state.timeOffset = Date.parse(r.now) - Date.now();
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
  // Ruletas. Con cuenta decide y entrega el servidor (schema_v14.sql); sin cuenta, igual pero en local.
  // Nivel: una tirada por cada nivel subido (los múltiplos de 10, legendaria). Tienda: pagando pesetas. Legendaria: tirada comprada.
  async spinWheel(rng) {
    if (this.cloud) return cloudSpin(sb.spinWheel);
    const lvl = LV.levelOf(state.stats); if (state.wheelLevel >= lvl) throw new Error('No tienes tiradas de ruleta pendientes');
    const L = state.wheelLevel + 1, out = localSpin(LV.isLegendLevel(L) ? 'legend' : 'normal', L, 0, rng, () => { state.wheelLevel = L; });
    return out;
  },
  async buySpin(rng) {
    if (this.cloud) return cloudSpin(sb.buySpin);
    const L = LV.levelOf(state.stats), cost = LV.shopSpinPrice(L); if (state.pesetas < cost) throw new Error('No tienes pesetas suficientes');
    return localSpin('normal', L, cost, rng);
  },
  async spinLegend(rng) {
    if (this.cloud) return cloudSpin(sb.spinLegend);
    if (state.legendSpins < 1) throw new Error('No tienes tiradas legendarias');
    return localSpin('legend', LV.levelOf(state.stats), 0, rng, () => { state.legendSpins--; });
  },
  // Nivel que cuenta el servidor (para no ofrecer tiradas que el servidor aún no da)
  async syncWheelCap() {
    if (!this.cloud) { state.wheelCap = null; return null; }
    try { await flush(); const s = state.stats, L = +(await sb.playerLevel(s.tomatoesThrown, s.hits, s.falls)); state.wheelCap = L < LV.levelOf(s) ? L : null; return L; } catch (e) { return null; }
  },
  // ---------- logros diarios
  async dailySync() {
    if (this.cloud) { const { r, sent } = await cloudOp(sb.dailySync); applyServer(r, sent); return state.daily; }
    state.daily = { ...D.todayState(state.daily, state.stats, this.todayKey(), LV.levelOf(state.stats)), local: true }; changed(false); return state.daily;
  },
  async claimMission(slot) {
    if (this.cloud) { const { r, sent } = await cloudOp(() => sb.claimDailyMission(slot)); applyServer(r.profile, sent); return r.reward; }
    const d = D.todayState(state.daily, state.stats, this.todayKey(), LV.levelOf(state.stats)), m = D.missionFor(d.date, slot, d.lv);
    if (d.done.includes(String(slot))) throw new Error('Ya has recogido esa misión');
    if (D.progress(d, state.stats, m) < m.goal) throw new Error('Todavía no has completado esa misión');
    const rw = D.rewardFor(slot, LV.levelOf(state.stats)); d.done.push(String(slot)); state.daily = { ...d, local: true };
    state.stats.chestTomatoes += rw.tomatoes; state.stats.chestPesetas += rw.pesetas; changed(false); return rw;
  },
  async claimDailyBonus() {
    if (this.cloud) { const { r, sent } = await cloudOp(sb.claimDailyBonus); applyServer(r.profile, sent); return r.reward; }
    const d = D.todayState(state.daily, state.stats, this.todayKey(), LV.levelOf(state.stats));
    if (d.done.length < 3) throw new Error('Te faltan misiones de hoy');
    if (d.bonus) throw new Error('Ya has recogido el cofre de hoy');
    const rw = E.rollChest('diamond', state.cards); E.applyChestCards(state.cards, rw.cards); d.bonus = true; state.daily = { ...d, local: true }; applyChestLocal(rw, 0); return rw;
  },
  async claimLoginDay() {
    if (this.cloud) { const { r, sent } = await cloudOp(sb.claimLoginDay); applyServer(r.profile, sent); return r.reward; }
    const key = this.todayKey(), d = D.todayState(state.daily, state.stats, key, LV.levelOf(state.stats)), L = D.loginDay(d, key);
    if (L.claimed) throw new Error('Ya has recogido el premio de hoy');
    const g = D.LOGIN[L.day - 1]; let rw = { tomatoes: g.tomatoes || 0, pesetas: g.pesetas || 0, cards: [] };
    d.login_date = key; d.login_streak = L.day; state.daily = { ...d, local: true };
    if (g.chest) { const c = E.rollChest(g.chest, state.cards); E.applyChestCards(state.cards, c.cards); c.pesetas += rw.pesetas; rw = { ...c, chest: g.chest }; applyChestLocal(rw, 0); }
    else { state.stats.chestTomatoes += rw.tomatoes; state.stats.chestPesetas += rw.pesetas; changed(false); }
    return { ...rw, day: L.day };
  },
  // ---------- invitaciones (solo con cuenta: el servidor comprueba que el amigo se ha registrado y ha jugado)
  async inviteCode() {
    if (!this.cloud) throw new Error('Necesitas una cuenta para invitar a tus amigos');
    if (!state.invite.code) state.invite.code = await sb.myInviteCode();
    return state.invite.code;
  },
  async redeemInvite(code) {
    if (!this.cloud) throw new Error('Necesitas una cuenta para usar una invitación');
    const { r, sent } = await cloudOp(() => sb.redeemInvite(code)); applyServer(r.profile, sent); return r;
  },
  async claimInvites() {
    if (!this.cloud) return { paid: 0, pesetas: 0, total: 0, pending: 0 };
    const { r, sent } = await cloudOp(sb.claimInvites); applyServer(r.profile, sent); return r;
  },
  async ackInvites() { if (this.cloud) { await sb.ackInvites(); state.invite.seen = state.invite.paid; } },
  // La Armería: comprar un objeto (desde el nivel 50, con pesetas; se queda para siempre). Con cuenta lo valida el servidor.
  async buyArmory(id, price) {
    if (this.cloud) { const { r, sent } = await cloudOp(() => sb.buyArmory(id)); applyServer(r, sent); return; }
    if (!price) throw new Error('Ese objeto no se vende');
    if (LV.levelOf(state.stats) < LV.ARMORY_LEVEL) throw new Error(`La Armería se desbloquea en el nivel ${LV.ARMORY_LEVEL}`);
    if (state.armory.includes(id)) throw new Error('Ya tienes ese objeto');
    if (state.pesetas < price) throw new Error('No tienes pesetas suficientes');
    state.stats.pesetasSpent += price; state.armory.push(id); changed(false);
  },
  // Regalo por instalar la app: cofre de diamante + 150 pesetas, una sola vez (con cuenta lo da el servidor)
  async claimInstall() {
    if (this.cloud) { const { r, sent } = await cloudOp(() => sb.claimInstall()); applyServer(r.profile, sent); return r.reward; }
    if (state.installClaimed) throw new Error('Ya has recogido el regalo de la app');
    const reward = E.rollChest('diamond', state.cards); E.applyChestCards(state.cards, reward.cards); reward.pesetas += INSTALL_PESETAS;
    state.installClaimed = true;
    if (LV.levelOf(state.stats) >= LV.ARMORY_LEVEL) { if (!state.armory.includes('hammer')) state.armory.push('hammer'); reward.item = 'hammer'; } else reward.hammer_at = LV.ARMORY_LEVEL;   // el martillo, al abrirse La Armería
    applyChestLocal(reward, 0); return reward;
  },
  // con la app y en el nivel 50: el martillo de goma pasa a La Armería
  async claimAppHammer() {
    if (this.cloud) { const { r, sent } = await cloudOp(sb.claimAppHammer); applyServer(r, sent); return; }
    if (!state.installClaimed) throw new Error('El martillo es el regalo de la app: instálala para conseguirlo');
    if (state.armory.includes('hammer')) throw new Error('Ya tienes el martillo');
    if (LV.levelOf(state.stats) < LV.ARMORY_LEVEL) throw new Error(`La Armería se desbloquea en el nivel ${LV.ARMORY_LEVEL}`);
    state.armory.push('hammer'); changed(false);
  },
  // Vídeo recompensado de la tienda (El Falcón o Sobre de la Moncloa). Con cuenta lo concede el servidor, con límite diario.
  async watchAd(placement) {
    if (!videosOn()) throw new Error('Los anuncios todavía no están disponibles');
    if (placement === 'falcon' && falconActive()) throw new Error('El Falcón ya está en marcha');
    const v = await showVideo(placement);
    if (!v.completed) throw new Error('No has completado el vídeo');
    if (this.cloud) { const { r: row, sent } = await cloudOp(() => sb.claimAdReward(placement, v.token || 'demo')); applyServer(row, sent); return; }
    if (placement === 'falcon') state.falconUntil = Date.now() + E.FALCON.minutes * 60000;
    else if (placement === 'ruleta') { state.legendAds++; if (state.legendAds >= LV.LEGEND_ADS) { state.legendAds = 0; state.legendSpins++; } }
    else state.stats.chestPesetas += E.SOBRE.pesetas;
    changed(false);
  },
};

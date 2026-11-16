// «Imagínatelo»: en la tienda, la animación de un objeto que aún no tienes se ve en pequeño, dentro de un bocadillo de sueño.
// Usa la misma escena (Pedro y el objeto de verdad) en un lienzo aparte, sin sonido y sin tocar la partida.
import { Arena, EASE } from './arena.js';
import { sample } from './pedro-anims.js';
import { runWeapon } from './weapons.js';
import { PLANK } from './stage-art.js';
import { setEnabled, isEnabled } from '../audio.js';

const VIEW = { x0: -40, x1: 1120, y0: 230, y1: 1110 };
export function dream(canvas, scene, id) {
  if (!scene?.rig) return () => {};
  const ps = Object.create(Arena.prototype);
  Object.assign(ps, { tw: [], parts: [], fx: [], now: performance.now() / 1000, rig: scene.rig, S: {}, pose: null, shake: { until: 0, amp: 0, dur: 1 }, busy: true, P: null });
  ps.play('idle');
  const c = canvas.getContext('2d'), wasOn = isEnabled(); let stop = false, last = ps.now;
  setEnabled(false);                                 // el sueño no suena
  const frame = () => {
    if (stop) return;
    const now = performance.now() / 1000, dt = Math.min(0.05, now - last); last = now; ps.now = now;
    for (const w of ps.tw.slice()) {
      const x = Math.min(1, (now - w.t0) / w.dur), e = EASE[w.ease](x);
      for (const k in w.props) w.obj[k] = w.from[k] + (w.props[k] - w.from[k]) * e;
      w.step?.(); if (x >= 1) { ps.tw.splice(ps.tw.indexOf(w), 1); w.res(); }
    }
    let ct = now - ps.clipT0; if (!ps.clip.loop && ct >= ps.clip.dur) { ps.play('idle'); ct = 0; }
    const P = sample(ps.clip, ps.clip.loop ? ct % ps.clip.dur : ct); P.px = 0; P.walkAmt = 0; ps.P = P;
    const W = canvas.width, H = canvas.height, k = Math.min(W / (VIEW.x1 - VIEW.x0), H / (VIEW.y1 - VIEW.y0));
    let sx = 0, sy = 0; if (now < ps.shake.until) { const a = ps.shake.amp * (ps.shake.until - now) / ps.shake.dur; sx = (Math.random() - 0.5) * 2 * a; sy = (Math.random() - 0.5) * 2 * a; }
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    const g = c.createRadialGradient(W / 2, H * 0.45, 10, W / 2, H / 2, W * 0.7); g.addColorStop(0, '#5a8dff'); g.addColorStop(1, '#1a2a7a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.setTransform(k, 0, 0, k, (W - (VIEW.x1 - VIEW.x0) * k) / 2 - VIEW.x0 * k + sx * k, (H - (VIEW.y1 - VIEW.y0) * k) / 2 - VIEW.y0 * k + sy * k);
    c.fillStyle = '#c98547'; c.strokeStyle = '#0a0b18'; c.lineWidth = 8; c.beginPath(); c.roundRect(140, PLANK.y, 745, 40, 10); c.fill(); c.stroke();
    ps.drawPedro(c, P, now);
    if (ps.prop) { ps.prop.step?.(); ps.prop.draw?.(c); ps.prop.over?.(c); }
    ps.drawParts(c, dt); ps.drawFx(c);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  (async () => { await ps.wait(0.4); while (!stop) { await runWeapon(ps, id); if (!stop) await ps.wait(0.8); } })();
  return () => { if (stop) return; stop = true; setEnabled(wasOn); };
}

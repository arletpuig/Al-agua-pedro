// Efectos de fiesta en un lienzo encima de una ventana: confeti, estrellas y monedas que saltan.
// Ligero: se para solo cuando no queda ninguna partícula.
export function createFx(host) {
  const cv = document.createElement('canvas'); cv.className = 'fx-canvas'; host.appendChild(cv);
  const ctx = cv.getContext('2d'); let parts = [], raf = 0, W = 0, H = 0, dpr = 1;
  function size() { const r = host.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; }
  const COLORS = ['#ffe766', '#ffb21a', '#ff4b3a', '#3fa2ff', '#8dff6a', '#ff5ad1', '#ffffff'];
  function add(p) { parts.push(p); if (!raf) { size(); last = performance.now(); raf = requestAnimationFrame(step); } }
  let last = 0;
  function step(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    parts = parts.filter(p => (p.life -= dt) > 0 && p.y < H + 60);
    for (const p of parts) {
      p.vy += (p.g ?? 900) * dt; p.vx *= p.drag ?? 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.min(1, p.life * 2);
      if (p.type === 'coin') {
        const sx = Math.abs(Math.cos(p.rot * 2)) * 0.8 + 0.2;
        ctx.scale(sx, 1); ctx.fillStyle = '#ffb21a'; ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 7); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#7a4500'; ctx.stroke(); ctx.fillStyle = '#ffe766'; ctx.beginPath(); ctx.arc(-p.s * .2, -p.s * .2, p.s * .55, 0, 7); ctx.fill();
      } else if (p.type === 'star') {
        ctx.fillStyle = p.c; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? p.s * .45 : p.s, a = i * Math.PI / 5; ctx.lineTo(Math.sin(a) * r, -Math.cos(a) * r); }
        ctx.fill();
      } else if (p.type === 'tomato') {
        ctx.fillStyle = '#e3262c'; ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 7); ctx.fill(); ctx.fillStyle = '#ff8a7a'; ctx.beginPath(); ctx.arc(-p.s * .3, -p.s * .3, p.s * .3, 0, 7); ctx.fill();
        ctx.fillStyle = '#2fc43c'; ctx.fillRect(-p.s * .3, -p.s * 1.1, p.s * .6, p.s * .4);
      } else { ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * (0.4 + Math.abs(Math.sin(p.rot * 3)))); }
      ctx.restore();
    }
    raf = parts.length ? requestAnimationFrame(step) : 0;
    if (!raf) ctx.clearRect(0, 0, W, H);
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  return {
    // explosión desde un punto (x, y relativos a la ventana)
    burst(x, y, n = 80, opts = {}) {
      for (let i = 0; i < n; i++) {
        const a = rnd(0, Math.PI * 2), v = rnd(opts.min ?? 250, opts.max ?? 750);
        add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opts.up ?? 250), rot: rnd(0, 6), vr: rnd(-12, 12), s: rnd(7, 13), life: rnd(1.6, 2.8),
          c: (opts.colors || COLORS)[i % (opts.colors || COLORS).length], type: opts.type || (Math.random() < 0.18 ? 'star' : 'paper'), drag: 0.985 });
      }
    },
    // lluvia desde arriba
    rain(n = 60, type = 'paper', colors) {
      for (let i = 0; i < n; i++) setTimeout(() => add({ x: rnd(0, W || 360), y: -20, vx: rnd(-60, 60), vy: rnd(80, 260), rot: rnd(0, 6), vr: rnd(-8, 8), s: type === 'paper' ? rnd(8, 13) : rnd(10, 16),
        life: 4, c: (colors || COLORS)[i % (colors || COLORS).length], type, g: type === 'paper' ? 220 : 520, drag: 0.995 }), i * 22);
    },
    // fuente de monedas o tomates (premios)
    fountain(x, y, n = 30, type = 'coin') {
      for (let i = 0; i < n; i++) setTimeout(() => add({ x, y, vx: rnd(-260, 260), vy: rnd(-900, -520), rot: rnd(0, 6), vr: rnd(-10, 10), s: rnd(9, 14), life: 2.6, type, g: 1300 }), i * 30);
    },
    resize: size,
    clear() { parts = []; },
  };
}

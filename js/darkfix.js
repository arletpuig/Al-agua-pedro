// «Modo oscuro» forzado de Samsung Internet (y Chrome con «oscurecer webs»): el navegador aclara los colores oscuros del texto,
// así que los contornos negros de las letras (-webkit-text-stroke) se vuelven claros y los textos parecen manchas.
// Las sombras de texto no las toca: si el navegador puede estar oscureciendo la página, cada contorno se dibuja con sombras.
const shadowOutline = (w, c) => {
  const r = Math.max(1, Math.min(4, w / 2)), d = +(r * 0.7).toFixed(2);
  return [[r, 0], [-r, 0], [0, r], [0, -r], [d, d], [-d, d], [d, -d], [-d, -d]].map(([x, y]) => `${x}px ${y}px 0 ${c}`).join(', ');
};
export const forcedDarkRisk = () => {
  if (/[?&]fd\b/.test(location.search)) return true;   // para probarlo
  return /SamsungBrowser/i.test(navigator.userAgent) && matchMedia('(prefers-color-scheme: dark)').matches;
};
function collect(rules, out) {
  for (const r of rules) {
    if (r.cssRules && !r.selectorText) { collect(r.cssRules, out); continue; }   // @media, @supports
    const st = r.style; if (!st || !r.selectorText) continue;
    // «-webkit-text-stroke: 9px var(--ink)»: con variables, el navegador solo da el texto del atajo, así que se lee a mano
    const short = st.getPropertyValue('-webkit-text-stroke').trim(), m = /^([\d.]+)px\s*(.*)$/.exec(short);
    const w = m ? +m[1] : parseFloat(st.getPropertyValue('-webkit-text-stroke-width')) || 0;
    if (!w) continue;
    const c = (m && m[2].trim()) || st.getPropertyValue('-webkit-text-stroke-color').trim() || 'var(--ink)';
    const prev = st.getPropertyValue('text-shadow').trim();
    const sel = r.selectorText.split(',').map(s => 'html.fd ' + s.trim()).join(', ');
    out.push(`${sel} { -webkit-text-stroke-width: 0 !important; text-shadow: ${shadowOutline(w, c)}${prev && prev !== 'none' ? ', ' + prev : ''} !important; }`);
  }
}
export function applyDarkFix() {
  if (!forcedDarkRisk()) return false;
  document.documentElement.classList.add('fd');
  const out = [];
  for (const sh of document.styleSheets) { try { collect(sh.cssRules, out); } catch (e) {} }
  const el = document.createElement('style'); el.id = 'darkfix'; el.textContent = out.join('\n'); document.head.appendChild(el);
  return true;
}

// iPhone/iPad: al pulsar muy rápido, Safari hacía zoom (doble toque), movía la página o seleccionaba texto.
// Aquí se bloquea todo eso. Solo se puede desplazar dentro de las ventanas con lista (.sheet-body).
const opt = { passive: false };
const SCROLL = '.sheet-body';
const TAPPABLE = 'button:not(#btn-click), a, input, label, select, textarea';   // botones normales: su toque sigue funcionando

// zoom con dos dedos (gestos propios de Safari)
for (const t of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(t, e => e.preventDefault(), opt);
// arrastrar: nada de mover la página; dentro de las listas sí se puede, con un dedo
document.addEventListener('touchmove', e => {
  if (e.touches.length > 1 || !e.target.closest?.(SCROLL)) e.preventDefault();
}, opt);
// doble toque rápido = zoom en Safari: se anula (el botón ¡DALE! cuenta sus toques al apoyar el dedo, así que no pierde ninguno)
let last = 0;
document.addEventListener('touchend', e => {
  const now = e.timeStamp;
  if (now - last < 400 && e.changedTouches.length === 1 && !e.target.closest?.(TAPPABLE)) e.preventDefault();
  last = now;
}, opt);
document.addEventListener('dblclick', e => e.preventDefault(), opt);

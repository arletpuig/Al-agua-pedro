// Datos del titular de la web (Aviso legal, Privacidad y Cookies los leen de aquí).
// Rellena estos campos: se actualizan las tres páginas a la vez.
window.TITULAR = {
  nombre: '',        // nombre y apellidos (o razón social)
  nif: '',           // NIF / DNI
  domicilio: '',     // dirección postal
  email: '',         // correo de contacto (también para ejercer los derechos de privacidad)
  web: 'alaguapedro.es',
  actualizado: '13 de noviembre de 2026',
};
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-t]').forEach(el => {
    const v = window.TITULAR[el.dataset.t];
    if (v) { el.textContent = v; if (el.dataset.t === 'email' && el.tagName === 'A') el.href = 'mailto:' + v; }
    else { el.textContent = '(pendiente de completar)'; el.classList.add('pend'); }
  });
});

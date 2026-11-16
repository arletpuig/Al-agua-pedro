// Actualización del juego: si el móvil tiene guardado código viejo (caché del navegador o de la app instalada),
// se descarga todo de nuevo y se recarga. Como mucho una vez cada 10 minutos, para no entrar nunca en bucle.
const KEY = 'alaguapedro.forceUpdate';
export const VERSION = +(new URL(document.querySelector('script[src*="js/main.js"]')?.src || location.href).searchParams.get('v') || 0);

export async function forceUpdate() {
  try { if (Date.now() - (+sessionStorage.getItem(KEY) || 0) < 600e3) return false; sessionStorage.setItem(KEY, String(Date.now())); } catch (e) {}
  try {
    const urls = new Set([location.href.split('#')[0]]);
    for (const e of performance.getEntriesByType('resource')) { const u = new URL(e.name); if (u.origin === location.origin && /\.(js|css|html|webmanifest)$/.test(u.pathname)) urls.add(e.name); }
    document.querySelectorAll('script[src], link[rel=stylesheet]').forEach(el => { const u = el.src || el.href; if (u && new URL(u).origin === location.origin) urls.add(u); });
    await Promise.all([...urls].map(u => fetch(u, { cache: 'reload' }).catch(() => {})));
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
    const reg = await navigator.serviceWorker?.getRegistration?.(); await reg?.update?.().catch(() => {});
  } catch (e) {}
  location.reload();
  return true;
}

// ¿Hay publicada una versión más nueva que la que está corriendo? (la página siempre se pide sin caché)
export async function checkVersion() {
  if (!VERSION || window.__AAP_NOUPDATE) return false;
  try {
    const html = await (await fetch(location.pathname + '?nv=' + Date.now(), { cache: 'no-store' })).text();
    const live = +(/versión (\d+)/.exec(html)?.[1] || 0);
    if (live > VERSION) return forceUpdate();
  } catch (e) {}
  return false;
}

// AL AGUA PEDRO · service worker: con la app instalada, el juego abre más rápido y aunque la conexión vaya mal.
// - Código y páginas: primero la red (siempre la última versión publicada); sin conexión, lo último guardado.
// - Imágenes y fuentes: lo guardado al momento y se actualiza por detrás.
// - Supabase, Google, anuncios, pagos y la música: no pasan por aquí (van directos).
const CACHE = 'aap-v6';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin || /\.mp3$/.test(u.pathname)) return;
  if (/\.(png|jpe?g|svg|webp|woff2?|ico)$/.test(u.pathname)) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(r);
      const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  e.respondWith(fetch(r).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
    return res;
  }).catch(async () => (await caches.match(r)) || (r.mode === 'navigate' ? caches.match('./') : Response.error())));
});

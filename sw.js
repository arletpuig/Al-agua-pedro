// AL AGUA PEDRO · service worker: con la app instalada, el juego abre más rápido y aunque la conexión vaya mal.
// - Código y páginas: primero la red (siempre la última versión publicada); sin conexión, lo último guardado.
// - Imágenes y fuentes: lo guardado al momento y se actualiza por detrás.
// - Supabase, Google, anuncios, pagos y la música: no pasan por aquí (van directos).
const CACHE = 'aap-v72';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
// avisos del servidor (cofre diario y recordatorio)
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data?.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'AL AGUA PEDRO', {
    body: d.body || '¡Pedro te espera!', icon: 'assets/icons/icon-192.png', badge: 'assets/icons/badge-96.png',
    tag: d.tag || 'aap', renotify: true, data: { url: d.url || './' }, vibrate: [60, 40, 120],
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = all.find(c => c.url.startsWith(self.registration.scope));
    if (open) { await open.focus(); return; }
    await self.clients.openWindow(url);
  })());
});
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
  // código y páginas: siempre se pregunta al servidor si hay algo nuevo (nunca se usa una copia vieja si hay conexión)
  e.respondWith((r.mode === 'navigate' ? fetch(r) : fetch(r, { cache: 'no-cache' })).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
    return res;
  }).catch(async () => (await caches.match(r)) || (r.mode === 'navigate' ? caches.match('./') : Response.error())));
});

/* Offline cache for the static app shell (network-first for the API, cache-first for app files). */
const CACHE = 'agps-v1.0.0';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'icons/icon.svg', 'css/studio.css',
  'js/core/util.js', 'js/core/schema.js', 'js/core/storage.js', 'js/core/i18n.js',
  'js/engine/context.js', 'js/engine/compiler.js', 'js/engine/image.js', 'js/engine/meshy.js', 'js/engine/gameplay.js',
  'js/engine/existing.js', 'js/engine/android.js', 'js/engine/router.js', 'js/engine/categories.js',
  'js/data/presets.js', 'js/data/templates.js', 'js/ui/app.js',
  'tests/harness.js', 'tests/specs/core.spec.js', 'tests/specs/prompts.spec.js', 'tests/specs/routing.spec.js',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/api/')) return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const net = fetch(e.request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});

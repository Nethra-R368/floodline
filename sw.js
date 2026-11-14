// Keeps FloodLine usable with no internet: after one visit, the app, its libraries, fonts and
// any map tiles already seen are served from the device. AI calls to the cloud are never cached.
const CACHE = 'floodline-v2';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/app.js', 'js/bench.js', 'js/map.js', 'js/util.js', 'js/ai.js', 'js/firebase-config.js',
  'js/core/dedupe.js', 'js/core/extract.js', 'js/core/gazetteer.js', 'js/core/hardset.js', 'js/core/input.js',
  'js/core/priority.js', 'js/core/prompt.js', 'js/core/sim.js', 'js/core/store.js',
];
const CACHEABLE_HOSTS = ['cdnjs.cloudflare.com', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'tile.openstreetmap.org'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const cdn = CACHEABLE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  if (!sameOrigin && !cdn) return; // AI, App Check, reCAPTCHA: always live network
  // Stale-while-revalidate: answer from the device at once, refresh the copy in the background.
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(req, { ignoreSearch: sameOrigin });
    const fresh = fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    }).catch(() => hit || (req.mode === 'navigate' ? cache.match('index.html') : Response.error()));
    return hit || fresh;
  }));
});

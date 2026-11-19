// Keeps FloodLine usable with no internet: after one visit, the app, its libraries, fonts and
// any map tiles already seen are served from the device. AI calls to the cloud are never cached.
const CACHE = 'floodline-v11';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css', 'icon.svg',
  'js/app.js', 'js/bench.js', 'js/map.js', 'js/util.js', 'js/ai.js', 'js/firebase-config.js',
  'js/core/dedupe.js', 'js/core/extract.js', 'js/core/gazetteer.js', 'js/core/hardset.js', 'js/core/input.js',
  'js/core/priority.js', 'js/core/prompt.js', 'js/core/realset.js', 'js/core/realstream.js', 'js/core/realstream_ai.js', 'js/core/security.js', 'js/firebase.js', 'js/sync.js', 'js/core/sim.js', 'js/core/store.js', 'js/core/measured.js', 'js/core/evaluate.js', 'js/case.js', 'js/label.js', 'label.html',
];
const CACHEABLE_HOSTS = ['cdnjs.cloudflare.com', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'tile.openstreetmap.org'];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache, so a new version never precaches old files.
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
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

  e.respondWith(caches.open(CACHE).then(async (cache) => {
    if (sameOrigin) {
      // FloodLine's own files: newest from the network when online, the saved copy when offline.
      try {
        const res = await fetch(req, { cache: 'no-cache' });
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req, { ignoreSearch: true }))
          || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
      }
    }
    // Libraries, fonts and map tiles have fixed URLs: the saved copy first, the network otherwise.
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }));
});

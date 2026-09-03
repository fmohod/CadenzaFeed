// Service worker for /betatest/ — offline after first load.
// Network first, cache fallback, for every same-origin GET this page makes. The
// cache is only ever a copy of what the network already served, so it can never
// show something newer than the site and never blocks an update.
const CACHE = 'cadenza-arthouse-world-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(req).then((res) => {
            if (res && res.ok) {
                const copy = res.clone();
                caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
            }
            return res;
        }).catch(() =>
            // Exact URL first (the ?v= query is the version); only then any version
            // of the same file, which beats a blank page when a version was never
            // fetched online.
            caches.match(req).then(hit => hit || caches.match(req, { ignoreSearch: true }))
                .then(hit => hit || Response.error())
        )
    );
});

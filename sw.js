const CACHE = 'alves-pro-ocr-v3';
const APP_SHELL = ['./', './index.html', './icone.png', './manifest.json'];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'tessdata.projectnaptha.com', 'cdnjs.cloudflare.com', 'www.gstatic.com'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(APP_SHELL.map(u => c.add(u)))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isCDN = CDN_HOSTS.includes(url.hostname);
  const isSame = url.origin === self.location.origin;
  if (!isCDN && !isSame) return; // Firebase (dados/auth) sempre via rede

  if (isCDN) {
    // Cache-first: bibliotecas e modelo de idioma do OCR
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  // App: rede primeiro, cache como fallback (offline)
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) {
        const cp = res.clone();
        caches.open(CACHE).then(c => c.put(req, cp));
      }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});

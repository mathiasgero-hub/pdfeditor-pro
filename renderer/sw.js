/**
 * sw.js — Service Worker PDFEdit Pro
 * Met en cache les assets statiques pour un fonctionnement hors ligne.
 */

// Incrémenter à chaque déploiement pour purger l'ancien cache
const CACHE_NAME = 'pdfedit-v4';

// Fichiers à mettre en cache au premier chargement
const PRECACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/web-shim.js',
  '/manifest.json',
  '/icon.png',
  '/icon.ico',
];

// ─── Installation : pré-cache des assets ─────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // cache:'reload' : ne pas reprendre une copie périmée du cache HTTP
      cache.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' }))))
  );
  self.skipWaiting();
});

// ─── Activation : nettoyage des anciens caches ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Fetch : network-first (mises à jour immédiates), cache en secours hors ligne ─
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignorer les requêtes non-GET et hors domaine (CDN, API externes)
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Revalider auprès du serveur plutôt que de servir le cache HTTP (anciennes
  // réponses "immutable") ; une requête de navigation ne peut pas être reconstruite.
  const req = event.request.mode === 'navigate'
    ? event.request
    : new Request(event.request, { cache: 'no-cache' });

  event.respondWith(
    fetch(req)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached =>
          cached || (event.request.mode === 'navigate' ? caches.match('/index.html') : Response.error())))
  );
});

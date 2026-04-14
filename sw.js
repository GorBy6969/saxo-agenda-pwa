/* ══════════════════════════════════════════════════════════
   sw.js — Service Worker minimal pour PWA
   ──────────────────────────────────────────────────────────
   Rôle :
     - Permet à Chrome Android de proposer "Ajouter à l'écran d'accueil"
     - Met en cache les ressources statiques pour un démarrage hors-ligne
     - Les données (API Vercel KV) ne sont PAS mises en cache
       (elles transitent toujours par le réseau pour rester à jour)

   Stratégie : Cache First pour les statiques, Network Only pour /api/*
   ══════════════════════════════════════════════════════════ */

/* Nom du cache versionné — incrémenter à chaque déploiement majeur */
const CACHE_NAME = 'saxo-agenda-v2';

/* Ressources à précacher lors de l'installation */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/css/app.css',
  '/js/storage.js',
  '/js/ui.js',
  '/js/events.js',
  '/js/calendar.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];


/* ── Événement INSTALL : précache les ressources statiques ── */
self.addEventListener('install', event => {
  console.log('[SW] Installation…');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Précache des ressources statiques');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => self.skipWaiting()) // active immédiatement sans attendre
  );
});


/* ── Événement ACTIVATE : nettoie les anciens caches ── */
self.addEventListener('activate', event => {
  console.log('[SW] Activation…');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME) // supprime les caches obsolètes
          .map(key => {
            console.log('[SW] Suppression ancien cache :', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim()) // prend le contrôle immédiatement
  );
});


/* ── Événement FETCH : interception des requêtes ── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* Les appels API passent toujours par le réseau (données fraîches) */
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  /* Pour les ressources statiques : Cache First, fallback réseau */
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        return cached; // réponse depuis le cache
      }
      /* Non trouvé en cache → réseau, puis on met à jour le cache */
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      });
    })
  );
});

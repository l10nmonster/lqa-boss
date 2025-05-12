// sw.js - Basic Caching Service Worker
const CACHE_NAME = 'lqa-viewer-v1';
// Adjust these paths based on your GitHub Pages repository name and where these files are located.
// These paths are relative to the Service Worker's scope.
// If sw.js is at /lqa-boss/sw.js and scope is /lqa-boss/,
// then paths like 'index.html' are correct if index.html is also at /lqa-boss/index.html.
const urlsToCache = [
    '.', // Alias for the directory the SW is in, often the start_url effectively
    'index.html',
    'viewer.css',
    'js/main.js',
    'js/eventHandlers.js',
    'js/dataManager.js',
    'js/ui.js',
    'libs/jszip.min.js',
    'manifest.webmanifest', // Cache the manifest too
    'icons/icon-512x512.png'
];

self.addEventListener('install', event => {
    console.log('[Service Worker] Install');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                return self.skipWaiting(); // Activate worker immediately
            })
    );
});

self.addEventListener('activate', event => {
    console.log('[Service Worker] Activate');
    // Remove old caches
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim(); // Take control of open clients
        })
    );
});

self.addEventListener('fetch', event => {
    // console.log('[Service Worker] Fetching:', event.request.url);
    // Cache-first strategy for app shell assets
    if (urlsToCache.some(url => event.request.url.endsWith(url.startsWith('.') ? 'index.html' : url))) {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    return response || fetch(event.request);
                })
        );
    } else {
        // For other requests (e.g., dynamic data, non-cached assets), go network first
        // or implement a more sophisticated caching strategy.
        // For a simple viewer that loads local files, this might be sufficient.
        event.respondWith(fetch(event.request).catch(() => {
             // Basic offline fallback for non-app shell items, if needed.
             // For this app, most action happens after file load, so network fallback is okay.
        }));
    }
});
// sw.js - CyberSentinel Service Worker
const CACHE_NAME = 'cs-vfx-v1';
const ASSETS = [
  './index.html',
  './js/RenderManager.js',
  './js/AudioEngine.js',
  './js/i18n.js',
  './vfx/AuroraBars.js',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
];

// 安裝並快取資源 (符合 SDG 12: 責任生產與消費)
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// 攔截請求：優先從快取讀取 (符合 SDG 7: 極致節能)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
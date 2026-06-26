const CACHE_NAME = 'zakup-pwa-v2'; // Поменяли версию на v2, чтобы сбросить старый кэш
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

// Установка: кэшируем новые файлы
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting(); // Принудительно активируем новый sw сразу же
});

// Активация: удаляем абсолютно ВСЕ старые кэши, которые блокировали сайт
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Запрос файлов: сначала берем свежее из сети, а если интернета нет — из кэша
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Если из сети всё загрузилось, обновляем копию в кэше
        if (response.status === 200) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Если интернета нет, отдаем из кэша
        return caches.match(event.request);
      })
  );
});
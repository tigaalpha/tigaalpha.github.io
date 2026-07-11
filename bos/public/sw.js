// Minimal network-first service worker — enough for "Add to Home Screen"
// installability plus a usable offline fallback for pages already visited.
// Registered scoped to /studio/, so it never touches the unrelated site at
// the repo root.
const CACHE_NAME = "tiga-bos-shell-v1";

self.addEventListener("install", (event) => {
  const scope = self.registration.scope;
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll([scope, `${scope}login/`]))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(event.request, copy))
          .catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

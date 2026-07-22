/* TiGA Piano service worker — app-shell cache for offline use.
   Stale-while-revalidate for navigations: serve cached index.html instantly
   then update cache in background so next visit is always fresh.
   Cross-origin requests (AI API, fonts) are left untouched. */
const CACHE = "tiga-v9";
const SHELL = ["./", "./manifest.webmanifest", "./icon.svg", "./alipay.jpg", "./wechat.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window" })
        .then((ws) => ws.forEach((w) => w.postMessage({ type: "SW_RELOAD" }))))
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Navigation: stale-while-revalidate — serve cached shell immediately, update in background
  if (req.mode === "navigate") {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const networkFetch = fetch(req).then((resp) => {
            if (resp && resp.status === 200) cache.put(req, resp.clone());
            return resp;
          }).catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((resp) => { const cp = resp.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); return resp; }).catch(() => cached)
    )
  );
});

/* re-engagement push (e.g. "your streak is about to end") — payload is JSON:
   { title, body, url } sent by the send-reminders edge function */
self.addEventListener("push", (e) => {
  let data = { title: "TiGA AI", body: "" };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch (err) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "./icon.svg",
      badge: "./icon.svg",
      tag: data.tag || "tiga-reminder",
      data: { url: data.url || "./" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

/* TiGA Piano service worker — app-shell cache for offline use.
   Network-first for navigations (so updates show when online), cache fallback
   when offline. Cross-origin requests (AI API, fonts) are left untouched. */
const CACHE = "tiga-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // don't cache API / CDN / cross-origin

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put("./index.html", cp)); return r; })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
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

// v10: network-first for JS/CSS to prevent stale cached bundles.
// v14: "network-first" was still handing fetch() to the BROWSER'S OWN HTTP
// cache, which GitHub Pages' default Cache-Control lets satisfy a request
// for several minutes with no request ever reaching the origin - so a user
// who reopens the app within that window can get old HTML/CSS even though
// the SW's own logic never touched a stale byte. cache:"no-store" forces an
// actual round trip every time. Bumped cache name to v14 so every client
// reinstalls this SW once.
const CACHE = "tiga-v14";
const ASSETS = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: "window" }).then(clients => {
        clients.forEach(c => c.postMessage({ type: "SW_UPDATED" }));
      }))
  );
});

// Re-engagement push (see shared-infra.ts subscribePush / the send-streak-reminders
// Edge Function) arrives here as { title, body, url, tag } — without this handler
// the push event fires but nothing is ever shown, silently.
self.addEventListener("push", e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) {}
  const title = data.title || "TIGA.AI";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || "tiga-notify",
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: data.url || "./", page: data.page || null },
    })
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  const page = (e.notification.data && e.notification.data.page) || null;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      // An already-open tab can only be focused, not navigated, from here — so
      // hand it a NAVIGATE message and let the app's own router act on it
      // (see App.tsx's serviceWorker message listener). A fresh launch instead
      // opens `url` directly, whose #hash the app reads once on boot.
      for (const c of list) {
        if ("focus" in c) { if (page) c.postMessage({ type: "NAVIGATE", page }); return c.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for HTML (always get the freshest app code). cache:"no-store"
  // is the part that actually matters - without it this is "network-first
  // according to the browser's HTTP cache", which is not the same promise.
  const isHtml = url.pathname === "/" || url.pathname.endsWith(".html");
  if (isHtml) {
    e.respondWith(
      fetch(e.request, { cache: "no-store" }).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Network-first for JS/CSS (prevent stale cached bundles)
  const isJsCss = url.pathname.endsWith(".js") || url.pathname.endsWith(".css") ||
    url.pathname.includes("/assets/");
  if (isJsCss) {
    e.respondWith(
      fetch(e.request, { cache: "no-store" }).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for other static assets (icons, manifests)
  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => null);
      return cached || net;
    })
  );
});

// v10: network-first for JS/CSS to prevent stale cached bundles.
// v16: clients.claim() raced a page's message listener - a tab left open from
// the night before could miss SW_UPDATED and run yesterday's bundle until a
// manual reload. controllerchange now also notifies (top-level listener), and
// the cache name bumps so every client reinstalls this worker once.
// v15: and that "bumped once, by hand" was the whole problem. A browser only
// reinstalls a worker whose BYTES changed, and the build copied this file
// verbatim, so it never changed, so `activate` below never ran, so the
// SW_UPDATED message App.tsx reloads on was never sent. Anyone with the app
// open kept running the build they first loaded. fda7d24cf878 is replaced at
// build time with a hash of the page itself (scripts/stamp-sw.mjs), so this
// file now changes exactly when the app does.
const CACHE = "tiga-v16-fda7d24cf878";
// v18: content-hashed build output (scripts, styles, fonts, the 3D worker)
// lives in a cache of its own that a new release does NOT throw away. Its
// filenames change whenever its bytes do, so a copy can never be stale — yet
// every release used to delete it along with the per-build cache, and a
// returning visitor re-downloaded the 3D renderer, the typefaces and every
// lazy page that had not changed at all. Only the files a release actually
// changed are fetched now. Oldest entries are pruned past ASSET_MAX.
const ASSET_CACHE = "tiga-assets-v1";
const ASSET_MAX = 140;
const HASHED = /\/bundle\/[^/]*-[A-Za-z0-9_-]{8,}\.[a-z0-9]+$/;
const ASSETS = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

// v17: only an UPDATE tells pages to reload — never a first install. activate
// used to post SW_UPDATED unconditionally, so the very first time a visitor
// reached the app (no worker yet, nothing stale anywhere) it still got
// reloaded ~1.3s after loading: 11 of 92 first visits in the week to 24 Sep,
// a lower bound, because the boot row is written 1.5s after paint and the
// reload usually got there first. The landing page registers no worker, so
// that first visit is exactly the Google-sign-up return — reloaded while the
// ?code= was being exchanged. A first install is serving the page the build
// it was just loaded with; there is nothing to reload into.
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => {
        const stale = keys.filter(k => k !== CACHE && k !== ASSET_CACHE);
        return Promise.all(stale.map(k => caches.delete(k))).then(() => stale.length > 0);
      })
      .then(wasUpdate => caches.open(ASSET_CACHE)
        .then(c => c.keys().then(ks => Promise.all(ks.slice(0, Math.max(0, ks.length - ASSET_MAX)).map(k => c.delete(k)))))
        .catch(() => {})
        .then(() => wasUpdate))
      .then(wasUpdate => self.clients.claim().then(() => wasUpdate))
      .then(wasUpdate => {
        if (!wasUpdate) return;
        return self.clients.matchAll({ type: "window" }).then(clients => {
          clients.forEach(c => c.postMessage({ type: "SW_UPDATED" }));
        });
      })
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
  /* A directory URL like /landing/ is a page, but it is neither "/" nor
     *.html, so it used to fall through to the cache-first branch at the
     bottom and a returning visitor could be served a stale copy of a page we
     had already replaced. request.mode === "navigate" is the reliable test:
     it is exactly "the browser is loading a document here". */
  const isHtml = e.request.mode === "navigate" ||
    url.pathname === "/" || url.pathname.endsWith(".html");
  if (isHtml) {
    e.respondWith(
      fetch(e.request, { cache: "no-store" }).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  /* Build output under /assets/ is content-hashed by Vite: the filename
     changes whenever the bytes do, so a cached copy can never be stale and
     re-fetching one is pure waste. Cache-first here is what makes a second
     visit cost a few kB of HTML instead of the whole bundle. The HTML itself
     stays network-first above, so it is always the freshest index.html that
     decides which hashed file to ask for. */
  if (HASHED.test(url.pathname)) {
    e.respondWith(
      caches.open(ASSET_CACHE).then(c => c.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        if (res.ok) c.put(e.request, res.clone());
        return res;
      })))
    );
    return;
  }

  // Network-first for any other JS/CSS (unhashed names could go stale)
  const isJsCss = url.pathname.endsWith(".js") || url.pathname.endsWith(".css") ||
    url.pathname.includes("/bundle/") || url.pathname.includes("/assets/");
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

/* ── space3d.tsx ──
   The host: the small piece that lives on the page. It decides where the
   room is drawn — in a Web Worker on an OffscreenCanvas wherever the browser
   allows it, on the page only where it does not — and it is the room's eyes
   on the page: it measures where the subject's feet are on the canvas, how
   far the page has scrolled, where the pointer is and whether the room is on
   screen at all, and sends only what changed.

   Nothing here imports three.js. In worker mode the page never downloads
   the renderer into its own thread at all; the worker fetches its own
   bundle. */
import { lazy, Suspense, useEffect, useRef, useState, useCallback } from "react";
import { rememberTier } from "./space-stage";
import workerUrl from "./space3d-worker.tsx?worker&url";

const MainCanvas = lazy(() => import("./space3d-main"));

const readDbg = () => { try { return localStorage.getItem("tg_3d_dbg") || ""; } catch (e) { return ""; } };
const canTransfer = () => {
  try {
    return typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined"
      && typeof HTMLCanvasElement !== "undefined" && "transferControlToOffscreen" in HTMLCanvasElement.prototype;
  } catch (e) { return false; }
};
const dprFor = (tier) => Math.min(tier >= 3 ? 2 : tier >= 2 ? 1.5 : 1.25, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
const newFeed = () => {
  const now = performance.now();
  return { anchor: null, ground: 0.95, scroll: 0, pointer: [0, 0], busy: now, quiet: false, hidden: false, wake: now + 4200, data: null, reduced: false };
};
const newBus = () => {
  const subs = new Set();
  return { on(f) { subs.add(f); return () => subs.delete(f); }, emit(e) { subs.forEach((f) => { try { f(e); } catch (err) {} }); } };
};

/* warm whichever renderer this browser will use, before anybody opens a room */
export function prefetchRenderer() {
  if (readDbg().indexOf("main") < 0 && canTransfer()) {
    try { fetch(workerUrl, { credentials: "same-origin" }).catch(() => {}); } catch (e) {}
  } else {
    import("./space3d-main").catch(() => {});
  }
}

export default function Space3D({ variant = "lobby", tier: tier0 = 2, stage = null, anchor = null, scroller = null, bus = null, data = null, quiet = null, reduced = false, onReady, onLost }) {
  const [dbg] = useState(readDbg);
  const [mode, setMode] = useState(() => (dbg.indexOf("main") >= 0 || !canTransfer() ? "main" : "worker"));
  /* drawn on the page's own thread, the room stays at the light tier: it
     shares that thread with scrolling and with the pet being turned */
  const [tier, setTier] = useState(() => (dbg.indexOf("main") >= 0 || !canTransfer() ? Math.min(1, tier0) : tier0));
  const tierRef = useRef(tier); tierRef.current = tier;
  const wrap = useRef(null), cv = useRef(null);
  const feed = useRef(null); if (!feed.current) { feed.current = newFeed(); feed.current.reduced = !!reduced; }
  const localBus = useRef(null); if (!localBus.current) localBus.current = newBus();
  const sink = useRef(null);
  const cbs = useRef({ onReady, onLost }); cbs.current = { onReady, onLost };

  // the device fell behind: one tier down, remembered for next time; below
  // the lightest tier the page keeps its still backdrop instead
  const stepDown = useCallback(() => {
    const t = tierRef.current;
    if (t <= 1) { rememberTier(0); cbs.current.onLost && cbs.current.onLost("slow"); return; }
    rememberTier(t - 1);
    setTier(t - 1);
    if (sink.current && sink.current.tier) sink.current.tier(t - 1);
  }, []);

  // ── main mode: the feed is written directly ──
  useEffect(() => {
    if (mode !== "main") return undefined;
    sink.current = {
      feed: (p, poke) => { Object.assign(feed.current, p); if (poke) feed.current.busy = performance.now(); },
      bus: (e) => { feed.current.busy = performance.now(); localBus.current.emit(e); },
      size: () => {},
      tier: () => {},
    };
    return () => { sink.current = null; };
  }, [mode]);

  // ── worker mode: the canvas goes to the worker, the feed goes by message ──
  useEffect(() => {
    if (mode !== "worker") return undefined;
    const c = cv.current, w = wrap.current;
    if (!c || !w || c.__sp3) return undefined;
    let worker = null;
    try {
      // a classic script in production (one iife bundle); vite's dev server
      // serves workers as modules
      worker = import.meta.env.DEV ? new Worker(workerUrl, { type: "module" }) : new Worker(workerUrl);
    } catch (e) { setMode("main"); return undefined; }
    let off = null;
    try { off = c.transferControlToOffscreen(); c.__sp3 = true; } catch (e) { worker.terminate(); setMode("main"); return undefined; }
    const r = w.getBoundingClientRect();
    const t = tierRef.current;
    let gone = false;
    const fallBack = () => { if (gone) return; gone = true; try { worker.terminate(); } catch (e) {} setMode("main"); };
    worker.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === "ready") cbs.current.onReady && cbs.current.onReady();
      else if (m.type === "slow") stepDown();
      else if (m.type === "fail") { setTier((x) => Math.min(1, x)); fallBack(); }
      else if (m.type === "lost") cbs.current.onLost && cbs.current.onLost("lost");
      else if (m.type === "info") { try { window.__sp3w = m.i; } catch (err) {} }
    };
    worker.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); setTier((x) => Math.min(1, x)); fallBack(); };
    const { anchor: a0, ground, scroll, pointer, quiet: q0, hidden, data: d0, reduced: rd } = feed.current;
    worker.postMessage({
      type: "init", canvas: off, variant, tier: t, stage, w: r.width, h: r.height, dpr: dprFor(t), dbg, reduced: rd,
      feed: { anchor: a0, ground, scroll, pointer, quiet: q0, hidden, data: d0 },
    }, [off]);
    sink.current = {
      feed: (p, poke) => { Object.assign(feed.current, p); worker.postMessage({ type: "feed", feed: p, poke: !!poke }); },
      bus: (e) => worker.postMessage({ type: "bus", e }),
      size: (ww, hh) => worker.postMessage({ type: "size", w: ww, h: hh, dpr: dprFor(tierRef.current) }),
      tier: (tt) => worker.postMessage({ type: "tier", tier: tt, dpr: dprFor(tt) }),
    };
    return () => {
      gone = true; sink.current = null;
      try { worker.postMessage({ type: "dispose" }); } catch (e) {}
      setTimeout(() => { try { worker.terminate(); } catch (e) {} }, 250);
    };
  }, [mode]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ── the room's eyes on the page ──
  useEffect(() => {
    const w = wrap.current;
    if (!w) return undefined;
    const send = (p, poke) => { if (sink.current) sink.current.feed(p, poke); else Object.assign(feed.current, p); };
    let raf = 0, lastQ = null, lastA = "", lastData = "", aT = 0, dT = 0, ptr = null, scrolled = true;
    const measure = () => {
      const r = w.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const el = anchor && anchor.current;
      let A = null;
      if (el) {
        const e = el.getBoundingClientRect();
        if (e.width) {
          const foot = parseFloat(el.dataset.foot || "0.02");
          A = { nx: ((e.left + e.width / 2 - r.left) / r.width) * 2 - 1, ny: -((e.bottom - e.height * foot - r.top) / r.height) * 2 + 1 };
        }
      }
      const key = A ? A.nx.toFixed(4) + "," + A.ny.toFixed(4) : "-";
      if (key !== lastA) { lastA = key; send({ anchor: A }); }
      if (variant === "arena") {
        const st = w.closest(".pvpstage");
        if (st) {
          const f = parseFloat(getComputedStyle(st).getPropertyValue("--pvpfloor")) || 6;
          send({ ground: 1 - f / Math.max(1, st.clientHeight) });
        }
      }
    };
    const frac = () => {
      const el = scroller && scroller.current;
      if (!el) return 0;
      return Math.max(0, Math.min(1, el.scrollTop / Math.max(1, w.offsetHeight)));
    };
    const tick = (t) => {
      raf = requestAnimationFrame(tick);
      if (ptr) { send({ pointer: ptr }, true); ptr = null; }
      if (scrolled) { scrolled = false; send({ scroll: frac() }, true); }
      const q = !!(quiet && quiet.current);
      if (q !== lastQ) { lastQ = q; send({ quiet: q }); }
      if (t - aT > 400) { aT = t; measure(); }
      if (data && t - dT > 500) {
        dT = t;
        let s = ""; try { s = JSON.stringify(data.current || null); } catch (e) {}
        if (s !== lastData) { lastData = s; send({ data: data.current || null }); }
      }
    };
    raf = requestAnimationFrame(tick);
    const onPtr = (e) => { ptr = [(e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1]; };
    const onScroll = () => { scrolled = true; };
    // a touch wakes the room — unless it landed on the subject, which holds
    // the room still (quiet) in the same message, so no frame is spent between
    const onPoke = () => { const q = !!(quiet && quiet.current); lastQ = q; send({ quiet: q }, true); };
    window.addEventListener("pointermove", onPtr, { passive: true });
    window.addEventListener("pointerdown", onPoke, { passive: true });
    const sc = scroller && scroller.current;
    if (sc) sc.addEventListener("scroll", onScroll, { passive: true });
    let ro = null, io = null;
    if ("ResizeObserver" in window) {
      ro = new ResizeObserver(() => {
        const r = w.getBoundingClientRect();
        if (sink.current) sink.current.size(r.width, r.height);
        measure();
      });
      ro.observe(w);
      if (anchor && anchor.current) ro.observe(anchor.current);
    }
    // a room that is off screen, or in a hidden tab, draws nothing
    let onScreen = true;
    const vis = () => send({ hidden: document.hidden || !onScreen });
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; vis(); }, { threshold: 0 });
      io.observe(w);
    }
    document.addEventListener("visibilitychange", vis);
    const offBus = bus ? bus.on((e) => { if (sink.current) sink.current.bus(e); }) : null;
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPtr); window.removeEventListener("pointerdown", onPoke);
      if (sc) sc.removeEventListener("scroll", onScroll);
      if (ro) ro.disconnect(); if (io) io.disconnect();
      document.removeEventListener("visibilitychange", vis);
      if (offBus) offBus();
    };
  }, [mode, anchor, scroller, bus, data, quiet, variant]);

  return (
    <div className="sp3-cvw" ref={wrap}>
      {mode === "worker" ? (
        <canvas className="sp3-cv" ref={cv} />
      ) : (
        <Suspense fallback={null}>
          <MainCanvas variant={variant} tier={tier} stage={stage} feed={feed.current} bus={localBus.current} dpr={dprFor(tier)} dbg={dbg}
            onFirst={() => cbs.current.onReady && cbs.current.onReady()} onSlow={stepDown}
            onLost={() => cbs.current.onLost && cbs.current.onLost("lost")} />
        </Suspense>
      )}
    </div>
  );
}

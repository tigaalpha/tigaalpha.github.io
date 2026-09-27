/* ── tiga-gateway.ts — lazy gateway to tigamodel (plan v3 1.5) ──
   THE ONLY STATIC IMPORT OF tigamodel left in app code — and this module's
   own import is dynamic, so the ~1.18 MB model tree (minified, Bench v1)
   leaves the main chunk and loads on demand.

   Design, in one breath:
   • Single dynamic singleton — one import("./tigamodel/web.js") for the whole
     app; every subsequent call is a resolved-module lookup.
   • queuedUntilTiga(fn) — the safety net for SYNCHRONOUS call sites: calls
     fn(m) immediately when the model is already loaded, otherwise queues it
     for the moment the import lands. Nothing throws, nothing blocks paint,
     nothing calls into an undefined module.
   • useTiga(mapper, deps) — React hook so render-path consumers re-render
     once the model arrives (null → the card simply hasn't rendered yet, the
     app's standing honest-null convention).
   • preloadTigamodel() — requestIdleCallback warm-up in App.tsx, so the
     first practice result screen almost never waits on a cold import.

   The gateway forwards only what production surfaces actually call; Model Lab
   and TigamodelBackoffice keep their full-surface access through their own
   direct dynamic imports.

   Rollback: every consumer keeps its hub-absent fallback path (try/catch or
   honest-null), which is the same behavior they had on cold-boot stalls —
   so re-inlining any import site is a one-line revert. ── */

import { useEffect, useRef, useState } from "react";

let _tigaPromise = null;
let _tigaMod = null;
const _pending = [];

/** Resolve the tigamodel web module (cached after the first call). */
export function tigaPromise() {
  if (!_tigaPromise) {
    _tigaPromise = import("./tigamodel/web.js")
      .then(m => {
        _tigaMod = m;
        const q = _pending.splice(0);
        for (const fn of q) { try { fn(m); } catch (e) {} }
        try { window.dispatchEvent(new Event("tiga:ready")); } catch (e) {}
        return m;
      })
      .catch(e => { _tigaPromise = null; return null; }); // hub absent → callers' fallbacks, same as a cold-boot stall
  }
  return _tigaPromise;
}

/** Already loaded? (sync check for hot paths) */
export function tigaNow() { return _tigaMod; }

/** Fire fn(tigaModule) as soon as the model is available — now if loaded,
    otherwise right after the dynamic import resolves. Returns fn's result
    (so `await queuedUntilTiga(m => m.modelFn(args))` works for user-initiated
    calls); fire-and-forget callers simply ignore the return. When the model
    isn't loaded yet, resolves to fn's result once the import lands (or
    undefined on total failure — honest-null, never throws). */
export function queuedUntilTiga(fn) {
  if (_tigaMod) { try { return fn(_tigaMod); } catch (e) { return undefined; } }
  return tigaPromise().then(m => (m ? fn(m) : undefined)).catch(() => undefined);
}

/** Warm-up: call from a top-level effect (App boot) — loads the model when
    the browser is idle, so user-driven surfaces find it already there. */
export function preloadTigamodel() {
  const kick = () => { tigaPromise(); };
  try {
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") window.requestIdleCallback(kick, { timeout: 3000 });
    else setTimeout(kick, 1500);
  } catch (e) { kick(); }
}

/** Plan v3.3 5.1 — interaction-first preload: don't fight the learner's first
    tap for bandwidth. The engine starts loading after the first real usage
    signal (pointerdown/keydown/touchstart); idle remains only the fallback so
    a never-interacts flow still gets the model (timeout 8 s). Rollback = call
    preloadTigamodel() instead (one line in App.tsx). */
export function preloadTigamodelOnInteraction() {
  let started = false;
  const kick = () => {
    if (started) return;
    started = true;
    try {
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
      window.removeEventListener("touchstart", kick);
    } catch (e) {}
    tigaPromise();
  };
  try {
    if (typeof window === "undefined") { tigaPromise(); return; }
    window.addEventListener("pointerdown", kick, { passive: true });
    window.addEventListener("keydown", kick, { passive: true });
    window.addEventListener("touchstart", kick, { passive: true });
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(kick, { timeout: 8000 });
    else setTimeout(kick, 4000);
  } catch (e) { kick(); }
}

/* ── forwarded model functions (the lazy-aware surface app UI calls) ──
   Sync fns return null until the model has loaded — every caller already has
   an honest-null fallback (the same behavior a cold-boot stall used to give).
   The async one awaits the load, so a user-initiated call never dead-ends. */
export function newStudentFeedback(args) { return _tigaMod ? _tigaMod.newStudentFeedback(args) : null; }
export function selfReportFromTranscript(text) { return _tigaMod ? _tigaMod.selfReportFromTranscript(text) : null; }
export function rerunLoopWithSelfReport(practiceStats, selfReport, lang) {
  return tigaPromise()
    .then(m => (m && m.rerunLoopWithSelfReport) ? m.rerunLoopWithSelfReport(practiceStats, selfReport, lang) : null)
    .catch(() => null);
}

/** React hook: runs mapper(tigaModule) when the model is loaded and re-renders
    once if the first render happened before the dynamic import landed. mapper
    must be pure/sync and return null when the engines have nothing (honest
    hide). Called WITHOUT a mapper it returns the ready tick (0/1) so hosts can
    pass it down as a plain re-render prop. */
export function useTiga(mapper, deps = []) {
  const [tick, setTick] = useState(_tigaMod ? 1 : 0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    if (_tigaMod) { if (tick === 0) setTick(1); return () => { mountedRef.current = false; }; }
    tigaPromise().then(() => { if (mountedRef.current) setTick(1); });
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!tick || !_tigaMod) return null;
  return mapper ? mapper(_tigaMod) : tick;
}

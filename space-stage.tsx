/* ── space-stage.tsx ──
   The light half of the 3D spaces (PvP, pets, shop). Nothing here imports
   three.js: this file decides whether the device should get the real-time
   scene at all, at what quality, and hands a lazy chunk to React only when a
   page that uses it is actually open. Until that chunk has arrived and drawn
   its first frame, the page shows the static obsidian backdrop in CSS
   (.sp3-bg), so there is never a blank or a flash — the 3D fades in over it.

   Quality tiers
     0  no WebGL, or a GPU/driver that cannot keep up → CSS backdrop only
     1  phones and small GPUs: no mirror floor, no post-processing, 30 fps
     2  capable phones / tablets / laptops: mirror floor, bloom, vignette, 60 fps
     3  desktop-class: + depth of field, glass crystal, sharper reflections
   The scene also watches its own frame rate and steps DOWN a tier on its own
   if the device falls behind, and gives up to the still backdrop if even the
   lightest tier stutters — so a hot phone degrades instead of juddering. */
import { lazy, Suspense, useState, useCallback, useEffect, memo } from "react";

const Space3D = lazy(() => import("./space3d"));

let tierCache = null;
/* What this device has taught us: when the room had to step down a tier to
   keep up, the next page starts at that tier instead of stuttering its way
   down again. A new app version gets a fresh chance (the key carries it). */
const AUTO_KEY = "tg_3d_tier_auto";
export function rememberTier(t) {
  try { localStorage.setItem(AUTO_KEY, JSON.stringify({ t, v: typeof __APP_BUILD__ !== "undefined" ? __APP_BUILD__ : "" })); } catch (e) {}
  if (tierCache != null) tierCache = Math.min(tierCache, t);
}
function learnedTier() {
  try {
    const v = JSON.parse(localStorage.getItem(AUTO_KEY) || "null");
    if (v && typeof v.t === "number" && v.v === (typeof __APP_BUILD__ !== "undefined" ? __APP_BUILD__ : "")) return v.t;
  } catch (e) {}
  return 3;
}
export function spaceTier() {
  if (tierCache != null) return tierCache;
  try {
    const forced = localStorage.getItem("tg_3d_tier");
    if (forced != null && forced !== "") return (tierCache = Math.max(0, Math.min(3, Number(forced) | 0)));
  } catch (e) {}
  let t = 0;
  try {
    const cv = document.createElement("canvas");
    const gl = cv.getContext("webgl2", { powerPreference: "high-performance" });
    if (gl) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      const gpu = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) || "");
      const soft = /swiftshader|llvmpipe|software/i.test(gpu);
      const weakGpu = soft || /mali-4|mali-t[678]|adreno \(tm\) [2345]\d\d|powervr sgx|powervr rogue g[e6]|intel\(r\) hd graphics [2-4]/i.test(gpu);
      // the phone GPUs that hold a mirror floor and a bloom pass at 60 fps
      const strongMobile = /apple gpu|apple m\d|adreno \(tm\) (6[4-9]\d|7\d\d|8\d\d)|mali-g(7[1-9]|6[1-9]|[6-9]\d\d)|immortalis|xclipse/i.test(gpu);
      const mem = Number(navigator.deviceMemory) || 4;
      const coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
      const small = Math.min(window.innerWidth, window.innerHeight) < 700;
      const saveData = !!(navigator.connection && navigator.connection.saveData);
      if (weakGpu || saveData || mem <= 2) t = soft ? 1 : 0;
      else if (coarse || small) t = strongMobile ? 2 : 1;
      else t = 3;
      const lose = gl.getExtension("WEBGL_lose_context"); if (lose) lose.loseContext();
    }
  } catch (e) { t = 0; }
  return (tierCache = Math.min(t, learnedTier()));
}
export const spaceReduced = () => {
  try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
};

/* Fetch the room ahead of time (idle, and only where it will be used), so
   opening the arena is not the moment the download starts: the small host,
   and then whichever renderer this browser will actually use — the worker
   bundle, or the on-page one. */
let prefetched = false;
export function prefetchSpace() {
  if (prefetched || spaceTier() === 0) return;
  prefetched = true;
  const go = () => { import("./space3d").then(m => m.prefetchRenderer && m.prefetchRenderer()).catch(() => { prefetched = false; }); };
  if (typeof window !== "undefined" && "requestIdleCallback" in window) window.requestIdleCallback(go, { timeout: 2500 });
  else setTimeout(go, 600);
}

/* ── the arena's wire ──
   The fight is driven by pvp-arena, the room is drawn here: a tiny bus
   carries the moments the room should answer (a hit, a guard, a KO, a new
   round) and a plain object carries where the fighters stand, read every
   frame without ever re-rendering React. */
export function createSpaceBus() {
  const subs = new Set();
  return {
    pos: { me: 0.24, op: 0.76, meAir: 0, opAir: 0 },
    on(f) { subs.add(f); return () => subs.delete(f); },
    emit(e) { subs.forEach(f => { try { f(e); } catch (err) {} }); },
  };
}

/* variant: "arena" | "lobby" | "pets" | "shop"
   anchor:  a ref to the DOM element whose bottom-centre the scene's plinth
            should sit under (the robot in the lobby, the pet in its room)
   scroller: a ref to the element whose scroll drives the camera
   quiet:   a ref the page sets while it needs the frame budget itself (a pet
            being turned): the room holds its last frame until it clears
   bus:     createSpaceBus(), for the arena
   stage:   the arena's id, which sets the room's tone
   data:    a ref holding hologram read-outs, updated without re-rendering */
export const SpaceStage = memo(function SpaceStage({ variant = "lobby", anchor = null, scroller = null, bus = null, stage = null, className = "", data = null, quiet = null, onReady = null, onLost = null }) {
  const [tier] = useState(() => spaceTier());
  const [ready, setReady] = useState(false);
  const [dead, setDead] = useState(false);
  const alive = tier > 0 && !dead;
  const [reduced] = useState(() => spaceReduced());
  /* the page paints first: the room is only asked for once the browser is
     idle after this page's own first frame, so opening a page never waits
     on (or stutters for) the 3D coming up behind it */
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (tier === 0) return undefined;
    let id = 0, ric = 0;
    const f = () => setGo(true);
    const w = typeof window !== "undefined" ? window : null;
    id = requestAnimationFrame(() => {
      if (w && "requestIdleCallback" in w) ric = w.requestIdleCallback(f, { timeout: 600 });
      else ric = setTimeout(f, 120);
    });
    return () => { cancelAnimationFrame(id); if (w && "cancelIdleCallback" in w) w.cancelIdleCallback(ric); else clearTimeout(ric); };
  }, [tier]);
  const ok = useCallback(() => { setReady(true); onReady && onReady(); }, [onReady]);
  const lost = useCallback(() => { setDead(true); setReady(false); onLost && onLost(); }, [onLost]);
  return (
    <div className={`sp3 sp3-${variant}${ready ? " ready" : ""}${className ? " " + className : ""}`} aria-hidden="true" data-tier={alive ? tier : 0}>
      <div className="sp3-bg" />
      {alive && go && (
        <Suspense fallback={null}>
          <Space3D variant={variant} tier={tier} stage={stage} anchor={anchor} scroller={scroller} bus={bus} data={data} quiet={quiet}
            reduced={reduced} onReady={ok} onLost={lost} />
        </Suspense>
      )}
    </div>
  );
});

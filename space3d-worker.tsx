/* ── space3d-worker.tsx ──
   The room, rendered off the page's thread. The page hands over its canvas
   (OffscreenCanvas) and then only ever sends small messages: its size, where
   the subject's feet are, how far it has scrolled, where the pointer is, and
   the fight's big moments. Shader compiles, scene updates and every draw call
   happen here, so however heavy a frame of the room is, the page's own
   scrolling, tapping and pet-turning never wait for it.

   Messages in:  init · size · feed · bus · tier · dispose
   Messages out: ready (first frame drawn) · slow (the device is falling
                 behind at this tier) · fail (no WebGL here — the page falls
                 back to drawing the room itself) · lost (context lost) */
import { createRoot, extend } from "@react-three/fiber";
import * as THREE from "three";
import { SceneRoot, setDbg, createBus, createFeed, CAMERA, glOptions } from "./space3d-scene";

// <Canvas> registers three's classes as JSX elements; a bare root must say so
extend(THREE);

const feed = createFeed();
const bus = createBus();
let root = null, props = null;
const post = (m) => { try { self.postMessage(m); } catch (e) {} };
const onFirst = () => post({ type: "ready" });
const onSlow = (v) => post({ type: "slow", v });
const size = (m) => ({ width: Math.max(1, m.w), height: Math.max(1, m.h), top: 0, left: 0, updateStyle: false });

function draw() {
  root.render(<SceneRoot {...props} feed={feed} bus={bus} onFirst={onFirst} onSlow={onSlow} />);
}

self.onmessage = (e) => {
  const m = e.data || {};
  if (m.type === "init") {
    setDbg(m.dbg || "");
    // debug read-out (tg_3d_dbg contains "info"): frames drawn, cost, calls
    if ((m.dbg || "").indexOf("info") >= 0) setInterval(() => { if (globalThis.__sp3) post({ type: "info", i: globalThis.__sp3 }); }, 100);
    feed.reduced = !!m.reduced;
    if (m.feed) Object.assign(feed, m.feed);
    props = { variant: m.variant, tier: m.tier, stage: m.stage, dpr: m.dpr };
    const cv = m.canvas;
    try {
      // a worker can hold an OffscreenCanvas and still be refused WebGL2
      const probe = cv.getContext("webgl2", glOptions(m.tier));
      if (!probe) { post({ type: "fail", msg: "no webgl2" }); return; }
      cv.addEventListener && cv.addEventListener("webglcontextlost", (ev) => { ev.preventDefault(); post({ type: "lost" }); });
      root = createRoot(cv);
      root.configure({
        gl: { ...glOptions(m.tier), context: probe },
        size: size(m), dpr: m.dpr, frameloop: "never", events: undefined, camera: CAMERA,
        onCreated: (st) => { st.gl.debug.checkShaderErrors = false; },
      });
      draw();
    } catch (err) {
      post({ type: "fail", msg: String((err && err.message) || err) });
    }
  } else if (!root) {
    // nothing to do until init has succeeded
  } else if (m.type === "size") {
    root.configure({ size: size(m), dpr: m.dpr });
    props = { ...props, dpr: m.dpr };
    feed.wake = Math.max(feed.wake, performance.now() + 700);
    draw();
  } else if (m.type === "feed") {
    Object.assign(feed, m.feed);
    if (m.poke) feed.busy = performance.now();
  } else if (m.type === "bus") {
    feed.busy = performance.now();
    bus.emit(m.e);
  } else if (m.type === "tier") {
    props = { ...props, tier: m.tier, dpr: m.dpr };
    root.configure({ dpr: m.dpr });
    draw();
  } else if (m.type === "dispose") {
    try { root.unmount(); } catch (err) {}
    root = null;
    self.close();
  }
};

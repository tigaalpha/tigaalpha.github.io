/* ── figure-cache.tsx ──
   Fighters as pictures.

   A robot in the arena is the live drawing: about 1,300 SVG elements for the
   player's machine, 700 for the opponent, 1,200 for a pet. Every pose change
   re-renders and repaints all of it, and a pet's idle bob repaints it every
   frame. On a mid-range phone (4x CPU slowdown) a fight ran at 44 fps with
   one frame in twenty over 50 ms, 30 fps with the pet along, and on a small
   phone (6x) at 16 fps.

   A pose, though, is a still. This module draws each still ONCE on the device
   — the real component, in the player's own colourway and gear — turns it
   into a bitmap, and from then on the fight shows the bitmap: one element to
   paint instead of a thousand, and a pose change is a picture swap. Pictures
   are kept for the visit and in Cache Storage for the next one, so a machine
   you have fought before costs nothing to show again. Nothing is downloaded:
   the pictures are made here, from the same code the live drawing runs.

   <FigurePic> shows the picture once it exists and the live drawing until
   then (and for good, wherever the browser cannot make pictures), so a
   fighter is never blank. prepareFigures() makes a list of stills in the
   background, one per idle moment, so the poses a fight will need are ready
   before it needs them. */
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

const SVGNS = "http://www.w3.org/2000/svg";
const STORE = "tiga-figures-v1";
const STORE_MAX = 160;
export const FIGURES_OK = typeof window !== "undefined" && typeof document !== "undefined" &&
  typeof XMLSerializer !== "undefined" && typeof Blob !== "undefined" && !!(window.URL && URL.createObjectURL) &&
  typeof HTMLCanvasElement !== "undefined" && !!HTMLCanvasElement.prototype.toBlob;

/* The region of drawing space a picture covers, per kind, [x, y, w, h]. Wider
   than the viewBox: the live robot is drawn with overflow visible, so a
   levelled blade reaches well past its box and the light column under the
   plate fades out far below it. Measured over every model, pose and turn,
   then rounded out; the parts beyond it have faded to nothing. */
const REGION = {
  bot: [-78, -92, 390, 626],     // viewBox -20 -16 160 416
  pet: [-56, -50, 234, 214],     // viewBox -12 -18 144 156
};

/* Pixels per drawing unit. The arena shows a 416-unit robot about 206 CSS px
   tall — half a CSS pixel a unit — times the screen's density, capped:
   every picture of a fight is held decoded for as long as the fight runs. */
const ppu = (kind) => {
  const d = (typeof devicePixelRatio === "number" && devicePixelRatio) || 1;
  return kind === "pet" ? Math.min(1.8, Math.max(1, d * .75)) : Math.min(1.3, Math.max(.8, d * .5));
};

/* key → { url, reg } once made; key → Promise while in flight. `hold` keeps a
   decoded <img> of every picture alive, which is what lets a pose change show
   the next picture in the same frame instead of waiting on a decode. */
const done = new Map();
const flying = new Map();
const hold = new Map();
/* pictures kept decoded for the visit: two fighters' worth of fights and a
   pet, oldest dropped first (they come back from Cache Storage, not redrawn) */
const MEM_MAX = 64;
const listeners = new Set();
const tell = () => listeners.forEach(f => f());

/* The drawing's own styles (the .ca- and .pa- rules in the app stylesheet),
   the same subset the thumbnail bake carries, read once from the live sheets.
   A picture is one moment, so nothing in it may be caught mid-animation. */
let css = null;
function artCss() {
  if (css != null) return css;
  const out = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try { rules = sheet.cssRules; } catch (e) { continue; }
    for (const r of Array.from(rules || [])) {
      const sel = r.selectorText;
      if (sel && sel.split(",").every(s => /^(svg)?\.(ca|pa)(-[\w-]+)?(?=$|[\s.:#[>+~])/.test(s.trim()))) out.push(r.cssText);
    }
  }
  out.push("*{animation:none!important;transition:none!important}");
  return (css = out.join("\n"));
}

/* the live drawing → the picture of it. Rendered into a detached node, so it
   costs React's work and nothing else: no style, no layout, no paint. */
async function make(el, kind) {
  const host = document.createElement("div");
  const root = createRoot(host);
  let xml;
  const [rx, ry, rw, rh] = REGION[kind];
  const k = ppu(kind), W = Math.round(rw * k), H = Math.round(rh * k);
  try {
    flushSync(() => root.render(el));
    const svg = host.querySelector("svg");
    if (!svg) return null;
    svg.setAttribute("xmlns", SVGNS);
    svg.setAttribute("viewBox", `${rx} ${ry} ${rw} ${rh}`);
    svg.setAttribute("width", String(W));
    svg.setAttribute("height", String(H));
    svg.setAttribute("overflow", "hidden");
    svg.removeAttribute("style");
    const st = document.createElementNS(SVGNS, "style");
    st.textContent = artCss();
    svg.insertBefore(st, svg.firstChild);
    xml = new XMLSerializer().serializeToString(svg);
  } finally {
    root.unmount();
  }
  const src = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const g = cv.getContext("2d");
    if (!g) return null;
    g.drawImage(img, 0, 0, W, H);
    const blob = await new Promise(r => cv.toBlob(r, "image/webp", .9));
    return blob && blob.size > 200 ? blob : null;
  } finally {
    URL.revokeObjectURL(src);
  }
}

let store = null;
const openStore = () => {
  if (!store) store = typeof caches !== "undefined" ? caches.open(STORE).catch(() => null) : Promise.resolve(null);
  return store;
};
const storeUrl = (key) => `/__figure/${encodeURIComponent(key)}`;
async function fromStore(key) {
  const s = await openStore();
  if (!s) return null;
  try { const res = await s.match(storeUrl(key)); return res ? await res.blob() : null; } catch (e) { return null; }
}
async function toStore(key, blob) {
  const s = await openStore();
  if (!s) return;
  try {
    await s.put(storeUrl(key), new Response(blob, { headers: { "content-type": blob.type || "image/webp" } }));
    const keys = await s.keys();
    // oldest first: past the cap, the machines not fought in longest go
    for (const r of keys.slice(0, Math.max(0, keys.length - STORE_MAX))) await s.delete(r);
  } catch (e) {}
}

async function settle(key, blob, kind) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  try { await img.decode(); } catch (e) { URL.revokeObjectURL(url); return null; }
  hold.set(key, img);
  const r = { url, reg: REGION[kind] };
  done.set(key, r);
  for (const [k, v] of done) {
    if (done.size <= MEM_MAX) break;
    done.delete(k); hold.delete(k); URL.revokeObjectURL(v.url);
  }
  tell();
  return r;
}

/* A picture already in the store costs a read and a decode, never a render,
   so it is fetched straight away, whether or not the queue is paused. */
const peeking = new Map();
function peek(key, kind) {
  if (done.has(key) || flying.has(key) || peeking.has(key)) return;
  const p = fromStore(key)
    .then(blob => (blob && !done.has(key) ? settle(key, blob, kind) : null))
    .catch(() => null)
    .finally(() => peeking.delete(key));
  peeking.set(key, p);
}

/** The picture for `key`, making it from `el()` if nobody has yet. */
function figure(key, el, kind) {
  if (done.has(key)) return Promise.resolve(done.get(key));
  if (flying.has(key)) return flying.get(key);
  const p = (async () => {
    if (peeking.has(key)) { await peeking.get(key); if (done.has(key)) return done.get(key); }
    let blob = await fromStore(key);
    if (!blob) {
      blob = await make(el(), kind).catch(() => null);
      if (blob) toStore(key, blob);
    }
    return blob ? settle(key, blob, kind) : null;
  })().finally(() => flying.delete(key));
  flying.set(key, p);
  return p;
}

/* One still per idle moment. Each is a whole render of the live drawing plus
   a rasterisation — on a mid-range phone well over 100 ms of main thread —
   so while a round is being fought nothing new is started at all: made in
   the middle of an exchange, the pictures that were meant to make the fight
   smooth cost more than they saved (a first fight measured 25 fps against
   44 drawn live). The arena pauses the queue from FIGHT! to the K.O.; the
   lobby, the round intros and the gaps between rounds do the work. A
   picture already stored costs a read and a decode, not a render, so the
   store is always read, paused or not. */
const queue = [];
let pumping = false, paused = false;
const idle = (f) => (typeof requestIdleCallback === "function" ? requestIdleCallback(f, { timeout: 500 }) : setTimeout(f, 40));
/* and never under a finger: a touch, a scroll or a key puts the next picture
   off until the page has been left alone for a moment, so the work lands
   while someone is reading rather than while they are doing something */
const QUIET_MS = 700;
let lastInput = 0;
if (FIGURES_OK) for (const ev of ["pointerdown", "touchstart", "wheel", "keydown", "scroll"])
  window.addEventListener(ev, () => { lastInput = performance.now(); }, { passive: true, capture: true });
function pump() {
  if (pumping) return;
  pumping = true;
  const next = () => {
    if (paused) { pumping = false; return; }
    const calm = performance.now() - lastInput;
    if (calm < QUIET_MS) { setTimeout(() => idle(next), QUIET_MS - calm + 40); return; }
    const job = queue.shift();
    if (!job) { pumping = false; return; }
    if (done.has(job.key)) { next(); return; }
    figure(job.key, job.el, job.kind).then(() => idle(next), () => idle(next));
  };
  idle(next);
}

/** Stop starting new pictures (true) or carry on (false). */
export function pauseFigures(on) {
  paused = !!on;
  if (!paused && queue.length) pump();
}

/** Queue stills to be made in the background: [{ key, kind, el }], `el` a
    function returning the live element (built only when its turn comes),
    `kind` "bot" or "pet". With `first`, they go ahead of anything waiting. */
export function prepareFigures(jobs, first = false) {
  if (!FIGURES_OK) return;
  const fresh = jobs.filter(j => !done.has(j.key) && !queue.some(q => q.key === j.key));
  for (const j of fresh) peek(j.key, j.kind);
  if (first) queue.unshift(...fresh); else queue.push(...fresh);
  pump();
}

/** A live drawing shown as its picture once the picture exists. `el` is the
    live element, shown until then; `cls` the class its <svg> carries, so the
    page's sizing rules apply to the stand-in exactly as they did to it. */
export function FigurePic({ fkey, kind = "bot", el, cls = "", vb }) {
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump(n => n + 1);
    listeners.add(f);
    return () => { listeners.delete(f); };
  }, []);
  useEffect(() => {
    if (!done.has(fkey)) prepareFigures([{ key: fkey, kind, el: () => el }], true);
  }, [fkey]);
  const pic = done.get(fkey);
  if (!pic) return el;
  const [rx, ry, rw, rh] = pic.reg;
  return (
    <svg className={cls} viewBox={vb} overflow="visible" aria-hidden="true">
      <image href={pic.url} x={rx} y={ry} width={rw} height={rh} preserveAspectRatio="none" />
    </svg>
  );
}

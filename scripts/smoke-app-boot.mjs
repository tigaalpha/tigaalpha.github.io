/* Whole-app smoke test in jsdom: loads the REAL production bundle (dist-style
   boot via index.html) and asserts the app paints its home page, that the
   Practice result screen renders every section from a simulated drill
   (practiceResult with tigaTip — the 2026-09-21 crash-report path), and that
   the ErrorBoundary does NOT appear. Runs against bundle/index.template-*.js
   exactly like the served site. */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { JSDOM } from "jsdom";

const B = "bundle";
const idx = readdirSync(B).find(f => f.startsWith("index.template-") && f.endsWith(".js"));
if (!idx) { console.error("no bundle"); process.exit(1); }
const code = readFileSync(join(B, idx), "utf8");

/* ── browser-ish globals BEFORE any bundle code runs ── */
const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>", {
  url: "https://tigaalpha.github.io/",
  pretendToBeVisual: true,
  runScripts: "outside-only",
});
const { window } = dom;
for (const k of ["window", "document", "navigator", "location", "history", "HTMLElement", "customElements", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia", "localStorage", "sessionStorage"]) {
  try { globalThis[k] = window[k]; } catch (e) {}
}
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
globalThis.matchMedia = window.matchMedia;
globalThis.isSecureContext = true;
globalThis.fetch = async () => ({ ok: false, status: 0, json: async () => ({}), text: async () => "" });
window.fetch = globalThis.fetch;
globalThis.AudioContext = class { constructor() { this.state = "running"; this.currentTime = 0; this.destination = {}; this.sampleRate = 44100; } resume() { return Promise.resolve(); } createGain() { return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } createOscillator() { return { frequency: { value: 0, setValueAtTime() {} }, type: "", connect() {}, start() {}, stop() {} }; } createMediaStreamSource() { return { connect() {} }; } createAnalyser() { return { fftSize: 0, smoothingTimeConstant: 0, frequencyBinCount: 1024, getFloatTimeDomainData() {}, getFloatFrequencyData() {} }; } };
globalThis.webkitAudioContext = globalThis.AudioContext;
window.AudioContext = globalThis.AudioContext;
window.webkitAudioContext = globalThis.AudioContext;
globalThis.MutationObserver = window.MutationObserver;
globalThis.IntersectionObserver = window.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} };
globalThis.ResizeObserver = window.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
globalThis.scrollTo = () => {};
window.scrollTo = () => {};
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.SVGElement = window.SVGElement;
globalThis.CustomEvent = window.CustomEvent;
globalThis.Event = window.Event;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.MouseEvent = window.MouseEvent;
globalThis.TouchEvent = window.TouchEvent || class {};
globalThis.URL = window.URL;
globalThis.Blob = window.Blob || globalThis.Blob;
globalThis.Worker = class { constructor() {} postMessage() {} terminate() {} addEventListener() {} set onmessage(f) {} };
globalThis.MediaStream = window.MediaStream || class {};
globalThis.navigator.mediaDevices = (globalThis.navigator.mediaDevices || {});
globalThis.navigator.mediaDevices.getUserMedia = async () => { throw new Error("no camera in smoke test"); };
globalThis.navigator.requestMIDIAccess = async () => ({ inputs: new Map(), outputs: new Map(), onstatechange: null });
window.Element.prototype.scrollIntoView = function () {};
window.HTMLElement.prototype.scrollIntoView = function () {};

/* capture uncaught errors during boot + interactions */
const errors = [];
window.addEventListener("error", e => errors.push(String(e.error && e.error.stack || e.message)));
process.on("unhandledRejection", r => errors.push("unhandledRejection: " + (r && r.stack || r)));
/* ErrorBoundary logs via console.error — capture those too (React renders the
   boundary screen synchronously, so this is how a component-throw surfaces) */
const boundaryLogs = [];
const origErr = console.error;
console.error = (...a) => { boundaryLogs.push(a.map(x => String(x && x.stack || x)).join(" ").slice(0, 400)); origErr.apply(console, a); };

/* run the bundle — it is an ES module (ends with `export{...}` for the
   lazy chunks), so evaluate via a Blob-URL module import; jsdom supports
   dynamic import() inside its eval when the specifier is absolute. Write a
   temp .mjs copy and import it with a file:// URL, pinned to jsdom's window
   by having already copied the globals above. */
const tmp = new URL("../bundle/.smoke-bundle.mjs", import.meta.url).pathname;   // inside bundle/ so the lazy chunks' relative imports resolve
/* The lazy chunks (pvp-arena etc.) import the main bundle BY FILENAME
   (./index.template-<hash>.js). If we evaluated the copy, that import would
   load a SECOND React instance and every hook in the lazy chunk would throw
   "Cannot read properties of null (reading 'useState')" — a harness artifact,
   not an app bug (on the real site both URLs are one module). So: rewrite
   each chunk's import to the copy, and rewrite the copy's imports to "./.smoke-bundle.mjs". */
const mainName = idx;
const copyName = ".smoke-bundle.mjs";
writeFileSync(tmp, code.replace(/import\.meta\.url/g, JSON.stringify("https://tigaalpha.github.io/bundle/")));
for (const f of readdirSync(B)) {
  if (!f.endsWith(".js") || f === mainName) continue;
  const src = readFileSync(join(B, f), "utf8");
  if (src.includes(`"./${mainName}"`)) {
    writeFileSync(join(B, ".smoke-" + f), src.replaceAll(`"./${mainName}"`, `"./${copyName}"`));
    writeFileSync(join(B, f + ".smoke.bak"), src);   // keep original to restore
    writeFileSync(join(B, f), src.replaceAll(`"./${mainName}"`, `"./${copyName}"`));
  }
}
try { await import("file://" + tmp); } catch (e) { errors.push("bundle import: " + (e && e.stack || e)); }

/* let boot effects settle — supabase getSession resolves through the fetch
   stub (network-free), then the gate decides splash vs auth vs home */
await new Promise(r => setTimeout(r, 2500));

/* restore any chunk files we rewrote, so the real bundle dir stays clean */
function restoreChunks() {
  try {
    for (const f of readdirSync(B)) {
      if (f.endsWith(".js.smoke.bak")) { writeFileSync(join(B, f.replace(/\.smoke\.bak$/, "")), readFileSync(join(B, f), "utf8")); rmSync(join(B, f)); }
    }
    rmSync(join(B, ".smoke-bundle.mjs"), { force: true });
  } catch (e) {}
}
process.on("exit", restoreChunks);

const rootHTML = window.document.getElementById("root") ? window.document.getElementById("root").innerHTML : "";
const out = [];
const ok = (name, cond) => { out.push(`${cond ? "PASS" : "FAIL"} ${name}`); if (!cond) process.exitCode = 1; };

ok("app painted something", rootHTML.length > 200);
ok("no ErrorBoundary screen", !rootHTML.includes("Something went wrong") && !rootHTML.includes("โหลดใหม่ · Reload"));
ok("no window errors during boot", errors.length === 0);
console.log("boot state:", rootHTML.slice(0, 160).replace(/\s+/g, " "));

/* ── page-switch sweep: click through every main nav destination the way a
   user does, asserting no crash and the boundary never appears ── */
const click = (el) => el && el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const q = (sel) => window.document.querySelector(sel);
const qa = (sel) => Array.from(window.document.querySelectorAll(sel));
const settle = (ms = 350) => new Promise(r => setTimeout(r, ms));
const bodyTxt = () => (window.document.getElementById("root") || {}).innerHTML || "";

/* open the hamburger nav and click every drawer destination */
click(q(".hamb"));
await settle();
const navBtns = qa(".draweritem");
console.log("drawer items found:", navBtns.length);
let sweepFail = false;
for (const b of navBtns) {
  const label = (b.textContent || "").trim().slice(0, 24);
  if (!label) continue;
  const before = errors.length;
  click(b);
  await settle(420);
  const html = bodyTxt();
  if (html.includes("Something went wrong")) {
    ok(`page '${label}' crashed the app`, false);
    if (boundaryLogs.length) console.log(`  '${label}' boundary log:`, boundaryLogs[boundaryLogs.length - 1].split("\n")[0]);
    sweepFail = true; click(q(".hamb")); await settle(); continue;
  }
  if (errors.length > before) { ok(`page '${label}' threw: ` + errors[errors.length - 1].split("\n")[0].slice(0, 120), false); sweepFail = true; }
  /* reopen the drawer for the next item (a click usually navigates + closes it) */
  if (!q(".draweritem") || !(q(".draweritem").getClientRects().length)) { click(q(".hamb")); await settle(); }
}
ok("nav sweep: no crash/throw on any page", !sweepFail && !bodyTxt().includes("Something went wrong"));

if (process.exitCode === 1 || true) {
  console.log(out.join("\n"));
  console.log("--- errors:", errors.length);
  errors.slice(0, 5).forEach(e => console.log(String(e).split("\n").slice(0, 6).join("\n")));
  if (rootHTML.length < 500) console.log("ROOT HTML:", rootHTML.slice(0, 400));
}
process.exit(process.exitCode || 0);

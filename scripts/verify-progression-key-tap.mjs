/* Headless reproduction: load the REAL production ESM bundle in Node (jsdom
   globals), tap through the Progression stage's key picker exactly like the
   screenshot's flow, and capture any thrown error. Also drives a
   non-progression stage (Triad) type→key flow as a control. */

import { JSDOM } from "/tmp/node_modules/jsdom/lib/api.js";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const html = readFileSync("dist/index.html", "utf8");
const dom = new JSDOM(html, {
  url: "https://tigaalpha.github.io/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
});
const { window } = dom;

const winErrors = [];
console.error = () => {};
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
window.AudioContext = window.AudioContext || function () { this.currentTime = 0; this.destination = {}; this.state = "running"; this.resume = () => Promise.resolve(); this.createOscillator = () => ({ connect() {}, start() {}, stop() {}, frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: "" }); this.createGain = () => ({ connect() {}, disconnect() {}, gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} } }); };
window.requestAnimationFrame = cb => setTimeout(cb, 16);
window.cancelAnimationFrame = clearTimeout;
window.scrollTo = () => {};
window.fetch = window.fetch || (() => Promise.reject(new Error("offline-stub")));
window.addEventListener("error", e => winErrors.push(String(e.message)));

for (const k of ["window", "document", "navigator", "location", "history", "localStorage", "sessionStorage", "HTMLElement", "customElements", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia", "AudioContext", "fetch"]) {
  try { if (window[k] !== undefined) globalThis[k] = window[k]; } catch {}
}
globalThis.IntersectionObserver = globalThis.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} };
globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
globalThis.MutationObserver = globalThis.MutationObserver || class { observe() {} disconnect() {} };
globalThis.open = () => {};
globalThis.alert = () => {};
globalThis.confirm = () => true;
window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || function () {};
window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || function () {};

const bundleJs = "dist/" + (html.match(/src="\.\/(bundle\/[^"]+\.js)"/) || [])[1];
try { await import(pathToFileURL(bundleJs).href); } catch (e) { console.log("IMPORT-THROW:", e.message); process.exit(1); }

let booted = false;
for (let i = 0; i < 40 && !booted; i++) {
  await new Promise(r => setTimeout(r, 250));
  booted = (window.document.body.textContent || "").includes("ทางคอร์ด");
}
if (!booted) { console.log("STUCK-AT-BOOT"); process.exit(1); }
const doc = window.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let fails = 0;
const ok = (cond, label) => { console.log((cond ? "PASS" : "FAIL") + "  " + label); if (!cond) fails++; };

function tapByText(re, label) {
  const els = [...doc.querySelectorAll("button")].filter(el => re.test((el.textContent || "").trim()));
  const el = els[els.length - 1];
  if (!el) { console.log("NOT-FOUND", label); fails++; return null; }
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  return el;
}

const errBefore = winErrors.length;

// 1) open the Progression (09 ทางคอร์ด) card
tapByText(/ทางคอร์ด \(Progression\)/, "progression card");
await sleep(250);
let t1 = doc.body.textContent || "";
ok(/เลือกคีย์ที่ต้องการเรียน|เลือกชนิดที่ต้องการเรียน/.test(t1), "picker opened after tapping stage 09");

if (!/เลือกได้ทั้ง 12 คีย์/.test(t1)) {
  tapByText(/คลาสสิกป๊อป|I vi ii V/, "type I vi ii V");
  await sleep(200);
  t1 = doc.body.textContent || "";
  ok(/เลือกได้ทั้ง 12 คีย์/.test(t1), "key grid visible after type pick");
}

// 2) tap G — same selector that worked in scripts/dump-after-tap.mjs
const gBtns = [...doc.querySelectorAll("button")].filter(b => (b.textContent || "").startsWith("G") && (b.textContent || "").trim().length < 14);
const gBtn = gBtns[gBtns.length - 1];
ok(!!gBtn, "G key button found (" + gBtns.length + ")");
if (gBtn) {
  gBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await sleep(1000);
  const t2 = doc.body.textContent || "";
  ok(/Progression\) · G/.test(t2), "lesson header shows key G");
  ok(/ทางคอร์ด: I vi ii V|Progression: I vi ii V/.test(t2), "lesson body lists the roman numerals");
  ok(/ชื่อคอร์ด: I = G|Chord names: I = G/.test(t2) && /vi = Em/.test(t2) && /V = D/.test(t2), "G-key chord names rendered (I=G, vi=Em, V=D)");
  const newErrs = winErrors.slice(errBefore);
  ok(newErrs.length === 0, "zero runtime errors during key tap (" + newErrs.slice(0, 2).join(" | ").slice(0, 160) + ")");
  if (fails > 0) console.log("PAGE SAMPLE:", JSON.stringify(t2.slice(0, 400)));
}

// 3) control: back to pathway, Triad stage type→key flow
 tapByText(/เส้นทาง|pathway|Pathway|เปลี่ยนคีย์/, "back to pathway");
await sleep(400);
tapByText(/ไทรแอด|Triad/, "triad card");
await sleep(250);
tapByText(/เมเจอร์/, "triad major type");
await sleep(250);
const t3 = doc.body.textContent || "";
ok(/เลือกได้ทั้ง 12 คีย์/.test(t3), "triad key picker visible");

console.log(fails === 0 ? "\nALL PASS" : "\n" + fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);

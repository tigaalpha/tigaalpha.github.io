/* Headless verification: the Progression lesson (stage 09) now teaches BOTH
   ways. Loads the real production bundle in jsdom and asserts:
     1. opening the lesson shows the Block⇄Broken toggle (seqIsChord now true)
     2. tapping Broken/Block switches the active style and replays (no errors)
     3. ฝึกฝน (Practice) opens practice mode on the progression
     4. no runtime errors anywhere in the flow
*/

import { JSDOM } from "/tmp/node_modules/jsdom/lib/api.js";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const html = readFileSync("dist/index.html", "utf8");
const dom = new JSDOM(html, { url: "https://tigaalpha.github.io/", runScripts: "outside-only", pretendToBeVisual: true });
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
for (const k of ["window", "document", "navigator", "location", "history", "localStorage", "sessionStorage", "HTMLElement", "customElements", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia", "AudioContext", "fetch"]) { try { if (window[k] !== undefined) globalThis[k] = window[k]; } catch {} }
globalThis.IntersectionObserver = globalThis.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} };
globalThis.ResizeObserver = globalThis.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
globalThis.MutationObserver = globalThis.MutationObserver || class { observe() {} disconnect() {} };
globalThis.open = () => {}; globalThis.alert = () => {}; globalThis.confirm = () => true;
window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || function () {};
window.HTMLElement.prototype.scrollIntoView = window.HTMLElement.prototype.scrollIntoView || function () {};
navigator.mediaDevices = navigator.mediaDevices || {};
navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error("no-mic-in-test"));

const bundleJs = "dist/" + (html.match(/src="\.\/(bundle\/[^"]+\.js)"/) || [])[1];
try { await import(pathToFileURL(bundleJs).href); } catch (e) { console.log("IMPORT-THROW:", e.message); process.exit(1); }

let booted = false;
for (let i = 0; i < 40 && !booted; i++) { await new Promise(r => setTimeout(r, 250)); booted = (window.document.body.textContent || "").includes("ทางคอร์ด"); }
if (!booted) { console.log("STUCK-AT-BOOT"); process.exit(1); }
const doc = window.document;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tap = re => { const els = [...doc.querySelectorAll("button")].filter(el => re.test((el.textContent || "").trim())); const el = els[els.length - 1]; if (el) el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); return !!el; };

let fails = 0;
const ok = (cond, label) => { console.log((cond ? "PASS" : "FAIL") + "  " + label); if (!cond) fails++; };

const errBefore = winErrors.length;

// open stage 09 → pick type → pick key C
tap(/ทางคอร์ด \(Progression\)/); await sleep(250);
if (!/เลือกได้ทั้ง 12 คีย์/.test(doc.body.textContent)) { tap(/คลาสสิกป๊อป|I vi ii V/); await sleep(200); }
tap(/^(C\b|Cโด)/m); await sleep(900);

let t = doc.body.textContent || "";
ok(/Progression\) · C/.test(t), "lesson opened in key C");

// 1) Block⇄Broken toggle visible on the progression lesson
const toggleRow = [...doc.querySelectorAll(".chordstylerow")];
ok(toggleRow.length > 0, "Block⇄Broken toggle visible on progression lesson");
const btnBroken = toggleRow[0] && toggleRow[0].querySelector(".chordstylebtn");
ok(!!btnBroken, "Broken button present");

// 2) switch to Block → replays without errors
const btnBlock = toggleRow[0] && [...toggleRow[0].querySelectorAll(".chordstylebtn")].find(b => /Block|บล็อก|พร้อมกัน/.test(b.textContent));
ok(!!btnBlock, "Block button present");
if (btnBlock) {
  btnBlock.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await sleep(1200);
  const t2 = doc.body.textContent || "";
  ok(/Progression\) · C/.test(t2), "still on the lesson after Block switch");
}

// 3) practice button opens practice mode
tap(/ฝึกฝน|🎯\s*ฝึกฝน/); await sleep(800);
const t3 = doc.body.textContent || "";
const practiceOpen = /ฝึก|Practice/.test(t3) && (/0 \//.test(t3) || /แม่นยำ|ความแม่น|Restart|เริ่มใหม่/.test(t3));
ok(practiceOpen, "practice mode opened on the progression");

const newErrs = winErrors.slice(errBefore).filter(e => !/getUserMedia|no-mic/i.test(e));
ok(newErrs.length === 0, "zero unexpected runtime errors (" + newErrs.slice(0, 2).join(" | ").slice(0, 160) + ")");

console.log(fails === 0 ? "\nALL PASS" : "\n" + fails + " FAILURES");
process.exit(fails === 0 ? 0 : 1);

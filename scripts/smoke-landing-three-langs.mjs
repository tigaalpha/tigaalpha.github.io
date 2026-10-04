/* Landing page smoke test: renders the REAL shipped bundle
   (landing/bundle/index.template-*.js) in jsdom three times — once per
   language — and asserts what a visitor actually reads.

   Three separate boots, not one grep: the copy is picked at runtime from
   document.documentElement.lang, so a grep can prove the string exists but
   never that a visitor is shown it, nor which language they get.

   The headline assertion is not "10,000+ is in the file" but that 10,000+
   is what the page shows AND that the app really holds that many pieces.
   A claim nobody may ship on faith, so it counts them from the data.

   Each boot imports the temp module under a DIFFERENT query string: the
   bundle reads document.documentElement.lang once at module scope, so a
   second import of the same URL would return the cached module already
   bound to the first boot's document and the second language would quietly
   never be exercised. */
import { readFileSync, readdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

const B = "landing/bundle";
const idx = readdirSync(B).find((f) => f.startsWith("index.template-") && f.endsWith(".js"));
if (!idx) { console.error("FAIL no landing bundle"); process.exit(1); }
const code = readFileSync(join(B, idx), "utf8");
const COPY = readFileSync("landing/landing-copy.ts", "utf8");

let pass = 0, fail = 0;
const ok = (m) => { console.log("  ok: " + m); pass++; };
const no = (m, d) => { console.log("  FAIL: " + m + (d ? " — " + String(d).slice(0, 200) : "")); fail++; };

/* ── how many pieces does the app actually hold? ─────────────────────────
   Counted from the data. classical is bundled into the app; the originals
   shelf is described by public/originals/index.json, which
   originals-store.ts reads at runtime. A missing source is a FAIL, so the
   claim can never be "verified" against nothing. */
function countJsonDir(dir) {
  let n = 0;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const a = JSON.parse(readFileSync(join(dir, f), "utf8"));
    n += Array.isArray(a) ? a.length : (a.songs || []).length;
  }
  return n;
}
const classical = countJsonDir("songs-src/classical");
const origIndex = JSON.parse(readFileSync("public/originals/index.json", "utf8"));
const originals = Array.isArray(origIndex.songs) ? origIndex.songs.length : origIndex.songs;

console.log("== the headline number is a fact, not a claim ==");
if (originals + classical >= 10000)
  ok(`app holds ${originals} originals + ${classical} classical = ${originals + classical}, so "10,000+" does not overstate it`);
else
  no('"10,000+" overstates the library', `only ${originals + classical} pieces found`);
if (originals + classical > 10000) ok('pieces exist above the headline number, as "+" says');
else no('"+" needs pieces above 10,000', `${originals + classical} is not more than 10,000`);

/* ── one boot per language ────────────────────────────────────────────── */
function globals(lang) {
  const dom = new JSDOM(
    `<!doctype html><html lang="${lang}"><body><div id="root"></div></body></html>`,
    { url: "https://tigaalpha.github.io/landing/", pretendToBeVisual: true, runScripts: "outside-only" }
  );
  const { window } = dom;
  for (const k of ["window", "document", "navigator", "location", "history", "HTMLElement", "customElements",
    "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "matchMedia", "localStorage",
    "sessionStorage", "CustomEvent", "Event", "MouseEvent", "KeyboardEvent", "URL", "Blob", "Node", "Element",
    "SVGElement", "Text", "MutationObserver", "IntersectionObserver", "ResizeObserver"]) {
    try { globalThis[k] = window[k]; } catch (e) { /* jsdom keeps a few of these to itself */ }
  }
  const mm = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  window.matchMedia = window.matchMedia || mm;
  globalThis.matchMedia = window.matchMedia;
  window.scrollTo = () => {}; globalThis.scrollTo = () => {};
  globalThis.isSecureContext = true;
  globalThis.fetch = async () => ({ ok: false, status: 0, json: async () => ({}), text: async () => "" });
  window.fetch = globalThis.fetch;
  globalThis.AudioContext = class {
    constructor() { this.state = "running"; this.currentTime = 0; this.destination = {}; this.sampleRate = 44100; }
    resume() { return Promise.resolve(); }
    createGain() { return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createOscillator() { return { frequency: { value: 0, setValueAtTime() {} }, type: "", connect() {}, start() {}, stop() {} }; }
    createAnalyser() { return { fftSize: 0, smoothingTimeConstant: 0, frequencyBinCount: 1024, getFloatTimeDomainData() {}, getFloatFrequencyData() {} }; }
  };
  globalThis.webkitAudioContext = globalThis.AudioContext;
  window.AudioContext = globalThis.AudioContext; window.webkitAudioContext = globalThis.AudioContext;
  globalThis.IntersectionObserver = window.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} };
  globalThis.ResizeObserver = window.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
  window.Element.prototype.scrollIntoView = function () {};
  window.HTMLElement.prototype.scrollIntoView = function () {};

  const errors = [];
  window.addEventListener("error", (e) => errors.push(String(e.message || e.error)));
  globalThis.addEventListener = window.addEventListener.bind(window);
  return { window, errors };
}

const tmp = join(B, ".smoke-landing.mjs");
writeFileSync(tmp, code.replace(/import\.meta\.url/g, JSON.stringify("https://tigaalpha.github.io/landing/bundle/")));
const cleanup = () => { try { rmSync(tmp); } catch (e) {} };

const EXPECT = {
  th: { proof1: "เพลงในแอป ให้เล่นตามได้ทั้งหมด", proof3: "ทดลองฟรี ไม่ต้องใช้บัตร", days: "7 วัน" },
  en: { proof1: "songs in the app, every one of them playable", proof3: "free to try, no card needed", days: "7 days" },
  zh: { proof1: "首应用内曲目，全部可跟弹", proof3: "免费试用，无需银行卡", days: "7 天" },
};

for (const lang of ["th", "en", "zh"]) {
  const E = EXPECT[lang];
  console.log(`== landing (${lang}) ==`);
  const { window, errors } = globals(lang);
  try {
    await import(pathToFileURL(tmp).href + "?l=" + lang);
  } catch (e) {
    no(`${lang}: bundle boots`, e && (e.stack || e));
    continue;
  }
  await new Promise((r) => setTimeout(r, 1200));

  const doc = window.document;
  const text = doc.body.textContent || "";
  /* A character floor is weak AND language-dependent — Chinese carries the
     same content in far fewer characters than Thai. What matters is that the
     proof strip and the trial promise are present, which is checked below. */
  if (text.length > 200) ok(`${lang}: painted the page (${text.length} chars)`);
  else { no(`${lang}: painted`, text.length + " chars"); continue; }

  /* the number a visitor reads, rendered */
  const strip = doc.querySelector(".lp-proof");
  if (!strip) { no(`${lang}: proof strip rendered`); }
  else {
    const cells = strip.querySelectorAll("div");
    const b = cells[0] && cells[0].querySelector("b");
    if (b && b.textContent.trim() === "10,000+") ok(`${lang}: strip headlines 10,000+`);
    else no(`${lang}: strip headline`, b ? `"${b.textContent.trim()}"` : "(no <b>)");

    const s1 = cells[0] && cells[0].querySelector("span");
    if (s1 && s1.textContent.trim() === E.proof1) ok(`${lang}: song caption reads in ${lang}`);
    else no(`${lang}: song caption`, `"${s1 ? s1.textContent.trim() : ""}"`);

    const b3 = cells[2] && cells[2].querySelector("b");
    const s3 = cells[2] && cells[2].querySelector("span");
    /* the 7-day promise must be on the FIRST screen, not revealed 15 seconds
       later by a sticky bar — a visitor who reads and leaves must see it */
    if (b3 && b3.textContent.trim() === E.days) ok(`${lang}: first screen states the 7-day trial ("${E.days}")`);
    else no(`${lang}: 7-day trial not on first screen`, `got "${b3 ? b3.textContent.trim() : "(no <b>)"}"`);
    if (s3 && s3.textContent.trim() === E.proof3) ok(`${lang}: trial caption reads in ${lang}`);
    else no(`${lang}: trial caption`, `"${s3 ? s3.textContent.trim() : ""}"`);
    if (text.includes(E.days)) ok(`${lang}: "7" appears on the first screen`);
    else no(`${lang}: no 7-day promise anywhere on first screen`);
  }

  /* No tier and no price: the checkout is what decides a tier, and naming
     one here is a promise the checkout does not always keep. The cap is an
     internal promotion detail. Both were explicit conditions on this copy. */
  for (const banned of ["Max", "Premium", "3,999", "1,490", "3999", "1490"]) {
    if (text.includes(banned)) no(`${lang}: must not show "${banned}"`);
  }
  if (!text.includes("Max") && !text.includes("Premium")) ok(`${lang}: no plan tier named`);
  if (!/10,000\s*(คน|users|people|first)/.test(text)) ok(`${lang}: the 10,000-user cap is not advertised`);

  if (errors.length === 0) ok(`${lang}: no runtime errors`);
  else no(`${lang}: runtime errors`, errors.slice(0, 2).join(" | "));
}

/* ── the three URLs exist, carry the right lang, and share one bundle ── */
console.log("== the three landing URLs ==");
for (const [f, want] of [["landing/index.html", "th"], ["landing-en/index.html", "en"], ["landing-zh/index.html", "zh"]]) {
  if (!existsSync(f)) { no(`${f} exists`); continue; }
  const h = readFileSync(f, "utf8");
  const m = h.match(/<html lang="([a-z]+)"/);
  if (m && m[1] === want) ok(`${f}: <html lang="${m[1]}"> matches its directory`);
  else no(`${f}: html lang`, m ? `says "${m[1]}", directory is ${want}` : "no lang attribute");
  /* the en/zh pages live one level down, so they reach the shared copy via ../ */
  if (h.includes(`bundle/${idx}`)) ok(`${f}: points at the one shared bundle`);
  else no(`${f}: does not reference the shared bundle`);
}

/* ── the copy the page is built from, per language ──────────────────── */
console.log("== the copy source of truth, three languages ==");
for (const lang of ["th", "en", "zh"]) {
  const E = EXPECT[lang];
  const KEYS = { proof1: E.proof1, proof3: E.proof3, proofDays: E.days };
  for (const [key, val] of Object.entries(KEYS)) {
    if (COPY.includes(`${key}: "${val}"`)) ok(`${lang}: ${key} in landing-copy.ts`);
    else no(`${lang}: ${key} in landing-copy.ts`, `expected ${key}: "${val}"`);
  }
}

cleanup();
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
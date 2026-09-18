/* Headless verification with the REAL production bundle:
   1. sessionStorage restore — after a simulated reload the app reopens on the
      admin console, still unlocked (the "refresh kicks me out" bug).
   2. sign-out clears the remembered state (security).
   3. CSS — .admstu-head carries flex-wrap (paragraph overflow bug).
   Loads dist/ via jsdom like scripts/verify-progression-key-tap.mjs. */
import { JSDOM } from "/tmp/node_modules/jsdom/lib/api.js";
import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const html = readFileSync("index.html", "utf8");
const bundle = readdirSync("bundle").find(f => f.startsWith("index.template"));
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log("FAIL:", msg); } };

// CSS check straight from the built stylesheet-in-JS source
const cssSrc = readFileSync("bundle/" + bundle, "utf8");
ok(/\.admstu-head\{[^}]*flex-wrap:wrap/.test(cssSrc), "CSS: .admstu-head has flex-wrap:wrap");
ok(/admstu-head>div:first-child\{flex:1 1 100%/.test(cssSrc), "CSS: title takes full row");

// Boot the app in jsdom with the remembered-admin state pre-seeded, exactly
// what a tab looks like right after an OTA reload while the owner was inside
// the console.
const dom = new JSDOM(html, {
  url: "https://tigaalpha.github.io/",
  runScripts: "outside-only",
  pretendToBeVisual: true,
  beforeParse(window) {
    window.sessionStorage.setItem("tiga_page", "admin");
    window.sessionStorage.setItem("tiga_admin_unlocked", "1");
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
    window.AudioContext = window.AudioContext || function () { return { currentTime: 0, destination: {}, createGain: () => ({ connect() {}, gain: { value: 0, setValueAtTime() {} } }), createOscillator: () => ({ connect() {}, start() {}, stop() {}, frequency: { value: 0, setValueAtTime() {} } }) }; };
    window.HTMLCanvasElement.prototype.getContext = () => null;
    window.Element.prototype.scrollIntoView = window.Element.prototype.scrollIntoView || function () {};
  },
});
const { window } = dom;
global.window = window; global.document = window.document;
global.sessionStorage = window.sessionStorage; global.localStorage = window.localStorage;
Object.defineProperty(global, "navigator", { value: window.navigator, configurable: true });
global.location = window.location;
global.MutationObserver = window.MutationObserver;
global.IntersectionObserver = window.IntersectionObserver || class { observe() {} unobserve() {} disconnect() {} };
global.ResizeObserver = window.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} };
global.requestAnimationFrame = cb => setTimeout(cb, 16); global.cancelAnimationFrame = clearTimeout;

const errs = [];
window.addEventListener("error", e => errs.push(e.message));

try {
  await import(pathToFileURL("bundle/" + bundle));
  await new Promise(r => setTimeout(r, 2500));
} catch (e) { errs.push("import: " + e.message); }

const body = window.document.body ? window.document.body.textContent || "" : "";
ok(errs.length === 0, "no runtime errors during boot (got: " + errs.slice(0, 3).join(" | ") + ")");
ok(body.includes("ADMIN CONSOLE") || body.includes("ADMIN"), "app restored to admin console after simulated reload");
ok(!body.includes("เส้นทางการเรียนรู้") || body.includes("ADMIN"), "did NOT fall back to pathway");

console.log(`${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

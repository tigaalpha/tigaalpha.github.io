// Runs the REAL campaign-funnel.ts and the REAL handoff/attribution code of local-identity.ts
// (transpiled with esbuild, not a copy) against fake rows / a fake browser.
//   node scripts/verify-campaign-funnel.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { build } = await import(pathToFileURL(path.join(ROOT, "node_modules/esbuild/lib/main.js")).href);
const tmpDir = path.join(ROOT, "node_modules/.cache"); fs.mkdirSync(tmpDir, { recursive: true });
async function load(entry, name) {
  const r = await build({ entryPoints: [path.join(ROOT, entry)], bundle: true, format: "esm", write: false, platform: "node", logLevel: "silent" });
  const f = path.join(tmpDir, name + ".mjs"); fs.writeFileSync(f, r.outputFiles[0].text);
  return import(pathToFileURL(f).href + "?t=" + Date.now());
}
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.error("FAIL", m); } else console.log("ok  ", m); };

/* ── 1. the funnel maths ── */
const F = await load("campaign-funnel.ts", "campaign-funnel-test");
const rows = [];
let id = 0;
const add = (anon, kind, item, ua = "facebook-webview", src = "fb") => rows.push({ id: ++id, anon_id: anon, kind, item_id: item, ua, src });
// A: in-app, played, saw gate, tapped escape, arrived in chrome (same anon id), signed up
add("A", "land", "view"); add("A", "land", "page:th"); add("A", "attr", "first;s=fb;c=oct;k=ad1;t=set1;v=b;lg=th;tz=Asia/Bangkok");
add("A", "land", "hero:seen"); add("A", "land", "piano"); add("A", "land", "gate:shown"); add("A", "land", "openreal-top");
add("A", "land", "escape:arrived:facebook-webview", "android-chrome", "fb"); add("A", "land", "signed_up_landing:th", "android-chrome");
// B: in-app, bounced
add("B", "land", "view"); add("B", "land", "page:th"); add("B", "attr", "first;s=fb;c=oct;k=ad2;t=set1;tz=Asia/Bangkok");
// C: real browser, played, tried google, signed up (google)
add("C", "land", "view", "android-chrome", "ig"); add("C", "land", "page:zh", "android-chrome", "ig"); add("C", "attr", "first;s=ig;c=nov;lg=zh;tz=Asia/Shanghai", "android-chrome", "ig");
add("C", "land", "piano", "android-chrome", "ig"); add("C", "land", "try:google", "android-chrome", "ig"); add("C", "land", "signup:google", "android-chrome", "ig");
// D: email path: submitted only (link not yet opened) — NOT a completed sign-up
add("D", "land", "view", "ios-safari", "direct"); add("D", "land", "try:email-otp", "ios-safari", "direct"); add("D", "land", "signup:email-otp", "ios-safari", "direct");
// E: no view at all (an app-only visitor) — must not count in the landing funnel
add("E", "attr", "first;s=direct;lg=app", "android-chrome", "direct");
const vis = F.buildVisitors(rows);
ok(vis.size === 5, "five distinct visitors");
const by = (dim) => Object.fromEntries(F.groupVisitors(vis.values(), dim).map(r => [r.key, r]));
let g = by("inapp");
ok(g["in-app"].n === 2 && g["real"].n === 2, "in-app 2, real 2, the app-only visitor is left out");
ok(g["in-app"].signed === 1 && g["real"].signed === 1, "signed up: 1 in-app (via escape) + 1 real");
ok(by("campaign").oct.n === 2 && by("campaign").oct.signed === 1, "campaign oct: 2 visitors, 1 signed");
ok(by("adset").set1.n === 2, "ad set set1 groups A and B");
ok(by("creative").ad1.signed === 1 && by("creative").ad2.signed === 0, "creative ad1 signed, ad2 not");
ok(by("variant").b.n === 1 && by("variant").a.n === 3, "variant b = A; everyone else is the control a");
ok(by("region").TH.n === 2 && by("region").CN.n === 1, "region from time zone: TH 2, CN 1");
ok(by("lang").th.n === 2 && by("lang").zh.n === 1, "language from page:xx / attr lg");
g = by("escape");
ok(g.escaped.n === 1 && g.escaped.escTap === 1 && g.escaped.arrived === 1 && g.stayed.n === 3, "escape: A escaped (tap + arrival), 3 stayed");
ok(by("browser")["facebook-webview"].n === 2, "browser = the FIRST row's ua even though A later wrote chrome rows");
ok(by("inapp")["real"].submitted === 1 && by("inapp")["real"].tried === 2, "email submit is 'submitted', not 'signed'");
ok(F.regionOfTz("Asia/Taipei") === "HK/MO/TW" && F.regionOfTz("America/New_York") === "Americas" && F.regionOfTz("") === "?", "regionOfTz buckets");
ok(JSON.stringify(F.parseTags("touch;c=a b;k=x")) === '{"c":"a b","k":"x"}', "parseTags");

/* ── 2. attribution + handoff in a fake browser ── */
const store = new Map();
let uuidN = 0;
const def = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
const makeBrowser = (href, ua, tz = "Asia/Bangkok") => {
  let current = new URL(href).href;
  def("localStorage", { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) });
  def("navigator", { userAgent: ua, language: "th-TH", maxTouchPoints: 5 });
  def("document", { referrer: "https://l.facebook.com/" });
  def("window", { get location() { return new URL(current); }, history: { state: null, replaceState: (_s, _t, u) => { current = new URL(u, current).href; } }, screen: { width: 400, height: 800 }, innerWidth: 400 });
  def("crypto", { randomUUID: () => "11111111-2222-3333-4444-" + String(++uuidN).padStart(12, "0") });
  def("Intl", { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: tz }) }) });
  return { now: () => current };
};
const L = await load("local-identity.ts", "local-identity-test");
const FB = "Mozilla/5.0 (Linux; Android 13; wv) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0]";
const CH = "Mozilla/5.0 (Linux; Android 13; Pixel) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";
let b = makeBrowser("https://x.test/landing/?utm_source=fb&utm_campaign=oct&utm_term=set1&utm_content=ad1&v=b&fbclid=ZZZ", FB);
ok(L.adoptHandoff() === null, "no handoff params -> adoptHandoff returns null");
const a1 = L.attributionEvent("th");
ok(/^first;/.test(a1) && /c=oct/.test(a1) && /t=set1/.test(a1) && /k=ad1/.test(a1) && /v=b/.test(a1) && /ck=fbclid/.test(a1) && /tz=Asia\/Bangkok/.test(a1) && !/ZZZ/.test(a1), "first touch row carries the tags, the click id only as presence: " + a1);
ok(L.attributionEvent("th") === null, "the same URL again logs nothing");
b = makeBrowser("https://x.test/landing/?utm_source=fb&utm_campaign=nov", FB);
ok(/^touch;/.test(L.attributionEvent("th") || ""), "a different campaign tag on a later visit is logged as a touch");
ok(L.landingVariant() === "b" || L.landingVariant() === "a", "landingVariant returns a value");
// the escape: build the URL in the webview ...
const anon = L.anonId();
const esc = L.handoffUrl("https://x.test/landing/?utm_campaign=nov");
const eu = new URL(esc);
ok(eu.searchParams.get("hid") === anon && eu.searchParams.get("hua") === "facebook-webview" && eu.searchParams.get("utm_campaign") === "nov", "escape URL carries the anon id, the browser kind and the original query");
// ... and open it in a brand-new Chrome (empty storage)
store.clear();
b = makeBrowser(esc, CH);
const arr = L.adoptHandoff();
ok(arr && arr.adopted && arr.ua === "facebook-webview", "fresh Chrome adopts the identity");
ok(L.anonId() === anon, "anon id continues across the browser jump");
ok(L.trafficSource() === "fb", "source continues (not 'direct')");
ok(!/hid=|hat=|hsrc=|hua=/.test(b.now()) && /utm_campaign=nov/.test(b.now()), "handoff params are removed from the address bar, the ad tags stay");
// a browser that already has its own identity does not get replaced
store.clear(); store.set("tg_anon_id", "my-own-id-1234");
b = makeBrowser(esc, CH);
const arr2 = L.adoptHandoff();
ok(arr2 && !arr2.adopted && L.anonId() === "my-own-id-1234", "existing identity is never replaced");
// a stale link (> 30 min) is not adopted
store.clear();
const stale = new URL(esc); stale.searchParams.set("hat", String(Math.floor(Date.now() / 60000) - 45));
b = makeBrowser(stale.href, CH);
const arr3 = L.adoptHandoff();
ok(arr3 && !arr3.adopted && L.anonId() !== anon, "a link older than 30 minutes is not adopted");
// the magic-link email: 24 h window + landing language stamped
store.clear();
const mail = L.handoffUrl("https://x.test/", { lg: "zh", via: "mail" });
store.clear();
const mu = new URL(mail); mu.searchParams.set("hat", String(Math.floor(Date.now() / 60000) - 300));
makeBrowser(mu.href, CH);
const arr4 = L.adoptHandoff();
ok(arr4 && arr4.adopted && L.readLandingOrigin() === "zh", "a 5-hour-old magic-link click is adopted and stamps the landing language");
// hostile id is refused
store.clear();
makeBrowser("https://x.test/?hid=<script>&hat=" + Math.floor(Date.now() / 60000), CH);
const arr5 = L.adoptHandoff();
ok(arr5 && !arr5.adopted, "a malformed id is not adopted");
console.log(fail ? `\n${fail} FAILED` : "\nall passed");
process.exit(fail ? 1 : 0);

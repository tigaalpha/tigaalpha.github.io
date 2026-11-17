/* Landing page smoke test: renders the REAL shipped bundle
   (landing/bundle/index.template-*.js) in jsdom ten times — once per
   language (th, en, zh, since 2026-11-11 ja, ko, ru, and since 2026-11-13
   hi, es, fr, ar) — and asserts what a visitor actually reads.

   The file keeps its original name (scripts/smoke-landing-three-langs.mjs,
   `npm run verify:landing`) although it now covers ten languages.

   LANDING_ROOT (env) points it at another folder laid out like the repo root
   (landing/bundle/index.template-*.js, landing-xx/index.html), so it can be
   run against a bundle and pages built in a temp folder.

   Ten separate boots, not one grep: the copy is picked at runtime from
   document.documentElement.lang, so a grep can prove the string exists but
   never that a visitor is shown it, nor which language they get.

   The headline assertion is not "100,000+ is in the file" but that 100,000+
   is what the page shows AND that the app really holds that many pieces.
   A claim nobody may ship on faith, so it counts them from the data.

   Each boot imports the temp module under a DIFFERENT query string: the
   bundle reads document.documentElement.lang once at module scope, so a
   second import of the same URL would return the cached module already
   bound to the first boot's document and the second language would quietly
   never be exercised. */
import { readFileSync, readdirSync, writeFileSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { buildSync } from "esbuild";

const ROOT = process.env.LANDING_ROOT || ".";
const B = join(ROOT, "landing/bundle");
const ALL = ["th", "en", "zh", "ja", "ko", "ru", "hi", "es", "fr", "ar"];
const NEWL = ["hi", "es", "fr", "ar"];                       // added 2026-11-13
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
/* index.json stopped carrying the rows when the shelf passed 10,000: it is a
   manifest now (n / indexShards) and the rows live in index-NNN.json. Reading
   `.songs` here would yield undefined and every count below would be NaN, which
   is how a headline check passes for the wrong reason. n is the number the app
   itself reads at runtime (originals-store.ts loadOriginalManifest). */
if (Array.isArray(origIndex.songs)) { no("index.json still carries every row", "it should be a manifest with n"); }
const originals = typeof origIndex.n === "number" ? origIndex.n : NaN;
const HEADLINE = 100000;

console.log("== the headline number is a fact, not a claim ==");
if (originals + classical >= HEADLINE)
  ok(`app holds ${originals} originals + ${classical} classical = ${originals + classical}, so "${HEADLINE.toLocaleString()}+" does not overstate it`);
else
  no(`"${HEADLINE.toLocaleString()}+" overstates the library`, `only ${originals + classical} pieces found`);
if (originals + classical > HEADLINE) ok('pieces exist above the headline number, as "+" says');
else no('"+" needs pieces above 100,000', `${originals + classical} is not more than ${HEADLINE.toLocaleString()}`);

/* ── the copy and lessons the page is built from, loaded for real ─────────
   Bundled with esbuild into a temp folder (never into the repo) so the checks
   below read the same objects the page does, not a regex over the source. */
const TMPD = mkdtempSync(join(tmpdir(), "landing-smoke-"));
for (const f of ["landing-copy", "landing-lessons", "landing-ai", "landing-utils"]) {
  buildSync({ entryPoints: [`landing/${f}.${f === "landing-utils" ? "tsx" : "ts"}`], bundle: true, format: "esm", outfile: join(TMPD, f + ".mjs"), jsx: "automatic", logLevel: "silent",
    external: ["react", "react/jsx-runtime"], alias: {}, platform: "node", define: {} });
}
const { C: COPYC, LANGS: LANGS_C, FLAGS: FLAGS_C, FLAG_NAMES: FLAGN_C, LANG_SHORT: SHORT_C, pickLang, RTL_LANGS, dirOf } = await import(pathToFileURL(join(TMPD, "landing-copy.mjs")).href);
const { LESSONS: LESSONSC } = await import(pathToFileURL(join(TMPD, "landing-lessons.mjs")).href);
const AIMOD = await import(pathToFileURL(join(TMPD, "landing-ai.mjs")).href).catch((e) => { no("landing-ai.ts loads in node", e && e.message); return null; });
/* landing-utils.tsx has a class component (the ErrorBoundary), so it is bundled WITH React here and imported before the first boot,
   while no window exists; its crash screen and sign-up error texts are checked for every language near the end */
buildSync({ entryPoints: ["landing/landing-utils.tsx"], bundle: true, format: "esm", outfile: join(TMPD, "landing-utils-full.mjs"), jsx: "automatic", logLevel: "silent", platform: "node", define: { "process.env.NODE_ENV": '"production"' } });
const UTILS = await import(pathToFileURL(join(TMPD, "landing-utils-full.mjs")).href).catch((e) => { no("landing-utils.tsx loads in node", e && (e.stack || e.message)); return null; });

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
const cleanup = () => { try { rmSync(tmp); } catch (e) {} try { rmSync(TMPD, { recursive: true, force: true }); } catch (e) {} };
process.on("exit", cleanup);   // the temp copy of the bundle sits inside the bundle folder: it goes even when an assertion throws

const EXPECT = {
  th: { proof1: "เพลงที่เราแต่งเอง เล่นตามได้ทุกเพลง", proof3: "ทดลองฟรี ไม่ต้องใช้บัตร", days: "7 วัน", songs: "100,000+" },
  en: { proof1: "songs we wrote ourselves, every one playable", proof3: "free to try, no card needed", days: "7 days", songs: "100,000+" },
  zh: { proof1: "我们的原创曲目，全部可跟弹", proof3: "免费试用，无需银行卡", days: "7 天", songs: "100,000+" },
  ja: { proof1: "曲の自作楽曲、どれも弾いて練習できます", proof3: "無料でお試し、カード不要", days: "7日間", songs: "100,000+" },
  ko: { proof1: "곡의 자체 제작 음악 — 전부 따라 칠 수 있어요", proof3: "무료 체험, 카드 불필요", days: "7일", songs: "100,000+" },
  ru: { proof1: "собственных песен, каждую можно сыграть", proof3: "бесплатного пробного периода, карта не нужна", days: "7 дней", songs: "100,000+" },
  hi: { proof1: "हमारे अपने बनाए गाने, हर एक बजाने के लिए तैयार", proof3: "मुफ़्त आज़माएँ, कार्ड ज़रूरी नहीं", days: "7 दिन", songs: "100,000+" },
  es: { proof1: "canciones propias, todas para tocar", proof3: "gratis para probar, sin tarjeta", days: "7 días", songs: "100,000+" },
  fr: { proof1: "chansons de notre cru, toutes jouables", proof3: "d'essai gratuit, sans carte bancaire", days: "7 jours", songs: "100,000+" },
  ar: { proof1: "أغنية من تأليفنا، وكلها قابلة للعزف", proof3: "تجربة مجانية، بلا بطاقة بنكية", days: "7 أيام", songs: "100,000+" },
};

for (const lang of ALL) {
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
    if (b && b.textContent.trim() === E.songs) ok(`${lang}: strip headlines ${E.songs}`);
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
  const BANNED = ["Max", "Premium", "3,999", "1,490", "3999", "1490", "プレミアム", "マックス", "프리미엄", "맥스", "Премиум", "Макс", "प्रीमियम", "मैक्स", "بريميوم", "ماكس"];
  let tierSeen = false;
  for (const banned of BANNED) {
    if (text.includes(banned)) { tierSeen = true; no(`${lang}: must not show "${banned}"`); }
  }
  if (!tierSeen) ok(`${lang}: no plan tier named`);
  if (!/10,000\s*(คน|users|people|first|人|명|человек|первых|लोग|usuarios|personas|utilisateurs|مستخدم)/.test(text)) ok(`${lang}: the 10,000-user cap is not advertised`);

  /* the ten-pill language nav: one pill per language, the current one pressed,
     each labelled with its short name, and the page itself in the right
     <html lang> with the right title (what a visitor and a screen reader get) */
  const pills = [...doc.querySelectorAll(".lp-lang")];
  if (pills.length === 10 && pills.map((b) => b.getAttribute("lang")).join() === ALL.join()) ok(`${lang}: ten language pills in order ${ALL.join(" ")}`);
  else no(`${lang}: ten language pills`, pills.map((b) => b.getAttribute("lang")).join());
  const on = pills.filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.getAttribute("lang"));
  if (on.length === 1 && on[0] === lang) ok(`${lang}: the ${lang} pill is the pressed one`);
  else no(`${lang}: pressed pill`, on.join());
  const shortOf = Object.fromEntries(pills.map((b) => [b.getAttribute("lang"), (b.querySelector(".lp-langcode") || {}).textContent]));
  if (shortOf.ja === "日本語" && shortOf.ko === "한국어" && shortOf.ru === "РУС" && shortOf.en === "EN") ok(`${lang}: pill labels 日本語 / 한국어 / РУС fit the pill`);
  else no(`${lang}: pill labels`, JSON.stringify(shortOf));
  if (shortOf.hi === "हिन्दी" && shortOf.es === "ES" && shortOf.fr === "FR" && shortOf.ar === "عربي") ok(`${lang}: pill labels हिन्दी / ES / FR / عربي fit the pill`);
  else no(`${lang}: new pill labels`, JSON.stringify(shortOf));
  if (doc.documentElement.lang === lang) ok(`${lang}: <html lang> is "${lang}" after mount`);
  else no(`${lang}: html lang`, doc.documentElement.lang);
  /* direction: right to left for Arabic and for nobody else, set on <html> by the page itself */
  const wantDir = lang === "ar" ? "rtl" : "ltr";
  if (doc.documentElement.dir === wantDir) ok(`${lang}: <html dir> is "${wantDir}" after mount`);
  else no(`${lang}: html dir`, doc.documentElement.dir);
  /* tapping a flag switches language AND direction at once, and tapping back restores both: Thai -> Arabic -> this page's own language */
  {
    const tap = async (code) => { const el = pills.find((b) => b.getAttribute("lang") === code); if (el) el.click(); await new Promise((r) => setTimeout(r, 250)); };   // a bundle without that flag (an old build) is a FAIL below, not a crash
    const other = lang === "ar" ? "en" : "ar";
    await tap(other);
    const flipped = doc.documentElement.lang === other && doc.documentElement.dir === (other === "ar" ? "rtl" : "ltr");
    await tap(lang);
    const back = doc.documentElement.lang === lang && doc.documentElement.dir === wantDir;
    if (flipped && back) ok(`${lang}: a flag tap to ${other} flips lang + dir (${other === "ar" ? "rtl" : "ltr"}) and a tap back restores them`);
    else no(`${lang}: runtime language / direction switch`, `flipped=${flipped} back=${back} now lang=${doc.documentElement.lang} dir=${doc.documentElement.dir}`);
  }
  if (doc.title === COPYC[lang].htmlTitle) ok(`${lang}: document title is the ${lang} one`);
  else no(`${lang}: title`, doc.title);
  const h1 = doc.querySelector(".lp-h1");
  if (h1 && h1.textContent === COPYC[lang].h1a + COPYC[lang].h1b) ok(`${lang}: headline reads in ${lang}`);
  else no(`${lang}: headline`, h1 && h1.textContent);
  const chipTxt = [...doc.querySelectorAll(".lp-chip")].map((c) => c.textContent.replace(" ↻", ""));
  if (chipTxt.length === 4 && chipTxt.every((t, i) => t === LESSONSC[i].chip[lang])) ok(`${lang}: four example-question chips read in ${lang}`);
  else no(`${lang}: chips`, chipTxt.join(" | "));

  if (errors.length === 0) ok(`${lang}: no runtime errors`);
  else no(`${lang}: runtime errors`, errors.slice(0, 2).join(" | "));
}

/* ── the ten URLs exist, carry the right lang, and share one bundle ── */
console.log("== the ten landing URLs ==");
const PAGES = [["landing/index.html", "th", "https://www.tigaalpha.com/landing/", "th_TH"],
  ["landing-en/index.html", "en", "https://www.tigaalpha.com/landing-en/", "en_US"],
  ["landing-zh/index.html", "zh-Hans", "https://www.tigaalpha.com/landing-zh/", "zh_CN"],
  ["landing-ja/index.html", "ja", "https://www.tigaalpha.com/landing-ja/", "ja_JP"],
  ["landing-ko/index.html", "ko", "https://www.tigaalpha.com/landing-ko/", "ko_KR"],
  ["landing-ru/index.html", "ru", "https://www.tigaalpha.com/landing-ru/", "ru_RU"],
  ["landing-hi/index.html", "hi", "https://www.tigaalpha.com/landing-hi/", "hi_IN"],
  ["landing-es/index.html", "es", "https://www.tigaalpha.com/landing-es/", "es_ES"],
  ["landing-fr/index.html", "fr", "https://www.tigaalpha.com/landing-fr/", "fr_FR"],
  ["landing-ar/index.html", "ar", "https://www.tigaalpha.com/landing-ar/", "ar_AR"]];
const HREFLANG = [["th", "https://www.tigaalpha.com/landing/"], ["en", "https://www.tigaalpha.com/landing-en/"],
  ["zh-Hans", "https://www.tigaalpha.com/landing-zh/"], ["ja", "https://www.tigaalpha.com/landing-ja/"],
  ["ko", "https://www.tigaalpha.com/landing-ko/"], ["ru", "https://www.tigaalpha.com/landing-ru/"],
  ["hi", "https://www.tigaalpha.com/landing-hi/"], ["es", "https://www.tigaalpha.com/landing-es/"],
  ["fr", "https://www.tigaalpha.com/landing-fr/"], ["ar", "https://www.tigaalpha.com/landing-ar/"],
  ["x-default", "https://www.tigaalpha.com/landing-en/"]];
const titles = new Set(), descs = new Set();
const t0 = (h, re) => (h.match(re) || [])[1] || "";      // the first capture of a regex over a page, or ""
for (const [f0, want, canon, og] of PAGES) {
  const f = join(ROOT, f0);
  if (!existsSync(f)) { no(`${f0} exists`); continue; }
  const h = readFileSync(f, "utf8");
  const m = h.match(/<html lang="([a-zA-Z-]+)"/);
  if (m && m[1] === want) ok(`${f0}: <html lang="${m[1]}"> matches its directory`);
  else no(`${f0}: html lang`, m ? `says "${m[1]}", directory is ${want}` : "no lang attribute");
  /* the pages in landing-xx/ live one level down, so they reach the shared copy via ../ */
  if (h.includes(`bundle/${idx}`)) ok(`${f0}: points at the one shared bundle`);
  else no(`${f0}: does not reference the shared bundle`);
  /* every page lists all ten (itself included) with the right codes, and the
     x-default stays the English page, exactly as before */
  const alts = [...h.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((x) => [x[1], x[2]]);
  if (JSON.stringify(alts) === JSON.stringify(HREFLANG)) ok(`${f0}: hreflang lists th, en, zh-Hans, ja, ko, ru, hi, es, fr, ar + x-default (landing-en) — a cluster of ten`);
  else no(`${f0}: hreflang set`, JSON.stringify(alts));
  /* dir="rtl" is on the Arabic page's root element and on no other page's (every other root stays exactly <html lang="..."> as it was) */
  const rootTag = (h.match(/<html[^>]*>/) || [""])[0];
  if (want === "ar" ? /\sdir="rtl"/.test(rootTag) : !/\sdir=/.test(rootTag)) ok(`${f0}: ${want === "ar" ? 'root is <html lang="ar" dir="rtl">' : "no dir attribute on the root (left to right by default)"}`);
  else no(`${f0}: html dir`, rootTag);
  /* the strings written into HTML attributes carry no double quote, ampersand, dollar sign or angle bracket */
  const attrStrings = [t0(h, /<title>([^<]*)<\/title>/), t0(h, /<meta name="description" content="([^"]*)"/), t0(h, /property="og:title" content="([^"]*)"/), t0(h, /property="og:description" content="([^"]*)"/)];
  if (attrStrings.every((x) => x && !/["&$<>]/.test(x))) ok(`${f0}: title / description / og:title / og:description carry no quote, ampersand, dollar sign or angle bracket`);
  else no(`${f0}: attribute strings`, attrStrings.join(" | "));
  const cn = (h.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
  if (cn === canon) ok(`${f0}: canonical is itself (${canon})`);
  else no(`${f0}: canonical`, cn);
  const ou = (h.match(/property="og:url" content="([^"]+)"/) || [])[1];
  if (ou === canon) ok(`${f0}: og:url is itself`);
  else no(`${f0}: og:url`, ou);
  const ol = (h.match(/property="og:locale" content="([^"]+)"/) || [])[1];
  if (ol === og) ok(`${f0}: og:locale ${og}`);
  else no(`${f0}: og:locale`, ol);
  const t = (h.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  const d = (h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
  titles.add(t); descs.add(d);
  const code = want === "zh-Hans" ? "zh" : want;
  if (t === COPYC[code].htmlTitle) ok(`${f0}: <title> is the page copy's own title`);
  else no(`${f0}: <title> differs from landing-copy htmlTitle`, `"${t}" vs "${COPYC[code].htmlTitle}"`);
  if (t.length > 0 && t.length <= 70) ok(`${f0}: title length ${t.length} (<= 70)`);
  else no(`${f0}: title length`, t.length);
  if (d.length >= 40 && d.length <= 170) ok(`${f0}: description length ${d.length} (CJK pages read shorter than the 110-160 of Latin ones)`);
  else no(`${f0}: description length`, d.length);
  /* the languages written in an alphabet carry the same weight as the English description: 110-160 characters */
  if (["en", "ru", ...NEWL].includes(code)) {
    if ([...d].length >= 110 && [...d].length <= 160) ok(`${f0}: description is ${[...d].length} characters (110-160, the English weight)`);
    else no(`${f0}: description weight`, [...d].length);
  }
  /* the structured data: the page's own url and language, valid JSON, and no tier name */
  const ld = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((x) => x[1]);
  let wp = null;
  try { wp = JSON.parse(ld[0])["@graph"].find((n) => n["@type"] === "WebPage"); } catch (e) { no(`${f0}: JSON-LD parses`, e.message); }
  if (wp && wp.url === canon && String(wp.inLanguage) === want) ok(`${f0}: JSON-LD WebPage url + inLanguage ("${want}") match the page`);
  else if (wp) no(`${f0}: JSON-LD WebPage`, `${wp.url} / ${wp.inLanguage}`);
  if (["ja", "ko", "ru", ...NEWL].includes(code)) {
    let faqOk = false;
    try { faqOk = ld.some((x) => JSON.parse(x)["@type"] === "FAQPage"); } catch (e) {}
    if (faqOk) ok(`${f0}: FAQ JSON-LD present and parses`);
    else no(`${f0}: FAQ JSON-LD`);
    if (/Premium|プレミアム|프리미엄|Премиум|प्रीमियम|بريميوم|Max\b/.test(h.replace(/<script type="module"[\s\S]*?<\/script>/g, ""))) no(`${f0}: names a plan tier in its markup`);
    else ok(`${f0}: no plan tier in the markup (title, description, JSON-LD, crawler text)`);
    const root = (h.match(/<div id="root">([\s\S]*?)<\/div>\s*<noscript>/) || [])[1] || "";
    const wantHint = { ja: /[぀-ヿ一-鿿]/, ko: /[가-힯]/, ru: /[Ѐ-ӿ]/, hi: /[\u0900-\u097F]/, ar: /[\u0600-\u06FF]/, es: /Preguntas frecuentes/, fr: /Questions fréquentes/ }[code];
    if (wantHint.test(root) && /id="seo-copy"/.test(root)) ok(`${f0}: crawler text (#seo-copy) is written in ${code}`);
    else no(`${f0}: crawler text language`);
    if (/blog\/[a-z]{2}\//.test(root) && root.includes(`/blog/${code}/`)) ok(`${f0}: crawler text links /blog/${code}/`);
    else no(`${f0}: blog link`);
  }
}
if (titles.size === 10) ok("ten distinct <title>s"); else no("titles are distinct", [...titles].join(" | "));
if (descs.size === 10) ok("ten distinct descriptions"); else no("descriptions are distinct");

/* ── the copy the page is built from, per language ──────────────────── */
console.log("== the copy source of truth, ten languages ==");
for (const lang of ALL) {
  const E = EXPECT[lang];
  const KEYS = { proof1: E.proof1, proof3: E.proof3, proofDays: E.days };
  for (const [key, val] of Object.entries(KEYS)) {
    if (COPY.includes(`${key}: "${val}"`)) ok(`${lang}: ${key} in landing-copy.ts`);
    else no(`${lang}: ${key} in landing-copy.ts`, `expected ${key}: "${val}"`);
  }
}

/* the digit systems the app never prints: Arabic-Indic and Devanagari digits (owner rule, i18n-src/glossary.md: Western 0-9 only) */
const EASTERN_DIGITS = /[\u0660-\u0669\u06F0-\u06F9\u0966-\u096F]/;

/* ── the dictionary, key by key ────────────────────────────────────────
   Every language has exactly the keys English has (a missing key is a blank
   in somebody's first impression), nothing empty except the two deliberate
   empty prefixes of the privacy sentence in ja / ko (their word order puts
   the link first), and everything that is not language is identical: the
   {n} placeholder, line breaks, emoji, digits. */
console.log("== copy parity against English ==");
const flat = (o, pre = "") => Object.entries(o).flatMap(([k, v]) => typeof v === "object" ? flat(v, pre + k + ".") : [[pre + k, v]]);
const EN = Object.fromEntries(flat(COPYC.en));
const emoji = (t) => (t.match(/\p{Extended_Pictographic}/gu) || []).join("");
/* a set, because the Thai strings repeat the number in their bilingual tail ("6 ตัวอักษร · … 6 characters") */
const nums = (t) => [...new Set((t.match(/\d[\d,]*/g) || []).map((x) => x.replace(/,$/, "")))].join("|");   // a comma right after a number is punctuation ("US$24.99, 카드 불필요")
const brace = (t) => (t.match(/\{[a-z]+\}/g) || []).join();
for (const lang of ALL) {
  const L = Object.fromEntries(flat(COPYC[lang]));
  const missing = Object.keys(EN).filter((k) => !(k in L)), extra = Object.keys(L).filter((k) => !(k in EN));
  if (!missing.length && !extra.length) ok(`${lang}: same ${Object.keys(EN).length} keys as English (incl. vb.*)`);
  else no(`${lang}: key parity`, `missing ${missing.join(",")} extra ${extra.join(",")}`);
  const empties = Object.keys(L).filter((k) => !String(L[k]).trim() && !(["ja", "ko"].includes(lang) && k === "agree"));
  if (!empties.length) ok(`${lang}: no empty string (except the ja/ko privacy prefix)`);
  else no(`${lang}: empty strings`, empties.join(","));
  if (lang === "en") continue;
  const badBrace = Object.keys(EN).filter((k) => brace(EN[k]) !== brace(L[k] || ""));
  if (!badBrace.length) ok(`${lang}: {n} placeholders identical to English`);
  else no(`${lang}: placeholders`, badBrace.join(","));
  const badNl = Object.keys(EN).filter((k) => (EN[k].match(/\n/g) || []).length !== ((L[k] || "").match(/\n/g) || []).length);
  if (!badNl.length) ok(`${lang}: line breaks identical to English`);
  else no(`${lang}: line breaks`, badNl.join(","));
  /* emoji: the three in a row of th / en / zh already differ nowhere, so any
     difference in the ten strings that carry emoji is a slip. */
  const badEmo = Object.keys(EN).filter((k) => emoji(EN[k]) !== emoji(L[k] || ""));
  if (!badEmo.length) ok(`${lang}: emoji identical to English`);
  else no(`${lang}: emoji`, badEmo.map((k) => `${k}:${emoji(EN[k])}/${emoji(L[k] || "")}`).join(" "));
  /* hi / es / fr / ar are held to a stricter line: EVERY string carries exactly the digits of its English twin
     (not only the six that carry the promise), in the same order, and none of them in a digit system the app never prints */
  if (NEWL.includes(lang)) {
    const allNums = (t) => (t.match(/\d[\d,]*/g) || []).map((x) => x.replace(/,$/, "")).join("|");
    const badAll = Object.keys(EN).filter((k) => allNums(EN[k]) !== allNums(L[k]));
    if (!badAll.length) ok(`${lang}: every one of the ${Object.keys(EN).length} strings has the digits of the English one, in the same order`);
    else no(`${lang}: digits differ from English`, badAll.map((k) => `${k}: "${allNums(EN[k])}" vs "${allNums(L[k])}"`).join(" ; "));
    const eastern = Object.keys(L).filter((k) => EASTERN_DIGITS.test(L[k]));
    if (!eastern.length) ok(`${lang}: Western digits 0-9 only (no Arabic-Indic or Devanagari digits)`);
    else no(`${lang}: non-Western digits`, eastern.join(","));
    const badPh = Object.keys(EN).filter((k) => (EN[k].match(/\{[a-z]+\}/g) || []).join() !== (L[k].match(/\{[a-z]+\}/g) || []).join());
    if (!badPh.length) ok(`${lang}: the same {n} placeholders as English (askFree only)`);
    else no(`${lang}: {n} placeholders`, badPh.join(","));
    const badMark = Object.keys(EN).filter((k) => (EN[k].match(/[→←↓↑▶⧉]/g) || []).length !== (L[k].match(/[→←↓↑▶⧉]/g) || []).length);
    if (!badMark.length) ok(`${lang}: the same number of arrow / play glyphs as English in every string`);
    else no(`${lang}: arrow glyph count`, badMark.join(","));
  }
  /* the numbers the promise rests on: 7 (days), the price (US$24.99 · ฿799 th · ¥176 zh), 6 (password), 5 (seconds), 100,000+ */
  const NUMKEYS = ["sticky", "trialLine", "passPh", "errShort", "nudgeBtn", "proofSongs"];
  /* The price is the one number that differs by design (owner, 2026-11-17): English and every extra language quote US$24.99, Thai
     ฿799 and Chinese ¥176 (what the app charges each of them). The English copy is the reference; th and zh are compared with
     its price swapped for their own. */
  const PT = lang === "th" ? "799" : lang === "zh" ? "176" : "24.99";
  const ref = (k) => (lang === "th" ? EN[k].replace("US$24.99", "799") : lang === "zh" ? EN[k].replace("US$24.99", "176") : EN[k]);
  const badNum = NUMKEYS.filter((k) => nums(ref(k)) !== nums(L[k]));
  if (!badNum.length) ok(`${lang}: the numbers in ${NUMKEYS.join(", ")} match English`);
  else no(`${lang}: numbers`, badNum.map((k) => `${k}: "${nums(ref(k))}" vs "${nums(L[k])}"`).join(" ; "));
  const hasPT = (t) => t.includes(PT);
  if (hasPT(L.sticky) && hasPT(L.trialLine) && /\b7\b/.test(L.sticky.replace(PT, ""))) ok(`${lang}: sticky + trial line state 7 days and the price (${PT})`);
  else no(`${lang}: 7 days / the price ${PT} in sticky + trialLine`);
  if (lang === "th") ok("th: keeps the baht price");
  else if (!/799|THB|baht|バーツ|바트|бат\b|泰铢|بات/i.test(L.sticky + L.trialLine)) ok(`${lang}: no baht price in sticky + trial line`);
  else no(`${lang}: still quotes the baht price`, L.sticky + " | " + L.trialLine);
}

/* ── the four lessons, ten languages ────────────────────────────────────
   The music in an answer must not change with the language, so the note
   names, chord spellings, finger runs and the semitone arithmetic have to
   appear in every translation exactly as they do in English. */
console.log("== lessons: the music is identical in every language ==");
const MUST = {
  cmajor: ["C D E F G A B C", "E→F", "B→C", "1-2-3", "1-2-3-4-5"],
  chords: ["C–E–G", "G–B–D", "A–C–E", "F–A–C", "C → G → Am → F", "Let It Be"],
  basics: ["C D E F G", "middle C"],
  triad: ["C – E – G", "E♭", "4 + 3", "3 + 4"],
};
/* the C-major run in solfege, the one place a language writes the same notes differently */
const SOLFEGE = { th: "โด เร มี ฟา ซอล ลา ที โด", en: "do re mi fa sol la ti do", zh: "do re mi fa sol la si do", ja: "ド レ ミ ファ ソ ラ シ ド", ko: "도 레 미 파 솔 라 시 도", ru: "до ре ми фа соль ля си до",
  hi: "डो रे मी फा सो ला सी डो", es: "do re mi fa sol la si do", fr: "do ré mi fa sol la si do", ar: "دو ري مي فا صول لا سي دو" };
const WHOLEHALF = { th: "เต็ม–เต็ม–ครึ่ง–เต็ม–เต็ม–เต็ม–ครึ่ง", en: "whole–whole–half–whole–whole–whole–half", zh: "全–全–半–全–全–全–半", ja: "全音–全音–半音–全音–全音–全音–半音", ko: "온음–온음–반음–온음–온음–온음–반음", ru: "тон–тон–полутон–тон–тон–тон–полутон",
  hi: "होल–होल–हाफ़–होल–होल–होल–हाफ़", es: "tono–tono–semitono–tono–tono–tono–semitono", fr: "ton–ton–demi-ton–ton–ton–ton–demi-ton", ar: "نغمة–نغمة–نصف–نغمة–نغمة–نغمة–نصف" };
for (const l of LESSONSC) {
  for (const lang of ALL) {
    const a = l.answer[lang];
    if (!a || a.length < 200) { no(`lesson ${l.id}/${lang}: answer present`, a ? a.length : "missing"); continue; }
    const need = MUST[l.id] || [];
    /* "middle C" stays in Latin letters in every language (th, ja, ko, ru write it as is; zh and the
       others add their own word next to it), so one token list serves all ten */
    const miss = need.filter((tok) => !a.includes(tok));
    if (!miss.length) ok(`lesson ${l.id}/${lang}: all ${need.length} note / chord / finger tokens present`);
    else no(`lesson ${l.id}/${lang}: tokens missing`, miss.join(" ; "));
    if (l.id === "cmajor") {
      if (a.includes(SOLFEGE[lang])) ok(`lesson cmajor/${lang}: solfege line (${SOLFEGE[lang]})`); else no(`lesson cmajor/${lang}: solfege`, SOLFEGE[lang]);
      if (a.includes(WHOLEHALF[lang])) ok(`lesson cmajor/${lang}: whole-whole-half pattern in the right order`); else no(`lesson cmajor/${lang}: step pattern`, WHOLEHALF[lang]);
    }
    /* the music's own digits stay Western in the four new languages: the finger runs and the "4 + 3" lines are 0-9, never ٤ or ४ */
    if (NEWL.includes(lang) && EASTERN_DIGITS.test(a + l.chip[lang] + l.ask[lang] + l.demoLabel[lang])) no(`lesson ${l.id}/${lang}: non-Western digits`);
    const bold = (a.match(/\*\*/g) || []).length;
    if (bold % 2 === 0) ok(`lesson ${l.id}/${lang}: ** markers pair up (${bold / 2} bold runs)`); else no(`lesson ${l.id}/${lang}: unbalanced **`, bold);
    for (const f of ["chip", "ask", "demoLabel"]) {
      if (!l[f][lang] || !String(l[f][lang]).trim()) no(`lesson ${l.id}/${lang}: ${f}`);
    }
  }
  /* every demo step plays notes the lesson's finger map names, so the keyboard shows what the text says */
  const bad = (l.demo || []).filter((st) => st.f && Object.keys(st.f).some((n) => !st.n.includes(n)));
  if (!bad.length) ok(`lesson ${l.id}: every finger number sits on a note that sounds`); else no(`lesson ${l.id}: finger map`, JSON.stringify(bad[0]));
}
/* the triad lesson's arithmetic, checked against the demo: 4 + 3 above C is E and G, then E is lowered to E♭ (D#) */
const triad = LESSONSC.find((l) => l.id === "triad");
const maj = triad.demo[0].n.join(","), min = triad.demo[2].n.join(",");
if (maj === "C4,E4,G4" && min === "C4,D#4,G4") ok("triad demo plays C-E-G, then C-E♭-G (D#4), as every language's answer says");
else no("triad demo notes", maj + " / " + min);

/* ── the language plumbing in landing-copy.ts ─────────────────────────── */
console.log("== language plumbing ==");
if (JSON.stringify(LANGS_C) === JSON.stringify(ALL)) ok("LANGS = th en zh ja ko ru hi es fr ar"); else no("LANGS", LANGS_C.join());
if (ALL.every((l) => FLAGS_C[l] && FLAGN_C[l] && SHORT_C[l])) ok("every language has a flag, a name and a short label"); else no("flag / name / short label missing");
if (FLAGS_C.ja === "🇯🇵" && FLAGS_C.ko === "🇰🇷" && FLAGS_C.ru === "🇷🇺") ok("flags 🇯🇵 🇰🇷 🇷🇺"); else no("new flags");
if (FLAGN_C.ja === "日本語" && FLAGN_C.ko === "한국어" && FLAGN_C.ru === "Русский") ok("names 日本語 / 한국어 / Русский"); else no("new language names");
if (FLAGS_C.hi === "🇮🇳" && FLAGS_C.es === "🇪🇸" && FLAGS_C.fr === "🇫🇷" && FLAGS_C.ar === "🇸🇦") ok("flags 🇮🇳 🇪🇸 🇫🇷 🇸🇦"); else no("flags of hi / es / fr / ar");
if (FLAGN_C.hi === "हिन्दी" && FLAGN_C.es === "Español" && FLAGN_C.fr === "Français" && FLAGN_C.ar === "العربية") ok("names हिन्दी / Español / Français / العربية"); else no("names of hi / es / fr / ar");
/* the flags and native names are the app's own (lang-extra.ts LANG_META): a returning visitor must recognise the control */
{
  const reg = readFileSync("lang-extra.ts", "utf8");
  const meta = Object.fromEntries([...reg.matchAll(/^\s*(th|en|zh|ja|ko|ru|hi|es|fr|ar): \{ flag: "([^"]+)", name: "([^"]+)"/gm)].map((m) => [m[1], { flag: m[2], name: m[3] }]));
  const diff = ALL.filter((l) => !meta[l] || meta[l].flag !== FLAGS_C[l] || meta[l].name !== FLAGN_C[l]);
  if (!diff.length) ok("all ten flags and native names are the ones in lang-extra.ts LANG_META"); else no("flag / name differs from LANG_META", diff.join());
  /* right to left: exactly the languages the registry marks rtl, and dirOf() says so */
  const rtlReg = [...reg.matchAll(/^\s*(\w{2,3}): \{[^}\n]*\brtl: true/gm)].map((m) => m[1]).sort().join();
  if (rtlReg === [...RTL_LANGS].sort().join() && rtlReg === "ar" && ALL.every((l) => dirOf(l) === (l === "ar" ? "rtl" : "ltr"))) ok("RTL_LANGS = ar = the languages lang-extra.ts marks rtl; dirOf is rtl for ar only");
  else no("rtl set", `registry "${rtlReg}" landing "${RTL_LANGS.join()}"`);
}
if (ALL.every((l) => pickLang(l) === l) && pickLang("de") === "th" && pickLang(undefined) === "th") ok("pickLang follows the URL's language and falls back to th (no navigator sniffing)");
else no("pickLang");
const FONTCSS = readFileSync("landing/landing.css", "utf8");
if (/"Hiragino Sans"/.test(FONTCSS) && /"Malgun Gothic"/.test(FONTCSS) && /"Noto Sans KR"/.test(FONTCSS) && /"Noto Sans JP"/.test(FONTCSS) && /"Apple SD Gothic Neo"/.test(FONTCSS) && /"Yu Gothic"/.test(FONTCSS)) ok("CSS font stack carries the ja / ko faces");
else no("CSS font stack");
if (/\.lp-langs\s*\{[^}]*flex:\s*1 0 100%/.test(FONTCSS) && /max-width:420px\)\{\s*\.lp-lang\s*\{[^}]*flex-direction:\s*column/.test(FONTCSS.replace(/\s+/g, " ").replace(/\{ /g, "{").replace(/ \}/g, "}")))
  ok("CSS: the language nav takes its own row and stacks flag over name under 420 px");
else no("CSS language nav layout");
{
  const css = FONTCSS.replace(/\s+/g, " ");
  /* ten pills: two rows of five (ten in one row leave 28 px a segment at 320 px), each pill still a 44 px target on a phone */
  const compact = css.replace(/\{ /g, "{").replace(/ \}/g, "}");
  if (/\.lp-langs \{[^}]*display: grid; grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/.test(css) && /max-width:420px\)\{\s*\.lp-lang\s*\{[^}]*min-height:\s*44px/.test(compact))
    ok("CSS: ten language pills in a five-column grid (two rows), 44 px tall under 420 px");
  else no("CSS ten-pill grid");
  /* Arabic and Devanagari type: their own stacks on the --font variable, a 1.7 line, tracking zeroed */
  if (/:lang\(ar\) \{ --font: "Noto Naskh Arabic", "Noto Sans Arabic", "Segoe UI", Tahoma, system-ui, sans-serif; \}/.test(css)
    && /:lang\(hi\) \{ --font: "Noto Sans Devanagari", "Nirmala UI", Mangal, system-ui, sans-serif; \}/.test(css)
    && /body:lang\(ar\), body:lang\(hi\) \{ line-height: 1\.7; \}/.test(css)) ok("CSS: Arabic and Devanagari font stacks (:lang(ar) / :lang(hi)) with a 1.7 line");
  else no("CSS Arabic / Devanagari type");
  /* right to left: the keyboard stays left to right, the e-mail field too, bold runs and the proof number are bidi-isolated, the physical left / right rules are mirrored */
  const need = ['html[dir="rtl"] .kr { direction: ltr; unicode-bidi: isolate; }', 'html[dir="rtl"] .lp-field input[type="email"] { direction: ltr;', 'html[dir="rtl"] .lp-bub b { unicode-bidi: isolate; }',
    'html[dir="rtl"] .lp-proof b { unicode-bidi: plaintext; }', 'html[dir="rtl"] .lp-openbtn { margin-left: 0; margin-right: auto; }', 'html[dir="rtl"] .lp-chips { padding: 4px 30px 0 0; }'];
  const lost = need.filter((x) => !css.includes(x));
  if (!lost.length) ok("CSS: the right-to-left block (keyboard and e-mail stay ltr, bold runs isolated, open-in-browser / chips / bubbles mirrored)"); else no("CSS rtl block", lost.join(" ; "));
}

/* ── the guest-profile write and the live-AI language ─────────────────── */
console.log("== language handed to the app and to landing-chat ==");
{
  const PAGE = readFileSync("landing/LandingPage1.tsx", "utf8");
  if (/document\.documentElement\.dir = dirOf\(lang\);/.test(PAGE)) ok("LandingPage1 sets <html dir> from dirOf(lang) next to <html lang>"); else no("LandingPage1 does not set dir");
  if (/SONG_PAGE_LANGS = \["th", "en", "zh"\]/.test(PAGE)) ok("the footer's All songs link points at /songs/en/ for every language that has no song pages of its own"); else no("footer songs link");
}
const PAGE_SRC = readFileSync("landing/LandingPage1.tsx", "utf8");
if (/function storeLang\(lg\)\s*\{\s*if \(!LANGS\.includes\(lg\)\) return;/.test(PAGE_SRC)) ok("storeLang accepts every landing language (ja / ko / ru included)");
else no("storeLang guard");
if (/storeLang\(pgLang\.slice\(0, 2\)\.toLowerCase\(\)\)/.test(PAGE_SRC) && (PAGE_SRC.match(/storeLang\(lang\);/g) || []).length >= 3)
  ok("the page language is written to the guest profile at Google, e-mail-link and e-mail sign-up (and on a pill tap)");
else no("sign-up writes the page language");
if (AIMOD) {
  const { wireLang, SERVER_LANGS } = AIMOD;
  for (const lg of ALL) {
    const w = wireLang(lg, "How do I read notes?");
    if (w.lang === lg && w.question === "How do I read notes?") ok(`landing-chat: ${lg} is sent as-is`); else no(`landing-chat ${lg}`, JSON.stringify(w));
  }
  // a language the function does not know still falls back to "en" with a last-word reply instruction
  for (const lg of ["pt"]) {
    const w = wireLang(lg, "Como leio notas?");
    if (w.lang === "en" && w.question.startsWith("Como leio notas?") && w.question.includes("Reply in")) ok(`landing-chat: an unknown language (${lg}) goes as "en" + a reply-language note`);
    else no(`landing-chat ${lg}`, JSON.stringify(w));
  }
  if (SERVER_LANGS.join() === ALL.join()) ok("SERVER_LANGS lists exactly what the repo's landing-chat knows (th, en, zh, ja, ko, ru, hi, es, fr, ar; the last four need the function deployed before the client is)"); else no("SERVER_LANGS", SERVER_LANGS.join());
}
const FN_SRC = existsSync("supabase/functions/landing-chat/index.ts") ? readFileSync("supabase/functions/landing-chat/index.ts", "utf8") : "";
if (/\["th", "en", "zh", "ja", "ko", "ru", "hi", "es", "fr", "ar"\]\.includes\(body\?\.lang\) \? body\.lang : "th"/.test(FN_SRC)) ok("the repo's landing-chat whitelists all ten languages and SERVER_LANGS matches it (th..ru are deployed since 2026-11-13; hi, es, fr, ar are in the repo's copy and need deploying)");
else no("landing-chat whitelist moved — re-read it and update landing-ai.ts SERVER_LANGS");
/* every language has its own system prompt and its own limit message in the function, and the prompts keep the rules that make it safe (a short answer, notes and fingers, no invented facts) */
{
  let SYS = null, LIM = null;
  try {
    const m = FN_SRC.match(/const SYSTEM: Record<string, string> = (\{[\s\S]*?\n\});\n\nconst LIMIT_MSG: Record<string, string> = (\{[\s\S]*?\n\});/);
    SYS = new Function("return (" + m[1] + ")")(); LIM = new Function("return (" + m[2] + ")")();
  } catch (e) { no("landing-chat SYSTEM / LIMIT_MSG parse", e && e.message); }
  if (SYS && LIM) {
    const miss = ALL.filter((l) => !SYS[l] || !LIM[l]);
    if (!miss.length && Object.keys(SYS).join() === ALL.join() && Object.keys(LIM).join() === ALL.join()) ok("landing-chat: a system prompt and a limit message for each of the ten languages, in the same order");
    else no("landing-chat: prompts / limit messages", "missing " + miss.join());
    const weak = ALL.filter((l) => !(SYS[l].includes("TIGA") && SYS[l].includes("150") && SYS[l].includes("C D E F G A B") && SYS[l].includes("1-5") && SYS[l].includes("**")));
    if (!weak.length) ok("landing-chat: every prompt names TIGA, the 150-word cap, note names, finger numbers 1-5 and allows only **bold**"); else no("landing-chat: prompt rules missing in", weak.join());
    const own = NEWL.filter((l) => !{ hi: /[\u0900-\u097F]/, ar: /[\u0600-\u06FF]/, es: /Responde siempre en español/, fr: /Répondez toujours en français/ }[l].test(SYS[l]) || !{ hi: /[\u0900-\u097F]/, ar: /[\u0600-\u06FF]/, es: /Se acabaron/, fr: /épuisées/ }[l].test(LIM[l]));
    if (!own.length) ok("landing-chat: the hi / es / fr / ar prompts tell the model to answer in that language and the limit messages are written in it"); else no("landing-chat: prompt language", own.join());
    if (/لهجات/.test(SYS.ar) && /0-9/.test(SYS.ar)) ok("landing-chat: the Arabic prompt asks for simple Modern Standard Arabic (no dialect) and Western digits 0-9"); else no("landing-chat: Arabic prompt rules");
    if (ALL.every((l) => !/Premium|Max\b|3,999|1,490|10,000/.test(SYS[l] + LIM[l]))) ok("landing-chat: no plan tier, price tier or cap is named in any prompt or limit message"); else no("landing-chat: a tier / cap is named");
  }
}

/* ── the crash screen and the sign-up errors, every language ───────────────
   friendlyAuthError answers th / en / zh with the Thai-and-English line it always had, and every other language with its own sentence
   followed by the English one ("native · English"); the ErrorBoundary's fallback reads <html lang> and does the same. */
console.log("== crash screen and sign-up errors speak every landing language ==");
if (UTILS) {
  const { friendlyAuthError, ErrorBoundary } = UTILS;
  const NATIVE = { ja: /[぀-ヿ一-鿿]/, ko: /[가-힯]/, ru: /[Ѐ-ӿ]/, hi: /[ऀ-ॿ]/, ar: /[؀-ۿ]/, es: /ya está registrado/, fr: /déjà enregistrée/ };
  const EXTRA = ["ja", "ko", "ru", ...NEWL];
  const bad = [];
  for (const lg of EXTRA) {
    const a = friendlyAuthError("User already registered", lg), c = friendlyAuthError("Invalid login credentials", lg), n = friendlyAuthError("Failed to fetch", lg), o = friendlyAuthError("", lg);
    if (!NATIVE[lg].test(a) || !a.endsWith(" · This email is already registered — try logging in instead")) bad.push(lg + ":exists");
    if (!c.endsWith(" · Incorrect email or password") || c.split(" · ")[0].length < 8) bad.push(lg + ":creds");
    if (!n.endsWith(" · Couldn't connect — please try again") || n.split(" · ")[0].length < 8) bad.push(lg + ":net");
    if (!o.endsWith(" · Something went wrong — please try again") || o.split(" · ")[0].length < 8) bad.push(lg + ":other");
    if (friendlyAuthError("some provider text", lg) !== "some provider text") bad.push(lg + ":passthrough");
  }
  if (!bad.length) ok("friendlyAuthError: ja / ko / ru / hi / es / fr / ar each answer exists / creds / net / other in their own language + the English tail, and pass an unknown provider message through"); else no("friendlyAuthError", bad.join(" "));
  if (["th", "en", "zh"].every((lg) => /^อีเมลนี้สมัครไว้แล้ว/.test(friendlyAuthError("User already registered", lg)))) ok("friendlyAuthError: th / en / zh keep the Thai-and-English line they always had"); else no("friendlyAuthError th / en / zh changed");
  const texts = (el) => (el == null || typeof el === "boolean" ? [] : typeof el === "string" || typeof el === "number" ? [String(el)] : Array.isArray(el) ? el.flatMap(texts) : texts(el.props && el.props.children));
  const crash = (lg) => {
    const keep = globalThis.document;
    globalThis.document = { documentElement: { getAttribute: () => lg } };
    try { const eb = new ErrorBoundary({}); eb.state = { hasError: true }; return texts(eb.render()).join(" | "); } finally { globalThis.document = keep; }
  };
  const badCrash = [];
  for (const lg of ALL) {
    const t = crash(lg);
    if (!/Something went wrong|Sorry about that/.test(t) || !/Reload|Sorry about that/.test(t)) badCrash.push(lg + ": no English line");
    if (EXTRA.includes(lg) && !({ ...NATIVE, es: /Algo salió mal/, fr: /Une erreur s'est produite/ }[lg]).test(t)) badCrash.push(lg + ": no native text");
    if (["th", "en", "zh"].includes(lg) && !/เกิดข้อผิดพลาด/.test(t)) badCrash.push(lg + ": not the Thai default");
  }
  if (!badCrash.length) ok("ErrorBoundary: the fallback screen reads <html lang> — its own language + English for ja / ko / ru / hi / es / fr / ar, the Thai + English default for th / en / zh"); else no("ErrorBoundary fallback", badCrash.join(" ; "));
}

cleanup();
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
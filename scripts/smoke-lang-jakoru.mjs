#!/usr/bin/env node
/* smoke-lang-jakoru.mjs — the REAL built app (dist/) in headless Chromium, switched to each of the seven extra languages: Japanese, Korean and Russian (2026-11-11),
   Hindi, Spanish, French and Arabic (2026-11-13). The file name is the old one (it began as ja / ko / ru); it covers all ten languages now.

     npm run build && node scripts/smoke-lang-jakoru.mjs
     DIST=/path/to/another/build node scripts/smoke-lang-jakoru.mjs        (any folder that holds a built index.html and bundle/; the default is ./dist)

   Proves, for ja ko ru hi es fr ar, at a 320 x 568 phone (the narrowest and shortest screen the app supports):
     - the header language menu lists TEN languages, in registry order, each in its own script, and the menu stays inside the viewport, in the default language and again after switching (right-to-left for Arabic);
     - choosing the language loads that language's catalog chunk and no other, sets <html lang> and <html dir> (rtl for Arabic and ONLY for Arabic), writes the guest profile and
       tg_lang_hint, and the first screen and the bottom tab bar are in the right script (kana / kanji, hangul, Cyrillic, Devanagari, Arabic);
     - Spanish and French share the Latin script with English, so a script test cannot see them: for those two the first screen and the tab labels must DIFFER from the English ones
       (many lines, most tab labels) and carry accented letters of that language, and <html dir> stays ltr;
     - Arabic: <html dir="rtl">, a piano key row (.kr) is direction:ltr (isolated) inside it, and the numbers print Western digits 0-9 on a device whose own locale is ar-SA
       (a plain toLocaleString() prints Arabic-Indic digits there unless the app's digit rule is on); Hindi on a hi-IN device never prints Devanagari digits;
     - the pricing card quotes baht (th), yuan (zh) and US dollars (en and all seven extra languages: ja ko ru used to show baht);
     - the members-only login card (raised through the test door tg_test_forcelogin) speaks the chosen language, flows rtl for Arabic and does not scroll sideways;
     - no page error and no React / undefined console error after switching, after visiting the tabs and after a reload; the page does not scroll sideways;
     - a reload keeps the language and puts the catalog in before the first paint; Thai, English and Chinese download no catalog and stay ltr.
   NOT proven here: how any of it looks or sounds on a real phone, a real screen reader or a real network (every Supabase / Google call is refused: a guest session needs none); fonts
   (this machine's Chromium may lack Devanagari or Naskh faces, so glyph quality is not judged); speech (no microphone, no voices); pages that need a signed-in account or database rows.
   Needs Playwright + Chromium (preinstalled in the cloud containers). */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pw from "/opt/node22/lib/node_modules/playwright/index.js";

const ROOT = process.env.DIST ? path.resolve(process.env.DIST) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".txt": "text/plain", ".woff2": "font/woff2", ".wasm": "application/wasm" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  let fp = path.join(ROOT, u === "/" ? "/index.html" : u);
  if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, "index.html");
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp)) { res.writeHead(404); return res.end("nf"); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream", "Cache-Control": "no-store" });
  res.end(fs.readFileSync(fp));
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

let pass = 0; const fails = [];
const ok = (c, n) => { if (c) { pass++; console.log("PASS " + n); } else { fails.push(n); console.log("FAIL " + n); } };

// the registry order of the picker (lang-extra.ts ALL_LANGS / LANG_META) and what the menu must show
const NAME = { th: "ไทย", en: "English", zh: "中文", ja: "日本語", ko: "한국어", ru: "Русский", hi: "हिन्दी", es: "Español", fr: "Français", ar: "العربية" };
const ORDER = ["th", "en", "zh", "ja", "ko", "ru", "hi", "es", "fr", "ar"];
const EXTRA = ["ja", "ko", "ru", "hi", "es", "fr", "ar"];
const SCRIPT = { ja: /[぀-ヿ㐀-鿿]/g, ko: /[가-힯]/g, ru: /[Ѐ-ӿ]/g, hi: /[ऀ-ॿ]/g, ar: /[؀-ۿݐ-ݿ]/g };   // Latin-script es / fr are not here on purpose
const ACCENT = { es: /[áéíóúñ¿¡]/gi, fr: /[éèêàâçùûôîïœ]/gi };
const LOCALE = { ja: "en-US", ko: "en-US", ru: "en-US", hi: "hi-IN", es: "es-ES", fr: "fr-FR", ar: "ar-SA" };   // the DEVICE's own locale: ar-SA is where a plain toLocaleString() prints Arabic-Indic digits
const VW = 320, VH = 568;

async function fresh(locale = "en-US") {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, locale });
  const page = await ctx.newPage();
  const errors = [], chunks = [];
  page.on("pageerror", e => errors.push(String(e && e.stack || e).slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" && /Minified React|Cannot read|is not a function|is not defined|undefined/.test(m.text())) errors.push("console: " + m.text().slice(0, 240)); });
  page.on("request", r => { const m = /\/(i18n-(ja|ko|ru|hi|es|fr|ar))-[\w-]+\.js/.exec(r.url()); if (m) chunks.push(m[2]); });
  // every call to the live backend is refused: a guest session needs none
  await page.route(/supabase\.co|googleapis|google-analytics|googletagmanager/, r => r.abort());
  return { ctx, page, errors, chunks };
}
// the welcome pop-up (and any later one) sits over the header: close it the way a learner would
const closePops = async page => { for (let i = 0; i < 3; i++) { const x = await page.$(".atpopup-x"); if (!x) break; await x.click().catch(() => {}); await page.waitForTimeout(250); } };
const text = async page => (await page.evaluate(() => document.body.innerText)) || "";
const tabsOf = async page => page.$$eval(".tabbar button, .tab-bar button, nav button", els => els.map(e => e.textContent.trim()).filter(Boolean).slice(0, 8));
const count = (s, re) => (s.match(re) || []).length;
const lines = s => s.split("\n").map(x => x.trim()).filter(Boolean);
const open = async (page, qs = "?ux=2") => { await page.goto(BASE + qs, { waitUntil: "domcontentloaded" }); await page.waitForSelector(".flagbtn", { timeout: 30000 }); await page.waitForTimeout(1200); await closePops(page); };
const pick = async (page, lg) => {
  await closePops(page);   // a pop-up (the education tip, 2.5 s after the first screen) can sit over the flag button
  await page.click(".flagbtn");
  await page.locator(".flagitem", { hasText: NAME[lg] }).click();
  await page.waitForFunction(l => document.documentElement.lang === l, lg === "zh" ? "zh-CN" : lg, { timeout: 15000 });
  await page.waitForTimeout(800); await closePops(page);
};
// the price on the pricing card (header pill "Upgrade Premium"): baht for Thai, yuan for Chinese, US dollars for English AND for every extra language
// (the catalogs hold the WORD "usd" translated, and by(CURRENCY_BY_LANG, lang) used to hand the checkout "米ドル" / "अमेरिकी डॉलर": ja ko ru showed baht, see payment.tsx currencyOf)
const priceOf = async page => {
  const b = await page.$(".pgupgrade"); if (!b) return null;
  await b.click(); await page.waitForSelector(".prtier-price", { timeout: 8000 });
  const prices = await page.$$eval(".prtier-price", els => els.map(e => e.textContent.trim()));
  await page.locator(".sethdr .cbtn").first().click().catch(() => {}); await page.waitForTimeout(250);   // close the card again: the next steps use the page behind it
  return prices;
};
// the members-only login card ("wall", app-shell.tsx LoginWall) is raised on the owner's own domain; anywhere else the documented test door tg_test_forcelogin shows the same card to a guest
const wallOf = async page => {
  await page.evaluate(() => { try { localStorage.setItem("tg_test_forcelogin", "1"); } catch (e) {} });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-login-wall]", { timeout: 30000 }); await page.waitForTimeout(600);
  return page.evaluate(() => { const w = document.querySelector("[data-login-wall]"); return { text: w.innerText, dir: getComputedStyle(w).direction, over: w.scrollWidth - w.clientWidth }; });
};
const sideways = page => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bsw: document.body.scrollWidth }));

// ── Thai (the default) downloads no catalog and lists ten languages; English is the reference the Latin-script languages are compared with ──
let EN = null;
{
  const { ctx, page, errors, chunks } = await fresh();
  await open(page);
  ok(chunks.length === 0, "the default language downloads no catalog chunk");
  ok(await page.evaluate(() => document.documentElement.dir) === "ltr" && await page.evaluate(() => document.documentElement.lang) === "th", "Thai: <html lang=th dir=ltr>");
  await page.click(".flagbtn");
  const menu = await page.evaluate(() => { const m = document.querySelector(".flagmenu"), r = m.getBoundingClientRect(); return { names: [...m.querySelectorAll(".flagitem .fn")].map(e => e.textContent), r: [r.left, r.top, r.right, r.bottom], vw: innerWidth, vh: innerHeight }; });
  ok(menu.names.length === 10, "the header language menu lists ten languages (" + menu.names.length + ")");
  ok(JSON.stringify(menu.names) === JSON.stringify(ORDER.map(l => NAME[l])), "...in registry order, each in its own script: " + menu.names.join(" | "));
  ok(menu.r[0] >= 0 && menu.r[1] >= 0 && menu.r[2] <= menu.vw + 0.5 && menu.r[3] <= menu.vh + 0.5, `...and the menu stays inside the ${menu.vw} x ${menu.vh} viewport (${menu.r.map(Math.round).join(",")})`);
  await page.click(".flagbtn"); await page.waitForTimeout(200);   // the menu closes on a click (there is no Escape handler); an open menu would sit over the Upgrade pill on a narrow screen
  const thPrice = await priceOf(page);
  ok(thPrice && /^฿799/.test(thPrice[0]), "Thai: the pricing card quotes baht (" + (thPrice && thPrice[0]) + ")");
  ok(errors.length === 0, "no page error on the default language: " + errors.join(" ; "));
  await ctx.close();
}
for (const lg of ["en", "zh"]) {
  const { ctx, page, errors, chunks } = await fresh();
  await open(page); await pick(page, lg);
  ok(chunks.length === 0, `${lg}: no catalog chunk is downloaded`);
  ok(await page.evaluate(() => document.documentElement.dir) === "ltr", `${lg}: dir is ltr`);
  const pr = await priceOf(page);
  ok(pr && (lg === "en" ? /^US\$24\.99/ : /^¥176/).test(pr[0]), `${lg}: the pricing card quotes ${lg === "en" ? "US dollars" : "yuan"} (${pr && pr[0]})`);
  if (lg === "en") { EN = { text: await text(page), tabs: await tabsOf(page) }; EN.wall = await wallOf(page); }
  ok(errors.length === 0, `${lg}: no page error (${errors.join(" ; ")})`);
  await ctx.close();
}

// ── each extra language ──
for (const lg of EXTRA) {
  const { ctx, page, errors, chunks } = await fresh(LOCALE[lg]);
  await open(page);
  const before = await text(page);
  await page.click(".flagbtn");
  const menu = await page.evaluate(() => { const m = document.querySelector(".flagmenu"), r = m.getBoundingClientRect(); return { n: m.querySelectorAll(".flagitem").length, r: [r.left, r.top, r.right, r.bottom] }; });
  ok(menu.n === 10 && menu.r[0] >= 0 && menu.r[2] <= VW + 0.5 && menu.r[3] <= VH + 0.5, `${lg}: the menu lists ${menu.n} languages and stays inside the ${VW} px viewport (${menu.r.map(Math.round).join(",")})`);
  await page.locator(".flagitem", { hasText: NAME[lg] }).click();
  await page.waitForFunction(l => document.documentElement.lang === l, lg, { timeout: 15000 });
  await page.waitForTimeout(800); await closePops(page);

  ok(chunks.length === 1 && chunks[0] === lg, `${lg}: only the ${lg} catalog chunk was downloaded (${chunks.join(",") || "none"})`);
  ok(await page.evaluate(() => document.documentElement.lang) === lg, `${lg}: <html lang> is ${lg}`);
  const dir = await page.evaluate(() => [document.documentElement.dir, getComputedStyle(document.body).direction]);
  ok(lg === "ar" ? dir[0] === "rtl" && dir[1] === "rtl" : dir[0] === "ltr" && dir[1] === "ltr", `${lg}: <html dir> is ${dir[0]} and the body flows ${dir[1]} (${lg === "ar" ? "right-to-left" : "left-to-right"} expected)`);
  const hint = await page.evaluate(() => localStorage.getItem("tg_lang_hint"));
  ok(hint === lg, `${lg}: tg_lang_hint remembers the language (${hint})`);
  const prof = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("tg_guest_profile") || "{}").lang; } catch (e) { return null; } });
  ok(prof === lg, `${lg}: the guest profile stores ${lg} (${prof})`);

  const after = await text(page), tabs = await tabsOf(page);
  ok(after !== before, `${lg}: the screen text changed`);
  if (SCRIPT[lg]) {
    const chars = count(after, SCRIPT[lg]);
    ok(chars >= 12, `${lg}: the first screen shows ${chars} characters in ${lg} script`);
    ok(tabs.length === 0 || tabs.some(t => count(t, SCRIPT[lg]) > 0), `${lg}: bottom tab bar labels: ${tabs.join(" / ")}`);
  } else {
    // Latin script: a script test cannot tell Spanish or French from English, so compare with the English screen and look for the language's own accented letters
    const enLines = new Set(lines(EN.text)), changed = lines(after).filter(l => !enLines.has(l)).length;
    ok(changed >= 8, `${lg}: ${changed} lines of the first screen differ from the English screen`);
    ok(count(after, ACCENT[lg]) >= 3, `${lg}: the first screen carries ${count(after, ACCENT[lg])} accented ${lg} letters`);
    const diffTabs = tabs.filter((t, i) => EN.tabs[i] !== undefined && t !== EN.tabs[i]).length;
    ok(tabs.length > 0 && diffTabs >= 3, `${lg}: ${diffTabs} of ${tabs.length} tab labels differ from English: ${tabs.join(" / ")}`);
  }
  const sw = await sideways(page);
  ok(sw.sw <= sw.cw + 1 && sw.bsw <= sw.cw + 1, `${lg}: the page does not scroll sideways at ${VW} px (scrollWidth ${sw.sw}, client ${sw.cw})`);
  ok(errors.length === 0, `${lg}: no page error after switching (${errors.join(" ; ")})`);
  const xp = await priceOf(page);
  ok(xp && /^US\$24\.99/.test(xp[0]), `${lg}: the pricing card quotes US dollars like English, never baht or a translated word (${xp && xp[0]})`);
  ok(errors.length === 0, `${lg}: no page error on the pricing card (${errors.join(" ; ")})`);

  // the header flag button, measured where it is (nothing is scrolled to it first). INFO only, never a failure: at 320-412 px the header row is wider than the screen in th / en / zh / ja / ko / ru
  // (the flag sits at x = 380-470), which was already so before hi / es / fr / ar; the new languages fit from 390 px up, with the guest login pill squeezed (app-css.ts, .guestloginpill max-width)
  const fb = await page.evaluate(() => { const b = document.querySelector(".flagbtn").getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; });
  console.log(`INFO ${lg}: the header flag button spans x = ${fb[0]}..${fb[1]} of a ${VW} px screen${fb[0] < 0 || fb[1] > VW ? " (partly or wholly off the screen: the picker is also in Settings > Language)" : ""}`);
  // the menu opened again IN this language (right-to-left for Arabic: the menu hangs from the left edge of its button there) still lists ten and stays inside the screen
  await page.click(".flagbtn");
  const menu2 = await page.evaluate(() => { const m = document.querySelector(".flagmenu"), r = m && m.getBoundingClientRect(); return m ? { n: m.querySelectorAll(".flagitem").length, r: [r.left, r.top, r.right, r.bottom] } : null; });
  ok(menu2 && menu2.n === 10 && menu2.r[0] >= -0.5 && menu2.r[2] <= VW + 0.5 && menu2.r[1] >= 0 && menu2.r[3] <= VH + 0.5, `${lg}: opened again in ${lg}, the menu lists ${menu2 && menu2.n} languages and stays inside the ${VW} x ${VH} screen (${menu2 && menu2.r.map(Math.round).join(",")})`);
  await page.click(".flagbtn"); await page.waitForTimeout(200);   // close it again

  if (lg === "ar") {
    const kr = await page.evaluate(() => { const el = document.querySelector(".kr"); if (!el) return null; const s = getComputedStyle(el); return { dir: s.direction, bidi: s.unicodeBidi }; });
    ok(kr && kr.dir === "ltr", "ar: the piano key row (.kr) stays direction:ltr inside the right-to-left page (" + JSON.stringify(kr) + ")");
    ok(kr && /isolate/.test(kr.bidi), "ar: ...and is isolated for the bidi algorithm (" + (kr && kr.bidi) + ")");
  }
  if (lg === "ar" || lg === "hi") {
    // the digits: the context's own locale is ar-SA / hi-IN, so this is exactly what a learner's phone would do
    const dg = await page.evaluate(() => ({ plain: (1234567).toLocaleString(), plainUndef: (1234567).toLocaleString(undefined), day: new Date(Date.UTC(2026, 10, 16, 12)).toLocaleDateString(undefined, { timeZone: "UTC" }), body: document.body.innerText, def: Intl.DateTimeFormat().resolvedOptions().locale }));
    if (lg === "ar") ok(/^[0-9,.\s]+$/.test(dg.plain) && dg.plain === dg.plainUndef && !/[٠-٩]/.test(dg.day) && !/[٠-٩]/.test(dg.body), `ar: on an ${dg.def} device a plain toLocaleString() prints ${dg.plain} (Western digits), a date prints ${dg.day}, and no Arabic-Indic digit is on the screen`);
    else ok(!/[०-९]/.test(dg.plain + dg.day + dg.body), `hi: on an ${dg.def} device numbers print ${dg.plain} and dates ${dg.day}: no Devanagari digit anywhere on the screen`);
  }

  // visit the other main pages through the tab bar / drawer: none may throw
  for (const sel of [".tabbar button:nth-child(2)", ".tabbar button:nth-child(3)", ".tabbar button:nth-child(4)", ".tabbar button:nth-child(5)"]) {
    try { await page.click(sel, { timeout: 2500 }); await page.waitForTimeout(500); } catch (e) { /* no tab bar at this size: skip */ }
  }
  ok(errors.length === 0, `${lg}: no page error after visiting the tabs (${errors.join(" ; ")})`);
  const sw2 = await sideways(page);
  ok(sw2.sw <= sw2.cw + 1, `${lg}: no sideways scroll after visiting the tabs (scrollWidth ${sw2.sw}, client ${sw2.cw})`);

  // a reload keeps the language, and the catalog is in before the first paint
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".flagbtn", { timeout: 30000 });
  ok(await page.evaluate(() => document.documentElement.lang) === lg && await page.evaluate(() => document.documentElement.dir) === (lg === "ar" ? "rtl" : "ltr"), `${lg}: a reload keeps <html lang> and <html dir>`);
  await page.waitForTimeout(500);
  const again = await text(page);
  if (SCRIPT[lg]) ok(count(again, SCRIPT[lg]) >= 12, `${lg}: after a reload the screen is still in ${lg}`);
  else ok(again !== EN.text && count(again, ACCENT[lg]) >= 3, `${lg}: after a reload the screen is still in ${lg} (not the English text)`);
  ok(errors.length === 0, `${lg}: no page error after a reload (${errors.join(" ; ")})`);

  // Settings > Language (drawer, second "sub" item): the two-column grid lists ten and fits the screen
  await page.evaluate(() => document.querySelector(".hamb").click()); await page.waitForTimeout(500);
  await page.evaluate(() => { const subs = [...document.querySelectorAll(".draweritem.sub")]; if (subs[1]) subs[1].click(); }); await page.waitForTimeout(800);
  const grid = await page.evaluate(() => { const el = document.querySelector(".setlangs-all"); if (!el) return null; const r = el.getBoundingClientRect(); return { n: el.querySelectorAll("button").length, l: r.left, r: r.right, sw: el.scrollWidth, cw: el.clientWidth }; });
  ok(grid && grid.n === 10 && grid.l >= 0 && grid.r <= VW + 0.5 && grid.sw <= grid.cw + 1, `${lg}: Settings > Language lists ${grid && grid.n} languages in a grid that fits the ${VW} px screen (x ${grid && Math.round(grid.l)}..${grid && Math.round(grid.r)}, no sideways overflow)`);
  ok(errors.length === 0, `${lg}: no page error in Settings (${errors.join(" ; ")})`);

  // the login card of the members-only domain: it used to honour th / en / zh only and showed English to someone who had chosen another language
  const wall = await wallOf(page);
  if (SCRIPT[lg]) ok(count(wall.text, SCRIPT[lg]) >= 6, `${lg}: the login card is in ${lg} (${count(wall.text, SCRIPT[lg])} characters in its script)`);
  else ok(wall.text !== EN.wall.text && lines(wall.text).filter(l => !new Set(lines(EN.wall.text)).has(l)).length >= 5 && count(wall.text, ACCENT[lg]) >= 1, `${lg}: the login card is in ${lg}, not English (${lines(wall.text).filter(l => !new Set(lines(EN.wall.text)).has(l)).length} lines differ, ${count(wall.text, ACCENT[lg])} accented letters)`);
  ok(wall.dir === (lg === "ar" ? "rtl" : "ltr") && wall.over <= 1, `${lg}: the login card flows ${wall.dir} and does not scroll sideways at ${VW} px (${wall.over} px over)`);
  ok(errors.length === 0, `${lg}: no page error on the login card (${errors.join(" ; ")})`);
  await ctx.close();
}

await browser.close(); server.close();
console.log(`\n${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);

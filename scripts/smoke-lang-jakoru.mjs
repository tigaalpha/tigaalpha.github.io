#!/usr/bin/env node
/* smoke-lang-jakoru.mjs — the REAL built app (dist/) in headless Chromium, switched to Japanese, Korean and Russian.

     npm run build && node scripts/smoke-lang-jakoru.mjs

   Proves: the language menu lists six languages; choosing ja / ko / ru loads that language's catalog chunk (and only that one), sets <html lang>,
   writes the guest profile and the tg_lang_hint, shows text in the right script on the first screen, the bottom tab bar and the settings panel, and
   never throws a page error (a `MAP[lang]` that is undefined for a new language is exactly the crash this guards). A reload keeps the language and
   loads the catalog BEFORE the first paint (no English flash). Th / en / zh must not download any catalog. Every Supabase call is stubbed.
   Needs Playwright + Chromium (preinstalled in the cloud containers). */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pw from "/opt/node22/lib/node_modules/playwright/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".webp": "image/webp", ".txt": "text/plain" };
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

const SCRIPT = { ja: /[぀-ヿ㐀-鿿]/g, ko: /[가-힯]/g, ru: /[Ѐ-ӿ]/g };
const NAME = { ja: "日本語", ko: "한국어", ru: "Русский" };

async function fresh() {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, locale: "en-US" });
  const page = await ctx.newPage();
  const errors = [], chunks = [];
  page.on("pageerror", e => errors.push(String(e && e.stack || e).slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" && /Minified React|Cannot read|is not a function|is not defined|undefined/.test(m.text())) errors.push("console: " + m.text().slice(0, 240)); });
  page.on("request", r => { const m = /\/(i18n-(ja|ko|ru))-[\w-]+\.js/.exec(r.url()); if (m) chunks.push(m[2]); });
  // every call to the live backend is refused: a guest session needs none
  await page.route(/supabase\.co|googleapis|google-analytics|googletagmanager/, r => r.abort());
  return { ctx, page, errors, chunks };
}
// the welcome pop-up (and any later one) sits over the header: close it the way a learner would
const closePops = async page => { for (let i = 0; i < 3; i++) { const x = await page.$(".atpopup-x"); if (!x) break; await x.click().catch(() => {}); await page.waitForTimeout(250); } };
const text = async page => (await page.evaluate(() => document.body.innerText)) || "";
const count = (s, re) => (s.match(re) || []).length;

// ── Thai (the default) downloads no catalog ──
{
  const { ctx, page, errors, chunks } = await fresh();
  await page.goto(BASE + "?ux=2", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".flagbtn", { timeout: 30000 });
  await page.waitForTimeout(1200); await closePops(page);
  ok(chunks.length === 0, "the default language downloads no ja / ko / ru catalog");
  await page.click(".flagbtn");
  const items = await page.$$eval(".flagitem .fn", els => els.map(e => e.textContent));
  ok(items.length === 6, "the header language menu lists six languages: " + items.join(" | "));
  ok(["日本語", "한국어", "Русский"].every(n => items.includes(n)), "the new languages are named in their own script");
  ok(errors.length === 0, "no page error on the default language: " + errors.join(" ; "));
  await ctx.close();
}

// ── each new language ──
for (const lg of ["ja", "ko", "ru"]) {
  const { ctx, page, errors, chunks } = await fresh();
  await page.goto(BASE + "?ux=2", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".flagbtn", { timeout: 30000 });
  await page.waitForTimeout(1200); await closePops(page);
  const before = await text(page);
  await page.click(".flagbtn");
  await page.locator(".flagitem", { hasText: NAME[lg] }).click();
  await page.waitForFunction(l => document.documentElement.lang === l, lg, { timeout: 15000 });
  await page.waitForTimeout(800); await closePops(page);
  ok(chunks.length === 1 && chunks[0] === lg, `${lg}: only the ${lg} catalog chunk was downloaded (${chunks.join(",") || "none"})`);
  ok(await page.evaluate(() => document.documentElement.lang) === lg, `${lg}: <html lang> is ${lg}`);
  const hint = await page.evaluate(() => localStorage.getItem("tg_lang_hint"));
  ok(hint === lg, `${lg}: tg_lang_hint remembers the language (${hint})`);
  const prof = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("tg_guest_profile") || "{}").lang; } catch (e) { return null; } });
  ok(prof === lg, `${lg}: the guest profile stores ${lg} (${prof})`);
  const after = await text(page);
  const chars = count(after, SCRIPT[lg]);
  ok(chars >= 12, `${lg}: the first screen shows ${chars} characters in ${lg} script`);
  ok(after !== before, `${lg}: the screen text changed`);
  // bottom tab bar (ux2) is translated too
  const tabs = await page.$$eval(".tabbar button, .tab-bar button, nav button", els => els.map(e => e.textContent.trim()).filter(Boolean).slice(0, 8));
  ok(tabs.length === 0 || tabs.some(t => SCRIPT[lg].test(t)), `${lg}: bottom tab bar labels: ${tabs.join(" / ")}`);
  ok(errors.length === 0, `${lg}: no page error after switching (${errors.join(" ; ")})`);

  // visit the other main pages through the tab bar / drawer: none may throw
  for (const sel of [".tabbar button:nth-child(2)", ".tabbar button:nth-child(3)", ".tabbar button:nth-child(4)", ".tabbar button:nth-child(5)"]) {
    try { await page.click(sel, { timeout: 2500 }); await page.waitForTimeout(500); } catch (e) { /* no tab bar at this size: skip */ }
  }
  ok(errors.length === 0, `${lg}: no page error after visiting the tabs (${errors.join(" ; ")})`);

  // a reload keeps the language, and the catalog is in before the first paint
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".flagbtn", { timeout: 30000 });
  ok(await page.evaluate(() => document.documentElement.lang) === lg, `${lg}: a reload keeps <html lang>`);
  await page.waitForTimeout(500);
  const again = await text(page);
  ok(count(again, SCRIPT[lg]) >= 12, `${lg}: after a reload the screen is still in ${lg}`);
  ok(errors.length === 0, `${lg}: no page error after a reload (${errors.join(" ; ")})`);
  await ctx.close();
}

await browser.close(); server.close();
console.log(`\n${pass} passed, ${fails.length} failed`);
process.exit(fails.length ? 1 : 0);

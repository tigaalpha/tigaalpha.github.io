// The premium interface (ux2) in a real browser: off by default, on by switch, a working tab bar that fits a 320 px phone.
// Needs `npm run build` first and Playwright with Chromium (exits 1 with "did NOT run" when they are missing).
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
let pw;
try { const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); pw = pwm.chromium ? pwm : (pwm.default || pwm); } catch (e) { console.log("this check did NOT run: Playwright is not installed"); process.exit(1); }
const ROOT = path.resolve(process.env.ROOT || "dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("nf"); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const b = await pw.chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
let pass = 0, fail = 0; const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log((ok ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); };
async function open({ ux, page = "pathway", w = 412, q = "" }) {
  const ctx = await b.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript(({ ux, page }) => {
    sessionStorage.setItem("tiga_page", page);
    localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en");
    localStorage.setItem("tg_orient_hint_seen", "1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_pa_intro", "1");
    localStorage.setItem("tg_edu_seen", '{"firstCoins":1,"chest":1,"pet":1,"shop":1,"rich":1,"shopIntro":1}');
    if (ux != null) localStorage.setItem("tg_ux2", ux);
    const si = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === "tg_guest_ms") return; return si.call(this, k, v); };
    const gi = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return k === "tg_guest_ms" ? "0" : gi.call(this, k); };
  }, { ux, page });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 140)));
  await p.goto(BASE + q, { waitUntil: "load" }); await p.waitForTimeout(2200);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(250); }
  return { ctx, p, errs };
}
{ const { ctx, p, errs } = await open({ ux: null });
  check("off by default: no tab bar, no ux2 class", !(await p.$(".tabbar")) && !(await p.$(".tg.ux2")), "errors " + errs.length);
  await ctx.close(); }
{ const { ctx, p, errs } = await open({ ux: "1" });
  check("on by switch: one tab bar with five tabs", (await p.$$(".tabbar .tab")).length === 5);
  check("Learn is the active tab on the pathway", await p.$eval(".tab.on", e => e.dataset.tab) === "learn");
  check("the pathway has NO large title (the owner did not like it, 2026-10-09)", !(await p.$(".uxtitle")));
  await p.click('.tab[data-tab="practice"]'); await p.waitForTimeout(900);
  check("tapping Practice opens the studio and marks it active", await p.$eval(".tab.on", e => e.dataset.tab) === "practice" && !!(await p.$(".studiocard, .studiohero, .pathhero")));
  await p.click('.tab[data-tab="learn"]'); await p.waitForTimeout(700);
  check("tapping Learn comes back to the pathway", !!(await p.$(".pathpage")) && await p.$eval(".tab.on", e => e.dataset.tab) === "learn");
  check("no page error", errs.length === 0, errs.join(" | "));
  await ctx.close(); }
{ const { ctx, p } = await open({ ux: "1", w: 320 });
  const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, clipped: [...document.querySelectorAll(".tab-lb")].filter(e => e.scrollWidth > e.clientWidth + 1).length, bar: !!document.querySelector(".tabbar") }));
  check("320 px phone: tab bar present, no sideways scroll, no clipped label", m.bar && m.sw <= m.cw + 1 && m.clipped === 0, JSON.stringify(m));
  await ctx.close(); }
{ const { ctx, p } = await open({ ux: "1", q: "?ux=0" });
  check("?ux=0 turns it off again, even though the device had it on", !(await p.$(".tabbar")));
  await ctx.close(); }
{ const { ctx, p } = await open({ ux: null, q: "?ux=2" });
  check("?ux=2 turns it on for a device without the switch", (await p.$$(".tabbar .tab")).length === 5);
  await ctx.close(); }
{ const { ctx, p } = await open({ ux: null, q: "" });
  await ctx.close(); }
// ── kid mode across the app ──
async function openKid(kid, page = "pathway") {
  const ctx = await b.newContext({ viewport: { width: 412, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript(({ kid, page }) => {
    sessionStorage.setItem("tiga_page", page);
    localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en");
    localStorage.setItem("tg_orient_hint_seen", "1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_pa_intro", "1");
    localStorage.setItem("tg_edu_seen", '{"firstCoins":1,"chest":1,"pet":1,"shop":1,"rich":1,"shopIntro":1}');
    if (kid != null) localStorage.setItem("tg_kid", kid);
    const si = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === "tg_guest_ms") return; return si.call(this, k, v); };
    const gi = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return k === "tg_guest_ms" ? "0" : gi.call(this, k); };
  }, { kid, page });
  const p = await ctx.newPage(); await p.goto(BASE, { waitUntil: "load" }); await p.waitForTimeout(2200);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(250); }
  return { ctx, p };
}
for (const page of ["pathway", "studio", "sensei", "profile"]) {
  const { ctx, p } = await openKid("1", page);
  const m = await p.evaluate(() => { const bs = [...document.querySelectorAll(".tg.kid button")].filter(e => e.offsetParent && e.getBoundingClientRect().height > 0); return { kid: !!document.querySelector(".tg.kid"), small: bs.filter(e => e.getBoundingClientRect().height < 40).length, n: bs.length }; });
  check(`kid mode on "${page}": the root wears .kid and touch targets are at least ~40 px`, m.kid && m.small <= Math.max(2, Math.floor(m.n * 0.08)), JSON.stringify(m));
  await ctx.close();
}
{ const { ctx, p } = await openKid("1", "pathway");
  const d = await p.evaluate(() => { const e = document.querySelector(".pcardsub"); return e ? getComputedStyle(e).display : "none-found"; });
  check("kid mode hides the card sub-lines on the pathway", d === "none" || d === "none-found", d);
  await ctx.close(); }
{ const { ctx, p } = await openKid("0", "pathway");
  check("kid mode off: no .kid class", !(await p.$(".tg.kid")));
  await ctx.close(); }
await b.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

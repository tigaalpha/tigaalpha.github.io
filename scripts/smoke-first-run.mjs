#!/usr/bin/env node
/* smoke-first-run.mjs — Step 3.1: the 3-minute first run of a NEW member (first-run.tsx, App.tsx frStep).
     npm run build && node scripts/smoke-first-run.mjs        (DIST=<dir> tests another build)
   Stubbed members (a Supabase session in localStorage, every Supabase call answered locally) in Chromium at 390x844:
   (a) a brand-new account (created a minute ago, trial plan) sees the welcome card ONCE, with the trial line and three level buttons that fit the screen; one level tap opens the easiest short song on the normal
       ready screen; a bot plays it; the tip card with the trial status and "Go to the next lesson" appears; the next-lesson button lands on the Pathway; a reload shows nothing again;
   (b) an OLD account never sees it;   (c) a new account can Skip on the first page: nothing else opens, and a reload shows nothing.
   Proves the wiring in a headless browser, NOT how it feels on a phone. */
import { createRequire } from "module"; import http from "http"; import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const require = createRequire(import.meta.url);
let chromium; for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"]) { try { chromium = require(p).chromium; break; } catch (e) {} }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), DIST = process.env.DIST ? path.resolve(process.env.DIST) : path.join(ROOT, "dist");
if (!chromium || !fs.existsSync(path.join(DIST, "index.html"))) { console.error("this check did NOT run: Playwright / Chromium or dist/ is missing"); process.exit(1); }
const REF = "gsaqgbracxnucdmtmcxz", UID = "00000000-0000-4000-8000-0000000000f1";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split("?")[0]); let fp = path.join(DIST, u === "/" ? "/index.html" : u); if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, "index.html"); if (!fp.startsWith(DIST) || !fs.existsSync(fp)) { res.writeHead(404); return res.end(); } res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream" }); fs.createReadStream(fp).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const HOST = "www.tigaalpha.com", BASE = `http://${HOST}:${server.address().port}/`;
const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined, args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1`, "--autoplay-policy=no-user-gesture-required"] });
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else fail++; console.log((c ? "  ✓ " : "  ✗ FAIL: ") + m); };
async function member(created) {
  const profile = { id: UID, name: "Tester", full_name: "Tester", onboarded: true, lang: "en", exp: 0, coins: 0, gems: 0, is_admin: false, admin_tier: 0, banned: false, created_at: created, plan: "trial" };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "en-US", serviceWorkers: "block", isMobile: true, hasTouch: true });
  const usage = [];
  await ctx.route(/supabase\.co/, async (r) => { const q = r.request(), url = q.url();
    if (q.method() === "POST" && /usage_events/.test(url)) { try { usage.push(JSON.parse(q.postData() || "{}")); } catch (e) {} return r.fulfill({ status: 201, body: "" }); }
    if (/\/rest\/v1\/profiles/.test(url) && q.method() === "GET") return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(profile) });
    if (/\/auth\/v1\//.test(url)) return r.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    return r.fulfill({ status: 200, contentType: "application/json", body: "[]" }); });
  await ctx.addInitScript(({ ref, uid }) => { try { if (!localStorage.getItem("__seeded")) { localStorage.setItem("__seeded", "1");
    for (const k of ["tg_pa_intro", "tg_permprimed", "tg_push_primed", "tg_welcomed", "tg_pa_testhook"]) localStorage.setItem(k, "1");
    localStorage.setItem("tg_consent", JSON.stringify({ v: "2026-11-26", a: 0, m: 0, t: 1 }));
    localStorage.setItem("tg_edu_seen", '{"firstCoins":1,"chest":1,"pet":1,"shop":1,"rich":1,"shopIntro":1}');
    localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({ access_token: "stub.access.token", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "stub-refresh", user: { id: uid, aud: "authenticated", role: "authenticated", email: "t@example.com", app_metadata: { provider: "google" }, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" } })); } } catch (e) {} }, { ref: REF, uid: UID });
  const page = await ctx.newPage(), errs = []; page.on("pageerror", e => errs.push(String(e).slice(0, 200)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" }); await page.waitForSelector(".hdr", { timeout: 45000 }); await page.waitForTimeout(3000);
  return { ctx, page, errs, usage };
}
const card = (p) => p.$("[data-first-run=welcome]");
console.log("(a) a brand-new account");
{
  const { ctx, page, errs, usage } = await member(new Date(Date.now() - 60e3).toISOString());
  ok(!!(await card(page)), "the welcome card is shown");
  const g = await page.evaluate(() => { const c = document.querySelector("[data-first-run=welcome] .setcard"); if (!c) return null; const r = c.getBoundingClientRect(); const b = [...c.querySelectorAll("button")].map(x => { const q = x.getBoundingClientRect(); return q.top >= 0 && q.bottom <= innerHeight; }); return { fits: r.top >= 0 && r.bottom <= innerHeight, btnsVisible: b.every(Boolean), n: b.length, txt: c.innerText.replace(/\s+/g, " ") }; });
  ok(g && g.fits && g.btnsVisible, "at 390x844 the whole card and every button are on screen without scrolling");
  ok(g && /free 7-day Pro trial/.test(g.txt) && g.n === 4, "it says the free 7-day Pro trial (no card) and has Skip + three level buttons");
  ok(!/799|฿|THB|\$/.test(g ? g.txt : ""), "no price on the card");
  await page.click("[data-first-run-level=none]"); await page.waitForTimeout(1500);
  ok(!!(await page.$(".songready")), "one tap opens a song on the normal ready screen");
  await page.click(".songready .songbtn.go"); await page.waitForTimeout(300);
  await page.evaluate(() => { const T = window.__paTest, last = {}; const tick = () => { const now = T.now(); if (now != null) { const ns = T.notes(); for (let i = 0; i < ns.length; i++) { const n = ns[i]; if (n.skip || n.hit || n.missed) continue; const due = n.t + T.lead, rt = performance.now(); if (now >= due && now < due + 0.12 && !(last[i] != null && rt - last[i] < 300)) { last[i] = rt; T.press(n.note); } } } requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  await page.waitForSelector("[data-first-run=tip]", { timeout: 120000 }); await page.waitForTimeout(500);
  const t = await page.evaluate(() => { const c = document.querySelector("[data-first-run=tip]"), r = c.getBoundingClientRect(); return { txt: c.innerText.replace(/\s+/g, " "), fits: r.bottom <= innerHeight && r.height < innerHeight * 0.3 }; });
  ok(/Free Pro trial: \d+ days? left/.test(t.txt) && /next lesson/i.test(t.txt) && t.fits, "after the song: a tip, \"Free Pro trial: N days left\" and the next-lesson button, as a short strip: " + t.txt.slice(0, 80));
  await page.click("[data-first-run-next]"); await page.waitForTimeout(1500);
  ok(!!(await page.$(".pathpage")) && !(await page.$("[data-first-run]")), "the next-lesson button lands on the Pathway and the card is gone");
  const done = await page.evaluate(() => localStorage.getItem("tg_firstrun"));
  ok(done === "done:" + UID, "remembered as done (" + done + ")");
  for (const id of ["start", "level:none", "song:done", "tip:shown", "done"]) ok(usage.some(r => r.kind === "onboard" && r.item_id === id), "usage row onboard/" + id);
  await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForSelector(".hdr", { timeout: 45000 }); await page.waitForTimeout(2500);
  ok(!(await page.$("[data-first-run]")), "a reload does not show it again");
  ok(errs.length === 0, "no page errors" + (errs[0] ? ": " + errs[0] : "")); await ctx.close();
}
console.log("(b) an old account");
{ const { ctx, page, errs } = await member("2025-01-01T00:00:00Z"); ok(!(await card(page)), "no first run for an account made long ago"); ok(errs.length === 0, "no page errors"); await ctx.close(); }
console.log("(c) Skip");
{
  const { ctx, page } = await member(new Date(Date.now() - 60e3).toISOString());
  ok(!!(await card(page)), "the card is shown to the new account");
  await page.click("[data-first-run-skip]"); await page.waitForTimeout(800);
  ok(!(await card(page)) && !(await page.$(".songready")), "Skip closes it and opens nothing else");
  await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForSelector(".hdr", { timeout: 45000 }); await page.waitForTimeout(2500);
  ok(!(await card(page)), "and a reload does not bring it back"); await ctx.close();
}
await browser.close(); server.close();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

#!/usr/bin/env node
/* verify-value-moment.mjs — Step 2.4 part A (owner 2026-11-26): the soft invitation after a guest's FIRST value moment.
     npm run build && node scripts/verify-value-moment.mjs        (DIST=<dir> tests another build)
   A guest (default path: no test door that changes the count; only the song-test hook window.__paTest) plays the first song of the list cleanly in Chromium at 390x844 and reaches the result screen:
   the short card is there once, is not a modal, does not cover the screen, spends no free use (tg_guest_uses stays 1), "Keep playing first" closes it and a second finished song does not bring it back;
   in a second guest "Try Premium free" opens the standard invitation with reason "value"; usage rows gate/value:shown, value:cta and value:close are written. Playing is done by a bot through the test hook,
   so this proves the wiring and the layout in a headless browser, NOT how it feels on a real phone. */
import fs from "node:fs"; import path from "node:path"; import http from "node:http"; import { createRequire } from "node:module"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), DIST = path.resolve(process.env.DIST || path.join(ROOT, "dist"));
const require = createRequire(path.join(ROOT, "package.json"));
let pass = 0; const fails = []; const ok = (c, n) => { if (c) { pass++; console.log("  ✓ " + n); } else { fails.push(n); console.log("  ✗ FAIL: " + n); } };
let chromium; for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright"]) { try { chromium = require(p).chromium; break; } catch (e) {} }
if (!chromium) { console.error("this check did NOT run: Playwright is missing"); process.exit(1); }
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webp": "image/webp", ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg" };
const srv = await new Promise((res) => { const s = http.createServer((req, rs) => { const u = decodeURIComponent(req.url.split("?")[0]); let fp = path.join(DIST, u === "/" ? "/index.html" : u); if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) fp = path.join(fp, "index.html"); if (!fp.startsWith(DIST) || !fs.existsSync(fp)) { rs.writeHead(404); return rs.end(); } rs.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream" }); fs.createReadStream(fp).pipe(rs); }); s.listen(0, "127.0.0.1", () => res(s)); });
const BASE = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined, args: ["--autoplay-policy=no-user-gesture-required"] });

async function guest() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const usage = [];
  await ctx.route(/supabase\.co/, (r) => { const q = r.request(); if (q.method() === "POST" && q.url().includes("/rest/v1/usage_events")) { try { usage.push(JSON.parse(q.postData() || "{}")); } catch (e) {} } r.fulfill({ status: 200, contentType: "application/json", body: "[]" }); });
  await ctx.addInitScript(() => {
    try {
      if (sessionStorage.getItem("__s")) return; sessionStorage.setItem("__s", "1");
      sessionStorage.setItem("tiga_page", "studio");
      localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "Tester", lang: "en", age: "adult", level: "beginner", exp: 5000 }));
      localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_orient_hint_seen", "1"); localStorage.setItem("tg_3d_tier", "0");
      localStorage.setItem("tg_edu_seen", '{"firstCoins":1,"chest":1,"pet":1,"shop":1,"rich":1,"shopIntro":1}');
      localStorage.setItem("tg_pa_testhook", "1"); localStorage.setItem("tg_pa_intro", "1"); localStorage.setItem("tg_pa_kind", "0"); localStorage.setItem("tg_pa_metro", "0");
      localStorage.setItem("tg_consent", JSON.stringify({ v: "2026-11-26", a: 0, m: 0, t: 1 }));
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new Error("no mic"));
    } catch (e) {}
  });
  const p = await ctx.newPage(), errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(BASE + "/", { waitUntil: "load" }); await p.waitForTimeout(3000);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(400); }
  return { ctx, p, usage, errs };
}
async function playFirstSong(p) {
  await (await p.$$(".songcard"))[0].click(); await p.waitForTimeout(1200);
  await (await p.$$(".songgrid .songcard"))[0].click(); await p.waitForTimeout(900);
  await p.click(".songready .songbtn.go"); await p.waitForTimeout(300);
  await p.evaluate(() => {
    const T = window.__paTest, last = {};
    const tick = () => { const now = T.now(); if (now != null) { const notes = T.notes(); for (let i = 0; i < notes.length; i++) { const n = notes[i]; if (n.skip || n.hit || n.missed) continue; const due = n.t + T.lead; const rt = performance.now(); if (now >= due && now < due + 0.12 && !(last[i] != null && rt - last[i] < 300)) { last[i] = rt; T.press(n.note); } } } window.__raf = requestAnimationFrame(tick); };
    window.__raf = requestAnimationFrame(tick);
  });
  await p.waitForSelector(".pl-result", { timeout: 120000 }); await p.waitForTimeout(1500);
}
const rows = (u, id) => u.filter((r) => r.kind === "gate" && r.item_id === id).length;

console.log("guest 1: first finished song");
{
  const { ctx, p, usage, errs } = await guest();
  await playFirstSong(p);
  const stars = await p.$$eval(".pl-bigstars span.on", (s) => s.length);
  ok(stars >= 1, "the clean run finished with " + stars + " star(s)");
  const card = await p.evaluate(() => { const c = document.querySelector("[data-guest-value]"); if (!c) return null; const r = c.getBoundingClientRect(); return { h: r.height, w: r.width, vh: innerHeight, vw: innerWidth, bottom: Math.round(innerHeight - r.bottom), pos: getComputedStyle(c).position, modal: !!document.querySelector("[data-trial-invite]"), txt: c.innerText.replace(/\s+/g, " ") }; });
  ok(!!card, "the value card is on the result screen");
  ok(card && card.pos === "fixed" && card.h < card.vh * 0.25 && card.w <= card.vw - 20, "it is a short strip (" + (card ? Math.round(card.h) + "px high of " + card.vh : "-") + "), not a full-screen cover");
  ok(card && !card.modal && /Premium/.test(card.txt) && /7 days/.test(card.txt) && /no card/i.test(card.txt), "no modal behind it; it says Premium, 7 days, no card: " + (card ? card.txt.slice(0, 90) : ""));
  ok(rows(usage, "value:shown") === 1, "gate/value:shown was written once");
  const uses = await p.evaluate(() => localStorage.getItem("tg_guest_uses"));
  ok(uses === "1", "the card spent no free use (tg_guest_uses = " + uses + ")");
  ok(!!(await p.evaluate(() => localStorage.getItem("tg_guest_value_seen"))), "tg_guest_value_seen remembers it on this browser");
  await p.click("[data-guest-value-close]"); await p.waitForTimeout(400);
  ok((await p.locator("[data-guest-value]").count()) === 0 && rows(usage, "value:close") === 1, "'Keep playing first' closes it at once and logs value:close");
  await p.evaluate(() => { cancelAnimationFrame(window.__raf); });
  const again = await p.$(".pl-again, .pl-result .songbtn.go, [data-play-again]");
  // a second finished song must not bring it back: play the song again through the result's own button when there is one
  if (again) { await again.click().catch(() => {}); await p.waitForTimeout(500); await p.evaluate(() => { const T = window.__paTest, last = {}; const tick = () => { const now = T.now(); if (now != null) { const notes = T.notes(); for (let i = 0; i < notes.length; i++) { const n = notes[i]; if (n.skip || n.hit || n.missed) continue; const due = n.t + T.lead; const rt = performance.now(); if (now >= due && now < due + 0.12 && !(last[i] != null && rt - last[i] < 300)) { last[i] = rt; T.press(n.note); } } } window.__raf = requestAnimationFrame(tick); }; window.__raf = requestAnimationFrame(tick); }); await p.waitForSelector(".pl-result", { timeout: 120000 }).catch(() => {}); await p.waitForTimeout(1200);
    ok((await p.locator("[data-guest-value]").count()) === 0 && rows(usage, "value:shown") === 1, "a second finished song does not bring the card back"); }
  else console.log("  (no play-again button found: the 'never twice' check was not run in the browser)");
  ok(errs.length === 0, "no page errors" + (errs[0] ? ": " + errs[0] : "")); await ctx.close();
}
console.log("guest 2: 'Try Premium free'");
{
  const { ctx, p, usage, errs } = await guest();
  await playFirstSong(p);
  await p.click("[data-guest-value-cta]"); await p.waitForTimeout(700);
  const inv = await p.evaluate(() => { const d = document.querySelector("[data-trial-invite]"); return d ? { reason: d.getAttribute("data-reason"), txt: d.innerText.replace(/\s+/g, " ") } : null; });
  ok(inv && inv.reason === "value", "the standard invitation opens with reason 'value'");
  ok(inv && /Great start/.test(inv.txt) && /free for 7 days/i.test(inv.txt), "it carries the value copy and the 7-day offer");
  ok((await p.locator("[data-guest-value]").count()) === 0, "the card is gone while the invitation is up");
  ok(rows(usage, "value:cta") === 1, "gate/value:cta was written");
  const uses = await p.evaluate(() => localStorage.getItem("tg_guest_uses"));
  ok(uses === "1", "still one use spent (" + uses + "): the count is untouched");
  ok(errs.length === 0, "no page errors" + (errs[0] ? ": " + errs[0] : "")); await ctx.close();
}
await browser.close(); srv.close();
console.log(`\n${pass} passed, ${fails.length} failed`); if (fails.length) console.log("failed:\n - " + fails.join("\n - "));
process.exit(fails.length ? 1 : 0);

// Adventure Mode: a knowledge beacon asks questions from what THIS learner has studied, climbs, and a wrong answer teaches on the piano.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href);
const pw = pwm.chromium ? pwm : (pwm.default || pwm);
const ROOT = path.resolve("dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("nf"); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
// Adventure missions: mine ore and ship it to Earth, capture a sun, nuke from orbit then assault.
async function open(pre) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); for (const k in d) localStorage.setItem(k, d[k]); }, pre);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  return { ctx, p, errs };
}


const D = (...ids) => ({ tg_adv_done: JSON.stringify(ids) });
async function enter(pre, idx) { const o = await open(pre); await o.p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx); return o; }
const IDX = { cobalt: 6, helios: 7, ashfall: 8 };
{ const o = await open(D("luma", "ferro")); const l = await o.p.evaluate(() => [...document.querySelectorAll(".adv-planet")].map(b => b.disabled));
  ok("Cobalt opens after Ferro; Helios needs Kryo; Ashfall needs Pyra", l[6] === false && l[7] === true && l[8] === true, JSON.stringify(l)); await o.ctx.close(); }
{ const o = await open({ tg_earth_ore: "55" }); ok("the menu shows what was shipped to Earth and the colony stage", /55/.test(await o.p.locator(".adv-menu").innerText()) && /Camp/.test(await o.p.locator(".adv-menu").innerText())); await o.ctx.close(); }
{ // ── mining ──
  const o = await enter(D("luma", "ferro"), IDX.cobalt); await o.p.waitForSelector(".adv canvas"); await o.p.waitForTimeout(1200);
  ok("a briefing tells the story when the map opens", /ore/i.test(await o.p.locator(".adv-banner").first().innerText().catch(() => "")));
  ok("there are ore nodes to dig and no boss", (await o.p.evaluate(() => window.__advTest.nodesLeft())) === 6 && (await o.p.evaluate(() => window.__advTest.boss())).dead === 1);
  await o.p.evaluate(() => window.__advTest.tp(560)); await o.p.waitForTimeout(100);
  for (let i = 0; i < 4; i++) { await o.p.evaluate(() => window.__advTest.kickNow()); await o.p.waitForTimeout(900); }
  ok("kicking a node breaks it open and puts ore in the cargo", (await o.p.evaluate(() => window.__advTest.cargo())) >= 4 && (await o.p.evaluate(() => window.__advTest.nodesLeft())) === 5, "cargo " + (await o.p.evaluate(() => window.__advTest.cargo())));
  await o.p.evaluate(() => { window.__advTest.setCargo(6); window.__advTest.tp(5200 - 220); }); await o.p.waitForTimeout(500);
  ok("with too little ore the pad does not launch", (await o.p.evaluate(() => window.__advTest.launched())) === false && (await o.p.evaluate(() => localStorage.getItem("tg_earth_ore"))) === null);
  await o.p.evaluate(() => window.__advTest.setCargo(12)); await o.p.waitForTimeout(500);
  ok("with enough ore the capsule launches to Earth", (await o.p.evaluate(() => window.__advTest.launched())) === true);
  ok("the ore is added to Earth's supplies and the map is cleared", (await o.p.evaluate(() => localStorage.getItem("tg_earth_ore"))) === "12" && (await o.p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_done") || "[]"))).includes("cobalt"));
  ok("mining no errors", o.errs.length === 0, o.errs.join("|")); await o.ctx.close(); }
{ // ── capture ──
  const o = await enter(D("luma", "ferro", "kryo"), IDX.helios); await o.p.waitForSelector(".adv canvas"); await o.p.waitForTimeout(900);
  ok("Helios has three stations to capture", (await o.p.evaluate(() => window.__advTest.stations())).length === 3);
  await o.p.evaluate(() => window.__advTest.tp(900)); await o.p.waitForTimeout(1500);
  const s1 = await o.p.evaluate(() => window.__advTest.stations()); ok("standing at a station fills its capture ring", s1[0].p > 0.8, JSON.stringify(s1[0]));
  await o.p.waitForTimeout(4000); ok("enemy waves arrive while it is being held", (await o.p.evaluate(() => window.__advTest.state().mons)) >= 2);
  const c0 = await o.p.evaluate(() => window.__advTest.crystals());
  for (const x of [900, 2000, 3300]) for (let tries = 0; tries < 12; tries++) { await o.p.evaluate((xx) => { window.__advTest.tp(xx); window.__advTest.capSkip(11); }, x); await o.p.waitForTimeout(500); const q = await o.p.evaluate(() => window.__advTest.stations()); if (q.every(z => z.done) || q.filter(z => z.done).length >= [900, 2000, 3300].indexOf(x) + 1) break; }   // the player may be knocked down meanwhile: keep going back
  const s2 = await o.p.evaluate(() => window.__advTest.stations()); ok("all three captured", s2.every(q => q.done), JSON.stringify(s2));
  ok("the sun is recorded as captured and pays crystals", (await o.p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_done") || "[]"))).includes("helios") && (await o.p.evaluate(() => window.__advTest.crystals())) > c0);
  ok("capture no errors", o.errs.length === 0, o.errs.join("|")); await o.ctx.close(); }
{ // ── orbital strike, then assault ──
  const o = await enter(D("luma", "ferro", "kryo", "pyra"), IDX.ashfall); await o.p.waitForSelector(".adv-strike", { timeout: 5000 });
  ok("Ashfall opens on the orbital strike screen with three warheads", (await o.p.evaluate(() => window.__advStrike.state())).left === 3 && (await o.p.locator(".as-base").count()) === 6);
  await o.p.evaluate(() => { window.__advStrike.setX(0.1); window.__advStrike.drop(); }); await o.p.waitForTimeout(2200);
  ok("a warhead on a base destroys it", (await o.p.evaluate(() => window.__advStrike.state())).alive <= 5, JSON.stringify(await o.p.evaluate(() => window.__advStrike.state())));
  await o.p.evaluate(() => { window.__advStrike.setX(0.42); window.__advStrike.drop(); }); await o.p.waitForTimeout(2200);
  await o.p.evaluate(() => { window.__advStrike.setX(0.9); window.__advStrike.drop(); }); await o.p.waitForTimeout(2200);
  const st = await o.p.evaluate(() => window.__advStrike.state()); ok("three warheads, then the strike is over", st.left === 0 && st.alive <= 3, JSON.stringify(st));
  await o.p.locator(".as-bot .go").click(); await o.p.waitForSelector(".adv canvas", { timeout: 5000 }); await o.p.waitForTimeout(900);
  const mons = await o.p.evaluate(() => window.__advTest.state().mons);
  ok("the ground assault starts with fewer defenders (17 without the strike)", mons < 17, mons + " left");
  ok("Ashfall has its commander boss", (await o.p.evaluate(() => window.__advTest.boss())).dead === 0);
  ok("strike no errors", o.errs.length === 0, o.errs.join("|")); await o.ctx.close(); }
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

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
// Adventure phase 3.3: planet-specific monsters, the gas-giant survival stage, Kryo with its boss.
async function open(pre) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); for (const k in d) localStorage.setItem(k, d[k]); }, pre);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  return { ctx, p, errs };
}
const DONE = { tg_adv_done: JSON.stringify(["luma", "ferro"]) };
async function enter(pre, idx) { const o = await open(pre); await o.p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx); await o.p.waitForSelector(".adv canvas"); await o.p.waitForTimeout(900); return o; }
{
  const o = await open({ tg_adv_done: JSON.stringify(["luma"]) });
  const lock = await o.p.evaluate(() => [...document.querySelectorAll(".adv-planet")].map(b => b.disabled));
  ok("after Luma: Ferro open; Jovia and Kryo still locked", lock[1] === false && lock[2] === true && lock[3] === true, JSON.stringify(lock));
  await o.ctx.close();
}
{
  const o = await open(DONE);
  const lock = await o.p.evaluate(() => [...document.querySelectorAll(".adv-planet")].map(b => b.disabled));
  ok("after Ferro: Jovia and Kryo open, Pyra and Nexa locked", lock[2] === false && lock[3] === false && lock[4] === true && lock[5] === true, JSON.stringify(lock));
  await o.ctx.close();
}
{
  const o = await enter({ tg_adv_done: JSON.stringify(["luma"]) }, 1);
  const types = await o.p.evaluate(() => window.__advTest.types());
  ok("Ferro has its own monsters (Rustcrawler, Magnet Pylon)", types.includes("rustcrawler") && types.includes("magnet"), types.join());
  await o.p.evaluate(() => window.__advTest.tp(600)); await o.p.waitForTimeout(3000); if (process.env.SHOT) await o.p.screenshot({ path: process.env.SHOT + "-ferro.png" });
  ok("Ferro runs without errors", o.errs.length === 0, o.errs.join("|")); await o.ctx.close();
}
{
  const o = await enter(DONE, 3);
  const types = await o.p.evaluate(() => window.__advTest.types());
  ok("Kryo has Shardlings and Frostcasters", types.includes("shardling") && types.includes("frostcaster"), types.join());
  await o.p.evaluate(() => window.__advTest.tp(560)); await o.p.waitForTimeout(3000); if (process.env.SHOT) await o.p.screenshot({ path: process.env.SHOT + "-kryo.png" });
  await o.p.evaluate(() => window.__advTest.tp(5200 - 900 + 120)); await o.p.waitForTimeout(700);
  ok("Kryo's boss wakes in its arena", (await o.p.evaluate(() => window.__advTest.boss())).active === true);
  await o.p.evaluate(() => window.__advTest.hitBoss(1e6)); await o.p.waitForTimeout(400);
  ok("Kryo is recorded as cleared", (await o.p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_done") || "[]"))).includes("kryo"));
  ok("Kryo runs without errors", o.errs.length === 0, o.errs.join("|")); await o.ctx.close();
}
{
  const o = await enter(DONE, 2);
  ok("Jovia starts with no wandering monsters and no boss", (await o.p.evaluate(() => window.__advTest.state().mons)) === 0 && (await o.p.evaluate(() => window.__advTest.boss())).active === false);
  await o.p.waitForTimeout(2600);
  const s1 = await o.p.evaluate(() => window.__advTest.surv());
  ok("waves of monsters come at the player", s1.wave >= 1 && s1.mons >= 3 && s1.t > 1, JSON.stringify(s1));
  const c0 = await o.p.evaluate(() => window.__advTest.crystals());
  await o.p.evaluate(() => window.__advTest.skip(95)); await o.p.waitForTimeout(500);
  const s2 = await o.p.evaluate(() => window.__advTest.surv());
  ok("holding out 90 s completes the harvest and clears the monsters", s2.done === true && s2.mons === 0, JSON.stringify(s2));
  ok("harvest pays crystals and is recorded as cleared", (await o.p.evaluate(() => window.__advTest.crystals())) >= c0 + 15 && (await o.p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_done") || "[]"))).includes("jovia"));
  ok("Jovia runs without errors", o.errs.length === 0, o.errs.join("|")); await o.ctx.close();
}
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

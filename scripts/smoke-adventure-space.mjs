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
// Adventure space maps: Departure (fly to orbit through debris) and the Asteroid Field (mine rocks for ore), plus the send-off film.
async function open(pre) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_sector", "space"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine","1"); localStorage.setItem("tg_adv_unlockall","1"); localStorage.setItem("tg_adv_nogate","1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); for (const k in d) localStorage.setItem(k, d[k]); }, pre);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  return { ctx, p, errs };
}
async function enter(p, re) { const idx = await p.evaluate((src) => [...document.querySelectorAll(".adv-planet")].findIndex(b => new RegExp(src).test(b.textContent)), re); await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx); return idx; }
{
  const { ctx, p, errs } = await open({}); const i = await enter(p, "Departure"); ok("Departure is on the menu and open from the start", i >= 0);
  await p.waitForFunction(() => !!window.__advShip, null, { timeout: 10000 }); ok("it is the launch mode", (await p.evaluate(() => window.__advShip.mode)) === "launch");
  await p.evaluate(() => window.__advShip.god()); await p.waitForTimeout(2500); ok("rocks and debris drift in", (await p.evaluate(() => window.__advShip.rocks())) >= 2);
  await p.evaluate(() => window.__advShip.skipLaunch()); await p.waitForSelector(".adv-clear[aria-label='ship clear']", { timeout: 15000 });
  ok("reaching orbit shows the clear card and records the map", await p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_done")).includes("departure")));
  ok("no errors (departure)", errs.length === 0, errs.slice(0, 2).join("|")); await ctx.close();
}
{
  const { ctx, p, errs } = await open({ tg_earth_ore: "0" }); await enter(p, "Asteroid Field");
  await p.waitForFunction(() => !!window.__advShip, null, { timeout: 10000 }); ok("the belt mode", (await p.evaluate(() => window.__advShip.mode)) === "belt");
  await p.evaluate(() => { window.__advShip.god(); window.__advShip.spawnRock(0); window.__advShip.spawnRock(0); }); await p.keyboard.down("Space"); await p.waitForTimeout(2500); await p.keyboard.up("Space");
  ok("shooting a small rock breaks it into ore", (await p.evaluate(() => window.__advShip.state().mined)) >= 1);
  await p.evaluate(() => window.__advShip.giveOre(16)); await p.waitForSelector(".adv-clear[aria-label='ship clear']", { timeout: 15000 });
  ok("16 ore wins the map and ships the ore to Earth", await p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_done")).includes("asteroids") && Number(localStorage.getItem("tg_earth_ore")) >= 16));
  ok("no errors (belt)", errs.length === 0, errs.slice(0, 2).join("|")); await ctx.close();
}
{
  const { ctx, p, errs } = await open({ tg_adv_nocine: "0", tg_adv_prologue: "skip" }); await enter(p, "Departure"); await p.waitForSelector(".adv-cine", { timeout: 8000 });
  const k = await p.evaluate(() => window.__advCine.kinds()); ok("the send-off film: pad > liftoff > earth fade > objective", JSON.stringify(k) === JSON.stringify(["pad", "liftoff", "earthfade", "objective"]), k.join());
  if (process.env.SHOT) for (let q = 0; q < 3; q++) { await p.evaluate((n) => window.__advCine.jump(n), q); await p.waitForTimeout(1200); await p.screenshot({ path: process.env.SHOT + q + ".png" }); }
  ok("no errors (film)", errs.length === 0, errs.slice(0, 2).join("|")); await ctx.close();
}
{
  const { ctx, p, errs } = await open({ tg_adv_prologue: "skip" }); await enter(p, "Asteroid Field"); await p.waitForFunction(() => !!window.__advShip, null, { timeout: 10000 });
  await p.evaluate(() => { window.__advShip.god(); window.__advShip.relayNow(); }); await p.waitForSelector(".adv-quiz", { timeout: 5000 });
  const t0 = await p.evaluate(() => window.__advShip.state().t); await p.waitForTimeout(700); const t1 = await p.evaluate(() => window.__advShip.state().t);
  ok("flying into a music relay opens ONE question and the ship waits", (await p.locator(".adv-qcard").count()) === 1 && Math.abs(t1 - t0) < 0.05, t0 + " " + t1);
  await p.locator(".adv-qcard button", { hasText: /Skip|ข้าม|跳过/ }).first().click(); await p.waitForTimeout(500);
  const t2 = await p.evaluate(() => window.__advShip.state().t); await p.waitForTimeout(500); const t3 = await p.evaluate(() => window.__advShip.state().t);
  ok("after the question the ship flies on", (await p.locator(".adv-quiz").count()) === 0 && t3 > t2 + 0.3);
  await p.evaluate(() => { window.__advShip.setHpS(40); window.__advShip.answer(true); }); ok("a right answer repairs the ship", (await p.evaluate(() => window.__advShip.hpNow())) >= 60);
  ok("no errors (relay)", errs.length === 0, errs.slice(0, 2).join("|")); await ctx.close();
}
{
  const { ctx, p, errs } = await open({}); const i = await enter(p, "Gas Giant"); ok("Gas Giant Skim is on the menu", i >= 0);
  await p.waitForFunction(() => !!window.__advShip, null, { timeout: 10000 }); ok("skim mode", (await p.evaluate(() => window.__advShip.mode)) === "skim");
  await p.evaluate(() => window.__advShip.god()); const f0 = await p.evaluate(() => window.__advShip.fuel());
  for (let k = 0; k < 8; k++) { await p.evaluate(() => window.__advShip.inBand()); await p.waitForTimeout(250); }
  ok("staying in the energy layer fills the tank", (await p.evaluate(() => window.__advShip.fuel())) > f0 + 5);
  await p.evaluate(() => window.__advShip.fillFuel()); await p.evaluate(() => window.__advShip.inBand()); await p.waitForSelector(".adv-clear[aria-label='ship clear']", { timeout: 15000 });
  ok("a full tank wins the map", await p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_done")).includes("gasskim")));
  ok("no errors (skim)", errs.length === 0, errs.slice(0, 2).join("|")); await ctx.close();
}
{
  const { ctx, p, errs } = await open({}); const i = await enter(p, "Foreign Star"); ok("Foreign Star is on the menu", i >= 0);
  await p.waitForFunction(() => !!window.__advShip, null, { timeout: 10000 }); ok("harvest mode", (await p.evaluate(() => window.__advShip.mode)) === "harvest");
  await p.evaluate(() => window.__advShip.god());
  for (let k = 0; k < 3; k++) { await p.evaluate(() => { window.__advShip.holdStation(); window.__advShip.fastStation(); }); await p.waitForTimeout(500); await p.evaluate(() => window.__advShip.holdStation()); await p.waitForTimeout(400); }
  await p.waitForSelector(".adv-clear[aria-label='ship clear']", { timeout: 15000 }).catch(() => {});
  ok("holding the ship in each ring seizes the stations", (await p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_done") || "[]").includes("starharvest"))));
  ok("no errors (harvest)", errs.length === 0, errs.slice(0, 2).join("|")); await ctx.close();
}
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

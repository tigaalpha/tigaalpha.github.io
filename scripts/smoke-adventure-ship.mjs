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
// Adventure starship dogfight: opens after Kryo, fly + shoot, waves, mothership, win pays crystals + loot coins, lose offers retry.
async function open(pre) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_sector", "all"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine","1"); localStorage.setItem("tg_adv_unlockall","1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); for (const k in d) localStorage.setItem(k, d[k]); }, pre);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  return { ctx, p, errs };
}
{
  const { ctx, p, errs } = await open({ tg_adv_done: JSON.stringify(["luma", "ferro", "kryo"]) });
  const idx = await p.evaluate(() => [...document.querySelectorAll(".adv-planet")].findIndex(b => /Void Gate/.test(b.textContent)));
  ok("Void Gate is on the menu and open after Kryo", idx >= 0 && (await p.evaluate((i) => !document.querySelectorAll(".adv-planet")[i].disabled, idx)), "idx " + idx);
  await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx); await p.waitForFunction(() => !!window.__advShip, null, { timeout: 10000 });
  await p.evaluate(() => window.__advShip.god());
  await p.keyboard.down("Space"); await p.keyboard.down("ArrowUp"); await p.waitForTimeout(1800);
  const a = await p.evaluate(() => window.__advShip.state()); ok("holding fire shoots (bullets live), the ship moves", a.bl > 3, JSON.stringify(a));
  await p.keyboard.up("ArrowUp"); await p.evaluate(() => window.__advShip.spawn("drone")); await p.waitForTimeout(2500);
  ok("enemies spawn and are shot down", (await p.evaluate(() => window.__advShip.state().kills)) >= 1);
  await p.keyboard.down("KeyK"); await p.waitForTimeout(150); await p.keyboard.up("KeyK");
  ok("a missile launches", (await p.evaluate(() => window.__advShip.state().ms)) >= 1);
  await p.evaluate(() => window.__advShip.skip()); await p.waitForTimeout(1500);
  ok("the mothership arrives after the waves", await p.evaluate(() => !!window.__advShip.state().boss));
  await p.evaluate(() => window.__advShip.killBoss()); await p.keyboard.down("Space"); await p.waitForSelector(".adv-clear[aria-label='ship clear']", { timeout: 15000 });
  ok("killing the mothership shows the victory card and records the map", await p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_done")).includes("voidgate")) && (await p.evaluate(() => Number(localStorage.getItem("tg_adv_crystals") || 0))) >= 0);
  ok("no errors (win)", errs.length === 0, errs.join("|")); await ctx.close();
}
{
  const { ctx, p, errs } = await open({ tg_adv_done: JSON.stringify(["luma", "ferro", "kryo"]) });
  const idx = await p.evaluate(() => [...document.querySelectorAll(".adv-planet")].findIndex(b => /Void Gate/.test(b.textContent)));
  await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx); await p.waitForFunction(() => !!window.__advShip, null, { timeout: 10000 });
  await p.evaluate(() => window.__advShip.dieNow()); await p.waitForTimeout(600);
  ok("losing shows the retry card", (await p.evaluate(() => window.__advShip.state().over)) && (await p.locator(".adv-clear button.go").count()) === 1);
  await p.locator(".adv-clear button.go").click(); await p.waitForTimeout(300);
  ok("retry restarts the run", await p.evaluate(() => !window.__advShip.state().over && window.__advShip.state().hp > 50));
  ok("no errors (lose)", errs.length === 0, errs.join("|")); await ctx.close();
}
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

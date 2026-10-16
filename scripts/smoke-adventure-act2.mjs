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
// Adventure Act 2 (the Harvesters): the third menu tab, Kindred Haven (trade ore), the Dark Forge (assemble vessels) and Under the Harvesters' Eye (a ship that must not shoot and must dodge scan beams).
async function open(pre) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_sector", "act2"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine","1"); localStorage.setItem("tg_adv_unlockall","1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); for (const k in d) localStorage.setItem(k, d[k]); }, pre);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  return { ctx, p, errs };
}
async function enter(p, re) { const idx = await p.evaluate((src) => [...document.querySelectorAll(".adv-planet")].findIndex(b => new RegExp(src).test(b.textContent)), re); await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx); return idx; }

{ const { ctx, p, errs } = await open({});
  ok("the menu has a tab for Act 2 (5 tabs now)", (await p.locator("[data-sector]").count()) === 4);
  ok("Act 2 shows its six maps (the Dyson build, dock and forge open the part)", (await p.locator(".adv-planet").count()) === 6, String(await p.locator(".adv-planet").count()));
  const names = await p.evaluate(() => [...document.querySelectorAll(".adv-planet b")].map(b => b.textContent));
  ok("they are Kindred Haven, the Dark Forge and the Harvesters' Eye", /Kindred/.test(names[3]) && /Dark Forge/.test(names[4]) && /Harvesters/.test(names[5]), names.join(" | "));
  ok("no errors (menu)", errs.length === 0, errs.join("|")); await ctx.close(); }
for (const [re, label] of [["Kindred", "Kindred Haven"], ["Dark Forge", "Dark Forge"]]) {
  const { ctx, p, errs } = await open({}); const i = await enter(p, re); ok(label + " opens from the menu", i >= 0);
  await p.waitForFunction(() => !!window.__advTest, null, { timeout: 10000 }); await p.waitForTimeout(1200);
  ok(label + ": the dig button is on the pad (a resource map)", (await p.locator(".pvpact.dig").count()) === 1);
  ok(label + ": monsters live on the map", (await p.evaluate(() => window.__advTest.state().mons)) > 0);
  if (true) { ok(label + ": elders stand where the beacons would (3)", (await p.evaluate(() => window.__advTest.beaconsN())) === 3); await p.evaluate(() => window.__advTest.tp(1100)); await p.waitForTimeout(600); ok(label + ": an elder greets the pilot who comes near", (await p.evaluate(() => window.__advTest.greeted())) >= 1); }
  ok(label + ": no errors", errs.length === 0, errs.slice(0, 2).join("|")); await ctx.close(); }
{ const { ctx, p, errs } = await open({}); const i = await enter(p, "Harvesters"); ok("Under the Harvesters' Eye opens", i >= 0);
  await p.waitForFunction(() => !!window.__advShip, null, { timeout: 10000 }); ok("it is the evade mode", (await p.evaluate(() => window.__advShip.mode)) === "evade");
  await p.evaluate(() => window.__advShip.setFire(true)); await p.waitForTimeout(700);
  ok("the ship will not shoot while hidden", (await p.evaluate(() => window.__advShip.bulletsN())) === 0);
  await p.evaluate(() => window.__advShip.god()); await p.waitForTimeout(4200);
  ok("scan beams start sweeping", (await p.evaluate(() => window.__advShip.scansN())) >= 1);
  await p.evaluate(() => window.__advShip.skipEvade()); await p.waitForSelector(".adv-clear[aria-label='ship clear']", { timeout: 15000 });
  ok("surviving the time shows the clear card and records the map", await p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_done")).includes("shadow")));
  ok("no errors (evade)", errs.length === 0, errs.slice(0, 2).join("|")); await ctx.close(); }
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

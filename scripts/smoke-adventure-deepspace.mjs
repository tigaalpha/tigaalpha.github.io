// Deep-space ship missions: solar charge, Dyson dock, gas pump, warp gates, black hole.
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
async function open(re) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript(() => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_sector", "all"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_adv_prologue", "skip"); localStorage.setItem("tg_adv_unlockall", "1"); localStorage.setItem("tg_adv_nogate", "1"); });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  const idx = await p.evaluate((src) => [...document.querySelectorAll(".adv-planet")].findIndex(b => new RegExp(src).test(b.textContent)), re);
  if (idx < 0) throw new Error("map not on the menu: " + re);
  await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx); await p.waitForSelector(".adv-ship canvas", { timeout: 8000 }); await p.waitForTimeout(700);
  return { ctx, p, errs };
}
const won = (p) => p.waitForSelector(".adv-clear[aria-label='ship clear']", { timeout: 15000 }).then(() => true).catch(() => false);
{ const { ctx, p, errs } = await open("Solar Array");
  const e0 = await p.evaluate(() => window.__advShip.energyNow()); await p.waitForTimeout(1500); const e1 = await p.evaluate(() => window.__advShip.energyNow());
  ok("solar: the battery drains", e1 < e0, e0 + " -> " + e1);
  await p.evaluate(() => window.__advShip.giveSolar()); await p.waitForTimeout(500);
  ok("solar: a panel charges it and counts", (await p.evaluate(() => window.__advShip.panelsNow())) >= 1);
  for (let i = 0; i < 8; i++) { await p.evaluate(() => window.__advShip.giveSolar()); await p.waitForTimeout(150); }
  ok("solar: 8 panels win the map", await won(p));
  ok("solar: no page errors", errs.length === 0, errs.join("|")); await ctx.close(); }
{ const { ctx, p, errs } = await open("Warp Gates");
  await p.waitForTimeout(3600); ok("warp: a gate appears", (await p.evaluate(() => window.__advShip.gatesNow())) >= 1);
  await p.evaluate(() => window.__advShip.warpSkip()); await p.waitForTimeout(300);
  const q = await p.evaluate(() => window.__advShip.portalXY()); await p.evaluate((q) => window.__advShip.setShip(q.x, q.y), q);
  ok("warp: diving into the portal wins", await won(p));
  ok("warp: no page errors", errs.length === 0, errs.join("|")); await ctx.close(); }
{ const { ctx, p, errs } = await open("Black Hole");
  await p.waitForTimeout(800); const h = await p.evaluate(() => window.__advShip.holeXY());
  const x0 = await p.evaluate(() => window.__advShip.setShip && 0); void x0;
  ok("blackhole: the hole is placed", !!h && h.x > 600, JSON.stringify(h));
  await p.evaluate((h) => window.__advShip.setShip(h.x - 20, h.y), h); await p.waitForTimeout(400);
  ok("blackhole: touching it before the door opens hurts and throws you back", (await p.evaluate(() => window.__advShip.shipPos().x)) < h.x - 100);
  await p.evaluate(() => window.__advShip.holeOpen()); await p.waitForTimeout(300); ok("blackhole: the door opens", await p.evaluate(() => window.__advShip.opened()));
  await p.evaluate((h) => window.__advShip.setShip(h.x - 20, h.y), h);
  ok("blackhole: diving in once open wins", await won(p));
  ok("blackhole: no page errors", errs.length === 0, errs.join("|")); await ctx.close(); }
for (const [re, label] of [["Dyson Dock", "dyson dock"], ["Gas Pump", "gas pump"]]) {
  const { ctx, p, errs } = await open(re);
  await p.waitForTimeout(1200); ok(label + ": opens as a harvest map with its own scenery and no errors", (await p.evaluate(() => window.__advShip.mode)) === "harvest" && errs.length === 0, errs.join("|"));
  await p.evaluate(() => { for (let i = 0; i < 3; i++) window.__advShip.holdStation(); }); await p.waitForTimeout(400);
  await ctx.close();
}
await browser.close(); server.close(); console.log(fail ? "FAILED " + fail : "ALL PASS"); process.exit(fail ? 1 : 0);

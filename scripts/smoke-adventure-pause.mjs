// HANDS OFF gate before every Adventure question, the lightning bolt, the energy taps and the mining markers.
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
async function open(planetRe) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript(() => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_adv_prologue", "skip"); localStorage.setItem("tg_adv_unlockall", "1"); });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  const idx = await p.evaluate((src) => [...document.querySelectorAll(".adv-planet")].findIndex(b => new RegExp(src).test(b.textContent)), planetRe);
  await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx); await p.waitForSelector(".adv canvas", { timeout: 8000 }); await p.waitForTimeout(800);
  return { ctx, p, errs };
}
// The gear button: one button, a pause pop-up with resume, graphics and sound, on a ground run and on a ship map.
{ const { ctx, p, errs } = await open("Luma");
  ok("one gear button, no separate music / graphics buttons in the top bar", (await p.locator(".adv-top [aria-label=settings]").count()) === 1 && (await p.locator(".adv-top [aria-label=music], .adv-top [aria-label=graphics]").count()) === 0);
  await p.evaluate(() => document.querySelector("[aria-label=settings]").click()); await p.waitForSelector("[data-pause]", { timeout: 3000 });
  ok("it opens a pop-up with resume, three graphics levels (3D still disabled) and exit", (await p.locator("[data-resume]").count()) === 1 && (await p.locator("[data-gfx]").count()) === 3 && (await p.evaluate(() => document.querySelector("[data-gfx=\"3d\"]").disabled)) && (await p.locator("[data-exit]").count()) === 1);
  const x0 = await p.evaluate(() => window.__advTest.state().x);
  await p.keyboard.down("ArrowRight"); await p.waitForTimeout(700); await p.keyboard.up("ArrowRight");
  ok("the run is paused while the pop-up is open", Math.abs((await p.evaluate(() => window.__advTest.state().x)) - x0) < 1);
  await p.evaluate(() => document.querySelector("[data-gfx=high]").click()); await p.waitForTimeout(100);
  ok("the graphics choice is saved", (await p.evaluate(() => localStorage.getItem("tg_adv_gfx"))) === "high");
  await p.evaluate(() => document.querySelector("[data-resume]").click()); await p.waitForTimeout(150);
  ok("resume closes it", (await p.locator("[data-pause]").count()) === 0);
  await p.keyboard.down("ArrowRight"); await p.waitForTimeout(700); await p.keyboard.up("ArrowRight");
  ok("and the run goes on", (await p.evaluate(() => window.__advTest.state().x)) > x0 + 20);
  ok("no page errors", errs.length === 0, errs.join("|")); await ctx.close(); }
{
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript(() => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_sector", "space"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_adv_prologue", "skip"); localStorage.setItem("tg_adv_unlockall", "1"); });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  const idx = await p.evaluate(() => [...document.querySelectorAll(".adv-planet")].findIndex(b => /Void Gate/.test(b.textContent)));
  await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx); await p.waitForSelector(".adv-ship canvas", { timeout: 8000 }); await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector("[aria-label=settings]").click()); await p.waitForSelector("[data-pause]", { timeout: 3000 });
  const a0 = await p.evaluate(() => window.__advShip.shipPos());
  await p.keyboard.down("ArrowRight"); await p.waitForTimeout(600); await p.keyboard.up("ArrowRight");
  const a1 = await p.evaluate(() => window.__advShip.shipPos());
  ok("a ship map pauses too", Math.abs(a1.x - a0.x) < 1);
  await p.evaluate(() => document.querySelector("[data-resume]").click()); await p.waitForTimeout(100);
  await p.keyboard.down("ArrowRight"); await p.waitForTimeout(500); await p.keyboard.up("ArrowRight");
  ok("and flies again after resume", (await p.evaluate(() => window.__advShip.shipPos().x)) > a1.x + 20);
  await ctx.close();
}
await browser.close(); server.close(); console.log(fail ? "FAILED " + fail : "ALL PASS"); process.exit(fail ? 1 : 0);

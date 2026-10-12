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
{ const { ctx, p, errs } = await open("Luma");
  await p.evaluate(() => window.__advTest.tp(1300)); await p.waitForSelector(".adv-quiz", { timeout: 4000 });
  ok("a beacon question opens behind the HANDS OFF card", (await p.locator("[data-handsoff]").count()) === 1 && (await p.locator(".adv-qopt, .adv-quiz .pk").count()) === 0);
  ok("the ready button is dead at first", await p.evaluate(() => document.querySelector("[data-ready]").disabled));
  await p.evaluate(() => document.querySelector("[data-ready]").click()); await p.waitForTimeout(150);
  ok("pressing it early does nothing", (await p.locator("[data-handsoff]").count()) === 1);
  await p.waitForTimeout(1000);
  ok("after the arming beat it is live", await p.evaluate(() => !document.querySelector("[data-ready]").disabled));
  await p.evaluate(() => document.querySelector("[data-ready]").click()); await p.waitForTimeout(250);
  ok("then the question shows", (await p.locator("[data-handsoff]").count()) === 0 && (await p.locator(".adv-qopt, .adv-quiz .pk").count()) > 0);
  ok("no page errors", errs.length === 0, errs.join("|")); await ctx.close(); }
{ const { ctx, p, errs } = await open("Luma");
  const n0 = await p.evaluate(() => window.__advTest.zapsN());
  await p.evaluate(() => window.__advTest.zapNow()); await p.waitForTimeout(60);
  ok("the BOLT button fires and survives the new renderer", (await p.evaluate(() => window.__advTest.zapsN())) > n0);
  await p.waitForTimeout(500); ok("no page errors while bolts draw", errs.length === 0, errs.join("|")); await ctx.close(); }
{ const { ctx, p } = await open("Jovia");
  const nb = await p.evaluate(() => window.__advTest.beaconsN ? window.__advTest.beaconsN() : -1);
  ok("the gas-giant harvest map has three energy taps (music questions)", nb === 3, String(nb)); await ctx.close(); }
await browser.close(); server.close(); console.log(fail ? "FAILED " + fail : "ALL PASS"); process.exit(fail ? 1 : 0);

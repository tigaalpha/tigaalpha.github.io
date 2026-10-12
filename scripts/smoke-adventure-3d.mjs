// Adventure weapons (owner, 2026-10-12): weapons drop from monsters, are picked up and equipped, and each one fires in its own way.
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
// Adventure 3D quality (owner, 2026-10-12): a Three.js world behind the 2D canvas, only on strong devices, with a fall-back to 2D High.
async function run(strong, gfx) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript(([strong, gfx]) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_adv_prologue", "skip"); localStorage.setItem("tg_adv_unlockall", "1"); localStorage.setItem("tg_adv_nogate", "1"); if (gfx) localStorage.setItem("tg_adv_gfx", gfx);
    if (strong) { localStorage.setItem("tg_3d_tier", "3"); Object.defineProperty(navigator, "hardwareConcurrency", { value: 8 }); Object.defineProperty(navigator, "deviceMemory", { value: 8 }); } else { localStorage.setItem("tg_3d_tier", "0"); } }, [strong, gfx]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  await p.locator(".adv-planet").first().tap(); await p.waitForSelector(".adv canvas"); await p.waitForTimeout(1500);
  return { ctx, p, errs };
}
{ const { ctx, p, errs } = await run(false, "3d");
  ok("a weak device ignores a saved 3D choice (2D, no 3D canvas)", (await p.locator(".adv-3d canvas").count()) === 0);
  await p.locator(".adv-gear").click(); await p.waitForSelector("[data-pause]");
  ok("and the 3D button is disabled for it", await p.evaluate(() => document.querySelector('[data-gfx="3d"]').disabled));
  ok("no page errors (weak)", errs.length === 0, errs.join("|")); await ctx.close(); }
{ const { ctx, p, errs } = await run(true, "high");
  await p.locator(".adv-gear").click(); await p.waitForSelector("[data-pause]");
  ok("a strong device can pick 3D", await p.evaluate(() => !document.querySelector('[data-gfx="3d"]').disabled));
  await p.evaluate(() => document.querySelector('[data-gfx="3d"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => document.querySelector("[data-resume]").click()); await p.waitForTimeout(3000);
  ok("choosing 3D builds the Three.js world behind the 2D canvas", (await p.locator(".adv-3d canvas").count()) === 1, String(await p.locator(".adv-3d canvas").count()));
  ok("it is remembered", (await p.evaluate(() => localStorage.getItem("tg_adv_gfx"))) === "3d");
  if (process.env.OUT) await p.screenshot({ path: process.env.OUT + "/3d.png" });
  await p.waitForTimeout(500); ok("the game state keeps running (a monster is alive)", (await p.evaluate(() => window.__advTest.state().mons)) > 0);
  await p.locator(".adv-gear").click(); await p.waitForSelector("[data-pause]"); await p.evaluate(() => document.querySelector('[data-gfx="high"]').click()); await p.waitForTimeout(500);
  ok("switching back to High removes the 3D canvas", (await p.locator(".adv-3d canvas").count()) === 0);
  ok("no page errors (strong)", errs.length === 0, errs.join("|")); await ctx.close(); }
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

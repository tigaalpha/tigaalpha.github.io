import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href);
const pw = pwm.chromium ? pwm : (pwm.default || pwm);
const ROOT = path.resolve("dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("nf"); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const gfx of ["standard", "high"]) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 390 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((g) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_gfx", g); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); }, gfx);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200))); p.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 150)); });
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(3500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  const t0 = Date.now();
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet", { timeout: 8000 });
  console.log(gfx, "menu after", Date.now() - t0, "ms");
  await p.screenshot({ path: `/tmp/claude-0/scratch/adv-menu-${gfx}.png` });
  await p.evaluate(() => document.querySelector(".adv-planet").click()); await p.waitForSelector(".adv canvas", { timeout: 8000 }); await p.waitForTimeout(800);
  // Adventure Mode smoke: the planet menu opens, both graphics modes run, a monster dies, nothing throws.
  // frame rate
  const fps = await p.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 1500) r(Math.round(n / ((performance.now() - t0) / 1000))); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  console.log(gfx, "rAF fps in headless", fps);
  await p.evaluate(() => window.__advTest.tp(480)); await p.waitForTimeout(600);
  await p.screenshot({ path: `/tmp/claude-0/scratch/adv-run-${gfx}.png` });
  // fight: stand by a monster and hammer attack
  for (let i = 0; i < 24; i++) { await p.locator(".adv-pad .pvpact.punch").dispatchEvent("pointerdown").catch(() => {}); await p.waitForTimeout(160); await p.locator(".adv-pad .pvpact.punch").dispatchEvent("pointerup").catch(() => {}); await p.locator(".adv-pad .pvpact.ult").dispatchEvent("pointerdown").catch(() => {}); await p.waitForTimeout(40); await p.locator(".adv-pad .pvpact.ult").dispatchEvent("pointerup").catch(() => {}); if (i % 6 === 0) await p.evaluate((n) => window.__advTest.tp(560 + n * 120), i); }
  await p.waitForTimeout(500);
  const st = await p.evaluate(() => window.__advTest.state()); if (!(st.kills >= 1)) { console.log("FAIL no monster was killed", JSON.stringify(st)); process.exitCode = 1; }
  console.log(gfx, "state", JSON.stringify(await p.evaluate(() => window.__advTest.state())));
  await p.screenshot({ path: `/tmp/claude-0/scratch/adv-fight-${gfx}.png` });
  console.log(gfx, "errors", errs.join(" | ") || "none"); if (errs.length) process.exitCode = 1;
  await ctx.close();
}
await browser.close(); server.close();

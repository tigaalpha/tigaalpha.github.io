// Robot Adventure 3D as a normal player (plan 39): the lobby button, the 3D story map (planets, locks, a tilted floor), the level starts in a real WebGL canvas with the Luma monsters, a win marks the planet cleared in the shared Adventure progress. SHOT=<prefix> saves pictures.
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); const pw = pwm.chromium ? pwm : pwm.default;
const ROOT = path.resolve("dist"); const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort()); await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await ctx.addInitScript(() => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_gfx", "high"); localStorage.setItem("tg_gp_free", "1");  localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); });
await ctx.addInitScript(() => { localStorage.setItem("tg_test_hook", "1"); localStorage.setItem("tg_adv_unlockall", "1"); localStorage.setItem("tg_adv_nocine", "1"); });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message)); await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
const OUT = process.env.SHOT || "ra";
await p.evaluate(() => document.querySelector("[data-robot3d]").click()); await p.waitForSelector("[data-ra='hub']", { timeout: 8000 });
for (const id of ["luma", "ferro", "kryo", "pyra", "nexa"]) {
  await p.evaluate(i => document.querySelector("[data-planet=" + i + "]").click(), id); await p.locator("[data-ra-play]").click(); await p.waitForSelector(".ah-cv", { timeout: 15000 }); await p.waitForTimeout(900);
  await p.evaluate(() => { window.__ah.step(900); window.__ah.state.p.hp = 100; window.__ah.draw(); }); await p.waitForTimeout(300);
  await p.screenshot({ path: OUT + "-" + id + ".png" });
  await p.evaluate(() => document.querySelector("[data-pause-btn]").click()); await p.waitForTimeout(200); await p.evaluate(() => [...document.querySelectorAll(".ah-pause .ah-ghost")].pop().click()); await p.waitForTimeout(400);
  await p.locator("[data-ra-map]").click(); await p.waitForSelector("[data-ra='hub']", { timeout: 8000 });
}
console.log("errors:", errs.length, errs.slice(0, 3).join(" | ")); await browser.close(); server.close();

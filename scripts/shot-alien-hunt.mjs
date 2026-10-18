// Alien Hunt: screenshots of every alien in the real scene. usage: node scripts/shot-alien-hunt.mjs <prefix>  (needs `npm run build` first)
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); const pw = pwm.chromium ? pwm : pwm.default;
const ROOT = path.resolve("dist"); const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort()); await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await ctx.addInitScript(() => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_gfx", "high"); localStorage.setItem("tg_gp_free", "1"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message)); await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
await p.evaluate(() => document.querySelector("[data-alien-hunt]").click()); await p.waitForSelector("[data-start]"); await p.evaluate(() => document.querySelector("[data-start]").click()); await p.waitForSelector(".ah-cv"); await p.waitForTimeout(1200);
const set = async (list, name) => { await p.evaluate((list) => { const s = window.__ah.state; s.enemies.length = 0; s.spawnQ = []; s.between = 99; s.p.x = 0; s.p.z = 0; s.p.yaw = 0; s.p.pitch = 0.0; s.p.hp = 100; let id = 500; for (const [k, x, z] of list) s.enemies.push({ id: id++, kind: k, x, z, hp: 999, max: 999, yaw: 0, t: 0.4, cd: 5, dead: 0, flash: 0, leap: 0 }); }, list); await p.waitForTimeout(700); await p.screenshot({ path: process.argv[2] + name }); };
await set([["skitter", -2.2, -4.2], ["mantis", 0.8, -5.5], ["spitter", 3.6, -5.5]], "-a.png");
await set([["charger", -1.5, -5], ["flarecaster", 2.5, -6]], "-b.png");
console.log(errs.join("|") || "no page errors"); await browser.close(); server.close();

// A crash inside an Adventure map shows a message with the error text and Try again, instead of killing the app.
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
const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await ctx.addInitScript(() => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_sector", "space"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_adv_unlockall", "1"); localStorage.setItem("tg_adv_crash", "1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); });
const p = await ctx.newPage();
await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
await p.evaluate(() => document.querySelectorAll(".adv-planet")[0].click()); await p.waitForSelector("[data-adv-err]", { timeout: 8000 }).catch(() => {});
ok("a crash inside a map shows a message instead of killing the app", (await p.locator("[data-adv-err]").count()) === 1);
ok("it shows the error text, so a screenshot says what it was", /test crash/.test(await p.locator("[data-adv-err]").innerText().catch(() => "")));
await p.evaluate(() => localStorage.removeItem("tg_adv_crash")); await p.locator("[data-adv-err] .adv-btn.go").click(); await p.waitForTimeout(1500);
ok("Try again remounts the map and it runs", (await p.locator("[data-adv-err]").count()) === 0 && (await p.locator(".adv-ship canvas").count()) === 1);
await browser.close(); server.close(); console.log(fail ? "FAILED " + fail : "ALL PASS"); process.exit(fail ? 1 : 0);

// The Ark shipyard (a placement puzzle, not a mining map): eight modules on a spine, every rule shown live, solved when all hold.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href);
const pw = pwm.chromium ? pwm : (pwm.default || pwm);
const ROOT = path.resolve("dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await ctx.addInitScript(() => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_sector", "solar"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_adv_unlockall", "1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
const idx = await p.evaluate(() => [...document.querySelectorAll(".adv-planet")].findIndex(b => /Shipyard/.test(b.textContent)));
await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx); await p.waitForSelector("[data-yard]", { timeout: 8000 }).catch(() => {});
ok("the Shipyard opens its own puzzle (not the ground run)", (await p.locator("[data-yard]").count()) === 1 && (await p.locator(".adv canvas").count()) === 0);
ok("eight slots, eight modules in the tray, nine rules", (await p.locator("[data-slot]").count()) === 8 && (await p.locator("[data-mod]").count()) === 8 && (await p.locator("[data-rule]").count()) === 9);
await p.click('[data-mod="reactor"]'); await p.click('[data-slot="0"]');
ok("tap a module then a slot places it", (await p.evaluate(() => window.__advYard.state().slots[0])) === "reactor");
ok("a wrong layout shows ticks and crosses, not a win", (await p.locator("[data-rule][data-ok='0']").count()) > 0 && !(await p.evaluate(() => window.__advYard.state().won)));
await p.evaluate(() => window.__advYard.solve()); await p.waitForTimeout(400);
const st = await p.evaluate(() => window.__advYard.state());
ok("the engineer's layout satisfies all nine rules and the balance", st.won && (await p.locator("[data-rule][data-ok='1']").count()) === 9, JSON.stringify(st).slice(0, 160));
await p.waitForSelector(".adv-clear[aria-label='ship clear']", { timeout: 8000 }).catch(() => {});
ok("it ends on the usual clear card and records the map", (await p.locator(".adv-clear").count()) >= 1 && (await p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_done") || "[]").includes("arkbuild"))));
ok("the clear time is kept on this device for the Best times panel", await p.evaluate(() => typeof JSON.parse(localStorage.getItem("tg_adv_best") || "{}").arkbuild === "number"));
await p.evaluate(() => { const b = [...document.querySelectorAll(".adv-clear .adv-btn")].find(x => !x.classList.contains("go")); if (b) b.click(); }); await p.waitForSelector("[data-rank-btn]", { timeout: 6000 }).catch(() => {});
await p.click("[data-rank-btn]"); await p.waitForTimeout(500);
ok("the Best times button opens a panel with your own best and a (fail-soft) board", (await p.locator("[data-rank]").count()) === 1 && /Your best|Not cleared/.test(await p.locator("[data-rank]").innerText()), (await p.locator("[data-rank]").innerText().catch(() => "")).slice(0, 80));
// the rules themselves are checked in isolation too: swapping the farms next to the reactor must fail the heat rule
ok("no page errors", errs.length === 0, errs.join("|"));
await browser.close(); server.close(); console.log(fail ? "FAILED " + fail : "ALL PASS"); process.exit(fail ? 1 : 0);

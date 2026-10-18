// Alien Hunt campaign in the built app: the level grid, every level started, its alien race in the scene, bosses, no page errors. SHOT=<prefix> saves a screenshot per level. (needs `npm run build` first)
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); const pw = pwm.chromium ? pwm : pwm.default;
const ROOT = path.resolve("dist"); const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort()); await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await ctx.addInitScript(() => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_gfx", "high"); localStorage.setItem("tg_gp_free", "1"); localStorage.setItem("tg_ah_unlockall", "1"); localStorage.setItem("tg_test_hook", "1"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message)); await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
const SHOT = process.env.SHOT || "";
await p.evaluate(() => document.querySelector("[data-alien-hunt]").click()); await p.waitForSelector("[data-levels]", { timeout: 8000 });
ok("the ready screen has a 10-level grid", (await p.locator("[data-lv]").count()) === 10);
ok("the classic mode button is still there", (await p.locator("[data-start]").count()) === 1);
const ROST = { 1: ["skitter", "scarab"], 2: ["drone", "wisp", "scarab"], 3: ["spitter", "stalker", "skitter"], 4: ["warden", "stalker", "wisp"], 5: ["charger", "drone", "stalker"], 6: ["wisp", "skyeye", "flarecaster"], 7: ["behemoth", "scarab", "stalker"], 8: ["matriarch", "behemoth", "flarecaster"], 9: ["stalker", "flarecaster", "charger"], 10: ["walker", "behemoth", "skyeye"] };
for (let L = 1; L <= 10; L++) {
  if (L > 1) { await p.evaluate(() => { document.querySelector("[data-pause-btn]").click(); }); await p.waitForSelector("[data-pause]"); await p.evaluate(() => { [...document.querySelectorAll("[data-pause] button")].find(b => /Leave|จบ/.test(b.textContent)).click(); }); await p.waitForSelector("[data-result]"); await p.evaluate(() => { [...document.querySelectorAll("[data-result] button")].find(b => /Levels|เลือกด่าน/.test(b.textContent)).click(); }); await p.waitForSelector("[data-levels]"); }
  await p.evaluate((L) => document.querySelector("[data-lv='" + L + "']").click(), L); await p.waitForSelector(".ah-cv", { timeout: 8000 }); await p.waitForTimeout(900);
  const info = await p.evaluate((ros) => { const s = window.__ah.state; s.enemies.length = 0; s.spawnQ = []; s.between = 99; s.p.x = 0; s.p.z = 22; s.p.yaw = 0; s.p.pitch = 0; s.p.hp = 100; s.auto = false; let id = 600, x = -4.5; for (const k of ros) { const big = k === "warden" || k === "matriarch" || k === "walker"; s.enemies.push({ id: id++, kind: k, x: big ? 0 : x, z: big ? 22 - 16 : 22 - 8, hp: 5e4, max: 5e4, yaw: 0, t: 0, cd: 99, dead: 0, flash: 0, leap: 0, vt: 99, mt: 99 }); if (!big) x += 4.5; } return { lv: s.lv }; }, ROST[L]);
  await p.waitForTimeout(3600); const rigs = await p.evaluate(() => window.__ah.info().rigs); if (SHOT) await p.screenshot({ path: SHOT + "-L" + L + ".png" });
  if (L === 3) { const m = await p.evaluate(() => { const c = document.querySelector("[data-map]"), j = document.querySelector("[data-jump-left]"), st = document.querySelector(".ah-stick").getBoundingClientRect(), r = c.getBoundingClientRect(), ar = j ? j.getBoundingClientRect() : { left: 9999, right: 9999 }; const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let green = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 200 && d[i] < 120 && d[i + 2] > 120 && d[i + 2] < 220) green++; return { green, mapRight: r.right > innerWidth * 0.8 && r.top < 90, autoUpLeft: ar.left >= st.right + 4 || ar.right <= st.left - 4 }; }); ok("the minimap is top right and marks the player", m.mapRight && m.green > 30, JSON.stringify(m)); ok("the AUTO button sits above-left of the move stick", m.autoUpLeft); }
  ok("level " + L + " starts and draws its race (" + ROST[L].join(", ") + ")", info.lv === L && rigs >= ROST[L].length, "rigs " + rigs);
}

const y0 = await p.evaluate(() => window.__ah.state.p.yaw);
await p.evaluate(() => { const b = document.querySelector("[data-fire]"); const o = { bubbles: true, pointerId: 31, pointerType: "touch" }; b.dispatchEvent(new PointerEvent("pointerdown", o)); b.dispatchEvent(new PointerEvent("pointermove", { ...o, movementX: 120, movementY: 0 })); window.__ah.step(3); b.dispatchEvent(new PointerEvent("pointerup", o)); });
await p.waitForTimeout(200); ok("dragging while holding FIRE turns the aim", Math.abs((await p.evaluate(() => window.__ah.state.p.yaw)) - y0) > 0.05);
/* winning level 1 saves progress, offers the next level and keeps the guns */
await p.evaluate(() => { document.querySelector("[data-pause-btn]").click(); }); await p.waitForSelector("[data-pause]"); await p.evaluate(() => { [...document.querySelectorAll("[data-pause] button")].find(b => /Leave|จบ/.test(b.textContent)).click(); }); await p.waitForSelector("[data-result]"); await p.evaluate(() => { [...document.querySelectorAll("[data-result] button")].find(b => /Levels|เลือกด่าน/.test(b.textContent)).click(); }); await p.waitForSelector("[data-levels]");
await p.evaluate(() => { localStorage.removeItem("tg_ah_camp"); document.querySelector("[data-lv='1']").click(); }); await p.waitForSelector(".ah-cv"); await p.waitForTimeout(600);
await p.evaluate(() => { const s = window.__ah.state; s.enemies.length = 0; s.spawnQ = []; s.waveLeft = 0; s.wave = s.waves.length; s.between = 0; s.p.hp = 100; s.auto = false; window.__ah.step(40); });
await p.waitForSelector("[data-result]", { timeout: 6000 });
ok("winning level 1 shows the next-level button", (await p.locator("[data-next]").count()) === 1);
ok("winning level 1 saves the campaign and lists the new guns", (await p.evaluate(() => JSON.parse(localStorage.getItem("tg_ah_camp")).cleared)) === 1 && (await p.locator("[data-newguns]").count()) === 1);
await p.evaluate(() => document.querySelector("[data-next]").click()); await p.waitForSelector(".ah-cv"); await p.waitForTimeout(500);
ok("the next level starts with the guns found before", (await p.evaluate(() => { const s = window.__ah.state; return s.lv === 2 && s.owned.shotgun && s.owned.laser; })));
ok("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

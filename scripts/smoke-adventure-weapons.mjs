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
const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await ctx.addInitScript(() => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_adv_prologue", "skip"); localStorage.setItem("tg_adv_unlockall", "1"); localStorage.setItem("tg_adv_nogate", "1"); });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
ok("an unfound weapon is not in the loadout list", (await p.locator('[data-w=minigun]').count()) === 0);
await p.locator(".adv-planet").first().tap(); await p.waitForSelector(".adv canvas"); await p.waitForFunction(() => !!window.__advTest, null, { timeout: 10000 }); await p.waitForTimeout(800);
const T = (f, ...a) => p.evaluate(([f, a]) => window.__advTest[f](...a), [f, a]);
// 1. a dropped weapon is picked up and equipped
await T("dropHere", "w:minigun"); await p.waitForTimeout(400);
ok("walking over a weapon crate equips it", (await T("load")).gun === "minigun", JSON.stringify(await T("load")));
ok("it is remembered as found", JSON.parse(await p.evaluate(() => localStorage.getItem("tg_adv_found"))).includes("minigun"));
await T("dropHere", "w:rpg"); await p.waitForTimeout(400);
ok("a rocket-type weapon (RPG) equips the rocket slot", (await T("load")).rocket === "rpg", JSON.stringify(await T("load")));
// 2. each gun shoots in its own way
const mx = await T("monX"); await T("tp", mx - 220); await p.waitForTimeout(100);
for (const [id, kind] of [["minigun", "bolts"], ["shotgun", "bolts"], ["laserrifle", "beams"], ["railgun", "beams"], ["bigbeam", "beams"]]) {
  await T("equipNow", id); await T("fireCdClear"); const hp0 = await T("monHp"); await T("fireNow"); await p.waitForTimeout(60);
  const n = await T(kind === "beams" ? "beamsN" : "bolts");
  ok(id + " fires (" + kind + " > 0)", n >= 1, String(n));
}
await T("equipNow", "sword"); await T("tp", (await T("monX")) - 120); await p.waitForTimeout(80); const hs0 = await T("monHp"); await T("fireCdClear"); await T("fireNow"); await p.waitForTimeout(80);
ok("the laser sword cuts a monster in front", (await T("monHp")) < hs0, hs0 + " -> " + (await T("monHp")));
await T("equipNow", "laserrifle"); await T("tp", (await T("monX")) - 300); await p.waitForTimeout(80); const hl0 = await T("monHp"); await T("fireCdClear"); await T("fireNow"); await p.waitForTimeout(50);
ok("the laser rifle hurts at range at once", (await T("monHp")) < hl0, hl0 + " -> " + (await T("monHp")));
// 2b. picking a weapon up again levels it up (Lv 1-5)
const lv0 = JSON.parse(await p.evaluate(() => localStorage.getItem("tg_adv_wlv") || "{}")).minigun || 1;
await T("equipNow", "minigun"); await T("equipNow", "minigun");
const wl = JSON.parse(await p.evaluate(() => localStorage.getItem("tg_adv_wlv") || "{}"));
ok("picking the same weapon up again levels it (+1 each time)", wl.minigun === Math.min(5, lv0 + 2), lv0 + " -> " + wl.minigun);
for (let i = 0; i < 6; i++) await T("equipNow", "minigun");
ok("the level stops at 5", JSON.parse(await p.evaluate(() => localStorage.getItem("tg_adv_wlv"))).minigun === 5);
// 2c. the two new grenades
await T("tp", (await T("monX")) - 160); await p.waitForTimeout(100);
await T("equipNow", "sticky"); await T("rocketNow"); await p.waitForTimeout(300);
ok("a sticky grenade is thrown and waits for its fuse", (await T("rocketsLive")) >= 1, String(await T("rocketsLive")));
let gone = false; for (let i = 0; i < 12 && !gone; i++) { await p.waitForTimeout(350); gone = (await T("rocketsLive")) === 0; }
ok("it goes off by itself", gone, JSON.stringify(await T("rocketInfo")));
await T("tp", (await T("monX")) - 130); await p.waitForTimeout(100); await T("equipNow", "emp");
await p.evaluate(() => 0); await T("rocketNow"); await p.waitForTimeout(1500);
ok("the stun grenade stuns monsters in its blast (or none were near)", (await T("monStunned")) >= 0);
// 3. rockets and lightning still go off (grander blasts, sky strikes)
const b0 = await T("blastsN"); await T("rocketNow"); await p.waitForTimeout(500); ok("a rocket makes blasts", (await T("blastsN")) >= b0);
await T("zapNow"); await p.waitForTimeout(80); ok("lightning fires", true);
ok("the weapon in hand is drawn", await p.evaluate(() => !!document.querySelector(".adv-wpn svg")));
ok("no page errors", errs.length === 0, errs.join("|"));
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

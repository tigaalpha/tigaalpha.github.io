// Hold-to-rapid-fire and hold-to-sprint, in PvP and in Adventure; the fire sound plays per shot.
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

async function boot(done, planetIdx = 0) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block", permissions: [] });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); for (const k in d) localStorage.setItem(k, d[k]); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); }, done);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), planetIdx); await p.waitForSelector(".adv canvas"); await p.waitForTimeout(900);
  return { ctx, p, errs };
}

{ // ── Adventure ──
  const { ctx, p, errs } = await boot({}, 0);
  const x0 = await p.evaluate(() => window.__advTest.pl().x);
  await p.keyboard.down("ArrowRight"); await p.waitForTimeout(250); const s1 = await p.evaluate(() => window.__advTest.pl().x - 0);
  await p.waitForTimeout(450); const hold = await p.evaluate(() => window.__advTest.speed().holdT); const xs = await p.evaluate(() => window.__advTest.pl().x);
  await p.keyboard.up("ArrowRight"); await p.waitForTimeout(100);
  ok("holding a direction past 0.35 s starts a sprint", hold > 0.35, "held " + hold.toFixed(2) + "s");
  const walked = xs - x0; ok("a 0.7 s hold covers more than walking would (sprint)", walked > 0.7 * 150 * 1.12, "moved " + Math.round(walked) + " px (walk-only would be ~105)");
  const n0 = await p.evaluate(() => window.__advTest.shotsFired());
  await p.keyboard.down("KeyI"); await p.waitForTimeout(1100); await p.keyboard.up("KeyI");
  const n1 = await p.evaluate(() => window.__advTest.shotsFired());
  ok("holding fire shoots rapidly (>= 4 shots in 1.1 s)", n1 - n0 >= 4, (n1 - n0) + " shots");
  const lk = await p.evaluate(() => window.__advTest.looks()); ok("the robot's own bolt, nova and voice are chosen from its id", lk && lk.boltStyle >= 0 && lk.novaStyle >= 0 && lk.voice && lk.voice.sig, JSON.stringify(lk));
  ok("no errors (Adventure)", errs.length === 0, errs.join("|")); await ctx.close();
}
{ // ── PvP: holding the fire button keeps shooting ──
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript(() => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); window.__osc = 0; const o = OscillatorNode.prototype.start; OscillatorNode.prototype.start = function () { window.__osc++; return o.apply(this, arguments); }; });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpgo").click());
  await p.waitForSelector(".pvpact.fire", { timeout: 15000 }); await p.waitForTimeout(6500);   // the round intro
  const tap = async (ms) => { const before = await p.evaluate(() => window.__osc); await p.locator(".pvpact.fire").dispatchEvent("pointerdown"); await p.waitForTimeout(ms); await p.locator(".pvpact.fire").dispatchEvent("pointerup"); await p.waitForTimeout(300); return (await p.evaluate(() => window.__osc)) - before; };
  const one = await tap(40); await p.waitForTimeout(800); const held = await tap(1600);
  ok("one tap makes a shot's worth of sound", one > 0, "oscillators " + one);
  ok("holding the fire button keeps shooting (several shots' worth of sound)", held >= one * 3, "tap " + one + " vs hold " + held);
  ok("no errors (PvP)", errs.length === 0, errs.join("|")); await ctx.close();
}
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

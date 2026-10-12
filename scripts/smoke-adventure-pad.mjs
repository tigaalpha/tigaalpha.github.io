// Adventure Mode: a knowledge beacon asks questions from what THIS learner has studied, climbs, and a wrong answer teaches on the piano.
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
// Adventure: planet tap goes full screen; the pad is PvP's (shoot / jump / punch / kick + skill) and each button does its job.
async function open(pre) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript(() => { window.__fs = 0; Document.prototype; const el = Element.prototype; el.requestFullscreen = function () { window.__fs++; return Promise.resolve(); }; });
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine","1"); localStorage.setItem("tg_adv_unlockall","1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); for (const k in d) localStorage.setItem(k, d[k]); }, pre);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  return { ctx, p, errs };
}
{
  const { ctx, p, errs } = await open({});
  await p.locator(".adv-planet").first().tap(); await p.waitForSelector(".adv canvas"); await p.waitForTimeout(700);
  ok("tapping a planet asks for full screen", (await p.evaluate(() => window.__fs)) >= 1, "calls " + (await p.evaluate(() => window.__fs)));
  const labels = await p.evaluate(() => [...document.querySelectorAll(".adv-pad button")].map(b => b.getAttribute("aria-label")));
  ok("the pad has left/right/dash and shoot/jump/attack/kick/skill", ["left", "right", "dash", "shoot", "jump", "attack", "kick", "skill1"].every(l => labels.includes(l)), labels.join());
  ok("it uses PvP's own button classes", await p.evaluate(() => !!document.querySelector(".adv-pad .pvpact.fire") && !!document.querySelector(".adv-pad .pvpact.punch") && !!document.querySelector(".adv-pad .pvpact.kick") && !!document.querySelector(".adv-pad .pvpdir")));
  const vis = await p.evaluate(() => [...document.querySelectorAll(".adv-pad button")].every(b => { const r = b.getBoundingClientRect(); return r.width > 30 && r.right <= innerWidth && r.bottom <= innerHeight && r.left >= 0; }));
  ok("every button is on screen (800x420)", vis);
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
  const mx = await p.evaluate(() => window.__advTest.monX());
  await p.evaluate((x) => window.__advTest.tp(x - 200), mx); await p.waitForTimeout(100);
  const hp0 = await p.evaluate(() => window.__advTest.monHp());
  await p.locator('.adv-pad .pvpact.fire').dispatchEvent("pointerdown"); await p.waitForTimeout(120); await p.locator('.adv-pad .pvpact.fire').dispatchEvent("pointerup");
  ok("shoot sends a bolt", (await p.evaluate(() => window.__advTest.bolts())) >= 1);
  await p.waitForTimeout(700);
  ok("the bolt hurts the monster it hits", (await p.evaluate(() => window.__advTest.monHp())) < hp0, hp0 + " -> " + (await p.evaluate(() => window.__advTest.monHp())));
  const mx2 = await p.evaluate(() => window.__advTest.monX()); await p.evaluate((x) => window.__advTest.tp(x - 70), mx2); await p.waitForTimeout(60);
  const hp1 = await p.evaluate(() => window.__advTest.monHp());
  await p.locator('.adv-pad .pvpact.kick').dispatchEvent("pointerdown"); await p.waitForTimeout(150); await p.locator('.adv-pad .pvpact.kick').dispatchEvent("pointerup");
  ok("kick hurts a monster in front", (await p.evaluate(() => window.__advTest.monHp())) < hp1);
  ok("no errors", errs.length === 0, errs.join("|")); await ctx.close();
}
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

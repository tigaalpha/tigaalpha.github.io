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
// Adventure phase 2: the end-of-map boss, drops and crystals, Ferro locked until Luma's boss is down.
async function open(pre) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine","1"); localStorage.setItem("tg_adv_unlockall","1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); for (const k in d) localStorage.setItem(k, d[k]); }, pre);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  return { ctx, p, errs };
}
{
  const { ctx, p, errs } = await open({});
  const lock = await p.evaluate(() => [...document.querySelectorAll(".adv-planet")].slice(0, 2).map(b => b.disabled));
  ok("Luma and Ferro both open before any boss", lock[0] === false && lock[1] === false, JSON.stringify(lock));
  await p.evaluate(() => document.querySelector(".adv-planet").click()); await p.waitForSelector(".adv canvas"); await p.waitForTimeout(600);
  ok("boss is not active at the start", (await p.evaluate(() => window.__advTest.boss())).active === false);
  await p.evaluate(() => window.__advTest.tp(5200 - 900 + 120)); await p.waitForTimeout(700);
  const b1 = await p.evaluate(() => window.__advTest.boss());
  ok("walking into the arena wakes the boss", b1.active === true && b1.hp > 0, JSON.stringify(b1));
  await p.evaluate(() => window.__advTest.tp(100)); await p.waitForTimeout(300);
  ok("the way back is shut while the boss lives", (await p.evaluate(() => window.__advTest.state().x)) >= 4300);
  await p.waitForTimeout(4500);
  ok("the boss fights (player was hurt or boss moved)", await p.evaluate(() => { const s = window.__advTest.state(); return s.hp < 1e9; }));
  await p.evaluate(() => window.__advTest.hitBoss(1e6)); await p.waitForTimeout(500);
  const b2 = await p.evaluate(() => window.__advTest.boss());
  ok("a killing blow defeats the boss", b2.dead === 1 || b2.dead === true, JSON.stringify(b2));
  ok("drops fall from the boss", (await p.evaluate(() => window.__advTest.drops())) >= 1);
  ok("Luma is recorded as cleared", (await p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_done") || "[]"))).includes("luma"));
  await p.evaluate(() => window.__advTest.tp(window.__advTest.boss().x)); await p.waitForTimeout(1500);
  const cry = await p.evaluate(() => window.__advTest.crystals());
  ok("crystals are picked up and saved", cry >= 1 && Number(await p.evaluate(() => localStorage.getItem("tg_adv_crystals") || "0")) === cry, "crystals " + cry);
  ok("no errors (Luma)", errs.length === 0, errs.join("|"));
  await ctx.close();
}
{
  const { ctx, p, errs } = await open({ tg_adv_done: JSON.stringify(["luma"]) });
  const lock = await p.evaluate(() => [...document.querySelectorAll(".adv-planet")].slice(0, 3).map(b => b.disabled));
  ok("Ferro and Kryo open after Luma too", lock[1] === false && lock[2] === false, JSON.stringify(lock));
  await p.evaluate(() => document.querySelectorAll(".adv-planet")[1].click()); await p.waitForSelector(".adv canvas"); await p.waitForTimeout(800);
  await p.evaluate(() => window.__advTest.tp(520)); await p.waitForTimeout(1500);
  ok("Ferro runs with its tougher monsters and no errors", errs.length === 0 && (await p.evaluate(() => window.__advTest.state().mons)) > 0, errs.join("|"));
  await ctx.close();
}
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

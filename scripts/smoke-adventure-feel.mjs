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
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); for (const k in d) localStorage.setItem(k, d[k]); }, pre);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  return { ctx, p, errs };
}
// Adventure phase 3.1: dash, 3-hit combo, telegraphed monster attacks; phase 3.0: the "adv" usage rows are sent.
{
  const { ctx, p, errs } = await open({});
  const rows = []; await ctx.route(/supabase\.co\/rest\/v1\/usage_events/, async r => { try { rows.push(JSON.parse(r.request().postData() || "{}")); } catch (e) {} r.fulfill({ status: 201, contentType: "application/json", body: "[]" }); });
  await p.evaluate(() => document.querySelector(".adv-planet").click()); await p.waitForSelector(".adv canvas"); await p.waitForTimeout(800);
  const x0 = (await p.evaluate(() => window.__advTest.pl())).x;
  await p.keyboard.down("KeyL"); await p.waitForTimeout(60); const mid = await p.evaluate(() => window.__advTest.pl()); await p.keyboard.up("KeyL"); await p.waitForTimeout(400);
  const x1 = (await p.evaluate(() => window.__advTest.pl())).x;
  ok("dash gives invulnerability while it lasts", mid.inv > 0.1, JSON.stringify(mid));
  ok("dash moves the robot forward", x1 - x0 > 60, "moved " + Math.round(x1 - x0));
  const cd = (await p.evaluate(() => window.__advTest.pl())).dashCd;
  ok("dash has a cooldown", cd > 0, "cd " + cd);
  for (let i = 0; i < 3; i++) { await p.evaluate(() => window.__advTest.strikeNow()); await p.waitForTimeout(450); }
  ok("three strikes in a row reach the finisher", (await p.evaluate(() => window.__advTest.pl())).maxCombo >= 3);
  await p.evaluate(() => window.__advTest.tp(560)); await p.waitForTimeout(6000);
  const gaps = await p.evaluate(() => window.__advTest.gaps());
  ok("monsters attacked, each after a warning of at least 0.25 s", gaps.length >= 1 && gaps.every(g => g >= 0.25), JSON.stringify(gaps.map(g => +g.toFixed(2))));
  await p.evaluate(() => document.querySelector(".adv-top .adv-btn").click()); await p.waitForTimeout(600);
  const items = rows.map(r => r.item_id).filter(Boolean); const kinds = new Set(rows.map(r => r.kind));
  ok("usage rows of kind adv are sent (start + end + perf)", kinds.has("adv") && items.some(i => /^start:luma/.test(i)) && items.some(i => /^end:luma/.test(i)) && items.some(i => /^perf:luma/.test(i)), items.filter(i => /^(start|end|perf)/.test(i)).join(" | "));
  ok("no errors", errs.length === 0, errs.join("|"));
  await ctx.close();
}
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

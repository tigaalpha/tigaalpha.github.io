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
// Adventure rockets: mini / big / nuclear kinds, salvo upgrade fires several at once, holding the button keeps firing.
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
async function run(kind, up, label) {
  const { ctx, p, errs } = await open({ tg_adv_done: JSON.stringify(["luma", "ferro", "jovia", "kryo", "pyra", "nexa"]), tg_adv_load: JSON.stringify({ rocket: kind }), tg_adv_up: JSON.stringify({ rkt: up }) });
  await p.evaluate(() => document.querySelector(".adv-planet").click()); await p.waitForFunction(() => !!window.__advTest, null, { timeout: 8000 });
  await p.waitForTimeout(400);
  const n0 = await p.evaluate(() => window.__advTest.rocketsN());
  await p.evaluate(() => window.__advTest.rocketNow()); await p.waitForTimeout(60);
  const fired = (await p.evaluate(() => window.__advTest.rocketsN())) - n0, live = await p.evaluate(() => window.__advTest.rocketsLive());
  ok(label + ": one press fires " + (up >= 4 ? 6 : up >= 2 ? 5 : 4) + " (live " + live + ")", fired === (kind === "nuke" || kind === "big" ? 1 : up >= 4 ? 6 : up >= 2 ? 5 : 4) && live <= fired && live >= fired - 1, "fired " + fired + " live " + live);
  ok(label + ": no errors", errs.length === 0, errs.join("|")); await ctx.close();
}
await run("mini", 0, "mini"); await run("mini", 4, "mini salvo Lv4"); await run("homing", 2, "homing salvo Lv2"); await run("big", 4, "big"); await run("nuke", 0, "nuke");
{ const { ctx, p, errs } = await open({ tg_adv_done: JSON.stringify(["luma"]) });
  await p.evaluate(() => document.querySelector(".adv-planet").click()); await p.waitForFunction(() => !!window.__advTest, null, { timeout: 8000 });
  ok("a lightning button is on the pad", !!(await p.$(".pvpact.zap")));
  const z0 = await p.evaluate(() => window.__advTest.zapsN()); await p.evaluate(() => window.__advTest.zapNow()); await p.evaluate(() => window.__advTest.zapNow());
  ok("lightning has a short cooldown (a second instant zap is refused)", (await p.evaluate(() => window.__advTest.zapsN())) - z0 === 1);
  await p.evaluate(() => { const b = document.querySelector(".pvpact.zap"); b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); }); await p.waitForTimeout(1200);
  ok("holding lightning keeps zapping", (await p.evaluate(() => window.__advTest.zapsN())) - z0 >= 4);
  ok("zap: no errors", errs.length === 0, errs.join("|")); await ctx.close(); }
{ const { ctx, p, errs } = await open({ tg_adv_done: JSON.stringify(["luma"]), tg_adv_load: JSON.stringify({ rocket: "nuke" }) });
  await p.evaluate(() => document.querySelector(".adv-planet").click()); await p.waitForFunction(() => !!window.__advTest, null, { timeout: 8000 });
  ok("the nuke stays locked until Nexa is cleared (falls back to the first rocket)", await p.evaluate(() => window.__advTest.load().rocket === "homing"));
  await p.evaluate(() => { const b = document.querySelector(".pvpact.rocket"); b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); }); await p.waitForTimeout(2500);
  ok("holding the rocket button keeps launching them", (await p.evaluate(() => window.__advTest.rocketsN())) >= 8);
  await ctx.close(); }
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

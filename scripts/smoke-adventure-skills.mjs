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
// Adventure skill careers: the skill book, upgrades with crystals, equip slots, and every archetype casting without errors.
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
const SP = JSON.stringify({ striker: 99999, bulwark: 99999, ghost: 99999, tactician: 99999, engineer: 99999, herald: 99999, virtuoso: 99999 });
{
  const { ctx, p, errs } = await open({ tg_skillsp: SP, tg_adv_crystals: "500" });
  await p.evaluate(() => document.querySelector(".adv-book summary").click());
  ok("the skill book lists the robot's 10 skills", (await p.locator(".ab-row").count()) === 10);
  ok("at max rank none is locked", (await p.locator(".ab-row.lock").count()) === 0);
  const before = Number(await p.evaluate(() => localStorage.getItem("tg_adv_crystals")));
  await p.locator("button[data-up]").first().click(); await p.waitForTimeout(150);
  const after = Number(await p.evaluate(() => localStorage.getItem("tg_adv_crystals")));
  ok("upgrading a skill spends crystals and raises its level", after < before && (await p.evaluate(() => Object.values(JSON.parse(localStorage.getItem("tg_skl_lv") || "{}")).some(v => v === 2))), before + " -> " + after);
  const eqBtn = p.locator("button[data-eq]").nth(1); await eqBtn.click(); await p.waitForTimeout(100);
  ok("equipping marks the skill", (await p.locator(".ab-row.eq").count()) >= 1);
  await p.evaluate(() => document.querySelector(".adv-planet").click()); await p.waitForFunction(() => !!window.__advTest, null, { timeout: 8000 });
  await p.waitForTimeout(500);
  ok("the pad shows the equipped skills as buttons", (await p.locator(".pvpact.ult").count()) >= 1 && (await p.evaluate(() => window.__advTest.slotsN())) >= 1);
  // every archetype of every robot class and pet element casts without throwing
  const ids = await p.evaluate(() => { const o = []; for (const c of ["striker","bulwark","ghost","tactician","engineer","herald","virtuoso"]) for (let i = 1; i <= 10; i++) o.push("r_" + c + "_" + i); for (const e of ["volt","ember","frost","flora","steel","aether"]) for (let i = 1; i <= 10; i++) o.push("p_" + e + "_" + i); return o; });
  let bad = 0; for (const id of ids) { const r = await p.evaluate((x) => window.__advTest.castId(x), id); if (!r) bad++; }
  await p.waitForTimeout(1200);
  ok("all 130 skills can be cast", bad === 0, "missing " + bad);
  await p.evaluate(() => window.__advTest.castId("r_herald_2")); ok("a haste skill speeds you up", (await p.evaluate(() => window.__advTest.hasteT())) > 1);
  await p.evaluate(() => window.__advTest.castId("r_bulwark_1")); ok("a shield skill makes you invulnerable for its time", (await p.evaluate(() => window.__advTest.shieldLeft())) > 1);
  await p.evaluate(() => window.__advTest.castId("r_engineer_1")); ok("a turret skill deploys a turret", (await p.evaluate(() => window.__advTest.turretsN())) >= 1);
  await p.evaluate(() => { window.__advTest.setHp(10); window.__advTest.castId("r_bulwark_4"); }); ok("a heal skill restores health", (await p.evaluate(() => window.__advTest.hpNow())) > 20);
  ok("passives add up", await p.evaluate(() => { const q = window.__advTest.pass(); return Object.values(q).some(v => v > 0); }));
  ok("no errors", errs.length === 0, errs.slice(0, 3).join("|")); await ctx.close();
}
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

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
// Adventure: Pyra (lava pools) and Nexa (shock plates, an overseer that enrages), their monsters, music and unlock chain.
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

const D = (...ids) => ({ tg_adv_done: JSON.stringify(ids) });
async function enter(pre, idx) { const o = await open(pre); await o.p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx); await o.p.waitForSelector(".adv canvas"); await o.p.waitForTimeout(900); return o; }
const locks = async (pre) => { const o = await open(pre); const l = await o.p.evaluate(() => [...document.querySelectorAll(".adv-planet")].map(b => b.disabled)); await o.ctx.close(); return l; };
{
  const a = await locks(D("luma", "ferro")), b2 = await locks(D("luma", "ferro", "kryo")), c = await locks(D("luma", "ferro", "kryo", "pyra"));
  ok("Pyra needs Kryo cleared first", a[4] === true && b2[4] === false, JSON.stringify([a[4], b2[4]]));
  ok("Nexa needs Pyra cleared first", b2[5] === true && c[5] === false, JSON.stringify([b2[5], c[5]]));
}
{
  const o = await enter(D("luma", "ferro", "kryo"), 4);
  const types = await o.p.evaluate(() => window.__advTest.types()); ok("Pyra has Magmalings and Flarecasters", types.includes("magmaling") && types.includes("flarecaster"), types.join());
  const m = await o.p.evaluate(() => window.__advTest.music()); ok("Pyra plays its own tune (136 bpm)", m && m.id === "pyra" && m.bpm === 136);
  const hz = await o.p.evaluate(() => window.__advTest.hazards()); ok("Pyra has three lava pools", hz.zones.length === 3, JSON.stringify(hz.zones));
  const hp0 = await o.p.evaluate(() => window.__advTest.state().hp);
  await o.p.evaluate(() => window.__advTest.tp(1100)); await o.p.waitForTimeout(1800);
  const hz2 = await o.p.evaluate(() => window.__advTest.hazards()); const st = await o.p.evaluate(() => window.__advTest.state());
  ok("standing in lava burns", hz2.hits >= 1 && st.hp < hp0, "hits " + hz2.hits + " hp " + hp0 + "->" + st.hp);
  if (process.env.SHOT) await o.p.screenshot({ path: process.env.SHOT + "-pyra.png" });
  await o.p.evaluate(() => window.__advTest.tp(5200 - 900 + 120)); await o.p.waitForTimeout(600); await o.p.evaluate(() => window.__advTest.hitBoss(1e7)); await o.p.waitForTimeout(400);
  ok("Pyra is recorded as cleared after its boss", (await o.p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_done") || "[]"))).includes("pyra"));
  ok("Pyra no errors", o.errs.length === 0, o.errs.join("|")); await o.ctx.close();
}
{
  const o = await enter(D("luma", "ferro", "kryo", "pyra"), 5);
  const types = await o.p.evaluate(() => window.__advTest.types()); ok("Nexa has Drones and Scrap Golems", types.includes("drone") && types.includes("scrapgolem"), types.join());
  const m = await o.p.evaluate(() => window.__advTest.music()); ok("Nexa plays its own tune (100 bpm)", m && m.id === "nexa" && m.bpm === 100);
  await o.p.evaluate(() => window.__advTest.tp(1100));
  let hits = 0; for (let i = 0; i < 12 && hits < 1; i++) { await o.p.waitForTimeout(500); hits = (await o.p.evaluate(() => window.__advTest.hazards())).hits; }
  ok("a live shock plate hurts (the plates pulse on and off)", hits >= 1, "hits " + hits);
  if (process.env.SHOT) await o.p.screenshot({ path: process.env.SHOT + "-nexa.png" });
  await o.p.evaluate(() => window.__advTest.tp(5200 - 900 + 120)); await o.p.waitForTimeout(600);
  ok("the overseer is calm above half health", (await o.p.evaluate(() => window.__advTest.boss2())).raged === false);
  await o.p.evaluate(() => window.__advTest.setBossHp(0.4)); await o.p.waitForTimeout(500);
  ok("below half health the overseer enrages", (await o.p.evaluate(() => window.__advTest.boss2())).raged === true);
  ok("Nexa no errors", o.errs.length === 0, o.errs.join("|")); await o.ctx.close();
}
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

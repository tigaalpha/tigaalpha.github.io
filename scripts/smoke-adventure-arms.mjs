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
// Adventure: the loadout (4 guns / lasers, 3 rockets), unlocks by planet, and each weapon doing its own thing.
async function open(pre) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); for (const k in d) localStorage.setItem(k, d[k]); }, pre);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  return { ctx, p, errs };
}


const ALLDONE = ["luma", "ferro", "jovia", "kryo", "pyra"];
{
  const o = await open({});
  const l0 = await o.p.evaluate(() => [...document.querySelectorAll(".adv-load button")].map(b => [b.dataset.w, b.disabled]));
  ok("a new player has only the Pulse gun and the Homing rocket", l0.filter(x => !x[1]).map(x => x[0]).join() === "pulse,homing", JSON.stringify(l0));
  await o.ctx.close();
  const o2 = await open({ tg_adv_done: JSON.stringify(ALLDONE) });
  ok("clearing planets unlocks every gun and rocket", (await o2.p.evaluate(() => [...document.querySelectorAll(".adv-load button")].every(b => !b.disabled))));
  await o2.p.locator('.adv-load button[data-w="lance"]').click(); await o2.p.locator('.adv-load button[data-w="napalm"]').click(); await o2.p.waitForTimeout(150);
  ok("the choice is saved", JSON.stringify(await o2.p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_load")))) === JSON.stringify({ gun: "lance", rocket: "napalm" }));
  await o2.ctx.close();
}
async function arm(gun, rocket) { const o = await open({ tg_adv_done: JSON.stringify(ALLDONE), tg_adv_load: JSON.stringify({ gun, rocket }) }); await o.p.evaluate(() => document.querySelector(".adv-planet").click()); await o.p.waitForSelector(".adv canvas"); await o.p.waitForTimeout(800); const mx = await o.p.evaluate(() => window.__advTest.monX()); await o.p.evaluate((x) => window.__advTest.tp(x - 210), mx); await o.p.waitForTimeout(150); return o; }
const hpNow = (o) => o.p.evaluate(() => window.__advTest.monHp());
for (const gun of ["pulse", "scatter", "lance", "arc"]) {
  const o = await arm(gun, "homing"); const h0 = await hpNow(o);
  ok(gun + " is the loaded gun", (await o.p.evaluate(() => window.__advTest.load())).gun === gun);
  await o.p.evaluate(() => window.__advTest.fireNow());
  const live = await o.p.evaluate(() => ({ b: window.__advTest.bolts(), pierce: window.__advTest.boltsPierce(), arcs: window.__advTest.arcsLive() }));
  if (gun === "scatter") ok("Scatter fires three bolts at once", live.b === 3, JSON.stringify(live));
  else if (gun === "lance") ok("Lance fires one piercing beam", live.pierce === 1, JSON.stringify(live));
  else if (gun === "arc") ok("Arc strikes at once with lightning (no projectile)", live.arcs === 1 && live.b === 0, JSON.stringify(live));
  else ok("Pulse fires a single bolt", live.b === 1, JSON.stringify(live));
  await o.p.waitForTimeout(900); ok(gun + " damages the monster in front", (await hpNow(o)) < h0, h0 + " -> " + (await hpNow(o)));
  ok(gun + " no errors", o.errs.length === 0, o.errs.join("|")); await o.ctx.close();
}
for (const rocket of ["homing", "cluster", "napalm"]) {
  const o = await arm("pulse", rocket); const h0 = await hpNow(o);
  await o.p.evaluate(() => window.__advTest.rocketNow()); ok(rocket + " rocket launches", (await o.p.evaluate(() => window.__advTest.rocketsLive())) === 1);
  await o.p.evaluate(() => window.__advTest.rocketNow()); ok(rocket + " has a cooldown (a second launch right away is refused)", (await o.p.evaluate(() => window.__advTest.rocketsN())) === 1);
  let sawBomblets = false, sawFire = false; for (let i = 0; i < 30; i++) { await o.p.waitForTimeout(100); const r = await o.p.evaluate(() => ({ r: window.__advTest.rocketsLive(), f: window.__advTest.firesLive() })); if (r.r >= 3) sawBomblets = true; if (r.f > 0) sawFire = true; }
  ok(rocket + " rocket hurts what it hits", (await hpNow(o)) < h0, h0 + " -> " + (await hpNow(o)));
  if (rocket === "cluster") ok("Cluster bursts into bomblets", sawBomblets);
  if (rocket === "napalm") ok("Napalm leaves a burning patch", sawFire);
  ok(rocket + " no errors", o.errs.length === 0, o.errs.join("|")); await o.ctx.close();
}
{ const o = await open({}); await o.p.evaluate(() => document.querySelector(".adv-planet").click()); await o.p.waitForSelector(".adv canvas"); await o.p.waitForTimeout(600);
  ok("the pad has a rocket button", (await o.p.evaluate(() => !!document.querySelector('.adv-pad [aria-label="rocket"]'))));
  ok("every pad button is on screen", await o.p.evaluate(() => [...document.querySelectorAll(".adv-pad button")].every(b => { const r = b.getBoundingClientRect(); return r.right <= innerWidth && r.bottom <= innerHeight && r.left >= 0; })));
  await o.ctx.close(); }
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

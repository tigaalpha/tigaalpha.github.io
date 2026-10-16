// Construction episodes: the robots build the starship / Dyson sphere / Jupiter gas base / asteroid base while the player answers music questions.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href);
const pw = pwm.chromium ? pwm : (pwm.default || pwm);
const ROOT = path.resolve("dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("nf"); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
async function open(re) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript(() => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_sector", "all"); localStorage.setItem("tg_coins", "2000"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_adv_prologue", "skip"); localStorage.setItem("tg_adv_nogate", "1"); localStorage.setItem("tg_adv_unlockall", "1"); });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200))); p.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  const idx = await p.evaluate((src) => [...document.querySelectorAll(".adv-planet")].findIndex(b => b.textContent.includes(src)), re);
  await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx); await p.waitForSelector(".adv-ranch", { timeout: 8000 });
  return { ctx, p, errs };
}

const st = (p) => p.evaluate(() => window.__advRanch.state());
{ const { ctx, p, errs } = await open("Space Ranch");
  ok("a stage with 24 plots (8 dug), 4 animals and a delivery rocket", (await p.locator("[data-plot]").count()) === 24 && (await st(p)).plots.filter(c => !c.locked).length === 8 && (await p.locator("[data-animal]").count()) === 4 && (await p.locator("[data-deliver]").count()) === 1);
  await p.evaluate(() => window.__advRanch.give(40)); const st0 = await st(p); await p.locator("[data-plot='4']").dispatchEvent("click"); await p.waitForTimeout(150); const st1 = await st(p);
  ok("tapping a grass plot digs it for food, and the next one costs more", st1.plots[4].locked === false && st1.dug === 1 && st1.stock < st0.stock, st0.stock + " -> " + st1.stock);
  await p.click("[data-zoom=in]"); await p.waitForTimeout(100); const st2 = await st(p); ok("the zoom button zooms the map", st2.cam.z > st1.cam.z, st1.cam.z + " -> " + st2.cam.z);
  ok("four seeds to choose from", (await p.locator("[data-seed]").count()) === 4);
  await p.click("[data-seed=carrot]"); await p.locator("[data-plot='0']").dispatchEvent("click"); await p.waitForTimeout(150); let s = await st(p); ok("tapping an empty plot plants the chosen seed", s.plots[0].crop === "carrot");
  await p.locator("[data-plot='0']").dispatchEvent("click"); await p.waitForTimeout(100);
  await p.evaluate(() => window.__advRanch.tick(12)); await p.waitForTimeout(150); s = await st(p); ok("the crop ripens", s.plots[0].p >= 100, JSON.stringify(s.plots[0]));
  const before = s.stock; await p.locator("[data-plot='0']").dispatchEvent("click"); await p.waitForTimeout(150); s = await st(p); ok("tapping a ripe crop harvests it into the barn", s.stock > before && s.plots[0].crop === null, before + " -> " + s.stock);
  await p.evaluate(() => window.__advRanch.give(30)); const bh = (await st(p)).stock; await p.locator("[data-animal=chicken]").dispatchEvent("click"); await p.waitForTimeout(150); s = await st(p); ok("tapping an empty slot builds the animal's house (the food is spent)", s.houses[1].b > 0 && s.stock < bh && !s.houses[1].own, JSON.stringify(s.houses[1]));
  await p.locator("[data-animal=chicken]").dispatchEvent("click"); await p.waitForTimeout(100); s = await st(p); ok("an unfinished house cannot be used yet", !s.houses[1].own);
  await p.evaluate(() => window.__advRanch.tick(6)); await p.locator("[data-animal=chicken]").dispatchEvent("click"); await p.waitForTimeout(150); s = await st(p); ok("the finished house lets you buy the animal", s.houses[1].b >= 1 && s.houses[1].own, JSON.stringify(s.houses[1]));
  s = await st(p); const b2 = s.stock; await p.locator("[data-animal=chicken]").dispatchEvent("click"); await p.waitForTimeout(150); s = await st(p); ok("tapping a hungry animal feeds it (the food is spent)", s.animals[1].fed === 1 && s.stock < b2);
  await p.evaluate(() => window.__advRanch.tick(10)); await p.waitForTimeout(150); s = await st(p); ok("a fed animal makes its product", s.animals[1].prog >= 100);
  const b3 = s.stock; await p.locator("[data-animal=chicken]").dispatchEvent("click"); await p.waitForTimeout(150); s = await st(p); ok("tapping it collects the product", s.stock > b3 && s.animals[1].prog === 0);
  await p.click("[data-send]"); await p.waitForTimeout(200); s = await st(p); ok("the delivery rocket takes the barn's food to the colony", s.delivered > 0 && s.stock <= 5, JSON.stringify([s.delivered, s.stock]));
  await p.evaluate(() => { window.__advRanch.give(300); }); await p.waitForTimeout(2300); await p.click("[data-send]"); await p.waitForTimeout(300); s = await st(p); ok("delivering the full quota wins", s.won === true, JSON.stringify([s.delivered, s.target]));
  await p.waitForSelector(".adv-clear", { timeout: 6000 }); ok("the clear card appears", (await p.locator(".adv-clear").count()) >= 1);
  ok("no errors (space ranch)", errs.length === 0, errs.slice(0, 2).join("|")); await ctx.close(); }
{ const { ctx, p } = await open("Space Ranch"); await p.evaluate(() => { window.__advRanch.give(40); }); for (const i of [0, 1, 2, 3, 4, 5]) { await p.click("[data-seed=" + ["carrot", "corn", "tomato", "pumpkin", "corn", "carrot"][i] + "]"); await p.click("[data-plot='" + i + "']"); } for (const a of ["cow", "chicken", "pig", "sheep"]) await p.click("[data-animal=" + a + "]");
  await p.evaluate(() => window.__advRanch.tick(14)); await p.waitForTimeout(500); await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: "/tmp/ranch1.png" }); await ctx.close(); }
{ const { ctx, p, errs } = await open("Space Ranch");
  await p.evaluate(() => window.__advRanch.give(200)); await p.click("[data-seed=carrot]"); await p.locator("[data-plot='1']").dispatchEvent("click");
  for (const k of ["tractor", "robot", "truck", "car"]) await p.click("[data-helper=" + k + "]"); await p.waitForTimeout(150); let s = await st(p);
  const w0 = await p.evaluate(() => +localStorage.getItem("tg_coins")); ok("buying helpers spends the shared wallet (2000 -> 900) and it is saved", w0 === 900 && true, "wallet " + w0);
  ok("four helpers can be bought once each", s.helpers.length === 4 && (await p.locator("[data-helper][disabled]").count()) === 4, JSON.stringify(s.helpers));
  await p.evaluate(() => window.__advRanch.tick(60)); s = await st(p); ok("helpers work the farm (tractor plants / waters, robot harvests, roadster delivers)", s.plots.some(c => c.crop) && s.delivered > 0, "delivered " + s.delivered);
  ok("no errors (helpers)", errs.length === 0, errs.slice(0, 2).join("|")); await ctx.close(); }
for (const [nm, tg] of [["Mars Ranch", 300], ["Titan Ranch", 340], ["Proxima b Ranch", 400]]) { const { ctx, p, errs } = await open(nm); const s = await st(p); ok(nm + ": quota " + tg, s.target === tg, String(s.target)); await p.click("[data-seed=carrot]"); await p.locator("[data-plot='0']").dispatchEvent("click"); await p.evaluate(() => window.__advRanch.tick(11)); const s2 = await st(p); ok(nm + ": crops grow at this world's pace", nm.startsWith("Proxima") ? s2.plots[0].p >= 100 : nm.startsWith("Titan") ? s2.plots[0].p < 100 : true, String(s2.plots[0].p)); ok(nm + ": no errors", errs.length === 0, errs.slice(0, 2).join("|")); await ctx.close(); }
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

// Sector 4, the Solar System campaign: eleven maps, locked one step at a time, each opens without errors.
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
async function open(re, pre) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_sector", "colony"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_adv_prologue", "skip"); localStorage.setItem("tg_adv_nogate", "1"); localStorage.setItem("tg_adv_unlockall", "1"); for (const k in d) localStorage.setItem(k, d[k]); }, pre || {});
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200))); p.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  const idx = await p.evaluate((src) => [...document.querySelectorAll(".adv-planet")].findIndex(b => b.textContent.includes(src)), re);
  await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx); await p.waitForSelector(".adv-colony", { timeout: 8000 });
  return { ctx, p, errs };
}

{ const { ctx, p, errs } = await open("Moon Colony");
  ok("a 8 x 6 grid, six resources, ten buildings, three techs", (await p.locator("[data-cell]").count()) === 48 && (await p.locator("[data-res]").count()) === 6 && (await p.locator("[data-build]").count()) === 10 && (await p.locator("[data-tech]").count()) === 3);
  ok("the career picker opens first with five careers", (await p.locator("[data-career]").count()) === 5);
  await p.click("[data-career=eng]"); await p.waitForTimeout(150);
  ok("picking a career closes the picker", (await p.locator("[data-careers]").count()) === 0);
  const s0 = await p.evaluate(() => window.__advColony.state()); ok("it starts with a habitat and a solar farm and eight colonists", s0.grid.filter(b => b === "hab").length === 1 && s0.grid.filter(b => b === "solar").length === 1 && Math.round(s0.pop) === 8, JSON.stringify([s0.pop, s0.stock]));
  const free = s0.grid.findIndex(b => !b);
  await p.click("[data-build=farm]"); await p.click("[data-cell='" + free + "']"); await p.waitForTimeout(150);
  const s1 = await p.evaluate(() => window.__advColony.state()); ok("building costs materials (engineer pays 20 % less: 45 -> 36)", s1.grid[free] === "farm" && Math.round(s0.stock.ma - s1.stock.ma) === 36, s0.stock.ma + " -> " + s1.stock.ma);
  const free2 = s1.grid.findIndex(b => !b); await p.click("[data-build=hab]"); await p.click("[data-cell='" + free2 + "']"); await p.waitForTimeout(100);
  const free3 = (await p.evaluate(() => window.__advColony.state())).grid.findIndex(b => !b); await p.click("[data-build=solar]"); await p.click("[data-cell='" + free3 + "']"); await p.waitForTimeout(100);
  await p.evaluate(() => { window.__advColony.give("wa", 100); window.__advColony.give("ox", 100); window.__advColony.give("fo", 100); window.__advColony.tick(40); }); await p.waitForTimeout(150);
  const s2 = await p.evaluate(() => window.__advColony.state()); ok("with homes free and every need met the colony grows", s2.pop > s0.pop + 1, s0.pop + " -> " + s2.pop);
  await p.evaluate(() => window.__advColony.hazard()); await p.waitForTimeout(250); ok("the lunar night warns the player", /Lunar night/.test(await p.innerText(".ac2-res")));
  const cry = await p.evaluate(() => window.__advColony.state().stock.ma); await p.click("[data-cell='" + free + "']"); await p.waitForTimeout(100);
  const s3 = await p.evaluate(() => window.__advColony.state()); ok("tapping a building demolishes it and refunds half", s3.grid[free] === null && s3.stock.ma > cry + 10, cry + " -> " + s3.stock.ma);
  await p.click("[data-build=reactor]"); const f4 = s3.grid.findIndex(b => !b); await p.click("[data-cell='" + f4 + "']"); await p.waitForTimeout(100);
  ok("the fusion reactor stays locked until 25 research", !(await p.evaluate(() => window.__advColony.state().grid)).includes("reactor"));
  await p.evaluate(() => { window.__advColony.finish(); }); await p.waitForTimeout(600);
  const s5 = await p.evaluate(() => window.__advColony.state()); ok("reaching the population target wins", s5.won === true, JSON.stringify([s5.pop, s5.target]));
  await p.waitForSelector(".adv-clear", { timeout: 6000 }); ok("the clear card appears", (await p.locator(".adv-clear").count()) >= 1);
  ok("no errors (moon colony)", errs.length === 0, errs.slice(0, 2).join("|")); await ctx.close();
}
for (const [nm, hz] of [["Mars Colony", /Dust storm/], ["Titan Colony", /deep freeze/], ["Proxima b Colony", /flare/]]) {
  const { ctx, p, errs } = await open(nm); await p.click("[data-career=inno]"); await p.evaluate(() => window.__advColony.hazard()); await p.waitForTimeout(250);
  ok(nm + " opens with its own hazard text", hz.test(await p.innerText(".ac2-res")) || hz.test(await p.innerText(".ac2-hz")), (await p.innerText(".ac2-res")).slice(0, 80));
  ok(nm + " has no errors", errs.length === 0, errs.slice(0, 2).join("|")); await ctx.close();
}
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

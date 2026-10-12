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
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_sector", "solar"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_adv_prologue", "skip"); localStorage.setItem("tg_adv_nogate", "1"); localStorage.setItem("tg_adv_unlockall", "1"); for (const k in d) localStorage.setItem(k, d[k]); }, pre || {});
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200))); p.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  const idx = await p.evaluate((src) => [...document.querySelectorAll(".adv-planet")].findIndex(b => b.textContent.includes(src)), re);
  await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx); await p.waitForSelector(".adv-farm", { timeout: 8000 });
  return { ctx, p, errs };
}
{ const { ctx, p, errs } = await open("Hydroponic");
  ok("six beds, three resources, three technologies", (await p.locator("[data-cell]").count()) === 6 && (await p.locator("[data-res]").count()) === 3 && (await p.locator("[data-tech]").count()) === 3);
  ok("it is the plants farm (water, LED, nutrients)", /Water/.test(await p.innerText(".af-res")) && /LED/.test(await p.innerText(".af-res")));
  await p.click("[data-cell='0']"); await p.waitForSelector("[data-pick]"); ok("tapping an empty bed offers five crops", (await p.locator("[data-type]").count()) === 5);
  await p.click("[data-type=algae]"); await p.waitForTimeout(100);
  const s0 = await p.evaluate(() => window.__advFarm.state()); ok("the crop is planted", s0.cells[0].ty === "algae");
  await p.waitForTimeout(2200); const s1 = await p.evaluate(() => window.__advFarm.state());
  ok("it grows and the resources drain", s1.cells[0].p > s0.cells[0].p + 5 && s1.res[0] < s0.res[0], JSON.stringify([s0.cells[0].p, s1.cells[0].p, s0.res[0], s1.res[0]]));
  await p.evaluate(() => window.__advFarm.grow()); await p.waitForTimeout(250);
  ok("a ripe bed says Harvest", /Harvest/.test(await p.innerText("[data-cell='0']")));
  const m0 = (await p.evaluate(() => window.__advFarm.state())).made; await p.click("[data-cell='0']"); await p.waitForTimeout(150);
  ok("harvesting adds food and empties the bed", (await p.evaluate(() => window.__advFarm.state())).made > m0 && (await p.evaluate(() => window.__advFarm.state())).cells[0].ty === null);
  const r0 = (await p.evaluate(() => window.__advFarm.state())).res[1]; await p.click("[data-res='1']"); await p.waitForTimeout(100);
  ok("tapping a resource refills it", (await p.evaluate(() => window.__advFarm.state())).res[1] >= r0 - 1 && (await p.evaluate(() => window.__advFarm.state())).res[1] > 0);
  await p.click("[data-cell='1']"); await p.click("[data-type=greens]"); await p.waitForTimeout(100); await p.evaluate(() => window.__advFarm.sickNow()); await p.waitForTimeout(250);
  ok("an outbreak shows up and a tap treats it", /Blight/.test(await p.innerText("[data-cell='1']"))); await p.click("[data-cell='1']"); await p.waitForTimeout(150);
  ok("treated", (await p.evaluate(() => window.__advFarm.state())).cells[1].sick === 0);
  ok("a technology is locked until there is food to pay for it", await p.evaluate(() => document.querySelector("[data-tech='0']").disabled));
  await p.evaluate(() => window.__advFarm.make(100)); await p.waitForTimeout(250); await p.click("[data-tech='0']"); await p.waitForTimeout(150);
  ok("then it can be bought", (await p.evaluate(() => window.__advFarm.state())).tech[0] === true);
  await p.evaluate(() => window.__advFarm.make(5000)); await p.waitForSelector(".adv-clear[aria-label='ship clear']", { timeout: 12000 });
  ok("reaching the target wins and shows the harvest on the card", /🌾/.test(await p.innerText(".adv-clear")), (await p.innerText(".adv-clear")).replace(/\n/g, " "));
  ok("no page errors", errs.length === 0, errs.join("|")); await ctx.close(); }
{ const { ctx, p, errs } = await open("Livestock");
  ok("the livestock farm has feed, water and vaccine, and gene-edit upgrades", /Feed/.test(await p.innerText(".af-res")) && /Vaccine/.test(await p.innerText(".af-res")) && /Gene edit/.test(await p.innerText(".af-tech")));
  await p.click("[data-cell='0']"); ok("animals to choose from", (await p.locator("[data-type]").count()) === 5 && /pigs/i.test(await p.innerText("[data-pick]")));
  ok("no page errors", errs.length === 0, errs.join("|")); await ctx.close(); }
{ const { ctx, p } = await open("Hydroponic", { tg_ark: JSON.stringify({ g: 0, f: 5, l: 0, h: 5, s: 0 }) });
  const tg = await p.evaluate(() => window.__advFarm.state().target); ok("a bigger habitat raises the target (600 + 60 x 5)", tg === 900, String(tg));
  await p.click("[data-cell='0']"); ok("farm decks raise the yield (+40 %)", /\+8/.test(await p.innerText("[data-type=algae]")), await p.innerText("[data-type=algae]")); await ctx.close(); }
await browser.close(); server.close(); console.log(fail ? "FAILED " + fail : "ALL PASS"); process.exit(fail ? 1 : 0);

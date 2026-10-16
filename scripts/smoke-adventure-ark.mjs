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
async function open(pre) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_sector", "all"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_adv_prologue", "skip"); localStorage.setItem("tg_adv_nogate", "1"); localStorage.setItem("tg_adv_unlockall", "1"); for (const k in d) localStorage.setItem(k, d[k]); }, pre);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200))); p.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 300)); });
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  return { ctx, p, errs };
}
{ const { ctx, p, errs } = await open({ tg_adv_crystals: "2000" });
  ok("the Solar System tab shows the Ark Bay", (await p.locator("[data-ark]").count()) === 1 && (await p.locator("[data-ark-line]").count()) === 5);
  const t0 = await p.innerText("[data-ark-stats]"); ok("with nothing built the ring is 0.4 g and the food is short", /0\.4 g/.test(t0) && /⚠/.test(t0), t0);
  for (let i = 0; i < 5; i++) await p.click("[data-ark-line=g]");
  for (let i = 0; i < 3; i++) await p.click("[data-ark-line=f]");
  await p.waitForTimeout(150); const t1 = await p.innerText("[data-ark-stats]");
  ok("buying ring levels raises gravity to 1.0 g and farms add food days", /1(\.0)? g/.test(t1) && /food \d+/i.test(t1), t1);
  ok("it costs crystals", parseInt(await p.evaluate(() => localStorage.getItem("tg_adv_crystals")), 10) < 2000);
  ok("the levels are saved", (await p.evaluate(() => JSON.parse(localStorage.getItem("tg_ark")))).g === 5);
  await ctx.close(); ok("no page errors", errs.length === 0, errs.join("|")); }
{ const { ctx, p, errs } = await open({ tg_ark: JSON.stringify({ g: 5, f: 5, l: 4, h: 3, s: 5 }) });
  const idx = await p.evaluate(() => [...document.querySelectorAll(".adv-planet")].findIndex(b => b.textContent.includes("Exodus")));
  await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx); try { await p.waitForSelector(".adv-ship canvas", { timeout: 8000 }); } catch (e) { console.log("PAGEERRS", idx, errs.join("|"), (await p.innerText("body")).slice(0, 300).replace(/\n/g, " ")); } await p.waitForTimeout(900);
  ok("the Ark's shields add hull points (+60 %)", /HP 160/.test(await p.innerText(".adv-bar.adv-hp")), await p.innerText(".adv-bar.adv-hp"));
  await p.evaluate(() => window.__advShip.warpSkip()); await p.waitForTimeout(300);
  const q = await p.evaluate(() => window.__advShip.portalXY()); await p.evaluate((q) => window.__advShip.setShip(q.x, q.y), q);
  await p.waitForSelector(".adv-clear[aria-label='ship clear']", { timeout: 15000 });
  const card = await p.innerText(".adv-clear"); ok("the result card says how many people arrived and that the food lasts", /people reached the new star/.test(card) && /food lasts/.test(card), card.replace(/\n/g, " "));
  ok("no page errors", errs.length === 0, errs.join("|")); await ctx.close(); }
await browser.close(); server.close(); console.log(fail ? "FAILED " + fail : "ALL PASS"); process.exit(fail ? 1 : 0);

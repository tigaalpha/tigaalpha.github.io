// Adventure weapons (owner, 2026-10-12): weapons drop from monsters, are picked up and equipped, and each one fires in its own way.
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
// First-person view (owner, 2026-10-12): a button in the top right of every Adventure screen switches it, and it persists.
async function open(sector, re) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((sec) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_adv_prologue", "skip"); localStorage.setItem("tg_adv_unlockall", "1"); localStorage.setItem("tg_adv_nogate", "1"); if (sec) localStorage.setItem("tg_adv_sector", sec); }, sector);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  const idx = await p.evaluate((src) => [...document.querySelectorAll(".adv-planet")].findIndex(b => new RegExp(src).test(b.textContent)), re);
  await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx);
  return { ctx, p, errs, idx };
}
const flip = (p) => p.evaluate(() => document.querySelector("[data-fpv-btn]").click());
const on = (p) => p.evaluate(() => document.querySelector("[data-fpv-btn]").getAttribute("aria-pressed") === "true");
{ const { ctx, p, errs } = await open("", "Luma"); await p.waitForSelector(".adv canvas"); await p.waitForTimeout(1200);
  ok("a ground map has the FPV button in the top right (beside the gear)", await p.evaluate(() => { const b = document.querySelector("[data-fpv-btn]"), g = document.querySelector(".adv-gear"); return !!b && !!g && b.getBoundingClientRect().right <= g.getBoundingClientRect().left + 1 && b.getBoundingClientRect().top < 60; }));
  ok("it starts off", !(await on(p)) && (await p.locator("[data-fpv=hands]").count()) === 0);
  await flip(p); await p.waitForTimeout(500);
  ok("switching on shows the hands, the reticle and the visor", (await on(p)) && (await p.locator("[data-fpv=hands]").count()) === 1 && (await p.locator(".fpv-xh").count()) === 1 && (await p.locator("[data-fpv=visor]").count()) === 1);
  ok("the hero's own body is hidden and the world is zoomed", await p.evaluate(() => { const hero = document.querySelector(".adv-px:nth-of-type(2), .adv-world ~ .adv-px, .adv-px"); const w = document.querySelector(".adv-world"); return /scale\(1\.3/.test(w.style.transform); }));
  ok("the choice is remembered", (await p.evaluate(() => localStorage.getItem("tg_fpv"))) === "1");
  await flip(p); await p.waitForTimeout(300);
  ok("switching off puts everything back", !(await on(p)) && (await p.locator("[data-fpv=hands]").count()) === 0 && (await p.evaluate(() => document.querySelector(".adv-world").style.transform)) === "");
  ok("no page errors (ground)", errs.length === 0, errs.join("|")); await ctx.close(); }
{ const { ctx, p, errs } = await open("space", "Void Gate"); await p.waitForFunction(() => !!window.__advShip, null, { timeout: 10000 }); await p.waitForTimeout(600);
  ok("a ship map has the button", (await p.locator("[data-fpv-btn]").count()) === 1);
  await p.evaluate(() => localStorage.setItem("tg_fpv", "0")); await flip(p); await p.waitForTimeout(400);
  ok("first person in a ship = a cockpit", (await p.locator("[data-fpv=cockpit]").count()) === 1);
  await p.waitForTimeout(600); ok("no page errors (ship)", errs.length === 0, errs.join("|")); await ctx.close(); }
{ const { ctx, p, errs } = await open("solar", "Hydroponic"); await p.waitForSelector(".adv-farm", { timeout: 8000 });
  ok("the farm has the button", (await p.locator("[data-fpv-btn]").count()) === 1);
  await p.evaluate(() => localStorage.setItem("tg_fpv", "0")); await flip(p); await p.waitForTimeout(300);
  ok("the farm gets a visor", (await p.locator("[data-fpv=visor]").count()) === 1);
  ok("no page errors (farm)", errs.length === 0, errs.join("|")); await ctx.close(); }
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

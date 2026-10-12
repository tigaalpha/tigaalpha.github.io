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
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_sector", "solar"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_adv_prologue", "skip"); localStorage.setItem("tg_adv_nogate", "1"); for (const k in d) localStorage.setItem(k, d[k]); }, pre);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  return { ctx, p, errs };
}
{ const { ctx, p } = await open({});
  ok("four tabs, the fourth is the Solar System", (await p.locator("[data-sector]").count()) === 4 && (await p.locator("[data-sector=solar]").count()) === 1);
  const n = await p.locator(".adv-planet").count(); ok("thirteen maps in Sector 4", n === 13, String(n));
  const lk = await p.evaluate(() => [...document.querySelectorAll(".adv-planet")].map(b => b.classList.contains("lock")));
  ok("locked one step at a time: only the Moon is open", lk[0] === false && lk.slice(1).every(Boolean), JSON.stringify(lk));
  const names = await p.evaluate(() => [...document.querySelectorAll(".adv-planet b")].map(b => b.textContent));
  ok("Moon, lunar base, Mars, Mercury, Venus, Jupiter, Saturn, Titan x2, Ark x4 in order", /Moon/.test(names[0]) && /Lunar/.test(names[1]) && /Mars/.test(names[2]) && /Mercury/.test(names[3]) && /Venus/.test(names[4]) && /Jupiter/.test(names[5]) && /Saturn/.test(names[6]) && /Titan/.test(names[7]) && /Titan/.test(names[8]) && /Ark|Shipyard/.test(names[9]) && /Hydroponic/.test(names[10]) && /Livestock/.test(names[11]) && /Exodus/.test(names[12]), names.join(" | "));
  await ctx.close(); }
const MAPS = [["Moon ·", false], ["Lunar Base", false], ["Mars ·", false], ["Mercury", false], ["Venus", true], ["Jupiter", true], ["Saturn", true], ["Titan · storm", false], ["Titan · the second", false], ["Shipyard", false], ["Hydroponic", false], ["Livestock", false], ["Exodus", true]];
for (const [re, ship] of MAPS) {
  const { ctx, p, errs } = await open({ tg_adv_unlockall: "1" });
  const idx = await p.evaluate((src) => [...document.querySelectorAll(".adv-planet")].findIndex(b => b.textContent.includes(src)), re);
  if (idx < 0) { ok(re + ": on the menu", false); await ctx.close(); continue; }
  await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx);
  await p.waitForSelector(ship ? ".adv-ship canvas" : (re === "Hydroponic" || re === "Livestock") ? ".adv-farm" : ".adv canvas", { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(1800);
  ok(re + ": opens and runs without errors", (await p.locator(ship ? ".adv-ship canvas" : (re === "Hydroponic" || re === "Livestock") ? ".adv-farm" : ".adv canvas").count()) >= 1 && errs.length === 0, errs.join("|"));
  if (re === "Exodus") ok("Exodus is a warp run flown by the Ark", (await p.evaluate(() => window.__advShip.mode)) === "warp");
  await ctx.close();
}
await browser.close(); server.close(); console.log(fail ? "FAILED " + fail : "ALL PASS"); process.exit(fail ? 1 : 0);

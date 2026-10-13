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
// Energy carried between maps: the menu shows it; step n opens when step n-1 is cleared; a tier-3 admin (or the test switch) is never locked.
async function open(pre, admin) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_adv_prologue", "skip"); for (const k in d) localStorage.setItem(k, d[k]); }, pre);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  return { ctx, p, errs };
}
{ const { ctx, p, errs } = await open({ tg_adv_unlockall: "1", tg_adv_energy: "60" });
  const t = await p.evaluate(() => document.querySelector("[data-energy]")?.textContent || "");
  ok("menu shows energy 60/100 with the +25% hint", /60\/100/.test(t) && /25%/.test(t), t);
  await ctx.close(); ok("no page errors", errs.length === 0, errs.join("|")); }
{ const { ctx, p } = await open({ tg_adv_unlockall: "1", tg_adv_energy: "10" });
  const t = await p.evaluate(() => document.querySelector("[data-energy]")?.textContent || "");
  ok("below 50 there is no boost hint", /10\/100/.test(t) && !/25%/.test(t), t); await ctx.close(); }
{ const { ctx, p } = await open({ tg_adv_unlockall: "1", tg_adv_done: JSON.stringify(["luma"]) });
  await p.click("[data-galaxy-btn]"); const n = await p.evaluate(() => document.querySelectorAll("[data-gnode]").length);
  ok("galaxy map shows five sectors", n === 5, String(n));
  await p.evaluate(() => document.querySelector("[data-gnode=solar]").dispatchEvent(new MouseEvent("click", { bubbles: true }))); await p.waitForTimeout(200);
  ok("tapping a node opens that sector", await p.evaluate(() => document.querySelector("[data-sector=solar]").getAttribute("aria-selected") === "true")); await ctx.close(); }
await browser.close(); server.close(); console.log(fail ? "FAILED " + fail : "ALL PASS"); process.exit(fail ? 1 : 0);

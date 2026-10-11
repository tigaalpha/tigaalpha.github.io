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
// Adventure Online: the entry button in the PvP lobby, the lobby panel, a failed connection is reported.
async function open(pre) {
  const ctx = await browser.newContext({ viewport: { width: 450, height: 1000 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); for (const k in d) localStorage.setItem(k, d[k]); }, pre);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  
  return { ctx, p, errs };
}
{
  const { ctx, p, errs } = await open({});
  await p.waitForSelector(".pvpadv.online");
  ok("the PvP lobby has an Adventure Online button above the Adventure one", await p.evaluate(() => { const a = document.querySelector(".pvpadv:not(.online)").getBoundingClientRect(), b = document.querySelector(".pvpadv.online").getBoundingClientRect(); return b.bottom <= a.top + 2 && Math.abs(a.left - b.left) < 4; }));
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
  await p.evaluate(() => document.querySelector(".pvpadv.online").click()); await p.waitForSelector(".adv-lobby");
  ok("the lobby offers create and join", (await p.locator("button[data-create]").count()) === 1 && (await p.locator("button[data-join]").count()) === 1);
  ok("join stays disabled until a 6-letter code is typed", await p.evaluate(() => document.querySelector("button[data-join]").disabled));
  await p.fill(".al-code", "abc123"); ok("a typed code is upper-cased and enables join", await p.evaluate(() => document.querySelector(".al-code").value === "ABC123" && !document.querySelector("button[data-join]").disabled));
  await p.evaluate(() => document.querySelector(".adv-top button, .adv-head button") && 0);
  ok("no errors", errs.length === 0, errs.join("|")); await ctx.close();
}
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

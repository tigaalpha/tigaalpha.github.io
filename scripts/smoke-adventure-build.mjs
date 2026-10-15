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
  await ctx.addInitScript(() => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_sector", "colony"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine", "1"); localStorage.setItem("tg_adv_prologue", "skip"); localStorage.setItem("tg_adv_nogate", "1"); localStorage.setItem("tg_adv_unlockall", "1"); });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200))); p.on("console", m => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 200)); });
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  const idx = await p.evaluate((src) => [...document.querySelectorAll(".adv-planet")].findIndex(b => b.textContent.includes(src)), re);
  await p.evaluate((i) => document.querySelectorAll(".adv-planet")[i].click(), idx); await p.waitForSelector(".adv-build", { timeout: 8000 });
  return { ctx, p, errs };
}
const st = (p) => p.evaluate(() => window.__advBuild.state());
for (const [nm, kind, N] of [["Colony Starship", "ship", 3], ["Dyson Sphere", "dyson", 3], ["Jupiter Gas Base", "gas", 3], ["Asteroid Mining Base", "mine", 3]]) {
  const { ctx, p, errs } = await open(nm);
  const s0 = await st(p); ok(nm + ": opens with a music question and no parts built", s0.kind === kind && s0.N === N && s0.built === 0 && s0.phase === "ask" && (await p.locator("[data-opt]").count()) >= 2, JSON.stringify(s0));
  ok(nm + ": the robot crew is shown and says it needs an answer", (await p.locator(".ab-r").count()) === 4 && /answer/i.test(await p.innerText(".ab-say")));
  if (kind === "ship") {
    await p.evaluate(() => window.__advBuild.answerWrong()); await p.waitForTimeout(150);
    ok("a wrong answer teaches (the explanation appears) and does not build", (await p.locator("[data-teach]").count()) === 1 && (await st(p)).built === 0 && (await st(p)).miss === 1);
    await p.click("[data-again]"); await p.waitForTimeout(150); ok("then a new question is asked", (await st(p)).phase === "ask");
  }
  await p.evaluate(() => window.__advBuild.answerRight()); await p.waitForTimeout(150);
  const s1 = await st(p); ok(nm + ": a right answer starts the robots building", s1.phase === "build" && s1.right >= 1, JSON.stringify(s1));
  await p.evaluate(() => window.__advBuild.tick(4)); await p.waitForTimeout(250); const s2 = await st(p);
  ok(nm + ": the part is finished and the next question comes", s2.built === 1 && s2.phase === "ask", JSON.stringify(s2));
  for (let i = 1; i < N; i++) { await p.evaluate(() => { window.__advBuild.answerRight(); window.__advBuild.tick(4); }); await p.waitForTimeout(60); }
  await p.waitForTimeout(400); const s3 = await st(p); ok(nm + ": all " + N + " parts built wins", s3.built === N && s3.won, JSON.stringify(s3));
  await p.waitForSelector(".adv-clear", { timeout: 6000 }); ok(nm + ": the clear card shows what was learned", /learned|notebook/i.test(await p.innerText(".adv-clear")));
  ok(nm + ": no errors", errs.length === 0, errs.slice(0, 2).join("|")); await ctx.close();
}
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

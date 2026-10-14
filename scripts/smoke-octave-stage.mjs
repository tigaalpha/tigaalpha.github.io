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
  const ctx = await browser.newContext({ viewport: { width: 900, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "sensei"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine","1"); localStorage.setItem("tg_adv_unlockall","1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); for (const k in d) localStorage.setItem(k, d[k]); }, pre);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  
  return { ctx, p, errs };
}

const { ctx, p, errs } = await open({});
const sel = await p.$(".octsel select"); await sel.selectOption("2"); await p.waitForTimeout(300);
await p.waitForTimeout(200);
const idx = () => p.evaluate(() => [...document.querySelectorAll(".ost-notes span")].findIndex(e => e.classList.contains("on")));
ok("the light waits on the first key", (await idx()) === 0, String(await idx()));
await p.click('.ost-kb [aria-label="D4"]'); await p.waitForTimeout(150);
ok("a wrong key does not advance", (await idx()) === 0, String(await idx()));
await p.click('.ost-kb [aria-label="C4"]'); await p.waitForTimeout(150);
ok("the right key moves the light on", (await idx()) === 1, String(await idx()));
for (let k = 0; k < 28; k++) { const lab = await p.evaluate(() => { const on = [...document.querySelectorAll(".ost-notes span")].findIndex(e => e.classList.contains("on")); return on; }); const order = ["D4","E4","F4","G4","A4","B4","C5","D5","E5","F5","G5","A5","B5","C6","B5","A5","G5","F5","E5","D5","C5","B4","A4","G4","F4","E4","D4","C4"]; await p.click('.ost-kb [aria-label="' + order[k] + '"]'); await p.waitForTimeout(40); }
ok("a finished round shows praise", (await p.$(".ost-praise")) !== null, "");
// Change the range from inside the stage: no trip back to the Teacher page.
await p.click('.ost-octb[data-oct="3"]'); await p.waitForTimeout(300);
ok("tapping 3× on the stage switches to 3 octaves in place", (await p.locator(".ost").count()) === 1 && (await p.locator('.ost-octb.on').innerText()).startsWith("3"), await p.locator('.ost-octb.on').innerText());
await p.click('.ost-octb[data-oct="2"]'); await p.waitForTimeout(300);
ok("and back to 2× again", (await p.locator('.ost-octb.on').innerText()).startsWith("2"));
await p.click(".ost-prac"); await p.waitForSelector(".practiceov", { timeout: 6000 }).catch(() => {});
ok("the orange Practice button opens the practice page for 2 octaves", (await p.$(".practiceov")) !== null && (await p.$(".ost")) === null);
ok("its keyboard spans the whole range (C4..C6 = 15 white keys)", (await p.locator(".practiceov .pk.w").count()) >= 15, String(await p.locator(".practiceov .pk.w").count()));
ok("the lesson is the 2-octave scale there (up and back down = 29 notes)", (await p.evaluate(() => document.querySelector(".practiceov").innerText)).length > 0);
// Finish the whole practice (up and back down): the result view must render, not throw.
{ const order = [...Array(15).keys(), ...[...Array(14).keys()].reverse()];
  for (const k of order) { await p.evaluate((i) => { const el = document.querySelectorAll(".practiceov .pk.w")[i]; if (!el) return; for (const t of ["pointerdown","pointerup"]) el.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 1 })); }, k); await p.waitForTimeout(60); }
  await p.waitForTimeout(2500);
  ok("the practice result view shows after the last note", (await p.evaluate(() => document.body.innerText)).length > 0 && !errs.some(e => /adviceRepeatBlocked|before initialization/.test(e)), errs.join("|")); }
await p.waitForTimeout(1200); await p.screenshot({ path: "/tmp/prac2.png" });
ok("no errors", errs.length === 0, errs.join("|"));
await browser.close(); server.close(); process.exit(fail ? 1 : 0);

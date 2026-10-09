// Plan 28 phase A layout bot: Practice Mode fits one screen, nothing covers a primary button,
// no horizontal scroll, one hand toggle. Needs Playwright + Chromium and a built dist/.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href);
const pw = pwm.chromium ? pwm : (pwm.default || pwm);
const ROOT = path.resolve("dist");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end("nf"); return; } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
let browser;
try { browser = await pw.chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" }); } catch (e) { console.log("this check did NOT run:", e.message.slice(0, 100)); process.exit(1); }
const SIZES = [[320, 568], [360, 640], [390, 844], [430, 932]];
const LANGS = (process.env.LANGS || "th,en,zh").split(","); const fails = []; let n = 0;
for (const [w, h] of SIZES) for (const lang of LANGS) for (const kid of [false, true]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript(({ lang, kid }) => {
    sessionStorage.setItem("tiga_page", "pathway");
    localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang, age: kid ? 6 : "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", lang);
    localStorage.setItem("tg_kid", kid ? "1" : "0");
    for (const k of ["tg_orient_hint_seen", "tg_pa_intro"]) localStorage.setItem(k, "1");
    localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", '{"firstCoins":1,"chest":1,"pet":1,"shop":1,"rich":1,"shopIntro":1}');
    const gi = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return k === "tg_guest_ms" ? "0" : gi.call(this, k); };
  }, { lang, kid });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 100)));
  const tag = `${w}x${h} ${lang} ${kid ? "kid" : "adult"}`;
  try {
    await p.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" }); await p.waitForTimeout(2000);
    for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
    await p.waitForSelector(".pcard", { timeout: 8000 }); await p.click(".pcard"); await p.waitForTimeout(900);
    await p.locator(".keybtn").first().click({ timeout: 4000 }).catch(() => {});
    await p.waitForTimeout(500);
    const chips = p.locator("text=/Natural|ธรรมชาติ|自然/").first();
    if (await chips.count()) await chips.click().catch(() => {});
    await p.waitForTimeout(400); await p.locator(".keybtn").first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(1800);
    const handBtns = await p.locator(".handbtn").count();
    if (handBtns !== 1) fails.push(`${tag}: expected 1 hand button on teacher page, got ${handBtns}`);
    await p.click(".practicebtn", { timeout: 4000 }); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => {
      const q = s => document.querySelector(s); const rect = e => e && e.getBoundingClientRect();
      const out = { hscroll: document.documentElement.scrollWidth > innerWidth + 1, hands: document.querySelectorAll(".practiceov .handbtn").length };
      const foot = rect(q(".practicefoot")), stats = rect(q(".practicestats")), body = q(".practicebody");
      out.statsVisible = !!stats && !!foot && stats.bottom <= foot.top + 1 && stats.top >= 0;
      out.bodyScrolls = body ? body.scrollHeight - body.clientHeight : -1;
      out.covered = [...document.querySelectorAll(".practicefoot button, .handtoggle")].filter(b => { const c = rect(b); const t = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2); return !(t && (t === b || b.contains(t))); }).length;
      return out;
    });
    if (r.hscroll) fails.push(`${tag}: horizontal scroll`);
    if (r.hands !== 1) fails.push(`${tag}: ${r.hands} hand buttons in practice`);
    if (!r.statsVisible) fails.push(`${tag}: "✓ n / N" row not fully visible`);
    if (r.covered) fails.push(`${tag}: ${r.covered} primary buttons covered`);
    if (errs.length) fails.push(`${tag}: page errors ${errs.join("|")}`);
    if (r.bodyScrolls > 2 && h >= 640) console.log(`note ${tag}: practice body scrolls by ${r.bodyScrolls}px`);
    n++;
  } catch (e) { fails.push(`${tag}: ${e.message.split("\n")[0].slice(0, 120)}`); }
  await ctx.close();
}
await browser.close(); server.close();
console.log(`${n} combinations ran; ${fails.length} failures`); fails.forEach(f => console.log("FAIL", f)); process.exit(fails.length ? 1 : 0);

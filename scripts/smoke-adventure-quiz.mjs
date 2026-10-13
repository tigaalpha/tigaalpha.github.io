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
async function run(done, label) {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
  await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await ctx.addInitScript((d) => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_path_done", JSON.stringify(d)); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_adv_nocine","1"); localStorage.setItem("tg_adv_unlockall","1"); localStorage.setItem("tg_adv_nogate","1"); localStorage.setItem("tg_3d_tier", "0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); }, done);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
  await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
  for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
  await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
  await p.evaluate(() => document.querySelector(".adv-planet").click()); await p.waitForSelector(".adv canvas"); await p.waitForTimeout(600);
  const asked = [];
  const WH = { 0: 0, 2: 1, 4: 2, 5: 3, 7: 4, 9: 5, 11: 6 }, BL = { 1: 0, 3: 1, 6: 2, 8: 3, 10: 4 };
  const tapPc = async (pc) => { const idx = pc in WH ? WH[pc] : 14 + BL[pc]; await p.evaluate((i) => { const el = document.querySelectorAll(".adv-quiz .pk")[i]; el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 })); el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 })); }, idx); await p.waitForTimeout(80); };
  for (let n = 0; n < 2; n++) {
    await p.evaluate((x) => window.__advTest.tp(x), n === 0 ? 1300 : 2650); await p.waitForSelector(".adv-quiz", { timeout: 4000 });
    ok(label + ": beacon " + (n + 1) + " opens the question card", true);
    const count = await p.evaluate(() => window.__advQuiz.qs.length); ok(label + ": exactly ONE question per beacon (owner rule)", count === 1, "qs " + count);
    const q = await p.evaluate(() => { const z = window.__advQuiz; const c = z.qs[z.i].q; return { topic: c.topic, tier: c.tier, kind: c.kind, ans: c.ans, opts: c.opts, text: c.q }; });
    asked.push(q); const wrong = n === 0;      // the first one is answered wrong on purpose
    if (q.kind === "choice") { const idx = q.opts.findIndex(o => o.ok === !wrong); await p.locator(".adv-qopt").nth(idx).click({ force: true }); }
    else if (q.kind === "key") { const pc = wrong ? [0,1,2,3,4,5,6,7,8,9,10,11].find(x => !q.ans.includes(x)) : q.ans[0]; await tapPc(pc); }
    else { const set = wrong ? [q.ans[0]] : q.ans; for (const pc of set) await tapPc(pc); await p.locator(".adv-qgo").click({ force: true }); }
    await p.waitForSelector(".adv-qres", { timeout: 3000 });
    await p.waitForTimeout(700);   // the answer keys light one at a time, lowest first
    const res = await p.evaluate(() => ({ cls: document.querySelector(".adv-qres").className, lit: document.querySelectorAll(".adv-quiz .pk.lit").length, why: document.querySelector(".adv-qres").innerText.length }));
    if (wrong && process.env.SHOT) await p.screenshot({ path: process.env.SHOT });
    if (wrong) ok(label + ": a wrong answer teaches (keys lit on the piano + a reason)", /bad/.test(res.cls) && res.lit >= 1 && res.why > 20, JSON.stringify(res));
    else ok(label + ": a right answer is marked right", /good/.test(res.cls));
    await p.locator(".adv-qgo").last().click({ force: true }); await p.waitForTimeout(350);
    ok(label + ": the card closes after that one question", (await p.locator(".adv-quiz").count()) === 0);
  }
  await p.waitForTimeout(300);
  ok(label + ": the card closes and the game goes on", (await p.locator(".adv-quiz").count()) === 0);
  const ladder = await p.evaluate(() => JSON.parse(localStorage.getItem("tg_adv_quiz") || "{}"));
  ok(label + ": the ladder and the weak-topic memory were written", !!ladder.lvl && !!(await p.evaluate(() => localStorage.getItem("tg_adv_weak"))));
  ok(label + ": no errors", errs.length === 0, errs.join("|"));
  await ctx.close(); return asked;
}
const a = await run(["scale"], "scale learner"); const b = await run(["triad", "interval"], "chord learner");
ok("only studied topics were asked (scale learner)", a.every(q => q.topic === "scale"), a.map(q => q.topic).join());
ok("only studied topics were asked (chord learner)", b.every(q => q.topic === "triad" || q.topic === "interval"), b.map(q => q.topic).join());
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

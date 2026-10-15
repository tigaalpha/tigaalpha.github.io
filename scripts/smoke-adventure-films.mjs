// Adventure Mode: a knowledge beacon asks questions from what THIS learner has studied, climbs, and a wrong answer teaches on the piano.
// Adventure films (owner, 2026-10-12): every map gets 5-10 shots with a story and a mood; maps about gathering resources have no alien in them; nothing throws while a film plays.
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
async function film(SEC, IDX, LANG) {
const ctx = await browser.newContext({ viewport: { width: 800, height: 420 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await ctx.addInitScript(([SEC]) => { localStorage.setItem("__sec", SEC); localStorage.setItem("tg_adv_unlockall","1"); sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_sector", localStorage.getItem("__sec")||"ground"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 }));  localStorage.setItem("tg_adv_prologue","1");  localStorage.setItem("tg_lang","th"); localStorage.setItem("tg_3d_tier","0"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); }, [SEC]);
await ctx.addInitScript(([L]) => { localStorage.setItem("tg_lang", L); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: L, age: "adult", level: "beginner", exp: 5000 })); }, [LANG]);
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 160)));
await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
for (let i=0;i<3;i++){const x=await p.$(".atpopup button"); if(!x)break; await x.click().catch(()=>{}); await p.waitForTimeout(200);}


await p.evaluate(() => document.querySelector(".pvpadv").click()); await p.waitForSelector(".adv-planet");
await p.locator(".adv-planet").nth(IDX).click(); await p.waitForTimeout(1200);
const kinds = await p.evaluate(() => window.__advCine.kinds()); const caps = [];
for (let i = 0; i < kinds.length - 1; i++) { await p.evaluate((n) => window.__advCine.jump(n), i); await p.waitForTimeout(700); caps.push(await p.locator(".ac-cap").first().innerText().catch(() => "")); }
await ctx.close(); return { kinds, caps, errs };
}
const wantScript = { th: /[\u0E00-\u0E7F]/, zh: /[\u4E00-\u9FFF]/, en: /^[\x00-\x7F\u2019\u2014]+$/ };
for (const [name, sec, idx, must, never] of [["luma (a fight map)", "ground", 0, ["descent", "landing", "crew", "warning"], []], ["cobalt (mining)", "ground", 6, ["survey", "work", "storm", "signal", "dawn"], ["warning", "boss"]], ["void gate (a ship map)", "space", 0, ["survey", "crew", "warning", "signal"], ["descent", "landing"]], ["under the harvesters' eye", "act2", 2, ["survey", "crew", "warning"], ["descent"]]]) {
  const r = await film(sec, idx, "en");
  ok(name + ": 20 to 30 shots", r.kinds.length >= 20 && r.kinds.length <= 30, r.kinds.join());
  ok(name + ": the sequence has " + must.join(", "), must.every(k => r.kinds.includes(k)));
  ok(name + ": and none of " + (never.join(", ") || "-"), never.every(k => !r.kinds.includes(k)));
  ok(name + ": every shot has its own subtitle", r.caps.every(c => c.length > 15) && new Set(r.caps).size === r.caps.length, r.caps.map(c => c.slice(0, 18)).join("|"));
  ok(name + ": nothing throws while it plays", r.errs.length === 0, r.errs.join("|"));
}
for (const lg of ["th", "zh"]) { const r = await film("ground", 6, lg); ok("cobalt in " + lg + ": the new shots are written in that language", r.caps.length > 5 && r.caps.every(c => wantScript[lg].test(c)), r.caps.map(c => c.slice(0, 14)).join("|")); ok("cobalt in " + lg + ": no errors", r.errs.length === 0, r.errs.join("|")); }
await browser.close(); server.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

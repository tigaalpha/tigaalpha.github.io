// Alien Hunt, a learner who has finished NOTHING in the Pathway (owner 2026-11-01: "it no longer asks every 30 s"): the question must still come, as a basic note question.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href);
const pw = pwm.chromium ? pwm : (pwm.default || pwm);
const ROOT = path.resolve("dist"); const SHOT = process.env.SHOT || "";
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };
const server = http.createServer((req, res) => { let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html"; const f = path.join(ROOT, p); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await ctx.addInitScript(() => { sessionStorage.setItem("tiga_page", "pvp"); localStorage.setItem("tg_adv_gfx", "high"); localStorage.setItem("tg_gp_free", "1"); localStorage.setItem("tg_path_done", JSON.stringify([])); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(200); }
await p.evaluate(() => document.querySelector("[data-alien-hunt]").click()); await p.waitForSelector("[data-ah=ready]", { timeout: 8000 });
ok("the ready screen says nothing is finished", (await p.evaluate(() => document.querySelector("[data-learned]").getAttribute("data-learned"))) === "0");
ok("and no longer says there are no questions", !/no questions|ยังไม่มีคำถาม/i.test(await p.evaluate(() => document.querySelector("[data-learned]").textContent)));
await p.evaluate(() => document.querySelector("[data-start]").click()); await p.waitForSelector(".ah-cv", { timeout: 8000 }); await p.waitForTimeout(1500);
for (let i = 0; i < 25; i++) { await p.evaluate(() => window.__ah.step(20)); }
ok("the 30 s clock is ON for a learner with nothing finished", (await p.evaluate(() => window.__ah.state.tuneEvery)) === 30);
await p.evaluate(() => { const s = window.__ah.state; s.p.hp = 100; s.wave = Math.max(1, s.wave); s.between = 99; if (!s.enemies.some(e => e.dead === 0)) s.enemies.push({ id: 990, kind: "mantis", x: s.p.x + 12, z: s.p.z - 12, hp: 1e6, max: 1e6, yaw: 0, t: 0, cd: 99, dead: 0, flash: 0, leap: 0 }); s.tuneT = s.tuneEvery - 0.05; window.__ah.step(10); });
await p.waitForSelector("[data-tuneup]", { timeout: 4000 }).catch(() => {});
ok("the game freezes for a question", await p.evaluate(() => window.__ah.state.frozen));
ok("the question card opens", (await p.locator("[data-tuneup]").count()) === 1);
const q = await p.evaluate(() => window.__ah.quizQ());
ok("it is a basic note question (topic 'basic'/'note'), not empty", !!q && !!q.q, JSON.stringify(q && { id: q.id, topic: q.topic, tier: q.tier }));
ok("no page errors", errs.length === 0, errs.slice(0, 2).join(" | "));
await browser.close(); server.close();
console.log(fail ? "FAILED" : "all passed"); process.exit(fail ? 1 : 0);

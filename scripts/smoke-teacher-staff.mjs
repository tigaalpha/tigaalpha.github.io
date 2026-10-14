// The portrait Teacher page shows the lesson on a five-line staff (two bars) above the keys and follows the lit note.
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
const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.route(u => !/127\.0\.0\.1/.test(u.hostname) && !/supabase\.co/.test(u.hostname), r => r.abort());
await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await ctx.addInitScript(() => { sessionStorage.setItem("tiga_page", "sensei"); localStorage.setItem("tg_test_hook", "1"); localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "en", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", "en"); localStorage.setItem("tg_edu_seen", JSON.stringify({firstCoins:1,chest:1,pet:1,shop:1,rich:1,shopIntro:1})); });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message.slice(0, 200)));
await p.goto("http://127.0.0.1:" + server.address().port + "/", { waitUntil: "load" }); await p.waitForTimeout(2500);
for (let i = 0; i < 3; i++) { const x = await p.$(".atpopup button"); if (!x) break; await x.click().catch(() => {}); await p.waitForTimeout(250); }
ok("no staff before a lesson is on the keys", (await p.locator("[data-tstaff]").count()) === 0);
const names = ["C4","D4","E4","F4","G4","A4","B4","C5"];
await p.evaluate((n) => window.__tgTest.setFingerChart({ label: "C MAJOR SCALE", notes: n.map((x, i) => ({ note: x, finger: [1,2,3,1,2,3,4,5][i] })), mode: "scale", key: null }), names); await p.waitForTimeout(400);
ok("the staff appears above the keys with the lesson", (await p.locator("[data-tstaff] svg").count()) === 1 && (await p.locator("[data-tstaff] svg ellipse").count()) === 8);
const box = await p.evaluate(() => { const a = document.querySelector("[data-tstaff]").getBoundingClientRect(), b = document.querySelector("[data-tstaff]").nextElementSibling.getBoundingClientRect(); return { staffBottom: a.bottom, pianoTop: b.top, w: a.width }; });
ok("it sits above the piano and fits the phone width", box.staffBottom <= box.pianoTop + 2 && box.w <= 412, JSON.stringify(box));
await p.screenshot({ path: "/tmp/tstaff.png" });
ok("no errors", errs.length === 0, errs.join("|"));
await browser.close(); server.close(); process.exit(fail ? 1 : 0);

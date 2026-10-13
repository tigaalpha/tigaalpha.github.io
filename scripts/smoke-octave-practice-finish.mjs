// Left hand, 2/3/4 octaves: play the whole Practice (up and down) and expect no page errors and a result.
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


for (const oct of ["2","3","4"]) {
const { ctx, p, errs } = await open({});
await (await p.$(".octsel select")).selectOption(oct); await p.waitForTimeout(300);
await p.click(".ost-hand:not(.act)"); await p.waitForTimeout(200);
await p.click(".ost-prac"); await p.waitForSelector(".practiceov",{timeout:6000}).catch(()=>{});
const up = oct==="4"?29:oct==="3"?22:15; const order=[...Array(up).keys(),...[...Array(up-1).keys()].reverse()];
for (const k of order) { await p.evaluate((i)=>{const el=document.querySelectorAll(".practiceov .pk.w")[i]; if(!el)return; for(const t of ["pointerdown","pointerup"]) el.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:1}));},k); await p.waitForTimeout(40); }
await p.waitForTimeout(2500);
const txt = await p.evaluate(()=>document.body.innerText);
const counted = await p.evaluate(() => { const st = JSON.parse(localStorage.getItem("tg_streak") || "{}"); const lg = JSON.parse(localStorage.getItem("tg_practice_log") || "{}"); return { streakToday: !!st.last, logDays: Object.keys(lg).filter(k => k[0] === "2").length, coins: Number(localStorage.getItem("tg_coins") || 0) }; });
ok("LEFT hand "+oct+" octaves: counts toward the daily streak, practice log and coins", counted.streakToday && counted.logDays > 0 && counted.coins > 0, JSON.stringify(counted));
ok("LEFT hand "+oct+" octaves: no errors, result shown", errs.length===0 && /100%|%/.test(txt), errs.join("|"));
await ctx.close();
}
await browser.close(); server.close(); process.exit(fail?1:0);

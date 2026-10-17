import fs from "node:fs"; import http from "node:http"; import path from "node:path"; import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); const pw = pwm.chromium ? pwm : pwm.default;
const ROOT = path.resolve("dist"), T = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webp": "image/webp" };
const srv = http.createServer((q, r) => { let u = decodeURIComponent(q.url.split("?")[0]); let fp = path.join(ROOT, u === "/" ? "/index.html" : u); if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { r.writeHead(404); return r.end("nf"); } r.writeHead(200, { "Content-Type": T[path.extname(fp)] || "application/octet-stream" }); r.end(fs.readFileSync(fp)); });
await new Promise(r => srv.listen(0, "127.0.0.1", r)); const BASE = `http://127.0.0.1:${srv.address().port}/`;
const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, serviceWorkers: "block", permissions: ["camera"] });
await ctx.route(/supabase\.co/, r => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
const FAKE = `export const FilesetResolver={forVisionTasks:async()=>({})};
const pts=()=>Array.from({length:21},(_,i)=>({x:0.3+0.02*(i%5)+Math.random()*0.01,y:0.3+0.02*Math.floor(i/5)+Math.random()*0.01,z:0}));
export const HandLandmarker={createFromOptions:async()=>({detectForVideo:()=>({landmarks:[pts(),pts()]})})};`;
await ctx.route(/vision_bundle\.mjs/, r => r.fulfill({ status: 200, contentType: "text/javascript", headers: { "access-control-allow-origin": "*" }, body: FAKE }));
await ctx.addInitScript(() => { localStorage.setItem("tg_guest_profile", JSON.stringify({ name: "T", lang: "th", age: "adult", level: "beginner", exp: 5000 })); localStorage.setItem("tg_lang", window.__L || "th"); localStorage.setItem("tg_orient_hint_seen", "1"); localStorage.setItem("tg_edu_seen", '{"firstCoins":1,"chest":1,"pet":1,"shop":1,"rich":1,"shopIntro":1}'); localStorage.removeItem("tg_act_log"); localStorage.setItem("tg_pro","1"); });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push("PE " + e.message)); p.on("console", m => { if (m.type() === "error") errs.push("CE " + m.text()); });
await p.goto(BASE, { waitUntil: "load" }); await p.waitForTimeout(2500);

/* Hand Coach (the camera overlay) with a FAKE camera and a FAKE hand model: the overlay used to crash with "Cannot read properties of undefined (reading 'th')"
   the moment the camera ran, because it read the mission's how-to from the wrong object (camMission.how, which is camMission.ch.how). The model library is
   stubbed so this runs without the CDN. Checks the overlay stays up, shows the mission and its how-to, and nothing throws. */
let fail = 0; const ok = (n, c, d = "") => { console.log((c ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); if (!c) fail++; };
await p.evaluate(() => document.querySelector('[data-tstep="hands"]').click()); await p.waitForTimeout(4000);
const t = (await p.locator(".camov").first().innerText().catch(() => "")).replace(/\s+/g, " ");
ok("overlay is open and running", (await p.locator(".camov").count()) === 1 && (await p.locator(".cammission").count()) === 1, t.slice(0, 80));
ok("the mission and its how-to are shown", /ถือท่าดี 15 วินาที/.test(t) && /งอนิ้วโค้ง/.test(t));
ok("no crash fallback, no page errors", !/แสดงไม่สำเร็จ/.test(await p.locator("body").innerText()) && !errs.some(e => /^PE|SafeZone|Cannot read/.test(e)), errs.slice(0, 2).join(" | "));
await b.close(); srv.close(); console.log(fail ? fail + " FAILED" : "all passed"); process.exit(fail ? 1 : 0);

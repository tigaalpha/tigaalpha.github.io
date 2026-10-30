// Play Store graphics: icon 512x512 and feature graphic 1024x500 (usage: node scripts/make-store-assets.mjs; needs Playwright + Chromium)
import fs from "node:fs"; import { execSync } from "node:child_process"; import path from "node:path"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); const pw = pwm.chromium ? pwm : pwm.default;
const svg = fs.readFileSync("public/icon.svg", "utf8"), uri = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const shot = async (w, h, html, out) => { const p = await b.newPage({ viewport: { width: w, height: h } }); await p.setContent(html); await p.waitForTimeout(300); await p.screenshot({ path: out, type: "png" }); await p.close(); };
await shot(512, 512, `<body style="margin:0;width:512px;height:512px;background:#fff;display:flex;align-items:center;justify-content:center;font:900 150px Arial,Helvetica,sans-serif;color:#d97757;box-sizing:border-box;border:18px solid #d97757">TIGA</body>`, "store-assets/icon-512.png");
const keys = Array.from({ length: 14 }, (_, i) => [1, 3, 6, 8, 10].includes(i % 12) ? `<i class="k b" style="left:${i * 62 + 40}px"></i>` : "").join("");
const white = Array.from({ length: 17 }, (_, i) => `<i class="k w" style="left:${i * 62}px"></i>`).join("");
await shot(1024, 500, `<style>body{margin:0;width:1024px;height:500px;background:radial-gradient(circle at 78% 20%,#7c3aed 0,#2a1250 45%,#0b1020 100%);font-family:system-ui,sans-serif;color:#fff;position:relative;overflow:hidden}
.k{position:absolute;bottom:0;display:block}.w{width:60px;height:120px;background:linear-gradient(#f4f1ff,#cfc8ee);border-radius:0 0 8px 8px;opacity:.9}.b{width:36px;height:76px;background:#120a26;border-radius:0 0 6px 6px;z-index:2;opacity:.95}
h1{position:absolute;left:56px;top:96px;margin:0;font-size:84px;letter-spacing:-2px}h2{position:absolute;left:58px;top:208px;margin:0;font-size:34px;font-weight:600;color:#d8c8ff;max-width:560px;line-height:1.25}
img{position:absolute;right:70px;top:60px;width:300px;border-radius:64px;box-shadow:0 20px 60px #0008}.tag{position:absolute;left:58px;top:340px;font-size:24px;color:#ffd9b0}</style>
<body><h1>TIGA.AI</h1><h2>Learn piano with songs, an AI teacher and games</h2><div class="tag">เรียนเปียโน · Piano · 钢琴</div><img src="${uri}">${white}${keys}</body>`, "store-assets/feature-graphic-1024x500.png");
await b.close(); console.log("ok");

// Android launcher icons from the TIGA ALPHA mark (usage: node scripts/make-android-icons.mjs; needs Playwright + Chromium). Writes the legacy, round, adaptive foreground and background PNGs of every density.
import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); const pw = pwm.chromium ? pwm : pwm.default;
const RES = "android/app/src/main/res", D = { ldpi: 36, mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }, CLAY = "#d97757";
const text = (S) => `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Arial,Helvetica,sans-serif;font-weight:900;color:${CLAY};line-height:1"><div style="font-size:${S * 0.3}px;letter-spacing:${S * 0.01}px">TIGA</div><div style="font-size:${S * 0.15}px;font-weight:700;letter-spacing:${S * 0.025}px;margin-top:${S * 0.02}px">ALPHA</div></div>`;
const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const shot = async (S, html, out, transparent) => { const p = await b.newPage({ viewport: { width: S, height: S } }); await p.setContent(`<body style="margin:0;width:${S}px;height:${S}px;position:relative;background:transparent">${html}</body>`); await p.screenshot({ path: out, omitBackground: !!transparent }); await p.close(); };
for (const [d, S] of Object.entries(D)) {
  const dir = path.join(RES, "mipmap-" + d), bw = Math.max(2, Math.round(S * 0.035));
  await shot(S, `<div style="position:absolute;inset:${bw / 2}px;border:${bw}px solid ${CLAY};border-radius:${S * 0.21}px;background:#fff"></div>${text(S)}`, path.join(dir, "ic_launcher.png"), true);
  await shot(S, `<div style="position:absolute;inset:${bw / 2}px;border:${bw}px solid ${CLAY};border-radius:50%;background:#fff"></div>${text(S * 0.9)}`, path.join(dir, "ic_launcher_round.png"), true);
  await shot(S, `<div style="position:absolute;inset:0;background:#fff"></div>`, path.join(dir, "ic_launcher_background.png"), false);
  await shot(S, text(S * 1.05), path.join(dir, "ic_launcher_foreground.png"), true);
}
await shot(512, `<div style="position:absolute;inset:9px;border:18px solid ${CLAY};border-radius:106px;background:#fff"></div>${text(512)}`, "store-assets/icon-512.png", true);
await b.close(); console.log("ok");

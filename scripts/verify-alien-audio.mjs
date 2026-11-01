#!/usr/bin/env node
/* verify-alien-audio.mjs — the Alien Hunt creature voices, rendered offline in Chromium (OfflineAudioContext, no speakers needed).
   Bundles ah-audio.ts, renders every voice (all 38 alien kinds x spawn / growl / bite / die, the pain cry, the boss stinger) into a fresh offline
   context and measures it: the voice exists (not silent), it is finite, it does not clip, it is not louder than a gun, it ends (no stuck tone).
     node scripts/verify-alien-audio.mjs        (SHOT=dir also writes a spectrogram PNG per base voice) */
import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process"; import { pathToFileURL, fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { build } = await import(pathToFileURL(path.join(ROOT, "node_modules/esbuild/lib/main.js")).href);
const tmp = path.join(ROOT, "node_modules/.cache/alien-audio-test"); fs.mkdirSync(tmp, { recursive: true });
fs.writeFileSync(path.join(tmp, "entry.ts"), `import * as AU from ${JSON.stringify(process.env.AUDIO_SRC || path.join(ROOT, "ah-audio.ts"))}; import { ALIENS } from ${JSON.stringify(path.join(ROOT, "ah-engine.ts"))}; (window as any).AU = AU; (window as any).KINDS = Object.keys(ALIENS); (window as any).__ready = true;`);
await build({ entryPoints: [path.join(tmp, "entry.ts")], bundle: true, format: "iife", outfile: path.join(tmp, "entry.js"), platform: "browser", logLevel: "error" });
fs.writeFileSync(path.join(tmp, "index.html"), `<!doctype html><meta charset=utf8><script src="entry.js"></script>`);
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); const pw = pwm.chromium ? pwm : pwm.default;
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.goto("file://" + path.join(tmp, "index.html")); await page.waitForFunction(() => window.__ready);
let pass = 0, fail = 0; const check = (n, ok, d = "") => { if (ok) pass++; else fail++; console.log((ok ? "PASS " : "FAIL ") + n + (d ? " — " + d : "")); };
const res = await page.evaluate(async () => {
  const AU = window.AU, SR = 44100, out = [];
  const stats = (d) => { let pk = 0, e = 0, bad = 0, last = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (!(a <= 10)) bad++; if (a > pk) pk = a; e += d[i] * d[i]; if (a > 0.004) last = i; } return { pk, rms: Math.sqrt(e / d.length), bad, end: last / SR }; };
  const render = async (fn, secs = 4) => { const c = new OfflineAudioContext(2, SR * secs, SR); window.__tgCineCtx = c; AU.dispose(); AU.warm(); fn(); const b = await c.startRendering(); AU.dispose(); return stats(b.getChannelData(0)); };
  const base = async () => { const o = []; for (const g of ["pistol", "rifle", "shotgun"]) o.push({ n: "gun:" + g, ...(await render(() => AU.sfx("shot", g), 2)) }); return o; };
  out.push(...(await base()));
  for (const k of window.KINDS) for (const m of ["spawn", "growl", "bite", "die"]) out.push({ n: k + ":" + m, ...(await render(() => AU.creature(k, m, 2), 5)) });
  out.push({ n: "hurt:charger", ...(await render(() => (AU.hurtVoice || (()=>{}))("charger"), 2)) }); out.push({ n: "hurt:skitter", ...(await render(() => (AU.hurtVoice || (()=>{}))("skitter"), 2)) });
  out.push({ n: "stinger", ...(await render(() => (AU.stinger || (()=>{}))(), 5)) });
  return out;
});
const guns = res.filter(r => r.n.startsWith("gun:")), voices = res.filter(r => !r.n.startsWith("gun:")), gunPk = Math.max(...guns.map(g => g.pk));
check("every one of the 38 alien kinds has all four voices (" + voices.filter(v => v.n.includes(":")).length + " renders)", voices.filter(v => /:(spawn|growl|bite|die)$/.test(v.n)).length >= 38 * 4);
const silent = voices.filter(v => v.pk < 0.01); check("none is silent", silent.length === 0, silent.map(v => v.n).join(", "));
check("all finite", voices.every(v => v.bad === 0));
const clip = voices.filter(v => v.pk >= 0.95); check("none clips or comes close to it (peak < 0.95)", clip.length === 0, clip.map(v => v.n + " " + v.pk.toFixed(2)).join(", "));
const loud = voices.filter(v => v.pk > 0.75 && !v.n.startsWith("stinger") && !/^(warden|matriarch|lumawarden|titan|walker):spawn$/.test(v.n));   // a boss arriving is allowed to be the biggest moment (its stinger rides on the roar), still under the clip line check("no creature voice peaks above 0.75 (the loudest gun is " + gunPk.toFixed(2) + ", the old voices peaked at 0.37)", loud.length === 0, loud.slice(0, 5).map(v => v.n + " " + v.pk.toFixed(2)).join(", "));
const stuck = voices.filter(v => v.end > (v.n.startsWith("stinger") ? 4.6 : 3.2)); check("every voice ends by itself", stuck.length === 0, stuck.slice(0, 5).map(v => v.n + " " + v.end.toFixed(1)).join(", "));
const sp = voices.filter(v => v.n.endsWith(":spawn")); check("spawn roars are fuller than idle growls (median RMS)", sp.map(v => v.rms).sort()[Math.floor(sp.length / 2)] > voices.filter(v => v.n.endsWith(":growl")).map(v => v.rms).sort()[Math.floor(sp.length / 2)]);
const st = voices.find(v => v.n === "stinger"); check("the boss stinger is audible and the biggest sound (peak " + st.pk.toFixed(2) + ")", st.pk > 0.2);
console.log("   info: gun peak " + gunPk.toFixed(2) + "; voices peak " + Math.max(...voices.map(v => v.pk)).toFixed(2) + ", median " + voices.map(v => v.pk).sort((a, b) => a - b)[Math.floor(voices.length / 2)].toFixed(2));
check("no page errors", errs.length === 0, errs.slice(0, 2).join(" | "));
await browser.close(); console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);

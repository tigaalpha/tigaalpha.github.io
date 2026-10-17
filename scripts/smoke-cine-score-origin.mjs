// A film's score must be booked from the live context's NOW. Booked from time zero (the old bug) it is silent on any context older than the film.
import path from "node:path"; import { execSync } from "node:child_process"; import { pathToFileURL } from "node:url"; import { build } from "esbuild";
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); const pw = pwm.chromium ? pwm : pwm.default;
const out = await build({ entryPoints: ["adventure-music.ts"], bundle: true, format: "iife", globalName: "AM", write: false });
const b = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage(); await p.setContent("<body></body>"); await p.addScriptTag({ content: out.outputFiles[0].text });
const r = await p.evaluate(async () => { const c = new AudioContext(); await c.resume(); await new Promise(r => setTimeout(r, 24000)); const an = c.createAnalyser(); an.fftSize = 2048; an.connect(c.destination); const g = c.createGain(); g.gain.value = 0.3; g.connect(an);
  AM.scheduleCineScore(c, g, "luma", [{ kind: "earth", dur: 6 }, { kind: "factory", dur: 6 }, { kind: "objective", dur: 6 }], 3); let mx = 0; const buf = new Float32Array(2048), t0 = performance.now(); while (performance.now() - t0 < 4000) { an.getFloatTimeDomainData(buf); for (const x of buf) mx = Math.max(mx, Math.abs(x)); await new Promise(r => setTimeout(r, 50)); } return { age: c.currentTime, max: mx }; });
await b.close(); const ok = r.max > 0.02; console.log((ok ? "PASS" : "FAIL") + " score audible on a context " + r.age.toFixed(0) + " s old, peak " + r.max.toFixed(3)); process.exit(ok ? 0 : 1);

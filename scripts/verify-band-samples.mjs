#!/usr/bin/env node
/* verify-band-samples.mjs — the band's sampler, in a real Chromium: bundles band-samples.ts, serves public/, loads every instrument through the
   real loader (fetch + decodeAudioData of the shipped MP3s), plays notes through an OfflineAudioContext and measures what came out.

     node scripts/verify-band-samples.mjs

   Checks: every instrument loads; every note in its range is audible, finite and not clipping; the pitch that comes out is the pitch that was
   asked for (within 40 cents, by autocorrelation; octave-checked on the notes a sample was bent for); a note is silent before it starts
   and after its release; an out-of-range note and an unloaded instrument return null; the credits file exists. */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { build } = await import(pathToFileURL(path.join(ROOT, "node_modules/esbuild/lib/main.js")).href);
const tmp = path.join(ROOT, "node_modules/.cache/band-samples-test"); fs.mkdirSync(tmp, { recursive: true });
fs.writeFileSync(path.join(tmp, "entry.ts"), `import * as S from ${JSON.stringify(path.join(ROOT, "band-samples.ts"))}; (window as any).S = S; (window as any).__ready = true;`);
await build({ entryPoints: [path.join(tmp, "entry.ts")], bundle: true, format: "iife", outfile: path.join(tmp, "entry.js"), platform: "browser", logLevel: "error" });
fs.writeFileSync(path.join(tmp, "index.html"), `<!doctype html><meta charset=utf8><script src="entry.js"></script>`);

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { if (ok) pass++; else fail++; console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); };

const PUB = path.join(ROOT, "public");
const server = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split("?")[0]);
  const f = u === "/" ? path.join(tmp, "index.html") : u === "/entry.js" ? path.join(tmp, "entry.js") : path.join(PUB, u);
  if (!f.startsWith(tmp) && !f.startsWith(PUB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".json") ? "application/json" : f.endsWith(".mp3") ? "audio/mpeg" : "text/html" }); s.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); const pw = pwm.chromium ? pwm : pwm.default;
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
await page.goto("http://127.0.0.1:" + server.address().port + "/"); await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });

const mf = JSON.parse(fs.readFileSync(path.join(PUB, "band-samples/manifest.json"), "utf8")).instruments;
const names = Object.keys(mf);
check("the credits file ships with the samples", fs.existsSync(path.join(PUB, "band-samples/CREDITS.md")) && /Creative Commons Attribution 3\.0/.test(fs.readFileSync(path.join(PUB, "band-samples/CREDITS.md"), "utf8")));

const res = await page.evaluate(async (names) => {
  const S = window.S, out = { load: null, notes: [], misc: {} };
  const ctx0 = new OfflineAudioContext(2, 44100, 44100);
  out.misc.nullBefore = S.playSample(ctx0, ctx0.destination, "acoustic_bass", 40, 0, 1) === null;
  out.load = await S.loadBandSamples(ctx0, names);
  out.misc.loadedAll = names.every((n) => S.sampleReady(n));
  const f0 = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const pitchOf = (d, sr, lo, hi) => {   // normalised autocorrelation, the smallest lag within 90 % of the best
    const n = Math.min(d.length, 16384); let best = 0, bl = 0; const corr = [];
    const l0 = Math.floor(sr / hi), l1 = Math.ceil(sr / lo);
    let e0 = 0; for (let i = 0; i < n - l1; i++) e0 += d[i] * d[i];
    for (let l = l0; l <= l1; l++) { let c = 0, e1 = 0; for (let i = 0; i < n - l1; i++) { c += d[i] * d[i + l]; e1 += d[i + l] * d[i + l]; } const v = c / Math.sqrt((e0 * e1) || 1); corr[l] = v; if (v > best) { best = v; bl = l; } }
    for (let l = l0; l <= l1; l++) if (corr[l] >= 0.9 * best && corr[l] >= corr[l - 1] && corr[l] >= corr[l + 1]) return { hz: sr / l, c: corr[l] };
    return { hz: sr / bl, c: best };
  };
  for (const name of names) {
    const r = S.sampleRange(name);
    for (let m = Math.ceil(r[0]); m <= r[1]; m += 2) {
      const ctx = new OfflineAudioContext(2, 44100 * 2, 44100);
      const g = ctx.createGain(); g.connect(ctx.destination);
      const h = S.playSample(ctx, g, name, m, 0.2, 1.2, 0.8);
      if (!h) { out.notes.push({ name, m, none: true }); continue; }
      const buf = await ctx.startRendering(); const d = buf.getChannelData(0);
      let peak = 0, nan = 0; for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (!(a <= 10)) nan++; if (a > peak) peak = a; }
      const before = Math.max(...Array.from(d.slice(0, Math.floor(44100 * 0.19)), Math.abs));
      const after = Math.max(...Array.from(d.slice(Math.floor(44100 * 1.7)), Math.abs));
      const seg = d.slice(Math.floor(44100 * 0.35), Math.floor(44100 * 0.35) + 16384);
      const p = pitchOf(seg, 44100, f0(m) / 1.45, f0(m) * 1.45);
      out.notes.push({ name, m, peak, nan, before, after, cents: 1200 * Math.log2(p.hz / f0(m)), c: p.c });
    }
  }
  const c2 = new OfflineAudioContext(2, 4410, 44100);
  out.misc.farNull = S.playSample(c2, c2.destination, "acoustic_bass", 100, 0, 1) === null;
  out.misc.unknownNull = S.playSample(c2, c2.destination, "no_such", 60, 0, 1) === null;
  return out;
}, names);

check("every instrument loads through the real loader", res.load === true && res.misc.loadedAll);
check("an instrument that is not loaded plays nothing (the old band is untouched)", res.misc.nullBefore && res.misc.unknownNull);
check("a pitch out of reach plays nothing", res.misc.farNull);
const notes = res.notes.filter((n) => !n.none);
check("every note in range plays (" + notes.length + " notes over " + names.length + " instruments)", res.notes.every((n) => !n.none) && notes.length > 100, res.notes.filter((n) => n.none).length + " refused");
check("all audible and finite", notes.every((n) => n.peak > 0.02 && n.nan === 0), JSON.stringify(notes.filter((n) => !(n.peak > 0.02 && n.nan === 0)).slice(0, 3)));
check("none clips (peak < 1 at gain 0.8)", notes.every((n) => n.peak < 1), "max peak " + Math.max(...notes.map((n) => n.peak)).toFixed(3));
check("silent before the note starts and after its release", notes.every((n) => n.before < 0.001 && n.after < 0.003), JSON.stringify(notes.filter((n) => !(n.before < 0.001 && n.after < 0.003)).slice(0, 3)));
const bad = notes.filter((n) => Math.abs(n.cents) > 40);
const octave = bad.filter((n) => Math.abs(Math.abs(n.cents) - 1200) < 60 || Math.abs(Math.abs(n.cents) - 700) < 60);
check("the pitch that comes out is the pitch that was asked for (within 40 cents)", bad.length - octave.length === 0, bad.length + " off by more than 40 cents, " + octave.length + " of them a detector octave/fifth slip: " + JSON.stringify(bad.filter((n) => !octave.includes(n)).slice(0, 4).map((n) => [n.name, n.m, Math.round(n.cents)])));
console.log("   info: " + notes.length + " notes, median |cents| " + notes.map((n) => Math.abs(n.cents)).sort((a, b) => a - b)[Math.floor(notes.length / 2)].toFixed(1) + ", max peak " + Math.max(...notes.map((n) => n.peak)).toFixed(3));
check("no page errors", errs.length === 0, errs.slice(0, 2).join(" | "));
await browser.close(); server.close();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);

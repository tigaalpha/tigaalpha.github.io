/* Play Along's own musical sounds, rendered offline and measured (the "effects" half of the audio: the graded hit ding, the
   milestone stingers, the crowd, the miss, the metronome's wood block and off-beat tick, the count-in's last beat, the result
   jingle). They sit on top of the band, so the three rules are: nothing clips, nothing is louder than a short effect should be, and
   — for a pianist whose microphone is open — everything is noise far above the piano (the pitch detector low-passes at 2.6 kHz
   before it listens), while a player who taps keeps the pitched version with every pitch blacklisted. The detector's own verdict
   on all of it (no wrong key is ever read) is in verify-playalong-mic-band.mjs, which now plays these sounds during the runs.

     node scripts/verify-playalong-sfx.mjs

   Needs Playwright + Chromium and esbuild. About a minute. Real music-engine and real play-along-band on an OfflineAudioContext. */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

let pwm;
try { pwm = await import("playwright"); } catch (e) {
  try { pwm = await import(pathToFileURL(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright/index.js")).href); }
  catch (e2) { console.error("Playwright is not installed (npm i -g playwright)."); process.exit(1); }
}
const pw = pwm.chromium ? pwm : pwm.default;
const EXE = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const plug = { name: "lab", setup(b) {
  b.onResolve({ filter: /^REAL_ME$/ }, () => ({ path: path.resolve("music-engine.tsx") }));
  b.onResolve({ filter: /^REAL_BAND$/ }, () => ({ path: path.resolve("play-along-band.ts") }));
} };
const bundle = await build({ entryPoints: [path.resolve("scripts/verify-playalong-mic-band.page.js")], bundle: true, format: "iife", write: false, plugins: [plug], loader: { ".ts": "ts", ".tsx": "tsx" }, jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, logLevel: "error" });
const code = bundle.outputFiles[0].text;
const browser = await pw.chromium.launch({ executablePath: EXE });
async function sfx(cfg) {
  const page = await browser.newPage();
  page.on("pageerror", e => console.log("PAGE ERROR", String(e).slice(0, 300)));
  try { await page.setContent("<html><body></body></html>"); await page.addScriptTag({ content: code }); return await page.evaluate((c) => window.__sfx(c), cfg); }
  finally { await page.close(); }
}
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log("PASS  " + msg); } else { fail++; console.log("FAIL  " + msg); } };
const db = (x) => 20 * Math.log10(Math.max(1e-9, x));
const f3 = (x) => x.toFixed(3);
const T = 0.5;                                   // when the sound fires
const SOUND = [[T, T + 1.0]];                     // the window the sound lives in

// ── P01 · the graded hit ding ──
const dings = {};
for (const mic of [false, true]) for (const grade of ["perfect", "great", "good"]) dings[(mic ? "m" : "t") + grade] = await sfx({ seconds: 2, mic, events: [{ t: T, fn: "ding", combo: 2, grade }], windows: SOUND });
for (const mic of [false, true]) {
  const [p, g, o] = ["perfect", "great", "good"].map(k => dings[(mic ? "m" : "t") + k]);
  const label = mic ? "a pianist (noise pings)" : "a tapper (chord-tone bell)";
  ok([p, g, o].every(r => r.clipped === 0 && r.peak < 0.5), `${label}: the three grades never clip and stay under 0.5 (peaks ${f3(p.peak)} / ${f3(g.peak)} / ${f3(o.peak)})`);
  ok(p.win[0].rms > g.win[0].rms * 0.98 && g.win[0].rms > o.win[0].rms * 1.15, `${label}: each grade is audibly its own — rms ${f3(p.win[0].rms)} (perfect) ≥ ${f3(g.win[0].rms)} (great) > ${f3(o.win[0].rms)} (good)`);
  if (mic) ok([p, g, o].every(r => r.win[0].below2600 < 0.12), `a pianist's pings keep ${((1 - Math.max(...[p, g, o].map(r => r.win[0].below2600))) * 100).toFixed(0)} % or more of their energy above the detector's 2.6 kHz ceiling`);
  else ok(p.win[0].below2600 < g.win[0].below2600, `the Perfect bell has the extra top (sparkle + noise "tss"): ${(100 * (1 - p.win[0].below2600)).toFixed(1)} % above 2.6 kHz vs ${(100 * (1 - g.win[0].below2600)).toFixed(1)} % for Great`);
}

// ── P04 · the stingers: alone, and landing on a downbeat of the full band in Fever ──
const KINDS = ["fever", "mega", "mark", "mark100", "ten", "boss"];
for (const mic of [false, true]) {
  const rs = {};
  for (const kind of KINDS) rs[kind] = await sfx({ seconds: 4, mic, events: [{ t: T, fn: "stinger", kind, n: 50 }], windows: [[T, T + 1.2], [T + 1.7, T + 2.7]] });
  const label = mic ? "a pianist" : "a tapper";
  ok(KINDS.every(k => rs[k].clipped === 0 && rs[k].peak < 0.6), `${label}: all six stingers alone — no clipped sample, peaks ${KINDS.map(k => k + " " + f3(rs[k].peak)).join(", ")}`);
  ok(KINDS.every(k => db(rs[k].win[1].rms) < db(rs[k].win[0].rms) - 14), `${label}: every stinger is gone within ~1.2 s (the window after it is ≥ 14 dB under its own)`);
  ok(rs.mega.win[0].rms > rs.mark.win[0].rms && rs.boss.win[0].rms > rs.ten.win[0].rms, `${label}: the sizes order themselves — mega ${f3(rs.mega.win[0].rms)} > mark ${f3(rs.mark.win[0].rms)}, boss ${f3(rs.boss.win[0].rms)} > ten ${f3(rs.ten.win[0].rms)}`);
  if (mic) ok(KINDS.every(k => rs[k].win[0].below2600 < 0.2), `a pianist's stingers keep their energy above 2.6 kHz (below it: ${KINDS.map(k => k + " " + (100 * rs[k].win[0].below2600).toFixed(0) + "%").join(", ")})`);
}
{
  const evs = [];
  // a stinger on each of the first downbeats of bars, in Fever with the whole band; the band's grid decides the exact moment
  KINDS.forEach((kind, i) => evs.push({ t: 2.3 + i * 2.4, fn: "stinger", kind, n: 50 }));
  const r = await sfx({ seconds: 17, mic: false, band: { combo: 40, fever: true, mega: true }, events: evs, windows: [] });
  ok(r.clipped === 0 && r.peak < 0.98, `a tapper in Mega Fever (the whole band) with each stinger landing on the grid: ${r.clipped} clipped samples, peak ${f3(r.peak)} (stingers at ${evs.map(e => e.kind).join(", ")})`);
  const base = await sfx({ seconds: 17, mic: false, band: { combo: 40, fever: true, mega: true }, events: [], windows: [] });
  ok(base.clipped === 0, `the same band without any stinger: ${base.clipped} clipped, peak ${f3(base.peak)} (the stingers add ${(db(r.peak) - db(base.peak)).toFixed(1)} dB at the peak)`);
}

// ── P11 · the crowd ──
{
  const out = {};
  for (const mic of [false, true]) for (const lv of [1, 2, 3]) out[(mic ? "m" : "t") + lv] = await sfx({ seconds: 5, mic, events: [{ t: T, fn: "crowd", level: lv }], windows: [[T, T + 2.5], [T + 3.2, T + 4.2]] });
  ok(Object.values(out).every(r => r.clipped === 0 && r.peak < 0.5), `the crowd never clips and stays under 0.5 (peaks ${Object.entries(out).map(([k, r]) => k + " " + f3(r.peak)).join(", ")})`);
  ok(Object.values(out).every(r => db(r.win[1].rms) < db(r.win[0].rms) - 20), `the crowd is over inside 2.5 s (the window 3.2 s on is ≥ 20 dB under it)`);
  ok(out.t3.win[0].rms > out.t1.win[0].rms * 1.3, `level 3 is bigger than level 1 (rms ${f3(out.t3.win[0].rms)} vs ${f3(out.t1.win[0].rms)})`);
  ok(out.m3.win[0].below2600 < 0.12 && out.m3.win[0].rms < out.t3.win[0].rms * 0.5, `a pianist's crowd: ${(100 - 100 * out.m3.win[0].below2600).toFixed(0)} % above 2.6 kHz and ${(out.m3.win[0].rms / out.t3.win[0].rms * 100).toFixed(0)} % of the tapper's level`);
}

// ── P06 · the miss ──
{
  const thud = await sfx({ seconds: 2, events: [{ t: T, fn: "miss", noBand: true }], windows: SOUND });
  const soft = await sfx({ seconds: 2, events: [{ t: T, fn: "miss", noBand: true, soft: true }], windows: SOUND });
  const mic = await sfx({ seconds: 2, mic: true, events: [{ t: T, fn: "miss", noBand: true }], windows: SOUND });
  ok(thud.clipped === 0 && thud.peak < 0.2 && thud.win[0].below2600 > 0.9, `the miss is a low, soft thud: peak ${f3(thud.peak)}, ${(100 * thud.win[0].below2600).toFixed(0)} % of its energy under 2.6 kHz (no buzz)`);
  ok(soft.peak < thud.peak * 0.8, `kind mode takes it down another third (peak ${f3(soft.peak)} vs ${f3(thud.peak)})`);
  ok(mic.win[0].below2600 < 0.35 && mic.peak < 0.5, `a pianist's miss is the noise sweep (7.5 → 3.6 kHz), peak ${f3(mic.peak)}`);
  // the band answers: pitched voices dull for a beat while the drums keep going
  const W = [[3.25, 3.75], [4.2, 4.6], [5.4, 5.9]];
  const run = (solo, miss) => sfx({ seconds: 6.5, band: { combo: 12, solo }, events: miss ? [{ t: 4.0, fn: "miss", noBand: false }] : [], windows: W });
  const pitched = ["b", "n", "c", "l", "a"], [pa, pb] = [await run(pitched, false), await run(pitched, true)];
  const [da, dbm] = [await run(["drums"], false), await run(["drums"], true)];
  const dip = db(pb.win[1].rms) - db(pa.win[1].rms), before = db(pb.win[0].rms) - db(pa.win[0].rms), after = db(pb.win[2].rms) - db(pa.win[2].rms);
  ok(before > -0.3 && before < 0.3, `before the miss the pitched voices are untouched (${before.toFixed(2)} dB)`);
  ok(dip < -3.0, `just after a miss the pitched voices (pad, bass, strings, lead) are ${(-dip).toFixed(1)} dB quieter than the same bars without it (target: about -4 dB and a closed top)`);
  ok(after > -1.0, `a beat and a half later they are back (${after.toFixed(2)} dB against the untouched run)`);
  const drumsDip = db(dbm.win[1].rms) - db(da.win[1].rms);
  ok(Math.abs(drumsDip) < 0.3, `the drums are not touched by a miss (${drumsDip.toFixed(2)} dB in the same window)`);
  const spb = 0.6, around = dbm.log.filter(e => e.when > 4.0 && e.when < 4.0 + 0.5 + spb * 1.2);
  ok(around.length >= 3 && around.every(e => e.drum), `the band keeps BOOKING drums through the dip: ${around.filter(e => e.drum).length}/${around.length} half-beats in the next ${(0.5 + spb * 1.2).toFixed(1)} s carry a drum hit`);
}

// ── P15 · the metronome: a wood block with an off-beat hat, quiet counts on ──
{
  const click = (mic, o) => sfx({ seconds: 1.5, mic, events: [{ t: T, fn: "click", ...o }], windows: [[T, T + 0.3]] });
  const [beat, acc, off] = [await click(false, {}), await click(false, { acc: true }), await click(false, { off: true })];
  ok([beat, acc, off].every(r => r.clipped === 0 && r.peak < 0.6), `the wood-block click never clips (peaks beat ${f3(beat.peak)}, accent ${f3(acc.peak)}, off-beat ${f3(off.peak)})`);
  ok(acc.win[0].rms > beat.win[0].rms * 1.2, `the accent is louder than the beat (rms ${f3(acc.win[0].rms)} vs ${f3(beat.win[0].rms)})`);
  ok(off.peak < beat.peak * 0.5 && off.win[0].below2600 < 0.2, `the off-beat tick is a quiet hat: ${(100 * off.peak / beat.peak).toFixed(0)} % of a beat click's peak, ${(100 - 100 * off.win[0].below2600).toFixed(0)} % above 2.6 kHz`);
  const mBeat = await click(true, {}), mOff = await click(true, { off: true });
  ok(mBeat.peak > 0.01 && mOff.peak < 1e-4, `a pianist keeps the noise tick on the beat (peak ${f3(mBeat.peak)}) and gets NO extra off-beat tick (peak ${mOff.peak.toExponential(1)})`);
  const stick = (o, mic = false) => sfx({ seconds: 1.5, mic, band: { combo: 0, solo: [] }, events: [{ t: T, fn: "stick", ...o }], windows: [[T + 0.18, T + 0.45]] });
  const [s1, s2] = [await stick({ acc: true }), await stick({ acc: true, last: true })];
  ok(s2.win[0].peak > s1.win[0].peak * 2 && s2.win[0].rms > s1.win[0].rms && s2.clipped === 0, `the last count-in beat is a clear "go": peak ${f3(s2.win[0].peak)} / rms ${f3(s2.win[0].rms)} against ${f3(s1.win[0].peak)} / ${f3(s1.win[0].rms)} for an ordinary accent, no clipping`);
}

// ── P12 · the result jingle ──
{
  const out = {};
  for (const mic of [false, true]) for (const stars of [0, 1, 2, 3]) out[(mic ? "m" : "t") + stars] = await sfx({ seconds: 7, mic, events: [{ t: T, fn: "jingle", stars, medals: stars === 3 ? 2 : 0 }], windows: [[T, T + 3.4], [T + 4.8, T + 5.8]] });
  ok(Object.values(out).every(r => r.clipped === 0 && r.peak < 0.6), `the jingle for 0-3 stars never clips (peaks ${Object.entries(out).map(([k, r]) => k + " " + f3(r.peak)).join(", ")})`);
  ok(Object.values(out).every(r => db(r.win[1].rms) < db(r.win[0].rms) - 20), `the jingle is over by about 4.5 s`);
  ok(out.t3.win[0].rms > out.t2.win[0].rms && out.t2.win[0].rms > out.t1.win[0].rms, `more stars sound bigger: rms ${f3(out.t1.win[0].rms)} (1) < ${f3(out.t2.win[0].rms)} (2) < ${f3(out.t3.win[0].rms)} (3)`);
  ok(out.t0.peak < out.t3.peak * 0.6, `no stars is only a soft cadence: peak ${f3(out.t0.peak)} vs ${f3(out.t3.peak)} at three stars`);
  ok(out.m3.win[0].below2600 < 0.25 && out.m1.win[0].below2600 < 0.25, `with a microphone still open (it is not, after the song) the jingle is noise above the piano: ${(100 - 100 * out.m3.win[0].below2600).toFixed(0)} % above 2.6 kHz at 3 stars`);
}

// ── P05 · the reward duck is only ever a dip: a Perfect landing while a stinger's duck is still booked ahead must not lift the band ──
{
  /* hitDuck() works out where an earlier duck had got to when a new one starts. If that earlier duck was booked in the FUTURE (a stinger
     books its dip a few hundred ms ahead) the elapsed time is negative and the old formula extrapolated the envelope backwards to a
     gain of 3-7 x for a few milliseconds, a burst on the band's bus. */
  const base = { combo: 12, solo: ["c", "n", "b"] };   // the pitched layers only: the drums' peaks would hide a burst on their bus
  const evs = (withDuck) => { const e = [{ t: 3.05, fn: "stinger", kind: "ten", n: 10 }]; if (withDuck) e.push({ t: 3.08, fn: "duck", db: 2, ms: 110 }); return e; };
  const [a, b] = [await sfx({ seconds: 5, mic: false, band: base, events: evs(false), windows: [[3.078, 3.1]] }), await sfx({ seconds: 5, mic: false, band: base, events: evs(true), windows: [[3.078, 3.1]] })];
  ok(b.win[0].peak <= a.win[0].peak * 1.05, `a Perfect's duck after a booked stinger duck only dips the band: peak ${f3(b.win[0].peak)} with it, ${f3(a.win[0].peak)} without`);
}

await browser.close();
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

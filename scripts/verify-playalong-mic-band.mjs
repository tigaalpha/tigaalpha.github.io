/* Play Along, the microphone and the sounds the game makes.

   A player on a real piano is heard through the phone's microphone — and the
   phone is also the speaker the band, the metronome and every hit sound come
   out of, an inch from that microphone. The pitch detector must not take any
   of it for a note the player pressed: a C heard while the D is due breaks the
   combo ("I pressed D and it heard C"), and a note the detector loses for a
   moment must not be reported a second time when it comes back.

   Nobody can put a piano next to a test run, but everything the game does is
   synthesised, so this runs the REAL music-engine (its sound functions, its
   blacklist, its note detector — createMonoDetector) and the REAL band on an
   OfflineAudioContext paused every 1/60 s, the pace of the microphone loop,
   with a phone speaker in front of a microphone that also hears a synthetic
   piano, and scores what the game would have made of it:

     - a piano alone is heard perfectly
     - a player on a real piano, with the band or with the metronome, with the
       phone at the piano's own level and 12 dB above it: every note is hit and
       no wrong key is ever read (before the low-pass, the held-note rule and
       the mic-safe sounds it was 30–70 wrong keys per 100 notes)
     - a player tapping the screen, with the full band and the mic open: the
       mic never costs a note
     - the detector on its own: C3–C6 all found, the same key twice found
       twice, and a ringing note drowned for 200 ms is not fired again

   The phone's volume is set from the band alone (the band, 0 dB or 12 dB over
   the piano at the microphone) and kept the same for the metronome.

     node scripts/verify-playalong-mic-band.mjs

   Needs Playwright + Chromium (preinstalled in the cloud containers) and
   esbuild (a Vite dependency). About a minute. */
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

const seq = (pitches, beats, len = 0.42) => pitches.map((m, i) => ({ midi: m, beat: beats[i], len }));
const MELODIES = {
  twinkle: { bpm: 96, prog: ["C", "C", "F", "C", "F", "C", "G", "C", "C", "F", "G", "C"], notes: seq([60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60, 62, 64, 65, 67, 69, 67, 65, 64, 62, 60], [...Array(24).keys()]) },
  ode: { bpm: 104, prog: ["C", "C", "G", "C", "C", "G", "C", "G", "C"], notes: seq([64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13.5, 14.5], 0.4) },
};
const secondsOf = (m) => 2.4 + Math.max(...m.notes.map(n => n.beat)) * (60 / m.bpm) + 1.8;

const browser = await pw.chromium.launch({ executablePath: EXE });
async function inPage(fn, arg) {
  const page = await browser.newPage();
  page.on("pageerror", e => console.log("PAGE ERROR", String(e).slice(0, 300)));
  try { await page.setContent("<html><body></body></html>"); await page.addScriptTag({ content: code }); return await page.evaluate(fn, arg); }
  finally { await page.close(); }
}
const runCfg = (c) => inPage((cfg) => window.__run(cfg), c);
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log("PASS  " + msg); } else { fail++; console.log("FAIL  " + msg); } };
const PIANO = 0.05;

// the phone's volume for each song: the band alone, measured once, so `db` dB over the piano
const spRms = {};
await Promise.all(Object.entries(MELODIES).map(async ([k, m]) => { spRms[k] = (await runCfg({ seconds: secondsOf(m), melody: m.notes, prog: m.prog, bpm: m.bpm, input: "mic", accomp: "track", spGain: 1, measure: true, pianoRms: 0 })).spRms; }));
const gainFor = (k, db) => PIANO * Math.pow(10, db / 20) / spRms[k];
const play = (k, extra) => runCfg({ seconds: secondsOf(MELODIES[k]), melody: MELODIES[k].notes, prog: MELODIES[k].prog, bpm: MELODIES[k].bpm, pianoRms: PIANO, ...extra });

const alone = await Promise.all(Object.keys(MELODIES).map(k => play(k, { input: "mic", accomp: "track", spGain: 0 })));
ok(alone.every(r => r.hits === r.notes && r.wrong === 0), `a piano alone: ${alone.map(r => r.hits + "/" + r.notes + " hit, " + r.wrong + " wrong").join(" · ")}`);

for (const [accomp, label] of [["track", "the backing track"], ["metro", "the metronome"]]) {
  const jobs = [];
  for (const db of [0, 12]) for (const k of Object.keys(MELODIES)) jobs.push({ db, k });
  const rs = await Promise.all(jobs.map(j => play(j.k, { input: "mic", accomp, spGain: gainFor(j.k, j.db) }).then(r => ({ ...j, ...r }))));
  for (const db of [0, 12]) {
    const g = rs.filter(r => r.db === db), notes = g.reduce((a, r) => a + r.notes, 0), hits = g.reduce((a, r) => a + r.hits, 0), wrong = g.reduce((a, r) => a + r.wrong, 0), strays = g.reduce((a, r) => a + r.strays.length, 0);
    ok(hits >= notes - 1 && wrong <= 1, `a pianist with ${label}, the phone ${db} dB over the piano: ${hits}/${notes} hit, ${wrong} wrong key${wrong === 1 ? "" : "s"}, ${strays} stray${strays === 1 ? "" : "s"}${wrong ? " (" + g.flatMap(r => r.wrongList).join(", ") + ")" : ""}`);
  }
  ok(rs.every(r => r.micSafeFrames / r.frames > 0.95), `the game took the player for a pianist all the way (${rs.map(r => Math.round(100 * r.micSafeFrames / r.frames) + "%").join(" ")} of the band's steps in its mic-safe voice)`);
}

const taps = await Promise.all(Object.keys(MELODIES).map(k => play(k, { input: "tap", accomp: "track", spGain: gainFor(k, 12) }).then(r => ({ k, ...r }))));
ok(taps.every(r => r.hits === r.notes && r.wrong === 0) && taps.every(r => r.micSafeFrames / r.frames < 0.2), `a player tapping the screen, the full band, the phone 12 dB over the piano: ${taps.map(r => r.hits + "/" + r.notes + " hit, " + r.wrong + " wrong, " + r.dets + " mic readings").join(" · ")}`);

const u = await inPage(() => window.__unit());
ok(u.scaleRight >= 35, `the detector on its own: ${u.scaleRight}/${u.scaleTotal} keys from C3 to C6 found${u.scaleMissed.length ? " (missed " + u.scaleMissed.join(",") + ")" : ""}`);
ok(u.again === u.againTotal, `the same key pressed twice is heard twice: ${u.again}/${u.againTotal}`);
ok(u.once === u.onceTotal, `a ringing note drowned by a burst of noise for 200 ms is not fired again: ${u.once}/${u.onceTotal} fired once (${u.bursts.join(",")} readings)`);

await browser.close();
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

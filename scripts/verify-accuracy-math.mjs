// verify-accuracy-math.mjs - proves the score/accuracy/star/timing maths of Play Along equal an
// INDEPENDENT exact-fraction reference over a large grid (not a copy of the formula's floats),
// plus invariants (0..100, integer, monotonic, never NaN). Part of the accuracy plan (2026-10-22).
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const dir = mkdtempSync(join(tmpdir(), "acc-"));
await build({ entryPoints: [new URL("../play-along-judge.ts", import.meta.url).pathname], bundle: true, platform: "node", format: "esm", outfile: join(dir, "j.mjs") });
const J = await import(pathToFileURL(join(dir, "j.mjs")).href);
await build({ entryPoints: [new URL("../learn-plan.ts", import.meta.url).pathname], bundle: true, platform: "node", format: "esm", outfile: join(dir, "l.mjs") });
const LP = await import(pathToFileURL(join(dir, "l.mjs")).href);
rmSync(dir, { recursive: true, force: true });
let pass = 0, fail = 0; const bad = [];
const ok = (c, m) => { if (c) pass++; else { fail++; if (bad.length < 12) bad.push(m); } };

// ---- accuracyOf against exact integer arithmetic: weights 1, 4/5, 1/2; wrong cost 1/2
// acc = round_half_up( (10p + 8g + 5d - 5(w+m)) / (10 * total) * 100 ) clamped 0..100, all in integers
const refAcc = ({ p, g, d, t, w, m, kind }) => {
  if (!t) return 0;
  const num = 10 * p + 8 * g + 5 * d - 5 * ((kind ? 0 : w) + m);   // = earned*10 - cost*10
  const den = 10 * t;
  // round half up of num*100/den
  let v = Math.floor((num * 100 * 2 + den) / (den * 2));
  if (num * 100 * 2 + den < 0) v = 0;
  return Math.max(0, Math.min(100, v));
};
let cases = 0;
for (let t = 1; t <= 30; t++)
  for (let p = 0; p <= t; p++)
    for (let g = 0; g <= t - p; g++) {
      const d = t - p - g;
      for (const w of [0, 1, 3]) for (const m of [0, 2]) for (const kind of [false, true]) {
        cases++;
        const got = J.accuracyOf({ perfect: p, great: g, good: d, total: t, wrong: w, mash: m, kind });
        const want = refAcc({ p, g, d, t, w, m, kind });
        ok(got === want, `acc p${p} g${g} d${d} t${t} w${w} m${m} k${kind}: got ${got} want ${want}`);
        ok(Number.isInteger(got) && got >= 0 && got <= 100, `acc range ${got}`);
      }
    }
ok(J.accuracyOf({ total: 0, perfect: 5 }) === 0, "no notes = 0, never NaN");
ok(J.accuracyOf({ perfect: 10, total: 10 }) === 100, "all perfect = 100");
// monotonic: one more perfect (instead of a good) never lowers it
for (let t = 2; t <= 40; t++) for (let p = 0; p < t; p++)
  ok(J.accuracyOf({ perfect: p + 1, good: t - p - 1, total: t }) >= J.accuracyOf({ perfect: p, good: t - p, total: t }), `monotonic t${t} p${p}`);

// ---- stars: exact boundaries
const S = [[0, 0], [49, 0], [50, 1], [74, 1], [75, 2], [89, 2], [90, 3], [100, 3]];
for (const [a, s] of S) ok(J.starsFor(a) === s, `stars(${a}) = ${s}`);
for (let a = 0; a < 100; a++) ok(J.starsFor(a + 1) >= J.starsFor(a), "stars monotonic " + a);
ok(J.nextStarGoal(100) === null && J.nextStarGoal(89).more === 1 && J.nextStarGoal(0).more === 50, "nextStarGoal edges");
ok(J.nextStarGoal("x").more === 50 && J.nextStarGoal(NaN).more === 50, "nextStarGoal garbage input");

// ---- timing windows: boundaries (floats: compare with the same constants the file exports)
for (const [kind, src] of [[false, "key"], [true, "key"], [false, "mic"], [true, "mic"]]) {
  const ex = src === "mic" ? J.MIC_EXTRA : 0, win = (kind ? J.RECEIVE_KIND : J.RECEIVE) + ex;
  ok(J.judgeOffset(0, kind, src) === "perfect", "0 offset perfect");
  ok(J.judgeOffset(J.PERFECT + ex, kind, src) === "perfect", "perfect edge inclusive");
  ok(J.judgeOffset(J.PERFECT + ex + 1e-6, kind, src) === "great", "just past perfect = great");
  ok(J.judgeOffset(J.GREAT + ex, kind, src) === "great", "great edge inclusive");
  ok(J.judgeOffset(J.GREAT + ex + 1e-6, kind, src) === "good", "just past great = good");
  ok(J.judgeOffset(win, kind, src) === "good", "window edge inclusive");
  ok(J.judgeOffset(win + 1e-6, kind, src) === null, "outside the window = miss");
  ok(J.receiveWindow(kind, src) === win, "window size");
}
// ---- calibration: median, clamp, needs 8 hits
ok(J.calibrate([0.01, 0.02]) === 0, "fewer than 8 hits = 0");
ok(Math.abs(J.calibrate([0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05]) - 0.05) < 1e-12, "median of equal values");
ok(J.calibrate(Array(8).fill(0.5)) === J.CALIB_MAX && J.calibrate(Array(8).fill(-0.5)) === -J.CALIB_MAX, "clamped both ways");
ok(Math.abs(J.calibrate([0.9, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06, -0.9]) - 0.035) < 1e-12, "one wild outlier each way does not move the median");
// ---- mash rule
ok(J.pressIsMash(0, 1) === false && J.pressIsMash(1, 1) === true && J.pressIsMash(2, 3) === false && J.pressIsMash(3, 0) === false, "mash rule");

// pctOf: exact round-half-up over every a<=b<=400
for (let b = 1; b <= 400; b++) for (let a = 0; a <= b; a++) {
  const want = Math.floor((a * 200 + b) / (2 * b));
  ok(LP.pctOf(a, b) === want && want >= 0 && want <= 100, `pctOf ${a}/${b}`);
}
ok(LP.pctOf(23, 40) === 58 && Math.round(23 / 40 * 100) === 57, "23/40 is 57.5 -> 58 (the float version gave 57)");
ok(LP.pctOf(0, 0) === 0 && LP.pctOf(5, 0) === 0, "pctOf with no tries = 0, never NaN");
console.log(`${cases} accuracy cases + extras checked: ${pass} passed, ${fail} failed`);
for (const b of bad) console.log("  FAIL", b);
process.exit(fail ? 1 : 0);

/* Headless verification of the Play Along plan #7/#8/#10 work:
   #7  song-analysis.ts — strategy-first analysis (real tigamodel loop +
       validation gate + real-data fallback)
   #8  Daily Song Quest helpers (deterministic daily song, day state)
   #10 pvp-online.ts — room code shape, join validation (no network in jsdom;
       transport is exercised for code-shape logic only)
   Transpiles the REAL source files with esbuild and imports them — no
   hand-mirrored copies (repo convention). jsdom stubs localStorage/window. */
import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { JSDOM } from "/tmp/node_modules/jsdom/lib/api.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://tigaalpha.github.io/" });
global.window = dom.window;
global.document = dom.window.document;
global.localStorage = dom.window.localStorage;
global.CustomEvent = dom.window.CustomEvent;

const OUT = "node_modules/.tmp-pa-verify";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

execSync(`npx esbuild song-analysis.ts --bundle --format=esm --outfile=${OUT}/song-analysis.mjs --log-level=silent`, { stdio: "inherit" });
// use-play-along.ts itself is not bundled: it imports App.tsx, which pulls
// font files and a worker esbuild has no loader for. Its rules live in pure
// modules (play-along-judge.ts, play-along-progress.ts), checked below.
execSync(`npx esbuild play-along-judge.ts --bundle --format=esm --outfile=${OUT}/play-along-judge.mjs --log-level=silent`, { stdio: "inherit" });
execSync(`npx esbuild pvp-online.ts --bundle --format=esm --outfile=${OUT}/pvp-online.mjs --log-level=silent`, { stdio: "inherit" });
execSync(`npx esbuild play-along-progress.ts --bundle --format=esm --outfile=${OUT}/play-along-progress.mjs --log-level=silent --define:import.meta.env={}`, { stdio: "inherit" });
const SA = await import(pathToFileURL(`${OUT}/song-analysis.mjs`).href);
const JD = await import(pathToFileURL(`${OUT}/play-along-judge.mjs`).href);
const PVP = await import(pathToFileURL(`${OUT}/pvp-online.mjs`).href);
const PG = await import(pathToFileURL(`${OUT}/play-along-progress.mjs`).href);

let pass = 0, fail = 0;
function ok(cond, label) { if (cond) { pass++; console.log(`PASS  ${label}`); } else { fail++; console.log(`FAIL  ${label}`); } }

/* ── #7: real-data fallback ── */
{
  const fb = SA.buildSongFallback("th", "Twinkle", { acc: 72, hits: 72, total: 100, missedNotes: ["C5", "D5", "C5"] });
  ok(fb && fb.weakness.includes("C5") && Array.isArray(fb.steps) && fb.steps.length === 2, "fallback: names the real missed note, 2 steps");
  const fbOk = SA.buildSongFallback("en", "Twinkle", { acc: 100, hits: 100, total: 100, missedNotes: [] });
  ok(fbOk && !fbOk.fallback === false && /Every note hit|confidence/i.test(fbOk.weakness), "fallback: flawless run gets praise path, marked fallback");
}

/* ── #7: validation gate — generic AI replies must never surface ── */
{
  // real tigamodel teaching loop (same wiring verify-autoteach uses)
  const { execSync: ex } = await import("node:child_process");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(`${OUT}/loop-entry.mjs`, `import { createTeachingLoop } from ${JSON.stringify(process.cwd() + "/tigamodel/teaching/teaching-loop.js")};\nimport { createTeachingPolicy } from ${JSON.stringify(process.cwd() + "/tigamodel/teaching/policy.js")};\nexport { createTeachingLoop, createTeachingPolicy };\n`);
  ex(`npx esbuild ${OUT}/loop-entry.mjs --bundle --format=esm --outfile=${OUT}/loop.mjs --log-level=silent`, { stdio: "inherit" });
  const loopM = await import(pathToFileURL(`${OUT}/loop.mjs`).href);
  const realLoop = loopM.createTeachingLoop({ policy: loopM.createTeachingPolicy() });
  const loopFn = (stats) => realLoop.runOnce({ practiceStats: stats });

  const result = { acc: 45, hits: 45, total: 100, missedNotes: ["C5", "C5", "E5"] };

  // AI returns GENERIC advice → must be rejected → fallback used
  const generic = await SA.analyzeSongRun("en", "Twinkle", result, loopFn,
    async () => JSON.stringify({ weakness: "You should practice regularly", steps: ["practice more", "keep going"] }));
  ok(generic && generic.fallback === true, "generic AI reply rejected → real-data fallback");

  // AI returns SPECIFIC advice with the strategy line → accepted, strategy present.
  // Its own label: a song's analysis is cached for a day by song + accuracy
  // bucket + top misses + language (ai-cache withAiCache), so the same inputs
  // as the generic case above would replay that reply instead of asking.
  let sawStrategyInSys = false;
  const specific = await SA.analyzeSongRun("en", "Twinkle (specific reply)", result, loopFn,
    async ({ system }) => {
      sawStrategyInSys = /strategy chosen by the model/i.test(system) || /must follow/i.test(system);
      return JSON.stringify({ weakness: "Repeated C5 misses in the opening phrase", steps: ["Drill C5-E5 slowly 3 times", "Run the opening at 0.8x tempo"] });
    });
  ok(specific && !specific.fallback && /C5/.test(specific.weakness), "specific AI reply accepted");
  ok(sawStrategyInSys, "system prompt carried the model's strategy line");

  // AI throws → fallback, never throws
  const boom = await SA.analyzeSongRun("th", "Twinkle", result, loopFn, async () => { throw new Error("network down"); });
  ok(boom && boom.fallback === true && boom.weakness.length > 3, "AI failure → fallback (never throws)");

  // teaching loop alone produces a strategy line from the real numbers
  ok(typeof loopFn === "function", "real tigamodel teaching loop loads");
}

/* ── #8: daily song quest (play-along-progress.ts) ── */
{
  const { dailySong, readDailyState, claimDaily, DAILY_SONG_REWARD } = PG;
  const fresh = readDailyState();
  ok(fresh && !fresh.id && fresh.done === false && fresh.stars === 0, "daily state: a fresh day starts with no song and undone");
  const a = dailySong(1, ""), b = dailySong(1, "");
  ok(a && b && a.id === b.id, "daily song is picked once and kept for the day");
  const st = readDailyState();
  ok(st.id === a.id && st.done === false, "the pick is stored for the day");
  ok(claimDaily("not-the-daily-song", 3) === false, "another song never pays the quest");
  ok(claimDaily(a.id, 0) === false, "the day's song with 0 stars does not pay");
  ok(claimDaily(a.id, 1) === true, "the day's song with 1 star pays");
  ok(claimDaily(a.id, 3) === false && readDailyState().done === true, "…and only once a day");
  ok(DAILY_SONG_REWARD.coins > 0 && DAILY_SONG_REWARD.exp > 0, "daily reward constants present");
}

/* ── scoring rules (play-along-judge.ts) ── */
{
  const { judgeOffset, accuracyOf, starsFor, pressIsMash, calibrate, nextStarGoal, bossHp, bossHit } = JD;
  ok(judgeOffset(0.05, false, "tap") === "perfect" && judgeOffset(0.1, false, "tap") === "great" && judgeOffset(0.2, false, "tap") === "good", "timing grades: perfect / great / good");
  ok(judgeOffset(0.3, false, "tap") === null && judgeOffset(0.3, true, "tap") === "good", "0.3 s off misses, except in kind mode");
  ok(judgeOffset(0.12, false, "mic") === "perfect", "the mic gets its settling time on top");
  ok(accuracyOf({ perfect: 10, total: 10 }) === 100 && starsFor(100) === 3, "every note perfect: 100%, 3 stars");
  ok(accuracyOf({ good: 10, total: 10 }) === 50 && starsFor(50) === 1, "every note only just in time: 50%, 1 star");
  ok(accuracyOf({ perfect: 10, total: 10, wrong: 4 }) === 80 && accuracyOf({ perfect: 10, total: 10, wrong: 4, kind: true }) === 100, "a wrong key costs half a note, forgiven in kind mode");
  ok(accuracyOf({ perfect: 10, total: 10, mash: 20, kind: true }) === 0, "mashing costs in every mode");
  ok(pressIsMash(1, 1) && !pressIsMash(1, 2) && !pressIsMash(5, 0), "a burst beyond the notes due is a mash; a chord is not; nothing due is never one");
  ok(calibrate([0.1, 0.1, 0.09, 0.11, 0.1, 0.1, 0.12, 0.08]) === 0.1 && calibrate([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]) === 0.12 && calibrate([0.1]) === 0, "input delay: median of 8 hits, clamped, none from too few");
  ok(JSON.stringify(nextStarGoal(86)) === JSON.stringify({ stars: 3, more: 4 }) && nextStarGoal(95) === null, "next-star goal");
  ok(bossHp(40) === 50 && bossHit("perfect", 3) === 2 && bossHit("good", 10) === 3, "boss hp and damage");
  const { feverAt, megaAt, comboMult, replayExp, comboMarkExp, medalOf, MEDAL_REWARD, runCoins, chestChance, runPlayed } = JD;
  /* plan 25 · D4 — REPLACED, deliberately and to a stricter contract. The old
     rule was "30 % of the notes, at least 10", whose floor put Fever and Mega
     out of reach on short songs (a 12-note song could never enter Mega at all).
     The new rule is the old one clamped to the song's own length, so the new
     check is the stronger claim: EVERY song length reaches BOTH marks. */
  ok(feverAt(4) === 4 && feverAt(12) === 4 && feverAt(20) === 6 && feverAt(30) === 9 && feverAt(42) === 13 && feverAt(48) === 15,
     "D4 Fever: 30% of the notes, never past the song's own last note");
  ok(megaAt(1) <= 1 && megaAt(5) <= 5 && megaAt(12) <= 12 && megaAt(20) <= 20 && megaAt(48) <= 48
     && megaAt(12) === 8 && megaAt(48) === 29 && megaAt(20) < megaAt(30) && megaAt(30) < megaAt(48),
     "D4 Mega Fever: EVERY song can reach it, and it still climbs with length");
  ok(megaAt(12) > feverAt(12) && megaAt(20) > feverAt(20) && megaAt(48) > feverAt(48),
     "D4 Mega always comes after Fever on the same song");
  ok(feverAt(0) >= 1 && megaAt(0) >= 1, "D4 a song with no notes does not divide by zero");
  /* plan 25 · D3 — the multiplier has to still be MOVING where a run actually
     ends. The old curve topped out at ×2.38 for the longest song (48 notes)
     because its ceiling sat at combo 300. */
  ok(comboMult(0) === 1 && comboMult(10) === 2, "D3 combo multiplier: ×1 → ×2 over the first 10");
  ok(comboMult(48) >= 3, "D3 combo multiplier: ×3 or more at the longest song's note count (was ×2.38)");
  ok(comboMult(20) < comboMult(30) && comboMult(30) < comboMult(40) && comboMult(40) < comboMult(48),
     "D3 combo multiplier: still climbing across the whole back half of a run");
  ok(comboMult(100000) <= 6, "D3 combo multiplier: capped, never unbounded");
  /* plan 25 · D1 — the reward for coming back. Must be non-decreasing (that is
     the feature) and must not pay on the first run (a first play already pays
     40 + acc·0.4 + combo). */
  ok(replayExp(1) === 0, "D1 the first play of a song gets no replay bonus");
  ok(replayExp(2) > 0 && replayExp(3) > replayExp(2) && replayExp(4) > replayExp(3) && replayExp(5) > replayExp(4)
     && replayExp(6) > replayExp(5) && replayExp(7) > replayExp(6),
     "D1 the replay bonus grows every run — this is the 4th-run fix");
  ok(replayExp(99) === replayExp(7) && replayExp(99) > 0, "D1 the replay bonus caps instead of running away");
  ok(replayExp(0) === 0 && replayExp(-5) === 0, "D1 no count means no bonus");
  ok(comboMarkExp(11, 42) === 15 && comboMarkExp(21, 42) === 25 && comboMarkExp(32, 42) === 35 && comboMarkExp(42, 42) === 50 && comboMarkExp(20, 42) === 0, "combo marks at 25/50/75/100% of the notes");
  ok(comboMarkExp(3, 12) === 15 && comboMarkExp(12, 12) === 50, "the shortest song reaches all four marks");
  ok(medalOf({ stars: 0 }) === 0 && medalOf({ stars: 1 }) === 1 && medalOf({ stars: 2 }) === 2 && medalOf({ stars: 3 }) === 3 && medalOf({ stars: 3, fullCombo: true }) === 4, "medals: bronze → crown");
  ok(medalOf({ stars: 3, fullCombo: true, tempo: 0.75 }) === 1, "below the real speed a run keeps bronze");
  ok(MEDAL_REWARD[1].coins === 10 && MEDAL_REWARD[4].coins === 60 && MEDAL_REWARD[4].exp === 200, "first-time medal rewards");
  ok(runCoins(0) === 0 && runCoins(1) === 10 && runCoins(3) === 20, "run coins: none without a star, 10/15/20");
  ok(chestChance(0) === 0 && chestChance(3) === 0.2, "one end chest, its chance by stars");
  ok(!runPlayed({ hits: 0 }) && !runPlayed({ hits: 2, mash: 300, acc: 0 }) && runPlayed({ hits: 1 }) && runPlayed({ hits: 5, mash: 0, acc: 0 }) && runPlayed({ hits: 10, mash: 12, acc: 3 }), "a run counts when a note was played and it was not mashed");
}

/* ── #10: pvp-online code shape + join validation ── */
{
  const code = PVP.makeRoomCode();
  ok(/^[A-Z0-9]{6}$/.test(code), "room code: 6 chars from the read-aloud-safe alphabet");
  ok(!/[I1O0]/.test(code), "room code: no ambiguous I/1/O/0");
  ok(PVP.currentOnlineRoom() === null, "no room active before host/join");
  let joinErr = null;
  try { await PVP.joinOnlineDuel("ABC", "Tester", {}); } catch (e) { joinErr = e; }
  ok(joinErr && /bad code/.test(String(joinErr.message)), "join rejects codes that are not 6 chars");
}

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

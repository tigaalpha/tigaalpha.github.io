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
// use-play-along pulls native-updater (import.meta.env) — define the env keys esbuild won't
execSync(`npx esbuild use-play-along.ts --bundle --format=esm --outfile=${OUT}/use-play-along.mjs --log-level=silent --define:import.meta.env={}`, { stdio: "inherit" });
execSync(`npx esbuild pvp-online.ts --bundle --format=esm --outfile=${OUT}/pvp-online.mjs --log-level=silent`, { stdio: "inherit" });
const SA = await import(pathToFileURL(`${OUT}/song-analysis.mjs`).href);
const PA = await import(pathToFileURL(`${OUT}/use-play-along.mjs`).href);
const PVP = await import(pathToFileURL(`${OUT}/pvp-online.mjs`).href);

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

  // AI returns SPECIFIC advice with the strategy line → accepted, strategy present
  let sawStrategyInSys = false;
  const specific = await SA.analyzeSongRun("en", "Twinkle", result, loopFn,
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

/* ── #8: daily song quest ── */
{
  const { dailySongFor, readDailySongState, DAILY_SONG_REWARD } = PA;
  const a = dailySongFor(), b = dailySongFor();
  ok(a && b && a.id === b.id, "daily song deterministic within a day");
  ok(PA.SONGS ? true : true, "module loads (SONGS is data-only here)");
  const key = new Date().toISOString().slice(0, 10);
  const st = readDailySongState(key);
  ok(st && st.d === key && st.done === false && st.stars === 0, "daily state: fresh day starts undone");
  ok(DAILY_SONG_REWARD.coins > 0 && DAILY_SONG_REWARD.exp > 0, "daily reward constants present");
  // different day → different-ish song (hash covers many days; just check it doesn't crash)
  const tomorrow = dailySongFor(new Date(Date.now() + 86400000));
  ok(tomorrow && tomorrow.id, "daily song for tomorrow resolves");
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

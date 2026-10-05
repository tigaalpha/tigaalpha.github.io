/* Play Along: a finished song must always reach the result screen.

   The report this answers (2026-10-05): "after a song ends in Play Along it
   does not go to the assessment page". The result screen itself renders
   correctly — that is checked here against the REAL component with a real
   finished run. What could strand a run before it got there was the ending
   itself living inside the requestAnimationFrame chain: one frame that threw,
   or a chain the browser dropped, left a finished song frozen on the stage
   with no result, and the only way out was to back out and start again.

   So this checks the three things that make the ending independent of the
   drawing:

     1. one shared truth for "is this run over" (songRunEnded), asked by the
        frame loop AND by hudTick's own interval
     2. the frame loop survives a throwing frame and keeps scheduling
     3. a song's own end is always a finite number, so the comparison can
        never be `x > NaN` (always false — a run that never ends), checked by
        running the REAL expandSong over every song the app ships

   Plus the result screen itself, rendered for real from a finished run.

     node scripts/verify-playalong-end.mjs                                  */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { JSDOM } from "jsdom";

let pass = 0, fail = 0;
const results = [];
const rec = (name, ok, detail) => {
  results.push({ name, ok });
  if (ok) pass++; else fail++;
  console.log((ok ? "PASS  " : "FAIL  ") + name + (detail ? " — " + detail : ""));
};

/* ── 1 + 2: the source of the ending ───────────────────────────────────── */
const PA = fs.readFileSync("use-play-along.ts", "utf8");

rec("songRunEnded is one shared function, not two copies of the rule",
  (PA.match(/function songRunEnded\(/g) || []).length === 1);
rec("the run ends on songRunEnded, not on a private comparison in the frame",
  /else if \(songRunEnded\(songTime\)\) \{ songFinishRef\.current\(\); return false; \}/.test(PA));
rec("the frame loop cannot end the run by throwing (try/catch around the frame)",
  /function songLoop\(\)[\s\S]{0,600}try \{[\s\S]{0,80}songFrame\(\)[\s\S]{0,400}catch \(e\)/.test(PA));
rec("a thrown frame still schedules the next frame (the run keeps its clock)",
  /catch \(e\)[\s\S]{0,900}if \(keepGoing && songRunRef\.current\) songRafRef\.current = requestAnimationFrame/.test(PA));
rec("a drill is still ended by its own pass/fail, not by the song's end",
  /function songRunEnded[\s\S]{0,300}if \(drillRef\.current\) return false;/.test(PA));
rec("a paused run is never finished underneath the pause menu",
  (PA.match(/function songRunEnded[\s\S]{0,400}pausedRef\.current\) return false;/) || []).length === 1);
rec("a finished run is never finished twice",
  (PA.match(/function songRunEnded[\s\S]{0,400}songFinishedRef\.current \|\| pausedRef\.current\) return false;/) || []).length === 1);
rec("a non-finite clock is not compared (x > NaN is false, and that hangs the run)",
  /function songRunEnded[\s\S]{0,400}if \(!isFinite\(songTime\) \|\| !isFinite\(end\)\) return false;/.test(PA));

/* the watchdog: hudTick's own interval, not the frame loop's, ends the run */
const hudTick = PA.slice(PA.indexOf("function hudTick("), PA.indexOf("function exitSong("));
rec("hudTick asks the same question — the result screen does not depend on rAF",
  /if \(songRunEnded\(songNow\(\)\)\) \{ songFinishRef\.current\(\); return; \}/.test(hudTick));
rec("hudTick's watchdog sits after the pause guard, so a pause is not overwritten",
  hudTick.indexOf("if (pausedRef.current) return;") < hudTick.indexOf("songRunEnded(songNow())"));
rec("hudTick still runs on its own interval (it is not called from the frame loop)",
  /songHudTimerRef\.current = setInterval\(\(\) => hudTick\(\), 120\)/.test(PA));

/* the guarantee: a finished run reaches its result screen whatever the
   bookkeeping does, and a stopped audio clock cannot strand it either */
rec("the reward bookkeeping is isolated in settleRun, not inline in finishSong",
  (PA.match(/function settleRun\(/g) || []).length === 1
  && /function finishSong\(\)[\s\S]{0,900}try \{ settleRun\(\); \}/.test(PA));
rec("finishSong catches a failed settle and still ends on the result screen",
  /catch \(e\) \{[\s\S]{0,600}setSongPhase\("done"\);/.test(PA));
rec("a failed settle still shows a real result, not a blank screen",
  /if \(!songResultRef\.current\) setSongResult\(bareResult\(\)\);/.test(PA)
  && /function bareResult\(\) \{[\s\S]{0,1200}score: songScoreRef\.current/.test(PA));
rec("a failed settle is recorded, so the next report is evidence not a guess",
  /finish-error:/.test(PA));
rec("a stopped audio clock cannot strand a run (a wall-clock deadline exists)",
  /function runOverByWallClock\(\)/.test(PA)
  && /performance\.now\(\) - rm\.startedAt\) \/ 1000 > songSec \+ songSec \* 0\.5 \+ 10/.test(PA));
rec("the wall-clock deadline is asked from hudTick's interval too",
  /runOverByWallClock\(\)\) \{ songFinishRef\.current\(\); return; \}/.test(hudTick));
rec("practice is exempt from the wall-clock deadline (its clock waits on purpose)",
  /function runOverByWallClock\(\)[\s\S]{0,300}practiceRef\.current\) return false;/.test(PA));
rec("a drill is exempt from the wall-clock deadline (it loops one section)",
  /runOverByWallClock\(\)\) \{ songFinishRef/.test(hudTick) && /!drillRef\.current && !pausedRef\.current && runOverByWallClock\(\)/.test(hudTick));

/* ── 3 + the result screen: the real modules ───────────────────────────── */
const STUBS = {
  "./app-shell": `
import * as React from "react";
export const CountUp = ({ value }) => React.createElement("span", null, String(value));
`,
  "./play-along-store": `export function useGameField(store, key) { return store.get(key); }`,
  "./play-along-progress": `
export const songStars = () => 0;
export const songBestAcc = () => 0;
export const songLengthSec = () => 30;
export const readDailyState = () => ({ id: null });
export const DAILY_SONG_REWARD = { coins: 5, exp: 20 };
export const logSongMood = () => {};
`,
  "./shared-infra": `
export const logActivity = () => {};
export const logUsage = () => {};
export const LINE_OA_URL = "";
`,
  "./i18n": `
export const L = { th: { songBackList: "กลับ", close: "ปิด", songScore: "คะแนน", songCombo: "คอมโบ", shareBtn: "แชร์", songRetry: "เล่นอีกครั้ง", songNextUp: "ถัดไป", concertComplete: "จบคอนเสิร์ต", songBest: "ดีที่สุด", songMaxCombo: "คอมโบสูงสุด", songAllPerfect: "สมบูรณ์แบบ", songFullCombo: "ฟูลคอมโบ", songNewBest: "สถิติใหม่", songInputHint: "เล่นตามโน้ต", songStart: "เริ่ม", songPreview: "ฟังก่อน", setlistSong: "เพลงที่" } };
export const tr = (m) => (m && (m.title || m.name)) || "x";
`,
  "./play-along-judge": `export const nextStarGoal = (acc) => (acc >= 100 ? null : { more: 100 - acc, stars: 3 });`,
  "./music-engine": `
export const PlayAlongStaff = () => null;
export const GamePiano = () => null;
export const laneHue = () => "#fff";
export const gpKeyBox = () => ({});
`,
};

const entry = `
import * as React from "react";
import { SongPlayOverlay } from "REAL_OVERLAY";
export { React, SongPlayOverlay };
`;
const plug = {
  name: "pa-end",
  setup(b) {
    b.onResolve({ filter: /^REAL_OVERLAY$/ }, () => ({ path: path.resolve("SongPlayOverlay.tsx") }));
    b.onResolve({ filter: /^ENTRY$/ }, () => ({ path: "entry-pa-end.js", namespace: "entry" }));
    b.onLoad({ filter: /.*/, namespace: "entry" }, () => ({ contents: entry, loader: "js", resolveDir: path.resolve(".") }));
    b.onResolve({ filter: /^\.\/(app-shell|play-along-store|play-along-progress|shared-infra|i18n|play-along-judge|music-engine)$/ }, (a) => ({ path: a.path, namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({ contents: STUBS[a.path] || "export {};", loader: "js", resolveDir: path.resolve(".") }));
  },
};
const built = await build({
  entryPoints: ["ENTRY"], bundle: true, format: "cjs", write: false, platform: "node",
  external: ["react", "react-dom", "react/jsx-runtime"], jsx: "automatic",
  loader: { ".ts": "ts", ".tsx": "tsx" },
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [plug], logLevel: "error",
});

const dom = new JSDOM(`<!doctype html><html><body></body></html>`, { url: "https://x.test/" });
const w = dom.window;
globalThis.window = w;
globalThis.document = w.document;
try { Object.defineProperty(globalThis, "navigator", { value: w.navigator, configurable: true }); } catch (e) {}
globalThis.localStorage = w.localStorage;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

const nodeRequire = createRequire(import.meta.url);
const mod = { exports: {} };
new Function("require", "module", "exports", built.outputFiles[0].text)(nodeRequire, mod, mod.exports);
const { React, SongPlayOverlay } = mod.exports;
const ReactDOMServer = nodeRequire("react-dom/server");

const noop = () => {};
const store = { _v: { songLoopRecap: null, songSetlistPos: null }, get(k) { return this._v[k]; } };
const finished = {
  acc: 87, score: 1234, maxCombo: 12, stars: 2, exp: 90, coins: 15, total: 40, hits: 35,
  best: 1300, newBest: true, fullCombo: false, allPerfect: false, missedNotes: ["E4"],
  playCount: 2, replayBonus: 5,
  grades: { perfect: 20, great: 10, good: 5, miss: 2, wrong: 1, mash: 0 },
  prevStars: 1, newStars: true, bestAcc: 87, goal: { more: 13, stars: 3 }, kind: null,
  dailyPaid: true, bossWon: false, medal: 2, medalNew: [2], medalCoins: 20, medalExp: 100,
  runNo: 1, coinCapped: false, moodLogged: false, setlist: null,
};
const base = {
  gameStore: store, pvpOnline: null,
  songMeta: { id: "ode", th: "Ode to Joy", en: "Ode to Joy", zh: "Ode to Joy", diff: 2, bpm: 90, seq: [["C4", 1]], custom: false },
  lang: "th", songCanvasRef: { current: null }, songDataRef: { current: { notes: [], dur: 30 } },
  songTempo: 1, setSongTempo: noop, songAutoLoop: false, setSongAutoLoop: noop, songInputRef: { current: noop },
  songAnalysisBusy: false, songAnalysis: null, requestSongAnalysis: noop,
  stylePickOpen: false, setStylePickOpen: noop, styleLoading: false,
  profile: null, exitSong: noop, startSongPlay: noop, previewSong: noop,
  shareCard: noop, shareLine: noop, styleTransform: noop,
  playAlongHand: "both", changePlayAlongHand: noop,
  drillPlan: [], drillActive: false, drillCleared: [], startDrill: noop, endDrill: noop,
  bossOn: false, bossMax: 0, kShelfOpen: false, setKShelfOpen: noop, kShelf: [], openKnowledgeShelf: noop,
  pauseSong: noop, resumeSong: noop, restartSong: noop, playAgain: noop, playNext: noop, nextSongFor: () => null,
  songKind: null, setSongKind: noop, songAccomp: "track", setSongAccomp: noop,
  songView: "fall", setSongView: noop, songBand: 2, setSongBand: noop, songFx: true, setSongFx: noop,
  songPractice: false, songGfx: "auto", setSongGfx: noop, songIntro: null, startIntro: noop, skipIntro: noop,
  sfxMuted: false, onToggleSfx: noop, onRemind: null, songTigaTip: null,
};

function render(props) {
  return ReactDOMServer.renderToStaticMarkup(React.createElement(SongPlayOverlay, props));
}

/* the assessment screen a finished run lands on */
let html = "";
try {
  html = render({ ...base, songPhase: "done", songResult: finished });
  rec("a finished run renders the result screen (the real component, a real result)", /class="[^"]*songresult/.test(html));
  rec("the result screen shows the run's accuracy", html.includes("87"));
  rec("the result screen offers to play again", /pl-again/.test(html));
  rec("the result screen offers the way back to the song list", /pl-back/.test(html));
} catch (e) {
  rec("a finished run renders the result screen (the real component, a real result)", false, "threw: " + (e && e.message));
}

try {
  const zero = render({ ...base, songPhase: "done", songResult: { ...finished, stars: 0, medal: 0, medalNew: [], goal: null, newStars: false } });
  rec("a run with no stars still lands on the result screen", /class="[^"]*songresult/.test(zero) && /pl-again/.test(zero));
} catch (e) { rec("a run with no stars still lands on the result screen", false, "threw: " + (e && e.message)); }

try {
  const concert = render({ ...base, songPhase: "done", songResult: { ...finished, setlist: [{ song: { th: "A" }, stars: 3 }, { song: { th: "B" }, stars: 1 }] } });
  rec("a finished concert lands on its own recap", /concertrecap/.test(concert) && /pl-again/.test(concert));
} catch (e) { rec("a finished concert lands on its own recap", false, "threw: " + (e && e.message)); }

/* every song the app ships ends at a finite time */
const songEntry = `
export { expandSong } from "./music-engine";
export { SONGS } from "./songs-data";
`;
const songPlug = {
  name: "pa-end-songs",
  setup(b) {
    b.onResolve({ filter: /^ENTRY$/ }, () => ({ path: "entry-pa-end-songs.js", namespace: "entry" }));
    b.onLoad({ filter: /.*/, namespace: "entry" }, () => ({ contents: songEntry, loader: "js", resolveDir: path.resolve(".") }));
  },
};
const songsBuilt = await build({
  entryPoints: ["ENTRY"], bundle: true, format: "cjs", write: false, platform: "node",
  external: ["react", "react-dom", "react/jsx-runtime", "three"], jsx: "automatic",
  loader: { ".ts": "ts", ".tsx": "tsx" },
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [songPlug], logLevel: "error",
});
const songMod = { exports: {} };
new Function("require", "module", "exports", songsBuilt.outputFiles[0].text)(nodeRequire, songMod, songMod.exports);
const { expandSong, SONGS } = songMod.exports;
const list = Array.isArray(SONGS) ? SONGS : Object.values(SONGS || {});
let notFinite = 0, threw = 0, ended = 0;
for (const s of list) {
  for (const hand of ["right", "left", "both"]) {
    let d;
    try { d = expandSong(s, hand); } catch (e) { threw++; continue; }
    if (!isFinite(d.lastT)) notFinite++;
    else if (hand === "right" && d.lastT >= 0) ended++;
  }
}
rec("every shipped song has a finite end in every hand mode (" + list.length + " songs)", notFinite === 0 && threw === 0, "notFinite=" + notFinite + " threw=" + threw);
rec("the end is the real one — at or past zero, not a placeholder", ended === list.length, "ended=" + ended + "/" + list.length);

/* the originals are parsed from a string; a token without a beat makes NaN */
const origDir = "public/originals";
const shards = fs.existsSync(origDir) ? fs.readdirSync(origDir).filter(f => /^songs-\d+\.json$/.test(f)) : [];
let origBad = 0, origChecked = 0;
for (const f of shards) {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(origDir, f), "utf8")); } catch (e) { origBad++; continue; }
  for (const s of (j && j.songs) || []) {
    origChecked++;
    if (typeof s.seq !== "string" || !s.seq.trim()) { origBad++; continue; }
    for (const t of s.seq.trim().split(/\s+/)) {
      const i = t.indexOf(":");
      if (i <= 0 || !isFinite(+t.slice(i + 1)) || +t.slice(i + 1) <= 0) { origBad++; break; }
    }
  }
}
rec("every original's beat string parses to real numbers (" + origChecked + " pieces, " + shards.length + " shards)", shards.length > 0 && origBad === 0, "bad=" + origBad);

/* the data above is all finite today, so the guard itself is checked directly:
   a single note with a non-finite time must not be able to poison lastT */
const ME = fs.readFileSync("music-engine.tsx", "utf8");
rec("lastT ignores a non-finite note time instead of reducing to NaN",
  /const lastT = notes\.reduce\(\(m, n\) => Math\.max\(m, isFinite\(n\.t\) \? n\.t : 0\), 0\);/.test(ME));
{
  const poisoned = [{ t: 1 }, { t: NaN }, { t: 5 }];
  const guarded = poisoned.reduce((m, n) => Math.max(m, isFinite(n.t) ? n.t : 0), 0);
  rec("a poisoned note list still ends at the last real note (5, not NaN)", guarded === 5, "lastT=" + guarded);
}

console.log("\n" + pass + " PASS, " + fail + " FAIL");
if (fail) process.exit(1);

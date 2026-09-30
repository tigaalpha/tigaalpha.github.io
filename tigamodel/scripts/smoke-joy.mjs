/* smoke-joy.mjs — plan v3.8 ระลอก 12 (12.1) JoyIndex v1 SHADOW.
   Proves on REAL code (esbuild + import — repo convention, no mirrors):
     • the signal vocabulary is fixed data: 5 signals, every one ask:false
       (the iron rule: NO mandatory questionnaire can exist in this metric)
     • every signal explains its source — the evidence names the exact log
       field it came from (tg_practice_log / tg_act_log / tg_stars_<id>)
     • signal-by-signal behaviour on crafted real-shaped log rows:
       came_back_soon (1–2 day gap), played_longer (>1.25× today's own
       per-session minutes and ≥10m), off_queue_song (a non-daily song run),
       first_full_combo (clean run on a song without 3 stars yet), shared_card
     • the score is ONLY the count of fired signals — no secret weights,
       no invented numbers (score === fired.length, always in 0..5)
     • the 12.2 opt-in mood taps are context: they NEVER enter the score
     • honest-null: no evidence → score null + "not enough evidence" line,
       in all 3 languages; n<30 → enough:false (the 7.2 rule)
     • shadow contract: used for no decision — shadow:true, enough:false
     • web.js pass-throughs exist and agree with the module
   Run: node tigamodel/scripts/smoke-joy.mjs */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const OUT = "/tmp/tiga-smoke-joy";
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

fs.rmSync(OUT, { recursive: true, force: true });
execSync(
  `npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/web.js --format=esm --platform=node --loader:.js=js --log-level=error`,
  { stdio: "pipe", cwd: ROOT }
);
const web = await import(url.pathToFileURL(path.join(OUT, "web.js")).href);
const joy = await import(url.pathToFileURL(path.join(ROOT, "tigamodel", "teaching", "joy.js")).href);

let passed = 0, failed = 0;
function check(label, fn) {
  try { fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n     ${e.message}`); }
}

const NOW = "2026-09-30";
const T = new Date(NOW + "T12:00:00").getTime();
const DAY = 86400000;

console.log("tigamodel teaching joy (JoyIndex v1 shadow):");

check("vocabulary: exactly 5 signals, all ask:false (no questionnaire by construction)", () => {
  const list = joy.JOY_SIGNALS;
  if (!Array.isArray(list) || list.length !== 5) throw new Error(`got ${list && list.length}`);
  for (const s of list) {
    if (s.ask !== false) throw new Error(`${s.key} allows asking (ask=${s.ask})`);
    for (const lg of ["th", "en", "zh"]) if (!s.label[lg] || !s.label[lg].length) throw new Error(`${s.key}.${lg} label missing`);
  }
});

check("vocabulary: frozen — the formula cannot drift silently", () => {
  let froze = false;
  try { joy.JOY_SIGNALS.push({ key: "x" }); } catch (e) { froze = true; }
  if (!froze || joy.JOY_SIGNALS.length !== 5) throw new Error("JOY_SIGNALS is mutable");
});

check("came_back_soon: practiced 2 days ago + today → fires, names both days", () => {
  const r = joy.joyIndex({
    practiceLog: { "2026-09-28": { n: 1, accSum: 60 }, [NOW]: { n: 1, accSum: 80 } },
    actLog: [], starsById: {}, daily: null, moods: [], now: NOW,
  });
  const e = r.evidence.find(x => x.key === "came_back_soon");
  if (!e.fired) throw new Error("did not fire");
  if (!e.source.includes("tg_practice_log")) throw new Error("source: " + e.source);
  const r3 = joy.joyIndex({ practiceLog: { "2026-09-25": { n: 1, accSum: 60 }, [NOW]: { n: 1, accSum: 80 } }, actLog: [], starsById: {}, daily: null, moods: [], now: NOW });
  if (r3.evidence.find(x => x.key === "came_back_soon").fired) throw new Error("fired across a 5-day gap");
});

check("played_longer: minutes above today's own per-session baseline → fires", () => {
  const actLog = [
    { t: T, d: NOW, k: "game", id: "twinkle", ok: 30, miss: 5, sec: 60 * 14 },
    { t: T + DAY / 2, d: NOW, k: "game", id: "ocean", ok: 20, miss: 5, sec: 60 * 2 },
  ];
  const r = joy.joyIndex({ practiceLog: { [NOW]: { n: 2, accSum: 150 } }, actLog, starsById: {}, daily: null, moods: [], now: NOW });
  const e = r.evidence.find(x => x.key === "played_longer");
  if (!e.fired) throw new Error("did not fire (16m vs 8m avg)");
  if (!e.source.includes("tg_act_log")) throw new Error("source: " + e.source);
  const short = joy.joyIndex({ practiceLog: { [NOW]: { n: 1, accSum: 80 } }, actLog: [actLog[0]], starsById: {}, daily: null, moods: [], now: NOW });
  if (short.evidence.find(x => x.key === "played_longer").fired) throw new Error("one even session must not fire");
});

check("off_queue_song: a non-daily song run fires; the daily song alone does not", () => {
  const actLog = [{ t: T, d: NOW, k: "game", id: "ocean", ok: 30, miss: 10, sec: 90 }];
  const r = joy.joyIndex({ practiceLog: { [NOW]: { n: 1, accSum: 80 } }, actLog, starsById: {}, daily: { id: "minuet" }, moods: [], now: NOW });
  const e = r.evidence.find(x => x.key === "off_queue_song");
  if (!e.fired || !String(e.source).includes("ocean")) throw new Error("self-picked run missed: " + e.source);
  const r2 = joy.joyIndex({ practiceLog: { [NOW]: { n: 1, accSum: 80 } }, actLog: [{ t: T, d: NOW, k: "game", id: "minuet", ok: 30, miss: 10, sec: 90 }], starsById: {}, daily: { id: "minuet" }, moods: [], now: NOW });
  if (r2.evidence.find(x => x.key === "off_queue_song").fired) throw new Error("daily song counted as off-queue");
});

check("first_full_combo: clean run on a song without 3 stars → fires; 3★ song → not again", () => {
  const clean = { t: T, d: NOW, k: "game", id: "twinkle", ok: 40, miss: 0, sec: 0 };
  const r = joy.joyIndex({ practiceLog: { [NOW]: { n: 1, accSum: 95 } }, actLog: [clean], starsById: { twinkle: 2 }, daily: { id: "minuet" }, moods: [], now: NOW });
  const e = r.evidence.find(x => x.key === "first_full_combo");
  if (!e.fired) throw new Error("first clean run missed");
  if (!e.source.includes("tg_stars_")) throw new Error("source must cite star history: " + e.source);
  const r2 = joy.joyIndex({ practiceLog: { [NOW]: { n: 1, accSum: 95 } }, actLog: [clean], starsById: { twinkle: 3 }, daily: { id: "minuet" }, moods: [], now: NOW });
  if (r2.evidence.find(x => x.key === "first_full_combo").fired) throw new Error("3★ song fired again");
});

check("shared_card: share rows in tg_act_log count, and the source says where", () => {
  const actLog = [
    { t: T, d: NOW, k: "share", id: "twinkle", ok: 0, miss: 0, sec: 0 },
    { t: T + 1, d: NOW, k: "share", id: "weekly", ok: 0, miss: 0, sec: 0 },
  ];
  const r = joy.joyIndex({ practiceLog: { [NOW]: { n: 1, accSum: 80 } }, actLog, starsById: {}, daily: null, moods: [], now: NOW });
  const e = r.evidence.find(x => x.key === "shared_card");
  if (!e.fired || e.count !== 2) throw new Error(`fired=${e.fired} count=${e.count}`);
  if (!e.source.includes("tg_act_log")) throw new Error("source: " + e.source);
});

check("score === fired count (no secret weights, no invented numbers)", () => {
  const practiceLog = { "2026-09-28": { n: 1, accSum: 60 }, [NOW]: { n: 2, accSum: 170 } };
  const actLog = [
    { t: T, d: NOW, k: "game", id: "ocean", ok: 30, miss: 10, sec: 60 * 12 },
    { t: T + 1, d: NOW, k: "game", id: "twinkle", ok: 40, miss: 0, sec: 0 },
    { t: T + 2, d: NOW, k: "share", id: "twinkle", ok: 0, miss: 0, sec: 0 },
  ];
  const r = joy.joyIndex({ practiceLog, actLog, starsById: { twinkle: 2 }, daily: { id: "minuet" }, moods: [], now: NOW });
  if (r.fired.length !== r.count || r.score !== r.count) throw new Error(`${r.score} vs fired ${r.fired.length}`);
  if (r.score < 0 || r.score > 5) throw new Error("out of range: " + r.score);
  if (r.count !== 5) throw new Error(`expected all 5 to fire on this dataset, got ${r.count}: ${r.fired.join(",")}`);
});

check("12.2 mood taps are context — they never enter the score", () => {
  const r = joy.joyIndex({ practiceLog: { [NOW]: { n: 1, accSum: 80 } }, actLog: [], starsById: {}, daily: null, moods: [{ songId: "x", v: "good" }, { songId: "y", v: "ok" }, { songId: "z", v: "good" }], now: NOW });
  if (r.mood_taps !== 3) throw new Error("mood taps not reported");
  if (r.score !== 0) throw new Error(`moods leaked into the score (${r.score})`);
});

check("honest-null: no evidence → score null + 'not enough evidence' in 3 languages", () => {
  const r = joy.joyIndex({ practiceLog: {}, actLog: [], starsById: {}, daily: null, moods: [], now: NOW });
  if (r.score !== null) throw new Error("guessed a score: " + r.score);
  if (!r.honestNull || !r.honestNull.th || !r.honestNull.en || !r.honestNull.zh) throw new Error("honestNull not trilingual");
  const empty = joy.joyEmpty("zh");
  if (empty.score !== null || !empty.line) throw new Error("joyEmpty not honest");
});

check("shadow contract: measured, explainable, wired to nothing", () => {
  const r = joy.joyIndex({ practiceLog: { [NOW]: { n: 1, accSum: 80 } }, actLog: [], starsById: {}, daily: null, moods: [], now: NOW });
  if (r.shadow !== true) throw new Error("not marked shadow");
  if (r.enough !== false) throw new Error("12.6 gate must stay closed until 30 loop rounds");
  if (r.signals.length !== 5 || r.of !== 5) throw new Error("vocabulary mismatch");
  for (const lg of ["th", "en", "zh"]) if (!joy.joyNote(lg)) throw new Error(`joyNote.${lg} empty`);
});

check("web.js pass-throughs exist and agree with the module", () => {
  const viaWeb = web.getJoyIndex({ practiceLog: { [NOW]: { n: 1, accSum: 80 } }, actLog: [], starsById: {}, daily: null, moods: [], now: NOW });
  if (!viaWeb || viaWeb.score !== 0) throw new Error("getJoyIndex mismatch: " + JSON.stringify(viaWeb));
  const list = web.joySignalList();
  if (list.length !== 5 || !list[0].label.th) throw new Error("joySignalList broken");
  if (!web.joyShadowNote("en") || !web.joyShadowEmpty("zh").line) throw new Error("note/empty pass-through broken");
  if (web.getJoyIndex(null) === undefined) throw new Error("null opts must return a result object");
});

console.log(`\n  ${passed} passed, ${failed} failed`);
fs.rmSync(OUT, { recursive: true, force: true });
if (failed > 0) process.exit(1);

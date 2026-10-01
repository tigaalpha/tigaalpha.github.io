/* smoke-boredom.mjs — plan v3.8 ระลอก 12 (12.3) boredom-risk (ความเบื่อก่อนเลิกเรียน).
   Proves on REAL code (esbuild + import — repo convention, no mirrors):
     • the risk vocabulary is the KB 6.8 churn list verbatim — 4 risks, every
       one ask:false, every one names its exact KB id (edu:churn:*)
     • every risk explains its source — the evidence names the exact log
       fields it counted (tg_practice_log / tg_act_log / tg_song_mood)
     • case-by-case behaviour on crafted real-shaped rows: wall_too_high
       (recent runs miss over half while still showing up), invisible_progress
       (both weeks ≥3 practice days and the mean did not rise), no_song_love
       (steady practice, zero off-queue runs, zero good moods), lonely_practice
       (steady practice, zero share rows the whole window)
     • score = count of fired risks, 0..4 — no secret weights, no invented
       numbers; boundaries are the DECLARED ones only
     • counter-cases: a healthy dataset fires nothing; moods/joy signals do
       not leak into the boredom score
     • honest-null: no practice at all → score null + the honest-null line;
       n<30 loop rounds → enough:false + enoughNote (the 7.2 rule)
     • shadow contract: displayed in Model Lab only — wired to no decision
     • web.js pass-throughs exist and agree with the module, and the KB the
       engine seeds really contains every cited churn entry id
   Run: node tigamodel/scripts/smoke-boredom.mjs */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const OUT = "/tmp/tiga-smoke-boredom";
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

console.log("tigamodel teaching joy (12.3 boredom risk):");

check("vocabulary: exactly the 4 KB 6.8 churn causes, ask:false, KB ids cited", () => {
  const list = joy.BOREDOM_RISKS;
  if (!Array.isArray(list) || list.length !== 4) throw new Error(`got ${list && list.length}`);
  const want = ["edu:churn:wall-too-high", "edu:churn:invisible-progress", "edu:churn:no-song-love", "edu:churn:lonely-practice"];
  for (const r of list) {
    if (r.ask !== false) throw new Error(`${r.key} allows asking`);
    if (!want.includes(r.kb)) throw new Error(`bad KB id: ${r.kb}`);
    for (const lg of ["th", "en", "zh"]) if (!r.label[lg]) throw new Error(`${r.key}.${lg} missing`);
  }
  if (joy.BOREDOM_WINDOW_DAYS !== 14) throw new Error("window is not the declared 14d");
});

check("vocabulary: frozen — the formula cannot drift silently", () => {
  let froze = false;
  try { joy.BOREDOM_RISKS.push({ key: "x" }); } catch (e) { froze = true; }
  if (!froze || joy.BOREDOM_RISKS.length !== 4) throw new Error("BOREDOM_RISKS is mutable");
});

check("wall_too_high: recent runs miss over half while still showing up → fires", () => {
  const practiceLog = { [NOW]: { n: 1, accSum: 30 }, "2026-09-29": { n: 1, accSum: 35 } };
  const actLog = [
    { t: T, d: NOW, k: "game", id: "sonata", ok: 3, miss: 7, sec: 60 },
    { t: T - DAY, d: "2026-09-29", k: "game", id: "sonata", ok: 4, miss: 6, sec: 60 },
  ];
  const r = joy.boredomRisk({ practiceLog, actLog, daily: null, moods: [], now: NOW });
  const e = r.evidence.find(x => x.key === "wall_too_high");
  if (!e.fired) throw new Error("did not fire (35% recent accuracy)");
  if (!e.source.includes("tg_act_log")) throw new Error("source: " + e.source);
  if (!e.kb || e.kb !== "edu:churn:wall-too-high") throw new Error("KB not cited");
  // counter-case: hard runs but the learner stopped showing up = not the wall case
  const r2 = joy.boredomRisk({ practiceLog: { "2026-09-20": { n: 1, accSum: 30 } }, actLog: [{ t: T - 9 * DAY, d: "2026-09-21", k: "game", id: "x", ok: 3, miss: 7, sec: 60 }], daily: null, moods: [], now: NOW });
  if (r2.evidence.find(x => x.key === "wall_too_high").fired) throw new Error("fired without recent attendance");
});

check("invisible_progress: both weeks ≥3 practice days and no mean gain → fires", () => {
  const practiceLog = {};
  const prevWeek = ["2026-09-17", "2026-09-19", "2026-09-21"];   // inside the 14-day window
  const thisWeek = ["2026-09-24", "2026-09-26", "2026-09-28"];
  prevWeek.forEach((d, i) => { practiceLog[d] = { n: 2, accSum: 2 * (60 + i) }; });
  thisWeek.forEach((d, i) => { practiceLog[d] = { n: 2, accSum: 2 * (60 - i) }; });
  const r = joy.boredomRisk({ practiceLog, actLog: [], daily: null, moods: [], now: NOW });
  const e = r.evidence.find(x => x.key === "invisible_progress");
  if (!e.fired) throw new Error("did not fire (flat accuracy over two real weeks)");
  if (!e.source.includes("tg_practice_log")) throw new Error("source: " + e.source);
  // counter-case: rising accuracy does not fire
  const up = {};
  prevWeek.forEach((d, i) => { up[d] = { n: 2, accSum: 2 * (55 + i) }; });
  thisWeek.forEach((d, i) => { up[d] = { n: 2, accSum: 2 * (80 + i) }; });
  const r2 = joy.boredomRisk({ practiceLog: up, actLog: [], daily: null, moods: [], now: NOW });
  if (r2.evidence.find(x => x.key === "invisible_progress").fired) throw new Error("fired on a rising learner");
});

check("no_song_love: steady practice, zero self-picked runs, zero good moods → fires", () => {
  const practiceLog = { [NOW]: { n: 1, accSum: 70 }, "2026-09-28": { n: 1, accSum: 70 }, "2026-09-26": { n: 1, accSum: 70 } };
  const dailyOnly = [{ t: T, d: NOW, k: "game", id: "daily-song", ok: 30, miss: 5, sec: 90 }];
  const r = joy.boredomRisk({ practiceLog, actLog: dailyOnly, daily: { id: "daily-song" }, moods: [], now: NOW });
  const e = r.evidence.find(x => x.key === "no_song_love");
  if (!e.fired) throw new Error("did not fire");
  if (!e.source.includes("tg_act_log") || !e.source.includes("tg_song_mood")) throw new Error("source: " + e.source);
  // counter-cases: one off-queue run OR one good-mood tap = counter-evidence
  const offQ = [{ t: T, d: NOW, k: "game", id: "my-song", ok: 30, miss: 5, sec: 90 }];
  const r2 = joy.boredomRisk({ practiceLog, actLog: offQ, daily: { id: "daily-song" }, moods: [], now: NOW });
  if (r2.evidence.find(x => x.key === "no_song_love").fired) throw new Error("off-queue run ignored");
  const r3 = joy.boredomRisk({ practiceLog, actLog: dailyOnly, daily: { id: "daily-song" }, moods: [{ t: T, d: NOW, songId: "daily-song", v: "good" }], now: NOW });
  if (r3.evidence.find(x => x.key === "no_song_love").fired) throw new Error("good mood ignored");
});

check("lonely_practice: ≥5 practice days, zero share rows in the window → fires", () => {
  const practiceLog = {};
  for (let i = 0; i < 5; i++) { const d = new Date(T - i * DAY); const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); practiceLog[k] = { n: 1, accSum: 70 }; }
  const r = joy.boredomRisk({ practiceLog, actLog: [], daily: null, moods: [], now: NOW });
  const e = r.evidence.find(x => x.key === "lonely_practice");
  if (!e.fired) throw new Error("did not fire");
  if (!e.source.includes("k=share")) throw new Error("source: " + e.source);
  // counter-case: a share inside the window = someone saw the playing
  const r2 = joy.boredomRisk({ practiceLog, actLog: [{ t: T, d: NOW, k: "share", id: "twinkle", ok: 0, miss: 0, sec: 0 }], daily: null, moods: [], now: NOW });
  if (r2.evidence.find(x => x.key === "lonely_practice").fired) throw new Error("share row ignored");
});

check("score = fired count 0..4; a healthy dataset fires nothing", () => {
  const practiceLog = {};
  const actLog = [];
  // rising learner, both weeks ≥3 days, sharing, off-queue picks, good moods
  for (let i = 0; i < 12; i++) {
    const ts = T - (11 - i) * DAY;
    const d = new Date(ts); const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    practiceLog[k] = { n: 1, accSum: 55 + i * 3 };
    if (i % 2 === 0) actLog.push({ t: ts, d: k, k: "game", id: i < 6 ? "daily-song" : "my-song", ok: 30, miss: 20 - i, sec: 60 * 5 });
  }
  actLog.push({ t: T, d: NOW, k: "share", id: "my-song", ok: 0, miss: 0, sec: 0 });
  const r = joy.boredomRisk({ practiceLog, actLog, daily: { id: "daily-song" }, moods: [{ t: T, d: NOW, songId: "my-song", v: "good" }], now: NOW });
  if (r.score !== 0) throw new Error(`healthy learner flagged: ${r.fired.join(",")}`);
  if (r.of !== 4 || r.count !== r.fired.length || r.score < 0 || r.score > 4) throw new Error("score contract broken");
});

check("joy signals and boredom risks are separate equations (no leakage)", () => {
  const practiceLog = { [NOW]: { n: 1, accSum: 70 } };
  const rB = joy.boredomRisk({ practiceLog, actLog: [], daily: null, moods: [], now: NOW });
  const rJ = joy.joyIndex({ practiceLog, actLog: [], starsById: {}, daily: null, moods: [], now: NOW });
  if (rJ.score !== null && rJ.score !== 0) throw new Error("joy score unexpected");
  for (const k of ["came_back_soon", "played_longer", "off_queue_song", "first_full_combo", "shared_card"]) if (rB.signals.includes(k)) throw new Error(`joy signal ${k} leaked into boredom`);
  for (const k of ["wall_too_high", "invisible_progress", "no_song_love", "lonely_practice"]) if (rJ.signals.includes(k)) throw new Error(`boredom risk ${k} leaked into joy`);
});

check("honest-null + n<30 rule: no practice → null; any data → enough:false + note", () => {
  const empty = joy.boredomRisk({ practiceLog: {}, actLog: [], daily: null, moods: [], now: NOW });
  if (empty.score !== null) throw new Error("guessed a score: " + empty.score);
  if (!empty.honestNull || !empty.honestNull.en) throw new Error("honestNull missing");
  const some = joy.boredomRisk({ practiceLog: { [NOW]: { n: 1, accSum: 70 } }, actLog: [], daily: null, moods: [], now: NOW });
  if (some.enough !== false) throw new Error("12.6 gate must stay closed until 30 loop rounds");
  if (!some.enoughNote || !some.enoughNote.th || !some.enoughNote.en || !some.enoughNote.zh) throw new Error("enoughNote not trilingual");
  if (some.shadow !== true) throw new Error("not marked shadow");
});

check("web.js pass-throughs exist, and the seeded KB really has every cited churn entry", () => {
  const viaWeb = web.getBoredomRisk({ practiceLog: { [NOW]: { n: 1, accSum: 70 } }, actLog: [], daily: null, moods: [], now: NOW });
  if (!viaWeb || viaWeb.of !== 4) throw new Error("getBoredomRisk mismatch");
  if (web.getBoredomRisk(null) === undefined) throw new Error("null opts must return a result object");
  const list = web.boredomRiskList();
  if (list.length !== 4 || list[0].kb !== "edu:churn:wall-too-high") throw new Error("boredomRiskList broken");
  const kb = getKb();
  function getKb() { try { return web.getKnowledgeBaseForTest(); } catch (e) { return null; } }
  for (const r of list) {
    let entry = null;
    try { entry = kb && (typeof kb.get === "function" ? kb.get(r.kb) : null); } catch (e) {}
    if (!entry) throw new Error(`KB missing cited entry: ${r.kb}`);
    if (!entry.body || !entry.body.length) throw new Error(`KB entry ${r.kb} empty`);
  }
});

check("12.4 helper: high risk → swap reason cites KB; low data → honest null", () => {
  const kb = (() => { try { return web.getKnowledgeBaseForTest(); } catch (e) { return null; } })();
  const high = joy.boredomResponse(kb, { score: 3, fired: ["no_song_love"], enough: false, evidence: [] }, "en");
  if (!high || !high.change || high.change !== true) throw new Error("high risk must swap the plan");
  if (!high.reason || !high.reason.en || !high.reason.th || !high.reason.zh) throw new Error("reason not trilingual");
  if (!Array.isArray(high.sources) || !high.sources.includes("edu:churn:no-song-love") || !high.sources.includes("mkt:hook:chorus-first")) throw new Error(`audit trail must cite both KB ids: ${JSON.stringify(high.sources)}`);
  if (!high.via) throw new Error("via label missing");
  const none = joy.boredomResponse(kb, null, "en");
  if (none !== null) throw new Error("no data must respond null (do exactly as before)");
  const calm = joy.boredomResponse(kb, { score: 3, fired: ["wall_too_high"], enough: false, evidence: [] }, "zh");
  if (!calm || calm.mode !== "relax") throw new Error("wall_too_high should route to relax mode, got " + (calm && calm.mode));
  if (!calm.sources.includes("edu:churn:wall-too-high") || !calm.sources.includes("thx:practice:calm-session")) throw new Error(`relax audit trail broken: ${JSON.stringify(calm.sources)}`);
});

console.log(`\n  ${passed} passed, ${failed} failed`);
fs.rmSync(OUT, { recursive: true, force: true });
if (failed > 0) process.exit(1);

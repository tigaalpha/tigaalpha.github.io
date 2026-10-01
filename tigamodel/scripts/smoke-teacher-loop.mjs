/* smoke-teacher-loop.mjs — plan v3.8 ระลอก 13 (13.3) teacher-outcome loop v1.
   Proves on REAL code (esbuild + import — repo convention, no mirrors):
     • recordTeacherOutcome appends through the CALLER's appender (the model
       never touches the network) and maps the advice's 1-week result onto
       4.4's RPC contract with NO schema change: surface="practice",
       strategy_id="teacher:<student>:<focus>", outcome +1/0/-1 from the
       accuracy the advice produced, accuracy_bucket from the same bands the
       RPC validates (0:<50 1:50-74 2:75-89 3:>=90)
     • every emitted payload passes the migration's own validation rules
       (checked here against a validator mirroring supabase-strategy-outcomes-
       migration.sql — the smoke reds if the mapping ever drifts from 4.4)
     • malformed calls never append and never throw (null)
     • teacherEvidenceShape: only real aggregate evidence speaks ({total,
       winRate}); empty/zero/malformed → null (honest-null = แนะนำแบบเดิม)
     • teacherAdviceWithEvidence: real advice from a REAL progress snapshot,
       outcomeNote filled ONLY with evidence, byte-identical advice otherwise
     • teacherAdviceFor keeps its shape (outcomeNote slot exists, null)
   Run: node tigamodel/scripts/smoke-teacher-loop.mjs */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const OUT = "/tmp/tiga-smoke-teacher";
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

fs.rmSync(OUT, { recursive: true, force: true });
execSync(
  `npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/web.js --format=esm --platform=node --loader:.js=js --log-level=error`,
  { stdio: "pipe", cwd: ROOT }
);
const web = await import(url.pathToFileURL(path.join(OUT, "web.js")).href);

let passed = 0, failed = 0;
function check(label, fn) {
  try { fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n     ${e.message}`); }
}

console.log("tigamodel teaching (13.3 teacher-outcome loop):");

/* a validator that mirrors supabase-strategy-outcomes-migration.sql exactly */
function rpcValidate(p) {
  if (!p || typeof p !== "object") return false;
  if (!p.p_strategy_id || typeof p.p_strategy_id !== "string" || p.p_strategy_id.length === 0 || p.p_strategy_id.length > 80) return false;
  if (!["practice", "song", "sight_reading", "camera"].includes(p.p_surface)) return false;
  if (!["th", "en", "zh"].includes(p.p_lang)) return false;
  if (p.p_self_report != null && !["too_easy", "too_hard", "understand", "confused", "retry", "frustrated", "great"].includes(p.p_self_report)) return false;
  if (![-1, 0, 1].includes(p.p_outcome)) return false;
  const b = p.p_accuracy_bucket == null ? 1 : p.p_accuracy_bucket;
  if (!(b >= 0 && b <= 3)) return false;
  return true;
}

check("recordTeacherOutcome: appends via the caller's appender, payload passes 4.4's RPC validation", () => {
  const seen = [];
  const ok = web.recordTeacherOutcome((p) => { seen.push(p); return rpcValidate(p); }, {
    studentId: "stu-9f2",
    advice: { focus: { label: "Rhythm in 6/8" }, summary: { avgAcc: 81 } },
    oneWeekAgo: { avgAcc: 72 },
  });
  if (!ok || !ok.strategy_id) throw new Error("no result");
  if (seen.length !== 1) throw new Error(`appended ${seen.length} rows`);
  const p = seen[0];
  if (p.p_strategy_id !== "teacher:stu-9f2:Rhythm in 6/8") throw new Error(`strategy_id: ${p.p_strategy_id}`);
  if (p.p_surface !== "practice" || p.p_lang === "en") throw new Error("mapping drifted from the 4.4 contract");
  if (p.p_outcome !== 1) throw new Error(`outcome ${p.p_outcome}, expected +1 (72→81)`);
  if (p.p_accuracy_bucket !== 2) throw new Error(`bucket ${p.p_accuracy_bucket}, expected 2 (75-89)`);
  if (!rpcValidate(p)) throw new Error("payload would be rejected by the RPC");
});

check("outcome bands: better/flat/worse map to +1/0/-1; bucket follows the accuracy bands", () => {
  const cases = [
    { before: 70, after: 70, outcome: 0, bucket: 1 },
    { before: 80, after: 66, outcome: -1, bucket: 1 },
    { before: 40, after: 93, outcome: 1, bucket: 3 },
    { before: 45, after: 49, outcome: 1, bucket: 0 },
  ];
  for (const c of cases) {
    const seen = [];
    web.recordTeacherOutcome((p) => { seen.push(p); return true; }, {
      studentId: "s",
      advice: { focus: { label: "x" }, summary: { avgAcc: c.after } },
      oneWeekAgo: { avgAcc: c.before },
    });
    if (seen[0].p_outcome !== c.outcome || seen[0].p_accuracy_bucket !== c.bucket) {
      throw new Error(`${c.before}→${c.after}: got outcome ${seen[0].p_outcome} bucket ${seen[0].p_accuracy_bucket}`);
    }
  }
});

check("missing 1-week data → outcome 0 (never a guessed direction), still a valid row", () => {
  const seen = [];
  const ok = web.recordTeacherOutcome((p) => { seen.push(p); return rpcValidate(p); }, {
    studentId: "s2",
    advice: { focus: { label: "Pedal" }, summary: { avgAcc: null } },
    oneWeekAgo: null,
  });
  if (!ok || seen.length !== 1) throw new Error("no append");
  if (seen[0].p_outcome !== 0) throw new Error(`outcome ${seen[0].p_outcome} without evidence`);
});

check("malformed calls never append and never throw", () => {
  let calls = 0;
  const appender = () => { calls++; return true; };
  if (web.recordTeacherOutcome(null, { advice: {} }) !== null) throw new Error("null appender accepted");
  if (web.recordTeacherOutcome(appender, null) !== null) throw new Error("null advice accepted");
  if (web.recordTeacherOutcome(appender, { advice: "nope" }) !== null) throw new Error("string advice accepted");
  if (calls !== 0) throw new Error(`appender fired ${calls}×`);
  // appender that reports failure → null result, honest
  if (web.recordTeacherOutcome(() => false, { studentId: "s", advice: { focus: { label: "x" }, summary: {} }, oneWeekAgo: null }) !== null) throw new Error("failed append must return null");
});

check("teacherEvidenceShape: only real aggregates speak; empty/malformed → null", () => {
  if (web.teacherEvidenceShape(null) !== null) throw new Error("null accepted");
  if (web.teacherEvidenceShape({}) !== null) throw new Error("no-counts accepted");
  if (web.teacherEvidenceShape({ counts: {} }) !== null) throw new Error("zero evidence accepted");
  if (web.teacherEvidenceShape({ counts: { "1": 0, "0": 0, "-1": 0 } }) !== null) throw new Error("all-zero accepted");
  const ev = web.teacherEvidenceShape({ counts: { "1": 3, "0": 1, "-1": 1 } });
  if (!ev || ev.total !== 5 || Math.abs(ev.winRate - 0.6) > 1e-9) throw new Error(`shape: ${JSON.stringify(ev)}`);
});

check("teacherAdviceWithEvidence: real advice, outcomeNote only with evidence, unchanged otherwise", () => {
  const pr = {
    practiceLog: { "2026-09-29": { n: 2, accSum: 150 }, "2026-09-30": { n: 1, accSum: 82 } },
    memory: { struggles: [{ label: "LH coordination", acc: 42, last: Date.now() }], noteMisses: [{ label: "F#4", count: 4, last: Date.now() }], mastered: [], recent: [] },
    summary: { avgAcc: 77, games: 6, pathDone: 3 },
    streak: { count: 4 },
  };
  const plain = web.teacherAdviceFor(pr);
  const withEv = web.teacherAdviceWithEvidence(pr, { counts: { "1": 4, "0": 1, "-1": 0 } });
  if (!plain || !withEv) throw new Error("advice missing");
  if (plain.outcomeNote !== null) throw new Error("bare advice must carry outcomeNote:null");
  if (!withEv.outcomeNote || withEv.outcomeNote.total !== 5 || Math.abs(withEv.outcomeNote.winRate - 0.8) > 1e-9) throw new Error("evidence note wrong");
  for (const lg of ["th", "en", "zh"]) if (!withEv.outcomeNote[lg]) throw new Error(`note.${lg} missing`);
  const noEv = web.teacherAdviceWithEvidence(pr, null);
  if (JSON.stringify(noEv) !== JSON.stringify(plain)) throw new Error("advice changed without evidence — must stay แนะนำแบบเดิม");
});

check("teacherAdviceFor shape intact (flags/focus/plan/summary/outcomeNote)", () => {
  const adv = web.teacherAdviceFor({
    practiceLog: { "2026-09-30": { n: 1, accSum: 80 } },
    memory: {}, summary: {}, streak: { count: 1 },
  });
  if (!adv) throw new Error("advice null");
  for (const k of ["flags", "focus", "plan", "summary", "outcomeNote"]) if (!(k in adv)) throw new Error(`missing key ${k}`);
});

console.log(`\n  ${passed} passed, ${failed} failed`);
fs.rmSync(OUT, { recursive: true, force: true });
if (failed > 0) process.exit(1);

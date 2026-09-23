/* smoke-diagnosis.mjs — AI PIANO COACH P0 (master product directive).
   Proves on REAL code:
     • diagnosis (WHAT/WHY/HOW) from real tg_memory shapes; null when no data
     • trend detection (improving/worsening/steady) from recent history
     • practice budget sums EXACTLY to the requested minutes (5-120)
     • short sessions drop low-leverage blocks (honest, never invented)
     • snapshot reports honest gaps (age/goal/genre stay absent)
     • coach prompt block carries WHAT/WHY/HOW and is empty with no data
   Run: node tigamodel/scripts/smoke-diagnosis.mjs */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const OUT = "/tmp/tiga-smoke-diagnosis";
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

fs.rmSync(OUT, { recursive: true, force: true });
/* diagnosis.js is dependency-free → plain transpile; web.js needs a bundle
   (its import tree pulls the whole model) — mirror the two shapes. */
execSync(`npx esbuild tigamodel/coach/diagnosis.js --outdir=${OUT} --format=esm --platform=node --loader:.js=js --log-level=error`, { stdio: "pipe", cwd: ROOT });
execSync(`npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/web-bundle.js --format=esm --platform=node --loader:.js=js --log-level=error`, { stdio: "pipe", cwd: ROOT });
const dx = await import(url.pathToFileURL(path.join(OUT, "diagnosis.js")).href);
const web = await import(url.pathToFileURL(path.join(OUT, "web-bundle.js")).href);

let passed = 0, failed = 0;
function check(label, fn) {
  try { fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n     ${e.message}`); }
}

const MEMORY = {
  struggles: [
    { label: "คอร์ด C→G มือซ้าย", acc: 55, count: 4, interval: 1 },
    { label: "จังหวะครึ่งจังหวะ", acc: 70, count: 1, interval: 2 },
  ],
  mastered: ["คอร์ด C major", "บันได C major"],
  recent: [
    { label: "คอร์ด C→G มือซ้าย", acc: 48, t: "d1" },
    { label: "คอร์ด C→G มือซ้าย", acc: 61, t: "d2" },
    { label: "คอร์ด C major", acc: 95, t: "d1" },
  ],
  sessions: 14,
};
const LOG = { _recent: [{ d: "a", acc: 72 }, { d: "b", acc: 64 }] };

async function main() {
  console.log("tigamodel AI piano coach (diagnosis/budget/snapshot) smoke:");

  check("WHAT picks the most-repeated lowest-accuracy struggle", () => {
    const d = dx.buildDiagnosis({ memory: MEMORY, practiceLog: LOG });
    if (d.what.label !== "คอร์ด C→G มือซ้าย") throw new Error(d.what.label);
    if (d.what.acc !== 55 || d.what.count !== 4) throw new Error("wrong acc/count");
  });

  check("WHY claims are backed by real numbers (no invention)", () => {
    const d = dx.buildDiagnosis({ memory: MEMORY });
    if (!d.why.some(w => w.includes("4 ครั้ง") && w.includes("55%"))) throw new Error("count/acc not cited");
    if (!d.why.some(w => w.includes("แนวโน้ม"))) throw new Error("trend not cited");
  });

  check("HOW gives concrete BPM/reps/minutes", () => {
    const d = dx.buildDiagnosis({ memory: MEMORY });
    if (!d.meta.bpm || !d.meta.reps || !d.meta.minutes) throw new Error("missing meta");
    if (!d.how.some(h => h.includes("BPM"))) throw new Error("no BPM in how");
  });

  check("trend: worsening when latest drops ≥8 vs previous", () => {
    const d = dx.buildDiagnosis({ memory: MEMORY });
    if (d.what.trend !== "worsening") throw new Error(d.what.trend);
  });

  check("honest gap: no data → diagnosis null + empty prompt block", () => {
    if (dx.buildDiagnosis({}) !== null) throw new Error("invented a diagnosis");
    if (dx.buildCoachContextBlock({}) !== "") throw new Error("invented a block");
  });

  check("budget sums EXACTLY to requested minutes (5-120)", () => {
    for (let t = 5; t <= 120; t++) {
      const b = dx.practiceTimeBudget(t, { memory: MEMORY });
      const sum = b.parts.reduce((a, p) => a + p.minutes, 0);
      if (sum !== t) throw new Error(`${t}min → ${sum}`);
    }
  });

  check("short sessions drop low-leverage blocks (never fake-minutes)", () => {
    const b5 = dx.practiceTimeBudget(5, { memory: MEMORY });
    if (b5.parts.length !== 2) throw new Error(`5min has ${b5.parts.length} parts`);
    const b20 = dx.practiceTimeBudget(20, { memory: MEMORY });
    if (b20.parts.length !== 5) throw new Error(`20min has ${b20.parts.length} parts`);
  });

  check("problem block focuses the real top struggle", () => {
    const b = dx.practiceTimeBudget(20, { memory: MEMORY });
    if (b.focus !== "คอร์ด C→G มือซ้าย") throw new Error(b.focus);
    const prob = b.parts.find(p => p.key === "problem");
    if (prob.label !== b.focus) throw new Error("problem block unlabeled");
  });

  check("snapshot: strengths/weaknesses from real data + honest gaps", () => {
    const s = dx.buildStudentSnapshot({ memory: MEMORY, practiceLog: LOG });
    if (s.sessions !== 14) throw new Error("sessions");
    if (s.avgAcc30 !== 68) throw new Error(`avgAcc30 ${s.avgAcc30}`);
    if (!s.strengths.includes("คอร์ด C major")) throw new Error("strengths");
    if (s.weaknesses[0].state !== "weak") throw new Error("state");
    if (!s.gaps.includes("age_group") || !s.gaps.includes("goal")) throw new Error("gaps must stay absent");
  });

  check("coach prompt block carries WHAT/WHY/HOW + snapshot", () => {
    const block = dx.buildCoachContextBlock({ memory: MEMORY, practiceLog: LOG });
    if (!block.includes("WHAT:") || !block.includes("WHY:") || !block.includes("HOW:")) throw new Error("missing dx lines");
    if (!block.includes("ความแม่นเฉลี่ย 30 วัน 68%")) throw new Error("missing snapshot");
  });

  check("web.js exports production surface + reads real LS keys", () => {
    if (typeof web.getCoachDiagnosis !== "function" || typeof web.getPracticeTimeBudget !== "function" || typeof web.getCoachContextBlock !== "function") {
      throw new Error("missing exports");
    }
    // node has no localStorage — the getters must degrade to null/"" (honest gap)
    if (web.getCoachDiagnosis() !== null) throw new Error("must be null without LS");
    if (web.getCoachContextBlock() !== "") throw new Error("must be empty without LS");
  });

  console.log(`\n  ${passed} passed, ${failed} failed`);
  fs.rmSync(OUT, { recursive: true, force: true });
  if (failed > 0) process.exit(1);
}

main().catch((e) => { console.error("SMOKE FAIL:", e.message); process.exit(1); });

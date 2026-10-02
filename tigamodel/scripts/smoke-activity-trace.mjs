// smoke-activity-trace.mjs — proves the gate that decides which act-log rows
// become real rows in the learning_* tables.
//
// WHY: P0 fixed the gate that had silently swallowed every trace (see
// smoke-learning-wire.mjs), but a second hole was still open — only
// practice-mode ever wrote a trace. A learner who practises ear gym or sight
// reading every day left nothing at all on the server, which is the same
// "no data = no teacher" problem wearing a different hat.
//
// The honesty rules that matter here are VOLUME ones: a stray tap must not
// become a fact, the same skill must not be counted 40 times in one day, and
// a day must not grow without bound. They live in activity-trace.ts (pure, no
// storage) so they can be pinned by a fixture instead of trusted.
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dir = mkdtempSync(join(tmpdir(), "smoke-trace-"));
await build({
  entryPoints: [new URL("../../activity-trace.ts", import.meta.url).pathname],
  bundle: true, platform: "node", format: "esm", outfile: join(dir, "trace.mjs"),
});
const A = await import(pathToFileURL(join(dir, "trace.mjs")).href);
rmSync(dir, { recursive: true, force: true });

let pass = 0, fail = 0;
const t = (name, cond) => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}`); } };
console.log("smoke-activity-trace — ทุกอย่างที่ซ้อมต้องเป็นหลักฐาน 1 รอบ (ไม่เกินจริง)\n");

const act = (k, id, ok, miss, sec = 120, skill = null) => {
  const e = { t: Date.now(), d: "2026-10-02", k, id, ok, miss, sec };
  if (skill) e.skill = skill;
  return e;
};
let state = { day: "2026-10-02", sent: {} };

/* 1. a practice round is not this module's business (it has its own writer) */
t("practice-mode entries are ignored here (already written elsewhere)",
  A.shouldTraceActEntry(act("game", "ode", 5, 1), state).ok === false);
t("lessons / voice carry no correctness signal → ignored",
  A.shouldTraceActEntry(act("lesson", "basics/C", 0, 0), state).ok === false);

/* 2. a stray tap is not a practice round */
t("4 attempts is play, not a round", A.shouldTraceActEntry(act("ear", "int", 3, 1), state).why === "too-few");
t("5 attempts is a round", A.shouldTraceActEntry(act("ear", "int", 4, 1), state).ok === true);

/* 3. the daily cap and the one-per-skill-per-day rule are what keep the
      numbers honest — 40 rows of the same exercise is not 40 facts */
{
  let s = { day: "2026-10-02", sent: {} };
  let written = 0;
  for (let i = 0; i < 40; i++) {
    const v = A.shouldTraceActEntry(act("ear", "chord", 6, 2), s);
    if (v.ok) { written++; s = A.bumpTraceState(s, v.key); }
  }
  t("the same ear drill 40 times in one day → ONE trace, not 40", written === 1);
  t("a second entry of the same skill today is refused", A.shouldTraceActEntry(act("ear", "chord", 6, 2), s).why === "already-today");
  t("a DIFFERENT skill today still gets through", A.shouldTraceActEntry(act("read", "rhythm-1", 6, 2), s).ok === true);
}
{
  let s = { day: "2026-10-02", sent: {} };
  let written = 0;
  for (let i = 0; i < 30; i++) {
    const v = A.shouldTraceActEntry(act("read", "drill-" + i, 6, 2), s);
    if (v.ok) { written++; s = A.bumpTraceState(s, v.key); }
  }
  t("30 different drills in one day → capped at the daily ceiling", written === A.TRACE_MAX_PER_DAY);
  t("past the ceiling nothing more is written", A.shouldTraceActEntry(act("read", "drill-99", 6, 2), s).why === "day-cap");
}

/* 4. a new day starts a fresh budget — yesterday's silence must not mute today */
{
  const yesterday = { day: "2026-09-30", sent: { "ear|int": 1 } };
  t("yesterday's trace does not block today", A.shouldTraceActEntry(act("ear", "int", 6, 2), yesterday).ok === true);
  const next = A.bumpTraceState(yesterday, "ear|int");
  t("bumping on a new day resets the counter", A.traceDayCount(next) === 1 && next.day !== yesterday.day);
  t("bumping never mutates the state it was given", A.traceDayCount(yesterday) === 1);
}

/* 5. the payload is FACTS ONLY — what the engine measured, no opinion */
{
  const tr = A.actEntryToTrace(act("ear", "chord", 6, 2, 90), "Ear gym · chord");
  t("accuracy is computed from the counts, not invented", tr.accuracy === 75 && tr.attempts === 8 && tr.misses === 2);
  t("the skill is named from the entry, the label is kept for display", tr.skill === "ear_training" && tr.label === "Ear gym · chord");
  t("an explicit skill tag wins over the kind guess", A.actEntryToTrace(act("game", "x", 5, 0, 30, "dynamics")).skill === "dynamics");
  t("sight reading maps to its own skill", A.actEntryToTrace(act("read", "rhythm-1", 6, 2)).skill === "sight_reading");
  t("an entry with no attempts produces nothing (not a 0)", A.actEntryToTrace(act("ear", "x", 0, 0)) === null);
  t("garbage in → null out, never a crash", A.actEntryToTrace(null) === null && A.actEntryToTrace({}) === null);
}

/* 6. missing/garbage state must not open the floodgates */
t("no state at all still enforces the minimum", A.shouldTraceActEntry(act("ear", "int", 1, 0), null).why === "too-few");
t("garbage state does not throw", A.shouldTraceActEntry(act("ear", "int", 6, 2), { sent: "nope" }).ok === true);
t("negative counts cannot fake a round", A.shouldTraceActEntry(act("ear", "int", -9, -9), state).ok === false);

console.log(`\n${pass} ผ่าน · ${fail} ไม่ผ่าน`);
process.exit(fail ? 1 : 0);
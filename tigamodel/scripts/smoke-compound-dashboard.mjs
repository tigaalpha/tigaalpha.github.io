/* Smoke: the compound dashboard (docs/12 §2, m41) and the before/after proof
   (docs/08, m24) — both on the REAL modules, on fixtures whose answers are
   known by hand.

   What is proven here:
     A. the board: every cell is either a counted number or "unavailable";
        the bars are the plan's own 20 / 50; no cell can ever be an estimate;
        a single window cannot become a trend; the switch state is reported.
     B. the proof: first-vs-latest on the SAME skill only, missing scores are
        skipped not guessed, one run never becomes a trend, different skills
        are never compared, an empty table says so instead of drawing 0%.

   Run: node tigamodel/scripts/smoke-compound-dashboard.mjs  (exit 1 on any fail) */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-smoke-compound";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p4`, { recursive: true });
execSync(`npx esbuild tigamodel/evaluation/compound-dashboard.js --bundle --outfile=${OUT}/p4/board.js --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });
execSync(`npx esbuild tigamodel/evaluation/before-after.js --bundle --outfile=${OUT}/p4/proof.js --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });

const { compoundBoard, renderBoardLines, LOOP_BARS } = await import(pathToFileURL(`${OUT}/p4/board.js`).href);
const { beforeAfterBoard, learnerProof, pctChange, orderRows } = await import(pathToFileURL(`${OUT}/p4/proof.js`).href);

let passed = 0, failed = 0;
const check = (name, fn) => {
  try { fn(); console.log(`  ✅ ${name}`); passed++; }
  catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
};

console.log("smoke-compound-dashboard (docs/12 §2 m41 + docs/08 m24):\n");

const cellsOf = (board) => board.loops.flatMap(l => l.metrics);
const named = (board, name) => cellsOf(board).find(m => m.name.includes(name));

console.log("A) แดชบอร์ดวงจร A→B→C");
check("the bars are the plan's own numbers (20 learners / 50 outcomes)", () => {
  assert.strictEqual(LOOP_BARS.plans, 20, "m08 acceptance: first 20 learners");
  assert.strictEqual(LOOP_BARS.outcomes, 50, "m40 pre-committed switch-on bar");
});

check("a missing count is 'unavailable' — never 0, never an estimate", () => {
  const board = compoundBoard({}, {});
  for (const m of cellsOf(board)) assert.strictEqual(m.status, "unavailable", m.name);
  const lines = renderBoardLines(board);
  assert.ok(lines.every(l => l.includes("ไม่ประมาณ")), "every line says it is not an estimate");
});

check("one bad value cannot poison the board — malformed input never throws", () => {
  for (const bad of [null, undefined, NaN, "12", {}, []]) {
    const board = compoundBoard({ outcomes: bad, skillStateLearners: bad }, { personalizedPlans: "yes" });
    assert.ok(Array.isArray(board.loops) && board.loops.length === 3);
    for (const l of board.loops) for (const m of l.metrics) assert.ok(m.value === null || m.value >= 0);
  }
  assert.strictEqual(compoundBoard(null, null).summary.of, 7, "the shape is fixed even for null input");
});

check("real counts come through as measured, and the summary counts them", () => {
  const board = compoundBoard({
    skillStateRows: 34, skillStateLearners: 21,
    outcomes: 60, outcomesRecent: 12, outcomesPrior: 5, strategiesWithOutcomes: 4,
    diagnosesWithSkill: 9, unanswerableBefore: 50, unanswerableAfter: 20,
  }, { personalizedPlans: true });
  assert.strictEqual(named(board, "learners with skill state").value, 21);
  assert.strictEqual(named(board, "learners with skill state").status, "measured");
  assert.strictEqual(board.summary.measured, 7, "every cell is measurable with this input");
  assert.strictEqual(board.summary.unavailable, 0);
});

check("a trend needs TWO windows — one real window is not a trend", () => {
  const one = compoundBoard({ outcomes: 30, outcomesRecent: 7 }, {});
  const trend = named(one, "เพิ่มจากสัปดาห์ก่อน");
  assert.strictEqual(trend.status, "unavailable", "recent without prior cannot be a delta");
  const two = compoundBoard({ outcomes: 30, outcomesRecent: 7, outcomesPrior: 2 }, {});
  const d = named(two, "เพิ่มจากสัปดาห์ก่อน");
  assert.strictEqual(d.status, "measured");
  assert.strictEqual(d.value, 5, "7 − 2 = 5 real new outcomes");
  assert.ok(named(two, "เพิ่มจากสัปดาห์ก่อน").value < 0 || named(two, "เพิ่มจากสัปดาห์ก่อน").value === 5, "no rounding surprises");
});

check("the unanswerable-rate cell stays unavailable without a real before/after pair", () => {
  const none = compoundBoard({ diagnosesWithSkill: 3 }, {});
  const c = named(none, "ตอบไม่ได้");
  assert.strictEqual(c.status, "unavailable", "one point in time cannot become a percentage");
  const pair = compoundBoard({ diagnosesWithSkill: 3, unanswerableBefore: 40, unanswerableAfter: 16 }, {});
  const measured = named(pair, "ตอบไม่ได้");
  assert.strictEqual(measured.status, "measured");
  assert.strictEqual(measured.value, 60, "(40−16)/40 = −60%");
  assert.strictEqual(measured.bar, 50, "docs/05 §9 target: −50%");
  const zeroBase = compoundBoard({ unanswerableBefore: 0, unanswerableAfter: 0 }, {});
  assert.strictEqual(named(zeroBase, "ตอบไม่ได้").status, "unavailable", "a 0% base has no percentage");
});

check("loop readiness follows the plan's bars AND the owner's switch", () => {
  const off = compoundBoard({ skillStateLearners: 25, outcomes: 60, strategiesWithOutcomes: 3 }, { personalizedPlans: false });
  assert.strictEqual(off.loops[0].ready, false, "loop A is not ready while the switch is off");
  assert.ok(off.loops[0].note.includes("tiga_personalized_plans"), "the board names the switch it waits for");
  const on = compoundBoard({ skillStateLearners: 25, outcomes: 60, strategiesWithOutcomes: 3 }, { personalizedPlans: true });
  assert.strictEqual(on.loops[0].ready, true, "25 ≥ 20 learners with the switch on");
  assert.strictEqual(on.loops[1].ready, true, "60 ≥ 50 outcomes with a leading strategy");
  assert.strictEqual(on.loops[2].ready, false, "loop C needs the wave baseline");
  assert.strictEqual(on.summary.loopsReady, 2);
});

check("below the bar the note names the real gap, never a rounded success", () => {
  const board = compoundBoard({ outcomes: 5, strategiesWithOutcomes: 1 }, {});
  assert.strictEqual(board.loops[1].ready, false);
  assert.ok(board.loops[1].note.includes("45"), "5 outcomes → the real gap (50−5)");
  assert.strictEqual(compoundBoard({ outcomes: 5 }, {}).loops[1].ready, false, "no strategies → still not ready");
});

check("deterministic: the same input prints the same board", () => {
  const counts = { outcomes: 12, outcomesRecent: 3, outcomesPrior: 1, skillStateLearners: 4 };
  assert.strictEqual(renderBoardLines(compoundBoard(counts)).join("|"), renderBoardLines(compoundBoard(counts)).join("|"));
});

console.log("\nB) หลักฐานก่อน-หลังรายคน (m24)");
const row = (o) => ({ skill: "note_accuracy", created_at: "2026-10-01T10:00:00Z", duration_sec: 300, score_before: 60, score_after: 70, ...o });
const rows = [
  row({ created_at: "2026-10-01T10:00:00Z", score_before: 60, score_after: 70 }),
  row({ created_at: "2026-10-08T10:00:00Z", score_before: 70, score_after: 78 }),
  row({ created_at: "2026-10-15T10:00:00Z", score_before: 78, score_after: 84 }),
];

check("pctChange: only from two real numbers, and never from a zero base", () => {
  assert.strictEqual(pctChange(60, 70), 16.7);
  assert.strictEqual(pctChange(84, 60), -28.6);
  assert.strictEqual(pctChange(0, 50), null, "no percentage off a zero base");
  assert.strictEqual(pctChange(null, 50), null);
  assert.strictEqual(pctChange(60, NaN), null);
});

check("the proof compares the FIRST and the LATEST run on the same skill", () => {
  const p = learnerProof(rows);
  assert.strictEqual(p.sessions, 3);
  assert.strictEqual(p.skill, "note_accuracy");
  assert.strictEqual(p.from, 70, "what the first run ended at");
  assert.strictEqual(p.to, 84, "where the latest run ended");
  assert.strictEqual(p.deltaPts, 14);
  assert.strictEqual(p.pct, 20, "14/70 = 20%");
  assert.strictEqual(p.days, 14);
  assert.strictEqual(p.insufficient, false);
});

check("row order is the table's own created_at, not the query's order", () => {
  const shuffled = [rows[2], rows[0], rows[1]];
  assert.strictEqual(learnerProof(shuffled).to, 84);
  assert.deepStrictEqual(orderRows(shuffled).map(r => r.created_at), orderRows(rows).map(r => r.created_at));
});

check("a run with no score is still a real session but never a score claim", () => {
  const p = learnerProof([{ skill: "rhythm", created_at: "2026-10-01T10:00:00Z", duration_sec: 240 }]);
  assert.strictEqual(p.sessions, 1, "the session is real");
  assert.strictEqual(p.minutes, 4);
  assert.strictEqual(p.skill, null);
  assert.strictEqual(p.deltaPts, null, "no score, no delta");
  assert.strictEqual(p.insufficient, true);
});

check("two different skills are never compared to each other", () => {
  const mixed = [
    row({ skill: "rhythm", created_at: "2026-10-01T10:00:00Z", score_before: 50, score_after: 55 }),
    row({ skill: "note_accuracy", created_at: "2026-10-02T10:00:00Z", score_before: 60, score_after: 60 }),
    row({ skill: "note_accuracy", created_at: "2026-10-09T10:00:00Z", score_before: 60, score_after: 75 }),
    row({ skill: "note_accuracy", created_at: "2026-10-16T10:00:00Z", score_before: 75, score_after: 80 }),
  ];
  const p = learnerProof(mixed);
  assert.strictEqual(p.skill, "note_accuracy", "the skill with the real evidence");
  assert.strictEqual(p.from, 60);
  assert.strictEqual(p.to, 80);
  assert.strictEqual(p.deltaPts, 20, "the rhythm rows never enter the claim");
});

check("one run never becomes a trend in a parent-facing claim", () => {
  const board = beforeAfterBoard([rows[0]], { minTotal: 1 });
  assert.strictEqual(board.total, 1);
  assert.strictEqual(board.learners[0].sessions, 1);
  assert.strictEqual(board.learners[0].claimable, false, "1 session is a moment, not a trend");
  assert.strictEqual(board.cohort.status, "insufficient");
  assert.strictEqual(board.cohort.avgDeltaPts, null, "no average is invented from one run");
  assert.ok(board.cohort.reason.length > 0, "the refusal says why");
});

check("the cohort verdict measures only when the evidence floor is met", () => {
  const thin = beforeAfterBoard(rows, { minTotal: 100 });
  assert.strictEqual(thin.cohort.status, "insufficient", "3 sessions cannot speak for a cohort");
  const rich = beforeAfterBoard([...rows, ...rows.map(r => ({ ...r, learner_id: "kid-2" })), ...rows.map(r => ({ ...r, learner_id: "kid-3" })), ...rows.map(r => ({ ...r, learner_id: "kid-4" }))], { minTotal: 10 });
  assert.strictEqual(rich.cohort.status, "measured");
  assert.strictEqual(rich.cohort.claimable, 4);
  assert.strictEqual(rich.cohort.avgDeltaPts, 14, "every learner improved 14 points on this fixture");
  assert.strictEqual(rich.cohort.improved, 4);
  assert.strictEqual(rich.cohort.declined, 0);
  assert.ok(rich.cohort.reason.includes("12"), "the reason names the real row count it used");
});

check("a decline is reported as a decline, never softened", () => {
  const down = [
    { ...rows[0], score_before: 60, score_after: 90 },
    { ...rows[1], score_before: 90, score_after: 80 },
    { ...rows[2], score_before: 80, score_after: 70 },
  ];
  const board = beforeAfterBoard(down, { minTotal: 1 });
  assert.strictEqual(board.cohort.avgDeltaPts, -20, "90 → 70 = −20 points");
  assert.strictEqual(board.cohort.improved, 0);
  assert.strictEqual(board.cohort.declined, 1, "a decline is visible to the parent too");
});

check("an empty or malformed table reports nothing rather than 0%", () => {
  for (const bad of [[], null, undefined, "nope", [{}, null, 3]]) {
    const board = beforeAfterBoard(bad);
    assert.strictEqual(board.total, 0);
    assert.strictEqual(board.cohort.status, "insufficient");
    assert.strictEqual(board.cohort.avgDeltaPts, null);
  }
  assert.strictEqual(learnerProof([]), null);
});

check("the same rows give the same board (no clock, no randomness)", () => {
  const a = JSON.stringify(beforeAfterBoard(rows));
  const b = JSON.stringify(beforeAfterBoard([...rows].reverse()));
  assert.strictEqual(a, b);
});

console.log(`\nผลรวม: ผ่าน ${passed} · ไม่ผ่าน ${failed}`);
rmSync(OUT, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
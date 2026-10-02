/* ── tigamodel/evaluation/compound-dashboard.js — docs/12 §2 (m41) ──
   THE COMPOUND DASHBOARD, as a pure function: loop A → B → C, today's result,
   every number taken from the real tables.

   The rule this module exists to enforce: **a metric with no data is
   "unavailable", never zero and never an estimate.** m40's counter already
   refuses to open loop B's switch before 50 real outcomes; here the same
   honesty covers the whole board, so the owner never reads a number that the
   database does not actually contain.

   Inputs are COUNTS the caller read from the live DB (the read-only script
   scripts/compound-dashboard.mjs is the caller in production). Nothing here
   touches a clock, a network or a database: same input → same board.

   The bars are the plan's own pre-committed thresholds, not numbers invented
   here: 20 learners for loop A (m08 acceptance: "เด็ก 20 คนแรกมี ≥3 รูปแบบ
   แผนจริง") and 50 outcomes for loop B (m40 / docs/06). ── */

export const LOOP_BARS = {
  plans: 20,      // m08: real personalized plans for the first 20 learners
  outcomes: 50,   // m40: the pre-committed loop B switch-on bar
};

/* One metric cell. `value` is only ever a number the caller counted; when the
   count is missing (null/undefined/not finite) the cell says so. */
function metric(name, count, bar) {
  const measured = typeof count === "number" && Number.isFinite(count);
  return {
    name,
    value: measured ? Math.max(0, Math.floor(count)) : null,
    bar: typeof bar === "number" ? bar : null,
    status: measured ? "measured" : "unavailable",
  };
}

/* Loop A — personalized plans: how many learners actually HAVE skill state
   (the input the plan is built from). `switchOn` is the owner's
   tiga_personalized_plans switch, reported as-is: a plan only ships when it
   is on, so the board must say which world the number describes. */
function loopA(counts, switches) {
  const rows = metric("learners with skill state", counts.skillStateLearners, LOOP_BARS.plans);
  const cells = metric("skill state rows", counts.skillStateRows, null);
  const planSwitch = switches.personalizedPlans === true;
  return {
    id: "A",
    name: "แผนเฉพาะคน (personalized plans)",
    switchOn: planSwitch,
    metrics: [rows, cells],
    ready: planSwitch && rows.status === "measured" && rows.value >= LOOP_BARS.plans,
    note: planSwitch
      ? "สวิตช์เปิดอยู่ — แผนเฉพาะคนผลิตจริงตามข้อมูลที่มี"
      : "สวิตช์ tiga_personalized_plans ยังปิด (ค่าเริ่มต้น) — ตัวเลขข้างบนคือข้อมูลที่มี ไม่ใช่แผนที่ผลิตแล้ว",
  };
}

/* Loop B — outcomes: the readiness counter m40 reports, plus today's growth.
   `outcomesAdded` is a real delta only when the caller supplies BOTH the
   total and a previous total; a single number cannot become a trend. */
function loopB(counts) {
  const total = metric("outcomes ทั้งหมด", counts.outcomes, LOOP_BARS.outcomes);
  /* A trend needs TWO real windows from the table (this week vs the week
     before). One window is not a trend — then the cell says unavailable. */
  const canTrend = typeof counts.outcomesRecent === "number" && Number.isFinite(counts.outcomesRecent)
    && typeof counts.outcomesPrior === "number" && Number.isFinite(counts.outcomesPrior);
  const added = canTrend
    ? { name: "outcomes เพิ่มจากสัปดาห์ก่อน", value: Math.floor(counts.outcomesRecent - counts.outcomesPrior), bar: null, status: "measured" }
    : { name: "outcomes เพิ่มจากสัปดาห์ก่อน", value: null, bar: null, status: "unavailable" };
  const strategies = metric("กลยุทธ์ที่มีผลลัพธ์", counts.strategiesWithOutcomes, null);
  return {
    id: "B",
    name: "ครูเรียนรู้จากผลจริง (outcomes)",
    metrics: [total, added, strategies],
    ready: total.status === "measured" && total.value >= LOOP_BARS.outcomes
      && strategies.status === "measured" && strategies.value > 0,
    note: total.status === "measured" && total.value < LOOP_BARS.outcomes
      ? `ยังขาดอีก ${LOOP_BARS.outcomes - total.value} outcomes (เกิดเองจากการซ้อมจริง ห้ามปลอม)`
      : "นับจริงจาก teaching_outcomes",
  };
}

/* Loop C — KB grows from real problems. Two honest halves: how many real
   diagnoses named a skill at all (m43's queue), and the unanswerable-rate
   reduction m19 promised. The reduction needs a BASELINE captured before a
   wave; without one it stays unavailable — a percentage computed from one
   point in time would be a fabrication. */
function loopC(counts) {
  const diagnoses = metric("diagnoses ที่ระบุทักษะ", counts.diagnosesWithSkill, null);
  const reduction = (typeof counts.unanswerableBefore === "number" && Number.isFinite(counts.unanswerableBefore)
    && typeof counts.unanswerableAfter === "number" && Number.isFinite(counts.unanswerableAfter))
    ? {
      name: "อัตรา ตอบไม่ได้ ลดลง",
      value: counts.unanswerableBefore > 0
        ? Math.round(((counts.unanswerableBefore - counts.unanswerableAfter) / counts.unanswerableBefore) * 1000) / 10
        : null,
      bar: 50, // docs/05 §9: −50% is the promised target
      status: counts.unanswerableBefore > 0 ? "measured" : "unavailable",
    }
    : { name: "อัตรา ตอบไม่ได้ ลดลง", value: null, bar: 50, status: "unavailable" };
  return {
    id: "C",
    name: "คลังความรู้โตจากปัญหาจริง (KB wave)",
    metrics: [diagnoses, reduction],
    ready: reduction.status === "measured" && reduction.value >= reduction.bar,
    note: reduction.status === "unavailable"
      ? "ยังวัด % ไม่ได้ — ต้องมี baseline (อัตรา ตอบไม่ได้ ก่อน wave) และค่าหลัง wave จากข้อมูลจริง"
      : "เทียบกับ baseline ก่อน wave",
  };
}

/* The whole board. Every loop reports measured cells AND the cells it could
   not measure; `summary` says plainly how many numbers on this board are
   real today, so a reader cannot mistake an empty table for a zero result. */
export function compoundBoard(counts, switches) {
  /* a null/garbage counts object is a missing one, not a crash */
  const c = (counts && typeof counts === "object") ? counts : {};
  const s = (switches && typeof switches === "object") ? switches : {};
  const loops = [loopA(c, s), loopB(c), loopC(c)];
  const all = loops.flatMap(l => l.metrics);
  const measured = all.filter(m => m.status === "measured");
  return {
    loops,
    summary: {
      measured: measured.length,
      unavailable: all.length - measured.length,
      of: all.length,
      loopsReady: loops.filter(l => l.ready).length,
      ofLoops: loops.length,
    },
  };
}

/* the read-only live script prints exactly these — the shape is the contract */
export function renderBoardLines(board, T = (s) => s) {
  const lines = [];
  for (const loop of board.loops) {
    for (const m of loop.metrics) {
      lines.push(m.status === "measured"
        ? T(`${loop.id} · ${m.name}: ${m.value}${m.bar ? ` (เกณฑ์ ${m.bar})` : ""}`)
        : T(`${loop.id} · ${m.name}: ยังไม่มีข้อมูลจริง (ไม่ประมาณ)`));
    }
  }
  return lines;
}
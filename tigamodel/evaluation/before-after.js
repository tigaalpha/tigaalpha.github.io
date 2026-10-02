/* ── tigamodel/evaluation/before-after.js — docs/08 §m24 ──
   THE BEFORE/AFTER PROOF, as a pure function over REAL practice rows.

   What a parent is shown must be a number the app actually recorded: the
   learner's own first practice and their own latest one, on the same skill,
   from `learning_practice_events` — never a promise, never an estimate.

   Contract (rows = the table's own shape):
     [{ learner_id, skill, created_at, score_before, score_after,
        duration_sec, attempts, succeeded }]

   The honesty rules, in order:
     * a score delta needs BOTH ends real and non-equal → otherwise no delta
     * a row with no usable score is kept as PRACTICE TIME (still real) but
       contributes nothing to an accuracy claim
     * rows for different skills are never compared to each other
     * below the evidence floor (MIN_EVENTS_PER_LEARNER, MIN_EVENTS_TOTAL) the
       answer is `insufficient`, with the real count it does have — a parent
       dashboard is worse than useless when it rounds a single run into a
       trend
     * pure, deterministic, no clock: the caller passes `now` when it needs
       the window cut; the default simply uses every row it was given.

   Percentages are computed from the numbers in the rows and are always
   accompanied by the n they were computed from. ── */

export const MIN_EVENTS_PER_LEARNER = 3;   // one run is a moment, three is a trend
export const MIN_EVENTS_TOTAL = 10;        // and a cohort claim needs more than a handful
export const WINDOW_DAYS = 42;             // the plan's own "6 สัปดาห์" (docs/08)

/* 0..100 accuracy or arbitrary score → percentage change, or null. A zero or
   missing base makes a percentage meaningless, so there is none. */
export function pctChange(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  if (from === 0) return null;
  return Math.round(((to - from) * 100 / Math.abs(from)) * 10) / 10;
}

function isNum(v) { return typeof v === "number" && Number.isFinite(v); }
function daysBetween(a, b) {
  const ta = Date.parse(a), tb = Date.parse(b);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return Math.abs(tb - ta) / 86400000;
}

/* usable rows only, oldest first — the table's own created_at decides order,
   never the order the query happened to return */
export function orderRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter(r => r && typeof r === "object" && r.created_at)
    .map((r, i) => ({ row: r, i }))
    .sort((a, b) => {
      const ta = Date.parse(a.row.created_at), tb = Date.parse(b.row.created_at);
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
      return a.i - b.i;                       // stable for identical/missing timestamps
    })
    .map(x => x.row);
}

/* One learner's real numbers: first and latest row on their strongest skill
   (most scored rows; tie → the skill name, so the pick is deterministic). */
export function learnerProof(rows) {
  const ordered = orderRows(rows);
  if (!ordered.length) return null;

  /* per-skill scored rows */
  const bySkill = new Map();
  for (const r of ordered) {
    const skill = typeof r.skill === "string" && r.skill.trim() ? r.skill.trim() : "(ไม่ระบุทักษะ)";
    if (!isNum(r.score_before) || !isNum(r.score_after)) continue;
    if (!bySkill.has(skill)) bySkill.set(skill, []);
    bySkill.get(skill).push(r);
  }

  let skill = null, best = [];
  for (const [s, rs] of bySkill) {
    if (!best.length || rs.length > best.length || (rs.length === best.length && s < skill)) { skill = s; best = rs; }
  }

  const first = best[0], last = best[best.length - 1];
  const sessions = ordered.length;
  const scored = ordered.filter(r => isNum(r.score_before) && isNum(r.score_after)).length;
  const minutes = ordered.reduce((a, r) => a + (isNum(r.duration_sec) ? Math.max(0, r.duration_sec) : 0), 0) / 60;

  const proof = {
    sessions,
    scoredSessions: scored,
    minutes: Math.round(minutes * 10) / 10,
    skill: skill || null,
    from: null, to: null, deltaPts: null, pct: null,
    days: skill ? daysBetween(first.created_at, last.created_at) : null,
    insufficient: true,
  };
  if (!best.length) return proof;                      // real sessions, no score claim
  proof.from = first.score_after;                     // what the FIRST run ended at
  proof.to = last.score_after;                        // where the LATEST run ended
  proof.deltaPts = Math.round((proof.to - proof.from) * 10) / 10;
  proof.pct = pctChange(proof.from, proof.to);
  proof.insufficient = false;
  return proof;
}

/* The dashboard a parent sees: per-learner proofs, plus the honest
   cohort verdict. `insufficient` at cohort level means "we do not show a
   trend yet" — and the reason says how many real rows exist. */
export function beforeAfterBoard(rows, { minPerLearner = MIN_EVENTS_PER_LEARNER, minTotal = MIN_EVENTS_TOTAL, lang = "th" } = {}) {
  const ordered = orderRows(rows);
  const total = ordered.length;

  const groups = new Map();
  for (const r of ordered) {
    const id = r.learner_id || "(ไม่ระบุผู้เรียน)";
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(r);
  }

  const T = lang === "en"
    ? { skill: "skill", sessions: "sessions", mins: "minutes", gain: "points", noData: "not enough real practice yet", cohort: "not enough learners yet" }
    : lang === "zh"
      ? { skill: "技能", sessions: "次数", mins: "分钟", gain: "分", noData: "真实练习数据还不够", cohort: "学员数量还不够" }
      : { skill: "ทักษะ", sessions: "ครั้ง", mins: "นาที", gain: "คะแนน", noData: "ยังมีข้อมูลซ้อมจริงไม่พอ", cohort: "ยังมีนักเรียนจริงไม่พอ" };

  const learners = [...groups.entries()]
    .map(([id, rs]) => ({ learner: id, ...learnerProof(rs) }))
    .sort((a, b) => b.sessions - a.sessions || (a.learner < b.learner ? -1 : 1))
    .map(p => ({
      learner: p.learner,
      sessions: p.sessions,
      skill: p.skill,
      label: p.skill ? `${p.skill} · ${p.sessions} ${T.sessions} · ${p.minutes} ${T.mins}` : `${p.sessions} ${T.sessions} · ${p.minutes} ${T.mins}`,
      from: p.from, to: p.to, deltaPts: p.deltaPts, pct: p.pct,
      days: p.days === null ? null : Math.round(p.days * 10) / 10,
      scoredSessions: p.scoredSessions,
      /* a single run never becomes a "before/after" claim */
      claimable: !p.insufficient && p.sessions >= minPerLearner,
    }));

  const claimable = learners.filter(l => l.claimable && isNum(l.deltaPts));
  const cohort = {
    learners: learners.length,
    claimable: claimable.length,
    sessions: total,
    minutes: Math.round(learners.reduce((a, l) => a + l.minutes, 0) * 10) / 10,
    avgDeltaPts: claimable.length
      ? Math.round((claimable.reduce((a, l) => a + l.deltaPts, 0) / claimable.length) * 10) / 10
      : null,
    improved: claimable.filter(l => l.deltaPts > 0).length,
    declined: claimable.filter(l => l.deltaPts < 0).length,
    status: total >= minTotal && claimable.length > 0 ? "measured" : "insufficient",
  };
  cohort.reason = cohort.status === "measured"
    ? `${cohort.claimable}/${cohort.learners} คนมีข้อมูลพอเทียบ · จาก ${total} ครั้งที่ซ้อมจริง`
    : (total < minTotal ? T.noData : T.cohort);

  return { total, learners, cohort, labels: T };
}
#!/usr/bin/env node
/* compound-dashboard.mjs — docs/12 §2 (m41) + docs/08 (m24): ONE read-only
   command that answers, with real numbers only:
     · loop A — how many learners actually have skill state (plans' input)
     · loop B — outcomes total, this week vs last week, strategies covered
     · loop C — diagnoses that named a skill, and whether the unanswerable
       rate has a real before/after pair yet
     · per-learner before/after proof from learning_practice_events (m24)

   Every number is counted from the live DB through the linked supabase CLI —
   the same read-only channel as outcomes-report.mjs (m40) and
   problems-to-kb-queue.mjs (m43). The board and the proof math are the REAL
   modules (tigamodel/evaluation/compound-dashboard.js, before-after.js), not a
   copy of their logic: a metric with no data prints "ยังไม่มีข้อมูลจริง
   (ไม่ประมาณ)", never a zero.

   Run: node scripts/compound-dashboard.mjs */

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compoundBoard, renderBoardLines, LOOP_BARS } from "../tigamodel/evaluation/compound-dashboard.js";
import { beforeAfterBoard } from "../tigamodel/evaluation/before-after.js";

const CLI = "node_modules/.tmp-supabase-cli/supabase";

function q(sql) {
  const f = join(mkdtempSync(join(tmpdir(), "q-")), "q.sql");
  writeFileSync(f, sql);
  const r = spawnSync(CLI, ["db", "query", "--linked", "--file", f], { encoding: "utf8", env: { ...process.env } });
  if (r.status !== 0) throw new Error(r.stderr.slice(0, 300));
  return r.stdout;
}
/* the CLI prints a box-drawing table; take the data row, not the header */
const scalar = (sql) => {
  const out = q(sql).split("\n").filter(l => l.includes("│") && !/─/.test(l))
    .map(l => l.split("│")[1]?.trim()).filter(v => v && v.length > 0 && !/^[a-z_]+$/i.test(v) || /^[\d.]+$/.test(v));
  const v = out.find(x => /^[\d.]+$/.test(x));
  return v === undefined ? null : parseFloat(v);
};
/* practice rows come back as real text cells (uuid, dates, numerics) */
const practiceRows = () => {
  const out = q(`select learner_id, coalesce(skill,'') as skill, created_at,
    score_before, score_after, duration_sec, attempts
    from learning_practice_events order by created_at asc limit 2000;`);
  const lines = out.split("\n").filter(l => l.includes("│") && !/─/.test(l) && !/learner_id/.test(l));
  return lines.map(l => {
    const c = l.split("│").map(s => s.trim());
    const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
    return { learner_id: c[1], skill: c[2] === "" ? null : c[2], created_at: c[3],
      score_before: num(c[4]), score_after: num(c[5]), duration_sec: num(c[6]), attempts: num(c[7]) };
  }).filter(r => r.created_at);
};

console.log("\n── แดชบอร์ดวงจร A→B→C (live DB, read-only) ──");
if (!existsSync(CLI)) {
  console.log("🟡 CLI not installed yet — run scripts/apply-migrations.mjs once, then re-run.");
  process.exit(0);
}
try {
  const counts = {
    skillStateRows: scalar("select count(*) as n from learner_skill_state;"),
    skillStateLearners: scalar("select count(distinct learner_id) as n from learner_skill_state;"),
    outcomes: scalar("select count(*) as n from teaching_outcomes;"),
    outcomesRecent: scalar("select count(*) as n from teaching_outcomes where created_at >= now() - interval '7 days';"),
    outcomesPrior: scalar("select count(*) as n from teaching_outcomes where created_at >= now() - interval '14 days' and created_at < now() - interval '7 days';"),
    strategiesWithOutcomes: scalar("select count(distinct strategy_id) as n from teaching_outcomes;"),
    diagnosesWithSkill: scalar("select count(*) as n from learning_diagnoses where skill is not null and length(trim(skill)) > 0;"),
    /* the unanswerable-rate pair stays undefined until a wave baseline exists */
  };
  const board = compoundBoard(counts, { personalizedPlans: false });
  for (const line of renderBoardLines(board)) console.log("  " + line);
  console.log(`\nเกณฑ์เปิดสวิตช์: วงจร A ${LOOP_BARS.plans} คน · วงจร B ${LOOP_BARS.outcomes} outcomes (ค่าจากแผน ไม่ใช่การเดา)`);
  console.log(`สรุปวันนี้: วัดได้ ${board.summary.measured}/${board.summary.of} ตัว · วงจรที่พร้อม ${board.summary.loopsReady}/${board.summary.ofLoops}`);

  console.log("\n── หลักฐานก่อน-หลังรายคน (m24, learning_practice_events) ──");
  const rows = practiceRows();
  const proof = beforeAfterBoard(rows);
  if (!proof.total) {
    console.log("  🟡 ยังไม่มีแถวซ้อมจริงในตาราง — เกิดเองเมื่อนักเรียนซ้อม ห้ามปลอม");
  } else {
    for (const l of proof.learners.slice(0, 10)) {
      const delta = l.claimable ? `คะแนน ${l.from} → ${l.to} (${l.deltaPts >= 0 ? "+" : ""}${l.deltaPts})` : "ยังไม่พอเทียบ";
      console.log(`  • ${l.label} — ${delta}`);
    }
    const c = proof.cohort;
    console.log(`\n  ${c.status === "measured" ? "🟢" : "🟡"} ${c.status === "measured"
      ? `เฉลี่ย ${c.avgDeltaPts >= 0 ? "+" : ""}${c.avgDeltaPts} คะแนน · ดีขึ้น ${c.improved} · ถดถอย ${c.declined} · รวม ${c.minutes} นาที (จาก ${c.sessions} ครั้งจริง)`
      : `ยังไม่แสดงเทรนด์ — ${c.reason}`}`);
  }
  console.log("");
  process.exit(0);
} catch (e) {
  console.error(`❌ ${e.message.slice(0, 300)}`);
  process.exit(1);
}
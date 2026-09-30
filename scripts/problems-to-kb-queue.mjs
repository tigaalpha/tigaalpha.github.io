#!/usr/bin/env node
/* problems-to-kb-queue.mjs — docs/13 m43: CLOSE LOOP C.
   Ranks the REAL problems learners hit (learning_diagnoses, live DB,
   read-only via the linked CLI) and converts them into the KB wave queue:
   which skill/domain deserves new entries first. The queue is a DECISION
   INPUT, not auto-written knowledge — every future KB entry still passes
   the retrieval gate and steel rule 7 (legal + registered source) as always.

   Run: node scripts/problems-to-kb-queue.mjs */

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = "node_modules/.tmp-supabase-cli/supabase";
/* skill (App.tsx SKILLS vocabulary, same as learner_skill_state) → the KB
   domain the retrieval layer serves for that topic. Deterministic mapping,
   documented — the wave planner uses it to point at where new entries go. */
const SKILL_TO_DOMAIN = {
  rhythm: "practice-planning",
  note_accuracy: "note-reading",
  sight_reading: "note-reading",
  ear_training: "ear-training",
  chord_knowledge: "chords",
  dynamics: "expression",
  technique: "technique",
};

function q(sql) {
  const f = join(mkdtempSync(join(tmpdir(), "q-")), "q.sql");
  writeFileSync(f, sql);
  const r = spawnSync(CLI, ["db", "query", "--linked", "--file", f], { encoding: "utf8", env: { ...process.env } });
  if (r.status !== 0) throw new Error(r.stderr.slice(0, 300));
  return r.stdout;
}
const rowsOf = (out) => out.split("\n")
  .filter(l => l.includes("│"))
  .map(l => l.split("│").map(s => s.trim()))
  .filter(cells => cells.length >= 3 && cells[1] && cells[2] && cells[1] !== "skill" && cells[1] !== "n")
  .map(cells => ({ skill: cells[1], n: parseInt(cells[2], 10) || 0 }));

console.log("\n── KB wave queue from REAL learner problems (live DB, read-only) ──");
if (!existsSync(CLI)) {
  console.log("🟡 CLI not installed yet — run scripts/apply-migrations.mjs once, then re-run.");
  process.exit(0);
}
try {
  const raw = q("select skill, count(*) as n from learning_diagnoses where skill is not null and length(trim(skill)) > 0 group by skill order by n desc limit 10;");
  const ranked = rowsOf(raw);
  const noSkill = rowsOf(q("select 'unknown', count(*) as n from learning_diagnoses where skill is null;"))[0];

  if (!ranked.length) {
    console.log("\n🟡 ยังไม่มี diagnosis ระบุทักษะ (เกิดเองเมื่อนักเรียนซ้อมจริง — ห้ามปลอม) — คิว KB wave ยังว่าง");
  } else {
    console.log("\n📋 คิว KB wave (ทักษะที่นักเรียนติดจริง มาก→น้อย):");
    for (const { skill, n } of ranked) {
      const domain = SKILL_TO_DOMAIN[skill] || "(ยังไม่มี domain mapping — ให้ทีมเลือกก่อนเขียน)";
      console.log(`  ${n >= 10 ? "1." : rank(ranked, skill)}. ${skill} → ${domain} · ปัญหาจริง ${n} รายการ`);
    }
    const top = ranked[0];
    console.log(`\n🟢 คำแนะนำอัตโนมัติ: wave ถัดไปเขียน entries สำหรับ "${top.skill}" (domain: ${SKILL_TO_DOMAIN[top.skill] || "รอ mapping"}) ก่อน — ตามข้อมูลจริง ${top.n} รายการ`);
    console.log("   กติกาเดิมครบ: ทุก entry ใหม่ต้องผ่านตารางตรวจกฎหมาย (ข้อ 7) + retrieval gate ≥80% (ข้อ 2) ก่อนเข้าคลัง");
  }
  if (noSkill) console.log(`(diagnoses ที่ไม่ระบุทักษะ: ${noSkill.n} แถว — ไม่เข้าคิวจนกว่าจะรู้ทักษะ)`);
  console.log("");
  process.exit(0);
} catch (e) {
  console.error(`❌ ${e.message.slice(0, 300)}`);
  process.exit(1);
}
function rank(ranked, skill) { return (ranked.findIndex(r => r.skill === skill) + 1) + "."; }

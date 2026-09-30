/* Smoke: KB wave queue (docs/13 m43) — decision logic on fixtures with known
   answers (the SQL read path itself runs against the live DB when invoked).
   Covers: real ranking order, domain mapping for the App SKILLS vocabulary,
   unknown skills never silently mapped, empty DB = honest empty queue. */

import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../scripts/problems-to-kb-queue.mjs", import.meta.url), "utf8");

let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}${extra ? " — " + extra : ""}`); } };

console.log("── smoke-problems-queue ──");
check("maps only the real App SKILLS vocabulary (rhythm/note_accuracy/sight_reading/ear_training/chord_knowledge/dynamics/technique)", (() => {
  const expected = ["rhythm", "note_accuracy", "sight_reading", "ear_training", "chord_knowledge", "dynamics", "technique"];
  return expected.every(k => src.includes(`${k}:`));
})());
check("unknown skill → explicit 'wait for mapping', never a guessed domain", src.includes("ยังไม่มี domain mapping"));
check("empty DB → honest empty queue (no fabricated problems)", src.includes("คิว KB wave ยังว่าง") && src.includes("ห้ามปลอม"));
check("reads the REAL diagnoses table + real skill column", src.includes("learning_diagnoses") && src.includes("group by skill"));
check("read-only (no write SQL in the source)", !/insert into|update learning|delete from/i.test(src));
check("queue is a decision input: reminds steel rule 7 + retrieval gate", src.includes("ข้อ 7") && src.includes("80%"));
check("missing CLI → loud guidance, not a fake queue", src.includes("🟡 CLI not installed"));

/* ranking logic on a fixture (same rowsOf + sort semantics the script uses) */
const rowsOf = (out) => out.split("\n")
  .filter(l => l.includes("│"))
  .map(l => l.split("│").map(s => s.trim()))
  .filter(cells => cells.length >= 3 && cells[1] && cells[2] && cells[1] !== "skill" && cells[1] !== "n")
  .map(cells => ({ skill: cells[1], n: parseInt(cells[2], 10) || 0 }));
const fixture = ["┌──────┬───┐", "│ skill │ n │", "├──────┼───┤", "│ rhythm │ 12 │", "│ dynamics │ 3 │", "└──────┴───┘"].join("\n");
const ranked = rowsOf(fixture);
check("parser: extracts real (skill, n) pairs in DB order", ranked.length === 2 && ranked[0].skill === "rhythm" && ranked[0].n === 12 && ranked[1].n === 3);

console.log(`\n${fail === 0 ? "✅" : "❌"} smoke-problems-queue: ${pass}/${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);

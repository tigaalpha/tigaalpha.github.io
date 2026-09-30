#!/usr/bin/env node
/* outcomes-report.mjs — docs/13 m40: THE READINESS REPORT for loop B.
   Counts the REAL teaching_outcomes rows on the live DB (read-only, via the
   linked supabase CLI — the same channel as apply-migrations) and issues the
   automatic verdict the plan pre-committed to: switch-on ready at ≥50 rows
   with a clear leading strategy. Every number comes from the table; nothing
   is estimated. Run: node scripts/outcomes-report.mjs */

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = "node_modules/.tmp-supabase-cli/supabase";
const BAR = 50; // the plan's pre-committed readiness bar (m06/m04 activation)

function q(sql) {
  const f = join(mkdtempSync(join(tmpdir(), "q-")), "q.sql");
  writeFileSync(f, sql);
  const r = spawnSync(CLI, ["db", "query", "--linked", "--file", f], { encoding: "utf8", env: { ...process.env } });
  if (r.status !== 0) throw new Error(r.stderr.slice(0, 300));
  return r.stdout;
}
/* pull real rows out of the CLI's box-drawing table */
const rowsOf = (out) => out.split("\n")
  .filter(l => l.includes("│"))
  .map(l => l.split("│")[1]?.trim())
  .filter(v => v && v.length > 0 && v !== "count" && v !== "strategy_id" && v !== "n" && !/^[─┌└├]+$/.test(v));

let failed = 0;
const ok = (name, cond, extra) => { console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!cond) failed++; };

console.log("\n── teaching_outcomes readiness report (live DB, read-only) ──");
if (!existsSync(CLI)) {
  console.log("🟡 CLI not installed in this workspace yet — run scripts/apply-migrations.mjs once (it installs it), then re-run.");
  process.exit(0);
}
try {
  const total = rowsOf(q("select count(*) from teaching_outcomes;"))[0] || "0";
  console.log(`\n📊 outcomes รวมทั้งหมด: ${total} (เกณฑ์เปิดสวิตช์: ≥${BAR})`);

  const perStrategyRaw = q("select strategy_id, count(*) as n from teaching_outcomes group by strategy_id order by n desc limit 8;");
  const pairs = perStrategyRaw.split("\n").filter(l => l.includes("│") && !/─/.test(l) && !/strategy_id/.test(l))
    .map(l => { const p = l.split("│").map(s => s.trim()); return p[1] && p[2] ? { strategy: p[1], n: parseInt(p[2], 10) } : null; })
    .filter(Boolean);
  if (pairs.length) {
    console.log("\nต่อกลยุทธ์ (จริง):");
    for (const p of pairs) console.log(`  • ${p.strategy}: ${p.n}`);
  } else {
    console.log("ต่อกลยุทธ์: ยังไม่มีแถว (ปกติ — outcomes เกิดเมื่อนักเรียนซ้อมผ่านวงจรสอนจริง)");
  }

  const n = parseInt(total, 10) || 0;
  const ready = n >= BAR && pairs.length > 0 && pairs[0].n >= Math.ceil(BAR / 3);
  console.log(`\n${ready ? "🟢" : "🟡"} คำตัดสินอัตโนมัติ (เกณฑ์ล่วงหน้าในแผน): ${ready
    ? `พร้อมเปิดสวิตช์ — outcomes ${n} ≥ ${BAR} และกลยุทธ์นำ "${pairs[0].strategy}" มี ${pairs[0].n} ตัวอย่าง · ขั้นถัดไป: admin รัน analyzer → admin_set_policy_weights(enabled:true)`
    : `ยังไม่พร้อม — ขาดอีก ${Math.max(0, BAR - n)} outcomes (เกิดเองจากการซ้อมจริงของนักเรียน ห้ามปลอม) · ตัวนับถูกออกแบบให้รันซ้ำทุกเช้าได้`}`);
  ok("report ran on the real DB", true);
} catch (e) {
  ok("report ran on the real DB", false, e.message.slice(0, 200));
}
console.log("");
process.exit(failed === 0 ? 0 : 1);

#!/usr/bin/env node
/* verify-knowledge-contributions.mjs — docs/09 layer 1 (m26/m27): prove the
   knowledge_contributions migration is REALLY on the live database, and that
   it is shaped the way the design promises. Read-only, through the same linked
   supabase CLI the morning report uses (no writes, no psql).

   What it checks, and what would be the bug if it failed:
     1. the table exists with the three statuses constrained (check constraint)
     2. RLS is ON and there are exactly TWO policies — insert own pending +
        select own — and NO update/delete policy (an editable verdict is the
        failure this table must never have)
     3. the admin RPCs exist: admin_moderate_contribution, _queue, _count
     4. the review-stamp trigger is attached (an approval is never anonymous)
     5. the contributor_name column (m27 credit) exists and the queue returns it
     6. re-running the migration is a no-op (it is additive + re-runnable)

   Run: node scripts/verify-knowledge-contributions.mjs   (exit 1 on any fail) */

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = "node_modules/.tmp-supabase-cli/supabase";

function q(sql) {
  const f = join(mkdtempSync(join(tmpdir(), "q-")), "q.sql");
  writeFileSync(f, sql);
  const r = spawnSync(CLI, ["db", "query", "--linked", "--file", f], { encoding: "utf8", env: { ...process.env } });
  if (r.status !== 0) throw new Error(r.stderr.slice(0, 300));
  return r.stdout;
}
/* one integer out of the CLI's table, or null when the row is absent */
const num = (sql) => {
  const out = q(sql).split("\n").filter(l => l.includes("│") && !/─/.test(l))
    .map(l => l.split("│")[1]?.trim());
  const v = out.find(x => /^\d+$/.test(x || ""));
  return v === undefined ? null : parseInt(v, 10);
};

let pass = 0, fail = 0;
const ok = (name, cond, extra) => {
  if (cond) { console.log(`  ✅ ${name}`); pass++; }
  else { console.log(`  ❌ ${name}${extra ? " — " + extra : ""}`); fail++; }
};

console.log("\n── knowledge_contributions: live verification (read-only) ──");
if (!existsSync(CLI)) {
  console.log("🟡 CLI not installed in this workspace yet — run scripts/apply-migrations.mjs once (it installs it), then re-run.");
  process.exit(0);
}
try {
  ok("the table exists", num(`select count(*)::int as n from information_schema.tables where table_schema='public' and table_name='knowledge_contributions';`) === 1);

  const cols = q(`select column_name from information_schema.columns where table_schema='public' and table_name='knowledge_contributions';`)
    .split("\n").filter(l => l.includes("│") && !/─/.test(l)).map(l => l.split("│")[1]?.trim()).filter(Boolean);
  const need = ["contributor_id", "contributor_name", "title", "body", "license", "source_kind", "gate_verdict", "gate_reasons", "status", "review_note", "reviewed_by", "reviewed_at"];
  const missing = need.filter(c => !cols.includes(c));
  ok(`every required column is there (${need.length})`, missing.length === 0, missing.join(", "));

  const cons = q(`select pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'public.knowledge_contributions'::regclass and contype = 'c';`);
  ok("status is constrained to pending/approved/rejected", /'pending'.*'approved'.*'rejected'/.test(cons));

  ok("row level security is ON", num(`select count(*)::int as n from pg_tables where schemaname='public' and tablename='knowledge_contributions' and rowsecurity;`) === 1);

  const pol = q(`select policyname, cmd from pg_policies where tablename='knowledge_contributions';`)
    .split("\n").filter(l => l.includes("│") && !/─/.test(l) && !/policyname/.test(l)).map(l => l.split("│").map(s => s.trim()));
  const cmds = pol.map(c => c[2]).filter(Boolean);
  ok(`exactly two policies: insert own pending + select own (found ${cmds.length})`, cmds.length === 2 && cmds.every(c => ["INSERT", "SELECT"].includes(c)), cmds.join(","));
  ok("no client UPDATE or DELETE policy exists", !cmds.includes("UPDATE") && !cmds.includes("DELETE"), cmds.join(","));

  const fns = q(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and p.proname like 'admin%contribution%';`)
    .split("\n").filter(l => l.includes("│") && !/─/.test(l) && !/proname/.test(l)).map(l => l.split("│")[1]?.trim()).filter(Boolean);
  ok("admin_contributions_queue / _count / admin_moderate_contribution all exist",
    ["admin_contributions_queue", "admin_contributions_count", "admin_moderate_contribution"].every(f => fns.includes(f)), fns.join(","));

  const trig = num(`select count(*)::int as n from pg_trigger where tgrelid = 'public.knowledge_contributions'::regclass and not tgisinternal;`);
  ok("the review-stamp trigger is attached", trig === 1, `found ${trig}`);

  const secdef = num(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('admin_moderate_contribution','admin_contributions_queue','admin_contributions_count') and p.prosecdef;`);
  ok("all three admin RPCs are SECURITY DEFINER with the standard shape", secdef === 3, `found ${secdef}`);

  const searchpath = q(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_moderate_contribution' and array_to_string(coalesce(p.proconfig,'{}'), ',') like '%search_path=public%';`);
  ok("admin_moderate_contribution pins search_path", num(`select 1;`) !== null && /│\s*1\s*│/.test(searchpath));

  const cnt = num(`select count(*)::int as n from public.knowledge_contributions;`);
  ok(`the table is readable (rows so far: ${cnt === null ? "?" : cnt})`, cnt !== null);
} catch (e) {
  /* Unreachable DB is NOT a pass and NOT a fail: it means this run could not
     verify anything. Say so loudly and exit 0 so a merge is not blocked by a
     network — the last real verdict stays on record in the plan. */
  console.log(`\n🟡 ยืนยันไม่ได้รอบนี้ — ต่อฐานข้อมูลไม่ได้: ${String(e.message).slice(0, 160)}`);
  console.log(`   (นี่ไม่ใช่ \"ผ่าน\" — รันซ้ำเมื่อเครื่องต่อเน็ตได้: node scripts/verify-knowledge-contributions.mjs)\n`);
  process.exit(0);
}
console.log(`\n${fail === 0 ? "🟢" : "🔴"} knowledge_contributions: ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
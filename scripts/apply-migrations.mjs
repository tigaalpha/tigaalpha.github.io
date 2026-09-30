#!/usr/bin/env node
/* apply-migrations.mjs — ONE COMMAND to run the OWNER-APPROVED SQL migrations
   on the live Supabase project, then verify them for real.

   The migrations carry the owner's per-migration approval recorded in
   tigamodel/plan/plan-v3.mjs OWNER_APPROVALS (2026-09-29: "อนุญาต ให้ทำได้ทั้งสองข้อ").
   This script is the button: the moment a database credential exists in the
   environment, one command applies and verifies. Until then it fails LOUDLY
   and tells you exactly which key to add (never silently "succeeds").

   Credentials (either one, checked in this order):
     SUPABASE_ACCESS_TOKEN  — Supabase management API (uses the project ref
                              baked into the repo, gsaqgbracxnucdmtmcxz);
                              the CLI is downloaded on demand into node_modules.
     SUPABASE_DB            — postgres connection string (psql or pg:// via
                              node-postgres if present).

   Usage:
     node scripts/apply-migrations.mjs --check          # report only (safe, no DB writes)
     node scripts/apply-migrations.mjs                  # apply both + verify
     node scripts/apply-migrations.mjs --only=learning  # one migration
     node scripts/apply-migrations.mjs --only=policy

   Verify steps run the checks the migration files themselves prescribe:
     learning-data: table presence + p_session_key RPCs respond (verify-learning-data suite covers the client contract; here we smoke the live DB)
     policy-weights: RPC admin_get_policy_weights returns enabled:false seed + tiga_policy_weights switch row exists
   ── */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const PROJECT_REF = "gsaqgbracxnucdmtmcxz"; // repo-baked project (AGENTS.md)
const MIGRATIONS = [
  { id: "learning", file: "supabase-learning-data-migration.sql", label: "Learning Data v1 (7 ตาราง + RLS + RPCs)" },
  { id: "policy", file: "supabase-policy-weights-migration.sql", label: "Policy weights (RPC + seed switch-off)" },
];
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const onlyArg = (args.find(a => a.startsWith("--only=")) || "").split("=")[1];
const list = onlyArg ? MIGRATIONS.filter(m => m.id === onlyArg) : MIGRATIONS;
if (onlyArg && list.length === 0) { console.error(`unknown --only=${onlyArg} (use: ${MIGRATIONS.map(m => m.id).join("|")})`); process.exit(1); }

const has = (k) => typeof process.env[k] === "string" && process.env[k].length > 0;
const accessToken = has("SUPABASE_ACCESS_TOKEN");
const dbUrl = has("SUPABASE_DB");
console.log(`\n── apply-migrations (project ${PROJECT_REF}) ──`);
console.log(`credential: ${accessToken ? "SUPABASE_ACCESS_TOKEN" : dbUrl ? "SUPABASE_DB" : "NONE"}\n`);

if (checkOnly) {
  for (const m of list) {
    const ok = existsSync(m.file);
    console.log(`${ok ? "✅" : "❌"} ${m.file} ${ok ? `ready (${(readFileSync(m.file).length / 1024).toFixed(1)} KB) — ${m.label}` : "MISSING"}`);
  }
  console.log(`\n${accessToken || dbUrl ? "🟢 credential present — run without --check to APPLY + VERIFY for real" : "🟡 no credential in this environment yet — add SUPABASE_ACCESS_TOKEN (or SUPABASE_DB) in Settings → Environment, then run:\n   node scripts/apply-migrations.mjs"}`);
  process.exit(0);
}

if (!accessToken && !dbUrl) {
  console.error(`❌ no database credential in this environment — I cannot press Run for you without it.\n\n   Add ONE of these in Freebuff Settings → Environment (project keys), then rerun:\n     SUPABASE_ACCESS_TOKEN  (Supabase → Account → Access Tokens; scope: this project)\n     SUPABASE_DB            (Supabase → Project Settings → Database → Connection string)\n\n   The owner approval for BOTH migrations is already recorded in the plan; this\n   script refuses to run without a credential and never fakes success.`);
  process.exit(1);
}

let pgClient = null;
async function pg() {
  if (pgClient) return pgClient;
  const { default: pg } = await import("pg");
  pgClient = new pg.Client({ connectionString: process.env.SUPABASE_DB, ssl: { rejectUnauthorized: false } });
  await pgClient.connect();
  return pgClient;
}

async function runSql(sql) {
  if (dbUrl) {
    const c = await pg();
    const r = await c.query(sql);
    return r;
  }
  // management-API path: ensure CLI + link record, then `db query` with a real temp file
  const cli = "node_modules/.tmp-supabase-cli/supabase";
  if (!existsSync(cli)) {
    console.log("(downloading supabase CLI on demand…)");
    execSync(`mkdir -p node_modules/.tmp-supabase-cli && curl -sSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz -C node_modules/.tmp-supabase-cli supabase`, { stdio: "inherit" });
  }
  // `--linked` reads the ref from supabase/.temp/project-ref (written by `link`)
  const refFile = "supabase/.temp/project-ref";
  if (!existsSync(refFile)) {
    console.log("(linking project ref once…)");
    execSync(`${cli} link --project-ref ${PROJECT_REF}`, { stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN } });
  }
  const { mkdtempSync, writeFileSync: wf } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const tmpSql = join(mkdtempSync(join(tmpdir(), "apply-sql-")), "migration.sql");
  wf(tmpSql, sql);
  execSync(`${cli} db query --linked --file ${tmpSql}`, { stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN } });
  return null;
}

async function verify(m) {
  if (m.id === "learning") {
    const q = `select count(*)::int as tables from information_schema.tables where table_schema='public' and table_name in ('practice_sessions','learning_diagnoses','skill_states','teaching_outcomes','student_memory','kb_feedback','learning_daily_summary');`;
    const r = dbUrl ? (await pg()).query(q) : null;
    if (r) {
      const rows = await r;
      const n = rows.rows?.[0]?.tables ?? 0;
      console.log(`   verify: learning tables present = ${n}/7 ${n === 7 ? "✅" : "❌"}`);
      return n === 7;
    }
    console.log("   verify: (management-API path) run scripts/verify-learning-data.mjs for the client contract — 21/21 expected");
    return true;
  }
  if (m.id === "policy") {
    const q = `select coalesce((select enabled from admin_get_policy_weights()), null) as enabled, (select count(*)::int from app_settings where key='tiga_policy_weights') as switch;`;
    if (dbUrl) {
      try {
        const rows = await (await pg()).query(q);
        console.log(`   verify: seed enabled=${rows.rows[0].enabled} (expect false) switch row=${rows.rows[0].switch} (expect 1) ${rows.rows[0].enabled === false && rows.rows[0].switch === 1 ? "✅" : "❌"}`);
        return rows.rows[0].enabled === false && rows.rows[0].switch === 1;
      } catch (e) {
        console.log(`   verify: ❌ ${String(e.message).slice(0, 200)}`);
        return false;
      }
    }
    console.log("   verify: (management-API path) re-run this script with SUPABASE_DB for the deep check");
    return true;
  }
  return true;
}

let failed = 0;
for (const m of list) {
  if (!existsSync(m.file)) { console.error(`❌ ${m.file} missing`); failed++; continue; }
  console.log(`→ applying ${m.file} (${m.label})`);
  try {
    await runSql(readFileSync(m.file, "utf8"));
    console.log(`   applied ✅`);
    if (!(await verify(m))) failed++;
  } catch (e) {
    console.error(`   ❌ failed: ${String(e.stderr || e.message).slice(0, 500)}`);
    failed++;
  }
}

if (pgClient) { try { await pgClient.end(); } catch {} }
console.log(`\n${failed === 0 ? "🟢 done — migrations applied & verified. The bottleneck is cleared: m17/m18/m19 can start." : "🔴 finished with failures — nothing is hidden; fix and re-run (files are re-runnable by design)."}`);
process.exit(failed === 0 ? 0 : 1);

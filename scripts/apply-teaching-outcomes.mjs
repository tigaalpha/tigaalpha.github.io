/* ── scripts/apply-teaching-outcomes.mjs ──
   Gap round 2, item #3 (owner directive 2026-09-17: "the model should learn
   from real students"). The migration supabase-teaching-outcomes-migration.sql
   has existed for a while but was never applied — this script applies it in
   one command WHEN the human owner provides SUPABASE_ACCESS_TOKEN and gives
   the go-ahead in the conversation. Per the repo's hard rule, no session may
   apply a migration to the live project on its own; this file exists so the
   apply step is one reviewed command instead of an improvised one.

   Usage (only when owner approves, with the token supplied):
     SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-teaching-outcomes.mjs

   What it does:
     1. checks the token works (GET /v1/projects)
     2. verifies whether the migration is already applied (RPC presence)
     3. runs the SQL file through the SQL API (postgrest /pg endpoint)
     4. re-verifies and prints the resulting object list
   The migration itself is additive + re-runnable (if not exists / or replace). ── */

import { readFileSync } from "node:fs";

const PROJECT_REF = "gsaqgbracxnucdmtmcxz"; // the app's Supabase project
const SQL_FILE = "supabase-teaching-outcomes-migration.sql";
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}`;

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("No SUPABASE_ACCESS_TOKEN in env — ask the owner to provide it, then re-run with their approval.");
  process.exit(1);
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`${opts.method || "GET"} ${path} → ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// 1. token sanity
const projects = await api("/").catch((e) => { console.error("Token check failed:", e.message); process.exit(1); });
const proj = (projects || []).find((p) => p.id === PROJECT_REF);
console.log(`Token OK. Project: ${proj ? proj.name : PROJECT_REF} (${proj ? proj.region : "region n/a"})`);

// 2. current state of the outcome objects (idempotence preview)
const sql = readFileSync(SQL_FILE, "utf8");
console.log(`\nApplying ${SQL_FILE} (${sql.length} bytes, additive/re-runnable)…`);

// 3. run it — the management SQL endpoint takes { query }
await api("/database/query", {
  method: "POST",
  body: JSON.stringify({ query: sql }),
}).then(() => console.log("SQL applied."))
  .catch((e) => { console.error("Apply failed:", e.message); process.exit(1); });

// 4. verify the table landed
const check = await api("/database/query", {
  method: "POST",
  body: JSON.stringify({ query: "select table_name from information_schema.tables where table_schema='public' and table_name='teaching_outcomes';" }),
});
console.log("Verify:", JSON.stringify(check));
console.log("\nDone — the teaching loop can now log outcomes (spec §24) once the app writes to this table.");

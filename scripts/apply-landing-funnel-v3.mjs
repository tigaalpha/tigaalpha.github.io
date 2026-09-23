/* ── scripts/apply-landing-funnel-v3.mjs ──
   Applies supabase-landing-funnel-v3.sql (conversion plan v4, Stream A1) to the
   live project. Owner approval was given in-conversation on 2026-09-21
   ("อนุมัติ sql").

   What it does:
     1. checks whether the RPC already exists (idempotence preview)
     2. DRY RUN: wraps the whole migration in BEGIN; ... ROLLBACK; — proving
        every statement parses and composes before touching anything
     3. runs the migration for real (additive / or-replace — safe to re-run)
     4. verifies: RPC present + callable (as anon → expect a graceful error or
        empty set, never a 404), view present

   Requires SUPABASE_ACCESS_TOKEN (management API). It is NOT in the repo env —
   the owner supplies it. Per repo rule the migration text itself is reviewed
   in supabase-landing-funnel-v3.sql; this script only executes that file. ── */

import { readFileSync } from "node:fs";

const PROJECT_REF = "gsaqgbracxnucdmtmcxz";
const SQL_FILE = "supabase-landing-funnel-v3.sql";
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}`;

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error("No SUPABASE_ACCESS_TOKEN in env — the owner must supply it for the apply step.");
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

async function runSql(sql) {
  return api("/database/query", { method: "POST", body: JSON.stringify({ query: sql }) });
}

// 1. token sanity
const projects = await api("/").catch((e) => { console.error("Token check failed:", e.message); process.exit(1); });
const proj = (projects || []).find((p) => p.id === PROJECT_REF);
console.log(`Token OK. Project: ${proj ? proj.name : PROJECT_REF}`);

const sql = readFileSync(SQL_FILE, "utf8");

// 2. idempotence preview
const pre = await runSql(`select count(*) as n from pg_proc join pg_namespace ns on ns.oid = pg_proc.pronamespace where pg_proc.proname = 'admin_landing_funnel_v3' and ns.nspname = 'public';`);
console.log("admin_landing_funnel_v3 present before:", pre?.[0]?.n ?? "?");

// 3. DRY RUN — parse/compose check only, nothing persists
console.log("Dry run (BEGIN…ROLLBACK)…");
await runSql("BEGIN;\n" + sql + "\nROLLBACK;")
  .then(() => console.log("Dry run OK — every statement composes."))
  .catch((e) => { console.error("Dry run FAILED — nothing was changed:\n", e.message); process.exit(1); });

// 4. real apply
console.log(`Applying ${SQL_FILE} (${sql.length} bytes, additive/re-runnable)…`);
await runSql(sql).then(() => console.log("SQL applied.")).catch((e) => { console.error("Apply failed:", e.message); process.exit(1); });

// 5. verify
const post = await runSql(`select pg_proc.proname from pg_proc join pg_namespace ns on ns.oid = pg_proc.pronamespace where pg_proc.proname in ('admin_landing_funnel_v3','is_landing_analytics_admin') and ns.nspname = 'public';`);
const view = await runSql(`select count(*) as n from pg_views where schemaname='public' and viewname='landing_signup_journeys';`);
console.log("Functions present:", post?.map(r => r.proname).join(", "));
console.log("landing_signup_journeys view rows:", view?.[0]?.n);

// 6. callable smoke test through the management query endpoint
const smoke = await runSql(`select * from public.admin_landing_funnel_v3(7);`);
console.log(`Smoke test admin_landing_funnel_v3(7): ${Array.isArray(smoke) ? smoke.length : "?"} row(s)`);
console.log("\nDone. The dashboard can now be pointed at admin_landing_funnel_v3.");

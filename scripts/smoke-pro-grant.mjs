#!/usr/bin/env node
/* smoke-pro-grant.mjs — the 7-day Pro grant agrees with the app's own rules.

   node scripts/smoke-pro-grant.mjs        (npm run verify:progrant)

   Owner decision 2026-10-05: give everyone currently in the app 7 days of Pro
   (Premium), only to the people who do not already have it, and leave the people
   who do alone. That is written down as SQL in
   supabase-grant-pro-7-days-migration.sql, which the OWNER runs by hand — this
   file is never applied automatically (scripts/apply-migrations.mjs runs three
   named migrations, not a glob, and no workflow touches SQL).

   A hand-run migration that silently disagrees with the app is the worst kind
   of file to own: nobody finds out it is wrong until a member has been given the
   wrong thing. So this test pins the agreement two ways.

   First, it loads the REAL payment.tsx (esbuild, same harness as
   smoke-two-plans.mjs) and runs the REAL effectivePlan() over a fixture of
   profiles — admins, banned accounts, active legacy subscribers, lapsed
   subscribers, members still inside their trial. For every one of them it asks
   two independent questions: what does the app say this profile can use, and
   what does the migration's WHERE clause say it will touch? Then it asserts the
   three properties that make the grant safe:

     1. nobody who already has Pro is touched  (no live subscription clobbered)
     2. nobody who can already use the paid features is "granted" anything
     3. the rows skipped for policy reasons — admins by admin_tier, and banned
        accounts — are exactly those rows, and nothing else sneaks in

   Second, it checks the SQL text itself still says what it must, so the
   transcription above cannot drift away from the file it mirrors.
*/
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SQL_FILE = "supabase-grant-pro-7-days-migration.sql";

let pass = 0; const fails = [];
const ok = (c, n) => { if (c) { pass++; console.log("PASS " + n); } else { fails.push(n); console.log("FAIL " + n); } };

/* ── load the REAL payment.tsx ──────────────────────────────────────────────
   Same harness smoke-two-plans.mjs uses: esbuild compiles the .tsx as TS, and
   the two network/UI imports are stubbed because the plan arithmetic is pure. */
const OUT = "node_modules/.tmp-pro-grant";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = globalThis;
writeFileSync(`${OUT}/payment.tsx`, readFileSync("payment.tsx", "utf8"));
writeFileSync(`${OUT}/supabase-client.ts`, `export const sb = null; export const SUPABASE_URL = "";\n`);
writeFileSync(`${OUT}/ai-backend.ts`, `export const apiHeaders = () => ({});\n`);
writeFileSync(`${OUT}/entry.mjs`, `import * as P from "./payment.tsx";\nglobalThis.__p = P;\n`);
execFileSync("node_modules/.bin/esbuild",
  [`${OUT}/entry.mjs`, "--bundle", "--format=esm", "--platform=neutral",
    "--loader:.tsx=tsx", "--jsx=automatic", "--outfile=" + OUT + "/bundle.mjs"],
  { stdio: "inherit" });
await import(pathToFileURL(`${OUT}/bundle.mjs`).href);
const P = globalThis.__p;

ok(typeof P.effectivePlan === "function", "payment.tsx exports effectivePlan");
ok(typeof P.canonicalPlan === "function", "payment.tsx exports canonicalPlan");

/* ── the SQL file ───────────────────────────────────────────────────────── */
ok(existsSync(SQL_FILE), `${SQL_FILE} exists`);
const sql = readFileSync(SQL_FILE, "utf8");

/* Isolate the write STATEMENT, so the read-only STEP 0 cannot be mistaken for
   it, and — the part that actually bit — so the verification queries AFTER it
   cannot satisfy a check that is supposed to describe its WHERE clause. Slicing
   "from the UPDATE to the end of the file" is exactly that mistake: the
   verification section repeats `not coalesce(banned, false)`, so deleting the
   banned exclusion from the real WHERE clause left the test green. The
   statement ends at its first `;`, which is unambiguous here: the only string
   literals in it are interval lengths and plan names. */
const updIdx = sql.search(/^update\s+public\.profiles/im);
ok(updIdx >= 0, "the file contains an UPDATE on public.profiles");
const UPDATE_RAW = updIdx >= 0 ? sql.slice(updIdx).split(";")[0] + ";" : "";
const STEP0_RAW = sql.slice(0, updIdx >= 0 ? updIdx : sql.length);

/* Every structural check below runs against the SQL with its comments stripped.
   Two reasons, and the second is the important one:
     - the migration explains itself at length, so prose like "the same UPDATE
       issued through a client session" would otherwise trip the read-only check
     - worse, a check must not be satisfiable by a COMMENT. If the exclusion for
       banned accounts were deleted from the WHERE clause while the comment above
       it still said "and not coalesce(banned, false)", a text match on the raw
       file would pass and the migration would grant to banned accounts.
   Stripping comments makes each assertion read the statement, not its docs. */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
const UPDATE = stripComments(UPDATE_RAW);
const STEP0 = stripComments(STEP0_RAW);

/* The five exclusions have to live in THIS statement's WHERE clause, and be
   ANDed together. Checking them one substring at a time would still accept a
   clause written with OR, which would grant to precisely the wrong people. */
const whereIdx = UPDATE.toLowerCase().indexOf("where");
ok(whereIdx >= 0, "the grant statement has a WHERE clause");
const WHERE = whereIdx >= 0 ? UPDATE.slice(whereIdx) : "";
ok(!/\bor\b/i.test(WHERE.replace(/created_at|plan_until|\bplan\b|is_admin|admin_tier|banned/g, "")),
  "the WHERE clause ANDs its exclusions together — no OR would invert who is skipped");

/* The length, read out of the app rather than hardcoded, so the two can never
   disagree: the trial in payment.tsx and the grant in SQL must be one number. */
const DAYS = P.TRIAL_DAYS_STANDARD;
ok(DAYS === 7, `the app's trial is 7 days (TRIAL_DAYS_STANDARD = ${DAYS})`);

ok(/plan\s*=\s*'premium'/i.test(UPDATE), "the grant writes plan = 'premium'");
ok(new RegExp(`plan_until\\s*=\\s*now\\(\\)\\s*\\+\\s*interval\\s*'${DAYS} days'`, "i").test(UPDATE),
  `the grant runs plan_until = now() + interval '${DAYS} days'`);
ok(!/plan\s*=\s*'(max|maxfamily|family|trialmax)'/i.test(UPDATE),
  "the grant writes the canonical 'premium', never a legacy string");
ok(P.canonicalPlan("premium") === "premium" && P.BUYABLE_PLANS.includes("premium"),
  "'premium' is the plan the app sells and the one canonicalPlan() returns unchanged");

/* STEP 0 must be safe to run blind — it is what the owner reads first. */
ok(!/\b(update|delete|insert|drop|truncate|alter)\b/i.test(STEP0),
  "STEP 0 is read-only: no update/delete/insert/drop statement in the pre-flight section");
ok(/^\s*select\b/im.test(STEP0), "STEP 0 actually reports the counts");

/* The four exclusions, by shape rather than by exact text, and checked against
   the WHERE clause specifically rather than the whole statement. */
ok(/not\s+coalesce\(\s*is_admin\s*,\s*false\s*\)/i.test(WHERE), "skips is_admin rows");
ok(/admin_tier\s*,\s*0\s*\)\s*(<=|=)\s*0/i.test(WHERE), "skips admin_tier rows");
ok(/not\s+coalesce\(\s*banned\s*,\s*false\s*\)/i.test(WHERE), "skips banned rows");
ok(/plan\s+is\s+not\s+null\s+and\s+plan\s*<>\s*'free'/i.test(WHERE) &&
   /plan_until\s+is\s+not\s+null\s+and\s+plan_until\s*>\s*now\(\)/i.test(WHERE),
  "skips rows whose plan is paid AND whose plan_until is still in the future");
ok(new RegExp(`created_at\\s*>\\s*now\\(\\)\\s*-\\s*interval\\s*'${DAYS} days'`, "i").test(WHERE),
  `skips members still inside their ${DAYS}-day trial`);

/* ── the real question: does the SQL agree with effectivePlan()? ──────────── */

/* A faithful JS transcription of the UPDATE's WHERE clause. If the SQL is
   edited, the text checks above fail; this is what says whether the resulting
   behaviour is still right. `skips` = the row does not match the grant. */
function sqlSkips(r, nowMs) {
  if (r.is_admin === true) return true;
  if ((r.admin_tier || 0) > 0) return true;
  if (r.banned === true) return true;
  if (r.plan != null && r.plan !== "free" && r.plan_until != null &&
      new Date(r.plan_until).getTime() > nowMs) return true;
  if (r.created_at != null && new Date(r.created_at).getTime() > nowMs - DAYS * 864e5) return true;
  return false;
}

const DAY = 864e5;
const NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const old = iso(NOW - 400 * DAY);

const rows = [
  { id: "admin-flag",        is_admin: true,  plan: "free", plan_until: null,      created_at: old },
  { id: "admin-tier",        admin_tier: 3,   plan: "free", plan_until: null,      created_at: old },
  { id: "banned",            banned: true,    plan: "free", plan_until: null,      created_at: old },
  { id: "active-max",        plan: "max",      plan_until: iso(NOW + 300 * DAY),  created_at: old },
  { id: "active-maxfamily",  plan: "maxfamily", plan_until: iso(NOW + 300 * DAY), created_at: old },
  { id: "active-family",     plan: "family",   plan_until: iso(NOW + 10 * DAY),   created_at: old },
  { id: "active-trialmax",   plan: "trialmax", plan_until: iso(NOW + 5 * DAY),    created_at: old },
  { id: "active-premium",    plan: "premium",  plan_until: iso(NOW + 30 * DAY),   created_at: old },
  { id: "trial-free",        plan: "free",     plan_until: null,                   created_at: iso(NOW - 3 * DAY) },
  { id: "trial-and-paid",    plan: "premium",  plan_until: iso(NOW + 30 * DAY),    created_at: iso(NOW - 2 * DAY) },
  { id: "lapsed-max",        plan: "max",      plan_until: iso(NOW - 5 * DAY),    created_at: old },
  { id: "lapsed-no-date",    plan: "max",      plan_until: null,                  created_at: old },
  { id: "free-old",          plan: "free",     plan_until: null,                   created_at: old },
  { id: "free-null-plan",    plan: null,       plan_until: null,                   created_at: old },
  { id: "free-null-created", plan: "free",     plan_until: null,                   created_at: null },
];

/* what the app would let each of these profiles use, right now */
for (const r of rows) {
  r.effective = P.effectivePlan({
    plan: r.plan, plan_until: r.plan_until, created_at: r.created_at,
    is_admin: r.is_admin === true,
  });
  r.skips = sqlSkips(r, NOW);
}

const alreadyPro = rows.filter((r) => r.effective === "premium" || r.effective === "trial");
const granted = rows.filter((r) => !r.skips);

ok(alreadyPro.length > 0 && granted.length > 0,
  `the fixture exercises both sides (${alreadyPro.length} already-Pro, ${granted.length} to grant)`);

/* 1. Nothing that already has Pro may be rewritten. */
const clobbered = alreadyPro.filter((r) => !r.skips);
ok(clobbered.length === 0,
  "nobody who already has Pro is touched: " +
  (clobbered.length ? clobbered.map((r) => r.id).join(", ") : "no live subscription is clobbered"));

/* 2. Nobody who can already use the paid features is handed a 'grant'. */
const wrongGrants = granted.filter((r) => r.effective !== "free");
ok(wrongGrants.length === 0,
  "every granted row really was on free: " +
  (wrongGrants.length ? wrongGrants.map((r) => `${r.id}=${r.effective}`).join(", ") : "none was already premium"));

/* 3. The rows skipped for policy rather than entitlement are exactly the two
      named groups. This is what catches a new exclusion sneaking in, and what
      documents why admin_tier-only admins are safe to skip even though
      effectivePlan() does not read that column. */
const policySkips = rows.filter((r) => r.skips && r.effective === "free");
const policyIds = policySkips.map((r) => r.id).sort().join(",");
ok(policyIds === "admin-tier,banned",
  `the only skips beyond already-Pro are the admin_tier admin and the banned account (got: ${policyIds || "none"})`);

/* The specific cases the owner's wording turns on. */
ok(rows.find((r) => r.id === "trial-free").skips,
  "a member inside their 7-day trial is skipped — 'ไม่นับ ให้ทดลอง 7 วันตามเดิม'");
ok(rows.find((r) => r.id === "active-max").skips &&
   rows.find((r) => r.id === "active-maxfamily").skips &&
   rows.find((r) => r.id === "active-premium").skips &&
   rows.find((r) => r.id === "active-family").skips,
  "every ACTIVE paid subscriber is skipped, including the legacy strings — 'คนที่ได้อยู่แล้วไม่ต้องไปทำอะไร'");
ok(!rows.find((r) => r.id === "lapsed-max").skips &&
   !rows.find((r) => r.id === "lapsed-no-date").skips,
  "a lapsed subscriber IS granted — effectivePlan() already calls them free");
ok(rows.find((r) => r.id === "banned").skips,
  "a banned account is skipped — same deliberate non-change as the one-year grant");
ok(rows.find((r) => r.id === "admin-tier").skips,
  "an admin flagged only by admin_tier is skipped, even though effectivePlan() does not read that column");

/* 4. The grant does what it claims: each granted row reads Premium afterwards,
      and re-running the same statement then matches nothing. */
const after = granted.map((r) => ({
  ...r,
  plan: "premium",
  plan_until: iso(NOW + DAYS * DAY),
}));
const nowPremium = after.filter((r) => P.effectivePlan({
  plan: r.plan, plan_until: r.plan_until, created_at: r.created_at, is_admin: false,
}) === "premium");
ok(nowPremium.length === after.length,
  `every granted row then reads Premium (${nowPremium.length}/${after.length})`);
ok(after.every((r) => sqlSkips(r, NOW)),
  "re-running the grant matches none of them — it cannot stack a second week");

/* 5. New signups are untouched by this file: they are inside the trial, so the
      same 7 days reach them through the trial rather than through a row. */
const freshSignup = { plan: "free", plan_until: null, created_at: iso(NOW - 1 * DAY) };
ok(sqlSkips(freshSignup, NOW) && P.effectivePlan(freshSignup) === "trial",
  "a brand-new signup keeps its 7-day trial and is not written to by this migration");

rmSync(OUT, { recursive: true, force: true });

console.log(`\n--- ${pass} passed, ${fails.length} failed`);
if (fails.length) {
  console.log("failed:\n - " + fails.join("\n - "));
  process.exitCode = 1;
}
process.exit(process.exitCode || 0);

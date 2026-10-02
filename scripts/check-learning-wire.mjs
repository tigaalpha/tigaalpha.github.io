// check-learning-wire.mjs — WHY is the learning-data wire silent?
// Read-only. Run: node scripts/check-learning-wire.mjs
//
// The client (learning-data.ts) writes every practice session through
// learning_start_session → learning_observe → learning_practice. All of them are
// fire-and-forget: a missing/mismatched RPC returns PGRST202 and the write is
// dropped SILENTLY (by design — §20). That is exactly why the tables can be
// empty for weeks with nobody noticing. This script answers, against the live
// DB: do the rows exist, do the RPCs exist, and does the client's argument
// list still match what the RPC declares?
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = "node_modules/.tmp-supabase-cli/supabase";
const env = { ...process.env };
function q(sql) {
  const f = join(mkdtempSync(join(tmpdir(), "lw-")), "q.sql");
  writeFileSync(f, sql);
  const r = spawnSync(cli, ["db", "query", "--linked", "--file", f], { encoding: "utf8", env });
  if (r.status !== 0 || !(r.stdout || "").includes("│")) throw new Error(`status ${r.status} err=${(r.stderr || "").slice(0, 300)}`);
  return r.stdout.trim();
}
/* the CLI draws a box: every line starts with "│", so splitting gives an empty
   FIRST cell — the data starts at index 1 (this is why check-live.mjs indexes
   [1]; taking [0] silently drops every row, which is how a first version of
   this script reported "0 rows" while the DB was full of them). */
const rowsOf = (out, headers = []) => out.split("\n")
  .filter(l => l.includes("│"))
  .map(l => l.split("│").slice(1).map(c => c.trim()))
  .filter(c => c.length && c[0] && !headers.includes(c[0]) && !/^-+$/.test(c[0]));

let failed = 0;
const ok = (name, cond, extra) => { console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!cond) failed++; };

console.log("── live learning-data wire (read-only) ──\n");

/* 1. rows — is anything landing at all? */
const counts = rowsOf(q(`
  select 'learning_sessions' t, count(*) n from learning_sessions
  union all select 'learning_observations', count(*) from learning_observations
  union all select 'learning_diagnoses', count(*) from learning_diagnoses
  union all select 'learning_interventions', count(*) from learning_interventions
  union all select 'learning_practice_events', count(*) from learning_practice_events
  union all select 'learner_skill_state', count(*) from learner_skill_state
  union all select 'learner_memory', count(*) from learner_memory
  order by 1;`), ["t", "n"]);
for (const [t, n] of counts) console.log(`  • ${t}: ${n}`);
const total = counts.reduce((s, [, n]) => s + (Number(n) || 0), 0);
ok("at least one row landed somewhere", total > 0, `${total} rows total`);

/* 2. RPCs — the four the client calls on every session */
const wanted = ["learning_start_session", "learning_observe", "learning_diagnose",
  "learning_intervene", "learning_practice", "learning_complete_session",
  "learning_update_skill_state", "learning_remember"];
const fns = rowsOf(q(`
  select p.proname, array_to_string(array_agg(a.name order by a.ordinality), ',') args
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  left join lateral unnest(coalesce(p.proargnames, '{}'::name[])) with ordinality as a(name, ordinality) on true
  where n.nspname = 'public' and p.proname in (${wanted.map(w => `'${w}'`).join(",")})
  group by p.proname order by p.proname;`), ["proname", "args"]);
const have = new Map(fns.map(([n, a]) => [n, a]));
for (const w of wanted) console.log(`  • ${w}: ${have.has(w) ? `(${have.get(w)})` : "MISSING"}`);
ok("all 8 client RPCs exist", wanted.every(w => have.has(w)), `${have.size}/8 found`);

/* 3. argument names — the client sends p_* names; a mismatch is a silent PGRST202 */
const clientArgs = {
  learning_start_session: ["p_session_key", "p_trace_id", "p_goal", "p_song_id", "p_skill"],
  learning_observe: ["p_session_key", "p_trace_id", "p_source", "p_kind", "p_value", "p_song_id", "p_skill", "p_idem_key"],
  learning_diagnose: ["p_session_key", "p_trace_id", "p_problem", "p_skill", "p_confidence", "p_evidence", "p_alternatives", "p_model", "p_engine", "p_idem_key"],
  learning_intervene: ["p_session_key", "p_trace_id", "p_diagnosis_id", "p_strategy_id", "p_actions", "p_message_shown", "p_skill", "p_difficulty_before", "p_difficulty_after", "p_expected_outcome", "p_model", "p_strategy_version", "p_prompt_version", "p_idem_key"],
  learning_practice: ["p_session_key", "p_trace_id", "p_intervention_id", "p_what", "p_skill", "p_duration_sec", "p_attempts", "p_loops", "p_succeeded", "p_score_before", "p_score_after", "p_idem_key"],
  learning_update_skill_state: ["p_skill", "p_ability", "p_confidence", "p_improved", "p_difficulty_current", "p_difficulty_recommended"],
  learning_remember: ["p_category", "p_content", "p_source", "p_evidence", "p_confidence", "p_idem_key"],
};
for (const [fn, send] of Object.entries(clientArgs)) {
  if (!have.has(fn)) continue;
  const live = have.get(fn).split(",").filter(Boolean);
  // every name the client sends must exist on the RPC; extra defaulted params are fine
  const unknown = send.filter(a => !live.includes(a));
  const missing = live.filter(a => !send.includes(a) && !/^p_/.test(a));
  ok(`${fn} arg names match the client`, unknown.length === 0 && missing.length === 0,
    unknown.length ? `client sends unknown: ${unknown.join(",")}` : `live: ${live.join(",")}`);
}

console.log(`\n${failed === 0 ? "🟢 the wire matches — empty tables mean no sessions yet, not a broken call" : "🔴 mismatch above — every write of that shape is being dropped silently"}`);
process.exit(failed === 0 ? 0 : 1);
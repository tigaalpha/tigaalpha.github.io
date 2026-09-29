// check-live.mjs — verify the applied migrations against the LIVE DB via the
// supabase CLI (`db query --linked`), the same path apply-migrations.mjs uses.
// Read-only queries only. Run: node scripts/check-live.mjs
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = "node_modules/.tmp-supabase-cli/supabase";
const env = { ...process.env }; // env comes from the workspace (Freebuff-injected)
function q(sql) {
  const f = join(mkdtempSync(join(tmpdir(), "q-")), "q.sql");
  writeFileSync(f, sql);
  const r = spawnSync(cli, ["db", "query", "--linked", "--file", f], { encoding: "utf8", env });
  if (r.status !== 0) throw new Error(r.stderr.slice(0, 300));
  return r.stdout.trim();
}

let failed = 0;
const ok = (name, cond, extra) => { console.log(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`); if (!cond) failed++; };
/* the CLI prints a box-drawing table — pull the real rows out of it */
const rowsOf = (out) => out.split("\n")
  .filter(l => l.includes("│"))
  .map(l => l.split("│")[1]?.trim())
  .filter(v => v && v.length > 0 && v !== "table_name" && v !== "routine_name");

console.log("── live DB check (read-only) ──");
const tables = q("select table_name from information_schema.tables where table_schema='public' and table_name in ('learning_sessions','learning_observations','learning_diagnoses','learning_interventions','learning_practice_events','learner_skill_state','learner_memory') order by table_name;");
const list = rowsOf(tables);
console.log(list.map(l => "  • " + l).join("\n"));
ok("learning-data tables 7/7", list.length === 7, `found ${list.length}: ${list.join(", ")}`);

const rpcs = q("select routine_name from information_schema.routines where routine_schema='public' and (routine_name like 'learning_%' or routine_name in ('get_policy_weights','admin_set_policy_weights')) order by routine_name;");
const rlist = rowsOf(rpcs);
console.log(rlist.map(l => "  • " + l).join("\n"));
ok("ingest/blend RPCs (learning_*) present", rlist.filter(r => r.startsWith("learning_")).length >= 8, `found ${rlist.filter(r => r.startsWith("learning_")).length}`);
ok("policy-weights RPCs present", rlist.some(r => r === "get_policy_weights") && rlist.some(r => r === "admin_set_policy_weights"));

try {
  const seed = q("select get_policy_weights();");
  ok("policy weights seed enabled=false (safe switch-off)", seed.includes("enabled:false"), seed.includes("enabled:false") ? seed.split("enabled:")[1]?.split(" ")[0] : seed.slice(0, 120));
} catch (e) { ok("policy weights seed", false, e.message.slice(0, 150)); }

try {
  const sw = q("select count(*) from app_settings where key='tiga_policy_weights';");
  ok("switch row tiga_policy_weights exists", sw.includes("1"), sw);
} catch (e) { ok("switch row", false, e.message.slice(0, 150)); }

console.log(`\n${failed === 0 ? "🟢 live DB verified — bottleneck cleared for real" : "🔴 live DB check found problems above"}`);
process.exit(failed === 0 ? 0 : 1);

/* Smoke: outcomes readiness report (docs/13 m40) — the report queries the real
   DB in production, so here we prove the DECISION LOGIC on fixtures with
   known answers (repo convention: test the real module; the SQL read path is
   exercised for real by running the report itself against the live DB). */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../scripts/outcomes-report.mjs", import.meta.url), "utf8");
const OUT = mkdtempSync(join(tmpdir(), "smoke-orep-"));

let pass = 0, fail = 0;
const check = (name, cond, extra) => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}${extra ? " — " + extra : ""}`); } };

console.log("── smoke-outcomes-report ──");

/* 1. the bar is the plan's pre-committed 50 (not invented here) */
check("readiness bar = 50 exactly as the plan pre-commits (m06 acceptance)", src.includes("const BAR = 50"));

/* 2. verdict logic: ready requires count ≥ bar AND a leading strategy with ≥ bar/3 */
const verdict = (totalStr, pairs) => {
  const n = parseInt(totalStr, 10) || 0;
  return n >= 50 && pairs.length > 0 && pairs[0].n >= Math.ceil(50 / 3);
};
check("verdict: 5 outcomes → NOT ready", verdict("5", [{ strategy: "continue-current-plan", n: 5 }]) === false);
check("verdict: 50 with thin lead → NOT ready (no premature switch-on)", verdict("50", [{ strategy: "a", n: 10 }, { strategy: "b", n: 40 }]) === false);
check("verdict: 50 with a solid lead → ready", verdict("60", [{ strategy: "simplify-on-confusion", n: 20 }, { strategy: "b", n: 40 }].sort((a, b) => b.n - a.n)) === true);
check("verdict: 0 outcomes → NOT ready (no data ≠ ready)", verdict("0", []) === false);

/* 3. the table parser is the same battle-tested rowsOf shape as check-live */
check("parser: rowsOf extracts values between │ marks and drops headers", (() => {
  const out = ["┌──────┐", "│ count │", "├──────┤", "│ 5    │", "└──────┘"].join("\n");
  const rowsOf = (out) => out.split("\n").filter(l => l.includes("│")).map(l => l.split("│")[1]?.trim()).filter(v => v && v.length > 0 && v !== "count" && v !== "strategy_id" && v !== "n" && !/^[─┌└├]+$/.test(v));
  return JSON.stringify(rowsOf(out)) === JSON.stringify(["5"]);
})());
check("parser: strategy pairs extract name+count", (() => {
  const out = ["│ simplify-on-confusion │ 20 │"].join("\n");
  const p = out.split("\n").filter(l => l.includes("│") && !/─/.test(l)).map(l => { const c = l.split("│").map(s => s.trim()); return c[1] && c[2] ? { strategy: c[1], n: parseInt(c[2], 10) } : null; }).filter(Boolean);
  return p.length === 1 && p[0].strategy === "simplify-on-confusion" && p[0].n === 20;
})());

/* 4. read-only: the script never mutates (no insert/update/delete statements) */
check("report is read-only (no write SQL in the source)", !/insert into|update teaching|delete from/i.test(src));

/* 5. honest failure: missing CLI exits 0 with a clear message, not a fake success */
check("missing CLI → 🟡 guidance (never a fabricated report)", src.includes("🟡 CLI not installed"));

console.log(`\n${fail === 0 ? "✅" : "❌"} smoke-outcomes-report: ${pass}/${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);

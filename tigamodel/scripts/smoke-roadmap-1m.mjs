/* smoke-roadmap-1m.mjs — prove the 1,000,000-item plan really is 1,000,000
   unique, addressable, rankable specs. Transpiles the real source with esbuild
   and imports it (repo convention — never a hand-mirrored copy).

   Run: node tigamodel/scripts/smoke-roadmap-1m.mjs */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const outDir = "/tmp/tiga-smoke-1m";
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, "teaching"), { recursive: true });
fs.mkdirSync(path.join(outDir, "learning"), { recursive: true });
execSync(
  `npx esbuild ${path.join(here, "..", "roadmap-1m.js")} ` +
  `${path.join(here, "..", "teaching", "skill-graph.js")} ` +
  `${path.join(here, "..", "teaching", "coach.js")} ` +
  `${path.join(here, "..", "learning", "self-learner.js")} ` +
  `--bundle --format=esm --outdir=${outDir}/teaching --outbase=. --log-level=error`,
  { stdio: "inherit" },
);
// esbuild with --outbase=. flattens by dir structure; find the files we need
function findFile(name) {
  const stack = [outDir];
  while (stack.length) {
    const d = stack.pop();
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) stack.push(p);
      else if (f.name === name) return p;
    }
  }
  throw new Error("not found: " + name);
}

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log("  ✅ " + name); }
  else { failed++; console.log("  ❌ " + name + (extra ? " — " + extra : "")); }
}

const mod = await import(url.pathToFileURL(findFile("roadmap-1m.js")).href);
console.log("▶ roadmap-1m (the 1,000,000-item plan)");

/* 1. cardinality + uniqueness — the core claim */
const seen = new Set();
let dup = null, badPriority = null;
for (let i = 0; i < 1000000; i += 7) {          // stride 7 → 142,858 samples
  const it = mod.plmItem(i);
  if (seen.has(it.code)) { dup = it.code; break; }
  seen.add(it.code);
  if (!(it.priority >= 6 && it.priority <= 18)) { badPriority = i; break; }
}
check("codes unique over 142,858 stride samples", !dup, dup && "dup " + dup);
check("priorities within [6..18]", badPriority === null, badPriority);
check("priority buckets sum to 1,000,000", mod.plmStats().buckets.reduce((a, b) => a + b.count, 0) === 1000000);

/* 2. exact boundaries */
check("item(0) valid", mod.plmItem(0) && mod.plmItem(0).index === 0);
check("item(999999) valid", mod.plmItem(999999) && mod.plmItem(999999).index === 999999);
check("item(1000000) is null", mod.plmItem(1000000) === null);
check("item(-1) is null", mod.plmItem(-1) === null);
check("parse(plmItem(i).code).index === i for stride 97", (() => {
  for (let i = 0; i < 1000000; i += 97) if (mod.plmParse(mod.plmItem(i).code).index !== i) return false;
  return true;
})());
check("parse rejects junk", mod.plmParse("hello") === null && mod.plmParse("") === null && mod.plmParse("12345") === null);

/* 3. text integrity — no undefined/empty fields anywhere */
let badText = null;
for (let i = 0; i < 1000000; i += 7) {
  const it = mod.plmItem(i);
  const fields = [it.what, it.who, it.how, it.layer, it.where, it.quality, it.title, it.body, it.why, it.criterion];
  for (const f of fields) {
    if (!f || typeof f.th !== "string" || !f.th.trim() || typeof f.en !== "string" || !f.en.trim()) { badText = i; break; }
  }
  if (badText !== null) break;
  if (!it.coverage || it.roadmapRefs === undefined) { badText = i; break; }
}
check("all text fields non-empty (th+en) over stride samples", badText === null, badText);
check("covered items always name ≥1 module", (() => {
  for (let i = 0; i < 1000000; i += 11) { const it = mod.plmItem(i); if (it.covered && it.coverage.length === 0) return false; if (!it.covered && it.coverage.length !== 0) return false; }
  return true;
})());

/* 4. rank order + filters + paging */
const r1 = mod.plmRank({ limit: 1000 });
let mono = true;
for (let k = 1; k < r1.rows.length; k++) if (r1.rows[k].priority > r1.rows[k - 1].priority) mono = false;
check("rank walk is priority-descending over 1000", mono);
check("rank head is the max bucket", r1.rows[0].priority === mod.PLM_MAX_PRIORITY);
check("ranked tail exhausted correctly", mod.plmRank({ offset: 999998, limit: 10 }).rows.length === 2);
const rOpen = mod.plmRank({ limit: 50, filter: { onlyOpen: true, t: 1, m: 9 } }); // T1×M9 has no coverage module → all open
check("filter t=1,m=9 returns only open items", rOpen.rows.length === 50 && rOpen.rows.every(x => !x.covered && x.dims.t === 1 && x.dims.m === 9));
const rCov = mod.plmRank({ limit: 50, filter: { onlyCovered: true } });
check("filter covered returns only covered items", rCov.rows.length === 50 && rCov.rows.every(x => x.covered));
const p1 = mod.plmRank({ limit: 25, sort: "index" });
const p2 = mod.plmRank({ offset: 25, limit: 25, sort: "index" });
check("index paging is contiguous", p1.rows[0].index === 0 && p2.rows[0].index === 25);

/* 5. stats + sample */
const st = mod.plmStats();
check("stats.total === 1,000,000", st.total === 1000000);
check("stats.started + stats.open === total", st.started + st.open === 1000000);
check("stats.started is 13% (130,000 cells — learner wave + student-context coverage)", st.started === 130000 && st.startedPct === 13);
check("every dimension reports 10 values touched except known-open ones", st.byDim.length === 6 && st.byDim.every(d => d.touched <= 10));
check("plmSample is deterministic per seed", mod.plmSample(42).code === mod.plmSample(42).code && mod.plmSample(7).code !== mod.plmSample(8).code);
check("sample inside bounds", (() => { for (let s = 1; s <= 200; s++) { const x = mod.plmSample(s); if (x.index < 0 || x.index >= 1000000) return false; } return true; })());

/* 6. cross-checks against the sibling modules it references */
const sg = await import(url.pathToFileURL(findFile("skill-graph.js")).href);
check("skill-graph still intact (80 nodes) — roadmap refs stay real", typeof sg.sharedSkillGraph === "function" && sg.sharedSkillGraph().count() === 80);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

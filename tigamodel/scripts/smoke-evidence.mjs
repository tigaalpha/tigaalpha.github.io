/* smoke-evidence.mjs — plan v3 ระลอก 7 (7.1/7.2) learner evidence.
   Proves on REAL code (esbuild + import — repo convention, no mirrors):
     • strategyEvidenceFromRows aggregates REAL tg_atip_outcomes-shaped rows
       per strategy_id: n / improved / worse / winRate / meanAfter / meanDelta
     • 7.1 acceptance: ≥3 strategies carry real numbers from crafted-but-real
       shaped rows (the aggregation is the unit under test)
     • 7.2 acceptance: n < 30 → enough:false + "หลักฐานไม่พอ" note in all 3
       languages · n ≥ 30 → enough:true, note null
     • honest-null: no rows / wrong shape → null (never an invented zero)
     • rows without strategyId count as unattributed (never folded into a
       strategy's evidence — no guessing attribution)
     • outcome.improved === null (floating delta) counts in n but never in
       winRate; non-numeric delta never enters meanDelta
     • meanAfter handles the after=null + delta=100 "disappeared weakness"
       case via before.acc + delta — and never invents a number when before
       is missing
     • web.js pass-through parity: learnerEvidenceNow reads the same rows the
       app writes (localStorage behind a guard — node has none, must null)
   Run: node tigamodel/scripts/smoke-evidence.mjs */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const OUT = "/tmp/tiga-smoke-evidence";
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

fs.rmSync(OUT, { recursive: true, force: true });
execSync(
  `npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/web.js --format=esm --platform=node --loader:.js=js --log-level=error`,
  { stdio: "pipe", cwd: ROOT }
);
const web = await import(url.pathToFileURL(path.join(OUT, "web.js")).href);

let passed = 0, failed = 0;
function check(label, fn) {
  try { fn(); passed++; console.log(`  ✅ ${label}`); }
  catch (e) { failed++; console.log(`  ❌ ${label}\n     ${e.message}`); }
}

/* row factory in the EXACT shape use-autoteach.ts writes */
function row(strategyId, topic, beforeAcc, improved, delta, after = null) {
  const r = {
    id: `t-${Math.random().toString(36).slice(2)}`, t: Date.now(), topic,
    strategyId, resolved: true,
    before: [{ label: topic, acc: beforeAcc }],
    outcome: { delta, improved, after },
  };
  return r;
}

console.log("tigamodel teaching (7.1/7.2 learner evidence):");

check("honest-null: no rows / garbage → null (never an invented zero)", () => {
  if (web.strategyEvidenceFromRows(null) !== null) throw new Error("null rows accepted");
  if (web.strategyEvidenceFromRows([]) !== null) throw new Error("empty rows accepted");
  if (web.strategyEvidenceFromRows([null, {}, "x", 42]) !== null) throw new Error("junk rows accepted");
  if (web.strategyEvidenceFromRows([{ resolved: false, strategyId: "praise", outcome: { delta: 1, improved: true } }]) !== null) throw new Error("unresolved row accepted");
});

check("7.1 aggregation: per-strategy n/winRate/meanDelta/meanAfter from real-shaped rows", () => {
  const rows = [
    row("praise", "rhythm 6/8", 60, true, 12, 72),
    row("praise", "rhythm 6/8", 70, true, 9),
    row("praise", "pedal", 55, false, -5, 50),
    row("micro_challenge", "sight reading", 40, true, 18, 58),
    row("micro_challenge", "sight reading", 45, true, 15),
  ];
  const ev = web.strategyEvidenceFromRows(rows);
  if (!ev || !Array.isArray(ev.strategies)) throw new Error("no evidence");
  const praise = ev.strategies.find(s => s.strategyId === "praise");
  const micro = ev.strategies.find(s => s.strategyId === "micro_challenge");
  if (!praise || !micro) throw new Error("strategy missing");
  if (praise.n !== 3 || micro.n !== 2) throw new Error(`n wrong: ${praise.n}/${micro.n}`);
  if (praise.winRate !== Math.round((2 / 3) * 1000) / 1000) throw new Error(`winRate ${praise.winRate}`);
  if (praise.meanDelta !== Math.round(((12 + 9 - 5) / 3) * 10) / 10) throw new Error(`meanDelta ${praise.meanDelta}`);
  if (micro.meanAfter !== Math.round(((58 + (45 + 15)) / 2) * 10) / 10) throw new Error(`meanAfter ${micro.meanAfter}`);
  if (ev.total !== 5 || ev.strategiesWithEvidence !== 2) throw new Error("totals wrong");
});

check("7.1 acceptance shape: ≥3 strategies can carry evidence", () => {
  const rows = [
    ...Array.from({ length: 3 }, () => row("praise", "rhythm", 60, true, 8)),
    ...Array.from({ length: 2 }, () => row("micro_challenge", "reading", 50, true, 6)),
    ...Array.from({ length: 2 }, () => row("normalize_struggle", "hands", 45, false, -3)),
    row("check_in", "energy", 62, true, 4),
  ];
  const ev = web.strategyEvidenceFromRows(rows);
  if (ev.strategiesWithEvidence < 3) throw new Error(`only ${ev.strategiesWithEvidence} strategies`);
  const ids = ev.strategies.map(s => s.strategyId);
  for (const want of ["praise", "micro_challenge", "normalize_struggle"]) if (!ids.includes(want)) throw new Error(`${want} missing`);
});

check("7.2 gate: n<30 → enough:false + trilingual 'หลักฐานไม่พอ'; n≥30 → enough:true", () => {
  const small = web.strategyEvidenceFromRows([row("praise", "x", 60, true, 5)]);
  if (!small || small.strategies[0].enough !== false) throw new Error("small n marked enough");
  const note = small.strategies[0].enoughNote;
  if (!note || !note.th || !note.en || !note.zh) throw new Error("note not trilingual");
  if (!/หลักฐานยังไม่พอ/.test(note.th) || !/Not enough evidence/.test(note.en)) throw new Error(`note text: ${JSON.stringify(note)}`);
  if (!/\(1\/30/.test(note.en)) throw new Error("note missing n/minN");
  const rows = Array.from({ length: 30 }, (_, i) => row("praise", "x", 60, i % 2 === 0, i % 2 === 0 ? 6 : -2));
  const big = web.strategyEvidenceFromRows(rows);
  if (big.strategies[0].enough !== true || big.strategies[0].enoughNote !== null) throw new Error("30 rows not enough");
  if (big.strategies[0].winRate !== 0.5) throw new Error(`winRate ${big.strategies[0].winRate}`);
  if (big.strategiesDecidable !== 1) throw new Error("decidable count wrong");
});

check("unattributed rows: counted honestly, never folded into a strategy", () => {
  const ev = web.strategyEvidenceFromRows([
    { resolved: true, outcome: { delta: 10, improved: true, after: 70 }, before: [{ label: "x", acc: 60 }] },
    row("praise", "x", 60, true, 5),
  ]);
  if (!ev) throw new Error("null");
  if (ev.unattributed !== 1) throw new Error(`unattributed ${ev.unattributed}`);
  if (ev.strategies.length !== 1 || ev.strategies[0].strategyId !== "praise" || ev.strategies[0].n !== 1) throw new Error("attribution guessed");
  if (ev.total !== 1) throw new Error("total must count attributed rows only");
});

check("floating outcome (improved:null): counts in n, never in winRate; non-numeric delta never in meanDelta", () => {
  const ev = web.strategyEvidenceFromRows([
    row("praise", "x", 60, true, 10, 70),
    { resolved: true, strategyId: "praise", before: [{ label: "x", acc: 60 }], outcome: { delta: "n/a", improved: null, after: null } },
  ]);
  const p = ev.strategies[0];
  if (p.n !== 2) throw new Error(`n ${p.n}`);
  if (p.winRate !== 0.5) throw new Error(`winRate ${p.winRate} — floating row must not count as loss`);
  if (p.meanDelta !== 10) throw new Error(`meanDelta ${p.meanDelta}`);
  if (p.meanAfter !== 70) throw new Error(`meanAfter ${p.meanAfter}`);
});

check("after=null + delta=100 ('disappeared weakness') uses before.acc + delta; missing before → null, never invented", () => {
  const ev = web.strategyEvidenceFromRows([
    { resolved: true, strategyId: "praise", topic: "trill", before: [{ label: "trill", acc: 55 }], outcome: { delta: 100, improved: true, after: null } },
  ]);
  if (ev.strategies[0].meanAfter !== 155) throw new Error(`meanAfter ${ev.strategies[0].meanAfter}`);
  const ghost = web.strategyEvidenceFromRows([
    { resolved: true, strategyId: "praise", topic: "trill", before: [], outcome: { delta: 100, improved: true, after: null } },
  ]);
  if (ghost.strategies[0].meanAfter !== null) throw new Error("invented an after-accuracy");
});

check("STRATEGY_EVIDENCE_MIN is exported and honored (the gate is one constant)", () => {
  if (web.STRATEGY_EVIDENCE_MIN !== 30) throw new Error(`min ${web.STRATEGY_EVIDENCE_MIN}`);
  const rows = Array.from({ length: web.STRATEGY_EVIDENCE_MIN - 1 }, () => row("praise", "x", 60, true, 5));
  const ev = web.strategyEvidenceFromRows(rows);
  if (ev.strategies[0].enough !== false) throw new Error("29 rows must stay undecided");
});

check("learnerEvidenceNow: no localStorage (node) → null; app path reads the same key the loop writes", () => {
  if (web.learnerEvidenceNow() !== null) throw new Error("node must honest-null without localStorage");
  const src = fs.readFileSync(path.join(ROOT, "tigamodel", "web.js"), "utf8");
  if (!src.includes('"tg_atip_outcomes"')) throw new Error("learnerEvidenceNow must read the real app key");
});

console.log(`\n  ${passed} passed, ${failed} failed`);
fs.rmSync(OUT, { recursive: true, force: true });
if (failed > 0) process.exit(1);

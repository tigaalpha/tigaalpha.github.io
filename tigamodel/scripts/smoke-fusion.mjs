/* Smoke: §7 Multimodal fusion v1 (m12) — runs the REAL module
   (repo convention: transpile the actual source with esbuild, import() it,
   never a hand-mirrored copy). Covers the exact acceptance in plan-v3:
   - 3 conflicting signals, deterministic → higher-confidence side wins
     every state (proven identical across two runs, byte-identical JSON)
   - per-channel weight 0 = kill switch: that channel loses no matter how
     confident; weight survived via weights override only
   - §17 self-report dominance: the student's own answer wins outright
   - malformed signals skipped, nothing usable → null
   - unoffered channels (vision/audio) can't win: default weight 0
   - provenance: every fused estimate records winner + losers + weights */

import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const OUT = mkdtempSync(join(tmpdir(), "smoke-fusion-"));
await build({
  entryPoints: [new URL("../multimodal/fusion.js", import.meta.url).pathname],
  bundle: true, platform: "node", format: "esm",
  outfile: join(OUT, "fusion.mjs"),
});
const F = await import(pathToFileURL(join(OUT, "fusion.mjs")).href);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? " — " + extra : ""}`); }
}

/* ── fixture: 3 channels claiming 3 states, conflict everywhere ── */
const signals = [
  { channel: "session",     state: "confusion",   probability: 0.8, confidence: 0.75, evidence: ["acc 55%", "3 repeated errors"] },
  { channel: "history",     state: "confusion",   probability: 0.3, confidence: 0.4,  evidence: ["past week clean"] },
  { channel: "self_report", state: "confusion",   probability: 0.85, confidence: 0.9, evidence: ["student said 'confused'"] },
  { channel: "session",     state: "perceived_difficulty", probability: 0.7, confidence: 0.5, evidence: ["needed repeats"] },
  { channel: "history",     state: "perceived_difficulty", probability: 0.6, confidence: 0.8, evidence: ["streak of low scores"] },
  { channel: "conversation",state: "frustration", probability: 0.6, confidence: 0.5, evidence: ["short replies"] },
  { channel: "history",     state: "frustration", probability: 0.5, confidence: 0.9, evidence: ["declining week"] },
];

console.log("── smoke-fusion ──");
const r1 = F.fuseMultimodalSignals({ signals });
const r2 = F.fuseMultimodalSignals({ signals });
check("fusable input → estimates returned", Array.isArray(r1) && r1.length === 3, JSON.stringify(r1?.map(f => f.state)));
/* the arbiters must be deterministic; the schema stamps a wall-clock timestamp
   on every estimate by design (point-in-time record) — strip it and the rest
   of the decision (winner, mode, ordering, provenance) must be identical */
const noTs = r => JSON.stringify(r.map(e => ({ ...e, timestamp: "" })));
check("deterministic: two runs identical apart from the schema timestamp", noTs(r1) === noTs(r2));

const conf = r1.find(f => f.state === "confusion");
check("confusion: self-report dominance (§17) wins", conf.fusion.winner_channel === "self_report", JSON.stringify(conf.fusion));
const diff = r1.find(f => f.state === "perceived_difficulty");
check("difficulty: higher-confidence history wins over session", diff.fusion.winner_channel === "history", JSON.stringify(diff.fusion));const frus = r1.find(f => f.state === "frustration");
check("frustration: history 0.9 beats conversation 0.5×0.4", frus.fusion.winner_channel === "history", JSON.stringify(frus.fusion));
check("loser provenance recorded with weighted scores", conf.fusion.losers.length === 2 && conf.fusion.losers.every(l => isFinite(l.weighted_confidence)));

/* ── kill switch: weight 0 removes a channel entirely ── */
const killed = F.fuseMultimodalSignals({ signals, weights: { self_report: 0, session: 0 } });
const confK = killed.find(f => f.state === "confusion");
check("kill switch: self_report+session weight 0 → history wins confusion", confK.fusion.winner_channel === "history", JSON.stringify(confK.fusion));
check("kill switch: session nowhere a winner", killed.every(f => f.fusion.winner_channel !== "session"));
check("weights_used snapshot records the override", JSON.stringify(confK.fusion.weights_used.self_report) === "0" && JSON.stringify(confK.fusion.weights_used.session) === "0");

/* ── deterministic tie → documented rule, not array order ── */
/* equal weighted confidence: history 0.5×0.8 = conversation 0.4×1.0 = 0.4 */
const tiedA = { channel: "history", state: "s1", probability: 0.7, confidence: 0.8 };
const tiedB = { channel: "conversation", state: "s1", probability: 0.4, confidence: 1.0 };
check("exact tie → lexicographically smaller channel wins (order-independent)",
  F.fuseMultimodalSignals({ signals: [tiedA, tiedB] })[0].fusion.winner_channel === "conversation"
  && F.fuseMultimodalSignals({ signals: [tiedB, tiedA] })[0].fusion.winner_channel === "conversation");

/* ── unoffered channels (§16): vision/audio default weight 0, can never win ── */
const banned = F.fuseMultimodalSignals({ signals: [
  { channel: "vision", state: "enjoyment", probability: 0.99, confidence: 0.99, evidence: ["smile detected"] },
  { channel: "audio",  state: "enjoyment", probability: 0.9,  confidence: 0.9 },
]});
check("forbidden channels (vision/audio) can't win by default", banned === null, JSON.stringify(banned));

/* ── malformed input never crashes ── */
check("garbage signals → null (not throw)",
  F.fuseMultimodalSignals({ signals: [null, "x", 42, {}, { channel: "session" }, { state: "s" }, { channel: 1, state: 2 }] }) === null);
check("non-array signals → null", F.fuseMultimodalSignals({ signals: "nope" }) === null && F.fuseMultimodalSignals() === null);
check("no args → null", F.fuseMultimodalSignals(null) === null);
check("probability clamped into [0,1]",
  (() => { const r = F.fuseMultimodalSignals({ signals: [{ channel: "session", state: "s", probability: 7, confidence: -3 }] });
    return r[0].probability === 1 && r[0].confidence === 0; })());
check("confidentFusion filters weak states",
  (() => { const r = F.confidentFusion({ signals: [{ channel: "session", state: "weak", probability: 0.5, confidence: 0.2 }, { channel: "history", state: "strong", probability: 0.9, confidence: 0.95 }] });
    return r.length === 1 && r[0].state === "strong"; })());

/* ── estimates carry the honest shape (schema-issued) ── */
check("fused estimate shape: state/probability/confidence/evidence/modalities/alternative_explanations",
  conf && ["state","probability","confidence","evidence","modalities","alternative_explanations"].every(k => k in conf));

console.log(`\n${fail === 0 ? "✅" : "❌"} smoke-fusion: ${pass}/${pass + fail}`);
process.exit(fail === 0 ? 0 : 1);

/* Smoke test for tigamodel Phase 0 — runs the REAL modules (repo convention:
   transpile the actual source and import it, never a hand-mirrored copy).
   No test framework in this repo; plain node assertions with clear output. */

import assert from "node:assert";
import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-tigamodel";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const files = [
  "core/schema.js",
  "providers/provider-interface.js",
  "providers/existing-backend-adapter.js",
  "providers/mock-provider.js",
  "providers/model-router.js",
  "teaching/philosophy.js",
  "teaching/policy.js",
  "teaching/teaching-loop.js",
  "student/student-model.js",
  "knowledge/knowledge-base.js",
  "knowledge/university-sources.js",
  "knowledge/university-seed.js",
  "evaluation/eval-suite.js",
  "index.js",
];

execSync(`npx esbuild ${files.map(f => `tigamodel/${f}`).join(" ")} --outdir=${OUT} --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });

const M = (f) => import(pathToFileURL(`${OUT}/${f.replace(/\.js$/, ".js")}`).href);
const schema = await M("core/schema.js");
const iface = await M("providers/provider-interface.js");
const mockM = await M("providers/mock-provider.js");
const routerM = await M("providers/model-router.js");
const policyM = await M("teaching/policy.js");
const loopM = await M("teaching/teaching-loop.js");
const kbM = await M("knowledge/knowledge-base.js");
const evalM = await M("evaluation/eval-suite.js");
const indexM = await M("index.js");

let passed = 0;
async function ok(label, fn) { await fn(); passed++; console.log(`  ✓ ${label}`); }

async function main() {

console.log("tigamodel Phase 0 smoke:");

/* 1. schema factories + validators */
ok("TIGARequest defaults + trace id", () => {
  const r = schema.makeTIGARequest({ message: "สวัสดี" });
  assert.ok(r.trace_id.startsWith("tg-"));
  assert.equal(r.task_type, "chat");
  assert.equal(r.message, "สวัสดี");
});
ok("unknown task_type falls back to chat (never throws)", () => {
  const r = schema.makeTIGARequest({ taskType: "warp-drive", message: "x" });
  assert.equal(r.task_type, "chat");
});
ok("state estimates require probability+confidence", () => {
  assert.throws(() => schema.makeStudentStateEstimate({ state: "confusion" }));
  const s = schema.makeStudentStateEstimate({ state: "confusion", probability: 1.7, confidence: 0.5 });
  assert.equal(s.probability, 1); // clamped
  assert.ok(Array.isArray(s.alternative_explanations));
});

/* 2. provider registry + router */
await ok("mock provider registers and routes", async () => {
  iface.registerProvider("mock", mockM.createMockProvider());
  const router = routerM.createModelRouter({ policy: {} });
  const req = schema.makeTIGARequest({ taskType: "chat", message: "ยากไป สับสน" });
  const { response, routed } = await router.route(req);
  assert.equal(response.status, "ok");
  assert.ok(response.text.includes("แบ่งใหม่"));
  assert.equal(routed.selected_provider, "mock");
});

/* 3. teaching policy rules */
ok("policy: confusion+difficulty → simplify-on-confusion", () => {
  const p = policyM.createTeachingPolicy();
  const states = [
    schema.makeStudentStateEstimate({ state: "confusion", probability: 0.8, confidence: 0.6 }),
    schema.makeStudentStateEstimate({ state: "perceived_difficulty", probability: 0.75, confidence: 0.5 }),
  ];
  const d = p.evaluate(states, {}, null);
  assert.equal(d.strategy_id, "simplify-on-confusion");
  assert.ok(d.actions.includes("reduce_complexity"));
});
ok("policy: self-report too_easy → raise-challenge", () => {
  const p = policyM.createTeachingPolicy();
  const d = p.evaluate([], {}, "too_easy");
  assert.equal(d.strategy_id, "raise-challenge");
});
ok("policy: nothing matched → continue-current-plan", () => {
  const p = policyM.createTeachingPolicy();
  const d = p.evaluate([], {}, null);
  assert.equal(d.strategy_id, "continue-current-plan");
});

/* 4. teaching loop on real practice signals */
ok("loop: low accuracy + repeated errors → simplify message", async () => {
  const p = policyM.createTeachingPolicy();
  const loop = loopM.createTeachingLoop({ policy: p });
  const out = await loop.runOnce({
    practiceStats: { accuracy: 45, repeatedErrors: 3, pauses: 4, rhythmScore: 50 },
  });
  assert.ok(out.states.some(s => s.state === "confusion" && s.probability >= 0.7));
  assert.ok(out.states.every(s => Array.isArray(s.evidence) && s.alternative_explanations !== undefined));
  assert.equal(out.decision.strategy_id, "simplify-on-confusion");
  assert.ok(out.response.text.length > 10);
});
ok("loop: high accuracy → understanding + continue/evidence-praise", async () => {
  const p = policyM.createTeachingPolicy();
  const loop = loopM.createTeachingLoop({ policy: p });
  const out = await loop.runOnce({ practiceStats: { accuracy: 98, repeatedErrors: 0, pauses: 0 } });
  assert.ok(out.states.some(s => s.state === "understanding"));
  assert.ok(out.response.text.includes("ตั้งแต่ครั้งก่อน")); // evidence-based praise
});

/* 5. knowledge base */
ok("KB: seeded, relations queryable", () => {
  const kb = kbM.createSeededKnowledgeBase();
  assert.ok(kb.count() >= 8);
  const ex = kb.exercisesFor("skill:steady-beat");
  assert.ok(ex.length >= 1 && ex.some(e => e.id === "ex:slow-count-aloud"));
  const entry = kb.get("ex:slow-count-aloud");
  assert.equal(entry.type, "strategy");
  assert.ok(entry.confidence > 0 && entry.confidence <= 1);
});

/* 5b. university-sourced knowledge: every entry must cite a real source id */
await ok("KB: university entries cite sources that exist (no fake citations)", async () => {
  const uniSeed = await M("knowledge/university-seed.js");
  const uniSources = await M("knowledge/university-sources.js");
  const kb = uniSeed.createUniversitySeededKnowledgeBase();
  const uniEntries = Array.from(kb._entries.values()).filter(e => e.id.startsWith("uni:"));
  assert.ok(uniEntries.length >= 10, `expected >=10 university entries, got ${uniEntries.length}`);
  for (const e of uniEntries) {
    assert.ok(e.source, `entry ${e.id} missing source`);
    assert.ok(uniSources.getSource(e.source), `entry ${e.id} cites unknown source ${e.source} — fake citation!`);
    const s = uniSources.getSource(e.source);
    assert.ok(s.url && s.url.startsWith("https://"), `source ${e.source} missing real URL`);
    assert.ok(e.confidence <= 0.85, `university-sourced claims must stay <=0.85 (${e.id})`);
    assert.ok(["fact", "expert-opinion"].includes(e.type), `unexpected type ${e.type} on ${e.id}`);
  }
  // coverage spans >= 8 distinct country labels
  const countries = new Set(uniSources.COVERAGE.map(c => c.country));
  assert.ok(countries.size >= 8, "university knowledge must span >=8 countries");
});

/* 6. eval suite over all registered providers */
await ok("eval-suite: scores computed, ordering deterministic", async () => {
  const results = await evalM.evaluateAllProviders(iface.listProviders());
  assert.ok(results.length >= 1);
  for (const r of results) {
    // dump scores so a regression names the failing case instead of a bare assert
    const failing = Object.entries(r.scores).filter(([, v]) => v < 1).map(([k, v]) => `${k}=${v}`);
    assert.ok(r.overall >= 0 && r.overall <= 1);
    assert.ok(r.scores["thai-language"] === 1, `mock must reply in Thai (failing: ${failing.join(", ") || "none"})`);
    assert.ok(r.scores["no-shaming"] === 1);
    assert.ok(r.scores["no-mind-reading"] === 1);
  }
});

/* 7. full assembly via index.js */
await ok("buildPianoIntelligence: chat end-to-end via router", async () => {
  const tiga = indexM.buildPianoIntelligence(); // mock only (no token)
  const { response, routed } = await tiga.chat({ message: "เพลงนี้ยากไป สับสนหมดแล้ว" });
  assert.equal(response.status, "ok");
  assert.equal(routed.selected_provider, "mock");
  assert.ok(tiga.kb.count() >= 8);
  assert.ok(tiga.philosophySystemPrompt("th").includes("ห้ามชมลอย ๆ"));
});
ok("buildPianoIntelligence: student context from app data (no localStorage → empty-safe)", () => {
  const tiga = indexM.buildPianoIntelligence();
  const ctx = tiga.buildStudentContextFromApp({ studentId: "t1", profile: { lang: "th", level: 3 } });
  assert.equal(ctx.student_id, "t1");
  assert.equal(ctx.language, "th");
  assert.equal(ctx.experience_level, "level-3");
  assert.equal(ctx.age_group, null); // never guessed
});

/* 8. existing-backend adapter wire shape (no network: fetch stub) */
await ok("existing-backend adapter: correct wire contract + no-throw on error", async () => {
  const eb = await M("providers/existing-backend-adapter.js");
  let captured = null;
  const adapter = eb.createExistingBackendAdapter({
    fetchImpl: async (url, opts) => {
      captured = { url, opts: JSON.parse(opts.body) };
      return { ok: true, status: 200, json: async () => ({ text: "ครูตอบกลับ" }) };
    },
  });
  const res = await adapter.complete(schema.makeTIGARequest({ taskType: "coach-tip", message: "สวัสดี", options: { system: "sys" } }));
  assert.equal(res.status, "ok");
  assert.equal(res.text, "ครูตอบกลับ");
  assert.equal(captured.opts.feature, "coach-tip");
  assert.equal(captured.opts.stream, false);
  assert.ok(captured.url.includes("piano-chat"));
  // error path: non-ok → status error, never throws
  const adapter2 = eb.createExistingBackendAdapter({ fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) });
  const res2 = await adapter2.complete(schema.makeTIGARequest({ taskType: "chat", message: "x" }));
  assert.equal(res2.status, "error");
});
}

main().then(() => {
  console.log(`\nAll ${passed} smoke checks passed ✅`);
  process.exit(0);
}).catch(e => {
  console.error(`\nSMOKE FAILED at check ${passed + 1}:`, e && e.message);
  process.exit(1);
});

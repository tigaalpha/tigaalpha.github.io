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
  "knowledge/teach-cards.js",
  "evaluation/eval-suite.js",
  "index.js",
];

execSync(`npx esbuild ${files.map(f => `tigamodel/${f}`).join(" ")} --outdir=${OUT} --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });

/* Phase 2 Practice Coach: transpile the app-side .ts builder and test the
   REAL file (repo convention — never a hand-mirrored copy). React stays
   external; only the pure builder is exercised here. */
execSync(`npx esbuild use-practice-coach.ts --bundle --outfile=${OUT}/use-practice-coach.js --format=esm --platform=node --loader:.ts=ts --packages=external`, { stdio: "pipe" });
const pcM = await import(pathToFileURL(`${OUT}/use-practice-coach.js`).href);


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
const srcM = await M("knowledge/university-sources.js");
const tcM = await M("knowledge/teach-cards.js");

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

  // ── Auto Teaching 2.0 — teach cards (plan §4.1): no fake citations, valid quizzes ──
  await ok("teach-cards: unique ids, 3 languages, REAL source citations, valid quizzes", async () => {
    const srcIds = new Set(srcM.listSourceIds());
    const ids = new Set();
    for (const c of tcM.TEACH_CARDS) {
      assert.ok(!ids.has(c.id), "duplicate card id " + c.id);
      ids.add(c.id);
      for (const f of ["concept", "why"]) assert.ok(c[f] && c[f].th && c[f].en && c[f].zh, c.id + " missing " + f + " langs");
      assert.ok(srcIds.has(c.source), c.id + " cites UNKNOWN source " + c.source + " (fake citation = spec §12 violation)");
      assert.ok(c.quiz && c.quiz.choices && c.quiz.choices.length === 3, c.id + " quiz needs 3 choices");
      assert.ok(c.quiz.correct >= 0 && c.quiz.correct < 3, c.id + " quiz.correct out of range");
      assert.ok(c.quiz.q && c.quiz.q.th && c.quiz.q.en && c.quiz.q.zh, c.id + " quiz.q missing langs");
      assert.ok(c.quiz.choices.every(ch => ch.th && ch.en && ch.zh), c.id + " quiz choices missing langs");
      assert.ok(c.tier >= 0 && c.tier <= 2, c.id + " tier out of range");
    }
    assert.ok(tcM.TEACH_CARDS.length >= 10, "expected at least 10 cards, got " + tcM.TEACH_CARDS.length);
  });

  await ok("teach-cards picker: tier gating + weakness matching + 7-day no-repeat", async () => {
    // beginner (level 1) must never get a tier-2 card
    for (let i = 0; i < 40; i++) {
      const c = tcM.pickTeachCard({ level: 1, now: 1758000000000 + i * 86400000 });
      assert.ok(c && c.tier === 0, "beginner got tier " + c.tier + " card " + c.id);
    }
    // weakness keyword match: rhythm struggle → a rhythm-tagged card
    const rhy = tcM.pickTeachCard({ level: 1, struggleLabel: "จังหวะ rhythm ไม่แม่น", now: 1758000000000 });
    assert.ok(rhy.tags.some(t => "จังหวะ rhythm ไม่แม่น".includes(t)), "rhythm struggle did not match a rhythm card");
    // 7-day no-repeat: seen today → same (level, struggle, day) yields a DIFFERENT card
    const now = 1758000000000;
    const first = tcM.pickTeachCard({ level: 5, struggleLabel: "", now });
    const again = tcM.pickTeachCard({ level: 5, struggleLabel: "", now, seenOverride: { [first.id]: new Date(now).toISOString().slice(0, 10) } });
    assert.notEqual(first.id, again.id, "seen card was not skipped");
  });

  await ok("teach-cards stats: streak continuity + correct/answered counters", async () => {
    tcM.writeKnowledgeStats({ streak: 0, bestStreak: 0, lastDay: null, correct: 0, answered: 0, seen: {} });
    const s1 = tcM.bumpKnowledgeStats(true);
    assert.equal(s1.streak, 1); assert.equal(s1.correct, 1); assert.equal(s1.answered, 1);
    const s2 = tcM.bumpKnowledgeStats(false);
    assert.equal(s2.streak, 1, "same-day answer must not raise streak");
    assert.equal(s2.correct, 1); assert.equal(s2.answered, 2);
    // yesterday → streak 2
    const y = new Date(Date.now() - 86400000);
    const pad = n => String(n).padStart(2, "0");
    tcM.writeKnowledgeStats({ streak: 1, bestStreak: 1, lastDay: y.getFullYear() + "-" + pad(y.getMonth() + 1) + "-" + pad(y.getDate()), correct: 5, answered: 6, seen: {} });
    const s3 = tcM.bumpKnowledgeStats(true);
    assert.equal(s3.streak, 2, "yesterday streak should continue");
    tcM.writeKnowledgeStats({ streak: 0, bestStreak: 0, lastDay: null, correct: 0, answered: 0, seen: {} });
  });

  /* ── Phase 2: TIGA Practice Coach (use-practice-coach.ts, real file) ── */

  await ok("coach data: tempo appears only when the drill carries a BPM (honest hide)", async () => {
    const withBpm = pcM.buildPracticeCoachData({ label: "C major scale", accuracy: 62, practiceTarget: [{ bpm: 72 }] });
    assert.ok(withBpm && withBpm.tempo && withBpm.tempo.bpm < 72, "accuracy 62 must step tempo DOWN from 72");
    const noBpm = pcM.buildPracticeCoachData({ label: "C major scale", accuracy: 62, practiceTarget: null });
    assert.ok(noBpm && noBpm.tempo == null, "no BPM in → no tempo section");
  });

  await ok("coach data: recap lines use real before/after + real worst missed note", async () => {
    const d = pcM.buildPracticeCoachData({ label: "Twinkle", accuracy: 80, prevAccuracy: 62, missedNotes: ["E4", "E4", "G4"], practiceTarget: null });
    assert.ok(d && d.recap && Array.isArray(d.recap.lines) && d.recap.lines.length === 3, "recap = 3 lines");
    const improved = d.recap.lines[0];
    assert.ok(/\+18|18/.test(improved.th + improved.en), "line 1 states the real +18 delta");
    assert.ok(d.recap.lines[1].th.includes("E4"), "drill line names the real worst missed note");
    assert.ok(d.recap.homework && d.recap.homework.th.includes("15"), "homework within 15 min");
  });

  await ok("coach data: next exercise is real generator output, level + topic follow this drill", async () => {
    const weak = pcM.buildPracticeCoachData({ label: "rhythm drill", accuracy: 55, rhythmPct: 60, missedNotes: [], practiceTarget: null, seed: 7 });
    assert.ok(weak && weak.exercise && weak.exercise.level === 2, "accuracy 55 → level 2");
    assert.equal(weak.exercise.topic, 4, "rhythm miss routes to the rhythm topic");
    assert.ok(weak.exercise.steps && weak.exercise.steps.length >= 2 && weak.exercise.check, "exercise has steps + a check bar");
    const strong = pcM.buildPracticeCoachData({ label: "rhythm drill", accuracy: 96, rhythmPct: 98, missedNotes: [], practiceTarget: null, seed: 7 });
    assert.ok(strong.exercise.level === 5, "accuracy 96 → level 5");
    const det = pcM.buildPracticeCoachData({ label: "rhythm drill", accuracy: 55, rhythmPct: 60, practiceTarget: null, seed: 7 });
    assert.equal(JSON.stringify(det.exercise), JSON.stringify(weak.exercise), "same seed+signals → same exercise (deterministic)");
  });

  await ok("coach data: garbage in → null (never throws into the result screen)", async () => {
    assert.equal(pcM.buildPracticeCoachData(null), null);
    assert.equal(pcM.buildPracticeCoachData({ accuracy: "x" }), null);
  });
}

main().then(() => {
  console.log(`\nAll ${passed} smoke checks passed ✅`);
  process.exit(0);
}).catch(e => {
  console.error(`\nSMOKE FAILED at check ${passed + 1}:`, e && e.message);
  process.exit(1);
});

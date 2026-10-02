#!/usr/bin/env node
/* tiga-scorecard.mjs — ONE COMMAND, THE WHOLE MODEL'S REPORT CARD.
   Answers the owner's question "how do we measure this model so we can make
   it better?" with a tool, not an essay. Runs the REAL modules (repo
   convention: transpile actual source, never a hand-mirrored copy) and prints
   a business-readable scorecard where every number traces to a check that
   actually executed.

   Sections (each maps to a plan-v3 milestone):
     1. Knowledge quality  — eval-expanded: theory facts + golden situations
     2. Knowledge fetching — retrieval eval: 30 known-answer probes, gate 80%
     3. Teaching decisions — policy engine: rules fire on the right states   4. Teacher materials  — exercise generator: deterministic, 10 topics × 5 levels
   5. Learning loop      — strategy analyzer: outcome→weight math (incl. kill switch)
   6. Legal cleanliness  — kb-compliance over the real KB
   7. Multimodal fusion  — confidence-weighted arbiter (m12)
   8. Measured speed     — rule brain/KB real latency (m33)     9. KB hot path        — capped+ranked serving: caps hold, gate holds, faster (m34)
     10. Cost governor     — per-session spend ceiling enforced by code (m13/m22)
     11. Accuracy+coverage — 5-layer model audit runs for real + the thin pillars are deep, served, retrievable (m50/m52)
     12. Loop honesty — the compound board and the before/after proof refuse to invent a number (m41/m24), and a client can never approve a contributed entry (m26)

   Exit 1 if any section fails its bar. */

import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync as ioSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OUT = "node_modules/.tmp-tiga-scorecard";
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/p4`, { recursive: true });

const REAL_SB = readFileSync("supabase-client.ts", "utf8");
ioSync("supabase-client.ts", "export const sb = null;\n");
try {
  execSync(`npx esbuild tigamodel/web.js --bundle --outfile=${OUT}/p4/web.js --format=esm --platform=node --loader:.js=js --packages=external`, { stdio: "pipe" });
  execSync(`npx esbuild tigamodel/evaluation/eval-expanded.js tigamodel/evaluation/eval-suite.js tigamodel/evaluation/retrieval-eval.js tigamodel/teaching/policy.js tigamodel/teaching/generator.js tigamodel/core/schema.js tigamodel/teaching/strategy-analyzer.js tigamodel/compliance/kb-compliance.js tigamodel/multimodal/fusion.js tigamodel/performance/answer-cache.js tigamodel/performance/kb-hot-path.js tigamodel/performance/cost-governor.js tigamodel/evaluation/compound-dashboard.js tigamodel/evaluation/before-after.js tigamodel/compliance/contribution-store.js tigamodel/compliance/contribution-gate.js tigamodel/compliance/kb-compliance.js --outdir=${OUT} --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });
} finally {
  ioSync("supabase-client.ts", REAL_SB);
}
globalThis.localStorage = { _m: new Map(), getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };

const M = (f) => import(pathToFileURL(`${OUT}/${f}`).href);
const webM = await import(pathToFileURL(`${OUT}/p4/web.js`).href);
const evalX = await M("evaluation/eval-expanded.js");
const retr = await M("evaluation/retrieval-eval.js");
const policyM = await M("teaching/policy.js");
const genM = await M("teaching/generator.js");
const analyzer = await M("teaching/strategy-analyzer.js");

const rows = [];
const section = (name, detail, score, bar, pass) => rows.push({ name, detail, score, bar, pass });

console.log("\n╔══════════════════════════════════════════════════════════╗");
console.log("║        TIGA MODEL — REPORT CARD (node scripts/tiga-scorecard.mjs)        ║");
console.log("╚══════════════════════════════════════════════════════════╝\n");

/* ── 1. Knowledge quality: the REAL eval suite vs the REAL provider registry ── */
{
  webM.initTigamodelWeb(); // lazy singleton — first caller initializes
  const tiga = webM.getTigamodel();
  const results = await evalX.evaluateAllProvidersExtended(tiga.providers.list());
  const best = results.reduce((a, b) => ((b && b.overall || 0) > (a && a.overall || 0) ? b : a), results[0] || { overall: 0, cases_run: 0 });
  const pct = (best.overall || 0) * 100;
  section(
    "1) คุณภาพความรู้ (eval suite เต็มของระบบ)",
    `รันจริง ${best.cases_run || 0} เคสกับ provider "${best.provider || "-"}" — ชุดเดียวกับที่ Model Lab ใช้กันเปลี่ยนโมเดล · KB ${webM.getKnowledgeBaseForTest().count().toLocaleString()} entries`,
    pct, "≥ 75%", pct >= 75
  );
}

/* ── 2. Knowledge fetching (retrieval) ── */
{
  const scored = retr.RETRIEVAL_PROBES.map(p => ({ score: retr.scoreRetrieval(p, retr.servedLabels(webM.getKBContext(p.q))) }));
  const acc = retr.retrievalAccuracy(scored);
  section(
    "2) การหยิบความรู้ถูกเรื่อง (retrieval)",
    `${retr.RETRIEVAL_PROBES.length} คำถามจริง (th/en) ยิงเข้า getKBContext ตัว production`,
    acc * 100, "≥ 80% (gate)", acc >= retr.RETRIEVAL_GATE
  );
}

/* ── 3. Teaching decisions (policy fires correctly) ── */
{
  const st = (state, p) => [{ state, probability: p, confidence: 0.9, evidence: [], modalities: [], alternatives: [] }];
  const p = policyM.createTeachingPolicy();
  const cases = [
    { label: "สับสน+ยาก → ลดความซับซ้อน", ok: p.evaluate([...st("confusion", 0.9), ...st("perceived_difficulty", 0.85)], {}, null).strategy_id === "simplify-on-confusion" },
    { label: "เข้าใจต่ำ+พลาดซ้ำ → ย้อนพื้นฐาน", ok: p.evaluate([...st("understanding", 0.2)], { repeated_errors: 3 }, null).strategy_id === "return-to-prerequisite" },
    { label: "บอกว่าง่าย → เพิ่มท้าทาย", ok: p.evaluate([], {}, "too_easy").strategy_id === "raise-challenge" },
    { label: "บอกว่ายาก → ลดภาระ", ok: p.evaluate([], {}, "too_hard").strategy_id === "simplify-on-hard-report" },
    { label: "ไม่มีสัญญาณ → ดำเนินต่อ", ok: p.evaluate([], {}, null).strategy_id === "continue-current-plan" },
  ];
  const pct = (cases.filter(c => c.ok).length / cases.length) * 100;
  section(
    "3) การตัดสินใจสอน (policy ยิงถูกกฎ)",
    cases.map(c => `${c.ok ? "✓" : "✗"} ${c.label}`).join(" · "),
    pct, "100%", pct === 100
  );
}

/* ── 4. Teacher materials (generator — topics are the generator's own table) ── */
{
  /* every field a generated exercise carries is a {th,en,zh} OBJECT, and the
     lab renders it through i18n.tr() — a bare object in a JSX text slot is
     React error #31 ("objects are not valid as a React child"), which is what
     crashed the Model Lab page. Assert the render is always possible. */
  const tr = (f, l) => f == null ? "" : (typeof f === "string" ? f : (f[l] || f.en || f.th || Object.values(f)[0] || ""));
  const kinds = webM.studentExerciseKinds();
  let made = 0, tried = 0;
  let renderable = true, firstBad = "";
  const seen = new Set();
  for (let t = 0; t < kinds.length; t++) for (let lvl = 1; lvl <= 5; lvl++) {
    tried++;
    const ex = webM.generateStudentExercise(t, lvl, `sc-${t}-${lvl}`);
    if (ex && ex.task && ex.task.th) { made++; seen.add(ex.task.th); }
    for (const l of ["th", "en", "zh"]) {
      const parts = ex ? [tr(ex.title, l), tr(ex.task, l), ...(ex.steps || []).map(s => tr(s, l)), tr(ex.check, l)] : [];
      if (!ex || parts.some(p => typeof p !== "string" || !p.trim())) {
        renderable = false;
        if (!firstBad) firstBad = `topic ${t} level ${lvl} lang ${l}`;
      }
    }
  }
  const det = JSON.stringify(webM.generateStudentExercise(4, 2, 42)) === JSON.stringify(webM.generateStudentExercise(4, 2, 42));
  const variety = new Set([...Array(8)].map((_, i) => { const x = webM.generateStudentExercise(1, 3, i + 1); return x && x.task && x.task.th; })).size;
  const pct = (made / tried) * 100;
  section(
    "4) การผลิตสื่อการสอน (แบบฝึกหัด)",
    `${made}/${tried} ชุด (${kinds.length} หัวข้อ × 5 ระดับ) · สร้างซ้ำได้เหมือนเดิม: ${det ? "ใช่" : "ไม่!"} · ต่างกัน 8 ด่าน: ${variety} แบบ · ทุกฟิลด์แสดงผลเป็นข้อความได้ครบ 3 ภาษา (React #31): ${renderable ? "ใช่" : "ไม่! " + firstBad}`,
    pct, "100%", pct === 100 && det && variety >= 6 && renderable
  );
}

/* ── 5. Learning loop (analyzer math + kill switch) ── */
{
  const rows30 = [];
  for (let i = 0; i < 12; i++) rows30.push({ strategy_id: "a", n: 12, avg_before: 0.4, avg_after: 0.7, delta: 0.3, improved: 9 });
  for (let i = 0; i < 10; i++) rows30.push({ strategy_id: "b", n: 10, avg_before: 0.5, avg_after: 0.4, delta: -0.1, improved: 2 });
  const w = analyzer.computePolicyWeights(rows30);
  const ordering = w["a"] > w["b"];
  const clamped = Object.values(w).every(v => v >= analyzer.WEIGHT_MIN && v <= analyzer.WEIGHT_MAX);
  const neutral = analyzer.computePolicyWeights([{ strategy_id: "c", n: 2, delta: 5, improved: 2 }])["c"] === 1.0;
  const off = analyzer.applyPolicyWeights(policyM.DEFAULT_POLICY, { enabled: false, weights: { "simplify-on-confusion": 2 } }) === null;
  const pct = [ordering, clamped, neutral, off].filter(Boolean).length * 25;
  section(
    "5) ลูปเรียนรู้จากผลจริง (analyzer)",
    `กลยุทธ์ที่ได้ผลกว่าได้น้ำหนักกว่า: ${ordering ? "ใช่" : "ไม่"} · ค่าอยู่ในกรอบ: ${clamped ? "ใช่" : "ไม่"} · ข้อมูลน้อยไม่เดา: ${neutral ? "ใช่" : "ไม่"} · สวิตช์ปิดได้: ${off ? "ใช่" : "ไม่"}`,
    pct, "100%", pct === 100
  );
}

/* ── 6. Legal cleanliness (docs/07 A+C+D) ── */
{
  const comp = await M("compliance/kb-compliance.js");
  const { SOURCES } = await import(pathToFileURL("tigamodel/knowledge/university-sources.js").href); // real registry — no silent fallback
  const entries = [...webM.getKnowledgeBaseForTest()._entries.values()];
  const rep = comp.auditKB(entries, SOURCES);
  const pct = 100 - Math.min(100, rep.flags.length);
  section(
    "6) ความสะอาดเชิงกฎหมายของคลังความรู้ (ที่มา/ก๊อปยาว/เครื่องหมายการค้า/สุขภาพ)",
    `ตรวจจริง ${rep.checked.toLocaleString()} entries — ที่มาไม่จดทะเบียน: ${rep.unregistered} · flag รวม: ${rep.flags.length} (JSON: ${JSON.stringify(rep.byCheck)})`,
    pct, "100% (0 flag)", rep.clean
  );
}

/* ── 7. Multimodal fusion (m12): confidence-weighted arbiter + kill switch ── */
{
  const fus = await M("multimodal/fusion.js");
  const sig = [
    { channel: "session",     state: "confusion", probability: 0.8, confidence: 0.75, evidence: ["acc 55%"] },
    { channel: "history",     state: "confusion", probability: 0.3, confidence: 0.4 },
    { channel: "self_report", state: "confusion", probability: 0.85, confidence: 0.9 },
    { channel: "session",     state: "perceived_difficulty", probability: 0.7, confidence: 0.5 },
    { channel: "history",     state: "perceived_difficulty", probability: 0.6, confidence: 0.8 },
  ];
  const r1 = fus.fuseMultimodalSignals({ signals: sig });
  const r2 = fus.fuseMultimodalSignals({ signals: sig });
  const noTs = r => JSON.stringify((r || []).map(e => ({ ...e, timestamp: "" })));
  const det = noTs(r1) === noTs(r2);
  const confWin = r1 && r1.find(f => f.state === "confusion");
  const srDominance = confWin && confWin.fusion && confWin.fusion.winner_channel === "self_report";
  const killed = fus.fuseMultimodalSignals({ signals: sig, weights: { self_report: 0, session: 0 } });
  const ks = killed && killed.find(f => f.state === "confusion");
  const killWorks = ks && ks.fusion && ks.fusion.winner_channel === "history";
  const banned = fus.fuseMultimodalSignals({ signals: [
    { channel: "vision", state: "enjoyment", probability: 0.99, confidence: 0.99 },
    { channel: "audio", state: "enjoyment", probability: 0.9, confidence: 0.9 },
  ]});
  const cases = [det, !!srDominance, !!killWorks, banned === null];
  const pct = (cases.filter(Boolean).length / cases.length) * 100;
  section(
    "7) ถ่วงน้ำหนักหลายสัญญาณ (fusion)",
    `ตัดสินซ้ำได้เหมือนเดิม: ${det ? "ใช่" : "ไม่!"} · คำตอบตรงจากนักเรียนชนะเสมอ: ${srDominance ? "ใช่" : "ไม่"} · สวิตช์ปิดต่อช่องได้: ${killWorks ? "ใช่" : "ไม่"} · ช่องห้าม (ใบหน้า/เสียง) ชนะไม่ได้: ${banned === null ? "ใช่" : "ไม่!"}`,
    pct, "100%", pct === 100
  );
}

/* ── 8. Speed, measured (docs/10 m33): real latency of the rule brain ── */
{
  const ac = await M("performance/answer-cache.js");
  const N = 200;
  const states = [{ state: "confusion", probability: 0.9, confidence: 0.9, evidence: ["x"], modalities: [], alternatives: [] }];
  const pol = policyM.createTeachingPolicy();
  // warm-up (first-touch JIT/JIT-free noise excluded from the claim)
  webM.getKBContext("โน้ต C"); pol.evaluate(states, {}, null);
  let t0 = performance.now();
  for (let i = 0; i < N; i++) webM.getKBContext("เวลาซ้อมเปียโนต้องนั่งท่าไหน นั่งสูงแค่ไหนดี");
  const kbMs = (performance.now() - t0) / N;
  t0 = performance.now();
  for (let i = 0; i < N; i++) pol.evaluate(states, { repeated_errors: 3 }, null);
  const polMs = (performance.now() - t0) / N;
  t0 = performance.now();
  for (let i = 0; i < N; i++) webM.generateStudentExercise(1, 3, i);
  const genMs = (performance.now() - t0) / N;
  // remembered-answer path: serve speed vs the network path (same machine)
  const cache = ac.createAnswerCache({ enabled: true, confidenceFloor: 0.4 });
  const key = ac.answerCacheKey({ message: "speed probe" });
  cache.maybeRemember(key, { status: "ok", text: "cached", provider: "mock", model: "m", trace_id: "t", confidence: 0.95, metadata: {} });
  t0 = performance.now();
  for (let i = 0; i < N; i++) cache.lookup(key);
  const hitMs = (performance.now() - t0) / N;
  const cases = [
    { label: "KB context < 100ms", ok: kbMs < 100, v: kbMs },
    { label: "policy ตัดสิน < 20ms", ok: polMs < 20, v: polMs },
    { label: "แบบฝึกหัด < 5ms", ok: genMs < 5, v: genMs },
    { label: "คำตอบจำได้ < 1ms", ok: hitMs < 1, v: hitMs },
  ];
  const pct = (cases.filter(c => c.ok).length / cases.length) * 100;
  const f3 = x => x.toFixed(3);
  section(
    "8) ความเร็วที่วัดจริง (สมองกฎ/KB — ไม่รอเครือข่าย)",
    `เฉลี่ย ${N} รอบ: KB ${f3(kbMs)}ms (เกณฑ์ <100) · policy ${f3(polMs)}ms (<20) · สร้างแบบฝึกหัด ${f3(genMs)}ms (<5) · คำตอบที่จำได้ ${f3(hitMs)}ms (<1) — ทางลัดเดียวที่อนุญาต = จำคำตอบที่ผ่านการตรวจแล้ว (docs/10)`,
    pct, "100%", pct === 100
  );
}

/* ── 9. KB hot path (docs/10 §1.3 / docs/14 §2, m34): serving must stay fast
   AND on-topic with the hot path ON — caps hold on the real seed, the
   retrieval gate still passes, and the worst path is measurably faster. ── */
{
  const hp = await M("performance/kb-hot-path.js");
  webM.initTigamodelWeb();
  webM.setKbHotPathEnabled(true);
  webM.kbHotPath().clearHot();
  const legacy = (() => { webM.setKbHotPathEnabled(false); const b = webM.getKBContext("คอร์ด C กับ G สลับไม่ทัน"); webM.setKbHotPathEnabled(true); return b; })();
  const HARMONY_Q = "คอร์ด C กับ G สลับไม่ทัน";
  webM.kbHotPath().clearHot();
  const capped = webM.getKBContext(HARMONY_Q);
  const cappedLines = capped.split("\n").filter(l => l.startsWith("• ")).length;
  const gateScored = retr.RETRIEVAL_PROBES.map(p => ({ score: retr.scoreRetrieval(p, retr.servedLabels(webM.getKBContext(p.q))) }));
  const acc = retr.retrievalAccuracy(gateScored);
  webM.kbHotPath().clearHot();
  let t0 = performance.now();
  for (let i = 0; i < 100; i++) { webM.kbHotPath().clearHot(); webM.getKBContext(HARMONY_Q); }
  const hotMs = (performance.now() - t0) / 100;
  webM.setKbHotPathEnabled(false); // measure the TRUE legacy path, not the hot path
  webM.getKBContext(HARMONY_Q); // warm the legacy path
  t0 = performance.now();
  for (let i = 0; i < 100; i++) webM.getKBContext(HARMONY_Q);
  const legacyMs = (performance.now() - t0) / 100;
  webM.setKbHotPathEnabled(true); // next case (kill switch) re-verifies OFF honestly
  const cases = [
    { label: "เพดานถือต่อข้อความ (≤24 บรรทัด/≤8k ตัวอักษร)", ok: cappedLines > 0 && cappedLines <= webM.kbHotPath().config.maxLines && capped.length < legacy.length / 100, v: `${cappedLines} lines` },
    { label: "retrieval gate ยังผ่าน (hot path เปิด)", ok: acc >= retr.RETRIEVAL_GATE, v: `${(acc * 100).toFixed(0)}%` },
    { label: "เส้นทางแย่สุดเร็วขึ้นวัดจริง", ok: hotMs < legacyMs, v: `${legacyMs.toFixed(3)}→${hotMs.toFixed(3)}ms` },
    { label: "kill switch ปิดได้ (OFF = byte-identical)", ok: (() => { webM.setKbHotPathEnabled(false); const b = webM.getKBContext(HARMONY_Q); const same = b === legacy; webM.setKbHotPathEnabled(true); return same; })(), v: "ปิด = เดิมเป๊ะ" },
  ];
  const pct = (cases.filter(c => c.ok).length / cases.length) * 100;
  section(
    "9) KB hot path — เลือกให้ตรงแทนการเททั้งคลัง (docs/14)",
    `${cases.map(c => `${c.ok ? "✓" : "✗"} ${c.label} (${c.v})`).join(" · ")} · บล็อกเดิม ${legacy.length.toLocaleString()} → ${capped.length.toLocaleString()} ตัวอักษร`,
    pct, "100%", pct === 100
  );
}

/* ── 10. Cost governor (docs/05 §8 / docs/15 §2, m13/m22): the spend ceiling
   must be enforced by code — decide-before-call, throttle before the cap,
   honest uncertain fallback, kill switch restores the untouched path. ── */
{
  const cg = await M("performance/cost-governor.js");
  const g = cg.createCostGovernor({ enabled: true, freeQuota: 40, hardCap: 100 });
  // real shape: decide before, charge after — 3 units per call crosses the 100 cap at call 34
  const decisions = [];
  for (let i = 0; i < 40; i++) { decisions.push(g.decide("sc", 3)); g.charge("sc", 3); }
  const throttledAt = decisions.findIndex(d => d.decision === "throttle");
  const warnedOnce = decisions.filter(d => d.reason === "warn_80pct").length === 1;
  const honest = g.governedResponse({ reason: "hard_cap_reached", spent: 100 });
  webM.setCostGovernorEnabled(true);
  webM.costGovernor().clear();
  webM.costGovernor().charge("sc-sess", 99); // the session's real spend so far — the next call would cross the cap
  const governed = await webM.chatThroughCostGovernor({ message: "scorecard probe", sessionKey: "sc-sess", estimatedUnits: 2 });
  const governedHonest = governed && governed.response && governed.response.provider === "cost-governor" && governed.response.status === "uncertain" && governed.response.metadata.governed === true;
  webM.costGovernor().clear();
  webM.setCostGovernorEnabled(false);
  const outOff = await webM.chatThroughCostGovernor({ message: "off path", sessionKey: "sc-sess" });
  const offUntouched = outOff && outOff.governed === false && outOff.response && outOff.response.status === "ok";
  const cases = [
    { label: "เพดานบังคับโดยโค้ด (throttle ก่อนทะลุ 100%)", ok: throttledAt > 0 && throttledAt < 40, v: `throttle@call ${throttledAt + 1}` },
    { label: "warn ครั้งเดียวที่ 80%", ok: warnedOnce, v: "1 ครั้ง" },
    { label: "คำตอบ throttle ซื่อสัตย์ (uncertain + ที่มา)", ok: honest.status === "uncertain" && honest.provider === "cost-governor" && honest.metadata.governed === true, v: "ไม่แต่งคำตอบ" },
    { label: "wiring จริง: throttle ผ่าน chatThroughCostGovernor", ok: !!governedHonest, v: "e2e" },
    { label: "kill switch ปิด = เส้นทางเดิม 100%", ok: !!offUntouched, v: "เดิมเป๊ะ" },
  ];
  const pct = (cases.filter(c => c.ok).length / cases.length) * 100;
  section(
    "10) ต้นทุนต่อเซสชันถูกบังคับด้วยโค้ด (cost governor, docs/15)",
    `${cases.map(c => `${c.ok ? "✓" : "✗"} ${c.label} (${c.v})`).join(" · ")} · tiers free=0 low=1 medium=2 high=4 — ตัวไม่รู้จักจ่าย low ไม่มีทางได้ฟรี`,
    pct, "100%", pct === 100
  );
}

/* ── 11. Accuracy + coverage (docs/16 §2/§3, m50/m52): the model measures
   itself in 5 layers, and the three formerly-thin pillars are deep, served
   (real questions get their labels) and retrievable through the production
   path. Every number here comes from the real modules, never a hand count. ── */
{
  const audit = await webM.runModelAccuracyAudit();
  const layers = (audit && audit.layers) || [];
  const retrLayer = layers.find(l => l.id === "kbRetrieval");
  const healthLayer = layers.find(l => l.id === "kbHealth");
  const kb = webM.getKnowledgeBaseForTest();
  const all = kb ? [...kb._entries.values()] : [];
  const dom = (d) => all.filter(e => e.domain === d);
  const mkt = dom("music-marketing"), inn = dom("innovation"), thx = dom("music-therapy");
  const hasThai = (s) => /[ก-๙]/.test(s);
  const tri = (list) => list.length > 0 && list.every(e => { const b = String(e.body); return hasThai(b) && b.includes("(EN: ") && b.includes("(ZH: "); });
  const taught = [...mkt, ...inn, ...thx].every(e => !!e.teach);
  const sourced = [...mkt, ...inn, ...thx].every(e => String(e.source || "").startsWith("tiga-"));
  const framed = thx.length > 0 && thx.every(e => /wellbeing frame|กรอบ wellbeing/.test(e.body));
  const NEW_PROBES = ["innovation-th", "innovation-en", "marketing-th", "marketing-en", "therapy-th", "therapy-en"];
  const probes = retr.RETRIEVAL_PROBES.filter(p => NEW_PROBES.includes(p.id));
  const scored = probes.map(p => retr.scoreRetrieval(p, retr.servedLabels(webM.getKBContext(p.q))));
  const probeAcc = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
  const cases = [
    { label: "audit 5 ชั้นวัดครบ + allPass (ไม่มีชั้นไหนเดา)", ok: layers.length === 5 && audit.allPass === true, v: `${layers.length}/5 layers` },
    { label: "ชั้น retrieval = 100% (30 probes)", ok: !!retrLayer && retrLayer.score === 100, v: `${retrLayer ? retrLayer.score : "–"}%` },
    { label: "ชั้น compliance = 0 flag บนคลังจริง", ok: !!healthLayer && healthLayer.score === 100, v: `${healthLayer ? healthLayer.score : "–"}%` },
    { label: "3 หมวดบางลึกพอ (≥ 16 ต่อหมวด)", ok: mkt.length >= 16 && inn.length >= 16 && thx.length >= 16, v: `mkt ${mkt.length} · inn ${inn.length} · thx ${thx.length}` },
    { label: "ครบ 3 ภาษา + teach + แหล่ง tiga-* ทุก entry", ok: tri(mkt) && tri(inn) && tri(thx) && taught && sourced, v: "48 entries ใหม่ + เดิม" },
    { label: "กรอบ wellbeing ครบทุก therapy entry", ok: framed, v: `${thx.length}/${thx.length}` },
    { label: "หมวดใหม่เสิร์ฟได้จริง (6 probes ผ่าน production path)", ok: probeAcc === 1 && probes.length === 6, v: `${(probeAcc * 100).toFixed(0)}%` },
  ];
  const pct = (cases.filter(c => c.ok).length / cases.length) * 100;
  section(
    "11) ความแม่นยำ + ครอบคลุมความรู้ (audit 5 ชั้น + 3 หมวดบาง, docs/16)",
    `${cases.map(c => `${c.ok ? "✓" : "✗"} ${c.label} (${c.v})`).join(" · ")}`,
    pct, "100%", pct === 100
  );
}

/* ── 12. Loop honesty (docs/12 §2 m41, docs/08 m24, docs/09 m26): the two
   dashboards that talk to PARENTS and the store that lets outsiders
   contribute must both refuse to invent a number, and nobody but an adult
   may approve. Checked here on the real modules so this file is the one
   command that says so out loud. ── */
{
  const board = await M("evaluation/compound-dashboard.js");
  const proof = await M("evaluation/before-after.js");
  const store = await M("compliance/contribution-store.js");

  const empty = board.compoundBoard({}, {});
  const allUnavailable = empty.loops.every(l => l.metrics.every(m => m.status === "unavailable"));
  const noZeroFabrication = empty.loops.every(l => l.metrics.every(m => m.value === null));
  const filled = board.compoundBoard({ skillStateLearners: 25, outcomes: 60, outcomesRecent: 7, outcomesPrior: 2, strategiesWithOutcomes: 3, diagnosesWithSkill: 9 }, { personalizedPlans: true });
  const barsAreThePlan = board.LOOP_BARS.plans === 20 && board.LOOP_BARS.outcomes === 50;
  const switchGatesA = filled.loops[0].ready === true && board.compoundBoard({ skillStateLearners: 25 }, { personalizedPlans: false }).loops[0].ready === false;
  const junk = board.compoundBoard({ outcomes: NaN, skillStateLearners: "12" }, {});
  const junkHonest = junk.loops.every(l => l.metrics.every(m => m.status === "unavailable"));

  const oneRun = proof.beforeAfterBoard([{ learner_id: "k1", skill: "rhythm", created_at: "2026-10-01T00:00:00Z", score_before: 60, score_after: 70, duration_sec: 300 }]);
  const noClaimFromOneRun = oneRun.learners[0].claimable === false && oneRun.cohort.avgDeltaPts === null;
  const twoSkills = proof.learnerProof([
    { skill: "rhythm", created_at: "2026-10-01T00:00:00Z", score_before: 50, score_after: 55 },
    { skill: "rhythm", created_at: "2026-10-05T00:00:00Z", score_before: 55, score_after: 60 },
    { skill: "rhythm", created_at: "2026-10-09T00:00:00Z", score_before: 60, score_after: 65 },
    { skill: "note_accuracy", created_at: "2026-10-10T00:00:00Z", score_before: 60, score_after: 60 },
  ]);
  const skillsNotMixed = twoSkills.skill === "rhythm" && twoSkills.to === 65;
  const emptyProof = proof.beforeAfterBoard([]);
  const emptyProofHonest = emptyProof.cohort.status === "insufficient" && emptyProof.cohort.avgDeltaPts === null;

  const sub = { content: { title: "ทดสอบ", body: "เนื้อหาทดสอบ", domain: "rhythm" }, license: "contributor-own-work", source: { kind: "own-work" }, contributor: { id: "11111111-2222-3333-4444-555555555555" } };
  const row = store.submissionToRow({ ...sub, status: "approved" });
  const clientCannotApprove = row.status === "pending";
  const noAdminNoDecision = store.moderateArgs("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "approved", "ok", { adminTier: 0 }).ok === false;
  const reasonRequired = store.moderateArgs("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "approved", "  ", { adminTier: 3 }).reason === "a written reason is required";
  const gateRejectedBlocked = store.approvalBlockers({ gate_verdict: "rejected", contributor_id: "x", license: "cc-by" }).length > 0;
  /* m27: the credit is what makes a contributed entry traceable */
  const compliance = await M("compliance/kb-compliance.js");
  const approvedRow = { ...store.submissionToRow(sub), status: "approved", contributor_name: "ครูเต" };
  const credited = store.creditedEntryFor(approvedRow);
  const creditedClean = !!credited && compliance.auditKB([credited.entry], credited.sources).flags.length === 0;
  const noCreditYet = store.creditedEntryFor({ ...store.submissionToRow(sub), status: "pending" }) === null;

  const cases = [
    { label: "ช่องว่าง = ยังไม่มีข้อมูล ไม่ใช่ 0", ok: allUnavailable && noZeroFabrication, v: "0 → null" },
    { label: "ตัวเลขเสีย (NaN/ข้อความ) ไม่กลายเป็นตัวเลข", ok: junkHonest, v: "unavailable" },
    { label: "เกณฑ์เปิดสวิตช์ = ตัวเลขของแผน (20/50)", ok: barsAreThePlan, v: "A 20 · B 50" },
    { label: "วงจร A พร้อมก็ต่อเมื่อสวิตช์เปิด", ok: switchGatesA, v: "สวิตช์เป็นเงื่อนไข" },
    { label: "1 ครั้งที่ซ้อมไม่เป็นเทรนด์ (ไม่มี % ปลอม)", ok: noClaimFromOneRun, v: "claimable=false" },
    { label: "คนละทักษะไม่ถูกเทียบรวมกัน", ok: skillsNotMixed, v: "rhythm 55→65" },
    { label: "ตารางว่าง = ไม่มีเทรนด์ ไม่ใช่ 0%", ok: emptyProofHonest, v: "insufficient" },
    { label: "client ส่ง status=approved ก็ยังเป็น pending", ok: clientCannotApprove, v: "RLS + โมดูล" },
    { label: "ไม่ใช่แอดมิน = ตัดสินไม่ได้", ok: noAdminNoDecision, v: "admin only" },
    { label: "ต้องเขียนเหตุผลทุกครั้ง", ok: reasonRequired, v: "บังคับ" },
    { label: "แถวที่ประตูไม่ผ่าน อนุมัติไม่ได้", ok: gateRejectedBlocked, v: "ต้องแก้ต้นทาง" },
    { label: "เครดิตผู้ร่วมสร้างอยู่ในแหล่งที่มาจริง (entry ผ่าน scanner)", ok: creditedClean && noCreditYet, v: "approved เท่านั้น" },
  ];
  const pct = (cases.filter(c => c.ok).length / cases.length) * 100;
  section(
    "12) ความซื่อสัตย์ของแดชบอร์ดและคิวความรู้ (ไม่แต่งตัวเลข, ไม่ให้ AI อนุมัติเอง)",
    `${cases.map(c => `${c.ok ? "✓" : "✗"} ${c.label} (${c.v})`).join(" · ")}`,
    pct, "100%", pct === 100
  );
}

/* ── print ── */
console.log("| ตัวชี้วัด | คะแนน | เกณฑ์ผ่าน | ผล |");
console.log("|---|---|---|---|");
for (const r of rows) {
  console.log(`| ${r.name} | ${r.score.toFixed(1)}% | ${r.bar} | ${r.pass ? "✅ ผ่าน" : "❌ ไม่ผ่าน"} |`);
  console.log(`| <sub>${r.detail}</sub> | | | |`);
}
const allPass = rows.every(r => r.pass);
console.log(`\n${allPass ? "🟢 สรุป: ผ่านทุกด่าน — พร้อมก้าวต่อตามแผน (accuracy+coverage เข้า scorecard แล้ว ด่าน 11)" : "🔴 สรุป: มีด่านไม่ผ่าน — ห้ามเพิ่มความฉลาดใหม่ก่อนแก้ด่านที่ตก (กติกาเหล็กข้อ 2)"}`);
process.exit(allPass ? 0 : 1);

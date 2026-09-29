#!/usr/bin/env node
/* tiga-scorecard.mjs — ONE COMMAND, THE WHOLE MODEL'S REPORT CARD.
   Answers the owner's question "how do we measure this model so we can make
   it better?" with a tool, not an essay. Runs the REAL modules (repo
   convention: transpile actual source, never a hand-mirrored copy) and prints
   a business-readable scorecard where every number traces to a check that
   actually executed.

   Sections (each maps to a plan-v3 milestone):
     1. Knowledge quality  — eval-expanded: theory facts + golden situations
     2. Knowledge fetching — retrieval eval: 24 known-answer probes, gate 80%
     3. Teaching decisions — policy engine: rules fire on the right states
     4. Teacher materials  — exercise generator: deterministic, 10 topics × 5 levels
     5. Learning loop      — strategy analyzer: outcome→weight math (incl. kill switch)

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
  execSync(`npx esbuild tigamodel/evaluation/eval-expanded.js tigamodel/evaluation/eval-suite.js tigamodel/evaluation/retrieval-eval.js tigamodel/teaching/policy.js tigamodel/teaching/generator.js tigamodel/core/schema.js tigamodel/teaching/strategy-analyzer.js tigamodel/compliance/kb-compliance.js tigamodel/multimodal/fusion.js --outdir=${OUT} --format=esm --platform=node --loader:.js=js`, { stdio: "pipe" });
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
  const kinds = webM.studentExerciseKinds();
  let made = 0, tried = 0;
  const seen = new Set();
  for (let t = 0; t < kinds.length; t++) for (let lvl = 1; lvl <= 5; lvl++) {
    tried++;
    const ex = webM.generateStudentExercise(t, lvl, `sc-${t}-${lvl}`);
    if (ex && ex.task && ex.task.th) { made++; seen.add(ex.task.th); }
  }
  const det = JSON.stringify(webM.generateStudentExercise(4, 2, 42)) === JSON.stringify(webM.generateStudentExercise(4, 2, 42));
  const variety = new Set([...Array(8)].map((_, i) => { const x = webM.generateStudentExercise(1, 3, i + 1); return x && x.task && x.task.th; })).size;
  const pct = (made / tried) * 100;
  section(
    "4) การผลิตสื่อการสอน (แบบฝึกหัด)",
    `${made}/${tried} ชุด (${kinds.length} หัวข้อ × 5 ระดับ) · สร้างซ้ำได้เหมือนเดิม: ${det ? "ใช่" : "ไม่!"} · ต่างกัน 8 ด่าน: ${variety} แบบ`,
    pct, "100%", pct === 100 && det && variety >= 6
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

/* ── print ── */
console.log("| ตัวชี้วัด | คะแนน | เกณฑ์ผ่าน | ผล |");
console.log("|---|---|---|---|");
for (const r of rows) {
  console.log(`| ${r.name} | ${r.score.toFixed(1)}% | ${r.bar} | ${r.pass ? "✅ ผ่าน" : "❌ ไม่ผ่าน"} |`);
  console.log(`| <sub>${r.detail}</sub> | | | |`);
}
const allPass = rows.every(r => r.pass);
console.log(`\n${allPass ? "🟢 สรุป: ผ่านทุกด่าน — พร้อมก้าวต่อตามแผน (m12 fusion เข้า scorecard แล้ว)" : "🔴 สรุป: มีด่านไม่ผ่าน — ห้ามเพิ่มความฉลาดใหม่ก่อนแก้ด่านที่ตก (กติกาเหล็กข้อ 2)"}`);
process.exit(allPass ? 0 : 1);

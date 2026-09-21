/* One-off patch — Auto Teaching validation gate (owner plan 2026-09-19, item 5):
   every AI tip is validated before display; anything generic/out-of-scope
   falls back to a locally-composed tip built from REAL learner data. */
import { readFileSync, writeFileSync } from "node:fs";

const F = "App.tsx";
let s = readFileSync(F, "utf8");
let fails = 0;
function rep(oldStr, newStr, label) {
  if (s.includes(newStr)) { console.log(`ok (already): ${label}`); return; }
  const i = s.indexOf(oldStr);
  if (i < 0) { console.log(`FAIL: ${label} — anchor not found`); fails++; return; }
  s = s.slice(0, i) + newStr + s.slice(i + oldStr.length);
  console.log(`ok: ${label}`);
}

// ── 1) Fallback builder, placed right before generateCoachTip ──
rep(
`async function generateCoachTip(lang, profile) {`,
`// Auto-Teach แม่นยำ (แผนข้อ 5): fallback ที่ "ถูกต้องเสมอ" — ถ้า AI ตอบกว้าง/หลุดขอบเขต
// ประกาศจากข้อมูลจริงของผู้เรียนแทน (จุดอ่อนหนักสุด + โน้ตที่พลาด + คำสอนของโมเดล)
// ไม่มีทางโชว์ popup ว่างหรือคำแนะนำสากล
function buildFallbackTip(lang, struggle, strat, noteMisses) {
  const nm = noteMisses && noteMisses.length ? noteMisses.map(n => n.label).join(", ") : null;
  const th = {
    weakness: struggle ? \`ท่อน "\${struggle.label}" ยังไม่ค่อยผ่าน (แม่นยำ \${struggle.acc}%)\` : (nm ? \`โน้ต \${nm} พลาดบ่อยในรอบล่าสุด\` : "ช่วงนี้ยังไม่มีจุดอ่อนชัดเจน — ไปต่อขั้นถัดไปกัน"),
    steps: struggle
      ? [\`ซ้อม "\${struggle.label}" ช้า ๆ ทีละ 2 ท่อนเล็ก แล้วค่อยเพิ่มความเร็ว\`, nm ? \`ระวังโน้ต \${nm} เป็นพิเศษ — ลองเล่นแค่โน้ตนั้น 3 ครั้งก่อนรวมท่อน\` : "เมื่อแม่นยำเกิน 80% ค่อยเพิ่มความเร็วขึ้นรอบละนิด"]
      : (nm ? [\`ฝึกโน้ต \${nm} แยกทีละเสียง 3 ครั้ง แล้วค่อยเล่นรวมท่อน\`, "แตะช้า ๆ ให้ได้ยินเสียงชัดก่อนเร่ง"] : ["ไปเรียนขั้นถัดไปในเส้นทางการเรียนรู้ได้เลย"]),
  };
  const zh = {
    weakness: struggle ? \`「\${struggle.label}」还不稳（准确率 \${struggle.acc}%）\` : (nm ? \`最近常错音：\${nm}\` : "目前没有明显弱点 — 继续下一步吧"),
    steps: struggle
      ? [\`把「\${struggle.label}」拆成两小段慢练，再逐渐加速\`, nm ? \`特别留意 \${nm} — 先单独弹 3 次再合段\` : "准确率超过 80% 后再小幅提速"]
      : (nm ? [\`先单独练 \${nm} 各 3 次，再合回整段\`, "慢速弹清楚再提速"] : ["直接去学习路径的下一课吧"]),
  };
  const en = {
    weakness: struggle ? \`"\${struggle.label}" is still shaky (\${struggle.acc}% accuracy)\` : (nm ? \`Notes \${nm} keep slipping lately\` : "No clear weak spot right now — onward to the next step"),
    steps: struggle
      ? [\`Practice "\${struggle.label}" slowly in 2 tiny chunks, then speed up bit by bit\`, nm ? \`Watch \${nm} especially — play just that note 3 times before joining the phrase\` : "Once you pass 80% accuracy, nudge the tempo up slightly"]
      : (nm ? [\`Isolate \${nm} — 3 clean reps each, then rejoin the phrase\`, "Slow and clear first, speed later"] : ["Head straight to the next step on your Pathway"]),
  };
  const c = lang === "th" ? th : lang === "zh" ? zh : en;
  return { weakness: c.weakness, steps: c.steps.slice(0, 2), feature: struggle ? "pathway" : "pathway", topic: struggle ? struggle.label : null, strategyId: strat ? strat.name : null, fallback: true };
}

async function generateCoachTip(lang, profile) {`,
"fallback builder");

// ── 2) Validation gate on the parsed reply ──
rep(
`  const obj = JSON.parse(jsonTxt);
  if (!COACH_FEATURE_LABELS[obj.feature]) obj.feature = "pathway"; // guard against a hallucinated key
  obj.steps = obj.steps.slice(0, 3); // enforce the "at most 3" cap even if the model overshoots
  obj.topic = struggle ? struggle.label : null; // so the caller can log it and this fn can dodge repeats next time
  return obj;`,
`  const obj = JSON.parse(jsonTxt);
  if (!COACH_FEATURE_LABELS[obj.feature]) obj.feature = "pathway"; // guard against a hallucinated key
  obj.steps = obj.steps.slice(0, tone.tier === "beginner" ? 2 : 3); // enforce the per-level cap
  obj.topic = struggle ? struggle.label : null; // so the caller can log it and this fn can dodge repeats next time
  obj.strategyId = strat ? strat.name : null;
  // Auto-Teach แม่นยำ (แผนข้อ 5): ตรวจก่อนแสดงเสมอ — กว้างเกิน/หลุดขอบเขต/โครงไม่ครบ
  // → ใช้ fallback จากข้อมูลจริงแทน ไม่โชว์คำแนะนำสากลเด็ดขาด
  if (!validateTip(obj, Object.keys(COACH_FEATURE_LABELS))) return buildFallbackTip(lang, struggle, strat, topNoteMisses(2));
  return obj;`,
"validation gate");

writeFileSync(F, s);
console.log(fails ? `DONE with ${fails} FAIL(s)` : "DONE all ok");

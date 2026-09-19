/* One-off patch — Auto Teaching accuracy upgrade (owner plan 2026-09-19, items 1,2,4,9).
   Rewrites generateCoachTip's data-gathering block + prompt in App.tsx.
   str_replace is out of sync with this file (recurring) — applied via Node
   with literal anchors + idempotence guards, matching prior one-off patches. */
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

// ── 1) Data-gathering block: weighted struggles + note misses + model strategy + tone ──
rep(
`async function generateCoachTip(lang, profile) {
  const mem = readMemory();
  // Prefer a struggle that hasn't already been surfaced in the last few tips — repeating
  // the identical weak spot every time it fires reads as nagging. Falls back to the top
  // struggle anyway when it's genuinely the only one on record (still real, worth saying).
  const recentTopics = new Set(readAutoTeachLog().slice(-5).map(t => t.topic).filter(Boolean));
  const struggle = (mem.struggles || []).find(s => !recentTopics.has(s.label)) || (mem.struggles || [])[0];
  const recentTxt = (mem.recent || []).slice(0, 5).map(r => \`\${r.label} (\${r.acc}%)\`).join(", ") || "—";
  const struggleTxt = struggle ? \`\${struggle.label} (\${struggle.acc}%, missed \${struggle.count}x)\` : "—";
  const profileTxt = coachStatsToText(computeCoachStats(profile, lang));
  const featureKeys = Object.keys(COACH_FEATURE_LABELS).join(", ");`,
`async function generateCoachTip(lang, profile) {
  const mem = readMemory();
  // Auto-Teach แม่นยำ (แผนข้อ 2): จุดอ่อนเรียงด้วยน้ำหนักความสด (recency half-life 6d)
  // + ความรุนแรง + ความถี่ และตัดของเก่าเกิน 21 วันทิ้ง — ไม่ใช่เรียงเก่าสุดก่อนแบบเดิม
  // Prefer a struggle that hasn't already been surfaced in the last few tips — repeating
  // the identical weak spot every time it fires reads as nagging. Falls back to the top
  // struggle anyway when it's genuinely the only one on record (still real, worth saying).
  const recentTopics = new Set(readAutoTeachLog().slice(-5).map(t => t.topic).filter(Boolean));
  const wStruggles = weightedStruggles();
  const struggle = wStruggles.find(s => !recentTopics.has(s.label)) || wStruggles[0] || (mem.struggles || [])[0];
  // Auto-Teach แม่นยำ (แผนข้อ 1+3): โน้ต pitch-class ที่พลาดจริงล่าสุด — ครูรู้ "โน้ตไหน" ไม่ใช่แค่ "เพลงไหน"
  const noteMissTxt = topNoteMisses(2).map(n => \`\${n.label}(×\${n.count})\`).join(", ") || "—";
  const recentTxt = (mem.recent || []).slice(0, 5).map(r => \`\${r.label} (\${r.acc}%)\`).join(", ") || "—";
  const struggleTxt = struggle ? \`\${struggle.label} (\${struggle.acc}%, missed \${struggle.count}x\${struggle.ageDays != null ? \`, \${struggle.ageDays}d ago\` : ""})\` : "—";
  const profileTxt = coachStatsToText(computeCoachStats(profile, lang));
  const featureKeys = Object.keys(COACH_FEATURE_LABELS).join(", ");
  // Auto-Teach แม่นยำ (แผนข้อ 4): TIGA Piano Model (teaching loop) วิเคราะห์สัญญาณจริงก่อนเสมอ
  // — โมเดลเลือกกลยุทธ์การสอน + ดึง KB tip แล้ว AI ภายนอกแค่เรียบเรียงภาษาตามคำตัดสิน
  const dec = decideStrategy({
    accuracy: (mem.recent || [])[0] ? (mem.recent || [])[0].acc : null,
    repeatedErrors: struggle ? Math.min(struggle.count || 0, 4) : 0,
    repeatedErrorLabel: struggle ? struggle.label : null,
    pauses: 0, rhythmScore: null, speedRatio: null, weekAgoAccuracy: (mem.recent || [])[1] ? (mem.recent || [])[1].acc : null,
  }, runTeachingLoopForPractice);
  const strat = strategyHint(dec);
  // Auto-Teach แม่นยำ (แผนข้อ 9): ปรับโทน/ความยาวตามระดับผู้เรียนจริง
  const tone = learnerTone(profile);`,
"data block");

// ── 2) Thai message: inject strategy + note misses + tone rule ──
rep(
`    th: \`ข้อมูลผู้เรียน: \${profileTxt}\\nซ้อมล่าสุด: \${recentTxt}\\nจุดอ่อน: \${struggleTxt}\\nfeature ที่เลือกได้: \${featureKeys}\\n\\nวิเคราะห์แล้วตอบ JSON: weakness ไม่เกิน 12 คำ, steps สูงสุด 3 ข้อ (เจาะจงชื่อเพลง/หัวข้อ ไม่ใช่คำแนะนำทั่วไป), feature เลือกจากรายการเท่านั้น\`,`,
`    th: \`ข้อมูลผู้เรียน: \${profileTxt}\\nซ้อมล่าสุด: \${recentTxt}\\nจุดอ่อน: \${struggleTxt}\\nโน้ตที่พลาดบ่อยล่าสุด: \${noteMissTxt}\\n\${strat ? \`กลยุทธ์ที่โมเดลสอนเลือก (ต้องทำตาม ห้ามขัด): \${strat.name || "-"}\${strat.modelText ? \` — \${strat.modelText}\` : ""}\\n\` : ""}กฎโทนเสียง: \${tone.rule}\\nfeature ที่เลือกได้: \${featureKeys}\\n\\nวิเคราะห์แล้วตอบ JSON: weakness ไม่เกิน 12 คำ, steps สูงสุด \${tone.tier === "beginner" ? 2 : 3} ข้อ (เจาะจงชื่อเพลง/หัวข้อ ห้ามคำแนะนำกว้าง ๆ อย่าง "ฝึกสม่ำเสมอ"), feature เลือกจากรายการเท่านั้น\`,`,
"th message");

// ── 3) Chinese message ──
rep(
`    zh: \`学员数据：\${profileTxt}\\n最近练习：\${recentTxt}\\n薄弱点：\${struggleTxt}\\n可选feature：\${featureKeys}\\n\\n分析后回JSON：weakness≤12字，steps最多3条（具体指明曲目/主题），feature必须从列表选\`,`,
`    zh: \`学员数据：\${profileTxt}\\n最近练习：\${recentTxt}\\n薄弱点：\${struggleTxt}\\n最近常错音：\${noteMissTxt}\\n\${strat ? \`模型已选教学策略（必须遵循）：\${strat.name || "-"}\${strat.modelText ? \` — \${strat.modelText}\` : ""}\\n\` : ""}语气规则：\${tone.rule}\\n可选feature：\${featureKeys}\\n\\n分析后回JSON：weakness≤12字，steps最多\${tone.tier === "beginner" ? 2 : 3}条（具体指明曲目/主题，禁止泛泛建议），feature必须从列表选\`,`,
"zh message");

// ── 4) English message ──
rep(
`    en: \`Learner data: \${profileTxt}\\nRecent sessions: \${recentTxt}\\nWeak spot: \${struggleTxt}\\nAvailable features: \${featureKeys}\\n\\nAnalyze and reply JSON: weakness ≤12 words, steps max 3 (name specific song/topic, not generic advice), feature from list only\`,`,
`    en: \`Learner data: \${profileTxt}\\nRecent sessions: \${recentTxt}\\nWeak spot: \${struggleTxt}\\nFrequently missed notes: \${noteMissTxt}\\n\${strat ? \`Teaching strategy chosen by the model (must follow, do not contradict): \${strat.name || "-"}\${strat.modelText ? \` — \${strat.modelText}\` : ""}\\n\` : ""}Tone rule: \${tone.rule}\\nAvailable features: \${featureKeys}\\n\\nAnalyze and reply JSON: weakness ≤12 words, steps max \${tone.tier === "beginner" ? 2 : 3} (name specific song/topic, never generic advice like "practice regularly"), feature from list only\`,`,
"en message");

writeFileSync(F, s);
console.log(fails ? `DONE with ${fails} FAIL(s)` : "DONE all ok");

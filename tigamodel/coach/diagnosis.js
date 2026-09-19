/* ── tigamodel/coach/diagnosis.js ──
   AI DIAGNOSIS + DAILY PRACTICE ENGINE (P0 — master product directive).

   Reads ONLY data the app already records (no new schema, no guessing):
     • tg_memory  → struggles [{label, acc, count, interval}], mastered, recent
     • tg_practice_log → per-day {n, accSum} + _recent [{d, acc}]
   and turns them into the three answers a real teacher gives:
     WHAT  — ปัญหาคืออะไร (top struggle by repetition × low accuracy)
     WHY   — ทำไม (probability+evidence style: only claims the numbers support)
     HOW   — ฝึกยังไง (BPM / repetitions / hands-separate / minutes, concrete)

   Plus practiceTimeBudget(minutes): the time-adaptive session split
   (warm-up / problem / review / reading / performance) — the DAILY PRACTICE
   ENGINE. Sizes scale to the minutes the student actually has today.

   Honest-gap rule: no data → returns null / empty block. Never invents a
   weakness to look smart. Pure + synchronous. ── */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* top struggle: repetition weighted by how low the accuracy is */
export function pickTopStruggle(memory) {
  const struggles = (memory && memory.struggles) || [];
  if (!struggles.length) return null;
  const scored = struggles.map(s => ({
    ...s,
    score: (s.count || 1) * (1 - clamp((s.acc || 0) / 100, 0, 1)),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

/* trend for a label from recent history (improving / steady / worsening) */
export function trendFor(memory, label) {
  const recent = ((memory && memory.recent) || []).filter(r => r.label === label);
  if (recent.length < 2) return "unknown";
  const [latest, prev] = recent;
  const d = (latest.acc || 0) - (prev.acc || 0);
  if (d >= 8) return "improving";
  if (d <= -8) return "worsening";
  return "steady";
}

/* ── WHAT / WHY / HOW diagnosis from real numbers ── */
export function buildDiagnosis({ memory = null, practiceLog = null, now = Date.now() } = {}) {
  const top = pickTopStruggle(memory);
  if (!top) return null; // honest gap: nothing on record yet
  const trend = trendFor(memory, top.label);
  const acc = top.acc || 0;
  const count = top.count || 1;

  /* WHY — every claim below is backed by a number we actually have */
  const why = [];
  if (count >= 3) why.push(`เป็นปัญหาซ้ำ — กลับมาฝึกแล้ว ${count} ครั้ง ยังอยู่ที่ ${acc}%`);
  else why.push(`ผลล่าสุด ${acc}% — ต่ำกว่าเกณฑ์เล่นต่อได้ (65%)`);
  if (trend === "worsening") why.push("แนวโน้มแย่ลงเมื่อเทียบรอบก่อน — มักจากการซ้อมเร็วเกินตัว");
  else if (trend === "improving") why.push("กำลังดีขึ้นเมื่อเทียบรอบก่อน — ต้องซ้ำให้ถึงจุดคงตัว");
  else why.push("ผลยังไม่ขยับ — วิธีเดิมยังไม่โดนจุด ควรเปลี่ยนมุมการฝึก");

  /* HOW — concrete prescription (BPM scales with severity) */
  const bpm = acc < 50 ? 50 : acc < 70 ? 60 : 72;
  const reps = count >= 3 ? 10 : 5;
  const minutes = acc < 50 ? 10 : 7;
  const how = [
    `ซ้อมช้าที่ ${bpm} BPM — ตัดเฉพาะช่วงที่พัง ไม่เล่นผ่านทั้งเพลง`,
    `มือแยกก่อน ข้างละ ${Math.max(2, Math.round(minutes / 2))} นาที แล้วค่อยรวม`,
    `เป้าหมายรอบนี้: เล่นถูก ${reps} ครั้งติดกันในความเร็วเดียวกัน`,
  ];

  return {
    what: { label: top.label, acc, count, trend },
    why,
    how,
    meta: { bpm, reps, minutes, generatedAt: now },
  };
}

/* ── DAILY PRACTICE ENGINE: minutes in → adaptive session split out ──
   parts are fractions of the session; floor 2 min each; remainder to the
   problem section (the highest-leverage block). With no known struggle the
   problem block becomes "song practice" (focus = null). ── */
const BUDGET_FRACTIONS = [
  { key: "warmup", f: 0.15 },
  { key: "problem", f: 0.35 },
  { key: "review", f: 0.2 },
  { key: "reading", f: 0.2 },
  { key: "performance", f: 0.1 },
];

export function practiceTimeBudget(minutes, { memory = null } = {}) {
  const total = clamp(Math.round(minutes || 20), 5, 120);
  const top = pickTopStruggle(memory);
  // very short sessions can't fund all five blocks (each needs ≥2 min) —
  // drop the lowest-leverage ones first so what remains is honest
  const partsFor = total < 6 ? BUDGET_FRACTIONS.filter(p => ["warmup", "problem"].includes(p.key))
    : total < 10 ? BUDGET_FRACTIONS.filter(p => ["warmup", "problem", "review"].includes(p.key))
    : total < 15 ? BUDGET_FRACTIONS.filter(p => p.key !== "reading")
    : BUDGET_FRACTIONS;
  const raw = partsFor.map(({ key, f }) => ({ key, minutes: Math.max(2, Math.round(total * f)) }));
  // trim/expand so the sum equals the budget; adjust the problem block first
  let diff = raw.reduce((a, p) => a + p.minutes, 0) - total; // >0 = we rounded high
  const have = new Set(raw.map(p => p.key));
  const order = ["problem", "review", "reading", "performance", "warmup"].filter(k => have.has(k));
  for (const key of order) {
    if (diff === 0) break;
    const p = raw.find(x => x.key === key);
    const next = clamp(p.minutes - diff, 2, total);
    diff -= p.minutes - next; // what we just removed off `diff`
    p.minutes = next;
  }
  return {
    total,
    focus: top ? top.label : null, // the problem block drills THIS (null → generic play)
    parts: raw.map(p => (p.key === "problem" && top ? { ...p, label: top.label } : p)),
  };
}

/* ── STUDENT SNAPSHOT — compact, honest profile from real data ──
   Trend classification per the long-term-memory directive:
   weak (<65 recent) → improving (65-89) → strong (≥90 / mastered) ── */
export function buildStudentSnapshot({ memory = null, practiceLog = null } = {}) {
  if (!memory && !practiceLog) return null;
  const recent = (memory && memory.recent) || [];
  const logRecent = (practiceLog && practiceLog._recent) || [];
  const acc30 = logRecent.length
    ? Math.round(logRecent.reduce((a, r) => a + (r.acc || 0), 0) / logRecent.length)
    : null;
  const days30 = logRecent.length;
  const mastered = (memory && memory.mastered) || [];
  const struggles = (memory && memory.struggles) || [];
  const skillState = (label) => {
    const s = struggles.find(x => x.label === label);
    if (s) return s.acc >= 80 ? "improving" : "weak";
    if (mastered.includes(label)) return "strong";
    const r = recent.find(x => x.label === label);
    if (r) return r.acc >= 90 ? "strong" : r.acc >= 65 ? "improving" : "weak";
    return null;
  };
  return {
    sessions: (memory && memory.sessions) || 0,
    practiceDays30: days30,
    avgAcc30: acc30,
    strengths: mastered.slice(0, 3),
    weaknesses: struggles.slice(0, 3).map(s => ({ label: s.label, acc: s.acc, count: s.count, state: skillState(s.label) })),
    // honest gap: age/goal/genre/favorite-music not collected app-wide yet —
    // they stay ABSENT here until real fields exist (never guessed)
    gaps: ["age_group", "goal", "genre_preference", "practice_time_preference"],
  };
}

/* ── the prompt block for the PRODUCTION chat teacher (use-chat injects it):
   lets the AI answer "ตอนนี้ฉันมีปัญหาอะไร / ทำไม / ควรฝึกอะไร / เท่าไร /
   BPM เท่าไร" from the student's REAL numbers. Empty when no data. ── */
export function buildCoachContextBlock({ memory = null, practiceLog = null } = {}) {
  const dx = buildDiagnosis({ memory, practiceLog });
  const snap = buildStudentSnapshot({ memory, practiceLog });
  const lines = [];
  if (snap) {
    const bits = [];
    if (snap.sessions) bits.push(`เซสชันซ้อมทั้งหมด ${snap.sessions}`);
    if (snap.avgAcc30 != null) bits.push(`ความแม่นเฉลี่ย 30 วัน ${snap.avgAcc30}% (${snap.practiceDays30} วันที่บันทึก)`);
    if (snap.strengths.length) bits.push(`จุดแข็ง: ${snap.strengths.join(", ")}`);
    if (snap.weaknesses.length) bits.push(`จุดที่ต้องช่วย: ${snap.weaknesses.map(w => `${w.label} (${w.acc}%, ${w.state})`).join(", ")}`);
    if (bits.length) lines.push(`[ข้อมูลนักเรียนจากระบบ — พูดถึงได้ อ้างได้ ห้ามกุเพิ่ม]\n• ${bits.join("\n• ")}`);
  }
  if (dx) {
    lines.push(
      `[การวินิจฉัยล่าสุด — ใช้ตอบคำถาม 'ฉันมีปัญหาอะไร/ทำไม/ควรฝึกยังไง']\n` +
      `WHAT: ${dx.what.label} — ความแม่น ${dx.what.acc}% (กลับมาแล้ว ${dx.what.count} ครั้ง, แนวโน้ม: ${dx.what.trend})\n` +
      `WHY: ${dx.why.join(" · ")}\n` +
      `HOW: ${dx.how.join(" · ")} (BPM ${dx.meta.bpm}, ${dx.meta.reps} รอบ, ~${dx.meta.minutes} นาที)`
    );
  }
  return lines.length ? "\n\n" + lines.join("\n\n") + "\n" : "";
}

/* ── tigamodel/teaching/coach.js ──
   THE COACHING REASONING LAYER (roadmap #73 hint ladder, #75 adaptive
   difficulty, #78 recap generator, #46 mastery criteria — all ⭐⭐⭐).

   Everything here is pure, synchronous, rule-based reasoning over data the
   app already has: no model call, no network, no invented facts. Follows the
   same contract as teaching-loop.js: probability+evidence, honest gaps,
   "สังเกต ≠ สรุป" — and it composes TEXT ONLY from its own computed data
   (never hallucinated specifics).

   1) HINT LADDER (#73) — 4 rungs a world-class teacher climbs IN ORDER,
      never jumping straight to the answer:
        0 ถามกลับ (ask back) → 1 ชี้จุด (point) → 2 โชว์วิธี (show how)
        → 3 เล่นให้ดู (play it / reveal)
      rungFor() picks the rung from the learner's history with THIS obstacle
      (attempts, same-spot fails, self-report); escalate() returns the next
      rung. Rung text is rendered per-language from computed facts only.

   2) ADAPTIVE DIFFICULTY (#75, flow ±10%) — tempoTarget() walks the practice
      tempo toward the goal while keeping success probability in the flow
      band (~85% accuracy = ±10% of capability, flow theory): many clean
      reps → +1 step; shaky → −1 step; mid → hold. Steps are REAL bounds
      (min/max BPM), and the reason is always attached.

   3) RECAP GENERATOR (#78) — recap() turns a session's actual numbers into
      exactly 3 lines (what improved / what to drill / next step) + one
      homework sized ≤15 min (#49), each computed from the session data.

   4) MASTERY CRITERIA (#46) — masteryChecklist(skillId) returns the concrete,
      checkable bar for "เก่งพอที่จะไปต่อ" per skill domain — the definition
      the other three functions are targeting. ── */

/* ── 1) HINT LADDER ── */

export const HINT_RUNGS = [
  { rung: 0, id: "ask-back",  th: "ถามกลับ", en: "Ask back",  zh: "反问" },
  { rung: 1, id: "point",     th: "ชี้จุด",   en: "Point",     zh: "点拨" },
  { rung: 2, id: "show-how",  th: "โชว์วิธี", en: "Show how",  zh: "示范" },
  { rung: 3, id: "play-it",   th: "เล่นให้ดู", en: "Play it",  zh: "演奏" },
];

/* Which rung does THIS obstacle deserve? History first, sympathy second:
   - first stumble            → rung 0 (ask back — let them find it)
   - same spot failed 2×      → rung 1 (point at the exact place/kind)
   - failed 3+ or asked help  → rung 2 (show the method, not the answer)
   - still stuck after that   → rung 3 (play it for them — reset pride)
   A hard self-report never skips the ladder; it only accelerates one rung. */
export function rungFor({ attempts = 1, sameSpotFails = 0, selfReport = null, lastRung = null } = {}) {
  const a = Math.max(1, attempts | 0);
  const f = Math.max(0, sameSpotFails | 0);
  let rung;
  if (f >= 3 || a >= 5) rung = 3;
  else if (f === 2 || a >= 3) rung = 2;
  else if (f === 1 || a >= 2) rung = 1;
  else rung = 0;
  if (selfReport === "too_hard" && rung < 3) rung += 1; // accelerate, never teleport
  if (lastRung != null) rung = Math.max(rung, Number(lastRung) || 0); // a ladder never descends mid-obstacle
  return Math.min(3, rung);
}

export function escalate(rung) {
  return Math.min(3, (Number(rung) || 0) + 1);
}

/* Render the rung as concrete teacher text. Facts in must be facts out:
   the composer only references values the caller supplied. */
export function renderHint(rung, ctx = {}) {
  const label = HINT_RUNGS[Math.max(0, Math.min(3, rung | 0))];
  const bar = ctx.barLabel || null;   // e.g. "ห้อง 5-6" — caller's real data
  const tempo = ctx.tempoBpm ? `${ctx.tempoBpm} BPM` : null;
  const where = bar ? `${bar} ` : "";
  if (label.id === "ask-back") {
    return {
      rung: label.rung, id: label.id,
      th: `ลองฟังตัวเองอีกครั้งตรง ${where}— คิดว่าจุดไหนเพี้ยนที่สุด แล้วบอกครูก่อนเล่นซ้ำ`,
      en: `Listen back to yourself at ${where}— which spot sounds most off? Tell me before you replay it.`,
      zh: `在${where}再听一遍自己——哪里最不对？先告诉我再重弹。`,
    };
  }
  if (label.id === "point") {
    return {
      rung: label.rung, id: label.id,
      th: `ตรง ${where}สังเกต${ctx.focus === "rhythm" ? "จังหวะที่หายไปครึ่งจังหวะ" : "นิ้วที่ยังกดไม่ทัน"} — ช้าลงแค่ท่อนนี้ แล้วนับออกเสียง`,
      en: `At ${where}watch ${ctx.focus === "rhythm" ? "the missing half-beat" : "the finger that lands late"} — slow just this bit and count aloud.`,
      zh: `在${where}注意${ctx.focus === "rhythm" ? "丢掉的半拍" : "晚落下的手指"}——放慢只练这里，边弹边数。`,
    };
  }
  if (label.id === "show-how") {
    return {
      rung: label.rung, id: label.id,
      th: `วิธีแก้: แบ่ง${where}เป็นสองท่อนเล็ก เล่นทีละท่อน 3 ครั้งให้สมบูรณ์${tempo ? ` ที่ ${tempo}` : ""} แล้วค่อยต่อ`,
      en: `The method: split ${where}into two tiny chunks, nail each 3×${tempo ? ` at ${tempo}` : ""}, then join.`,
      zh: `方法：把${where}拆成两小段，每段完美弹 3 次${tempo ? `（${tempo}）` : ""}再连起来。`,
    };
  }
  return {
    rung: label.rung, id: label.id,
    th: `ครูเล่นให้ฟัง${where ? `ตรง ${where}` : ""}หนึ่งครั้ง ฟังดูจุดที่ต่างจากของตัวเอง แล้วลองเลียนตาม`,
    en: `I'll play ${where ? `the ${where}` : "it"} for you once — listen for what differs from yours, then copy.`,
    zh: `${where ? `我在${where}` : ""}示范一次——听出与你不同的地方，然后模仿。`,
  };
}

/* ── 2) ADAPTIVE DIFFICULTY (flow ±10%) ── */

/* One tempo decision. targetBpm/goalBpm are REAL numbers from the caller
   (song config / practice history); the band rule:
     accuracy ≥ 95% AND clean reps ≥ 3 → +1 step (≈ +5 BPM)
     accuracy < 75%                    → −1 step (≈ −8 BPM)
     else                              → hold
   Output is always clamped to [minBpm, min(goalBpm, maxBpm)] with the reason
   attached — a decision that cannot explain itself is not shipped. */
export function tempoTarget({ currentBpm, goalBpm, accuracy, cleanReps = 0, minBpm = 40, maxBpm = 208 } = {}) {
  const cur = Math.round(Number(currentBpm) || 0);
  const goal = Math.round(Number(goalBpm) || 0);
  if (!cur || !goal) return { bpm: cur || goal || null, step: 0, reason: "no-data", band: null };
  const acc = typeof accuracy === "number" ? accuracy : null;
  const max = Math.min(goal, Math.max(1, maxBpm | 0));
  const min = Math.max(20, minBpm | 0);
  let step = 0, reason = "hold-in-flow-band";
  if (acc == null) { reason = "no-accuracy-yet"; }
  else if (acc >= 95 && cleanReps >= 3 && cur < max) { step = +5; reason = "flow-high: ≥95% × 3 clean reps — nudge up"; }
  else if (acc < 75 && cur > min) { step = -8; reason = "below-band: accuracy <75% — step down to rebuild"; }
  const bpm = Math.max(min, Math.min(max, cur + step));
  const pctOfGoal = Math.round((bpm / goal) * 100);
  /* reasonId = stable machine key (smoke-reasoning asserts on it);
     reasonT = trilingual display text — the UI renders the app's language,
     never this English-only id (owner request: analysis follows app lang). */
  const REASON_TEXT = {
    "hold-in-flow-band": { th: "อยู่ในโซนไหลลื่น — คงเทมโปนี้ไว้ก่อน", en: "Inside the flow band — hold this tempo", zh: "处于流畅区间——保持这个速度" },
    "no-accuracy-yet": { th: "ยังไม่มีข้อมูลความแม่น — ซ้อมต่อแล้วระบบจะปรับให้", en: "No accuracy data yet — keep playing and we'll adjust", zh: "暂无准确度数据——继续练习，系统会自动调整" },
    "flow-high: ≥95% × 3 clean reps — nudge up": { th: "แม่น ≥95% ต่อเนื่อง 3 ครั้ง — ขยับเร็วขึ้นอีกนิด", en: "≥95% × 3 clean reps — nudging faster", zh: "准确度≥95%连续3次——稍微加快" },
    "below-band: accuracy <75% — step down to rebuild": { th: "แม่นต่ำกว่า 75% — ช้าลงเพื่อสร้างฐานให้แน่น", en: "Accuracy below 75% — slowing down to rebuild", zh: "准确度低于75%——放慢重建基础" },
    "no-data": { th: "ยังไม่มีข้อมูล", en: "No data", zh: "暂无数据" },
  };
  return {
    bpm, step: bpm - cur, reason,
    reasonT: REASON_TEXT[reason] || null,
    band: { pctOfGoal, inFlow: pctOfGoal >= 55 && pctOfGoal <= 100 }, // flow band = working comfortably inside ±10% of current capability
  };
}

/* ── 3) RECAP GENERATOR (#78) — 3 lines + ≤15-min homework, all computed ── */

export function recap({ studentName = null, skillLabel = null, session = {}, masteryBefore = null, masteryAfter = null, nextSkill = null, tempo = null, lang = "th" } = {}) {
  const L = (lang === "zh" || lang === "en") ? lang : "th";
  const acc = typeof session.accuracy === "number" ? session.accuracy : null;
  const prev = typeof session.weekAgoAccuracy === "number" ? session.weekAgoAccuracy : null;
  const worst = session.worstSpotLabel || null;
  const lines = [];
  // Line 1 — what actually improved (real delta or honest "not yet")
  if (acc != null && prev != null) {
    const d = acc - prev;
    lines.push(d >= 3
      ? { kind: "improved", th: `แม่นขึ้นจริง +${d}% จากสัปดาห์ก่อน (${acc}%)`, en: `Accuracy up ${d}% vs last week (${acc}%)`, zh: `准确度比上周提高 ${d}%（${acc}%）` }
      : d <= -3
        ? { kind: "regressed", th: `ครั้งนี้ ${acc}% — ถอย ${Math.abs(d)}% จากสัปดาห์ก่อน ปกติของการเรียน งั้นเราซ้อมจุดเดิมให้แน่น`, en: `${acc}% this time — ${Math.abs(d)}% below last week. Normal dip; we'll re-secure the same spot.`, zh: `本次 ${acc}%——比上周低 ${Math.abs(d)}%。正常波动，我们重新巩固同一位置。` }
        : { kind: "steady", th: `คงระดับ ${acc}% ได้มั่นคง — ฐานเดิมแน่นแล้ว พร้อมก้าวถัดไป`, en: `Held steady at ${acc}% — the base is solid, ready for the next step`, zh: `稳定保持 ${acc}%——基础扎实，可以进步了` });
  } else if (acc != null) {
    lines.push(acc >= 85
      ? { kind: "strong", th: `ความแม่นยำ ${acc}% — ระดับที่เล่นให้คนอื่นฟังได้`, en: `Accuracy ${acc}% — performance-ready level`, zh: `准确度 ${acc}%——可以表演的水平` }
      : { kind: "recorded", th: `บันทึกผล ${acc}% ไว้เป็นฐานตั้งต้น`, en: `Recorded ${acc}% as your starting base`, zh: `已记录 ${acc}% 作为起点` });
  } else {
    lines.push({ kind: "recorded", th: "บันทึกเซสชันนี้ไว้แล้ว (ยังไม่มีตัวเลขความแม่นยำ)", en: "Session logged (no accuracy number yet)", zh: "已记录本次练习（暂无准确度）" });
  }
  // Line 2 — the ONE drill (from the worst real spot)
  const drillSpot = worst ? `${worst} ` : "";
  lines.push({ kind: "drill", th: `โฟกัสซ้อม: ${drillSpot}เล่นช้า 3 ครั้งให้สมบูรณ์ แล้วค่อยเร็วขึ้นทีละนิด`, en: `Drill: ${drillSpot}play it slowly 3× perfectly before any speed-up`, zh: `重点练习：${drillSpot}慢速完美弹 3 次后再加速` });
  // Line 3 — the next step (from the skill graph, not invented). The label
  // follows the language of each line entry (owner request: analysis follows
  // the app language) — nextSkill nodes carry th/en/zh; older callers may
  // pass a bare string or {th} only, so fall back gracefully.
  const L3 = (o) => (o && typeof o === "object" ? (o[L] || o.en || o.th || null) : (o || null));
  const nextLabel = (nextSkill && (nextSkill[L] || nextSkill.en || nextSkill.th)) || L3(skillLabel) || null;
  lines.push(nextLabel
    ? { kind: "next", th: `ก้าวถัดไป: ${nextLabel}`, en: `Next step: ${nextLabel}`, zh: `下一步：${nextLabel}` }
    : { kind: "next", th: "ก้าวถัดไป: ทบทวนเพลงเดิมให้ลื่นขึ้นอีกระดับ", en: "Next step: polish the current piece one level smoother", zh: "下一步：把当前曲目弹得更流畅" });
  // Homework ≤ 15 min (#49): small, checkable, doable anywhere
  const hw = {
    th: `การบ้าน (≤15 นาที): ${drillSpot || "ท่อนที่ซ้อมวันนี้ "}ช้าๆ 3 รอบ + จบด้วยเล่นเพลงที่ชอบ 1 เพลง`,
    en: `Homework (≤15 min): ${drillSpot || "today's passage "}slow 3× + end with one favourite piece`,
    zh: `作业（≤15 分钟）：${drillSpot || "今日段落"}慢速 3 遍 + 以一首喜欢的曲子结束`,
  };
  return {
    lines, homework: hw,
    summary: {
      accuracy: acc, deltaVsLastWeek: (acc != null && prev != null) ? acc - prev : null,
      masteryDelta: (typeof masteryAfter === "number" && typeof masteryBefore === "number") ? +(masteryAfter - masteryBefore).toFixed(2) : null,
      tempo: tempo || null,
    },
  };
}

/* ── 4) MASTERY CRITERIA (#46) — the concrete bar per skill domain ── */

export const MASTERY_CRITERIA = {
  rhythm: { th: "เล่นผ่านได้ 3 ครั้งติดต่อกัน โดยจังหวะไม่เหลื่อมเกินครึ่งจังหวะ ที่เทมโปเป้าหมาย", en: "3 consecutive passes with timing within half a beat at target tempo", zh: "在目标速度下连续 3 次通过，节奏误差不超过半拍" },
  technique: { th: "ท่าถูก ไร้แรงเกร็ง เล่นได้ 3 ครั้งติด ที่เทมโปไม่ต่ำกว่า 80% ของเป้าหมาย", en: "Correct relaxed form, 3 consecutive passes at ≥80% of target tempo", zh: "姿势正确放松，以不低于目标速度 80% 连续通过 3 次" },
  "sight-reading": { th: "อ่านและเล่นผ่านบทใหม่ (ไม่เคยเห็น) ได้ครั้งแรก พลาดไม่เกิน 2 จุด", en: "First-time play-through of unseen material with ≤2 mistakes", zh: "首次视奏未见过的新谱，错误不超过 2 处" },
  harmony: { th: "จับ/สลับคอร์ดถูกต้อง 8 ครั้งติดต่อกัน ตามจังหวะ ไม่มีเสียงแตก", en: "8 consecutive correct clean chord changes in time", zh: "按节奏连续 8 次正确干净的和弦转换" },
  expression: { th: "คุมดัง-เบา/ประโยคได้ตามที่ตั้งใจไว้ 2 ครั้งติด และอธิบายเหตุผลได้", en: "Intended dynamics/phrasing twice in a row, and can explain the why", zh: "连续 2 次实现预期的强弱与分句，并能说明理由" },
  repertoire: { th: "เล่นจบทั้งเพลงต่อเนื่อง ไม่หยุดซ่อม เกิน 1 ครั้ง", en: "Full continuous performance with at most one stop-and-fix", zh: "完整连续演奏，最多一次停顿修正" },
  coordination: { th: "สองมือทำงานต่างรูปแบบได้ 3 ครั้งติด ที่เทมโปช้า ๆ โดยไม่สะดุด", en: "3 consecutive clean passes with both hands in different roles, slowly", zh: "双手不同分工连续 3 次慢速干净通过" },
  theory: { th: "ตอบถูกด้วยตัวเอง 8/10 คำถามในหัวข้อนั้น โดยไม่เปิดเฉลย", en: "Answers 8/10 topic questions unaided", zh: "独立答对 8/10 相关问题" },
  pedal: { th: "เปลี่ยนแป้นเชื่อมเสียงได้เนียน 8/10 ครั้ง ไม่มีเสียงติดกันมัว", en: "8/10 clean legato pedal changes, no blur", zh: "8/10 次干净的切分踏板，无浑浊" },
  accompaniment: { th: "มือซ้ายนิ่งค้ำจังหวะได้ตลอดเพลง ขณะมือขวาร้องเมโลดี้", en: "Left hand holds steady throughout while the right sings", zh: "右手歌唱时左手全程稳定" },
  performance: { th: "เล่นต่อหน้าคนอื่น (หรือกล้อง) จบเพลง ใจสั่นแค่ไหนก็ได้ แต่ไม่หยุด", en: "Plays the full piece for an audience (or camera) without stopping", zh: "能在观众（或镜头）前完整演奏不中断" },
};

export function masteryChecklist(skillDomain) {
  return MASTERY_CRITERIA[skillDomain] || null;
}

/* ── Assembled coach instance (what web.js / the lab consume) ── */
export function createCoach({ skillGraph } = {}) {
  return {
    rungFor, escalate, renderHint,
    tempoTarget, recap, masteryChecklist,
    nextSkill: (mastery, opts) => (skillGraph ? skillGraph.nextSkill(mastery, opts) : null),
  };
}

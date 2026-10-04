import { dayKey } from "./shared-infra";
/* ── ai-chat-context.ts ──
   Cross-session learner memory (struggles/mastered/recent, spaced-review
   due dates) and assigned-homework tracking, folded into the AI chat's
   system prompt so the tutor has continuity between sessions. Take only
   `lang`, read everything else from localStorage. Extracted from App.tsx
   verbatim — no logic changes.

   Note: curriculumContext() and songRecommendationHint() (the other two
   context builders named in the modularization plan) stay in App.tsx for
   now — both call gamification functions (nextRecommendedAction,
   weakestSkills, computeSkillScores, SKILL_LABELS, pathDoneSet,
   keyDoneMap) that are themselves still plain top-level App.tsx helpers,
   not part of use-gamification.ts (that hook only owns the coins/exp/
   streak/quest state, not this skill-tracking/recommendation layer).
   Moving curriculumContext/songRecommendationHint now would still create
   a circular import; they belong here once THAT layer gets its own
   module, whenever that happens. ── */


/* ── learner memory (cross-session) → personalized AI + adaptive path ── */
export function readMemory() { try { return JSON.parse(localStorage.getItem("tg_memory") || "null") || { struggles: [], mastered: [], recent: [] }; } catch (e) { return { struggles: [], mastered: [], recent: [] }; } }
export function writeMemory(m) { try { localStorage.setItem("tg_memory", JSON.stringify(m)); } catch (e) {} }
export function recordMemory(label, acc) {
  if (!label) return;
  const m = readMemory();
  m.recent = [{ label, acc, t: dayKey() }, ...(m.recent || []).filter(r => r.label !== label)].slice(0, 12);
  const prev = (m.struggles || []).find(s => s.label === label);
  if (acc >= 90) {
    if (!m.mastered.includes(label)) m.mastered = [label, ...m.mastered].slice(0, 12);
    m.struggles = (m.struggles || []).filter(s => s.label !== label);
  } else if (acc < 65) {
    // Still struggling — SM-2-lite, same shape as markPathAccuracy()'s Pathway
    // scheduling: a poor showing resets the interval short ("see it again
    // soon"), instead of the flat fixed "2 days" every struggle used to get
    // regardless of how many times it had already come back due.
    m.struggles = [{ label, acc, last: Date.now(), count: (prev ? prev.count : 0) + 1, interval: 1 }, ...(m.struggles || []).filter(s => s.label !== label)].slice(0, 6);
  } else if (prev) {
    // Improving (65-89%) on something already tracked as a struggle — grow
    // the interval instead of leaving the entry stale at its old (worse)
    // accuracy/timestamp forever. Still short of "mastered" so it stays on
    // the list, just checked back on less urgently each time it improves.
    const factor = acc >= 80 ? 2 : 1.4;
    const interval = Math.min(14, Math.max(1, Math.round((prev.interval || 1) * factor)));
    m.struggles = [{ label, acc, last: Date.now(), count: prev.count + 1, interval }, ...(m.struggles || []).filter(s => s.label !== label)].slice(0, 6);
  }
  writeMemory(m);
}
// stamp the end of a voice session so next time we know how long they were away
export function touchSessionMemory() { try { const m = readMemory(); m.lastSession = Date.now(); m.sessions = (m.sessions || 0) + 1; writeMemory(m); } catch (e) {} }
export function memoryContext(lang) {
  const m = readMemory(), parts = [];
  const now = Date.now();
  const dAgo = (t) => t ? Math.max(0, Math.floor((now - t) / 86400000)) : null;
  // SPACED REPETITION: due once each struggle's own SM-2-lite interval has
  // passed (recordMemory above) — falls back to the old flat 2-day rule for
  // entries recorded before this existed (no `interval` field yet).
  const due = (m.struggles || []).filter(s => s.last && (now - s.last) >= (s.interval || 2) * 86400000).slice(0, 3);
  if (due.length) parts.push((lang === "th" ? "⏰ ครบกำหนดทบทวน (แทรกการทบทวนสั้น ๆ ให้เขาแบบเนียน ๆ): " : lang === "zh" ? "⏰ 到复习时间（自然地带入简短回顾）：" : "⏰ Due for spaced review (weave in a quick revisit): ") + due.map(s => `${s.label} (${dAgo(s.last)}d)`).join(", "));
  if (m.struggles && m.struggles.length) parts.push((lang === "th" ? "เคยติด: " : lang === "zh" ? "曾困难: " : "Struggled with: ") + m.struggles.slice(0, 3).map(s => s.label).join(", "));
  if (m.mastered && m.mastered.length) parts.push((lang === "th" ? "ทำได้ดีแล้ว: " : lang === "zh" ? "已掌握: " : "Mastered: ") + m.mastered.slice(0, 3).join(", "));
  if (m.recent && m.recent.length) {
    // Gap #9 (2026-09-17 round 2): include the ACCURACY of the last attempts,
    // not just labels — "เพลงที่เธอซ้อมอยู่เมื่อวานได้ 72%" lets the teacher
    // reference real progress like a human does, and pick up where it hurt.
    const recentLabel = lang === "th" ? "ฝึกล่าสุด" : lang === "zh" ? "最近练习" : "Recently practiced";
    parts.push(recentLabel + ": " + m.recent.slice(0, 3).map(r => `${r.label} ${r.acc != null ? r.acc + "%" : ""}`.trim()).join(", "));
  }
  const gap = dAgo(m.lastSession);
  if (gap != null && gap >= 1) parts.push((lang === "th" ? "ห่างหายไป " + gap + " วัน (ทักทายอบอุ่นแบบคิดถึง)" : lang === "zh" ? "已隔 " + gap + " 天（温暖地问候，像想念他）" : "Returning after " + gap + " days (greet warmly like you missed them)"));
  return parts.length ? ("\n\n[" + (lang === "th" ? "ความจำผู้เรียน (อ้างถึงเพื่อความต่อเนื่อง + ทบทวนตามจังหวะ)" : lang === "zh" ? "学员记忆（用于连贯与按时复习）" : "Learner memory (use for continuity + spaced review)") + ": " + parts.join(" · ") + "]") : "";
}

/* ── homework + lesson plan (assigned by the AI, tracked across sessions) ── */
export function readHomework() { try { return JSON.parse(localStorage.getItem("tg_homework") || "null"); } catch (e) { return null; } }
export function setHomeworkLS(h) { try { h ? localStorage.setItem("tg_homework", JSON.stringify(h)) : localStorage.removeItem("tg_homework"); } catch (e) {} }
export function homeworkContext(lang) {
  const h = readHomework();
  if (!h || !h.text) return "";
  const lbl = lang === "th" ? "การบ้านที่คุณสั่งไว้คราวก่อน (ถามว่าเขาฝึกหรือยัง แล้วตรวจ/ให้ฟีดแบ็ก)" : lang === "zh" ? "你上次布置的作业（先问他练了没，然后检查/反馈）" : "Homework you assigned last time (ask if they did it, then check and give feedback)";
  return "\n\n[" + lbl + ": " + h.text + "]";
}

/* ── learnerSignal → prompt block (plan 21 §V4b) ──────────────────────────
   The tutor already had the memory LIST ("เคยติด: a, b, c"), which is what the
   learner struggled with before. What it never had is the DECISION the rest of
   the app already computes and already trusts: `learnerSignal()` — the same
   function use-autoteach and the Daily Mentor card read, from the same act log
   and the same `tg_memory`. So the tutor could name past mistakes but could not
   aim at the one that is hurting now.

   This adds only the aim. It costs ~150 chars, against the 3,000+ that plan 21
   §V2 saves on every message, and it adds NO model call — the signal is
   computed locally from data the app already has.

   Honest-gap rule (the same one the rest of the module follows): when the app
   cannot say what to practise, `nextAction` is null and this returns "" rather
   than guessing. A tutor that invents a weakness is worse than one that is
   silent about it. When it does know, it gets the evidence too — "40% miss rate
   over 12 attempts" — so the tutor can speak from the learner's own numbers the
   way `getCoachContextBlock()` already lets it.

   `signal` is passed in rather than read here: the act log and the label
   function live in the app layer, and this module is imported by that layer —
   reading them here would close a cycle. */
export function learnerSignalContext(lang, signal) {
  const s = signal && typeof signal === "object" ? signal : null;
  if (!s) return "";
  const weak = Array.isArray(s.skillScores) ? s.skillScores.filter(x => x && x.score != null) : [];
  const parts = [];
  const na = s.nextAction;
  if (na && na.label) {
    const why = na.evidence && na.evidence[0] && na.evidence[0].n
      ? ` (${na.evidence[0].n} ครั้ง)`
      : "";
    parts.push((lang === "th" ? "ควรให้ความสำคัญตอนนี้: " : lang === "zh" ? "现在该关注： " : "Focus right now: ") + asPlain(na.label) + why);
  }
  // only skills that are genuinely weak — a strong skill is not an instruction
  const bad = weak.filter(x => x.score != null && x.score < 55).sort((a, b) => a.score - b.score).slice(0, 2);
  if (bad.length) {
    parts.push((lang === "th" ? "ทักษะที่ยังไม่แน่น: " : lang === "zh" ? "还不稳的技能： " : "Still weak: ")
      + bad.map(x => `${asPlain(x.skill)} ${x.score}%`).join(", "));
  }
  if (!parts.length) return "";
  const head = lang === "th" ? "สัญญาณจากการฝึกของเขา (ใช้เล็งเฉพาะตรงนี้ ไม่ต้องย้ำเรื่องที่เขาทำได้แล้ว)"
    : lang === "zh" ? "来自他练习的信号（只针对这里，不用重复他已经会的）"
    : "Signals from their practice (aim here; do not repeat what they already do well)";
  return "\n\n[" + head + ": " + parts.join(" · ") + "]";
}

/* A label may be {th,en,zh}; a prompt block is text, so pick the language and
   never let an object reach the string (React #31 territory). */
function asPlain(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.slice(0, 60);
  if (typeof v === "object") return String(v.th || v.en || v.zh || "").slice(0, 60);
  return String(v).slice(0, 60);
}

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
   keyDoneMap) that haven't been extracted yet; moving them now would
   create a circular import. Move them here once gamification has its own
   module (Phase 3's use-gamification.ts unblocks this the same way
   music-engine.tsx unblocked payment.tsx's playUi earlier in this plan). ── */


/* ── learner memory (cross-session) → personalized AI + adaptive path ── */
export function readMemory() { try { return JSON.parse(localStorage.getItem("tg_memory") || "null") || { struggles: [], mastered: [], recent: [] }; } catch (e) { return { struggles: [], mastered: [], recent: [] }; } }
export function writeMemory(m) { try { localStorage.setItem("tg_memory", JSON.stringify(m)); } catch (e) {} }
export function recordMemory(label, acc) {
  if (!label) return;
  const m = readMemory();
  m.recent = [{ label, acc, t: dayKey() }, ...(m.recent || []).filter(r => r.label !== label)].slice(0, 12);
  if (acc >= 90) {
    if (!m.mastered.includes(label)) m.mastered = [label, ...m.mastered].slice(0, 12);
    m.struggles = (m.struggles || []).filter(s => s.label !== label);
  } else if (acc < 65) {
    const prev = (m.struggles || []).find(s => s.label === label);
    // keep a timestamp + count so the teacher can space-repeat reviews like a master
    m.struggles = [{ label, acc, last: Date.now(), count: ((prev && prev.count) || 0) + 1 }, ...(m.struggles || []).filter(s => s.label !== label)].slice(0, 6);
  }
  writeMemory(m);
}
// stamp the end of a voice session so next time we know how long they were away
export function touchSessionMemory() { try { const m = readMemory(); m.lastSession = Date.now(); m.sessions = (m.sessions || 0) + 1; writeMemory(m); } catch (e) {} }
export function memoryContext(lang) {
  const m = readMemory(), parts = [];
  const now = Date.now();
  const dAgo = (t) => t ? Math.max(0, Math.floor((now - t) / 86400000)) : null;
  // SPACED REPETITION: struggles not revisited for 2+ days are due for a quick review
  const due = (m.struggles || []).filter(s => s.last && (now - s.last) >= 2 * 86400000).slice(0, 3);
  if (due.length) parts.push((lang === "th" ? "⏰ ครบกำหนดทบทวน (แทรกการทบทวนสั้น ๆ ให้เขาแบบเนียน ๆ): " : lang === "zh" ? "⏰ 到复习时间（自然地带入简短回顾）：" : "⏰ Due for spaced review (weave in a quick revisit): ") + due.map(s => `${s.label} (${dAgo(s.last)}d)`).join(", "));
  if (m.struggles && m.struggles.length) parts.push((lang === "th" ? "เคยติด: " : lang === "zh" ? "曾困难: " : "Struggled with: ") + m.struggles.slice(0, 3).map(s => s.label).join(", "));
  if (m.mastered && m.mastered.length) parts.push((lang === "th" ? "ทำได้ดีแล้ว: " : lang === "zh" ? "已掌握: " : "Mastered: ") + m.mastered.slice(0, 3).join(", "));
  if (m.recent && m.recent.length) parts.push((lang === "th" ? "ฝึกล่าสุด: " : lang === "zh" ? "最近练习: " : "Recently practiced: ") + m.recent.slice(0, 2).map(r => r.label).join(", "));
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

/* ── tigamodel/student/student-model.js ──
   Student Model (spec §13) — Phase 0 is a MERGED VIEW over data the app
   already collects, not a new database: it reads the app's localStorage
   learner memory (tg_memory shape from ai-chat-context.ts), the gamification
   profile blob the caller passes in, and normalizes everything into
   TIGAStudentContext. Nothing is invented: fields the app doesn't track yet
   stay null/empty and are marked as such.

   Privacy: only aggregates + labels cross into model prompts — never raw
   conversation logs, never camera data (which P0 doesn't touch at all).
   Personality/mental-state claims are structurally impossible here: there
   are no fields for them (spec §13 prohibitions). ── */

import { validateStudentContext } from "../core/schema.js";

function readLS(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch (e) { return null; } }

/* Build the context from REAL app data.
   profile: the app's profile object (may include lang, level, stats) — optional. */
export function buildStudentContextFromApp({ studentId = "anon", profile = null, consent = null } = {}) {
  const mem = readLS("tg_memory") || {};
  const struggles = (mem.struggles || []).map(s => s.label).filter(Boolean).slice(0, 6);
  const mastered = (mem.mastered || []).slice(0, 12);
  const recent = (mem.recent || []).map(r => `${r.label} @ ${r.acc}%`).slice(0, 12);
  const sessions = mem.sessions || 0;
  const practice_habits = sessions > 0 ? {
    sessions_total: sessions,
    last_session: mem.lastSession ? new Date(mem.lastSession).toISOString() : null,
    // NOTE: minutes/day not tracked app-wide yet — stays absent (honest gap)
  } : null;

  const lang = (profile && profile.lang) || "th";
  const level = profile && typeof profile.level === "number" ? profile.level : null;

  return validateStudentContext({
    student_id: studentId,
    age_group: null, // not collected app-wide — never guessed
    experience_level: level != null ? `level-${level}` : null,
    goals: [], // not yet tracked (P1: from PianoLevelQuiz)
    strengths: mastered,
    struggles,
    mastered,
    recent,
    practice_habits,
    preferred_explanations: null, // P2: learned from outcome data
    effective_strategies: [], // P1+: outcome dataset
    ineffective_strategies: [],
    language: lang,
    consent: consent || undefined,
  });
}

/* Merge an update (e.g. after a practice session) into a context object
   without losing fields — used by the teaching loop's final step. */
export function updateContext(context, patch = {}) {
  return validateStudentContext({ ...context, ...patch, consent: { ...context.consent, ...(patch.consent || {}) } });
}

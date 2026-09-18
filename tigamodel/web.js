/* ── tigamodel/web.js ──
   Browser-side assembly of TIGA Piano Intelligence for the Model Lab and
   Phase 1 feature wiring. Lives in its own entry file (not index.js) so the
   Node smoke test and the app bundle never fight over environment-specific
   imports: this file may touch window/localStorage/the app's supabase
   client; index.js must not.

   Phase 1 note (owner approved direction): the existing-backend adapter
   reuses the app's piano-chat edge function, so the Model Lab tests the
   REAL production path (same per-feature model routing the students hit),
   with the signed-in admin's JWT — which also means ai_models config
   applies, exactly like production. ── */

import { buildPianoIntelligence } from "./index.js";
import { createExistingBackendAdapter } from "./providers/existing-backend-adapter.js";
import { createMockProvider } from "./providers/mock-provider.js";
import { registerProvider, listProviders } from "./providers/provider-interface.js";
import { createTeachingPolicy } from "./teaching/policy.js";
import { createTeachingLoop } from "./teaching/teaching-loop.js";
import { evaluateProvider, evaluateAllProviders } from "./evaluation/eval-suite.js";
import { makeTIGARequest } from "./core/schema.js";
import { createUniversitySeededKnowledgeBase } from "./knowledge/university-seed.js";
import { linkUniversityKnowledge } from "./knowledge/university-links.js";
import { seedGlobalTheory } from "./knowledge/global-theory-seed.js";
import { seedGlobalPedagogy } from "./knowledge/global-pedagogy-seed.js";
import { seedPianoCraft } from "./knowledge/piano-craft-seed.js";
import { seedTeacherCraft } from "./knowledge/teacher-craft-seed.js";
import { seedRepertoireForms } from "./knowledge/repertoire-forms-seed.js";
import { seedLearnerSkills } from "./knowledge/learner-skills-seed.js";
import { SOURCES, COVERAGE, GLOBAL_COVERAGE, listSourceIds } from "./knowledge/university-sources.js";
import { createSelfLearner } from "./learning/self-learner.js";
import { sb } from "../supabase-client";

/* Singleton per page load — the lab rebuilds providers when the session
   token changes (login/logout) via reinit(). */
let _tiga = null;

export function initTigamodelWeb() {
  _tiga = buildPianoIntelligence({
    providers: [
      { name: "mock", adapter: createMockProvider() },
    ],
    routerPolicy: { prefer_privacy: "balanced", prefer_cost: "balanced", min_quality: 0, provider_overrides: {}, fallback_provider: "mock" },
  });
  // Upgrade the KB to the university-sourced seed (Thai first, then US/RU/FR/
  // CN/JP/KR/UK — every entry carries a source actually read on 2026-09-17).
  try {
    _tiga.kb = createUniversitySeededKnowledgeBase();
    linkUniversityKnowledge(_tiga.kb);
    seedGlobalTheory(_tiga.kb);   // global music-theory facts (2026-09-17 sweep)
    seedGlobalPedagogy(_tiga.kb); // teaching methods + practice science
    seedPianoCraft(_tiga.kb);     // GROUP 1: pedal/dynamics/jazz — app-teached topics (gap audit)
    seedTeacherCraft(_tiga.kb);   // GROUP 2+3: memory/ear/stage-fright/motivation/deep-theory
    seedRepertoireForms(_tiga.kb); // gap round 2 #1/#4/#5: eras, forms, left-hand patterns
    seedLearnerSkills(_tiga.kb);   // gap round 2 #6/#7/#10: improv how-to, transpose, special populations
  } catch (e) { /* keep the base seed if anything unexpected happens */ }
  return _tiga;
}

/* Async session-aware init: registers the existing-backend adapter with the
   current JWT when a session exists. Called once by the Model Lab on mount. */
export async function ensureTigamodelWeb() {
  if (!_tiga) initTigamodelWeb();
  try {
    if (sb && sb.auth) {
      const { data } = await sb.auth.getSession();
      const token = data && data.session && data.session.access_token;
      if (token) {
        // re-register with a fresh token (adapter closes over it)
        registerProvider("existing-backend", createExistingBackendAdapter({ accessToken: token }));
      }
    }
  } catch (e) {}
  return _tiga;
}

export function getTigamodel() { return _tiga; }

/* ── Self-Learning (owner directive 2026-09-18): the model can learn from
   the owner's admin-chat teaching and reinforce strategies from practice
   outcomes — gated behind ONE master switch the owner flips in Model Lab
   (app_settings.ai_self_learn.enabled). Singleton alongside _tiga. ── */
let _learner = null;

function ensureSelfLearner() {
  if (_learner) return _learner;
  _learner = createSelfLearner({
    load: async () => {
      try {
        const r = await sb.from("app_settings").select("value").eq("key", "ai_self_learn").maybeSingle();
        return r && r.data && r.data.value ? r.data.value : null;
      } catch (e) { return null; }
    },
    save: async (snapshot) => {
      const { error } = await sb.rpc("admin_set_app_setting", { p_key: "ai_self_learn", p_value: snapshot });
      if (error) throw new Error(error.message || "save failed");
    },
  });
  return _learner;
}

export function getSelfLearner() { return ensureSelfLearner(); }
export async function isSelfLearningEnabled() { try { return await ensureSelfLearner().isEnabled(); } catch (e) { return false; } }
export async function setSelfLearningEnabled(on) { return ensureSelfLearner().setEnabled(on); }
export async function learnFromAdminTeaching(replyText) {
  try { return await ensureSelfLearner().learnFromAdmin(replyText); } catch (e) { return { learned: 0, error: String(e?.message || e) }; }
}
export async function reinforceTeachingOutcome(signal) {
  try { return await ensureSelfLearner().reinforceOutcome(signal); } catch (e) { return { applied: false }; }
}
export async function getLearnedKBContextAsync(matchText) {
  try { return await ensureSelfLearner().getLearnedKBContext(matchText); } catch (e) { return ""; }
}

/* ── P2 wiring (owner-approved direction, 2026-09-17): run the teaching loop
   on REAL practice signals from inside the app. Used by use-practice-mode's
   finishPractice() after every drill: app-native signals (accuracy, repeated
   errors, pauses, rhythm) go in, the policy selects a strategy, the KB adds
   a teach tip, and a { text, strategy_id } object comes back — all locally,
   synchronously, no network call, never throws. Returns null when anything
   is off (no singleton, no stats) so the caller can skip silently.
   (Self-learning outcome reinforcement is a SEPARATE async export —
   reinforceTeachingOutcome — called by finishPractice fire-and-forget.) ── */
export function runTeachingLoopForPractice(practiceStats, { selfReport = null } = {}) {
  try {
    if (!practiceStats) return null;
    if (!_tiga) initTigamodelWeb();
    const tiga = _tiga;
    if (!tiga || !tiga.loop) return null;
    return tiga.loop.runOnce({ practiceStats, selfReport });
  } catch (e) { return null; }
}

/* The strategy_id from the loop, in the UI's three languages — rendered by
   PracticeOverlay's result card so the learner sees WHICH teaching move the
   model chose, not just its text. Kept here (not in i18n.ts) because it is
   tigamodel's vocabulary, not the piano app's. */
export const TIGA_STRATEGY_LABELS = {
  "simplify-on-confusion": { th: "🧩 ลดความซับซ้อน — แบ่งท่อนใหม่", en: "🧩 Simplify — break it into chunks", zh: "🧩 降低难度 — 分段练习" },
  "return-to-prerequisite": { th: "↩️ กลับไปพื้นฐานก่อน", en: "↩️ Back to the prerequisite", zh: "↩️ 回到基础练习" },
  "ease-off-on-low-engagement": { th: "🌙 ผ่อนความเข้ม วันนี้สั้นพอ", en: "🌙 Ease off — keep today short", zh: "🌙 放松强度 — 今天短练即可" },
  "raise-challenge": { th: "🚀 เพิ่มความท้าทายให้", en: "🚀 Raise the challenge", zh: "🚀 增加挑战" },
  "simplify-on-hard-report": { th: "🧩 ช้าลงแล้วแบ่งท่อน", en: "🧩 Slow down and isolate", zh: "🧩 减速分段" },
  "continue-current-plan": { th: "✅ ทำต่อตามแผนเดิมได้", en: "✅ Continue the current plan", zh: "✅ 按原计划继续" },
};
export function tigaStrategyLabel(id, lang) {
  const t = TIGA_STRATEGY_LABELS[id];
  return t ? (t[lang] || t.en) : null;
}

/* University knowledge source registry (for the Model Lab's ความรู้ tab). */
export function getUniversitySources() { return { sources: SOURCES, coverage: COVERAGE, globalCoverage: GLOBAL_COVERAGE, ids: listSourceIds() }; }

/* ── KB → student-facing teacher prompt (GROUP 4.1 of the owner's gap
   audit 2026-09-17; retrieval refinement is gap round 2, item #2). The KB
   seeds are static per page load, so the per-entry index is built once and
   cached; per MESSAGE the caller passes the student's text and only the
   entries whose keywords/domain match are rendered — asking about pedal no
   longer ships the jazz block. No match at all → a small always-useful
   core (motivation/planning) instead of nothing. ── */
let _kbIndex = null;
const KB_DOMAIN_LABEL = {
  pedal: "PEDAL", expression: "EXPRESSION", technique: "TECHNIQUE",
  jazz: "JAZZ", "ear-training": "EAR TRAINING", memorization: "MEMORIZATION",
  "practice-planning": "PRACTICE PLANS", performance: "PERFORMANCE",
  motivation: "MOTIVATION", culture: "THAI MUSIC", rhythm: "RHYTHM",
  theory: "THEORY", harmony: "HARMONY", repertoire: "REPERTOIRE",
  form: "FORM", accompaniment: "ACCOMPANIMENT", improvisation: "IMPROVISATION",
  "learner-differences": "LEARNER DIFFERENCES",
};
const KB_DOMAIN_KEYWORDS = {
  pedal: ["pedal", "แป้น", "เหยียบ", "sustain", "sostenuto", "una corda"],
  expression: ["dynamic", "crescendo", "ดัง", "เบา", "rubato", "expression", "แสดงออก", "cresc", "sfz", "เน้นเสียง"],
  technique: ["ท่า", "นั่ง", "ศอก", "ไหล่", "ข้อมือ", "นิ้ว", "posture", "hand position", "เจ็บ", "เมื่อย", "tension", "technique", "curved"],
  jazz: ["jazz", "blues", "swing", "comping", "voicing", "บลูส์", "แจ๊ส", "12-bar", "riff"],
  "ear-training": ["ฟัง", "หู", "ear", "interval", "คู่เสียง", "dictation", "แยกเสียง"],
  memorization: ["จำ", "ท่องจำ", "memoriz", "ลืม", "memory"],
  "practice-planning": ["ซ้อม", "practice", "แผน", "กี่นาที", "นาที", "ตาราง", "ฝึก", "plan", "วันละ"],
  performance: ["ขึ้นเล่น", "เวที", "ใจสั่น", "ประหม่า", "stage", "anxiety", "ประกวด", "การแสดง"],
  motivation: ["เบื่อ", "เลิก", "ท้อ", "แรงใจ", "motivat", "รางวัล", "แต้ม", "ชม", "streak", "อยากเล่น"],
  culture: ["เพลงไทย", "ลูกทุ่ง", "หมอลำ", "thai music", "ขิม", "จะเข้"],
  rhythm: ["จังหวะ", "rhythm", "beat", "note value", "ครึ่งจังหวะ", "crotchet", "quaver", "โน้ตตัว"],
  theory: ["ทฤษฎี", "theory", "บันไดเสียง", "scale", "mode", "คู่เสียง", "interval", "key", "คีย์", "เซมิโทน", "solfege", "transpose", "ย้ายคีย์"],
  harmony: ["คอร์ด", "chord", "harmony", "inversion", "voice leading", "modulation", "เปลี่ยนคีย์", "cadence", "7th", "slash", "tension"],
  repertoire: ["เพลงคลาสสิก", "ยุค", "baroque", "คลาสสิก", "โรแมนติก", "bach", "mozart", "beethoven", "chopin", "ผู้แต่ง", "composer"],
  form: ["ฟอร์ม", "form", "ABA", "rondo", "โซนาต", "sonatina", "sonata", "variation", "โครงเพลง"],
  accompaniment: ["ประกอบ", "มือซ้าย", "left hand", "alberti", "ostinato", "เบส", "bass", "arpeggio", "บล็อกคอร์ด", "accomp"],
  improvisation: ["ด้นสด", "improvis", "แต่งเพลง", "แต่งสด"],
  "learner-differences": ["adhd", "สมาธิ", "เด็ก", "ลูก", "มือเล็ก", "ยืดไม่ถึง", "ผู้สูง", "พิเศษ", "hyperfocus", "child"],
};

function buildKbIndex(tiga) {
  const byDomain = new Map();
  for (const e of (tiga.kb ? tiga.kb._entries.values() : [])) {
    if (!e.teach || !KB_DOMAIN_LABEL[e.domain]) continue;
    if (!byDomain.has(e.domain)) byDomain.set(e.domain, []);
    byDomain.get(e.domain).push(e);
  }
  return byDomain;
}

export function getKBContext(matchText) {
  try {
    // sync init — ensureTigamodelWeb() is async and would return a Promise here
    if (!_tiga) initTigamodelWeb();
    const tiga = _tiga;
    if (!tiga || !tiga.kb) return "";
    if (!_kbIndex) _kbIndex = buildKbIndex(tiga);
    if (!_kbIndex.size) return "";

    const text = String(matchText || "").toLowerCase();
    let domains = [];
    if (text) {
      for (const [d, kws] of Object.entries(KB_DOMAIN_KEYWORDS)) {
        if (kws.some(k => text.includes(k))) domains.push(d);
      }
    }
    // no topical hit → serve a small always-relevant core, not the whole KB
    if (!domains.length) domains = ["motivation", "practice-planning"];
    const top = domains.slice(0, 4); // cap: at most 4 domains per message

    const lines = [];
    for (const d of top) {
      const label = KB_DOMAIN_LABEL[d];
      for (const e of (_kbIndex.get(d) || [])) {
        lines.push(`• [${label}] ${e.title} — วิธีสอน: ${e.teach}`);
      }
    }
    if (!lines.length) {
      // switch-gated learned knowledge still injects even without a topical
      // seed hit — fire-and-forget cache warm (async fn, safe to ignore)
      if (_learner) _learner.getLearnedKBContext(matchText).catch(() => {});
      return "";
    }
    return (
      "\n\n[TIGA KNOWLEDGE BASE — curated teaching knowledge with sources. Use these when relevant; follow the วิธีสอน (how to teach) guidance. Do not contradict them.]\n" +
      lines.join("\n") + "\n"
    );
  } catch (e) { return ""; }
}

/* Learned-knowledge injection for callers that CAN await (use-chat / admin
   chat build their system prompt asynchronously anyway). Returns the static
   KB slice + the switch-gated learned block in one string, so production
   surfaces only ever call this. Empty when nothing matches / switch OFF. */
export async function getFullKBContext(matchText) {
  const base = getKBContext(matchText);
  let learned = "";
  try { if (_learner) learned = await _learner.getLearnedKBContext(matchText); } catch (e) { /* off or error → skip */ }
  return base + learned;
}

/* ── Lab/Backoffice local stores ──
   Chat sessions and eval runs from the admin's testing persist on-device
   (localStorage, same pattern as the referral code and guest profile) so the
   owner can review past model tests and compare eval scores before/after a
   model switch (spec §25: never switch on vibes). Server-side history comes
   with the teaching_outcomes migration — these stores keep the lab useful
   today without waiting on it. */
const CHAT_STORE_KEY = "tiga_lab_chat_sessions";
const EVAL_STORE_KEY = "tiga_lab_eval_runs";

function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : fallback;
  } catch (e) { return fallback; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* quota/private mode — store is best-effort */ }
}

export function loadChatSessions() { return readStore(CHAT_STORE_KEY, []); }
export function appendChatSession(session) {
  const next = [session, ...loadChatSessions()].slice(0, 50); // newest first, cap 50
  writeStore(CHAT_STORE_KEY, next);
  return next;
}
export function deleteChatSession(id) {
  writeStore(CHAT_STORE_KEY, loadChatSessions().filter(s => s.id !== id));
  return loadChatSessions();
}
export function clearChatSessions() { writeStore(CHAT_STORE_KEY, []); }

export function loadEvalRuns() { return readStore(EVAL_STORE_KEY, []); }
export function saveEvalRun(run) {
  const next = [{ ...run, saved_at: new Date().toISOString() }, ...loadEvalRuns()].slice(0, 30);
  writeStore(EVAL_STORE_KEY, next);
  return next;
}
export function clearEvalRuns() { writeStore(EVAL_STORE_KEY, []); }

export { evaluateProvider, evaluateAllProviders, makeTIGARequest, createTeachingLoop, createTeachingPolicy };

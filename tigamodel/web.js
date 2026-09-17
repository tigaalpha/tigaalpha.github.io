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
import { SOURCES, COVERAGE, GLOBAL_COVERAGE, listSourceIds } from "./knowledge/university-sources.js";
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

/* University knowledge source registry (for the Model Lab's ความรู้ tab). */
export function getUniversitySources() { return { sources: SOURCES, coverage: COVERAGE, globalCoverage: GLOBAL_COVERAGE, ids: listSourceIds() }; }

/* ── KB → student-facing teacher prompt (GROUP 4.1 of the owner's gap
   audit 2026-09-17: the 52+ KB entries existed but never reached the chat
   students actually use — THEORY_REF was static text only). Renders the
   KB's strongest TEACHABLE entries as a compact system-prompt block:
   topic title + the entry's own `teach` line (how to teach it), capped so
   the per-message token cost stays bounded. Cached per page load — the KB
   seeds are static this session, and rebuilding per message would allocate
   for nothing. ── */
let _kbContextCache = null;
export function getKBContext() {
  if (_kbContextCache !== null) return _kbContextCache;
  try {
    // sync init — ensureTigamodelWeb() is async and would return a Promise here
    if (!_tiga) initTigamodelWeb();
    const tiga = _tiga;
    if (!tiga || !tiga.kb) return "";
    const groups = {
      pedal: "PEDAL / เปียโนเฉพาะ",
      expression: "EXPRESSION / การแสดงออก",
      technique: "TECHNIQUE / ท่าทาง-เทคนิค",
      jazz: "JAZZ",
      "ear-training": "EAR TRAINING / ฝึกหู",
      memorization: "MEMORIZATION / การจำ",
      "practice-planning": "PRACTICE PLANS / แผนซ้อม",
      performance: "PERFORMANCE / ขึ้นเล่น",
      motivation: "MOTIVATION / แรงจูงใจ",
      culture: "THAI MUSIC / ดนตรีไทย",
      rhythm: "RHYTHM",
      theory: "THEORY+",
      harmony: "HARMONY+",
    };
    const lines = [];
    for (const e of tiga.kb._entries.values()) {
      if (!e.teach || !groups[e.domain]) continue; // only teachable, gap-domain entries
      lines.push(`• [${groups[e.domain]}] ${e.title} — วิธีสอน: ${e.teach}`);
    }
    if (!lines.length) return (_kbContextCache = "");
    return (_kbContextCache =
      "\n\n[TIGA KNOWLEDGE BASE — curated teaching knowledge with sources. Use these when relevant; follow the วิธีสอน (how to teach) guidance. Do not contradict them.]\n" +
      lines.join("\n") + "\n");
  } catch (e) { return ""; }
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

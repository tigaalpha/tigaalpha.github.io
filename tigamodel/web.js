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
import { seedMatrixExpansion } from "./knowledge/expansion-matrix.js";
import { seedDeepExpansion } from "./knowledge/expansion-deep.js";
import { seedFinalExpansion } from "./knowledge/expansion-final.js";
import { seedScaleExpansion } from "./knowledge/expansion-scale.js";
import { seedCanvasExpansion } from "./knowledge/expansion-canvas.js";
import { seedSummitExpansion } from "./knowledge/expansion-summit.js";
import { seedKnowledgeExpansion } from "./knowledge/expansion-core.js";
import { seedRepertoireExpansion } from "./knowledge/expansion-repertoire.js";
import { seedPedagogyExpansion } from "./knowledge/expansion-pedagogy.js";
import { seedPeaksExpansion } from "./knowledge/expansion-peaks.js";
import { seedLearnerWave } from "./knowledge/expansion-learner.js";
import { seedStageWave } from "./knowledge/expansion-stage.js";
import { seedMusicMarketing } from "./knowledge/music-marketing.js";   // plan v3.4 6.1
import { seedMusicBusiness } from "./knowledge/music-business.js";   // plan v3.4 6.7
import { seedMusicEducationMarket } from "./knowledge/music-education-market.js"; // plan v3.4 6.8
import { seedMusicTherapy } from "./knowledge/music-therapy.js";     // plan v3.4 11.1 (wellbeing frame)
import { seedMusicInnovation } from "./knowledge/music-innovation.js"; // plan v3.5 6.13 (music innovation — owner pillar 5)
import { seedMusicInnovationAI } from "./knowledge/music-innovation-ai.js"; // v3.5 6.13 ระลอกขยาย: AI in music (owner directive 2026-09-30)
import { seedGlobalCoverageWave } from "./knowledge/global-coverage-wave.js"; // docs/16 §3 (m52): marketing/innovation/therapy world wave
import { nextSongAdvice, longTermValueSection, careerPathwayReply, calmModeIntro, isoSongPick, therapyDisclaimer } from "./teaching/knowledge-surfaces.js"; // v3.4 6.3/6.4/6.9/6.10/11.2-11.4
import { seedStageTwoWave } from "./knowledge/expansion-stage2.js";
import { buildStudentContextFromApp } from "./student/student-model.js";
import { createCapabilityEngine } from "./teaching/capability-engine.js";
import { generateExercise, generateSheet } from "./teaching/generator.js";
import { createUnifiedPlan } from "./roadmap-unified.js";
import { buildCoachContextBlock, practiceTimeBudget, buildDiagnosis, buildStudentSnapshot } from "./coach/diagnosis.js";
import { SOURCES, COVERAGE, GLOBAL_COVERAGE, listSourceIds } from "./knowledge/university-sources.js";
import { auditKB as _auditKB } from "./compliance/kb-compliance.js";
import { createSelfLearner } from "./learning/self-learner.js";
import { sharedSkillGraph } from "./teaching/skill-graph.js";
import { createCoach } from "./teaching/coach.js";
import { plmItem, plmParse, plmRank, plmSample, plmStats, PLM_TOTAL, PLM_DIMENSIONS } from "./roadmap-1m.js";
import { evaluateProviderExtended, evaluateAllProvidersExtended, regressionVerdict, rubricReply, EXTENDED_PROBES, THEORY_FACTS, GOLDEN_SITUATIONS } from "./evaluation/eval-expanded.js";
import { sb } from "../supabase-client";
import { createJevJudgment } from "./jev/jev-judgment.js";

/* Singleton per page load — the lab rebuilds providers when the session
   token changes (login/logout) via reinit(). */
let _tiga = null;

/* docs/10 §1.1 (m32): answer cache — remembers ONLY verified provider answers
   (status ok + confidence floor) with full provenance; key includes history so
   different conversations never share answers. DEFAULT OFF (kill switch inside
   the module; enabling is an admin/app_settings decision) — when off, both
   storing and serving are dead code paths, so today's behaviour is unchanged. */
import { createAnswerCache as _createAnswerCache, answerCacheKey as _answerCacheKey, chatThroughCache as _chatThroughCache } from "./performance/answer-cache.js";
/* docs/10 §1.3 (m34): KB hot path — relevance-ranked, hard-capped KB serving
   (selection only; content and the line template never change). Singleton
   like the answer cache, DEFAULT OFF — when off, getKBContext serves the
   legacy block byte-identically. */
import { createKBHotPath as _createKBHotPath, KB_HOT_PATH_SWITCH } from "./performance/kb-hot-path.js";
/* docs/05 §8 / docs/15 §2 (m13/m22): cost governor — a per-session weighted
   ledger that decides BEFORE each provider call; throttled sessions degrade
   to an honest uncertain response (never an invented answer). Singleton
   like the answer cache, DEFAULT OFF — off = every decision allows, the
   shipped path unchanged. */
import { createCostGovernor as _createCostGovernor, chargeForCall as _chargeForCall, COST_GOVERNOR_SWITCH } from "./performance/cost-governor.js";
import { createProviderBudget as _createProviderBudget, kbFallbackResponse as _kbFallbackResponse, PROVIDER_BUDGET_SWITCH } from "./performance/provider-budget.js";
/* docs/16 §2 (m50): the model's accuracy audit as data — the CI scorecard's
   numbers, computable in the browser from these REAL modules so TIGA MODEL
   LAB renders them live and admins can re-run after any model change. */
import { runModelAccuracyAudit as _runModelAccuracyAudit, loadAccuracyHistory as _loadAccHistory, saveAccuracyRun as _saveAccRun, clearAccuracyHistory as _clearAccHistory } from "./evaluation/lab-accuracy.js";
let _answerCache = null;
export function answerCache() {
  if (!_answerCache) _answerCache = _createAnswerCache({ enabled: false }); // OFF until switched on
  return _answerCache;
}
export function setAnswerCacheEnabled(on, opts = {}) {
  const c = answerCache();
  c.setEnabled(on === true);
  return c.isEnabled();
}
export function newAnswerCache(opts) { return _createAnswerCache(opts || {}); }
export function answerCacheKeyFor(args) { return _answerCacheKey(args || {}); }

let _costGovernor = null;
export function costGovernor() {
  if (!_costGovernor) _costGovernor = _createCostGovernor({ enabled: false }); // OFF until switched on
  return _costGovernor;
}
export function setCostGovernorEnabled(on) {
  const g = costGovernor();
  g.setEnabled(on === true);
  return g.isEnabled();
}
/* Chat with the cost governor honored (off → identical to chat()). Decides
   BEFORE the call using the caller's estimate (default 1 weighted unit);
   after an allowed call, books the REAL weighted charge from the answering
   provider's declared() cost tier. A throttle serves the honest governed
   fallback — never an invented answer. */
export async function chatThroughCostGovernor(args) {
  const { message = "", sessionKey = null, preferFree = false, estimatedUnits = null, ...rest } = args || {};
  try {
    const g = costGovernor();
    const tiga = getTigamodel();
    if (!g.isEnabled() || !sessionKey) {
      return { ...(await tiga.chat({ message, ...rest })), governed: false };
    }
    const est = Number.isFinite(estimatedUnits) && estimatedUnits >= 0 ? estimatedUnits : 1;
    const d = g.decide(sessionKey, est, { preferFree: preferFree === true });
    if (d.decision === "throttle") {
      return { response: g.governedResponse({ reason: d.reason, spent: d.spent, freeQuota: d.freeQuota }), routed: { selected_provider: "cost-governor", reason: d.reason, attempts: [] }, request: null, governed: true };
    }
    const out = await tiga.chat({ message, ...rest, routing: (d && d.warn) ? { preferCost: "free-first" } : {} });
    const answeredBy = out && out.response && out.response.provider;
    const declared = answeredBy && tiga.providers.get(answeredBy);
    const declaredCost = declared && declared.declare ? declared.declare().cost : null;
    g.charge(sessionKey, _chargeForCall(answeredBy, declaredCost));
    return { ...out, governed: true };
  } catch (e) { return null; }
}
/* ── m47 (docs/15 §2): the cost governor's kill switch (app_settings), the REAL
   per-learner session key, and the honest declared cost of one chat call.
   Same shape as the m44 hot-path switch on purpose: read at most once a
   minute, fail CLOSED (no row / error → OFF), written through the same admin
   RPC, and OFF means the caller's path is byte-for-byte the old one. ── */
const CG_SWITCH_TTL_MS = 60000;
let _cgSwitchAt = 0;
let _cgSwitchBusy = null;
export function refreshCostGovernorSwitch({ force = false } = {}) {
  if (!force && _cgSwitchAt && Date.now() - _cgSwitchAt < CG_SWITCH_TTL_MS) return Promise.resolve(costGovernor().isEnabled());
  if (_cgSwitchBusy) return _cgSwitchBusy;
  _cgSwitchBusy = (async () => {
    let on = false;
    try {
      const r = sb ? await sb.from("app_settings").select("value").eq("key", COST_GOVERNOR_SWITCH).maybeSingle() : null;
      on = !!(r && r.data && r.data.value && r.data.value.enabled === true);
    } catch (e) { on = false; }
    setCostGovernorEnabled(on);
    _cgSwitchAt = Date.now();
    _cgSwitchBusy = null;
    return on;
  })();
  return _cgSwitchBusy;
}
export async function setCostGovernorSwitch(on) {
  const { error } = await sb.rpc("admin_set_app_setting", { p_key: COST_GOVERNOR_SWITCH, p_value: { enabled: on === true } });
  if (error) throw new Error(error.message || "save failed");
  setCostGovernorEnabled(on === true);
  _cgSwitchAt = Date.now();
  return costGovernor().isEnabled();
}
export async function isCostGovernorSwitchOn() { return refreshCostGovernorSwitch({ force: true }); }

/* The REAL session key: the signed-in user when we know it, else a per-device
   guest id — bucketed by calendar day so the free ceiling is a DAILY budget
   (docs/05 §8: 40 free questions), never an all-time one. Nothing invented:
   same key all day for the same learner, different for the next one. */
const CG_GUEST_KEY = "tiga_cost_governor_guest";
let _cgUserId = null;
export function setCostGovernorUserId(id) { _cgUserId = id ? String(id) : null; }
export async function refreshCostGovernorUser() {
  try {
    if (sb && sb.auth) {
      const { data } = await sb.auth.getSession();
      const uid = data && data.session && data.session.user && data.session.user.id;
      if (uid) { _cgUserId = String(uid); return _cgUserId; }
      _cgUserId = null; // signed out: the budget must NOT stay attached to the last account
    }
  } catch (e) { /* a blip must not wipe a good id — keep the cache */ }
  return _cgUserId;
}
export function costGovernorSessionKey(day = null) {
  let who = _cgUserId;
  if (!who) {
    try {
      who = localStorage.getItem(CG_GUEST_KEY);
      if (!who) {
        who = `guest-${(typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(CG_GUEST_KEY, who);
      }
    } catch (e) { who = "guest-anon"; }
  }
  const d = day || new Date().toISOString().slice(0, 10);
  return `cg:${who}:${d}`;
}

/* The honest declared cost of ONE chat call, read from the SAME app_settings
   row the edge function reads (ai_models → the "chat" feature) — so the ledger
   books what the backend is actually configured to call, with no redeploy and
   no guessing. Unknown provider/model NEVER rides free (chargeForCall's rule):
   it is charged like "low". The shipped chat default IS the openrouter free
   ladder, which the model ids name with ":free". */
let _cgAiModels = null;
let _cgAiAt = 0;
export async function refreshChatDeclaredCost({ force = false } = {}) {
  if (!force && _cgAiAt && Date.now() - _cgAiAt < CG_SWITCH_TTL_MS) return chatDeclaredCostTier();
  try {
    const r = sb ? await sb.from("app_settings").select("value").eq("key", "ai_models").maybeSingle() : null;
    _cgAiModels = r && r.data && r.data.value && typeof r.data.value === "object" ? r.data.value : null;
  } catch (e) { _cgAiModels = null; }
  _cgAiAt = Date.now();
  return chatDeclaredCostTier();
}
export function chatDeclaredCostTier(feature = "chat") {
  try {
    const row = _cgAiModels;
    const m = row && row[feature] ? row[feature] : (row && row["default"] ? row["default"] : null);
    const provider = String((m && m.provider) || "").toLowerCase();
    const model = String((m && m.model) || "").toLowerCase();
    if (!provider && !model) return "free"; // nothing configured = the shipped free ladder
    if (/:free\b/.test(model) || model === "openrouter/free" || model.endsWith("/free")) return "free";
    if (provider === "gemini") return /flash/.test(model) ? "low" : "medium";
    if (provider === "anthropic") return "medium";
    return "low"; // unknown → never free
  } catch (e) { return "low"; }
}

/* The gate the REAL chat asks BEFORE the edge call. Switch OFF or no key →
   { governed: false } and the caller takes the untouched path. Throttled →
   an honest uncertain response (never an invented answer) plus the reason. */
export async function chatGovernanceGate({ sessionKey = null, estimatedUnits = 1, message = "" } = {}) {
  try { await Promise.race([refreshCostGovernorSwitch(), new Promise(r => setTimeout(r, 400))]); } catch (e) { /* fail closed: keep current state */ }
  const g = costGovernor();
  let key = sessionKey;
  if (!key) { await refreshCostGovernorUser(); key = costGovernorSessionKey(); }
  if (!g.isEnabled() || !key) return { governed: false, throttled: false, reason: g.isEnabled() ? "no_session_key" : "switch_off", sessionKey: key };
  const est = Number.isFinite(estimatedUnits) && estimatedUnits >= 0 ? estimatedUnits : 1;
  const d = g.decide(key, est);
  if (d.decision === "throttle") {
    return { governed: true, throttled: true, reason: d.reason, spent: d.spent, freeQuota: d.freeQuota, sessionKey: key, response: g.governedResponse({ reason: d.reason, spent: d.spent, freeQuota: d.freeQuota }) };
  }
  return { governed: true, throttled: false, reason: d.reason, spent: d.spent, freeQuota: d.freeQuota, warn: d.warn === true, sessionKey: key, response: null };
}

/* Book the REAL weighted cost AFTER an allowed, real answer (one call = the
   declared tier above). OFF switch → no-op, ledger stays empty. */
export function chargeGovernedChat(sessionKey = null) {
  try {
    const g = costGovernor();
    const key = sessionKey || costGovernorSessionKey();
    if (!g.isEnabled() || !key) return false;
    g.charge(key, _chargeForCall("chat", chatDeclaredCostTier()));
    return true;
  } catch (e) { return false; }
}

/* ── m35 (docs/15 §4): short routing — a small measured request may skip the
   big-model queue for a provider that DECLARED itself fast/free. The switch
   lives on the router (policy.short_routing) and defaults OFF; the reader here
   is the same fail-closed, 60s-cached convention as every other switch, and
   the size signal is counted characters, never a guess. ── */
const SR_SWITCH = "tiga_short_routing";
let _srAt = 0;
let _srBusy = null;
let _srOn = false;
function applyShortRouting(on) {
  _srOn = on === true;
  try { const t = getTigamodel(); if (t && t.router && t.router.setShortRouting) t.router.setShortRouting(_srOn); } catch (e) {}
  return _srOn;
}
export function refreshShortRoutingSwitch({ force = false } = {}) {
  if (!force && _srAt && Date.now() - _srAt < 60000) return Promise.resolve(_srOn);
  if (_srBusy) return _srBusy;
  _srBusy = (async () => {
    let on = false;
    try {
      const r = sb ? await sb.from("app_settings").select("value").eq("key", SR_SWITCH).maybeSingle() : null;
      on = !!(r && r.data && r.data.value && r.data.value.enabled === true);
    } catch (e) { on = false; }
    applyShortRouting(on);
    _srAt = Date.now();
    _srBusy = null;
    return _srOn;
  })();
  return _srBusy;
}
export async function setShortRoutingSwitch(on) {
  const { error } = await sb.rpc("admin_set_app_setting", { p_key: SR_SWITCH, p_value: { enabled: on === true } });
  if (error) throw new Error(error.message || "save failed");
  _srAt = Date.now();
  return applyShortRouting(on === true);
}
export async function isShortRoutingSwitchOn() { return refreshShortRoutingSwitch({ force: true }); }
/* what the owner sees next to the switch: the REAL threshold the router uses,
   read from the router's own policy — never a number typed into a label. */
export function shortRoutingConfig() {
  let policy = {};
  try { const t = getTigamodel(); if (t && t.router && t.router.policy) policy = t.router.policy; } catch (e) {}
  return { on: _srOn, smallChars: Number.isFinite(policy.small_chars) && policy.small_chars > 0 ? Math.floor(policy.small_chars) : 1500 };
}

/* ── m48 (docs/15 §4): a real deadline per provider call, and when it is
   missed the learner gets the app's own VERIFIED knowledge (the same KB lines
   the chat already built, with their labels) instead of an error bubble or a
   stall. Switch OFF (default) → the chat's old path, untouched: the fallback is
   never even built. The answer is honest about what it is: provider
   "rule-brain", status "uncertain", sources listed. ── */
let _providerBudget = null;
export function providerBudget() {
  if (!_providerBudget) _providerBudget = _createProviderBudget({ enabled: false }); // OFF until switched on
  return _providerBudget;
}
export function setProviderBudgetEnabled(on) {
  providerBudget().setEnabled(on === true);
  return providerBudget().isEnabled();
}
const PB_SWITCH_TTL_MS = 60000;
let _pbSwitchAt = 0;
let _pbSwitchBusy = null;
export function refreshProviderBudgetSwitch({ force = false } = {}) {
  if (!force && _pbSwitchAt && Date.now() - _pbSwitchAt < PB_SWITCH_TTL_MS) return Promise.resolve(providerBudget().isEnabled());
  if (_pbSwitchBusy) return _pbSwitchBusy;
  _pbSwitchBusy = (async () => {
    let on = false;
    try {
      const r = sb ? await sb.from("app_settings").select("value").eq("key", PROVIDER_BUDGET_SWITCH).maybeSingle() : null;
      on = !!(r && r.data && r.data.value && r.data.value.enabled === true);
    } catch (e) { on = false; }
    setProviderBudgetEnabled(on);
    _pbSwitchAt = Date.now();
    _pbSwitchBusy = null;
    return on;
  })();
  return _pbSwitchBusy;
}
export async function setProviderBudgetSwitch(on) {
  const { error } = await sb.rpc("admin_set_app_setting", { p_key: PROVIDER_BUDGET_SWITCH, p_value: { enabled: on === true } });
  if (error) throw new Error(error.message || "save failed");
  setProviderBudgetEnabled(on === true);
  _pbSwitchAt = Date.now();
  return providerBudget().isEnabled();
}
export async function isProviderBudgetSwitchOn() { return refreshProviderBudgetSwitch({ force: true }); }

/* The honest fallback for THIS question, or null when the switch is off / the
   KB has nothing real for it (the caller then keeps its own error). */
export function kbFallbackFor(question, lang = "th") {
  try {
    if (!providerBudget().isEnabled()) return null;
    return _kbFallbackResponse({ block: getKBContext(question), lang, budgetMs: providerBudget().config.hardMs, maxLines: providerBudget().config.maxLines });
  } catch (e) { return null; }
}

/* Chat with the answer cache honored (off → identical to chat()). Returns
   { response, routed, request, cache_hit, cache_provenance? }. */
export async function chatThroughAnswerCache(args) {
  try { return await _chatThroughCache({ tiga: getTigamodel(), cache: answerCache(), ...(args || {}) }); }
  catch (e) { return null; }
}

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
    // 10,000-item knowledge expansion (owner directive 2026-09-18): computed
    // music-theory grid — every entry real & verifiable, zero filler.
    seedMatrixExpansion(_tiga.kb);
    seedDeepExpansion(_tiga.kb);
    seedFinalExpansion(_tiga.kb);
    seedScaleExpansion(_tiga.kb);
    seedCanvasExpansion(_tiga.kb);
    seedSummitExpansion(_tiga.kb);
    seedKnowledgeExpansion(_tiga.kb);
    seedRepertoireExpansion(_tiga.kb);
    seedPedagogyExpansion(_tiga.kb);
    seedPeaksExpansion(_tiga.kb);
    // learner wave (owner directive "ใช้ได้จริงๆ"): memory/ear/sight-reading/
    // special-populations/Thai-keyboard/plans/motivation — the knowledge the
    // production chat teacher actually adapts with.
    seedLearnerWave(_tiga.kb);
    // stage & craft wave: deepens performance/improv/accompaniment (capability
    // engine flagged these as the thinnest real domains)
    seedStageWave(_tiga.kb);
    seedStageTwoWave(_tiga.kb); // completes performance-domain depth (T8 kb=1.0)
    seedMusicMarketing(_tiga.kb);      // v3.4 6.1: hook-first · audience · sequencing · arrangement · positioning
    seedMusicBusiness(_tiga.kb);       // v3.4 6.7: streaming · rights · sync · live · brand/career
    seedMusicEducationMarket(_tiga.kb);// v3.4 6.8: lifecycle · parents · churn · grade structure
    seedMusicTherapy(_tiga.kb);        // v3.4 11.1: wellbeing-frame therapy principles (no medical claims)
    seedMusicInnovation(_tiga.kb);     // v3.5 6.13: piano genesis · recording · notation · pedagogy innovation (owner pillar 5)
    seedMusicInnovationAI(_tiga.kb);   // v3.5 6.13 expansion: AI in the music industry + AI piano pedagogy (owner directive)
    seedGlobalCoverageWave(_tiga.kb);  // docs/16 §3 (m52): owner coverage directive — marketing/innovation/therapy world-craft wave (legal tiga-* sources, wellbeing frame)
  } catch (e) { /* keep the base seed if anything unexpected happens */ }
  // Reasoning layer (roadmap #62/#73/#75/#78): skill graph + coach (hint
  // ladder, adaptive tempo, recap) — pure, sync, no model call. Attached to
  // the singleton AND used to rebuild the loop so prerequisite suggestions
  // work inside runTeachingLoopForPractice.
  try {
    const sg = sharedSkillGraph();
    _tiga.skillGraph = sg;
    _tiga.coach = createCoach({ skillGraph: sg });
    _tiga.loop = createTeachingLoop({
      policy: _tiga.policy, kb: _tiga.kb, skillGraph: sg,
      // docs/05 §5 (m20): Jev decides only genuine policy ties; the kill
      // switch (app_settings.tiga_jev_policy) defaults OFF — missing row,
      // error, or disabled → the shipped first-match behaviour, unchanged.
      // The switch is cached for 60s: a practice-finish must never wait on
      // a settings round-trip, and OFF must cost exactly zero network calls.
      jev: jevJudgment,
      isJevPolicyEnabled: (() => {
        let cacheV = null, cacheAt = 0;
        return async () => {
          if (cacheV !== null && Date.now() - cacheAt < 60000) return cacheV;
          try {
            const r = await sb.from("app_settings").select("value").eq("key", "tiga_jev_policy").maybeSingle();
            cacheV = !!(r && r.data && r.data.value && r.data.value.enabled === true);
          } catch (e) { cacheV = false; }
          cacheAt = Date.now();
          return cacheV;
        };
      })(),
    });
  } catch (e) { /* reasoning layer is an enhancement, never a failure path */ }
  return _tiga;
}

/* Direct accessors for surfaces that only need the reasoning layer (Model
   Lab coach tab) without the full tiga instance. */
export function getSkillGraph() {
  if (!_tiga) initTigamodelWeb();
  return _tiga && _tiga.skillGraph ? _tiga.skillGraph : sharedSkillGraph();
}
export function getCoach() {
  if (!_tiga) initTigamodelWeb();
  return _tiga && _tiga.coach ? _tiga.coach : createCoach({ skillGraph: sharedSkillGraph() });
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

/* ── Capability engine (owner directive: แผน 1M 13% → 100%): scores every
   t×m×s route across kb/reasoning/surface/measure/evolve from REAL module
   state — the honest successor to module-route coverage. The KB index is
   injected from the real seeded KB so depth numbers are live. ── */
let _capEngine = null;
function kbEntriesIndex(kb) {
  const idx = new Map();
  if (!kb || !kb._entries) return idx;
  for (const [, e] of kb._entries) {
    if (!idx.has(e.domain)) idx.set(e.domain, []);
    idx.get(e.domain).push(e);
  }
  return idx;
}
export function getCapabilityEngine() {
  if (!_capEngine) {
    const tiga = _tiga || initTigamodelWeb();
    _capEngine = createCapabilityEngine({ kbEntries: kbEntriesIndex(tiga && tiga.kb) });
  }
  return _capEngine;
}

/* plan v3 1.6: the TIGA Bench script re-seeds its bundle per run (fresh KB
   state each time), so a memoized sweep from a previous session must not
   leak across runs — the bench calls this once at startup. Production never
   needs it: reinforceTeachingOutcome already invalidates after KB changes. */
/* plan v3.4: read-only KB access for smoke/bench (same pattern as the test
   reset hooks — never used by the app runtime) */
/* plan v3.4 product surfaces — KB-grounded, trilingual, honest-null; exported
   so the app reaches them through the same lazy gateway as everything else */
export function tigaNextSongAdvice(memory, lang) { try { return nextSongAdvice(getKnowledgeBaseForTest(), memory, lang); } catch (e) { return null; } }
export function tigaLongTermValueSection(rep, lang) { try { return longTermValueSection(getKnowledgeBaseForTest(), rep, lang); } catch (e) { return null; } }
export function tigaCareerPathwayReply(question, lang) { try { return careerPathwayReply(getKnowledgeBaseForTest(), question, lang); } catch (e) { return null; } }
export function tigaCalmModeIntro(lang) { try { return calmModeIntro(getKnowledgeBaseForTest(), lang); } catch (e) { return null; } }
export function tigaIsoSongPick(mood, candidates, lang) { try { return isoSongPick(getKnowledgeBaseForTest(), mood, candidates, lang); } catch (e) { return null; } }
export function tigaTherapyDisclaimer(lang) { try { return therapyDisclaimer(getKnowledgeBaseForTest(), lang); } catch (e) { return null; } }

export function getKnowledgeBaseForTest() {
  if (!_tiga) initTigamodelWeb();
  return _tiga && _tiga.kb ? _tiga.kb : null;
}

export function resetCapabilityEngineForTest() {
  try { getCapabilityEngine().invalidateCapabilityCache(); } catch (e) {}
}
/* bench/test hook (never used by the app runtime — same contract as the other
   *ForTest hooks): drops the whole model instance so a fresh import re-seeds
   the 17k-entry KB and a cold kbProbe measures the REAL first-answer cost. */
export function __resetTigaForTest() {
  try { _tiga = null; _capEngine = null; } catch (e) {}
}
export function capabilitySummary() { return getCapabilityEngine().summary(); }
export function capabilityWorklist(limit = 50) { return getCapabilityEngine().worklist(limit); }

/* ── plan v3.8 ระลอก 13 (13.1) — per-pillar readiness: the bench's
   "weakest ขอมุม 5 ขุม" bar and the Lab's pillar card both read through
   here, so every surface reports the SAME numbers from the SAME engine. ── */
export function capabilityPillars() { try { return getCapabilityEngine().pillars(); } catch (e) { return []; } }
export function capabilityPillarProbe(domain) { try { return getCapabilityEngine().pillarProbe(domain); } catch (e) { return null; } }

/* ── plan v3 ระลอก 7 (7.1/7.2) — LEARNER EVIDENCE. Pure aggregator over the
   REAL closed-loop rows (tg_atip_outcomes, use-autoteach.ts): per-strategy
   before/after accuracy, n<30 = "หลักฐานไม่พอ", no rows = null. The caller
   passes its own rows — the app reads localStorage, the smokes craft their
   own — one pure path for every surface (Lab scoreboard 7.2, later 7.3). ── */
import { strategyEvidence as _strategyEvidence, STRATEGY_EVIDENCE_MIN_N as _EV_MIN_N } from "./teaching/evidence.js";
export const STRATEGY_EVIDENCE_MIN = _EV_MIN_N;
export function strategyEvidenceFromRows(rows) { try { return _strategyEvidence(rows); } catch (e) { return null; } }
export function learnerEvidenceNow() {
  try {
    let rows = [];
    if (typeof localStorage !== "undefined") rows = JSON.parse(localStorage.getItem("tg_atip_outcomes") || "[]") || [];
    return _strategyEvidence(rows);
  } catch (e) { return null; }
}

/* ── Exercise generation (capability "gen"): real KB-backed exercises from
   computed data — deterministic per seed, level 1-5, every topic. ── */
export function generateStudentExercise(topic, level, seed) {
  try { return generateExercise(topic, level, seed); } catch (e) { return null; }
}
export function generateStudentSheet(level, seed) {
  try { return generateSheet(level, seed); } catch (e) { return null; }
}

/* The 10 real exercise topics the generator can build (Phase 2 Practice
   Coach needs to offer an honest "next exercise" — the topic list IS the
   generator's own topic table, not invented labels). Stable order. */
import { GENERATOR_KINDS as _GENERATOR_KINDS } from "./teaching/generator.js";
export function studentExerciseKinds() {
  try { return _GENERATOR_KINDS(); } catch (e) { return []; }
}

/* ══ PLAN v3 ระลอก 2 — W/H/Q adaptivity adapters (tigamodel/teaching/adaptivity.js) ══
   Thin pass-throughs (same pattern as the coach/plm accessors): pure, sync,
   never throw, honest identity/null when nothing applies. ageBandFromProfile
   reads the profile fields the app already keeps; no new storage, no engine
   changes — the adapters decorate AFTER the engines speak. ── */
import { ageBandFromProfile as _ageBand, forAge as _forAge, forStrategy as _forStrategy, strategyVariant as _strategyVariant, barsFor as _barsFor, QUALITY_BARS as _QUALITY_BARS } from "./teaching/adaptivity.js";
import { joyIndex as _joyIndex, joyNote as _joyNote, joyEmpty as _joyEmpty, JOY_SIGNALS as _JOY_SIGNALS, boredomRisk as _boredomRisk, BOREDOM_RISKS as _BOREDOM_RISKS, boredomResponse as _boredomResponse } from "./teaching/joy.js";
export function tigaAgeBand(profile) { try { return _ageBand(profile); } catch (e) { return null; } }
export function tigaForAge(band, content) { try { return _forAge(band, content); } catch (e) { return content; } }
export function tigaForStrategy(ex, strategyId) { try { return _forStrategy(ex, strategyId); } catch (e) { return ex; } }
export function tigaStrategyVariant(strategyId) { try { return _strategyVariant(strategyId); } catch (e) { return { variant: "standard", note: null }; } }
/* ── PLAN v3.8 ระลอก 12 (12.1) — JoyIndex v1 SHADOW (tigamodel/teaching/joy.js).
   The 10th dimension — learner joy — measured from behaviour the app already
   logs (tg_practice_log + tg_act_log + tg_stars_<id>), five explainable
   signals, trilingual, honest-null, and wired to nothing: it never changes a
   run's coins/exp/stars and steers no queue until the 12.6 data rule (30
   loop rounds) is met. Reads its own localStorage keys when called without
   arguments (mirrors getCoachDiagnosis above); the smoke passes everything
   explicitly so it never depends on a browser. ── */
export function getJoyIndex(opts) { try { return _joyIndex(opts || null); } catch (e) { return null; } }
export function joyShadowNote(lang) { try { return _joyNote(lang); } catch (e) { return null; } }
export function joyShadowEmpty(lang) { try { return _joyEmpty(lang); } catch (e) { return null; } }
export function joySignalList() { try { return _JOY_SIGNALS.map(s => ({ key: s.key, label: { th: s.label.th, en: s.label.en, zh: s.label.zh } })); } catch (e) { return []; } }

/* ── PLAN v3.8 ระลอก 12 (12.3) — BOREDOM RISK (ความเบื่อก่อนเลิกเรียน).
   Same shadow contract as the joy score: classified against the four quit
   causes the education-market KB names (6.8, edu:churn:*), counted from the
   same real logs, shown in Model Lab ONLY, honest-null when there is no
   practice at all, and never a decision input until the 12.6 data rule.
   boredomResponse(kb, risk, lang) is the 12.4 helper: the coach's calm
   reply to a high risk — every reason cites its KB id, and a null/low-data
   risk returns null = "do exactly as before". ── */
export function getBoredomRisk(opts) { try { return _boredomRisk(opts || null); } catch (e) { return null; } }
export function boredomRiskList() { try { return _BOREDOM_RISKS.map(r => ({ key: r.key, kb: r.kb, label: { th: r.label.th, en: r.label.en, zh: r.label.zh } })); } catch (e) { return []; } }
export function boredomResponseFor(kb, risk, lang) { try { return _boredomResponse(kb || (_tiga && _tiga.kb) || null, risk, lang); } catch (e) { return null; } }

export function tigaBarsFor(surface) { try { return _barsFor(surface); } catch (e) { return null; } }
export { _QUALITY_BARS as TIGA_QUALITY_BARS };

/* ══ PHASE 3 — TEACHER DASHBOARD ADVICE (spec §34) ══
   The teacher's SchoolDashboard already shows every student's SYNCED real
   state (school_roster → profiles.progress: practiceLog/gameLog/memory/
   summary). What it lacks is the TIGA layer: WHAT the teacher should DO
   about each student in the next lesson. teacherAdviceFor(pr) turns one
   student's synced progress into a pre-lesson brief, using the same engines
   the student-facing coach uses (getCoachDiagnosis builds what/why/how from
   real numbers) plus honest risk flags. EVERY field is derived from the
   student's own record — nothing guessed, null when no data. Pure + sync.

   pr = the progress snapshot shape App.tsx buildProgressSnapshot() writes:
   { practiceLog:{YYYY-MM-DD:{n,accSum}}, memory:{struggles[],mastered[],
     noteMisses[]}, summary:{games,avgAcc,pathDone}, streak:{count} } ── */
export function teacherAdviceFor(pr) {
  try {
    if (!pr || typeof pr !== "object") return null;
    const mem = pr.memory || {};
    const plog = pr.practiceLog || {};
    const sum = pr.summary || {};

    /* risk flags — each one a concrete, checkable condition */
    const now = Date.now();
    const days = (ts) => Math.floor((now - ts) / 86400000);
    const flags = [];
    let lastDayTs = null;
    for (const k of Object.keys(plog)) {
      if (k.startsWith("_")) continue;
      const ts = new Date(k + "T00:00:00").getTime();
      if (!Number.isNaN(ts) && (lastDayTs == null || ts > lastDayTs)) lastDayTs = ts;
    }
    const daysIdle = lastDayTs != null ? Math.floor((now - 86400000 * new Date().getTimezoneOffset() / 1440 - lastDayTs) / 86400000) : null;
    if (daysIdle != null && daysIdle >= 5) flags.push({ id: "idle", icon: "😴", th: `ห่างหาย ${daysIdle} วัน — ควรถามก่อนว่าติดอะไร`, en: `Away ${daysIdle} days — ask what's blocking first`, zh: `缺席 ${daysIdle} 天——先了解原因` });
    const topMiss = (mem.noteMisses || []).slice().sort((a, b) => (b.count || 0) - (a.count || 0))[0] || null;
    if (topMiss && (topMiss.count || 0) >= 3) flags.push({ id: "note", icon: "🎼", th: `โน้ต ${topMiss.label} พลาดซ้ำ ${topMiss.count} ครั้ง`, en: `Note ${topMiss.label} missed ${topMiss.count}×`, zh: `音符 ${topMiss.label} 已错 ${topMiss.count} 次` });
    const hardStruggles = (mem.struggles || []).filter(s => (s.acc || 0) < 50 && s.last && days(s.last) <= 14);
    if (hardStruggles.length > 0) flags.push({ id: "stuck", icon: "🧱", th: `ติดจริง: ${hardStruggles[0].label} (${hardStruggles[0].acc}%)`, en: `Stuck: ${hardStruggles[0].label} (${hardStruggles[0].acc}%)`, zh: `卡住：${hardStruggles[0].label}（${hardStruggles[0].acc}%）` });
    if ((sum.avgAcc || 0) >= 85 && (sum.games || 0) >= 5) flags.push({ id: "ready", icon: "🚀", positive: true, th: "เก่งขึ้นจริง — พร้อมท้าทายเพลงใหม่", en: "Ready for a new challenge piece", zh: "可以挑战新曲目" });

    /* the coach's diagnosis engine — what/why/how from real numbers
       (getCoachDiagnosis reads localStorage; here we pass the student's
       SYNCED memory directly to the underlying builder instead) */
    let focus = null;
    try {
      const d = buildDiagnosis({ memory: mem, practiceLog: plog });
      if (d) focus = { label: d.what.label, acc: d.what.acc, trend: d.what.trend, why: d.why, how: d.how, bpm: d.meta ? d.meta.bpm : null };
    } catch (e) {}

    /* lesson plan for the next session — from the real time-budget engine */
    let plan = null;
    try {
      const b = practiceTimeBudget(30, { memory: mem });
      if (b && Array.isArray(b.parts)) plan = { total: b.total, focus: b.focus || null, parts: b.parts.map(p => ({ key: p.key, minutes: p.minutes, label: p.label || null })) };
    } catch (e) {}

    return { flags, focus, plan, summary: { avgAcc: sum.avgAcc || null, games: sum.games || null, pathDone: sum.pathDone || null, daysIdle }, outcomeNote: null };
  } catch (e) { return null; }
}

/* ── plan v3.8 ระลอก 13 (13.3) — TEACHER-OUTCOME LOOP v1 (ป้อนกลับครู).
   4.4 already ships the evidence table (strategy_outcomes + the aggregate-
   only strategy_evidence RPC); THIS is the teacher's path into it —
   "ต่อเส้นทางเท่านั้น", no new table, no new RPC:

     recordTeacherOutcome(appender, { studentId, advice, oneWeekAgo })
        → the app supplies HOW to append (its own sb.rpc("submit_strategy_outcome"))
          — the model never touches the network and stays pure/sync.
          Writes ONE row per advised strategy, tagged surface="teacher"…
          WAIT — the RPC validates surface ∈ {practice, song, sight_reading,
          camera} and self_report ∈ its fixed enum. The honest mapping that
          needs NO schema change: surface="practice" (the advice's plan runs
          in practice), and the advice's own 1-week result rides the outcome
          column (+1 focus improved, 0 flat, -1 worse). The teacher's origin
          lives in strategy_id: "teacher:<studentId>:<focus>" — queryable,
          zero rows invented.

     teacherEvidenceFor(appender-independent) — readEvidence below just
        passes the caller's RPC-shaped getter through: the Lab/School card
        renders { counts, winRate } or null (honest-null = แนะนำแบบเดิม).

   teacherAdviceFor keeps its shape; the ONE addition above (outcomeNote:
   null) is the slot the caller fills with evidence when it has any —
   advice without evidence stays byte-compatible with today. ── */
export function recordTeacherOutcome(appender, opts) {
  try {
    const o = opts && typeof opts === "object" ? opts : {};
    const studentId = o.studentId != null ? o.studentId : null;
    const advice = o.advice != null ? o.advice : null;
    const oneWeekAgo = o.oneWeekAgo != null ? o.oneWeekAgo : null;
    if (typeof appender !== "function" || !advice || typeof advice !== "object") return null;
    const focus = advice.focus && advice.focus.label ? String(advice.focus.label).slice(0, 40) : "general";
    const sid = "teacher:" + String(studentId || "anon").slice(0, 30) + ":" + focus;
    const bucketOf = (acc) => (acc == null ? 1 : acc >= 90 ? 3 : acc >= 75 ? 2 : acc >= 50 ? 1 : 0);
    const after = advice.summary && typeof advice.summary.avgAcc === "number" ? advice.summary.avgAcc : null;
    const before = oneWeekAgo && typeof oneWeekAgo.avgAcc === "number" ? oneWeekAgo.avgAcc : null;
    let outcome = 0;
    if (before != null && after != null) outcome = after > before ? 1 : after < before ? -1 : 0;
    else outcome = 0;
    const ok = !!appender({
      p_strategy_id: sid,
      p_surface: "practice",
      p_lang: "th",
      p_accuracy_bucket: bucketOf(after),
      p_self_report: null,
      p_outcome: outcome,
    });
    return ok ? { strategy_id: sid, outcome, before, after } : null;
  } catch (e) { return null; }
}
/* read the 4.4 evidence the same way the policy engine does — the CALLER
   supplies the RPC call (the model never goes online); shape: { counts,
   winRate } straight from strategy_evidence, null = no data → แนะนำแบบเดิม */
export function teacherEvidenceShape(raw) {
  try {
    if (!raw || typeof raw !== "object") return null;
    const counts = raw.counts && typeof raw.counts === "object" ? raw.counts : null;
    if (!counts) return null;
    const total = (counts["1"] || 0) + (counts["0"] || 0) + (counts["-1"] || 0);
    if (total <= 0) return null;
    return { total, winRate: Math.round(((counts["1"] || 0) / total) * 1000) / 1000 };
  } catch (e) { return null; }
}
/* the advice's evidence note: fills outcomeNote ONLY on real evidence —
   otherwise stays null and the caller does exactly what it does today */
export function teacherAdviceWithEvidence(pr, evidence) {
  try {
    const adv = teacherAdviceFor(pr);
    if (!adv) return null;
    const ev = teacherEvidenceShape(evidence);
    if (!ev) return adv;                       // honest-null: unchanged advice
    return { ...adv, outcomeNote: { winRate: ev.winRate, total: ev.total, th: `ครั้งก่อนคำแนะนำแบบนี้ช่วยได้ ${Math.round(ev.winRate * 100)}% จาก ${ev.total} รอบที่ติดตาม`, en: `Last time this advice helped ${Math.round(ev.winRate * 100)}% of ${ev.total} followed rounds`, zh: `上次这类建议在${ev.total}次跟进中帮助了${Math.round(ev.winRate * 100)}%` } };
  } catch (e) { return null; }
}
/* ══ PHASE 4 — ADAPTIVE TEACHER (spec §14–15, §17, §21) ══
   Three exports power the self-report micro-poll on the practice result
   screen: the state estimator (multi-source fusion), the feedback record
   factory, and a loop re-run where the student's answer steers the decision
   (direct answer REPLACES performance guesses — spec §17's "คำตอบโดยตรงของ
   นักเรียนควรมีน้ำหนักสูงกว่าการเดาจากใบหน้าเพียงอย่างเดียว"). ── */
import { estimateStates as _estimateStates, makeStudentFeedback, SELF_REPORT_OPTIONS } from "./student/state-estimator.js";
/* §7 multimodal fusion (m12) — deterministic confidence-weighted arbiter for
   combining signals from several channels; per-channel weight 0 = kill switch,
   self-report dominance per §17, vision/audio can never win (§16). */
import { fuseMultimodalSignals as _fuseMultimodalSignals, confidentFusion as _confidentFusion, DEFAULT_CHANNEL_WEIGHTS as _FUSION_WEIGHTS } from "./multimodal/fusion.js";
export function estimateStudentStates(args) {
  try { return _estimateStates(args || {}); } catch (e) { return null; }
}
/* Fuse raw channel signals into per-state estimates. args =
   { signals: [...], weights?: { channel: number } }. Errors/malformed → null. */
export function fuseMultimodalStates(args) {
  try { return _fuseMultimodalSignals(args && typeof args === "object" ? args : null); } catch (e) { return null; }
}
/* Same, but only states at or above a confidence floor (default 0.5) survive —
   weak inferences stay evidence, never teaching decisions. */
export function confidentMultimodalStates(args, floor) {
  try { return _confidentFusion(args && typeof args === "object" ? args : null, floor); } catch (e) { return null; }
}
export const FUSION_CHANNEL_WEIGHTS = _FUSION_WEIGHTS;

/* docs/12 §1A (m39): the §3 wire — real learner_skill_state rows → the
   personalized-plan brain. Kill switch (tiga_personalized_plans) is checked
   inside; switch off / no data / any error → null = callers keep today's
   behavior. The wire can only ADD a plan on top of a good state. */
import { fetchSkillStates as _fetchSkillStates, toAbilities as _toAbilities, planForLearner as _planForLearner } from "./teaching/skill-state-wiring.js";
export async function fetchLearnerSkillStates() {
  try { return await _fetchSkillStates(sb); } catch (e) { return null; }
}
export function learnerAbilitiesFromRows(rows) {
  try { return _toAbilities(rows); } catch (e) { return null; }
}
export async function personalizedPlanForLearner(args) {
  try { return await _planForLearner(args || {}); } catch (e) { return null; }
}
export function newStudentFeedback(args) {
  try { return makeStudentFeedback(args || {}); } catch (e) { return null; }
}
export const SELF_REPORT_CHOICES = SELF_REPORT_OPTIONS;

/* Re-run the loop with the learner's answer folded in. stats = the SAME
   practiceStats the first run got (plus weekAgoAccuracy) — the caller holds
   them; here we only fuse the report. Returns the full new loop result.
   lang = the app's CURRENT language mode (owner plan 1.2: the self-report
   rerun is a language touchpoint like every other — without it runOnce()
   defaulted to Thai and an EN/ZH learner got a Thai verdict after answering).
   Optional + defaulted, so existing callers (and older smoke scripts) stay
   correct — and it rolls back by simply not passing lang again. */
export async function rerunLoopWithSelfReport(practiceStats, selfReport, lang) {
  try {
    if (!selfReport || !SELF_REPORT_STATE_KEYS[selfReport]) return null;
    if (!_tiga) initTigamodelWeb();          // idempotent; the poll may be the first tigamodel touch of the session
    if (!_tiga || !_tiga.loop) return null;
    return await _tiga.loop.runOnce({ practiceStats, selfReport, lang });
  } catch (e) { return null; }
}
const SELF_REPORT_STATE_KEYS = { confused: 1, too_easy: 1, too_hard: 1, understand: 1, frustrated: 1, retry: 1, great: 1 };

/* P4a — CAMERA→LOOP BRIDGE (spec §18/§19, real wiring): the camera coach's
   hand-posture detector already measures real frames ({round, wrist, thumb}
   averages in camSignalWindow). This turns those MEASURED values into loop
   observations — only what the detector actually saw, never mood/attention
   (§16). Caller passes the window the UI already computed; null/empty → no
   observation (honest). Returns [{modality, signal, value}] for runOnce. */
export function visionObservationsFromWindow(win) {
  try {
    if (!Array.isArray(win) || win.length < 5) return null;   // too few frames = no claim
    const n = win.length;
    const avg = k => win.reduce((s, w) => s + (typeof w[k] === "number" ? w[k] : 0), 0) / n;
    const mRound = avg("round"), mWrist = avg("wrist");
    const obs = [];
    if (mRound < 0.6) obs.push({ modality: "vision", signal: "hand_shape", value: { code: "hand_posture_flat", detail: "รูปมือแบนระหว่างเล่น (ค่าเฉลี่ยจากกล้อง)", confidence: Math.min(0.7, 0.4 + (0.6 - mRound)) } });
    if (mWrist < 0.55) obs.push({ modality: "vision", signal: "wrist_position", value: { code: "wrist_collapsed", detail: "ข้อมือยุบล่างระหว่างเล่น", confidence: Math.min(0.7, 0.4 + (0.55 - mWrist)) } });
    return obs.length ? obs : null;
  } catch (e) { return null; }
}

/* P4b — STT ANSWER PATH (spec §17/§18): a self-report answer SPOKEN instead
   of tapped. Maps the transcript to the self-report vocabulary; anything
   unmatched → null (the caller falls back to the tap UI). Thai/English/
   Chinese keywords, all exact words a learner would actually say. */
const SR_SPEECH_MAP = [
  [/เข้าใจ(แล้ว)?|แล้ว|got ?it|underst(o|a)od|understand|明白|懂了/, "understand"],
  [/งง|confus|ไม่เข้าใจ|不明白|懵/, "confused"],
  [/ง่าย(ไป|เกิน)|too ?easy|太简单/, "too_easy"],
  [/ยาก(ไป|เกิน)|too ?hard|太难/, "too_hard"],
  [/ลอง(อีก|ใหม่)|อีกครั้ง|retry|again|再来|再试/, "retry"],
  [/หงุดหงิด|โมโห|frustrat|烦躁|烦/, "frustrated"],
  [/สนุก|มันส์|fun|好玩|有趣/, "great"],
];
export function selfReportFromTranscript(text) {
  try {
    const t = String(text || "").toLowerCase();
    if (!t.trim()) return null;
    for (const [re, key] of SR_SPEECH_MAP) if (re.test(t)) return key;
    return null;
  } catch (e) { return null; }
}

/* ── THE UNIFIED PLAN (owner directive: รวมแผน 100 + แผน 1M เป็นแผ่นเดียว):
   100 streams × their 1M cells, one work order, statuses verified by the
   capability engine (a "done" tick without real capability never shows done). ── */
let _unified = null;
export function getUnifiedPlan() {
  if (!_unified) {
    const tiga = _tiga || initTigamodelWeb();
    _unified = createUnifiedPlan({ kbEntries: kbEntriesIndex(tiga && tiga.kb) });
  }
  return _unified;
}
export function unifiedSummary() { return getUnifiedPlan().summary(); }
export function unifiedWorkOrder(limit) { return getUnifiedPlan().workOrder(limit); }
/* plan v3.8 ระลอก 13 (13.2) — the reward÷risk batch queue (see roadmap-unified.js nextBatch) */
export function unifiedNextBatch(limit) { try { return getUnifiedPlan().nextBatch(limit); } catch (e) { return []; } }

/* ── AI PIANO COACH P0 (master product directive): WHAT/WHY/HOW diagnosis +
   time-adaptive practice budget + honest student snapshot — all from data
   the app already records (tg_memory + tg_practice_log). No new schema. ── */
export function getCoachDiagnosis() {
  try {
    const memory = (typeof localStorage !== "undefined") ? JSON.parse(localStorage.getItem("tg_memory") || "null") : null;
    const practiceLog = (typeof localStorage !== "undefined") ? JSON.parse(localStorage.getItem("tg_practice_log") || "null") : null;
    return buildDiagnosis({ memory, practiceLog });
  } catch (e) { return null; }
}
export function getPracticeTimeBudget(minutes) {
  try {
    const memory = (typeof localStorage !== "undefined") ? JSON.parse(localStorage.getItem("tg_memory") || "null") : null;
    return practiceTimeBudget(minutes, { memory });
  } catch (e) { return practiceTimeBudget(minutes, {}); }
}
export function getCoachContextBlock() {
  try {
    const memory = (typeof localStorage !== "undefined") ? JSON.parse(localStorage.getItem("tg_memory") || "null") : null;
    const practiceLog = (typeof localStorage !== "undefined") ? JSON.parse(localStorage.getItem("tg_practice_log") || "null") : null;
    return buildCoachContextBlock({ memory, practiceLog });
  } catch (e) { return ""; }
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
  try {
    const r = await ensureSelfLearner().reinforceOutcome(signal);
    try { getCapabilityEngine().invalidateCapabilityCache(); } catch (e) {}
    return r;
  } catch (e) { return { applied: false }; }
}
export async function getLearnedKBContextAsync(matchText) {
  try { return await ensureSelfLearner().getLearnedKBContext(matchText); } catch (e) { return ""; }
}

/* ── P2 wiring (owner-approved direction, 2026-09-17): run the teaching loop
   on REAL practice signals from inside the app. Used by use-practice-mode's
   finishPractice() after every drill: app-native signals (accuracy, repeated
   errors, pauses, rhythm) go in, the policy selects a strategy, the KB adds
   a teach tip, and a { text, strategy_id } object comes back — all locally,
   no network call, never throws. Returns null when anything is off (no
   singleton, no stats) so the caller can skip silently.
   (Self-learning outcome reinforcement is a SEPARATE async export —
   reinforceTeachingOutcome — called by finishPractice fire-and-forget.)

   ASYNC — bug fix (found twice, independently): runOnce() has been `async`
   since the Phase 0 skeleton (3d8c3cd8), but this wrapper was sync and
   returned the raw Promise — finishPractice() read .response/.decision off
   the Promise → undefined → the "🧠 TIGA Model วิเคราะห์" verdict NEVER
   rendered on any practice result. (Found by this branch's verify-finish-
   practice-flow e2e AND by verify-autoteach on main.) Now a real async
   function returning the resolved loop result (or null) — callers await it.
   Also passes `lang` through so the verdict speaks the app's language, and
   `observations` (main's addition) straight to the loop. ── */
export async function runTeachingLoopForPractice(practiceStats, { selfReport = null, lang = "th", observations = null } = {}) {
  try {
    if (!practiceStats && !(Array.isArray(observations) && observations.length)) return null;
    if (!_tiga) initTigamodelWeb();
    const tiga = _tiga;
    if (!tiga || !tiga.loop) return null;
    return await tiga.loop.runOnce({ practiceStats, selfReport, lang, observations: observations || [] });
  } catch (e) { return null; }
}

/* Coaching helpers for practice surfaces (roadmap #73/#75/#78): the hint
   rung for the current obstacle, the tempo decision in the flow band, and a
   3-line recap + homework. All pure/sync — fire and render, never throws. */
export function coachHintFor(practiceStats) {
  try { return getCoach().rungFor(practiceStats || {}); } catch (e) { return 0; }
}
export function coachHintText(rung, ctx) {
  try { return getCoach().renderHint(rung, ctx || {}); } catch (e) { return null; }
}
export function coachTempoTarget(args) {
  try { return getCoach().tempoTarget(args || {}); } catch (e) { return null; }
}
export function coachRecap(args) {
  try { return getCoach().recap(args || {}); } catch (e) { return null; }
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

/* plan v3 1.5: the label vocabulary is ALSO exported as a light standalone
   module (../tiga-strategy-labels.ts) that render-path UI can import without
   pulling the whole model tree into the main chunk. web.js re-exports the
   same definitions so Model Lab/admin always agree with the UI. */
import { TIGA_STRATEGY_LABELS as _TIGA_LABELS_CHECK, tigaStrategyLabel as _tigaLabelCheck } from "../tiga-strategy-labels";
void _TIGA_LABELS_CHECK; void _tigaLabelCheck;

/* ── 1,000,000-item development plan (owner directive 2026-09-18): the
   combinatorial capability-spec space in roadmap-1m.js. Thin pass-throughs
   so the Model Lab never imports the raw module (same pattern as the coach
   accessors above). All pure/sync, never throws. ── */
export function plm1mItem(i) { try { return plmItem(i); } catch (e) { return null; } }
export function plm1mParse(code) { try { return plmParse(code); } catch (e) { return null; } }
export function plm1mRank(args) { try { return plmRank(args || {}); } catch (e) { return { rows: [], nextOffset: null, exhausted: true }; } }
export function plm1mSample(seed) { try { return plmSample(seed); } catch (e) { return null; } }
export function plm1mStats() { try { return plmStats(); } catch (e) { return { total: PLM_TOTAL, started: 0, open: PLM_TOTAL, startedPct: 0, buckets: [], byDim: [], modules: [] }; } }
export { PLM_TOTAL as PLM1M_TOTAL, PLM_DIMENSIONS as PLM1M_DIMENSIONS };

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
  "sight-reading": "SIGHT READING",
  "innovation": "MUSIC INNOVATION",
  "music-marketing": "MUSIC MARKETING",
  "music-therapy": "MUSIC THERAPY",
};
const KB_DOMAIN_KEYWORDS = {
  "sight-reading": ["อ่านโน้ต", "อ่านสายตา", "sight", "reading", "ledger", "บรรทัดโน้ต", "ตัวโน้ต", "กวาดตา"],
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
  "innovation": ["นวัตกรรม", "innovation", "technology", "เทคโนโลยี", "digital", "ดิจิทัล", "midi", "synthesizer", "ซินธิ", "app", "แอป", "edtech", "online lesson", "เรียนออนไลน์", "ai"],
  /* docs/16 §3 (m52): the thin pillars become SERVABLE — marketing/therapy
     questions now get their labelled lines instead of falling to the core. */
  "music-marketing": ["การตลาด", "marketing", "market", "ตลาด", "โปรโมท", "โฆษณา", "คลิป", "content", "คอนเทนต์", "โซเชียล", "social", "รีวิว", "ราคา", "แบรนด์", "brand", "บอกต่อ", "นักเรียนใหม่"],
  "music-therapy": ["บำบัด", "wellbeing", "สุขภาวะ", "อารมณ์", "เครียด", "สงบ", "ผ่อนคลาย", "ดูแลใจ"],
};

/* The keywords of a question that actually fired a KB domain — the reference the
   capped-vs-legacy report uses to count how many served lines are on topic. */
export function kbFiredKeywords(matchText) {
  const text = String(matchText || "").toLowerCase();
  const out = [];
  for (const kws of Object.values(KB_DOMAIN_KEYWORDS)) for (const k of kws) if (text.includes(String(k).toLowerCase())) out.push(String(k).toLowerCase());
  return out;
}

let _kbHotPath = null;
export function kbHotPath() {
  if (!_kbHotPath) _kbHotPath = _createKBHotPath({ enabled: false }); // OFF until switched on
  return _kbHotPath;
}
export function setKbHotPathEnabled(on) {
  const hp = kbHotPath();
  hp.setEnabled(on === true);
  return hp.isEnabled();
}

/* ── m44 (docs/14 §2): the hot path's kill switch, read from app_settings ──
   app_settings.tiga_kb_hot_path = { "enabled": true } turns the capped,
   relevance-ranked block on. A missing row, an error, or anything else leaves
   it OFF — the legacy block, byte-identical — so the switch fails closed, the
   same convention as isJevPolicyEnabled. It is read at most once a minute and
   never inside getKBContext (which must stay synchronous): getFullKBContext
   asks for it right before it builds the block. The owner flips it from Model
   Lab (setKbHotPathSwitch), no deploy needed. */
const KB_SWITCH_TTL_MS = 60000;
let _kbSwitchAt = 0;
let _kbSwitchBusy = null;
export function refreshKbHotPathSwitch({ force = false } = {}) {
  if (!force && _kbSwitchAt && Date.now() - _kbSwitchAt < KB_SWITCH_TTL_MS) return Promise.resolve(kbHotPath().isEnabled());
  if (_kbSwitchBusy) return _kbSwitchBusy;
  _kbSwitchBusy = (async () => {
    let on = false;
    try {
      const r = sb ? await sb.from("app_settings").select("value").eq("key", KB_HOT_PATH_SWITCH).maybeSingle() : null;
      on = !!(r && r.data && r.data.value && r.data.value.enabled === true);
    } catch (e) { on = false; }
    setKbHotPathEnabled(on);
    if (on) { const rows = readHotStore(); if (rows) kbHotPath().restoreHot(rows); } // m45: resume the real serving order
    _kbSwitchAt = Date.now();
    _kbSwitchBusy = null;
    return on;
  })();
  return _kbSwitchBusy;
}
/* Admin: write the switch (admin_set_app_setting, the same RPC Model Lab uses for
   self-learning) and apply it on this device at once. Throws when the write is
   refused so the panel can say so. */
export async function setKbHotPathSwitch(on) {
  const { error } = await sb.rpc("admin_set_app_setting", { p_key: KB_HOT_PATH_SWITCH, p_value: { enabled: on === true } });
  if (error) throw new Error(error.message || "save failed");
  setKbHotPathEnabled(on === true);
  _kbSwitchAt = Date.now();
  return kbHotPath().isEnabled();
}
export async function isKbHotPathSwitchOn() { return refreshKbHotPathSwitch({ force: true }); }

/* ── m45 (docs/14 §2): hot counts that survive a page reload ──
   Only what was REALLY served is stored (entry id + its serve count, capped),
   per device, in a try/catch so private mode / a full quota just skips it.
   Loaded when the switch turns ON, written a beat after real serves, cleared
   by the admin. Switch OFF → nothing is read, nothing is written, and the
   ranking cannot use a count that is not from a real serve. */
const HOT_STORE_KEY = "tiga_kb_hot_counts";
function readHotStore() {
  try {
    const raw = localStorage.getItem(HOT_STORE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : null;
  } catch (e) { return null; }
}
function writeHotStore() {
  try {
    const hp = kbHotPath();
    if (!hp.isEnabled()) return false;
    localStorage.setItem(HOT_STORE_KEY, JSON.stringify(hp.snapshotHot()));
    return true;
  } catch (e) { return false; }
}
let _hotSaveT = null;
function persistHotSoon() {
  try {
    if (_hotSaveT) return;
    _hotSaveT = setTimeout(() => { _hotSaveT = null; writeHotStore(); }, 1500);
  } catch (e) { /* no timers / no storage → nothing to persist */ }
}
export function clearKbHotCounts() {
  kbHotPath().clearHot();
  try { localStorage.removeItem(HOT_STORE_KEY); } catch (e) {}
  return true;
}
export function kbHotCountStore() {
  return { entries: kbHotPath().snapshotHot().length, stored: (readHotStore() || []).length, key: HOT_STORE_KEY };
}

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

    /* docs/10 §1.3 (m34): with the hot path ON, lines are relevance-ranked
       and hard-capped (maxLines/maxChars) — a SELECTION of the domain, not
       all of it; OFF (default) → the legacy loop below, byte-identical. */
    let lines = null;
    let servedIds = null;
    const hp = _kbHotPath;
    if (hp && hp.isEnabled()) {
      const kw = [];
      for (const d of top) for (const k of (KB_DOMAIN_KEYWORDS[d] || [])) kw.push(String(k).toLowerCase());
      const sel = hp.select({ domains: top, index: _kbIndex, keywords: kw, labelOf: d => KB_DOMAIN_LABEL[d] || d });
      if (sel) { lines = sel.lines; servedIds = sel.picked.map(e => e.id); }
    }
    if (!lines) {
      lines = [];
      for (const d of top) {
        const label = KB_DOMAIN_LABEL[d];
        for (const e of (_kbIndex.get(d) || [])) {
          lines.push(`• [${label}] ${e.title} — วิธีสอน: ${e.teach}`);
        }
      }
    }
    if (!lines.length) {
      // switch-gated learned knowledge still injects even without a topical
      // seed hit — fire-and-forget cache warm (async fn, safe to ignore)
      const lr = ensureSelfLearner();
      lr.getLearnedKBContext(matchText).catch(() => {});
      return "";
    }
    if (servedIds && servedIds.length) { hp.recordServed(servedIds); persistHotSoon(); } // bounded hot-count feed (m34) + m45 persist
    return (
      "\n\n[TIGA KNOWLEDGE BASE — curated teaching knowledge with sources. Use these when relevant; follow the วิธีสอน (how to teach) guidance. Do not contradict them.]\n" +
      lines.join("\n") + "\n"
    );
  } catch (e) { return ""; }
}

/* ── Student-aware teaching block for PRODUCTION callers (use-chat). Reads
   the same localStorage memory the app already tracks (tg_memory), formats
   it through the real student-model schema, and returns a compact prompt
   block. The teacher then answers as a teacher who KNOWS this student —
   struggles by name, respects the mastered list, never re-explains what is
   already solid. Honest-gap rule: fields the app doesn't track stay absent,
   never guessed. Empty string when there is no memory at all (new student). ── */
export function getStudentContextBlock() {
  try {
    const raw = (typeof localStorage !== "undefined") ? localStorage.getItem("tg_memory") : null;
    if (!raw) return ""; // brand-new student — nothing to personalize (honest gap, not a guess)
    const mem = JSON.parse(raw);
    const hasSignal = mem && ((mem.struggles && mem.struggles.length) || (mem.mastered && mem.mastered.length) || (mem.recent && mem.recent.length) || mem.sessions);
    if (!hasSignal) return "";
    const ctx = buildStudentContextFromApp({});
    if (!ctx) return "";
    const lines = [];
    if (ctx.mastered && ctx.mastered.length) lines.push(`ทักษะที่ทราบว่าทำได้แล้ว (อย่าอธิบายซ้ำ ให้ต่อยอด): ${ctx.mastered.join(", ")}`);
    if (ctx.struggles && ctx.struggles.length) lines.push(`จุดที่เคยติดขัด (โอกาสที่ควรเสนอช่วย แต่ถามก่อนว่าอยากซ้อมจุดนี้ไหม): ${ctx.struggles.join(", ")}`);
    if (ctx.recent && ctx.recent.length) lines.push(`ผลการซ้อมล่าสุด: ${ctx.recent.join(" · ")}`);
    if (ctx.practice_habits && ctx.practice_habits.sessions_total) lines.push(`จำนวนเซสชันซ้อมทั้งหมด: ${ctx.practice_habits.sessions_total}`);
    if (ctx.experience_level) lines.push(`ระดับที่แอปบันทึกไว้: ${ctx.experience_level}`);
    if (!lines.length) return "";
    return `\n\n[ข้อมูลนักเรียนจากแอป — ใช้ปรับการสอนเป็นของคนนี้ อ้างอิงได้ว่า 'เธอทำผ่าน X มาแล้ว' ห้ามกุข้อมูลนอกนี้]\n${lines.map(l => "• " + l).join("\n")}\n`;
  } catch (e) { return ""; /* memory malformed → teach without it, never break the chat */ }
}

/* Learned-knowledge injection for callers that CAN await (use-chat / admin
   chat build their system prompt asynchronously anyway). Returns the static
   KB slice + the switch-gated learned block in one string, so production
   surfaces only ever call this. Empty when nothing matches / switch OFF. */
export async function getFullKBContext(matchText) {
  // which block getKBContext serves depends on the switch; a slow settings read never holds an answer back for more than a moment (the first message then just uses the current state)
  try { await Promise.race([refreshKbHotPathSwitch(), new Promise(r => setTimeout(r, 400))]); } catch (e) { /* fail closed: keep the current state */ }
  const base = getKBContext(matchText);
  let learned = "";
  // BUGFIX (owner directive "ใช้ได้จริงๆ"): was `if (_learner)` — but _learner
  // is null until someone calls ensureSelfLearner(), so production chat NEVER
  // received learned knowledge even with the switch ON. Create it now; the
  // learner reads its own switch and returns "" when disabled.
  try { learned = await ensureSelfLearner().getLearnedKBContext(matchText); } catch (e) { /* off or error → skip */ }
  return base + learned;
}

/* ── Measurement system (roadmap #81/#82/#83/#85/#86): extended 124-case eval
   + regression alarm with a localStorage baseline (key separate from the
   quick-eval history so the two never clobber each other). ── */
const EVAL_X_BASELINE_KEY = "tiga_lab_eval_extended_baseline";
export function loadEvalExtendedBaseline() {
  try {
    const raw = localStorage.getItem(EVAL_X_BASELINE_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" ? v : null;
  } catch (e) { return null; }
}
export async function runExtendedEvalWithRegression() {
  try {
    if (!_tiga) initTigamodelWeb();
    const tiga = _tiga;
    if (!tiga || !tiga.providers) return { error: "not initialized" };
    const results = await evaluateAllProvidersExtended(tiga.providers.list());
    const baseline = loadEvalExtendedBaseline();
    const head = results[0] || null;
    const verdict = regressionVerdict(head || { scores: {} }, baseline && baseline.scores ? baseline : null);
    try {
      localStorage.setItem(EVAL_X_BASELINE_KEY, JSON.stringify(head ? { provider: head.provider, scores: head.scores, overall: head.overall, cases_run: head.cases_run, saved_at: new Date().toISOString() } : {}));
    } catch (e) { /* quota/private mode — baseline stays in-memory for this session */ }
    return { results, verdict };
  } catch (e) { return { error: String(e?.message || e) };
  }
}
export { evaluateProviderExtended, regressionVerdict, rubricReply, EXTENDED_PROBES as EVALX_PROBES, THEORY_FACTS as EVALX_THEORY_FACTS, GOLDEN_SITUATIONS as EVALX_GOLDEN_SITUATIONS };

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

/* ── TIGA Capability Hub — the intent façade the whole app speaks to ──
   Surfaces ask for INTENTS (sight-reading setup, song-result explanation,
   quest hints, learner summaries) — never for a module by name. Each intent
   consults its domains in priority order and falls back to an honest
   baseline, so registering a smarter engine later upgrades every surface
   with zero UI changes (spec: the app must keep benefiting from every
   future TIGA MODEL improvement).
   Registered NOW (real engines, already smoke-tested):
     skill-graph  → skill-graph.js (80-node map: clef/level/next-skill)
     coach        → coach/diagnosis.js (tempo bands, weak-spot targeting)
     diagnosis    → coach/diagnosis.js buildDiagnosis (learner summary lines)
     teaching-loop→ (reserved: state-aware quest framing — registers when
                    the loop exposes a sync probe) */
import { createTigaHub } from "./hub.js";
import { buildDiagnosis as _hubDiag } from "./coach/diagnosis.js";
/* engine calls are wrapped so a throwing engine degrades to the next domain
   (or the baseline) instead of breaking the surface that asked */
function attempt(fn) { try { const v = fn(); return v == null ? null : v; } catch (e) { return null; } }
const _hubSG = sharedSkillGraph();
export const tigaHub = createTigaHub();

/* ── Jev judgment engine (TypeSafe System One) — TIGA MODEL's door to typed
   Choice/Score/Noul judgments. Runs through the jev-judge edge function with
   the signed-in user's JWT, so the TYPESAFE_API_KEY stays server-side for all
   three projects (TIGA AI surfaces, this hub, and bos). Judgments COMPOSE
   with the chat providers: Jev picks/verifies, chat providers explain. ── */
export const jevJudgment = createJevJudgment({
  supabaseUrl: (sb && sb.supabaseUrl) || "https://gsaqgbracxnucdmtmcxz.supabase.co",
  getAccessToken: async () => {
    try {
      const { data } = await sb.auth.getSession();
      return (data && data.session && data.session.access_token) || null;
    } catch (e) { return null; }
  },
});
tigaHub.registerEngine("jev-judgment", {
  /* async engine — surfaces await judge() and degrade to their baseline on
     ok:false, the same contract as every other engine here */
  judge: (state, questions, opts) => jevJudgment.judge(questions, state, opts),
  choose: (state, instructions, criteria, opts) => jevJudgment.choose(state, instructions, criteria, opts),
  noul: (state, instructions, opts) => jevJudgment.noul(state, instructions, opts),
  score: (state, instructions, levels, opts) => jevJudgment.score(state, instructions, levels, opts),
}, { note: "TypeSafe Jev (jev-latest) via jev-judge edge function — typed judgments, server-side key" });
tigaHub.registerEngine("skill-graph", {
  recommendSightReading(mem, cur) {
    const struggles = ((mem && mem.struggles) || []).map(s => (s && typeof s === "object") ? (s.label || s.th || s.en || s.code || "") : (typeof s === "string" ? s : "")).filter(Boolean);
    const nxt = attempt(() => _hubSG.nextSkill({}) || null);
    const hint = nxt && nxt.id ? ` → ก้าวถัดไป: ${nxt.th || nxt.en || nxt.id}` : "";
    const tip = struggles.length
      ? { th: `อ่านโน้ตชุดที่พลาดบ่อย (${struggles.slice(0, 2).join(", ")}) ก่อน${hint}`, en: `Drill the notes you miss most (${struggles.slice(0, 2).join(", ")})${hint}`, zh: `先练最容易错的音（${struggles.slice(0, 2).join("、")}）${hint}` }
      : { th: `ทักษะถัดไป: ${nxt ? (nxt.th || nxt.en || nxt.id) : "ทบทวนที่ชำนาญ"}`, en: `Next skill: ${nxt ? (nxt.en || nxt.th || nxt.id) : "review what you know"}`, zh: `下一技能：${nxt ? (nxt.th || nxt.en || nxt.id) : "复习已掌握内容"}` };
    return { clef: (cur && cur.clef) || "treble", tip, nextSkill: nxt || null };
  },
  nextQuestHint(mem, profile) {
    const nxt = attempt(() => _hubSG.nextSkill({}) || null);
    const struggles = ((mem && mem.struggles) || []).map(s => (s && typeof s === "object") ? (s.label || s.th || s.en || s.code || "") : (typeof s === "string" ? s : "")).filter(Boolean);
    const tip = struggles.length
      ? { th: `ภารกิจวันนี้: ซ้อมท่อนที่มี "${struggles[0] && (struggles[0].label || struggles[0])}" ให้ชนะ 1 รอบ${nxt ? ` (มุ่งสู่ ${nxt.th || nxt.en || nxt.id})` : ""}`, en: `Today's quest: win one run containing "${struggles[0] && (struggles[0].label || struggles[0])}"${nxt ? ` (toward ${nxt.en || nxt.th || nxt.id})` : ""}`, zh: `今日任务：赢一局含“${struggles[0] && (struggles[0].label || struggles[0])}”的曲子${nxt ? `（迈向${nxt.th || nxt.en || nxt.id}）` : ""}` }
      : { th: `ภารกิจวันนี้: ${nxt ? `ฝึกทักษะ "${nxt.th || nxt.en || nxt.id}"` : "จบซ้อม 3 รอบให้ครบ"}`, en: `Today's quest: ${nxt ? `practice "${nxt.en || nxt.th || nxt.id}"` : "finish 3 practice rounds"}`, zh: `今日任务：${nxt ? `练习“${nxt.th || nxt.en || nxt.id}”` : "完成3次练习"}` };
    return { tip, nextSkill: nxt || null };
  },
}, { note: "80-node skill map (real nextSkill engine)" });
tigaHub.registerEngine("coach", {
  explainSongResult(result, mem) {
    const acc = result && (typeof result.acc === "number" ? result.acc : result.accuracy);
    if (acc == null) return null;
    const d = attempt(() => _hubDiag({ memory: mem || null })) || null;
    const stars = result.stars != null ? result.stars : (acc >= 95 ? 3 : acc >= 85 ? 2 : acc >= 70 ? 1 : 0);
    const what = d && d.what ? d.what : null;
    const focusLabel = what ? what.label : null;
    const tip = stars >= 3
      ? { th: "🔥 ครบ 3 ดาว! รอบหน้าลองเปิดเมโทรนอมเร็วขึ้น 5 BPM", en: "🔥 3 stars! Next round, try +5 BPM on the metronome", zh: "🔥 三星！下次节拍器加快5" }
      : focusLabel
        ? { th: `🎯 โฟกัส "${focusLabel}"${what && typeof what.acc === "number" ? ` (ล่าสุด ${what.acc}%)` : ""} — ซ้อมช้า 3 ครั้งให้สมบูรณ์ แล้วค่อยเร่ง`, en: `🎯 Focus "${focusLabel}"${what && typeof what.acc === "number" ? ` (last ${what.acc}%)` : ""} — 3 slow perfect passes before speeding up`, zh: `🎯 专注“${focusLabel}”${what && typeof what.acc === "number" ? `（上次${what.acc}%）` : ""}，慢速完美弹3次再加速` }
        : { th: "🎯 ผ่อนความเร็ว 15% แล้วซ้อมท่อนสั้นที่พลาด กลับมาเต็มความเร็วหลังผ่าน 2 รอบ", en: "🎯 Slow to 85%, drill the missed short section, return after 2 clean passes", zh: "🎯 放慢15%练错段，两次全对后回原速" };
    return { tip, stars, acc, focus: focusLabel || null };
  },
}, { note: "diagnosis engine: real tempo bands + weak-spot targeting" });
tigaHub.registerEngine("diagnosis", {
  learnerSummary(mem, plog, profile) {
    const d = attempt(() => _hubDiag({ memory: mem || null, practiceLog: plog || null })) || null;
    const accs = plog && typeof plog === "object" ? Object.values(plog).map(v => v && v.acc).filter(a => typeof a === "number") : [];
    const avg = accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null;
    const struggles = (mem && mem.struggles) || [];
    return {
      avgAcc: avg, rounds: accs.length, topStruggle: struggles[0] || null,
      streak: profile && typeof profile.streak === "number" ? profile.streak : null,
      line: avg == null ? null : {
        th: `ความแม่นเฉลี่ย ${avg}% จาก ${accs.length} รอบซ้อม${struggles[0] ? ` · จุดต้องเก็บ: ${struggles[0]}` : ""}`, en: `${avg}% average accuracy over ${accs.length} rounds${struggles[0] ? ` · weak spot: ${struggles[0]}` : ""}`, zh: `平均准确率 ${avg}%（${accs.length} 次练习）${struggles[0] ? ` · 薄弱点：${struggles[0]}` : ""}` },
    };
  },
}, { note: "buildDiagnosis learner lines (real engine)" });

/* ── Phase 5: attach the capability engine (real t×m×s scoring from the
   seeded KB) so hub.capability()/summary() report 🟢🟡⚪ from live state,
   and mount the first deep SPECIALISTS — one engine deep in ONE topic
   domain, consulted specialist-first by every topic-tagged intent. New
   specialists land here as one registerSpecialist call: zero UI change. ── */
try { tigaHub.attachCapabilityEngine(() => getCapabilityEngine()); } catch (e) { /* capability view degrades to engine/baseline status */ }
tigaHub.registerSpecialist("technique", {
  explainSongResult(result, mem) {
    const acc = result && (typeof result.acc === "number" ? result.acc : result.accuracy);
    if (acc == null) return null;
    const tempo = attempt(() => coachTempoTarget({ accuracy: acc, bpm: result.bpm })) || null;
    const bpmTxt = tempo && tempo.bpm ? ` ที่ ${tempo.bpm} BPM` : "";
    const decision = tempo && tempo.decision ? tempo.decision : "";
    return {
      specialist: "technique",
      tip: acc < 75
        ? { th: `🎹 (ผู้เชี่ยวชาญเทคนิค) ลดจังหวะ${bpmTxt || " 15%"} แล้วซ้อมมือแยกสองมือ — มือซ้ายช้าได้ก่อน ค่อยรวมเมื่อเล่นได้ 3 รอบติด`, en: `🎹 (technique specialist) Drop the tempo${bpmTxt || " 15%"} and hands-separate — left hand first, combine after 3 clean passes`, zh: `🎹（技术专长）放慢速度${bpmTxt || "15%"}，分手练习——先练左手，3次全对后再合手` }
        : { th: `🎹 (ผู้เชี่ยวชาญเทคนิค) เล่นได้แล้ว${bpmTxt ? " " + bpmTxt.trim() : ""} — เพิ่มน้ำหนักกดคีย์ให้เสียงลึกเท่ากันทั้ง 5 นิ้ว จะได้น้ำเสียงสม่ำเสมอ`, en: `🎹 (technique specialist) Solid${bpmTxt ? " at " + bpmTxt.trim() : ""} — now even out key weight across all five fingers for a consistent tone`, zh: `🎹（技术专长）已稳定${bpmTxt ? "（" + bpmTxt.trim() + "）" : ""}——让五指下键力度均匀，音色统一` },
      tempo,
    };
  },
}, { note: "hands-separate / tempo-ladder depth (real coach tempo engine)" });
tigaHub.registerSpecialist("theory", {
  /* Knowledge-drop ranking (P6): the played note's own fact unless this
     learner already collected it — then no drop claim (caller keeps its
     own behavior). Teaches unheard facts first. */
  knowledgeForNote(noteName, ctx) {
    const cands = (ctx && ctx.candidates) || {};
    const shelf = (ctx && ctx.shelf) || [];
    const pc = String(noteName || "").replace(/-?\d+$/, "");
    if (!cands[pc]) return null;
    if (shelf.some(x => x && x.pc === pc)) return null; // already learned — rotate elsewhere
    return { fact: cands[pc], reason: "unheard", via: "theory" };
  },
  explainSongResult(result, mem) {
    const acc = result && (typeof result.acc === "number" ? result.acc : result.accuracy);
    if (acc == null) return null;
    return {
      specialist: "theory",
      tip: acc >= 90
        ? { th: "🎼 (ผู้เชี่ยวชาญทฤษฎี) ลองหาคอร์ด I–IV–V ในท่อนนี้ก่อนเล่นรอบหน้า — เห็นโครงสร้างแล้วจะอ่านโน้ตเร็วขึ้นเอง", en: "🎼 (theory specialist) Before the next run, find the I–IV–V chords in this piece — seeing structure makes reading faster", zh: "🎼（理论专长）下次演奏前先找 I–IV–V 和弦——看清结构，读谱更快" }
        : { th: "🎼 (ผู้เชี่ยวชาญทฤษฎี) ไล่ชื่อโน้ต 5 ตัวแรกของแต่ละท่อนก่อนเล่น — สมองจะเตรียมตำแหน่งมือให้ล่วงหน้า", en: "🎼 (theory specialist) Name the first five notes of each section before playing — your hand learns where to go", zh: "🎼（理论专长）弹奏前先说出每段前五个音——手会提前到位" },
    };
  },
}, { note: "structure-first reading (chord functions, key geography)" });
tigaHub.registerSpecialist("sight-reading", {
  recommendSightReading(mem, cur) {
    const struggles = ((mem && mem.struggles) || []).map(s => (s && typeof s === "object") ? (s.label || s.th || s.en || s.code || "") : (typeof s === "string" ? s : "")).filter(Boolean);
    return {
      specialist: "sight-reading",
      clef: (cur && cur.clef) || "treble",
      tip: struggles.length
        ? { th: `👁️ (ผู้เชี่ยวชาญอ่านโน้ต) วันนี้เน้น "${struggles[0]}" — อ่านชื่อโน้ตออกเสียงก่อนกดคีย์ทุกครั้ง จะจำตำแหน่งได้เร็วขึ้น 2 เท่า`, en: `👁️ (sight-reading specialist) Focus on "${struggles[0]}" — say each note name aloud before pressing; recognition doubles`, zh: `👁️（识谱专长）今天专注"${struggles[0]}"——按键前先读出音名，识谱速度翻倍` }
        : { th: "👁️ (ผู้เชี่ยวชาญอ่านโน้ต) ลองโหมด sprint — อ่านโน้ตให้เร็วที่สุดใน 60 วินาที ฝึกสายตาให้ไวกว่ามือ", en: "👁️ (sight-reading specialist) Try sprint mode — read as fast as you can in 60s; train the eyes ahead of the hands", zh: "👁️（识谱专长）试试冲刺模式——60秒内读谱，让眼睛快过手" },
    };
  },
}, { note: "eyes-ahead-of-hands drill depth" });

/* topic → exercise topic of the capability engine (t index): a tag hint →
   real exercise kind from the real generator */
tigaHub.registerSpecialist("repertoire", {
  /* Smart Daily Song: pick from the app's REAL song list using the real
     learner record — struggle coverage first, then the skill graph's next
     domain, never the 3-star set from the past week. Ties → deterministic
     day-hash so two devices agree. No candidate fits → null (caller keeps
     its day-hash pick; nothing invented). */
  recommendDailySong(songs, ctx) {
    if (!Array.isArray(songs) || !songs.length) return null;
    const mem = (ctx && ctx.memory) || {};
    const log = (ctx && ctx.practiceLog) || {};
    const starMap = (ctx && ctx.starMap) || {};
    const struggles = ((mem.struggles) || []).map(x => (x && typeof x === "object") ? (x.label || "") : String(x || "")).filter(Boolean);
    const dayKey = (ctx && ctx.dayKey) || "";
    let h = 0; for (let i = 0; i < dayKey.length; i++) h = (h * 31 + dayKey.charCodeAt(i)) | 0;
    const dayHash = Math.abs(h);
    const starOf = (song) => starMap[song.id || song.en || ""] || 0;
    const mastered3 = songs.filter(s => starOf(s) >= 3);
    let pool = songs.filter(s => starOf(s) < 3);
    if (!pool.length) pool = songs.slice(); // everyone at 3 stars → all eligible again
    // 1) songs whose title matches a real struggle label (the "fix my weak spot" pick)
    const labelOf = (s) => (s && (s.en || s.th || s.zh || s.id)) || "";
    const cover = pool.filter(s => { const t = labelOf(s); return struggles.some(x => x && (t.includes(x) || x.includes(t))); });
    if (cover.length) { const s = cover[dayHash % cover.length]; return { song: s, reason: { th: `ซ้อมจุดที่ติง "${struggles[0]}" ผ่านเพลงนี้`, en: `Targets your weak spot "${struggles[0]}"`, zh: `针对弱点“${struggles[0]}”` }, via: "repertoire" }; }
    // 2) otherwise rotate not-yet-3-star songs deterministically per day
    const fresh = pool.filter(s => starOf(s) < 3);
    const pick = (fresh.length ? fresh : pool)[dayHash % (fresh.length ? fresh.length : pool.length)];
    if (pick && mastered3.includes(pick)) return null;
    return { song: pick, reason: { th: "เพลงที่ยังไม่ได้ดาวเต็ม — เก็บ 3 ดาวให้ครบวันนี้", en: "Not yet 3-starred — collect the last star today", zh: "还没满星——今天拿下最后一颗星" }, via: "repertoire" };
  },
  nextQuestHint(mem, profile, opts) {
    if (!opts || !opts.dailySong) return null; // only the tie-in voice
    return { tip: { th: `🎵 เพลงประจำวันวันนี้ (🎵 ${opts.dailySong}) ได้ 1 ดาวขึ้นไป = ภารกิจสำเร็จ`, en: `🎵 One star or more on today's song (🎵 ${opts.dailySong}) completes the quest`, zh: `🎵 今日曲目（🎵 ${opts.dailySong}）得 1 星以上即完成任务` } };
  },
  /* Worded the way the LEARNER would say it: a tap on the chip sends `question` as their
     own message (it used to be the app asking the learner something — "want to tell me
     how it went?" — which, sent as the learner's message, turned the tutor's answer
     around). `label` is the short chip text. Both come from the real record only. */
  chatStartersFor(mem, plog, profile) {
    const struggles = ((mem && mem.struggles) || []).map(x => (x && typeof x === "object") ? (x.label || x.th || "") : String(x || "")).filter(Boolean);
    const recent = (mem && mem.recent) || [];
    if (!struggles.length && !recent.length) return null; // nothing real → static pool
    const out = [];
    if (struggles[0]) out.push({
      question: { th: `ช่วยแนะนำวิธีฝึก "${struggles[0]}" หน่อยครับ ฉันยังพลาดเรื่องนี้อยู่`, en: `Can you help me practise "${struggles[0]}"? I still keep missing it.`, zh: `能帮我练一下“${struggles[0]}”吗？我还是总出错。` },
      label: { th: `ฝึก "${struggles[0]}"`, en: `Practise "${struggles[0]}"`, zh: `练“${struggles[0]}”` },
      contextLabel: struggles[0],
    });
    const r0 = recent[0] ? String(typeof recent[0] === "object" ? (recent[0].label || recent[0].song || "") : recent[0]).trim() : "";
    if (r0 && r0 !== struggles[0]) out.push({
      question: { th: `ช่วยบอกวิธีเล่น "${r0}" ให้ดีขึ้นหน่อยครับ`, en: `How can I play "${r0}" better?`, zh: `怎样才能把“${r0}”弹得更好？` },
      label: { th: `เล่น "${r0}" ให้ดีขึ้น`, en: `Play "${r0}" better`, zh: `把“${r0}”弹得更好` },
      contextLabel: "recent",
    });
    if (out.length) return { starters: out, via: "repertoire" };
    return null;
  },
}, { note: "Smart Daily Song + personalized openers (real song list + real memory)" });
tigaHub.registerSpecialist("ear-training", {
  recommendSightReading(mem, cur) {
    return { specialist: "ear-training", clef: (cur && cur.clef) || "treble", tip: { th: "👂 (ผู้เชี่ยวชาญฝึกหู) ปิดตา 10 วินาทีก่อนเริ่ม — ฟังโน้ตในหัวก่อนเห็นบนหน้าจอ", en: "👁️ (ear specialist) Close your eyes for 10s first — hear the note before you see it", zh: "👂（练耳专长）先闭眼10秒——先在脑中听音再看屏幕" } };
  },
}, { note: "sound-before-sight drills" });

/* ── docs/16 §2 (m50): TIGA MODEL LAB accuracy audit — five measured layers
   (retrieval/policy/materials/answer-quality/KB-health) computed HERE from
   the real modules (the eval suite is async; compliance reads the real KB),
   plus a bounded per-browser history the admin can re-run against. ── */
export async function runModelAccuracyAudit() {
  try {
    if (!_tiga) initTigamodelWeb();
    const tiga = _tiga;
    // Layer 4 input: the REAL extended eval suite against the REAL provider registry
    let bestOverall, casesRun, provider;
    try {
      const results = await evaluateAllProvidersExtended(tiga.providers.list());
      const best = (results || []).reduce((a, b) => ((b && b.overall || 0) > (a && a.overall || 0) ? b : a), (results || [])[0] || null);
      if (best && Number.isFinite(best.overall)) { bestOverall = best.overall; casesRun = best.cases_run; provider = best.provider; }
    } catch (e) { /* no eval this run → the layer stays honestly unavailable */ }
    // Layer 5 input: the REAL compliance audit over the REAL KB
    let auditResult;
    try { auditResult = _auditKB([...tiga.kb._entries.values()], SOURCES); } catch (e) { /* unavailable → layer absent */ }
    const args = {
      getKBContext,
      policy: tiga && tiga.policy,
      generateStudentExercise: (...a) => generateStudentExercise(...a),
      kinds: (typeof studentExerciseKinds === "function") ? studentExerciseKinds() : [],
      bestOverall, casesRun, provider, auditResult,
      kbCount: tiga && tiga.kb ? tiga.kb.count() : null,
    };
    return _runModelAccuracyAudit(args);
  } catch (e) { return { overall: null, allPass: false, layers: [], unavailable: ["all"], ranAt: null, error: String(e?.message || e) }; }
}
export function accuracyAuditHistory() { return _loadAccHistory(typeof localStorage !== "undefined" ? localStorage : null); }
export function saveAccuracyAuditRun(run) { return _saveAccRun(typeof localStorage !== "undefined" ? localStorage : null, run); }
export function clearAccuracyAuditHistory() { return _clearAccHistory(typeof localStorage !== "undefined" ? localStorage : null); }

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

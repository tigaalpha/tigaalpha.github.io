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
import { SOURCES, COVERAGE, listSourceIds } from "./knowledge/university-sources.js";
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
export function getUniversitySources() { return { sources: SOURCES, coverage: COVERAGE, ids: listSourceIds() }; }

export { evaluateProvider, evaluateAllProviders, makeTIGARequest, createTeachingLoop, createTeachingPolicy };

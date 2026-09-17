/* ── tigamodel/index.js ──
   Entry point: buildPianoIntelligence() assembles the Phase 0 system.
   Nothing here imports React, App.tsx, or any app module — zero effect on
   the production bundle until Phase 1 wires a feature through it.

   Default registry: mock (always, as the guaranteed floor) + optional
   existing-backend adapter when an access token is provided. Passing your
   own providers list replaces both. ── */

import { createTeachingPolicy } from "./teaching/policy.js";
import { createTeachingLoop } from "./teaching/teaching-loop.js";
import { createSeededKnowledgeBase } from "./knowledge/knowledge-base.js";
import { buildStudentContextFromApp } from "./student/student-model.js";
import { createModelRouter } from "./providers/model-router.js";
import { registerProvider, listProviders, getProvider } from "./providers/provider-interface.js";
import { createMockProvider } from "./providers/mock-provider.js";
import { createExistingBackendAdapter } from "./providers/existing-backend-adapter.js";
import { makeTIGARequest } from "./core/schema.js";
import { philosophySystemPrompt } from "./teaching/philosophy.js";

export function buildPianoIntelligence({
  accessToken = null,
  providers = null, // [{ name, adapter }] custom registry; default = mock + existing-backend
  routerPolicy = { prefer_privacy: "balanced", prefer_cost: "balanced", min_quality: 0, provider_overrides: {}, fallback_provider: "mock" },
} = {}) {
  // teaching layer
  const policy = createTeachingPolicy();
  const kb = createSeededKnowledgeBase();
  const loop = createTeachingLoop({ policy, kb });

  // provider registry (fresh instance per build — no global leak)
  if (providers) {
    providers.forEach(({ name, adapter }) => registerProvider(name, adapter));
  } else {
    registerProvider("mock", createMockProvider());
    if (accessToken) registerProvider("existing-backend", createExistingBackendAdapter({ accessToken }));
  }

  const router = createModelRouter({ policy: routerPolicy });

  async function chat({ message, studentContext = null, taskType = "chat", history = [], options = {} } = {}) {
    const req = makeTIGARequest({ taskType, message, history, studentContext, options: { system: philosophySystemPrompt(studentContext?.language || "th"), ...options } });
    const { response, routed } = await router.route(req);
    return { response, routed, request: req };
  }

  return {
    version: "0.1.0-phase0",
    // teaching loop (rule-based, no model needed)
    loop,
    policy,
    kb,
    // student model
    buildStudentContextFromApp: (opts) => buildStudentContextFromApp({ ...opts }),
    // providers + router
    providers: { list: listProviders, get: getProvider },
    router,
    chat,
    // philosophy prompt for any surface that still calls the edge function directly
    philosophySystemPrompt,
  };
}

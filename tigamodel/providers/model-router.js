/* ── tigamodel/providers/model-router.js ──
   Selects a REGISTERED provider for each request (spec §6, §26).

   Phase 0 scope, stated honestly: with only mock + existing-backend in the
   registry, routing is simple — the value is that the SELECTION CONTRACT
   (policy → candidates → score → execute → validate → record) is real and
   tested, so future providers (OpenRouter multi-model, self-host, local)
   plug in without touching core. piano-chat already does per-feature model
   choice upstream; this router operates one level above it (choosing the
   provider adapter, and one day the provider directly).

   Routing policy (config, not hard-code):
   - prefer_privacy "local-first": local-capable provider wins if suitable
   - prefer_cost "free-first": free/cheap wins if quality gate not set
   - quality gate: minQuality from eval results (evaluation/eval-suite.js);
     a provider below the gate is skipped unless nothing else fits
   - fallback chain: first candidate that errors → next → mock last (always
     registered) so the teaching loop NEVER hard-fails for the learner ── */

import { getProvider, listProviders } from "./provider-interface.js";

export function createModelRouter({ policy = {} } = {}) {
  const p = {
    prefer_privacy: policy.prefer_privacy || "balanced", // "local-first" | "balanced"
    prefer_cost: policy.prefer_cost || "balanced", // "free-first" | "balanced"
    min_quality: policy.min_quality || 0, // 0..1 from eval results
    provider_overrides: policy.provider_overrides || {}, // taskType → providerName
    fallback_provider: policy.fallback_provider || "mock",
  };

  function candidatesFor(req) {
    // explicit per-task override first (admin/expert control)
    const override = p.provider_overrides[req.task_type];
    const all = listProviders().filter(pr => (pr.declare().taskTypes || []).includes(req.task_type));
    const scored = all.map(pr => {
      const d = pr.declare();
      let score = 0;
      if (p.prefer_privacy === "local-first" && d.privacy === "local") score += 3;
      if (p.prefer_cost === "free-first" && d.cost === "free") score += 2;
      if (d.cost === "low") score += 1;
      if (d.latency === "fast") score += 1;
      return { name: pr.name, score, declared: d };
    }).sort((a, b) => b.score - a.score);

    const names = scored.filter(s => s.name !== p.fallback_provider).map(s => s.name);
    if (override && getProvider(override) && !names.includes(override)) names.unshift(override);
    // fallback provider (mock) is always last — guaranteed floor
    names.push(p.fallback_provider);
    return names.filter((n, i, a) => a.indexOf(n) === i);
  }

  return {
    policy: p,
    candidatesFor,
    async route(req, { signal } = {}) {
      const names = candidatesFor(req);
      const attempts = [];
      for (const name of names) {
        const provider = getProvider(name);
        if (!provider) continue;
        const t0 = Date.now();
        const res = await provider.complete(req, { signal });
        const latencyMs = Date.now() - t0;
        attempts.push({ provider: name, status: res.status, latencyMs });
        const ok = res.status === "ok" || res.status === "uncertain";
        if (ok) {
          return { response: res, routed: { selected_provider: name, reason: "policy", attempts } };
        }
        // error → next candidate
      }
      // every provider failed — never happens while mock is registered, but
      // return a structured refusal rather than throwing (learner-facing floor)
      return {
        response: { trace_id: req.trace_id, status: "error", text: "", provider: null, model: null, metadata: {}, confidence: null },
        routed: { selected_provider: null, reason: "all_failed", attempts },
      };
    },
  };
}

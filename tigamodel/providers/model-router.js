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
     registered) so the teaching loop NEVER hard-fails for the learner

   Two later additions, both OFF unless a switch says otherwise and both
   honest about WHY a provider was picked:

   • m49 — a per-call preferCost override. When the cost governor reports the
     session is in its warn zone (≥80% of the free quota, docs/15 §4) the chat
     passes "free-first" so the cheap provider is tried FIRST; throttling stays
     the LAST resort (the governor, not the router, decides that).
   • m35 — short routing: a SMALL measured request (system + message + history
     characters, counted, never guessed) skips the big-model queue for a
     declared-fast/declared-free provider. Off by default (policy.short_routing
     = "off"); the size hint only ever ADDS score to providers that declared
     themselves fast/free, so it can never promote a provider on no evidence. ── */

import { getProvider, listProviders } from "./provider-interface.js";

/* m35: the honest size signal — the real characters this request would ship. */
export const SHORT_ROUTING_DEFAULTS = { smallChars: 1500, boost: 2 };
export function classifyRequestSize(req, { smallChars = SHORT_ROUTING_DEFAULTS.smallChars } = {}) {
  try {
    const r = req || {};
    const parts = [];
    const sys = r.options && r.options.system;
    if (sys) parts.push(String(sys));
    if (r.message) parts.push(String(r.message));
    for (const m of Array.isArray(r.history) ? r.history : []) parts.push(String((m && m.content) || ""));
    const chars = parts.reduce((a, s) => a + s.length, 0);
    const cap = Number.isFinite(smallChars) && smallChars > 0 ? smallChars : SHORT_ROUTING_DEFAULTS.smallChars;
    return { chars, small: chars > 0 && chars <= cap, smallChars: cap };
  } catch (e) { return { chars: 0, small: false, smallChars: SHORT_ROUTING_DEFAULTS.smallChars }; }
}

export function createModelRouter({ policy = {} } = {}) {
  const p = {
    prefer_privacy: policy.prefer_privacy || "balanced", // "local-first" | "balanced"
    prefer_cost: policy.prefer_cost || "balanced", // "free-first" | "balanced"
    min_quality: policy.min_quality || 0, // 0..1 from eval results
    provider_overrides: policy.provider_overrides || {}, // taskType → providerName
    fallback_provider: policy.fallback_provider || "mock",
    short_routing: policy.short_routing || "off", // m35: "off" | "auto" (default OFF)
    small_chars: Number.isFinite(policy.small_chars) && policy.small_chars > 0 ? Math.floor(policy.small_chars) : SHORT_ROUTING_DEFAULTS.smallChars,
  };

  /* m35: the owner's switch. Off = the shipped selection, byte-identical. */
  function setShortRouting(v) { p.short_routing = v === true || v === "auto" ? "auto" : "off"; return p.short_routing; }
  function isShortRoutingOn() { return p.short_routing === "auto"; }

  function candidatesFor(req, opts2 = {}) {
    const { preferCost = null, sizeHint = null } = opts2 || {};
    const cost_mode = preferCost || p.prefer_cost;
    // explicit per-task override first (admin/expert control)
    const override = p.provider_overrides[req.task_type];
    const all = listProviders().filter(pr => (pr.declare().taskTypes || []).includes(req.task_type));
    const size = sizeHint || (isShortRoutingOn() ? classifyRequestSize(req, { smallChars: p.small_chars }) : { small: false, chars: 0 });
    const scored = all.map(pr => {
      const d = pr.declare();
      let score = 0;
      if (p.prefer_privacy === "local-first" && d.privacy === "local") score += 3;
      if (cost_mode === "free-first" && d.cost === "free") score += 2;
      if (d.cost === "low") score += 1;
      if (d.latency === "fast") score += 1;
      /* m35: a measured-small request boosts ONLY providers that declared
         themselves fast or free — evidence, not a guess. */
      if (size && size.small) {
        if (d.latency === "fast") score += SHORT_ROUTING_DEFAULTS.boost;
        if (d.cost === "free") score += SHORT_ROUTING_DEFAULTS.boost;
      }
      return { name: pr.name, score, declared: d };
    }).sort((a, b) => b.score - a.score);

    const names = scored.filter(s => s.name !== p.fallback_provider).map(s => s.name);
    if (override && getProvider(override) && !names.includes(override)) names.unshift(override);
    // fallback provider (mock) is always last — guaranteed floor
    names.push(p.fallback_provider);
    return names.filter((n, i, a) => a.indexOf(n) === i);
  }

  /* The honest WHY for the selected provider, for routed.reason. */
  function routeReason(opts2 = {}) {
    const o = opts2 || {};
    if (o.preferCost === "free-first") return "warn_zone_free_first";
    if (o.sizeHint && o.sizeHint.small) return "small_task_short_route";
    return "policy";
  }

  return {
    policy: p,
    candidatesFor,
    classifyRequestSize,
    setShortRouting,
    isShortRoutingOn,
    async route(req, { signal, preferCost = null, sizeHint = null } = {}) {
      const opts2 = { preferCost, sizeHint };
      const names = candidatesFor(req, opts2);
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
          return { response: res, routed: { selected_provider: name, reason: routeReason(opts2), attempts } };
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

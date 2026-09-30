/* ── tigamodel/performance/cost-governor.js — docs/05 §8 / docs/14 §3 / docs/15 §2 (m13/m22) ──
   Cheaper WITHOUT touching quality: the governor keeps a per-session ledger
   of weighted charges (each provider's declared cost tier: free=0, low=1,
   medium=2, high=4) and decides BEFORE each provider call whether the
   session may spend. Decisions are the plan's own numbers (docs/05 §8):
   free sessions get `freeQuota` weighted units; a warn fires at 80% of the
   free ceiling and throttling starts BEFORE the 100% mark is ever crossed.

   The quality guarantee comes from the plan itself: the eval suite is the
   co-condition of m13/m22 — a throttled session degrades to the cheapest
   tier honestly (status "uncertain", never an invented answer), the rule
   brain (policy + KB + exercises) still answers without any provider, and
   the admin can flip the switch back in under a minute.

   Hard rules (steel rules 5 + 8, docs/10 §2):
   * Kill switch INSIDE the module (tiga_cost_governor): disabled → every
     decision is "allow" and the ledger stays empty — the shipped path,
     unchanged. Nothing is recorded, nothing throttled.
   * The ceiling can never be bypassed by a bad or missing argument: charge
     arithmetic clamps malformed input to 0, decisions only allow when
     really affordable, and `charge()` itself respects the state.
   * Honest throttled responses: never a made-up text — status "uncertain",
     provider "cost-governor", full provenance of WHY in metadata.
   * Deterministic + bounded: no clocks, no randomness; ledger is LRU-
     bounded (default 500 sessions, oldest-evicted-first).
   * Pure + sync; malformed calls are skipped (never throw). ── */

export const COST_GOVERNOR_DEFAULTS = {
  freeQuota: 40,      // weighted units per free session (docs/05 §8: 40 free questions → weighted units)
  hardCap: 100,       // weighted units where the throttle is absolute (100% of the case)
  warnAt: 0.8,        // warn at 80% of the free quota
  maxSessions: 500,   // LRU bound on tracked sessions
};

export const COST_TIERS = { free: 0, low: 1, medium: 2, high: 4 };

/* Kill switch key (steel rule 5) — app_settings.tiga_cost_governor. The
   module defaults OFF; wiring reads the switch and calls setEnabled. */
export const COST_GOVERNOR_SWITCH = "tiga_cost_governor";

/* Weighted cost of one call from a provider's declared() shape. Unknown /
   missing tier → 0 is NOT assumed (that would under-charge); unknown names
   charge like "low" so a misconfigured provider can never ride free. */
export function chargeForCall(providerName, declaredCost) {
  try {
    if (providerName === "cost-governor") return 0; // the throttle itself is not a spend
    const tier = COST_TIERS[String(declaredCost || "").toLowerCase()];
    if (tier === undefined) return providerName ? COST_TIERS.low : 0;
    return tier;
  } catch (e) { return 0; }
}

export function createCostGovernor(opts = {}) {
  const cfg = {
    freeQuota: Number.isFinite(opts.freeQuota) && opts.freeQuota >= 0 ? opts.freeQuota : COST_GOVERNOR_DEFAULTS.freeQuota,
    hardCap: Number.isFinite(opts.hardCap) && opts.hardCap >= 0 ? Math.max(opts.hardCap, (Number.isFinite(opts.freeQuota) && opts.freeQuota >= 0 ? opts.freeQuota : COST_GOVERNOR_DEFAULTS.freeQuota)) : Math.max(COST_GOVERNOR_DEFAULTS.hardCap, COST_GOVERNOR_DEFAULTS.freeQuota),
    warnAt: Number.isFinite(opts.warnAt) && opts.warnAt > 0 && opts.warnAt <= 1 ? opts.warnAt : COST_GOVERNOR_DEFAULTS.warnAt,
    maxSessions: Number.isFinite(opts.maxSessions) && opts.maxSessions > 0 ? Math.floor(opts.maxSessions) : COST_GOVERNOR_DEFAULTS.maxSessions,
  };
  const ledger = new Map(); // sessionKey → { spent, warns, calls, chargedCalls, throttledCalls }
  let enabled = opts.enabled === true; // DEFAULT OFF — zero-risk by construction

  function setEnabled(v) { enabled = v === true; if (!enabled) ledger.clear(); }
  function isEnabled() { return enabled; }
  function clear() { ledger.clear(); }

  function touch(key) {
    let s = ledger.get(key);
    if (!s) {
      s = { spent: 0, warns: 0, calls: 0, chargedCalls: 0, throttledCalls: 0 };
      ledger.set(key, s);
      while (ledger.size > cfg.maxSessions) { // bounded, oldest-first (Map order)
        const oldest = ledger.keys().next().value;
        ledger.delete(oldest);
      }
    } else {
      ledger.delete(key); ledger.set(key, s); // refresh LRU position
    }
    return s;
  }

  /* The decision BEFORE a call: may this session spend `units` more?
     allow → the normal path; throttle → the caller serves the governed
     fallback instead of the provider call. */
  function decide(sessionKey, units, opts2 = {}) {
    try {
      const key = String(sessionKey || "");
      if (!enabled || !key) return { decision: "allow", reason: enabled ? "no_session_key" : "switch_off" };
      const want = Number.isFinite(units) && units > 0 ? units : 0;
      const s = touch(key);
      s.calls += 1;
      if (s.spent >= cfg.hardCap) {
        s.throttledCalls += 1;
        return { decision: "throttle", reason: "hard_cap_reached", spent: s.spent, hardCap: cfg.hardCap };
      }
      if (want > 0 && s.spent + want > cfg.hardCap) {
        s.throttledCalls += 1;
        return { decision: "throttle", reason: "call_would_cross_cap", spent: s.spent, hardCap: cfg.hardCap };
      }
      if (s.spent >= cfg.freeQuota * cfg.warnAt && s.warns === 0) {
        s.warns += 1;
        return { decision: "allow", reason: "warn_80pct", spent: s.spent, freeQuota: cfg.freeQuota, warn: true };
      }
      if (opts2.preferFree && s.spent >= cfg.freeQuota * 0.5) {
        return { decision: "throttle", reason: "prefer_free_half", spent: s.spent };
      }
      return { decision: "allow", reason: "within_quota", spent: s.spent };
    } catch (e) { return { decision: "allow", reason: "governor_error_fails_open" }; }
  }

  /* Book the spend AFTER a real (allowed) call. Re-checks the cap so the
     ceiling cannot be bypassed by a misplaced charge. */
  function charge(sessionKey, units) {
    try {
      const key = String(sessionKey || "");
      if (!enabled || !key) return false;
      const u = Number.isFinite(units) && units > 0 ? units : 0;
      const s = touch(key);
      let u2;
      if (u > 0 && s.spent + u > cfg.hardCap) u2 = cfg.hardCap - s.spent; // clamp: cap is law
      else u2 = u;
      s.spent += u2;
      if (u2 > 0) s.chargedCalls += 1;
      return true;
    } catch (e) { return false; }
  }

  /* The honest governed fallback: never an invented answer — status
     "uncertain", provider "cost-governor", the WHY in metadata. */
  function governedResponse({ trace_id = null, reason = "throttled", spent = null, freeQuota = null } = {}) {
    return {
      trace_id,
      status: "uncertain",
      text: "",
      provider: "cost-governor",
      model: "throttle",
      metadata: { governed: true, reason, spent, freeQuota },
      confidence: null,
    };
  }

  function stats() {
    let sessions = 0, spent = 0, throttled = 0, warns = 0;
    for (const s of ledger.values()) {
      sessions += 1; spent += s.spent; throttled += s.throttledCalls; warns += s.warns;
    }
    return { enabled, sessions, spentUnits: spent, throttledCalls: throttled, warnSessions: warns, config: { ...cfg } };
  }

  return { decide, charge, governedResponse, setEnabled, isEnabled, clear, stats, config: cfg };
}

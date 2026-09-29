/* ── tigamodel/performance/answer-cache.js — docs/10 §1.1 (m32) ──
   Speed WITHOUT hallucination: the only shortcut we allow is remembering
   an answer that was already produced AND verified. The cache never invents
   anything — it can only return what a real provider once answered, with
   the full provenance of that answer attached.

   Hard rules (docs/10 §2):
   * ONLY status:"ok" answers are memorable. "uncertain"/"error"/anything
     else is never cached — an answer we were unsure about once must be
     re-thought every time, not frozen as truth.
   * ONLY answers at or above a confidence floor (default 0.85) are memorable.
   * The cache key includes everything that could change the answer:
     the message text AND the chat history — different context = different
     key, never a cross-context answer leak.
   * Size-bounded (default 200) with deterministic LRU eviction (oldest
     remembered-first) — no unbounded memory on a learner's device.
   * Kill switch honored INSIDE the module: when the switch is off, nothing
     is stored and nothing is served — zero code path relies on callers
     remembering to check.
   * Pure + sync; no I/O, no timers. The caller stays the owner of when
     to ask/record; a malformed call is skipped (never throws).

   Honest label: a cache HIT is always a REMEMBERED answer — consumers must
   surface provenance (resp.provider/model/trace) unchanged, which this
   module preserves byte-for-byte. ── */

export const ANSWER_CACHE_DEFAULTS = {
  maxEntries: 200,
  confidenceFloor: 0.85,   // below this = re-think every time
};

/* Kill switch key (steel rule 5): when admin wiring lands, this app_settings
   key is the single switch that turns remembering on/off. The module itself
   defaults OFF and re-checks the flag on every store/serve — no code path
   depends on callers remembering to gate. */
export const ANSWER_CACHE_SWITCH = "tiga_answer_cache";

/* normalizeKey({ message, history, taskType }) → stable cache key.
   History is included so the same words in a different conversation are a
   different key (docs/10 §2.2 — no cross-context leaks). */
export function answerCacheKey({ message = "", history = null, taskType = "chat" } = {}) {
  try {
    const msg = String(message == null ? "" : message).trim();
    if (!msg) return null;
    let hist = "";
    if (Array.isArray(history) && history.length) {
      hist = history.slice(-6).map(h => `${h && h.role != null ? String(h.role) : "?"}:${h && h.content != null ? String(h.content).trim().slice(0, 200) : ""}`).join("|");
    }
    return JSON.stringify([taskType, hist, msg]);
  } catch (e) { return null; }
}

/* createAnswerCache({ maxEntries, confidenceFloor, enabled }) → cache
   enabled is the kill switch state; callers typically read it from
   app_settings (default OFF — this module itself defaults enabled:false so
   wiring code can't accidentally turn remembering on). */
export function createAnswerCache(opts = {}) {
  const cfg = {
    maxEntries: Number.isFinite(opts.maxEntries) && opts.maxEntries > 0 ? Math.floor(opts.maxEntries) : ANSWER_CACHE_DEFAULTS.maxEntries,
    confidenceFloor: Number.isFinite(opts.confidenceFloor) ? opts.confidenceFloor : ANSWER_CACHE_DEFAULTS.confidenceFloor,
  };
  const store = new Map(); // key → response (Map order = insertion; oldest first)
  let enabled = opts.enabled === true; // DEFAULT OFF — zero-risk by construction

  function setEnabled(v) { enabled = v === true; if (!enabled) store.clear(); }
  function isEnabled() { return enabled; }
  function size() { return store.size; }
  function clear() { store.clear(); }

  /* Remember an answer ONLY if it is the kind we are allowed to remember.
     Returns true when stored. Uncertain/error/low-confidence → false. */
  function maybeRemember(key, response) {
    try {
      if (!enabled || !key || !response || typeof response !== "object") return false;
      if (response.status !== "ok") return false;              // rule 1: ok only
      const conf = response.confidence;
      if (typeof conf === "number" && conf < cfg.confidenceFloor) return false; // rule 2
      if (store.has(key)) store.delete(key);                   // refresh → newest position
      store.set(key, response);
      while (store.size > cfg.maxEntries) {                    // rule 4: bounded, LRU
        const oldest = store.keys().next().value;
        store.delete(oldest);
      }
      return true;
    } catch (e) { return false; }
  }

  /* Serve a remembered answer, or null. The response returned is the
     ORIGINAL object — provenance (provider/model/trace/metadata) intact. */
  function lookup(key) {
    try {
      if (!enabled || !key || !store.has(key)) return null;
      const resp = store.get(key);
      store.delete(key); store.set(key, resp); // touch → newest position
      return resp;
    } catch (e) { return null; }
  }

  return { maybeRemember, lookup, setEnabled, isEnabled, size, clear, config: cfg };
}

/* Convenience wrapper matching the chat() call shape of buildPianoIntelligence:
   chatThroughCache({ tiga, message, history, taskType, studentContext, cache })
   - cache miss/off → the real (unchanged) chat path runs, result remembered if allowed
   - cache hit → remembered answer returned instantly, provenance preserved
   Returns { response, routed, request, cache_hit, cache_provenance? } */
export async function chatThroughCache({ tiga, cache, message, history = [], taskType = "chat", studentContext = null, options = {} } = {}) {
  const key = answerCacheKey({ message, history, taskType });
  if (cache && key) {
    const hit = cache.lookup(key);
    if (hit) {
      return { response: hit, routed: { selected_provider: hit.provider ?? null, reason: "answer_cache_hit", attempts: [] }, request: null, cache_hit: true, cache_provenance: { remembered: true, provider: hit.provider ?? null, model: hit.model ?? null, trace_id: hit.trace_id ?? null } };
    }
  }
  const out = await tiga.chat({ message, studentContext, taskType, history, options });
  if (cache && key && out && out.response) {
    const stored = cache.maybeRemember(key, out.response);
    if (stored) out.cache_provenance = { remembered: true, provider: out.response.provider ?? null, model: out.response.model ?? null, trace_id: out.response.trace_id ?? null };
  }
  out.cache_hit = false;
  return out;
}

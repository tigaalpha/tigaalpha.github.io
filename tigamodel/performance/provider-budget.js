/* ── tigamodel/performance/provider-budget.js — docs/15 §4 (m36/m48) ──
   A provider that is too slow must not leave the learner staring at nothing.
   This module gives every provider call a real deadline and, when it is
   exceeded, hands back the app's OWN verified answer instead of a stall: the
   rule brain (the same KB lines the chat already builds, each carrying its
   label) — real content, with its sources, never an invented sentence.

   The fallback is deliberately NOT dressed up as a model answer:
   status "uncertain", provider "rule-brain", metadata.sources lists the labels
   that were actually served, and metadata.reason says WHY the live model was
   not used. A learner (and the app) can always tell the difference.

   Hard rules (steel rules 1/2/5/8):
   * Kill switch INSIDE the module (tiga_provider_budget), DEFAULT OFF: with it
     off, callWithBudget returns the provider's result untouched — the shipped
     path, byte-identical, no timer, no fallback.
   * Quality is a co-condition: the fallback only ever carries knowledge the
     compliance gate already checked (tiga-* sources, no medical claims).
   * Deterministic + pure-ish: the clock is injected (now()), never read from a
     global, and malformed input is skipped (never throws).
   * Bounded: at most `maxLines` KB lines are ever shown, so a fallback can
     never become a second 1.4 MB dump. ── */

export const PROVIDER_BUDGET_DEFAULTS = {
  softMs: 8000,   // past this the answer is marked slow (metadata only, still answered)
  hardMs: 20000,  // past this the live call is abandoned for the rule-brain answer
  maxLines: 6,    // the fallback shows at most this many verified KB lines
};

/* Kill switch key (steel rule 5) — app_settings.tiga_provider_budget. */
export const PROVIDER_BUDGET_SWITCH = "tiga_provider_budget";

/* Honest fallback text lead, per language. The lines that follow are the app's
   own knowledge lines (label + title + how to teach), not model prose. */
export const FALLBACK_LEAD = {
  th: "ตอบนี้มาจากคลังความรู้ของครู (โมเดลตอบช้าเกินกำหนด) — ทุกบรรทัดคือหลักการสอนที่ผ่านการตรวจแล้ว:",
  en: "This answer comes from the teacher's knowledge base (the model was too slow) — every line is a checked teaching principle:",
  zh: "此回答来自老师的知识库（模型响应超时）——每一行都是已审核的教学原则：",
};

/* Pull the served knowledge lines out of a KB block (the exact lines the chat
   would have given the model) and pair them with the honest lead. Returns null
   when there is nothing real to show — the caller then keeps its own error. */
export function kbFallbackResponse({ block, reason = "provider_budget_exceeded", lang = "th", provider = null, budgetMs = null, maxLines = PROVIDER_BUDGET_DEFAULTS.maxLines } = {}) {
  try {
    const cap = Number.isFinite(maxLines) && maxLines > 0 ? Math.floor(maxLines) : PROVIDER_BUDGET_DEFAULTS.maxLines;
    const lines = String(block || "")
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.startsWith("• "))
      .slice(0, cap)
      .map(l => l.replace(/^•\s*/, "").replace(/\s*—\s*วิธีสอน:\s*/, " — "));
    if (!lines.length) return null;
    const lead = FALLBACK_LEAD[lang] || FALLBACK_LEAD.th;
    const sources = lines.map(l => {
      const m = /^\[([^\]]+)\]/.exec(l);
      return m ? m[1] : null;
    }).filter(Boolean);
    return {
      status: "uncertain",
      text: `${lead}\n• ${lines.join("\n• ")}`,
      provider: "rule-brain",
      model: "knowledge-fallback",
      confidence: null,
      metadata: { governed: true, reason, provider, budgetMs, sources, honest: "คำตอบจากคลังความรู้ ไม่ใช่คำตอบที่โมเดลเขียน" },
    };
  } catch (e) { return null; }
}

export function createProviderBudget(opts = {}) {
  const num = (v, d) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : d);
  const cfg = {
    softMs: num(opts.softMs, PROVIDER_BUDGET_DEFAULTS.softMs),
    hardMs: num(opts.hardMs, PROVIDER_BUDGET_DEFAULTS.hardMs),
    maxLines: num(opts.maxLines, PROVIDER_BUDGET_DEFAULTS.maxLines),
  };
  let enabled = opts.enabled === true; // DEFAULT OFF — zero-risk by construction
  let clock = typeof opts.now === "function" ? opts.now : () => Date.now();

  function setEnabled(v) { enabled = v === true; }
  function isEnabled() { return enabled; }
  function setNow(fn) { if (typeof fn === "function") clock = fn; }

  /* callWithBudget({ name, run, fallback, softMs, hardMs })
     - OFF → `await run()` returned untouched, no timer at all
     - ON  → the call races a hard deadline; the winner decides:
         resolved  → the real answer, tagged metadata.slow when it was late
         timed out → fallback({ reason, provider, budgetMs }) — the caller's
                      honest rule-brain answer, or null if it has none
     Errors are NOT swallowed: they propagate to the caller's own path, exactly
     as before. */
  async function callWithBudget({ name = null, run, fallback = null, softMs = null, hardMs = null } = {}) {
    if (typeof run !== "function") return null;
    if (!enabled) return run();
    const hard = num(hardMs, cfg.hardMs);
    const soft = num(softMs, cfg.softMs);
    const t0 = clock();
    let timer = null;
    try {
      const work = Promise.resolve().then(() => run());
      const guard = new Promise((resolve) => {
        timer = setTimeout(() => resolve({ __timeout: true }), hard);
      });
      const won = await Promise.race([work.then(v => ({ value: v })), guard]);
      if (won && won.__timeout) {
        const fb = typeof fallback === "function" ? fallback({ reason: "provider_budget_exceeded", provider: name, budgetMs: hard }) : null;
        return fb;
      }
      const value = won ? won.value : undefined;
      const elapsed = clock() - t0;
      if (value && typeof value === "object" && elapsed > soft) {
        try { value.metadata = { ...(value.metadata || {}), slow: true, elapsedMs: elapsed, softMs: soft }; } catch (e) {}
      }
      return value;
    } finally {
      if (timer) { try { clearTimeout(timer); } catch (e) {} }
    }
  }

  function stats() { return { enabled, config: { ...cfg } }; }

  return { callWithBudget, setEnabled, isEnabled, setNow, stats, config: cfg };
}

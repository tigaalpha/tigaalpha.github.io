/* ── tigamodel/learning/self-learner.js ──
   The model's SELF-LEARNING engine (owner directive 2026-09-18): the model
   can learn and update its own knowledge WITHOUT a redeploy — but ONLY when
   the owner's master switch (app_settings.ai_self_learn.enabled) is ON.

   Nothing here runs on a timer or collects anything silently:
   • learning FROM the owner happens ONLY at the moment the owner (admin
     tier ≥ 3) sends a teach message in the admin chat — the reply's own
     facts/strategies become candidate KB entries (source: "admin-taught").
   • reinforcement happens ONLY from signed-in learners' practice outcomes
     (accuracy + strategy_id from the teaching loop) — a strategy that
     measurably helps gets confidence nudged UP (bounded +0.02 per event,
     capped 0.85); one that correlates with worse next-attempt accuracy
     drifts DOWN. This is the Phase-0 stand-in for the gated outcome
     dataset (roadmap #89) — same philosophy: observe ≠ conclude, so every
     adjustment carries evidence and stays within hard bounds.

   Storage: Supabase app_settings key "ai_self_learn" —
     { enabled: bool, updated_at, entries: { [id]: {domain,title,body,teach,
       confidence, source, created_at, hits, up, down} }, stats: {...} }
   The whole store fits one jsonb row (entries are compact; cap 200, evict
   lowest-confidence-first when full). No new tables → no migration needed.

   Safety (philosophy.js compliance):
   • admin-taught entries cap at confidence 0.8 (below university-sourced
     facts), typed "expert-opinion" — the owner's word is authoritative
     teaching guidance, not verified fact.
   • reinforced entries never exceed 0.85.
   • clearLearned() wipes everything; toggle OFF stops all learning and
     injection immediately (getLearnedKBContext returns "" when disabled). ── */

export const SELF_LEARN_CAP = 200;
export const CONF_MAX_ADMIN = 0.8;
export const CONF_MAX_REINFORCED = 0.85;
const STEP_UP = 0.02;
const STEP_DOWN = 0.03;

function clampConf(v, cap) { return Math.max(0.05, Math.min(cap, Number(v) || 0.5)); }

export function createSelfLearner({ load, save } = {}) {
  /* load()/save() are injected by web.js (app_settings-backed, async).
     In-memory cache mirrors the server row; every mutator persists. */
  let cache = null;          // { enabled, entries, stats }
  let pending = null;        // in-flight save promise (serialization)

  async function read() {
    if (cache) return cache;
    try {
      const v = load ? await load() : null;
      cache = (v && typeof v === "object" && v.entries && typeof v.entries === "object")
        ? { enabled: !!v.enabled, entries: v.entries, stats: v.stats && typeof v.stats === "object" ? v.stats : { learned: 0, reinforced: 0 } }
        : { enabled: false, entries: {}, stats: { learned: 0, reinforced: 0 } };
    } catch (e) {
      cache = { enabled: false, entries: {}, stats: { learned: 0, reinforced: 0 } };
    }
    return cache;
  }

  async function persist() {
    if (!save || !cache) return;
    const snapshot = JSON.parse(JSON.stringify(cache));
    const p = save(snapshot);
    pending = (pending ? pending.then(() => p, () => p) : p);
    try { await pending; } catch (e) { /* keep in-memory truth; caller sees error via log */ }
  }

  /* ── master switch (the owner's ON/OFF in Model Lab) ── */
  async function isEnabled() { return (await read()).enabled; }

  async function setEnabled(on) {
    const s = await read();
    s.enabled = !!on;
    await persist();
    return s.enabled;
  }

  /* ── learning from the owner's admin-chat teaching ──
     extractCandidates(replyText): split the reply into candidate facts.
     Phase-0 heuristic (honest about being heuristic): each bullet/line with
     a "fact-like" shape becomes ONE candidate; the admin sees them in the
     Model Lab's Self-Learning tab where any can be removed. Long replies
     yield at most 6 candidates per message. */
  function extractCandidates(replyText) {
    const text = String(replyText || "");
    const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
    const cands = [];
    for (const line of lines) {
      const cleaned = line.replace(/^[•\-*\d]+[.)]?\s*/, "").trim();
      if (cleaned.length < 25 || cleaned.length > 400) continue;
      // skip obvious meta/greeting/error lines
      if (/^(ok|เข้าใจ|สวัสดี|error|⚠)/i.test(cleaned)) continue;
      cands.push(cleaned);
      if (cands.length >= 6) break;
    }
    return cands;
  }

  /* learnFromAdmin: store candidates as learned entries (dedup by id).
     Returns how many NEW entries were stored. No-op when switch is OFF. */
  async function learnFromAdmin(replyText, { domain = "pedagogy" } = {}) {
    const s = await read();
    if (!s.enabled) return { learned: 0, skipped: "switch-off" };
    const cands = extractCandidates(replyText);
    let learned = 0;
    for (const body of cands) {
      const id = "learn:" + hashId(body);
      if (s.entries[id]) continue;
      if (Object.keys(s.entries).length >= SELF_LEARN_CAP) evictLowest(s.entries);
      s.entries[id] = {
        id, type: "expert-opinion", domain,
        title: body.length > 60 ? body.slice(0, 57) + "…" : body,
        body, teach: body,
        confidence: 0.65, source: "admin-taught",
        created_at: new Date().toISOString(),
        hits: 0, up: 0, down: 0,
      };
      learned++;
      s.stats.learned = (s.stats.learned || 0) + 1;
    }
    if (learned) await persist();
    return { learned };
  }

  function hashId(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function evictLowest(entries) {
    let worstId = null, worstC = 2;
    for (const [id, e] of Object.entries(entries)) {
      const score = (e.confidence || 0) + (e.up || 0) * 0.01 - (e.down || 0) * 0.02;
      if (score < worstC) { worstC = score; worstId = id; }
    }
    if (worstId) delete entries[worstId];
  }

  /* ── outcome reinforcement (roadmap #89 Phase-0 stand-in) ──
     Called by use-practice-mode's finishPractice with the loop's strategy_id
     and this attempt's accuracy. Confidence moves a bounded step per event.
     Only signed-in flows reach here (guests never call finishPractice's AI
     path), and nothing identifies the learner — aggregate signal only. */
  async function reinforceOutcome({ strategyId, accuracy, prevAccuracy } = {}) {
    const s = await read();
    if (!s.enabled) return { applied: false, reason: "switch-off" };
    if (!strategyId || typeof accuracy !== "number") return { applied: false, reason: "no-signal" };
    // find the learned entry that matches this strategy (or the loop's own
    // strategy entries are reinforced on the "continue-current-plan" default)
    const ids = Object.keys(s.entries).filter(id => id === "learn:strat:" + strategyId);
    let changed = false;
    for (const id of ids) {
      const e = s.entries[id];
      const improved = prevAccuracy == null ? accuracy >= 80 : accuracy > prevAccuracy;
      e.confidence = clampConf(e.confidence + (improved ? STEP_UP : -STEP_DOWN), CONF_MAX_REINFORCED);
      if (improved) e.up = (e.up || 0) + 1; else e.down = (e.down || 0) + 1;
      changed = true;
    }
    if (changed) { s.stats.reinforced = (s.stats.reinforced || 0) + 1; await persist(); }
    return { applied: changed };
  }

  /* register a strategy→learned-entry link so reinforcement can find it */
  async function linkStrategy(strategyId, entryId) {
    const s = await read();
    if (!s.enabled || !strategyId || !entryId) return false;
    const src = s.entries[entryId];
    if (!src) return false;
    const id = "learn:strat:" + strategyId;
    if (!s.entries[id]) {
      s.entries[id] = { ...src, id, title: "กลยุทธ์: " + src.title, body: src.body, teach: src.teach, strategy: strategyId, hits: 0, up: 0, down: 0 };
      await persist();
    }
    return true;
  }

  /* ── injection: learned entries as a KB context block (used by getKBContext
     and the admin-chat system prompt). Empty string when switch is OFF. ── */
  async function getLearnedKBContext(matchText) {
    const s = await read();
    if (!s.enabled) return "";
    const entries = Object.values(s.entries).filter(e => !e.strategy);
    if (!entries.length) return "";
    const text = String(matchText || "").toLowerCase();
    // topical match when text given; otherwise top-confidence entries
    const matched = text
      ? entries.filter(e => text.includes(String(e.domain)) || (e.body || "").toLowerCase().split(/\s+/).some(w => w.length > 5 && text.includes(w)))
      : entries;
    const pool = (matched.length ? matched : entries)
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 6);
    if (!pool.length) return "";
    return (
      "\n\n[TIGA LEARNED KNOWLEDGE — from the owner's own teaching (source: admin-taught). Follow these when relevant; they outrank generic advice.]\n" +
      pool.map(e => `• [LEARNED/${e.domain}] ${e.body}`).join("\n") + "\n"
    );
  }

  /* manual ops for the Model Lab UI */
  async function removeEntry(id) {
    const s = await read();
    if (s.entries[id]) { delete s.entries[id]; await persist(); }
    return Object.keys(s.entries).length;
  }
  async function clearLearned() {
    const s = await read();
    s.entries = {};
    s.stats = { learned: 0, reinforced: 0 };
    await persist();
  }
  async function snapshot() {
    const s = await read();
    return { enabled: s.enabled, stats: { ...s.stats }, entries: Object.values(s.entries).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")) };
  }

  return {
    isEnabled, setEnabled,
    learnFromAdmin, extractCandidates,
    reinforceOutcome, linkStrategy,
    getLearnedKBContext,
    removeEntry, clearLearned, snapshot,
  };
}

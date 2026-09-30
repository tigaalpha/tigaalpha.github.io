/* ── tigamodel/teaching/strategy-analyzer.js ──
   Strategy Effect Analyzer (docs/05 §1) — the first leg of the loop that was
   missing (docs/04 §1.4): real learner outcomes flowing back into teaching
   policy. Reads the effectiveness aggregate the teaching_outcomes migration
   already publishes (RPC `admin_strategy_effectiveness`, applied to
   production — per-row shape: { strategy_id, n, avg_before, avg_after,
   delta, improved }), computes a weight per strategy, and hands the weights
   to the teaching policy by REORDERING its rules (policy.js picks the first
   matching rule, so rank-by-evidence is the honest lever: it changes which
   strategy wins ties-of-applicability, never fakes a probability).

   Guardrails (docs/05 steel rules 3–6):
   - pure core, no I/O — the caller (admin UI / future scheduled job) owns
     fetching the rows and persisting app_settings.tiga_policy_weights
   - clamp 0.5–2.0; a strategy with < MIN_SAMPLES outcomes keeps weight 1.0
     (unknown ≠ good ≠ bad)
   - every clamp/count boundary is covered by smoke-strategy-analyzer.mjs
   - kill switch: weights object without enabled:true, or an unknown shape,
     applies nothing — policy stays exactly as shipped ── */

export const MIN_SAMPLES = 5;
export const WEIGHT_MIN = 0.5;
export const WEIGHT_MAX = 2.0;

/* delta = avg_after − avg_before, in whatever unit the outcome rows carry.
   A wide but finite squashing keeps ranking while damping small-sample
   noise; 1/(1+exp(−delta)) maps ℝ→(0,1) without any unit assumption, then
   linear-stretches (0,1) onto [WEIGHT_MIN, WEIGHT_MAX]. */
export function deltaToWeight(delta) {
  const d = Number(delta);
  if (!Number.isFinite(d)) return 1.0;
  const unit = 1 / (1 + Math.exp(-d));
  return WEIGHT_MIN + unit * (WEIGHT_MAX - WEIGHT_MIN);
}

export function computePolicyWeights(rows, { minSamples = MIN_SAMPLES } = {}) {
  if (!Array.isArray(rows)) return {};
  const out = {};
  for (const r of rows) {
    if (!r || typeof r.strategy_id !== "string" || !r.strategy_id) continue;
    const n = Number(r.n);
    if (!Number.isFinite(n) || n < minSamples) { out[r.strategy_id] = 1.0; continue; } // unknown → neutral
    const w = deltaToWeight(r.delta);
    out[r.strategy_id] = Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, w)); // hard clamp, always
  }
  return out;
}

/* Apply weights to a policy built by createTeachingPolicy() (policy.js):
   reorder `rules` so higher weight = tried first. First-match-wins semantics
   are untouched; rules without a weight keep their original relative order
   (stable sort). Mutates nothing — returns a new rules array. Returns null
   when the switch is off or the shape is foreign, so callers can tell
   "disabled" apart from "no change". */
export function applyPolicyWeights(rules, weights) {
  if (!Array.isArray(rules)) return null;
  if (!weights || typeof weights !== "object" || weights.enabled !== true) return null;
  const w = weights.weights;
  if (!w || typeof w !== "object") return null;
  const keyed = rules.map((rule, i) => ({ rule, i, weight: Number(w[rule.id]) }));
  if (keyed.every(k => !Number.isFinite(k.weight))) return null; // nothing applicable → disabled
  return keyed
    .map(k => ({ ...k, sort: Number.isFinite(k.weight) ? k.weight : 1.0 }))
    .sort((a, b) => (b.sort - a.sort) || (a.i - b.i))
    .map(k => k.rule);
}

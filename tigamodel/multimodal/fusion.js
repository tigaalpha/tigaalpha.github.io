/* ── tigamodel/multimodal/fusion.js — §7 Multimodal fusion v1 (m12) ──
   THE deterministic arbiter for combining student-state signals from
   multiple channels (performance, session, history, conversation, and —
   when their encoders come online — consented vision/audio; §16 forbidden
   uses stay out by DESIGN: default weight 0 + no mood channel exists).

   Contract (acceptance, plan-v3 m12):
   * 3 conflicting signals, deterministic → the higher-CONFIDENCE side wins
     every state, every call (same input → byte-identical output).
   * Per-channel weight can be set to 0 = kill switch: that channel is
     excluded entirely, no matter how confident it claims to be.
   * §17 dominance: a self_report signal for a state wins that state
     outright — the student's own answer is never averaged away.
   * Malformed input never crashes: bad entries are skipped, unusable
     input → null. Errors → null (enhancement, never a crash path).

   Pure + sync; no I/O. Output carries provenance (which channel won, what
   lost, weighted scores) so every fused claim is auditable. ── */

import { makeStudentStateEstimate } from "../core/schema.js";

/* Default channel weights. vision/audio start at 0 until a real, consented
   encoder registers (mirrors state-estimator.js MODALITY_WEIGHTS + the
   honest registry in interfaces.js — impossible to overclaim by accident). */
export const DEFAULT_CHANNEL_WEIGHTS = {
  performance:  0.7,
  session:      0.7,
  history:      0.5,
  self_report:  1.0,   // dominance rule anyway; weight documents intent
  conversation: 0.4,
  vision:       0.0,   // §16: no mood-from-face — reserved, consented signals only
  audio:        0.0,   // reserved for future piano-audio engine (§20)
};

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function isNum(x) { return typeof x === "number" && Number.isFinite(x); }

/* Normalise one raw signal into a usable record, or null if malformed.
   Accepts { channel, state, probability, confidence, evidence, alternatives }. */
function normalizeSignal(raw) {
  try {
    if (!raw || typeof raw !== "object") return null;
    const channel = typeof raw.channel === "string" ? raw.channel.trim() : "";
    const state = typeof raw.state === "string" ? raw.state.trim() : "";
    if (!channel || !state) return null;
    if (!isNum(raw.probability)) return null;
    return {
      channel,
      state,
      probability: clamp01(raw.probability),
      confidence: clamp01(isNum(raw.confidence) ? raw.confidence : 0.5),
      evidence: Array.isArray(raw.evidence) ? raw.evidence.filter(v => typeof v === "string").slice(0, 3) : [],
      alternatives: Array.isArray(raw.alternatives) ? raw.alternatives.filter(v => typeof v === "string").slice(0, 3) : [],
    };
  } catch (e) { return null; }
}

/* fuseMultimodalSignals({ signals, weights }) → fused[] | null
   - signals: raw channel observations (see normalizeSignal)
   - weights: optional { channel: number } overrides on DEFAULT_CHANNEL_WEIGHTS
     (a channel with weight 0 is a hard kill switch — fully excluded)
   Returns one fused estimate per state, sorted by weighted confidence desc
   (then state name asc — deterministic). Provenance embedded per estimate
   in `fusion` metadata: winner, losers with weighted scores, weights used. */
export function fuseMultimodalSignals(args) {
  const { signals = null, weights = null } = args && typeof args === "object" ? args : {};
  try {
    if (!Array.isArray(signals)) return null;
    const w = { ...DEFAULT_CHANNEL_WEIGHTS, ...(weights && typeof weights === "object" ? weights : {}) };
    /* normalise + attach effective weight; weight-0 channels are killed */
    const usable = [];
    for (const raw of signals) {
      const s = normalizeSignal(raw);
      if (!s) continue;
      const weight = w[s.channel];
      if (!isNum(weight) || weight <= 0) continue;   // kill switch / unknown channel
      usable.push({ ...s, weight });
    }
    if (!usable.length) return null;

    /* group by state; per state pick the winner deterministically:
       1) self_report dominance (§17) — first self_report signal wins;
       2) else highest weighted confidence (weight × confidence);
       3) tie → higher raw confidence;
       4) still tied → lexicographically smaller channel id (documented,
          deterministic — never "whichever came first in the array"). */
    const byState = new Map();
    for (const s of usable) {
      if (!byState.has(s.state)) byState.set(s.state, []);
      byState.get(s.state).push(s);
    }
    const out = [];
    for (const state of [...byState.keys()].sort()) {
      const group = byState.get(state);
      let winner;
      const sr = group.find(s => s.channel === "self_report");
      if (sr) {
        winner = { s: sr, mode: "self_report_dominance" };
      } else {
        let best = null;
        for (const s of group) {
          if (!best) { best = s; continue; }
          const a = s.weight * s.confidence, b = best.weight * best.confidence;
          if (a > b
            || (a === b && s.confidence > best.confidence)
            || (a === b && s.confidence === best.confidence && s.channel < best.channel)) best = s;
        }
        winner = { s: best, mode: "weighted_confidence" };
      }
      const win = winner.s;
      const others = group.filter(s => s !== win);
      const losers = others.map(s => ({
        channel: s.channel, weighted_confidence: Math.round(s.weight * s.confidence * 1000) / 1000,
        probability: s.probability,
      }));
      const evidence = [...new Set([...win.evidence, ...others.flatMap(s => s.evidence)])].slice(0, 8);
      const alternatives = [...new Set(group.flatMap(s => s.alternatives))].slice(0, 5);
      const est = makeStudentStateEstimate({
        state,
        probability: win.probability,
        confidence: clamp01(win.confidence),
        evidence,
        modalities: [...new Set(group.map(s => s.channel))],
        alternatives,
      });
      /* provenance: every fused claim is auditable (winner + who lost + how) */
      est.fusion = {
        mode: winner.mode,
        winner_channel: win.channel,
        winner_weighted_confidence: Math.round(win.weight * win.confidence * 1000) / 1000,
        weights_used: { ...w },
        losers,
        deterministic: true,
      };
      out.push(est);
    }
    /* sort: strongest evidence first, state name breaks exact ties */
    out.sort((a, b) =>
      (b.fusion.winner_weighted_confidence - a.fusion.winner_weighted_confidence)
      || (a.state < b.state ? -1 : a.state > b.state ? 1 : 0));
    return out;
  } catch (e) { return null; }
}

/* Convenience: fuse + keep only states above a confidence floor (default 0.5)
   — callers that act on fused states use this so weak inferences stay as
   evidence, never as teaching decisions. */
export function confidentFusion(args, floor = 0.5) {
  const fused = fuseMultimodalSignals(args && typeof args === "object" ? args : null);
  if (!fused) return null;
  const kept = fused.filter(f => f.confidence >= floor);
  return kept.length ? kept : null;
}

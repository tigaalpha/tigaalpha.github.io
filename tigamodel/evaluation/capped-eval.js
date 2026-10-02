/* ── tigamodel/evaluation/capped-eval.js — docs/14 §2 (m46) ──
   "โค้ดเร็วขึ้นแล้วคุณภาพไม่ตก" must be PROVEN, not felt. The hot path
   (m34) serves a capped, relevance-ranked selection where the legacy path
   served everything; this module runs the REAL retrieval probes against both
   paths and reports the two numbers the plan actually asks for:

     1. QUALITY — per probe, the served labels and the probe's score, legacy vs
        capped. The gate is `noRegression`: no probe may score LOWER with the
        cap on. (Same scorer the retrieval gate uses — no second opinion.)
     2. COST — the characters actually shipped, and a clearly-labelled token
        ESTIMATE (chars/4, the usual rough rule) so nobody mistakes it for a
        tokenizer reading.

   Hard rules: pure + deterministic (same inputs → same report), malformed
   input is skipped (never throws), and every number printed here is measured
   from the blocks the production function returned. ── */

import { RETRIEVAL_PROBES, servedLabels, scoreRetrieval } from "./retrieval-eval.js";

/* chars per token for the ESTIMATE only — the real tokenizer count depends on
   the model, so this is labelled as an estimate everywhere it is reported. */
export const TOKEN_ESTIMATE_CHARS_PER_TOKEN = 4;

export function compareCappedVsLegacy({ legacy, capped, probes = RETRIEVAL_PROBES } = {}) {
  try {
    const list = Array.isArray(probes) ? probes : [];
    const rows = [];
    for (const p of list) {
      const lb = String(legacy && legacy(p && p.q) || "");
      const cb = String(capped && capped(p && p.q) || "");
      rows.push({
        id: (p && p.id) || "?",
        legacyScore: scoreRetrieval(p, servedLabels(lb)),
        cappedScore: scoreRetrieval(p, servedLabels(cb)),
        legacyChars: lb.length,
        cappedChars: cb.length,
        legacyLines: lb.split("\n").filter(l => l.startsWith("• ")).length,
        cappedLines: cb.split("\n").filter(l => l.startsWith("• ")).length,
      });
    }
    const regressions = rows.filter(r => r.cappedScore < r.legacyScore);
    const legacyChars = rows.reduce((a, r) => a + r.legacyChars, 0);
    const cappedChars = rows.reduce((a, r) => a + r.cappedChars, 0);
    const legacyCorrect = rows.filter(r => r.legacyScore === 1).length;
    const cappedCorrect = rows.filter(r => r.cappedScore === 1).length;
    return {
      probes: rows.length,
      rows,
      regressions,
      noRegression: regressions.length === 0,
      legacyCorrect,
      cappedCorrect,
      accuracyLegacy: rows.length ? legacyCorrect / rows.length : 0,
      accuracyCapped: rows.length ? cappedCorrect / rows.length : 0,
      legacyChars,
      cappedChars,
      shrink: legacyChars > 0 ? 1 - cappedChars / legacyChars : 0,
      tokenEstimate: {
        charsPerToken: TOKEN_ESTIMATE_CHARS_PER_TOKEN,
        legacy: Math.round(legacyChars / TOKEN_ESTIMATE_CHARS_PER_TOKEN),
        capped: Math.round(cappedChars / TOKEN_ESTIMATE_CHARS_PER_TOKEN),
        note: "ประมาณการจากจำนวนตัวอักษรจริง (chars/4) — ไม่ใช่การนับด้วย tokenizer ของโมเดล",
      },
    };
  } catch (e) {
    return { probes: 0, rows: [], regressions: [], noRegression: false, legacyCorrect: 0, cappedCorrect: 0, accuracyLegacy: 0, accuracyCapped: 0, legacyChars: 0, cappedChars: 0, shrink: 0, tokenEstimate: { charsPerToken: TOKEN_ESTIMATE_CHARS_PER_TOKEN, legacy: 0, capped: 0, note: "measurement failed — no numbers invented" } };
  }
}

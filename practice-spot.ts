/* ── practice-spot.ts — Spot Drill target builder (Practice Mode v4 plan §2.1) ──
   Reference implementation of the plan's hardest contract, written BEFORE the
   UI wiring so the contract is proven by test, not by prose. Pure, no React,
   no audio, no DOM, no imports — dependency-free on purpose so
   tigamodel/scripts/smoke-practice-spot.mjs can import it directly (same
   convention as mistake-drill.ts's header).

   Job: given a finished practice round's per-index miss data, cut a SUBSET
   drill containing only the notes (or whole chords) that were missed, in
   song order, capped in size, with all progression identifiers stripped.

   The five correctness traps this file exists to avoid (plan §0.5):
   T2 — the caller must NOT hand the expanded target back through
        startPractice's scale expansion. A spot drill is emitted with
        mode:"seq" (the plain listen-and-grade mode), so startPractice's
        `if (seq.mode === "scale")` branch can never re-expand it. Ascending
        order is preserved from the original ascending notes; the up+down
        shape is intentionally NOT part of a spot drill (you drill the hard
        notes, not the shape).
   T3 — stageId and bossGroup are never copied into the output object at
        all (not set to null — absent), so finishPractice's
        markPathDone/markBossDone can never fire from a subset run, and the
        Drill Deck save can't overwrite a real stage's record shape.
   T4 — chord/prog+block rounds are cut WHOLE-CHORD (any chord containing a
        missed index), never per-note, and the surviving chords' uniform
        size is re-derived so the block-grading window stays honest.
   T6 — the drill's own bpm (practiceTarget[].bpm, read by the coach) is
        carried through unchanged so the tempo section never blanks.

   All inputs are defensive: a malformed/empty input returns null and the
   caller hides the spot-drill button (honest-UI contract). ── */

// Hard cap: a wrecked 40-note round must not become a 40-note drill.
// Worst-first selection inside the cap, song order restored after.
export const SPOT_CAP_NOTES = 12;
export const SPOT_CAP_CHORDS = 4;

const PCS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// "C#4" → "C#" (pitch-class label, octave dropped) — mirrors piano-guard's
// own miss-keying so practiceNoteMissesRef's fallback data lines up.
function pcOfName(name) {
  const s = String(name || "");
  const m = s.match(/^([A-G]#?)/);
  return m ? m[1] : s;
}

/* Sort helper: ascending index order = song order. */
function byIdx(a, b) { return a - b; }

/* Chord helper — group surviving indices into whole chords for block modes.
   chordSizes: per-chord sizes (prog); gs: one uniform size (chord/block);
   falls back to gs across all indices when chordSizes is absent. */
function chordBounds(total, gs, chordSizes) {
  const bounds = [];
  let i = 0, c = 0;
  while (i < total) {
    const size = (Array.isArray(chordSizes) && chordSizes.length)
      ? (chordSizes[c] || 1)
      : (gs > 0 ? gs : total);
    bounds.push([i, Math.min(total, i + size)]);
    i += size;
    c++;
  }
  return bounds;
}

/* ── main builder ──
   wrongByIdx: plain object or Map of index → miss count (both accepted —
   the hook holds a Map, the smoke test uses plain objects).
   fallbackPcs: pitch-class labels missed this round (practiceNoteMissesRef
   shape), used only when wrongByIdx carries nothing. */
export function buildSpotTarget(input) {
  const {
    target, ascNotes, mode, chordGroupSize, chordSizes, wrongByIdx, fallbackPcs, label, bpm, key,
  } = input || {};
  try {
    const tgt = Array.isArray(target) ? target.filter(Boolean) : [];
    if (!tgt.length) return null;

    // Normalize wrongByIdx → sorted unique ascending index list with counts.
    let misses = [];
    if (wrongByIdx instanceof Map) {
      for (const [i, n] of wrongByIdx) if (n > 0) misses.push({ idx: i, n });
    } else if (wrongByIdx && typeof wrongByIdx === "object") {
      for (const k of Object.keys(wrongByIdx)) {
        const n = Number(wrongByIdx[k]);
        if (n > 0) misses.push({ idx: Number(k), n });
      }
    }
    misses = misses.filter(m => m.idx >= 0 && m.idx < tgt.length).sort((a, b) => byIdx(a.idx, b.idx));

    // Fallback: no per-index data but we know WHICH pitch classes were missed
    // (practiceNoteMissesRef) — map them back onto target indices. Most-missed
    // pc first, then any other missed index fills the rest.
    if (!misses.length && Array.isArray(fallbackPcs) && fallbackPcs.length) {
      const counts = new Map();
      for (const p of fallbackPcs) counts.set(String(p), (counts.get(String(p)) || 0) + 1);
      const rankedPcs = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
      const byPc = tgt.map((n, i) => ({ i, pc: pcOfName(n && n.note != null ? n.note : n) }));
      const picked = [];
      for (const pc of rankedPcs) for (const e of byPc) if (e.pc === pc && !picked.includes(e.i)) picked.push(e.i);
      misses = picked.map(i => ({ idx: i, n: 1 })).sort((a, b) => byIdx(a.idx, b.idx));
    }
    if (!misses.length) return null; // nothing missed → no button (S5)

    const m = String(mode || "seq");
    const isBlock = (m === "chord" || m === "prog") && (chordGroupSize > 0 || (Array.isArray(chordSizes) && chordSizes.length > 0));

    // ── block modes (T4): cut whole chords ──
    if (isBlock) {
      const bounds = chordBounds(tgt.length, chordGroupSize > 0 ? chordGroupSize : 0, chordSizes);
      const chordMisses = bounds.map(([a, b]) => ({
        a, b,
        n: misses.filter(x => x.idx >= a && x.idx < b).reduce((s, x) => s + x.n, 0),
      })).filter(c => c.n > 0);
      if (!chordMisses.length) return null;
      // cap: worst chords first, then restore song order
      const kept = chordMisses.slice().sort((x, y) => y.n - x.n).slice(0, SPOT_CAP_CHORDS).sort((x, y) => x.a - y.a);
      const notes = [];
      for (const c of kept) for (let i = c.a; i < c.b; i++) notes.push(tgt[i]);
      const sizes = kept.map(c => c.b - c.a);
      const uniform = sizes.every(s => s === sizes[0]);
      return {
        notes,
        mode: m,
        key: key || null,
        chordGroupSize: uniform ? sizes[0] : 0,
        chordSizes: uniform ? null : sizes,
        label: (label || "") + " · จุดพลาด",
        bpm: bpm != null ? bpm : null,
        noExpand: true,
      };
    }

    // ── seq / scale (T2): cut per-note, ascending order, mode "seq" ──
    // scale rounds pass ascNotes (the pre-expansion ascending list) so the
    // cut maps back onto ascending-only notes; every other mode uses target.
    let src = tgt;
    let idxMap = null;
    if (m === "scale" && Array.isArray(ascNotes) && ascNotes.length) {
      src = ascNotes;
      // map each ascending note to its first index in the expanded target —
      // misses recorded against the expanded sequence are re-anchored onto
      // the ascending source by pitch-class+octave name.
      idxMap = new Map();
      for (const miss of misses) {
        const name = tgt[miss.idx] && tgt[miss.idx].note != null ? tgt[miss.idx].note : tgt[miss.idx];
        for (let j = 0; j < src.length; j++) {
          const sn = src[j] && src[j].note != null ? src[j].note : src[j];
          if (sn === name) { idxMap.set(j, Math.max(idxMap.get(j) || 0, miss.n)); break; }
        }
      }
      misses = [...idxMap.entries()].map(([idx, n]) => ({ idx, n })).sort((a, b) => byIdx(a.idx, b.idx));
      if (!misses.length) return null;
    }
    const kept = misses.slice().sort((a, b) => b.n - a.n).slice(0, SPOT_CAP_NOTES).sort((a, b) => byIdx(a.idx, b.idx));
    const notes = kept.map(k => src[k.idx]);
    return {
      notes,
      mode: "seq",
      key: key || null,
      chordGroupSize: 0,
      chordSizes: null,
      label: (label || "") + " · จุดพลาด",
      bpm: bpm != null ? bpm : null,
      noExpand: true,
    };
  } catch (e) { return null; }
}

/* ── scoreRhythm beat mode (plan §2.4, smoke S9/S10) ──
   beatMs == null → the ORIGINAL evenness grading, byte-for-byte identical
   behavior (regression-safe). beatMs set → each IOI is graded against the
   beat interval within ±20%. Returns the same {ok, miss} shape either way. */
export function scoreRhythmMode(times, beatMs) {
  if (!times || times.length < 6) return null;
  const iois = [];
  for (let i = 1; i < times.length; i++) iois.push(times[i] - times[i - 1]);
  if (beatMs != null && beatMs > 0) {
    let ok = 0, miss = 0;
    for (const v of iois) {
      if (v > 0 && Math.abs(v - beatMs) <= beatMs * 0.2) ok++;
      else if (v > 0) miss++;
      // non-positive IOIs (simultaneous hits) are neither — excluded from both
    }
    return ok + miss > 0 ? { ok, miss } : null;
  }
  const mean = iois.reduce((s, v) => s + v, 0) / iois.length;
  if (mean <= 0) return null;
  let ok = 0, miss = 0;
  for (const v of iois) { if (Math.abs(v - mean) <= mean * 0.35) ok++; else miss++; }
  return { ok, miss };
}

/* ── play-along-judge.ts ──
   The Play Along scoring rules, pure and headless (no React, no audio, no
   DOM) so a verify script can import this file and check the numbers
   directly — same convention as mistake-drill.ts.

   What these rules fix: a note used to count as hit anywhere inside ±0.45 s,
   a wrong key did nothing, and stars were simply notes-hit ÷ notes. So
   mashing every key scored 42/42, a Full Combo and 3 stars, and pressing
   every note 0.4 s early was still 3 stars. Now timing grades the hit,
   a wrong key costs, and a burst of keys beyond the notes that are due is
   treated as mashing in every mode. ── */

export const RECEIVE = 0.25;       // a press further than this from the note never hits it
export const RECEIVE_KIND = 0.35;  // kind mode (beginners): a wider window
export const PERFECT = 0.07;
export const GREAT = 0.14;
export const MIC_EXTRA = 0.06;     // pitch detection needs time to settle on a note
export const MASH_WINDOW = 0.15;   // presses closer together than this are one burst
export const CALIB_HITS = 8;       // hits used to learn the device's input delay
export const CALIB_MAX = 0.12;     // the learned delay is never trusted beyond this

export const WEIGHT = { perfect: 1, great: 0.8, good: 0.5 };
export const POINTS = { perfect: 300, great: 200, good: 100 };
export const WRONG_COST = 0.5;     // a wrong key costs half a note of accuracy

export function receiveWindow(kind, src) {
  return (kind ? RECEIVE_KIND : RECEIVE) + (src === "mic" ? MIC_EXTRA : 0);
}

/* |press − note| → the grade, or null when it is outside the window. The
   Perfect/Great bands widen with the mic too, by the same amount. */
export function judgeOffset(absDt, kind, src) {
  const extra = src === "mic" ? MIC_EXTRA : 0;
  if (absDt <= PERFECT + extra) return "perfect";
  if (absDt <= GREAT + extra) return "great";
  if (absDt <= receiveWindow(kind, src)) return "good";
  return null;
}

/* Accuracy 0–100 from the graded notes and the wrong presses that count
   against it. Kind mode forgives a single wrong key; mashing costs in
   every mode (see pressIsMash). */
export function accuracyOf({ perfect = 0, great = 0, good = 0, total = 0, wrong = 0, mash = 0, kind = false }) {
  if (!total) return 0;
  const earned = perfect * WEIGHT.perfect + great * WEIGHT.great + good * WEIGHT.good;
  const cost = ((kind ? 0 : wrong) + mash) * WRONG_COST;
  return Math.max(0, Math.min(100, Math.round((earned - cost) / total * 100)));
}

export function starsFor(acc) {
  return acc >= 90 ? 3 : acc >= 75 ? 2 : acc >= 50 ? 1 : 0;
}

/* "Accurate 4% more for 3 stars" — the next star this player can reach from
   their best accuracy, or null at 3 stars already. */
export function nextStarGoal(bestAcc) {
  const a = Math.max(0, Math.round(Number(bestAcc) || 0));
  for (const [need, stars] of [[50, 1], [75, 2], [90, 3]]) if (a < need) return { stars, more: need - a };
  return null;
}

/* A press arriving while `recentPresses` other presses already happened in
   the last MASH_WINDOW seconds, with `dueNotes` notes due right now, is part
   of a burst larger than the music asks for. Two presses for a two-note
   chord are fine; the third is not. With nothing due, a stray key is just
   ignored (never a mash, never a wrong). */
export function pressIsMash(recentPresses, dueNotes) {
  return dueNotes > 0 && recentPresses >= dueNotes;
}

/* The input delay learned from the first CALIB_HITS hits: the median of how
   early (−) or late (+) they landed, clamped. A Bluetooth speaker or a slow
   touch screen makes every press late by the same amount; this takes that
   out so the player is graded on their timing, not their device's. */
export function calibrate(offsets) {
  if (!offsets || offsets.length < CALIB_HITS) return 0;
  const s = offsets.slice(0, CALIB_HITS).sort((a, b) => a - b);
  const med = (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2;
  return Math.max(-CALIB_MAX, Math.min(CALIB_MAX, med));
}

/* The combo multiplier the game has always used: ×1 climbing to ×2 over the
   first 10 notes, then slowly on up to ×4.9 at combo 300. */
export function comboMult(combo) {
  return combo <= 10 ? 1 + combo * 0.1 : 2 + Math.min(combo - 10, 290) * 0.01;
}

/* ── Boss ──
   Boss HP is 1.25 × the notes: hitting every note Great or better beats it
   before the song ends, Good on every note does not. The old floor of 30 HP
   made the two shortest songs (12–13 notes) unbeatable even all Perfect. */
export function bossHp(totalNotes) {
  return Math.max(1, Math.ceil((totalNotes || 0) * 1.25));
}
export function bossHit(grade, combo) {
  const base = grade === "perfect" ? 2 : grade === "great" ? 1.5 : 1;
  return base + (combo > 0 && combo % 10 === 0 ? 2 : 0);
}

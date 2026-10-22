/* learn-plan.ts - the ranking brain behind "what should this learner practise now".
   PURE: no storage, no network. Callers pass the act log in and get a decision out.

   Five rules (owner request 2026-10-22, UI unchanged):
   1. one source of truth: the daily plan slots and the focus card both read rankTopics()
   2. rank by expected gain per minute: recency-weighted miss rate x confidence, plus a
      spaced-repetition nudge for topics not touched for days (never a fake number)
   3. adaptive tempo: stepTempo() moves a per-topic speed factor up after two clean
      rounds and down after a poor one, so practice stays at about 70-85 % accuracy
   4. cause of the misses: causeOf() splits "wrong notes" from "uneven rhythm" using the
      rhythm-tagged rows the practice mode already writes
   5. results close the loop: fxRecord()/fxSummary() keep before/after per method */

const DAY = 86400000;
export const PLAN_HALFLIFE_DAYS = 14;
export const PLAN_MIN_N = 4;

export function recencyW(t, now) { return Math.pow(0.5, Math.max(0, now - t) / (PLAN_HALFLIFE_DAYS * DAY)); }

/* every graded topic, ranked. A row = { key, k, id, n, miss, rate, wRate, last, idleDays, score, cause } */
export function rankTopics(log, now = Date.now(), labelOf = null) {
  const by = {};
  for (const e of Array.isArray(log) ? log : []) {
    if (!e || e.k === "voice" || !(e.ok + e.miss > 0)) continue;
    const key = e.k + "|" + e.id;
    const b = by[key] || (by[key] = { key, k: e.k, id: e.id, e, ok: 0, miss: 0, wOk: 0, wMiss: 0, last: 0, rOk: 0, rMiss: 0 });
    const w = recencyW(e.t || now, now);
    if (e.skill === "rhythm") { b.rOk += e.ok || 0; b.rMiss += e.miss || 0; continue; }
    if (e.skill === "dynamics") continue;
    b.ok += e.ok || 0; b.miss += e.miss || 0;
    b.wOk += (e.ok || 0) * w; b.wMiss += (e.miss || 0) * w;
    b.last = Math.max(b.last, e.t || 0);
  }
  return Object.values(by)
    .filter((b: any) => b.ok + b.miss >= PLAN_MIN_N && b.miss > 0)
    .map((b: any) => {
      const n = b.ok + b.miss;
      const wRate = b.wMiss / Math.max(1e-9, b.wOk + b.wMiss);
      const conf = 1 - Math.exp(-n / 8);                     // 4 tries ~0.39, 16 tries ~0.86
      const idleDays = b.last ? Math.max(0, (now - b.last) / DAY) : 0;
      const spaced = idleDays <= 21 ? Math.min(0.25, idleDays / 56) : 0;   // review window only: up to +0.25, none once a topic is 3+ weeks stale
      const fresh = 0.5 + 0.5 * recencyW(b.last || now, now);             // a stale pile fades to half weight
      return {
        key: b.key, k: b.k, id: b.id, entry: b.e, n, miss: b.miss,
        rate: Math.round(b.miss / n * 100), wRate: Math.round(wRate * 100),
        last: b.last, idleDays: Math.round(idleDays),
        score: wRate * conf * fresh + spaced,
        cause: causeOf(b.rOk, b.rMiss, wRate),
        label: typeof labelOf === "function" ? labelOf(b.e) : String(b.id),
      };
    })
    .sort((a, b) => (b.score - a.score) || (b.n - a.n) || String(a.label).localeCompare(String(b.label)));
}

/* 4 - why it goes wrong. Needs >= 4 rhythm-graded tries, otherwise "notes" (the honest default). */
export function causeOf(rOk, rMiss, noteMissRate) {
  const n = (rOk || 0) + (rMiss || 0);
  if (n < 4) return "notes";
  const rr = rMiss / n;
  return rr >= 0.4 && rr > noteMissRate + 0.1 ? "rhythm" : "notes";
}

/* 3 - tempo factor 0.5..1.0 of the written tempo. history = recent accuracies (0-100), newest last. */
export function stepTempo(factor, history) {
  const f = typeof factor === "number" && factor > 0 ? factor : 1;
  const h = (history || []).filter(x => typeof x === "number");
  if (!h.length) return f;
  const last = h[h.length - 1], prev = h.length > 1 ? h[h.length - 2] : null;
  if (last < 60) return Math.max(0.5, Math.round((f - 0.1) * 100) / 100);
  if (last >= 85 && prev != null && prev >= 85) return Math.min(1, Math.round((f + 0.1) * 100) / 100);
  return f;
}

/* 5 - before/after per advice method. rec = { method, before, after } (accuracy 0-100) */
export function fxSummary(list) {
  const out = {};
  for (const r of Array.isArray(list) ? list : []) {
    if (!r || r.before == null || r.after == null) continue;
    const s = out[r.method] || (out[r.method] = { n: 0, gain: 0, wins: 0 });
    s.n++; s.gain += r.after - r.before; if (r.after > r.before) s.wins++;
  }
  for (const m of Object.keys(out)) out[m].avg = Math.round(out[m].gain / out[m].n);
  return out;
}
/* the method that has worked best for this learner, only when it has >= 3 results and beats the rest */
export function bestMethod(list, fallback = "slow") {
  const s = fxSummary(list);
  const ok = Object.keys(s).filter(m => s[m].n >= 3 && s[m].avg > 0).sort((a, b) => s[b].avg - s[a].avg);
  return ok[0] || fallback;
}

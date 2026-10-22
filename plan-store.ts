/* plan-store.ts - the small local memory behind learn-plan.ts: a tempo factor per topic and the
   before/after results per advice method. Local only (no network, no SQL). */
import { stepTempo, fxSummary, bestMethod } from "./learn-plan";

const TEMPO = "tg_plan_tempo", FX = "tg_plan_fx", DAY = 86400000;
const rd = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "") || d; } catch (e) { return d; } };
const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

export function tempoFactorOf(label) { const t = rd(TEMPO, {}); return typeof t[label] === "number" ? t[label] : 1; }

/* call BEFORE the round is written to the act log, so "previous" really is the previous round */
export function planRecordRound(label, accuracy, log, now = Date.now()) {
  try {
    if (!label || typeof accuracy !== "number") return;
    const rounds = (Array.isArray(log) ? log : []).filter(e => e && e.k === "drill" && e.id === label && !e.skill && e.ok + e.miss >= 4)
      .map(e => ({ t: e.t, acc: Math.round(e.ok / (e.ok + e.miss) * 100) }));
    const prev = rounds.length ? rounds[rounds.length - 1] : null;
    const tempo = rd(TEMPO, {});
    const f0 = typeof tempo[label] === "number" ? tempo[label] : 1;
    const f1 = stepTempo(f0, [...rounds.slice(-1).map(r => r.acc), accuracy]);
    if (f1 !== f0) { tempo[label] = f1; wr(TEMPO, tempo); }
    if (prev && now - prev.t < 7 * DAY) {
      const method = f0 < 1 ? "slow" : "repeat";
      const fx = rd(FX, []); fx.push({ t: now, label, method, before: prev.acc, after: Math.round(accuracy) });
      wr(FX, fx.slice(-60));
    }
  } catch (e) {}
}
export function planFxResults() { return rd(FX, []); }
export function planFxSummary() { return fxSummary(rd(FX, [])); }
export function planBestMethod() { return bestMethod(rd(FX, [])); }

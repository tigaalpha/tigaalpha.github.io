// Event-trigger conditions for the hourly agent-event-triggers cron — pure
// math, deliberately free of any supabase/Deno import so vitest can import
// it directly (same convention as lead-score.ts / promptpay.ts). The
// DB-facing orchestration (checkEventTriggers) lives in
// agent-event-triggers.ts.

export interface SalesWindowCounts {
  recent: number;
  previous: number;
}

// Relative drop of the recent window vs the previous one. Returns null when
// there's nothing to compare against (previous = 0); 0 when sales are flat
// or up.
export function salesDropRatio(recent: number, previous: number): number | null {
  if (previous <= 0) return null;
  const drop = (previous - recent) / previous;
  return drop > 0 ? drop : 0;
}

export function shouldTriggerSalesDrop(recent: number, previous: number, minDropRatio = 0.3, minPrevious = 2): boolean {
  if (previous < minPrevious) return false;
  const ratio = salesDropRatio(recent, previous);
  return ratio !== null && ratio >= minDropRatio;
}

export function shouldTriggerNoNewWon(recentWon: number, priorWon: number): boolean {
  return recentWon === 0 && priorWon >= 1;
}

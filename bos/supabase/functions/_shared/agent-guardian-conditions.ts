// Guardian Agent conditions (งาน #2 — เฝ้าธุรกิจแทนเจ้าของ) — pure math,
// deliberately free of any supabase/Deno import so vitest can import it
// directly (same convention as agent-event-conditions.ts). The DB-facing
// orchestration lives in agent-event-triggers.ts: these functions decide
// WHETHER to care, the trigger file decides what to do about it.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Customer whose last booking started more than `dormantDays` ago. */
export function isDormant(lastBookingStartMs: number | null | undefined, now: number, dormantDays = 30): boolean {
  if (typeof lastBookingStartMs !== "number" || !Number.isFinite(lastBookingStartMs)) return false;
  return now - lastBookingStartMs >= dormantDays * DAY_MS;
}

/**
 * Payment escalation ladder — overdue invoices get louder as they age:
 * 1 = 3+ days (gentle nudge), 2 = 7+ days (follow-up), 3 = 14+ days (urgent).
 */
export function overdueStage(daysOverdue: number): 1 | 2 | 3 | null {
  if (daysOverdue >= 14) return 3;
  if (daysOverdue >= 7) return 2;
  if (daysOverdue >= 3) return 1;
  return null;
}

/** Lead (pre-won) that hasn't been touched in `staleDays` (falls back to created_at). */
export function isStaleLead(
  lastContactMs: number | null | undefined,
  createdMs: number | null | undefined,
  now: number,
  staleDays = 7
): boolean {
  const reference = typeof lastContactMs === "number" && Number.isFinite(lastContactMs) ? lastContactMs : createdMs;
  if (typeof reference !== "number" || !Number.isFinite(reference)) return false;
  return now - reference >= staleDays * DAY_MS;
}

/** Zero content actually published in the last 7 days. */
export function isContentDrought(publishedLast7Days: number): boolean {
  return publishedLast7Days === 0;
}

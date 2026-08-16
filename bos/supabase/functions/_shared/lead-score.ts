// Lead scoring (feature #7) — the pure scoring function, mirroring the SQL
// in migration 0059 + 0077 (base from status/qualification/recency, then
// activity bonuses). Deliberately free of any supabase import so vitest can
// import it directly (same convention as promptpay.ts / retry.ts); the
// DB-facing refresh helper lives in lead-score-db.ts.

export interface LeadScoreInputs {
  salesStatus: string;
  recentMessages30d: number;
  activeBookings: number;
  paidPayments: number;
  /** Whether the customer has a learning goal filled in (0059 base). */
  hasLearningGoal?: boolean;
  /** Whether the customer has a budget filled in (0059 base). */
  hasBudget?: boolean;
  /** Days since last contact (0059 recency). Default 0 = contacted today. */
  daysSinceContact?: number;
}

// Mirrors recompute_lead_score() in migration 0077 — the SQL version is the
// source of truth at runtime; this mirrors it for tests.
export function computeLeadScore(inputs: LeadScoreInputs): number {
  const statusWeight: Record<string, number> = {
    new_lead: 10,
    contacted: 20,
    qualified: 30,
    interested: 40,
    trial_booked: 60,
    trial_completed: 70,
    negotiating: 80,
    waiting_decision: 85,
    won: 100,
    renew_pending: 90,
    renewed: 100,
    lost: 0,
  };
  let score = statusWeight[inputs.salesStatus] ?? 10;
  if (inputs.hasLearningGoal) score += 10;
  if (inputs.hasBudget) score += 5;

  const days = inputs.daysSinceContact ?? 0;
  if (days <= 7) score += 5;
  else if (days > 30 && !["won", "lost", "renewed"].includes(inputs.salesStatus)) score -= 10;

  score += Math.min(inputs.recentMessages30d, 25);
  score += Math.min(inputs.activeBookings * 10, 40);
  score += Math.min(inputs.paidPayments * 30, 60);
  return Math.max(0, Math.min(score, 100));
}

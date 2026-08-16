// DB-facing lead-score helper (feature #7). Kept separate from
// lead-score.ts (pure, unit-tested) because this file needs the supabase
// client types, which the test-visible pure file must stay free of.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Recompute + persist a customer's lead score. Cheap (3 count queries) — call after customer message, payment, or booking. */
export async function refreshLeadScore(admin: SupabaseClient, customerId: string | null | undefined): Promise<void> {
  if (!customerId) return;
  await admin.rpc("recompute_lead_score", { p_customer: customerId }).catch(() => {});
}

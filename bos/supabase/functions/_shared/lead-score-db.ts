// DB-facing lead-score helper (feature #7). Kept separate from
// lead-score.ts (pure, unit-tested) because this file needs the supabase
// client types, which the test-visible pure file must stay free of.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Recompute + persist a customer's lead score. Cheap (3 count queries) — call after customer message, payment, or booking. */
export async function refreshLeadScore(admin: SupabaseClient, customerId: string | null | undefined): Promise<void> {
  if (!customerId) return;
  // Note: the supabase-js v2 PostgrestBuilder is thenable but has no .catch
  // — chaining .catch() on admin.rpc() throws "...catch is not a function"
  // at runtime. Wrap in try/catch instead.
  try {
    await admin.rpc("recompute_lead_score", { p_customer: customerId });
  } catch {
    // lead score is a soft signal — never let it fail the caller
  }
}

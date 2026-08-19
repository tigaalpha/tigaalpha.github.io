import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Read-only helper for the Control Center's pending-approvals tile. The
// existing approve/reject flow (features/approvals/components/
// approvals-manager.tsx) talks to the `approvals` edge function directly
// via fetch and is untouched -- this only adds a count query, which RLS
// (staff read) already permits directly against the table.
export class ApprovalsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async pendingCount(): Promise<number> {
    const { count, error } = await this.db.from("approval_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
    if (error) throw error;
    return count ?? 0;
  }
}

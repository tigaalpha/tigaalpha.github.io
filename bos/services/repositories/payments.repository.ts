import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

// Read helpers for the payments table. Creating/confirming payments goes
// through the AI tools (create_payment_link / mark_payment_paid) or the
// create-payment / verify-payment edge functions — writes are owner/admin
// gated there on purpose, so this repository stays read-only.
export class PaymentsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: string): Promise<Tables<"payments"> | null> {
    const { data, error } = await this.db.from("payments").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async listByCustomer(customerId: string, limit = 20): Promise<Tables<"payments">[]> {
    const { data, error } = await this.db
      .from("payments")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async listPending(limit = 50): Promise<Tables<"payments">[]> {
    const { data, error } = await this.db
      .from("payments")
      .select("*, customers(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async listRecent(limit = 50): Promise<Tables<"payments">[]> {
    const { data, error } = await this.db.from("payments").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  }
}

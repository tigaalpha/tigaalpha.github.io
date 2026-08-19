import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

// Read helpers for the payments table. Creating/confirming payments goes
// through the AI tools (create_payment_link / mark_payment_paid) or the
// create-payment / verify-payment edge functions — writes are owner/admin
// gated there on purpose, so this repository stays read-only.

export interface PaymentWithCustomer extends Tables<"payments"> {
  customerName: string;
}

export class PaymentsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  // Same pattern as ReceiptsRepository.listRecent: fetch rows, then a second
  // `in` query for the customer names (nested select is untyped in the
  // hand-rolled Database type, and one extra indexed query is cheap here).
  private async attachCustomerNames(rows: Tables<"payments">[]): Promise<PaymentWithCustomer[]> {
    if (rows.length === 0) return [];
    const customerIds = Array.from(new Set(rows.map((p) => p.customer_id)));
    const { data: customers, error: custErr } = await this.db.from("customers").select("id, name").in("id", customerIds);
    if (custErr) throw custErr;
    const nameById = new Map((customers ?? []).map((c) => [c.id, c.name]));
    return rows.map((p) => ({ ...p, customerName: nameById.get(p.customer_id) ?? "-" }));
  }

  /** All payments, newest first — used by the Payments page (filters status client-side). */
  async listAll(limit = 100): Promise<PaymentWithCustomer[]> {
    const { data, error } = await this.db
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return this.attachCustomerNames(data ?? []);
  }

  /** Payments filtered by status, newest first, with customer name attached. */
  async listByStatus(status: Tables<"payments">["status"], limit = 100): Promise<PaymentWithCustomer[]> {
    const { data, error } = await this.db
      .from("payments")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return this.attachCustomerNames(data ?? []);
  }

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

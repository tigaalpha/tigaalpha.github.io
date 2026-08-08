import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export interface ReceiptWithCustomer extends Tables<"receipts"> {
  customerName: string;
}

export class ReceiptsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listRecent(limit = 50): Promise<ReceiptWithCustomer[]> {
    const { data: receipts, error } = await this.db.from("receipts").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    if (!receipts || receipts.length === 0) return [];

    const customerIds = Array.from(new Set(receipts.map((r) => r.customer_id)));
    const { data: customers, error: custErr } = await this.db.from("customers").select("id, name").in("id", customerIds);
    if (custErr) throw custErr;
    const nameById = new Map((customers ?? []).map((c) => [c.id, c.name]));

    return receipts.map((r) => ({ ...r, customerName: nameById.get(r.customer_id) ?? "-" }));
  }
}

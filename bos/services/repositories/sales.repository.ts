import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SalesStatus, Tables } from "@/types/database";

const PIPELINE_ORDER: SalesStatus[] = [
  "new_lead", "contacted", "qualified", "interested", "trial_booked",
  "trial_completed", "negotiating", "waiting_decision", "won", "lost",
  "renew_pending", "renewed",
];

export class SalesRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async changeStatus(customerId: string, toStatus: SalesStatus, note?: string, changedBy?: string, lostReason?: string): Promise<void> {
    const { data: customer, error: fetchError } = await this.db
      .from("customers")
      .select("sales_status")
      .eq("id", customerId)
      .single();
    if (fetchError) throw fetchError;

    const { error: historyError } = await this.db.from("sales_status_history").insert({
      customer_id: customerId,
      from_status: customer.sales_status,
      to_status: toStatus,
      note: note ?? null,
      changed_by: changedBy ?? null,
      lost_reason: toStatus === "lost" ? (lostReason ?? null) : null,
    });
    if (historyError) throw historyError;

    const { error: updateError } = await this.db.from("customers").update({ sales_status: toStatus }).eq("id", customerId);
    if (updateError) throw updateError;
  }

  async lostReasonCounts(): Promise<Record<string, number>> {
    const { data, error } = await this.db.from("sales_status_history").select("lost_reason").eq("to_status", "lost").not("lost_reason", "is", null);
    if (error) throw error;
    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      if (row.lost_reason) counts[row.lost_reason] = (counts[row.lost_reason] ?? 0) + 1;
    }
    return counts;
  }

  async history(customerId: string): Promise<Tables<"sales_status_history">[]> {
    const { data, error } = await this.db
      .from("sales_status_history")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async funnelCounts(): Promise<Record<SalesStatus, number>> {
    const { data, error } = await this.db.from("customers").select("sales_status");
    if (error) throw error;

    const counts = Object.fromEntries(PIPELINE_ORDER.map((status) => [status, 0])) as Record<SalesStatus, number>;
    for (const row of data ?? []) {
      counts[row.sales_status] += 1;
    }
    return counts;
  }
}

export { PIPELINE_ORDER };

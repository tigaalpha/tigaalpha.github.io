import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export interface TransferSlipWithPayment extends Tables<"transfer_slips"> {
  /** Reference code of the payment this slip matched (or was checked against), if any. */
  paymentReference: string | null;
  paymentStatus: Tables<"payments">["status"] | null;
  /** Name of the customer who sent the slip (null when unbound). */
  customerName: string | null;
}

// Read-only helpers for transfer_slips (slip images the LINE AI matched
// against pending payments — see supabase/functions/line-webhook). Slips are
// written by the webhook/edge functions; the frontend only inspects them on
// the Payments page. Follows the same select-then-in pattern as
// ReceiptsRepository/PaymentsRepository for the joined payment reference.
export class TransferSlipsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listRecent(limit = 30): Promise<TransferSlipWithPayment[]> {
    const { data: slips, error } = await this.db.from("transfer_slips").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    if (!slips || slips.length === 0) return [];

    const paymentIds = Array.from(new Set(slips.map((s) => s.payment_id).filter((id): id is string => id !== null)));
    const refByPaymentId = new Map<string, { reference_code: string; status: Tables<"payments">["status"] }>();
    if (paymentIds.length > 0) {
      const { data: payments, error: payErr } = await this.db
        .from("payments")
        .select("id, reference_code, status")
        .in("id", paymentIds);
      if (payErr) throw payErr;
      for (const p of payments ?? []) refByPaymentId.set(p.id, { reference_code: p.reference_code, status: p.status });
    }

    const customerIds = Array.from(new Set(slips.map((s) => s.customer_id).filter((id): id is string => id !== null)));
    const nameByCustomerId = new Map<string, string>();
    if (customerIds.length > 0) {
      const { data: customers, error: custErr } = await this.db.from("customers").select("id, name").in("id", customerIds);
      if (custErr) throw custErr;
      for (const c of customers ?? []) nameByCustomerId.set(c.id, c.name);
    }

    return slips.map((slip) => {
      const payment = slip.payment_id ? refByPaymentId.get(slip.payment_id) : undefined;
      return {
        ...slip,
        paymentReference: payment?.reference_code ?? null,
        paymentStatus: payment?.status ?? null,
        customerName: slip.customer_id ? (nameByCustomerId.get(slip.customer_id) ?? null) : null,
      };
    });
  }
}

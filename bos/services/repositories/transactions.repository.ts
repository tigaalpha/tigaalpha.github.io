import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class TransactionsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listBetween(startDate: string, endDate: string): Promise<Tables<"transactions">[]> {
    const { data, error } = await this.db
      .from("transactions")
      .select("*")
      .gte("transaction_date", startDate)
      .lte("transaction_date", endDate)
      .order("transaction_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async create(row: Database["public"]["Tables"]["transactions"]["Insert"]): Promise<Tables<"transactions">> {
    const { data, error } = await this.db.from("transactions").insert(row).select("*").single();
    if (error) throw error;
    return data;
  }

  async update(id: string, patch: Partial<Tables<"transactions">>): Promise<Tables<"transactions">> {
    const { data, error } = await this.db.from("transactions").update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("transactions").delete().eq("id", id);
    if (error) throw error;
  }
}

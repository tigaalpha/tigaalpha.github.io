import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class SalesChatExamplesRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async list(): Promise<Tables<"sales_chat_examples">[]> {
    const { data, error } = await this.db.from("sales_chat_examples").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async confirm(extractedTurns: { speaker: "customer" | "owner"; text: string }[]): Promise<Tables<"sales_chat_examples">> {
    const { data, error } = await this.db
      .from("sales_chat_examples")
      .insert({ extracted_turns: extractedTurns, confirmed: true })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("sales_chat_examples").delete().eq("id", id);
    if (error) throw error;
  }
}

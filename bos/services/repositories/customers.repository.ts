import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SalesStatus, Tables } from "@/types/database";

export class CustomersRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: string): Promise<Tables<"customers"> | null> {
    const { data, error } = await this.db.from("customers").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async findByLineUserId(lineUserId: string): Promise<Tables<"customers"> | null> {
    const { data, error } = await this.db.from("customers").select("*").eq("line_user_id", lineUserId).maybeSingle();
    if (error) throw error;
    return data;
  }

  async search(query: string, limit = 20): Promise<Tables<"customers">[]> {
    const { data, error } = await this.db
      .from("customers")
      .select("*")
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async listByStatus(status: SalesStatus): Promise<Tables<"customers">[]> {
    const { data, error } = await this.db
      .from("customers")
      .select("*")
      .eq("sales_status", status)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async listPipeline(): Promise<Tables<"customers">[]> {
    const { data, error } = await this.db
      .from("customers")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async create(input: Database["public"]["Tables"]["customers"]["Insert"]): Promise<Tables<"customers">> {
    const { data, error } = await this.db.from("customers").insert(input).select("*").single();
    if (error) throw error;
    return data;
  }

  async update(id: string, patch: Database["public"]["Tables"]["customers"]["Update"]): Promise<Tables<"customers">> {
    const { data, error } = await this.db.from("customers").update(patch).eq("id", id).select("*").single();
    if (error) throw error;
    return data;
  }

  async updateLastContact(id: string): Promise<void> {
    const { error } = await this.db.from("customers").update({ last_contact_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  }

  /** Lead counts grouped by lead_source, for the Reports page. Unset sources are grouped as "Unknown". */
  async countByLeadSource(): Promise<Record<string, number>> {
    const { data, error } = await this.db.from("customers").select("lead_source");
    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const key = row.lead_source?.trim() || "Unknown";
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }
}

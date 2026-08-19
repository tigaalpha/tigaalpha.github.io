import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, SalesStatus, Tables } from "@/types/database";

export interface InactiveLead {
  id: string;
  name: string;
  lastActivityAt: string;
  salesStatus: SalesStatus;
}

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
    // .or() takes a raw PostgREST filter string, not a parameterized query —
    // "," separates clauses and "()" nests them, so interpolating user input
    // unsanitized let a search string containing those characters inject
    // extra filter clauses or break the grammar. A name/phone search box
    // never legitimately needs them, so strip rather than escape.
    const safe = query.replace(/[,()]/g, "").slice(0, 200);
    const { data, error } = await this.db
      .from("customers")
      .select("*")
      .or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  // Both queries below were previously unbounded (`select("*")` with no
  // `.limit()`), unlike every other list method in this file — fine at
  // today's row counts, but at production scale it means every visit to
  // Students/Sales pulls the *entire* customers table (every column,
  // including notes/PII) to the browser. LIMIT_SAFETY_NET caps the worst
  // case; it is not real pagination — the Students/Sales pages still need
  // proper cursor/page-based UI to genuinely scale past a few thousand rows.
  private static readonly LIMIT_SAFETY_NET = 500;

  async listByStatus(status: SalesStatus): Promise<Tables<"customers">[]> {
    const { data, error } = await this.db
      .from("customers")
      .select("*")
      .eq("sales_status", status)
      .order("updated_at", { ascending: false })
      .limit(CustomersRepository.LIMIT_SAFETY_NET);
    if (error) throw error;
    return data ?? [];
  }

  async listPipeline(): Promise<Tables<"customers">[]> {
    const { data, error } = await this.db
      .from("customers")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(CustomersRepository.LIMIT_SAFETY_NET);
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

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("customers").delete().eq("id", id);
    if (error) throw error;
  }

  // Same "gone quiet" condition as automation-engine-runner's
  // processInactiveCustomerRule (sales_status not won/lost, last_contact_at
  // falling back to created_at), as a read for the Dashboard -- a shorter
  // default than that rule's 30-day threshold since this is a passive
  // "you should glance at this" list for a human, not a trigger for an
  // automated customer-facing message.
  async inactiveLeads(days = 7): Promise<InactiveLead[]> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.db
      .from("customers")
      .select("id, name, last_contact_at, created_at, sales_status")
      .not("sales_status", "in", "(won,lost)")
      .limit(CustomersRepository.LIMIT_SAFETY_NET);
    if (error) throw error;

    return (data ?? [])
      .map((c) => ({ id: c.id, name: c.name, lastActivityAt: c.last_contact_at ?? c.created_at, salesStatus: c.sales_status }))
      .filter((c) => c.lastActivityAt < cutoff)
      .sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? -1 : 1));
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

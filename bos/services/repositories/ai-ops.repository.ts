import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export interface VoiceCallWithCustomer extends Tables<"voice_call_logs"> {
  customerName: string | null;
}

// Read helpers for the AI-first ops tables (kb_drafts, content_calendar,
// voice_call_logs). All writes go through edge functions or owner-only
// client mutations with RLS.
export class AiOpsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listKbDrafts(): Promise<Tables<"kb_drafts">[]> {
    const { data, error } = await this.db.from("kb_drafts").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data ?? [];
  }

  async listContentCalendar(): Promise<Tables<"content_calendar">[]> {
    const { data, error } = await this.db.from("content_calendar").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data ?? [];
  }

  async listVoiceCalls(limit = 20): Promise<VoiceCallWithCustomer[]> {
    const { data: calls, error } = await this.db.from("voice_call_logs").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    if (!calls || calls.length === 0) return [];

    const customerIds = Array.from(new Set(calls.map((c) => c.customer_id).filter((id): id is string => id !== null)));
    const nameById = new Map<string, string>();
    if (customerIds.length > 0) {
      const { data: customers, error: custErr } = await this.db.from("customers").select("id, name").in("id", customerIds);
      if (custErr) throw custErr;
      for (const c of customers ?? []) nameById.set(c.id, c.name);
    }

    return calls.map((call) => ({ ...call, customerName: call.customer_id ? (nameById.get(call.customer_id) ?? null) : null }));
  }
}

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

  async listPolicies(): Promise<Tables<"company_policies">[]> {
    const { data, error } = await this.db.from("company_policies").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data ?? [];
  }

  async createPolicy(input: { title: string; content: string; tags?: string[] }): Promise<void> {
    const { error } = await this.db.from("company_policies").insert({ title: input.title, content: input.content, tags: input.tags ?? [] });
    if (error) throw error;
  }

  async updatePolicy(id: string, patch: { title?: string; content?: string; active?: boolean }): Promise<void> {
    const { error } = await this.db.from("company_policies").update(patch).eq("id", id);
    if (error) throw error;
  }

  async deletePolicy(id: string): Promise<void> {
    const { error } = await this.db.from("company_policies").delete().eq("id", id);
    if (error) throw error;
  }

  async listEvals(limit = 100): Promise<Tables<"ai_evals">[]> {
    const { data, error } = await this.db.from("ai_evals").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async listEvents(limit = 50): Promise<Tables<"events">[]> {
    const { data, error } = await this.db.from("events").select("*").order("start_time", { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async createEvent(input: {
    title: string;
    event_type: Tables<"events">["event_type"];
    start_time: string;
    end_time?: string | null;
    location?: string | null;
    description?: string | null;
    status?: Tables<"events">["status"];
  }): Promise<void> {
    const { error } = await this.db.from("events").insert({
      title: input.title,
      event_type: input.event_type,
      start_time: input.start_time,
      end_time: input.end_time ?? null,
      location: input.location ?? null,
      description: input.description ?? null,
      status: input.status ?? "open",
    });
    if (error) throw error;
  }

  async updateEvent(id: string, patch: Partial<Tables<"events">>): Promise<void> {
    const { error } = await this.db.from("events").update(patch).eq("id", id);
    if (error) throw error;
  }

  async deleteEvent(id: string): Promise<void> {
    const { error } = await this.db.from("events").delete().eq("id", id);
    if (error) throw error;
  }

  async listParticipants(eventId: string): Promise<(Tables<"event_participants"> & { customerName: string | null })[]> {
    const { data, error } = await this.db.from("event_participants").select("*").eq("event_id", eventId).order("created_at", { ascending: true });
    if (error) throw error;
    const rows = data ?? [];
    const customerIds = Array.from(new Set(rows.map((r) => r.customer_id).filter((id): id is string => id !== null)));
    const nameById = new Map<string, string>();
    if (customerIds.length > 0) {
      const { data: customers, error: cErr } = await this.db.from("customers").select("id, name").in("id", customerIds);
      if (cErr) throw cErr;
      for (const c of customers ?? []) nameById.set(c.id, c.name);
    }
    return rows.map((r) => ({ ...r, customerName: r.customer_id ? (nameById.get(r.customer_id) ?? null) : null }));
  }

  async addParticipant(eventId: string, customerId: string, piece?: string): Promise<void> {
    const { error } = await this.db.from("event_participants").upsert({ event_id: eventId, customer_id: customerId, piece: piece ?? null }, { onConflict: "event_id,customer_id" });
    if (error) throw error;
  }

  async removeParticipant(id: string): Promise<void> {
    const { error } = await this.db.from("event_participants").delete().eq("id", id);
    if (error) throw error;
  }

  async listWinbackCampaigns(limit = 50): Promise<(Tables<"winback_campaigns"> & { customerName: string | null })[]> {
    const { data, error } = await this.db.from("winback_campaigns").select("*").order("created_at", { ascending: false }).limit(limit);
    if (error) throw error;
    const rows = data ?? [];
    const customerIds = Array.from(new Set(rows.map((r) => r.customer_id).filter((id): id is string => id !== null)));
    const nameById = new Map<string, string>();
    if (customerIds.length > 0) {
      const { data: customers, error: cErr } = await this.db.from("customers").select("id, name").in("id", customerIds);
      if (cErr) throw cErr;
      for (const c of customers ?? []) nameById.set(c.id, c.name);
    }
    return rows.map((r) => ({ ...r, customerName: r.customer_id ? (nameById.get(r.customer_id) ?? null) : null }));
  }

  async listAdSpend(limit = 100): Promise<Tables<"ad_spend_entries">[]> {
    const { data, error } = await this.db.from("ad_spend_entries").select("*").order("spend_date", { ascending: false }).limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async addAdSpend(input: { platform: string; amount: number; spend_date: string; campaign_name?: string; note?: string }): Promise<void> {
    const { error } = await this.db.from("ad_spend_entries").insert({
      platform: input.platform,
      amount: input.amount,
      spend_date: input.spend_date,
      campaign_name: input.campaign_name ?? null,
      note: input.note ?? null,
    });
    if (error) throw error;
  }

  async deleteAdSpend(id: string): Promise<void> {
    const { error } = await this.db.from("ad_spend_entries").delete().eq("id", id);
    if (error) throw error;
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

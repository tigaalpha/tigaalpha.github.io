import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MessageSender, Tables } from "@/types/database";

export interface ConversationWithCustomer extends Tables<"conversations"> {
  /** Name of the customer this conversation belongs to (null when unbound). */
  customerName: string | null;
}

export class ConversationsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findOrCreateForLineUser(lineUserId: string, customerId?: string): Promise<Tables<"conversations">> {
    const { data: existing, error: findError } = await this.db
      .from("conversations")
      .select("*")
      .eq("line_user_id", lineUserId)
      .eq("channel", "line")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (findError) throw findError;
    if (existing) return existing;

    const { data, error } = await this.db
      .from("conversations")
      .insert({ channel: "line", line_user_id: lineUserId, customer_id: customerId ?? null })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listNeedingReview(): Promise<Tables<"conversations">[]> {
    const { data, error } = await this.db
      .from("conversations")
      .select("*")
      .eq("needs_review", true)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  /** Count-only variant of listNeedingReview(), for the Alert Center badge. */
  async countNeedingReview(): Promise<number> {
    const { count, error } = await this.db.from("conversations").select("id", { count: "exact", head: true }).eq("needs_review", true);
    if (error) throw error;
    return count ?? 0;
  }

  /** Customer-facing Inbox list — excludes 'internal' (Floating AI Assistant) conversations. */
  async listRecent(limit = 30): Promise<Tables<"conversations">[]> {
    const { data, error } = await this.db
      .from("conversations")
      .select("*")
      .neq("channel", "internal")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Full Inbox history — every customer-facing conversation (no cap), newest
   * first, with the customer name joined in. Powers the Inbox's customer +
   * date-range filters so the owner can browse all past chats, not just the
   * most recent page.
   */
  async listAllWithCustomers(): Promise<ConversationWithCustomer[]> {
    const { data, error } = await this.db
      .from("conversations")
      .select("*")
      .neq("channel", "internal")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) return [];

    const customerIds = Array.from(new Set(rows.map((c) => c.customer_id).filter((id): id is string => id !== null)));
    const nameById = new Map<string, string>();
    if (customerIds.length > 0) {
      const { data: customers, error: custErr } = await this.db.from("customers").select("id, name").in("id", customerIds);
      if (custErr) throw custErr;
      for (const c of customers ?? []) nameById.set(c.id, c.name);
    }

    return rows.map((c) => ({ ...c, customerName: c.customer_id ? (nameById.get(c.customer_id) ?? null) : null }));
  }

  async setNeedsReview(id: string, needsReview: boolean): Promise<void> {
    const { error } = await this.db.from("conversations").update({ needs_review: needsReview }).eq("id", id);
    if (error) throw error;
  }

  async setSummary(id: string, summary: string): Promise<void> {
    const { error } = await this.db.from("conversations").update({ summary }).eq("id", id);
    if (error) throw error;
  }

  async listMessages(conversationId: string, limit = 50): Promise<Tables<"messages">[]> {
    const { data, error } = await this.db
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async addMessage(conversationId: string, sender: MessageSender, content: string, metadata?: Record<string, unknown>): Promise<Tables<"messages">> {
    const { data, error } = await this.db
      .from("messages")
      .insert({ conversation_id: conversationId, sender, content, metadata: metadata ?? null })
      .select("*")
      .single();
    if (error) throw error;

    await this.db.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    return data;
  }

  /** How much of the AI's work needed a human — the "AI Performance" dashboard/report metric. */
  async aiResolutionStats(): Promise<{ total: number; resolvedByAi: number; needsReview: number; resolutionRate: number }> {
    const [totalRes, reviewRes] = await Promise.all([
      this.db.from("conversations").select("id", { count: "exact", head: true }),
      this.db.from("conversations").select("id", { count: "exact", head: true }).eq("needs_review", true),
    ]);
    if (totalRes.error) throw totalRes.error;
    if (reviewRes.error) throw reviewRes.error;

    const total = totalRes.count ?? 0;
    const needsReview = reviewRes.count ?? 0;
    const resolvedByAi = total - needsReview;
    const resolutionRate = total > 0 ? Math.round((resolvedByAi / total) * 100) : 0;

    return { total, resolvedByAi, needsReview, resolutionRate };
  }

  /**
   * Owner's internal Floating Assistant conversations — the reverse of
   * listRecent(). Powers the TIGA Agent conversation history section.
   */
  async listInternalConversations(limit = 50): Promise<Tables<"conversations">[]> {
    const { data, error } = await this.db
      .from("conversations")
      .select("*")
      .eq("channel", "internal")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async countInternalConversations(): Promise<number> {
    const { count, error } = await this.db
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("channel", "internal");
    if (error) throw error;
    return count ?? 0;
  }

  /**
   * "Where do customers drop off in the conversation" -- last_stage is
   * tagged by chat-core.ts after every AI turn from cheap, real signals
   * (no extra AI call): opening / handoff / fallback / tool_used / general.
   * Counts every customer-facing conversation that's had at least one AI
   * reply -- excludes the owner's own internal Floating Assistant chats.
   */
  async dropOffStageCounts(): Promise<Record<string, number>> {
    const { data, error } = await this.db.from("conversations").select("last_stage").neq("channel", "internal").not("last_stage", "is", null);
    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const stage = row.last_stage ?? "unknown";
      counts[stage] = (counts[stage] ?? 0) + 1;
    }
    return counts;
  }
}

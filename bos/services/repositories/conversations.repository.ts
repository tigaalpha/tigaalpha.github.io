import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, MessageSender, Tables } from "@/types/database";

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

  async listRecent(limit = 30): Promise<Tables<"conversations">[]> {
    const { data, error } = await this.db
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
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
}

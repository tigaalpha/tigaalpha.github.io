import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class StrategyRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listSessions(): Promise<Tables<"strategy_sessions">[]> {
    const { data, error } = await this.db.from("strategy_sessions").select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async listMessages(sessionId: string): Promise<Tables<"strategy_messages">[]> {
    const { data, error } = await this.db
      .from("strategy_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async listPinned(): Promise<Tables<"strategy_messages">[]> {
    const { data, error } = await this.db
      .from("strategy_messages")
      .select("*")
      .eq("pinned", true)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async renameSession(id: string, title: string): Promise<void> {
    const { error } = await this.db.from("strategy_sessions").update({ title }).eq("id", id);
    if (error) throw error;
  }

  async deleteSession(id: string): Promise<void> {
    const { error } = await this.db.from("strategy_sessions").delete().eq("id", id);
    if (error) throw error;
  }

  async togglePin(messageId: string, pinned: boolean): Promise<void> {
    const { error } = await this.db.from("strategy_messages").update({ pinned }).eq("id", messageId);
    if (error) throw error;
  }
}

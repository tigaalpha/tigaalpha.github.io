import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationType, Tables } from "@/types/database";

export class NotificationsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listUnread(limit = 50): Promise<Tables<"notifications">[]> {
    const { data, error } = await this.db
      .from("notifications")
      .select("*")
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async listAll(limit = 100): Promise<Tables<"notifications">[]> {
    const { data, error } = await this.db
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async create(type: NotificationType, title: string, body?: string, customerId?: string, bookingId?: string): Promise<void> {
    const { error } = await this.db.from("notifications").insert({
      type,
      title,
      body: body ?? null,
      customer_id: customerId ?? null,
      booking_id: bookingId ?? null,
    });
    if (error) throw error;
  }

  async markRead(id: string): Promise<void> {
    const { error } = await this.db.from("notifications").update({ read: true }).eq("id", id);
    if (error) throw error;
  }

  async markAllRead(): Promise<void> {
    const { error } = await this.db.from("notifications").update({ read: true }).eq("read", false);
    if (error) throw error;
  }
}

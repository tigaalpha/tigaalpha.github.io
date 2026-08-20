import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Metadata-only view of connected accounts — refresh_token never leaves the server (see gcal-events edge function). */
export interface GoogleCalendarConnectionSummary {
  id: string;
  label: string;
  google_account_email: string | null;
  calendar_id: string;
  color: string;
  connected_at: string;
}

export class GoogleCalendarConnectionsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async list(): Promise<GoogleCalendarConnectionSummary[]> {
    const { data, error } = await this.db
      .from("google_calendar_connections")
      .select("id, label, google_account_email, calendar_id, color, connected_at")
      .order("connected_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.from("google_calendar_connections").delete().eq("id", id);
    if (error) throw error;
  }
}

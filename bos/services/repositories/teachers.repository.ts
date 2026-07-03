import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class TeachersRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listActive(): Promise<Tables<"teachers">[]> {
    const { data, error } = await this.db.from("teachers").select("*").eq("active", true).order("name");
    if (error) throw error;
    return data ?? [];
  }

  async findById(id: string): Promise<Tables<"teachers"> | null> {
    const { data, error } = await this.db.from("teachers").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async findByName(name: string): Promise<Tables<"teachers"> | null> {
    const { data, error } = await this.db.from("teachers").select("*").ilike("name", name).maybeSingle();
    if (error) throw error;
    return data;
  }
}

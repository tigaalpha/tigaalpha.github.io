import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export class ReferencePhotosRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async list(): Promise<Tables<"reference_photos">[]> {
    const { data, error } = await this.db.from("reference_photos").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async upload(label: string, mimeType: string, imageBase64: string, createdBy: string | null): Promise<Tables<"reference_photos">> {
    const { data, error } = await this.db
      .from("reference_photos")
      .insert({ label, mime_type: mimeType, image_base64: imageBase64, created_by: createdBy })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.db.from("reference_photos").delete().eq("id", id);
    if (error) throw error;
  }
}

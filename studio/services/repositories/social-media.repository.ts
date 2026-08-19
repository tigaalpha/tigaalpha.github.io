import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialPlatform, SocialPostStatus, Tables } from "@/types/database";

export type SocialAccount = Tables<"social_accounts">;
export type SocialPost = Tables<"social_posts">;

export class SocialMediaRepository {
  constructor(private db: SupabaseClient) {}

  async getSocialAccounts(userId: string, platform?: SocialPlatform): Promise<SocialAccount[]> {
    let query = this.db.from("social_accounts").select("*").eq("user_id", userId);

    if (platform) {
      query = query.eq("platform", platform);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getSocialAccount(id: string, userId: string): Promise<SocialAccount | null> {
    const { data, error } = await this.db
      .from("social_accounts")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error?.code === "PGRST116") return null;
    if (error) throw error;
    return data;
  }

  async connectSocialAccount(
    userId: string,
    platform: SocialPlatform,
    accountName: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date,
    metadata?: Record<string, unknown>
  ): Promise<SocialAccount> {
    const { data, error } = await this.db
      .from("social_accounts")
      .upsert(
        {
          user_id: userId,
          platform,
          account_name: accountName,
          access_token: accessToken,
          refresh_token: refreshToken ?? null,
          token_expires_at: expiresAt?.toISOString() ?? null,
          metadata: metadata ?? {},
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform,account_name" }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async disconnectSocialAccount(id: string, userId: string): Promise<void> {
    const { error } = await this.db.from("social_accounts").delete().eq("id", id).eq("user_id", userId);
    if (error) throw error;
  }

  async createSocialPost(userId: string, content: string, platforms: SocialPlatform[]): Promise<SocialPost> {
    const { data, error } = await this.db
      .from("social_posts")
      .insert({
        user_id: userId,
        content,
        platforms,
        status: "queued",
        posted_at: null,
        external_ids: {},
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateSocialPostStatus(id: string, userId: string, status: SocialPostStatus, errorMessage?: string): Promise<SocialPost> {
    const { data, error } = await this.db
      .from("social_posts")
      .update({
        status,
        error_message: errorMessage ?? null,
        updated_at: new Date().toISOString(),
        posted_at: status === "success" ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getSocialPost(id: string, userId: string): Promise<SocialPost | null> {
    const { data, error } = await this.db
      .from("social_posts")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error?.code === "PGRST116") return null;
    if (error) throw error;
    return data;
  }

  async getUserSocialPosts(userId: string, limit = 20): Promise<SocialPost[]> {
    const { data, error } = await this.db
      .from("social_posts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data ?? [];
  }
}

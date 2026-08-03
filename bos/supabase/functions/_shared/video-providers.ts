import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { startVeoClip, type SourceImage } from "./veo.ts";
import { startSeedanceClip, type SeedanceVariant } from "./seedance.ts";

export type VideoProvider = "veo" | SeedanceVariant;

export const VIDEO_PROVIDERS: VideoProvider[] = ["veo", "seedance-2", "seedance-2-5"];

export function isVideoProvider(value: unknown): value is VideoProvider {
  return typeof value === "string" && (VIDEO_PROVIDERS as string[]).includes(value);
}

/** Reads whichever API key the chosen provider needs and throws a clear error if it's missing. */
export function requireProviderApiKey(provider: VideoProvider): string {
  if (provider === "veo") {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) throw new Error("GEMINI_API_KEY not configured");
    return key;
  }
  const key = Deno.env.get("FAL_API_KEY");
  if (!key) throw new Error("ยังไม่ได้ตั้งค่า FAL_API_KEY — ไปที่ Supabase Dashboard > Edge Functions > Secrets เพื่อเพิ่มก่อนใช้ Seedance");
  return key;
}

export async function startClip(admin: SupabaseClient, provider: VideoProvider, apiKey: string, userId: string, image: SourceImage) {
  if (provider === "veo") return startVeoClip(admin, apiKey, userId, image);
  return startSeedanceClip(admin, apiKey, userId, image, provider);
}

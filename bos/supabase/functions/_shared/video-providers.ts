import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { startVeoClip, type SourceImage } from "./veo.ts";
import { startSeedanceClip, type SeedanceVariant } from "./seedance.ts";
import { startLumaClip } from "./luma.ts";
import { startRunwayClip } from "./runway.ts";
import { startHailuoClip } from "./hailuo.ts";
import { startMinimaxH3Clip } from "./minimax-h3.ts";

export type VideoProvider = "veo" | SeedanceVariant | "luma-ray-2" | "runway-gen4-turbo" | "hailuo-2.3-fast" | "minimax-h3";

/** Defaults to "vertical" everywhere it's threaded through, to keep every existing caller's behavior unchanged. */
export type VideoOrientation = "vertical" | "horizontal";

export function isVideoOrientation(value: unknown): value is VideoOrientation {
  return value === "vertical" || value === "horizontal";
}

export const VIDEO_PROVIDERS: VideoProvider[] = [
  "veo",
  "seedance-2",
  "seedance-2-fast",
  "luma-ray-2",
  "runway-gen4-turbo",
  "hailuo-2.3-fast",
  "minimax-h3",
];

export function isVideoProvider(value: unknown): value is VideoProvider {
  return typeof value === "string" && (VIDEO_PROVIDERS as string[]).includes(value);
}

// fal.ai hosts Seedance, Luma, Hailuo, and MiniMax H3, so all four reuse
// FAL_API_KEY — only Runway needs a separate key since it isn't on fal.ai.
function providerKeyEnvVar(provider: VideoProvider): { envVar: string; missingMessage: string } {
  if (provider === "veo") return { envVar: "GEMINI_API_KEY", missingMessage: "GEMINI_API_KEY not configured" };
  if (provider === "runway-gen4-turbo") {
    return {
      envVar: "RUNWAY_API_KEY",
      missingMessage: "ยังไม่ได้ตั้งค่า RUNWAY_API_KEY — ไปที่ Supabase Dashboard > Edge Functions > Secrets เพื่อเพิ่มก่อนใช้ Runway",
    };
  }
  return {
    envVar: "FAL_API_KEY",
    missingMessage:
      "ยังไม่ได้ตั้งค่า FAL_API_KEY — ไปที่ Supabase Dashboard > Edge Functions > Secrets เพื่อเพิ่มก่อนใช้ Seedance/Luma/Hailuo/MiniMax H3",
  };
}

/** Reads whichever API key the chosen provider needs and throws a clear error if it's missing. */
export function requireProviderApiKey(provider: VideoProvider): string {
  const { envVar, missingMessage } = providerKeyEnvVar(provider);
  const key = Deno.env.get(envVar);
  if (!key) throw new Error(missingMessage);
  return key;
}

export async function startClip(
  admin: SupabaseClient,
  provider: VideoProvider,
  apiKey: string,
  userId: string,
  image: SourceImage,
  orientation: VideoOrientation = "vertical"
) {
  if (provider === "veo") return startVeoClip(admin, apiKey, userId, image, orientation);
  if (provider === "luma-ray-2") return startLumaClip(admin, apiKey, userId, image, orientation);
  if (provider === "runway-gen4-turbo") return startRunwayClip(admin, apiKey, userId, image, orientation);
  if (provider === "hailuo-2.3-fast") return startHailuoClip(admin, apiKey, userId, image, orientation);
  if (provider === "minimax-h3") return startMinimaxH3Clip(admin, apiKey, userId, image, orientation);
  return startSeedanceClip(admin, apiKey, userId, image, provider, orientation);
}

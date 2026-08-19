import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { SourceImage } from "./veo.ts";
import type { VideoOrientation } from "./video-providers.ts";
import { submitFalQueue } from "./fal-queue.ts";

// Model slugs confirmed against fal.ai's own docs/GitHub examples
// (bytedance/seedance-2.0/*) — "Seedance 2.5" isn't a live fal.ai model
// yet (only announced), so this offers the confirmed 2.0 standard/fast
// tiers instead of a guessed, nonexistent slug.
export type SeedanceVariant = "seedance-2" | "seedance-2-fast";

const DURATIONS = [4, 8];

function falModelId(variant: SeedanceVariant): string {
  const envKey = variant === "seedance-2" ? "FAL_SEEDANCE_2_MODEL" : "FAL_SEEDANCE_2_FAST_MODEL";
  const fallback = variant === "seedance-2" ? "bytedance/seedance-2.0/image-to-video" : "bytedance/seedance-2.0/fast/image-to-video";
  return Deno.env.get(envKey) ?? fallback;
}

export async function startSeedanceClip(
  admin: SupabaseClient,
  falApiKey: string,
  userId: string,
  image: SourceImage,
  variant: SeedanceVariant,
  orientation: VideoOrientation = "vertical"
) {
  const durationSeconds = DURATIONS[Math.floor(Math.random() * DURATIONS.length)];
  const modelId = falModelId(variant);

  const { statusUrl, responseUrl } = await submitFalQueue(falApiKey, modelId, {
    image_url: `data:${image.mime_type};base64,${image.image_base64}`,
    prompt: image.prompt,
    resolution: "720p",
    duration: String(durationSeconds),
    aspect_ratio: orientation === "horizontal" ? "16:9" : "9:16",
    generate_audio: false,
  });

  const operationName = JSON.stringify({ statusUrl, responseUrl });

  const { data: row, error: insertErr } = await admin
    .from("video_clips")
    .insert({
      source_image_id: image.id,
      status: "processing",
      provider: variant,
      operation_name: operationName,
      duration_seconds: durationSeconds,
      created_by: userId,
    })
    .select("*")
    .single();
  if (insertErr) throw insertErr;

  return row;
}

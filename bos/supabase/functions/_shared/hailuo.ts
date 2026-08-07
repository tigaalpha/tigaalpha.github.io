import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { SourceImage } from "./veo.ts";
import { submitFalQueue } from "./fal-queue.ts";

// MiniMax Hailuo 2.3 Fast (Standard) on fal.ai -- the cheapest Hailuo tier
// (~$0.03/sec, roughly Seedance-2.0-standard pricing) added specifically to
// give a lower-cost alternative to Veo/Luma/Runway. Model slug confirmed
// against fal.ai's own listing; overridable via env var (same escape hatch
// as FAL_SEEDANCE_2_MODEL) in case fal.ai renames/retires this exact slug.
const DURATIONS = [6, 10];

function falModelId(): string {
  return Deno.env.get("FAL_HAILUO_MODEL") ?? "fal-ai/minimax/hailuo-2.3-fast/standard/image-to-video";
}

export async function startHailuoClip(admin: SupabaseClient, falApiKey: string, userId: string, image: SourceImage) {
  const durationSeconds = DURATIONS[Math.floor(Math.random() * DURATIONS.length)];
  const modelId = falModelId();

  const { statusUrl, responseUrl } = await submitFalQueue(falApiKey, modelId, {
    image_url: `data:${image.mime_type};base64,${image.image_base64}`,
    prompt: image.prompt,
    duration: String(durationSeconds),
  });

  const operationName = JSON.stringify({ statusUrl, responseUrl });

  const { data: row, error: insertErr } = await admin
    .from("video_clips")
    .insert({
      source_image_id: image.id,
      status: "processing",
      provider: "hailuo-2.3-fast",
      operation_name: operationName,
      duration_seconds: durationSeconds,
      created_by: userId,
    })
    .select("*")
    .single();
  if (insertErr) throw insertErr;

  return row;
}

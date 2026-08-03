import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { SourceImage } from "./veo.ts";
import { submitFalQueue } from "./fal-queue.ts";

// Luma's Ray-2 image-to-video model is hosted on fal.ai (confirmed model
// slug: fal-ai/luma-dream-machine/ray-2/image-to-video), so this reuses
// the same FAL_API_KEY and queue mechanics as Seedance — no separate Luma
// account needed.
const DURATIONS = [5, 9];

function falModelId(): string {
  return Deno.env.get("FAL_LUMA_RAY2_MODEL") ?? "fal-ai/luma-dream-machine/ray-2/image-to-video";
}

export async function startLumaClip(admin: SupabaseClient, falApiKey: string, userId: string, image: SourceImage) {
  const durationSeconds = DURATIONS[Math.floor(Math.random() * DURATIONS.length)];

  const { statusUrl, responseUrl } = await submitFalQueue(falApiKey, falModelId(), {
    image_url: `data:${image.mime_type};base64,${image.image_base64}`,
    prompt: image.prompt,
    duration: String(durationSeconds),
    aspect_ratio: "9:16",
  });

  const operationName = JSON.stringify({ statusUrl, responseUrl });

  const { data: row, error: insertErr } = await admin
    .from("video_clips")
    .insert({
      source_image_id: image.id,
      status: "processing",
      provider: "luma-ray-2",
      operation_name: operationName,
      duration_seconds: durationSeconds,
      created_by: userId,
    })
    .select("*")
    .single();
  if (insertErr) throw insertErr;

  return row;
}

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { SourceImage } from "./veo.ts";
import type { VideoOrientation } from "./video-providers.ts";
import { submitFalQueue } from "./fal-queue.ts";

// MiniMax H3 (aka Hailuo 3.0) -- MiniMax's newest flagship model (launched
// July 2026): native 2K + audio, up to 15s. This is the model the owner
// asked for by its exact name ("MiniMax H3"). It's *not* the cheap option
// (~$0.13/sec, pricier than Hailuo 2.3 Fast's ~$0.03/sec, though still far
// cheaper than Luma Ray-2) -- kept as a separate provider alongside Hailuo
// 2.3 Fast so cost vs. quality/2K/audio is the owner's choice per video,
// not baked into one tradeoff.
const DURATIONS = [6, 10];

function falModelId(): string {
  return Deno.env.get("FAL_MINIMAX_H3_MODEL") ?? "minimax/h3/image-to-video";
}

export async function startMinimaxH3Clip(
  admin: SupabaseClient,
  falApiKey: string,
  userId: string,
  image: SourceImage,
  orientation: VideoOrientation = "vertical"
) {
  const durationSeconds = DURATIONS[Math.floor(Math.random() * DURATIONS.length)];

  const { statusUrl, responseUrl } = await submitFalQueue(falApiKey, falModelId(), {
    image_url: `data:${image.mime_type};base64,${image.image_base64}`,
    prompt: image.prompt,
    duration: String(durationSeconds),
    aspect_ratio: orientation === "horizontal" ? "16:9" : "9:16",
  });

  const operationName = JSON.stringify({ statusUrl, responseUrl });

  const { data: row, error: insertErr } = await admin
    .from("video_clips")
    .insert({
      source_image_id: image.id,
      status: "processing",
      provider: "minimax-h3",
      operation_name: operationName,
      duration_seconds: durationSeconds,
      created_by: userId,
    })
    .select("*")
    .single();
  if (insertErr) throw insertErr;

  return row;
}

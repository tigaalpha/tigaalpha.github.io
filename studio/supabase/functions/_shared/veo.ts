import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { VideoOrientation } from "./video-providers.ts";

// Shared by generate-video-clip-start (one image) and
// generate-video-batch-start (many images stitched into one long video
// client-side) so both kick off Veo generations the same way.
export const VEO_DURATIONS = [4, 8];

export function veoModel(): string {
  return Deno.env.get("AI_VIDEO_MODEL") ?? "veo-3.0-fast-generate-001";
}

export interface SourceImage {
  id: string;
  prompt: string;
  mime_type: string;
  image_base64: string;
}

export async function startVeoClip(
  admin: SupabaseClient,
  apiKey: string,
  userId: string,
  image: SourceImage,
  orientation: VideoOrientation = "vertical"
) {
  const durationSeconds = VEO_DURATIONS[Math.floor(Math.random() * VEO_DURATIONS.length)];
  const aspectRatio = orientation === "horizontal" ? "16:9" : "9:16";

  const startRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${veoModel()}:predictLongRunning?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: image.prompt, image: { bytesBase64Encoded: image.image_base64, mimeType: image.mime_type } }],
        parameters: { aspectRatio, durationSeconds },
      }),
    }
  );

  if (!startRes.ok) {
    const detail = await startRes.text();
    throw new Error(`Veo request failed (${startRes.status}): ${detail.slice(0, 400)}`);
  }

  const operation = (await startRes.json()) as { name?: string };
  if (!operation.name) throw new Error("Veo did not return an operation name");

  const { data: row, error: insertErr } = await admin
    .from("video_clips")
    .insert({
      source_image_id: image.id,
      status: "processing",
      provider: "veo",
      operation_name: operation.name,
      duration_seconds: durationSeconds,
      created_by: userId,
    })
    .select("*")
    .single();
  if (insertErr) throw insertErr;

  return row;
}

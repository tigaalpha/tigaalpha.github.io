import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

// Veo (image-to-video) turns one Image Studio still into a few seconds of
// real motion — distinct from the free client-side slideshow, which only
// crossfades stills and never actually animates anything. Generation is a
// long-running Google operation (can take minutes), so this just kicks it
// off; generate-video-clip-status polls it to completion.
const DURATIONS = [4, 8];

function videoModel(): string {
  return Deno.env.get("AI_VIDEO_MODEL") ?? "veo-3.0-fast-generate-001";
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "generate-video-clip", { windowMinutes: 60, maxRequests: 10 });

    const { imageId } = await req.json();
    if (!imageId || typeof imageId !== "string") return jsonResponse({ error: "imageId is required" }, 400);

    const { data: image, error: imageErr } = await admin
      .from("generated_images")
      .select("id, prompt, mime_type, image_base64")
      .eq("id", imageId)
      .maybeSingle();
    if (imageErr) throw imageErr;
    if (!image) return jsonResponse({ error: "Image not found" }, 404);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return jsonResponse({ error: "GEMINI_API_KEY not configured" }, 400);

    const durationSeconds = DURATIONS[Math.floor(Math.random() * DURATIONS.length)];

    const startRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${videoModel()}:predictLongRunning?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [
            {
              prompt: image.prompt,
              image: { bytesBase64Encoded: image.image_base64, mimeType: image.mime_type },
            },
          ],
          parameters: { aspectRatio: "9:16", durationSeconds },
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
        operation_name: operation.name,
        duration_seconds: durationSeconds,
        created_by: userId,
      })
      .select("*")
      .single();
    if (insertErr) throw insertErr;

    return jsonResponse({ videoClip: row }, 201);
  } catch (error) {
    if (error instanceof RateLimitError) {
      await logSystemEvent(admin, "generate-video-clip-start", "warning", error.message);
      return jsonResponse({ error: error.message }, 429);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    await logSystemEvent(admin, "generate-video-clip-start", "error", message);
    return jsonResponse({ error: message }, 500);
  }
});

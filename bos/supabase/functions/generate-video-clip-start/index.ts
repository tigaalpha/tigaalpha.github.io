import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logSystemEvent } from "../_shared/monitor.ts";
import { startVeoClip } from "../_shared/veo.ts";

// Veo (image-to-video) turns one Image Studio still into a few seconds of
// real motion — distinct from the free client-side slideshow, which only
// crossfades stills and never actually animates anything. Generation is a
// long-running Google operation (can take minutes), so this just kicks it
// off; generate-video-clip-status polls it to completion.
//
// Shared "generate-video-clip" rate-limit bucket with generate-video-batch-start
// (a batch of N images makes N of these calls) — capped generously enough
// for a full 20-image batch, not just single clips.
const RATE_LIMIT = { windowMinutes: 60, maxRequests: 40 };

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "generate-video-clip", RATE_LIMIT);

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

    const row = await startVeoClip(admin, apiKey, userId, image);

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

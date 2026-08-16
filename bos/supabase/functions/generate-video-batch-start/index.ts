import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { isVideoProvider, isVideoOrientation, requireProviderApiKey, startClip } from "../_shared/video-providers.ts";
import { checkVideoDailyBudget } from "../_shared/video-budget.ts";
import type { SourceImage } from "../_shared/veo.ts";

// Kicks off one generation (Veo or Seedance, whichever the caller picked)
// per selected image, in the order given — the frontend polls each
// resulting video_clips row individually, then once all of them finish,
// stitches the clips into one long continuous video client-side (no
// server-side video encoding involved).
const MAX_IMAGES = 20;
const RATE_LIMIT = { windowMinutes: 60, maxRequests: 40 };

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);

    const { imageIds, provider = "veo", orientation = "vertical" } = await req.json();
    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      return jsonResponse({ error: "imageIds must be a non-empty array" }, 400);
    }
    if (imageIds.length > MAX_IMAGES) {
      return jsonResponse({ error: `Select at most ${MAX_IMAGES} images per batch` }, 400);
    }
    if (!isVideoProvider(provider)) return jsonResponse({ error: "Invalid provider" }, 400);
    if (!isVideoOrientation(orientation)) return jsonResponse({ error: "Invalid orientation" }, 400);

    const apiKey = requireProviderApiKey(provider);

    const { data: images, error: imagesErr } = await admin
      .from("generated_images")
      .select("id, prompt, mime_type, image_base64")
      .in("id", imageIds);
    if (imagesErr) throw imagesErr;

    const byId = new Map((images ?? []).map((img) => [img.id, img as SourceImage]));
    const orderedImages = imageIds.map((id: string) => byId.get(id)).filter((img): img is SourceImage => Boolean(img));
    if (orderedImages.length === 0) return jsonResponse({ error: "No matching images found" }, 404);

    // Daily video budget: a batch of N clips needs N remaining slots today.
    const budget = await checkVideoDailyBudget(admin, orderedImages.length);
    if (!budget.allowed) return jsonResponse({ error: budget.message }, 429);

    const videoClips = [];
    for (const image of orderedImages) {
      try {
        await enforceRateLimit(admin, userId, "generate-video-clip", RATE_LIMIT);
      } catch (err) {
        if (err instanceof RateLimitError) break;
        throw err;
      }
      const row = await startClip(admin, provider, apiKey, userId, image, orientation);
      videoClips.push(row);
    }

    return jsonResponse({ videoClips, requested: orderedImages.length, started: videoClips.length });
  } catch (error) {
    return await handleUnexpectedError(admin, "generate-video-batch-start", error);
  }
});

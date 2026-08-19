import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { generateImage } from "../_shared/ai-provider.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";

const MAX_PROMPT_LENGTH = 2000;

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "generate-image", { windowMinutes: 60, maxRequests: 10 });

    const { prompt, referencePhotoId } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return jsonResponse({ error: "prompt is required" }, 400);
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return jsonResponse({ error: `prompt must be ${MAX_PROMPT_LENGTH} characters or fewer` }, 400);
    }

    let referenceImage: { mimeType: string; base64: string } | undefined;
    if (referencePhotoId && typeof referencePhotoId === "string") {
      const { data: photo, error: photoErr } = await admin
        .from("reference_photos")
        .select("mime_type, image_base64")
        .eq("id", referencePhotoId)
        .maybeSingle();
      if (photoErr) throw photoErr;
      if (!photo) return jsonResponse({ error: "Reference photo not found" }, 404);
      referenceImage = { mimeType: photo.mime_type, base64: photo.image_base64 };
    }

    const image = await generateImage(prompt, referenceImage);

    const { data: row, error } = await admin
      .from("generated_images")
      .insert({ prompt, mime_type: image.mimeType, image_base64: image.base64, created_by: userId })
      .select("*")
      .single();
    if (error) throw error;

    return jsonResponse({ image: row }, 201);
  } catch (error) {
    if (error instanceof RateLimitError) {
      await logSystemEvent(admin, "generate-image", "warning", error.message);
      return jsonResponse({ error: error.message }, 429);
    }
    return await handleUnexpectedError(admin, "generate-image", error);
  }
});

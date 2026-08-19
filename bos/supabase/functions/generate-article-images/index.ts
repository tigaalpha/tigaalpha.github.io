import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { generate, generateImage } from "../_shared/ai-provider.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";
import type { ChatModelId } from "../_shared/ai-provider.ts";

const MAX_ARTICLE_LENGTH = 15000;
const MAX_SCENES = 6;

interface SceneResult {
  sceneNumber: number;
  title: string;
  description: string;
  prompt: string;
  landscape: { mimeType: string; base64: string } | null;
  portrait: { mimeType: string; base64: string } | null;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "generate-article-images", { windowMinutes: 60, maxRequests: 5 });

    const { article, model } = await req.json();
    if (!article || typeof article !== "string") {
      return jsonResponse({ error: "article text is required" }, 400);
    }
    if (article.length > MAX_ARTICLE_LENGTH) {
      return jsonResponse({ error: `article must be ${MAX_ARTICLE_LENGTH} characters or fewer` }, 400);
    }

    const modelId = (model as ChatModelId) || "gemini";

    // Step 1: Use AI to analyze the article and break it into scenes
    const analysisPrompt = `You are a professional video storyboard artist. Analyze the following article and break it into ${MAX_SCENES} key visual scenes for video content.

For each scene, provide:
1. A short title (in the same language as the article)
2. A brief description of what the scene shows
3. A detailed image generation prompt in English that describes the scene visually — include composition, lighting, mood, and style. Make it cinematic and suitable for both landscape (16:9) and portrait (9:16) formats.

Return EXACTLY a JSON array with ${MAX_SCENES} objects, each with keys: "title", "description", "prompt". No markdown, no explanation — just the raw JSON array.

Article:
${article.slice(0, 12000)}`;

    const analysisResult = await generate(
      [{ role: "user", content: analysisPrompt }],
      undefined,
      0.7,
      4096,
      "content"
    );

    let scenes: { title: string; description: string; prompt: string }[];
    try {
      const rawText = analysisResult.text.trim();
      // Extract JSON array from the response (handle potential markdown wrapping)
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No JSON array found");
      scenes = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(scenes) || scenes.length === 0) throw new Error("Empty scenes array");
    } catch {
      return jsonResponse({ error: "AI could not parse article into scenes. Try a different article or shorter text." }, 422);
    }

    // Step 2: Generate images for each scene (landscape + portrait)
    const results: SceneResult[] = [];
    const savedImages: { prompt: string; mime_type: string; image_base64: string; created_by: string }[] = [];

    for (let i = 0; i < Math.min(scenes.length, MAX_SCENES); i++) {
      const scene = scenes[i];
      const sceneResult: SceneResult = {
        sceneNumber: i + 1,
        title: scene.title,
        description: scene.description,
        prompt: scene.prompt,
        landscape: null,
        portrait: null,
      };

      try {
        // Landscape (16:9)
        const landscapePrompt = `${scene.prompt} — Landscape composition, 16:9 aspect ratio, wide cinematic frame, horizontal orientation`;
        const landscape = await generateImage(landscapePrompt);
        sceneResult.landscape = { mimeType: landscape.mimeType, base64: landscape.base64 };
        savedImages.push({
          prompt: `[Scene ${i + 1} Landscape] ${scene.prompt}`,
          mime_type: landscape.mimeType,
          image_base64: landscape.base64,
          created_by: userId,
        });
      } catch {
        // Landscape generation failed — continue with portrait
      }

      try {
        // Portrait (9:16)
        const portraitPrompt = `${scene.prompt} — Portrait composition, 9:16 aspect ratio, vertical frame, mobile-optimized, tall orientation`;
        const portrait = await generateImage(portraitPrompt);
        sceneResult.portrait = { mimeType: portrait.mimeType, base64: portrait.base64 };
        savedImages.push({
          prompt: `[Scene ${i + 1} Portrait] ${scene.prompt}`,
          mime_type: portrait.mimeType,
          image_base64: portrait.base64,
          created_by: userId,
        });
      } catch {
        // Portrait generation failed — continue
      }

      results.push(sceneResult);
    }

    // Save all generated images to the database
    if (savedImages.length > 0) {
      await admin.from("generated_images").insert(savedImages);
    }

    return jsonResponse({ scenes: results, savedCount: savedImages.length }, 200);
  } catch (error) {
    if (error instanceof RateLimitError) {
      await logSystemEvent(admin, "generate-article-images", "warning", error.message);
      return jsonResponse({ error: error.message }, 429);
    }
    return await handleUnexpectedError(admin, "generate-article-images", error);
  }
});

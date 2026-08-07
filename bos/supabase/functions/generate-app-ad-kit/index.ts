import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { generate } from "../_shared/ai-provider.ts";
import { researchWithSearch } from "../_shared/gemini.ts";
import { PROMPTS } from "../_shared/prompts.ts";
import type { ToolDefinition } from "../_shared/ai-types.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";

const RETURN_APP_AD_KIT_TOOL: ToolDefinition = {
  name: "return_app_ad_kit",
  description: "Return the complete app ad kit. Call this exactly once with the full result — never reply with plain text instead.",
  parameters: {
    type: "object",
    properties: {
      appName: { type: "string" },
      summary: { type: "string" },
      topFeatures: {
        type: "array",
        description: "Exactly 5 items.",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            imagePrompt: { type: "string" },
          },
          required: ["title", "description", "imagePrompt"],
        },
      },
      articleMarkdown: { type: "string" },
      videoConcepts: {
        type: "array",
        description: "Exactly 2 items: one feature_highlight, one testimonial_review.",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["feature_highlight", "testimonial_review"] },
            script: { type: "string" },
            videoPrompt: { type: "string" },
          },
          required: ["type", "script", "videoPrompt"],
        },
      },
    },
    required: ["appName", "summary", "topFeatures", "articleMarkdown", "videoConcepts"],
  },
};

interface AppAdKitArgs {
  appName: string;
  summary: string;
  topFeatures: { title: string; description: string; imagePrompt: string }[];
  articleMarkdown: string;
  videoConcepts: { type: "feature_highlight" | "testimonial_review"; script: string; videoPrompt: string }[];
}

function isValidPublicUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  // Basic SSRF guard -- research goes through Gemini's own search
  // infrastructure below, not a direct server-side fetch of this URL, but
  // the URL still ends up in a prompt, so reject anything that looks like
  // an attempt to target internal infrastructure rather than a real app link.
  if (host === "localhost" || host.endsWith(".local") || /^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
  return true;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "generate-app-ad-kit", { windowMinutes: 60, maxRequests: 10 });

    const { appUrl } = await req.json();
    if (typeof appUrl !== "string" || !isValidPublicUrl(appUrl)) {
      return jsonResponse({ error: "appUrl must be a valid http(s) URL" }, 400);
    }

    // Gemini's own search-grounding infrastructure fetches/reads the page,
    // not this server directly -- same pattern as generate-competitor-analysis
    // and generate-course-article.
    const research = await researchWithSearch(
      `Look up the mobile or web application at this URL and describe it in detail: ${appUrl}\n\nInclude: the app's real name, what it does, who it's for, and its most notable, specific features or capabilities (not generic claims). If you cannot find real information about this specific app, say so clearly rather than guessing.`
    );

    const systemPrompt = `${PROMPTS.app_ad_kit}\n\n## Web research about this app (ground everything in this — never invent beyond it)\n${research.text}`;
    const userPrompt = `App URL: ${appUrl}\n\nCall return_app_ad_kit with the complete result.`;

    const result = await generate(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      [RETURN_APP_AD_KIT_TOOL],
      0.7,
      8192
    );

    const call = result.message.toolCalls?.find((c) => c.name === "return_app_ad_kit");
    if (!call) {
      return jsonResponse({ error: "The AI didn't return a structured ad kit — try again." }, 502);
    }
    const args = call.arguments as unknown as AppAdKitArgs;

    const { data: kit, error: insertError } = await admin
      .from("app_ad_kits")
      .insert({
        app_url: appUrl,
        app_name: args.appName,
        summary: args.summary,
        top_features: args.topFeatures,
        article_markdown: args.articleMarkdown,
        video_concepts: args.videoConcepts,
        sources: research.sources,
        created_by: userId,
      })
      .select("*")
      .single();
    if (insertError) throw insertError;

    return jsonResponse({ appAdKit: kit }, 201);
  } catch (error) {
    if (error instanceof RateLimitError) {
      await logSystemEvent(admin, "generate-app-ad-kit", "warning", error.message);
      return jsonResponse({ error: error.message }, 429);
    }
    return await handleUnexpectedError(admin, "generate-app-ad-kit", error);
  }
});

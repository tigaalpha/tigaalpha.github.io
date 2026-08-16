import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { generate } from "../_shared/ai-provider.ts";
import { logAiUsage } from "../_shared/usage-logging.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

// Video repurposing (Feature #8): one approved article → 2 short vertical
// video scripts (TikTok/Reels/Shorts) + captions + hashtags, stored as
// kind='short' rows in content_calendar for the owner to render/publish.
// Script-level today — no external video API needed, and the existing
// Vertical Video tool already renders from scripts.
const MAX_SOURCES = 2;
const SHORTS_PER_SOURCE = 2;

Deno.serve(async (req: Request) => {
  const preflight = req.method === "OPTIONS" ? jsonResponse({}, 200) : null;
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    // Source material: approved content-calendar articles, then any article.
    const { data: approved } = await admin
      .from("content_calendar")
      .select("id, title, body")
      .eq("kind", "article")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(MAX_SOURCES);
    const sources = (approved ?? []).length > 0 ? approved : [];

    let created = 0;
    for (const source of sources.slice(0, MAX_SOURCES)) {
      for (let i = 0; i < SHORTS_PER_SOURCE; i++) {
        const result = await generate([
          {
            role: "system",
            content:
              "Write ONE short vertical video script (15-30 seconds, spoken aloud) in Thai for TikTok/Reels/Shorts, based on the given article. " +
              "Output: the script as plain spoken paragraphs (no scene directions, no brackets), then a caption (1-2 sentences) and 4-6 hashtags " +
              "on separate lines. No markdown symbols.",
          },
          { role: "user", content: `Title: ${source.title}\nArticle: ${(source.body ?? "").slice(0, 3000)}` },
        ]);
        await logAiUsage(admin, result.usage, "video-repurpose");

        await admin.from("content_calendar").insert({
          kind: "short",
          title: `${source.title} (Short ${i + 1})`,
          body: result.message.content.trim(),
          platform: "tiktok/reels/shorts",
          status: "draft",
        });
        created += 1;
      }
    }

    if (created > 0) await logSystemEvent(admin, "video-repurpose", "info", `${created} shorts drafted`);
    return jsonResponse({ sources: sources.length, created });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logSystemEvent(admin, "video-repurpose", "error", message);
    return jsonResponse({ error: message }, 500);
  }
});

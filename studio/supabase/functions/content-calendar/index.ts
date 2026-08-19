import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { generate } from "../_shared/ai-provider.ts";
import { logAiUsage } from "../_shared/usage-logging.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

// Content pipeline (Feature #7): every Monday the AI plans next week's
// content — 3 items (SEO article / short video script / social post) for a
// Thai piano school — and writes full drafts into content_calendar. The
// owner opens the Content page, approves what's worth publishing, and the
// rest is skipped. Self-contained (no external topic sources needed yet).
const MAX_ITEMS = 3;

Deno.serve(async (req: Request) => {
  const preflight = req.method === "OPTIONS" ? jsonResponse({}, 200) : null;
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const planResult = await generate([
      {
        role: "system",
        content:
          "You are the marketing planner for Tiga Studio, a Thai piano school. Propose 3 concrete content ideas for next week " +
          "that will attract parents and adult beginners. For each: title, kind (one of article/short/social), target platform, " +
          "and a 1-sentence angle. Reply as plain text, one idea per block, separated by a blank line. No markdown symbols.",
      },
      { role: "user", content: "Plan next week's content." },
    ]);
    await logAiUsage(admin, planResult.usage, "content-calendar:plan");

    const planned = planResult.message.content
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .filter(Boolean)
      .slice(0, MAX_ITEMS);

    let created = 0;
    for (const block of planned) {
      const kind = block.includes("short") ? "short" : block.includes("social") ? "social" : "article";
      const titleLine = block.split("\n")[0]?.replace(/^[-•*\d.\s]+/, "").trim() ?? "เนื้อหาสัปดาห์หน้า";
      const title = titleLine.length > 120 ? titleLine.slice(0, 120) : titleLine;

      // Expand the angle into a real draft body.
      const draftResult = await generate([
        {
          role: "system",
          content:
            "Write the full draft for this content piece in Thai, plain text paragraphs (no markdown, no lists, no special symbols). " +
            "Ground everything in general piano-school truths — never invent prices or teacher names. For a 'short', write a 20-30s spoken script. " +
            "For 'social', write 2-3 short sentences. For 'article', write 3-4 short paragraphs.",
        },
        { role: "user", content: `Title: ${title}\nIdea: ${block}` },
      ]);
      await logAiUsage(admin, draftResult.usage, "content-calendar:draft");

      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await admin.from("content_calendar").insert({
        kind,
        title,
        body: draftResult.message.content.trim(),
        platform: "tbd",
        planned_date: nextWeek.toISOString().slice(0, 10),
        status: "draft",
      });
      created += 1;
    }

    if (created > 0) await logSystemEvent(admin, "content-calendar", "info", `${created} items planned`);
    return jsonResponse({ created });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logSystemEvent(admin, "content-calendar", "error", message);
    return jsonResponse({ error: message }, 500);
  }
});

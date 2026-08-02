import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { broadcast } from "../_shared/line.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

const GRAPH_VERSION = "v19.0";

// Instagram/TikTok/YouTube all require an attached image/video via their
// APIs — there is no plain-text post endpoint for any of them, and the
// content queue here only ever collects text. Real auto-posting is only
// possible for Facebook (Page feed post) and LINE (broadcast) today; the
// others stay on the manual copy-link fallback already in the frontend.
const SUPPORTED_PLATFORMS = new Set(["facebook", "line"]);

async function publishToFacebook(admin: ReturnType<typeof createAdminClient>, userId: string, content: string): Promise<string> {
  const { data: account } = await admin.from("social_accounts").select("*").eq("user_id", userId).eq("platform", "facebook").maybeSingle();
  if (!account) throw new Error("ยังไม่ได้เชื่อมต่อ Facebook Page — ไปที่ Settings > Integrations");

  const pageId = (account.metadata as { pageId?: string })?.pageId;
  if (!pageId) throw new Error("ไม่พบ Page ID ที่เชื่อมต่อไว้ — ลองเชื่อมต่อ Facebook ใหม่");

  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ message: content, access_token: account.access_token }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Facebook ปฏิเสธการโพสต์ (${response.status}): ${body.slice(0, 300)}`);
  }
  const data = (await response.json()) as { id?: string };
  return data.id ?? "unknown";
}

async function publishToLine(content: string): Promise<string> {
  if (!Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")) throw new Error("LINE ยังไม่ได้ตั้งค่า — ไปที่ Settings > Integrations");
  await broadcast(content);
  return "broadcast";
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    const { postId } = (await req.json()) as { postId: string };
    if (!postId) return jsonResponse({ error: "postId is required" }, 400);

    const { data: post, error: fetchErr } = await admin.from("social_posts").select("*").eq("id", postId).eq("user_id", userId).single();
    if (fetchErr || !post) return jsonResponse({ error: "Post not found" }, 404);

    await admin.from("social_posts").update({ status: "posting" }).eq("id", postId);

    const externalIds: Record<string, string> = { ...(post.external_ids as Record<string, string>) };
    const errors: string[] = [];
    const targetPlatforms = (post.platforms as string[]).filter((p) => SUPPORTED_PLATFORMS.has(p) && !externalIds[p]);

    for (const platform of targetPlatforms) {
      try {
        externalIds[platform] = platform === "facebook" ? await publishToFacebook(admin, userId, post.content) : await publishToLine(post.content);
      } catch (err) {
        errors.push(`${platform}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const anySucceeded = targetPlatforms.some((p) => externalIds[p]);
    const status = errors.length === 0 ? "success" : anySucceeded ? "success" : "failed";

    const { data: updated, error: updateErr } = await admin
      .from("social_posts")
      .update({ status, external_ids: externalIds, error_message: errors.length > 0 ? errors.join("; ") : null })
      .eq("id", postId)
      .select("*")
      .single();
    if (updateErr) throw updateErr;

    if (errors.length > 0) await logSystemEvent(admin, "social-publish", "warning", errors.join("; "));

    return jsonResponse({ post: updated, published: targetPlatforms.filter((p) => externalIds[p]), failed: errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await logSystemEvent(admin, "social-publish", "error", message);
    return jsonResponse({ error: message }, 500);
  }
});

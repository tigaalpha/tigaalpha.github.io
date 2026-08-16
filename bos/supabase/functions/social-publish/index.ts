import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { broadcast } from "../_shared/line.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";

const GRAPH_VERSION = "v19.0";

// TikTok/YouTube require an attached video via their APIs, so they stay on
// the manual copy-link fallback. Instagram works with an image through the
// Graph API container flow (same Meta token as the Facebook Page) — enabled
// when the post carries media_urls. Facebook (text feed) and LINE
// (broadcast) auto-post as before.
const SUPPORTED_PLATFORMS = new Set(["facebook", "line", "instagram"]);

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

// Instagram image post via the container API: upload media_urls[0] with the
// caption, then publish the container. Uses the same Meta Page token as the
// Facebook publish — the connected Instagram Business account must be linked
// to that Page in Meta.
async function publishToInstagram(admin: ReturnType<typeof createAdminClient>, userId: string, content: string, mediaUrls: string[]): Promise<string> {
  const imageUrl = mediaUrls[0];
  if (!imageUrl) throw new Error("โพสต์ Instagram ต้องมีรูป — เพิ่มรูปในโพสต์ก่อน");

  const { data: account } = await admin.from("social_accounts").select("*").eq("user_id", userId).eq("platform", "facebook").maybeSingle();
  if (!account) throw new Error("ยังไม่ได้เชื่อมต่อ Facebook Page — ไปที่ Settings > Integrations");
  const token = account.access_token as string;
  const pageId = (account.metadata as { pageId?: string })?.pageId;
  if (!pageId) throw new Error("ไม่พบ Page ID ที่เชื่อมต่อไว้");

  // Resolve the linked Instagram Business account id from the Page.
  const pageRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}?fields=connected_instagram_account{id}&access_token=${token}`);
  const pageData = (await pageRes.json()) as { connected_instagram_account?: { id?: string }; error?: { message?: string } };
  const igId = pageData?.connected_instagram_account?.id;
  if (!igId) throw new Error(`Instagram ยังไม่ได้เชื่อมกับ Page นี้ (${pageData?.error?.message ?? "ไม่พบ Instagram Business Account"})`);

  const createRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ image_url: imageUrl, caption: content, access_token: token }),
  });
  const createData = (await createRes.json()) as { id?: string; error?: { message?: string } };
  if (!createData.id) throw new Error(`Instagram สร้าง media ไม่สำเร็จ: ${createData.error?.message ?? "unknown"}`);

  const pubRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${igId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: createData.id, access_token: token }),
  });
  const pubData = (await pubRes.json()) as { id?: string; error?: { message?: string } };
  if (!pubData.id) throw new Error(`Instagram publish ไม่สำเร็จ: ${pubData.error?.message ?? "unknown"}`);
  return pubData.id;
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
        const mediaUrls = Array.isArray(post.media_urls) ? post.media_urls : [];
        externalIds[platform] =
          platform === "facebook"
            ? await publishToFacebook(admin, userId, post.content)
            : platform === "instagram"
              ? await publishToInstagram(admin, userId, post.content, mediaUrls)
              : await publishToLine(post.content);
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
    return await handleUnexpectedError(admin, "social-publish", error);
  }
});

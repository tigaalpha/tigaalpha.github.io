import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { broadcast } from "../_shared/line.ts";
import { buildOAuthHeader } from "../_shared/x-oauth.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";

const GRAPH_VERSION = "v19.0";

// TikTok and YouTube require an attached video via their APIs, so TikTok
// stays enabled only when the post carries a public media URL (video or
// photo, PULL_FROM_URL — Supabase Storage public URLs work); YouTube keeps
// the manual copy-link fallback. Instagram works with an image through the
// Graph API container flow (same Meta token as the Facebook Page). X
// (Twitter) posts text and uploads a single image/video ≤5MB via OAuth 1.0a.
const SUPPORTED_PLATFORMS = new Set(["facebook", "line", "instagram", "tiktok", "x"]);

async function publishToFacebook(admin: ReturnType<typeof createAdminClient>, userId: string, content: string): Promise<string> {
  const { data: account } = await admin.from("social_accounts").select("id, access_token, metadata").eq("user_id", userId).eq("platform", "facebook").maybeSingle();
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

  const { data: account } = await admin.from("social_accounts").select("access_token, metadata").eq("user_id", userId).eq("platform", "facebook").maybeSingle();
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

// TikTok Content Posting API — PULL_FROM_URL (media must be a public URL,
// e.g. a Supabase Storage public URL). Sandbox apps are forced to SELF_ONLY;
// production apps default to SELF_ONLY too until `tiktok_privacy_level`
// integration setting is set to PUBLIC_TO_EVERYONE (Settings > Integrations).
async function publishToTiktok(admin: ReturnType<typeof createAdminClient>, userId: string, content: string, mediaUrls: string[]): Promise<string> {
  const { data: account } = await admin.from("social_accounts").select("access_token").eq("user_id", userId).eq("platform", "tiktok").maybeSingle();
  if (!account) throw new Error("ยังไม่ได้เชื่อมต่อ TikTok — ไปที่ Settings > Integrations");

  const mediaUrl = mediaUrls[0];
  if (!mediaUrl) throw new Error("โพสต์ TikTok ต้องมีรูปหรือวิดีโอ — เพิ่ม media URL ในโพสต์ก่อน (Supabase Storage public URL)");

  const { data: privacyRow } = await admin.from("integration_settings").select("value").eq("key", "tiktok_privacy_level").maybeSingle();
  const privacyLevel = (privacyRow?.value as string | undefined)?.trim() || "SELF_ONLY";

  const isVideo = /\.(mp4|mov|webm|m4v|mkv)(\?|$)/i.test(mediaUrl);
  const initUrl = isVideo ? "https://open.tiktokapis.com/v2/post/publish/video/init/" : "https://open.tiktokapis.com/v2/post/publish/photo/init/";
  const source = isVideo ? { source: "PULL_FROM_URL", video_url: mediaUrl } : { source: "PULL_FROM_URL", photo_cover: mediaUrl };

  const headers = { Authorization: `Bearer ${account.access_token}`, "Content-Type": "application/json" };

  const initResponse = await fetch(initUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      post_info: { title: content.slice(0, 2200), privacy_level: privacyLevel, disable_duet: false, disable_comment: false, disable_stitch: false },
      source,
    }),
  });
  if (!initResponse.ok) {
    const body = await initResponse.text();
    throw new Error(`TikTok ปฏิเสธคำขอโพสต์ (${initResponse.status}): ${body.slice(0, 300)}`);
  }
  const initData = (await initResponse.json()) as { data?: { publish_id?: string }; error?: { message?: string } };
  const publishId = initData.data?.publish_id;
  if (!publishId) throw new Error(`TikTok ไม่คืน publish_id: ${initData.error?.message ?? "unknown"}`);

  // Poll the publish status (up to ~18s). Still processing after that isn't
  // a failure — TikTok finishes it on their side; we report the publish id.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const statusResponse = await fetch("https://open.tiktokapis.com/v2/post/publish/status/fetch/", {
      method: "POST",
      headers,
      body: JSON.stringify({ publish_id: publishId }),
    });
    if (!statusResponse.ok) continue;
    const statusData = (await statusResponse.json()) as { data?: { status?: string; fail_reason?: string } };
    const status = statusData.data?.status;
    if (status === "PUBLISH_COMPLETE") return publishId;
    if (status === "FAILED") throw new Error(`TikTok โพสต์ล้มเหลว: ${statusData.data?.fail_reason ?? "ไม่ทราบสาเหตุ"}`);
    // PROCESSING -> keep polling
  }
  return publishId;
}

async function getXCredentials(admin: ReturnType<typeof createAdminClient>): Promise<{ consumerKey: string; consumerSecret: string }> {
  const { data: keyRow } = await admin.from("integration_settings").select("value").eq("key", "x_client_key").maybeSingle();
  const consumerKey = keyRow?.value as string | undefined;
  const consumerSecret = Deno.env.get("X_API_SECRET");
  if (!consumerKey || !consumerSecret) throw new Error("ยังไม่ได้ตั้งค่า X — ใส่ API Key ใน Settings > Integrations และ X_API_SECRET ใน Supabase Secrets");
  return { consumerKey, consumerSecret };
}

// X (Twitter): OAuth 1.0a user-context posting. Text via /2/tweets; one
// attached image/video ≤5MB via /1.1/media/upload (chunked upload for
// larger files is not implemented — the clear error below tells the owner
// to post that one manually, same behavior documented in docs/SETUP.md).
async function publishToX(admin: ReturnType<typeof createAdminClient>, userId: string, content: string, mediaUrls: string[]): Promise<string> {
  const { data: account } = await admin.from("social_accounts").select("access_token, refresh_token, metadata").eq("user_id", userId).eq("platform", "x").maybeSingle();
  if (!account) throw new Error("ยังไม่ได้เชื่อมต่อ X (Twitter) — ไปที่ Settings > Integrations");
  const { consumerKey, consumerSecret } = await getXCredentials(admin);
  const creds = {
    consumerKey,
    consumerSecret,
    token: account.access_token as string,
    tokenSecret: (account.refresh_token as string | null) ?? ((account.metadata as { tokenSecret?: string })?.tokenSecret ?? ""),
  };

  let mediaId: string | null = null;
  const mediaUrl = mediaUrls[0];
  if (mediaUrl) {
    const mediaResponse = await fetch(mediaUrl);
    if (!mediaResponse.ok) throw new Error(`ดึง media จาก ${mediaUrl} ไม่สำเร็จ (${mediaResponse.status})`);
    const blob = await mediaResponse.blob();
    if (blob.size > 5 * 1024 * 1024) {
      throw new Error("ไฟล์ >5MB ยังไม่รองรับการโพสต์ X ผ่านระบบ (ต้อง chunked upload) — โพสต์คลิปนี้เองผ่าน X");
    }

    const form = new FormData();
    form.append("media", blob);
    const uploadHeader = await buildOAuthHeader(creds, "POST", "https://upload.twitter.com/1.1/media/upload.json", []);
    const uploadResponse = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
      method: "POST",
      headers: { Authorization: uploadHeader },
      body: form,
    });
    if (!uploadResponse.ok) {
      const body = await uploadResponse.text();
      throw new Error(`X อัปโหลด media ไม่สำเร็จ (${uploadResponse.status}): ${body.slice(0, 300)}`);
    }
    const uploadData = (await uploadResponse.json()) as { media_id_string?: string; media_id?: number };
    mediaId = uploadData.media_id_string ?? (uploadData.media_id ? String(uploadData.media_id) : null);
    if (!mediaId) throw new Error("X ไม่คืน media_id");
  }

  const tweetBody: Record<string, unknown> = { text: content.slice(0, 280) };
  if (mediaId) tweetBody.media = { media_ids: [mediaId] };

  const tweetsHeader = await buildOAuthHeader(creds, "POST", "https://api.twitter.com/2/tweets", []);
  const tweetsResponse = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: { Authorization: tweetsHeader, "Content-Type": "application/json" },
    body: JSON.stringify(tweetBody),
  });
  if (!tweetsResponse.ok) {
    const body = await tweetsResponse.text();
    throw new Error(`X ปฏิเสธการโพสต์ (${tweetsResponse.status}): ${body.slice(0, 300)}`);
  }
  const tweetsData = (await tweetsResponse.json()) as { data?: { id?: string } };
  return tweetsData.data?.id ?? "unknown";
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    const { postId } = (await req.json()) as { postId: string };
    if (!postId) return jsonResponse({ error: "postId is required" }, 400);

    const { data: post, error: fetchErr } = await admin.from("social_posts").select("id, content, platforms, media_urls, external_ids, status").eq("id", postId).eq("user_id", userId).single();
    if (fetchErr || !post) return jsonResponse({ error: "Post not found" }, 404);

    await admin.from("social_posts").update({ status: "posting" }).eq("id", postId);

    const externalIds: Record<string, string> = { ...(post.external_ids as Record<string, string>) };
    const errors: string[] = [];
    const targetPlatforms = (post.platforms as string[]).filter((p) => SUPPORTED_PLATFORMS.has(p) && !externalIds[p]);

    for (const platform of targetPlatforms) {
      try {
        const mediaUrls = Array.isArray(post.media_urls) ? (post.media_urls as string[]) : [];
        externalIds[platform] =
          platform === "facebook"
            ? await publishToFacebook(admin, userId, post.content)
            : platform === "instagram"
              ? await publishToInstagram(admin, userId, post.content, mediaUrls)
              : platform === "tiktok"
                ? await publishToTiktok(admin, userId, post.content, mediaUrls)
                : platform === "x"
                  ? await publishToX(admin, userId, post.content, mediaUrls)
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

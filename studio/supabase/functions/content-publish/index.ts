import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { logSystemEvent } from "../_shared/monitor.ts";
import { push } from "../_shared/line.ts";

// Feature #9 — content loop: the owner approves a content_calendar item in
// the Content page, and this hourly cron turns approved items that are due
// (planned_date <= today) into queued social_posts rows — the exact queue
// the Post page publishes with one click. Closes "สร้าง → อนุมัติ → โพสต์"
// without any manual copy-paste. An item is only queued once (guarded by
// the social_posts.content_calendar_id link), and items without a body are
// skipped (nothing to post).
const KIND_PLATFORMS: Record<string, string[]> = {
  article: ["website"],
  short: ["tiktok", "instagram"],
  social: ["facebook", "line", "instagram"],
  ad: ["facebook"],
};

Deno.serve(async (req: Request) => {
  const preflight = req.method === "OPTIONS" ? jsonResponse({}, 200) : null;
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    // Approved items due today or earlier that aren't already published.
    const { data: items, error } = await admin
      .from("content_calendar")
      .select("id, kind, title, body, platform, planned_date")
      .eq("status", "approved")
      .lte("planned_date", new Date().toISOString().slice(0, 10))
      .order("planned_date", { ascending: true })
      .limit(20);
    if (error) throw error;

    // Owner profile (the only staff account) owns the queued posts so the
    // Post page lists them for one-click publishing.
    const { data: ownerProfile } = await admin.from("profiles").select("id").eq("role", "owner").limit(1).maybeSingle();
    const ownerId = ownerProfile?.id ?? null;

    let queued = 0;
    let skipped = 0;
    for (const item of (items ?? []) as { id: string; kind: string; title: string; body?: string | null; platform?: string | null; planned_date?: string | null }[]) {
      const body = item.body?.trim();
      if (!body) {
        skipped += 1;
        continue;
      }
      // Explicit platform overrides the kind default when the planner set
      // one (e.g. "facebook" on a social item).
      const explicit = item.platform && item.platform !== "tbd" ? [item.platform] : null;
      const platforms = explicit ?? KIND_PLATFORMS[item.kind] ?? ["line"];

      const { data: existing } = await admin
        .from("social_posts")
        .select("id")
        .eq("content_calendar_id", item.id)
        .maybeSingle();
      if (existing) continue; // already queued once — never double-queue

      const { error: postErr } = await admin.from("social_posts").insert({
        user_id: ownerId,
        content: body.slice(0, 2000),
        platforms,
        status: "queued",
        posted_at: null,
        external_ids: {},
        content_calendar_id: item.id,
      });
      if (postErr) {
        await logSystemEvent(admin, "content-publish", "error", `queue ${item.id}: ${postErr.message}`);
        continue;
      }
      await admin.from("content_calendar").update({ status: "published" }).eq("id", item.id);
      queued += 1;
    }

    if (queued > 0) {
      await logSystemEvent(admin, "content-publish", "info", `queued ${queued} posts`);
      await admin.from("notifications").insert({
        type: "content_ready",
        title: `เนื้อหา ${queued} ชิ้นพร้อมโพสต์`,
        body: "เนื้อหาที่อนุมัติแล้วถูกเตรียมเป็นคิวโพสต์แล้ว — ไปที่หน้า Post เพื่อเผยแพร่ทุกช่องทาง",
      });
    }

    // Close the loop the other way too: content that is due but never got
    // approved just sits as a draft forever (production data: 3 drafts,
    // zero posts). Tell the owner on LINE once per day when something is
    // overdue so they can approve it instead of it silently piling up.
    const { data: overdue } = await admin
      .from("content_calendar")
      .select("id, title, planned_date")
      .neq("status", "published")
      .lte("planned_date", new Date().toISOString().slice(0, 10))
      .limit(20);
    if ((overdue ?? []).length > 0) {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: recent } = await admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("type", "content_needs_approval")
        .gte("created_at", dayAgo);
      if ((recent ?? 0) === 0) {
        const titles = (overdue as { title: string; planned_date?: string | null }[])
          .slice(0, 5)
          .map((c) => `${c.planned_date ?? ""} ${c.title}`)
          .join("\n");
        await admin.from("notifications").insert({
          type: "content_needs_approval",
          title: `คอนเทนต์ ${(overdue ?? []).length} ชิ้นถึงวันแต่ยังไม่อนุมัติ`,
          body: "ไปที่หน้า Content เพื่ออนุมัติ แล้วระบบจะขึ้นคิวโพสต์ให้อัตโนมัติ",
        });
        const { data: ownerRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
        if (ownerRow?.value) {
          await push(ownerRow.value, `📋 คอนเทนต์ ${(overdue ?? []).length} ชิ้นถึงวันแต่ยังไม่อนุมัติ:${titles ? "\n" + titles : ""} — ไปอนุมัติในหน้า Content ได้เลย`).catch(() => {});
        }
      }
    }
    return jsonResponse({ scanned: (items ?? []).length, queued, skipped });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logSystemEvent(admin, "content-publish", "error", message);
    return jsonResponse({ error: message }, 500);
  }
});

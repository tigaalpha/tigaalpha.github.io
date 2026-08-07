import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);

    if (req.method === "GET") {
      const { data: posts, error } = await admin
        .from("social_posts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return jsonResponse({ posts: posts ?? [] });
    }

    if (req.method === "POST") {
      const { content, platforms } = await req.json();

      if (typeof content !== "string" || !content.trim() || !Array.isArray(platforms) || platforms.length === 0) {
        return jsonResponse({ error: "content (non-empty string) and platforms (non-empty array) are required" }, 400);
      }
      if (!platforms.every((p) => typeof p === "string")) {
        return jsonResponse({ error: "platforms must be an array of strings" }, 400);
      }

      const { data: post, error } = await admin
        .from("social_posts")
        .insert({
          user_id: userId,
          content,
          platforms,
          status: "queued",
          posted_at: null,
          external_ids: {},
        })
        .select()
        .single();

      if (error) throw error;
      return jsonResponse({ post }, 201);
    }

    return jsonResponse({ error: "Method not allowed" }, 405);
  } catch (error) {
    return await handleUnexpectedError(admin, "social-posts", error);
  }
});

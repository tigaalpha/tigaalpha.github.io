import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";

// Minimum scope to read the Page list and publish text posts to a Page feed.
// Instagram publishing needs additional scopes + a media URL and isn't wired
// up yet — see social-publish/index.ts.
const SCOPE = "pages_show_list,pages_manage_posts,pages_read_engagement";
const STATE_TTL_MS = 10 * 60 * 1000;

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const admin = createAdminClient();
    const userId = await requireStaff(admin, req);

    const { data: row } = await admin.from("integration_settings").select("value").eq("key", "meta_app_id").maybeSingle();
    const appId = row?.value;
    if (!appId) {
      return jsonResponse({ error: "Set the Meta App ID in Settings > Integrations first." }, 400);
    }

    const state = crypto.randomUUID();
    // social_accounts rows are per-user (unlike integration_settings, which
    // is global) — the callback below runs with no session of its own
    // (Facebook redirects the browser directly), so the initiating staff
    // member's id rides along with the state nonce to attribute the
    // resulting row correctly.
    await admin
      .from("integration_settings")
      .upsert({ key: "meta_oauth_state", value: `${state}:${Date.now() + STATE_TTL_MS}:${userId}` }, { onConflict: "key" });

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-oauth-callback`;

    const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    url.searchParams.set("client_id", appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("state", state);

    return jsonResponse({ url: url.toString(), redirectUri });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

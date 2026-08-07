import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";

// Fallback path for when the OAuth flow can't be completed (e.g. the
// pages_manage_posts permission isn't selectable in a Login for Business
// Configuration without a verified Business Portfolio). Staff pastes a Page
// Access Token generated manually via Graph API Explorer directly into the
// authenticated Settings UI -- never through this chat -- and this function
// validates + stores it the same way meta-oauth-callback would.
const GRAPH_VERSION = "v19.0";

interface PageIdentity {
  id?: string;
  name?: string;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);

    const { pageAccessToken } = await req.json();
    if (!pageAccessToken || typeof pageAccessToken !== "string") {
      return jsonResponse({ error: "pageAccessToken is required" }, 400);
    }

    // A Page Access Token acts as the Page itself for /me -- this both
    // validates the token and gives us the Page's id/name without the
    // staff member needing to look them up separately.
    const meResponse = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/me?fields=id,name&access_token=${encodeURIComponent(pageAccessToken)}`
    );
    if (!meResponse.ok) {
      const body = await meResponse.text();
      return jsonResponse({ error: `Facebook rejected this token (${meResponse.status}): ${body.slice(0, 300)}` }, 400);
    }
    const me = (await meResponse.json()) as PageIdentity;
    if (!me.id || !me.name) {
      return jsonResponse({ error: "Facebook didn't return a Page identity for this token -- make sure it's a Page Access Token, not a User Access Token." }, 400);
    }

    // Confirm this token can actually post -- catches a token that only has
    // pages_show_list (no pages_manage_posts) before it's saved as "connected".
    const permsResponse = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${me.id}/permissions?access_token=${encodeURIComponent(pageAccessToken)}`
    );
    if (permsResponse.ok) {
      const perms = (await permsResponse.json()) as { data?: { permission: string; status: string }[] };
      const granted = new Set((perms.data ?? []).filter((p) => p.status === "granted").map((p) => p.permission));
      if (!granted.has("pages_manage_posts")) {
        return jsonResponse(
          { error: "This token doesn't have pages_manage_posts granted -- go back to Graph API Explorer, make sure that permission was checked before generating the token." },
          400
        );
      }
    }

    await admin.from("social_accounts").delete().eq("user_id", userId).eq("platform", "facebook");
    await admin.from("social_accounts").insert({
      user_id: userId,
      platform: "facebook",
      account_name: me.name,
      access_token: pageAccessToken,
      metadata: { pageId: me.id, connectedVia: "manual-token" },
    });

    return jsonResponse({ connected: true, pageName: me.name });
  } catch (error) {
    return await handleUnexpectedError(admin, "meta-manual-connect", error);
  }
});

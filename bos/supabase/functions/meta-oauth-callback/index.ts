import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

// Public — Facebook redirects the browser here directly, with no Supabase
// JWT attached, so this can't be verify_jwt=true. Protected instead by the
// one-time state nonce minted in meta-oauth-start.

const APP_SETTINGS_URL = "https://tigaalpha.github.io/studio/settings/";
const GRAPH_VERSION = "v19.0";

function redirectTo(status: "connected" | "error", message?: string): Response {
  const url = new URL(APP_SETTINGS_URL);
  url.searchParams.set("meta", status);
  if (message) url.searchParams.set("metaError", message);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

interface FacebookPage {
  id: string;
  name: string;
  access_token: string;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error_message") ?? url.searchParams.get("error");

  if (error) return redirectTo("error", error);
  if (!code || !state) return redirectTo("error", "Missing code or state");

  const admin = createAdminClient();

  const { data: stateRow } = await admin.from("integration_settings").select("value").eq("key", "meta_oauth_state").maybeSingle();
  const [storedState, expiresAtStr, userId] = (stateRow?.value ?? "").split(":");
  const expiresAt = Number(expiresAtStr ?? 0);

  if (!storedState || storedState !== state || Date.now() > expiresAt || !userId) {
    return redirectTo("error", "State expired or invalid — try connecting again.");
  }
  await admin.from("integration_settings").delete().eq("key", "meta_oauth_state");

  const { data: appIdRow } = await admin.from("integration_settings").select("value").eq("key", "meta_app_id").maybeSingle();
  const appId = appIdRow?.value;
  const appSecret = Deno.env.get("META_APP_SECRET");
  if (!appId || !appSecret) {
    return redirectTo("error", "Meta App ID or Secret not configured.");
  }

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meta-oauth-callback`;

  const shortLivedResponse = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?` +
      new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, client_secret: appSecret, code })
  );
  if (!shortLivedResponse.ok) return redirectTo("error", `Token exchange failed (${shortLivedResponse.status})`);
  const shortLived = (await shortLivedResponse.json()) as { access_token?: string };
  if (!shortLived.access_token) return redirectTo("error", "Facebook did not return an access token.");

  // Exchange for a long-lived user token (~60 days) so the connection
  // doesn't need re-authorizing every couple of hours.
  const longLivedResponse = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token?` +
      new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLived.access_token,
      })
  );
  if (!longLivedResponse.ok) return redirectTo("error", `Long-lived token exchange failed (${longLivedResponse.status})`);
  const longLived = (await longLivedResponse.json()) as { access_token?: string };
  const userToken = longLived.access_token ?? shortLived.access_token;

  const pagesResponse = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts?access_token=${userToken}`);
  if (!pagesResponse.ok) return redirectTo("error", `Failed to list Pages (${pagesResponse.status})`);
  const pagesData = (await pagesResponse.json()) as { data?: FacebookPage[] };
  const pages = pagesData.data ?? [];
  if (pages.length === 0) {
    return redirectTo("error", "No Facebook Page found for this account — this app connects to a Page, not a personal profile.");
  }

  // Without a Business Portfolio, a Configuration can't restrict which Pages
  // it's allowed to see — Facebook returns every Page the logging-in account
  // administers. If the staff member manages more than one Page, blindly
  // taking the first one risks connecting the wrong Page (e.g. a personal
  // side project instead of the studio's Page). meta_target_page_name lets
  // them pin the exact Page by name; falls back to the first result only
  // when no preference has been set.
  const { data: targetNameRow } = await admin
    .from("integration_settings")
    .select("value")
    .eq("key", "meta_target_page_name")
    .maybeSingle();
  const targetName = targetNameRow?.value?.trim();

  let page: FacebookPage;
  if (targetName) {
    const match = pages.find((p) => p.name.toLowerCase() === targetName.toLowerCase()) ?? pages.find((p) => p.name.toLowerCase().includes(targetName.toLowerCase()));
    if (!match) {
      const found = pages.map((p) => p.name).join(", ");
      return redirectTo("error", `Page "${targetName}" not found among the Pages this login granted access to (${found}). Check the name in Settings matches exactly, or check which Page you approved during Facebook login.`);
    }
    page = match;
  } else {
    page = pages[0]!;
  }

  // Page access tokens derived from a long-lived user token don't expire on
  // their own timeline the same way — no separate refresh flow needed for
  // posting, unlike Google Calendar's refresh-token model.
  // Unique constraint is (user_id, platform, account_name) — if the Page is
  // renamed on Facebook's side, reconnecting creates a new row rather than
  // updating in place. Acceptable for now: delete any prior facebook row
  // for this user first so there's never more than one connected Page.
  await admin.from("social_accounts").delete().eq("user_id", userId).eq("platform", "facebook");
  await admin.from("social_accounts").insert({
    user_id: userId,
    platform: "facebook",
    account_name: page.name,
    access_token: page.access_token,
    metadata: { pageId: page.id },
  });

  return redirectTo("connected");
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

// Public — TikTok redirects the browser here directly with no Supabase
// session, so this can't be verify_jwt=true. Protected by the one-time
// state nonce + PKCE verifier minted in tiktok-oauth-start.

const APP_SETTINGS_URL = "https://tigaalpha.github.io/studio/settings/";

function redirectTo(status: "connected" | "error", message?: string): Response {
  const url = new URL(APP_SETTINGS_URL);
  url.searchParams.set("tiktok", status);
  if (message) url.searchParams.set("tiktokError", message);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) return redirectTo("error", error);
  if (!code || !state) return redirectTo("error", "Missing code or state");

  const admin = createAdminClient();

  const { data: stateRow } = await admin.from("integration_settings").select("value").eq("key", "tiktok_oauth_state").maybeSingle();
  const [storedState, expiresAtStr, userId, codeVerifier] = (stateRow?.value ?? "").split(":");
  const expiresAt = Number(expiresAtStr ?? 0);

  if (!storedState || storedState !== state || Date.now() > expiresAt || !userId || !codeVerifier) {
    return redirectTo("error", "State expired or invalid — try connecting again.");
  }
  await admin.from("integration_settings").delete().eq("key", "tiktok_oauth_state");

  const { data: keyRow } = await admin.from("integration_settings").select("value").eq("key", "tiktok_client_key").maybeSingle();
  const clientKey = keyRow?.value as string | undefined;
  const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");
  if (!clientKey || !clientSecret) {
    return redirectTo("error", "TikTok Client Key or TIKTOK_CLIENT_SECRET not configured.");
  }

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tiktok-oauth-callback`;

  const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });
  if (!tokenResponse.ok) return redirectTo("error", `Token exchange failed (${tokenResponse.status})`);
  const tokenData = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; open_id?: string; error?: string };
  if (tokenData.error || !tokenData.access_token) {
    return redirectTo("error", `TikTok did not return an access token: ${tokenData.error ?? "unknown"}`);
  }

  // Resolve the display name for the social_accounts row (best-effort —
  // the connection succeeds with just the open_id if this fails).
  let displayName = "";
  try {
    const userResponse = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (userResponse.ok) {
      const userData = (await userResponse.json()) as { data?: { user?: { open_id?: string; display_name?: string } } };
      displayName = userData.data?.user?.display_name ?? "";
    }
  } catch {
    // display name is cosmetic — never fail the callback over it
  }

  const accountName = displayName || tokenData.open_id || "TikTok";
  const tokenExpiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null;

  await admin.from("social_accounts").delete().eq("user_id", userId).eq("platform", "tiktok");
  await admin.from("social_accounts").insert({
    user_id: userId,
    platform: "tiktok",
    account_name: accountName,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token ?? null,
    token_expires_at: tokenExpiresAt,
    metadata: { openId: tokenData.open_id ?? null, displayName },
  });

  return redirectTo("connected");
});

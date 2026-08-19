import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { buildOAuthHeader, parseOAuthForm } from "../_shared/x-oauth.ts";

// Public — X redirects the browser here directly, no Supabase session.
// Protected by the oauth_token matching the request token we minted in
// x-oauth-start (the request token is a one-time, short-lived credential).

const APP_SETTINGS_URL = "https://tigaalpha.github.io/studio/settings/";
const ACCESS_TOKEN_URL = "https://api.twitter.com/oauth/access_token";

function redirectTo(status: "connected" | "error", message?: string): Response {
  const url = new URL(APP_SETTINGS_URL);
  url.searchParams.set("x", status);
  if (message) url.searchParams.set("xError", message);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const oauthToken = url.searchParams.get("oauth_token");
  const oauthVerifier = url.searchParams.get("oauth_verifier");

  if (!oauthToken || !oauthVerifier) return redirectTo("error", "Missing oauth_token or oauth_verifier");

  const admin = createAdminClient();

  const { data: stateRow } = await admin.from("integration_settings").select("value").eq("key", "x_oauth_state").maybeSingle();
  const [storedToken, storedSecret, expiresAtStr, userId] = (stateRow?.value ?? "").split(":");
  const expiresAt = Number(expiresAtStr ?? 0);

  if (!storedToken || storedToken !== oauthToken || Date.now() > expiresAt || !storedSecret || !userId) {
    return redirectTo("error", "Request token expired or invalid — try connecting again.");
  }
  await admin.from("integration_settings").delete().eq("key", "x_oauth_state");

  const { data: keyRow } = await admin.from("integration_settings").select("value").eq("key", "x_client_key").maybeSingle();
  const consumerKey = keyRow?.value as string | undefined;
  const consumerSecret = Deno.env.get("X_API_SECRET");
  if (!consumerKey || !consumerSecret) {
    return redirectTo("error", "X API Key or X_API_SECRET not configured.");
  }

  const verifierParam: [string, string] = ["oauth_verifier", oauthVerifier];
  const authHeader = await buildOAuthHeader(
    { consumerKey, consumerSecret, token: oauthToken, tokenSecret: storedSecret },
    "POST",
    ACCESS_TOKEN_URL,
    [verifierParam]
  );

  const response = await fetch(ACCESS_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ oauth_token: oauthToken, oauth_verifier: oauthVerifier }),
  });
  if (!response.ok) {
    const body = await response.text();
    return redirectTo("error", `Access token exchange failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const params = parseOAuthForm(await response.text());
  const userToken = params.oauth_token;
  const userTokenSecret = params.oauth_token_secret;
  const screenName = params.screen_name;
  const xUserId = params.user_id;
  if (!userToken || !userTokenSecret) {
    return redirectTo("error", "X did not return an access token.");
  }

  await admin.from("social_accounts").delete().eq("user_id", userId).eq("platform", "x");
  await admin.from("social_accounts").insert({
    user_id: userId,
    platform: "x",
    account_name: screenName || "X",
    access_token: userToken,
    refresh_token: userTokenSecret,
    metadata: { userId: xUserId ?? null, screenName: screenName ?? null },
  });

  return redirectTo("connected");
});

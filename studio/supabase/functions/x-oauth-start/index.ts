import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { buildOAuthHeader, parseOAuthForm } from "../_shared/x-oauth.ts";

// Starts the X (Twitter) OAuth 1.0a flow — request token -> browser
// authorization -> access token (x-oauth-callback). X's publish API needs
// OAuth 1.0a user context (no app-only bearer for posting), so this is the
// full three-legged dance.
//
// Consumer key: entered in Settings > Integrations (integration_settings
// `x_client_key`, same pattern as meta_app_id). Consumer secret: X_API_SECRET
// Edge Function secret (see docs/SETUP.md — H2 X (Twitter)).

const REQUEST_TOKEN_URL = "https://api.twitter.com/oauth/request_token";
const AUTHENTICATE_URL = "https://api.twitter.com/oauth/authenticate";
const STATE_TTL_MS = 10 * 60 * 1000;

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);

    const { data: keyRow } = await admin.from("integration_settings").select("value").eq("key", "x_client_key").maybeSingle();
    const consumerKey = keyRow?.value as string | undefined;
    const consumerSecret = Deno.env.get("X_API_SECRET");
    if (!consumerKey) {
      return jsonResponse({ error: "ตั้งค่า X API Key (Consumer Key) ใน Settings > Integrations ก่อน" }, 400);
    }
    if (!consumerSecret) {
      return jsonResponse({ error: "X_API_SECRET ยังไม่ได้ตั้งค่า — เพิ่มใน Supabase Secrets ก่อน (ดู Settings > Integrations > X)" }, 400);
    }

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/x-oauth-callback`;
    const callbackParam: [string, string] = ["oauth_callback", redirectUri];

    const authHeader = await buildOAuthHeader({ consumerKey, consumerSecret }, "POST", REQUEST_TOKEN_URL, [callbackParam]);

    const response = await fetch(REQUEST_TOKEN_URL, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ oauth_callback: redirectUri }),
    });
    if (!response.ok) {
      const body = await response.text();
      return jsonResponse({ error: `X ปฏิเสธคำขอ request token (${response.status}): ${body.slice(0, 300)}` }, 502);
    }

    const params = parseOAuthForm(await response.text());
    const oauthToken = params.oauth_token;
    const oauthTokenSecret = params.oauth_token_secret;
    if (!oauthToken || !oauthTokenSecret) {
      return jsonResponse({ error: "X ไม่คืน oauth_token — ตรวจสอบ Consumer Key/Secret อีกครั้ง" }, 502);
    }

    // state = oauth_token:oauth_token_secret:expiry:userId — the token
    // secret is needed at the callback to sign the access_token exchange.
    await admin
      .from("integration_settings")
      .upsert({ key: "x_oauth_state", value: `${oauthToken}:${oauthTokenSecret}:${Date.now() + STATE_TTL_MS}:${userId}` }, { onConflict: "key" });

    return jsonResponse({ url: `${AUTHENTICATE_URL}?oauth_token=${encodeURIComponent(oauthToken)}`, redirectUri });
  } catch (error) {
    return await handleUnexpectedError(admin, "x-oauth-start", error);
  }
});

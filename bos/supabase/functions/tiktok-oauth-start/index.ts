import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";

// Starts the TikTok Content Posting API OAuth flow (Authorization Code +
// PKCE). Scope covers posting videos (video.publish) and photos
// (photo.share) plus basic user info for the account name. The callback
// (tiktok-oauth-callback, verify_jwt=false) exchanges the code for tokens
// and stores them in social_accounts — TikTok redirects the browser
// directly, so the initiating staff member's id rides along in the state.

const TIKTOK_SCOPE = "user.info.basic,user.info.profile,video.publish,photo.share";
const STATE_TTL_MS = 10 * 60 * 1000;
const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const enc = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBase64Url(byteLength: number): string {
  const buf = new Uint8Array(byteLength);
  crypto.getRandomValues(buf);
  return base64Url(buf);
}

async function sha256Base64Url(str: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(str));
  return base64Url(new Uint8Array(digest));
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);

    const { data: keyRow } = await admin.from("integration_settings").select("value").eq("key", "tiktok_client_key").maybeSingle();
    const clientKey = keyRow?.value as string | undefined;
    if (!clientKey) {
      return jsonResponse({ error: "ตั้งค่า TikTok Client Key ใน Settings > Integrations ก่อน" }, 400);
    }

    const state = crypto.randomUUID();
    const codeVerifier = randomBase64Url(48);
    const codeChallenge = await sha256Base64Url(codeVerifier);

    // state = state:expiry:userId:codeVerifier — the verifier must survive
    // the round trip because the callback has no session of its own.
    await admin
      .from("integration_settings")
      .upsert({ key: "tiktok_oauth_state", value: `${state}:${Date.now() + STATE_TTL_MS}:${userId}:${codeVerifier}` }, { onConflict: "key" });

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/tiktok-oauth-callback`;

    const url = new URL(AUTH_URL);
    url.searchParams.set("client_key", clientKey);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", TIKTOK_SCOPE);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");

    return jsonResponse({ url: url.toString(), redirectUri });
  } catch (error) {
    return await handleUnexpectedError(admin, "tiktok-oauth-start", error);
  }
});

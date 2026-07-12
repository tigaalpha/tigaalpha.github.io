import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

// Public — Google redirects the browser here directly, with no Supabase JWT
// attached, so this can't be verify_jwt=true. Protected instead by the
// one-time state nonce minted in google-oauth-start; a request with no
// matching, unexpired state is rejected before any token exchange happens.

const APP_SETTINGS_URL = "https://tigaalpha.github.io/studio/settings/";

function redirectTo(status: "connected" | "error", message?: string): Response {
  const url = new URL(APP_SETTINGS_URL);
  url.searchParams.set("googleCalendar", status);
  if (message) url.searchParams.set("googleCalendarError", message);
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

  const { data: stateRow } = await admin.from("integration_settings").select("value").eq("key", "google_oauth_state").maybeSingle();
  const [storedState, expiresAtStr] = (stateRow?.value ?? "").split(":");
  const expiresAt = Number(expiresAtStr ?? 0);

  if (!storedState || storedState !== state || Date.now() > expiresAt) {
    return redirectTo("error", "State expired or invalid — try connecting again.");
  }
  await admin.from("integration_settings").delete().eq("key", "google_oauth_state");

  const { data: clientIdRow } = await admin.from("integration_settings").select("value").eq("key", "google_client_id").maybeSingle();
  const clientId = clientIdRow?.value;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return redirectTo("error", "Google Client ID or Secret not configured.");
  }

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-oauth-callback`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    return redirectTo("error", `Token exchange failed (${tokenResponse.status})`);
  }

  const tokenData = (await tokenResponse.json()) as { refresh_token?: string };
  if (!tokenData.refresh_token) {
    return redirectTo(
      "error",
      "Google didn't return a refresh token — revoke the app's access at https://myaccount.google.com/permissions and try connecting again."
    );
  }

  await admin
    .from("integration_settings")
    .upsert({ key: "google_refresh_token", value: tokenData.refresh_token }, { onConflict: "key" });

  return redirectTo("connected");
});

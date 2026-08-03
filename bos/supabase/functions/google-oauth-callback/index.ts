import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

// Public — Google redirects the browser here directly, with no Supabase JWT
// attached, so this can't be verify_jwt=true. Protected instead by the
// one-time state nonce minted in google-oauth-start / gcal-connect-start.
//
// Both the primary (write) Google Calendar connection and the additional
// (read-only, up to 3) viewing connections share this one callback URL —
// Google requires every redirect_uri to be pre-registered in Cloud Console,
// and asking for a second registered URI just for the new multi-account
// feature isn't necessary when the state nonce alone is enough to tell the
// two flows apart.

const APP_SETTINGS_URL = "https://tigaalpha.github.io/studio/settings/";
const PALETTE = ["#7C3AED", "#0EA5E9", "#F97316"];

function redirectTo(kind: "primary" | "gcal", status: "connected" | "error", message?: string): Response {
  const url = new URL(APP_SETTINGS_URL);
  if (kind === "primary") {
    url.searchParams.set("googleCalendar", status);
    if (message) url.searchParams.set("googleCalendarError", message);
  } else {
    url.searchParams.set("gcalConnect", status);
    if (message) url.searchParams.set("gcalConnectError", message);
  }
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error_message") ?? url.searchParams.get("error");

  const admin = createAdminClient();
  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-oauth-callback`;

  // Figure out which flow this is by checking which pending state nonce
  // matches — at most one of these is ever active for a given state value.
  const { data: primaryStateRow } = await admin.from("integration_settings").select("value").eq("key", "google_oauth_state").maybeSingle();
  const [primaryState, primaryExpiresAtStr] = (primaryStateRow?.value ?? "").split(":");
  const isPrimaryFlow = Boolean(state) && primaryState === state && Date.now() <= Number(primaryExpiresAtStr ?? 0);

  const { data: gcalStateRow } = await admin.from("integration_settings").select("value").eq("key", "gcal_connect_state").maybeSingle();
  const gcalParts = (gcalStateRow?.value ?? "").split(":");
  const isGcalFlow = !isPrimaryFlow && Boolean(state) && gcalParts[0] === state && Date.now() <= Number(gcalParts[1] ?? 0);

  const kind: "primary" | "gcal" = isGcalFlow ? "gcal" : "primary";

  if (error) return redirectTo(kind, "error", error);
  if (!code || !state) return redirectTo(kind, "error", "Missing code or state");
  if (!isPrimaryFlow && !isGcalFlow) return redirectTo(kind, "error", "State expired or invalid — try connecting again.");

  const { data: clientIdRow } = await admin.from("integration_settings").select("value").eq("key", "google_client_id").maybeSingle();
  const clientId = clientIdRow?.value;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return redirectTo(kind, "error", "Google Client ID or Secret not configured.");
  }

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
    return redirectTo(kind, "error", `Token exchange failed (${tokenResponse.status})`);
  }

  const tokenData = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string };
  if (!tokenData.refresh_token) {
    return redirectTo(
      kind,
      "error",
      "Google didn't return a refresh token — revoke the app's access at https://myaccount.google.com/permissions and try connecting again."
    );
  }

  if (isPrimaryFlow) {
    await admin.from("integration_settings").delete().eq("key", "google_oauth_state");
    await admin.from("integration_settings").upsert({ key: "google_refresh_token", value: tokenData.refresh_token }, { onConflict: "key" });
    return redirectTo("primary", "connected");
  }

  // Multi-account viewing flow
  await admin.from("integration_settings").delete().eq("key", "gcal_connect_state");
  const label = gcalParts.slice(2).join(":");

  let email: string | null = null;
  if (tokenData.access_token) {
    try {
      const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userinfoResponse.ok) {
        const userinfo = (await userinfoResponse.json()) as { email?: string };
        email = userinfo.email ?? null;
      }
    } catch {
      // best-effort — connection still works without a display email
    }
  }

  const { count } = await admin.from("google_calendar_connections").select("id", { count: "exact", head: true });
  const color = PALETTE[(count ?? 0) % PALETTE.length];

  const { error: insertErr } = await admin.from("google_calendar_connections").insert({
    label: label || email || "Google Calendar",
    google_account_email: email,
    calendar_id: "primary",
    refresh_token: tokenData.refresh_token,
    color,
  });
  if (insertErr) return redirectTo("gcal", "error", insertErr.message);

  return redirectTo("gcal", "connected");
});

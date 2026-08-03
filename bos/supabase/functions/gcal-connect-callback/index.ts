import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

// Public — Google redirects the browser here directly, with no Supabase
// JWT attached, so this can't be verify_jwt=true. Protected instead by the
// one-time state nonce minted in gcal-connect-start.

const APP_SETTINGS_URL = "https://tigaalpha.github.io/studio/settings/";
const PALETTE = ["#7C3AED", "#0EA5E9", "#F97316"];

function redirectTo(status: "connected" | "error", message?: string): Response {
  const url = new URL(APP_SETTINGS_URL);
  url.searchParams.set("gcalConnect", status);
  if (message) url.searchParams.set("gcalConnectError", message);
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error_message") ?? url.searchParams.get("error");

  if (error) return redirectTo("error", error);
  if (!code || !state) return redirectTo("error", "Missing code or state");

  const admin = createAdminClient();

  const { data: stateRow } = await admin.from("integration_settings").select("value").eq("key", "gcal_connect_state").maybeSingle();
  const [storedState, expiresAtStr, label] = (stateRow?.value ?? "").split(":");
  const expiresAt = Number(expiresAtStr ?? 0);

  if (!storedState || storedState !== state || Date.now() > expiresAt) {
    return redirectTo("error", "State expired or invalid — try connecting again.");
  }
  await admin.from("integration_settings").delete().eq("key", "gcal_connect_state");

  const { data: clientIdRow } = await admin.from("integration_settings").select("value").eq("key", "google_client_id").maybeSingle();
  const clientId = clientIdRow?.value;
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    return redirectTo("error", "Google Client ID/Secret not configured.");
  }

  const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/gcal-connect-callback`;

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) return redirectTo("error", `Token exchange failed (${tokenResponse.status})`);
  const tokens = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string };
  if (!tokens.refresh_token) {
    return redirectTo(
      "error",
      "Google ไม่ได้ส่ง refresh token กลับมา — ถ้าเคยเชื่อมต่อบัญชีนี้แล้ว ให้ไปที่ myaccount.google.com/permissions เพิกถอนสิทธิ์แอปนี้ก่อนแล้วลองใหม่"
    );
  }
  if (!tokens.access_token) return redirectTo("error", "Google did not return an access token.");

  let email: string | null = null;
  try {
    const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (userinfoResponse.ok) {
      const userinfo = (await userinfoResponse.json()) as { email?: string };
      email = userinfo.email ?? null;
    }
  } catch {
    // best-effort — connection still works without a display email
  }

  const { count } = await admin.from("google_calendar_connections").select("id", { count: "exact", head: true });
  const color = PALETTE[(count ?? 0) % PALETTE.length];

  const { error: insertErr } = await admin.from("google_calendar_connections").insert({
    label: label || email || "Google Calendar",
    google_account_email: email,
    calendar_id: "primary",
    refresh_token: tokens.refresh_token,
    color,
  });
  if (insertErr) return redirectTo("error", insertErr.message);

  return redirectTo("connected");
});

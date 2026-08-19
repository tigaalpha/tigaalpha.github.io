// Shared Google OAuth access-token helper — used by anything that calls a
// Google API on the owner's behalf (Calendar, Drive, Search Console) using
// the single refresh token obtained via google-oauth-start/callback.

import { createAdminClient } from "./supabase-admin.ts";

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Client ID and refresh token come from the integration_settings table when
 * the owner connected Google through Settings > Integrations (the guided
 * OAuth flow — see google-oauth-start/google-oauth-callback). Falls back to
 * GOOGLE_CLIENT_ID / GOOGLE_REFRESH_TOKEN Edge Function secrets for anyone
 * who set them up the old way (manually, before that UI existed).
 */
async function getGoogleCredentials(): Promise<{ clientId: string; refreshToken: string }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integration_settings")
    .select("key, value")
    .in("key", ["google_client_id", "google_refresh_token"]);

  const fromDb = Object.fromEntries((data ?? []).map((row: { key: string; value: string | null }) => [row.key, row.value]));

  const clientId = fromDb.google_client_id || Deno.env.get("GOOGLE_CLIENT_ID");
  const refreshToken = fromDb.google_refresh_token || Deno.env.get("GOOGLE_REFRESH_TOKEN");

  if (!clientId || !refreshToken) {
    throw new Error("Google is not connected yet — connect it from Settings > Integrations.");
  }

  return { clientId, refreshToken };
}

export async function getGoogleAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const { clientId, refreshToken } = await getGoogleCredentials();

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google OAuth token refresh failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

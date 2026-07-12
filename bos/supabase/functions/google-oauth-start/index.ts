import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";

const SCOPE = "https://www.googleapis.com/auth/calendar";
const STATE_TTL_MS = 10 * 60 * 1000;

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const admin = createAdminClient();
    await requireStaff(admin, req);

    const { data: row } = await admin.from("integration_settings").select("value").eq("key", "google_client_id").maybeSingle();
    const clientId = row?.value;
    if (!clientId) {
      return jsonResponse({ error: "Set the Google Client ID in Settings > Integrations first." }, 400);
    }

    const state = crypto.randomUUID();
    await admin.from("integration_settings").upsert(
      { key: "google_oauth_state", value: `${state}:${Date.now() + STATE_TTL_MS}` },
      { onConflict: "key" }
    );

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-oauth-callback`;

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);

    return jsonResponse({ url: url.toString(), redirectUri });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";

// Feature #2 — public bootstrap config for the customer portal. Returns only
// non-secret values (LIFF app id / channel id) needed to init the LINE SDK
// in the browser. Same public-by-design pattern as web_chat_secret.
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  try {
    const { data: rows } = await admin.from("integration_settings").select("key, value").in("key", ["liff_app_id", "liff_client_id"]);
    const map = new Map((rows ?? []).map((r) => [r.key, r.value]));
    return jsonResponse({
      liffAppId: map.get("liff_app_id") ?? null,
      liffClientId: map.get("liff_client_id") ?? null,
    });
  } catch {
    return jsonResponse({ liffAppId: null, liffClientId: null });
  }
});

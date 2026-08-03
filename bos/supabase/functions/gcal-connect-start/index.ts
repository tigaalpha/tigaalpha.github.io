import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";

// Read-only + email so the connected account can be identified in the UI —
// this connection is for *viewing* a calendar on the Calendar page, never
// for writing events (that stays the existing single Google Calendar
// connection in integration_settings, used by book_lesson/calendar.ts).
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email";
const STATE_TTL_MS = 10 * 60 * 1000;
const MAX_CONNECTIONS = 3;

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  try {
    const admin = createAdminClient();
    await requireStaff(admin, req);

    const { count, error: countErr } = await admin
      .from("google_calendar_connections")
      .select("id", { count: "exact", head: true });
    if (countErr) throw countErr;
    if ((count ?? 0) >= MAX_CONNECTIONS) {
      return jsonResponse({ error: `เชื่อมต่อครบ ${MAX_CONNECTIONS} บัญชีแล้ว — ลบบัญชีเดิมก่อนถ้าต้องการเชื่อมต่อใหม่` }, 400);
    }

    const { data: row } = await admin.from("integration_settings").select("value").eq("key", "google_client_id").maybeSingle();
    const clientId = row?.value;
    if (!clientId) {
      return jsonResponse({ error: "ตั้งค่า Google Client ID ในหน้า Settings > Integrations ก่อน (ใช้ตัวเดียวกับ Google Calendar หลัก)" }, 400);
    }

    const body = await req.json().catch(() => ({}));
    const label = typeof body.label === "string" && body.label.trim() ? body.label.trim() : `บัญชีที่ ${(count ?? 0) + 1}`;

    const state = crypto.randomUUID();
    await admin.from("integration_settings").upsert(
      { key: "gcal_connect_state", value: `${state}:${Date.now() + STATE_TTL_MS}:${label}` },
      { onConflict: "key" }
    );

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/gcal-connect-callback`;

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent select_account");
    url.searchParams.set("state", state);

    return jsonResponse({ url: url.toString(), redirectUri });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

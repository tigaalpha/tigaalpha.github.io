import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { createPortalToken, verifyLiffIdToken } from "../_shared/portal-session.ts";

// Feature #2 — customer self-service portal. Public endpoint (verify_jwt=false):
// the customer logs in through a LINE LIFF app; we verify the ID token against
// LINE and bind the session to their customer row via line_user_id. No
// password, no staff auth — the portal only ever sees the customer's own data.
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  try {
    const { idToken } = await req.json();
    if (!idToken || typeof idToken !== "string") return jsonResponse({ error: "idToken is required" }, 400);

    const lineUserId = await verifyLiffIdToken(admin, idToken);
    if (!lineUserId) {
      return jsonResponse({ error: "ไม่สามารถยืนยันตัวตนผ่าน LINE ได้ — ตรวจสอบ liff_client_id ในระบบ" }, 401);
    }

    const { data: customer } = await admin.from("customers").select("id, name, phone, line_user_id").eq("line_user_id", lineUserId).maybeSingle();
    if (!customer) {
      return jsonResponse({ error: "ยังไม่พบข้อมูลลูกค้าในระบบ — รบกวนทักแชทกับร้านก่อนเพื่อผูกบัญชี LINE" }, 404);
    }

    const token = await createPortalToken(admin, lineUserId, customer.id);
    return jsonResponse({ token, customer: { name: customer.name, phone: customer.phone } });
  } catch (error) {
    return await handleUnexpectedError(admin, "portal-login", error);
  }
});

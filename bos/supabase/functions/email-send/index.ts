import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { sendEmail } from "../_shared/email.ts";

// email-send — send one email (invoice, receipt, or a manual message).
//
//   Request: { to?: string, customerId?: string, subject, body, html? }
//   Response: { ok, message }
//
// Resolve the recipient from `to` directly or from the customer's email
// address on file. Requires RESEND_API_KEY (Supabase secret) and a verified
// sender (integration_settings `email_from_address`) — see Settings >
// Integrations > Email.

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    await requireStaff(admin, req);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    let to = typeof body.to === "string" ? body.to.trim() : "";
    const customerId = typeof body.customerId === "string" ? body.customerId.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const text = typeof body.body === "string" ? body.body : typeof body.message === "string" ? body.message : "";
    const html = typeof body.html === "string" ? body.html : undefined;

    if (!to && customerId) {
      const { data: customer } = await admin.from("customers").select("email").eq("id", customerId).maybeSingle();
      to = customer?.email ?? "";
    }
    if (!to) return jsonResponse({ error: "ต้องระบุผู้รับ (to) หรือ customerId ที่มีอีเมล" }, 400);

    const result = await sendEmail(admin, { to, subject, html, text });
    if (!result.ok) return jsonResponse({ error: result.message }, 502);
    return jsonResponse(result);
  } catch (error) {
    return await handleUnexpectedError(admin, "email-send", error);
  }
});

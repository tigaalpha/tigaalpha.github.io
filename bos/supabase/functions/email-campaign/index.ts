import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { sendEmail } from "../_shared/email.ts";

// email-campaign — send a newsletter (or any broadcast) to every customer
// who has an email address on file. Runs sequentially so each send's
// result is recorded; one bad address never stops the rest.
//
//   Request: { subject, body }
//   Response: { total, sent, failed, failures: [{email, message}] }

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    await requireStaff(admin, req);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const text = typeof body.body === "string" ? body.body : "";
    if (!subject || !text) return jsonResponse({ error: "subject และ body เป็น required" }, 400);
    if (text.length > 100_000) return jsonResponse({ error: "เนื้อหาอีเมลยาวเกินไป" }, 400);

    if (!Deno.env.get("RESEND_API_KEY")) {
      return jsonResponse({ error: "RESEND_API_KEY ยังไม่ได้ตั้งค่า — เพิ่มใน Supabase Secrets ก่อน (ดู Settings > Integrations > Email)" }, 502);
    }

    const { data: customers, error } = await admin.from("customers").select("id, name, email").not("email", "is", null);
    if (error) throw error;

    const recipients = (customers ?? []).filter((c) => typeof c.email === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email as string));
    const html = text
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br/>")}</p>`)
      .join("");

    let sent = 0;
    const failures: { email: string; message: string }[] = [];
    for (const customer of recipients) {
      const result = await sendEmail(admin, {
        to: customer.email as string,
        subject,
        text,
        html,
      });
      if (result.ok) sent += 1;
      else failures.push({ email: customer.email as string, message: result.message });
    }

    return jsonResponse({ total: recipients.length, sent, failed: failures.length, failures: failures.slice(0, 20) });
  } catch (error) {
    return await handleUnexpectedError(admin, "email-campaign", error);
  }
});

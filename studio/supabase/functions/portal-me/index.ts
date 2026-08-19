import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";
import { verifyPortalToken } from "../_shared/portal-session.ts";

// Feature #2 — customer self-service portal data. Bearer token from
// portal-login. Returns ONLY this customer's own rows: upcoming lessons,
// pending invoices (with QR to pay), and recent paid history.
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  try {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const session = await verifyPortalToken(admin, token);
    if (!session) return jsonResponse({ error: "Unauthorized" }, 401);

    const now = new Date().toISOString();

    const [customerRes, bookingsRes, pendingRes, paidRes, coursesRes] = await Promise.all([
      admin.from("customers").select("id, name, phone, line_user_id, parent_name, created_at").eq("id", session.customerId).maybeSingle(),
      admin
        .from("bookings")
        .select("id, title, start_time, end_time, status, teachers(name)")
        .in("status", ["confirmed", "rescheduled", "pending"])
        .eq("customer_id", session.customerId)
        .gte("start_time", now)
        .order("start_time", { ascending: true })
        .limit(10),
      admin
        .from("payments")
        .select("id, amount, reference_code, qr_url, qr_base64, created_at, status")
        .eq("customer_id", session.customerId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10),
      admin
        .from("payments")
        .select("id, amount, reference_code, created_at, status, paid_at")
        .eq("customer_id", session.customerId)
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(8),
      admin
        .from("courses")
        .select("id, total_hours, current_hour, remaining_hour, price")
        .eq("customer_id", session.customerId),
    ]);

    if (customerRes.error) throw customerRes.error;
    const customer = customerRes.data;
    if (!customer) return jsonResponse({ error: "Unauthorized" }, 401);

    return jsonResponse({
      customer: {
        name: customer.name,
        phone: customer.phone,
        parentName: customer.parent_name,
        memberSince: customer.created_at,
      },
      upcomingLessons: (bookingsRes.data ?? []).map((b) => ({
        id: b.id,
        title: b.title,
        startTime: b.start_time,
        endTime: b.end_time,
        status: b.status,
        teacher: (b as { teachers?: { name?: string } | null }).teachers?.name ?? null,
      })),
      pendingPayments: (pendingRes.data ?? []).map((p) => ({
        id: p.id,
        amount: p.amount,
        referenceCode: p.reference_code,
        qrUrl: p.qr_url,
        qrBase64: p.qr_base64,
        createdAt: p.created_at,
      })),
      paidHistory: (paidRes.data ?? []).map((p) => ({
        id: p.id,
        amount: p.amount,
        referenceCode: p.reference_code,
        paidAt: p.paid_at,
      })),
      courses: (coursesRes.data ?? []).map((c) => ({
        id: c.id,
        totalHours: c.total_hours,
        currentHour: c.current_hour,
        remainingHours: c.remaining_hour,
        price: c.price,
      })),
    });
  } catch (error) {
    return await handleUnexpectedError(admin, "portal-me", error);
  }
});

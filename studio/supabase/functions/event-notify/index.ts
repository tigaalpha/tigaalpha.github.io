import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireOwnerOrAdmin } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { push as linePush } from "../_shared/line.ts";
import { handleUnexpectedError } from "../_shared/monitor.ts";

// Feature #7 — event/recital manager notifications. Owner picks an event and
// everyone added to event_participants gets a LINE invite with the details.
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  try {
    const userId = await requireOwnerOrAdmin(admin, req);
    const { eventId } = await req.json();
    if (!eventId || typeof eventId !== "string") return jsonResponse({ error: "eventId is required" }, 400);

    const { data: event, error: eErr } = await admin.from("events").select("*").eq("id", eventId).maybeSingle();
    if (eErr) throw eErr;
    if (!event) return jsonResponse({ error: "event not found" }, 404);

    const { data: participants, error: pErr } = await admin
      .from("event_participants")
      .select("id, piece, customers(line_user_id, name)")
      .eq("event_id", eventId);
    if (pErr) throw pErr;

    const start = new Date(event.start_time);
    const timeLabel = start.toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" });
    const lines = [
      `🎹 เรียนเชิญ ${event.title}`,
      `วันที่ ${timeLabel}`,
      event.location ? `สถานที่: ${event.location}` : "",
      event.description ? event.description : "",
      "รบกวนตอบกลับในแชทนี้เพื่อยืนยันการเข้าร่วมด้วยนะคะ",
    ].filter(Boolean);

    let notified = 0;
    for (const p of (participants ?? []) as { id: string; piece?: string | null; customers?: { line_user_id?: string | null; name?: string | null } | null }[]) {
      const customer = Array.isArray(p.customers) ? p.customers[0] : p.customers;
      if (!customer?.line_user_id) continue;
      const msg = p.piece ? [...lines, `เพลงที่เตรียม: ${p.piece}`].join("\n") : lines.join("\n");
      try {
        await linePush(customer.line_user_id, msg);
        notified += 1;
      } catch {
        // blocked OA — skip; participant stays "invited"
      }
    }

    await admin.from("notifications").insert({
      type: "event_notify",
      title: `ส่งคำเชิญ ${event.title}`,
      body: `ส่งถึง ${notified} คน จาก ${(participants ?? []).length} คน`,
    });

    return jsonResponse({ notified, total: (participants ?? []).length, requestedBy: userId });
  } catch (error) {
    return await handleUnexpectedError(admin, "event-notify", error);
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { push as linePush } from "../_shared/line.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

// Reschedule assistant (Feature #10): when a student declined attendance,
// the AI finds 2 free 1-hour slots with the same teacher in the next 7 days
// and offers them over LINE with one polite message. Waitlist-freed-slot
// offers already live in automation-nudges; this closes the decline side.
// Free slots = gaps >= 1h between the teacher's other confirmed bookings.
const SLOT_WINDOW_DAYS = 7;
const SLOT_HOUR_MS = 60 * 60 * 1000;
const MAX_PER_RUN = 5;

Deno.serve(async (req: Request) => {
  const preflight = req.method === "OPTIONS" ? jsonResponse({}, 200) : null;
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + SLOT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: declined } = await admin
      .from("bookings")
      .select("id, title, start_time, teacher_id, customers(id, name, line_user_id)")
      .eq("attendance_status", "declined")
      .is("reschedule_offered_at", null)
      .gte("start_time", now.toISOString())
      .order("start_time", { ascending: true })
      .limit(20);
    if (!declined) return jsonResponse({ offered: 0 });

    let offered = 0;
    for (const booking of declined) {
      if (offered >= MAX_PER_RUN) break;
      const customer = Array.isArray(booking.customers) ? booking.customers[0] : booking.customers;
      const lineUserId = customer?.line_user_id as string | undefined;
      if (!lineUserId || !booking.teacher_id) continue;

      // All confirmed bookings for this teacher in the window → free gaps.
      const { data: teacherBookings } = await admin
        .from("bookings")
        .select("start_time")
        .eq("teacher_id", booking.teacher_id)
        .in("status", ["confirmed", "rescheduled"])
        .gte("start_time", now.toISOString())
        .lt("start_time", horizon);
      const busy = (teacherBookings ?? []).map((b) => new Date(b.start_time).getTime()).sort((a, b) => a - b);

      const slots: string[] = [];
      const start = new Date(now.getTime() + 3 * SLOT_HOUR_MS);
      start.setMinutes(0, 0, 0);
      const end = new Date(horizon);
      for (let t = start.getTime(); t + SLOT_HOUR_MS <= end.getTime(); t += SLOT_HOUR_MS) {
        if (slots.length >= 2) break;
        const inWindow = (ts: number) => ts >= t && ts < t + SLOT_HOUR_MS;
        if (busy.some(inWindow)) continue;
        const date = new Date(t);
        if (date.getDay() === 0) continue; // studio closed Sundays
        slots.push(date.toLocaleString("th-TH", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }));
      }

      if (slots.length > 0) {
        const name = customer?.name && customer.name !== `โทรเข้า ${booking.phone ?? ""}` ? customer.name : "";
        const greeting = name ? `สวัสดีคุณ${name} ` : "สวัสดี ";
        await linePush(
          lineUserId,
          `${greeting}ค่ะ เห็นว่า${booking.title}รอบวันที่ ${new Date(booking.start_time).toLocaleDateString("th-TH")} มาสะดวกไม่ได้ อยากชวนย้ายมาเวลาเหล่านี้แทนไหมคะ:\n\n${slots.join("\n")}\n\nสะดวกวันไหนตอบมาได้เลยค่ะ หรือถ้าทุกวันไม่สะดวกบอกได้ค่ะ จะหาวันอื่นให้ใหม่`
        ).catch(() => {});
        offered += 1;
      }

      await admin.from("bookings").update({ reschedule_offered_at: new Date().toISOString() }).eq("id", booking.id);
    }

    if (offered > 0) await logSystemEvent(admin, "reschedule-assistant", "info", `${offered} reschedule offers sent`);
    return jsonResponse({ offered });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logSystemEvent(admin, "reschedule-assistant", "error", message);
    return jsonResponse({ error: message }, 500);
  }
});

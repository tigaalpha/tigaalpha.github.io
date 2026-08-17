import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { pushFlex } from "../_shared/line.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";
import {
  CHAT_FEATURE_KEYS,
  CHAT_FEATURE_LABELS,
  isFeatureEnabled,
  reviewModeIsAuto,
  buildLessonReminderFlex,
  DAILY_LIMITS,
} from "../_shared/chat-features.ts";

// งานแชท #3 — เตือนคาบเรียน 2 ชม. ก่อนเรียน (การ์ด Flex พร้อมปุ่มยืนยันมา/
// มาไม่ได้) ผ่านคิว ai_outbox เช่นเดียวกับทุกข้อความ "ออกไปหาลูกค้า":
//   - review "always": รอเจ้าของอนุมัติ (การ์ดจะขึ้น "ใกล้หมดอายุ" ในหน้า
//     Outbox ถ้ายังไม่ทันตรวจก่อนเวลาเรียน ระบบจะข้ามไปเอง ไม่สปาเม้อีก)
//   - review "auto": ส่งตรงทันที
// หมายเหตุ: การยืนยันการมาเรียน 24 ชม. (text + quick replies) ยังเป็นหน้าที่
// ของ attendance-reminder เดิม ซึ่งส่งตรงอยู่แล้ว — ฟังก์ชันนี้เสริมชั้น 2 ชม.
Deno.serve(async (req: Request) => {
  const preflight = req.method === "OPTIONS" ? jsonResponse({}, 200) : null;
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const { data: flagRows } = await admin.from("integration_settings").select("key, value");
    const flags = Object.fromEntries((flagRows ?? []).map((r) => [r.key, r.value])) as Record<string, string | undefined>;

    if (!isFeatureEnabled(flags, "lessonReminder")) {
      return jsonResponse({ skipped: "feature disabled" });
    }
    const auto = reviewModeIsAuto(flags);
    const now = Date.now();
    const windowStart = new Date(now + 1.5 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(now + 2.5 * 60 * 60 * 1000).toISOString();

    // วงเงินต่อวัน
    const dayStart = new Date().toISOString().slice(0, 10);
    const { count: sentToday } = await admin
      .from("ai_outbox")
      .select("id", { count: "exact", head: true })
      .eq("feature", "lesson_reminder")
      .gte("created_at", dayStart);
    const overLimit = (sentToday ?? 0) >= DAILY_LIMITS.lesson_reminder;

    // ข้อความที่เคยสร้างไปแล้ว (ทุกสถานะ) — ไม่สร้างซ้ำ
    const existing = await admin
      .from("ai_outbox")
      .select("reference_id")
      .eq("feature", "lesson_reminder")
      .gte("created_at", new Date(now - 2 * 60 * 60 * 1000).toISOString());
    const seen = new Set((existing.data ?? []).map((r) => r.reference_id));

    const results: { type: string; status: string }[] = [];

    // Pass 1: bookings ครั้งเดียว
    const { data: bookings } = await admin
      .from("bookings")
      .select("id, customer_id, title, start_time, teacher_id")
      .in("status", ["confirmed", "rescheduled"])
      .eq("attendance_status", "unconfirmed")
      .gte("start_time", windowStart)
      .lte("start_time", windowEnd)
      .limit(30);

    for (const b of bookings ?? []) {
      const ref = `booking:${b.id}:2h`;
      if (seen.has(ref)) continue;
      const { data: cust } = await admin
        .from("customers")
        .select("id, name, line_user_id, marketing_opt_out")
        .eq("id", b.customer_id)
        .maybeSingle();
      if (!cust?.line_user_id || cust.marketing_opt_out) continue;

      const { data: teacher } = b.teacher_id
        ? await admin.from("teachers").select("name").eq("id", b.teacher_id).maybeSingle()
        : { data: null };
      const flex = buildLessonReminderFlex({
        lessonTitle: b.title,
        teacherName: teacher?.name ?? "ครูประจำวิชา",
        startLabel: `อีกประมาณ 2 ชม. (${formatBkkTime(b.start_time)})`,
        customerName: cust.name,
        bookingRef: b.id,
      });

      const status = auto && !overLimit ? "approved" : "pending_review";
      const { error } = await admin.from("ai_outbox").insert({
        feature: "lesson_reminder",
        status,
        mode: auto ? "auto" : "suggest",
        channel: "line",
        customer_id: cust.id,
        recipient_line_user_id: cust.line_user_id,
        message: `เตือนคาบเรียน ${b.title} ${formatBkkTime(b.start_time)} — รออนุมัติส่ง`,
        message_type: "flex",
        flex_payload: flex,
        reason: "คาบเรียนเริ่มในอีก ~2 ชม. ยังไม่ยืนยันการมาเรียน",
        reference_id: ref,
      });
      if (error) throw error;

      if (status === "approved") {
        try {
          await pushFlex(cust.line_user_id, flex, `🎹 เตือนคาบเรียน ${b.title} อีก 2 ชม.`);
          await admin.from("ai_outbox").update({ status: "sent", sent_at: new Date().toISOString() }).eq("reference_id", ref);
          results.push({ type: "booking", status: "sent" });
        } catch (err) {
          await admin.from("ai_outbox").update({ status: "failed", error: String(err) }).eq("reference_id", ref);
        }
      } else {
        results.push({ type: "booking", status: "pending_review" });
      }
    }

    // Pass 2: คาบประจำรายสัปดาห์ (ถ้าไม่มี booking ใกล้เคียง — กันเตือนซ้ำ)
    const { data: schedules } = await admin
      .from("attendance_reminder_schedules")
      .select("id, customer_id, time_of_day, next_occurrence_at, day_of_week")
      .eq("active", true)
      .eq("attendance_status", "unconfirmed")
      .gte("next_occurrence_at", windowStart)
      .lte("next_occurrence_at", windowEnd)
      .limit(30);

    for (const s of schedules ?? []) {
      const ref = `sched:${s.id}:2h`;
      if (seen.has(ref)) continue;
      const occ = new Date(s.next_occurrence_at);
      const { count: bookingCount } = await admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("customer_id", s.customer_id)
        .gte("start_time", new Date(occ.getTime() - 30 * 60 * 1000).toISOString())
        .lte("start_time", new Date(occ.getTime() + 30 * 60 * 1000).toISOString());
      if ((bookingCount ?? 0) > 0) continue;

      const { data: cust } = await admin
        .from("customers")
        .select("id, name, line_user_id, marketing_opt_out")
        .eq("id", s.customer_id)
        .maybeSingle();
      if (!cust?.line_user_id || cust.marketing_opt_out) continue;

      const flex = buildLessonReminderFlex({
        lessonTitle: "คาบเรียนประจำ",
        teacherName: "ครูประจำวิชา",
        startLabel: `อีกประมาณ 2 ชม. (${s.time_of_day.slice(0, 5)} น.)`,
        customerName: cust.name,
      });

      const status = auto && !overLimit ? "approved" : "pending_review";
      const { error } = await admin.from("ai_outbox").insert({
        feature: "lesson_reminder",
        status,
        mode: auto ? "auto" : "suggest",
        channel: "line",
        customer_id: cust.id,
        recipient_line_user_id: cust.line_user_id,
        message: `เตือนคาบประจำ ${s.time_of_day.slice(0, 5)} น. — รออนุมัติส่ง`,
        message_type: "flex",
        flex_payload: flex,
        reason: "คาบประจำเริ่มในอีก ~2 ชม. ยังไม่ยืนยันการมาเรียน",
        reference_id: ref,
      });
      if (error) throw error;

      if (status === "approved") {
        try {
          await pushFlex(cust.line_user_id, flex, "🎹 เตือนคาบเรียนประจำ อีก 2 ชม.");
          await admin.from("ai_outbox").update({ status: "sent", sent_at: new Date().toISOString() }).eq("reference_id", ref);
          results.push({ type: "schedule", status: "sent" });
        } catch (err) {
          await admin.from("ai_outbox").update({ status: "failed", error: String(err) }).eq("reference_id", ref);
        }
      } else {
        results.push({ type: "schedule", status: "pending_review" });
      }
    }

    await logSystemEvent(admin, "chat-lesson-reminder", "info", `lesson-reminder: ${results.length} รายการ (${auto ? "auto" : "review"})`);
    return jsonResponse({ created: results.length, mode: auto ? "auto" : "suggest", feature: CHAT_FEATURE_LABELS.lessonReminder, results });
  } catch (error) {
    return await handleUnexpectedError(admin, "chat-lesson-reminder", error);
  }
});

function formatBkkTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok", hour12: false }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}

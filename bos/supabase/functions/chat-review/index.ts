import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { push, pushFlex } from "../_shared/line.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";

// งานแชท — หัวใจของ "human-in-the-loop": เจ้าของตรวจคิว ai_outbox แล้ว
//   approve → ส่งจริง (LINE) แล้ว mark sent
//   edit  → แก้ข้อความ (flex ถูกแปลงเป็น text) แล้วกลับ pending_review
//   reject → mark rejected + บันทึกเหตุผลลง chat_feedback (สอน AI รอบถัดไป)
// สำหรับ feature lesson_reminder ระบบเช็คด้วยว่ายังไม่เลยเวลาเรียนก่อนส่ง
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  try {
    const userId = await requireStaff(admin, req);

    const { outboxId, action, message, note } = await req.json();
    if (!outboxId || !["approve", "reject", "edit"].includes(action)) {
      return jsonResponse({ error: "outboxId และ action (approve/reject/edit) จำเป็น" }, 400);
    }

    const { data: row, error: loadError } = await admin.from("ai_outbox").select("*").eq("id", outboxId).maybeSingle();
    if (loadError) throw loadError;
    if (!row) return jsonResponse({ error: "ไม่พบข้อความในคิว" }, 404);
    if (row.status !== "pending_review") {
      return jsonResponse({ error: `ข้อความนี้สถานะ ${row.status} อยู่แล้ว` }, 409);
    }

    if (action === "reject") {
      await admin.from("ai_outbox").update({ status: "rejected", rejected_note: note ?? "", reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq("id", outboxId);
      if (note && note.trim()) {
        await admin.from("chat_feedback").insert({
          feature: row.feature,
          customer_id: row.customer_id,
          original_message: row.message,
          feedback_type: "rejected",
          note: note.trim(),
          created_by: userId,
        });
      }
      await logSystemEvent(admin, "chat-review", "info", `reject ${row.feature}${note ? `: ${note.slice(0, 100)}` : ""}`);
      return jsonResponse({ ok: true, status: "rejected" });
    }

    if (action === "edit") {
      if (!message || !message.trim()) return jsonResponse({ error: "message จำเป็นสำหรับการแก้" }, 400);
      const { error } = await admin
        .from("ai_outbox")
        .update({
          message: message.trim(),
          message_type: "text",
          flex_payload: null,
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", outboxId);
      if (error) throw error;
      if (note && note.trim()) {
        await admin.from("chat_feedback").insert({
          feature: row.feature,
          customer_id: row.customer_id,
          original_message: row.message,
          feedback_type: "edited",
          note: note.trim(),
          created_by: userId,
        });
      }
      return jsonResponse({ ok: true, status: "pending_review", message: message.trim() });
    }

    // approve
    if (!row.recipient_line_user_id) {
      await admin.from("ai_outbox").update({ status: "failed", error: "ลูกค้าไม่มี LINE user id", reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq("id", outboxId);
      return jsonResponse({ error: "ลูกค้ารายนี้ไม่มี LINE id — ไม่สามารถส่งได้" }, 400);
    }

    // เตือนคาบเรียน: ถ้าเลยเวลาเรียนแล้ว ให้ mark failed แทนการส่งสาย
    if (row.feature === "lesson_reminder" && row.reference_id?.startsWith("booking:")) {
      const bookingId = row.reference_id.replace("booking:", "").replace(":2h", "");
      const { data: booking } = await admin.from("bookings").select("start_time").eq("id", bookingId).maybeSingle();
      if (!booking || new Date(booking.start_time).getTime() < Date.now()) {
        await admin.from("ai_outbox").update({ status: "failed", error: "เลยเวลาเรียนแล้ว ไม่ส่ง", reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq("id", outboxId);
        return jsonResponse({ error: "เลยเวลาเรียนแล้ว — ข้ามข้อความนี้" }, 409);
      }
    }

    try {
      if (row.message_type === "flex" && row.flex_payload) {
        await pushFlex(row.recipient_line_user_id, row.flex_payload, row.message.slice(0, 100) || "แจ้งเตือนจาก Tiga Studio");
      } else {
        await push(row.recipient_line_user_id, row.message);
      }
    } catch (err) {
      await admin.from("ai_outbox").update({ status: "failed", error: String(err), reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq("id", outboxId);
      return jsonResponse({ error: `ส่งไม่สำเร็จ: ${String(err).slice(0, 200)}` }, 502);
    }

    await admin.from("ai_outbox").update({ status: "sent", sent_at: new Date().toISOString(), reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq("id", outboxId);
    await logSystemEvent(admin, "chat-review", "info", `approve+send ${row.feature} → ${row.recipient_line_user_id}`);
    return jsonResponse({ ok: true, status: "sent" });
  } catch (error) {
    return await handleUnexpectedError(admin, "chat-review", error);
  }
});

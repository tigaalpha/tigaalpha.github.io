// AI lesson summary (feature #5): a teacher (or the owner in owner mode)
// submits rough notes — typed, or a voice note that line-webhook already
// transcribed — and the AI turns them into a clean, parent-friendly lesson
// summary + homework, stores it, and pushes it to the student's parent on
// LINE with an offer to book the next lesson.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { generate } from "./ai-provider.ts";
import { logAiUsage } from "./usage-logging.ts";
import { push as linePush } from "./line.ts";

const SUMMARY_SYSTEM_PROMPT = `You are the lesson-note writer for a piano school. Turn the teacher's rough notes into a warm, clear summary for the student's parent (in Thai). Respond with ONLY a JSON object:
{"summary": "...2-4 short sentences on what was practiced and how the student did...", "homework": "...1-3 short practice tasks for this week..."}
Keep language simple and encouraging. No markdown, no preamble.`;

export interface CreateLessonSummaryInput {
  bookingId: string;
  /** Raw teacher notes (typed or transcribed from voice). */
  rawNotes: string;
  createdBy?: string | null;
}

export async function createLessonSummary(admin: SupabaseClient, input: CreateLessonSummaryInput): Promise<{ id: string; summary: string; homework: string }> {
  const notes = input.rawNotes.trim();
  if (notes.length < 10) throw new Error("บันทึกสั้นเกินไป — กรุณาใส่รายละเอียดสิ่งที่เรียนในคาบนี้อย่างน้อย 1-2 ประโยค");

  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .select("id, customer_id, teacher_id, title, start_time")
    .eq("id", input.bookingId)
    .maybeSingle();
  if (bookingErr || !booking) throw new Error("ไม่พบการจองที่ระบุ");

  const result = await generate([{ role: "system", content: SUMMARY_SYSTEM_PROMPT }, { role: "user", content: `Lesson: ${booking.title} (${booking.start_time}). Teacher notes: ${notes}` }], undefined, 0.4, 1024);
  await logAiUsage(admin, result.usage, "lesson-summary");

  let summary = "";
  let homework = "";
  try {
    const firstBrace = result.message.content.indexOf("{");
    const lastBrace = result.message.content.lastIndexOf("}");
    const parsed = firstBrace >= 0 && lastBrace > firstBrace ? (JSON.parse(result.message.content.slice(firstBrace, lastBrace + 1)) as Record<string, string>) : {};
    summary = parsed.summary ?? result.message.content;
    homework = parsed.homework ?? "";
  } catch {
    summary = result.message.content;
  }
  if (!summary) throw new Error("AI ไม่สามารถสรุปบทเรียนได้ กรุณาลองใหม่");

  const { data: note, error: noteErr } = await admin
    .from("lesson_notes")
    .insert({
      booking_id: booking.id,
      customer_id: booking.customer_id,
      teacher_id: booking.teacher_id,
      summary,
      homework: homework || null,
      raw_input: notes,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();
  if (noteErr) throw noteErr;

  const { data: customer } = await admin.from("customers").select("name, line_user_id").eq("id", booking.customer_id).maybeSingle();
  if (customer?.line_user_id) {
    const header = `📝 สรุปบทเรียน${customer.name ? `ของน้อง${customer.name}` : ""} วันนี้:\n\n${summary}`;
    const homeworkLine = homework ? `\n\n🎯 การบ้านสัปดาห์นี้:\n${homework}` : "";
    await linePush(customer.line_user_id, `${header}${homeworkLine}\n\nทักมาได้เลยถ้ามีคำถาม หรืออยากนัดคาบถัดไปค่ะ 😊`).catch(() => {});
    await admin.from("lesson_notes").update({ sent_to_customer: true }).eq("id", note.id);
  }

  await admin.from("notifications").insert({
    type: "lesson_summary",
    title: "สรุปบทเรียนถูกส่งให้ผู้ปกครองแล้ว",
    body: `${customer?.name ?? "นักเรียน"} — ${summary.slice(0, 120)}`,
    customer_id: booking.customer_id,
  });

  return { id: note.id, summary, homework };
}

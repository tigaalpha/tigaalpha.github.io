import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { generate } from "../_shared/ai-provider.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";

// งานแชท #6 (ส่วนคำตอบสำเร็จรูป) — เมื่อเจ้าของกำลังจะตอบลูกค้าเอง กดปุ่ม
// "คำตอบสำเร็จรูป" → AI ร่าง 3 แบบสั้นๆ ให้น้ำเสียงเหมือนเจ้าของร้านพิมพ์เอง
// เจ้าของกดเลือก → ใส่ช่องพิมพ์ → แก้เล็กน้อย → ส่ง (ผ่าน send-staff-reply เดิม)
Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();
  try {
    await requireStaff(admin, req);

    const { conversationId } = await req.json();
    if (!conversationId) return jsonResponse({ error: "conversationId is required" }, 400);

    const { data: conversation } = await admin
      .from("conversations")
      .select("customer_id, customers(name, sales_status, notes)")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conversation) return jsonResponse({ error: "ไม่พบการสนทนา" }, 404);

    const { data: messages } = await admin
      .from("messages")
      .select("sender, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(8);
    const history = [...(messages ?? [])].reverse()
      .map((m) => `${m.sender === "customer" ? "ลูกค้า" : m.sender === "ai" ? "AI" : "เจ้าของ"}: ${m.content.slice(0, 300)}`)
      .join("\n");

    const cust = conversation.customers as { name: string; sales_status: string; notes: string | null } | null;
    const prompt = [
      "คุณคือเจ้าของโรงเรียนสอนเปียโน กำลังจะตอบลูกค้าใน LINE เอง",
      `ลูกค้า: ${cust?.name ?? "?"} (สถานะ ${cust?.sales_status ?? "?"})`,
      cust?.notes ? `บันทึก: ${cust.notes.slice(0, 300)}` : null,
      "บทสนทนาล่าสุด:",
      history || "(ยังไม่มีประวัติ)",
      "",
      "เขียนคำตอบสำเร็จรูป 3 แบบ ให้เจ้าของเลือก สั้น กระชับ (ไม่เกิน 40 คำต่อแบบ) ภาษาไทย น้ำเสียงอบอุ่นเป็นธรรมชาติเหมือนพิมพ์เอง ไม่ขึ้นต้นว่า 'สวัสดีค่ะ' ทุกแบบ",
      "ตอบเป็น JSON array ของ string เท่านั้น ไม่มีอย่างอื่น เช่น [\"...\",\"...\",\"...\"]",
    ].filter(Boolean).join("\n");

    const res = await generate([{ role: "user", content: prompt }], undefined, 0.8, 400);
    const raw = (res.text ?? "").trim();
    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(raw.replace(/```json|```/g, ""));
      suggestions = Array.isArray(parsed) ? parsed.map((s) => String(s).trim()).filter(Boolean).slice(0, 3) : [];
    } catch {
      // fallback: ตัดเป็นบรรทัด
      suggestions = raw.split("\n").map((l) => l.replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean).slice(0, 3);
    }
    if (suggestions.length === 0) return jsonResponse({ error: "AI ร่างไม่ได้ ลองใหม่" }, 422);

    return jsonResponse({ suggestions });
  } catch (error) {
    await logSystemEvent(admin, "chat-suggest-replies", "error", error instanceof Error ? error.message : String(error));
    return await handleUnexpectedError(admin, "chat-suggest-replies", error);
  }
});

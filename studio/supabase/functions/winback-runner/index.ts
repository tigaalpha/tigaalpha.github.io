import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { geminiProvider } from "../_shared/gemini.ts";
import { cleanReplyText } from "../_shared/text-clean.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";

// Feature #4 — lapsed-student win-back. Daily cron: finds customers who
// stopped booking (45+ days) or are almost out of course hours (<= 2h), and
// drafts a personalized offer with AI. Nothing is sent automatically — the
// campaign lands in winback_campaigns as "pending" and the owner approves in
// the UI (winback-action sends the LINE message + payment link).
const MAX_PER_RUN = 3;
const LAPSED_DAYS = 45;
const LOW_HOURS = 2;

Deno.serve(async (req: Request) => {
  const preflight = req.method === "OPTIONS" ? jsonResponse({}, 200) : null;
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const now = new Date();
    const lapsedBefore = new Date(Date.now() - LAPSED_DAYS * 24 * 60 * 60 * 1000).toISOString();

    // Candidates: active customers with a LINE id who have either almost no
    // hours left or no lesson in 45 days.
    const [lowHoursRes, lapsedRes] = await Promise.all([
      admin
        .from("courses")
        .select("customer_id, total_hours, remaining_hour, customers(id, name, line_user_id, sales_status)")
        .lte("remaining_hour", LOW_HOURS),
      admin
        .from("customers")
        .select("id, name, line_user_id, sales_status, last_contact_at")
        .not("line_user_id", "is", null)
        .in("sales_status", ["won", "renewed"]),
    ]);
    if (lowHoursRes.error) throw lowHoursRes.error;

    const candidates = new Map<string, { customerId: string; name: string; lineUserId: string; reason: string }>();
    for (const c of (lowHoursRes.data ?? []) as { customer_id: string; remaining_hour: number; customers?: { id: string; name: string; line_user_id?: string | null; sales_status: string } | null }[]) {
      const cust = c.customers;
      if (!cust?.line_user_id) continue;
      candidates.set(cust.id, { customerId: cust.id, name: cust.name, lineUserId: cust.line_user_id, reason: `ชั่วโมงเหลือ ${c.remaining_hour} ชม. จาก ${c.total_hours} ชม.` });
    }
    for (const c of (lapsedRes.data ?? []) as { id: string; name: string; line_user_id?: string | null; last_contact_at?: string | null }[]) {
      if (!c.line_user_id) continue;
      const last = c.last_contact_at ? new Date(c.last_contact_at).getTime() : 0;
      if (last > lapsedBefore.getTime() || last === 0) continue;
      if (!candidates.has(c.id)) {
        candidates.set(c.id, { customerId: c.id, name: c.name, lineUserId: c.line_user_id, reason: `เงียบไป ${Math.floor((Date.now() - last) / 86400000)} วัน` });
      }
    }

    // Skip anyone with a recent active campaign (30 days).
    const ids = [...candidates.keys()];
    let recent = new Set<string>();
    if (ids.length > 0) {
      const { data } = await admin
        .from("winback_campaigns")
        .select("customer_id")
        .in("customer_id", ids)
        .in("status", ["pending", "approved", "sent", "converted"])
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      recent = new Set((data ?? []).map((r) => r.customer_id));
    }

    const targets = [...candidates.values()].filter((c) => !recent.has(c.customerId)).slice(0, MAX_PER_RUN);

    let drafted = 0;
    for (const target of targets) {
      try {
        const prompt = [
          "คุณเป็นพนักงานขายของโรงเรียนสอนเปียโน TIGA Studio เขียนข้อความไล่ตามลูกค้าที่หายไป 1 ข้อความ พูดภาษาไทยธรรมชาติเหมือนคนจริง",
          `ลูกค้า: ${target.name} — เหตุผล: ${target.reason}`,
          "เนื้อหาควร: ทักทายเป็นกันเอง ถามสารทุกข์สุขดิบ อย่าเพิ่งเสนอโปรโมชันหรือส่วนลดแรงๆ ครั้งแรกแค่ปลุกความสนใจ เชิญชวนกลับมาคุยเรื่องเรียนต่อ",
          "ห้ามใช้เครื่องหมายพิเศษ ห้ามขีดฆ่า ห้าม bullet ห้ามตัวหนา เขียนเป็นประโยคไหลๆ ไม่เกิน 4-5 ประโยค",
        ].join("\n");
        const result = await geminiProvider.generate([{ role: "user", content: prompt }], undefined, 0.6, 400);
        const offerText = cleanReplyText((result.message.content ?? "").trim());

        await admin.from("winback_campaigns").insert({
          customer_id: target.customerId,
          offer_text: offerText,
          status: "pending",
        });
        await admin.from("notifications").insert({
          type: "winback_draft",
          title: `แคมเปญไล่ตามลูกค้า: ${target.name}`,
          body: offerText.slice(0, 300),
          customer_id: target.customerId,
        });
        drafted += 1;
      } catch (e) {
        await logSystemEvent(admin, "winback-runner", "error", `${target.customerId}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (drafted > 0) await logSystemEvent(admin, "winback-runner", "info", `drafted ${drafted}`);
    return jsonResponse({ drafted, scanned: candidates.size });
  } catch (error) {
    return await handleUnexpectedError(admin, "winback-runner", error);
  }
});

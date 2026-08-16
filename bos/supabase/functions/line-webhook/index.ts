import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { verifySignature, reply, push, fetchContent } from "../_shared/line.ts";
import { respond } from "../_shared/chat-core.ts";
import { logSystemEvent } from "../_shared/monitor.ts";
import { understandImage, transcribeAudio } from "../_shared/gemini.ts";
import { SLIP_EXTRACT_PROMPT, parseSlipJson, matchSlipToPayment, type SlipExtraction } from "../_shared/slip.ts";
import { confirmPaymentBySlip } from "../_shared/payments.ts";
import { refreshLeadScore } from "../_shared/lead-score-db.ts";
import { handleOwnerCommand } from "../_shared/owner-command.ts";

const FALLBACK_REPLY = "ขออภัยค่ะ ระบบขัดข้องชั่วคราว รบกวนลองทักใหม่อีกครั้งสักครู่นะคะ";

// Safe Mode (Settings > safe-mode-card.tsx): the owner's kill switch for
// AI auto-replies to customers. On, the app stops mediating entirely --
// no AI reply, not even the fallback -- and just tells the owner so she
// can reply herself outside this system while it's on. Scoped to this
// customer-facing path only; the owner's own Floating Assistant
// (ai-chat, mode:"owner") is a separate entry point and stays live.
async function isSafeModeOn(admin: ReturnType<typeof createAdminClient>): Promise<boolean> {
  const { data } = await admin.from("integration_settings").select("value").eq("key", "safe_mode").maybeSingle();
  return data?.value === "true";
}

async function notifyOwnerSafeMode(admin: ReturnType<typeof createAdminClient>, customerName: string, messageText: string): Promise<void> {
  await admin.from("notifications").insert({
    type: "ai_needs_review",
    title: `Safe Mode: ${customerName} ทักเข้ามา`,
    body: messageText.slice(0, 500),
  });
  const { data: ownerLineIdRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
  if (ownerLineIdRow?.value) {
    await push(ownerLineIdRow.value, `[Safe Mode เปิดอยู่] ${customerName}: ${messageText.slice(0, 300)}`);
  }
}

interface LineEvent {
  type: string;
  source: { userId?: string };
  message?: { type: string; text?: string; id?: string };
  replyToken?: string;
  webhookEventId?: string;
}

// LINE retries a webhook delivery on timeout/non-200, so the same event
// can arrive twice. Insert-first dedup on LINE's own per-event id: if the
// insert conflicts, this event was already handled -- skip it rather than
// generating a second AI reply (and a second tool-call side effect, e.g.
// a second booking, if the reply involved one). If an event genuinely has
// no id (shouldn't happen per LINE's schema), process it anyway rather
// than silently dropping a customer message.
async function alreadyProcessed(admin: ReturnType<typeof createAdminClient>, webhookEventId: string | undefined): Promise<boolean> {
  if (!webhookEventId) return false;
  const { error } = await admin.from("line_webhook_events").insert({ event_id: webhookEventId });
  // Postgres unique_violation
  return error?.code === "23505";
}

async function resolveConversation(admin: ReturnType<typeof createAdminClient>, lineUserId: string): Promise<string> {
  const { data: customer } = await admin.from("customers").select("id, name").eq("line_user_id", lineUserId).maybeSingle();

  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("line_user_id", lineUserId)
    .eq("channel", "line")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await admin
    .from("conversations")
    .insert({ channel: "line", line_user_id: lineUserId, customer_id: customer?.id ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

// Feature #1: a customer sends a photo of their bank transfer slip -> read
// it with vision -> match against their real pending payments -> auto-confirm
// when the match is unambiguous; otherwise alert the owner to check.
async function handleSlipImage(admin: ReturnType<typeof createAdminClient>, lineUserId: string, messageId: string, replyToken: string, customerName: string): Promise<void> {
  const { data: customer } = await admin.from("customers").select("id, name").eq("line_user_id", lineUserId).maybeSingle();
  if (!customer) {
    await reply(replyToken, "ได้รับรูปแล้วค่ะ ถ้ายังไม่ได้ระบุตัวตน กรุณาทักผ่านช่องทางของสตูดิโออีกครั้งนะคะ");
    return;
  }

  const content = await fetchContent(messageId);
  if (!content) {
    await reply(replyToken, "ได้รับรูปแล้วค่ะ แต่ระบบอ่านรูปไม่ทัน (ไฟล์อาจหมดอายุ) รบกวนส่งใหม่อีกครั้ง หรือโอนแล้วแจ้งเจ้าของร้านได้เลยค่ะ");
    return;
  }

  const raw = await understandImage(content.mimeType, content.base64, SLIP_EXTRACT_PROMPT).catch(() => "");
  const extraction: SlipExtraction | null = parseSlipJson(raw);

  const { data: pending } = await admin.from("payments").select("id, amount, reference_code, status").eq("customer_id", customer.id).eq("status", "pending");
  const match = extraction ? matchSlipToPayment(extraction, (pending ?? []).map((p) => ({ id: p.id, amount: Number(p.amount), reference_code: p.reference_code, status: p.status }))) : null;

  if (match) {
    await confirmPaymentBySlip(admin, { paymentId: match.paymentId, slipImageUrl: null });
    await admin.from("transfer_slips").insert({
      customer_id: customer.id,
      payment_id: match.paymentId,
      extracted_amount: extraction?.amount ?? null,
      extracted_reference: extraction?.reference ?? null,
      confidence: extraction?.confidence ?? null,
      match_status: "matched",
      raw_extraction: raw ? { raw } : null,
    });
    await refreshLeadScore(admin, customer.id);
    await reply(replyToken, "✅ ได้รับสลิปและตรวจสอบแล้ว ขอบคุณมากค่ะ ยอดโอนถูกยืนยันเรียบร้อยแล้วนะคะ 🙏");
    return;
  }

  const notSlip = extraction ? !extraction.isSlip : true;
  await admin.from("transfer_slips").insert({
    customer_id: customer.id,
    extracted_amount: extraction?.amount ?? null,
    extracted_reference: extraction?.reference ?? null,
    confidence: extraction?.confidence ?? null,
    match_status: notSlip ? "not_a_slip" : "unmatched",
    raw_extraction: raw ? { raw } : null,
  });

  if (notSlip) {
    await reply(replyToken, "ได้รับรูปแล้วค่ะ รบกวนรอสักครู่ เดี๋ยวเจ้าหน้าที่จะช่วยดูแลให้ค่ะ 😊");
    return;
  }

  // Real slip but couldn't be matched to a pending invoice — the owner must
  // eyeball it (wrong amount, or a transfer without an invoice behind it).
  await admin.from("notifications").insert({
    type: "slip_unmatched",
    title: "สลิปไม่ตรงกับใบแจ้งชำระ",
    body: `${customer.name} ส่งสลิป${extraction?.amount ? ` ${extraction.amount} บาท` : ""}${extraction?.reference ? ` (อ้างอิง ${extraction.reference})` : ""} แต่ไม่ตรงกับใบชำระที่ค้างอยู่ — กรุณาตรวจสอบ`,
    customer_id: customer.id,
  });
  const { data: ownerRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
  if (ownerRow?.value) {
    await push(ownerRow.value, `⚠️ ${customer.name} ส่งสลิปที่ไม่ตรงกับใบชำระ (${extraction?.amount ? extraction.amount + " บาท" : "อ่านยอดไม่ได้"}) — กรุณาตรวจสอบในแอป`).catch(() => {});
  }
  await reply(replyToken, "ได้รับสลิปแล้วค่ะ กำลังตรวจสอบให้ รบกวนรอสักครู่ ถ้ายอดหรือข้อมูลไม่ตรง ทางเราจะติดต่อกลับนะคะ 🙏");
}

async function processEvents(admin: ReturnType<typeof createAdminClient>, events: LineEvent[]): Promise<void> {
  const safeMode = await isSafeModeOn(admin);

  await Promise.all(
    events.map(async (event) => {
      if (event.type !== "message" || !event.source.userId || !event.replyToken) return;
      const messageType = event.message?.type;
      if (messageType !== "text" && messageType !== "image" && messageType !== "audio") return;
      if (await alreadyProcessed(admin, event.webhookEventId)) return;

      const lineUserId = event.source.userId;
      const replyToken = event.replyToken;

      try {
        const { data: customer } = await admin.from("customers").select("id, name").eq("line_user_id", lineUserId).maybeSingle();

        // Image = transfer slip path (feature #1), handled without the AI
        // text loop; audio = voice note (feature #14), transcribed and then
        // fed into the normal text conversation.
        if (messageType === "image") {
          await handleSlipImage(admin, lineUserId, event.message?.id ?? "", replyToken, customer?.name ?? lineUserId);
          return;
        }
        if (messageType === "audio") {
          const content = await fetchContent(event.message?.id ?? "");
          if (!content) {
            await reply(replyToken, "ขอโทษค่ะ อ่านไฟล์เสียงไม่สำเร็จ รบกวนพิมพ์ข้อความแทนได้ไหมคะ");
            return;
          }
          const transcript = await transcribeAudio(content.mimeType, content.base64).catch(() => "");
          if (!transcript) {
            await reply(replyToken, "ขอโทษค่ะ ถอดเสียงไม่สำเร็จ รบกวนพิมพ์ข้อความแทนได้ไหมคะ");
            return;
          }
          const conversationId = await resolveConversation(admin, lineUserId);
          await admin.from("messages").insert({ conversation_id: conversationId, sender: "customer", content: `[เสียง] ${transcript}`, metadata: { voice: true } });
          await admin.from("notifications").insert({
            type: "voice_transcript",
            title: "ลูกค้าส่งข้อความเสียง",
            body: `${customer?.name ?? "ลูกค้า"}: ${transcript.slice(0, 300)}`,
            customer_id: customer?.id ?? null,
          });
          const { reply: text, quickReplies } = await respond(admin, conversationId, transcript);
          await reply(replyToken, text, quickReplies);
          return;
        }

        const messageText = event.message?.text ?? "";
        const conversationId = await resolveConversation(admin, lineUserId);

        // Owner Command Center (feature #10): the owner's own LINE messages
        // that look like business commands ("ยอดขายวันนี้", "ใครค้างเงิน") get
        // a direct plain-text answer instead of the chat loop.
        const { data: ownerRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
        if (ownerRow?.value && ownerRow.value === lineUserId) {
          const commandReply = await handleOwnerCommand(admin, messageText);
          if (commandReply) {
            await reply(replyToken, commandReply);
            return;
          }
        }

        if (safeMode) {
          // Keep the message in conversation history (same insert respond()
          // itself would do) so nothing is lost once Safe Mode is turned
          // off -- just skip AI generation and any reply to the customer.
          await admin.from("messages").insert({ conversation_id: conversationId, sender: "customer", content: messageText });
          await notifyOwnerSafeMode(admin, customer?.name ?? lineUserId, messageText);
          return;
        }

        const { reply: text, quickReplies } = await respond(admin, conversationId, messageText);
        await reply(replyToken, text, quickReplies);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await logSystemEvent(admin, "line-webhook", "error", `Failed to reply to LINE message: ${message}`);
        try {
          await reply(replyToken, FALLBACK_REPLY);
        } catch {
          // best-effort -- if even the fallback reply fails (LINE itself
          // down), the system_events log above is the record.
        }
      }
    })
  );
}

// Public webhook — authenticated by the LINE signature, not a Supabase JWT.
// Deploy with verify_jwt=false.
Deno.serve(async (req: Request) => {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");

  if (!await verifySignature(rawBody, signature)) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
  }

  const admin = createAdminClient();
  const body = JSON.parse(rawBody) as { events: LineEvent[] };

  EdgeRuntime.waitUntil(processEvents(admin, body.events));

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
});

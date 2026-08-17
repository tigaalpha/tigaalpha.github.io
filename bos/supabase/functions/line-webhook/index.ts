import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { verifySignature, reply, push, fetchContent, fetchProfile } from "../_shared/line.ts";
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
  postback?: { data?: string };
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
  let { data: customer } = await admin.from("customers").select("id, name").eq("line_user_id", lineUserId).maybeSingle();

  // Money-leak fix: a brand-new person messaging the OA must never stay
  // unbound. Previously conversation.customer_id was left null and every
  // tool that creates revenue (create_payment_link, book_lesson) failed for
  // them — a real buyer transferred 27k+ THB with zero record in the CRM.
  // Auto-create a lead on first contact so the conversation is always
  // bound; the AI (or the owner) enriches name/phone afterwards.
  if (!customer) {
    const profile = await fetchProfile(lineUserId).catch(() => null);
    const displayName = profile?.displayName?.trim() ?? "";
    const { data: created, error: createErr } = await admin
      .from("customers")
      .insert({
        name: displayName || "ลูกค้า LINE ใหม่",
        line_user_id: lineUserId,
        lead_source: "LINE",
        notes: displayName ? undefined : "ยังไม่ได้ระบุชื่อ — ให้ AI ถามชื่อและอัปเดต profile",
      })
      .select("id, name")
      .single();
    if (!createErr) {
      customer = created;
      await admin.from("sales_status_history").insert({ customer_id: created.id, to_status: "new_lead", note: "สร้างอัตโนมัติจาก LINE" });
    }
  }

  const { data: existing } = await admin
    .from("conversations")
    .select("id, customer_id")
    .eq("line_user_id", lineUserId)
    .eq("channel", "line")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    // Repair a conversation created before the auto-link fix (customer_id
    // null) now that a matching customer record exists.
    if (!existing.customer_id && customer) {
      await admin.from("conversations").update({ customer_id: customer.id }).eq("id", existing.id);
    }
    return existing.id;
  }

  const { data: created, error } = await admin
    .from("conversations")
    .insert({ channel: "line", line_user_id: lineUserId, customer_id: customer?.id ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

// Keep the raw slip photo in Storage (public bucket, lazily created like
// payment-qrs) so the owner can eyeball it on the Payments page — the
// vision extraction below only stores text, which is not enough to check a
// transfer by hand. Returns a public URL, or null when storage fails (the
// extraction + owner notification still work either way).
async function uploadSlipImage(admin: ReturnType<typeof createAdminClient>, content: { mimeType: string; base64: string }, customerId: string): Promise<string | null> {
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    if (!url) return null;
    const ext = content.mimeType === "image/png" ? "png" : content.mimeType === "image/webp" ? "webp" : content.mimeType === "image/jpeg" ? "jpg" : "bin";
    const bin = atob(content.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    try {
      await admin.storage.createBucket("slip-images", { public: true });
    } catch {
      // bucket already exists — fine
    }
    const path = `slips/${customerId}/${Date.now()}.${ext}`;
    const { error } = await admin.storage.from("slip-images").upload(path, bytes, { contentType: content.mimeType, upsert: true });
    if (error) return null;
    return `${url}/storage/v1/object/public/slip-images/${path}`;
  } catch {
    return null;
  }
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

  const imageUrl = await uploadSlipImage(admin, content, customer.id);
  const raw = await understandImage(content.mimeType, content.base64, SLIP_EXTRACT_PROMPT).catch(() => "");
  const extraction: SlipExtraction | null = parseSlipJson(raw);

  const { data: pending } = await admin.from("payments").select("id, amount, reference_code, status").eq("customer_id", customer.id).eq("status", "pending");
  const match = extraction ? matchSlipToPayment(extraction, (pending ?? []).map((p) => ({ id: p.id, amount: Number(p.amount), reference_code: p.reference_code, status: p.status }))) : null;

  if (match) {
    await confirmPaymentBySlip(admin, { paymentId: match.paymentId, slipImageUrl: imageUrl });
    await admin.from("transfer_slips").insert({
      customer_id: customer.id,
      payment_id: match.paymentId,
      image_url: imageUrl,
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
    image_url: imageUrl,
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

const WELCOME_REPLIES = ["จองคอร์ส", "ดูตาราง", "ราคา", "คุยกับคน"];
const WELCOME_TEXT =
  "สวัสดีค่ะ ยินดีต้อนรับสู่ Tiga Studio 🎹\n" +
  "ทักมาถามอะไรก็ได้เลยนะคะ ไม่ว่าจะเรื่องคอร์สเรียน ราคา หรือตารางว่าง — AI ของเราพร้อมช่วยตอบทันที หรือกดเมนูด้านล่างก็ได้ค่ะ 😊";

// Postback จาก Rich Menu: แปลงเป็นการ์ดข้อความแล้วส่งเข้า AI loop ปกติ
// (ได้ tool ครบ — จองคอร์สได้จริง ฯลฯ) MENU_HUMAN ใช้ trigger handoff เดิม
const POSTBACK_MESSAGES: Record<string, string> = {
  MENU_BOOK: "อยากจองคอร์สเรียน",
  MENU_SCHEDULE: "ช่วยดูตารางว่างให้หน่อย",
  MENU_PRICE: "ราคาคอร์สเท่าไหร่บ้าง",
  MENU_HUMAN: "คุยกับคน",
};

const OPT_OUT_PHRASES = ["เลิกแจ้ง", "เลิกติดต่อ", "unsubscribe", "stop", "เลิกส่ง"];
const OPT_OUT_REPLY = "รับทราบค่ะ ไม่ส่งข้อความโปรโมชันเพิ่มแล้วนะคะ แต่ยังยินดีให้บริการตามปกติค่า 😊";

async function handleFollow(admin: ReturnType<typeof createAdminClient>, event: LineEvent): Promise<void> {
  const lineUserId = event.source?.userId;
  const replyToken = event.replyToken;
  if (!lineUserId || !replyToken) return;

  const { data: flagRows } = await admin.from("integration_settings").select("key, value");
  const flags = Object.fromEntries((flagRows ?? []).map((r) => [r.key, r.value])) as Record<string, string | undefined>;
  if (flags["chat_feature_rich_menu"] !== "on") {
    await reply(replyToken, WELCOME_TEXT, WELCOME_REPLIES).catch(() => {});
    return;
  }

  // ลูกค้าอาจเคยขอเลิกแจ้งแล้วกลับมาแอดใหม่ — ยกเลิก opt-out ให้
  await admin.from("customers").update({ marketing_opt_out: false }).eq("line_user_id", lineUserId).maybeSingle();
  await reply(replyToken, WELCOME_TEXT, WELCOME_REPLIES).catch(() => {});
  await logSystemEvent(admin, "line-webhook", "info", `follow: ${lineUserId} กลับมาแอด LINE ใหม่`);
}

async function handleUnfollow(admin: ReturnType<typeof createAdminClient>, event: LineEvent): Promise<void> {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;
  await admin.from("customers").update({ marketing_opt_out: true }).eq("line_user_id", lineUserId).maybeSingle();
  await logSystemEvent(admin, "line-webhook", "info", `unfollow: ${lineUserId} เลิกติดตาม (ตั้ง opt-out)`);
}

async function handlePostback(admin: ReturnType<typeof createAdminClient>, event: LineEvent): Promise<void> {
  const lineUserId = event.source?.userId;
  const replyToken = event.replyToken;
  const data = event.postback?.data ?? "";
  if (!lineUserId || !replyToken || !data.startsWith("MENU_")) return;

  const syntheticMessage = POSTBACK_MESSAGES[data] ?? POSTBACK_MESSAGES.MENU_BOOK;
  try {
    const conversationId = await resolveConversation(admin, lineUserId);
    await admin.from("messages").insert({ conversation_id: conversationId, sender: "customer", content: syntheticMessage, metadata: { postback: data } });
    const { reply: text, quickReplies } = await respond(admin, conversationId, syntheticMessage);
    await reply(replyToken, text, quickReplies);
  } catch (err) {
    await logSystemEvent(admin, "line-webhook", "error", `postback ${data} failed: ${err instanceof Error ? err.message : String(err)}`);
    await reply(replyToken, FALLBACK_REPLY).catch(() => {});
  }
}

async function notifyOwnerNewChat(admin: ReturnType<typeof createAdminClient>, customerName: string, messageText: string): Promise<void> {
  await admin.from("notifications").insert({
    type: "new_customer_chat",
    title: `${customerName} ทักเข้ามา`, 
    body: messageText.slice(0, 300),
  });
  const { data: ownerRow } = await admin.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
  if (ownerRow?.value) {
    await push(ownerRow.value, `💬 ${customerName}: ${messageText.slice(0, 200)}`).catch(() => {});
  }
}

async function processEvents(admin: ReturnType<typeof createAdminClient>, events: LineEvent[]): Promise<void> {
  const safeMode = await isSafeModeOn(admin);
  const { data: flagRows } = await admin.from("integration_settings").select("key, value");
  const flags = Object.fromEntries((flagRows ?? []).map((r) => [r.key, r.value])) as Record<string, string | undefined>;

  await Promise.all(
    events.map(async (event) => {
      if (!event.source.userId) return;

      // follow / unfollow / postback (rich menu) — ไม่ใช่ message event
      if (event.type === "follow") {
        await handleFollow(admin, event);
        return;
      }
      if (event.type === "unfollow") {
        await handleUnfollow(admin, event);
        return;
      }
      if (event.type === "postback") {
        await handlePostback(admin, event);
        return;
      }

      if (event.type !== "message" || !event.replyToken) return;
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

        // ลูกค้าขอเลิกแจ้ง → opt-out (broadcast/outbound จะข้ามคนนี้)
        if (OPT_OUT_PHRASES.some((p) => messageText.trim().toLowerCase().includes(p.toLowerCase()))) {
          await admin.from("customers").update({ marketing_opt_out: true }).eq("line_user_id", lineUserId);
          await reply(replyToken, OPT_OUT_REPLY);
          await logSystemEvent(admin, "line-webhook", "info", `opt-out: ${lineUserId}`);
          return;
        }

        // แจ้งเจ้าของเมื่อลูกค้าใหม่ทักมาครั้งแรก (feature เปิด/ปิดได้)
        if (flags["chat_feature_owner_notify"] === "on") {
          const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversationId);
          if ((count ?? 0) === 0) {
            await notifyOwnerNewChat(admin, customer?.name ?? "ลูกค้าใหม่", messageText);
          }
        }

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

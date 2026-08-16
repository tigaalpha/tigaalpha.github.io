import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { generate } from "./ai-provider.ts";
import type { ChatMessage } from "./ai-types.ts";
import { buildSystemPrompt, type PromptName } from "./prompts.ts";
import { AI_TOOLS, OWNER_TOOLS, executeTool, translateDbError } from "./tools.ts";
import { getLatestCompetitorContext } from "./competitor-context.ts";
import { logAiUsage } from "./usage-logging.ts";
import { cleanReplyText } from "./text-clean.ts";
import { push as linePush } from "./line.ts";
import { checkAiBudgetExceeded, AI_BUDGET_REPLY } from "./ai-budget.ts";
import { refreshLeadScore } from "./lead-score-db.ts";

const MAX_TOOL_ITERATIONS = 4;
const RECENT_MESSAGE_LIMIT = 12;
// FAQ answers (pricing, hours) can change, so a cached reply isn't reused forever.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export interface RespondResult {
  reply: string;
  needsReview: boolean;
  // Only meaningful to LINE (line-webhook attaches these as tappable quick-
  // reply buttons); other channels (web chat) just ignore the field.
  quickReplies?: string[];
}

// Attached to the opening reply only -- gives a brand-new customer a fast
// tap-to-answer path right after the full product overview instead of
// having to type a reply, and doubles as the entry point into the instant
// human-handoff check below ("คุยกับคน").
const OPENING_QUICK_REPLIES = ["เรียนที่สตูดิโอ", "เรียนออนไลน์", "ทดลองเรียนฟรี", "คุยกับคน"];

// A customer explicitly asking for a human is a high-intent signal that
// should never wait on a normal AI turn (tool-calling latency, or worse, a
// misfire) -- skip generation entirely, hand off immediately, and alert the
// owner right away (LINE push, not just a dashboard notification) since
// this is a more urgent signal than the generic degenerate-reply escalation
// below.
const HANDOFF_TRIGGERS = ["ขอคุยกับคน", "คุยกับคน", "เจ้าของร้าน", "คุยกับเจ้าหน้าที่", "ขอคุยกับเจ้าหน้าที่", "คุยกับพนักงาน", "ขอคุยกับพนักงาน", "ติดต่อเจ้าของ"];

function formatBkkTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok", hour12: false }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}
const HANDOFF_REPLY = "ได้เลยค่ะ กำลังแจ้งเจ้าของร้านให้ติดต่อกลับนะคะ รอสักครู่นะคะ 😊";

async function hashQuestion(text: string): Promise<string> {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, " ");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Long conversations occasionally collapse into repeating just the emoji
// sign-off from prior turns (e.g. "😊") instead of a real answer — a known
// LLM degeneration pattern, not a knowledge-base gap. Detected by the
// absence of any letter/digit in the reply.
function isDegenerateReply(content: string): boolean {
  return !/\p{L}|\p{N}/u.test(content.trim());
}

const DEGENERATE_FALLBACK = "ขอโทษค่ะ รบกวนพิมพ์คำถามอีกครั้งได้ไหมคะ อยากให้แน่ใจว่าตอบตรงกับที่คุณลูกค้าต้องการค่ะ";

export async function respond(
  db: SupabaseClient,
  conversationId: string,
  customerMessage: string,
  promptContext: PromptName[] = ["sales", "booking", "knowledge", "customer_service"],
  callerId: string | null = null
): Promise<RespondResult> {
  const { count: priorMessageCount } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);
  const isOpeningMessage = (priorMessageCount ?? 0) === 0;

  // AI cost optimization (Cache / Reuse Answers): an opening FAQ-style
  // question ("how much for 20 hours?") asked by a different customer
  // shouldn't cost a fresh Gemini call. Only applies to the first message —
  // once there's conversation history, a reply is context-dependent and
  // must not be reused verbatim for someone else's conversation.
  if (isOpeningMessage) {
    const questionHash = await hashQuestion(customerMessage);
    const { data: cached } = await db.from("ai_response_cache").select("*").eq("question_hash", questionHash).maybeSingle();

    if (cached && Date.now() - new Date(cached.created_at).getTime() < CACHE_TTL_MS) {
      const reply = cleanReplyText(cached.reply);
      await db.from("messages").insert({ conversation_id: conversationId, sender: "customer", content: customerMessage });
      await db.from("messages").insert({
        conversation_id: conversationId,
        sender: "ai",
        content: reply,
        metadata: { cached: true },
      });
      await db.from("ai_response_cache").update({ hits: cached.hits + 1 }).eq("id", cached.id);
      await db.from("conversations").update({ last_stage: "opening" }).eq("id", conversationId);
      return { reply, needsReview: false, quickReplies: isOpeningMessage ? OPENING_QUICK_REPLIES : undefined };
    }
  }

  await db.from("messages").insert({ conversation_id: conversationId, sender: "customer", content: customerMessage });

  const { data: conversation } = await db.from("conversations").select("summary, customer_id, channel").eq("id", conversationId).single();

  // Feature #7: every customer message nudges the lead score (recomputed
  // from sales status + message recency + bookings + paid payments).
  await refreshLeadScore(db, conversation?.customer_id ?? null);

  // Feature #13: daily AI token budget guard — when the owner set
  // ai_budget_daily_tokens and today's spend has hit it, stop generating
  // and tell the owner once (the reply also nudges the customer to talk
  // to a human).
  if (conversation?.channel !== "internal") {
    const budgetExceeded = await checkAiBudgetExceeded(db);
    if (budgetExceeded) {
      await db.from("messages").insert({ conversation_id: conversationId, sender: "ai", content: AI_BUDGET_REPLY, metadata: { fallback: true } });
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: notifiedToday } = await db
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("type", "ai_budget_exceeded")
        .gte("created_at", todayStart.toISOString());
      if ((notifiedToday ?? 0) === 0) {
        await db.from("notifications").insert({ type: "ai_budget_exceeded", title: "AI ถึงวงเงินวันนี้แล้ว", body: "ระบบหยุดตอบลูกค้าอัตโนมัติจนกว่าจะถึงวันพรุ่งนี้ หรือเพิ่มค่า ai_budget_daily_tokens ใน Settings" });
        const { data: ownerRow } = await db.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
        if (ownerRow?.value) {
          await linePush(ownerRow.value, "⚠️ ระบบ AI ถึงวงเงินค่าใช้จ่ายของวันนี้แล้ว — ลูกค้าจะได้รับข้อความแจ้งแทนการตอบอัตโนมัติ เพิ่มงบได้ที่ Settings → ai_budget_daily_tokens").catch(() => {});
        }
      }
      return { reply: AI_BUDGET_REPLY, needsReview: true };
    }
  }

  // Never for the owner's own internal Floating Assistant -- "คุยกับคน" from
  // the owner herself means something else entirely, not a customer asking
  // to be escalated to herself.
  if (conversation?.channel !== "internal" && HANDOFF_TRIGGERS.some((phrase) => customerMessage.includes(phrase))) {
    await db.from("messages").insert({ conversation_id: conversationId, sender: "ai", content: HANDOFF_REPLY, metadata: { fallback: true } });
    await db.from("conversations").update({ needs_review: true, last_stage: "handoff" }).eq("id", conversationId);
    await db.from("notifications").insert({ type: "ai_needs_review", title: "ลูกค้าขอคุยกับเจ้าของร้าน", body: customerMessage.slice(0, 300) });
    const { data: ownerLineIdRow } = await db.from("integration_settings").select("value").eq("key", "owner_line_user_id").maybeSingle();
    if (ownerLineIdRow?.value) {
      await linePush(ownerLineIdRow.value, `ลูกค้าขอคุยกับคนโดยตรง: ${customerMessage.slice(0, 300)}`).catch(() => {});
    }
    return { reply: HANDOFF_REPLY, needsReview: true };
  }

  // Only "internal" conversations (the owner/staff Floating Assistant) are
  // allowed to act on an arbitrary customer named in the message — every
  // other channel is a real customer talking about themselves, so tool
  // calls are pinned to whichever customer this conversation is already
  // tied to (see executeTool in tools.ts for why: an unpinned customerId
  // would let a crafted message get the model to write to someone else's
  // record).
  const boundCustomerId: string | null = conversation?.channel === "internal" ? null : (conversation?.customer_id ?? null);

  // OWNER_TOOLS (record_transaction, save_knowledge, mark_payment_paid,
  // bulk_update_sales_status) are only ever offered on the internal/owner
  // channel — a customer on LINE/web must never see them, regardless of
  // what they type or whether a customer row is linked yet (an unlinked
  // LINE/web user would otherwise get boundCustomerId=null and the old
  // `boundCustomerId === null` gate would wrongly expose owner tools).
  const tools = conversation?.channel === "internal" ? [...AI_TOOLS, ...OWNER_TOOLS] : AI_TOOLS;

  // Fetch the most recent RECENT_MESSAGE_LIMIT messages (descending so the
  // limit keeps the newest ones -- including the customer message just
  // inserted above), then restore chronological order for the model.
  const { data: recentHistory } = await db
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(RECENT_MESSAGE_LIMIT);
  const history = recentHistory ? [...recentHistory].reverse() : recentHistory;

  const systemParts = [buildSystemPrompt(promptContext)];
  if (conversation?.summary) {
    systemParts.push(`Summary of earlier messages in this conversation (not repeated below):\n${conversation.summary}`);
  }

  // The owner's own closing technique, distilled from their real chat
  // history (see analyze-sales-style) -- applies to every sales
  // conversation unconditionally, not just when RAG happens to surface a
  // similar-looking example.
  if (promptContext.includes("sales")) {
    const { data: playbookRow } = await db
      .from("integration_settings")
      .select("value")
      .eq("key", "learned_sales_playbook")
      .maybeSingle();
    if (playbookRow?.value) {
      systemParts.push(`## Owner's proven sales playbook (learned from their own real closed-sale chats — follow this closely)\n${playbookRow.value}`);
    }
  }

  // Attendance confirmation (24h-before): when this customer has an upcoming
  // lesson they haven't confirmed yet, tell the model so the moment the
  // student answers ("มา"/"มาไม่ได้") it records it via
  // record_attendance_confirmation — that updates the calendar and alerts
  // the owner when they can't come.
  if (boundCustomerId) {
    const now = new Date().toISOString();
    const horizon = new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString();
    const [bookingRes, scheduleRes] = await Promise.all([
      db
        .from("bookings")
        .select("id, title, start_time")
        .in("status", ["confirmed", "rescheduled"])
        .eq("customer_id", boundCustomerId)
        .eq("attendance_status", "unconfirmed")
        .gte("start_time", now)
        .lt("start_time", horizon)
        .order("start_time", { ascending: true })
        .limit(1)
        .maybeSingle(),
      db
        .from("attendance_reminder_schedules")
        .select("id, day_of_week, time_of_day")
        .eq("customer_id", boundCustomerId)
        .eq("attendance_status", "unconfirmed")
        .gte("next_occurrence_at", now)
        .lt("next_occurrence_at", horizon)
        .order("next_occurrence_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    const upcoming = (bookingRes || scheduleRes) as { id?: string } | null;
    if (upcoming) {
      const label = bookingRes ? `${bookingRes.title} (${formatBkkTime(bookingRes.start_time)})` : `คาบเรียนประจำ (${scheduleRes.time_of_day.slice(0, 5)})`;
      systemParts.push(
        `[ATTENDANCE — ${label}] ยังไม่ยืนยันการมาเรียน ถ้าลูกค้าบอกว่าจะมา หรือบอกว่ามาไม่ได้ ให้เรียก record_attendance_confirmation ทันที ` +
          `(${bookingRes ? `bookingId: ${bookingRes.id}` : `scheduleId: ${scheduleRes.id}`}, status: confirmed หรือ declined)`
      );
    }
  }

  // Only the owner/staff Floating Assistant (internal channel) gets the
  // competitor analysis context -- same boundCustomerId===null signal that
  // gates OWNER_TOOLS -- customers on LINE/web must never see the studio's
  // own competitive strategy data.
  if (boundCustomerId === null) {
    const competitorContext = await getLatestCompetitorContext(db);
    if (competitorContext) systemParts.push(competitorContext);
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemParts.join("\n\n") },
    // A degenerate AI turn (or the DEGENERATE_FALLBACK apology saved in its
    // place — flagged via metadata.fallback, since the fallback text itself
    // has real letters and would otherwise pass the letterless check below)
    // must not stay in the context fed back to the model — seeing its own
    // prior "😊"-only turn, or its own prior "please retype" apology, is
    // exactly what drags a fresh generation back into repeating the same
    // failure, on the retry as much as the original attempt (same messages
    // array, same attractor) — confirmed in production: both real LINE
    // conversations this bot has ever had got stuck in exactly this loop.
    ...(history ?? [])
      .filter((m: { sender: string; content: string; metadata?: { fallback?: boolean } | null }) => m.sender !== "ai" || (!isDegenerateReply(m.content) && !m.metadata?.fallback))
      .map((m: { sender: string; content: string }) => ({
        role: (m.sender === "customer" ? "user" : "assistant") as ChatMessage["role"],
        content: m.content,
      })),
  ];

  let iterations = 0;
  let usedTools = false;

  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations += 1;
    const result = await generate(messages, tools);
    await logAiUsage(db, result.usage, "chat-core:respond");

    if (result.finishReason !== "tool_calls" || !result.message.toolCalls?.length) {
      let usedFallback = false;
      if (isDegenerateReply(result.message.content)) {
        // A stochastic degenerate reply usually doesn't repeat on a fresh
        // sample from the same prompt, so retry once before falling back.
        const retry = await generate(messages, tools);
        await logAiUsage(db, retry.usage, "chat-core:respond");
        if (retry.finishReason !== "tool_calls" && !isDegenerateReply(retry.message.content)) {
          result.message.content = retry.message.content;
        } else {
          result.message.content = DEGENERATE_FALLBACK;
          usedFallback = true;
        }
      }

      // Safety net: strip any markdown / special characters the model
      // leaked into the reply before it is saved or sent to the customer
      // (prompts forbid them, but this guarantees it).
      result.message.content = cleanReplyText(result.message.content);

      await db.from("messages").insert({
        conversation_id: conversationId,
        sender: "ai",
        content: result.message.content,
        ...(usedFallback ? { metadata: { fallback: true } } : {}),
      });

      // Cheap, real signal for "where did this conversation stall" -- no
      // extra AI call, derived from what already happened this turn. Used
      // by the Sales dashboard's drop-off breakdown (dropOffStageCounts).
      const stage = usedFallback ? "fallback" : usedTools ? "tool_used" : isOpeningMessage ? "opening" : "general";

      // The bot just admitted it couldn't produce a real answer even after a
      // retry -- tell the owner right away instead of leaving a customer
      // stuck talking to a broken loop for days (confirmed in production:
      // neither of the 2 real conversations this ever happened to were ever
      // escalated before this fix). Same two writes flag_needs_review's own
      // tool handler does (tools.ts).
      if (usedFallback) {
        await db.from("conversations").update({ needs_review: true, last_stage: stage }).eq("id", conversationId);
        await db.from("notifications").insert({ type: "ai_needs_review", title: "AI escalated a conversation", body: "AI ตอบไม่ได้หลังจากลองใหม่แล้ว ต้องการให้เจ้าของช่วยตอบ" });
      } else {
        await db.from("conversations").update({ last_stage: stage }).eq("id", conversationId);
      }

      // Only cache plain knowledge-lookup answers — a reply that used tools
      // (booking, CRM lookups) is specific to this customer and must not be
      // replayed to someone else.
      if (isOpeningMessage && !usedTools) {
        const questionHash = await hashQuestion(customerMessage);
        await db.from("ai_response_cache").upsert(
          { question_hash: questionHash, question_text: customerMessage, reply: result.message.content, hits: 1, created_at: new Date().toISOString() },
          { onConflict: "question_hash" }
        );
      }

      await maybeSummarize(db, conversationId, conversation?.summary ?? null);

      const { data: fresh } = await db.from("conversations").select("needs_review").eq("id", conversationId).single();
      return {
        reply: result.message.content,
        needsReview: fresh?.needs_review ?? false,
        quickReplies: isOpeningMessage && !usedFallback ? OPENING_QUICK_REPLIES : undefined,
      };
    }

    usedTools = true;
    messages.push(result.message);

    for (const call of result.message.toolCalls) {
      const toolResult = await executeTool(call, db, boundCustomerId, callerId).catch((error: unknown) => ({
        // A raw Postgres error (has a .code) is translated to a plain Thai
        // message before it ever reaches the model -- confirmed in
        // production that the model will otherwise paraphrase a raw
        // technical error straight to a real customer ("มีข้อผิดพลาดทาง
        // เทคนิคเล็กน้อยในการบันทึกข้อมูลลูกค้าค่ะ"). An error already
        // thrown deliberately elsewhere (new Error("ภาษาไทยที่ชัดเจน")) has
        // no .code and passes through unchanged.
        error: error && typeof error === "object" && "code" in error ? translateDbError(error) : error instanceof Error ? error.message : String(error),
      }));
      messages.push({ role: "tool", toolCallId: call.id, content: JSON.stringify(toolResult) });
    }
  }

  await db.from("conversations").update({ needs_review: true, last_stage: "fallback" }).eq("id", conversationId);
  const fallback = "ขอโทษค่ะ ขอเวลาตรวจสอบข้อมูลเพิ่มเติมกับทางทีมงานก่อนนะคะ เดี๋ยวจะรีบติดต่อกลับค่ะ";
  await db.from("messages").insert({ conversation_id: conversationId, sender: "ai", content: fallback, metadata: { fallback: true } });
  return { reply: fallback, needsReview: true };
}

/**
 * Summarize once a conversation outgrows the recent-message window sent to
 * the model, so older context is compressed rather than silently dropped.
 * Deliberately not incremental/rolling — it only fires the first time the
 * limit is exceeded, trading perfect freshness for a bounded number of
 * extra Gemini calls per conversation (see README AI Cost Optimization).
 */
async function maybeSummarize(db: SupabaseClient, conversationId: string, existingSummary: string | null): Promise<void> {
  if (existingSummary) return;

  const { count } = await db.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversationId);
  if ((count ?? 0) <= RECENT_MESSAGE_LIMIT) return;

  const { data: older } = await db
    .from("messages")
    .select("sender, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit((count ?? 0) - RECENT_MESSAGE_LIMIT);
  if (!older || older.length === 0) return;

  const transcript = older.map((m: { sender: string; content: string }) => `${m.sender}: ${m.content}`).join("\n");
  const result = await generate([
    {
      role: "system",
      content: "Summarize this customer conversation in 2-3 short sentences. Keep names, numbers, and commitments made. No preamble.",
    },
    { role: "user", content: transcript },
  ]);
  await logAiUsage(db, result.usage, "chat-core:summarize");

  await db.from("conversations").update({ summary: result.message.content }).eq("id", conversationId);
}

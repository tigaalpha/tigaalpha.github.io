import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { respond } from "../_shared/chat-core.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

const GRAPH_BASE = "https://graph.facebook.com/v19.0";
const FALLBACK_REPLY = "ขออภัยค่ะ ระบบขัดข้องชั่วคราว รบกวนลองทักใหม่อีกครั้งสักครู่นะคะ";

interface MessengerEntry {
  messaging?: Array<{
    sender?: { id?: string };
    message?: { text?: string };
    timestamp?: number;
  }>;
}

function verifyToken(): string {
  return Deno.env.get("MESSENGER_VERIFY_TOKEN") ?? "";
}

function pageAccessToken(): string {
  return Deno.env.get("MESSENGER_PAGE_ACCESS_TOKEN") ?? "";
}

async function sendMessage(psid: string, text: string): Promise<void> {
  const token = pageAccessToken();
  if (!token) throw new Error("MESSENGER_PAGE_ACCESS_TOKEN is not set");
  const response = await fetch(`${GRAPH_BASE}/me/messages?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: psid }, message: { text } }),
  });
  if (!response.ok) {
    throw new Error(`Messenger send failed (${response.status}): ${await response.text()}`);
  }
}

async function handleMessaging(admin: ReturnType<typeof createAdminClient>, psid: string, text: string, timestamp: number): Promise<void> {
  const { data: customer } = await admin.from("customers").select("id, name").eq("messenger_psid", psid).maybeSingle();

  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("line_user_id", `fb:${psid}`)
    .eq("channel", "messenger")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId: string;
  if (existing) {
    conversationId = existing.id;
  } else {
    const { data: created, error } = await admin
      .from("conversations")
      .insert({ channel: "messenger", line_user_id: `fb:${psid}`, customer_id: customer?.id ?? null })
      .select("id")
      .single();
    if (error) throw error;
    conversationId = created.id;
  }

  const { reply: replyText, quickReplies } = await respond(admin, conversationId, text, ["sales", "booking", "knowledge", "customer_service"], null);
  const finalText = quickReplies?.length ? `${replyText}\n\n(กด: ${quickReplies.join(" / ")})` : replyText;
  await sendMessage(psid, finalText);
  void timestamp;
}

// Feature #4 — Facebook Messenger channel. Public webhook: verify_jwt=false.
// Auth is the GET verification handshake (MESSENGER_VERIFY_TOKEN) plus the
// fact that only Meta can hit the URL. Messages flow through the exact same
// respond() core as LINE — same tools, same knowledge base, same safety.
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const admin = createAdminClient();

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && token === verifyToken() && challenge) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Verification failed", { status: 403 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const body = (await req.json()) as { entry?: MessengerEntry[] };
  const events: { psid: string; text: string; timestamp: number }[] = [];
  for (const entry of body.entry ?? []) {
    for (const event of entry.messaging ?? []) {
      const text = event.message?.text?.trim();
      if (text && event.sender?.id) {
        events.push({ psid: event.sender.id, text, timestamp: event.timestamp ?? Date.now() });
      }
    }
  }

  EdgeRuntime.waitUntil(
    (async () => {
      for (const event of events) {
        try {
          await handleMessaging(admin, event.psid, event.text, event.timestamp);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await logSystemEvent(admin, "messenger-webhook", "error", `Failed to reply to Messenger message: ${message}`);
          try {
            await sendMessage(event.psid, FALLBACK_REPLY);
          } catch {
            // best-effort
          }
        }
      }
    })()
  );

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
});

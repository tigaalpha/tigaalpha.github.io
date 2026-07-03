import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { createContainer } from "@/services/container";

interface LineEvent {
  type: string;
  source: { userId?: string };
  message?: { type: string; text?: string };
  replyToken?: string;
}

/**
 * LINE webhook: verifies the signature, routes each message event through
 * the AI chat service, and replies via the LINE Reply API. Public route —
 * authenticated by the LINE signature, not Supabase auth (see middleware.ts).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature");

  const db = createAdminClient();
  const { line, chat, repos } = createContainer(db);

  if (!line.verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as { events: LineEvent[] };

  await Promise.all(
    body.events.map(async (event) => {
      if (event.type !== "message" || event.message?.type !== "text" || !event.source.userId || !event.replyToken) {
        return;
      }

      const lineUserId = event.source.userId;
      const replyToken = event.replyToken;
      const customer = await repos.customers.findByLineUserId(lineUserId);
      const conversation = await repos.conversations.findOrCreateForLineUser(lineUserId, customer?.id);

      const { reply } = await chat.respond({
        conversationId: conversation.id,
        customerMessage: event.message?.text ?? "",
      });

      await line.reply(replyToken, reply);
    })
  );

  return NextResponse.json({ ok: true });
}

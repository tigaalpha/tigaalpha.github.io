import { computeLineSignature, constantTimeEqual } from "./line-signature.ts";

const LINE_API_BASE = "https://api.line.me/v2/bot";

export async function verifySignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const secret = Deno.env.get("LINE_CHANNEL_SECRET");
  if (!secret) return false;

  const expected = await computeLineSignature(rawBody, secret);
  return constantTimeEqual(expected, signature);
}

async function call(path: string, body: unknown): Promise<void> {
  const response = await fetch(`${LINE_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`LINE API ${path} failed (${response.status}): ${await response.text()}`);
  }
}

export function reply(replyToken: string, text: string): Promise<void> {
  return call("/message/reply", { replyToken, messages: [{ type: "text", text }] });
}

export function push(userId: string, text: string): Promise<void> {
  return call("/message/push", { to: userId, messages: [{ type: "text", text }] });
}

/** Sends a message to every follower of the LINE Official Account — the "post" for LINE in social-publish. */
export function broadcast(text: string): Promise<void> {
  return call("/message/broadcast", { messages: [{ type: "text", text }] });
}

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

// LINE quick replies: up to 13 tappable buttons attached to a text message,
// each label capped at 20 characters by LINE's own API. Tapping one sends
// its text back as an ordinary customer message -- no new message type or
// webhook handling needed on our side.
function buildQuickReply(labels?: string[]): { items: { type: "action"; action: { type: "message"; label: string; text: string } }[] } | undefined {
  if (!labels || labels.length === 0) return undefined;
  return {
    items: labels.slice(0, 13).map((label) => ({
      type: "action",
      action: { type: "message", label: label.slice(0, 20), text: label },
    })),
  };
}

export function reply(replyToken: string, text: string, quickReplies?: string[]): Promise<void> {
  const quickReply = buildQuickReply(quickReplies);
  return call("/message/reply", { replyToken, messages: [{ type: "text", text, ...(quickReply ? { quickReply } : {}) }] });
}

export function push(userId: string, text: string, quickReplies?: string[]): Promise<void> {
  const quickReply = buildQuickReply(quickReplies);
  return call("/message/push", { to: userId, messages: [{ type: "text", text, ...(quickReply ? { quickReply } : {}) }] });
}

/** Sends a message to every follower of the LINE Official Account — the "post" for LINE in social-publish. */
export function broadcast(text: string): Promise<void> {
  return call("/message/broadcast", { messages: [{ type: "text", text }] });
}

/** Real connectivity check (used by system-health-check) -- true only on a 2xx from LINE's own bot-info endpoint, using the same token push/reply already rely on. Never throws. */
export async function checkConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${LINE_API_BASE}/info`, {
      headers: { Authorization: `Bearer ${Deno.env.get("LINE_CHANNEL_ACCESS_TOKEN")}` },
    });
    return response.ok;
  } catch {
    return false;
  }
}

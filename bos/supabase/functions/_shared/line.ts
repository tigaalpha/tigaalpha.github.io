const LINE_API_BASE = "https://api.line.me/v2/bot";

export async function verifySignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) return false;
  const secret = Deno.env.get("LINE_CHANNEL_SECRET");
  if (!secret) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expectedBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(expectedBytes)));
  return expectedB64 === signature;
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

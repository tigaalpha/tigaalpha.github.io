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

  // Constant-time comparison -- a naive === lets response-timing leak how
  // many leading bytes matched, which over enough requests can help an
  // attacker forge a valid signature.
  if (expectedB64.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedB64.length; i++) {
    diff |= expectedB64.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
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

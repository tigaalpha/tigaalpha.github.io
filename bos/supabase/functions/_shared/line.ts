import { createHmac, timingSafeEqual } from "node:crypto";

const LINE_API_BASE = "https://api.line.me/v2/bot";

export function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  const expected = createHmac("sha256", Deno.env.get("LINE_CHANNEL_SECRET")!).update(rawBody).digest("base64");
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);

  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
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

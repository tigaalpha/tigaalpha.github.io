import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

const LINE_API_BASE = "https://api.line.me/v2/bot";

export interface LineWebhookEvent {
  type: string;
  source: { userId?: string; type: string };
  message?: { type: string; text?: string };
  replyToken?: string;
  timestamp: number;
}

export class LineService {
  /** Verifies the X-Line-Signature header per LINE's webhook spec. */
  verifySignature(rawBody: string, signature: string | null): boolean {
    if (!signature) return false;

    const expected = createHmac("sha256", env.line.channelSecret()).update(rawBody).digest("base64");
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signature);

    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  }

  async reply(replyToken: string, text: string): Promise<void> {
    await this.call("/message/reply", {
      replyToken,
      messages: [{ type: "text", text }],
    });
  }

  async push(userId: string, text: string): Promise<void> {
    await this.call("/message/push", {
      to: userId,
      messages: [{ type: "text", text }],
    });
  }

  private async call(path: string, body: unknown): Promise<void> {
    const response = await fetch(`${LINE_API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.line.channelAccessToken()}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LINE API ${path} failed (${response.status}): ${errorText}`);
    }
  }
}

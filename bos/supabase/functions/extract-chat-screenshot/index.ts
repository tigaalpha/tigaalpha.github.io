import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";
import { understandImage } from "../_shared/gemini.ts";

interface ExtractedTurn {
  speaker: "customer" | "owner";
  text: string;
}

const INSTRUCTION = `This image is a screenshot of a chat conversation (LINE or similar) between the owner of a piano school and a customer. Read every message bubble in the screenshot, in the order they appear top to bottom, and return ONLY a JSON array (no markdown code fence, no explanation) of objects shaped like:
[{"speaker": "customer" | "owner", "text": "..."}]

Rules:
- "owner" is whoever is replying/selling (usually the bubbles on the right or in a distinct sent-message color); "customer" is the other party.
- Transcribe the text faithfully, in whatever language it's actually written in (Thai or English).
- Replace any customer personal information you can read (full name, phone number, address, LINE ID, email) with the single word "ลูกค้า" wherever it appears in the text -- keep everything else as written.
- Skip system messages, timestamps, "read" markers, and stickers/images with no text.
- If you cannot confidently read a bubble, omit it rather than guessing.
- Return [] if this doesn't look like a chat screenshot at all.`;

function parseTurns(raw: string): ExtractedTurn[] {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("Model did not return a JSON array");
  return parsed
    .filter((item): item is ExtractedTurn => item && typeof item.text === "string" && (item.speaker === "customer" || item.speaker === "owner"))
    .map((item) => ({ speaker: item.speaker, text: item.text.trim() }))
    .filter((item) => item.text.length > 0);
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "extract-chat-screenshot", { windowMinutes: 60, maxRequests: 30 });

    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return jsonResponse({ error: "imageBase64 is required" }, 400);
    }
    if (!mimeType || typeof mimeType !== "string" || !mimeType.startsWith("image/")) {
      return jsonResponse({ error: "mimeType must be an image/* type" }, 400);
    }

    const raw = await understandImage(mimeType, imageBase64, INSTRUCTION);

    let turns: ExtractedTurn[];
    try {
      turns = parseTurns(raw);
    } catch {
      return jsonResponse({ error: "อ่านภาพนี้ไม่สำเร็จ ลองภาพที่ชัดกว่านี้ หรือครอปเฉพาะส่วนบทสนทนา" }, 422);
    }

    if (turns.length === 0) {
      return jsonResponse({ error: "ไม่พบข้อความสนทนาในภาพนี้ ลองภาพอื่น" }, 422);
    }

    return jsonResponse({ turns });
  } catch (error) {
    if (error instanceof RateLimitError) {
      await logSystemEvent(admin, "extract-chat-screenshot", "warning", error.message);
      return jsonResponse({ error: error.message }, 429);
    }
    return await handleUnexpectedError(admin, "extract-chat-screenshot", error);
  }
});

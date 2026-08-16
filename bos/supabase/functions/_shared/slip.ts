// Transfer-slip auto-verification logic (feature #1). Pure functions here are
// unit-tested from bos/lib/slip.test.ts (same convention as promptpay.ts).
// The vision call itself lives in gemini.ts (understandImage); this file
// owns: (a) instructing/parsing the model's JSON output, (b) matching the
// extraction against the customer's real pending payments, and (c) the
// safe auto-confirm rule.

export interface SlipExtraction {
  /** Whether the image is actually a Thai bank transfer slip. */
  isSlip: boolean;
  /** Transfer amount in THB, if readable. */
  amount: number | null;
  /** Reference/note text on the slip (e.g. our "PPXXXX" code), if present. */
  reference: string | null;
  /** Transfer date ISO (yyyy-mm-dd), if readable. */
  date: string | null;
  /** Model self-assessed confidence 0..1. */
  confidence: number;
}

export const SLIP_EXTRACT_PROMPT = `You are reading a photo of a Thai bank transfer slip (สลิปโอนเงิน). Determine whether this image is really a transfer slip and extract its key fields. Respond with ONLY a JSON object, no markdown fences, no commentary, in this exact shape:
{"isSlip": true|false, "amount": 1234.5|null, "reference": "PPXXXX"|null, "date": "YYYY-MM-DD"|null, "confidence": 0.95}
Rules:
- isSlip=false if the image is a screenshot of a chat, a selfie, or anything that is not a bank transfer slip.
- amount: the transferred amount in THB as a number (no commas, no "฿").
- reference: the note/remark text the payer wrote, if any (this is often our payment reference code like PPXXXX).
- date: the transfer date if printed, in YYYY-MM-DD.
- confidence: how sure you are that this is a transfer slip and the fields are correct (0..1).`;

// The model occasionally wraps JSON in ```json fences or adds prose despite
// the instruction — strip all of that and parse defensively.
export function parseSlipJson(raw: string): SlipExtraction | null {
  if (!raw) return null;
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
    const amount = typeof parsed.amount === "number" ? parsed.amount : null;
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
    return {
      isSlip: Boolean(parsed.isSlip),
      amount: amount !== null && Number.isFinite(amount) && amount > 0 ? amount : null,
      reference: typeof parsed.reference === "string" && parsed.reference.trim() ? parsed.reference.trim() : null,
      date: typeof parsed.date === "string" && parsed.date.trim() ? parsed.date.trim() : null,
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
    };
  } catch {
    return null;
  }
}

export interface PendingPayment {
  id: string;
  amount: number;
  reference_code: string;
  status: string;
}

function normalizeRef(ref: string): string {
  return ref.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Match an extraction against a customer's pending payments, most specific
 * match first:
 *   1. exact reference-code match (our PPXXXX) — the strongest signal
 *   2. exact amount match — only auto-confirms when it's unambiguous
 *      (exactly one pending payment with that amount), so a duplicate-priced
 *      course can never be auto-confirmed to the wrong invoice
 * Returns null when nothing matches safely (owner reviews it then).
 */
export function matchSlipToPayment(extraction: SlipExtraction, pending: PendingPayment[]): { paymentId: string; matchedBy: "reference" | "amount" } | null {
  if (!extraction.isSlip || pending.length === 0) return null;

  if (extraction.reference) {
    const ref = normalizeRef(extraction.reference);
    if (ref.length >= 3) {
      const byRef = pending.find((p) => normalizeRef(p.reference_code) === ref);
      if (byRef) return { paymentId: byRef.id, matchedBy: "reference" };
    }
  }

  if (extraction.amount !== null) {
    const amount = extraction.amount;
    const byAmount = pending.filter((p) => Math.abs(Number(p.amount) - amount) < 0.01);
    if (byAmount.length === 1 && byAmount[0]) return { paymentId: byAmount[0].id, matchedBy: "amount" };
  }

  return null;
}

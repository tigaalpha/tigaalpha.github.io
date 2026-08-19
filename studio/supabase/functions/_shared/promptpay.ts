// PromptPay EMVCo QR payload builder — ported verbatim from the TiGA Piano
// consumer app (repo-root App.tsx) so the BOS accepts money the exact same
// way: an EMVCo Merchant-Presented QR that Thai banking apps scan to pay
// straight into the studio's PromptPay ID. No gateway, no fees.
//
// This file has ZERO imports and no Deno-specific syntax on purpose — vitest
// (bos/lib/promptpay.test.ts) imports it directly into a Node run. The QR
// PNG encoding itself lives in payments.ts (edge-function side) since it
// pulls in qrcode-generator.

// target = mobile number (0xxxxxxxxx) or national/tax id (13 digits); amount in THB
export function promptPayPayload(target: string, amount: number): string {
  const digits = String(target || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  let acc: string;
  let tag: string;
  if (digits.length >= 13) {
    acc = digits.slice(0, 13);
    tag = "02"; // national / tax id
  } else {
    // mobile -> 0066 + 9 digits (13 total)
    let local = digits;
    if (local.startsWith("66")) local = local.slice(2);
    local = local.replace(/^0+/, "");
    acc = "0066" + local;
    tag = "01";
  }
  const merchant = tlv("00", "A000000677010111") + tlv(tag, acc);
  let s = tlv("00", "01") + tlv("01", amount > 0 ? "12" : "11") + tlv("29", merchant) + tlv("53", "764") + tlv("58", "TH");
  if (amount > 0) s += tlv("54", Number(amount).toFixed(2));
  s += "6304";
  return s + crc16(s);
}

function tlv(id: string, val: string): string {
  const l = String(val.length).padStart(2, "0");
  return id + l + val;
}

export function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Amount must be a positive THB value with at most 2 decimals. Returns null when invalid. */
export function sanitizeAmount(amount: unknown): number | null {
  const n = typeof amount === "number" && Number.isFinite(amount) ? amount : typeof amount === "string" ? Number(amount) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  const rounded = Math.round(n * 100) / 100;
  return rounded;
}

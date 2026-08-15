import { describe, expect, it } from "vitest";
import { crc16, promptPayPayload, sanitizeAmount } from "../supabase/functions/_shared/promptpay";

describe("promptPayPayload", () => {
  it("builds a valid EMVCo structure for a mobile number with amount", () => {
    const payload = promptPayPayload("0812345678", 27000);
    expect(payload.startsWith("000201")).toBe(true); // payload format indicator
    expect(payload).toContain("010212"); // point of initiation: dynamic (amount set)
    expect(payload).not.toContain("010211"); // static only when no amount
    expect(payload).toContain("5303764"); // THB
    expect(payload).toContain("5802TH"); // Thailand
    expect(payload).toContain("540827000.00"); // tag 54, len 8, amount with 2 decimals
    expect(payload).toMatch(/6304[0-9A-F]{4}$/); // CRC trailer
    expect(payload).toContain("0066812345678"); // mobile -> 0066 + 9 digits
  });

  it("uses national id (13 digits) as-is with tag 02", () => {
    const payload = promptPayPayload("1103701234567", 0);
    expect(payload).toContain("02131103701234567"); // tag 02, len 13
    expect(payload).toContain("010211"); // no amount -> static
    expect(payload).not.toContain("54");
  });

  it("normalizes leading 66 / leading 0 variants of a mobile number", () => {
    expect(promptPayPayload("66812345678", 100)).toContain("0066812345678");
    expect(promptPayPayload("0812345678", 100)).toContain("0066812345678");
  });

  it("returns an empty string for an empty target", () => {
    expect(promptPayPayload("", 100)).toBe("");
    expect(promptPayPayload(undefined as unknown as string, 100)).toBe("");
  });

  it("rounds amounts to 2 decimals", () => {
    const a = promptPayPayload("0812345678", 27.5);
    expect(a).toContain("540527.50"); // len 5: "27.50"
    const b = promptPayPayload("0812345678", 1000.999);
    expect(b).toContain("54071001.00"); // toFixed(2) of 1000.999 -> "1001.00" (7 chars)
  });

  it("appends a CRC that re-computes to itself", () => {
    for (const target of ["0812345678", "1103701234567"]) {
      for (const amount of [0, 1, 990, 27000.5]) {
        const payload = promptPayPayload(target, amount);
        const body = payload.slice(0, -4);
        expect(crc16(body)).toBe(payload.slice(-4));
      }
    }
  });
});

describe("sanitizeAmount", () => {
  it("accepts positive finite numbers and rounds to 2 decimals", () => {
    expect(sanitizeAmount(27000)).toBe(27000);
    expect(sanitizeAmount("990.5")).toBe(990.5);
    expect(sanitizeAmount("1.009")).toBe(1.01);
  });

  it("rejects zero, negatives, NaN, and anything over 1M", () => {
    expect(sanitizeAmount(0)).toBeNull();
    expect(sanitizeAmount(-5)).toBeNull();
    expect(sanitizeAmount(NaN)).toBeNull();
    expect(sanitizeAmount(1_000_000.01)).toBeNull();
    expect(sanitizeAmount("not a number")).toBeNull();
  });
});

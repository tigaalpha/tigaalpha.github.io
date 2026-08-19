import { describe, expect, it } from "vitest";
import { parseSlipJson, matchSlipToPayment, type SlipExtraction } from "../supabase/functions/_shared/slip";

const PENDING = [
  { id: "p1", amount: 27000, reference_code: "PPABC123", status: "pending" },
  { id: "p2", amount: 1490, reference_code: "PPXYZ789", status: "pending" },
];

describe("parseSlipJson", () => {
  it("parses a clean JSON object", () => {
    const result = parseSlipJson('{"isSlip": true, "amount": 27000, "reference": "PPABC123", "date": "2026-08-15", "confidence": 0.98}');
    expect(result?.isSlip).toBe(true);
    expect(result?.amount).toBe(27000);
    expect(result?.reference).toBe("PPABC123");
    expect(result?.confidence).toBe(0.98);
  });

  it("strips markdown code fences and surrounding prose", () => {
    const raw = 'Here you go:\n```json\n{"isSlip": true, "amount": 1490, "reference": "PPXYZ789", "confidence": 0.9}\n```\nThanks!';
    const result = parseSlipJson(raw);
    expect(result?.isSlip).toBe(true);
    expect(result?.amount).toBe(1490);
  });

  it("returns null on garbage", () => {
    expect(parseSlipJson("not json at all")).toBeNull();
    expect(parseSlipJson("")).toBeNull();
  });

  it("clamps confidence and rejects invalid amounts", () => {
    const result = parseSlipJson('{"isSlip": true, "amount": -5, "reference": null, "confidence": 3}');
    expect(result?.amount).toBeNull();
    expect(result?.confidence).toBe(1);
  });
});

describe("matchSlipToPayment", () => {
  const slip = (overrides: Partial<SlipExtraction>): SlipExtraction => ({
    isSlip: true,
    amount: 27000,
    reference: "PPABC123",
    date: null,
    confidence: 0.95,
    ...overrides,
  });

  it("matches by exact reference code", () => {
    const match = matchSlipToPayment(slip({}), PENDING);
    expect(match?.paymentId).toBe("p1");
    expect(match?.matchedBy).toBe("reference");
  });

  it("matches by amount only when unambiguous", () => {
    const match = matchSlipToPayment(slip({ reference: null }), PENDING);
    expect(match?.paymentId).toBe("p1");
    expect(match?.matchedBy).toBe("amount");
  });

  it("refuses ambiguous amount matches (two pending invoices, same price)", () => {
    const dupAmounts = [
      { id: "a", amount: 27000, reference_code: "PPAAA1", status: "pending" },
      { id: "b", amount: 27000, reference_code: "PPBBB2", status: "pending" },
    ];
    expect(matchSlipToPayment(slip({ reference: null }), dupAmounts)).toBeNull();
  });

  it("returns null for non-slips and empty pending list", () => {
    expect(matchSlipToPayment(slip({ isSlip: false }), PENDING)).toBeNull();
    expect(matchSlipToPayment(slip({}), [])).toBeNull();
  });

  it("normalizes reference format (case/spaces)", () => {
    const match = matchSlipToPayment(slip({ reference: "pp abc123 " }), PENDING);
    expect(match?.paymentId).toBe("p1");
  });
});

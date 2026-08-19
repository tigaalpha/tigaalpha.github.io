import { describe, expect, it } from "vitest";
import { formatCurrency, describeFunctionError } from "./utils";

describe("formatCurrency", () => {
  it("formats a positive amount as Thai baht with no decimals", () => {
    expect(formatCurrency(1500)).toBe("฿1,500");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("฿0");
  });

  it("rounds fractional amounts (no decimals shown)", () => {
    expect(formatCurrency(999.9)).toBe("฿1,000");
  });

  it("formats negative amounts", () => {
    expect(formatCurrency(-500)).toBe("-฿500");
  });
});

describe("describeFunctionError", () => {
  it("extracts the error field from a JSON error response body", async () => {
    const error = {
      context: new Response(JSON.stringify({ error: "prompt is required" }), { status: 400 }),
    };
    expect(await describeFunctionError(error)).toBe("prompt is required");
  });

  it("falls back to raw text when the response body isn't JSON", async () => {
    const error = { context: new Response("Internal Server Error", { status: 500 }) };
    expect(await describeFunctionError(error)).toBe("Internal Server Error");
  });

  it("falls back to the Error's message when there's no context", async () => {
    expect(await describeFunctionError(new Error("network failure"))).toBe("network failure");
  });

  it("falls back to a generic message for a non-Error, non-context value", async () => {
    expect(await describeFunctionError("just a string")).toBe("Unknown error");
  });

  it("falls back to the raw response text when the JSON body has no error field", async () => {
    const error = {
      context: new Response(JSON.stringify({ ok: true }), { status: 200 }),
    };
    expect(await describeFunctionError(error)).toBe('{"ok":true}');
  });
});

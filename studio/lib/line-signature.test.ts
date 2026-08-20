import { describe, expect, it } from "vitest";
import { computeLineSignature, constantTimeEqual } from "../supabase/functions/_shared/line-signature";

// This guards every inbound LINE webhook (line-webhook/index.ts) -- a bug
// here means either forged webhook payloads get accepted, or LINE's own
// real requests get rejected. Test vector computed independently via
// Node's crypto.createHmac (not by re-deriving the same code under test).
describe("computeLineSignature", () => {
  it("matches an independently-computed HMAC-SHA256 base64 signature", async () => {
    const signature = await computeLineSignature('{"events":[]}', "test-secret-key");
    expect(signature).toBe("JTL9OzTebjkcNeXoYKoFokvCq2FBLof959aB7cAMWjs=");
  });

  it("produces a different signature for a different body", async () => {
    const a = await computeLineSignature('{"events":[]}', "test-secret-key");
    const b = await computeLineSignature('{"events":[{}]}', "test-secret-key");
    expect(a).not.toBe(b);
  });

  it("produces a different signature for a different secret", async () => {
    const a = await computeLineSignature("same body", "secret-a");
    const b = await computeLineSignature("same body", "secret-b");
    expect(a).not.toBe(b);
  });
});

describe("constantTimeEqual", () => {
  it("returns true for identical strings", () => {
    expect(constantTimeEqual("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(constantTimeEqual("abc123", "abc124")).toBe(false);
  });

  it("returns false for different lengths without throwing", () => {
    expect(constantTimeEqual("short", "much-longer-string")).toBe(false);
  });

  it("returns false when only the first character differs", () => {
    expect(constantTimeEqual("Xbc123", "abc123")).toBe(false);
  });
});

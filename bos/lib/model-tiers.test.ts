import { describe, expect, it } from "vitest";
import { resolveTierModelId, DEFAULT_MODEL_ID } from "../supabase/functions/_shared/model-tiers";

const VALID = ["gemini", "claude", "gpt", "qwen", "kimi", "glm", "grok", "deepseek", "deepseek-v3-free"];

describe("resolveTierModelId", () => {
  it("uses the tier value when set and valid", () => {
    expect(resolveTierModelId("chat", { tierValue: "deepseek", masterValue: "gemini" }, VALID)).toBe("deepseek");
  });

  it("falls back to the master model when tier is unset", () => {
    expect(resolveTierModelId("agent", { tierValue: null, masterValue: "claude" }, VALID)).toBe("claude");
  });

  it("falls back to the default when both are unset", () => {
    expect(resolveTierModelId("content", { tierValue: "", masterValue: "" }, VALID)).toBe(DEFAULT_MODEL_ID);
  });

  it("ignores an invalid tier value and falls through to master", () => {
    expect(resolveTierModelId("chat", { tierValue: "not-a-model", masterValue: "qwen" }, VALID)).toBe("qwen");
  });

  it("ignores an invalid master value too", () => {
    expect(resolveTierModelId("chat", { tierValue: null, masterValue: "bogus" }, VALID)).toBe(DEFAULT_MODEL_ID);
  });
});

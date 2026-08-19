import { describe, expect, it, vi } from "vitest";
import { withRetry } from "../supabase/functions/_shared/retry";

describe("withRetry", () => {
  it("returns the value on first success", async () => {
    const fn = vi.fn().mockResolvedValue(42);
    await expect(withRetry(fn)).resolves.toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures then succeeds", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("quota")).mockResolvedValue("ok");
    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 1 })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after the attempt limit", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(withRetry(fn, { attempts: 2, baseDelayMs: 1 })).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry errors the predicate rejects", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fatal"));
    await expect(withRetry(fn, { attempts: 3, baseDelayMs: 1, retryable: () => false })).rejects.toThrow("fatal");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

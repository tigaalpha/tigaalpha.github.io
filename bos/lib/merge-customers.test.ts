import { describe, it, expect } from "vitest";
import { findDuplicateCandidates } from "../supabase/functions/_shared/merge-customers";

describe("findDuplicateCandidates", () => {
  it("detects pairs sharing the same phone number", () => {
    const pairs = findDuplicateCandidates([
      { id: "a", name: "สมชาย ใจดี", phone: "081-234-5678", created_at: "2026-01-01T00:00:00Z" },
      { id: "b", name: "สมชาย ใจดี", phone: "0812345678", created_at: "2026-02-01T00:00:00Z" },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ keepId: "a", dupId: "b", matchField: "phone" });
  });

  it("detects pairs sharing the same normalized name", () => {
    const pairs = findDuplicateCandidates([
      { id: "a", name: "Somchai Jaidee", created_at: "2026-01-01T00:00:00Z" },
      { id: "b", name: "somchai jaidee", created_at: "2026-02-01T00:00:00Z" },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ keepId: "a", dupId: "b", matchField: "name" });
  });

  it("does not flag short names or short phone numbers", () => {
    const pairs = findDuplicateCandidates([
      { id: "a", name: "จอย", phone: "0812", created_at: "2026-01-01T00:00:00Z" },
      { id: "b", name: "จอย", phone: "0812", created_at: "2026-02-01T00:00:00Z" },
    ]);
    expect(pairs).toHaveLength(0);
  });

  it("keeps the oldest record as the surviving row", () => {
    const pairs = findDuplicateCandidates([
      { id: "newer", name: "ลภัส ศรีสุข", created_at: "2026-03-01T00:00:00Z" },
      { id: "older", name: "ลภัส ศรีสุข", created_at: "2026-01-01T00:00:00Z" },
    ]);
    expect(pairs[0]!.keepId).toBe("older");
    expect(pairs[0]!.dupId).toBe("newer");
  });

  it("dedupes a pair that matches on both phone and name", () => {
    const pairs = findDuplicateCandidates([
      { id: "a", name: "เหมือน กัน", phone: "0812345678", created_at: "2026-01-01T00:00:00Z" },
      { id: "b", name: "เหมือน กัน", phone: "0812345678", created_at: "2026-02-01T00:00:00Z" },
    ]);
    expect(pairs).toHaveLength(1);
  });
});

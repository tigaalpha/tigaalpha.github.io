import { describe, expect, it } from "vitest";
import { isDormant, overdueStage, isStaleLead, isContentDrought } from "../supabase/functions/_shared/agent-guardian-conditions";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-08-17T00:00:00Z");

describe("isDormant (ลูกค้าเงียบ 30+ วัน)", () => {
  it("true when last booking is older than the window", () => {
    expect(isDormant(NOW - 31 * DAY, NOW)).toBe(true);
  });

  it("false for recent bookings and for missing/unknown timestamps", () => {
    expect(isDormant(NOW - 10 * DAY, NOW)).toBe(false);
    expect(isDormant(null, NOW)).toBe(false);
    expect(isDormant(undefined, NOW)).toBe(false);
    expect(isDormant(Number.NaN, NOW)).toBe(false);
  });

  it("respects a custom window", () => {
    expect(isDormant(NOW - 45 * DAY, NOW, 30)).toBe(true);
    expect(isDormant(NOW - 45 * DAY, NOW, 60)).toBe(false);
  });
});

describe("overdueStage (ขั้นบันไดทวงหนี้ 3/7/14)", () => {
  it("returns null before 3 days", () => {
    expect(overdueStage(0)).toBeNull();
    expect(overdueStage(2)).toBeNull();
  });

  it("escalates 1 → 2 → 3", () => {
    expect(overdueStage(3)).toBe(1);
    expect(overdueStage(6)).toBe(1);
    expect(overdueStage(7)).toBe(2);
    expect(overdueStage(13)).toBe(2);
    expect(overdueStage(14)).toBe(3);
    expect(overdueStage(30)).toBe(3);
  });
});

describe("isStaleLead (lead ค้าง 7+ วัน)", () => {
  it("uses last_contact_at when present", () => {
    expect(isStaleLead(NOW - 8 * DAY, NOW - 30 * DAY, NOW)).toBe(true);
    expect(isStaleLead(NOW - 2 * DAY, NOW - 30 * DAY, NOW)).toBe(false);
  });

  it("falls back to created_at when never contacted", () => {
    expect(isStaleLead(null, NOW - 10 * DAY, NOW)).toBe(true);
    expect(isStaleLead(null, NOW - 2 * DAY, NOW)).toBe(false);
  });

  it("never flags a lead with no timestamps at all", () => {
    expect(isStaleLead(null, null, NOW)).toBe(false);
  });
});

describe("isContentDrought (content แล้ง 7 วัน)", () => {
  it("true only when nothing was published", () => {
    expect(isContentDrought(0)).toBe(true);
    expect(isContentDrought(1)).toBe(false);
    expect(isContentDrought(7)).toBe(false);
  });
});

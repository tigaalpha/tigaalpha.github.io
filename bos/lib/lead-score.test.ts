import { describe, expect, it } from "vitest";
import { computeLeadScore } from "../supabase/functions/_shared/lead-score";

describe("computeLeadScore", () => {
  it("a fresh lead starts low", () => {
    expect(computeLeadScore({ salesStatus: "new_lead", recentMessages30d: 1, activeBookings: 0, paidPayments: 0 })).toBe(16);
  });

  it("status is the dominant signal", () => {
    const interested = computeLeadScore({ salesStatus: "interested", recentMessages30d: 0, activeBookings: 0, paidPayments: 0 });
    const won = computeLeadScore({ salesStatus: "won", recentMessages30d: 0, activeBookings: 0, paidPayments: 0 });
    expect(interested).toBeGreaterThan(10);
    expect(won).toBeGreaterThan(interested);
  });

  it("qualification fields add to the base (0059)", () => {
    const plain = computeLeadScore({ salesStatus: "interested", recentMessages30d: 0, activeBookings: 0, paidPayments: 0 });
    const qualified = computeLeadScore({ salesStatus: "interested", recentMessages30d: 0, activeBookings: 0, paidPayments: 0, hasLearningGoal: true, hasBudget: true });
    expect(qualified).toBe(plain + 15);
  });

  it("activity and payments stack on top of status (capped at 100)", () => {
    const base = computeLeadScore({ salesStatus: "interested", recentMessages30d: 0, activeBookings: 0, paidPayments: 0 });
    const active = computeLeadScore({ salesStatus: "interested", recentMessages30d: 5, activeBookings: 1, paidPayments: 1 });
    expect(active).toBeGreaterThan(base);
    expect(active).toBe(45 + 5 + 10 + 30); // 40 base + 5 recency + bonuses
    expect(computeLeadScore({ salesStatus: "interested", recentMessages30d: 50, activeBookings: 5, paidPayments: 5 })).toBe(100);
  });

  it("stale contacts lose points (0059 recency penalty)", () => {
    const stale = computeLeadScore({ salesStatus: "interested", recentMessages30d: 0, activeBookings: 0, paidPayments: 0, daysSinceContact: 40 });
    expect(stale).toBe(30); // 40 base - 10 penalty
  });

  it("lost leads score zero when they have no activity", () => {
    expect(computeLeadScore({ salesStatus: "lost", recentMessages30d: 0, activeBookings: 0, paidPayments: 0, daysSinceContact: 40 })).toBe(0);
  });
});

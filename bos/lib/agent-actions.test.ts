import { describe, expect, it } from "vitest";
import {
  classifyAgentAction,
  AUTO_EXECUTE_ACTION_TYPES,
  isAgentActionType,
  canAutoExecuteAgentAction,
  AUTONOMY_LEVELS,
  isAutonomyLevel,
} from "../supabase/functions/_shared/agent-actions";

describe("classifyAgentAction", () => {
  it("auto-executes low-risk internal types", () => {
    expect(classifyAgentAction("create_task")).toBe("auto");
    expect(classifyAgentAction("send_notification")).toBe("auto");
    // Drafting content is low-risk too — it lands in the calendar as a draft
    // that still needs the owner's approval before anything is published.
    expect(classifyAgentAction("draft_content")).toBe("auto");
  });

  it("requires approval for customer- and money-facing types", () => {
    expect(classifyAgentAction("send_line")).toBe("approval");
    expect(classifyAgentAction("create_schedule")).toBe("approval");
    expect(classifyAgentAction("update_customer")).toBe("approval");
    expect(classifyAgentAction("send_email")).toBe("approval");
  });

  it("the auto list matches the code's intent exactly", () => {
    expect(AUTO_EXECUTE_ACTION_TYPES).toEqual(["create_task", "send_notification", "draft_content"]);
  });
});

describe("isAgentActionType", () => {
  it("accepts known types and rejects junk", () => {
    expect(isAgentActionType("send_line")).toBe(true);
    expect(isAgentActionType("send_notification")).toBe(true);
    expect(isAgentActionType("draft_content")).toBe(true);
    expect(isAgentActionType("update_customer")).toBe(true);
    expect(isAgentActionType("send_email")).toBe(true);
    expect(isAgentActionType("change_sales_status")).toBe(false);
    expect(isAgentActionType(null)).toBe(false);
    expect(isAgentActionType(42)).toBe(false);
  });
});

describe("canAutoExecuteAgentAction (งาน #1: Autonomy Tier 2)", () => {
  it("base internal types always auto-execute at every tier", () => {
    for (const level of AUTONOMY_LEVELS) {
      expect(canAutoExecuteAgentAction("create_task", level, {})).toBe(true);
      expect(canAutoExecuteAgentAction("send_notification", level, {})).toBe(true);
      expect(canAutoExecuteAgentAction("draft_content", level, {})).toBe(true);
    }
  });

  it("conservative never auto-runs customer/money-facing types", () => {
    expect(canAutoExecuteAgentAction("send_line", "conservative", { customerId: "c1" })).toBe(false);
    expect(canAutoExecuteAgentAction("send_email", "conservative", { email: "a@b.c" })).toBe(false);
    expect(canAutoExecuteAgentAction("update_customer", "conservative", { customerId: "c1" })).toBe(false);
    expect(canAutoExecuteAgentAction("create_schedule", "conservative", {})).toBe(false);
  });

  it("balanced allows email with a recipient and notes-only customer updates", () => {
    expect(canAutoExecuteAgentAction("send_email", "balanced", { email: "a@b.c" })).toBe(true);
    expect(canAutoExecuteAgentAction("send_email", "balanced", { customerId: "c1" })).toBe(true);
    expect(canAutoExecuteAgentAction("send_email", "balanced", {})).toBe(false);
    expect(canAutoExecuteAgentAction("update_customer", "balanced", { customerId: "c1", note: "คุยโทรศัพท์แล้ว" })).toBe(true);
    // sales-status changes stay owner-only below the high tier
    expect(canAutoExecuteAgentAction("update_customer", "balanced", { customerId: "c1", salesStatus: "won" })).toBe(false);
    expect(canAutoExecuteAgentAction("send_line", "balanced", { customerId: "c1" })).toBe(false);
  });

  it("high allows hot-lead LINE sends and sales-status changes", () => {
    expect(canAutoExecuteAgentAction("send_line", "high", { customerId: "c1" })).toBe(true);
    expect(canAutoExecuteAgentAction("send_line", "high", { lineUserId: "U123" })).toBe(true);
    expect(canAutoExecuteAgentAction("send_line", "high", {})).toBe(false); // no way to reach the customer
    expect(canAutoExecuteAgentAction("update_customer", "high", { customerId: "c1", salesStatus: "won" })).toBe(true);
    expect(canAutoExecuteAgentAction("update_customer", "high", { customerId: "c1" })).toBe(true);
    expect(canAutoExecuteAgentAction("send_email", "high", { email: "a@b.c" })).toBe(true);
  });

  it("never auto-runs types outside the tier rules", () => {
    for (const level of AUTONOMY_LEVELS) {
      expect(canAutoExecuteAgentAction("create_schedule", level, {})).toBe(false);
      expect(canAutoExecuteAgentAction("create_schedule", level, { title: "คาบสาธิต" })).toBe(false);
    }
  });
});

describe("isAutonomyLevel", () => {
  it("accepts known levels and rejects junk", () => {
    expect(isAutonomyLevel("conservative")).toBe(true);
    expect(isAutonomyLevel("balanced")).toBe(true);
    expect(isAutonomyLevel("high")).toBe(true);
    expect(isAutonomyLevel("full")).toBe(false);
    expect(isAutonomyLevel(undefined)).toBe(false);
    expect(isAutonomyLevel(42)).toBe(false);
    expect(AUTONOMY_LEVELS).toEqual(["conservative", "balanced", "high"]);
  });
});

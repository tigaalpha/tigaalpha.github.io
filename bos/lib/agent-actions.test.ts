import { describe, expect, it } from "vitest";
import { classifyAgentAction, AUTO_EXECUTE_ACTION_TYPES, isAgentActionType } from "../supabase/functions/_shared/agent-actions";

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

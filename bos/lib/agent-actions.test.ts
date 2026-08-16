import { describe, expect, it } from "vitest";
import { classifyAgentAction, AUTO_EXECUTE_ACTION_TYPES, isAgentActionType } from "../supabase/functions/_shared/agent-actions";

describe("classifyAgentAction", () => {
  it("auto-executes low-risk internal types", () => {
    expect(classifyAgentAction("create_task")).toBe("auto");
    expect(classifyAgentAction("send_notification")).toBe("auto");
  });

  it("requires approval for customer- and money-facing types", () => {
    expect(classifyAgentAction("send_line")).toBe("approval");
    expect(classifyAgentAction("create_schedule")).toBe("approval");
  });

  it("the auto list matches the code's intent exactly", () => {
    expect(AUTO_EXECUTE_ACTION_TYPES).toEqual(["create_task", "send_notification"]);
  });
});

describe("isAgentActionType", () => {
  it("accepts known types and rejects junk", () => {
    expect(isAgentActionType("send_line")).toBe(true);
    expect(isAgentActionType("send_notification")).toBe(true);
    expect(isAgentActionType("change_sales_status")).toBe(false);
    expect(isAgentActionType(null)).toBe(false);
    expect(isAgentActionType(42)).toBe(false);
  });
});

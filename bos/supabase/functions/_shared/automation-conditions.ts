// Pure condition evaluation for automation_rules.conditions -- no Deno API
// calls, so it's its own file (like availability.ts/categories.ts) purely
// so lib/automation-conditions.test.ts can import it straight into vitest.

export type ConditionOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export function evaluateConditions(conditions: Condition[], data: Record<string, unknown>): boolean {
  return conditions.every((condition) => evaluateCondition(condition, data));
}

function evaluateCondition(condition: Condition, data: Record<string, unknown>): boolean {
  const actual = data[condition.field];
  switch (condition.operator) {
    case "eq":
      return actual === condition.value;
    case "neq":
      return actual !== condition.value;
    case "gt":
      return typeof actual === "number" && typeof condition.value === "number" && actual > condition.value;
    case "gte":
      return typeof actual === "number" && typeof condition.value === "number" && actual >= condition.value;
    case "lt":
      return typeof actual === "number" && typeof condition.value === "number" && actual < condition.value;
    case "lte":
      return typeof actual === "number" && typeof condition.value === "number" && actual <= condition.value;
    case "contains":
      return typeof actual === "string" && typeof condition.value === "string" && actual.includes(condition.value);
    default:
      return false;
  }
}

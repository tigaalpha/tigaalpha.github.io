import { describe, expect, it } from "vitest";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from "../features/accounting/categories";
import {
  INCOME_CATEGORIES as AGENT_INCOME_CATEGORIES,
  EXPENSE_CATEGORIES as AGENT_EXPENSE_CATEGORIES,
  PAYMENT_METHODS as AGENT_PAYMENT_METHODS,
} from "../supabase/functions/_shared/categories";

// The Accounting UI (features/accounting/categories.ts) and the TIGA AI
// AGENT's record_transaction tool (supabase/functions/_shared/categories.ts)
// keep separate copies of these lists, because Deno edge functions can't
// import repo files outside supabase/functions at runtime. If they drift,
// the agent could record a transaction with a category the Accounting page
// doesn't recognize (or vice versa) — this test is what actually enforces
// "keep these in sync," not just a comment.
describe("accounting category lists stay in sync with the AI agent's copy", () => {
  it("INCOME_CATEGORIES match", () => {
    expect(AGENT_INCOME_CATEGORIES).toEqual(INCOME_CATEGORIES);
  });

  it("EXPENSE_CATEGORIES match", () => {
    expect(AGENT_EXPENSE_CATEGORIES).toEqual(EXPENSE_CATEGORIES);
  });

  it("PAYMENT_METHODS match", () => {
    expect(AGENT_PAYMENT_METHODS).toEqual(PAYMENT_METHODS);
  });
});

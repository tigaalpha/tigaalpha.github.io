import { describe, expect, it } from "vitest";
import {
  DEPARTMENTS,
  DELEGATE_TO_DEPARTMENT_TOOL,
  CHIEF_OF_STAFF_SLUG,
  departmentBySlug,
} from "../supabase/functions/_shared/departments";

// Chief of Staff acts as CEO: it takes the owner's orders directly and
// dispatches them into other departments' chats via delegate_to_department.
// These tests pin the contract the ai-chat edge function and the AI
// Automation Chat page both rely on.
describe("Chief of Staff → department delegation contract", () => {
  it("registers chief_of_staff and tells it about the delegation tool", () => {
    const cos = DEPARTMENTS.find((d) => d.slug === CHIEF_OF_STAFF_SLUG);
    expect(cos).toBeDefined();
    expect(cos?.systemPrompt).toContain("delegate_to_department");
    expect(cos?.systemPrompt).toContain("เจ้าของ");
  });

  it("offers every other department in the tool enum — no self-delegation", () => {
    const enumSlugs = DELEGATE_TO_DEPARTMENT_TOOL.parameters.properties.department.enum;
    expect(enumSlugs).not.toContain(CHIEF_OF_STAFF_SLUG);
    expect(new Set(enumSlugs)).toEqual(
      new Set(
        DEPARTMENTS.filter((d) => d.slug !== CHIEF_OF_STAFF_SLUG).map((d) => d.slug)
      )
    );
    // The departments the owner specifically commands from the CoS chat.
    expect(enumSlugs).toContain("marketing");
    expect(enumSlugs).toContain("strategy");
    expect(enumSlugs).toContain("sales");
    expect(enumSlugs).toContain("growth");
  });

  it("requires a self-contained directive so target chats need no shared context", () => {
    expect([...DELEGATE_TO_DEPARTMENT_TOOL.parameters.required]).toEqual([
      "department",
      "directive",
    ]);
    expect(DELEGATE_TO_DEPARTMENT_TOOL.parameters.properties.directive.description).toContain(
      "ไม่เห็นบทสนทนาของเจ้าของ"
    );
  });

  it("resolves every registered slug through departmentBySlug", () => {
    for (const dept of DEPARTMENTS) {
      expect(departmentBySlug(dept.slug)?.slug).toBe(dept.slug);
    }
    expect(departmentBySlug("no_such_department")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import {
  DEPARTMENTS,
  DELEGATE_TO_DEPARTMENT_TOOL,
  CHIEF_OF_STAFF_SLUG,
  CREATE_AGENT_TOOL,
  MESSAGE_CHIEF_TOOL,
  allDepartments,
  buildDelegateTool,
  departmentBySlug,
  findDepartment,
  normalizeSlug,
  personaForCustomAgent,
  rosterPrompt,
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

// A tiny stand-in for the Supabase client: only integration_settings reads.
function fakeDb(value: string | null) {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: value === null ? null : { value } }) }) }),
    }),
  };
}

describe("Agents created by the Chief of Staff", () => {
  const stored = JSON.stringify([
    { slug: "review_agent", label: "รีวิวลูกค้า", systemPrompt: "คุณคือเอเจนต์รีวิว" },
    { slug: "marketing", label: "ปลอม", systemPrompt: "ห้ามทับแผนกจริง" },
    { slug: "bad" },
  ]);

  it("merges custom agents after the built-in departments and never overrides a built-in slug", async () => {
    const all = await allDepartments(fakeDb(stored));
    expect(all.slice(0, DEPARTMENTS.length)).toEqual(DEPARTMENTS);
    expect(all.map((d) => d.slug)).toContain("review_agent");
    expect(all.find((d) => d.slug === "marketing")?.label).toBe("การตลาด");
    expect(all.find((d) => d.slug === "bad")).toBeUndefined();
    expect(all.find((d) => d.slug === "review_agent")?.custom).toBe(true);
  });

  it("copes with a missing or broken custom_departments setting", async () => {
    expect((await allDepartments(fakeDb(null))).length).toBe(DEPARTMENTS.length);
    expect((await allDepartments(fakeDb("not json"))).length).toBe(DEPARTMENTS.length);
  });

  it("finds custom agents by slug", async () => {
    expect((await findDepartment(fakeDb(stored), "review_agent"))?.label).toBe("รีวิวลูกค้า");
    expect(await findDepartment(fakeDb(stored), "nope")).toBeUndefined();
    expect((await findDepartment(fakeDb(null), "sales"))?.slug).toBe("sales");
  });

  it("puts custom agents into the delegation enum, still without the Chief of Staff", async () => {
    const all = await allDepartments(fakeDb(stored));
    const tool = buildDelegateTool(all);
    expect(tool.parameters.properties.department.enum).toContain("review_agent");
    expect(tool.parameters.properties.department.enum).not.toContain(CHIEF_OF_STAFF_SLUG);
    expect([...tool.parameters.required]).toEqual(["department", "directive"]);
    expect(rosterPrompt(all)).toContain("review_agent");
  });

  it("makes safe slugs", () => {
    expect(normalizeSlug("Review Agent!!")).toBe("review_agent");
    expect(normalizeSlug("รีวิว")).toBe("");
    expect(normalizeSlug("a".repeat(80)).length).toBe(32);
  });

  it("gives every new agent a persona that can talk upward", () => {
    const persona = personaForCustomAgent("รีวิวลูกค้า", "ตอบรีวิว", "สุภาพ");
    expect(persona).toContain("รีวิวลูกค้า");
    expect(persona).toContain("message_chief_of_staff");
    expect(persona).toContain("สุภาพ");
  });

  it("defines the create-agent and talk-upward tools", () => {
    expect([...CREATE_AGENT_TOOL.parameters.required]).toEqual(["label", "role"]);
    expect([...MESSAGE_CHIEF_TOOL.parameters.required]).toEqual(["message"]);
  });
});

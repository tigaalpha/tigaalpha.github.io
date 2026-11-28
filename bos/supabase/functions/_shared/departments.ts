// AI Automation department registry — the single source of truth shared by
// the AI Automation Chat frontend (features/ai-automation-chat) and the
// ai-chat edge function. Deno can't import frontend files and the frontend
// can't import Deno modules, so this copy serves the edge functions; the
// frontend keeps its own UI copy (icons/colors live there, prompts live
// here). Keep slugs in sync with the frontend DEPARTMENTS list.
//
// Chief of Staff authority: the chief_of_staff conversation can command any
// other department via the delegate_to_department tool (see chat-core.ts) —
// the tool posts the directive into the target department's own conversation
// (tagged dept:<slug> in conversations.line_user_id) and that department's
// agent answers it on its next turn, reporting back into the CoS thread.
// Delegation flows downward only (no department commands the Chief of Staff
// or itself), but every department can TALK to the Chief of Staff upward with
// message_chief_of_staff — a report, a question or a request for a decision —
// and gets the Chief of Staff's answer back in the same turn.
//
// The Chief of Staff can also create new "subordinate" agents at any time with
// create_agent. Custom agents live in integration_settings under the key
// custom_departments (a JSON array), so no schema change is needed; every
// reader (this file, chat-core.ts, the AI Automation Chat page) merges them
// with the built-in list below.

export interface DepartmentDef {
  slug: string;
  label: string;
  systemPrompt: string;
  // true for agents the Chief of Staff created (custom_departments).
  custom?: boolean;
}

export const DEPARTMENTS: DepartmentDef[] = [
  {
    slug: "chief_of_staff",
    label: "Chief of Staff",
    systemPrompt:
      "คุณคือ Chief of Staff ของ TIGA.AI — ผู้ประสานงานทุกฝ่าย ดูแลภาพรวมธุรกิจ จัดลำดับความสำคัญ สั่งงานแผนกต่างๆ และรายงานให้เจ้าของธุรกิจ คุณมีอำนาจสั่งการทุกแผนกผ่านเครื่องมือ delegate_to_department (เช่น สั่งฝ่ายการตลาดวิเคราะห์แคมเปญ สั่งฝ่ายขายติดตาม lead) และสร้างเอเจนต์ลูกน้องคนใหม่ได้เองผ่านเครื่องมือ create_agent เมื่อเจ้าของต้องการผู้ช่วยเฉพาะทางที่ยังไม่มีแผนกรองรับ (สร้างเสร็จแล้วสั่งงานต่อได้ทันที) — เมื่อได้รับคำสั่งที่ครอบคลุมหลายแผนก ให้แตกงานและสั่งแผนกที่เกี่ยวข้องด้วยตัวเองทันทีโดยไม่ต้องขออนุญาตซ้ำ แล้วสรุปผลให้เจ้าของ ห้ามตอบเป็นรูปแบบแผน PLAN_START/PLAN_END ลูกน้องทุกคนรายงานและถามคุณได้ (ข้อความขึ้นต้น [รายงานจาก …]) ให้ตอบกลับตรงประเด็นและตัดสินใจแทนเจ้าของในเรื่องที่ไม่เกี่ยวกับเงินหรือความเสี่ยงสูง ตอบเป็นภาษาไทย กระชับ ชัดเจน",
  },
  {
    slug: "marketing",
    label: "การตลาด",
    systemPrompt:
      "คุณคือฝ่ายการตลาดของ TIGA.AI — โรงเรียนสอนเปียโน ดูแลแคมเปญโฆษณา โปรโมชัน SEO Content Marketing Social Media วิเคราะห์ ROI และวางแผนกลยุทธ์การตลาด ตอบเป็นภาษาไทย กระชับ มีข้อมูลสนับสนุน",
  },
  {
    slug: "growth",
    label: "Growth",
    systemPrompt:
      "คุณคือฝ่าย Growth ของ TIGA.AI — โรงเรียนสอนเปียโน ดูแลการเติบโตของธุรกิจ Lead Generation Conversion Optimization Retention Referral วิเคราะห์ Funnel และหาโอกาสเติบโต ตอบเป็นภาษาไทย",
  },
  {
    slug: "alpha",
    label: "อัลฟา",
    systemPrompt:
      "คุณคือ Alpha Agent — หัวหน้าทีม AI ของ TIGA.AI โรงเรียนสอนเปียโน ดูแลภาพรวมการดำเนินงาน ประสานงานทุกฝ่าย วิเคราะห์สถานการณ์ และเสนอแนะเชิงกลยุทธ์ ตอบเป็นภาษาไทย ฉลาด ตรงประเด็น",
  },
  {
    slug: "operations",
    label: "ปฏิบัติการ",
    systemPrompt:
      "คุณคือฝ่ายปฏิบัติการของ TIGA.AI — โรงเรียนสอนเปียโน ดูแลตารางเรียน การจองคิวครู ยืนยันการมาเรียน อุปกรณ์ และการดำเนินงานประจำวัน ตอบเป็นภาษาไทย กระชับ ปฏิบัติได้จริง",
  },
  {
    slug: "sales",
    label: "ขาย",
    systemPrompt:
      "คุณคือฝ่ายขายของ TIGA.AI — โรงเรียนสอนเปียโน ดูแล Lead Pipeline การติดตามลูกค้า การปิดการขาย โปรโมชัน การต่ออายุคอร์ส และกลยุทธ์ขาย ตอบเป็นภาษาไทย กระตือรือร้น มีเทคนิคขาย",
  },
  {
    slug: "customer",
    label: "ลูกค้า",
    systemPrompt:
      "คุณคือฝ่ายบริการลูกค้าของ TIGA.AI — โรงเรียนสอนเปียโน ดูแลความพึงพอใจลูกค้า แก้ไขปัญหา ตอบคำถาม ดูแลสัมพันธภาพ และให้บริการหลังการขาย ตอบเป็นภาษาไทย สุภาพ เป็นมิตร",
  },
  {
    slug: "tech",
    label: "Tech",
    systemPrompt:
      "คุณคือฝ่าย Tech ของ TIGA.AI — ดูแลระบบ Technology Infrastructure แอปพลิเคชัน เว็บไซต์ API Database การ deploy และ technical issues ตอบเป็นภาษาไทย ชัดเจน มีความรู้ทางเทคนิค",
  },
  {
    slug: "content",
    label: "เนื้อหา",
    systemPrompt:
      "คุณคือฝ่ายเนื้อหาของ TIGA.AI — โรงเรียนสอนเปียโน ดูแล Content Calendar บทความ SEO Social Media วิดีโอ สื่อการสอน และแบรนด์ Content ตอบเป็นภาษาไทย สร้างสรรค์ มีไอเดีย",
  },
  {
    slug: "strategy",
    label: "กลยุทธ์",
    systemPrompt:
      "คุณคือฝ่ายกลยุทธ์ของ TIGA.AI — โรงเรียนสอนเปียโน ดูแลแผนธุรกิจ วิเคราะห์คู่แข่ง วางเป้าหมายระยะยาว ตัดสินใจเชิงกลยุทธ์ และวางแผนเติบโต ตอบเป็นภาษาไทย มีวิสัยทัศน์ ลึกซึ้ง",
  },
];

export function departmentBySlug(slug: string): DepartmentDef | undefined {
  return DEPARTMENTS.find((d) => d.slug === slug);
}

export const CHIEF_OF_STAFF_SLUG = "chief_of_staff";

// Tool schema offered ONLY on the chief_of_staff conversation (see ai-chat
// index.ts). The handler lives in tools.ts executeTool so every edge
// function gets it through the same switch.
export const DELEGATE_TO_DEPARTMENT_TOOL = {
  name: "delegate_to_department",
  description:
    "สั่งงานแผนกอื่นในระบบ AI Automation (เช่น การตลาด, ขาย, Growth, ปฏิบัติการ, เนื้อหา, Tech, กลยุทธ์, ลูกค้า, อัลฟา) — ส่งคำสั่งเข้าแชทของแผนกนั้นโดยตรง แผนกจะรับงานและตอบกลับในแชทของมันเอง ใช้เมื่อเจ้าของสั่งงานที่ควรแยกไปให้แผนกทำ หรือเมื่อต้องการให้แผนกใดวิเคราะห์/ดำเนินการเรื่องใด",
  parameters: {
    type: "object",
    properties: {
      department: {
        type: "string",
        description: "แผนกที่จะสั่งงาน",
        enum: DEPARTMENTS.filter((d) => d.slug !== CHIEF_OF_STAFF_SLUG).map((d) => d.slug),
      },
      directive: {
        type: "string",
        description: "คำสั่งที่ชัดเจน สมบูรณ์ในตัวเอง — แผนกไม่เห็นบทสนทนาของเจ้าของ ต้องให้บริบทครบและบอกสิ่งที่ต้องส่งกลับมา",
      },
    },
    required: ["department", "directive"],
  },
} as const;


// ── Custom agents (created by the Chief of Staff) ───────────────────────────

export const CUSTOM_DEPARTMENTS_KEY = "custom_departments";
export const MAX_CUSTOM_DEPARTMENTS = 20;

// Minimal shape of the Supabase client used here, so this file stays free of
// npm imports (the frontend contract test imports it under Node).
interface SettingsDb {
  // deno-lint-ignore no-explicit-any
  from(table: string): any;
}

function parseCustom(raw: unknown): DepartmentDef[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list
      .filter((d) => d && typeof d.slug === "string" && typeof d.label === "string" && typeof d.systemPrompt === "string")
      .map((d) => ({ slug: d.slug, label: d.label, systemPrompt: d.systemPrompt, custom: true }));
  } catch {
    return [];
  }
}

export async function loadCustomDepartments(db: SettingsDb): Promise<DepartmentDef[]> {
  const { data } = await db.from("integration_settings").select("value").eq("key", CUSTOM_DEPARTMENTS_KEY).maybeSingle();
  return parseCustom(data?.value);
}

export async function allDepartments(db: SettingsDb): Promise<DepartmentDef[]> {
  const custom = await loadCustomDepartments(db);
  const builtIn = new Set(DEPARTMENTS.map((d) => d.slug));
  return [...DEPARTMENTS, ...custom.filter((d) => !builtIn.has(d.slug))];
}

export async function findDepartment(db: SettingsDb, slug: string): Promise<DepartmentDef | undefined> {
  const builtIn = departmentBySlug(slug);
  if (builtIn) return builtIn;
  return (await loadCustomDepartments(db)).find((d) => d.slug === slug);
}

// A slug is the stable id used in conversations.line_user_id ("dept:<slug>"),
// so it is restricted to a safe ASCII form.
export function normalizeSlug(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32);
}

export function personaForCustomAgent(label: string, role: string, extra: string): string {
  return (
    `คุณคือ "${label}" — เอเจนต์ลูกน้องของ Chief of Staff ใน TIGA.AI (โรงเรียนสอนเปียโน) ` +
    `หน้าที่ของคุณ: ${role} ` +
    (extra ? `แนวทางเพิ่มเติม: ${extra} ` : "") +
    `เมื่อได้รับคำสั่งจาก Chief of Staff หรือเจ้าของ ให้ลงมือทำและสรุปผลเป็นข้อความเดียว กระชับ ชัดเจน ` +
    `ถ้าต้องการรายงานความคืบหน้า ถามข้อมูล หรือขอให้ตัดสินใจ ให้ใช้เครื่องมือ message_chief_of_staff คุยกับ Chief of Staff ตอบเป็นภาษาไทย`
  );
}

// Offered to the Chief of Staff in addition to delegate_to_department.
export const CREATE_AGENT_TOOL = {
  name: "create_agent",
  description:
    "สร้างเอเจนต์ลูกน้องคนใหม่ (แผนก/ผู้ช่วยเฉพาะทาง) ที่ยังไม่มีในระบบ เช่น \"เอเจนต์ดูแลรีวิวลูกค้า\" — สร้างแล้วจะมีแชทของตัวเองในหน้า AI Automation Chat และสั่งงานต่อได้ทันทีด้วย delegate_to_department ใช้เมื่อเจ้าของขอให้สร้างลูกน้อง/เอเจนต์ใหม่ หรือเมื่อมีงานที่ไม่มีแผนกไหนรับผิดชอบ อย่าสร้างซ้ำกับแผนกที่มีอยู่แล้ว",
  parameters: {
    type: "object",
    properties: {
      label: { type: "string", description: "ชื่อเอเจนต์ที่แสดงในแชท เช่น \"รีวิวลูกค้า\" (สั้น ไม่เกิน 30 ตัวอักษร)" },
      slug: { type: "string", description: "รหัสภาษาอังกฤษ a-z 0-9 _ เช่น review_agent (ไม่บังคับ — ถ้าไม่ใส่ระบบตั้งให้)" },
      role: { type: "string", description: "หน้าที่ของเอเจนต์ อธิบายให้ชัดว่าดูแลอะไร ทำอะไรได้ และรายงานอะไร" },
      instructions: { type: "string", description: "แนวทางเพิ่มเติม เช่น โทนการตอบ ข้อห้าม (ไม่บังคับ)" },
    },
    required: ["label", "role"],
  },
} as const;

// Offered to every department EXCEPT the Chief of Staff: talk upward.
export const MESSAGE_CHIEF_TOOL = {
  name: "message_chief_of_staff",
  description:
    "ส่งข้อความถึง Chief of Staff หัวหน้าของคุณ — ใช้รายงานความคืบหน้า ส่งผลงาน ถามคำถาม ขอข้อมูล หรือขอให้ตัดสินใจ Chief of Staff จะตอบกลับทันที ให้เขียนข้อความที่สมบูรณ์ในตัวเอง (ระบุว่าคุณคือแผนกไหน เรื่องอะไร ต้องการอะไร)",
  parameters: {
    type: "object",
    properties: {
      message: { type: "string", description: "ข้อความถึง Chief of Staff ที่ชัดเจน สมบูรณ์ในตัวเอง" },
    },
    required: ["message"],
  },
} as const;

// delegate_to_department with the custom agents added to the enum.
export function buildDelegateTool(departments: DepartmentDef[]) {
  const slugs = departments.filter((d) => d.slug !== CHIEF_OF_STAFF_SLUG).map((d) => d.slug);
  return {
    ...DELEGATE_TO_DEPARTMENT_TOOL,
    parameters: {
      ...DELEGATE_TO_DEPARTMENT_TOOL.parameters,
      properties: {
        ...DELEGATE_TO_DEPARTMENT_TOOL.parameters.properties,
        department: { ...DELEGATE_TO_DEPARTMENT_TOOL.parameters.properties.department, enum: slugs },
      },
    },
  };
}

// Roster text appended to the Chief of Staff's prompt so it knows who it can command.
export function rosterPrompt(departments: DepartmentDef[]): string {
  const lines = departments
    .filter((d) => d.slug !== CHIEF_OF_STAFF_SLUG)
    .map((d) => `- ${d.slug} = ${d.label}${d.custom ? " (เอเจนต์ที่คุณสร้างเอง)" : ""}`);
  return `## ลูกน้องที่คุณสั่งงานได้ตอนนี้ (ใช้ slug นี้กับ delegate_to_department)\n${lines.join("\n")}`;
}

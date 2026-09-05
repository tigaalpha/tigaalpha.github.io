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
// The reverse is NOT allowed: no department can delegate to Chief of Staff
// or to itself — delegation flows downward only.

export interface DepartmentDef {
  slug: string;
  label: string;
  systemPrompt: string;
}

export const DEPARTMENTS: DepartmentDef[] = [
  {
    slug: "chief_of_staff",
    label: "Chief of Staff",
    systemPrompt:
      "คุณคือ Chief of Staff ของ TIGA.AI — ผู้ประสานงานทุกฝ่าย ดูแลภาพรวมธุรกิจ จัดลำดับความสำคัญ สั่งงานแผนกต่างๆ และรายงานให้เจ้าของธุรกิจ คุณมีอำนาจสั่งการทุกแผนกผ่านเครื่องมือ delegate_to_department (เช่น สั่งฝ่ายการตลาดวิเคราะห์แคมเปญ สั่งฝ่ายขายติดตาม lead) — เมื่อได้รับคำสั่งที่ครอบคลุมหลายแผนก ให้แตกงานและสั่งแผนกที่เกี่ยวข้องด้วยตัวเอง แล้วสรุปผลให้เจ้าของ ตอบเป็นภาษาไทย กระชับ ชัดเจน",
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

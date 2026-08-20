import type { Database, SalesStatus } from "@/types/database";

export const SALES_STATUSES: SalesStatus[] = [
  "new_lead", "contacted", "qualified", "interested", "trial_booked", "trial_completed",
  "negotiating", "waiting_decision", "won", "lost", "renew_pending", "renewed",
];

// Accept a few header spellings so an owner's existing spreadsheet (Thai or
// English column names) usually works without editing it first.
export const HEADER_ALIASES: Record<string, string> = {
  name: "name", ชื่อ: "name", "ชื่อนักเรียน": "name",
  phone: "phone", เบอร์: "phone", "เบอร์โทร": "phone", "เบอร์โทรศัพท์": "phone",
  age: "age", อายุ: "age",
  learning_goal: "learning_goal", goal: "learning_goal", เป้าหมาย: "learning_goal",
  budget: "budget", งบประมาณ: "budget",
  experience_level: "experience_level", experience: "experience_level", ประสบการณ์: "experience_level",
  preferred_schedule: "preferred_schedule", schedule: "preferred_schedule", ตาราง: "preferred_schedule",
  practice_frequency: "practice_frequency",
  parent_name: "parent_name", "ชื่อผู้ปกครอง": "parent_name",
  parent_phone: "parent_phone", "เบอร์ผู้ปกครอง": "parent_phone",
  sales_status: "sales_status", status: "sales_status", สถานะ: "sales_status",
  lead_source: "lead_source", source: "lead_source", ช่องทาง: "lead_source",
  notes: "notes", note: "notes", หมายเหตุ: "notes",
};

export type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];

export interface ParsedRow {
  data: CustomerInsert;
  error?: string;
}

export function toRows(records: Record<string, string>[]): ParsedRow[] {
  return records.map((record) => {
    const mapped: Record<string, string> = {};
    for (const [key, value] of Object.entries(record)) {
      const field = HEADER_ALIASES[key];
      if (field && value) mapped[field] = value;
    }

    if (!mapped.name) {
      return { data: { name: "" }, error: "ไม่มีชื่อ (name) — ข้ามแถวนี้" };
    }

    const status = mapped.sales_status?.toLowerCase().replace(/\s+/g, "_") as SalesStatus | undefined;
    const data: CustomerInsert = {
      name: mapped.name,
      phone: mapped.phone || null,
      age: mapped.age ? Number(mapped.age) || null : null,
      learning_goal: mapped.learning_goal || null,
      budget: mapped.budget || null,
      experience_level: mapped.experience_level || null,
      preferred_schedule: mapped.preferred_schedule || null,
      practice_frequency: mapped.practice_frequency || null,
      parent_name: mapped.parent_name || null,
      parent_phone: mapped.parent_phone || null,
      sales_status: status && SALES_STATUSES.includes(status) ? status : "new_lead",
      lead_source: mapped.lead_source || "CSV Import",
      notes: mapped.notes || null,
    };

    return { data };
  });
}

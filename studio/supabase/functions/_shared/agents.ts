// The agent registry: developer-defined roles, not owner-editable (same
// style as CHAT_MODELS/PROMPTS -- a plain array in code, not a DB table).
// Scoped to 4 agents that map directly to real CRM data rather than the
// full ~16-department roster in the Level 4 checklist (Coding/QA/SEO/
// Research agents have no real consumer in this app). Adding a 5th agent
// later is a new entry here + one task-runner in agent-tasks.ts, not new
// infrastructure.

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
}

export const AGENTS: AgentDefinition[] = [
  { id: "sales", name: "Sales Agent", role: "วิเคราะห์ sales pipeline, lead score, conversion, lost reasons" },
  { id: "marketing", name: "Marketing Agent", role: "วิเคราะห์ช่องทางการตลาด, เทรนด์, และเนื้อหาที่มีอยู่" },
  { id: "finance", name: "Finance Agent", role: "วิเคราะห์รายรับ-รายจ่าย, cash flow, ต้นทุน" },
  { id: "content", name: "Content Agent", role: "วิเคราะห์คอนเทนต์/ปฏิทินเนื้อหา, บทความ, สคริปต์ และผลงานที่ผลิตได้" },
  { id: "ops", name: "Ops Agent", role: "วิเคราะห์สุขภาพระบบ: งานอัตโนมัติ, cron, แจ้งเตือน, ความผิดพลาด และงานค้าง" },
  { id: "research", name: "Research Agent", role: "วิเคราะห์ความรู้ในระบบ (knowledge base), นโยบายบริษัท และข้อมูลคู่แข่ง" },
  { id: "business_analyst", name: "Business Analyst Agent", role: "หา pattern/anomaly ข้ามแผนก จากรายงานและ automation ที่ผ่านมา" },
];

export function isKnownAgentId(id: string): boolean {
  return AGENTS.some((a) => a.id === id);
}

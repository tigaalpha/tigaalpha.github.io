// Model tier routing (cost optimization): instead of one model for every
// AI call in the app, work is split into three tiers so the owner can put
// a cheap model on high-volume work (customer chat) and spend a strong
// model only where it matters (agent strategy). Pure functions here so the
// frontend (lib/model-tiers.test.ts mirrors) and backend share the same
// rules.

export type ModelTier = "chat" | "agent" | "content";

// Setting keys per tier. Each falls back to the legacy master
// ai_chat_model, then to the built-in default.
export const MODEL_TIER_SETTING_KEYS: Record<ModelTier, string> = {
  chat: "ai_model_chat",
  agent: "ai_model_agent",
  content: "ai_model_content",
};

export const MASTER_MODEL_SETTING_KEY = "ai_chat_model";

export const DEFAULT_MODEL_ID = "gemini";

export const TIER_LABELS: Record<ModelTier, string> = {
  chat: "แชทลูกค้า (LINE/เว็บ/Messenger)",
  agent: "TIGA AI Agent (CEO + Specialist)",
  content: "สร้างคอนเทนต์ (บทความ/สคริปต์/โฆษณา)",
};

// Resolve which model id a tier should use given the owner's stored
// settings. Pure: `tierValue` is the ai_model_<tier> row, `masterValue`
// the legacy ai_chat_model row. Returns a valid id from `validIds` or the
// fallback — never an arbitrary string.
export function resolveTierModelId(
  tier: ModelTier,
  settings: { tierValue?: string | null; masterValue?: string | null },
  validIds: readonly string[],
  fallback: string = DEFAULT_MODEL_ID
): string {
  if (settings.tierValue && validIds.includes(settings.tierValue)) return settings.tierValue;
  if (settings.masterValue && validIds.includes(settings.masterValue)) return settings.masterValue;
  return fallback;
}

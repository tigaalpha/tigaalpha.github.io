import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type PromptName =
  | "system"
  | "sales"
  | "booking"
  | "calendar"
  | "knowledge"
  | "customer_service"
  | "renewal"
  | "owner";

const promptCache = new Map<PromptName, string>();
const PROMPTS_DIR = path.join(process.cwd(), "prompts");

async function loadPrompt(name: PromptName): Promise<string> {
  const cached = promptCache.get(name);
  if (cached) return cached;

  const content = await readFile(path.join(PROMPTS_DIR, `${name}.md`), "utf-8");
  promptCache.set(name, content);
  return content;
}

/**
 * Owner-editable prompts live as markdown files, never inline in source code,
 * so the owner can teach/correct the AI without a deploy (see PRD "AI Training").
 */
export async function buildSystemPrompt(context: PromptName[]): Promise<string> {
  const names: PromptName[] = ["system", ...context.filter((n) => n !== "system")];
  const sections = await Promise.all(names.map((name) => loadPrompt(name)));
  return sections.join("\n\n");
}

export function clearPromptCache(): void {
  promptCache.clear();
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { jsonResponse } from "../_shared/cors.ts";
import { checkCronSecret } from "../_shared/cron-auth.ts";
import { generate } from "../_shared/ai-provider.ts";
import { logAiUsage } from "../_shared/usage-logging.ts";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "../_shared/categories.ts";
import { logSystemEvent } from "../_shared/monitor.ts";

// Feature #8 — auto-categorize money. Daily cron: transactions whose
// category is missing or the catch-all "อื่นๆ" are handed to the LLM with
// their description, which picks the closest real category from the same
// lists the Accounting page uses. Keeps the category breakdown on the
// Accounting page honest without any manual data entry. Only touches
// transactions that genuinely need it (null / "อื่นๆ" / "รายได้อื่นๆ" /
// "ค่าใช้จ่ายอื่นๆ") — never overwrites a category the owner already chose.
const GENERIC_CATEGORIES = new Set(["อื่นๆ", "รายได้อื่นๆ", "ค่าใช้จ่ายอื่นๆ"]);

// The model often drops the suffix of a compound category ("การตลาด"
// instead of "การตลาด/โฆษณา") — match on the part before "/" with a
// contains fallback, never invent a new category.
function matchCategory(chosen: string, valid: string[]): string | null {
  const head = (c: string) => c.split("/")[0].trim();
  const exact = valid.find((v) => v === chosen);
  if (exact) return exact;
  const byHead = valid.find((v) => head(v) === head(chosen));
  if (byHead) return byHead;
  const byContains = valid.find((v) => v.includes(chosen) || chosen.includes(v));
  return byContains ?? null;
}

const CATEGORIZE_PROMPT = (type: string, description: string, amount: number) =>
  [
    "จัดหมวดหมู่รายการเงินของโรงเรียนสอนเปียโนให้ตรงที่สุด ตอบแค่ชื่อหมวดเดียว",
    `ประเภทรายการ: ${type === "income" ? "รายรับ" : "รายจ่าย"}`,
    `รายละเอียด: ${description || "(ไม่มีคำอธิบาย)"}`,
    `จำนวน: ${amount.toLocaleString("th-TH")} บาท`,
    `ตัวเลือกสำหรับรายรับ: ${INCOME_CATEGORIES.join(", ")}`,
    `ตัวเลือกสำหรับรายจ่าย: ${EXPENSE_CATEGORIES.join(", ")}`,
    "ตอบเพียงชื่อหมวดที่เลือกเท่านั้น ไม่มีอย่างอื่น",
  ].join("\n");

Deno.serve(async (req: Request) => {
  const preflight = req.method === "OPTIONS" ? jsonResponse({}, 200) : null;
  if (preflight) return preflight;

  const admin = createAdminClient();
  if (!(await checkCronSecret(admin, req))) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    // Recent window: only look at the last 90 days, so ancient manually
    // imported rows aren't silently re-labeled.
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: rows, error } = await admin
      .from("transactions")
      .select("id, type, category, description, amount")
      .gte("transaction_date", since)
      .order("transaction_date", { ascending: false })
      .limit(100);
    if (error) throw error;

    const candidates = (rows ?? []).filter((t) => !t.category || GENERIC_CATEGORIES.has(t.category));

    let categorized = 0;
    const skipped: string[] = [];
    for (const t of candidates as { id: string; type: string; category?: string | null; description?: string | null; amount: number }[]) {
      const type = t.type === "income" ? "income" : "expense";
      const valid = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
      try {
        const result = await generate([{ role: "user", content: CATEGORIZE_PROMPT(type, t.description ?? "", Number(t.amount)) }], undefined, 0.1, 100);
        await logAiUsage(admin, result.usage, "categorize-transactions");
        const chosen = (result.message.content ?? "").trim().replace(/^["']|["']$/g, "");
        const matched = matchCategory(chosen, valid);
        if (!matched) {
          skipped.push(chosen || "(ว่าง)");
          continue;
        }
        const { error: upErr } = await admin.from("transactions").update({ category: matched, updated_at: new Date().toISOString() }).eq("id", t.id);
        if (upErr) throw upErr;
        categorized += 1;
      } catch (e) {
        await logSystemEvent(admin, "categorize-transactions", "error", `row ${t.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (categorized > 0) await logSystemEvent(admin, "categorize-transactions", "info", `categorized ${categorized}`);
    return jsonResponse({ scanned: (rows ?? []).length, candidates: candidates.length, categorized, skipped: skipped.slice(0, 5) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logSystemEvent(admin, "categorize-transactions", "error", message);
    return jsonResponse({ error: message }, 500);
  }
});

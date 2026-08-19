import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { generate, embed } from "../_shared/ai-provider.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logSystemEvent, handleUnexpectedError } from "../_shared/monitor.ts";
import { logAiUsage } from "../_shared/usage-logging.ts";

// AI-drafted only — not a substitute for actual legal review. Every
// document this produces is prefixed with a disclaimer, and the frontend
// (features/legal/components/legal-document-manager.tsx) shows the same
// warning prominently before anyone can copy/print it.
const DISCLAIMER =
  "*** เอกสารฉบับร่างจาก AI — ยังไม่ผ่านการตรวจสอบทางกฎหมาย กรุณาให้ทนายความตรวจสอบก่อนนำไปใช้งานจริงกับลูกค้า ***\n\n";

const PROMPTS: Record<string, string> = {
  enrollment_contract: `Draft a Thai-language piano lesson enrollment contract (สัญญาลงทะเบียนเรียนเปียโน) for Tiga Studio, grounded in the Knowledge Base for pricing/policies — never invent terms not backed by it. Include: parties (school + student/parent), course details (hours, price, payment terms), lesson policies (rescheduling, cancellation, refund — only if stated in the knowledge base, otherwise leave as a placeholder for the owner to fill in), duration, and signature blocks for both parties with date fields. Plain formal Thai, structured with numbered clauses.`,
  parental_consent: `Draft a Thai-language parental consent form (หนังสือยินยอมผู้ปกครอง) for a minor student enrolling in piano lessons at Tiga Studio. Include: student's name/age (as blank fields to fill in), parent/guardian consent statement, acknowledgment of lesson policies, emergency contact fields, and a signature block with date. Plain formal Thai.`,
};

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    await enforceRateLimit(admin, userId, "generate-legal-document", { windowMinutes: 60, maxRequests: 10 });

    const { type, customerId, variables } = await req.json();
    if (!type || !PROMPTS[type]) return jsonResponse({ error: "type must be 'enrollment_contract' or 'parental_consent'" }, 400);

    let customerContext = "";
    if (customerId) {
      const { data: customer } = await admin.from("customers").select("name, phone").eq("id", customerId).maybeSingle();
      if (customer) customerContext = `\nStudent/customer on file: ${customer.name}${customer.phone ? `, phone ${customer.phone}` : ""}`;
    }

    const embedding = await embed(type === "enrollment_contract" ? "pricing course policies enrollment" : "policies student age minor");
    const { data: matches } = await admin.rpc("match_knowledge_chunks", { query_embedding: embedding, match_count: 6, min_similarity: 0.4 });
    const knowledgeContext = (matches ?? []).length
      ? (matches as { content: string }[]).map((m, i) => `[${i + 1}] ${m.content}`).join("\n\n")
      : "No matching knowledge base entries — leave pricing/policy specifics as [กรอกข้อมูล] placeholders rather than inventing them.";

    const extraVariables = variables && typeof variables === "object" ? JSON.stringify(variables) : "{}";

    const result = await generate(
      [
        {
          role: "system",
          content: `${PROMPTS[type]}\n\n## Business knowledge base (ground all facts in this — never invent)\n${knowledgeContext}`,
        },
        {
          role: "user",
          content: `Draft the document now.${customerContext}\nAdditional details provided: ${extraVariables}\n\nReturn only the document body in Thai, plain text/Markdown, no preamble or explanation.`,
        },
      ],
      undefined,
      0.4,
      3000,
      "content"
    );
    await logAiUsage(admin, result.usage, "generate-legal-document");

    const content = DISCLAIMER + result.message.content.trim();

    const { data: document, error: insertError } = await admin
      .from("legal_documents")
      .insert({
        type,
        customer_id: customerId ?? null,
        content,
        variables: variables ?? {},
        created_by: userId,
      })
      .select("*")
      .single();
    if (insertError) throw insertError;

    return jsonResponse({ document }, 201);
  } catch (error) {
    if (error instanceof RateLimitError) {
      await logSystemEvent(admin, "generate-legal-document", "warning", error.message);
      return jsonResponse({ error: error.message }, 429);
    }
    return await handleUnexpectedError(admin, "generate-legal-document", error);
  }
});

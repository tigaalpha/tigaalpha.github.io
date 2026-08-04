import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { requireStaff } from "../_shared/auth.ts";
import { jsonResponse, handleOptions } from "../_shared/cors.ts";
import { enforceRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { logSystemEvent } from "../_shared/monitor.ts";
import { PROMPTS } from "../_shared/prompts.ts";
import { STRATEGY_MODELS, availableStrategyModels, callStrategyModel, type StrategyModelId } from "../_shared/strategy-models.ts";
import type { SimpleChatMessage } from "../_shared/openai-compatible.ts";

interface StrategyMessageRow {
  role: "user" | "ai";
  model: string | null;
  content: string;
}

function modelLabel(id: string): string {
  return STRATEGY_MODELS.find((m) => m.id === id)?.label ?? id;
}

// Every real chat API only has one "assistant" role -- to give each model
// visibility into what its peers already said this session, prior AI turns
// are linearized as assistant messages prefixed with the model's label
// rather than modeled as separate participants.
function toConversation(history: StrategyMessageRow[]): SimpleChatMessage[] {
  return history.map((m) =>
    m.role === "user"
      ? { role: "user", content: m.content }
      : { role: "assistant", content: `[${modelLabel(m.model ?? "")}] ${m.content}` }
  );
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  const admin = createAdminClient();

  try {
    const userId = await requireStaff(admin, req);
    // One turn can fan out to up to 7 paid provider calls -- a tighter
    // window than the other AI-backed functions.
    await enforceRateLimit(admin, userId, "strategy-ask", { windowMinutes: 60, maxRequests: 20 });

    const { sessionId, prompt, models } = await req.json();
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return jsonResponse({ error: "prompt is required" }, 400);
    }
    if (!Array.isArray(models) || models.length === 0) {
      return jsonResponse({ error: "Select at least one AI model." }, 400);
    }

    const available = availableStrategyModels();
    const availableIds = new Set(available.map((m) => m.id));
    const requested = (models as string[]).filter((m): m is StrategyModelId => availableIds.has(m as StrategyModelId));
    const unavailable = (models as string[]).filter((m) => !availableIds.has(m as StrategyModelId));
    if (requested.length === 0) {
      return jsonResponse({ error: "None of the selected models have an API key configured yet." }, 400);
    }

    let currentSessionId = typeof sessionId === "string" && sessionId ? sessionId : null;
    if (!currentSessionId) {
      const { data: session, error: sessionError } = await admin
        .from("strategy_sessions")
        .insert({ title: prompt.trim().slice(0, 80), created_by: userId })
        .select("id")
        .single();
      if (sessionError) throw sessionError;
      currentSessionId = session.id;
    }

    const { data: historyRows, error: historyError } = await admin
      .from("strategy_messages")
      .select("role, model, content")
      .eq("session_id", currentSessionId)
      .order("created_at", { ascending: true });
    if (historyError) throw historyError;

    const { error: insertUserError } = await admin
      .from("strategy_messages")
      .insert({ session_id: currentSessionId, role: "user", model: null, content: prompt.trim() });
    if (insertUserError) throw insertUserError;

    const conversation: SimpleChatMessage[] = [
      { role: "system", content: PROMPTS.strategy_advisor },
      ...toConversation((historyRows ?? []) as StrategyMessageRow[]),
      { role: "user", content: prompt.trim() },
    ];

    const settled = await Promise.allSettled(requested.map((modelId) => callStrategyModel(modelId, conversation)));

    const responses: Array<{ model: string; content?: string; error?: string }> = [];
    for (let i = 0; i < requested.length; i++) {
      const modelId = requested[i]!;
      const result = settled[i]!;
      if (result.status === "fulfilled") {
        const { error: insertAiError } = await admin
          .from("strategy_messages")
          .insert({ session_id: currentSessionId, role: "ai", model: modelId, content: result.value });
        if (insertAiError) throw insertAiError;
        responses.push({ model: modelId, content: result.value });
      } else {
        const message = result.reason instanceof Error ? result.reason.message : "Unknown error";
        await logSystemEvent(admin, "strategy-ask", "warning", `${modelId}: ${message}`);
        responses.push({ model: modelId, error: message });
      }
    }
    for (const modelId of unavailable) {
      responses.push({ model: modelId, error: "API key not configured for this model." });
    }

    await admin.from("strategy_sessions").update({ updated_at: new Date().toISOString() }).eq("id", currentSessionId);

    return jsonResponse({ sessionId: currentSessionId, responses });
  } catch (error) {
    if (error instanceof RateLimitError) {
      await logSystemEvent(admin, "strategy-ask", "warning", error.message);
      return jsonResponse({ error: error.message }, 429);
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    await logSystemEvent(admin, "strategy-ask", "error", message);
    return jsonResponse({ error: message }, 500);
  }
});

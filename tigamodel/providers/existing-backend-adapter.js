/* ── tigamodel/providers/existing-backend-adapter.js ──
   Phase 0's first REAL provider: it does not talk to any foundation-model
   vendor directly — it calls the app's existing `piano-chat` Supabase edge
   function, which is ALREADY the production per-feature model router
   (providers anthropic/gemini/deepseek/openrouter + fallback ladder +
   admin-configurable per-feature model via app_settings.ai_models).

   Why this adapter exists (spec §5 "อย่าสร้างซ้ำสิ่งที่มีอยู่"):
   - TIGA gains immediate multi-provider routing with zero new secrets and
     zero new server code.
   - When a dedicated TIGA routing path appears later (e.g. OpenRouter
     multi-model, self-host), a new adapter joins the registry — this file
     is untouched.

   Wire format (from supabase/functions/piano-chat/index.ts, source of truth):
   POST { message, conversationHistory, system, stream:false, feature }
   → 200 { text } (the stream:false simple path).

   The access token is injected by the app (ai-backend.ts keeps it fresh via
   the auth listener). In Phase 0 this module is intentionally NOT imported
   by the app bundle — it is used by tests and, from Phase 1, by the
   coach-tip/practice-plan wiring. ── */

import { makeTIGAResponse } from "../core/schema.js";

const DEFAULT_ENDPOINT = "https://gsaqgbracxnucdmtmcxz.supabase.co/functions/v1/piano-chat";
// anon key is PUBLIC by design (ships in every bundle); per-user JWT is what
// actually gates this function (see its header comment).
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzYXFnYnJhY3hudWNkbXRtY3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MTM1MzAsImV4cCI6MjA5NzM4OTUzMH0.vwhXn9usX4YRJdGEL8VU-E86mYfg6mZQbjkernMNXT4";

export function createExistingBackendAdapter({ endpoint = DEFAULT_ENDPOINT, accessToken = null, fetchImpl = (typeof fetch !== "undefined" ? fetch : null) } = {}) {
  if (!fetchImpl) {
    // Node smoke-test env without global fetch: declare() still works,
    // complete() will return an error response instead of throwing.
    fetchImpl = null;
  }
  return {
    declare() {
      return {
        taskTypes: ["chat", "diagnose", "coach-tip", "weekly-report", "practice-plan", "lesson-plan", "exercise", "feedback"],
        cost: "medium", // actual model depends on admin's ai_models config upstream
        latency: "medium",
        privacy: "cloud",
        modalities: ["text"],
      };
    },
    async complete(tigaRequest, { signal } = {}) {
      if (!fetchImpl) return makeTIGAResponse({ traceId: tigaRequest.trace_id, status: "error", text: "", metadata: { reason: "no_fetch" } });
      try {
        const res = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + (accessToken || ANON_KEY),
            apikey: ANON_KEY,
          },
          body: JSON.stringify({
            message: tigaRequest.message,
            conversationHistory: tigaRequest.history,
            system: (tigaRequest.options && tigaRequest.options.system) || "",
            stream: false,
            feature: tigaRequest.task_type === "chat" ? "chat" : tigaRequest.task_type,
          }),
          signal,
        });
        if (!res.ok) {
          return makeTIGAResponse({ traceId: tigaRequest.trace_id, status: "error", metadata: { http: res.status } });
        }
        const data = await res.json().catch(() => null);
        const text = data && typeof data.text === "string" ? data.text : "";
        if (!text) return makeTIGAResponse({ traceId: tigaRequest.trace_id, status: "error", metadata: { reason: "empty_text" } });
        return makeTIGAResponse({
          traceId: tigaRequest.trace_id,
          text,
          provider: "existing-backend",
          model: data.model || null,
          status: "ok",
        });
      } catch (e) {
        return makeTIGAResponse({ traceId: tigaRequest.trace_id, status: "error", metadata: { reason: String((e && e.name) || "fetch_failed") } });
      }
    },
  };
}

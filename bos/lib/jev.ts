/* ── bos/lib/jev.ts — TypeSafe Jev judgment client for TIGA AUTOMATION ──
   Typed judgments (Choice / Score / Noul) for the automation workspace:
   routing customer messages, scoring urgency, verifying claims. Calls go
   through the shared `jev-judge` Supabase edge function with the signed-in
   user's JWT — the TYPESAFE_API_KEY lives ONLY in edge function secrets (see
   bos/lib/env.ts: static export ships zero secrets; server keys live in
   supabase secrets). Same door TIGA AI and TIGA MODEL use, one key, one auth
   model across all three projects.

   Usage (browser code, after AuthGuard has a session):
     const jev = createJev();
     const r = await jev.judge(state, { desk: { type: "choice", ... } });
     if (r.ok) route(r.answers.desk.choice);
   Returns { ok:false, error } instead of throwing so UI surfaces degrade
   gracefully, the same contract as TIGA MODEL's jev-judgment engine. ── */

import type { JevQuestion, JevAnswers, JevJudgeResult } from "@/lib/jev-types";

const DEFAULT_TIMEOUT_MS = 15000;

export type { JevQuestion, JevAnswers, JevJudgeResult };

export function createJev(opts: { supabaseUrl?: string; getAccessToken?: () => Promise<string | null>; timeoutMs?: number } = {}) {
  // Late import at CALL time — this module stays importable at build time
  // even in server contexts where browser singletons don't exist.
  const url = opts.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  async function token(): Promise<string | null> {
    if (opts.getAccessToken) return opts.getAccessToken();
    try {
      const { createClient } = await import("@/services/supabase/client");
      const { data } = await createClient().auth.getSession();
      return (data && data.session && data.session.access_token) || null;
    } catch {
      return null;
    }
  }

  async function judge(state: string, questions: Record<string, JevQuestion>, judgeOpts: { model?: string } = {}): Promise<JevJudgeResult> {
    if (!url) return { ok: false, error: "NEXT_PUBLIC_SUPABASE_URL missing", via: "jev" };
    if (!state.trim()) return { ok: false, error: "state must be a non-empty string", via: "jev" };
    if (!questions || !Object.keys(questions).length) return { ok: false, error: "questions must be a non-empty object", via: "jev" };

    const accessToken = await token();
    if (!accessToken) return { ok: false, error: "not signed in (jev-judge requires a user session)", via: "jev" };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(`${url}/functions/v1/jev-judge`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ state, questions, model: judgeOpts.model }),
        signal: ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: String(data?.error || `jev-judge ${res.status}`), via: "jev" };
      return { ok: true, answers: (data.answers || {}) as JevAnswers, model: data.model, usage: data.usage, via: "jev" };
    } catch (e: any) {
      return { ok: false, error: e?.name === "AbortError" ? "jev timeout" : String(e?.message || e), via: "jev" };
    } finally {
      clearTimeout(timer);
    }
  }

  return { judge };
}

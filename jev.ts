import { apiHeaders } from "./ai-backend";

/* ── jev.ts — client bridge to the piano-jev edge function ──
   Jev (TypeSafe AI, System One model) powers the app's small structured
   decisions: classify, route, score, filter. Unlike the chat backend, a Jev
   task that is disabled, unconfigured, rate-limited, or erroring resolves to
   { ok:false } — NEVER a thrown error. Every call site pairs a jevTask() call
   with the pre-Jev fallback path and simply proceeds when ok:false, so:
     - no Jev key configured    → app behaves exactly as before
     - admin switched a task off → that task behaves exactly as before
     - Jev slow/down            → fallback wins, UX unchanged
   Jev is ~70-500ms per call and parallel-evaluates every question in one
   round-trip, so callers may await it inline on hot paths (unlike the 3-30s
   LLM calls) — but every caller ALSO keeps its own local deadline race so a
   hung Jev can never stall the UI it decorates.

   The per-task call sites:
     teach-rank        App.tsx fetchAutoTeachTip (rank AI-generated tips)
     song-rec          App.tsx songRecommendationHint (pick the next song)
     chat-precheck     use-chat.ts callClaude (spam/mood/homework/intent)
     voice-intent      use-voice-tutor.ts vmProcess (spoken command routing)
     run-classify      use-play-along.ts fetchSongAnalysis (mistake profile)
     ear-adaptive      App.tsx EarGymPage (adaptive difficulty)
     slip-prefilter    App.tsx AdminPayments aiRead (skip non-slip uploads)
     feedback-classify App.tsx AdminStudents (bucket learner reports) ── */

const JEV_URL = "https://gsaqgbracxnucdmtmcxz.supabase.co/functions/v1/piano-jev";

export async function jevTask(task, state, options = {}, timeoutMs = 2500) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(JEV_URL, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({ task, state, options }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return { ok: false, answers: null, reason: "http-" + res.status };
    const data = await res.json();
    if (!data || data.ok !== true || !data.answers) return { ok: false, answers: null, reason: data?.reason || "bad-shape" };
    return { ok: true, answers: data.answers, raw: data.raw || null };
  } catch (e) {
    return { ok: false, answers: null, reason: "error" };
  }
}

// ── response readers — each returns the useful bit or null; call sites treat
// null identically to ok:false (use the fallback) ──
export function jevNoul(a) { return a && a.type === "noul" && typeof a.noul === "number" ? a.noul : null; }
export function jevChoice(a) { return a && a.type === "choice" && a.choice ? a.choice : null; }
export function jevScore(a) { return a && a.type === "score" && typeof a.score === "number" ? a.score : null; }

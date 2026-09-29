// jev-judge — Supabase Edge Function (Deno)
//
// The ONE server-side door to TypeSafe's Jev (System One) judgment API for all
// three projects in this repo: TIGA AI (piano SPA), TIGA MODEL (capability hub
// and Model Lab), and TIGA AUTOMATION (bos Next.js workspace). Jev turns
// natural-language state + typed questions into structured judgments
// (Choice/Noul/Score with probabilities) — see .claude/skills/typesafe-ai —
// and this function exists so the TYPESAFE_API_KEY never ships to any client
// (the skill's hard rule, and this repo's habit: piano-chat does the same for
// every LLM provider key).
//
// WIRE CONTRACT:
//   Request:  POST { state: string, questions: { [id]: { type, instructions, criteria? } }, model?: string }
//             — questions follow the TypeSafe primitives: "choice" (criteria:
//             {key: description}), "score" (criteria: [level, ...]),
//             "noul" (no criteria). Optional "feature" tags the call for
//             logging. `model` defaults to "jev-latest".
//   Response: { answers: { [id]: typedAnswer }, model, usage } — the System
//             One response body, passed through unchanged.
//   Errors:   { error: "<message>" } with a matching status code (400 bad
//             input, 429 rate limit, 502 upstream failure, 500 key missing).
//
// ENV VARS (set via `supabase secrets set TYPESAFE_API_KEY ...`):
//   TYPESAFE_API_KEY — required. Server-side only; clients never hold it.
//
// Auth: caller must present a valid Supabase user JWT (Authorization: Bearer
// <access_token>), same habit as piano-chat's per-user flow — anon probes get
// 401. RLS stays the enforcement layer for any per-user data; this function
// only brokers the judgment itself.

const TYPESAFE_API_URL = "https://api.typesafe.ai/v1/systemone";
const DEFAULT_MODEL = "jev-latest";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (obj: any, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });

const isQuestionObject = (q: any) =>
  q && typeof q === "object" &&
  typeof q.type === "string" && ["choice", "score", "noul"].includes(q.type) &&
  typeof q.instructions === "string" && q.instructions.length > 0;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  // ── auth: a real signed-in Supabase user is required ──
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return json({ error: "missing bearer token" }, 401);

  // ── input validation before spending the caller's tokens ──
  const state = typeof body.state === "string" ? body.state : "";
  const questions = body.questions && typeof body.questions === "object" && !Array.isArray(body.questions) ? body.questions : null;
  if (!state.trim() || !questions || Object.keys(questions).length === 0) {
    return json({ error: "body needs a non-empty `state` string and a `questions` object (choice/score/noul)" }, 400);
  }
  for (const [id, q] of Object.entries(questions)) {
    if (!isQuestionObject(q)) return json({ error: `question "${id}" needs { type: choice|score|noul, instructions }` }, 400);
  }

  const apiKey = Deno.env.get("TYPESAFE_API_KEY");
  if (!apiKey) return json({ error: "TYPESAFE_API_KEY not configured on the server" }, 500);

  const model = typeof body.model === "string" && body.model ? body.model : DEFAULT_MODEL;

  try {
    const upstream = await fetch(TYPESAFE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ state, model, questions }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      return json({ error: `typesafe upstream ${upstream.status}: ${detail.slice(0, 300)}` }, upstream.status === 429 ? 429 : 502);
    }

    const data = await upstream.json();
    return json({ answers: data?.answers ?? {}, model: data?.model ?? model, usage: data?.usage ?? null });
  } catch (e: any) {
    return json({ error: `typesafe request failed: ${e?.message || "unknown"}` }, 502);
  }
});

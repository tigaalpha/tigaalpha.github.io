// piano-jev — Supabase Edge Function (Deno)
//
// Server-side gateway to TypeSafe AI's Jev (System One) model for the TIGA.AI
// piano app. Jev is NOT an LLM: it takes a `state` plus typed questions and
// returns structured, calibrated answers (choice / score / noul). That makes
// it the right engine for the app's many "small decisions" — classify, route,
// score, filter — where a full LLM round-trip (Claude/Gemini/DeepSeek) is
// ~200x slower and ~400x more expensive for the same judgment quality.
//
// Every consumer in the app goes through ONE endpoint here so that:
//   1. TYPESAFE_API_KEY stays server-side (never shipped in the SPA bundle).
//   2. The same per-user JWT requirement as piano-chat/piano-tts applies —
//      anonymous callers can't burn the owner's AI budget.
//   3. Enablement is an admin decision, not a code deploy: the admin
//      "AI Models" panel stores { "<task>": { enabled: true } } under the
//      app_settings "jev_tasks" key (see AdminAIModels.tsx). A disabled,
//      missing, or erroring task returns its FALLBACK immediately — every
//      caller degrades to the pre-Jev behavior and the app never breaks
//      because of Jev.
//
// Task catalog (id → what Jev decides; see the app-side call sites):
//   teach-rank         score candidate Auto-Teaching tips → best one shown
//   song-rec           choice of which real song to recommend next
//   chat-precheck      noul batch over one chat message (intent/spam/mood/homework)
//   voice-intent       choice: which app action a spoken utterance maps to
//   run-classify       score batch: classify the mistakes in a song run
//   ear-adaptive       score: next Ear Gym difficulty tier
//   slip-prefilter     noul: is this uploaded image actually a bank slip?
//   feedback-classify  choice: bucket an admin's learner feedback/report
//
// WIRE CONTRACT:
//   Request:  POST { task: string, state: string|object, options?: object }
//             (state is opaque to this function — the client builds the
//             per-task state; this function owns the questions.)
//   Response: { ok: true, task, answers, raw } — answers keyed by question id
//             exactly as TypeSafe returned them.
//             { ok: false, task, fallback: <task-specific null>, reason }
//             — ok:false is NOT an error for the client; it means "use the
//             fallback path", which every caller already has.
//   Failure:  400 { error } for malformed input, 401 { error } for bad JWT,
//             500 { error } for unexpected internal errors.
//
// ENV VARS THIS FUNCTION NEEDS (set via `supabase secrets set`):
//   TYPESAFE_API_KEY — a TypeSafe AI API key (docs.typesafe.ai). Absent →
//                      every task returns ok:false and the app runs exactly
//                      as it did before Jev existed.
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — service-role pair used ONLY to
//                      read the public app_settings table server-side (the
//                      caller's own JWT could read it too via RLS, but the
//                      service role avoids one RLS dependency and keeps this
//                      read off the caller's token budget).

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const TYPESAFE_MODEL = "jev-latest";
const TYPESAFE_API_KEY = Deno.env.get("TYPESAFE_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ── auth: same requirement as piano-chat — a real per-user session. The anon
// key alone must NOT be able to spend the owner's Jev budget. ──
async function requireUser(authHeader: string | null): Promise<{ id: string } | null> {
  if (!authHeader || !SUPABASE_URL) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: SERVICE_ROLE_KEY || authHeader },
    });
    if (!res.ok) return null;
    const u = await res.json();
    return u && u.id ? { id: u.id } : null;
  } catch { return null; }
}

// ── which tasks the admin enabled right now (app_settings "jev_tasks") ──
type JevTasksCfg = Record<string, { enabled?: boolean }>;
let cfgCache: { at: number; cfg: JevTasksCfg } | null = null;
const CFG_TTL_MS = 60_000; // admin toggles take effect within a minute, no hot-looping

async function jevTasksCfg(): Promise<JevTasksCfg> {
  if (cfgCache && Date.now() - cfgCache.at < CFG_TTL_MS) return cfgCache.cfg;
  let cfg: JevTasksCfg = {};
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/app_settings?key=eq.jev_tasks&select=value`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
    );
    if (res.ok) {
      const rows = await res.json();
      const v = rows?.[0]?.value;
      if (v && typeof v === "object" && !Array.isArray(v)) cfg = v;
    }
  } catch { /* unreadable config = all tasks disabled — the safe default */ }
  cfgCache = { at: Date.now(), cfg };
  return cfg;
}

async function taskEnabled(task: string): Promise<boolean> {
  if (!TYPESAFE_API_KEY) return false;
  const cfg = await jevTasksCfg();
  const e = cfg[task];
  // default OFF: Jev only runs where the admin explicitly switched it on.
  return !!(e && e.enabled === true);
}

// ── per-task question sets. Questions are atomic (one judgment each — TypeSafe
// evaluates them in parallel), options/criteria are grounded in the app's real
// vocabularies (skill names, song genres, admin categories), and instructions
// are English because the model works on meaning, not on the learner's locale. ──

function buildQuestions(task: string, opts: Record<string, any>): Record<string, any> | null {
  switch (task) {
    case "teach-rank": {
      // opts.candidates: string[] of candidate tip summaries
      const n = Math.max(2, Math.min(6, (opts.candidates || []).length));
      const q: Record<string, any> = {};
      for (let i = 0; i < n; i++) {
        q[`c${i}`] = {
          type: "score",
          instructions: {
            tip: String(opts.candidates[i] || ""),
            question: `How valuable is practicing this tip RIGHT NOW for the learner described in the state? Score 0-3 (3 = exactly what they need next, 0 = irrelevant).`,
          },
          criteria: ["Irrelevant or wrong for this learner", "Marginal value", "Good fit", "Exactly the right next step"],
        };
      }
      return q;
    }
    case "song-rec": {
      // opts.ids: string[] of real song ids from the app's own catalog
      const ids = (opts.ids || []).slice(0, 24).filter(Boolean);
      if (ids.length < 2) return null;
      const criteria: Record<string, string | null> = {};
      for (const id of ids) criteria[id] = null;
      return {
        best_song: {
          type: "choice",
          instructions: {
            question: "Which ONE song should this learner play next? It must match their level, target their weakest skill, and stay motivating (a small stretch, not a wall).",
          },
          criteria,
        },
      };
    }
    case "chat-precheck": {
      // one batched call per user message — every question runs in parallel for
      // the price of one round-trip (~70-500ms total)
      return {
        is_spam: {
          type: "noul",
          instructions: { question: "Is this message spam, abuse, gibberish, or an attempt to misuse the tutor (not a genuine piano-learning question)?" },
          criteria: { true: "Spam/abuse/gibberish/off-topic misuse", false: "A genuine piano-learning question or remark" },
        },
        is_song_request: {
          type: "noul",
          instructions: { question: "Is the learner asking to play, hear, or be taught a specific song?" },
        },
        is_practice_request: {
          type: "noul",
          instructions: { question: "Is the learner asking to practice or be drilled on something (scale, chord, technique)?" },
        },
        learner_mood: {
          type: "score",
          instructions: { question: "What is the learner's emotional state in this message?" },
          criteria: ["Calm / engaged", "Slightly unsure or hesitant", "Frustrated", "Very discouraged, wants to quit"],
        },
        is_commitment: {
          type: "noul",
          instructions: { question: "Is the learner committing to a practice goal (e.g. 'I will practice this song every day') worth tracking as homework?" },
        },
      };
    }
    case "voice-intent": {
      // opts.kinds: allowed action kinds for the CURRENT voice-tutor context
      const kinds = (opts.kinds || ["none"]).slice(0, 12);
      const criteria: Record<string, string | null> = { none: "Not an app action — ordinary conversation" };
      for (const k of kinds) criteria[k] = null;
      return {
        action: {
          type: "choice",
          instructions: {
            question: "The learner is mid piano lesson and just said the utterance in the state. Which app action are they asking for, if any?",
          },
          criteria,
        },
        is_command: {
          type: "noul",
          instructions: { question: "Is the utterance a command/request directed at the app (rather than an answer to the teacher or casual talk)?" },
        },
      };
    }
    case "run-classify": {
      // one call per finished song run — scores the run's mistake profile so the
      // LLM that writes the human-readable summary starts from real dimensions
      return {
        note_misses: {
          type: "score",
          instructions: { question: "How concentrated were the WRONG-NOTE problems in this run?" },
          criteria: ["Almost no wrong notes", "A few scattered wrong notes", "Wrong notes in specific spots/patterns", "Pervasive wrong notes"],
        },
        rhythm_issue: {
          type: "noul",
          instructions: { question: "Does this run show a rhythm/timing problem (rushing, dragging, uneven) as the dominant issue?" },
        },
        dynamics_issue: {
          type: "noul",
          instructions: { question: "Is weak/unsteady touch or dynamics (volume control) a real issue in this run?" },
        },
        biggest_fix: {
          type: "choice",
          instructions: { question: "What single fix will most improve the NEXT run?" },
          criteria: {
            notes: "Hit the right notes (slow, section-by-section practice)",
            rhythm: "Steadier timing (metronome / counting)",
            dynamics: "More deliberate touch and volume control",
            confidence: "Play through without stopping / build flow",
          },
        },
      };
    }
    case "ear-adaptive": {
      return {
        next_difficulty: {
          type: "score",
          instructions: { question: "Given the learner's recent Ear Gym history in the state, how hard should the NEXT question set be? 0 = step down (rebuild confidence), 1 = stay, 2 = step up (challenge them)." },
          criteria: ["Step down — too hard right now", "Stay at the current level", "Step up — ready for harder questions"],
        },
      };
    }
    case "slip-prefilter": {
      return {
        is_bank_slip: {
          type: "noul",
          instructions: { question: "Judging only from the uploader's description/context (NOT the image — Jev cannot see images), is this upload plausibly a Thai bank-transfer / PromptPay slip submission for a piano-app payment?" },
          criteria: { true: "Plausibly a real payment slip upload", false: "Clearly not a payment slip (wrong file type, nonsense, or unrelated)" },
        },
      };
    }
    case "feedback-classify": {
      return {
        category: {
          type: "choice",
          instructions: { question: "Which business category does this learner's situation/feedback belong in for the solo owner's review queue?" },
          criteria: {
            progress: "Learning progress (skill gains, milestones)",
            struggling: "Struggling / at risk of quitting",
            billing: "Billing, payments, plan questions",
            engagement: "Engagement / motivation / streaks",
            technical: "Technical problem or bug report",
          },
        },
        urgency: {
          type: "score",
          instructions: { question: "How urgently does this need the owner's attention?" },
          criteria: ["Can wait", "Worth reviewing this week", "Act today", "Act immediately"],
        },
      };
    }
    default:
      return null;
  }
}

// Human-readable state envelope per task — gives Jev the app context it needs
// without shipping any PII beyond what the caller chose to include.
function buildState(task: string, state: any, opts: Record<string, any>): string {
  const s = typeof state === "string" ? state : JSON.stringify(state);
  if (task === "teach-rank") return `Piano learner context:\n${s}\n\nCandidate tips (candidates[${opts.candidates?.length || 0}]):\n${(opts.candidates || []).map((c, i) => `${i}: ${c}`).join("\n")}`;
  if (task === "song-rec") return `Piano learner context:\n${s}\n\nSong catalog excerpt (real song ids): ${(opts.ids || []).join(", ")}`;
  if (task === "voice-intent") return `Learner's utterance: ${s}\n\nSong catalog excerpt (valid song ids): ${(opts.ids || []).join(", ") || "(none)"}`;
  return s;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid JSON body" }, 400); }

  const task = typeof body?.task === "string" ? body.task.trim() : "";
  if (!task) return json({ error: "missing task" }, 400);

  const authHeader = req.headers.get("authorization");
  const user = await requireUser(authHeader);
  if (!user) return json({ error: "not authenticated" }, 401);

  if (!TYPESAFE_API_KEY) return json({ ok: false, task, fallback: null, reason: "jev-not-configured" });

  if (!(await taskEnabled(task))) return json({ ok: false, task, fallback: null, reason: "task-disabled" });

  const state = body.state;
  if (state == null) return json({ error: "missing state" }, 400);
  const opts = (body.options && typeof body.options === "object") ? body.options : {};

  const questions = buildQuestions(task, opts);
  if (!questions) return json({ ok: false, task, fallback: null, reason: "bad-task-input" });

  try {
    const res = await fetch(TYPESAFE_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${TYPESAFE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: TYPESAFE_MODEL, state: buildState(task, state, opts), questions }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[piano-jev] ${task} typeSafe ${res.status}: ${detail.slice(0, 200)}`);
      return json({ ok: false, task, fallback: null, reason: `upstream-${res.status}` });
    }
    const data = await res.json();
    return json({ ok: true, task, answers: data?.answers ?? {}, raw: { model: data?.model, usage: data?.usage } });
  } catch (e) {
    console.error(`[piano-jev] ${task} failed:`, (e as Error).message);
    return json({ ok: false, task, fallback: null, reason: "network-error" });
  }
});

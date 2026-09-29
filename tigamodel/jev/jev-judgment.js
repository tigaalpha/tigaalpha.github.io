/* ── tigamodel/jev/jev-judgment.js — TypeSafe Jev judgment engine ──
   TIGA MODEL's door to System One judgments (Choice / Score / Noul) for all
   three projects. Jev returns TYPED answers with probabilities that code
   composes — the counterpart to the chat providers here, which generate text.

   Pure JS, no imports, dependency-injected — testable in Node exactly like
   hub.js. The API key never touches any client: every call goes through the
   `jev-judge` Supabase edge function with the caller's Supabase JWT, so this
   module runs safely in the browser SPA, in the Model Lab, and in bos server
   code alike.

   Usage:
     const jev = createJevJudgment({ fetchImpl, supabaseUrl, getAccessToken });
     const r = await jev.judge({
       state: "...",
       questions: {
         best_song: { type: "choice", instructions: "...", criteria: { a: "...", b: "..." } },
         churn_risk: { type: "noul", instructions: "..." },
         frustration: { type: "score", instructions: "...", criteria: ["...", "..."] },
       },
     });
     // r.ok === true → r.answers.best_song.choice / r.answers.churn_risk.noul / ...
     // r.ok === false → r.error (string); NEVER throws so surfaces can degrade
     //                  to their local baseline, the same contract hub engines
     //                  follow via attempt(). ── */

export function createJevJudgment({ fetchImpl = null, supabaseUrl = "", getAccessToken = null, model = "jev-latest", timeoutMs = 15000 } = {}) {
  const _fetch = fetchImpl || (typeof fetch !== "undefined" ? fetch : null);
  const base = String(supabaseUrl || "").replace(/\/$/, "");

  function configError() {
    if (!_fetch) return "fetch unavailable in this environment";
    if (!base) return "supabaseUrl is required (project root: https://gsaqgbracxnucdmtmcxz.supabase.co)";
    return null;
  }

  function normalizeQuestion(q) {
    if (!q || typeof q !== "object") return null;
    const type = q.type;
    if (!["choice", "score", "noul"].includes(type)) return null;
    const out = { type, instructions: String(q.instructions || "") };
    if (!out.instructions) return null;
    if (q.criteria != null) out.criteria = q.criteria;
    return out;
  }

  /* judge(questions, state, opts?) — both orders accepted for convenience.
     Returns { ok:true, answers, model, usage, via } or { ok:false, error, via }.
     `via` marks the engine so the back office can prove what produced an
     answer (the hub's provenance habit). */
  async function judge(questionsOrState, stateOrQuestions, opts = {}) {
    let questions = null, state = "";
    if (typeof questionsOrState === "string" && stateOrQuestions && typeof stateOrQuestions === "object") {
      state = questionsOrState; questions = stateOrQuestions;
    } else if (typeof stateOrQuestions === "string" && questionsOrState && typeof questionsOrState === "object") {
      questions = questionsOrState; state = stateOrQuestions;
    } else if (questionsOrState && typeof questionsOrState === "object" && questionsOrState.state != null && questionsOrState.questions != null) {
      ({ state, questions } = questionsOrState);
      opts = {};
    }
    const via = "jev-judgment";
    const cfgErr = configError();
    if (cfgErr) return { ok: false, error: cfgErr, via };
    if (typeof state !== "string" || !state.trim()) return { ok: false, error: "state must be a non-empty string", via };
    if (!questions || typeof questions !== "object" || Array.isArray(questions)) return { ok: false, error: "questions must be an object", via };

    const clean = {};
    for (const [id, q] of Object.entries(questions)) {
      const n = normalizeQuestion(q);
      if (n) clean[id] = n; // silently drop malformed questions — mirrors attempt() degradation
    }
    if (!Object.keys(clean).length) return { ok: false, error: "no valid questions (need type choice|score|noul + instructions)", via };

    let token = null;
    try { token = typeof getAccessToken === "function" ? await getAccessToken() : null; } catch (e) { /* treat as anon */ }
    if (!token) return { ok: false, error: "no Supabase access token (jev-judge requires a signed-in user)", via };

    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctrl && timeoutMs ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    try {
      const res = await _fetch(`${base}/functions/v1/jev-judge`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ state, questions: clean, model: opts.model || model }),
        signal: ctrl ? ctrl.signal : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: String(data?.error || `jev-judge ${res.status}`), via };
      return { ok: true, answers: data.answers || {}, model: data.model || opts.model || model, usage: data.usage || null, via };
    } catch (e) {
      return { ok: false, error: e && e.name === "AbortError" ? `jev timeout after ${timeoutMs}ms` : String((e && e.message) || e), via };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /* Convenience helpers — one primitive each, per the skill's "one narrow,
     coherent judgment per question" rule. */
  async function choose(state, instructions, criteria, opts) {
    const r = await judge({ q: { type: "choice", instructions, criteria } }, state, opts);
    return r.ok ? { ok: true, choice: r.answers.q?.choice ?? null, probabilities: r.answers.q?.probabilities ?? null, confidence: r.answers.q?.confidence ?? null, via: r.via } : r;
  }
  async function noul(state, instructions, opts) {
    const r = await judge({ q: { type: "noul", instructions } }, state, opts);
    return r.ok ? { ok: true, noul: r.answers.q?.noul ?? null, via: r.via } : r;
  }
  async function score(state, instructions, levels, opts) {
    const r = await judge({ q: { type: "score", instructions, criteria: levels } }, state, opts);
    return r.ok ? { ok: true, score: r.answers.q?.score ?? null, confidence: r.answers.q?.confidence ?? null, via: r.via } : r;
  }

  return { judge, choose, noul, score };
}

/* Where TIGA judgments plug in first — the piano app's own data. Kept here so
   every surface asks for the SAME judgment definitions instead of inventing
   its own per call site. */
export const JEV_RECIPES = {
  /* TIGA AI — next best song for a learner right now (sight-reading coach) */
  nextBestSong: {
    questions: {
      next_song: {
        type: "choice",
        instructions: "Which song should this piano student play next",
        criteria: {
          celebrate: "A song they recently mastered, to celebrate and build momentum",
          same_level: "A new song at their current level",
          challenge: "A song one level harder, to stretch them",
          review: "A review of an older piece they struggled with",
        },
      },
    },
  },
  /* TIGA AI — churn risk from the practice log (drives winback popups) */
  churnRisk: {
    questions: {
      churn_risk: { type: "noul", instructions: "This student's recent practice pattern signals disengagement and churn risk" },
    },
  },
  /* TIGA AUTOMATION — route an inbound customer message to the right desk */
  routeMessage: {
    questions: {
      desk: {
        type: "choice",
        instructions: "Which team should handle this customer message",
        criteria: {
          billing: "Payment, invoice, or subscription issues",
          lesson: "Lesson scheduling or teacher questions",
          technical: "App bugs or login problems",
          sales: "Pricing questions or new enrollment",
        },
      },
      urgency: { type: "score", instructions: "How urgent this message is", criteria: ["Can wait a day", "Needs a same-day reply", "Needs an immediate reply"] },
    },
  },
};

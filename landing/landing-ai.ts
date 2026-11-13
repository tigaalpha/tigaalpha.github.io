import { anonId } from "../local-identity";

/* ── landing/landing-ai.ts ──
   Talks to the `landing-chat` Edge Function, which is the ONLY backend on this
   project that answers without a session.

   It is not piano-chat. piano-chat has verify_jwt on deliberately, so it
   cannot be called anonymously off the project's AI budget — and a stranger
   from an ad has no account by definition. landing-chat is a separate door
   with its own bouncer: it owns the system prompt (so it cannot be turned into
   a free general-purpose LLM proxy), caps input and output, rate-limits per
   visitor, per IP and globally, and runs only on free routes, so the worst
   case is that it stops answering rather than that it starts billing.

   Streamed, not awaited whole: a free reasoning model can think for several
   seconds before its first token, and words appearing one by one is the
   difference between "it's working" and a stranger closing the tab. ── */

export const LANDING_CHAT_URL =
  "https://gsaqgbracxnucdmtmcxz.supabase.co/functions/v1/landing-chat";

/* ── which languages the DEPLOYED landing-chat knows ──
   The function whitelists `lang` (supabase/functions/landing-chat/index.ts), so an
   unknown code silently becomes "th" and a visitor would get a Thai answer.
   Deployed 2026-11-13 with prompts for all six landing languages, so every
   language is sent as itself. The fallback below stays for a language the
   function does not know (and for a future seventh page that ships before the
   function does): it is sent as "en" with a last-word instruction to reply in
   the visitor's language instead. */
export const SERVER_LANGS = ["th", "en", "zh", "ja", "ko", "ru"];
const REPLY_IN = { ja: "Japanese (日本語)", ko: "Korean (한국어)", ru: "Russian (русский)" };
/* The function cuts the question at 500 characters, and a cut would take the
   instruction first if it sat at the end — so the visitor's own text is trimmed
   to leave room for it. */
const MAX_QUESTION = 500;
export function wireLang(lang, question) {
  if (SERVER_LANGS.includes(lang)) return { lang, question };
  const note = "\n\n[Reply in " + (REPLY_IN[lang] || "the visitor's language") +
    ". This overrides the English-only rule above. Keep note names and chord symbols as written.]";
  return { lang: "en", question: String(question).slice(0, MAX_QUESTION - note.length) + note };
}

/* Resolves once the answer is complete. onChunk gets the WHOLE answer so far,
   not the delta, so the caller just assigns it. Throws { limit: true } when the
   free allowance is gone, so the page can show the sign-up card rather than an
   error. */
export async function askLandingAI({ question, history = [], lang = "th", signal, onChunk }) {
  const wire = wireLang(lang, question);
  const res = await fetch(LANDING_CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: wire.question, history, lang: wire.lang, anon_id: anonId() }),
    signal,
  });

  if (res.status === 429) {
    const data = await res.json().catch(() => ({}));
    const err: any = new Error(data.error || "limit");
    err.limit = true;
    throw err;
  }
  if (!res.ok || !res.body) {
    throw new Error("HTTP " + res.status);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      // ": keep-alive" comment lines are the function telling us a slow model
      // is still thinking — a read, which is the point, and nothing to parse.
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let evt: any;
      try { evt = JSON.parse(payload); } catch { continue; }
      // A provider failure arrives as a typed error event rather than as text,
      // so a raw 429 blob can never land in a stranger's first impression.
      if (evt.error) throw new Error(evt.error);
      if (typeof evt.content === "string" && evt.content) {
        text += evt.content;
        onChunk && onChunk(text);
      }
    }
  }

  if (!text.trim()) throw new Error("empty answer");
  return text;
}

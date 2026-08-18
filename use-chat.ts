import { useState, useRef, useEffect } from "react";
import {
  LESSON_MODE, extractNotes, playPianoNote, FINGERING_REF,
} from "./music-engine";
import { tr, L, matchFaqTopic } from "./i18n";
import { stopCloudTTS } from "./speech";
import { memoryContext } from "./ai-chat-context";
import { streamChatCompletion } from "./ai-backend";
import { EXP, buildAlternatingHistory } from "./App";
/* ── use-chat.ts ──
   Owns the main AI-sensei chat panel: the message list + typed-input box
   + streaming Claude call (send/callClaude), the [play:]-tag reply
   interpreter (handleAIReply, internal), the expanded-chat-modal toggle,
   and which message is currently being spoken aloud (activeSpk). Msg/
   Typing/Input (chat-ui.tsx, Phase 1) and SenseiView/the inline expanded-
   modal JSX (still in PianoApp) are this hook's consumers; every prop
   they already receive keeps its exact original name.

   flagOpen/setFlagOpen (the language-picker dropdown, showing FLAGS/
   FLAG_NAMES) is NOT part of this hook despite sitting one line below
   activeSpk in the original source - it's app-chrome, not a chat concern,
   confirmed by its only real consumer being the language switcher UI, not
   anything touching msgs/topicHint/callClaude. Its own outside-click-close
   effect stays in PianoApp untouched.

   pushMessage(msg) and setLessonContext(hint, key) are NEW convenience
   wrappers around setMsgs/topicHint.current/lessonKey.current, added here
   per the governing plan so pathway's learnTopic()/readChapter() and
   school's reviewSchools() (all still in PianoApp, all still touching the
   raw setMsgs/topicHint/lessonKey directly today, unchanged by this step)
   have a real API to switch to in Phase 3.10's glue cleanup - this phase
   only builds the API, it doesn't migrate those call sites yet.

   hand/playSequence/seqTimers (use-keyboard.ts) and gainExp
   (use-gamification.ts) are threaded as ordinary params; requireLogin is
   a PianoApp closure threaded the same way use-payment.ts/
   use-play-along.ts already do. EXP is already exported from App.tsx (no
   change); buildAlternatingHistory is a NEW export in place - genuinely
   multi-consumer (AdminPage's own diagnostic chat, and Voice Tutor's own
   history builder, both still directly calling it, neither moving until
   later/never) so it can't relocate, same convention as logGame/
   logPractice/scoreDynamics/API_MODEL. buildHistory() itself (a 1-line
   wrapper with exactly one caller, callClaude) moves here verbatim as an
   internal helper, not exported.

   Ordering note (new this hook): callClaude was a hoisted `function`
   declaration in PianoApp, so usePracticeMode.ts's call site (needing it
   as a param) could sit anywhere in PianoApp's body and still resolve.
   Once callClaude is a hook-returned const, hoisting no longer applies -
   useChat() must be CALLED before usePracticeMode()'s call site, not just
   textually positioned anywhere. PianoApp's call site is placed
   immediately before usePracticeMode()'s (which already threads
   setMsgs/topicHint/lessonKey/callClaude/isGuest/lang - all unchanged),
   and after useKeyboard()/useGamification() (hand/playSequence/seqTimers/
   gainExp must already exist). ── */
export function useChat({ lang, hand, playSequence, seqTimers, gainExp, requireLogin }) {
  const lc = L[lang];

  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);

  const [activeSpk, setActiveSpk] = useState(null);

  const endRef = useRef(null);
  const mendRef = useRef(null);
  const topicHint = useRef(null); // "scale" | "chord" — what the current lesson is about
  const lessonKey = useRef(null); // the key id picked in the lesson (e.g. "F", "Bb") — forces correct key
  // true from callClaude()'s start until its stream fully resolves (success or
  // error) — deliberately separate from `loading`, which flips false as soon as
  // the empty AI bubble appears (see callClaude's onStart) so the typing-dots
  // indicator can hand off to the live-filling bubble. Without this, a second
  // callClaude() firing mid-stream (send() re-entered once `loading` is already
  // false, or use-practice-mode.ts's auto-feedback call, which has no loading
  // check at all) would race flush()'s "overwrite the last AI message" logic
  // against the first call's still-arriving tokens, corrupting whichever bubble
  // ends up last.
  const streamingRef = useRef(false);

  function pushMessage(msg) { setMsgs(prev => [...prev, msg]); }
  function setLessonContext(hint, key = null) { topicHint.current = hint; lessonKey.current = key; }

  useEffect(() => {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    stopCloudTTS();
    setActiveSpk(null);
    setMsgs([{ role: "ai", text: lc.welcome }]);
    setInput("");
  }, [lang]);

  useEffect(() => {
    // throttle scrolling to one rAF tick — avoids layout thrash while streaming
    const id = requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
      mendRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [msgs, loading]);

  function handleAIReply(text) {
    // when a lesson is active we already played the correct demo explicitly —
    // do NOT auto-play from the AI text (that mis-detected the topic before)
    if (topicHint.current === LESSON_MODE) return;
    const parsed = extractNotes(text, hand, topicHint.current, lessonKey.current);
    if (parsed) {
      const t = setTimeout(() => playSequence(parsed), 500);
      seqTimers.current.push(t); // tracked so clearSeq()/unmount can cancel it
    }
  }

  function buildHistory() {
    return buildAlternatingHistory(msgs, 6);
  }

  /* Chat via the Supabase Edge Function proxy — streams the reply word-by-word.
     Sends { message, conversationHistory, system }; reads SSE lines of
     `data: {"content":"..."}` produced by the function. */
  async function callClaude(userText) {
    if (streamingRef.current) return; // a stream is already in flight — never let two calls interleave
    streamingRef.current = true;
    setLoading(true);
    const history = buildHistory();

    try {
      // throttle UI updates to ~16fps instead of re-rendering on every token
      let pendingFlush = null;
      let lastFlush = 0;
      let latest = "";
      const flush = () => {
        pendingFlush = null;
        lastFlush = Date.now();
        const text = latest;
        setMsgs(prev => {
          const copy = prev.slice();
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === "ai") { copy[i] = { ...copy[i], text }; break; }
          }
          return copy;
        });
      };
      const scheduleFlush = () => {
        if (pendingFlush) return;
        const since = Date.now() - lastFlush;
        const wait = since >= 60 ? 0 : 60 - since;
        pendingFlush = setTimeout(flush, wait);
      };

      const acc = await streamChatCompletion(
        { message: userText, conversationHistory: history, system: lc.sys + FINGERING_REF + memoryContext(lang), feature: "chat" },
        {
          // insert an empty AI bubble we will fill as tokens arrive
          onStart: () => { setMsgs(prev => [...prev, { role: "ai", text: "" }]); setLoading(false); },
          onChunk: (soFar) => { latest = soFar; scheduleFlush(); },
        }
      );
      if (pendingFlush) clearTimeout(pendingFlush);
      latest = acc;
      flush(); // final flush with the complete text

      if (acc.trim()) {
        handleAIReply(acc);
      } else {
        // nothing streamed back — surface a friendly error in the empty bubble
        setMsgs(prev => {
          const copy = prev.slice();
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === "ai") { copy[i] = { ...copy[i], text: lc.chatErr }; break; }
          }
          return copy;
        });
      }
      setLoading(false);
    } catch (e) {
      console.error("Chat error:", e);
      // never surface the raw provider error (401/429 JSON) — friendly copy only
      setMsgs(prev => [...prev, { role: "ai", text: lc.chatErr }]);
      setLoading(false);
    } finally {
      streamingRef.current = false;
    }
  }

  function send() {
    const t = input.trim();
    if (!t || loading || streamingRef.current) return; // streamingRef stays true after `loading` already cleared (see callClaude) — block a second send for the whole in-flight window, not just its pre-first-token half
    // derive topic hint from what the user actually typed (scale vs chord)
    const lo = t.toLowerCase();
    if (/\bscale\b|สเกล|บันไดเสียง|音阶|音階/.test(lo)) topicHint.current = "scale";
    else if (/\bchord\b|triad|คอร์ด|ไทรแอด|和弦/.test(lo)) topicHint.current = "chord";
    else topicHint.current = null; // let the detector decide from the AI reply
    lessonKey.current = null; // free-typed: don't force a lesson key, detect from text
    setInput("");
    setMsgs(prev => [...prev, { role: "user", text: t }]);
    playPianoNote("C5", 0.1);
    // tier 1: does this clearly match a prepared Pathway chapter/case study already in the app?
    // — answered entirely locally, so guests get this tier free, same as any
    // other pathway content. Only tier 2 (the live AI) needs a real login.
    const faq = matchFaqTopic(t, lang);
    if (faq) {
      topicHint.current = LESSON_MODE; // curated reading content — don't auto-detect notes from it
      setMsgs(prev => [...prev, { role: "ai", text: tr(faq.content, lang) }]);
      gainExp(EXP.ask, { quest: true }); // reward engaging with the AI sensei
    } else if (!requireLogin("ai")) {
      callClaude(t); // tier 2: no prepared match — ask the live AI
      gainExp(EXP.ask, { quest: true }); // reward engaging with the AI sensei
    }
  }
  return { msgs, setMsgs, input, setInput, loading, setLoading, modal, setModal, activeSpk, setActiveSpk, endRef, mendRef, topicHint, lessonKey, send, callClaude, pushMessage, setLessonContext };
}

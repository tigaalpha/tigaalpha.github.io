import { memo, useMemo, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { L } from "./i18n";
import { extractNotes, getAC } from "./music-engine";
import { ttsSupported, stopSpeaking, stopCloudTTS, speakCloud, speakDeviceOrNative } from "./speech";

/* ── chat-ui.tsx ──
   Chat UI atoms shared by every chat surface (Sensei page, expanded chat
   modal): the message bubble (Msg), typing indicator (Typing), text input
   (Input), and the read-aloud button (SpeakBtn, currently feature-flagged
   off via TTS_ENABLED while the cloud-TTS quota is sorted out). Extracted
   from App.tsx verbatim — no logic changes — as part of the App.tsx
   modularization. ── */


/* Read-aloud is on for every platform. Cloud TTS (Gemini) is the primary
   voice; when its shared quota is out (free tier: ~10 req/min) or on a weak
   signal, the fallback in speech.ts speaks with the device voice — on the
   web that is speechSynthesis, and inside the Android app's WebView (where
   speechSynthesis does not exist) it is the OS TTS engine via the Capacitor
   plugin, so the button ALWAYS produces sound. The IndexedDB clip cache
   (ttsCacheGet/ttsCachePut) keeps repeat listens free of the cloud quota. */
export const TTS_ENABLED = false;

/* ── Speaker button (robust, with fallback message) ── */
export const SpeakBtn = memo(function SpeakBtn({ text, lang, id, activeId, setActiveId }) {
  const lc = L[lang];
  const supported = ttsSupported();
  const isOn = activeId === id;

  function toggle() {
    if (isOn) {
      stopSpeaking();
      stopCloudTTS();
      setActiveId(null);
      return;
    }
    getAC(); // unlock audio inside the tap gesture (iOS Safari)
    setActiveId(id);
    // try the natural cloud voice first; fall back to the device voice on any error.
    // No alert popups — a failure just quietly resets the button (the old "blocked
    // in preview" alert was misleading on the live site and jarring).
    speakCloud(
      text, lang,
      null,                                   // onStart
      () => setActiveId(null),                // onDone
      () => {                                 // onError → device/native-voice fallback (never silent on a real device)
        speakDeviceOrNative(text, lang, () => setActiveId(null), () => setActiveId(null)).catch(() => setActiveId(null));
      }
    );
  }

  return (
    <button className={`spkbtn${isOn ? " on" : ""}`} onClick={toggle}
      title={supported ? lc.speak : lc.ttsNo} aria-label={supported ? lc.speak : lc.ttsNo}>
      <span className="spkwave" aria-hidden="true">
        <span /><span /><span /><span />
      </span>
      <span className="spktxt">{isOn ? lc.speaking : lc.speak}</span>
    </button>
  );
});

/* ── Light formatting for the tutor's answers ──
   **bold**, "- " bullets, "1." steps and "#" headings (shown as bold) — and
   nothing else. The tutor is asked to write plain text with a little of this,
   and without it the learner sees stray asterisks. It builds React elements,
   never HTML, so nothing the model writes can inject markup; a line it does not
   recognise is kept exactly as typed. A message with none of these markers
   keeps the plain pre-wrap paragraph it always had (see Msg). */
const RICH_MARKS = /\*\*|^\s*(?:[-•*]|\d+[.)])\s|^#{1,6}\s/m;
function inlineBold(text: string, keyBase: string) {
  const parts = text.split(/\*\*([^*\n]+)\*\*/g);
  return parts.map((t, i) => (i % 2 === 1 ? <strong key={keyBase + i}>{t}</strong> : t));
}
function RichText({ text }: { text: string }) {
  const lines = String(text).split("\n");
  return (
    <div className="rt">
      {lines.map((raw, i) => {
        if (!raw.trim()) return <div key={i} className="rt-gap" />;
        const h = raw.match(/^#{1,6}\s+(.*)$/);
        if (h) return <div key={i}><strong>{inlineBold(h[1], i + "h")}</strong></div>;
        const b = raw.match(/^\s*(?:[-•*])\s+(.*)$/);
        if (b) return <div key={i} className="rt-li"><span className="rt-dot" aria-hidden="true">•</span><span>{inlineBold(b[1], i + "b")}</span></div>;
        const n = raw.match(/^\s*(\d+)[.)]\s+(.*)$/);
        if (n) return <div key={i} className="rt-li"><span className="rt-dot rt-num" aria-hidden="true">{n[1]}.</span><span>{inlineBold(n[2], i + "n")}</span></div>;
        return <div key={i}>{inlineBold(raw, i + "p")}</div>;
      })}
    </div>
  );
}

/* ── Message (memoized: only re-renders when its own props change) ── */
export const Msg = memo(function Msg({ m, idx, lang, activeSpk, setActiveSpk, onPlay, onRetry, onMore = null }) {
  // parse notes only when the message text or language actually changes
  const parsed = useMemo(
    () => (m.role === "ai" && m.text ? extractNotes(m.text) : null),
    [m.role, m.text]
  );
  const lc = L[lang];
  /* An answer is placed in the thread the moment it is asked for and filled in
     when it arrives, so between those two moments this rendered a bubble with
     an empty paragraph in it — a labelled box with nothing inside, which reads
     as the app having hung rather than as it working. It gets the same three
     bouncing dots the standalone Typing indicator uses; three because that is
     already this app's sign for "thinking" and a second, different count would
     be a second sign for the same thing. */
  const waiting = m.role === "ai" && !m.text && !m.img;
  /* The tutor now answers short on purpose; under the newest live answer a
     tap asks for the long version. Not on errors, chapters or local replies. */
  const showMore = !!onMore && m.role === "ai" && !!m.live && !m.error && !waiting && String(m.text || "").length >= 60;
  return (
    <div className={`msg ${m.role === "user" ? "u" : "a"}`}>
      <div className="bbl">
        {m.role === "ai" && <div className="atag">◈ TIGA CHAT</div>}
        {m.img && <img src={m.img} alt="" className="adminimg" />}
        {waiting
          ? <div className="typing" role="status" aria-live="polite"
                 aria-label={lang === "th" ? "กำลังคิดคำตอบ" : lang === "zh" ? "正在思考" : "Thinking"}>
              <div className="tdd" /><div className="tdd" /><div className="tdd" />
            </div>
          : (m.role === "ai" && RICH_MARKS.test(String(m.text || "")))
            ? <RichText text={String(m.text)} />
            : <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{m.text}</p>}
      </div>
      {/* the row is skipped entirely when it would be empty, so turning TTS off
          leaves no stray gap under messages that carry no notes */}
      {/* One-tap retry on a failed answer — the question is still in the thread
          right above, so ↻ resends it verbatim instead of making the learner
          retype it (the #1 most-requested recovery after a dropped reply). */}
      {m.role === "ai" && m.error && onRetry && (
        <div className="mact">
          <button className="retrybtn" onClick={onRetry}>
            <span>↻</span><span>{lang === "th" ? "ลองส่งใหม่" : lang === "zh" ? "重试" : "Retry"}</span>
          </button>
        </div>
      )}
      {m.role === "ai" && !waiting && (TTS_ENABLED || parsed || showMore) && (
        <div className="mact">
          {TTS_ENABLED && (
            <SpeakBtn text={m.text} lang={lang} id={idx}
              activeId={activeSpk} setActiveId={setActiveSpk} />
          )}
          {parsed && (
            <button className="playbtn" onClick={() => onPlay(parsed)}>
              <span>▶</span><span>{lang === "th" ? "เล่นโน้ต" : lang === "zh" ? "演奏" : "PLAY"}</span>
            </button>
          )}
          {parsed && <span className="nlbl">{parsed.label}</span>}
          {showMore && (
            <button className="morebtn" onClick={onMore}>
              <span aria-hidden="true">＋</span><span>{lc.chatMore}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export const Typing = memo(function Typing({ slow, lang }) {
  const slowText = lang === "th"
    ? "ยังเชื่อมต่ออยู่ — กำลังลองใหม่อัตโนมัติ…"
    : lang === "zh"
    ? "仍在连接中 — 正在自动重试…"
    : "Still connecting — retrying automatically…";
  return (
    <div className="msg a">
      <div className="bbl">
        <div className="atag">◈ TIGA CHAT</div>
        <div className="typing"><div className="tdd"/><div className="tdd"/><div className="tdd"/></div>
        {slow && <div className="slowhint">{slowText}</div>}
      </div>
    </div>
  );
});

export function Input({ val, onChange, onSend, loading, ph, note = null, noteOut = false }) {
  function onKey(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }
  function onInput(e) {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 110) + "px";
    onChange(e.target.value);
  }
  return (
    <>
      <div className="ir">
        <textarea className="tin" value={val} placeholder={ph} aria-label={ph}
          onChange={onInput} onKeyDown={onKey} rows={1} />
        <button className="snd" disabled={loading || !val.trim()} onClick={onSend}
          aria-label={ph}>➤</button>
      </div>
      {/* free messages left today — only for a free account, only when given one */}
      {note && <div className={"qnote" + (noteOut ? " out" : "")} role="status">{note}</div>}
    </>
  );
}

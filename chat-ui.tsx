import { memo, useMemo, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { L } from "./i18n";
import { extractNotes, getAC } from "./music-engine";
import { ttsSupported, stopSpeaking, stopCloudTTS, speakCloud, speakRobust } from "./speech";

/* ── chat-ui.tsx ──
   Chat UI atoms shared by every chat surface (Sensei page, expanded chat
   modal): the message bubble (Msg), typing indicator (Typing), text input
   (Input), and the read-aloud button (SpeakBtn, currently feature-flagged
   off via TTS_ENABLED while the cloud-TTS quota is sorted out). Extracted
   from App.tsx verbatim — no logic changes — as part of the App.tsx
   modularization. ── */


/* Read-aloud in the chat was switched off globally while the Gemini TTS quota
   was sorted out — the free tier ran out within a few taps on the full web
   audience, so the button mostly failed. Now scoped to the Android app only:
   a much smaller audience than the web, on top of the IndexedDB clip cache
   (speech.ts, ttsCacheGet/ttsCachePut) that already makes repeat listens free.
   First-time listens still draw from the same shared quota, so watch it if
   the Android install base grows; flip back to `false` (or gate further) if
   it becomes a problem again. Set to `true` to restore it everywhere. */
export const TTS_ENABLED = Capacitor.getPlatform() === "android";

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
      () => {                                 // onError → device-voice fallback (silent)
        if (!supported) { setActiveId(null); return; }
        const ok = speakRobust(text, lang, () => setActiveId(null), () => setActiveId(null));
        if (!ok) setActiveId(null);
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

/* ── Message (memoized: only re-renders when its own props change) ── */
export const Msg = memo(function Msg({ m, idx, lang, activeSpk, setActiveSpk, onPlay }) {
  // parse notes only when the message text or language actually changes
  const parsed = useMemo(
    () => (m.role === "ai" && m.text ? extractNotes(m.text) : null),
    [m.role, m.text]
  );
  const lc = L[lang];
  return (
    <div className={`msg ${m.role === "user" ? "u" : "a"}`}>
      <div className="bbl">
        {m.role === "ai" && <div className="atag">◈ TIGA.AI</div>}
        {m.img && <img src={m.img} alt="" className="adminimg" />}
        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{m.text}</p>
      </div>
      {/* the row is skipped entirely when it would be empty, so turning TTS off
          leaves no stray gap under messages that carry no notes */}
      {m.role === "ai" && (TTS_ENABLED || parsed) && (
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
        </div>
      )}
    </div>
  );
});

export const Typing = memo(function Typing() {
  return (
    <div className="msg a">
      <div className="bbl">
        <div className="atag">◈ TIGA.AI</div>
        <div className="typing"><div className="tdd"/><div className="tdd"/><div className="tdd"/></div>
      </div>
    </div>
  );
});

export function Input({ val, onChange, onSend, loading, ph }) {
  function onKey(e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }
  function onInput(e) {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 110) + "px";
    onChange(e.target.value);
  }
  return (
    <div className="ir">
      <textarea className="tin" value={val} placeholder={ph} aria-label={ph}
        onChange={onInput} onKeyDown={onKey} rows={1} />
      <button className="snd" disabled={loading || !val.trim()} onClick={onSend}
        aria-label={ph}>➤</button>
    </div>
  );
}

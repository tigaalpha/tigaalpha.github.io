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
        {m.role === "ai" && <div className="atag">◈ TIGA CHAT</div>}
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
        <div className="atag">◈ TIGA CHAT</div>
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

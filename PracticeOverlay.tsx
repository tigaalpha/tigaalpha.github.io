import { L } from "./i18n";
import { Piano, pcOf } from "./music-engine";
/* ── PracticeOverlay ──
   The active practice-session full-screen overlay (practiceOpen), extracted
   verbatim from PianoApp's inline JSX as part of Phase 2 componentization —
   no logic changes. lc is derived from lang internally, same convention as
   PricingOverlay. ── */
export function PracticeOverlay({ practiceModeRef, chordStyle, practiceTarget, practiceHitIdxs, practiceFingers, lang, practiceLabel, exitPractice, practiceSrc, practiceTune, hand, setHand, practiceIdx, practiceHeard, practiceMiss, restartPractice, practiceHandlerRef, switchPracticeChordStyle }) {
  const lc = L[lang];
        const isBlockMode = practiceModeRef.current === "chord" && chordStyle === "block";
        const remainingIdxs = isBlockMode
          ? practiceTarget.map((_, i) => i).filter(i => !practiceHitIdxs.includes(i))
          : [];
        const remainingNotes = isBlockMode ? remainingIdxs.map(i => practiceTarget[i]) : [];
        const remainingFingerMap = isBlockMode
          ? remainingIdxs.reduce((m, i) => { if (practiceFingers[i] != null) m[practiceTarget[i]] = practiceFingers[i]; return m; }, {})
          : {};
  return (
        <div className="practiceov">
          <div className="practicehdr">
            <div className="practicehtitle">
              {lc.practiceTitle}
              <small>{practiceLabel}</small>
            </div>
            <button className="cbtn" onClick={exitPractice}>{lc.close}</button>
          </div>
          {practiceModeRef.current === "chord" && (
            <div className="chordstylerow practicechordstyle">
              <button className={`chordstylebtn${chordStyle === "broken" ? " on" : ""}`} onClick={() => chordStyle !== "broken" && switchPracticeChordStyle()}>{lc.chordBroken}</button>
              <button className={`chordstylebtn${chordStyle === "block" ? " on" : ""}`} onClick={() => chordStyle !== "block" && switchPracticeChordStyle()}>{lc.chordBlock}</button>
            </div>
          )}
          <div className="practicebody">
            <div className={`practicesrc${practiceSrc && practiceSrc.type === "error" ? " err" : ""}`}>
              {!practiceSrc ? "…"
                : practiceSrc.type === "midi" ? lc.practiceMidi
                : practiceSrc.type === "mic"
                  ? (practiceTune != null ? `${lc.practiceMic} · 🎚 ${practiceTune > 0 ? "+" : ""}${practiceTune}¢` : lc.practiceMic)
                : lc.practiceMicErr}
            </div>

            {/* hand picker — finger numbers update to the correct hand */}
            <div className="handsel practicehand" style={{ maxWidth: "360px", margin: "12px auto 2px", justifyContent: "center" }}>
              <button className={`handbtn${hand === "left" ? " on" : ""}`}
                onClick={() => setHand("left")} aria-pressed={hand === "left"} title={lc.leftHand}>
                <span className="handlbl">{lc.leftHand}</span>
              </button>
              <button className={`handbtn${hand === "right" ? " on" : ""}`}
                onClick={() => setHand("right")} aria-pressed={hand === "right"} title={lc.rightHand}>
                <span className="handlbl">{lc.rightHand}</span>
              </button>
            </div>

            {isBlockMode ? (
              <Piano
                litSet={remainingNotes}
                fingerMap={remainingFingerMap}
                onNote={(n) => practiceHandlerRef.current({ note: n, freq: null })} />
            ) : (
              <Piano
                litNote={practiceTarget[practiceIdx] || null}
                fingerMap={practiceTarget[practiceIdx] != null && practiceFingers[practiceIdx] != null
                  ? { [practiceTarget[practiceIdx]]: practiceFingers[practiceIdx] } : {}}
                onNote={(n) => practiceHandlerRef.current({ note: n, freq: null })} />
            )}

            <div className="practicenow">
              <div className="practicenow-box">
                <div className="practicenow-lbl">{lc.practicePlay}</div>
                <div className="practicenow-note target">
                  {isBlockMode
                    ? (remainingNotes.length ? remainingNotes.map(n => pcOf(n)).join(" · ") : "✓")
                    : (practiceTarget[practiceIdx] ? pcOf(practiceTarget[practiceIdx]) : "✓")}
                </div>
              </div>
              <div className="practicenow-box">
                <div className="practicenow-lbl">{lc.practiceHeard}</div>
                <div className={`practicenow-note heard${practiceHeard ? (practiceHeard.ok ? " ok" : " bad") : ""}`}>
                  {practiceHeard ? pcOf(practiceHeard.note) : "–"}
                </div>
              </div>
            </div>

            <div className="practicechips">
              {practiceTarget.map((n, i) => (
                <span key={i} className={`pchip${isBlockMode
                  ? (practiceHitIdxs.includes(i) ? " done" : "")
                  : (i < practiceIdx ? " done" : i === practiceIdx ? " cur" : "")}`}>
                  {pcOf(n)}
                </span>
              ))}
            </div>

            <div className="practicebar">
              <div className="practicefill" style={{ width: `${practiceTarget.length ? Math.round(practiceIdx / practiceTarget.length * 100) : 0}%` }} />
            </div>
            <div className="practicestats">
              <span>{lc.practiceAcc}: <b>{(practiceIdx + practiceMiss) > 0 ? Math.round(practiceIdx / (practiceIdx + practiceMiss) * 100) : 100}%</b></span>
              <span>✓ <b>{practiceIdx}</b> / {practiceTarget.length}</span>
            </div>

            <div className="practicetip">{lc.practiceHint}<br />{lc.practiceMicTip}</div>
          </div>
          <div className="practicefoot">
            <button className="practicerestart" onClick={restartPractice}>↻ {lc.practiceRestart}</button>
            <button className="practiceexit" onClick={exitPractice}>✕ {lc.practiceExit}</button>
          </div>
        </div>
  );
}

import { L } from "./i18n";
import { Piano, playUi } from "./music-engine";
import { Msg, Typing, Input } from "./chat-ui";
/* ── SenseiView ──
   The default page (page==="sensei"), extracted verbatim from PianoApp's
   inline JSX as part of Phase 2 componentization — no logic changes. The
   main on-screen keyboard + recording/fingering controls interleaved with
   the AI chat list, with no sub-boundary of its own (per the plan: "today
   interleaving the keyboard and the chat list with no sub-boundary"). The
   expanded-chat modal (.mov) is a separate, always-mounted overlay outside
   this page==="sensei" block and stays in PianoApp. lc is derived from lang
   internally. recommendNext/toggleChordStyle are PianoApp closures (not
   top-level, not exported), so they're threaded as props. ── */
export function SenseiView({ lang, activeStageId, setPage, onBack, recommendNext, pianoOct, setPianoOct, replayLast, seqIsChord, chordStyle, toggleChordStyle, litNote, litSet, fingerMap, handleMainKey, recording, toggleRecord, hasSeq, togglePlayPause, seqPlaying, hasClip, playingClip, playClip, critiqueRecording, fingerChart, hand, setHand, startPractice, msgs, activeSpk, setActiveSpk, playSequence, loading, endRef, input, setInput, send, setModal }) {
  const lc = L[lang];
  return (
        <>
          <button className="senseiback" onClick={() => { playUi("click"); onBack(); }} aria-label={activeStageId ? lc.backChangeKey : lc.back}>
            <span>←</span> {activeStageId ? lc.backChangeKey : lc.back}
          </button>
          {(() => {
            const rec = recommendNext();
            return (
              <button className="dailyrec" onClick={rec.fn}>
                <span className="dailyrec-lbl">{lc.recFor}</span>
                <span className="dailyrec-ic">{rec.icon}</span>
                <span className="dailyrec-txt">{rec.label}</span>
                <span className="dailyrec-go">→</span>
              </button>
            );
          })()}
          <div className="pw">
            <div className="plblrow">
              <span className="plbl">{lc.pianoLabel}</span>
              <div className="octctl" title={lc.octaveHint}>
                <button className="octbtn" onClick={() => setPianoOct(o => Math.max(2, o - 1))} disabled={pianoOct <= 2} aria-label="Octave down">◀</button>
                <span className="octlbl">C{pianoOct}–B{pianoOct + 1}</span>
                <button className="octbtn" onClick={() => setPianoOct(o => Math.min(5, o + 1))} disabled={pianoOct >= 5} aria-label="Octave up">▶</button>
              </div>
              <button className="replaybtn" onClick={replayLast} title={lc.replay} aria-label={lc.replay}>
                <span className="replayicon">↻</span>
                <span>{lc.replay}</span>
              </button>
            </div>
            {seqIsChord && (
              <div className="chordstylerow">
                <button className={`chordstylebtn${chordStyle === "broken" ? " on" : ""}`} onClick={() => chordStyle !== "broken" && toggleChordStyle()}>{lc.chordBroken}</button>
                <button className={`chordstylebtn${chordStyle === "block" ? " on" : ""}`} onClick={() => chordStyle !== "block" && toggleChordStyle()}>{lc.chordBlock}</button>
              </div>
            )}
            <Piano litNote={litNote} litSet={litSet} fingerMap={fingerMap} baseOct={pianoOct} onNote={handleMainKey} />
            <div className="recbar">
              <button className={`recbtn${recording ? " on" : ""}`} onClick={toggleRecord}>
                {recording ? `■ ${lc.recStop}` : `● ${lc.recRecord}`}
              </button>
              {hasSeq && <button className="recbtn" onClick={togglePlayPause} title={seqPlaying ? lc.demoPause : lc.demoPlay}>
                {seqPlaying ? "⏸" : "▶"} {seqPlaying ? lc.demoPause : lc.demoPlay}
              </button>}
              {hasClip && !recording && <button className="recbtn ghost" onClick={playClip} disabled={playingClip}>
                ▶ {playingClip ? lc.recPlaying : lc.recPlay}
              </button>}
              {hasClip && !recording && <button className="recbtn ai" onClick={critiqueRecording}>
                🎓 {lc.recCritique}
              </button>}
              {recording && <span className="recdot">● REC</span>}
            </div>

            {/* persistent fingering chart — shows finger numbers for current hand */}
            {fingerChart && fingerChart.notes.some(p => p.finger != null) && (
              <div className="fchart">
                <div className="fchart-head">
                  <span className="fchart-title">{lc.fingerLabel}</span>
                  <span className="fchart-key">{fingerChart.label}</span>
                </div>
                <div className="fchart-row" style={{ display: "flex", gap: "4px", overflowX: "auto", paddingBottom: "2px" }}>
                  {fingerChart.notes.map((p, i) => (
                    <div key={i} className="fchart-cell" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", flexShrink: 0, minWidth: "34px" }}>
                      <span className="fchart-finger" style={{ background: hand === "left" ? "#d97757" : "#ff5252" }}>{p.finger != null ? p.finger : "·"}</span>
                      <span className="fchart-note">{p.note.replace(/[45]/, "")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="handsel" style={{ display: "flex", gap: "10px", marginTop: "10px", padding: "0 2px" }}>
              <button className={`handbtn${hand === "left" ? " on" : ""}`}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                onClick={() => setHand("left")} title={lc.leftHand} aria-label={lc.leftHand} aria-pressed={hand === "left"}>
                <svg className="handsvg" width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <path d="M11 14V7.5a1.8 1.8 0 0 1 3.6 0V13M14.6 13V6a1.8 1.8 0 0 1 3.6 0v7M18.2 13.5V8a1.8 1.8 0 0 1 3.6 0v8.5c0 4.5-2.6 8-7.4 8-3 0-4.6-1.2-6.4-3.6l-2.8-3.8a1.9 1.9 0 0 1 3-2.3l1.8 2V9a1.8 1.8 0 0 1 3.6 0v5"
                    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="handlbl">{lc.leftHand}</span>
              </button>
              <button className={`handbtn${hand === "right" ? " on" : ""}`}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
                onClick={() => setHand("right")} title={lc.rightHand} aria-label={lc.rightHand} aria-pressed={hand === "right"}>
                <span className="handlbl">{lc.rightHand}</span>
                <svg className="handsvg" width="22" height="22" viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ flexShrink: 0, transform: "scaleX(-1)" }}>
                  <path d="M11 14V7.5a1.8 1.8 0 0 1 3.6 0V13M14.6 13V6a1.8 1.8 0 0 1 3.6 0v7M18.2 13.5V8a1.8 1.8 0 0 1 3.6 0v8.5c0 4.5-2.6 8-7.4 8-3 0-4.6-1.2-6.4-3.6l-2.8-3.8a1.9 1.9 0 0 1 3-2.3l1.8 2V9a1.8 1.8 0 0 1 3.6 0v5"
                    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <button className="practicebtn" disabled={!hasSeq} onClick={startPractice}
              title={hasSeq ? lc.practiceBtn : lc.practiceNoSeq}>
              {hasSeq ? lc.practiceBtn : lc.practiceNoSeq}
            </button>
          </div>
          <div className="cw">
            <div className="chdr">
              <div className="ailbl"><div className="dot" />{lc.aiLabel}</div>
              <button className="ebtn" onClick={() => setModal(true)}>{lc.expand}</button>
            </div>
            <div className="msgs">
              {msgs.map((m, i) => (
                <Msg key={i} m={m} idx={i} lang={lang}
                  activeSpk={activeSpk} setActiveSpk={setActiveSpk} onPlay={playSequence} />
              ))}
              {loading && <Typing />}
              <div ref={endRef} />
            </div>
            <div className="iw">
              <Input val={input} onChange={setInput} onSend={send} loading={loading} ph={lc.ph} />
              <div className="hint">{lc.hint}</div>
            </div>
          </div>
        </>
  );
}

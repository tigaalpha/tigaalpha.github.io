import { L, tr } from "./i18n";
import { Piano, playUi, playPianoNote } from "./music-engine";
import { Msg, Typing, Input, ChatProgress } from "./chat-ui";
import { FingerHand } from "./PracticeOverlay";
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
export function SenseiView({ lang, activeStageId, setPage, onBack, recommendNext, pianoOct, setPianoOct, replayLast, seqIsChord, chordStyle, toggleChordStyle, litNote, litSet, fingerMap, handleMainKey, recording, toggleRecord, hasSeq, togglePlayPause, seqPlaying, hasClip, playingClip, playClip, critiqueRecording, fingerChart, hand, setHand, startPractice, msgs, activeSpk, setActiveSpk, playSequence, loading, slow, endRef, input, setInput, send, retryLast, setModal, chatStarters, onStarterTap, chatNote = null, chatNoteOut = false, onMore = null, speakMode = "off", onSpeakLocked = null, onMark = null, onGoStep = null, chatProg = null, todayPlan = null, todayTags = null, onTodayOpen = null, resumeCard = null, onResumeDrill = null, missCard = null, sessionDone = null}) {
  const lc = L[lang];
  const tt = todayTags || {};
  const TT = {
    th: { doneTitle: "ครบทุกข้อของวันนี้แล้ว", lastDrill: "เล่นซ้ำ", missed: "พลาดบ่อย 7 วันนี้", now: "ตอนนี้", start: "เริ่มฝึก", more: "เพิ่มเติม", notes: "โน้ต", min: "นาที", listen: "ฟังตัวอย่างก่อน" },
    en: { doneTitle: "Today's plan is done", lastDrill: "Play again", missed: "Missed most this week", now: "Now", start: "Start", more: "More", notes: "notes", min: "min", listen: "Listen to the demo first" },
    zh: { doneTitle: "今日计划已完成", lastDrill: "再练一次", missed: "本周最常错", now: "现在", start: "开始", more: "更多", notes: "个音", min: "分钟", listen: "先听示范" },
  }[lang];
  const planNext = todayPlan && todayPlan.next;
  return (
        <>
          {/* Plan 26 · P2 — the goal bar sits at the TOP now, not buried under the
              chat input, and it renders even when streak/quest are still zero:
              a brand-new learner is exactly who most needs to see a target. */}
          {chatProg && <ChatProgress lang={lang} streak={chatProg.streak} askedToday={chatProg.askedToday} questCount={chatProg.questCount} questGoal={chatProg.questGoal} expToday={chatProg.expToday} always />}
          {/* Plan 26 · P1 + P3 — today's plan on the page the learner stands on.
              The numbers come from buildTodaySteps(), the SAME function TodayPage
              renders, so the two can never disagree. One button, and it runs the
              first step that is not done yet (or opens the full plan for the
              homework step, which has no "go" of its own and must not be ticked
              off from here without doing it). */}
          {todayPlan && todayPlan.total > 0 && (
            <div className="todaybar">
              <button className="todaybar-btn" onClick={() => {
                playUi("click");
                if (!planNext) { onTodayOpen && onTodayOpen(); return; }
                if (planNext.go) planNext.go(); else onTodayOpen && onTodayOpen();
              }}>
                <span className="todaybar-ic" aria-hidden="true">{planNext ? planNext.icon : "✅"}</span>
                <span className="todaybar-tx">
                  <b className="todaybar-tag">{planNext ? planNext.tag : tt.allDoneShort}</b>
                  <span className="todaybar-lb">{planNext ? planNext.label : ""}</span>
                </span>
                <span className="todaybar-ct">{todayPlan.done}/{todayPlan.total}</span>
              </button>
              <div className="todaybar-track" role="progressbar" aria-valuemin={0} aria-valuemax={todayPlan.total} aria-valuenow={todayPlan.done}>
                <div className="todaybar-fill" style={{ width: todayPlan.pct + "%" }} />
              </div>
            </div>
          )}
          {/* Plan 26 · P7 — shown only when the whole plan is actually done, and
              only with two REAL numbers from readPracticeLog()._recent (the
              learner's last session and the one before it). No number is ever
              invented to fill this card in. */}
          {sessionDone && (
            <div className="todaydone">
              <span className="todaydone-ic" aria-hidden="true">🎉</span>
              <span className="todaydone-tx">
                <b>{TT.doneTitle}</b>
                <span className="todaydone-acc">
                  {sessionDone.before}% <span className="todaydone-arrow" aria-hidden="true">→</span> <b>{sessionDone.after}%</b>
                  {sessionDone.delta !== 0 && (
                    <em className={sessionDone.delta > 0 ? "up" : "down"}>
                      {sessionDone.delta > 0 ? "+" : ""}{sessionDone.delta}
                    </em>
                  )}
                </span>
              </span>
            </div>
          )}
          {/* Plan 26 · P5 — the learner's own last drill, one tap from playing
              it again. The drill comes from readPracticeBests(), the same store
              the profile's Drill Deck replays from. */}
          {resumeCard && (
            <button className="resumebar" onClick={() => onResumeDrill && onResumeDrill(resumeCard)}>
              <span className="resumebar-ic" aria-hidden="true">⏯</span>
              <span className="resumebar-tx">
                <b className="resumebar-tag">{TT.lastDrill}</b>
                <span className="resumebar-lb">{resumeCard.label}</span>
              </span>
              <span className="resumebar-acc">{resumeCard.accuracy}%</span>
            </button>
          )}
          {/* Plan 26 · P6 — pitch classes the learner actually misses, counted
              by recordNoteMisses() on every drill and, until now, read by
              nothing on screen. Tap plays the note; it does not navigate away. */}
          {missCard && (
            <div className="missbar">
              <span className="missbar-lbl">{TT.missed}</span>
              {missCard.map(m => (
                <button key={m.pc} className="misschip" onClick={() => { playPianoNote(m.pc + "4", 0.4); }} title={TT.missed + ` · ${m.n}×`}>
                  {m.pc}<em>{m.n}</em>
                </button>
              ))}
            </div>
          )}
          <button className="senseiback" onClick={() => { playUi("click"); onBack(); }} aria-label={activeStageId ? lc.backChangeKey : lc.back}>
            <span>←</span> {activeStageId ? lc.backChangeKey : lc.back}
          </button>
          {/* Plan 28 · B1 — ONE card answers "what do I do now": what, how many notes, about how long, and one big button.
              With a demo on the keys it is the practice run of that demo; without one it is the same recommendation
              the Daily Mentor shows (recommendNext), so the pages cannot disagree. */}
          {(() => {
            const rec = recommendNext();
            const nNotes = fingerChart && fingerChart.notes ? fingerChart.notes.length : 0;
            const mins = Math.max(1, Math.round(nNotes / 6));
            if (hasSeq) {
              return (
                <div className="nowcard">
                  <span className="nowcard-tag">{TT.now}</span>
                  <b className="nowcard-t">{fingerChart && fingerChart.label ? fingerChart.label : lc.practiceBtn}</b>
                  <span className="nowcard-s">{nNotes ? `${nNotes} ${TT.notes} · ~${mins} ${TT.min}` : ""}{rec && rec.label ? ` · ${lc.recFor}: ${rec.label}` : ""}</span>
                  <button className={`practicebtn nowcard-go${!seqPlaying ? " ready" : ""}`} onClick={startPractice} title={lc.practiceBtn}>▶ {TT.start}</button>
                  <button className="nowcard-sub" onClick={togglePlayPause}>{seqPlaying ? "⏸ " + lc.demoPause : "👂 " + TT.listen}</button>
                </div>
              );
            }
            return (
              <button className="nowcard nowcard-rec" onClick={rec.fn}>
                <span className="nowcard-tag">{TT.now}</span>
                <b className="nowcard-t"><span aria-hidden="true">{rec.icon}</span> {rec.label}</b>
                <span className="nowcard-s">{lc.recFor} →</span>
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
            <details className="sv-more"><summary>{TT.more}</summary>
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

            </details>
            {/* Plan 28 · B3 — the finger table is a hand: the finger for the note that is lit (demo or key) is the one that glows,
                the same drawing the practice screen uses; the note names stay as quiet text below. */}
            {fingerChart && fingerChart.notes.some(p => p.finger != null) && (() => {
              const cur = fingerChart.notes.find(p => p.note === litNote);
              return (
                <div className="fchart fchart-hand">
                  <div className="fchart-head">
                    <span className="fchart-title">{lc.fingerLabel}</span>
                    <span className="fchart-key">{fingerChart.label}</span>
                  </div>
                  <FingerHand finger={cur && cur.finger != null ? cur.finger : 0} hand={hand} />
                  <div className="fchart-notes">{fingerChart.notes.map(p => p.note.replace(/[0-9]/g, "")).join(" · ")}</div>
                </div>
              );
            })()}

            <div className="handsel" style={{ display: "flex", marginTop: "10px", padding: "0 2px" }}>
              <button className="handbtn on handtoggle" onClick={() => setHand(hand === "left" ? "right" : "left")}
                title={hand === "left" ? lc.leftHand : lc.rightHand} aria-label={hand === "left" ? lc.leftHand : lc.rightHand}>
                <svg className="handsvg" width="24" height="24" viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ flexShrink: 0, transform: hand === "right" ? "scaleX(-1)" : undefined }}>
                  <path d="M11 14V7.5a1.8 1.8 0 0 1 3.6 0V13M14.6 13V6a1.8 1.8 0 0 1 3.6 0v7M18.2 13.5V8a1.8 1.8 0 0 1 3.6 0v8.5c0 4.5-2.6 8-7.4 8-3 0-4.6-1.2-6.4-3.6l-2.8-3.8a1.9 1.9 0 0 1 3-2.3l1.8 2V9a1.8 1.8 0 0 1 3.6 0v5"
                    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span className="handlbl">{hand === "left" ? lc.leftHand : lc.rightHand}</span>
                <span className="handswap" aria-hidden="true">⇄</span>
              </button>
            </div>
          </div>
          <div className="cw">
            <div className="chdr">
              <div className="ailbl"><div className="dot" />{lc.aiLabel}</div>
              <button className="ebtn" onClick={() => setModal(true)}>{lc.expand}</button>
            </div>
            <div className="msgs">
              {msgs.map((m, i) => (
                <Msg key={i} m={m} idx={i} lang={lang}
                  activeSpk={activeSpk} setActiveSpk={setActiveSpk} onPlay={playSequence} onRetry={retryLast}
                  speakMode={speakMode} onSpeakLocked={onSpeakLocked} onMark={onMark} onGoStep={onGoStep}
                  onMore={i === msgs.length - 1 ? onMore : null} />
              ))}
              {loading && <Typing slow={slow} lang={lang} />}
              <div ref={endRef} />
            </div>
            {/* Knowledge Quest starters — 3 unread "why music matters" case
                studies, re-rolled each time this page is entered (see
                chatStarters in PianoApp). Surfaces the curated deep-dive
                content early instead of leaving it undiscovered until the
                pathway naturally reaches level 9+. Disappears once every
                case in every domain has been read. */}
            {chatStarters && chatStarters.length > 0 && (
              <div className="chatstarters">
                <span className="chatstarters-hint">💡 {lc.chatStartersHint}</span>
                {chatStarters.map(s => (
                  <button key={s.stage.id + "/" + s.c.id} className="starterchip" onClick={() => onStarterTap(s.stage, s.c)}>
                    <span className="starterchip-ic">{s.c.icon || s.stage.icon}</span>
                    <span className="starterchip-tx">{tr(s.c.title, lang)}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="iw">
              {/* ChatProgress moved to the top of the page (plan 26 · P2) — it is
                  the learner's goal, not a footnote under a text box. */}
              <Input val={input} onChange={setInput} onSend={send} loading={loading} ph={lc.ph} note={chatNote} noteOut={chatNoteOut} />
              <div className="hint">{lc.hint}</div>
            </div>
          </div>
        </>
  );
}

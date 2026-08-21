import { L } from "./i18n";
import { Piano, StaffSVG, pcOf } from "./music-engine";
/* ── SightReadingOverlay ──
   The sight-reading practice full-screen overlay (sightOpen), extracted
   verbatim from PianoApp's inline JSX as part of Phase 2 componentization —
   no logic changes. lc is derived from lang internally, same convention as
   the other overlay components. SIGHT_ROUND is threaded as a prop rather
   than imported, since it's a module-top-level constant in App.tsx itself
   (importing it back would create a circular App.tsx <-> component import).

   Belt ranking + Sprint mode (fun/value pass): sightBelts/sightTotalRead
   drive a small always-visible belt badge in the header; a promotion is
   called out on the result screen (sightDone.beltUp) rather than left to be
   noticed later on some separate stats page. Sprint is a second, timed mode
   alongside the normal fixed-length round — same clef picker row pattern,
   restarts the round on switch for the same fairness reason a clef switch
   already did. ── */
export function SightReadingOverlay({ lang, exitSight, sightDone, sightIdx, SIGHT_ROUND, sightScore, sightClef, pickSightClef, sightFeedback, sightTarget, sightHint, sightNoteClef, sightHandlerRef, sightSrc, openSight, sightStreak = 0, sightPhrasePos = 0, sightPhraseLen = 3, sightMode = "round", pickSightMode, sightSprintLeft = 0, sightSprintSecs = 60, sightBelts = [], sightBestStreakMap = {}, sightBestSprintMap = {}, sightTotalRead = 0 }) {
  const lc = L[lang];
  const belt = (() => { let b = sightBelts[0]; for (const x of sightBelts) if (sightTotalRead >= x.need) b = x; return b; })();
  const nextBelt = sightBelts.find(b => b.need > sightTotalRead) || null;
  const beltLabel = (b) => b ? (lang === "th" ? b.th : lang === "zh" ? b.zh : b.en) : "";
  return (
        <div className="practiceov sightov">
          <div className="practicehdr">
            <div className="practicehtitle">
              {lc.sightTitle}<small>{lc.sightSub}</small>
            </div>
            {belt && <div className="sightbelt" title={`${lc.sightBeltLbl}: ${beltLabel(belt)}`}><span>{belt.icon}</span>{beltLabel(belt)}</div>}
            <button className="cbtn" onClick={exitSight}>{lc.close}</button>
          </div>
          <div className="practicebody">
            {sightDone ? (
              <div className="songresult">
                {sightDone.beltUp && (
                  <div className="punlock">
                    <div className="punlock-ic">{sightDone.beltUp.icon}</div>
                    <div className="punlock-tt">{lc.sightBeltUp}</div>
                    <div className="punlock-sub">{beltLabel(sightDone.beltUp)}</div>
                  </div>
                )}
                <div className="songstars">{"★".repeat(sightDone.acc >= 90 ? 3 : sightDone.acc >= 70 ? 2 : sightDone.acc >= 40 ? 1 : 0)}{"☆".repeat(3 - (sightDone.acc >= 90 ? 3 : sightDone.acc >= 70 ? 2 : sightDone.acc >= 40 ? 1 : 0))}</div>
                <div className="songresult-acc">{sightDone.acc}%</div>
                {(sightDone.streakIsBest || sightDone.sprintIsBest) && (
                  <div className="sightnewbest">
                    {sightDone.sprintIsBest ? `🏆 ${lc.sightNewSprintBest}` : `🏆 ${lc.sightNewStreakBest}`}
                  </div>
                )}
                <div className="songresult-grid">
                  <div><span>{sightDone.mode === "sprint" ? lc.sightSprintScore : lc.sightScore}</span><b>{sightDone.correct}{sightDone.mode === "sprint" ? "" : "/" + SIGHT_ROUND}</b></div>
                  <div><span>{lc.sightBestStreak}</span><b>{sightDone.bestStreak || 0}</b></div>
                  <div><span>EXP</span><b>+{sightDone.reward}</b></div>
                </div>
                {/* belt progress — the exact numbers captured when this round ended,
                    always visible here so "how close am I" is never a mystery */}
                <div className="beltprog">
                  <div className="beltprog-row"><span>{sightDone.belt.icon} {beltLabel(sightDone.belt)}</span>{sightDone.nextBelt && <span>{beltLabel(sightDone.nextBelt)} {sightDone.nextBelt.icon}</span>}</div>
                  {sightDone.nextBelt && <div className="wkbar beltprog-bar"><div style={{ width: Math.min(100, Math.round((sightDone.totalRead - sightDone.belt.need) / (sightDone.nextBelt.need - sightDone.belt.need) * 100)) + "%" }} /></div>}
                  <div className="beltprog-count">{sightDone.nextBelt ? `${sightDone.totalRead}/${sightDone.nextBelt.need} ${lc.sightBeltReads}` : lc.sightBeltMax}</div>
                </div>
                <div className="songready-btns">
                  <button className="songbtn ghost" onClick={exitSight}>↩ {lc.back}</button>
                  <button className="songbtn go" onClick={() => openSight(sightDone.mode)}>↻ {lc.sightAgain}</button>
                </div>
              </div>
            ) : (
              <>
                <div className="songhud">
                  {sightMode === "sprint"
                    ? <span>⏱ <b>{sightSprintLeft}s</b></span>
                    : <span>{lc.sightRoundLbl} <b>{Math.min(sightIdx + 1, SIGHT_ROUND)}/{SIGHT_ROUND}</b></span>}
                  <span className="sightphrase" title={lc.sightPhraseHint}>{"●".repeat(sightPhrasePos)}{"○".repeat(Math.max(0, sightPhraseLen - sightPhrasePos))}</span>
                  <span>{lc.sightScore} <b>{sightScore}</b></span>
                  {sightStreak >= 2 && <span className="sightstreak">🔥 {sightStreak}</span>}
                </div>
                <div className="clefsel">
                  {[["treble", lc.sightTreble, "𝄞"], ["bass", lc.sightBass, "𝄢"], ["both", lc.sightBoth, "𝄞𝄢"]].map(([m, label, gly]) => {
                    const best = sightBestStreakMap[m] || 0;
                    return (
                      <button key={m} className={`clefbtn${sightClef === m ? " on" : ""}`} onClick={() => pickSightClef(m)} aria-pressed={sightClef === m}>
                        <span className="clefgly">{gly}</span>{label}
                        {best > 0 && <span className="clefbest">🔥{best}</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="clefsel">
                  {[["round", lc.sightModeRound], ["sprint", lc.sightModeSprint]].map(([m, label]) => (
                    <button key={m} className={`clefbtn${sightMode === m ? " on" : ""}`} onClick={() => pickSightMode(m)} aria-pressed={sightMode === m}>
                      {m === "sprint" ? "⏱ " : "🎯 "}{label}
                      {m === "sprint" && sightBestSprintMap[sightClef] > 0 && <span className="clefbest">🏆{sightBestSprintMap[sightClef]}</span>}
                    </button>
                  ))}
                </div>
                <div className={`staffwrap${sightFeedback ? (sightFeedback.ok ? " ok" + (sightFeedback.phraseClean ? " phraseclean" : "") : " bad") : ""}`}>
                  <StaffSVG note={sightTarget} clef={sightNoteClef} />
                </div>
                <div className={`sighthint${sightHint ? " show" : ""}`}>
                  {sightHint && sightTarget ? `${lc.sightAnswer}: ${pcOf(sightTarget)}` : lc.sightPrompt}
                </div>
                <Piano onNote={(n) => sightHandlerRef.current({ note: n, freq: null })} />
                <div className="songsrcbar">
                  {!sightSrc ? "…" : sightSrc.type === "midi" ? lc.practiceMidi : sightSrc.type === "mic" ? lc.practiceMic : lc.practiceMicErr}
                </div>
              </>
            )}
          </div>
        </div>
  );
}

import { L } from "./i18n";
import { Piano, StaffSVG, pcOf } from "./music-engine";
/* ── SightReadingOverlay ──
   The sight-reading practice full-screen overlay (sightOpen), extracted
   verbatim from PianoApp's inline JSX as part of Phase 2 componentization —
   no logic changes. lc is derived from lang internally, same convention as
   the other overlay components. SIGHT_ROUND is threaded as a prop rather
   than imported, since it's a module-top-level constant in App.tsx itself
   (importing it back would create a circular App.tsx <-> component import). ── */
export function SightReadingOverlay({ lang, exitSight, sightDone, sightIdx, SIGHT_ROUND, sightScore, sightClef, pickSightClef, sightFeedback, sightTarget, sightHint, sightNoteClef, sightHandlerRef, sightSrc, openSight, sightStreak = 0, sightPhrasePos = 0, sightPhraseLen = 3 }) {
  const lc = L[lang];
  return (
        <div className="practiceov sightov">
          <div className="practicehdr">
            <div className="practicehtitle">{lc.sightTitle}<small>{lc.sightSub}</small></div>
            <button className="cbtn" onClick={exitSight}>{lc.close}</button>
          </div>
          <div className="practicebody">
            {sightDone ? (
              <div className="songresult">
                <div className="songstars">{"★".repeat(sightDone.acc >= 90 ? 3 : sightDone.acc >= 70 ? 2 : sightDone.acc >= 40 ? 1 : 0)}{"☆".repeat(3 - (sightDone.acc >= 90 ? 3 : sightDone.acc >= 70 ? 2 : sightDone.acc >= 40 ? 1 : 0))}</div>
                <div className="songresult-acc">{sightDone.acc}%</div>
                <div className="songresult-grid">
                  <div><span>{lc.sightScore}</span><b>{sightDone.correct}/{SIGHT_ROUND}</b></div>
                  <div><span>{lc.sightBestStreak}</span><b>{sightDone.bestStreak || 0}</b></div>
                  <div><span>EXP</span><b>+{sightDone.reward}</b></div>
                </div>
                <div className="songready-btns">
                  <button className="songbtn ghost" onClick={exitSight}>↩ {lc.back}</button>
                  <button className="songbtn go" onClick={openSight}>↻ {lc.sightAgain}</button>
                </div>
              </div>
            ) : (
              <>
                <div className="songhud">
                  <span>{lc.sightRoundLbl} <b>{Math.min(sightIdx + 1, SIGHT_ROUND)}/{SIGHT_ROUND}</b></span>
                  <span className="sightphrase" title={lc.sightPhraseHint}>{"●".repeat(sightPhrasePos)}{"○".repeat(Math.max(0, sightPhraseLen - sightPhrasePos))}</span>
                  <span>{lc.sightScore} <b>{sightScore}</b></span>
                  {sightStreak >= 2 && <span className="sightstreak">🔥 {sightStreak}</span>}
                </div>
                <div className="clefsel">
                  {[["treble", lc.sightTreble, "𝄞"], ["bass", lc.sightBass, "𝄢"], ["both", lc.sightBoth, "𝄞𝄢"]].map(([m, label, gly]) => (
                    <button key={m} className={`clefbtn${sightClef === m ? " on" : ""}`} onClick={() => pickSightClef(m)} aria-pressed={sightClef === m}>
                      <span className="clefgly">{gly}</span>{label}
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

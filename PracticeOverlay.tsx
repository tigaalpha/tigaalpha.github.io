import { L } from "./i18n";
import { Piano, pcOf } from "./music-engine";
import { tigaStrategyLabel } from "./tigamodel/web";
import { usePracticeCoach } from "./use-practice-coach";
/* ── PracticeOverlay ──
   The active practice-session full-screen overlay (practiceOpen), extracted
   verbatim from PianoApp's inline JSX as part of Phase 2 componentization —
   no logic changes. lc is derived from lang internally, same convention as
   PricingOverlay.

   practiceResult (added later, no longer "verbatim"): when finishPractice()
   sets it, this component shows an in-place result screen instead of the
   live drill body — same overlay, no page/chat navigation. practiceStreak
   drives an escalating combo badge next to the "heard" note while the drill
   is still live. ── */
// Combo badge escalates in tier, not just count — a small "you're on a roll"
// signal beyond the raw number, same spirit as a rhythm game's combo meter.
function comboBadge(streak) {
  if (streak < 3) return null;
  const fire = streak >= 8 ? "🔥🔥🔥" : streak >= 5 ? "🔥🔥" : "🔥";
  return `${fire} ×${streak}`;
}
function ResultBar({ label, pct, color }) {
  return (
    <div className="presultbar-row">
      <div className="presultbar-lbl">{label}</div>
      <div className="practicebar presultbar"><div className="practicefill" style={{ width: `${pct}%`, background: color }} /></div>
      <div className="presultbar-pct">{pct}%</div>
    </div>
  );
}
function PracticeResultView({ practiceResult, lang, lc, restartPractice, exitPractice, onKeepGoing, showKeepGoing, practiceTarget, metroBpm, onSetTempo }) {
  const r = practiceResult;
  const dynPct = r.dyn ? Math.round(r.dyn.ok / (r.dyn.ok + r.dyn.miss) * 100) : null;
  const rhythmPct = r.rhythm ? Math.round(r.rhythm.ok / (r.rhythm.ok + r.rhythm.miss) * 100) : null;
  const tierIcon = { bronze: "🥉", silver: "🥈", gold: "🥇" };
  return (
    <div className="practicebody presultwrap">
      {r.pathUnlocked && (
        <div className="punlock">
          <div className="punlock-ic">{tierIcon[r.pathUnlocked.tier] || "🏆"}</div>
          <div className="punlock-tt">{lc.pathUnlockedTitle}</div>
          <div className="punlock-sub">{r.pathUnlocked.label}</div>
        </div>
      )}
      {r.bossDefeated && (
        <div className="punlock pboss">
          <div className="punlock-ic">👑</div>
          <div className="punlock-tt">{lc.bossDefeatedTitle}</div>
          <div className="punlock-sub">{r.bossDefeated.label}</div>
        </div>
      )}
      {r.memoryStreak && r.memoryStreak.tierUp && (
        <div className="punlock pmemory">
          <div className="punlock-ic">{r.memoryStreak.tier ? r.memoryStreak.tier.icon : "🧠"}</div>
          <div className="punlock-tt">{lc.memoryStreakTierUp}</div>
          <div className="punlock-sub">{lc.memoryStreakLbl}: {r.memoryStreak.count}</div>
        </div>
      )}
      <div className="presulthead">
        <div className="presulttitle">{lc.practiceResultTitle}</div>
        <div className="presultsub">{r.label}</div>
        {r.isNewBest && <div className="presultbest">{lc.practiceNewBest}</div>}
      </div>

      <div className="presultstats">
        <div className="presultstat">
          <div className="presultstat-v">{r.accuracy}%</div>
          <div className="presultstat-l">{lc.practiceAcc}</div>
          {r.prevBest && <div className="presultstat-d">{lc.practiceBestLbl}: {r.prevBest.accuracy}%</div>}
        </div>
        <div className="presultstat">
          <div className="presultstat-v">🔥 {r.bestStreak}</div>
          <div className="presultstat-l">{lc.practiceStreakLbl}</div>
          {r.prevBest && <div className="presultstat-d">{lc.practiceBestLbl}: {r.prevBest.bestStreak}</div>}
        </div>
      </div>

      {(dynPct != null || rhythmPct != null) && (
        <div className="presultbars">
          {dynPct != null && <ResultBar label={lc.practiceDynLbl} pct={dynPct} color="#8ad4ff" />}
          {rhythmPct != null && <ResultBar label={lc.practiceRhythmLbl} pct={rhythmPct} color="#ffd23f" />}
        </div>
      )}

      {/* Conversion pill (strategy phase 2): only for free-plan learners and
          only after a genuinely good run (accuracy gate passed via prop) —
          the exact peak moment where an upgrade feels earned, not gated. */}
      {showKeepGoing && <button className="presultkeep" onClick={onKeepGoing}>{lang === "th" ? "🔥 ฟอร์มนี้กำลังมา — รักษาต่อกับครู TIGA AI ได้ทุกวัน" : lang === "zh" ? "🔥 状态正佳——每天与TIGA AI老师保持下去" : "🔥 You're on a roll — keep it going with Teacher TIGA AI daily"}</button>}

      {/* TIGA Model verdict — the teaching loop ran locally on this drill's
          real signals (accuracy/misses/pauses/rhythm). Always visible when it
          has something to say, guests included; the AI flourish below it is
          signed-in only. */}
      {r.tigaTip && r.tigaTip.text && (
        <div className="presultai" style={{ borderColor: "#d97757" }}>
          {/* Owner: the teacher is "ครู TIGA AI" everywhere on this screen. */}
          <div className="presultai-h">🧠 {lang === "th" ? "ครู TIGA AI วิเคราะห์" : lang === "zh" ? "TIGA AI模型分析" : "Teacher TIGA AI analysis"}{tigaStrategyLabel(r.tigaTip.strategyId, lang) ? ` · ${tigaStrategyLabel(r.tigaTip.strategyId, lang)}` : ""}</div>
          <div className="presultai-tx">{r.tigaTip.text}</div>
        </div>
      )}

      {/* ── TIGA Practice Coach (Phase 2, spec §34): tempo decision + 3-line
          recap + homework + next exercise — all from the model's real engines
          fed with THIS drill's real data. Sections hide honestly when the
          data doesn't exist (no BPM → no tempo line; the coach never shows
          invented numbers). ── */}
      <PracticeCoachCard lang={lang} lc={lc} practiceResult={r} rhythmPct={rhythmPct} dynPct={dynPct} practiceTarget={practiceTarget} metroBpm={metroBpm} onSetTempo={onSetTempo} restartPractice={restartPractice} />

      {(r.aiLoading || r.aiText) && (
        <div className="presultai">
          <div className="presultai-h">💬 {lc.practiceCoachSays}</div>
          {/* Waiting state is a real sentence, not an ellipsis: the analysis
              needs a moment, and "รอครู TIGA AI ประมวลผลสักครู่…" tells the
              learner (and their parent watching) exactly what's happening. */}
          {r.aiLoading
            ? <div className="presultai-loading">{lang === "th" ? "⏳ รอครู TIGA AI ประมวลผลสักครู่…" : lang === "zh" ? "⏳ 等待TIGA AI老师分析中…" : "⏳ Teacher TIGA AI is analyzing, one moment…"}</div>
            : <div className="presultai-tx">{r.aiText}</div>}
        </div>
      )}
    </div>
  );
}
export function PracticeOverlay({ practiceModeRef, chordStyle, practiceTarget, practiceHitIdxs, practiceFingers, lang, practiceLabel, exitPractice, practiceSrc, practiceTune, hand, setHand, practiceIdx, practiceHeard, practiceMiss, practiceStreak = 0, practiceResult = null, restartPractice, practiceHandlerRef, switchPracticeChordStyle, chordGroupSize = 0, onKeepGoing, showKeepGoing = false, metroBpm = null, onSetTempo = null }) {
  const lc = L[lang];
        // Grading (use-practice-mode) treats BOTH chord and progression drills
        // as block-style when the toggle says so — the display must gate on the
        // same modes, or a block progression would show broken-style single-note
        // hints while the grader accepts whole-chord windows.
        const isBlockMode = (practiceModeRef.current === "chord" || practiceModeRef.current === "prog") && chordStyle === "block";
        // A chord-PROGRESSION drill lights only the CURRENT chord's remaining
        // notes (windows are uniform and full, so floor(practiceIdx / size)
        // recovers the window's start from the whole-drill progress count); a
        // plain chord/interval keeps the original whole-target display.
        const progWin = isBlockMode && chordGroupSize > 0 && chordGroupSize < practiceTarget.length
          ? Math.floor(practiceIdx / chordGroupSize) * chordGroupSize : -1;
        const remainingIdxs = isBlockMode
          ? (progWin >= 0
              ? practiceTarget.map((_, i) => i).filter(i => i >= progWin && i < Math.min(practiceTarget.length, progWin + chordGroupSize) && !practiceHitIdxs.includes(i))
              : practiceTarget.map((_, i) => i).filter(i => !practiceHitIdxs.includes(i)))
          : [];
        const remainingNotes = isBlockMode ? remainingIdxs.map(i => practiceTarget[i]) : [];
        const remainingFingerMap = isBlockMode
          ? remainingIdxs.reduce((m, i) => { if (practiceFingers[i] != null) m[practiceTarget[i]] = practiceFingers[i]; return m; }, {})
          : {};
  if (practiceResult) {
    return (
      <div className="practiceov">
        <div className="practicehdr">
          <div className="practicehtitle">{lc.practiceTitle}<small>{practiceLabel}</small></div>
          <button className="cbtn" onClick={exitPractice}>{lc.close}</button>
        </div>
        <PracticeResultView practiceResult={practiceResult} lang={lang} lc={lc} restartPractice={restartPractice} exitPractice={exitPractice} onKeepGoing={onKeepGoing} showKeepGoing={showKeepGoing} practiceTarget={practiceTarget} metroBpm={metroBpm} onSetTempo={onSetTempo} />
        <div className="practicefoot">
          <button className="practicerestart" onClick={restartPractice}>↻ {lc.practiceRestart}</button>
          <button className="practiceexit" onClick={exitPractice}>✕ {lc.practiceExit}</button>
        </div>
      </div>
    );
  }
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
            {/* Every route that is actually live, not just the first one that
                answered. MIDI, the microphone and the on-screen keys all feed
                the same handler at the same time, so the badge lists them —
                a learner who can see "keyboard + mic + screen" knows the tap
                they just made was heard, rather than guessing. */}
            <div className={`practicesrc${practiceSrc && practiceSrc.type === "error" ? " err" : ""}`}>
              {!practiceSrc ? "…" : practiceSrc.type === "error" ? lc.practiceMicErr : (() => {
                const all = practiceSrc.all || [practiceSrc.type];
                const parts = [];
                if (all.includes("midi")) parts.push(lc.practiceMidi);
                if (all.includes("mic")) parts.push(practiceTune != null ? `${lc.practiceMic} · 🎚 ${practiceTune > 0 ? "+" : ""}${practiceTune}¢` : lc.practiceMic);
                parts.push("👆");
                return parts.join(" + ");
              })()}
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
              {comboBadge(practiceStreak) && <span key={practiceStreak} className="sightstreak practicecombo">{comboBadge(practiceStreak)}</span>}
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

/* ── TIGA Practice Coach card (Phase 2, spec §34): the model's tempo
   decision, 3-line recap, homework and the next exercise — rendered from
   usePracticeCoach's real-data builder. Sections hide when data is absent. ── */
function PracticeCoachCard({ lang, lc, practiceResult, rhythmPct, dynPct, practiceTarget, metroBpm, onSetTempo, restartPractice }) {
  const r = practiceResult || {};
  const missed = (r.miss != null && r.miss > 0) ? null : null; // missed NOTES (pitch-level) come from noteMisses in tg_memory; the builder reads them itself
  const data = usePracticeCoach({
    label: r.label || null,
    accuracy: r.accuracy,
    missedNotes: (r.tigaTip && r.tigaTip.states && r.tigaTip.states.repeatedErrorLabel) ? [r.tigaTip.states.repeatedErrorLabel] : [],
    rhythmPct, dynPct, practiceTarget, metroBpm,
    prevAccuracy: (r.prevBest && r.prevBest.accuracy) || null,
    strategyId: (r.tigaTip && r.tigaTip.strategyId) || null,
  });
  if (!data) return null;
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const L = lang || "th";
  const tempo = data.tempo;
  const recap = data.recap;
  const ex = data.exercise;
  const tx = (o) => (o ? (o[L] || o.en || o.th) : null);
  return (
    <div className="presultai pcoach" style={{ borderColor: "#8ad4ff" }}>
      <div className="presultai-h">🎯 {T("ครู TIGA Practice Coach", "Teacher TIGA Practice Coach", "TIGA 练习教练")}</div>

      {tempo && (
        <div className="pcoach-tempo">
          <b>{tempo.bpm} BPM</b>
          <span className="pcoach-why">{tempo.step > 0 ? `▲ +${tempo.step}` : tempo.step < 0 ? `▼ ${tempo.step}` : "▬"} {tempo.reason}</span>
          {onSetTempo && <button className="pcoach-btn" onClick={() => onSetTempo(tempo.bpm)}>⏱ {T("ตั้งเมโทรนอม", "Set metronome", "设置节拍器")}</button>}
        </div>
      )}

      {recap && recap.lines && recap.lines.length > 0 && (
        <div className="pcoach-recap">
          {recap.lines.map((ln, i) => <div key={i} className="presultai-tx">• {tx(ln)}</div>)}
          {recap.homework && <div className="pcoach-hw">📝 {tx(recap.homework)}</div>}
        </div>
      )}

      {ex && (
        <div className="pcoach-ex">
          <div className="pcoach-ex-t">➡️ {T("แบบฝึกหัดถัดไป", "Next exercise", "下一个练习")}: <b>{tx(ex.title) || ex.title}</b></div>
          <div className="presultai-tx">{tx(ex.task) || ex.task}</div>
          {Array.isArray(ex.steps) && ex.steps.length > 0 && (
            <ol className="pcoach-steps">
              {ex.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          )}
          {ex.check && <div className="pcoach-check">✓ {ex.check}</div>}
        </div>
      )}
    </div>
  );
}

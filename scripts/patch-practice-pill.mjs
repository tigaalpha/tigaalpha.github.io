/* One-off patch — conversion pill on the practice-result screen (strategy
   phase 2 / peak-moment upsell). Applied via Node with literal anchors +
   idempotence guards (this tool's str_replace has been out of sync with
   this file before). */
import { readFileSync, writeFileSync } from "node:fs";

const F = "PracticeOverlay.tsx";
let s = readFileSync(F, "utf8");
let fails = 0;
function rep(oldStr, newStr, label) {
  if (s.includes(newStr)) { console.log(`ok (already): ${label}`); return; }
  if (!s.includes(oldStr)) { console.error(`MISS: ${label}`); fails++; return; }
  s = s.split(oldStr).join(newStr);
  console.log(`patched: ${label}`);
}

/* 1. PracticeResultView gains the pill props */
rep(
  `function PracticeResultView({ practiceResult, lang, lc, restartPractice, exitPractice }) {`,
  `function PracticeResultView({ practiceResult, lang, lc, restartPractice, exitPractice, onKeepGoing, showKeepGoing }) {`,
  "PracticeResultView signature",
);

/* 2. the pill itself, right under the stat bars */
rep(
  `      {(dynPct != null || rhythmPct != null) && (
        <div className="presultbars">
          {dynPct != null && <ResultBar label={lc.practiceDynLbl} pct={dynPct} color="#8ad4ff" />}
          {rhythmPct != null && <ResultBar label={lc.practiceRhythmLbl} pct={rhythmPct} color="#ffd23f" />}
        </div>
      )}`,
  `      {(dynPct != null || rhythmPct != null) && (
        <div className="presultbars">
          {dynPct != null && <ResultBar label={lc.practiceDynLbl} pct={dynPct} color="#8ad4ff" />}
          {rhythmPct != null && <ResultBar label={lc.practiceRhythmLbl} pct={rhythmPct} color="#ffd23f" />}
        </div>
      )}

      {/* Conversion pill (strategy phase 2): only for free-plan learners and
          only after a genuinely good run (accuracy gate passed via prop) —
          the exact peak moment where an upgrade feels earned, not gated. */}
      {showKeepGoing && <button className="presultkeep" onClick={onKeepGoing}>{lang === "th" ? "🔥 ฟอร์มนี้กำลังมา — รักษาต่อกับครู TIGA AI ได้ทุกวัน" : lang === "zh" ? "🔥 状态正佳——每天与TIGA AI老师保持下去" : "🔥 You're on a roll — keep it going with Teacher TIGA AI daily"}</button>}`,
  "keep-going pill",
);

/* 3. PracticeOverlay passes them through */
rep(
  `function PracticeOverlay({ practiceModeRef, chordStyle, practiceTarget, practiceHitIdxs, practiceFingers, lang, practiceLabel, exitPractice, practiceSrc, practiceTune, hand, setHand, practiceIdx, practiceHeard, practiceMiss, practiceStreak = 0, practiceResult = null, restartPractice, practiceHandlerRef, switchPracticeChordStyle, chordGroupSize = 0 }) {`,
  `function PracticeOverlay({ practiceModeRef, chordStyle, practiceTarget, practiceHitIdxs, practiceFingers, lang, practiceLabel, exitPractice, practiceSrc, practiceTune, hand, setHand, practiceIdx, practiceHeard, practiceMiss, practiceStreak = 0, practiceResult = null, restartPractice, practiceHandlerRef, switchPracticeChordStyle, chordGroupSize = 0, onKeepGoing, showKeepGoing = false }) {`,
  "PracticeOverlay signature",
);
rep(
  `<PracticeResultView practiceResult={practiceResult} lang={lang} lc={lc} restartPractice={restartPractice} exitPractice={exitPractice} />`,
  `<PracticeResultView practiceResult={practiceResult} lang={lang} lc={lc} restartPractice={restartPractice} exitPractice={exitPractice} onKeepGoing={onKeepGoing} showKeepGoing={showKeepGoing} />`,
  "result view props",
);

if (fails) { console.error(`${fails} MISS`); process.exit(1); }
writeFileSync(F, s);
console.log("PracticeOverlay.tsx written");

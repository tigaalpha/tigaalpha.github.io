/* One-off patch — Practice Mode v4 Step 1 (plan docs/PRACTICE_MODE_V2_PLAN.md
   runbook §6 Step 1: D1 events + A1 Spot Drill + A2 per-note chips):

   use-practice-mode.ts — flush wrongByIdx into result + event, export refs/starter
   PracticeOverlay.tsx  — spot button card on the result screen + live 3-color chips
   i18n.ts             — practiceSpotBtn/practiceSpotN in th/en/zh
   app-styles.ts       — .pchip--ok/--retry/--miss chip colors
   App.tsx             — destructure + wire the two new props into PracticeOverlay

   str_replace is out of sync with App.tsx (recurring) — applied via Node
   with literal anchors + idempotence guards, same as patch-conversion.mjs. */
import { readFileSync, writeFileSync } from "node:fs";

let fails = 0;
function rep(file, oldStr, newStr, label) {
  let s = readFileSync(file, "utf8");
  if (s.includes(newStr)) { console.log(`ok (already): ${label}`); return; }
  if (!s.includes(oldStr)) { console.error(`MISS: ${label} (${file})`); fails++; return; }
  s = s.split(oldStr).join(newStr);
  writeFileSync(file, s);
  console.log(`patched: ${label}`);
}
function append(file, add, label, marker) {
  let s = readFileSync(file, "utf8");
  if (s.includes(marker)) { console.log(`ok (already): ${label}`); return; }
  writeFileSync(file, s + add);
  console.log(`patched: ${label}`);
}

const PM = "use-practice-mode.ts";
const OV = "PracticeOverlay.tsx";
const I18 = "i18n.ts";
const ST = "app-styles.ts";
const A = "App.tsx";

/* ── use-practice-mode.ts: flush + exports ── */
rep(PM,
  `      strategyText: tigaTip && tigaTip.text ? tigaTip.text : null } })); } catch (e) {}`,
  `      strategyText: tigaTip && tigaTip.text ? tigaTip.text : null,
      spotUsed: wrongByIdxIsSpot === true, // Practice v4 D1: ต่อยอด event เดิม — ผู้ดูแลเห็น adoption ของ Spot Drill ได้จาก event เดียวกัน
      wrongByIdx: wrongByIdxSnap } })); } catch (e) {}`,
  "pm: event spotUsed + wrongByIdx",
);
rep(PM,
  `      strategyText: tigaTip && tigaTip.text ? tigaTip.text : null,
      spotUsed: wrongByIdxIsSpot === true, // Practice v4 D1: ต่อยอด event เดิม — ผู้ดูแลเห็น adoption ของ Spot Drill ได้จาก event เดียวกัน
      wrongByIdx: wrongByIdxSnap } })); } catch (e) {}`,
  `      strategyText: tigaTip && tigaTip.text ? tigaTip.text : null,
      spotUsed: wrongByIdxIsSpot === true, // Practice v4 D1: ต่อยอด event เดิม — ผู้ดูแลเห็น adoption ของ Spot Drill ได้จาก event เดียวกัน
      wrongByIdx: wrongByIdxSnap } })); } catch (e) {}
    practiceIsSpotRef.current = false; // flag consumed for this run (set again by the next startSpotPractice)`,
  "pm: consume isSpot flag after event",
);
rep(PM,
  `runFinishTeachingAndResult({ label, total, hits, miss, accuracy, bestStreak, dyn, rhythm, prevBest, isNewBest, pathUnlocked, bossDefeated, memoryStreak });`,
  `runFinishTeachingAndResult({ label, total, hits, miss, accuracy, bestStreak, dyn, rhythm, prevBest, isNewBest, pathUnlocked, bossDefeated, memoryStreak, wrongByIdx: wrongByIdxSnap, spotUsed: practiceIsSpotRef.current === true });`,
  "pm: pass wrongByIdx/spotUsed into result ctx",
);
rep(PM,
  `    const { label, total, hits, miss, accuracy, bestStreak, dyn, rhythm, prevBest, isNewBest, pathUnlocked, bossDefeated, memoryStreak } = ctx;`,
  `    const { label, total, hits, miss, accuracy, bestStreak, dyn, rhythm, prevBest, isNewBest, pathUnlocked, bossDefeated, memoryStreak, wrongByIdx: wrongByIdxSnap, spotUsed: wrongByIdxIsSpot } = ctx;`,
  "pm: destructure wrongByIdx/spotUsed in result fn",
);
rep(PM,
  `memoryStreak, aiText: null, aiLoading: !isGuest, tigaTip });`,
  `memoryStreak, aiText: null, aiLoading: !isGuest, tigaTip, wrongByIdx: wrongByIdxSnap, spotUsed: wrongByIdxIsSpot });`,
  "pm: result snapshot carries wrongByIdx (A2 render data)",
);
rep(PM,
  `practiceBestStreakRef, practiceLabelRef, practiceHandlerRef, practiceHeardTimer,`,
  `practiceBestStreakRef, practiceLabelRef, practiceWrongByIdxRef, practiceHandlerRef, practiceHeardTimer,`,
  "pm: export practiceWrongByIdxRef",
);
rep(PM,
  `exitPractice, finishPractice, replayDrill };`,
  `exitPractice, finishPractice, replayDrill, startSpotPractice };`,
  "pm: export startSpotPractice",
);

/* ── PracticeOverlay.tsx ── */
rep(OV,
  `import { usePracticeCoach } from "./use-practice-coach";`,
  `import { usePracticeCoach } from "./use-practice-coach";\nimport { SPOT_CAP_NOTES } from "./practice-spot";`,
  "ov: import SPOT_CAP_NOTES",
);
rep(OV,
  `function PracticeResultView({ practiceResult, lang, lc, restartPractice, exitPractice, onKeepGoing, showKeepGoing, practiceTarget, metroBpm, onSetTempo, onTipUpdate }) {
  const r = practiceResult;`,
  `function PracticeResultView({ practiceResult, lang, lc, restartPractice, exitPractice, onKeepGoing, showKeepGoing, practiceTarget, metroBpm, onSetTempo, onTipUpdate, startSpotPractice }) {
  const r = practiceResult;
  // Practice v4 A1/A2: per-index miss counts flushed by finishPractice into the
  // result snapshot — chips render the exact missed notes; the launcher's count
  // is capped by the same SPOT_CAP_NOTES the cutter enforces.
  const wrongByIdx = (r && r.wrongByIdx) || {};
  const missIdxs = Object.keys(wrongByIdx).map(Number).filter(n => !isNaN(n) && practiceTarget && practiceTarget[n]).sort((a, b) => a - b);
  const spotN = Math.min(missIdxs.length, SPOT_CAP_NOTES);`,
  "ov: result view spot data",
);
rep(OV,
  `      <div className="presultstats">`,
  `      {/* Practice v4 A1: Spot Drill launcher — only when the just-finished
          round actually missed something (honest hide otherwise). The cut
          itself is buildSpotTarget's contract, proven by smoke S1-S8. */}
      {startSpotPractice && spotN > 0 && (
        <div className="presultai pspot">
          <div className="presultai-h">🎯 {lc.practiceSpotBtn}</div>
          <div className="presultai-tx">{lc.practiceSpotN.replace("{n}", String(spotN))}</div>
          <div>{missIdxs.map(i => (
            <span key={i} className="pchip pchip--miss">{pcOf(practiceTarget[i])}</span>
          ))}</div>
          <button className="atpopup-ok" style={{ marginTop: 8 }} onClick={startSpotPractice}>🎯 {lc.practiceSpotBtn}</button>
        </div>
      )}

      <div className="presultstats">`,
  "ov: spot launcher card",
);
rep(OV,
  `export function PracticeOverlay({ practiceModeRef, chordStyle, practiceTarget, practiceHitIdxs, practiceFingers, lang, practiceLabel, exitPractice, practiceSrc, practiceTune, hand, setHand, practiceIdx, practiceHeard, practiceMiss, practiceStreak = 0, practiceResult = null, restartPractice, practiceHandlerRef, switchPracticeChordStyle, chordGroupSize = 0,`,
  `export function PracticeOverlay({ practiceModeRef, chordStyle, practiceTarget, practiceHitIdxs, practiceFingers, lang, practiceLabel, exitPractice, practiceSrc, practiceTune, hand, setHand, practiceIdx, practiceHeard, practiceMiss, practiceStreak = 0, practiceResult = null, restartPractice, practiceHandlerRef, practiceWrongByIdxRef = null, switchPracticeChordStyle, startSpotPractice = null, chordGroupSize = 0,`,
  "ov: new props",
);
rep(OV,
  `<PracticeResultView practiceResult={practiceResult} lang={lang} lc={lc} restartPractice={restartPractice} exitPractice={exitPractice} onKeepGoing={onKeepGoing} showKeepGoing={showKeepGoing} practiceTarget={practiceTarget} metroBpm={metroBpm} onSetTempo={onSetTempo} onTipUpdate={onTipUpdate} />`,
  `<PracticeResultView practiceResult={practiceResult} lang={lang} lc={lc} restartPractice={restartPractice} exitPractice={exitPractice} onKeepGoing={onKeepGoing} showKeepGoing={showKeepGoing} practiceTarget={practiceTarget} metroBpm={metroBpm} onSetTempo={onSetTempo} onTipUpdate={onTipUpdate} startSpotPractice={startSpotPractice} />`,
  "ov: pass startSpotPractice to result view",
);
rep(OV,
  `        const remainingFingerMap = isBlockMode
          ? remainingIdxs.reduce((m, i) => { if (practiceFingers[i] != null) m[practiceTarget[i]] = practiceFingers[i]; return m; }, {})
          : {};`,
  `        const remainingFingerMap = isBlockMode
          ? remainingIdxs.reduce((m, i) => { if (practiceFingers[i] != null) m[practiceTarget[i]] = practiceFingers[i]; return m; }, {})
          : {};
        // Practice v4 A2: misses so far THIS round — a chip the learner keeps
        // missing turns amber live (fresh read on every miss-driven re-render;
        // practiceMiss state changes guarantee the re-render). Flushed into the
        // result snapshot at finish, where the spot launcher reads it.
        const liveMissMap = practiceWrongByIdxRef && practiceWrongByIdxRef.current
          ? Object.fromEntries(practiceWrongByIdxRef.current) : {};`,
  "ov: liveMissMap",
);
rep(OV,
  `                <span key={i} className={\`pchip\${isBlockMode
                  ? (practiceHitIdxs.includes(i) ? " done" : "")
                  : (i < practiceIdx ? " done" : i === practiceIdx ? " cur" : "")}\`}>`,
  `                <span key={i} className={\`pchip\${isBlockMode
                  ? (practiceHitIdxs.includes(i) ? " done" : liveMissMap[i] ? " pchip--retry" : "")
                  : (i < practiceIdx ? " done" : i === practiceIdx ? " cur" : liveMissMap[i] ? " pchip--retry" : "")}\`}>`,
  "ov: 3-color chips (A2)",
);

/* ── i18n.ts (§2.5 — the two keys this step needs, all three languages) ── */
rep(I18,
  `    practiceRestart: "เริ่มใหม่", practiceExit: "ออก",`,
  `    practiceRestart: "เริ่มใหม่", practiceExit: "ออก",
    practiceSpotBtn: "🎯 ซ้อมเฉพาะจุดพลาด", practiceSpotN: "รวบโน้ตที่พลาดจากรอบเมื่อกี้ {n} ตัว — เริ่มเลย",`,
  "i18n: th spot keys",
);
rep(I18,
  `    practiceRestart: "Restart", practiceExit: "Exit",`,
  `    practiceRestart: "Restart", practiceExit: "Exit",
    practiceSpotBtn: "🎯 Spot drill: missed notes", practiceSpotN: "Drill the {n} notes you missed last round",`,
  "i18n: en spot keys",
);
rep(I18,
  `    practiceRestart: "重新开始", practiceExit: "退出",`,
  `    practiceRestart: "重新开始", practiceExit: "退出",
    practiceSpotBtn: "🎯 专练错音", practiceSpotN: "把上一轮错的 {n} 个音集中练一遍",`,
  "i18n: zh spot keys",
);

/* ── app-styles.ts (A2 chip colors) ── */
append(ST,
  `
/* Practice Mode v4 (plan §4): per-note miss-state chips (A2) — green = clean
   hit is the existing .pchip.done; amber = missed this round; red = was
   missed at finish (spot launcher list) */
.pchip--ok{background:rgba(52,199,89,.14);border-color:#34c759;color:#34c759}
.pchip--retry{background:rgba(255,159,10,.14);border-color:#ffa502;color:#ffa502}
.pchip--miss{background:rgba(255,82,82,.14);border-color:#ff5252;color:#ff5252}
.pspot{text-align:left}
.pspot .pchip{margin:2px}
`,
  "styles: pchip miss colors",
  ".pchip--miss",
);

/* ── App.tsx wiring ── */
rep(A,
  `exitPractice, finishPractice, replayDrill } = usePracticeMode({ hand, chordStyle,`,
  `exitPractice, finishPractice, replayDrill, startSpotPractice } = usePracticeMode({ hand, chordStyle,`,
  "app: destructure startSpotPractice",
);
rep(A,
  `practiceLabelRef, practiceHandlerRef, practiceHeardTimer, tuneOffsetRef, notePitchMatches,`,
  `practiceLabelRef, practiceWrongByIdxRef, practiceHandlerRef, practiceHeardTimer, tuneOffsetRef, notePitchMatches,`,
  "app: destructure practiceWrongByIdxRef",
);
rep(A,
  `switchPracticeChordStyle={switchPracticeChordStyle} /></SafeZone>}`,
  `switchPracticeChordStyle={switchPracticeChordStyle} startSpotPractice={startSpotPractice} practiceWrongByIdxRef={practiceWrongByIdxRef} /></SafeZone>}`,
  "app: wire new props into PracticeOverlay",
);

if (fails) { console.error(`\\n${fails} MISS — nothing written for those anchors`); process.exit(1); }
console.log("\\nPractice v4 Step 1 patch complete.");

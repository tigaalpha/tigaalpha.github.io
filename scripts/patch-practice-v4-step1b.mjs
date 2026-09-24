/* Follow-up mini-patch for Step 1 (§2.5/§2.6 leftovers):
   - spot card dismiss button → logUsage("practice","spot:clear")
   - practiceSpotDone line on a finished spot round's result
   - rename the confusing destructured alias wrongByIdxIsSpot → isSpotRun
   Same literal-anchor + idempotence approach. */
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

const PM = "use-practice-mode.ts";
const OV = "PracticeOverlay.tsx";
const I18 = "i18n.ts";

/* rename alias in use-practice-mode.ts (3 usages + destructure) */
rep(PM,
  `spotUsed: wrongByIdxIsSpot === true, // Practice v4 D1`,
  `spotUsed: isSpotRun === true, // Practice v4 D1`,
  "pm: rename event alias",
);
rep(PM,
  `practiceIsSpotRef.current = false; // flag consumed for this run (set again by the next startSpotPractice)`,
  `practiceIsSpotRef.current = false; // flag consumed for this run (set again by the next startSpotPractice); isSpotRun captured before this reset`,
  "pm: comment the capture order",
);
rep(PM,
  `wrongByIdx: wrongByIdxSnap, spotUsed: practiceIsSpotRef.current === true });`,
  `wrongByIdx: wrongByIdxSnap, spotUsed: practiceIsSpotRef.current === true }); // captured BEFORE the flag reset above? no — this runs first; the reset is after the event dispatch`,
  "pm: ctx pass note",
);
rep(PM,
  `wrongByIdx: wrongByIdxSnap, spotUsed: wrongByIdxIsSpot });`,
  `wrongByIdx: wrongByIdxSnap, spotUsed: isSpotRun });`,
  "pm: result snapshot alias",
);
rep(PM,
  `wrongByIdx: wrongByIdxSnap, spotUsed: wrongByIdxIsSpot } = ctx;`,
  `wrongByIdx: wrongByIdxSnap, spotUsed: isSpotRun } = ctx;`,
  "pm: destructure alias",
);

/* spot card dismiss + spotDone line */
rep(OV,
  `      {startSpotPractice && spotN > 0 && (
        <div className="presultai pspot">
          <div className="presultai-h">🎯 {lc.practiceSpotBtn}</div>
          <div className="presultai-tx">{lc.practiceSpotN.replace("{n}", String(spotN))}</div>
          <div>{missIdxs.map(i => (
            <span key={i} className="pchip pchip--miss">{pcOf(practiceTarget[i])}</span>
          ))}</div>
          <button className="atpopup-ok" style={{ marginTop: 8 }} onClick={startSpotPractice}>🎯 {lc.practiceSpotBtn}</button>
        </div>
      )}`,
  `      {startSpotPractice && spotN > 0 && !spotCleared && (
        <div className="presultai pspot">
          <div className="presultai-h">🎯 {lc.practiceSpotBtn}
            <button className="atpopup-x" style={{ float: "right" }} aria-label="close" onClick={() => { try { logUsage("practice", "spot:clear"); } catch (e) {} setSpotCleared(true); }}>×</button>
          </div>
          <div className="presultai-tx">{lc.practiceSpotN.replace("{n}", String(spotN))}</div>
          <div>{missIdxs.map(i => (
            <span key={i} className="pchip pchip--miss">{pcOf(practiceTarget[i])}</span>
          ))}</div>
          <button className="atpopup-ok" style={{ marginTop: 8 }} onClick={startSpotPractice}>🎯 {lc.practiceSpotBtn}</button>
        </div>
      )}`,
  "ov: spot card dismiss (spot:clear)",
);
rep(OV,
  `  const spotN = Math.min(missIdxs.length, SPOT_CAP_NOTES);`,
  `  const spotN = Math.min(missIdxs.length, SPOT_CAP_NOTES);
  // §2.6 spot:clear — dismissing the launcher logs it (KPI guard: a clear is
  // not a start). Local state only; a new result resets the card naturally.
  const [spotCleared, setSpotCleared] = useState(false);
  useEffect(() => { setSpotCleared(false); }, [r && r.label]);`,
  "ov: spotCleared state",
);
rep(OV,
  `      {(dynPct != null || rhythmPct != null) && (`,
  `      {/* §2.5 practiceSpotDone: a just-finished SPOT round says so — the
          learner knows the small loop paid off and the full drill is next. */}
      {r.spotUsed && <div className="presultsub" style={{ color: "#34c759" }}>✓ {lc.practiceSpotDone}</div>}

      {(dynPct != null || rhythmPct != null) && (`,
  "ov: practiceSpotDone line",
);
rep(OV,
  `import { useState, useEffect } from "react";`,
  `import { useState, useEffect } from "react";\nimport { logUsage } from "./shared-infra";`,
  "ov: import logUsage",
);

/* i18n practiceSpotDone (th/en/zh) */
rep(I18,
  `    practiceSpotBtn: "🎯 ซ้อมเฉพาะจุดพลาด", practiceSpotN: "รวบโน้ตที่พลาดจากรอบเมื่อกี้ {n} ตัว — เริ่มเลย",`,
  `    practiceSpotBtn: "🎯 ซ้อมเฉพาะจุดพลาด", practiceSpotN: "รวบโน้ตที่พลาดจากรอบเมื่อกี้ {n} ตัว — เริ่มเลย", practiceSpotDone: "จุดพลาดซ้อมแล้ว — กลับไปเล่นรอบเต็มดูสิ!",`,
  "i18n: th spotDone",
);
rep(I18,
  `    practiceSpotBtn: "🎯 Spot drill: missed notes", practiceSpotN: "Drill the {n} notes you missed last round",`,
  `    practiceSpotBtn: "🎯 Spot drill: missed notes", practiceSpotN: "Drill the {n} notes you missed last round", practiceSpotDone: "Spot drilled — now try the full round again!",`,
  "i18n: en spotDone",
);
rep(I18,
  `    practiceSpotBtn: "🎯 专练错音", practiceSpotN: "把上一轮错的 {n} 个音集中练一遍",`,
  `    practiceSpotBtn: "🎯 专练错音", practiceSpotN: "把上一轮错的 {n} 个音集中练一遍", practiceSpotDone: "错音已专练——回去再练完整一遍吧！",`,
  "i18n: zh spotDone",
);

if (fails) { console.error(`\n${fails} MISS`); process.exit(1); }
console.log("Step 1 follow-up patch complete.");

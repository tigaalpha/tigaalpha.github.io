// One-shot patcher: UI wiring for Play Along plan items 1/3/4/8.
// - App.tsx: destructure the new exports from usePlayAlong, pass them to SongPlayOverlay.
// - SongPlayOverlay.tsx: accept props; HUD boss bar, drill heat-map card on result screen,
//   knowledge-drop toast, knowledge shelf modal, backing progress label.
import { readFileSync, writeFileSync } from "node:fs";

function must(cond, msg) { if (!cond) { console.error("FAIL: " + msg); process.exit(1); } }

/* ════════ App.tsx ════════ */
let A = "App.tsx";
let s = readFileSync(A, "utf8");
const origA = s;

// 1) destructure new exports (anchor on startPvpTogether which plan #10 already added)
const dAnchor = `startSetlist, playAlongHand, changePlayAlongHand } = usePlayAlong(`;
must(s.includes(dAnchor), "App destructure anchor missing");
must(!s.includes("drillPlan, drillActive, startDrill"), "App destructure already patched");
s = s.replace(dAnchor, `startSetlist, playAlongHand, changePlayAlongHand, drillPlan, drillActive, startDrill, endDrill, bossOn, bossHp, bossMax, bossFx, kDrop, kShelfOpen, setKShelfOpen, kShelf, openKnowledgeShelf } = usePlayAlong(`);

// 2) add props to SongPlayOverlay mount (anchor on the last prop)
const mAnchor = `metroBpm={metroBpm} setSongPhase={setSongPhase} />}`;
must(s.includes(mAnchor), "App mount anchor missing");
must(!s.includes("drillPlan={drillPlan}"), "App mount already patched");
s = s.replace(mAnchor, `metroBpm={metroBpm} setSongPhase={setSongPhase} drillPlan={drillPlan} drillActive={drillActive} startDrill={startDrill} endDrill={endDrill} bossOn={bossOn} bossHp={bossHp} bossMax={bossMax} bossFx={bossFx} kDrop={kDrop} kShelfOpen={kShelfOpen} setKShelfOpen={setKShelfOpen} kShelf={kShelf} openKnowledgeShelf={openKnowledgeShelf} />}`);

writeFileSync(A, s);
console.log("App.tsx patched, delta:", s.length - origA.length);

/* ════════ SongPlayOverlay.tsx ════════ */
let B = "SongPlayOverlay.tsx";
let t = readFileSync(B, "utf8");
const origB = t;

// 1) accept new props in the signature
const sigAnchor = `playAlongHand, changePlayAlongHand, setSongPhase }) {`;
must(t.includes(sigAnchor), "overlay signature anchor missing");
must(!t.includes("drillPlan,"), "overlay signature already patched");
t = t.replace(sigAnchor, `playAlongHand, changePlayAlongHand, setSongPhase, drillPlan, drillActive, startDrill, endDrill, bossOn, bossHp, bossMax, bossFx, kDrop, kShelfOpen, setKShelfOpen, kShelf, openKnowledgeShelf }) {`);

writeFileSync(B, t);
console.log("SongPlayOverlay signature patched, delta:", t.length - origB.length);

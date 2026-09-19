// Corrective patcher for use-play-along.ts (plan items 1/3/4/8).
// The first engine patch ran before bossMax/armBoss were added to the patcher,
// and the drill logic had ordering bugs: startSongPlay resets the drill window
// and tempo AFTER startDrill sets them, and the ladder started at 1× instead
// of 0.75×. This patcher fixes all of it against the CURRENT file state.
import { readFileSync, writeFileSync } from "node:fs";

function must(cond, msg) { if (!cond) { console.error("FAIL: " + msg); process.exit(1); } }

const P = "use-play-along.ts";
let s = readFileSync(P, "utf8");
const orig = s;

/* ── 1) bossMax state (missing — patcher edit came after the engine patch ran) ── */
if (!s.includes("const [bossMax, setBossMax]")) {
  const a = "  const [bossHp, setBossHp] = useState(0);               // reactive: HP bar in the HUD";
  must(s.includes(a), "bossHp state anchor");
  s = s.replace(a, a + "\n  const [bossMax, setBossMax] = useState(0);             // reactive: HP ceiling for the bar");
}

/* ── 2) setBossMax in startSongPlay init ── */
if (!s.includes("setBossMax(bossMaxRef.current);")) {
  const a = `    bossMaxRef.current = Math.max(1, bossHpRef.current);
    setBossHp(bossHpRef.current);
    setBossOn(true);`;
  must(s.includes(a), "boss init anchor");
  s = s.replace(a, `    bossMaxRef.current = Math.max(1, bossHpRef.current);
    setBossHp(bossHpRef.current);
    setBossMax(bossMaxRef.current);
    setBossOn(true);`);
}

/* ── 3) armBoss helper (missing) ── */
if (!s.includes("function armBoss()")) {
  const a = "  // #3: one boss-fx flash at a time (hit / defeat / attack)\n  function bossFlash(kind) {";
  must(s.includes(a), "bossFlash anchor");
  s = s.replace(a, `  // #3: arm/reset the boss from the UI (result-screen retry, drill re-entry)
  function armBoss() {
    const total = songTotalRef.current || (songDataRef.current && songDataRef.current.total) || 0;
    bossHpRef.current = bossHpFor(total);
    bossMaxRef.current = Math.max(1, bossHpRef.current);
    setBossHp(bossHpRef.current);
    setBossMax(bossMaxRef.current);
    setBossOn(true);
  }
` + a);
}

/* ── 4) drillPlanRef declaration (stale-closure fix for the HUD climb) ── */
if (!s.includes("const drillPlanRef")) {
  const a = `  const drillStartSecRef = useRef(null);   // #1 Mistake Loop window start (sec) or null`;
  must(s.includes(a), "drill refs anchor");
  s = s.replace(a, `  const drillPlanRef = useRef(null);       // #1 mirrors drillPlan state for HUD-timer closures
` + a);
}

/* ── 5) startDrill: correct order (window/tempo set AFTER startSongPlay's sync
   reset) + ladder starts at min(0.75, songTempo) + optional forced rung ── */
const sdOld = `  function startDrill(seg) {
    if (!seg) return;
    drillSavedTempoRef.current = songTempoRef.current || songTempo || 1;
    const rung = nextDrillTempo(drillSavedTempoRef.current);
    drillTempoRef.current = rung;
    setSongTempo(rung);
    songTempoRef.current = rung;
    drillStartSecRef.current = Math.max(0, seg.start - 0.5);
    drillEndSecRef.current = seg.end + 0.5;
    setDrillActive(true);
    startSongPlay();
    announce(lang === "th" ? ("🎯 ดริล " + (seg.idx + 1) + " · " + (Math.round(rung * 100)) + "%") : lang === "zh" ? ("🎯 练习 " + (seg.idx + 1)) : ("🎯 Drill " + (seg.idx + 1) + " · " + Math.round(rung * 100) + "%"));
  }`;
must(s.includes(sdOld), "startDrill block");
const sdNew = `  function startDrill(seg, forcedRung) {
    if (!seg) return;
    // Save the SONG's tempo (state value — what the tempo buttons last set),
    // then pick the ladder rung: always start at 75% (or the song's own tempo
    // if it's already slower) and climb to 1× only after real passes.
    drillSavedTempoRef.current = songTempo || 1;
    const rung = forcedRung || firstDrillTempo(drillSavedTempoRef.current);
    drillTempoRef.current = rung;
    setSongTempo(rung);
    setDrillActive(true);
    // startSongPlay synchronously resets the drill window and songTempoRef —
    // so the drill-specific values go back AFTER that call returns (it only
    // yields at its first await, well past those resets).
    startSongPlay();
    songTempoRef.current = rung;
    drillStartSecRef.current = Math.max(0, seg.start - 0.5);
    drillEndSecRef.current = seg.end + 0.5;
    announce(lang === "th" ? ("🎯 ดริล " + (seg.idx + 1) + " · " + (Math.round(rung * 100)) + "%") : lang === "zh" ? ("🎯 练习 " + (seg.idx + 1)) : ("🎯 Drill " + (seg.idx + 1) + " · " + Math.round(rung * 100) + "%"));
  }`;
s = s.replace(sdOld, sdNew);

/* ── 6) HUD climb: use drillPlanRef, drop the redundant tempo writes,
   pass the next rung into startDrill ── */
const hudOld = `          const doneSeg = (drillPlan || []).find(x => Math.abs((x.start - 0.5) - (drillStartSecRef.current || -99)) < 0.6);
          const rung = drillTempoRef.current;
          if (rung >= 1) {
            endDrill();
            announce(lang === "th" ? "✅ ผ่านดริลแล้ว!" : lang === "zh" ? "✅ 练习通过！" : "✅ Drill cleared!");
            setSongPhase("ready");
          } else {
            const nxt = nextDrillTempo(rung);
            drillTempoRef.current = nxt;
            setSongTempo(nxt); songTempoRef.current = nxt;
            announce(lang === "th" ? ("⏫ เท็มโป " + Math.round(nxt * 100) + "%") : lang === "zh" ? ("⏫ 速度 " + Math.round(nxt * 100) + "%") : ("⏫ Tempo " + Math.round(nxt * 100) + "%"));
            if (doneSeg) { const seg = doneSeg; setTimeout(() => startDrill(seg), 900); }
            else setTimeout(() => startSongPlay(), 900);
          }`;
must(s.includes(hudOld), "HUD climb block");
const hudNew = `          const doneSeg = (drillPlanRef.current || []).find(x => Math.abs((x.start - 0.5) - (drillStartSecRef.current || -99)) < 0.6);
          const rung = drillTempoRef.current;
          if (rung >= 1) {
            endDrill();
            announce(lang === "th" ? "✅ ผ่านดริลแล้ว!" : lang === "zh" ? "✅ 练习通过！" : "✅ Drill cleared!");
            setSongPhase("ready");
          } else {
            const nxt = nextDrillTempo(rung);
            announce(lang === "th" ? ("⏫ เท็มโป " + Math.round(nxt * 100) + "%") : lang === "zh" ? ("⏫ 速度 " + Math.round(nxt * 100) + "%") : ("⏫ Tempo " + Math.round(nxt * 100) + "%"));
            if (doneSeg) setTimeout(() => startDrill(doneSeg, nxt), 900);
            else setTimeout(() => startSongPlay(), 900);
          }`;
s = s.replace(hudOld, hudNew);

/* ── 7) captureDrillPlan: mirror into drillPlanRef ── */
const cpOld = `  function captureDrillPlan(notes) {
    const plan = buildDrillPlan(notes, { max: 4 });
    setDrillPlan(plan);
    setDrillActive(false);
  }`;
must(s.includes(cpOld), "captureDrillPlan block");
s = s.replace(cpOld, `  function captureDrillPlan(notes) {
    const plan = buildDrillPlan(notes, { max: 4 });
    drillPlanRef.current = plan; // HUD-timer closures read the ref, not state
    setDrillPlan(plan);
    setDrillActive(false);
  }`);

/* ── 8) exitSong: clear the ref too ── */
const exOld = `    setDrillPlan(null); setDrillActive(false); drillStartSecRef.current = null; drillEndSecRef.current = null;`;
must(s.includes(exOld), "exitSong drill clear");
s = s.replace(exOld, exOld + `\n    drillPlanRef.current = null;`);

/* ── 9) import firstDrillTempo ── */
if (!s.includes("firstDrillTempo")) {
  const a = `import { buildDrillPlan, nextDrillTempo, bossHpFor, bossComboChip, bossRewardCoins, knowledgeDropFor, smartBackingPlan } from "./mistake-drill";`;
  must(s.includes(a), "mistake-drill import");
  s = s.replace(a, a.replace("nextDrillTempo, ", "nextDrillTempo, firstDrillTempo, "));
}

/* ── 10) return block: bossMax (missing from the first engine patch) ── */
if (!s.includes("drillPlan, drillActive, startDrill, endDrill, bossOn, bossHp, bossMax, bossFx")) {
  const a = "drillPlan, drillActive, startDrill, endDrill, bossOn, bossHp, bossFx, kDrop, kShelfOpen, setKShelfOpen, kShelf, openKnowledgeShelf, startPvpTogether: startPvpTogether };";
  must(s.includes(a), "return anchor");
  s = s.replace(a, a.replace("bossHp, bossFx", "bossHp, bossMax, bossFx"));
}

writeFileSync(P, s);
console.log("fixes applied, delta:", s.length - orig.length);

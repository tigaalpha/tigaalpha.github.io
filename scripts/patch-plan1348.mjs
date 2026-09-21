// One-shot patcher: Play Along plan items 1/3/4/8 in use-play-along.ts
// #1 Mistake Loop state+helpers, #3 Boss Battle state+helpers,
// #4 Knowledge Drops state, #8 AI Backing smart progression.
import { readFileSync, writeFileSync } from "node:fs";

const P = "use-play-along.ts";
let s = readFileSync(P, "utf8");
const orig = s;

function must(cond, msg) { if (!cond) { console.error("FAIL: " + msg); process.exit(1); } }

/* ── 1) import ── */
must(!s.includes(`from "./mistake-drill"`), "import already present");
const impAnchor = `import { analyzeSongRun, buildSongFallback } from "./song-analysis";`;
must(s.includes(impAnchor), "song-analysis import anchor missing");
s = s.replace(impAnchor, impAnchor + `\nimport { buildDrillPlan, nextDrillTempo, bossHpFor, bossComboChip, bossRewardCoins, knowledgeDropFor, smartBackingPlan } from "./mistake-drill";`);

/* ── 2) state block after the backing state (D1 lines) ── */
const stateAnchor = `  const [backingOn, setBackingOn] = useState(false);
  const backingTimerRef = useRef<any>(null);`;
must(s.includes(stateAnchor), "backing state anchor missing");
s = s.replace(stateAnchor, stateAnchor + `
  // ── Play Along plan items 1/3/4/8 (this session) ──
  // #1 Mistake Loop — after a run, the missed notes are bucketed into
  // loopable segments (buildDrillPlan) and the player can drill JUST the
  // worst segment on a rising tempo ladder instead of replaying the song.
  const [drillPlan, setDrillPlan] = useState(null);      // null | [{idx,start,end,misses,notes}]
  const [drillActive, setDrillActive] = useState(false); // true while a drill window is loaded
  const drillTempoRef = useRef(1);                       // ladder rung for the active drill
  const drillSavedTempoRef = useRef(1);                  // song tempo to restore when the drill ends
  // #3 Boss Battle — HP is chipped by every hit (bigger for perfects and
  // every 10× combo) and the boss attacks back on misses. Refs: the game
  // loop mutates them every frame.
  const [bossOn, setBossOn] = useState(false);
  const [bossHp, setBossHp] = useState(0);               // reactive: HP bar in the HUD
  const [bossMax, setBossMax] = useState(0);             // reactive: HP ceiling for the bar
  const [bossFx, setBossFx] = useState(null);            // {id, kind} hit/defeat/attack flash
  const bossHpRef = useRef(0);
  const bossMaxRef = useRef(1);
  const bossFxT = useRef(null);
  const bossHpDirtyRef = useRef(false);                  // throttle setState to ~5Hz
  const bossHpDirtyAtRef = useRef(0);
  // #4 Knowledge Drops — perfect hits sometimes drop a one-line fact about
  // the pitch just played; facts collect into a per-device shelf.
  const [kDrop, setKDrop] = useState(null);              // {id, note, text} toast mid-game
  const [kShelfOpen, setKShelfOpen] = useState(false);
  const [kShelf, setKShelf] = useState([]);              // [{pc, note, text, at}]
  const kDropT = useRef(null);
  const kDroppedRef = useRef({});                        // one drop per pitch-class per run
  const LANG_KEY = (l) => l === "th" ? "th" : l === "zh" ? "zh" : "en";`);

/* ── 3) helper functions — insert before `function comboWord(c) {` ── */
const helperAnchor = `  // Used to hard-cap at "UNSTOPPABLE!" forever past combo 50 — the shout-out`;
must(s.includes(helperAnchor), "comboWord anchor missing");
s = s.replace(helperAnchor, `  // ════ plan items 1/3/4/8 helpers ════
  // #3: one boss-fx flash at a time (hit / defeat / attack)
  function armBoss() {
    const total = songTotalRef.current || (songDataRef.current && songDataRef.current.total) || 0;
    bossHpRef.current = bossHpFor(total);
    bossMaxRef.current = Math.max(1, bossHpRef.current);
    setBossHp(bossHpRef.current);
    setBossMax(bossMaxRef.current);
    setBossOn(true);
  }
  function bossFlash(kind) {
    setBossFx({ id: Date.now(), kind });
    clearTimeout(bossFxT.current);
    bossFxT.current = setTimeout(() => setBossFx(null), 700);
  }
  function bossDamage(base) {
    if (!bossOn) return;
    bossHpRef.current = Math.max(0, bossHpRef.current - base);
    bossHpDirtyRef.current = true;
    if (bossHpRef.current <= 0) { bossFlash("defeat"); }
    else bossFlash("hit");
  }
  // #4: maybe drop a knowledge card on a PERFECT hit — max one per pitch
  // class per run, ~8% of eligible perfects, capped at 3 cards mid-game.
  function maybeKnowledgeDrop(noteName) {
    if (kDroppedRef.current[noteName]) return;
    const live = songPopsRef.current || [];
    if (Object.keys(kDroppedRef.current).length >= 3) return;
    if (Math.random() >= 0.08) return;
    const f = knowledgeDropFor(noteName);
    if (!f) return;
    kDroppedRef.current[noteName] = true;
    const text = f[LANG_KEY(lang)];
    setKDrop({ id: Date.now(), note: noteName, text });
    clearTimeout(kDropT.current); kDropT.current = setTimeout(() => setKDrop(null), 2600);
    try {
      const shelf = JSON.parse(localStorage.getItem("tg_kdrops") || "[]");
      if (!shelf.some(x => x.pc === f.pc)) {
        shelf.unshift({ pc: f.pc, note: noteName, text, at: Date.now() });
        localStorage.setItem("tg_kdrops", JSON.stringify(shelf.slice(0, 30)));
      }
    } catch (e) {}
  }
  function openKnowledgeShelf() {
    try { setKShelf(JSON.parse(localStorage.getItem("tg_kdrops") || "[]")); } catch (e) { setKShelf([]); }
    setKShelfOpen(true);
  }
  // #1: called from finishSong with this run's graded notes — builds the
  // drill plan shown on the result screen.
  function captureDrillPlan(notes) {
    const plan = buildDrillPlan(notes, { max: 4 });
    setDrillPlan(plan);
    setDrillActive(false);
  }
  // #1: drill JUST one segment — start/end seconds become a temporary note
  // window on a slower ladder rung; finishing one pass climbs the ladder,
  // 1× pass clears the drill and restores the song tempo.
  function startDrill(seg) {
    if (!seg) return;
    drillSavedTempoRef.current = songTempoRef.current || songTempo || 1;
    const rung = nextDrillTempo(drillSavedTempoRef.current);
    drillTempoRef.current = rung;
    setSongTempo(rung);
    songTempoRef.current = rung;
    drillStartSecRef.current = Math.max(0, seg.start - 0.5);
    drillEndSecRef.current = seg.end + 0.5;
    setDrillActive(true);
    armBoss();
    startSongPlay();
    announce(lang === "th" ? ("🎯 ดริล " + (seg.idx + 1) + " · " + (Math.round(rung * 100)) + "%") : lang === "zh" ? ("🎯 练习 " + (seg.idx + 1)) : ("🎯 Drill " + (seg.idx + 1) + " · " + Math.round(rung * 100) + "%"));
  }
  function endDrill() {
    setDrillActive(false);
    drillStartSecRef.current = null; drillEndSecRef.current = null;
    setSongTempo(drillSavedTempoRef.current);
    songTempoRef.current = drillSavedTempoRef.current;
  }

` + helperAnchor);

/* ── 4) drill window refs — add next to drill state? No: refs must exist before use.
   Add near other refs (after songStartClockRef declaration). ── */
const refAnchor = `  const songStartClockRef = useRef(0);`;
must(s.includes(refAnchor), "startClock ref anchor missing");
s = s.replace(refAnchor, refAnchor + `
  const drillStartSecRef = useRef(null);   // #1 Mistake Loop window start (sec) or null
  const drillEndSecRef = useRef(null);     // #1 window end (sec) or null
  const songPopsRef = useRef(0);           // #4 cheap eligibility guard`);

/* ── 5) startSongPlay: boss init + backing upgrade + drill window reset ── */
const bossInitAnchor = `    songFeverRef.current = false; setSongFever(false); setSongPops([]); setSongAnnounce(null);
    songLaneFlashRef.current = {}; songCountdownRef.current = null; songFinishedRef.current = false;`;
must(s.includes(bossInitAnchor), "boss init anchor missing");
s = s.replace(bossInitAnchor, bossInitAnchor + `
    // #3 Boss Battle: HP scales with song length — armed every run; the HP
    // bar only renders while bossOn (result-screen rematch keeps it fair).
    bossHpRef.current = bossHpFor(songTotalRef.current || (data && data.total) || 0);
    bossMaxRef.current = Math.max(1, bossHpRef.current);
    setBossHp(bossHpRef.current);
    setBossMax(bossMaxRef.current);
    setBossOn(true);
    // #1: fresh run = no drill window, reset per-run knowledge-drop memory
    drillStartSecRef.current = null; drillEndSecRef.current = null;
    kDroppedRef.current = {};`);

/* ── 6) backing: replace I-IV-V-I loop with smartBackingPlan ── */
const backingAnchor = `    // D1: Start backing chord loop if enabled
    if (backingOn && songMeta) {
      const tonic = songTonic(songMeta);
      const ri = _PC.indexOf(tonic); if (ri >= 0) {
        const IVpc = _PC[(ri + 5) % 12]; const Vpc = _PC[(ri + 7) % 12];
        const chords = [tonic, IVpc, Vpc, tonic];
        const beatMs = (60 / (songMeta.bpm || 90)) * 1000;
        let ci = 0;
        const tick = () => { if (!songRunRef.current) return; playBackingChord(chords[ci % chords.length]); ci++; backingTimerRef.current = setTimeout(tick, beatMs * 4); };
        backingTimerRef.current = setTimeout(tick, 200);
      }
    }`;
must(s.includes(backingAnchor), "backing anchor missing");
s = s.replace(backingAnchor, `    // D1 (upgraded, plan #8): real per-song progression — major songs get
    // I–V–vi–IV, minor songs i–VI–III–VII (smartBackingPlan reads the song's
    // own notes to pick tonic + mode) instead of the old I–IV–V–I loop.
    if (backingOn && songMeta) {
      const plan = smartBackingPlan(songMeta);
      if (plan && plan.chords.length) {
        const beatMs = (60 / (songMeta.bpm || 90)) * 1000;
        let ci = 0;
        const tick = () => { if (!songRunRef.current) return; playBackingChord(plan.chords[ci % plan.chords.length]); ci++; backingTimerRef.current = setTimeout(tick, beatMs * 4); };
        backingTimerRef.current = setTimeout(tick, 200);
      }
    }`);

/* ── 7) HUD tick: boss HP sync + drill-window end check ── */
const hudAnchor = `      // ghost race vs your best run
      const st = (getAC().currentTime - songStartClockRef.current) * songTempoRef.current;`;
must(s.includes(hudAnchor), "hud anchor missing");
s = s.replace(hudAnchor, `      // #3: flush boss HP to React ~5Hz max (refs are mutated per hit)
      if (bossOn && bossHpDirtyRef.current) {
        bossHpDirtyRef.current = false;
        const nowMs = performance.now();
        if (nowMs - bossHpDirtyAtRef.current > 200) { bossHpDirtyAtRef.current = nowMs; setBossHp(bossHpRef.current); }
      }
      // #1: drill window reached its end → one pass done; climb the ladder or
      // graduate (1× pass = restore the song's own tempo and stop drilling).
      if (drillActive && drillEndSecRef.current != null) {
        const songTimeNow = (getAC().currentTime - songStartClockRef.current) * songTempoRef.current;
        if (songTimeNow >= drillEndSecRef.current + 1.2) {
          const doneSeg = (drillPlan || []).find(x => Math.abs((x.start - 0.5) - (drillStartSecRef.current || -99)) < 0.6);
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
          }
        }
      }
` + hudAnchor);

/* ── 8) game loop: skip notes outside the drill window ── */
const loopAnchor = `    for (const n of notes) {
      const hitAt = n.t + SONG_LEAD;
      if (!n.hit && !n.missed && songTime > hitAt + SONG_MISSWINDOW) {`;
must(s.includes(loopAnchor), "loop anchor missing");
s = s.replace(loopAnchor, `    const drillStart = drillStartSecRef.current, drillEnd = drillEndSecRef.current;
    for (const n of notes) {
      if (drillEnd != null && (n.t < drillStart || n.t > drillEnd)) { if (!n.hit && !n.missed) n.missed = true; continue; } // #1 drill: only the segment falls
      const hitAt = n.t + SONG_LEAD;
      if (!n.hit && !n.missed && songTime > hitAt + SONG_MISSWINDOW) {`);

/* ── 9) handleSongInput: boss damage + knowledge drop on perfect ── */
const feverAnchor = `      if (!songFeverRef.current && combo >= 15) { songFeverRef.current = true; setSongFever(true); playUi("levelup"); triggerShake(); announce("🔥 FEVER!"); }`;
must(s.includes(feverAnchor), "fever anchor missing");
s = s.replace(feverAnchor, `      if (bossOn) bossDamage(perfect ? 2 : 1 + bossComboChip(combo)); // #3: perfects hit 2, every 10× combo chips +2
      if (perfect) maybeKnowledgeDrop(best.note);                     // #4: facts drop on perfects
      if (!songFeverRef.current && combo >= 15) { songFeverRef.current = true; setSongFever(true); playUi("levelup"); triggerShake(); announce("🔥 FEVER!"); }`);

/* ── 9b) boss attacks back on a miss ── */
const missAnchor = `        if (songFeverRef.current) { songFeverRef.current = false; setSongFever(false); }
        songLaneFlashRef.current[n.lane] = { ok: false, until: now + 220 };
        playMiss(); flashJudge("miss");`;
must(s.includes(missAnchor), "miss anchor missing");
s = s.replace(missAnchor, missAnchor + `
        if (bossOn && bossHpRef.current > 0) bossFlash("attack"); // #3: the boss strikes back on every dropped note`);

/* ── 10) finishSong: capture drill plan + boss bounty + end drill ── */
const finishMissAnchor = `    const missedNotes = songNotesRef.current.filter(n => n.missed).map(n => n.note);
    if (missedNotes.length) recordNoteMisses(missedNotes);`;
must(s.includes(finishMissAnchor), "finish miss anchor missing");
s = s.replace(finishMissAnchor, finishMissAnchor + `
    captureDrillPlan(songNotesRef.current); // #1: heat-map source for the result screen
    if (drillActive) endDrill();
    if (bossOn) { // #3: defeat bounty — killed the boss (≥80% of notes) pays by stars
      if (bossHpRef.current <= 0 && stars >= 1) {
        const bounty = bossRewardCoins(stars);
        if (bounty > 0) {
          earnCoins(bounty);
          setSongBonus({ id: Date.now(), text: "👾 +" + bounty + " 🪙" });
          clearTimeout(songBonusT.current); songBonusT.current = setTimeout(() => setSongBonus(null), 2000);
        }
      }
      setBossOn(false); setBossHp(0);
    }`);

/* ── 11) exitSong: clear the new transient state ── */
const exitAnchor = `    songFeverRef.current = false; setSongFever(false); setSongPops([]); setSongAnnounce(null);
  }
  function songLoop() {`;
must(s.includes(exitAnchor), "exit anchor missing");
s = s.replace(exitAnchor, `    songFeverRef.current = false; setSongFever(false); setSongPops([]); setSongAnnounce(null);
    setDrillPlan(null); setDrillActive(false); drillStartSecRef.current = null; drillEndSecRef.current = null;
    setBossOn(false); setBossHp(0); setBossFx(null); setKDrop(null); setKShelfOpen(false);
    clearTimeout(bossFxT.current); clearTimeout(kDropT.current);
  }
  function songLoop() {`);

/* ── 12) return block: expose everything the UI needs ── */
const retOld = `songLoopRecap, songSetlistPos, chooseSong, previewSong, startSongPlay, startSetlist, exitSong, styleTransform, playAlongHand, changePlayAlongHand };`;
must(s.includes(retOld), "return anchor missing");
s = s.replace(retOld, `songLoopRecap, songSetlistPos, chooseSong, previewSong, startSongPlay, startSetlist, exitSong, styleTransform, playAlongHand, changePlayAlongHand,
    drillPlan, drillActive, startDrill, endDrill, bossOn, bossHp, bossMax, bossFx, kDrop, kShelfOpen, setKShelfOpen, kShelf, openKnowledgeShelf, startPvpTogether: startPvpTogether };`);

writeFileSync(P, s);
console.log("patched OK, delta bytes:", s.length - orig.length);

import { useState, useRef } from "react";
import {
  SIGHT_NOTES, SIGHT_NOTES_BASS, pcOf, getAC, playPianoNote, playUi,
  stopPracticeListeners, startMidiListener, startMicListener,
} from "./music-engine";
import { logPractice } from "./App";
import { logActivity, recordNoteMisses } from "./shared-infra";
import { recordMemory } from "./ai-chat-context";

// Belt ranking — a cumulative, all-time count of correct reads across every
// clef and mode (tg_sight_total), the closest honest single number to "how
// much sight-reading mileage have you actually put in." Belts are a
// threshold ladder over that lifetime total, not a per-session stat, so
// switching clefs or modes never resets progress toward the next one.
const SIGHT_BELTS = [
  { id: "white",  need: 0,    icon: "⚪", th: "ขาว",     en: "White",  zh: "白带" },
  { id: "yellow", need: 50,   icon: "🟡", th: "เหลือง",   en: "Yellow", zh: "黄带" },
  { id: "orange", need: 150,  icon: "🟠", th: "ส้ม",     en: "Orange", zh: "橙带" },
  { id: "green",  need: 300,  icon: "🟢", th: "เขียว",    en: "Green",  zh: "绿带" },
  { id: "blue",   need: 500,  icon: "🔵", th: "น้ำเงิน",  en: "Blue",   zh: "蓝带" },
  { id: "purple", need: 800,  icon: "🟣", th: "ม่วง",     en: "Purple", zh: "紫带" },
  { id: "brown",  need: 1200, icon: "🟤", th: "น้ำตาล",   en: "Brown",  zh: "棕带" },
  { id: "black",  need: 2000, icon: "⚫", th: "ดำ",      en: "Black",  zh: "黑带" },
];
function sightTotalRead() { try { return +(localStorage.getItem("tg_sight_total") || 0); } catch (e) { return 0; } }
function addSightTotalRead(n) { try { localStorage.setItem("tg_sight_total", String(sightTotalRead() + n)); } catch (e) {} }
export function sightBeltFor(total) { let b = SIGHT_BELTS[0]; for (const belt of SIGHT_BELTS) if (total >= belt.need) b = belt; return b; }
function sightNextBelt(total) { return SIGHT_BELTS.find(b => b.need > total) || null; }

export function sightBestMap(key) { try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch (e) { return {}; } }
// Returns true only on a genuine improvement (strictly greater than whatever
// was stored before) — a tie doesn't count as "new best," it just leaves the
// record untouched.
function markSightBest(key, clef, val) {
  try {
    const m = sightBestMap(key);
    const prev = m[clef] || 0;
    if (val > prev) { m[clef] = val; localStorage.setItem(key, JSON.stringify(m)); return true; }
    return false;
  } catch (e) { return false; }
}
const SIGHT_SPRINT_SECS = 60;
/* ── use-sight-reading.ts ──
   Owns the sight-reading drill: show a random note on a staff (treble/
   bass/both), grade the learner's mic/MIDI/tap response against it, and
   run a fixed-length round (SIGHT_ROUND notes) to a scored finish.
   SightReadingOverlay.tsx (Phase 2) is this hook's only external consumer
   beyond PianoApp; every prop it already receives keeps its exact
   original name.

   Simplest hook so far: no effects to relocate (sight-reading never had
   one straddling another hook, unlike practice mode's hand-switch
   effect), and only 4 params - SIGHT_ROUND (a top-level App.tsx constant,
   threaded rather than exported: SightReadingOverlay.tsx's own header
   already established this convention before Phase 3 even started, and
   nothing outside sight-reading needs it, so there's no reason to add a
   circular import for it), lang, and earnCoins/gainExp from
   use-gamification.ts. logPractice is imported from "./App" - already
   exported there by use-practice-mode.ts (Phase 3.4), so this is a plain
   new import, not a new export.

   The shared unmount-cleanup effect's `clearTimeout(sightFbTimer.current)`
   line is deliberately left untouched in PianoApp: it still resolves
   correctly since PianoApp destructures `sightFbTimer` from this hook's
   return under its original name (same reasoning that already made a
   dedicated split-out cleanup effect optional, not required, in
   use-practice-mode.ts).

   Fun/value pass (feature audit item #3): fixed the retry-trap where a
   miss used to just wait on the same note forever instead of moving on —
   real sight-reading pedagogy forgives a wrong note but never rewards
   stopping to fix it. Added a no-hint streak (sightStreak/sightBestStreak)
   so clean unbroken reading is its own visible reward, a per-note timeout
   so a stalled learner is nudged forward instead of staring at a static
   staff, and 3-note "phrase" pacing (shorter gap between notes inside a
   phrase, a fuller beat + a small flourish at each clean phrase boundary)
   so a round reads more like a short passage than a stack of flashcards. ── */
const SIGHT_PHRASE_LEN = 3;
const SIGHT_NOTE_TIMEOUT_MS = 8000;

export function useSightReading({ SIGHT_ROUND, lang, earnCoins, gainExp, bumpWeekly }) {
  const [sightOpen, setSightOpen] = useState(false);
  const [sightTarget, setSightTarget] = useState(null);
  const [sightClef, setSightClef] = useState("treble");      // treble | bass | both — which clef(s) to drill
  const [sightNoteClef, setSightNoteClef] = useState("treble"); // clef of the CURRENT note (matters in "both")
  const [sightIdx, setSightIdx] = useState(0);
  const [sightScore, setSightScore] = useState(0);
  const [sightFeedback, setSightFeedback] = useState(null); // {ok} | null
  const [sightHint, setSightHint] = useState(false);
  const [sightDone, setSightDone] = useState(null);          // result obj | null
  const [sightSrc, setSightSrc] = useState(null);
  const [sightStreak, setSightStreak] = useState(0);          // consecutive correct-with-no-hint, this round
  const [sightPhrasePos, setSightPhrasePos] = useState(0);    // 0-based position within the current SIGHT_PHRASE_LEN-note phrase
  const [sightMode, setSightMode] = useState("round");        // "round" (fixed SIGHT_ROUND notes) | "sprint" (fixed 60s, however many you can read)
  const [sightSprintLeft, setSightSprintLeft] = useState(SIGHT_SPRINT_SECS);

  const sightTargetRef = useRef(null);
  const sightClefRef = useRef("treble");   // selected clef mode (treble|bass|both)
  const sightNoteClefRef = useRef("treble"); // clef of the note currently shown
  const sightModeRef = useRef("round");
  const sightActiveRef = useRef(false);
  const sightHandlerRef = useRef(() => {});
  const sightScoreRef = useRef(0);
  const sightMissRef = useRef(0);
  const sightIdxRef = useRef(0);
  const sightFbTimer = useRef(null);
  const sightTimeoutTimer = useRef(null);      // per-note "you've stalled, moving on" timer
  const sightStreakRef = useRef(0);
  const sightBestStreakRef = useRef(0);
  const sightPhraseCleanRef = useRef(true);    // no miss yet within the current phrase
  const sightMissedNotesRef = useRef([]);      // note names missed this round, for recordNoteMisses()
  const sightSprintTimerRef = useRef(null);    // 1s tick — drives the live countdown display
  const sightSprintEndRef = useRef(0);         // Date.now() timestamp the sprint ends at

  function armSightTimeout() {
    clearTimeout(sightTimeoutTimer.current);
    sightTimeoutTimer.current = setTimeout(() => {
      if (sightActiveRef.current) sightInput({ note: null, timedOut: true });
    }, SIGHT_NOTE_TIMEOUT_MS);
  }

  // ════ SIGHT-READING controls ════
  function newSightNote() {
    // pick this note's clef: fixed for treble/bass, random each note for "both"
    const mode = sightClefRef.current;
    const clef = mode === "both" ? (Math.random() < 0.5 ? "treble" : "bass") : mode;
    const pool = clef === "bass" ? SIGHT_NOTES_BASS : SIGHT_NOTES;
    const cur = sightTargetRef.current;
    let n = cur;
    while (n === cur) n = pool[Math.floor(Math.random() * pool.length)];
    sightTargetRef.current = n;
    sightNoteClefRef.current = clef;
    setSightTarget(n);
    setSightNoteClef(clef);
    setSightHint(false);
    setSightFeedback(null);
    armSightTimeout();
  }
  // switch clef mid-session — restart the round so the score stays fair
  function pickSightClef(mode) {
    if (mode === sightClefRef.current) return;
    sightClefRef.current = mode;
    setSightClef(mode);
    playUi("click");
    if (sightActiveRef.current) restartSightRound();
  }
  // switch round/sprint mode mid-session — same reset-and-restart as a clef
  // switch, for the same fairness reason.
  function pickSightMode(mode) {
    if (mode === sightModeRef.current) return;
    sightModeRef.current = mode;
    setSightMode(mode);
    playUi("click");
    if (sightActiveRef.current) restartSightRound();
  }
  function restartSightRound() {
    sightScoreRef.current = 0; sightMissRef.current = 0; sightIdxRef.current = 0;
    sightStreakRef.current = 0; sightBestStreakRef.current = 0; sightPhraseCleanRef.current = true;
    sightMissedNotesRef.current = [];
    setSightScore(0); setSightIdx(0); setSightDone(null); setSightStreak(0); setSightPhrasePos(0);
    sightTargetRef.current = null;
    armSightSprintClock();
    newSightNote();
  }
  // Sprint mode has no fixed note count — a 1s-tick countdown ends the round
  // at SIGHT_SPRINT_SECS regardless of where sightIdx happens to be.
  function armSightSprintClock() {
    clearInterval(sightSprintTimerRef.current);
    if (sightModeRef.current !== "sprint") { setSightSprintLeft(SIGHT_SPRINT_SECS); return; }
    sightSprintEndRef.current = Date.now() + SIGHT_SPRINT_SECS * 1000;
    setSightSprintLeft(SIGHT_SPRINT_SECS);
    sightSprintTimerRef.current = setInterval(() => {
      const left = Math.max(0, Math.round((sightSprintEndRef.current - Date.now()) / 1000));
      setSightSprintLeft(left);
      if (left <= 0) { clearInterval(sightSprintTimerRef.current); if (sightActiveRef.current) finishSight(); }
    }, 1000);
  }
  async function openSight(mode = "round") {
    sightModeRef.current = mode;
    setSightMode(mode);
    sightScoreRef.current = 0; sightMissRef.current = 0; sightIdxRef.current = 0;
    sightStreakRef.current = 0; sightBestStreakRef.current = 0; sightPhraseCleanRef.current = true;
    sightMissedNotesRef.current = [];
    sightTargetRef.current = null;
    sightActiveRef.current = true;
    setSightScore(0); setSightIdx(0); setSightDone(null); setSightSrc(null); setSightStreak(0); setSightPhrasePos(0);
    armSightSprintClock();
    newSightNote();
    setSightOpen(true);
    getAC();
    stopPracticeListeners(); // release any mic/MIDI another mode left open — never stack listeners
    const onDetect = (d) => sightHandlerRef.current(d);
    const midiOk = await startMidiListener(onDetect, () => setSightSrc({ type: "midi" }));
    if (!midiOk) await startMicListener(onDetect, () => setSightSrc({ type: "mic" }), () => setSightSrc({ type: "error" }));
  }
  function sightInput(d) {
    if (!sightActiveRef.current || !sightTargetRef.current) return;
    const ok = !d.timedOut && pcOf(d.note) === pcOf(sightTargetRef.current);
    const isSprint = sightModeRef.current === "sprint";
    clearTimeout(sightFbTimer.current);
    clearTimeout(sightTimeoutTimer.current);
    const next = sightIdxRef.current + 1;
    const roundOver = !isSprint && next >= SIGHT_ROUND;
    const atPhraseEnd = next % SIGHT_PHRASE_LEN === 0 || roundOver;
    if (ok) {
      playPianoNote(sightTargetRef.current, 0.5);
      sightScoreRef.current += 1;
      sightStreakRef.current += 1;
      if (sightStreakRef.current > sightBestStreakRef.current) sightBestStreakRef.current = sightStreakRef.current;
      setSightScore(sightScoreRef.current);
      setSightStreak(sightStreakRef.current);
      setSightFeedback({ ok: true, phraseClean: atPhraseEnd && sightPhraseCleanRef.current });
      sightIdxRef.current = next;
      setSightIdx(next);
      setSightPhrasePos(next % SIGHT_PHRASE_LEN);
      if (atPhraseEnd) sightPhraseCleanRef.current = true; // reset for the phrase that's about to start
      // shorter beat mid-phrase (keeps reading feeling continuous), a fuller beat at a phrase boundary
      const pause = atPhraseEnd ? 520 : 260;
      sightFbTimer.current = setTimeout(() => { roundOver ? finishSight() : newSightNote(); }, pause);
    } else {
      sightMissRef.current += 1;
      sightMissedNotesRef.current.push(sightTargetRef.current);
      sightStreakRef.current = 0;
      sightPhraseCleanRef.current = false;
      setSightStreak(0);
      setSightFeedback({ ok: false });
      setSightHint(true); // reveal the note name, then move on — never re-ask the same note
      sightIdxRef.current = next;
      setSightIdx(next);
      setSightPhrasePos(next % SIGHT_PHRASE_LEN);
      sightFbTimer.current = setTimeout(() => { roundOver ? finishSight() : newSightNote(); }, 900);
    }
  }
  function finishSight() {
    sightActiveRef.current = false;
    stopPracticeListeners();
    clearTimeout(sightFbTimer.current);
    clearTimeout(sightTimeoutTimer.current);
    clearInterval(sightSprintTimerRef.current);
    const correct = sightScoreRef.current, miss = sightMissRef.current;
    const acc = correct + miss > 0 ? Math.round(correct / (correct + miss) * 100) : 100;
    const reward = 25 + Math.round(acc / 4); // 25..50 EXP
    if (sightMissedNotesRef.current.length) recordNoteMisses(sightMissedNotesRef.current);
    // Belt ranking — every correct read (any clef, any mode) counts toward
    // the lifetime total; detect a promotion crossing this exact round so
    // the result screen can call it out instead of it just quietly ticking
    // up somewhere the learner has to go check.
    const clef = sightClefRef.current;
    const beltBefore = sightBeltFor(sightTotalRead());
    addSightTotalRead(correct);
    const totalAfter = sightTotalRead();
    const beltAfter = sightBeltFor(totalAfter);
    const beltUp = beltAfter.id !== beltBefore.id ? beltAfter : null;
    const streakIsBest = sightBestStreakRef.current > 0 && markSightBest("tg_sight_best_streak", clef, sightBestStreakRef.current);
    const isSprint = sightModeRef.current === "sprint";
    const sprintIsBest = isSprint && correct > 0 && markSightBest("tg_sight_best_sprint", clef, correct);
    setSightDone({
      correct, miss, acc, reward, bestStreak: sightBestStreakRef.current,
      mode: sightModeRef.current, belt: beltAfter, beltUp, totalRead: totalAfter, nextBelt: sightNextBelt(totalAfter),
      streakIsBest, sprintIsBest,
    });
    logPractice(acc);
    logActivity("read", "sight-" + sightClefRef.current, correct, miss, 90);
    recordMemory(lang === "th" ? "อ่านโน้ตฉับพลัน" : lang === "zh" ? "视奏" : "Sight-reading", acc);
    earnCoins(5 + Math.round(acc / 20));
    gainExp(reward, { quest: true });
    if (beltUp) { earnCoins(15 + SIGHT_BELTS.findIndex(b => b.id === beltUp.id) * 5); gainExp(40, { quest: true }); }
    // Weekly challenges — "games"/"perfect" used to only ever bump from Play
    // Along's finishSong(), so Sight-Reading could never complete 6 of the
    // week's 9 rotating challenge types. correct = notes actually read right.
    if (bumpWeekly) { bumpWeekly("games", 1); if (correct) bumpWeekly("perfect", correct); }
  }
  function exitSight() {
    sightActiveRef.current = false;
    stopPracticeListeners();
    clearTimeout(sightFbTimer.current);
    clearTimeout(sightTimeoutTimer.current);
    clearInterval(sightSprintTimerRef.current);
    setSightOpen(false);
    setSightDone(null);
  }
  sightHandlerRef.current = sightInput;
  return { sightOpen, setSightOpen, sightTarget, setSightTarget, sightClef, setSightClef, sightNoteClef, setSightNoteClef, sightIdx, setSightIdx, sightScore, setSightScore, sightFeedback, setSightFeedback, sightHint, setSightHint, sightDone, setSightDone, sightSrc, setSightSrc, sightStreak, sightPhrasePos, sightPhraseLen: SIGHT_PHRASE_LEN, sightMode, sightSprintLeft, sightSprintSecs: SIGHT_SPRINT_SECS, sightBelts: SIGHT_BELTS, sightBestStreakMap: sightBestMap("tg_sight_best_streak"), sightBestSprintMap: sightBestMap("tg_sight_best_sprint"), sightTotalRead: sightTotalRead(), sightTargetRef, sightClefRef, sightNoteClefRef, sightActiveRef, sightHandlerRef, sightScoreRef, sightMissRef, sightIdxRef, sightFbTimer, newSightNote, pickSightClef, pickSightMode, openSight, sightInput, finishSight, exitSight };
}

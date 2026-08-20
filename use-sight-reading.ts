import { useState, useRef } from "react";
import {
  SIGHT_NOTES, SIGHT_NOTES_BASS, pcOf, getAC, playPianoNote, playUi,
  stopPracticeListeners, startMidiListener, startMicListener,
} from "./music-engine";
import { logPractice } from "./App";
import { logActivity } from "./shared-infra";
import { recordMemory } from "./ai-chat-context";
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

export function useSightReading({ SIGHT_ROUND, lang, earnCoins, gainExp }) {
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

  const sightTargetRef = useRef(null);
  const sightClefRef = useRef("treble");   // selected clef mode (treble|bass|both)
  const sightNoteClefRef = useRef("treble"); // clef of the note currently shown
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
    if (sightActiveRef.current) {
      sightScoreRef.current = 0; sightMissRef.current = 0; sightIdxRef.current = 0;
      sightStreakRef.current = 0; sightBestStreakRef.current = 0; sightPhraseCleanRef.current = true;
      setSightScore(0); setSightIdx(0); setSightDone(null); setSightStreak(0); setSightPhrasePos(0);
      sightTargetRef.current = null;
      newSightNote();
    }
  }
  async function openSight() {
    sightScoreRef.current = 0; sightMissRef.current = 0; sightIdxRef.current = 0;
    sightStreakRef.current = 0; sightBestStreakRef.current = 0; sightPhraseCleanRef.current = true;
    sightTargetRef.current = null;
    sightActiveRef.current = true;
    setSightScore(0); setSightIdx(0); setSightDone(null); setSightSrc(null); setSightStreak(0); setSightPhrasePos(0);
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
    clearTimeout(sightFbTimer.current);
    clearTimeout(sightTimeoutTimer.current);
    const next = sightIdxRef.current + 1;
    const atPhraseEnd = next % SIGHT_PHRASE_LEN === 0 || next >= SIGHT_ROUND;
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
      sightFbTimer.current = setTimeout(() => { next >= SIGHT_ROUND ? finishSight() : newSightNote(); }, pause);
    } else {
      sightMissRef.current += 1;
      sightStreakRef.current = 0;
      sightPhraseCleanRef.current = false;
      setSightStreak(0);
      setSightFeedback({ ok: false });
      setSightHint(true); // reveal the note name, then move on — never re-ask the same note
      sightIdxRef.current = next;
      setSightIdx(next);
      setSightPhrasePos(next % SIGHT_PHRASE_LEN);
      sightFbTimer.current = setTimeout(() => { next >= SIGHT_ROUND ? finishSight() : newSightNote(); }, 900);
    }
  }
  function finishSight() {
    sightActiveRef.current = false;
    stopPracticeListeners();
    clearTimeout(sightFbTimer.current);
    clearTimeout(sightTimeoutTimer.current);
    const correct = sightScoreRef.current, miss = sightMissRef.current;
    const acc = correct + miss > 0 ? Math.round(correct / (correct + miss) * 100) : 100;
    const reward = 25 + Math.round(acc / 4); // 25..50 EXP
    setSightDone({ correct, miss, acc, reward, bestStreak: sightBestStreakRef.current });
    logPractice(acc);
    logActivity("read", "sight-" + sightClefRef.current, correct, miss, 90);
    recordMemory(lang === "th" ? "อ่านโน้ตฉับพลัน" : lang === "zh" ? "视奏" : "Sight-reading", acc);
    earnCoins(5 + Math.round(acc / 20));
    gainExp(reward, { quest: true });
  }
  function exitSight() {
    sightActiveRef.current = false;
    stopPracticeListeners();
    clearTimeout(sightFbTimer.current);
    clearTimeout(sightTimeoutTimer.current);
    setSightOpen(false);
    setSightDone(null);
  }
  sightHandlerRef.current = sightInput;
  return { sightOpen, setSightOpen, sightTarget, setSightTarget, sightClef, setSightClef, sightNoteClef, setSightNoteClef, sightIdx, setSightIdx, sightScore, setSightScore, sightFeedback, setSightFeedback, sightHint, setSightHint, sightDone, setSightDone, sightSrc, setSightSrc, sightStreak, sightPhrasePos, sightPhraseLen: SIGHT_PHRASE_LEN, sightTargetRef, sightClefRef, sightNoteClefRef, sightActiveRef, sightHandlerRef, sightScoreRef, sightMissRef, sightIdxRef, sightFbTimer, newSightNote, pickSightClef, openSight, sightInput, finishSight, exitSight };
}

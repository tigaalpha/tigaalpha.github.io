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
   use-practice-mode.ts). ── */
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

  const sightTargetRef = useRef(null);
  const sightClefRef = useRef("treble");   // selected clef mode (treble|bass|both)
  const sightNoteClefRef = useRef("treble"); // clef of the note currently shown
  const sightActiveRef = useRef(false);
  const sightHandlerRef = useRef(() => {});
  const sightScoreRef = useRef(0);
  const sightMissRef = useRef(0);
  const sightIdxRef = useRef(0);
  const sightFbTimer = useRef(null);

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
  }
  // switch clef mid-session — restart the round so the score stays fair
  function pickSightClef(mode) {
    if (mode === sightClefRef.current) return;
    sightClefRef.current = mode;
    setSightClef(mode);
    playUi("click");
    if (sightActiveRef.current) {
      sightScoreRef.current = 0; sightMissRef.current = 0; sightIdxRef.current = 0;
      setSightScore(0); setSightIdx(0); setSightDone(null);
      sightTargetRef.current = null;
      newSightNote();
    }
  }
  async function openSight() {
    sightScoreRef.current = 0; sightMissRef.current = 0; sightIdxRef.current = 0;
    sightTargetRef.current = null;
    sightActiveRef.current = true;
    setSightScore(0); setSightIdx(0); setSightDone(null); setSightSrc(null);
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
    const ok = pcOf(d.note) === pcOf(sightTargetRef.current);
    clearTimeout(sightFbTimer.current);
    if (ok) {
      playPianoNote(sightTargetRef.current, 0.5);
      sightScoreRef.current += 1;
      setSightScore(sightScoreRef.current);
      setSightFeedback({ ok: true });
      const next = sightIdxRef.current + 1;
      sightIdxRef.current = next;
      setSightIdx(next);
      sightFbTimer.current = setTimeout(() => { next >= SIGHT_ROUND ? finishSight() : newSightNote(); }, 520);
    } else {
      sightMissRef.current += 1;
      setSightFeedback({ ok: false });
      setSightHint(true); // reveal the note name after a wrong try
      sightFbTimer.current = setTimeout(() => setSightFeedback(null), 600);
    }
  }
  function finishSight() {
    sightActiveRef.current = false;
    stopPracticeListeners();
    clearTimeout(sightFbTimer.current);
    const correct = sightScoreRef.current, miss = sightMissRef.current;
    const acc = correct + miss > 0 ? Math.round(correct / (correct + miss) * 100) : 100;
    const reward = 25 + Math.round(acc / 4); // 25..50 EXP
    setSightDone({ correct, miss, acc, reward });
    logPractice(acc);
    logActivity("read", "sight-" + sightClefRef.current, correct, miss, 90);
    recordMemory(lang === "th" ? "อ่านโน้ต" : lang === "zh" ? "视奏" : "Sight-reading", acc);
    earnCoins(5 + Math.round(acc / 20));
    gainExp(reward, { quest: true });
  }
  function exitSight() {
    sightActiveRef.current = false;
    stopPracticeListeners();
    clearTimeout(sightFbTimer.current);
    setSightOpen(false);
    setSightDone(null);
  }
  sightHandlerRef.current = sightInput;
  return { sightOpen, setSightOpen, sightTarget, setSightTarget, sightClef, setSightClef, sightNoteClef, setSightNoteClef, sightIdx, setSightIdx, sightScore, setSightScore, sightFeedback, setSightFeedback, sightHint, setSightHint, sightDone, setSightDone, sightSrc, setSightSrc, sightTargetRef, sightClefRef, sightNoteClefRef, sightActiveRef, sightHandlerRef, sightScoreRef, sightMissRef, sightIdxRef, sightFbTimer, newSightNote, pickSightClef, openSight, sightInput, finishSight, exitSight };
}

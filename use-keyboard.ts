import { useState, useRef, useEffect, useCallback } from "react";
import { getFingers, TRIAD_FINGER_LH, TRIAD_FINGER_RH, stopAllPianoNotes, playPianoNote, playUi, getAC } from "./music-engine";
/* ── use-keyboard.ts ──
   Owns the on-screen keyboard's display state (lit note/keys, finger
   numbers, the persistent fingering chart, chord voicing style, hand
   selection, octave) plus two imperative playback APIs built on top of it:
   playSequence()/clearSeq() (AI-taught demos - chat's free-text note
   detector, pathway's "LEARN THIS" demo, the replay/pause controls) and
   record/playback of the learner's own playing (handleMainKey/toggleRecord/
   playClip/stopClip). Extracted from PianoApp verbatim - no logic changes.

   Unlike use-payment.ts/use-gamification.ts, this hook needs NO params and
   NO top-level-helper exports: every non-moving identifier it touches
   (getFingers, TRIAD_FINGER_LH/RH, stopAllPianoNotes, playPianoNote,
   playUi, getAC) was already a clean ./music-engine import. Confirmed by
   an exhaustive per-function free-variable trace, not a keyword search.

   Two related pieces of PianoApp state deliberately stay OUTSIDE this hook
   (left inline in PianoApp, reading this hook's returned `hand`/calling its
   returned `clearSeq`):
   - The page-navigation effect (`if (page !== "sensei") clearSeq()`) - the
     only reason to thread `page` in would be this one line.
   - Practice Mode's own hand-switch fingering-recompute effect - it reads
     this hook's `hand` but writes practice-mode's own (not yet extracted,
     Phase 3.4) practiceFingers/practiceOpen/practice*Ref state, so it can't
     be cleanly owned by either hook alone yet.
   `critiqueRecording` (sends a recorded clip to the AI teacher) also stays
   in PianoApp - it depends on chat state (Phase 3.8, not yet extracted)
   and payment state, not just keyboard state; it keeps referencing this
   hook's `clipRef`/`recordingRef`/`stopClip` by their same bare names,
   same as always, since PianoApp destructures this hook's return locally. ── */
export function useKeyboard() {
  const [litNote, setLitNote] = useState(null);
  const [litSet, setLitSet] = useState(null);   // multiple simultaneously-lit keys, for block-chord demos
  const [fingerMap, setFingerMap] = useState({});
  const [fingerChart, setFingerChart] = useState(null); // {label, notes:[{note,finger}], mode} — persistent chart
  // How chord demos are voiced: one note at a time (broken/arpeggiated) or all
  // together (block). Toggling replays the current chord immediately in the
  // new style — comparing both is the whole point (triad/7th/tension/slash/
  // block/pad chord topics all go through the same "chord" demo mode).
  const [chordStyle, setChordStyle] = useState("broken"); // "broken" | "block"
  const [seqIsChord, setSeqIsChord] = useState(false);
  const [hand, setHand] = useState("right");   // "right" | "left"

  const [pianoOct, setPianoOct] = useState(4);   // base octave for the on-screen keyboard

  const [recording, setRecording] = useState(false);
  const [hasClip, setHasClip] = useState(false);
  const [playingClip, setPlayingClip] = useState(false);

  const [hasSeq, setHasSeq] = useState(false);          // is there a sequence to practice?
  const [seqPlaying, setSeqPlaying] = useState(false);  // is the demo actively lighting up/sounding right now?

  const seqTimers = useRef([]);
  const lastSeq = useRef(null);   // remembers last played sequence for the replay button

  // recompute the fingering chart instantly when the hand is switched
  useEffect(() => {
    setFingerChart(prev => {
      if (!prev) return prev;
      let fingers = null;
      if (prev.key) fingers = getFingers(prev.key, prev.mode, hand);
      else if (prev.mode === "chord" || (prev.mode === "seq" && prev.notes.length === 3)) {
        fingers = hand === "left" ? TRIAD_FINGER_LH : TRIAD_FINGER_RH;
      }
      if (!fingers) return prev;
      const pairs = prev.notes.map((p, i) => ({ note: p.note, finger: fingers[i] != null ? fingers[i] : null }));
      return { ...prev, notes: pairs };
    });
  }, [hand]);

  function clearSeq() {
    seqTimers.current.forEach(t => clearTimeout(t));
    seqTimers.current = [];
    setLitNote(null);
    setLitSet(null);
    setFingerMap({});
    setSeqPlaying(false);
    stopAllPianoNotes(); // actually silence a still-ringing demo, not just reset its UI state
  }

  /* Play a sequence: ascending then descending, with finger numbers */
  function playSequence(parsed, styleOverride) {
    clearSeq();
    lastSeq.current = parsed;   // remember for replay
    setHasSeq(true);            // enable the Practice button
    setSeqPlaying(true);
    const { notes, mode } = parsed;
    setSeqIsChord(mode === "chord");

    // recompute fingering for the currently selected hand
    let fingers = parsed.fingers;
    if (parsed.key) {
      // key-based scale/chord: recompute exactly for that key + hand
      fingers = getFingers(parsed.key, mode, hand);
    } else if (!fingers) {
      // no explicit fingers provided — fall back to a sensible default
      if (mode === "chord" && notes.length === 3) fingers = hand === "left" ? TRIAD_FINGER_LH : TRIAD_FINGER_RH;
      else if (mode === "seq" && notes.length === 3) fingers = hand === "left" ? TRIAD_FINGER_LH : TRIAD_FINGER_RH;
    }
    // else: use the explicit fingers passed in (e.g. transposed lesson demo)

    // build a persistent fingering chart (ascending notes + finger numbers)
    if (fingers) {
      const pairs = notes.map((n, i) => ({ note: n, finger: fingers[i] != null ? fingers[i] : null }));
      setFingerChart({ label: parsed.label, notes: pairs, mode, key: parsed.key || null });
    } else {
      setFingerChart(null);
    }

    // Chords can be voiced two ways: broken (one note at a time, like the
    // scale/sequence path below) or block (every note struck together, so
    // the full triad/7th/tension/slash/pad-chord shape is heard and seen at
    // once). Triads, sevenths, tension, block/slash/pad-chord topics all
    // share this same "chord" demo mode, so the toggle covers all of them.
    if (mode === "chord" && (styleOverride || chordStyle) === "block") {
      const dur = 2.6;
      notes.forEach(n => playPianoNote(n, dur));
      setLitSet(notes);
      const fmap = {};
      if (fingers) notes.forEach((n, i) => { if (fingers[i] != null) fmap[n] = fingers[i]; });
      setFingerMap(fmap);
      const tEnd = setTimeout(() => { setLitSet(null); setFingerMap({}); setSeqPlaying(false); }, dur * 1000 + 200);
      seqTimers.current.push(tEnd);
      return;
    }

    let order, fingerOrder;
    if (mode === "chord") {
      order = notes;
      fingerOrder = fingers ? fingers.slice() : notes.map(() => null);
    } else {
      // scales/sequences: ascending then descending (skip duplicate top note)
      const up = notes.slice();
      const down = notes.slice(0, -1).reverse();
      order = up.concat(down);
      const fUp = fingers ? fingers.slice() : notes.map(() => null);
      const fDown = fingers ? fingers.slice(0, -1).reverse() : notes.slice(0, -1).map(() => null);
      fingerOrder = fUp.concat(fDown);
    }

    const interval = mode === "chord" ? 398 : 1094;  // 50% slower per request (was 199/547)
    const dur = mode === "chord" ? 2.5 : 1.54;       // note length scaled to match

    order.forEach((n, i) => {
      const t = setTimeout(() => {
        playPianoNote(n, dur);
        setLitNote(n);
        const fg = fingerOrder[i];
        setFingerMap(fg != null ? { [n]: fg } : {});
      }, i * interval);
      seqTimers.current.push(t);
    });
    const tEnd = setTimeout(() => { setLitNote(null); setFingerMap({}); setSeqPlaying(false); }, order.length * interval + 400);
    seqTimers.current.push(tEnd);
  }

  function togglePlayPause() {
    playUi("click");
    if (seqPlaying) clearSeq();       // stop right away — no need to wait it out
    else if (lastSeq.current) playSequence(lastSeq.current); // "once more" = restart the same demo from the top
  }

  function toggleChordStyle() {
    playUi("click");
    const next = chordStyle === "block" ? "broken" : "block";
    setChordStyle(next);
    if (lastSeq.current && lastSeq.current.mode === "chord") playSequence(lastSeq.current, next);
  }

  // replay the last taught sequence (for the replay button on the piano)
  function replayLast() {
    if (lastSeq.current) playSequence(lastSeq.current);
  }

  // ── record & play back your own playing (on-screen keyboard) ──
  const recordingRef = useRef(false);
  const recStartRef = useRef(0);
  const recEventsRef = useRef([]);
  const clipRef = useRef([]);
  const clipTimersRef = useRef([]);

  const handleMainKey = useCallback((n) => {
    if (recordingRef.current) recEventsRef.current.push({ note: n, t: Date.now() - recStartRef.current });
  }, []);

  function stopClip() {
    clipTimersRef.current.forEach(clearTimeout);
    clipTimersRef.current = [];
    setPlayingClip(false);
    setLitNote(null);
  }

  function toggleRecord() {
    if (recordingRef.current) {
      recordingRef.current = false;
      setRecording(false);
      clipRef.current = recEventsRef.current.slice();
      setHasClip(clipRef.current.length > 0);
    } else {
      stopClip();
      getAC();
      recEventsRef.current = [];
      recStartRef.current = Date.now();
      recordingRef.current = true;
      setRecording(true);
      setHasClip(false);
    }
  }

  function playClip() {
    const clip = clipRef.current;
    if (!clip.length || recordingRef.current) return;
    stopClip();
    getAC();
    setPlayingClip(true);
    clip.forEach(ev => {
      const t = setTimeout(() => { playPianoNote(ev.note, 0.7); setLitNote(ev.note); }, ev.t);
      clipTimersRef.current.push(t);
    });
    const endT = setTimeout(() => { setPlayingClip(false); setLitNote(null); }, clip[clip.length - 1].t + 800);
    clipTimersRef.current.push(endT);
  }

  // on unmount: cancel pending playback/clip timers, same split-out-of-
  // PianoApp's-shared-cleanup-effect treatment as use-gamification.ts.
  useEffect(() => {
    return () => {
      seqTimers.current.forEach(t => clearTimeout(t));
      seqTimers.current = [];
      clipTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  return { litNote, setLitNote, litSet, setLitSet, fingerMap, setFingerMap, fingerChart, setFingerChart, chordStyle, setChordStyle, seqIsChord, setSeqIsChord, hand, setHand, pianoOct, setPianoOct, recording, setRecording, hasClip, setHasClip, playingClip, setPlayingClip, hasSeq, setHasSeq, seqPlaying, setSeqPlaying, seqTimers, lastSeq, recordingRef, recStartRef, recEventsRef, clipRef, clipTimersRef, clearSeq, playSequence, togglePlayPause, toggleChordStyle, replayLast, handleMainKey, stopClip, toggleRecord, playClip };
}

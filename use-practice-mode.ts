import { useState, useRef, useEffect } from "react";
import {
  fingersForNotes, pcOf, centsFromPC, PITCH_TOL_CENTS, TUNE_OFFSET_CAP,
  getAC, playPianoNote, playUi, stopPracticeListeners, startMidiListener, startMicListener,
  DUP_WINDOW_MS,
  THEORY_REF,
} from "./music-engine";
import { EARN, takeEarn, logPractice, scoreDynamics, pathDoneSet, markPathDone, markPathAccuracy, pathTier, PATH_PASS_ACCURACY, bossDoneSet, markBossDone, BOSS_PASS_ACCURACY, getDueReviews, bumpMemoryStreak } from "./App";
import { logActivity } from "./shared-infra";
import { recordMemory } from "./ai-chat-context";
import { fetchChatCompletion } from "./ai-backend";
import { runTeachingLoopForPractice } from "./tigamodel/web";
/* ── use-practice-mode.ts ──
   Owns the "listen to the learner play and grade it against a target
   sequence" session: mic/MIDI/tap-driven note matching (broken = one note
   at a time, block = any order — chord/interval topics only), the mic
   tuning-drift learner, and the session lifecycle (start/restart/exit/
   finish). PracticeOverlay.tsx (Phase 2) is this hook's only external
   consumer beyond PianoApp itself — every prop it already receives keeps
   its exact original name. Extracted from PianoApp verbatim - no logic
   changes, including the hand-switch fingering-recompute effect that
   use-keyboard.ts's header explicitly left behind in PianoApp because it
   straddled both hooks: now that this hook exists, it moves in cleanly,
   reading `hand` as an ordinary param (use-keyboard.ts already returns it,
   already in scope by the time this hook is called).

   logPractice/scoreDynamics stay physically in App.tsx (module scope) and
   are exported in place rather than moved, same convention and same
   justification as use-gamification.ts's ~20 helpers: both are also read
   directly by other, non-PianoApp top-level components (logPractice by
   TodayPage/EarGymPage-or-ReadingPage; scoreDynamics will be needed again
   by use-play-along.ts, not yet extracted) and are self-contained (no
   dependencies beyond things already imported), so exporting them in place
   is the low-risk choice over relocating a shared helper for one caller.
   scoreRhythm/readPracticeBests/writePracticeBest below have exactly one
   caller (finishPractice, right here), so they stay local instead.

   Params are plain values/refs/functions already in PianoApp's scope by
   this hook's call site - no ref-sync trick needed here, unlike
   use-gamification.ts's Flag #1: nothing this hook returns is needed by an
   EARLIER hook's own call-time params, so there's no circular ordering
   constraint, just an ordinary "call this after its dependencies exist"
   placement. hand/chordStyle/setChordStyle/lastSeq/clearSeq come from
   use-keyboard.ts; earnCoins/gainExp from use-gamification.ts. The result
   screen's AI flourish is fetched standalone (fetchChatCompletion directly,
   not callClaude) so it renders inside PracticeOverlay's own result view
   instead of forcing a page/chat navigation — this hook no longer touches
   setPage/setMsgs/callClaude/topicHint/lessonKey at all. ── */

// Self-relative timing consistency — same "how close to the AVERAGE, not to an
// external target" approach as scoreDynamics (vels vs. their own mean), applied
// to the gaps between correct hits. Practice Mode is self-paced/wait-mode by
// design (see above) — there's no metronome target to grade against, so "good
// rhythm" here means EVEN spacing, not matching a tempo.
function scoreRhythm(times) {
  if (!times || times.length < 6) return null;
  const iois = [];
  for (let i = 1; i < times.length; i++) iois.push(times[i] - times[i - 1]);
  const mean = iois.reduce((s, v) => s + v, 0) / iois.length;
  if (mean <= 0) return null;
  let ok = 0, miss = 0;
  for (const v of iois) { if (Math.abs(v - mean) <= mean * 0.35) ok++; else miss++; }
  return { ok, miss };
}
// Per-drill personal best (keyed by label, +chord-style when relevant since
// block vs. broken grade completely differently — see switchPracticeChordStyle).
// Accuracy and streak track independently: a learner might set one record
// without the other in the same run.
export function readPracticeBests() { try { return JSON.parse(localStorage.getItem("tg_practice_best") || "{}") || {}; } catch (e) { return {}; } }
function writePracticeBest(key, rec) { try { const m = readPracticeBests(); m[key] = rec; localStorage.setItem("tg_practice_best", JSON.stringify(m)); } catch (e) {} }

// TIGA teaching-loop signal: a gap longer than PAUSE_GAP_MS between two
// consecutive correct hits counts as one "pause" — the loop uses pauses >= 3
// as its hesitation evidence ("หยุดคิดบ่อยระหว่างเล่น", alternatives: reading
// ahead / thinking technically / tired). Counted on correct hits only, so a
// wrong-note stall or the mic sitting silent before the first note never
// inflates the signal. 4 s is comfortably above normal reading time between
// phrases but well below "walked away from the piano".
const PAUSE_GAP_MS = 4000;

export function usePracticeMode({ hand, chordStyle, setChordStyle, lastSeq, clearSeq, earnCoins, gainExp, grantPracticeGem, isGuest, lang, bumpWeekly }) {
  // ── practice mode (listen to the learner play) ──
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [practiceTarget, setPracticeTarget] = useState([]); // note names to play, in order
  const [practiceFingers, setPracticeFingers] = useState([]);
  const [practiceLabel, setPracticeLabel] = useState("");
  const [practiceIdx, setPracticeIdx] = useState(0);    // how many notes done = current pointer
  const [practiceHitIdxs, setPracticeHitIdxs] = useState([]); // which target indices are hit — block-style chord/interval practice only (order-independent, so this can differ from practiceIdx's implied "first N")
  const [practiceMiss, setPracticeMiss] = useState(0);
  const [practiceHeard, setPracticeHeard] = useState(null); // {note, ok} last detected
  const [practiceSrc, setPracticeSrc] = useState(null);     // {type:"midi"|"mic"|"error"}
  const [practiceTune, setPracticeTune] = useState(null);   // learned tuning offset (cents) to show
  const [practiceStreak, setPracticeStreak] = useState(0);  // consecutive correct hits, resets on a real miss
  const [practiceResult, setPracticeResult] = useState(null); // set on finish; PracticeOverlay shows the in-overlay result screen instead of the live drill while this is non-null

  // ── practice-mode refs: progress lives in refs so the audio/MIDI callbacks
  // (created once when practice starts) never read stale React state ──
  const practiceActiveRef = useRef(false);
  const practiceTargetRef = useRef([]);
  const practiceKeyRef = useRef(null);   // scale/chord key so practice can recompute fingering per hand
  const practiceModeRef = useRef("seq");
  const practiceAscRef = useRef([]);     // ascending-only notes (pre up+down expansion) — lets a hand switch mid-scale recompute correctly
  const practiceBaseFingersRef = useRef([]); // this drill's fingers as originally resolved (startPractice's own fallback chain), RIGHT-hand-canonical — lets a mid-drill hand switch remirror a chord/interval that has no scale-style per-key data to relookup (e.g. a 4+-note seventh chord), instead of leaving the previous hand's numbers on screen
  const practiceIdxRef = useRef(0);
  const practiceHitSetRef = useRef(new Set()); // hit target indices — block-style chord/interval practice only
  const practiceHitsRef = useRef(0);
  // set the moment a finish pays, so a finish cannot pay twice and an exit
  // straight after one does not pay again on top
  const practicePaidRef = useRef(false);
  const practiceChordGrpRef = useRef(-1); // progression block practice: start index of the chord window currently being struck, or -1 when this drill is not a chord-by-chord progression
  const practiceMissRef = useRef(0);
  const practicePauseRef = useRef(0);  // gaps > 4 s between consecutive correct hits this drill — TIGA teaching-loop "hesitation" signal (see finishPractice)
  const practiceLastHitRef = useRef(0); // Date.now() of the previous correct hit, for the pause detection above
  const practiceVelsRef = useRef([]); // MIDI velocities of hit notes this drill — see scoreDynamics()
  const practiceTimesRef = useRef([]); // Date.now() of each correct hit this drill — see scoreRhythm()
  const practiceStreakRef = useRef(0);
  const practiceBestStreakRef = useRef(0);
  const practiceLabelRef = useRef("");
  const practiceStageIdRef = useRef(null); // Pathway stage id this drill grades, if launched from learnTopic() — null for Studio/AI-custom drills
  const practiceBossGroupRef = useRef(null); // Pathway group id, if this is a Group Boss Challenge run — see startBossChallenge()
  const practiceHandlerRef = useRef(() => {});
  const lastInputRef = useRef(null);   // for the cross-source de-duplication below
  const practiceHeardTimer = useRef(null);
  const tuneOffsetRef = useRef(0); // learned piano tuning offset (cents), mic only

  // Called after every correct hit (both broken and block paths): bumps the
  // pause counter when the gap since the previous correct hit exceeded
  // PAUSE_GAP_MS, then records this hit's time. The refs reset in the same
  // places practiceMissRef does (start/restart/switch). TIGA loop input —
  // see finishPractice's runTeachingLoopForPractice() call.
  const countHitPause = () => {
    const now = Date.now();
    if (practiceLastHitRef.current && now - practiceLastHitRef.current > PAUSE_GAP_MS) practicePauseRef.current += 1;
    practiceLastHitRef.current = now;
  };

  // Practice Mode: recompute the on-key finger numbers when the hand is switched.
  // Recomputes from the ASCENDING-only notes (fingering data is keyed to that
  // length), then re-expands up+down for scales — matching startPractice().
  useEffect(() => {
    if (!practiceOpen) return;
    const ascNotes = practiceAscRef.current.length ? practiceAscRef.current : practiceTargetRef.current;
    let pf = fingersForNotes(practiceKeyRef.current, practiceModeRef.current, ascNotes, hand);
    if (pf && practiceModeRef.current === "scale" && practiceTargetRef.current.length > ascNotes.length) {
      pf = pf.concat(pf.slice(0, -1).reverse());
    }
    if (!pf && practiceBaseFingersRef.current.length) {
      // No verified per-key/scale/3-note-triad data for this hand — mirror the
      // canonical right-hand fingers instead (same "reverse for left" rule
      // buildStageDemoSeq already uses when a lesson first opens).
      pf = hand === "left" ? practiceBaseFingersRef.current.slice().reverse() : practiceBaseFingersRef.current.slice();
    }
    if (pf) setPracticeFingers(pf);
  }, [hand, practiceOpen]);

  /* ── PRACTICE MODE ──
     Compare each note the learner plays (mic/MIDI/tap) against the target
     sequence. "Broken" (seq/scale, and chord/interval by default) advances
     one note at a time in order (Wait-Mode style). "Block" (chord/interval
     only, when chordStyle === "block") accepts the target's notes in ANY
     order — matching how notes actually arrive when several keys are
     struck together (MIDI/mic/tap each still report one pitch per event,
     just not necessarily in the demo's stored order). */
  function notePitchMatches(d, targetPC) {
    if (d.freq == null) {
      // MIDI, on-screen tap, or polyphonic-mic → digital/exact pitch class
      return pcOf(d.note) === targetPC;
    }
    // microphone (monophonic) → tolerant, tuning-aware. Measure how many cents
    // the played pitch is from the target note, re-centered by the piano's
    // learned offset, so a slightly out-of-tune string still counts as correct.
    const raw = centsFromPC(d.freq, targetPC);
    const eff = raw - tuneOffsetRef.current;
    const correct = Math.abs(eff) <= PITCH_TOL_CENTS;
    if (correct) {
      // learn this piano's tuning drift (smoothed EMA, clamped) so it gets
      // more accurate the more the learner plays
      let off = tuneOffsetRef.current * 0.7 + raw * 0.3;
      off = Math.max(-TUNE_OFFSET_CAP, Math.min(TUNE_OFFSET_CAP, off));
      tuneOffsetRef.current = off;
      setPracticeTune(Math.round(off));
    }
    return correct;
  }
  function handlePlayedNote(d) {
    if (!practiceActiveRef.current) return;
    // accept legacy string calls too, just in case
    if (typeof d === "string") d = { note: d, freq: null };
    /* ── one press, one credit ──
       With MIDI and the microphone both live, a single key press can arrive
       twice: the mic hears the MIDI instrument, or hears the app's own synth
       playing the note back. Same pitch class, DIFFERENT source, inside
       140ms = one press heard twice. Two presses of the same note that far
       apart is not something a human does on purpose, and a repeat from the
       SAME source is always honoured, so nothing real is ever dropped. */
    if (d.note) {
      const pc = pcOf(d.note);
      const src = d.source || "screen";
      const last = lastInputRef.current;
      const now = Date.now();
      if (last && last.pc === pc && last.src !== src && now - last.t < DUP_WINDOW_MS) return;
      lastInputRef.current = { pc, src, t: now };
    }
    // Polyphonic mic detection reports everything it heard in one strike as
    // d.notes. In BLOCK practice that batch is the whole point: the learner is
    // being asked to strike the chord's notes TOGETHER, so a genuine attempt
    // always presents several of the target's notes in the same batch. Requiring
    // at least two of them before crediting anything is both the pedagogically
    // correct reading of "block" and the strongest possible guard against a lone
    // stray detection silently advancing the drill — one spurious note can happen
    // from a bump or a stray harmonic, but two specific chord tones arriving
    // together essentially cannot.
    if (d.notes && d.notes.length) {
      const tg = practiceTargetRef.current;
      const hitSet = practiceHitSetRef.current;
      if ((practiceModeRef.current === "chord" || practiceModeRef.current === "prog") && chordStyle === "block") {
        // Window = the slice of the target this strike is graded against. A
        // chord PROGRESSION opens one chord at a time (practiceChordGrpRef ≥ 0
        // is the window's start, size from lastSeq.chordGroupSize — set from
        // seq.chordSizes in startPractice); a plain chord/interval lesson keeps
        // grp -1 = the whole target, which reduces every line below to exactly
        // the original whole-target behavior.
        const grp = practiceChordGrpRef.current;
        const win = grp >= 0 ? (((lastSeq.current || {}).chordGroupSize) || tg.length) : tg.length;
        const lo = grp >= 0 ? grp : 0;
        const hi = grp >= 0 ? Math.min(tg.length, grp + win) : tg.length;
        const remaining = hi - lo - hitSet.size;   // hitSet ⊆ [lo, hi) always
        const matches = [];
        for (let i = lo; i < hi; i++) {
          if (hitSet.has(i)) continue;
          if (d.notes.some(n => notePitchMatches({ note: n, freq: null }, pcOf(tg[i])))) matches.push(i);
        }
        // Only the final note(s) may be finished one at a time — otherwise a chord
        // whose last note the mic keeps missing could never be completed at all.
        const needed = Math.min(2, Math.max(1, remaining));
        if (matches.length < needed) {
          setPracticeHeard({ note: d.notes[0], ok: false });
          clearTimeout(practiceHeardTimer.current);
          practiceHeardTimer.current = setTimeout(() => setPracticeHeard(null), 650);
          return;                                  // heard something, but not a real block strike of this chord
        }
      }
      d.notes.forEach(n => handlePlayedNote({ note: n, freq: null, source: d.source }));
      return;
    }

    const targets = practiceTargetRef.current;
    const heardNote = d.note;
    const isBlock = (practiceModeRef.current === "chord" || practiceModeRef.current === "prog") && chordStyle === "block";

    if (isBlock) {
      const hit = practiceHitSetRef.current;
      // Same window rule as the batch gate above: a progression grades only the
      // current chord's slice; a plain chord/interval grades the whole target.
      const grp = practiceChordGrpRef.current;
      const win = grp >= 0 ? (((lastSeq.current || {}).chordGroupSize) || targets.length) : targets.length;
      const lo = grp >= 0 ? grp : 0;
      const hi = grp >= 0 ? Math.min(targets.length, grp + win) : targets.length;
      let matchedIdx = -1;
      for (let i = lo; i < hi; i++) {
        if (hit.has(i)) continue;
        if (notePitchMatches(d, pcOf(targets[i]))) { matchedIdx = i; break; }
      }
      if (matchedIdx >= 0) {
        hit.add(matchedIdx);
        practiceHitsRef.current += 1;
        if (d.vel != null) practiceVelsRef.current.push(d.vel);
        practiceTimesRef.current.push(Date.now());
        practiceStreakRef.current += 1;
        if (practiceStreakRef.current > practiceBestStreakRef.current) practiceBestStreakRef.current = practiceStreakRef.current;
        setPracticeStreak(practiceStreakRef.current);
        playPianoNote(targets[matchedIdx], 0.5);
        setPracticeHeard({ note: heardNote, ok: true });
        countHitPause();
        // "how many done" across the WHOLE drill: for a plain chord lo is 0, so
        // this is the original hit.size; for a progression the earlier chords
        // (all indices below the window) are already banked.
        const doneTotal = lo + hit.size;
        practiceIdxRef.current = doneTotal;
        setPracticeIdx(doneTotal);
        // The overlay reads hitIdxs as "which targets are complete": a
        // progression's completed chords stay complete, so report every index
        // below doneTotal, not just the current window.
        setPracticeHitIdxs(grp >= 0 ? Array.from({ length: doneTotal }, (_, i) => i) : Array.from(hit));
        if (doneTotal >= targets.length) finishPractice();
        else if (hit.size >= hi - lo) {
          // progression drill: this chord is complete — slide the accepted
          // window to the next chord. A plain chord/interval lesson has
          // grp -1 and hi-lo = the whole target, so it can never land here
          // (finishing is its only way out).
          const start = hi;
          const end = Math.min(targets.length, start + win);
          hit.clear();
          for (let i = start; i < end; i++) hit.add(i);
          practiceChordGrpRef.current = start;
        }
      } else {
        // A block chord keeps ringing after the first hit, and a learner who only
        // got some notes often replays the WHOLE chord to catch the rest — either
        // way the mic can re-report a note already matched. That's not a mistake,
        // just an echo of a correct note, so it must never count against accuracy
        // (or the streak — resetting a combo on a harmless echo would be unfair).
        // A note from a LATER chord of the progression (rehearsed early, or a
        // ringing string) is also not a mistake — same reasoning as the echo
        // above: it never counts against accuracy or the streak.
        const isRepeat = practiceChordGrpRef.current >= 0
          ? targets.some(tn => pcOf(tn) === pcOf(heardNote))
          : targets.some((tn, i) => hit.has(i) && pcOf(tn) === pcOf(heardNote));
        if (!isRepeat) {
          practiceMissRef.current += 1;
          setPracticeMiss(practiceMissRef.current);
          practiceStreakRef.current = 0;
          setPracticeStreak(0);
        }
        setPracticeHeard({ note: heardNote, ok: isRepeat });
      }
    } else {
      const idx = practiceIdxRef.current;
      if (idx >= targets.length) return;
      const correct = notePitchMatches(d, pcOf(targets[idx]));
      if (correct) {
        practiceHitsRef.current += 1;
        if (d.vel != null) practiceVelsRef.current.push(d.vel); // MIDI-only signal — see scoreDynamics()
        practiceTimesRef.current.push(Date.now()); // any input source — see scoreRhythm()
        practiceStreakRef.current += 1;
        if (practiceStreakRef.current > practiceBestStreakRef.current) practiceBestStreakRef.current = practiceStreakRef.current;
        setPracticeStreak(practiceStreakRef.current);
        playPianoNote(targets[idx], 0.5);
        setPracticeHeard({ note: heardNote, ok: true });
        countHitPause();
        const next = idx + 1;
        practiceIdxRef.current = next;
        setPracticeIdx(next);
        if (next >= targets.length) finishPractice();
      } else {
        practiceMissRef.current += 1;
        setPracticeMiss(practiceMissRef.current);
        practiceStreakRef.current = 0;
        setPracticeStreak(0);
        setPracticeHeard({ note: heardNote, ok: false });
      }
    }
    clearTimeout(practiceHeardTimer.current);
    practiceHeardTimer.current = setTimeout(() => setPracticeHeard(null), 650);
  }
  practiceHandlerRef.current = handlePlayedNote; // keep fresh closure for the listeners

  // Shared by startPractice/restartPractice/switchPracticeChordStyle — always
  // releases whatever listener is currently open (there may be none, or a
  // live one left by a drill still in progress) and acquires a fresh one for
  // the drill about to (re)start. Centralizing this means every entry point
  // that starts a drill is guaranteed a live listener, instead of relying on
  // each caller to remember to reacquire one itself — see restartPractice()'s
  // header for the bug this fixes.
  /* ── every input, all the time ──
     This used to be an either/or: if a MIDI device answered, the microphone
     was never started at all. That is wrong for the way people actually
     practise — a learner with a MIDI controller plugged into the tablet may
     still be sitting at an acoustic piano, and a learner with neither still
     has the on-screen keys. All three routes are live simultaneously now
     (screen taps never went through here at all — they call the handler
     directly — but they were the ones being blamed for the other two).
     `dedupe` below is what makes running both listeners safe. */
  async function acquireListener(usePoly) {
    stopPracticeListeners();
    setPracticeSrc(null);
    const onDetect = (d) => practiceHandlerRef.current(d);
    const srcs = [];
    const midiOk = await startMidiListener(onDetect, () => {
      srcs.push("midi"); setPracticeSrc({ type: "midi", all: srcs.slice() });
    });
    // started whether or not MIDI answered
    await startMicListener(
      onDetect,
      () => { srcs.push("mic"); setPracticeSrc({ type: midiOk ? "midi" : "mic", all: srcs.slice() }); },
      () => { if (!midiOk) setPracticeSrc({ type: "error" }); },
      usePoly ? { poly: true } : undefined
    );
  }

  // chordStyleOverride: replayDrill() below needs to grade against the style
  // a saved drill actually was (block vs. broken), which setChordStyle()
  // alone can't guarantee in time — that's a state update, and this function
  // would otherwise read the OLD chordStyle from its own closure before the
  // update lands. Every other caller omits it and gets today's normal
  // behavior (read the current chordStyle state).
  async function startPractice(chordStyleOverride) {
    // IMPORTANT: SenseiView's practice button is wired as onClick={startPractice},
    // so React hands the MouseEvent here as the first argument — truthy, so
    // `(chordStyleOverride || chordStyle) === "block"` was always false when
    // tapped from the lesson page. A block progression then never seeded its
    // chord-by-chord windows and the practice piano merged all four chords'
    // finger numbers onto the keyboard (repeated notes showed conflicting
    // fingers, e.g. G = 3 in chord I but 1 in chord V). Accept ONLY real
    // style strings; any other truthy garbage (the event) falls back to state.
    const style0 = (chordStyleOverride === "block" || chordStyleOverride === "broken") ? chordStyleOverride : chordStyle;
    const seq = lastSeq.current;
    if (!seq || !seq.notes || !seq.notes.length) return;
    clearSeq(); // actually silence any still-ringing demo chord before the mic starts listening (clearSeq now really stops the audio, not just the UI state)
    practicePaidRef.current = false;   // a fresh run is unpaid
    // finger numbers for the currently selected hand (falls back to the played fingers)
    const pf = fingersForNotes(seq.key, seq.mode, seq.notes, hand);
    let notes = seq.notes.slice();
    let fingers = pf || (seq.fingers ? seq.fingers.slice() : []);
    // Right-hand-canonical copy for a later mid-drill hand switch to remirror
    // (see practiceBaseFingersRef) — demoFingers/seq.fingers already mirror
    // for whichever hand was active when the lesson was opened, so undo that
    // once here rather than assuming "right" was the original.
    practiceBaseFingersRef.current = fingers.length ? (hand === "left" ? fingers.slice().reverse() : fingers.slice()) : [];
    practiceAscRef.current = notes;
    // a full scale is drilled ascending THEN descending — same as the audio demo
    // and the app's own fingering rule ("descending = the same fingers in
    // reverse"), and correct for whichever hand is selected since `fingers` was
    // already recomputed for `hand` above. Chords / custom AI drills stay as-is.
    if (seq.mode === "scale" && notes.length > 1) {
      notes = notes.concat(notes.slice(0, -1).reverse());
      if (fingers.length) fingers = fingers.concat(fingers.slice(0, -1).reverse());
    }
    practiceTargetRef.current = notes;
    practiceKeyRef.current = seq.key || null;
    practiceModeRef.current = seq.mode || "seq";
    practiceIdxRef.current = 0;
    // A chord PROGRESSION drilled block-style is graded chord-by-chord, not as
    // one big any-order soup: practiceHitSetRef is pre-seeded with the FIRST
    // chord's indices (so only its notes are accepted) and each completion
    // advances to the next chord's window — see handlePlayedNote(). A plain
    // chord/interval lesson stays unseeded (whole target open, any order), and
    // broken-style grading never reads the set. Progression lessons (mode
    // "prog") carry per-chord sizes in seq.chordSizes — derive the uniform
    // window from them when they're all equal (all our progressions are
    // triads, so they are), and set seq.chordGroupSize once so the rest of
    // the block-grading code can treat both modes identically.
    const gs0 = seq.chordGroupSize || ((practiceModeRef.current === "chord" || practiceModeRef.current === "prog") && Array.isArray(seq.chordSizes) && seq.chordSizes.length && seq.chordSizes.every(s => s === seq.chordSizes[0]) ? seq.chordSizes[0] : 0);
    const seed0 = (practiceModeRef.current === "chord" || practiceModeRef.current === "prog") && style0 === "block" && gs0 > 0 && gs0 < notes.length;
    practiceChordGrpRef.current = seed0 ? 0 : -1;
    practiceHitSetRef.current = seed0 ? new Set(notes.slice(0, gs0).map((_, i) => i)) : new Set();
    // Persist the derived uniform window back onto lastSeq so every other
    // reader (handlePlayedNote's window, restartPractice, the drill-deck save)
    // sees the same size without re-deriving chordSizes each time.
    if (seed0 && !seq.chordGroupSize) lastSeq.current = { ...seq, chordGroupSize: gs0 };
    practiceHitsRef.current = 0;
    practiceMissRef.current = 0;
    practicePauseRef.current = 0;   // TIGA loop signals reset with every fresh drill — same lifecycle as the counters above
    practiceLastHitRef.current = 0;
    practiceVelsRef.current = [];
    practiceTimesRef.current = [];
    practiceStreakRef.current = 0;
    practiceBestStreakRef.current = 0;
    practiceLabelRef.current = seq.label || "";
    practiceStageIdRef.current = seq.stageId || null;
    practiceBossGroupRef.current = seq.bossGroup || null;
    practiceActiveRef.current = true;
    setPracticeTarget(notes);
    setPracticeFingers(fingers);
    setPracticeLabel(seq.label || "");
    setPracticeIdx(0);
    setPracticeHitIdxs([]);
    setPracticeMiss(0);
    setPracticeHeard(null);
    setPracticeSrc(null);
    setPracticeTune(null);
    setPracticeStreak(0);
    setPracticeResult(null);
    tuneOffsetRef.current = 0; // re-learn tuning for whatever piano is used now
    setPracticeOpen(true);
    getAC(); // unlock/resume audio inside the click gesture
    // Block-style chord/interval/progression practice needs the polyphonic mic
    // path so several notes struck together on a real piano can each be heard —
    // the default monophonic detector only ever names the loudest one.
    await acquireListener((seq.mode === "chord" || seq.mode === "prog") && style0 === "block");
  }

  // Resets a drill's progress and starts it over — from either the mid-drill
  // "Restart" button or the result screen's "Play Again". Deliberately does
  // NOT touch the mic/MIDI listener. An earlier version of this fix made it
  // reacquire one unconditionally (to fix "Play Again" leaving a dead
  // listener — see finishPractice(), which used to stop it on every finish),
  // and that DID work — verified by counting real acquisition attempts — but
  // broke worse on real phones/tablets: repeatedly tearing down and rebuilding
  // a getUserMedia() mic stream is itself exactly the kind of rapid
  // stop/restart cycle iOS Safari (and some Android WebViews) can silently
  // botch — the stream opens, the UI looks ready, but no audio actually comes
  // through, for that round and every one after. The real fix is to never
  // tear the listener down between rounds at all: finishPractice() no longer
  // stops it (practiceActiveRef alone already makes it ignore anything heard
  // on the result screen), so the SAME listener started once by
  // startPractice()/replayDrill() just keeps running, correctly configured,
  // for every subsequent round — nothing to reacquire, nothing to race.
  function restartPractice(chordStyleOverride) {
    // Same MouseEvent guard as startPractice above — switchPracticeChordStyle
    // passes a proper string, but restartPractice is ALSO wired directly to
    // buttons (ผิดพลาด/Play Again), which would smuggle the event in here too.
    const styleR = (chordStyleOverride === "block" || chordStyleOverride === "broken") ? chordStyleOverride : chordStyle;
    practiceIdxRef.current = 0;
    // Re-derive the chord-by-chord windows from the CURRENT seq (lastSeq), not
    // from startPractice's closure — a mid-drill Block⇄Broken switch (see
    // switchPracticeChordStyle) lands here after its setChordStyle() has NOT
    // yet been applied to state, so the style must arrive as an argument.
    const seqR = lastSeq.current;
    const gsR = (seqR && seqR.chordGroupSize) || ((seqR && (seqR.mode === "chord" || seqR.mode === "prog") && Array.isArray(seqR.chordSizes) && seqR.chordSizes.length && seqR.chordSizes.every(s => s === seqR.chordSizes[0])) ? seqR.chordSizes[0] : 0);
    const tgtR = practiceTargetRef.current;
    const seedR = (practiceModeRef.current === "chord" || practiceModeRef.current === "prog") && styleR === "block" && gsR > 0 && gsR < tgtR.length;
    practiceChordGrpRef.current = seedR ? 0 : -1;
    practiceHitSetRef.current = seedR ? new Set(tgtR.slice(0, gsR).map((_, i) => i)) : new Set();
    // Persist the derived window back onto lastSeq (same as startPractice does)
    // so the PracticeOverlay's chordGroupSize prop — read from lastSeq at render
    // time, right after this restart — lights only the CURRENT chord's notes.
    // Without this, a mid-drill Block⇄Broken switch on a progression merged all
    // four chords' finger numbers onto the keyboard (repeated notes across
    // chords showed conflicting fingers — e.g. G as 3 in I but 1 in V).
    if (seedR && seqR && !seqR.chordGroupSize) lastSeq.current = { ...seqR, chordGroupSize: gsR };
    practiceHitsRef.current = 0;
    practiceMissRef.current = 0;
    practicePauseRef.current = 0;   // TIGA loop signals reset with every fresh drill — same lifecycle as the counters above
    practiceLastHitRef.current = 0;
    practiceVelsRef.current = [];
    practiceTimesRef.current = [];
    practiceStreakRef.current = 0;
    practiceBestStreakRef.current = 0;
    practiceActiveRef.current = true;
    setPracticeIdx(0);
    setPracticeHitIdxs([]);
    setPracticeMiss(0);
    setPracticeHeard(null);
    setPracticeStreak(0);
    setPracticeResult(null); // "Play Again" from the result screen returns to the live drill
  }

  // switch Block ⇄ Broken WHILE already inside a practice session (interval and
  // every chord topic share the "chord" practice mode, so this covers both) —
  // restarts the current attempt since block vs. broken grade completely
  // differently (all-at-once vs. one-at-a-time). Unlike a plain restart, this
  // ONE case genuinely needs a fresh listener — block vs. broken need
  // different mic modes (polyphonic vs. monophonic) — so it's the only
  // caller that still tears down and reacquires.
  async function switchPracticeChordStyle() {
    if (practiceModeRef.current !== "chord" && practiceModeRef.current !== "prog") return;
    playUi("click");
    const next = chordStyle === "block" ? "broken" : "block";
    setChordStyle(next);
    restartPractice(next); // pass the new style — state hasn't updated yet inside restartPractice
    getAC();
    await acquireListener(next === "block");
  }

  // Drill Deck — replay a past drill straight from its saved best-record,
  // bypassing playSequence()/lastSeq's usual "demo just played on the piano"
  // path entirely. use-voice-tutor.ts's own voice-launched practice flow
  // already sets lastSeq.current directly the same way (see its header), so
  // this is a proven pattern, not a new one. If this drill graded a Pathway
  // stage or Boss Challenge originally, replaying it still can (chasing a
  // better tier/clearing a boss later), since stageId/bossGroup ride along
  // with the rest of the saved record — same as any fresh attempt.
  function replayDrill(entry) {
    if (!entry || !entry.notes || !entry.notes.length) return;
    const style = entry.mode === "chord" && entry.chordStyle ? entry.chordStyle : chordStyle;
    if (style !== chordStyle) setChordStyle(style); // keep the persistent toggle in sync for next render; startPractice(style) below doesn't wait on it
    lastSeq.current = { notes: entry.notes, mode: entry.mode, key: entry.key, label: entry.label, stageId: entry.stageId, bossGroup: entry.bossGroup, chordGroupSize: entry.chordGroupSize || null, fingers: null };
    startPractice(style);
  }

  function exitPractice() {
    /* Leaving early still pays for what you actually played. A drill you gave
       up on halfway is still half a drill of practice, and paying nothing for
       it taught people to avoid the hard ones. Capped per day so it cannot
       become a tap-in-tap-out coin tap. */
    if (!practicePaidRef.current && practiceHitsRef.current >= 4 && takeEarn("partial")) {
      earnCoins(Math.min(EARN.practice, practiceHitsRef.current * EARN.partial));
      gainExp(6, { quest: true });
    }
    practicePaidRef.current = false;
    practiceActiveRef.current = false;
    stopPracticeListeners();
    clearTimeout(practiceHeardTimer.current);
    setPracticeOpen(false);
    setPracticeHeard(null);
    setPracticeResult(null);
  }

  function finishPractice() {
    const total = practiceTargetRef.current.length;
    if (practicePaidRef.current) return;      // a finish pays exactly once
    const hits = practiceHitsRef.current;
    const miss = practiceMissRef.current;
    const accuracy = hits + miss > 0 ? Math.round((hits / (hits + miss)) * 100) : 100;
    const label = practiceLabelRef.current;
    const bestStreak = practiceBestStreakRef.current;
    // Memory Streak — was this stage actually due for SRS review right now?
    // Captured before markPathAccuracy() below reschedules it (which would
    // otherwise make it read as "not due" by the time this check ran).
    const wasDueStage = !!practiceStageIdRef.current && getDueReviews().stages.some(s => s.id === practiceStageIdRef.current);
    practiceActiveRef.current = false; // handlePlayedNote no-ops on anything heard while the result screen is up — that's all "stop listening" actually requires
    clearTimeout(practiceHeardTimer.current);
    // Overlay stays open — the result now renders in-place (see practiceResult
    // below) instead of exiting to a chat text summary the learner had to go
    // find on a different page. The mic/MIDI listener is deliberately left
    // running (NOT stopped here) — see restartPractice()'s header for why
    // tearing it down between rounds, even to correctly reacquire it, is
    // itself the source of a worse bug on real devices.

    logPractice(accuracy);
    logActivity("drill", label || "drill", hits, miss, Math.max(20, total * 2));
    const dyn = scoreDynamics(practiceVelsRef.current);
    if (dyn) logActivity("drill", label || "drill", dyn.ok, dyn.miss, 0, "dynamics");
    const rhythm = scoreRhythm(practiceTimesRef.current);
    if (rhythm) logActivity("drill", label || "drill", rhythm.ok, rhythm.miss, 0, "rhythm");
    recordMemory(label, accuracy);

    // Personal best, per drill (+chord-style when relevant — block vs. broken
    // grade completely differently, see switchPracticeChordStyle). Accuracy and
    // streak track independently since a run might set one record without the
    // other. Computed BEFORE granting the reward below, so a genuine new best
    // can pay a small bonus on top — every other feature's per-drill best this
    // gamification pass added (belts, speed ranks, the ladder, Posture Streak)
    // rewards genuine improvement specifically; Practice Mode never did.
    const bestKey = practiceModeRef.current === "chord" ? `${label}|${chordStyle}` : label;
    const bests = readPracticeBests();
    const prevBest = bests[bestKey] || null;
    const isNewBest = !prevBest || accuracy > prevBest.accuracy || bestStreak > prevBest.bestStreak;
    /* Practice pays DOUBLE a Pathway chapter: playing something is harder than
       reading about it, and the economy should say so. Accuracy and a genuine
       new best add on top, so a sloppy run still pays but a good one pays
       properly. */
    /* Practice is the thing we most want repeated, so it pays like it. A base,
       a quarter of the accuracy, the best streak of the run, and a real bonus
       for beating your own record: a sloppy run still pays, a good one pays
       several times a Pathway chapter. */
    const streakBonus = Math.min(20, bestStreak * 2);
    earnCoins(EARN.practice + Math.round(accuracy / 4) + streakBonus + (isNewBest ? 25 : 0));
    gainExp(20 + Math.round(accuracy / 5) + (isNewBest ? 10 : 0), { quest: true }); // 20–40 EXP scaled by accuracy, +10 on a genuine new best
    practicePaidRef.current = true;
    /* Gems, and ONLY here. They are deliberately much rarer than coins: a drill
       has to come in at 90%+ to qualify at all, it pays one gem rather than a
       handful, and the server caps how many a day can be granted — gems are
       protected by a database trigger precisely so the client cannot mint
       them, so this asks and the server decides. If the RPC is not deployed
       yet the call simply fails and no gem is granted; coins are unaffected. */
    if ((accuracy >= 70 || isNewBest) && grantPracticeGem) grantPracticeGem();
    // Weekly challenges — "games"/"perfect" used to only ever bump from Play
    // Along's finishSong(), so Practice Mode could never complete 6 of the
    // week's 9 rotating challenge types. hits = notes actually played correctly.
    if (bumpWeekly) { bumpWeekly("games", 1); if (hits) bumpWeekly("perfect", hits); }
    writePracticeBest(bestKey, {
      accuracy: Math.max(accuracy, prevBest ? prevBest.accuracy : 0),
      bestStreak: Math.max(bestStreak, prevBest ? prevBest.bestStreak : 0),
      at: Date.now(),
      // Drill Deck — replay data, always refreshed to the drill just played
      // regardless of whether accuracy/streak improved (unlike the two
      // fields above, this isn't a "max", just "what this drill currently
      // is"). practiceAscRef, not practiceTargetRef: the ASCENDING-only
      // notes, before startPractice()'s own up+down scale expansion —
      // replayDrill() below feeds this back into startPractice() the same
      // way a fresh lastSeq from playSequence() would, so it must match
      // that pre-expansion shape or a scale would double-expand.
      notes: practiceAscRef.current.slice(),
      mode: practiceModeRef.current,
      key: practiceKeyRef.current,
      chordGroupSize: (lastSeq.current && lastSeq.current.chordGroupSize) || null,
      label,
      stageId: practiceStageIdRef.current,
      bossGroup: practiceBossGroupRef.current,
      chordStyle: practiceModeRef.current === "chord" ? chordStyle : null,
    });

    // Pathway completion — requires actually passing THIS stage's own drill,
    // not just having opened the lesson (see learnTopic()'s header comment).
    // pathUnlocked only fires the first time a stage crosses the bar; playing
    // it again afterward (e.g. chasing a better tier) updates the accuracy/
    // tier silently without re-showing the unlock celebration.
    let pathUnlocked = null;
    if (practiceStageIdRef.current && accuracy >= PATH_PASS_ACCURACY) {
      const wasAlreadyDone = pathDoneSet().has(practiceStageIdRef.current);
      markPathDone(practiceStageIdRef.current);
      markPathAccuracy(practiceStageIdRef.current, accuracy);
      if (!wasAlreadyDone) pathUnlocked = { label, tier: pathTier(accuracy) };
    }

    // Group Boss Challenge — a combined run across a whole group's stages, so
    // it's graded on its own (higher) bar rather than folding into any single
    // stage's tier/SRS schedule. First-time clears get a bonus on top of the
    // normal accuracy-scaled reward, same "capstone feels bigger" reasoning as
    // the milestone bonuses elsewhere in the reward economy.
    let bossDefeated = null;
    if (practiceBossGroupRef.current && accuracy >= BOSS_PASS_ACCURACY) {
      const groupId = practiceBossGroupRef.current;
      const wasAlreadyDone = bossDoneSet().has(groupId);
      markBossDone(groupId);
      if (!wasAlreadyDone) {
        bossDefeated = { groupId, label };
        earnCoins(50);
        gainExp(75, { quest: true });
      }
    }

    // Memory Streak — credit for reviewing a stage that was actually due,
    // pass or fail (see wasDueStage above): showing up for the review is the
    // habit being rewarded, same "showing up counts" treatment as every
    // other per-feature streak this pass added.
    let memoryStreak = null;
    if (wasDueStage) {
      const r = bumpMemoryStreak();
      if (r.bumped) {
        earnCoins(5 + (r.tierUp ? 10 : 0));
        gainExp(10 + (r.tierUp ? 25 : 0), { quest: true });
        memoryStreak = r;
      }
    }

    // One sound cue for the whole result, not one per celebration — several
    // of the above can land on the same drill (a due review that also sets
    // a new best, say), and firing playUi() once per event would layer them
    // into a muddle instead of one clean cue. Loudest event wins.
    playUi(bossDefeated || (memoryStreak && memoryStreak.tierUp) || pathUnlocked ? "levelup" : isNewBest || memoryStreak ? "reward" : "click");

    /* ── TIGA teaching loop (P2 wiring, owner-approved direction): analyze
       this drill with the model BEFORE anything renders. Real signals in —
       accuracy, repeated errors, pauses (now actually counted per hit gap),
       rhythm and dynamics percentages — the policy picks a strategy, the KB
       appends a teach tip. All local/synchronous: zero latency on the result
       screen, zero network cost, and it still works for guests (whose AI
       flourish below is skipped). prevBest tells the loop whether accuracy
       moved vs. the learner's own bar. Null on any failure — the loop is an
       enhancement, never a crash path (same convention as kbTipFor). ── */
    const weekAgoAccuracy = (() => { try {
      const m = JSON.parse(localStorage.getItem("tg_memory") || "null");
      if (!m || !Array.isArray(m.recent)) return null;
      const prev = m.recent.find(r => r.label === label);
      return prev && prev.acc != null ? prev.acc : null;   // ~"last time" — the closest honest weekly proxy the app tracks
    } catch (e) { return null; } })();
    const rhythmPct = rhythm ? Math.round((rhythm.ok / (rhythm.ok + rhythm.miss)) * 100) : null;
    const tigaLoop = runTeachingLoopForPractice({
      accuracy,
      repeatedErrors: bestStreak === 0 && miss >= 2 ? miss : (miss >= 4 ? miss : 0),
      // miss >= 2 with a broken combo is the loop's own "repeated error"
      // shape; a high miss count alone (>= 4) reads as repeated errors even
      // when the streak survived. passMisses → repeatedErrorLabel for the KB tip.
      repeatedErrorLabel: label,
      pauses: practicePauseRef.current,
      rhythmScore: rhythmPct,
      speedRatio: null,
      weekAgoAccuracy,
    });
    const tigaTip = tigaLoop && tigaLoop.response ? { text: tigaLoop.response.text, strategyId: tigaLoop.decision ? tigaLoop.decision.strategy_id : null, states: tigaLoop.states } : null;

    setPracticeResult({ label, total, hits, miss, accuracy, bestStreak, dyn, rhythm, prevBest, isNewBest, pathUnlocked, bossDefeated, memoryStreak, aiText: null, aiLoading: !isGuest, tigaTip });

    // Bonus AI flourish on top of an already-complete local result — fetched
    // standalone (not through the shared chat thread/callClaude) so it can
    // render right inside the result screen instead of forcing a page/chat
    // navigation. Skipped quietly for guests, same as before: practice itself
    // stays fully free during the trial, this is just a nice-to-have on top.
    // The loop's verdict now also feeds the prompt: the AI gets the SAME
    // structured signals + chosen strategy + KB tip as data, so its message
    // extends the model's teaching decision instead of possibly contradicting
    // it (spec §21 — the loop OBSERVE→…→RESPOND, the provider renders it).
    if (!isGuest) {
      const loopCtx = tigaTip
        ? `\n\n[TIGA MODEL ANALYSIS — follow this teaching decision, do not contradict it.\nStrategy: ${tigaTip.strategyId || "none"}\nSignals: accuracy ${accuracy}%, misses ${miss}, pauses ${practicePauseRef.current}${rhythmPct != null ? `, rhythm ${rhythmPct}%` : ""}${weekAgoAccuracy != null ? `, last time ${weekAgoAccuracy}%` : ""}\nStates: ${tigaTip.states.map(s => `${s.state}@${s.probability.toFixed(2)}`).join(", ") || "none"}\nModel message: ${tigaTip.text}]`
        : "";
      const fb = lang === "th"
        ? `ผู้เรียนเพิ่งฝึกเล่น "${label}" บนเปียโน เล่นถูกครบ ${total} โน้ต ความแม่นยำ ${accuracy}% (เล่นผิดระหว่างทาง ${miss} ครั้ง) คอมโบสูงสุด ${bestStreak} โน้ตติด ในฐานะครูเปียโน TiGA ช่วยชมและให้กำลังใจสั้นๆ อบอุ่น แล้วแนะนำ 1-2 จุดที่ควรฝึกต่อให้ดีขึ้น ตอบกระชับเป็นภาษาไทย ไม่ต้องระบุชื่อโน้ต${loopCtx}`
        : lang === "zh"
        ? `学员刚在钢琴上练习了"${label}"，完成全部 ${total} 个音，准确率 ${accuracy}%（中途失误 ${miss} 次），最高连击 ${bestStreak} 个音。作为 TiGA 钢琴老师，请简短温暖地表扬鼓励，并给出 1-2 个可继续提升的小建议。简洁中文回答，不要列音名${loopCtx}`
        : `The learner just practiced "${label}" on piano, completing all ${total} notes at ${accuracy}% accuracy (${miss} wrong notes along the way), with a best combo of ${bestStreak} notes in a row. As TiGA the piano teacher, give a short, warm word of praise and encouragement, then 1-2 tips to improve next. Be concise; no note names needed.${loopCtx}`;
      fetchChatCompletion({ message: fb, conversationHistory: [], system: THEORY_REF, stream: false, feature: "practice-tip" })
        .then(txt => setPracticeResult(prev => (prev && prev.label === label ? { ...prev, aiText: txt || null, aiLoading: false } : prev)))
        .catch(() => setPracticeResult(prev => (prev && prev.label === label ? { ...prev, aiLoading: false } : prev)));
    }
  }
  return { practiceOpen, setPracticeOpen, practiceTarget, setPracticeTarget, practiceFingers, setPracticeFingers, practiceLabel, setPracticeLabel, practiceIdx, setPracticeIdx, practiceHitIdxs, setPracticeHitIdxs, practiceMiss, setPracticeMiss, practiceHeard, setPracticeHeard, practiceSrc, setPracticeSrc, practiceTune, setPracticeTune, practiceStreak, setPracticeStreak, practiceResult, setPracticeResult, practiceActiveRef, practiceTargetRef, practiceKeyRef, practiceModeRef, practiceAscRef, practiceIdxRef, practiceHitSetRef, practiceHitsRef, practiceMissRef, practiceVelsRef, practiceTimesRef, practiceStreakRef, practiceBestStreakRef, practiceLabelRef, practiceHandlerRef, practiceHeardTimer, tuneOffsetRef, notePitchMatches, handlePlayedNote, startPractice, restartPractice, switchPracticeChordStyle, exitPractice, finishPractice, replayDrill };
}

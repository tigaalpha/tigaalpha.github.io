import { useState, useRef, useEffect } from "react";
import {
  fingersForNotes, pcOf, centsFromPC, PITCH_TOL_CENTS, TUNE_OFFSET_CAP,
  getAC, playPianoNote, playUi, stopPracticeListeners, startMidiListener, startMicListener,
} from "./music-engine";
import { logPractice, scoreDynamics, pathDoneSet, markPathDone, markPathAccuracy, pathTier, PATH_PASS_ACCURACY } from "./App";
import { logActivity } from "./shared-infra";
import { recordMemory } from "./ai-chat-context";
import { fetchChatCompletion } from "./ai-backend";
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
function readPracticeBests() { try { return JSON.parse(localStorage.getItem("tg_practice_best") || "{}") || {}; } catch (e) { return {}; } }
function writePracticeBest(key, rec) { try { const m = readPracticeBests(); m[key] = rec; localStorage.setItem("tg_practice_best", JSON.stringify(m)); } catch (e) {} }

export function usePracticeMode({ hand, chordStyle, setChordStyle, lastSeq, clearSeq, earnCoins, gainExp, isGuest, lang }) {
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
  const practiceIdxRef = useRef(0);
  const practiceHitSetRef = useRef(new Set()); // hit target indices — block-style chord/interval practice only
  const practiceHitsRef = useRef(0);
  const practiceMissRef = useRef(0);
  const practiceVelsRef = useRef([]); // MIDI velocities of hit notes this drill — see scoreDynamics()
  const practiceTimesRef = useRef([]); // Date.now() of each correct hit this drill — see scoreRhythm()
  const practiceStreakRef = useRef(0);
  const practiceBestStreakRef = useRef(0);
  const practiceLabelRef = useRef("");
  const practiceStageIdRef = useRef(null); // Pathway stage id this drill grades, if launched from learnTopic() — null for Studio/AI-custom drills
  const practiceHandlerRef = useRef(() => {});
  const practiceHeardTimer = useRef(null);
  const tuneOffsetRef = useRef(0); // learned piano tuning offset (cents), mic only

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
      if (practiceModeRef.current === "chord" && chordStyle === "block") {
        const remaining = tg.length - hitSet.size;
        const matches = [];
        for (let i = 0; i < tg.length; i++) {
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
    const isBlock = practiceModeRef.current === "chord" && chordStyle === "block";

    if (isBlock) {
      const hit = practiceHitSetRef.current;
      let matchedIdx = -1;
      for (let i = 0; i < targets.length; i++) {
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
        practiceIdxRef.current = hit.size; // reused purely as a "how many done" progress count
        setPracticeIdx(hit.size);
        setPracticeHitIdxs(Array.from(hit));
        if (hit.size >= targets.length) finishPractice();
      } else {
        // A block chord keeps ringing after the first hit, and a learner who only
        // got some notes often replays the WHOLE chord to catch the rest — either
        // way the mic can re-report a note already matched. That's not a mistake,
        // just an echo of a correct note, so it must never count against accuracy
        // (or the streak — resetting a combo on a harmless echo would be unfair).
        const isRepeat = targets.some((tn, i) => hit.has(i) && pcOf(tn) === pcOf(heardNote));
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

  async function startPractice() {
    const seq = lastSeq.current;
    if (!seq || !seq.notes || !seq.notes.length) return;
    clearSeq(); // actually silence any still-ringing demo chord before the mic starts listening (clearSeq now really stops the audio, not just the UI state)
    // finger numbers for the currently selected hand (falls back to the played fingers)
    const pf = fingersForNotes(seq.key, seq.mode, seq.notes, hand);
    let notes = seq.notes.slice();
    let fingers = pf || (seq.fingers ? seq.fingers.slice() : []);
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
    practiceHitSetRef.current = new Set();
    practiceHitsRef.current = 0;
    practiceMissRef.current = 0;
    practiceVelsRef.current = [];
    practiceTimesRef.current = [];
    practiceStreakRef.current = 0;
    practiceBestStreakRef.current = 0;
    practiceLabelRef.current = seq.label || "";
    practiceStageIdRef.current = seq.stageId || null;
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
    stopPracticeListeners(); // release any mic/MIDI another mode left open — never stack listeners
    const onDetect = (d) => practiceHandlerRef.current(d);
    const midiOk = await startMidiListener(onDetect, () => setPracticeSrc({ type: "midi" }));
    if (!midiOk) {
      // Block-style chord/interval practice needs the polyphonic mic path so
      // several notes struck together on a real piano can each be heard —
      // the default monophonic detector only ever names the loudest one.
      const usePoly = (seq.mode || "seq") === "chord" && chordStyle === "block";
      await startMicListener(onDetect, () => setPracticeSrc({ type: "mic" }), () => setPracticeSrc({ type: "error" }), usePoly ? { poly: true } : undefined);
    }
  }

  function restartPractice() {
    practiceIdxRef.current = 0;
    practiceHitSetRef.current = new Set();
    practiceHitsRef.current = 0;
    practiceMissRef.current = 0;
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
  // differently (all-at-once vs. one-at-a-time), and re-acquires the mic listener
  // because only block style needs the polyphonic path (several notes at once).
  async function switchPracticeChordStyle() {
    if (practiceModeRef.current !== "chord") return;
    playUi("click");
    const next = chordStyle === "block" ? "broken" : "block";
    setChordStyle(next);
    restartPractice();
    stopPracticeListeners();
    setPracticeSrc(null);
    const onDetect = (d) => practiceHandlerRef.current(d);
    const midiOk = await startMidiListener(onDetect, () => setPracticeSrc({ type: "midi" }));
    if (!midiOk) {
      const usePoly = next === "block";
      await startMicListener(onDetect, () => setPracticeSrc({ type: "mic" }), () => setPracticeSrc({ type: "error" }), usePoly ? { poly: true } : undefined);
    }
  }

  function exitPractice() {
    practiceActiveRef.current = false;
    stopPracticeListeners();
    clearTimeout(practiceHeardTimer.current);
    setPracticeOpen(false);
    setPracticeHeard(null);
    setPracticeResult(null);
  }

  function finishPractice() {
    const total = practiceTargetRef.current.length;
    const hits = practiceHitsRef.current;
    const miss = practiceMissRef.current;
    const accuracy = hits + miss > 0 ? Math.round((hits / (hits + miss)) * 100) : 100;
    const label = practiceLabelRef.current;
    const bestStreak = practiceBestStreakRef.current;
    practiceActiveRef.current = false;
    stopPracticeListeners();
    clearTimeout(practiceHeardTimer.current);
    // Overlay stays open — the result now renders in-place (see practiceResult
    // below) instead of exiting to a chat text summary the learner had to go
    // find on a different page.

    logPractice(accuracy);
    logActivity("drill", label || "drill", hits, miss, Math.max(20, total * 2));
    const dyn = scoreDynamics(practiceVelsRef.current);
    if (dyn) logActivity("drill", label || "drill", dyn.ok, dyn.miss, 0, "dynamics");
    const rhythm = scoreRhythm(practiceTimesRef.current);
    if (rhythm) logActivity("drill", label || "drill", rhythm.ok, rhythm.miss, 0, "rhythm");
    recordMemory(label, accuracy);
    earnCoins(5 + Math.round(accuracy / 20));
    gainExp(20 + Math.round(accuracy / 5), { quest: true }); // 20–40 EXP scaled by accuracy

    // Personal best, per drill (+chord-style when relevant — block vs. broken
    // grade completely differently, see switchPracticeChordStyle). Accuracy and
    // streak track independently since a run might set one record without the
    // other.
    const bestKey = practiceModeRef.current === "chord" ? `${label}|${chordStyle}` : label;
    const bests = readPracticeBests();
    const prevBest = bests[bestKey] || null;
    const isNewBest = !prevBest || accuracy > prevBest.accuracy || bestStreak > prevBest.bestStreak;
    writePracticeBest(bestKey, {
      accuracy: Math.max(accuracy, prevBest ? prevBest.accuracy : 0),
      bestStreak: Math.max(bestStreak, prevBest ? prevBest.bestStreak : 0),
      at: Date.now(),
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

    setPracticeResult({ label, total, hits, miss, accuracy, bestStreak, dyn, rhythm, prevBest, isNewBest, pathUnlocked, aiText: null, aiLoading: !isGuest });

    // Bonus AI flourish on top of an already-complete local result — fetched
    // standalone (not through the shared chat thread/callClaude) so it can
    // render right inside the result screen instead of forcing a page/chat
    // navigation. Skipped quietly for guests, same as before: practice itself
    // stays fully free during the trial, this is just a nice-to-have on top.
    if (!isGuest) {
      const fb = lang === "th"
        ? `ผู้เรียนเพิ่งฝึกเล่น "${label}" บนเปียโน เล่นถูกครบ ${total} โน้ต ความแม่นยำ ${accuracy}% (เล่นผิดระหว่างทาง ${miss} ครั้ง) คอมโบสูงสุด ${bestStreak} โน้ตติด ในฐานะครูเปียโน TiGA ช่วยชมและให้กำลังใจสั้นๆ อบอุ่น แล้วแนะนำ 1-2 จุดที่ควรฝึกต่อให้ดีขึ้น ตอบกระชับเป็นภาษาไทย ไม่ต้องระบุชื่อโน้ต`
        : lang === "zh"
        ? `学员刚在钢琴上练习了"${label}"，完成全部 ${total} 个音，准确率 ${accuracy}%（中途失误 ${miss} 次），最高连击 ${bestStreak} 个音。作为 TiGA 钢琴老师，请简短温暖地表扬鼓励，并给出 1-2 个可继续提升的小建议。简洁中文回答，不要列音名`
        : `The learner just practiced "${label}" on piano, completing all ${total} notes at ${accuracy}% accuracy (${miss} wrong notes along the way), with a best combo of ${bestStreak} notes in a row. As TiGA the piano teacher, give a short, warm word of praise and encouragement, then 1-2 tips to improve next. Be concise; no note names needed.`;
      fetchChatCompletion({ message: fb, conversationHistory: [], stream: false, feature: "practice-tip" })
        .then(txt => setPracticeResult(prev => (prev && prev.label === label ? { ...prev, aiText: txt || null, aiLoading: false } : prev)))
        .catch(() => setPracticeResult(prev => (prev && prev.label === label ? { ...prev, aiLoading: false } : prev)));
    }
  }
  return { practiceOpen, setPracticeOpen, practiceTarget, setPracticeTarget, practiceFingers, setPracticeFingers, practiceLabel, setPracticeLabel, practiceIdx, setPracticeIdx, practiceHitIdxs, setPracticeHitIdxs, practiceMiss, setPracticeMiss, practiceHeard, setPracticeHeard, practiceSrc, setPracticeSrc, practiceTune, setPracticeTune, practiceStreak, setPracticeStreak, practiceResult, setPracticeResult, practiceActiveRef, practiceTargetRef, practiceKeyRef, practiceModeRef, practiceAscRef, practiceIdxRef, practiceHitSetRef, practiceHitsRef, practiceMissRef, practiceVelsRef, practiceTimesRef, practiceStreakRef, practiceBestStreakRef, practiceLabelRef, practiceHandlerRef, practiceHeardTimer, tuneOffsetRef, notePitchMatches, handlePlayedNote, startPractice, restartPractice, switchPracticeChordStyle, exitPractice, finishPractice };
}

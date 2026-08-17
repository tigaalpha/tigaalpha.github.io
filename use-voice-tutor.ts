import { useState, useRef, useEffect } from "react";
import {
  NF, pcOf, getAC, playPianoNote, stopAllPianoNotes, playUi, haptic,
  stopPracticeListeners, startMicListener, _practiceStop, _sfxMuted,
  _ascNotes, chordNotesOf, identifyChord, interpretPlayed, rhythmReport,
  transposeNotes, vmThinkCue, FINGERING_REF,
} from "./music-engine";
import { L } from "./i18n";
import {
  TTS_LOCALES, ttsSupported, getSR, sttSupported, speakDeviceOrNative, stopSpeaking,
  stopCloudTTS, getVmVoiceKey, setTtsMood, speakCloud, fetchCloudClips, playCloudClips,
} from "./speech";
import { readMemory, touchSessionMemory, memoryContext, setHomeworkLS, homeworkContext } from "./ai-chat-context";
import { streamChatCompletion } from "./ai-backend";
import { dayKey, logActivity } from "./shared-infra";
import { SONGS } from "./songs-data";
import { isAndroidNative, curriculumContext, songRecommendationHint, setLessonPlanLS, buildAlternatingHistory, levelInfo, vmDisplayText } from "./App";
/* ── use-voice-tutor.ts ──
   Owns the AI Voice Tutor: the turn-based, hands-free voice lesson
   (Android-app-only - openVoice()/startVoiceSession() both gate on
   isAndroidNative and return immediately on web or iOS). This is Phase 3's highest-
   risk, largest, and least verifiable step - the governing plan itself
   flags it as "confirmed structurally unreachable in any web/headless
   context": a clean build proves the rest of the app still works with
   this hook in place, nothing about Voice Tutor's own behavior, which
   needs a real Android device to exercise at all (mic permission, real
   STT/TTS, Capacitor.isNativePlatform() actually true). Same treatment
   already given to analyzeHands' AI path and the live MediaPipe loop in
   use-camera-coach.ts (Phase 3.6), just for the entire hook this time.
   VoiceTutorOverlay.tsx (Phase 2.9) is this hook's only external
   consumer; every prop it already receives keeps its exact original name.

   The metronome engine (metroOn/setMetroOn/metroBpm/setMetroBpm,
   metroBeatRef/metroBeatTimesRef, its own tick effect, and
   metroTimingReport()) is NOT part of this hook despite sitting
   textually between vmEndRef's scroll effect and the rest of PianoApp -
   it's a general Settings-panel feature usable with or without a voice
   session open (metroOn/metroBpm are toggled from SfxMetronomeSettings,
   Phase 2.6), so it stays in PianoApp. vmActSeg's [metro:] tag handler
   only needs setMetroOn/setMetroBpm (threaded params); vmProcess's
   rhythm-vs-click grading only needs metroTimingReport itself threaded
   as a param (a PianoApp closure, same convention as requireLogin -
   moving it would just mean threading metroBeatTimesRef/metroOn/metroBpm
   separately instead of the one function that already closes over them).

   session/profile/lang/homework/setHomework/setPage/setStudioView are
   PianoApp props/state threaded as ordinary params. openCamera
   (use-camera-coach.ts), chooseSong (use-play-along.ts), startPractice
   (use-practice-mode.ts) and lastSeq (use-keyboard.ts) are threaded the
   same way, needed only by vmActSeg's [posture:]/[song:]/[practice:] tag
   handlers. No gainExp/earnCoins/bumpWeekly calls exist anywhere in this
   hook (confirmed by direct search) - voice sessions log to the activity
   feed (vmLogSegment -> logActivity("voice", ...)) but award no
   coins/EXP, an existing product characteristic unrelated to this move.

   curriculumContext()/songRecommendationHint() (both top-level, both
   used only here) and setLessonPlanLS() (top-level, used only here) are
   new exports in place rather than relocations: curriculumContext's own
   dependencies (pathDoneSet/keyDoneMap/nextRecommendedAction/
   readLessonPlan) and songRecommendationHint's (computeSkillScores/
   weakestSkills/SKILL_LABELS) are each genuinely multi-consumer
   elsewhere in App.tsx (TodayPage, ProfileDashboardPanel, CoachPage,
   the AI Mentor recommendation engine), so pulling the wrapper functions
   out without their shared infrastructure isn't possible - same
   convention as logGame/logPractice/scoreDynamics/API_MODEL/EXP.
   isAndroidNative is also a new export in place (used elsewhere in App.tsx,
   e.g. StudioPage's own voice-card gating). buildAlternatingHistory is
   already exported (Phase 3.8) - a plain new import here, not a new
   export.

   Ordering note: like use-chat.ts, this hook's params include values
   returned by earlier hooks (openCamera/chooseSong/startPractice/
   lastSeq), so PianoApp's call site must come after all of those -
   placed right after usePracticeMode()'s call site (the latest of the
   four), which is itself already after use-keyboard/use-play-along/
   use-camera-coach/use-chat. ── */
export function useVoiceTutor({ lang, session, profile, homework, setHomework, setPage, setStudioView, setMetroOn, setMetroBpm, metroTimingReport, openCamera, chooseSong, startPractice, lastSeq }) {
  // ── AI voice tutor ──
  const [vmOpen, setVmOpen] = useState(false);
  const [vmState, setVmState] = useState("idle");            // idle|listening|thinking|speaking|error
  const [vmCaption, setVmCaption] = useState("");
  const [vmMsgs, setVmMsgs] = useState([]);
  const [vmNotes, setVmNotes] = useState([]);
  const [vmErr, setVmErr] = useState(null);

  // voice tutor runtime
  const vmActiveRef = useRef(false);
  const vmStateRef = useRef("idle");
  const vmRecRef = useRef(null);
  const vmMsgsRef = useRef([]);
  const vmNotesRef = useRef([]);
  const vmFrozenRef = useRef(false);
  const vmPlayReactT = useRef(null);   // fires after the learner plays then pauses → AI reacts like a listening teacher
  const vmSilenceT = useRef(null);     // finalize speech after a short pause (continuous STT)
  const vmRestartT = useRef(null);     // quick re-arm of the recognizer so the ear stays open
  const vmWatchdogT = useRef(null);    // backstop: recover a silently-dead recognizer
  const vmListenSeqRef = useRef(0);    // invalidates stale recognizer callbacks across restarts
  const vmEndRef = useRef(null);
  const vmLastActivityRef = useRef(0); // last time we heard speech OR a played note, while listening
  const vmIdleNudgedRef = useRef(false); // has this silent stretch already gotten its one gentle check-in?
  const vmIdleTimerRef = useRef(null); // recurring watcher (a real teacher eventually breaks a long silence)
  const vmSelfSpeakingRef = useRef(false); // true while the idle-nudge plays over speakers WHILE the recognizer is still live — so the mic can't mishear its own voice as the learner talking
  const vmEarResetRef = useRef(() => {});  // clears the live ear's partial-speech buffers (used when a typed message supersedes whatever was half-heard)
  const vmEarFlushRef = useRef(() => {});  // surfaces buffered speech once back in "listening" (short mid-reply answers, words spoken over a filler)
  const vmDeafCountRef = useRef(0);        // consecutive watchdog restarts with zero audio → free the note-mic (it may be starving STT)
  const vmTallyOkRef = useRef(0);          // whole-session ✓ count → real lesson stats for the teacher
  const vmTallyMissRef = useRef(0);        // whole-session ✗ count
  const [vmFast, setVmFast] = useState(false);  // default = natural HQ cloud voice (falls back to device on weak signal)
  const vmFastRef = useRef(false);
  const [vmSpeed, setVmSpeed] = useState(1);    // demo playback speed: 1 / 1.25 / 1.5 / 1.75 / 2
  const vmSpeedRef = useRef(1);
  const [vmVoice, setVmVoice] = useState(getVmVoiceKey());  // voice character (warm/deep/friendly/bright)
  const [vmPoly, setVmPoly] = useState(() => { try { return localStorage.getItem("tg_vmpoly") === "1"; } catch (e) { return false; } }); // beta: hear chords from mic
  const vmPolyRef = useRef(false);
  const [vmLangOpen, setVmLangOpen] = useState(false);  // top-right language switcher inside voice mode
  const [vmMenuOpen, setVmMenuOpen] = useState(false);  // ⋯ settings popover (speed/voice/HQ/chord-ear), bottom-right
  const langRef = useRef(lang);                          // lets an in-flight (stale-closure) recognizer still read the CURRENT language
  const vmLastDemoRef = useRef(null);           // last [play]/[chord] demo → instant "again" replay
  const vmStreakRef = useRef(0);                // consecutive correct notes this session → adaptive pacing
  const vmMissRef = useRef(0);                  // consecutive misses → ease off
  const vmRecoveredRef = useRef(false);         // just broke a rough patch (misses → correct) — celebrate it like a human would
  const vmFillersRef = useRef([]);              // pre-decoded "mm-hmm / okay" active-listening clips (same warm voice)
  const vmFillerSrcRef = useRef(null);          // currently-playing filler (stopped the instant real speech starts)
  const vmCloudDeadRef = useRef(false);  // cloud TTS failed this session → stick to the local voice (smooth on weak signal)
  const [vmLit, setVmLit] = useState([]);       // keys the AI highlights on the voice-mode piano
  const vmLitT = useRef(null);
  const [vmStaff, setVmStaff] = useState(null); // notes the teacher shows on the staff ([staff:])
  const [vmInstant, setVmInstant] = useState(null); // {ok,id} instant ✓/✗ flash on the learner's note
  const vmInstantT = useRef(null);
  const vmExpectRef = useRef(null);             // Set of expected pitch classes (for instant feedback)
  const vmSeqRef = useRef(null);                // ORDERED expected pitch classes → pinpoint the first wrong note
  const vmEarRef = useRef(null);                // active ear-training target {label, notes, pcs}
  const vmInterruptRef = useRef(false);         // set when the learner barges in (tap/play) to stop the AI
  const vmTurnRef = useRef(0);                   // turn token — a newer turn supersedes a barged-in one
  const vmSpokenRef = useRef("");               // rolling tail of what the teacher just SAID aloud → self-echo filter
  const vmSpokeAtRef = useRef(0);               // when the teacher's audio last started/ended (echo freshness window)
  const vmSessionStartRef = useRef(0);          // lesson clock — a human teacher paces the session & wraps up on time
  const vmActStartRef = useRef(0);              // activity-log segment start (survives pause/resume without double counting)
  const vmFillerLastRef = useRef(-1);           // never play the exact same "mm-hmm" clip twice in a row
  const [vmInput, setVmInput] = useState("");   // typed message (STT fallback / by choice)

  // ════ AI VOICE TUTOR (turn-based, hands-free) ════
  // Switching language mid-session (top-right button): keep the ref fresh for any
  // in-flight recognizer, drop the now-wrong-language filler cache, and if the ear
  // is actively listening right now, restart it immediately so it hears the new
  // language on the very next word instead of waiting for the next natural turn.
  useEffect(() => {
    langRef.current = lang;
    if (!vmActiveRef.current) return;
    vmFillersRef.current = [];
    prefetchFillers();
    vmSpawnEar(); // rec.lang is fixed at construction — respawn the persistent ear in the new language (any state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);
  // close the voice-mode language dropdown on outside click
  useEffect(() => {
    if (!vmLangOpen) return;
    const close = () => setVmLangOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [vmLangOpen]);
  // close the ⋯ settings popover on outside click
  useEffect(() => {
    if (!vmMenuOpen) return;
    const close = () => setVmMenuOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [vmMenuOpen]);
  function vmSetState(s) { vmStateRef.current = s; setVmState(s); }
  // buffer notes the learner plays while we're listening (so the AI can react)
  function vmOnNote(d) {
    // barge-in: tapping a key while the AI talks/thinks interrupts it (then this note
    // is buffered under the now-listening state). Only ON-SCREEN taps interrupt — a
    // mic onset during speech is usually the AI's own voice, not the learner.
    if ((vmStateRef.current === "speaking" || vmStateRef.current === "thinking") && vmActiveRef.current) {
      if (d.source !== "tap") return;
      vmInterrupt();
    }
    if (vmStateRef.current !== "listening" || vmFrozenRef.current) return;
    const now = Date.now();
    vmLastActivityRef.current = now;
    // ── chord (poly beta): several pitch classes detected in one strike ──
    if (d.notes && d.notes.length > 1) {
      const pcs = [...new Set(d.notes.map(pcOf))];
      if (vmExpectRef.current && vmExpectRef.current.size) {
        const ok = pcs.some(p => vmExpectRef.current.has(p));   // any expected tone present → ✓
        setVmInstant({ ok, id: now });
        clearTimeout(vmInstantT.current);
        vmInstantT.current = setTimeout(() => setVmInstant(null), 650);
        if (ok) { if (vmMissRef.current >= 2) vmRecoveredRef.current = true; vmStreakRef.current++; vmMissRef.current = 0; vmTallyOkRef.current++; }
        else { vmMissRef.current++; vmStreakRef.current = 0; vmTallyMissRef.current++; }
      }
      vmNotesRef.current = vmNotesRef.current.filter(x => now - x.t < 12000);
      for (const p of pcs) vmNotesRef.current.push({ note: p, t: now, vel: d.vel || 0, chord: true });
      if (vmNotesRef.current.length > 16) vmNotesRef.current = vmNotesRef.current.slice(-16);
      setVmNotes(vmNotesRef.current.map(x => x.note));
      clearTimeout(vmPlayReactT.current);
      vmPlayReactT.current = setTimeout(() => vmReactToPlaying(), 1700); // chords resolve fast → react a touch sooner
      return;
    }
    // instant local feedback: ✓ if the played pitch is one the teacher just showed
    if (vmExpectRef.current && vmExpectRef.current.size) {
      const ok = vmExpectRef.current.has(pcOf(d.note));
      setVmInstant({ ok, id: now });
      clearTimeout(vmInstantT.current);
      vmInstantT.current = setTimeout(() => setVmInstant(null), 650);
      // track a correct/missed streak so the teacher can adapt the pace
      if (ok) { if (vmMissRef.current >= 2) vmRecoveredRef.current = true; vmStreakRef.current++; vmMissRef.current = 0; vmTallyOkRef.current++; }
      else { vmMissRef.current++; vmStreakRef.current = 0; vmTallyMissRef.current++; }
    }
    vmNotesRef.current = vmNotesRef.current.filter(x => now - x.t < 12000);
    vmNotesRef.current.push({ note: pcOf(d.note), t: now, vel: d.vel || 0 });
    if (vmNotesRef.current.length > 16) vmNotesRef.current.shift();
    setVmNotes(vmNotesRef.current.map(x => x.note));
    // a human teacher reacts when you PLAY, not only when you talk — once the
    // learner plays a little then pauses (and isn't speaking), comment on it.
    clearTimeout(vmPlayReactT.current);
    vmPlayReactT.current = setTimeout(() => vmReactToPlaying(), 2000);
  }
  function vmReactToPlaying() {
    if (!vmActiveRef.current || vmStateRef.current !== "listening" || vmFrozenRef.current) return;
    if (vmNotesRef.current.length < 2) return; // ignore a stray single note
    vmProcess(L[langRef.current].vmPlayedCue);            // implicit "I just played — what do you think?"
  }
  function openVoice() {
    if (!isAndroidNative) return; // Android-app-only feature, by design — never reachable on web or iOS
    setVmOpen(true);
    setVmErr(null);
    vmMsgsRef.current = []; setVmMsgs([]);
    if (!sttSupported()) { setVmErr(L[lang].vmNoSTT); vmSetState("error"); return; }
    startVoiceSession();
  }
  // Pre-fetch short "active listening" clips in the warm voice so the teacher can
  // say "mm-hmm / okay / let's see" the instant you finish — no dead air, no delay.
  const VM_FILLERS = {
    th: ["อืม", "โอเคครับ", "เดี๋ยวนะ", "ดีมาก ฟังนะ", "เข้าใจแล้ว"],
    en: ["Mm-hmm.", "Okay.", "Let's see.", "Nice, listen.", "Got it."],
    zh: ["嗯。", "好的。", "我看看。", "不错。", "明白了。"],
  };
  // said ONCE, gently, if the learner goes quiet for a while — a real teacher
  // doesn't just sit in silence forever without saying anything.
  const VM_IDLE_NUDGE = {
    th: ["ค่อยๆ นะครับ ไม่ต้องรีบ", "ครูรออยู่นะครับ ใจเย็นๆ", "พร้อมเมื่อไหร่ค่อยเล่นก็ได้นะ"],
    en: ["Take your time.", "No rush, I'm still here.", "Whenever you're ready."],
    zh: ["慢慢来，不着急。", "老师还在呢，别紧张。", "准备好了再开始就行。"],
  };
  const VM_IDLE_MS = 24000; // how long of true silence before the one gentle check-in
  async function prefetchFillers() {
    vmFillersRef.current = [];
    if (vmFastRef.current || vmCloudDeadRef.current) return;   // device voice: skip (no cached clips)
    const list = VM_FILLERS[lang] || VM_FILLERS.en;
    for (const t of list) {
      try { const clips = await fetchCloudClips(t, lang); if (clips && clips[0]) vmFillersRef.current.push({ buf: clips[0], text: t }); } catch (e) {}
      if (!vmActiveRef.current) return;
    }
  }
  function vmStopFiller() { if (vmFillerSrcRef.current) { try { vmFillerSrcRef.current.onended = null; vmFillerSrcRef.current.stop(); } catch (e) {} vmFillerSrcRef.current = null; vmSelfSpeakingRef.current = false; } }
  // play one random filler immediately; returns true if it spoke (else caller earcons)
  function vmPlayFiller() {
    const buffers = vmFillersRef.current;
    if (_sfxMuted || !buffers || !buffers.length) return false;
    try {
      const ac = getAC();
      let idx = Math.floor(Math.random() * buffers.length);
      if (buffers.length > 1 && idx === vmFillerLastRef.current) idx = (idx + 1) % buffers.length; // a human never says the exact same "mm-hmm" twice in a row
      vmFillerLastRef.current = idx;
      const pick = buffers[idx];
      vmStopFiller();
      vmMarkSpoken(pick.text); // even our "mm-hmm" echoes — the filter must know it
      const src = ac.createBufferSource();
      src.buffer = pick.buf;
      const rate = 1 + ((vmSpeedRef.current || 1) - 1) * 0.5;
      if (rate !== 1) src.playbackRate.value = Math.max(0.5, Math.min(1.8, rate));
      src.connect(ac.destination);
      // the ear is live while this plays — mute recognition so our own "mm-hmm"
      // can never read as the learner barging in (same guard as the idle nudge)
      vmSelfSpeakingRef.current = true;
      src.onended = () => { if (vmFillerSrcRef.current === src) { vmFillerSrcRef.current = null; vmSpokeAtRef.current = Date.now(); setTimeout(() => { vmSelfSpeakingRef.current = false; vmEarFlushRef.current(); }, 250); } };
      vmFillerSrcRef.current = src;
      src.start();
      return true;
    } catch (e) { return false; }
  }
  // A real teacher never just sits in dead silence forever — if the learner goes
  // quiet (not speaking, not playing) for a while during "listening", say one
  // short, gentle line ONCE, without disrupting the mic/state (same non-intrusive
  // approach as the active-listening fillers). Checked on a slow interval, so it's
  // cheap and never competes with the STT engine's own restart cycling.
  function vmCheckIdle() {
    if (!vmActiveRef.current || vmStateRef.current !== "listening" || vmFrozenRef.current) return;
    if (vmIdleNudgedRef.current) return;
    if (Date.now() - vmLastActivityRef.current < VM_IDLE_MS) return;
    vmIdleNudgedRef.current = true;
    const list = VM_IDLE_NUDGE[lang] || VM_IDLE_NUDGE.en;
    const line = list[Math.floor(Math.random() * list.length)];
    // the recognizer stays live through this (still "listening") — mute its
    // results while our own voice is in the air, plus a short tail for echo/reverb
    vmSelfSpeakingRef.current = true;
    vmSpeakP(line).then(() => { setTimeout(() => { vmSelfSpeakingRef.current = false; vmEarFlushRef.current(); }, 400); });
  }
  // the interval below is armed ONCE per session but must always run the LATEST
  // vmCheckIdle (which closes over the current `lang`) — same stale-closure risk
  // langRef solves for STT, via the same trampoline-ref trick used throughout.
  const vmCheckIdleRef = useRef(() => {});
  useEffect(() => { vmCheckIdleRef.current = vmCheckIdle; });
  function startVoiceSession() {
    if (!isAndroidNative) return; // belt-and-suspenders: vmToggle()/vmOrbTap() can re-enter this once the modal is open
    if (!sttSupported()) { setVmErr(L[lang].vmNoSTT); vmSetState("error"); return; }
    getAC();
    vmActiveRef.current = true;
    vmCloudDeadRef.current = false; // give the natural cloud voice a fresh try each session
    vmTallyOkRef.current = 0; vmTallyMissRef.current = 0; vmDeafCountRef.current = 0;
    if (!vmMsgsRef.current.length) vmSessionStartRef.current = Date.now(); // fresh lesson starts the clock; resume keeps it
    vmActStartRef.current = Date.now(); // each start/resume opens a new activity-log segment
    vmSpokenRef.current = ""; vmSpokeAtRef.current = 0;
    vmNotesRef.current = []; setVmNotes([]); setVmCaption("");
    stopPracticeListeners();
    vmPolyRef.current = vmPoly;                  // reflect the current beta-toggle choice
    startMicListener((d) => vmOnNote(d), null, null, { poly: vmPolyRef.current }); // best-effort note buffer (chord-aware if poly on)
    prefetchFillers();   // warm up the active-listening clips (non-blocking)
    clearInterval(vmIdleTimerRef.current);
    vmIdleTimerRef.current = setInterval(() => vmCheckIdleRef.current(), 5000);
    vmSpawnEar();        // the ear opens at second zero — you can even talk over the greeting
    if (!vmMsgsRef.current.length) {
      vmOpenGreeting();
    } else {
      vmStartListen();
    }
  }
  // A hardcoded opening line said verbatim every session is the fastest way to feel
  // like a bot. Instead, let the teacher (Gemini, on the natural-conversation system
  // prompt) improvise its own opening — the system prompt already gets homework /
  // struggle / mastered / days-since-last-session context via memoryContext() and
  // homeworkContext(), so this cue can stay short and the greeting still lands warm,
  // relevant and different every single time. Falls back to a static line offline.
  async function vmOpenGreeting() {
    vmSetState("thinking");
    if (!vmPlayFiller()) vmThinkCue();
    const myTurn = ++vmTurnRef.current;
    vmInterruptRef.current = false;
    const cue = "(This is the very start of a brand-new voice lesson — the learner just opened the app, they haven't said anything yet. Greet them the way you'd actually greet a student walking in: brief, warm, in character. Use whatever you know about them from memory/homework context if it's there, otherwise just a natural hello. Never the same opening line twice — genuinely improvise it.)";
    // stream the greeting through the same look-ahead pipeline as a normal reply:
    // the first sentence is SPOKEN while the rest is still generating, so the
    // teacher's voice lands ~2s sooner — first impressions are made of latency
    const segQ = []; let pumping = false, started = false;
    const live = () => vmActiveRef.current && !vmInterruptRef.current && vmTurnRef.current === myTurn;
    const pump = async () => {
      if (pumping) return; pumping = true;
      while (segQ.length && live()) {
        if (!started) { started = true; vmStopFiller(); vmSetState("speaking"); }
        const s = segQ.shift();
        if (s.type === "say") await vmSpeakSeg(s); else await vmActSeg(s);
      }
      pumping = false;
    };
    const enqueue = (sentence) => {
      const uc = !vmFastRef.current && !vmCloudDeadRef.current;
      for (const s of vmParseSegments(sentence)) {
        if (s.type === "say") {
          const t = (s.text || "").trim();
          if (!t) continue;
          segQ.push({ type: "say", text: t, clips: uc ? fetchCloudClips(t, lang).catch(() => null) : undefined });
        } else segQ.push(s);
      }
      pump();
    };
    let greet = "";
    try { greet = (await vmFetchAI(cue, [], enqueue)).trim(); } catch (e) { greet = ""; }
    while ((segQ.length || pumping) && live()) await vmWait(70);
    if (!vmActiveRef.current || vmTurnRef.current !== myTurn) return;
    if (!greet && !vmInterruptRef.current) { // offline / stream failed → static fallback greeting
      const mem = readMemory();
      const topStruggle = mem.struggles && mem.struggles.length ? mem.struggles[0].label : null;
      greet = (homework && homework.text) ? L[lang].vmGreetHw.replace("{x}", homework.text)
        : topStruggle ? L[lang].vmGreetBack.replace("{x}", topStruggle)
        : L[lang].vmGreeting;
      vmStopFiller();
      vmSetState("speaking");
      await vmSpeakAndAct(greet);
    }
    if (greet) {
      vmMsgsRef.current = [{ role: "ai", text: vmDisplayText(greet) || greet }];
      setVmMsgs(vmMsgsRef.current);
    }
    if (vmActiveRef.current && !vmInterruptRef.current && vmTurnRef.current === myTurn) vmStartListen();
  }
  // Toggle the beta "chord ear" mid-session: re-arm just the mic listener with
  // the new mode (mono ↔ poly). STT and everything else keep running.
  function vmTogglePoly() {
    const v = !vmPoly;
    setVmPoly(v); vmPolyRef.current = v;
    try { localStorage.setItem("tg_vmpoly", v ? "1" : "0"); } catch (e) {}
    playUi("click");
    if (vmActiveRef.current) {
      if (_practiceStop.mic) { try { _practiceStop.mic(); } catch (e) {} _practiceStop.mic = null; }
      startMicListener((d) => vmOnNote(d), null, null, { poly: v });
    }
  }
  /* ═══ CONTINUITY CORE — the always-open ear ═══
     Why the old flow felt discontinuous: it opened a FRESH recognizer for every
     turn and killed it while the AI thought/spoke. That meant (1) a 0.3–0.7s
     cold-start after EVERY reply during which the learner's first syllables
     were simply lost, (2) total deafness while the AI talked — no interrupting
     by voice, words spoken "too early" vanished — and (3) a long 1.0–1.6s
     silence wait before each turn was considered finished. Stacked on the
     unavoidable network round-trip, every exchange gained 2–3s of dead air.
     New design: ONE continuous recognizer stays alive for the whole session,
     like a human ear that never closes.
     - state "listening": caption + finalize after a short pause (tightened)
     - state "speaking"/"thinking": enough sustained speech = VOICE BARGE-IN —
       the teacher stops mid-sentence and your words are already captured
     - the engine's own periodic restarts re-arm instantly in ANY state. */
  const VM_BARGE_MIN = 12; // chars (spaces stripped) heard mid-reply before we treat it as a real interruption — guards against speaker echo/noise
  // ── SELF-ECHO FILTER ────────────────────────────────────────────
  // On a phone without headphones the mic hears the teacher's OWN voice. The
  // system echo canceller usually removes it — but when it leaks through, it
  // either (a) read as a voice barge-in (the teacher stopped mid-sentence for
  // no reason), or (b) its tail (recognition lags the audio by up to ~1s)
  // landed in the buffer right as we returned to listening, where the flush
  // turned it into a phantom user turn — the teacher literally answered
  // itself. We KNOW exactly what was just said, so a cheap character-bigram
  // overlap test kills both failure modes.
  function vmMarkSpoken(t) {
    const add = (t || "").trim();
    if (!add) return;
    vmSpokenRef.current = (vmSpokenRef.current + " " + add).slice(-600); // rolling tail ≈ the last few sentences
    vmSpokeAtRef.current = Date.now();
  }
  function vmEchoLike(t) {
    // while LISTENING only a fresh tail (≤1.5s after our audio ended) can be
    // echo — a learner genuinely repeating the teacher's words is never eaten;
    // while the teacher is talking/thinking any strong match blocks a fake barge-in
    const win = vmStateRef.current === "listening" ? 1500 : 20000;
    if (!vmSpokeAtRef.current || Date.now() - vmSpokeAtRef.current > win) return false;
    const norm = (s) => (s || "").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
    const heard = norm(t), spoken = norm(vmSpokenRef.current);
    if (heard.length < 6 || spoken.length < 8) return false;
    const bi = new Set();
    for (let i = 0; i < spoken.length - 1; i++) bi.add(spoken.slice(i, i + 2));
    let hit = 0, tot = 0;
    for (let i = 0; i < heard.length - 1; i++) { tot++; if (bi.has(heard.slice(i, i + 2))) hit++; }
    return tot >= 5 && hit / tot >= 0.72;
  }
  // ── UNFINISHED-SENTENCE DETECTOR ────────────────────────────────
  // A human teacher hears when you trail off mid-thought ("แล้วก็…", "um…",
  // "然后…") and waits — instead of cutting in the instant you pause to think.
  const VM_HESIT = {
    th: ["เอ่อ", "อ่า", "อืม", "เอิ่ม", "คือ", "แบบ", "แบบว่า", "แล้วก็", "ก็คือ", "กับ", "และ", "หรือ", "แต่", "ของ", "อยากจะ", "ช่วย"],
    en: ["um", "uh", "er", "hmm", "and", "but", "so", "because", "like", "the", "a", "an", "to", "of", "for", "with", "my", "your", "let's", "i", "i'm", "can", "could", "should"],
    zh: ["嗯", "呃", "那个", "这个", "就是", "然后", "还有", "但是", "所以", "因为", "和", "跟", "我想", "我要", "可以", "帮我"],
  };
  function vmTrailingHesitation(t) {
    const s = (t || "").trim().toLowerCase().replace(/[.,!?…。！？]+$/g, "");
    if (!s) return false;
    const lg = langRef.current;
    const list = VM_HESIT[lg] || VM_HESIT.en;
    if (lg === "en") { const last = s.split(/\s+/).pop(); return list.includes(last); }
    return list.some(w => s.endsWith(w));
  }
  function vmStartListen() {
    if (!vmActiveRef.current) return;
    // a FRESH turn resets the idle clock; re-entering listening never tears the ear down
    if (vmStateRef.current !== "listening") { vmLastActivityRef.current = Date.now(); vmIdleNudgedRef.current = false; }
    clearTimeout(vmPlayReactT.current);
    clearTimeout(vmSilenceT.current);
    vmFrozenRef.current = false;
    setVmCaption("");
    vmSetState("listening");
    if (!vmRecRef.current) vmSpawnEar(); // ear already hot? just flip state — zero-gap turn-taking
    // CRITICAL: anything said DURING the reply that was too short to barge in
    // ("yes", "ครับ", "โอเค") is sitting in the ear's buffer with no timer armed.
    // Without this flush it would never be processed — the #1 "it didn't hear me".
    else vmEarFlushRef.current();
  }
  function vmSpawnEar() {
    if (!vmActiveRef.current) return;
    const SR = getSR();
    if (!SR) { setVmErr(L[langRef.current].vmNoSTT); vmSetState("error"); return; }
    // never two recognizers at once — they fight over the mic
    if (vmRecRef.current) { try { vmRecRef.current.onend = null; vmRecRef.current.onresult = null; vmRecRef.current.abort(); } catch (e) {} vmRecRef.current = null; }
    clearTimeout(vmRestartT.current);
    clearTimeout(vmWatchdogT.current);
    const mySeq = ++vmListenSeqRef.current;
    let rec;
    try { rec = new SR(); } catch (e) { vmSetState("error"); return; }
    rec.lang = TTS_LOCALES[langRef.current] || "en-US"; // ref, so engine restarts always hear the CURRENT language
    rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
    let finalText = "", lastInterim = "";
    const stale = () => mySeq !== vmListenSeqRef.current;
    const reArm = (ms) => { clearTimeout(vmRestartT.current); vmRestartT.current = setTimeout(() => { if (vmActiveRef.current && !vmRecRef.current && vmListenSeqRef.current === mySeq) vmSpawnEar(); }, ms); };
    const armWatchdog = () => { // recover a silently-hung engine (no result, no end — Android does this)
      clearTimeout(vmWatchdogT.current);
      vmWatchdogT.current = setTimeout(() => {
        if (vmActiveRef.current && vmListenSeqRef.current === mySeq && vmRecRef.current === rec && !finalText && !lastInterim) {
          // SELF-HEALING: two consecutive stone-deaf cycles usually mean the
          // note-detection mic stream is starving speech recognition of the
          // device mic (some Androids won't share it). Free it and tell the
          // learner the ear was re-tuned — taps still play notes fine.
          vmDeafCountRef.current++;
          if (vmDeafCountRef.current >= 2) {
            vmDeafCountRef.current = 0;
            try { stopPracticeListeners(); } catch (e) {}
            if (vmStateRef.current === "listening") setVmCaption(L[langRef.current].vmEarReset);
          }
          try { rec.onend = null; rec.abort(); } catch (e) {}
          vmRecRef.current = null; vmSpawnEar();
        }
      }, 15000);
    };
    const consume = (useInterim) => {
      if (stale()) return;
      const t = finalText.trim() || (useInterim ? lastInterim.trim() : "");
      finalText = ""; lastInterim = "";
      clearTimeout(vmSilenceT.current);
      if (!t) return;
      // PHANTOM-TURN GUARD: recognition lags the speaker by up to ~1s, so the echo
      // of the teacher's own last sentence can land here right after we start
      // listening — without this check the teacher would answer itself.
      if (vmEchoLike(t)) { setVmCaption(""); vmFrozenRef.current = false; return; }
      vmProcess(t); // the ear keeps running underneath (gated by state) — no teardown, no cold restart
    };
    vmEarResetRef.current = () => { finalText = ""; lastInterim = ""; clearTimeout(vmSilenceT.current); };
    // surface whatever the buffer already holds ONCE we're (back in) listening —
    // covers short mid-reply answers and words spoken while a filler was playing
    vmEarFlushRef.current = () => {
      if (stale() || vmStateRef.current !== "listening") return;
      const t = (finalText + " " + lastInterim).trim();
      if (!t) return;
      vmFrozenRef.current = true;
      vmLastActivityRef.current = Date.now();
      setVmCaption(finalText.trim() || lastInterim.trim());
      clearTimeout(vmSilenceT.current);
      const hesF = vmTrailingHesitation(finalText.trim() || lastInterim.trim());
      vmSilenceT.current = setTimeout(() => consume(true), hesF ? 1300 : finalText.trim() ? 450 : 850); // it's already waited — finish fast (unless they trailed off mid-thought)
    };
    rec.onresult = (e) => {
      if (stale()) return;
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
      }
      lastInterim = interim;
      armWatchdog();
      vmDeafCountRef.current = 0; // the mic is definitely alive
      // While OUR OWN short clip plays (filler/idle-nudge): keep ACCUMULATING —
      // dropping these events permanently ate any words spoken over the clip
      // (a top "it didn't hear me" cause). We just hold off captions/turn-taking;
      // vmEarFlushRef surfaces the buffer the moment the clip ends.
      if (vmSelfSpeakingRef.current) return;
      const st = vmStateRef.current;
      if (st === "speaking" || st === "thinking") {
        // VOICE BARGE-IN: sustained speech over the teacher = the learner takes the floor.
        const heard = (finalText + interim).replace(/\s+/g, "");
        if (heard.length < VM_BARGE_MIN) return; // short answers stay buffered — flushed at turn end
        // …unless it's the teacher's OWN voice leaking back through the speaker —
        // never let the teacher interrupt itself (and scrub the echo from the buffer)
        if (vmEchoLike(finalText + " " + interim)) { finalText = ""; lastInterim = ""; return; }
        vmInterruptRef.current = true;
        clearTimeout(vmPlayReactT.current);
        vmStopFiller(); stopCloudTTS(); stopSpeaking();
        vmSetState("listening"); // their words are ALREADY captured — nothing was lost
      }
      if (finalText || interim) { vmFrozenRef.current = true; clearTimeout(vmPlayReactT.current); vmLastActivityRef.current = Date.now(); }
      setVmCaption(finalText || interim);
      // finalize after a natural pause — tightened from 1000/1600ms so the reply
      // starts noticeably sooner after you stop talking
      clearTimeout(vmSilenceT.current);
      if (finalText.trim() || interim.trim()) {
        // hold the turn open longer when they trail off mid-thought ("แล้วก็…", "um…")
        const hes = vmTrailingHesitation(finalText.trim() || interim.trim());
        vmSilenceT.current = setTimeout(() => consume(true), hes ? 1800 : finalText.trim() ? 700 : 1100);
      }
    };
    rec.onerror = (ev) => {
      if (stale()) return;
      const err = ev && ev.error;
      if (err === "not-allowed" || err === "service-not-allowed") { setVmErr(L[langRef.current].vmMicDenied); vmSetState("error"); return; }
      if (err === "network" && vmStateRef.current === "listening") setVmCaption(L[langRef.current].vmNetRetry); // weak signal — onend re-arms
      // the note-detection mic can hold the device mic — free it so STT can capture
      if (err === "audio-capture") { try { stopPracticeListeners(); } catch (e) {} }
    };
    rec.onend = () => {
      if (stale()) return;
      vmRecRef.current = null;
      if (!vmActiveRef.current) return;
      // engine died mid-sentence → deliver what we had instead of losing it
      const t = finalText.trim() || lastInterim.trim();
      if (t && vmStateRef.current === "listening") { consume(true); }
      reArm(180); // reopen in ANY state — the ear stays hot while the AI talks too
    };
    vmRecRef.current = rec;
    try { rec.start(); armWatchdog(); }
    catch (e) { vmRecRef.current = null; reArm(500); }
  }
  function vmStudentContext() {
    const li = levelInfo((profile && profile.exp) || 0);
    const meta = (session && session.user && session.user.user_metadata) || {};
    const nm = (profile && profile.full_name) || meta.full_name || meta.name || "";
    const lg = langRef.current;
    const tierName = li.tier[lg] || li.tier.en;
    const ld = (profile && profile.lessons_done) || 0;
    const lbl = lg === "th" ? "ข้อมูลผู้เรียน" : lg === "zh" ? "学员信息" : "Student profile";
    const parts = [];
    if (nm) parts.push((lg === "th" ? "ชื่อ: " : lg === "zh" ? "姓名: " : "Name: ") + nm);
    parts.push((lg === "th" ? "ระดับ: " : lg === "zh" ? "等级: " : "Level: ") + li.level + " (" + tierName + ")");
    parts.push((lg === "th" ? "เรียนจบ " : lg === "zh" ? "已完成 " : "Lessons done: ") + ld + (lg === "th" ? " บท" : lg === "zh" ? " 节" : ""));
    // live lesson stats — a human teacher keeps score of the whole session, not just the last attempt
    const ok = vmTallyOkRef.current, ms = vmTallyMissRef.current;
    if (ok + ms > 0) parts.push((lg === "th" ? "คาบนี้เล่นถูก " + ok + " / พลาด " + ms + " โน้ต" : lg === "zh" ? "本课已弹对 " + ok + " 音 / 弹错 " + ms + " 音" : "This session: " + ok + " correct / " + ms + " missed notes"));
    // the lesson clock — lets the teacher pace the session and wrap up on time
    const mins = vmSessionStartRef.current ? Math.floor((Date.now() - vmSessionStartRef.current) / 60000) : 0;
    if (mins >= 1) parts.push(lg === "th" ? "เวลาเรียนผ่านไป " + mins + " นาที" : lg === "zh" ? "本课已进行 " + mins + " 分钟" : "Lesson running " + mins + " min");
    return "\n\n[" + lbl + ": " + parts.join(" · ") + "]";
  }
  // stream the reply; call onSentence(chunk) as soon as each complete sentence
  // arrives (bracket-aware so [play:…] tags never get split) — lets us start
  // speaking almost immediately instead of waiting for the whole reply.
  async function vmFetchAI(message, history, onSentence) {
    const TERM = ".!?…\n。！？";
    const body = { message, conversationHistory: history, system: L[langRef.current].vmSys + FINGERING_REF + vmStudentContext() + memoryContext(langRef.current) + homeworkContext(langRef.current) + curriculumContext(langRef.current) + songRecommendationHint(langRef.current) };
    let lastErr;
    // Try up to twice. On a weak signal a stall watchdog aborts a frozen stream;
    // if nothing was spoken yet we retry, and if a partial reply was already
    // spoken we keep it (graceful) instead of erroring — smoother for the learner.
    for (let attempt = 0; attempt < 2; attempt++) {
      const ctrl = new AbortController();
      let stallT = setTimeout(() => ctrl.abort(), 9000);
      const arm = () => { clearTimeout(stallT); stallT = setTimeout(() => ctrl.abort(), 9000); };
      let spoken = 0, emittedAny = false, lastAcc = "";
      const emit = (acc, final) => {
        if (!onSentence) return;
        while (true) {
          const s = acc.slice(spoken);
          let depth = 0, end = -1;
          for (let i = 0; i < s.length; i++) {
            const c = s[i];
            if (c === "[") depth++;
            else if (c === "]") depth = Math.max(0, depth - 1);
            else if (depth === 0 && TERM.includes(c)) { end = i; break; }
          }
          if (end === -1) break;
          const chunk = s.slice(0, end + 1);
          if (chunk.trim()) { onSentence(chunk); emittedAny = true; }
          spoken += end + 1;
        }
        if (final) { const tail = acc.slice(spoken); if (tail.trim()) { onSentence(tail); emittedAny = true; spoken = acc.length; } }
      };
      try {
        const acc = await streamChatCompletion(body, {
          signal: ctrl.signal,
          onRawChunk: arm, // reset the stall timer on every chunk
          onChunk: (soFar) => { lastAcc = soFar; emit(soFar, false); },
        });
        clearTimeout(stallT);
        emit(acc, true);
        return acc;
      } catch (e) {
        clearTimeout(stallT);
        lastErr = e;
        if (emittedAny) return lastAcc;   // already spoke part of it → keep what we have
        if (attempt === 1) throw e;       // second clean failure → give up
        await vmWait(500);                // nothing spoken yet → quick retry
      }
    }
    throw lastErr;
  }
  // Handle the most common requests instantly (no AI round-trip) so the lesson
  // feels responsive: "again", "slower", "faster", "stop".
  function vmLocalCommand(text) {
    const t = (text || "").toLowerCase().trim().replace(/[\s.!?。！？．,]+$/g, "");
    if (!t || t.length > 18) return false;
    const hit = (arr) => arr.indexOf(t) >= 0;
    const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
    const AGAIN = ["again", "repeat", "one more", "once more", "play again", "play it again", "อีกที", "อีกครั้ง", "ขออีกที", "ซ้ำ", "ซ้ำอีกที", "เล่นอีกที", "再来", "再一次", "重来", "再来一次", "再弹一次"];
    const SLOWER = ["slower", "slow down", "too fast", "ช้าลง", "ช้าๆ", "ช้า ๆ", "ช้ากว่านี้", "ช้าหน่อย", "慢一点", "慢点", "太快了", "慢一些"];
    const FASTER = ["faster", "speed up", "too slow", "เร็วขึ้น", "เร็วกว่านี้", "เร็วหน่อย", "快一点", "快点", "太慢了", "快一些"];
    const STOP = ["stop", "stop it", "หยุด", "พอแล้ว", "พอก่อน", "停", "停下", "停一下", "别弹了"];
    const replay = () => { const d = vmLastDemoRef.current; if (d) { vmSetState("speaking"); vmPlayDemo(d.mode, d.notes).then(() => { if (vmActiveRef.current && !vmInterruptRef.current) vmStartListen(); }); } else { vmStartListen(); } };
    const bump = (dir) => { let i = SPEEDS.indexOf(vmSpeedRef.current || 1); if (i < 0) i = 0; i = Math.max(0, Math.min(SPEEDS.length - 1, i + dir)); vmSpeedRef.current = SPEEDS[i]; setVmSpeed(SPEEDS[i]); };
    if (hit(AGAIN)) { replay(); return true; }
    if (hit(SLOWER)) { bump(-1); replay(); return true; }
    if (hit(FASTER)) { bump(1); replay(); return true; }
    if (hit(STOP)) { vmStop(); return true; }
    return false;
  }
  async function vmProcess(text) {
    if (!vmActiveRef.current) return;
    clearTimeout(vmPlayReactT.current);
    // instant local commands (not the "I just played" cue) → no AI round-trip
    if (text !== L[langRef.current].vmPlayedCue && vmLocalCommand(text)) return;
    const myTurn = ++vmTurnRef.current;        // newer turn supersedes any in-flight (barged-in) one
    vmInterruptRef.current = false;            // fresh turn — clear any prior barge-in
    const expSeq = vmSeqRef.current;           // capture the ordered target + ear test before clearing
    const ear = vmEarRef.current;
    vmExpectRef.current = null; vmSeqRef.current = null; vmEarRef.current = null; setVmStaff(null);
    vmSetState("thinking");
    if (!vmPlayFiller()) vmThinkCue();          // warm "mm-hmm/okay" the instant they finish (else a soft cue)
    const notes = vmNotesRef.current.map(x => x.note);
    const times = vmNotesRef.current.map(x => x.t);
    const vels = vmNotesRef.current.map(x => x.vel);
    // poly beta: group notes that struck together (same timestamp) → name each chord cleanly
    const chordGroups = (() => {
      const by = {};
      for (const x of vmNotesRef.current) if (x.chord) (by[x.t] = by[x.t] || []).push(x.note);
      return Object.keys(by).map(t => [...new Set(by[t])]).filter(g => g.length >= 2);
    })();
    vmNotesRef.current = []; setVmNotes([]);
    const history = buildAlternatingHistory(vmMsgsRef.current, 14); // deeper recall — a human remembers the whole lesson, not the last 5 exchanges
    vmMsgsRef.current = [...vmMsgsRef.current, { role: "user", text }];
    setVmMsgs(vmMsgsRef.current);
    setVmCaption("");
    let msg = text;
    if (notes.length) {
      // name each struck-together chord (poly beta); else fall back to whole-buffer interpretation
      const chordNames = chordGroups.map(g => { const n = identifyChord(g); return n ? n + " (" + g.join("+") + ")" : g.join("+"); });
      const interp = chordNames.length ? chordNames.join(", ") : interpretPlayed(notes); // local music engine: name the chord/scale
      const rhythm = rhythmReport(times);        // tempo + steadiness + rush/drag (like a human ear)
      const dyn = vmDynReport(vels);             // touch/dynamics + crescendo (MIDI velocity)
      const metroT = metroTimingReport(times);   // ms-precise timing vs the running metronome
      const lbl = chordNames.length ? (notes.join(" ") + " — chord(s): " + chordNames.join(", ")) : (notes.join(" ") + (interp ? " = " + interp : ""));
      msg += `\n\n(${L[langRef.current].vmNotesLbl}: ${lbl}${rhythm ? "; rhythm: " + rhythm : ""}${dyn ? "; " + dyn : ""}${metroT ? "; " + metroT : ""})`;
    }
    // Real-time sequence correction: pinpoint exactly where the attempt diverged.
    if (expSeq && expSeq.length && notes.length && !ear) {
      let i = 0; while (i < expSeq.length && i < notes.length && expSeq[i] === notes[i]) i++;
      if (i < expSeq.length && i < notes.length)
        msg += `\n\n(Sequence check — target: ${expSeq.join(" ")}; played: ${notes.join(" ")}; first wrong note is #${i + 1}: should be ${expSeq[i]} but played ${notes[i]}. Point this out gently and have them retry from there.)`;
      else if (notes.length < expSeq.length)
        msg += `\n\n(Sequence check — target ${expSeq.length} notes (${expSeq.join(" ")}); only ${notes.length} played (${notes.join(" ")}). Encourage finishing the rest.)`;
      else
        msg += `\n\n(Sequence check — all ${expSeq.length} notes correct & in order: ${expSeq.join(" ")}. Praise it and level up.)`;
    }
    // Ear-training grading: app supplies the ground truth so the AI just judges.
    if (ear) {
      msg += `\n\n(Ear-training — I just played by ear (no keys shown): ${ear.label} [${ear.notes.map(pcOf).join(" ")}]. The learner's answer is above${notes.length ? " (played: " + notes.join(" ") + ")" : ""}. Say if they got it right, reveal what it was, and offer another with [ear: ${ear.kind}].)`;
    }
    // Adaptive pacing from this session's instant ✓/✗ streak.
    // voice tone adapts to the moment: proud on a streak, gentle after misses,
    // and visibly delighted the moment a rough patch turns around — a human
    // teacher lights up when the learner finally gets it, and that warmth IS
    // part of the reward ("There you go! That's it!").
    const vmRecovered = vmRecoveredRef.current; vmRecoveredRef.current = false;
    if (vmStreakRef.current >= 3) { setTtsMood("celebrate"); msg += `\n\n(Pacing: the learner just played ${vmStreakRef.current} correct in a row — sounding confident, consider leveling up or adding a small challenge.)`; }
    else if (vmMissRef.current >= 2) { setTtsMood("gentle"); msg += `\n\n(Pacing: the learner missed ${vmMissRef.current} in a row — slow down, make the step smaller, and be extra encouraging.)`; }
    else if (vmRecovered) { setTtsMood("celebrate"); msg += `\n\n(Pacing: the learner just broke out of a rough patch with a correct note — celebrate this small win with real warmth and sincerity first, then keep the next step small and doable.)`; }
    else setTtsMood("warm");
    vmStreakRef.current = 0; vmMissRef.current = 0;
    // (the persistent ear keeps running underneath — gated by state, ready for voice barge-in)
    // Pipeline with cloud look-ahead: as each sentence streams in, parse it to
    // segments and immediately START fetching the cloud audio for spoken parts, so
    // the next sentence's voice is ready before the current finishes — gapless,
    // natural speech instead of a fetch-gap between every sentence.
    const segQ = []; let pumping = false, started = false;
    const enqueue = (sentence) => {
      const uc = !vmFastRef.current && !vmCloudDeadRef.current; // re-check each time (sticky fallback)
      for (const s of vmParseSegments(sentence)) {
        if (s.type === "say") {
          const t = (s.text || "").trim();
          if (!t) continue;
          segQ.push({ type: "say", text: t, clips: uc ? fetchCloudClips(t, langRef.current).catch(() => null) : undefined });
        } else segQ.push(s);
      }
      pump();
    };
    const live = () => vmActiveRef.current && !vmInterruptRef.current && vmTurnRef.current === myTurn;
    const pump = async () => {
      if (pumping) return; pumping = true;
      while (segQ.length && live()) {
        if (!started) { started = true; vmStopFiller(); vmSetState("speaking"); }
        const s = segQ.shift();
        if (s.type === "say") await vmSpeakSeg(s);
        else await vmActSeg(s);
      }
      pumping = false;
    };
    let reply = "";
    try { reply = await vmFetchAI(msg, history, enqueue); } catch (e) { reply = ""; }
    while ((segQ.length || pumping) && live()) await vmWait(70);
    if (vmTurnRef.current !== myTurn) return;   // a newer turn (barge-in) took over — abandon this one
    if (!vmActiveRef.current) return;
    if (!vmInterruptRef.current && !reply.trim()) { reply = L[langRef.current].err; await vmSpeakAndAct(reply); }
    if (reply.trim() && !vmInterruptRef.current) {
      const display = vmDisplayText(reply);
      vmMsgsRef.current = [...vmMsgsRef.current, { role: "ai", text: display || reply }];
      setVmMsgs(vmMsgsRef.current);
    }
    if (vmActiveRef.current && !vmInterruptRef.current) vmStartListen();
  }
  // barge-in: stop the talking/thinking AI and start listening immediately
  function vmInterrupt() {
    if (!vmActiveRef.current) return;
    if (vmStateRef.current !== "speaking" && vmStateRef.current !== "thinking") return;
    vmInterruptRef.current = true;
    clearTimeout(vmPlayReactT.current);
    vmStopFiller(); stopCloudTTS(); stopSpeaking();
    vmStartListen();
  }
  // ── speak the reply and play any [play:…]/[chord:…] demos inline, in order ──
  const _FLAT = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#", Cb: "B", Fb: "E" };
  function vmNormNote(tok) {
    let t = (tok || "").trim();
    if (t === "-") return "-";
    const m = t.match(/^([A-Ga-g])(#|b)?(\d)?$/);
    if (!m) return null;
    let L0 = m[1].toUpperCase(), acc = m[2] || "", oct = m[3] || "4", name;
    if (acc === "b") { name = (_FLAT[L0 + "b"] || L0) + oct; }
    else { name = L0 + acc + oct; }
    return NF[name] ? name : null;
  }
  function vmParseSegments(text) {
    const segs = [], re = /\[(play|chord|highlight|metro|homework|plan|staff|practice|song|posture|ear)(?::\s*([^\]]+))?\]/gi;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) { const t = text.slice(last, m.index); if (t.trim()) segs.push({ type: "say", text: t }); }
      const cmd = m[1].toLowerCase(), val = (m[2] || "").trim();
      if (cmd === "metro") { const bpm = parseInt(val, 10); if (bpm) segs.push({ type: "metro", bpm: Math.min(208, Math.max(40, bpm)) }); }
      else if (cmd === "homework") { if (val) segs.push({ type: "homework", text: val }); }
      else if (cmd === "plan") { if (val) segs.push({ type: "plan", text: val }); }
      else if (cmd === "posture") { segs.push({ type: "posture" }); }
      else if (cmd === "ear") { segs.push({ type: "ear", kind: (val || "interval").toLowerCase() }); }
      else if (cmd === "song") { if (val) segs.push({ type: "song", id: val.toLowerCase() }); }
      else if (cmd === "staff" || cmd === "practice") {
        const notes = val.split(/[\s,]+/).map(vmNormNote).filter(Boolean);
        if (notes.length) segs.push({ type: cmd, notes });
      }
      else {
        const notes = val.split(/[\s,]+/).map(vmNormNote).filter(Boolean);
        if (notes.length) segs.push({ type: cmd === "highlight" ? "highlight" : "play", mode: cmd, notes });
      }
      last = re.lastIndex;
    }
    if (last < text.length) { const t = text.slice(last); if (t.trim()) segs.push({ type: "say", text: t }); }
    if (!segs.length) segs.push({ type: "say", text });
    return segs;
  }
  const vmWait = (ms) => new Promise(r => setTimeout(r, ms));
  // A real teacher breathes between sentences — a short beat after a plain line,
  // a longer one after a question/exclamation so it lands before the next thought.
  // Pauses shrink when the learner asks for a faster pace (never a wall of words).
  function vmBreath(text) {
    const ends = /[?!。！？]$/.test((text || "").trim());
    const base = ends ? 520 : 240;
    const sp = Math.max(0.75, Math.min(2, vmSpeedRef.current || 1));
    return vmWait(base / sp);
  }
  async function vmPlayDemo(mode, notes) {
    const sp = vmSpeedRef.current || 1;            // 1 / 1.25 / 1.5 / 1.75 / 2 — faster = shorter gaps
    vmLastDemoRef.current = { mode, notes: notes.slice() };  // remember for an instant "again"
    clearTimeout(vmLitT.current);                  // take over the highlight while we demo
    if (mode === "chord") {
      const lit = notes.filter(n => n !== "-" && NF[n]);
      setVmLit(lit);                               // light the whole chord
      for (const n of lit) playPianoNote(n, 1.2 / sp);
      await vmWait(1200 / sp);
      setVmLit([]);
      stopAllPianoNotes(); // the chord-ear beta listens right after this — same self-echo risk Practice Mode had, same fix
    } else {
      for (const n of notes) {
        if (!vmActiveRef.current) { setVmLit([]); return; }
        if (n === "-") { setVmLit([]); await vmWait(210 / sp); continue; }
        if (NF[n]) { setVmLit([n]); playPianoNote(n, 0.55 / sp); }  // running light follows the note
        await vmWait(300 / sp);
      }
      setVmLit([]);
      await vmWait(120);
    }
    // after a demo, the learner will try it — remember the notes for instant ✓/✗
    // and the ORDER, so we can pinpoint the first wrong note in their attempt.
    vmExpectRef.current = new Set(notes.filter(n => n !== "-").map(pcOf));
    vmSeqRef.current = notes.filter(n => n !== "-").map(pcOf);
  }
  function vmSpeakP(text) {
    return new Promise(res => {
      let done = false;
      const clean = (text || "").trim();
      vmMarkSpoken(clean); // the echo filter must know every line we say aloud
      // HARD safety net: a stuck TTS engine (Android frequently drops onend, or a
      // cloud fetch hangs on weak signal) must NEVER freeze the lesson on "speaking".
      // Force-advance after a generous estimate of how long this line should take.
      const guard = setTimeout(() => { try { stopSpeaking(); stopCloudTTS(); } catch (e) {} finish(); },
        Math.min(28000, 4000 + clean.length * 140));
      function finish() { if (done) return; done = true; clearTimeout(guard); vmSpokeAtRef.current = Date.now(); res(); }
      // speech speed follows the speed control, but mapped gently so the voice
      // stays natural (2x demo → ~1.5x talking, never chipmunk-fast).
      const rateMul = 1 + ((vmSpeedRef.current || 1) - 1) * 0.5;
      // device/native voice when: user picked Fast, OR cloud already failed this
      // session (sticky fallback keeps speech smooth on a weak signal — no
      // per-sentence retries). Android WebView has no speechSynthesis, so this
      // also falls back to the OS TTS engine — the teacher never goes silent.
      if (vmFastRef.current || vmCloudDeadRef.current) { speakDeviceOrNative(text, langRef.current, finish, finish, rateMul); return; }
      speakCloud(text, langRef.current, null, finish, () => {
        vmCloudDeadRef.current = true; // first cloud failure → stay on the device voice from now on
        speakDeviceOrNative(text, langRef.current, finish, finish, rateMul);
      }, rateMul);
    });
  }
  async function vmSpeakAndAct(text) {
    // the persistent ear stays live while we speak — barge-in by voice works even here
    const segs = vmParseSegments(text);
    for (const s of segs) {
      if (!vmActiveRef.current) return;
      if (s.type === "say") { if (s.text.trim()) { await vmSpeakP(s.text); await vmBreath(s.text); } }
      else await vmActSeg(s);
    }
  }
  // speak one say-segment, using its prefetched cloud clips when ready (gapless,
  // natural); fall back to the device voice if the cloud clip failed/empty.
  async function vmSpeakSeg(s) {
    if (!vmActiveRef.current || !s.text) return;
    if (s.clips !== undefined) {
      let clips = null;
      try { clips = await s.clips; } catch (e) { clips = null; }
      if (!vmActiveRef.current) return;
      if (clips && clips.length) {
        const rateMul = 1 + ((vmSpeedRef.current || 1) - 1) * 0.5;
        vmMarkSpoken(s.text); // the echo filter must know every line we say aloud
        let done = false;
        const guard = setTimeout(() => { if (!done) { done = true; try { stopCloudTTS(); } catch (e) {} } },
          Math.min(28000, 4000 + s.text.length * 140));
        await playCloudClips(clips, rateMul, () => !vmActiveRef.current);
        done = true; clearTimeout(guard);
        vmSpokeAtRef.current = Date.now(); // the echo freshness window starts when the audio ENDS
        await vmBreath(s.text);            // …then a human beat before the next sentence
        return;
      }
      vmCloudDeadRef.current = true; // cloud failed → device voice from here on
    }
    await vmSpeakP(s.text); // device voice (has its own watchdog)
    await vmBreath(s.text);
  }
  // show notes the learner should play: light the keys + remember them so we can
  // give instant local ✓/✗ as the learner plays (no AI round-trip needed).
  function vmShowTargets(notes, ms = 12000) {
    setVmLit(notes);
    vmExpectRef.current = new Set(notes.filter(n => n !== "-").map(pcOf));
    vmSeqRef.current = notes.filter(n => n !== "-").map(pcOf);
    clearTimeout(vmLitT.current);
    vmLitT.current = setTimeout(() => { setVmLit([]); setVmStaff(null); vmExpectRef.current = null; }, ms);
  }
  // hand off to a drill / camera: pause the voice session first so it releases the
  // mic, then open the other mode on top.
  function vmLaunch(fn) {
    vmStop();
    setTimeout(() => { try { fn(); } catch (e) {} }, 180);
  }
  // run one non-speech segment (metronome / homework / highlight / staff / drill / camera / demo)
  async function vmActSeg(s) {
    if (!vmActiveRef.current) return;
    if (s.type === "metro") { getAC(); setMetroBpm(s.bpm); setMetroOn(true); }
    else if (s.type === "homework") { const hw = { text: s.text, date: dayKey() }; setHomeworkLS(hw); setHomework(hw); }
    else if (s.type === "plan") { setLessonPlanLS({ text: s.text, date: dayKey() }); }
    else if (s.type === "highlight") { vmShowTargets(s.notes); }
    else if (s.type === "staff") { setVmStaff(s.notes); vmShowTargets(s.notes); }
    else if (s.type === "posture") { vmLaunch(() => openCamera()); }
    else if (s.type === "song") { const meta = SONGS.find(x => x.id === s.id); vmLaunch(() => { if (meta) chooseSong(meta); else { setPage("studio"); setStudioView("songs"); } }); }
    else if (s.type === "practice") { lastSeq.current = { notes: s.notes.slice(), label: s.notes.map(pcOf).join(" "), mode: "seq", key: null }; vmLaunch(() => startPractice()); }
    else if (s.type === "ear") { await vmStartEar(s.kind); }
    else await vmPlayDemo(s.mode, s.notes);
  }
  // ── EAR TRAINING — play a target by ear ONLY (no keys lit, no hint); the learner
  // answers by playing or saying it, then the app hands the AI the ground truth to grade.
  const EAR_INTERVALS = [
    { s: 2, en: "Major 2nd" }, { s: 3, en: "Minor 3rd" }, { s: 4, en: "Major 3rd" },
    { s: 5, en: "Perfect 4th" }, { s: 7, en: "Perfect 5th" }, { s: 9, en: "Major 6th" }, { s: 12, en: "Octave" },
  ];
  const EAR_CHORDS = [
    { q: "major", en: "Major triad" }, { q: "minor", en: "Minor triad" },
    { q: "dim", en: "Diminished triad" }, { q: "aug", en: "Augmented triad" },
  ];
  async function vmPlayEar(notes, asChord) {
    const sp = vmSpeedRef.current || 1;
    setVmLit([]); // ear training shows NOTHING — pure listening
    if (asChord) {
      for (const n of notes) if (NF[n]) playPianoNote(n, 1.5 / sp);
      await vmWait(1500 / sp);
    } else {
      for (const n of notes) { if (!vmActiveRef.current) return; if (NF[n]) playPianoNote(n, 0.6 / sp); await vmWait(420 / sp); }
    }
  }
  async function vmStartEar(kind) {
    const root = ["C4", "D4", "E4", "F4", "G4", "A4"][Math.floor(Math.random() * 6)];
    let notes, label, asChord = false;
    if (kind === "note") { notes = [root]; label = pcOf(root) + " (single note)"; }
    else if (kind === "chord") {
      const c = EAR_CHORDS[Math.floor(Math.random() * EAR_CHORDS.length)];
      notes = _ascNotes(chordNotesOf(pcOf(root), c.q), 4); label = pcOf(root) + " " + c.en; asChord = true;
    } else {
      const iv = EAR_INTERVALS[Math.floor(Math.random() * EAR_INTERVALS.length)];
      notes = [root, transposeNotes([root], iv.s)[0]]; label = iv.en;
    }
    vmEarRef.current = { kind, label, notes, pcs: new Set(notes.map(pcOf)) };
    vmExpectRef.current = null; vmSeqRef.current = null; // no visual/instant hint during an ear test
    await vmPlayEar(notes, asChord);
  }
  // rough dynamics from MIDI velocities (mic AGC flattens loudness, so MIDI only)
  function vmDynReport(vels) {
    const v = (vels || []).filter(x => x > 0);
    if (v.length < 3) return null;
    const mean = v.reduce((s, x) => s + x, 0) / v.length;
    const dev = Math.sqrt(v.reduce((s, x) => s + (x - mean) * (x - mean), 0) / v.length) / (mean || 1);
    const h = Math.floor(v.length / 2);
    const m1 = v.slice(0, h).reduce((s, x) => s + x, 0) / Math.max(1, h);
    const m2 = v.slice(-h).reduce((s, x) => s + x, 0) / Math.max(1, h);
    const trend = m2 > m1 * 1.2 ? "crescendo" : m2 < m1 * 0.83 ? "diminuendo" : "level";
    const even = dev < 0.22 ? "very even" : dev < 0.4 ? "fairly even" : "uneven";
    const lvl = mean > 95 ? "loud (f)" : mean > 60 ? "medium (mf)" : "soft (p)";
    return `touch ${even}, ${lvl}, ${trend}`;
  }
  // close the current voice segment into the activity log (once per start/resume)
  function vmLogSegment() {
    if (!vmActStartRef.current) return;
    const sec = (Date.now() - vmActStartRef.current) / 1000;
    vmActStartRef.current = 0;
    if (sec >= 20) logActivity("voice", "session", vmTallyOkRef.current, vmTallyMissRef.current, sec);
  }
  function vmStop() { // pause the session but keep the overlay open
    vmLogSegment();
    vmActiveRef.current = false;
    vmListenSeqRef.current++;   // invalidate any in-flight recognizer callbacks
    clearTimeout(vmPlayReactT.current); clearTimeout(vmSilenceT.current); clearTimeout(vmRestartT.current); clearTimeout(vmWatchdogT.current);
    clearInterval(vmIdleTimerRef.current); vmIdleTimerRef.current = null;
    vmSelfSpeakingRef.current = false;
    if (vmRecRef.current) { try { vmRecRef.current.onend = null; vmRecRef.current.abort(); } catch (e) {} vmRecRef.current = null; }
    vmStopFiller(); stopCloudTTS(); stopSpeaking();
    touchSessionMemory();   // remember when this session ended (for return-gap greetings)
    vmSetState("idle");
  }
  function vmToggle() { if (vmActiveRef.current) vmStop(); else startVoiceSession(); }
  // tap the orb: interrupt while it talks/thinks, or re-open the ear while listening
  function vmOrbTap() {
    if (vmStateRef.current === "speaking" || vmStateRef.current === "thinking") vmInterrupt();
    else if (vmStateRef.current === "listening") { haptic(); vmSpawnEar(); } // force a FRESH recognizer (unsticks a dead ear)
    else if (!vmActiveRef.current) startVoiceSession();
  }
  function exitVoice() {
    vmLogSegment();
    vmActiveRef.current = false;
    vmListenSeqRef.current++;
    clearTimeout(vmPlayReactT.current); clearTimeout(vmInstantT.current); clearTimeout(vmLitT.current);
    clearTimeout(vmSilenceT.current); clearTimeout(vmRestartT.current); clearTimeout(vmWatchdogT.current);
    clearInterval(vmIdleTimerRef.current); vmIdleTimerRef.current = null;
    vmSelfSpeakingRef.current = false;
    if (vmRecRef.current) { try { vmRecRef.current.onend = null; vmRecRef.current.abort(); } catch (e) {} vmRecRef.current = null; }
    vmStopFiller(); stopCloudTTS(); stopSpeaking(); stopPracticeListeners();
    touchSessionMemory();   // remember when this session ended (for return-gap greetings)
    vmFillersRef.current = [];
    vmExpectRef.current = null; vmSeqRef.current = null; vmEarRef.current = null;
    setVmStaff(null); setVmLit([]); setVmInstant(null);
    vmSetState("idle"); setVmOpen(false); setVmCaption("");
  }
  useEffect(() => { if (vmEndRef.current) vmEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [vmMsgs]);
  return { vmOpen, setVmOpen, vmState, vmCaption, setVmCaption, vmMsgs, setVmMsgs, vmNotes, setVmNotes, vmErr, setVmErr, vmActiveRef, vmStateRef, vmRecRef, vmMsgsRef, vmNotesRef, vmFrozenRef, vmPlayReactT, vmSilenceT, vmRestartT, vmWatchdogT, vmListenSeqRef, vmEndRef, vmLastActivityRef, vmIdleNudgedRef, vmIdleTimerRef, vmSelfSpeakingRef, vmEarResetRef, vmEarFlushRef, vmDeafCountRef, vmTallyOkRef, vmTallyMissRef, vmFast, setVmFast, vmFastRef, vmSpeed, setVmSpeed, vmSpeedRef, vmVoice, setVmVoice, vmPoly, setVmPoly, vmPolyRef, vmLangOpen, setVmLangOpen, vmMenuOpen, setVmMenuOpen, langRef, vmLastDemoRef, vmStreakRef, vmMissRef, vmFillersRef, vmFillerSrcRef, vmCloudDeadRef, vmLit, setVmLit, vmLitT, vmStaff, setVmStaff, vmInstant, setVmInstant, vmInstantT, vmExpectRef, vmSeqRef, vmEarRef, vmInterruptRef, vmTurnRef, vmSpokenRef, vmSpokeAtRef, vmSessionStartRef, vmActStartRef, vmFillerLastRef, vmInput, setVmInput, openVoice, exitVoice, vmOrbTap, vmOnNote, vmTogglePoly, vmProcess, vmToggle };
}

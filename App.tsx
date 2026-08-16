import { useState, useRef, useEffect, useMemo, memo, useCallback, Fragment } from "react";
import { Capacitor } from "@capacitor/core";
import { PATHWAY } from "./pathway-data";
import { SONGS, SONG_GENRES, SONG_TIMESIG } from "./songs-data";
import { CSS, useInjectCSS } from "./app-styles";
import { nativeSTTAvailable, NativeSpeechRecognition } from "./native-stt";
import { nativeSignInWith, listenForNativeAuthRedirect } from "./native-auth";
import { initNativeUpdater } from "./native-updater";
import { sb, SUPABASE_URL } from "./supabase-client";
import { setAccessToken, streamChatCompletion, fetchChatCompletion } from "./ai-backend";
import { withAiCache } from "./ai-cache";
import {
  isPremium, setPremiumLS, getPlan, setPlanLS, isMaxPlan,
  PLAN_PRICE, CURRENCY_BY_LANG, PLAN_LABEL,
  yearPrice, planPriceByCur, yearPriceByCur, fmtPrice,
  b2bPriceByCur, b2bYearPriceByCur,
  effectivePlan, trialDaysLeft, planBadge, CheckoutModal, SchoolCheckoutModal,
} from "./payment";
import {
  NF, KEYS_12, CHROMA, LESSON_MODE,
  FINGERINGS_RH, FINGERINGS_LH, FINGERING_REF, TRIAD_FINGER_RH, TRIAD_FINGER_LH,
  getFingers, fingersForNotes, extractNotes, chordNotesOf, identifyChord, interpretPlayed,
  INTERVAL_FEEL, TRIAD_FEEL, SEVENTH_FEEL,
  normalizeSeq, noteKeyFrac, transposeNotes, semisFromC,
  getAC, playPianoNote, stopAllPianoNotes, playUi, playClick, playMiss, playWhoosh, playBoom, haptic,
  playComboTone, startAmbient, stopAmbient, vmThinkCue, setSfxVol, setSfxMuted, getSfxVol, getSfxMuted,
  pcOf, centsFromPC, PITCH_TOL_CENTS, TUNE_OFFSET_CAP, _practiceStop,
  startMidiListener, startMicListener, stopPracticeListeners, laneHue, roundRect, rhythmReport,
  SONG_LEAD, SONG_HITWINDOW, SONG_PERFECT, SONG_DEBOUNCE_MS, SONG_ECHO_MS, SONG_MISSWINDOW,
  expandSong, songTechniqueProfile, _ascNotes,
  MINOR_TYPES, TRIAD_TYPES, SEVENTH_TYPES, INTERVAL_DEFS,
  MAJOR_SCALE_SONGS, MINOR_SCALE_SONGS, TRIAD_SONGS, SEVENTH_SONGS, INTERVAL_SONGS,
  SIGHT_NOTES, SIGHT_NOTES_BASS,
  Piano, GamePiano, StaffSVG, StaffNotes, PlayAlongStaff,
  PC_SOLFA, PC_SOLFA_TH, EG_INT_BASE, EG_INT_FULL, RC_LEVELS, CHORD_MOODS,
  _PC, playBackingChord, songTonic, detectSongMatch,
} from "./music-engine";
import { loadHandLandmarker, HAND_BONES, handRoundness } from "./hand-pose";
import {
  TTS_LOCALES, ttsSupported, getSR, sttSupported, cleanForTTS,
  speakRobust, stopSpeaking, stopCloudTTS, VM_VOICES, getVmVoiceKey, setTtsMood,
  speakCloud, fetchCloudClips, playCloudClips,
} from "./speech";
import {
  tr, L, FLAGS, FLAG_NAMES, PATH_GROUPS, BENEFIT_CASES, STAGES_BY_GROUP,
  localPathwayLesson, matchFaqTopic, COACH_FEATURE_LABELS, EXAM_GRADES,
} from "./i18n";
import { Msg, Typing, Input } from "./chat-ui";
import {
  readMemory, recordMemory, touchSessionMemory, memoryContext,
  readHomework, setHomeworkLS, homeworkContext,
} from "./ai-chat-context";
import {
  GUEST_TRIAL_MS, PRACTICE_LOG_KEY, dayDate, dayKey, ymd,
  pushSupported, subscribePush, unsubscribePush, logUsage,
  readActLog, logActivity, recordSRS, getDueSRS, recordNoteMisses, readPracticeLog,
  loadGuestProfile, saveGuestProfile, clearGuestProfile, getGuestMs, addGuestMs,
  guestHasProgress, mergeGuestProgressIntoProfile,
} from "./shared-infra";
import { Splash, BannedScreen, GuestGateScreen, ProfileForm, CountUp } from "./app-shell";
import { PricingOverlay } from "./PricingOverlay";
import { PracticeOverlay } from "./PracticeOverlay";
import { SongPlayOverlay } from "./SongPlayOverlay";
import { SightReadingOverlay } from "./SightReadingOverlay";
import { CameraCoachOverlay } from "./CameraCoachOverlay";
import { SkinThemeSettings } from "./SkinThemeSettings";
import { SfxMetronomeSettings } from "./SfxMetronomeSettings";
import { LanguageSettings } from "./LanguageSettings";
import { ProfileDashboardPanel } from "./ProfileDashboardPanel";
import { SenseiView } from "./SenseiView";
import { VoiceTutorOverlay } from "./VoiceTutorOverlay";
import { usePayment } from "./use-payment";
import { useGamification } from "./use-gamification";
import { useKeyboard } from "./use-keyboard";
import { usePracticeMode } from "./use-practice-mode";
import { useSightReading } from "./use-sight-reading";
import { useCameraCoach } from "./use-camera-coach";
import { usePlayAlong } from "./use-play-along";
import { useChat } from "./use-chat";
import { useVoiceTutor } from "./use-voice-tutor";

/* true only inside the Capacitor-wrapped iOS/Android app, never on the website —
   gates the AI Voice Tutor (mobile-only by design) and native-only integrations. */
export const isNative = Capacitor.isNativePlatform();

/* ── Note frequencies ── */
// Equal-temperament note frequencies, generated for a wide range (C2–C7) so the
// synth, AI demos and games can reach beyond the on-screen 2 octaves.


// build a 2-octave (default) key layout starting at a given octave, for the
// octave-shiftable on-screen keyboard. baseOct=4 reproduces the original C4–B5.

// Horizontal position {cx,w} (as fractions of width) of a note on the in-game
// keyboard (C4–B5, 14 white keys), so falling notes line up over their key.

// normalize a single note from AI-generated song data → a valid NF key or "R"

/* chromatic order for transposing demos to a chosen key */

/* ── music-theory engine: accurate scale/chord notes + recognition ──
   Grounds the AI tutor (never hallucinate notes) and powers live listening. */
// what the chat log SHOWS: strip the [play:]/[chord:]/... tool syntax and any
// stray screenplay-style *action* text the model might slip into (never meant
// to be read literally — cleanForTTS strips it from SPEECH; this keeps the
// on-screen transcript matching what was actually said).
export function vmDisplayText(reply) {
  return String(reply || "")
    .replace(/\[(?:play|chord|highlight|staff|practice|song|metro|posture|ear|plan)[^\]]*\]/gi, "")
    .replace(/\*\*/g, "")               // strip bold markers FIRST (see cleanForTTS) so they can't
    .replace(/\*[^*\n]{1,60}\*/g, "")   // mis-pair with the single-star stage-direction strip below
    .replace(/\s{2,}/g, " ").trim();
}
// analyze timing from note onset timestamps (ms) → tempo + steadiness + rush/drag

/* ── Standard right-hand fingering for common scales (1-5) ── */
// Right-hand fingerings (ascending). RH scales: thumb-under pattern

// Authoritative fingering reference injected into the AI prompts. The model used to
// hallucinate finger numbers — especially the LEFT hand — so we hand it the exact,
// graded-standard numbers and forbid guessing. Finger numbers are universal (1=thumb
// … 5=pinky) so one block works in every language.


/* ════════════════════════════════════════════════════════════
   GAMIFICATION — EXP & LEVELS
   Learners earn EXP for every action so the app feels like a game and they keep
   coming back. Total EXP is stored on the Supabase profile (`exp` column);
   the level/rank is derived from it. A daily streak rewards returning often.
════════════════════════════════════════════════════════════ */
export const EXP = { lesson: 50, chapter: 25, ask: 10, daily: 15 };

// Rank ladder — each tier needs `min` total EXP. Level number = index + 1.
// Colors stay within the pink/magenta/wine family, deepening as the learner advances.
export const LEVELS = [
  { min: 0,    icon: "🌱", c: "#d97757", th: "มือใหม่",      en: "Novice",      zh: "初学者" },
  { min: 120,  icon: "🎵", c: "#ffa8d2", th: "ผู้เริ่มต้น",   en: "Beginner",    zh: "入门" },
  { min: 300,  icon: "🎶", c: "#ff5fb1", th: "นักเรียน",     en: "Student",     zh: "学生" },
  { min: 560,  icon: "🎹", c: "#d97757", th: "นักฝึก",       en: "Apprentice",  zh: "学徒" },
  { min: 900,  icon: "🎼", c: "#ff59c7", th: "นักดนตรี",     en: "Musician",    zh: "乐手" },
  { min: 1350, icon: "⭐", c: "#ff94e0", th: "นักเปียโน",    en: "Pianist",     zh: "钢琴手" },
  { min: 1950, icon: "🌟", c: "#ff76d8", th: "ผู้ชำนาญ",     en: "Virtuoso",    zh: "演奏家" },
  { min: 2750, icon: "💎", c: "#ff5252", th: "ปรมาจารย์",    en: "Maestro",     zh: "大师" },
  { min: 3800, icon: "👑", c: "#d97757", th: "เซียนเปียโน",   en: "Grandmaster", zh: "宗师" },
  { min: 5200, icon: "🏆", c: "#ff76d8", th: "ตำนาน",        en: "Legend",      zh: "传奇" },
];

// Resolve total EXP -> { level, tier, progress to next, EXP still needed, ... }
export function levelInfo(exp) {
  const e = Math.max(0, exp || 0);
  let i = 0;
  for (let k = 0; k < LEVELS.length; k++) if (e >= LEVELS[k].min) i = k;
  const tier = LEVELS[i];
  const next = LEVELS[i + 1] || null;
  const span = next ? next.min - tier.min : 1;
  return {
    level: i + 1,
    tier,
    next,
    curMin: tier.min,
    nextMin: next ? next.min : tier.min,
    need: next ? next.min - e : 0,
    progress: next ? Math.min(1, (e - tier.min) / span) : 1,
    isMax: !next,
  };
}

/* Prestige: level 10 (the top of LEVELS) used to be a dead end — once reached,
   EXP kept accumulating with zero further feedback. Past that cap, every extra
   PRESTIGE_STEP EXP earns a "Legend Star". Purely DERIVED from exp (same trick
   as BADGES below) — never stored or reset, so it can't be forged by writing a
   smaller exp value (the anti-cheat trigger only blocks increases, not decreases;
   see supabase-security-hardening-migration.sql). */
const PRESTIGE_STEP = 2000;
export function prestigeInfo(exp) {
  const e = Math.max(0, exp || 0);
  const cap = LEVELS[LEVELS.length - 1].min; // 5200 — top of the level ladder
  if (e < cap) return { tier: 0, into: 0, need: PRESTIGE_STEP };
  const past = e - cap;
  return { tier: Math.floor(past / PRESTIGE_STEP), into: past % PRESTIGE_STEP, need: PRESTIGE_STEP - (past % PRESTIGE_STEP) };
}

/* face shown by the floating mascot companion, keyed by mascotMood (see mascot()) */
const MASCOT_FACE = { idle: "🙂", happy: "😊", celebrate: "🤩", sad: "🥺" };


/* Daily quest: complete this many learning activities in a day for a bonus. */
export const QUEST_GOAL = 3;
export const QUEST_BONUS = 40;

/* Achievements — unlocked purely from existing stats (no extra storage).
   metric ∈ exp | lessons | streak | level. */
export const BADGES = [
  { id: "first", icon: "🎫", metric: "lessons", need: 1,    th: "ก้าวแรก",          en: "First Step",    zh: "第一步" },
  { id: "l10",   icon: "📚", metric: "lessons", need: 10,   th: "นักเรียนขยัน",      en: "Diligent",      zh: "勤奋学员" },
  { id: "l50",   icon: "🎓", metric: "lessons", need: 50,   th: "จอมวิริยะ",         en: "Devoted",       zh: "刻苦学员" },
  { id: "s3",    icon: "🔥", metric: "streak",  need: 3,    th: "ไฟแรง 3 วัน",       en: "3-Day Streak",  zh: "连续3天" },
  { id: "s7",    icon: "⚡", metric: "streak",  need: 7,    th: "ไฟแรง 7 วัน",       en: "7-Day Streak",  zh: "连续7天" },
  { id: "s30",   icon: "🌟", metric: "streak",  need: 30,   th: "วินัยเหล็ก 30 วัน",  en: "30-Day Streak", zh: "连续30天" },
  { id: "lv5",   icon: "⭐", metric: "level",   need: 5,    th: "ถึงเลเวล 5",        en: "Reach Lv 5",    zh: "达到5级" },
  { id: "lv10",  icon: "👑", metric: "level",   need: 10,   th: "ถึงเลเวล 10",       en: "Reach Lv 10",   zh: "达到10级" },
  { id: "e1000", icon: "💎", metric: "exp",     need: 1000, th: "สะสม 1,000 EXP",    en: "1,000 EXP",     zh: "1,000 EXP" },
  { id: "e5000", icon: "🏆", metric: "exp",     need: 5000, th: "สะสม 5,000 EXP",    en: "5,000 EXP",     zh: "5,000 EXP" },
];
function badgeMetric(p, metric) {
  const exp = (p && p.exp) || 0;
  if (metric === "exp") return exp;
  if (metric === "lessons") return (p && p.lessons_done) || 0;
  if (metric === "streak") return (p && p.streak) || 0;
  if (metric === "level") return levelInfo(exp).level;
  return 0;
}
export function unlockedBadgeIds(p) {
  return BADGES.filter(b => badgeMetric(p, b.metric) >= b.need).map(b => b.id);
}
/* how many quest activities counted today (0 if it's a new day) */
function questToday(p) {
  if (!p || p.quest_date !== ymd(new Date())) return 0;
  return p.quest_count || 0;
}

// Shown in the ☰ drawer so you can instantly verify which build is live
// after a manual upload. Keep in sync with package.json on every release.
const APP_VER = "13.3.0";

async function signInWith(provider) {
  try {
    if (isNative) { await nativeSignInWith(sb, provider); return; } // opens the OS browser; session completes via the appUrlOpen listener
    await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
  } catch (e) {
    alert("Sign-in error: " + (e?.message || e));
  }
}
// Model/limits are configured server-side in the Edge Function.
// (These remain only for the legacy admin-console path.)
export const API_MODEL = "claude-sonnet-4-6";
const API_MAX_TOKENS = 700;
// Build a single text prompt (system + alternating history + new turn) for
// window.claude.complete, which only accepts a plain string.
function buildTextPrompt(system, history, userText) {
  let p = system + "\n\n";
  for (const h of history) p += (h.role === "user" ? "User: " : "Assistant: ") + h.content + "\n";
  return p + "User: " + userText + "\nAssistant:";
}

/* ── Shared helper: build a clean user/assistant-alternating history ──
   Used by BOTH the main chat and the admin chat (was duplicated before).
   - drops the welcome message (slice 1)
   - keeps only the last `limit` turns to keep prompts small & fast
   - collapses consecutive same-role turns and ensures it starts with "user"   */
export function buildAlternatingHistory(msgs, limit = 6) {
  const recent = msgs.slice(1).filter(m => typeof m.text === "string");
  const trimmed = limit ? recent.slice(-limit) : recent;
  const raw = trimmed.map(m => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.text,
  }));
  const hist = [];
  for (const m of raw) {
    if (!hist.length || hist[hist.length - 1].role !== m.role) hist.push(m);
  }
  while (hist.length && hist[0].role !== "user") hist.shift();
  return hist;
}

/* ── Audio ── */
// soft "miss" buzz for game feedback
// Instantly silence every piano note currently ringing, instead of just waiting
// out its own decay envelope. Each oscillator playPianoNote started is tracked
// in _activeNotes specifically so this can cancel its own gain ramp and stop it
// directly — cutting the shared bus instead (a single node every note passes
// through) sounds like a fix but isn't one: each note's OWN gain envelope keeps
// running upstream of the bus regardless, so it would simply resume audibly the
// moment the bus was turned back up. Used right before a mic listener starts
// (Practice Mode opening, a chord-style toggle's own preview, leaving the page)
// so there's nothing left ringing for it to mishear as a real key press — and
// since nothing is left ringing, any suppression entries still on the books are
// now stale and would only risk blocking a genuine same-pitch replay, so
// they're cleared here too.

/* ════════════════════════════════════════════════════════════
   PRACTICE MODE — listen to what the learner actually plays
   • Web MIDI  → exact notes (best; also handles chords)
   • Microphone → autocorrelation pitch detection (monophonic; best one
     note at a time / scales)
   • Tapping the on-screen keys also works as a fallback.
   Matching is octave-agnostic (by pitch class) to stay forgiving.
════════════════════════════════════════════════════════════ */

// Autocorrelation pitch detector (returns Hz, or -1 for silence/no pitch/not tonal).
// Based on the well-known ACF2+/PitchDetect approach.
// TIMBRE GATE: is this spectrum piano-shaped, or does it carry a vowel formant?
// A struck piano string's overtones roll off in a fairly smooth curve (some natural
// ripple from the hammer-strike position, but no single harmonic jumps out). A sung/
// hummed/spoken vowel has a FORMANT — a resonance band fixed in absolute frequency no
// matter what pitch is sung — so whichever harmonic happens to land inside it gets
// boosted well above what the smooth rolloff around it would predict. That mismatch is
// what this checks for, using the FFT magnitude data the caller already has on hand.
// A generous margin is used on purpose: rejecting a real piano note is a worse failure
// than occasionally letting a very piano-like hum slip through.

/* ── Polyphonic (chord) pitch detection from a microphone ──────────────
   The autocorrelation detector above is monophonic — it locks onto ONE
   pitch, so a learner playing a triad on an acoustic piano only ever gets
   the loudest note named. This detector reads the FFT magnitude spectrum
   and uses HARMONIC SUMMATION: for every candidate piano note it sums the
   energy at that note's fundamental + first few harmonics. A real note has
   strong partials lined up on its harmonic series, so its summed salience
   spikes; the spikes of 2–4 simultaneous notes survive together. We then
   peak-pick, suppress octave/harmonic ghosts, and return the chord.
   It is intentionally conservative (high thresholds) — better to miss a
   note than to invent one — and only runs when the learner opts in. */
// Signed cents from a detected frequency to the NEAREST occurrence of a target
// pitch class (octave-agnostic). 0 = perfectly in tune; ±100 = a full semitone.
// This lets us accept a slightly out-of-tune piano instead of demanding an exact Hz.

// active listener teardown handles

// timing (seconds, song-time): how long a note falls, and the hit/miss windows
// Supplements the AI Voice Tutor's small hardcoded curated song list (kept as
// a safe default — see vmSys) with a wider pool it wouldn't otherwise know
// exists: vmSys only ever names 7 of SONGS' 180 entries. When Note Accuracy
// is the current weakest skill, biases toward smaller-leap songs (contained
// hand movement, easier pitches to nail) using songTechniqueProfile — a
// content-free proxy, not real hand-specific tagging (songs-data.ts has no
// such field; see project plan notes on why that needs new authoring).
export function songRecommendationHint(lang) {
  try {
    const weak = weakestSkills(computeSkillScores(), 1)[0];
    let pool = SONGS.filter(s => !s.maxOnly);
    pool = weak && weak.skill === "note_accuracy"
      ? pool.map(s => ({ s, p: songTechniqueProfile(s) })).sort((a, b) => (a.p ? a.p.avgLeap : 99) - (b.p ? b.p.avgLeap : 99)).map(x => x.s)
      : pool.slice().sort((a, b) => a.diff - b.diff);
    const ids = pool.slice(0, 24).map(s => s.id).join(", ");
    const label = weak ? tr(SKILL_LABELS[weak.skill], lang) : null;
    return lang === "th"
      ? `\n\n[เพลงอื่นที่แนะนำได้ (นอกเหนือจากตัวอย่างเดิม): ${ids}.${label ? ` จุดที่ผู้เรียนควรฝึกเพิ่มตอนนี้: ${label}` : ""}]`
      : lang === "zh"
      ? `\n\n[也可推荐的其他曲目（除原有示例外）：${ids}。${label ? `学员目前应加强：${label}` : ""}]`
      : `\n\n[Other real songs you can also recommend (beyond the original examples): ${ids}.${label ? ` The learner's current priority skill: ${label}.` : ""}]`;
  } catch (e) { return ""; }
}

const SIGHT_ROUND = 10; // notes per sight-reading round



/* ── Pathway Page ── */
const PathwayPage = memo(function PathwayPage({ lang, onLearn, onRead, initialOpenStageId, initialSelectedType, userName = "" }) {
  const lc = L[lang];
  const groups = PATH_GROUPS[lang];
  // initialOpenStageId re-opens the topic the learner just came from (via the
  // Sensei page's "change key" back button) so its key picker is right there —
  // this only matters on first mount, same as any other useState initializer.
  // initialSelectedType carries along the chord/interval type that was already
  // chosen, so "change key" lands straight on STEP 2 (key picker) instead of
  // making the learner re-pick the type in STEP 1.
  const [openStageId, setOpenStageId] = useState(initialOpenStageId || null);
  const [selectedType, setSelectedType] = useState(initialSelectedType || null); // type obj from stage.types, or null
  useEffect(() => {
    if (!initialOpenStageId) return;
    const el = document.getElementById("pcard-" + initialOpenStageId);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCard(st) {
    if (openStageId === st.id) { setOpenStageId(null); setSelectedType(null); return; }
    logUsage("pathway", st.id);
    setOpenStageId(st.id);
    setSelectedType(null);
  }
  function pickType(t) { setSelectedType(t); }
  const pathDone = pathDoneSet();
  const keyDone = keyDoneMap();   // { stageId: ["c","g",...] } — keys already studied per topic
  const currentStage = PATHWAY.find(s => !pathDone.has(s.id));
  const currentId = currentStage ? currentStage.id : null;
  function chooseKey(stage, key) {
    const t = selectedType;
    setOpenStageId(null);
    setSelectedType(null);
    onLearn(stage, key, t);
  }

  return (
    <div className="pathpage">
      <div className="pathhero">
        <div className="pathhero-glow" />
        <div className="pathbadge">◈ PATHWAY OF LEARNING ◈</div>
      </div>

      {groups.map((g, gi) => {
        const stages = STAGES_BY_GROUP[g.id] || [];
        const gc = stages[0].color;
        const openStage = stages.find(s => s.id === openStageId);
        const openIdx = openStage ? stages.indexOf(openStage) : -1;
        return (
          <Fragment key={g.id}>
          <section className="pgroup pisland" style={{ "--gc": gc }}>
            <header className="pgrouphdr">
              <span className="pgbar" style={{ background: gc }} />
              <span className="pgicon">{g.icon}</span>
              <div className="pginfo">
                <div className="pglabel">{g.label}</div>
                <div className="pgdesc">{g.desc}</div>
              </div>
              <span className="pgstep">STEP {gi + 1}</span>
            </header>

            <div className="pgrid" style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "10px" }}>
              {stages.map((st, si) => {
                const isOpen = openStageId === st.id;
                const isRead = !!st.content;
                // Card label: for stages with types, show "เลือกชนิด" when open; otherwise "เลือกคีย์"
                let cardLabel = isRead ? lc.readBtn : lc.learnBtn;
                if (isOpen && !isRead) cardLabel = (st.types && !selectedType) ? lc.pickType : lc.pickKey;
                const nKeys = (keyDone[st.id] || []).length; // keys studied in this topic
                // the expanded panel is injected full-width right after the ROW that
                // holds the open card, so its sub-topics sit attached to what was tapped
                const rowEnd = si % 2 === 1 || si === stages.length - 1;
                const panelHere = rowEnd && openIdx >= si - (si % 2) && openIdx <= si;
                return (
                  <Fragment key={st.id}>
                  <button id={"pcard-" + st.id} className={`pcard${isOpen ? " active" : ""}${pathDone.has(st.id) ? " done" : ""}${st.id === currentId ? " current" : ""}`}
                    style={{ "--ac": st.color }}
                    onClick={() => isRead ? (BENEFIT_CASES[st.id] ? openCard(st) : onRead(st)) : openCard(st)}>
                    <span className="pcardglow" />
                    {pathDone.has(st.id) && <span className="pcarddone">✓</span>}
                    {st.id === currentId && <span className="pcardhere">{lc.pathHere}</span>}
                    <span className="pcardlevel">{String(st.level).padStart(2, "0")}</span>
                    <span className="pcardicon" aria-hidden="true">{st.icon}</span>
                    <span className="pcardtitle">{tr(st.title, lang)}</span>
                    <span className="pcardsub">{tr(st.subtitle, lang)}</span>
                    {nKeys > 0 && !isRead && <span className="pcardkeys">🎹 {lc.keysLearned.replace("{n}", nKeys)}</span>}
                    <span className="pcardgo">
                      {cardLabel}
                      <span className="pcardarrow">{isOpen && !isRead ? "▾" : "→"}</span>
                    </span>
                  </button>

                  {/* panel — type picker first (if stage has types), then key picker —
                      rendered inside the grid so it expands right under the tapped row */}
                  {panelHere && openStage && (
              <div className="keypanel" style={{
                "--ac": openStage.color,
                background: "var(--card2)",
                border: `1px solid ${openStage.color}`,
                borderRadius: "14px",
                padding: "14px 13px",
                marginTop: 0,
                gridColumn: "1 / -1",
              }}>
                {/* panel header */}
                <div className="keypanel-head" style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "13px", paddingBottom: "10px", borderBottom: "1px solid var(--bd1)" }}>
                  <span style={{ fontSize: "18px" }}>{openStage.icon}</span>
                  <span style={{ flex: 1, fontFamily: "'Orbitron',sans-serif", fontSize: "12px", fontWeight: 700, color: "var(--text)" }}>{tr(openStage.title, lang)}</span>
                  {selectedType && (
                    <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "9px", background: openStage.color + "33", color: openStage.color, borderRadius: "6px", padding: "2px 7px", border: `1px solid ${openStage.color}55` }}>
                      {tr(selectedType.label, lang)}
                    </span>
                  )}
                  <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "9px", color: openStage.color, whiteSpace: "nowrap" }}>
                    {openStage.content ? lc.caseSub : openStage.types && !selectedType ? lc.pickType : lc.pickKey}
                  </span>
                </div>

                {/* READ CHAPTER: overview + world-class case-study sub-topics */}
                {openStage.content && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "9px" }}>
                    <button onClick={() => onRead(openStage)} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px", padding: "12px 11px", borderRadius: "11px", cursor: "pointer", background: "var(--card3)", border: `1px solid ${openStage.color}55`, textAlign: "left" }}>
                      <span style={{ fontSize: "18px" }}>📖</span>
                      <span style={{ fontSize: "11px", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, color: "var(--text2)", lineHeight: 1.25 }}>{lc.caseOverview}</span>
                    </button>
                    {(BENEFIT_CASES[openStage.id] || []).map(c => (
                      <button key={c.id} onClick={() => onRead(openStage, c)} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px", padding: "12px 11px", borderRadius: "11px", cursor: "pointer", background: "var(--card3)", border: "1px solid var(--bd1)", textAlign: "left" }}>
                        <span style={{ fontSize: "18px" }}>{c.icon}</span>
                        <span style={{ fontSize: "11px", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, color: "var(--text2)", lineHeight: 1.25 }}>{tr(c.title, lang)}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* STEP 1: type picker */}
                {!openStage.content && openStage.types && !selectedType && (
                  <>
                    <div style={{ fontSize: "9.5px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", marginBottom: "10px", textAlign: "center" }}>
                      {lc.pickTypeHint}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "9px", marginBottom: "12px" }}>
                      {openStage.types.map(t => (
                        <button key={t.id} onClick={() => pickType(t)} style={{
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px",
                          padding: "13px 8px", borderRadius: "11px", cursor: "pointer",
                          background: "var(--card3)",
                          border: `1px solid ${openStage.color}55`,
                          transition: "all .15s",
                        }}>
                          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: "20px", fontWeight: 900, color: openStage.color, lineHeight: 1 }}>{t.symbol}</span>
                          <span style={{ fontSize: "10px", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, color: "var(--text2)", lineHeight: 1.2, textAlign: "center" }}>{tr(t.label, lang)}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* STEP 2: key picker (after type selected, or stage has no types) */}
                {!openStage.content && (!openStage.types || selectedType) && (
                  <>
                    {selectedType && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                        <span style={{ fontSize: "9.5px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace" }}>{lc.pickKeyHint}</span>
                        <button onClick={() => setSelectedType(null)} style={{ fontSize: "9px", color: "var(--muted)", background: "none", border: "1px solid var(--bd4)", borderRadius: "5px", padding: "2px 7px", cursor: "pointer" }}>← {lc.pickType}</button>
                      </div>
                    )}
                    <div className="keygrid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px", marginBottom: selectedType ? "8px" : "12px" }}>
                      {KEYS_12.map(k => {
                        const kdone = (keyDone[openStage.id] || []).includes(k.id.toLowerCase());
                        return (
                        <button key={k.id} className={`keybtn${k.black ? " black" : ""}${kdone ? " kdone" : ""}`}
                          style={{
                            position: "relative",
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "3px",
                            padding: "11px 5px", borderRadius: "10px", cursor: "pointer",
                            background: "var(--card3)",
                            border: kdone ? "1px solid #d97757" : "1px solid var(--bd4)",
                          }}
                          onClick={() => chooseKey(openStage, k)}>
                          {kdone && <span style={{ position: "absolute", top: "3px", right: "4px", fontSize: "10px", color: "#d97757", fontWeight: 900 }}>✓</span>}
                          <span style={{ fontFamily: "'Orbitron',sans-serif", fontSize: "16px", fontWeight: 900, color: kdone ? "#d97757" : "var(--text)", lineHeight: 1 }}>{k.name}</span>
                          <span style={{ fontSize: "8.5px", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, color: "var(--muted)", lineHeight: 1 }}>{lang === "th" ? k.th : lang === "zh" ? k.zh : k.name}</span>
                        </button>
                        );
                      })}
                    </div>
                    {!selectedType && (
                      <div style={{ textAlign: "center", fontSize: "9.5px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", lineHeight: 1.5 }}>{lc.pickKeyHint}</div>
                    )}
                  </>
                )}
              </div>
                  )}
                  </Fragment>
                );
              })}
            </div>
          </section>
          {gi < groups.length - 1 && (
            <div className="ptrail" aria-hidden="true">
              <span className="ptrail-line" style={{ background: `linear-gradient(180deg, ${gc}, ${STAGES_BY_GROUP[groups[gi + 1].id][0].color})` }} />
              <span className="ptrail-node" style={{ borderColor: STAGES_BY_GROUP[groups[gi + 1].id][0].color }}>{groups[gi + 1].icon}</span>
            </div>
          )}
          </Fragment>
        );
      })}

      {/* F5: Certificate — shown when all pathway stages are done */}
      {pathDone.size >= PATHWAY.length && (
        <div className="cert-banner">
          <div className="cert-ic">🏆</div>
          <div className="cert-body">
            <div className="cert-title">{lc.certCompleted}</div>
            <div className="cert-sub">{lc.certTitle}</div>
          </div>
          <button className="cert-dl-btn" onClick={() => downloadCertificate(lang, userName)}>
            📜 {lc.certDownload}
          </button>
        </div>
      )}

      <div className="pathfoot">{lc.pathFoot}</div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   PRACTICE TODAY — a one-tap daily plan built from the learner's real
   state (progress, homework, activity log). Removes the "what should I
   practice?" decision that kills most practice habits.
════════════════════════════════════════════════════════════ */
const _v12wait = (ms) => new Promise(r => setTimeout(r, ms));
const TodayPage = memo(function TodayPage({ lang, exp, homework, onLearn, onRead, onSong, onReward, onBack, onNavigate }) {
  const T = {
    th: { title: "ซ้อมวันนี้", sub: "แผนซ้อมส่วนตัวของคุณ — สร้างใหม่ให้ทุกวันจากความคืบหน้าจริง ไล่ทำทีละข้อได้เลย", warm: "วอร์มอัพนิ้ว", hw: "การบ้านจากครู", review: "ทบทวนของเดิม", learn: "เรียนเรื่องใหม่", song: "เพลงปิดท้าย", start: "เริ่ม ▶", done: "เสร็จแล้ว ✓", hwBtn: "ทำแล้ว ✓", progress: "ความคืบหน้าวันนี้", allDone: "ครบทุกข้อแล้ว! สุดยอดไปเลยครับ 🎉", bonus: "รับโบนัสประจำวัน +40 EXP · +20 🪙", claimed: "รับโบนัสของวันนี้แล้ว ✓" },
    en: { title: "Practice Today", sub: "Your personal plan — rebuilt every day from your real progress. Just work down the list.", warm: "Finger warm-up", hw: "Teacher's homework", review: "Review", learn: "Something new", song: "Closing song", start: "Start ▶", done: "Done ✓", hwBtn: "Done ✓", progress: "Today's progress", allDone: "All done — amazing work! 🎉", bonus: "Claim daily bonus +40 EXP · +20 🪙", claimed: "Today's bonus claimed ✓" },
    zh: { title: "今日练习", sub: "你的专属计划 — 每天根据真实进度重新生成，逐项完成即可。", warm: "手指热身", hw: "老师的作业", review: "复习", learn: "学点新的", song: "结尾曲", start: "开始 ▶", done: "完成 ✓", hwBtn: "已完成 ✓", progress: "今日进度", allDone: "全部完成，太棒了！🎉", bonus: "领取每日奖励 +40 EXP · +20 🪙", claimed: "今日奖励已领取 ✓" },
  }[lang];
  const [, setTick] = useState(0);
  const bump = () => setTick(t => t + 1);
  const doneLog = todayEntries();
  const seed = daySeed();
  const doneP = pathDoneSet();
  const keyMap = keyDoneMap();

  const warm = MAJOR_SCALE_SONGS[seed % MAJOR_SCALE_SONGS.length];
  const hw = homework && homework.text ? homework : null;

  // review = the finished (non-chapter) topic you've gone longest without touching
  const lessonLast = {};
  for (const e of readActLog()) if (e.k === "lesson") { const sid = e.id.split("/")[0]; lessonLast[sid] = Math.max(lessonLast[sid] || 0, e.t); }
  const reviewables = PATHWAY.filter(s => !s.content && doneP.has(s.id))
    .sort((a, b) => (lessonLast[a.id] || 0) - (lessonLast[b.id] || 0));
  const review = reviewables[0] || null;
  const reviewKey = review
    ? (KEYS_12.find(k => (keyMap[review.id] || []).includes(k.id.toLowerCase())) || KEYS_12[seed % KEYS_12.length])
    : null;

  // new = adaptive: a critically weak skill takes priority over the next Pathway
  // stage as a soft nudge, never a hard block — "next_stage"/"warmup" fall back
  // to the exact previous behavior (see nextRecommendedAction).
  const nextAction = nextRecommendedAction();
  const nextStage = nextAction.type === "next_stage" ? nextAction.stage : null;
  const nextKey = nextStage && !nextStage.content
    ? (KEYS_12.find(k => !(keyMap[nextStage.id] || []).includes(k.id.toLowerCase())) || KEYS_12[0])
    : null;

  // closing song matched to level
  const lvl = levelInfo(exp).level;
  const pool = (lvl >= 10 ? ["furelise"] : lvl >= 5 ? ["birthday", "london", "saints"] : ["twinkle", "row"])
    .map(id => SONGS.find(s => s.id === id)).filter(Boolean);
  const song = pool.length ? pool[seed % pool.length] : SONGS[0];

  const steps = [
    { id: "warm", icon: "🎹", tag: T.warm, label: tr(warm, lang), isDone: doneLog.some(e => e.k === "game" && e.id === warm.id), go: () => onSong(warm) },
    ...(hw ? [{ id: "hw", icon: "📘", tag: T.hw, label: hw.text, isDone: hwDoneToday(), hwStep: true }] : []),
    ...(review ? [{ id: "review", icon: "🔁", tag: T.review, label: tr(review.title, lang) + (reviewKey ? " · " + reviewKey.name : ""), isDone: doneLog.some(e => e.k === "lesson" && e.id.split("/")[0] === review.id), go: () => onLearn(review, reviewKey, review.types ? review.types[0] : null) }] : []),
    ...(nextAction.type === "fundamentals" ? [{
      id: "new", icon: nextAction.feature === "hand_coach" ? "🖐️" : nextAction.feature === "ear_training" ? "👂" : "🎵",
      tag: T.learn,
      label: (nextAction.feature === "hand_coach" ? L[lang].studioCamera : nextAction.feature === "ear_training" ? L[lang].navEar : L[lang].studioPlayAlong),
      isDone: nextAction.feature === "hand_coach" ? doneLog.some(e => e.id === "hand_coach")
        : nextAction.feature === "ear_training" ? doneLog.some(e => e.k === "ear") : doneLog.some(e => e.k === "game"),
      go: () => onNavigate(nextAction.feature),
    }] : nextAction.type === "remediate" ? [{
      id: "new", icon: "🎯", tag: T.learn, label: tr(SKILL_LABELS[nextAction.skill], lang),
      isDone: doneLog.some(e => skillsOfActivity(e).includes(nextAction.skill)),
      go: () => onNavigate(nextAction.feature, nextAction.skill === "chord_knowledge" ? "chord" : undefined),
    }] : (nextAction.type === "new_song" || nextAction.type === "replay_song") ? [{
      id: "new", icon: "🎵", tag: T.learn, label: tr(nextAction.song, lang),
      isDone: doneLog.some(e => e.k === "game" && e.id === nextAction.song.id),
      go: () => onSong(nextAction.song),
    }] : nextStage ? [{ id: "new", icon: "✨", tag: T.learn, label: tr(nextStage.title, lang) + (nextKey ? " · " + nextKey.name : ""), isDone: doneLog.some(e => (e.k === "lesson" || e.k === "read-chapter") && e.id.split("/")[0] === nextStage.id), go: () => nextStage.content ? onRead(nextStage) : onLearn(nextStage, nextKey, nextStage.types ? nextStage.types[0] : null) }] : []),
    { id: "song", icon: "🚀", tag: T.song, label: tr(song, lang), isDone: doneLog.some(e => e.k === "game" && e.id === song.id), go: () => onSong(song) },
  ];
  const nDone = steps.filter(s => s.isDone).length;
  const allDone = nDone === steps.length;
  const pct = Math.round((nDone / steps.length) * 100);

  return (
    <div className="pathpage">
      {onBack && (
        <button onClick={() => { playUi("click"); onBack(); }}
          style={{ margin: "12px 2px 0", background: "none", border: "1px solid var(--bd4)", borderRadius: "8px", color: "#a88b9b", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>
          ← {L[lang].navStudio}
        </button>
      )}
      <div className="v12hero">
        <div className="v12title">📅 {T.title}</div>
        <div className="v12sub">{T.sub}</div>
      </div>
      <div className="v12card">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "7px" }}>
          <span style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace" }}>{T.progress}</span>
          <span style={{ fontSize: "11px", color: "#d97757", fontFamily: "'Orbitron',sans-serif", fontWeight: 700 }}>{nDone}/{steps.length}</span>
        </div>
        <div className="tdbar"><div className="tdfill" style={{ width: pct + "%" }} /></div>
      </div>
      {steps.map(s => (
        <div key={s.id} className={`tdstep${s.isDone ? " done" : ""}`}>
          <span className="tdico">{s.isDone ? "✅" : s.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="tdtag">{s.tag}</div>
            <div className="tdlbl">{s.label}</div>
          </div>
          {s.hwStep
            ? (s.isDone
              ? <span className="tdgo done">{T.done}</span>
              : <button className="tdgo" onClick={() => { playUi("click"); markHwDone(); onReward(10, 0); bump(); }}>{T.hwBtn}</button>)
            : (s.isDone
              ? <span className="tdgo done">{T.done}</span>
              : <button className="tdgo" onClick={() => { playUi("click"); logUsage("pathway", "today-" + s.id); s.go(); }}>{T.start}</button>)}
        </div>
      ))}
      {allDone && (
        <div className="v12card" style={{ textAlign: "center", borderColor: "#d9775766" }}>
          <div style={{ fontSize: "15px", color: "#d97757", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, marginBottom: "9px" }}>{T.allDone}</div>
          {todayBonusClaimed()
            ? <div style={{ fontSize: "12px", color: "#d97757", fontFamily: "'Share Tech Mono',monospace" }}>{T.claimed}</div>
            : <button className="tdgo" style={{ borderColor: "#d97757", color: "#d97757", background: "rgba(217,119,87,.1)" }}
                onClick={() => { playUi("reward"); claimTodayBonus(); onReward(40, 20); bump(); }}>{T.bonus}</button>}
        </div>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   EAR GYM — daily listening workouts (intervals / chord quality /
   melody echo). Practicable anywhere, even without a piano.
════════════════════════════════════════════════════════════ */
const EG_ROUND = 8;
const EarGymPage = memo(function EarGymPage({ lang, onReward, onBack, initialTab }) {
  const T = {
    th: { title: "ยิมหู", sub: "ฝึกหูวันละนิด — ไม่ต้องมีเปียโนตรงหน้าก็ซ้อมได้", int: "ขั้นคู่", chord: "คอร์ด", echo: "เล่นตามทำนอง", melody: "จำทำนอง", q: "ข้อ", listenAgain: "🔊 ฟังอีกครั้ง", start: "เริ่มรอบใหม่ ▶", pickInt: "เสียงที่ได้ยินคือขั้นคู่อะไร?", pickChord: "คอร์ดที่ได้ยินคือชนิดไหน?", pickEcho: "แตะโน้ตตามลำดับที่ได้ยิน", pickMelody: "เพลงนี้ชื่ออะไร?", clear: "ล้าง", right: "ถูกต้อง! 🎉", wrong: "เฉลย: ", score: "คะแนน", best: "สถิติดีสุด", done: "จบรอบ!", again: "เล่นอีกรอบ ▶" },
    en: { title: "Ear Gym", sub: "A little listening every day — no piano needed", int: "Intervals", chord: "Chords", echo: "Melody echo", melody: "Name That Tune", q: "Q", listenAgain: "🔊 Hear it again", start: "Start round ▶", pickInt: "Which interval did you hear?", pickChord: "Which chord quality is it?", pickEcho: "Tap the notes in the order you heard", pickMelody: "Which song is this?", clear: "Clear", right: "Correct! 🎉", wrong: "Answer: ", score: "Score", best: "Best", done: "Round complete!", again: "Play again ▶" },
    zh: { title: "听力房", sub: "每天练一点听力 — 没有钢琴也能练", int: "音程", chord: "和弦", echo: "旋律模仿", melody: "辨别曲目", q: "第", listenAgain: "🔊 再听一次", start: "开始 ▶", pickInt: "你听到的是什么音程？", pickChord: "这是什么和弦？", pickEcho: "按听到的顺序点击音符", pickMelody: "这是哪首歌？", clear: "清除", right: "正确！🎉", wrong: "答案：", score: "得分", best: "最佳", done: "本轮结束！", again: "再来一轮 ▶" },
  }[lang];
  const [tab, setTab] = useState(initialTab || "int");
  const [phase, setPhase] = useState("idle");   // idle | play | done
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [cur, setCur] = useState(null);          // { notes, chord, answer, options[{key,label}] }
  const [fb, setFb] = useState(null);            // { ok, answerLabel, pickedKey }
  const [taps, setTaps] = useState([]);
  const [result, setResult] = useState(null);
  const startTRef = useRef(0);
  const roundRef = useRef(0);
  const ROOTS = ["C4", "D4", "E4", "F4", "G4", "A4"];

  async function playCur(c) {
    const q = c || cur;
    if (!q) return;
    if (q.chord) { for (const n of q.notes) playPianoNote(n, 1.5); }
    else { for (const n of q.notes) { playPianoNote(n, 0.55); await _v12wait(430); } }
  }
  function genQ(kind) {
    const root = ROOTS[Math.floor(Math.random() * ROOTS.length)];
    if (kind === "int") {
      const pool = (earBest().int || 0) >= 7 ? EG_INT_FULL : EG_INT_BASE;
      const semi = pool[Math.floor(Math.random() * pool.length)];
      const opts = [...new Set([semi, ...[...pool].sort(() => Math.random() - 0.5)])].slice(0, 4).sort(() => Math.random() - 0.5);
      return {
        notes: [root, transposeNotes([root], semi)[0]], chord: false, answer: String(semi),
        options: opts.map(s => ({ key: String(s), label: (INTERVAL_DEFS.find(d => d.semi === s) || {})[lang] || String(s) })),
      };
    }
    if (kind === "chord") {
      const q = TRIAD_TYPES[Math.floor(Math.random() * TRIAD_TYPES.length)];
      return {
        notes: _ascNotes(chordNotesOf(pcOf(root), q.key), 4), chord: true, answer: q.key,
        options: TRIAD_TYPES.map(t => ({ key: t.key, label: t.lab[lang] || t.lab.en })),
      };
    }
    if (kind === "melody") {
      // D5: Name That Tune — play first 6 non-rest notes of a random song, pick which song
      const eligible = SONGS.filter(s => !s.custom && !s.drill && s.seq && s.seq.length >= 6);
      if (eligible.length < 4) return genQ("int"); // fallback if not enough songs
      const correct = eligible[Math.floor(Math.random() * eligible.length)];
      const wrongs = eligible.filter(s => s.id !== correct.id).sort(() => Math.random() - 0.5).slice(0, 3);
      const allOpts = [correct, ...wrongs].sort(() => Math.random() - 0.5);
      const rawNotes = correct.seq.filter((x: any[]) => x[0] !== "R").slice(0, 7);
      const bpmMs = 60000 / Math.max(60, correct.bpm);
      const notes = rawNotes.map((x: any[]) => x[0]);
      const durations = rawNotes.map((x: any[]) => (x[1] || 1) * bpmMs);
      return {
        notes, durations, chord: false, answer: correct.id, isMelody: true,
        options: allOpts.map(s => ({ key: s.id, label: lang === "th" ? s.th : lang === "zh" ? s.zh : s.en })),
      };
    }
    const len = (earBest().echo || 0) >= 7 ? 4 : 3;
    const pcs = [];
    for (let i = 0; i < len; i++) pcs.push(["C", "D", "E", "F", "G", "A", "B"][Math.floor(Math.random() * 7)]);
    return { notes: pcs.map(p => p + "4"), chord: false, answer: pcs.join(" "), pcs };
  }
  async function playCurMelody(q) {
    if (!q || !q.isMelody) return;
    for (let i = 0; i < q.notes.length; i++) {
      playPianoNote(q.notes[i], Math.min(1.2, (q.durations[i] || 600) / 1000));
      await _v12wait(Math.min(600, q.durations[i] || 500));
    }
  }
  function nextQ(kind, myRound) {
    const q = genQ(kind);
    setCur(q); setFb(null); setTaps([]);
    if (q.isMelody) {
      setTimeout(() => { if (roundRef.current === myRound) playCurMelody(q); }, 350);
    } else {
      setTimeout(() => { if (roundRef.current === myRound) playCur(q); }, 350);
    }
  }
  function startRound() {
    playUi("click");
    const myRound = ++roundRef.current;
    setScore(0); setIdx(0); setResult(null); setPhase("play");
    startTRef.current = Date.now();
    nextQ(tab, myRound);
  }
  function finishRound(finalScore) {
    const secs = Math.round((Date.now() - startTRef.current) / 1000);
    const acc = Math.round((finalScore / EG_ROUND) * 100);
    const stars = finalScore >= 8 ? 3 : finalScore >= 6 ? 2 : finalScore >= 4 ? 1 : 0;
    const xp = 10 + finalScore * 3;
    setEarBest(tab, finalScore);
    logActivity("ear", tab, finalScore, EG_ROUND - finalScore, Math.max(30, secs));
    logPractice(acc);
    onReward(xp, stars * 5);
    setResult({ score: finalScore, stars, xp, coins: stars * 5 });
    setPhase("done");
    playUi(stars >= 2 ? "levelup" : "click");
  }
  function answered(ok, answerLabel, pickedKey) {
    const ns = ok ? score + 1 : score;
    setScore(ns);
    setFb({ ok, answerLabel, pickedKey });
    playUi(ok ? "click" : "wrong");
    const myRound = roundRef.current;
    setTimeout(() => {
      if (roundRef.current !== myRound) return;
      if (idx + 1 >= EG_ROUND) { finishRound(ns); return; }
      setIdx(idx + 1);
      nextQ(tab, myRound);
    }, ok ? 900 : 1600);
  }
  function pickOption(o) {
    if (!cur || fb) return;
    const okAns = o.key === cur.answer;
    let ansLabel;
    if (cur.isMelody) {
      ansLabel = (cur.options.find((x: any) => x.key === cur.answer) || {}).label || cur.answer;
    } else {
      ansLabel = cur.chord
        ? (TRIAD_TYPES.find(t => t.key === cur.answer) || { lab: {} }).lab[lang]
        : (INTERVAL_DEFS.find(d => String(d.semi) === cur.answer) || {})[lang];
    }
    answered(okAns, ansLabel || cur.answer, o.key);
  }
  function tapEcho(pc) {
    if (!cur || fb || !cur.pcs) return;
    playPianoNote(pc + "4", 0.4);
    const nt = [...taps, pc];
    setTaps(nt);
    if (nt.length >= cur.pcs.length) {
      const okAns = nt.join(" ") === cur.pcs.join(" ");
      answered(okAns, cur.pcs.map(p => (lang === "th" ? PC_SOLFA_TH[p] : p)).join(" · "), null);
    }
  }
  const best = earBest();
  const tabs = [["int", "📏", T.int], ["chord", "🎹", T.chord], ["echo", "🎶", T.echo], ["melody", "🎵", T.melody]];
  return (
    <div className="pathpage">
      {onBack && (
        <button onClick={() => { playUi("click"); onBack(); }}
          style={{ margin: "12px 2px 0", background: "none", border: "1px solid var(--bd4)", borderRadius: "8px", color: "#a88b9b", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>
          ← {L[lang].navStudio}
        </button>
      )}
      <div className="v12hero">
        <div className="v12title">👂 {T.title}</div>
        <div className="v12sub">{T.sub}</div>
      </div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        {tabs.map(([k, ic, lb]) => (
          <button key={k} onClick={() => { if (phase === "play") return; playUi("click"); setTab(k); setPhase("idle"); setResult(null); }}
            style={{ flex: 1, padding: "11px 6px", borderRadius: "12px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: "13px",
              border: tab === k ? "1px solid #d97757" : "1px solid var(--bd4)", color: tab === k ? "#d97757" : "var(--text2)",
              background: tab === k ? "rgba(217,119,87,.1)" : "var(--card3)" }}>
            {ic} {lb}<div style={{ fontSize: "9px", color: "var(--muted)", marginTop: "2px" }}>{T.best}: {best[k] || 0}/{EG_ROUND}</div>
          </button>
        ))}
      </div>
      {phase !== "play" && (
        <div className="v12card" style={{ textAlign: "center", padding: "24px 14px" }}>
          {result && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "26px" }}>{"⭐".repeat(result.stars) || "💪"}</div>
              <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: "17px", color: "var(--text)", fontWeight: 900, margin: "6px 0" }}>{T.done} {result.score}/{EG_ROUND}</div>
              <div style={{ fontSize: "12px", color: "#d97757", fontFamily: "'Share Tech Mono',monospace" }}>+{result.xp} EXP · +{result.coins} 🪙</div>
            </div>
          )}
          <button className="tdgo" style={{ fontSize: "12px", padding: "12px 26px" }} onClick={startRound}>{result ? T.again : T.start}</button>
        </div>
      )}
      {phase === "play" && cur && (
        <div className="v12card" style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontFamily: "'Share Tech Mono',monospace", fontSize: "11px", color: "var(--muted)" }}>
            <span>{T.q} {idx + 1}/{EG_ROUND}</span><span>{T.score}: {score}</span>
          </div>
          <button onClick={() => cur.isMelody ? playCurMelody(cur) : playCur()} style={{ margin: "0 auto 14px", display: "block", padding: "13px 24px", borderRadius: "14px", border: "1px solid #d9775755", background: "rgba(217,119,87,.08)", color: "#d97757", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>{T.listenAgain}</button>
          <div style={{ fontSize: "12px", color: "var(--muted)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, marginBottom: "11px" }}>
            {tab === "int" ? T.pickInt : tab === "chord" ? T.pickChord : tab === "melody" ? T.pickMelody : T.pickEcho}
          </div>
          {tab !== "echo" && cur.options && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "9px" }}>
              {cur.options.map(o => (
                <button key={o.key} className={`egopt${fb && o.key === cur.answer ? " ok" : fb && fb.pickedKey === o.key && !fb.ok ? " bad" : ""}`} onClick={() => pickOption(o)}>{o.label}</button>
              ))}
            </div>
          )}
          {tab === "echo" && (
            <>
              <div style={{ minHeight: "26px", marginBottom: "9px", fontFamily: "'Orbitron',sans-serif", color: "#ff76d8", fontSize: "14px", letterSpacing: "2px" }}>
                {taps.map(p => (lang === "th" ? PC_SOLFA_TH[p] : p)).join(" ")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "6px" }}>
                {["C", "D", "E", "F", "G", "A", "B"].map(p => (
                  <button key={p} className="egopt" style={{ padding: "13px 2px" }} onClick={() => tapEcho(p)}>
                    <div style={{ fontSize: "15px", fontFamily: "'Orbitron',sans-serif" }}>{p}</div>
                    <div style={{ fontSize: "9px", color: "var(--muted)" }}>{lang === "th" ? PC_SOLFA_TH[p] : PC_SOLFA[p]}</div>
                  </button>
                ))}
              </div>
              {taps.length > 0 && !fb && <button onClick={() => setTaps([])} style={{ marginTop: "9px", background: "none", border: "1px solid var(--bd4)", borderRadius: "7px", color: "#a88b9b", padding: "4px 12px", fontSize: "11px", cursor: "pointer" }}>{T.clear}</button>}
            </>
          )}
          <div style={{ minHeight: "24px", marginTop: "12px", fontSize: "13px", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, color: fb ? (fb.ok ? "#d97757" : "#ff5252") : "transparent" }}>
            {fb ? (fb.ok ? T.right : T.wrong + fb.answerLabel) : "·"}
          </div>
        </div>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   NOTE-READING COURSE — a graded path to real notation literacy:
   treble → ledger lines → bass clef → accidentals → short sequences.
════════════════════════════════════════════════════════════ */
const ReadingPage = memo(function ReadingPage({ lang, onReward, onBack }) {
  const T = {
    th: { title: "คอร์สอ่านโน้ต", sub: "อ่านโน้ตจริงเป็นขั้นบันได — กุญแจซอล → เส้นน้อย → กุญแจฟา → ชาร์ป → อ่านเป็นวลี", lvl: "ด่าน", locked: "ผ่านด่านก่อนหน้าให้ได้ ⭐⭐ ก่อน", q: "ข้อ", what: "โน้ตตัวนี้คือ?", seqWhat: "แตะชื่อโน้ตตามลำดับบนบรรทัด", right: "ถูกต้อง! 🎉", wrong: "เฉลย: ", done: "จบด่าน!", again: "เล่นอีกครั้ง ▶", play: "เริ่ม ▶", back: "← เลือกด่าน", score: "คะแนน",
        tapMode: "⌨️ แตะเลือก", pianoMode: "🎹 เล่นเปียโนจริง", listening: "🎤 กำลังฟัง... เล่นโน้ตนี้บนเปียโนได้เลย", listenReady: "🎹 พร้อมแล้ว — เล่นโน้ตที่เห็นบนเปียโน/MIDI ของคุณ", listenErr: "เข้าไมค์ไม่ได้ — ลองแตะเลือกแทน" },
    en: { title: "Note Reading", sub: "Real notation literacy, step by step — treble → ledger lines → bass clef → sharps → phrases", lvl: "Level", locked: "Earn ⭐⭐ on the previous level first", q: "Q", what: "Which note is this?", seqWhat: "Tap the note names in order", right: "Correct! 🎉", wrong: "Answer: ", done: "Level complete!", again: "Play again ▶", play: "Start ▶", back: "← Levels", score: "Score",
        tapMode: "⌨️ Tap to answer", pianoMode: "🎹 Play a real piano", listening: "🎤 Listening... play this note on your piano", listenReady: "🎹 Ready — play the note you see on your piano/MIDI", listenErr: "Couldn't reach the mic — try tap mode instead" },
    zh: { title: "识谱课", sub: "循序渐进学会读谱 — 高音谱号 → 加线 → 低音谱号 → 升号 → 短句", lvl: "关卡", locked: "先在上一关拿到 ⭐⭐", q: "第", what: "这是什么音？", seqWhat: "按顺序点击音名", right: "正确！🎉", wrong: "答案：", done: "本关完成！", again: "再来一次 ▶", play: "开始 ▶", back: "← 选关", score: "得分",
        tapMode: "⌨️ 点击作答", pianoMode: "🎹 用真钢琴弹奏", listening: "🎤 聆听中...在钢琴上弹这个音吧", listenReady: "🎹 准备好了 — 在钢琴/MIDI 上弹出你看到的音", listenErr: "无法使用麦克风 — 请改用点击模式" },
  }[lang];
  const [lvl, setLvl] = useState(null);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [cur, setCur] = useState(null);   // { notes, answerPcs, options }
  const [fb, setFb] = useState(null);
  const [taps, setTaps] = useState([]);
  const [result, setResult] = useState(null);
  const startTRef = useRef(0);
  const runRef = useRef(0);
  // ── answer by playing a real piano/MIDI keyboard instead of tapping ──
  // reuses the same mic/MIDI singleton every other listening mode shares.
  const [micMode, setMicMode] = useState(false);
  const [micSrc, setMicSrc] = useState(null);   // {type:"midi"|"mic"|"error"}
  const [micHeard, setMicHeard] = useState(null); // last detected note, for a flash of feedback
  const micTapsRef = useRef([]);
  const curRef = useRef(null); curRef.current = cur;
  const fbRef = useRef(null); fbRef.current = fb;
  function micInput(d) {
    if (!curRef.current || fbRef.current || !lvl) return;
    const pc = pcOf(d.note);
    playPianoNote(d.note, 0.3);
    setMicHeard(d.note);
    if (lvl.seq === 1) {
      answered(pc === curRef.current.answerPcs[0], lvl);
    } else {
      micTapsRef.current = [...micTapsRef.current, pc];
      setTaps(micTapsRef.current);
      if (micTapsRef.current.length >= curRef.current.answerPcs.length) {
        answered(micTapsRef.current.join(" ") === curRef.current.answerPcs.join(" "), lvl);
      }
    }
  }
  const micHandlerRef = useRef(() => {});
  micHandlerRef.current = micInput;
  useEffect(() => {
    if (!micMode || !lvl || result) { stopPracticeListeners(); setMicSrc(null); return; }
    getAC();
    stopPracticeListeners(); // release any listener another mode left open — never stack
    const onDetect = (d) => micHandlerRef.current(d);
    (async () => {
      const midiOk = await startMidiListener(onDetect, () => setMicSrc({ type: "midi" }));
      if (!midiOk) await startMicListener(onDetect, () => setMicSrc({ type: "mic" }), () => setMicSrc({ type: "error" }));
    })();
    return () => stopPracticeListeners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micMode, lvl, result]);
  useEffect(() => () => stopPracticeListeners(), []); // belt-and-braces: release on unmount

  function genQ(L) {
    const pick = () => L.pool[Math.floor(Math.random() * L.pool.length)];
    const notes = [];
    for (let i = 0; i < L.seq; i++) { let n = pick(); if (L.seq > 1) while (i > 0 && n === notes[i - 1]) n = pick(); notes.push(n); }
    const answerPcs = notes.map(pcOf);
    let options = null;
    if (L.seq === 1) {
      const pcsAll = [...new Set(L.pool.map(pcOf))];
      const others = pcsAll.filter(p => p !== answerPcs[0]).sort(() => Math.random() - 0.5).slice(0, 3);
      options = [answerPcs[0], ...others].sort(() => Math.random() - 0.5);
    }
    return { notes, answerPcs, options };
  }
  function nextQ(L) { setCur(genQ(L)); setFb(null); setTaps([]); micTapsRef.current = []; setMicHeard(null); }
  function startLevel(L) {
    playUi("click");
    runRef.current++;
    setLvl(L); setIdx(0); setScore(0); setResult(null);
    startTRef.current = Date.now();
    nextQ(L);
  }
  function finishLevel(finalScore, L) {
    const secs = Math.round((Date.now() - startTRef.current) / 1000);
    const acc = Math.round((finalScore / L.qn) * 100);
    const stars = finalScore >= Math.ceil(L.qn * 0.9) ? 3 : finalScore >= Math.ceil(L.qn * 0.7) ? 2 : finalScore >= Math.ceil(L.qn * 0.5) ? 1 : 0;
    const xp = 15 + Math.round((finalScore / L.qn) * 30);
    setReadCourseStars(L.n, stars);
    logActivity("read", "L" + L.n, finalScore, L.qn - finalScore, Math.max(30, secs));
    logPractice(acc);
    onReward(xp, stars * 5);
    setResult({ score: finalScore, stars, xp, coins: stars * 5, qn: L.qn });
    playUi(stars >= 2 ? "levelup" : "click");
  }
  function answered(ok, L) {
    const ns = ok ? score + 1 : score;
    setScore(ns);
    setFb({ ok });
    playUi(ok ? "click" : "wrong");
    if (ok) playPianoNote(cur.notes[0], 0.5);
    const run = runRef.current;
    setTimeout(() => {
      if (runRef.current !== run) return;
      if (idx + 1 >= L.qn) { finishLevel(ns, L); return; }
      setIdx(idx + 1);
      nextQ(L);
    }, ok ? 750 : 1500);
  }
  function pickPc(pc) {
    if (!cur || fb || !lvl) return;
    playPianoNote(pc + "4", 0.35); // hear the note you picked, right or wrong — that's the lesson
    answered(pc === cur.answerPcs[0], lvl);
  }
  function tapSeq(pc) {
    if (!cur || fb || !lvl) return;
    playPianoNote(pc + "4", 0.35);
    const nt = [...taps, pc];
    setTaps(nt);
    if (nt.length >= cur.answerPcs.length) answered(nt.join(" ") === cur.answerPcs.join(" "), lvl);
  }
  const stars = readCourseStars();
  const unlocked = (n) => n === 1 || (stars[n - 1] || 0) >= 2;
  const pcLabel = (p) => p.replace("#", "♯");

  if (!lvl) {
    return (
      <div className="pathpage">
        {onBack && (
          <button onClick={() => { playUi("click"); onBack(); }}
            style={{ margin: "12px 2px 0", background: "none", border: "1px solid var(--bd4)", borderRadius: "8px", color: "#a88b9b", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>
            ← {L[lang].navStudio}
          </button>
        )}
        <div className="v12hero"><div className="v12title">🎼 {T.title}</div><div className="v12sub">{T.sub}</div></div>
        {RC_LEVELS.map(L => {
          const open = unlocked(L.n);
          const st = stars[L.n] || 0;
          return (
            <button key={L.n} className="tdstep" style={{ width: "100%", cursor: open ? "pointer" : "default", opacity: open ? 1 : 0.55, textAlign: "left" }}
              onClick={() => open && startLevel(L)}>
              <span className="tdico">{open ? L.icon : "🔒"}</span>
              <div style={{ flex: 1 }}>
                <div className="tdtag">{T.lvl} {L.n} · {L.clef === "bass" ? "𝄢" : "𝄞"}{L.seq > 1 ? " · x" + L.seq : ""}</div>
                <div className="tdlbl">{open ? ("⭐".repeat(st) || "—") : T.locked}</div>
              </div>
              {open && <span className="tdgo">{T.play}</span>}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div className="pathpage">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 2px 10px", gap: "8px", flexWrap: "wrap" }}>
        <button onClick={() => { playUi("click"); runRef.current++; setLvl(null); setResult(null); }} style={{ background: "none", border: "1px solid var(--bd4)", borderRadius: "8px", color: "#a88b9b", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, flexShrink: 0 }}>{T.back}</button>
        <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: "11px", color: "var(--muted)" }}>
          {result ? T.done : `${T.q} ${idx + 1}/${lvl.qn} · ${T.score}: ${score}`}
        </span>
        {!result && (
          <button onClick={() => { playUi("click"); setMicMode(m => !m); }}
            style={{ marginLeft: "auto", background: micMode ? "rgba(217,119,87,.14)" : "none", border: `1px solid ${micMode ? "#d97757" : "var(--bd4)"}`, borderRadius: "20px", color: micMode ? "#d97757" : "#a88b9b", padding: "6px 12px", fontSize: "11px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, flexShrink: 0 }}>
            {micMode ? T.tapMode : T.pianoMode}
          </button>
        )}
      </div>
      {result ? (
        <div className="v12card" style={{ textAlign: "center", padding: "26px 14px" }}>
          <div style={{ fontSize: "28px" }}>{"⭐".repeat(result.stars) || "💪"}</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: "18px", color: "var(--text)", fontWeight: 900, margin: "8px 0" }}>{result.score}/{result.qn}</div>
          <div style={{ fontSize: "12px", color: "#d97757", fontFamily: "'Share Tech Mono',monospace", marginBottom: "14px" }}>+{result.xp} EXP · +{result.coins} 🪙</div>
          <button className="tdgo" style={{ fontSize: "12px", padding: "12px 26px" }} onClick={() => startLevel(lvl)}>{T.again}</button>
        </div>
      ) : cur && (
        <div className="v12card" style={{ textAlign: "center" }}>
          <div style={{ background: "var(--card)", borderRadius: "12px", padding: "8px 6px", marginBottom: "13px", border: "1px solid var(--bd1)" }}>
            <StaffNotes notes={cur.notes} hideNames clef={lvl.clef} />
          </div>
          <div style={{ fontSize: "12.5px", color: "var(--muted)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, marginBottom: "11px" }}>
            {lvl.seq === 1 ? T.what : T.seqWhat}
          </div>
          {micMode ? (
            <div style={{ padding: "18px 10px", borderRadius: "12px", border: `1px solid ${micSrc && micSrc.type === "error" ? "#ff5252" : "#d9775744"}`, background: "rgba(217,119,87,.06)" }}>
              {micSrc && micSrc.type === "error" ? (
                <div style={{ fontSize: "13px", color: "#ff5252", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600 }}>{T.listenErr}</div>
              ) : (
                <>
                  <div style={{ fontSize: "26px", marginBottom: "6px" }} className={micHeard ? "" : "flicker"}>{micSrc ? "🎹" : "🎤"}</div>
                  <div style={{ fontSize: "12.5px", color: "var(--muted)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600 }}>
                    {micSrc ? T.listenReady : T.listening}
                  </div>
                  {lvl.seq > 1 && <div style={{ minHeight: "20px", marginTop: "8px", fontFamily: "'Orbitron',sans-serif", color: "#ff76d8", fontSize: "14px", letterSpacing: "2px" }}>{taps.join(" ")}</div>}
                  {micHeard && <div style={{ marginTop: "6px", fontFamily: "'Share Tech Mono',monospace", fontSize: "11px", color: "var(--muted)" }}>♪ {micHeard}</div>}
                </>
              )}
            </div>
          ) : (
            <>
              {lvl.seq === 1 && cur.options && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "9px" }}>
                  {cur.options.map(p => (
                    <button key={p} className={`egopt${fb && p === cur.answerPcs[0] ? " ok" : ""}`} onClick={() => pickPc(p)}>
                      <div style={{ fontSize: "17px", fontFamily: "'Orbitron',sans-serif" }}>{pcLabel(p)}</div>
                      {!p.includes("#") && <div style={{ fontSize: "9.5px", color: "var(--muted)" }}>{lang === "th" ? PC_SOLFA_TH[p] : PC_SOLFA[p]}</div>}
                    </button>
                  ))}
                </div>
              )}
              {lvl.seq > 1 && (
                <>
                  <div style={{ minHeight: "24px", marginBottom: "9px", fontFamily: "'Orbitron',sans-serif", color: "#ff76d8", fontSize: "14px", letterSpacing: "2px" }}>{taps.join(" ")}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "6px" }}>
                    {["C", "D", "E", "F", "G", "A", "B"].map(p => (
                      <button key={p} className="egopt" style={{ padding: "13px 2px" }} onClick={() => tapSeq(p)}>
                        <div style={{ fontSize: "15px", fontFamily: "'Orbitron',sans-serif" }}>{p}</div>
                        <div style={{ fontSize: "9px", color: "var(--muted)" }}>{lang === "th" ? PC_SOLFA_TH[p] : PC_SOLFA[p]}</div>
                      </button>
                    ))}
                  </div>
                  {taps.length > 0 && !fb && <button onClick={() => setTaps([])} style={{ marginTop: "9px", background: "none", border: "1px solid var(--bd4)", borderRadius: "7px", color: "#a88b9b", padding: "4px 12px", fontSize: "11px", cursor: "pointer" }}>✕</button>}
                </>
              )}
            </>
          )}
          <div style={{ minHeight: "24px", marginTop: "12px", fontSize: "13px", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, color: fb ? (fb.ok ? "#d97757" : "#ff5252") : "transparent" }}>
            {fb ? (fb.ok ? T.right : T.wrong + cur.answerPcs.map(pcLabel).join(" ")) : "·"}
          </div>
        </div>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   MY STATS (insights) — turns the activity log the app already keeps
   into visible progress: minutes, accuracy, weak spots, best hour.
════════════════════════════════════════════════════════════ */
const InsightsPage = memo(function InsightsPage({ lang, profile, onSong, onBack }) {
  const T = {
    th: { title: "สถิติของฉัน", sub: "ความคืบหน้าจริงจากการซ้อมของคุณ — ยิ่งซ้อม กราฟยิ่งโต", mins: "นาทีรวม", notes: "โน้ตที่เล่นถูก", days: "วันที่ซ้อม (14 วัน)", streak: "สตรีค", chart: "นาทีซ้อมย้อนหลัง 14 วัน", acc: "ความแม่นยำ", accNow: "7 วันนี้", accPrev: "7 วันก่อน", weak: "จุดที่ควรเก็บ", weakGo: "ซ้อมเลย ▶", weakNone: "ยังไม่มีข้อมูลพอ — ซ้อมต่อไปเรื่อยๆ เดี๋ยวระบบจะชี้จุดให้เอง", hour: "ช่วงเวลาที่คุณซ้อมบ่อยที่สุด", empty: "ยังไม่มีข้อมูลการซ้อม — เริ่มจากหน้า 'ซ้อมวันนี้' ได้เลย!" },
    en: { title: "My Stats", sub: "Real progress from your real practice — the more you play, the more this grows", mins: "Total minutes", notes: "Correct notes", days: "Days practiced (14d)", streak: "Streak", chart: "Practice minutes — last 14 days", acc: "Accuracy", accNow: "This 7 days", accPrev: "Previous 7", weak: "Spots to polish", weakGo: "Practice ▶", weakNone: "Not enough data yet — keep practicing and this will fill in", hour: "Your most frequent practice time", empty: "No practice data yet — start with 'Practice Today'!" },
    zh: { title: "我的数据", sub: "来自真实练习的真实进步 — 练得越多，这里越丰富", mins: "总分钟", notes: "弹对音符", days: "练习天数(14天)", streak: "连续", chart: "近14天练习分钟", acc: "准确率", accNow: "近7天", accPrev: "前7天", weak: "待加强", weakGo: "去练 ▶", weakNone: "数据还不够 — 继续练习，这里会自动填充", hour: "你最常练习的时间", empty: "还没有练习数据 — 从'今日练习'开始吧！" },
  }[lang];
  const log = readActLog();
  const dayMs = 86400000;
  // day boundary must match dayKey()/dayDate() (DAY_TZ_OFFSET_MIN — currently UTC),
  // not the device's local midnight, or "days practiced" and this chart disagree
  const _n0 = new Date();
  const t0 = Date.UTC(_n0.getUTCFullYear(), _n0.getUTCMonth(), _n0.getUTCDate());
  const start14 = t0 - 13 * dayMs;
  const now = Date.now();
  const mins = Array(14).fill(0);
  const hourSec = Array(24).fill(0);
  let ok7 = 0, miss7 = 0, okP = 0, missP = 0, totalSec = 0, totalOk = 0;
  const daysSet = new Set();
  for (const e of log) {
    const di = Math.floor((e.t - start14) / dayMs);
    if (di >= 0 && di < 14) { mins[di] += e.sec; if (e.sec > 0) daysSet.add(di); }
    if (e.t >= now - 7 * dayMs) { ok7 += e.ok; miss7 += e.miss; }
    else if (e.t >= now - 14 * dayMs) { okP += e.ok; missP += e.miss; }
    hourSec[new Date(e.t).getHours()] += e.sec;
    totalSec += e.sec; totalOk += e.ok;
  }
  const acc7 = ok7 + miss7 > 0 ? Math.round(ok7 / (ok7 + miss7) * 100) : null;
  const accP = okP + missP > 0 ? Math.round(okP / (okP + missP) * 100) : null;
  const byTopic = {};
  for (const e of log) {
    if (e.k === "voice" || e.ok + e.miss < 1) continue;
    const key = e.k + "|" + e.id;
    const b = byTopic[key] || (byTopic[key] = { e, ok: 0, miss: 0 });
    b.ok += e.ok; b.miss += e.miss;
  }
  const weak = Object.values(byTopic)
    .filter(b => b.ok + b.miss >= 4 && b.miss > 0)
    .map(b => ({ ...b, rate: b.miss / (b.ok + b.miss) }))
    .sort((a, b) => b.rate - a.rate).slice(0, 3);
  const bestHour = hourSec.some(s => s > 0) ? hourSec.indexOf(Math.max(...hourSec)) : null;
  const maxMin = Math.max(60, ...mins);
  const WD = { th: ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"], en: ["S", "M", "T", "W", "T", "F", "S"], zh: ["日", "一", "二", "三", "四", "五", "六"] }[lang];
  const hasData = log.length > 0;
  return (
    <div className="pathpage">
      {onBack && (
        <button onClick={() => { playUi("click"); onBack(); }}
          style={{ margin: "12px 2px 0", background: "none", border: "1px solid var(--bd4)", borderRadius: "8px", color: "#a88b9b", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>
          ← {L[lang].navProfile}
        </button>
      )}
      <div className="v12hero"><div className="v12title">📊 {T.title}</div><div className="v12sub">{T.sub}</div></div>
      {!hasData && <div className="v12card" style={{ textAlign: "center", color: "var(--muted)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: "13.5px", padding: "22px 14px" }}>{T.empty}</div>}
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
        <div className="instile"><b>{Math.round(totalSec / 60)}</b><span>{T.mins}</span></div>
        <div className="instile"><b>{totalOk}</b><span>{T.notes}</span></div>
        <div className="instile"><b>{daysSet.size}</b><span>{T.days}</span></div>
        <div className="instile"><b>{(profile && profile.streak) || 0}🔥</b><span>{T.streak}</span></div>
      </div>
      <div className="v12card">
        <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", marginBottom: "6px" }}>{T.chart}</div>
        <div className="insbarwrap">
          {mins.map((m, i) => <div key={i} className="insbar" style={{ height: Math.max(2, Math.round(m / maxMin * 88)) + "%", opacity: m > 0 ? 1 : 0.25 }} title={Math.round(m / 60) + " min"} />)}
        </div>
        <div style={{ display: "flex", gap: "4px", padding: "2px 2px 0" }}>
          {mins.map((_, i) => { const d = new Date(start14 + i * dayMs); return <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "8px", color: "#826575", fontFamily: "'Share Tech Mono',monospace" }}>{WD[d.getUTCDay()]}</div>; })}
        </div>
      </div>
      <div className="v12card">
        <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", marginBottom: "8px" }}>{T.acc}</div>
        <div style={{ display: "flex", gap: "8px" }}>
          <div className="instile"><b style={{ color: acc7 != null && accP != null ? (acc7 >= accP ? "#4caf50" : "#ff5252") : "#d97757" }}>{acc7 == null ? "—" : acc7 + "%"}</b><span>{T.accNow}</span></div>
          <div className="instile"><b style={{ color: "var(--muted)" }}>{accP == null ? "—" : accP + "%"}</b><span>{T.accPrev}</span></div>
        </div>
      </div>
      <div className="v12card">
        <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", marginBottom: "8px" }}>🎯 {T.weak}</div>
        {weak.length === 0 && <div style={{ fontSize: "12.5px", color: "var(--muted)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600 }}>{T.weakNone}</div>}
        {weak.map((w, i) => {
          const song = actSongOf(w.e);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderTop: i ? "1px solid #ffffff0c" : "none" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", color: "var(--text)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>{actTopicLabel(w.e, lang)}</div>
                <div style={{ fontSize: "10px", color: "#ff5252", fontFamily: "'Share Tech Mono',monospace" }}>{Math.round(w.rate * 100)}% miss · {w.ok + w.miss} n</div>
              </div>
              {song && <button className="tdgo" onClick={() => { playUi("click"); onSong(song); }}>{T.weakGo}</button>}
            </div>
          );
        })}
      </div>
      {bestHour != null && (
        <div className="v12card" style={{ textAlign: "center" }}>
          <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", marginBottom: "5px" }}>⏰ {T.hour}</div>
          <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: "19px", color: "#d97757", fontWeight: 900 }}>{String(bestHour).padStart(2, "0")}:00 – {String((bestHour + 1) % 24).padStart(2, "0")}:00</div>
        </div>
      )}
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   REPORT CARD — a weekly parent-friendly summary with a written
   teacher's comment, plus downloadable certificates per finished
   Pathway chapter and a shareable weekly PNG.
════════════════════════════════════════════════════════════ */
const ReportPage = memo(function ReportPage({ lang, profile, onBack }) {
  const T = {
    th: { title: "สมุดพก", sub: "สรุปผลการเรียนรายสัปดาห์ + ใบประกาศนียบัตร — บันทึกเป็นรูปส่งให้ผู้ปกครองหรือแชร์ได้เลย", week: "สัปดาห์นี้ (7 วันล่าสุด)", mins: "นาที", days: "วัน", accL: "แม่นยำ", topicsL: "หัวข้อ", gamesL: "เกม", comment: "คำติชมจากครู TiGA", certs: "ใบประกาศนียบัตร", certGet: "⬇ บันทึกใบประกาศ", certLock: "เรียนให้ครบทุกหัวข้อในหมวดนี้", share: "⬇ บันทึกสมุดพกเป็นรูป", making: "กำลังสร้างรูป…", student: "นักเรียน TiGA" },
    en: { title: "Report Card", sub: "A weekly summary with a teacher's comment + downloadable certificates — save as an image for parents or sharing", week: "This week (last 7 days)", mins: "min", days: "days", accL: "accuracy", topicsL: "topics", gamesL: "games", comment: "Teacher TiGA's comment", certs: "Certificates", certGet: "⬇ Save certificate", certLock: "Finish every topic in this chapter", share: "⬇ Save report as image", making: "Rendering…", student: "TiGA Student" },
    zh: { title: "成绩单", sub: "每周学习总结 + 老师评语 + 可下载证书 — 保存成图片给家长或分享", week: "本周（近7天）", mins: "分钟", days: "天", accL: "准确率", topicsL: "主题", gamesL: "游戏", comment: "TiGA 老师评语", certs: "证书", certGet: "⬇ 保存证书", certLock: "完成本章全部主题", share: "⬇ 保存成绩单图片", making: "生成中…", student: "TiGA 学员" },
  }[lang];
  const [busy, setBusy] = useState(false);
  const log = readActLog();
  const now = Date.now();
  const dayMs = 86400000;
  function stat(from, to) {
    let sec = 0, ok = 0, miss = 0, games = 0;
    const days = new Set(), topics = new Set();
    for (const e of log) {
      if (e.t < from || e.t >= to) continue;
      sec += e.sec; ok += e.ok; miss += e.miss;
      if (e.sec > 0) days.add(e.d);
      if (e.k === "game") games++;
      if (e.k === "lesson" || e.k === "read-chapter") topics.add(e.id.split("/")[0]);
    }
    return { min: Math.round(sec / 60), days: days.size, ok, miss, acc: ok + miss > 0 ? Math.round(ok / (ok + miss) * 100) : null, topics: topics.size, games };
  }
  const a = stat(now - 7 * dayMs, now + 1), b = stat(now - 14 * dayMs, now - 7 * dayMs);
  // teacher's written comment — honest, data-driven, template-based (no AI cost)
  let comment;
  if (a.min === 0) {
    comment = lang === "th" ? "สัปดาห์นี้ยังไม่ได้เริ่มซ้อมเลยครับ ไม่เป็นไรเลย — เริ่มใหม่วันนี้ที่หน้า 'ซ้อมวันนี้' แค่วันละ 15 นาที เดี๋ยวสัปดาห์หน้าสมุดพกหน้านี้จะสวยขึ้นแน่นอนครับ"
      : lang === "zh" ? "这周还没开始练习也没关系 — 今天就从「今日练习」开始，每天15分钟，下周的成绩单一定会更漂亮。"
      : "No practice yet this week — that's okay! Start today with 'Practice Today', just 15 minutes a day, and next week's report will look very different.";
  } else {
    const p1 = lang === "th" ? `สัปดาห์นี้ซ้อม ${a.days} วัน รวม ${a.min} นาที` : lang === "zh" ? `本周练习 ${a.days} 天，共 ${a.min} 分钟` : `Practiced ${a.days} day(s) this week, ${a.min} minutes total`;
    let p2 = "";
    if (a.acc != null && b.acc != null) {
      const d = a.acc - b.acc;
      p2 = d >= 0
        ? (lang === "th" ? ` ความแม่นยำ ${a.acc}% ${d > 0 ? `ดีขึ้น +${d}% จากสัปดาห์ก่อน` : "คงที่"} — เยี่ยมมากครับ` : lang === "zh" ? ` 准确率 ${a.acc}%${d > 0 ? `，比上周提升 ${d}%` : "，保持稳定"} — 非常棒` : ` — accuracy ${a.acc}%${d > 0 ? `, up ${d}% from last week` : ", holding steady"} — excellent`)
        : (lang === "th" ? ` ความแม่นยำ ${a.acc}% ลดลงนิดหน่อย ไม่ต้องกังวลครับ ลองซ้อมช้าลงอีกนิดแล้วค่อยเร่ง` : lang === "zh" ? ` 准确率 ${a.acc}%，略有下降，别担心 — 先放慢再加速` : ` — accuracy ${a.acc}%, a little dip; slow the tempo down first, then speed up`);
    } else if (a.acc != null) {
      p2 = lang === "th" ? ` ความแม่นยำ ${a.acc}%` : lang === "zh" ? ` 准确率 ${a.acc}%` : ` — accuracy ${a.acc}%`;
    }
    const p3 = a.topics > 0
      ? (lang === "th" ? ` และได้เรียน ${a.topics} หัวข้อใหม่ รักษาจังหวะนี้ไว้นะครับ 💪` : lang === "zh" ? `，学习了 ${a.topics} 个主题。保持这个节奏！💪` : `, and covered ${a.topics} topic(s). Keep this rhythm going! 💪`)
      : (lang === "th" ? ` สัปดาห์หน้าลองเปิดหัวข้อใหม่ใน Pathway สักเรื่องนะครับ 💪` : lang === "zh" ? `。下周试着在学习之路开一个新主题吧！💪` : `. Next week, try opening one new Pathway topic! 💪`);
    comment = p1 + p2 + p3;
  }
  // 7-day minute bars — boundary must match dayKey()/dayDate() (currently UTC),
  // not device-local midnight, or these bars disagree with the "days" stat above
  const _n0 = new Date();
  const t0 = Date.UTC(_n0.getUTCFullYear(), _n0.getUTCMonth(), _n0.getUTCDate());
  const start7 = t0 - 6 * dayMs;
  const mins7 = Array(7).fill(0);
  for (const e of log) { const di = Math.floor((e.t - start7) / dayMs); if (di >= 0 && di < 7) mins7[di] += e.sec; }
  const maxM = Math.max(60, ...mins7);
  const WD = { th: ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"], en: ["S", "M", "T", "W", "T", "F", "S"], zh: ["日", "一", "二", "三", "四", "五", "六"] }[lang];
  const doneP = pathDoneSet();
  const name = (profile && profile.full_name) || T.student;
  async function saveWeekly() {
    if (busy) return; setBusy(true); playUi("click");
    try {
      const url = await renderWeeklyPNG({ name, mins: a.min, days: a.days, acc: a.acc, topics: a.topics, streak: (profile && profile.streak) || 0, lang });
      downloadDataURL(url, "tiga-weekly-report.png");
    } catch (e) {}
    setBusy(false);
  }
  async function saveCert(g) {
    if (busy) return; setBusy(true); playUi("reward");
    try {
      const url = await renderCertificatePNG({ name, course: g.icon + " " + g.label, dateStr: new Date().toLocaleDateString(lang === "th" ? "th-TH" : lang === "zh" ? "zh-CN" : "en-GB", { year: "numeric", month: "long", day: "numeric" }), lang });
      downloadDataURL(url, "tiga-certificate-" + g.id + ".png");
    } catch (e) {}
    setBusy(false);
  }
  return (
    <div className="pathpage">
      {onBack && (
        <button onClick={() => { playUi("click"); onBack(); }}
          style={{ margin: "12px 2px 0", background: "none", border: "1px solid var(--bd4)", borderRadius: "8px", color: "#a88b9b", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>
          ← {L[lang].navProfile}
        </button>
      )}
      <div className="v12hero"><div className="v12title">🏅 {T.title}</div><div className="v12sub">{T.sub}</div></div>
      <div className="v12card">
        <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", marginBottom: "8px" }}>{T.week}</div>
        <div style={{ display: "flex", gap: "7px", marginBottom: "12px" }}>
          <div className="instile"><b>{a.min}</b><span>{T.mins}</span></div>
          <div className="instile"><b>{a.days}/7</b><span>{T.days}</span></div>
          <div className="instile"><b>{a.acc == null ? "—" : a.acc + "%"}</b><span>{T.accL}</span></div>
          <div className="instile"><b>{a.topics}</b><span>{T.topicsL}</span></div>
          <div className="instile"><b>{a.games}</b><span>{T.gamesL}</span></div>
        </div>
        <div className="insbarwrap" style={{ height: "64px" }}>
          {mins7.map((m, i) => <div key={i} className="insbar" style={{ height: Math.max(3, Math.round(m / maxM * 88)) + "%", opacity: m > 0 ? 1 : 0.25 }} />)}
        </div>
        <div style={{ display: "flex", gap: "4px" }}>
          {mins7.map((_, i) => { const d = new Date(start7 + i * dayMs); return <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "8.5px", color: "#826575", fontFamily: "'Share Tech Mono',monospace" }}>{WD[d.getUTCDay()]}</div>; })}
        </div>
      </div>
      <div className="v12card" style={{ borderColor: "#d9775744" }}>
        <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", marginBottom: "7px" }}>💬 {T.comment}</div>
        <div style={{ fontSize: "13.5px", color: "var(--text)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, lineHeight: 1.65 }}>{comment}</div>
      </div>
      <button className="tdgo" disabled={busy} onClick={saveWeekly} style={{ width: "100%", padding: "13px", fontSize: "11.5px", marginBottom: "16px" }}>{busy ? T.making : T.share}</button>
      <div style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace", margin: "2px 2px 9px" }}>🎓 {T.certs}</div>
      {PATH_GROUPS[lang].map(g => {
        const stages = STAGES_BY_GROUP[g.id] || [];
        const done = stages.filter(s => doneP.has(s.id)).length;
        const earned = stages.length > 0 && done === stages.length;
        return (
          <div key={g.id} className={`certrow${earned ? " earned" : ""}`}>
            <span style={{ fontSize: "22px" }}>{earned ? "🏆" : g.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "13.5px", color: earned ? "#d97757" : "var(--text2)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700 }}>{g.label}</div>
              <div style={{ fontSize: "10px", color: "var(--muted)", fontFamily: "'Share Tech Mono',monospace" }}>{done}/{stages.length}{earned ? "" : " · " + T.certLock}</div>
            </div>
            {earned && <button className="tdgo" style={{ borderColor: "#d97757", color: "#d97757", background: "rgba(217,119,87,.08)" }} disabled={busy} onClick={() => saveCert(g)}>{busy ? T.making : T.certGet}</button>}
          </div>
        );
      })}
    </div>
  );
});

/* ── Profile / Gamification page — avatar, level, EXP bar, stats & rank ladder ── */
/* ── Studio hub: choose Play-Along / Sight-Reading / Hand Coach ── */

const StudioPage = memo(function StudioPage({ lang, onVoice, onSongs, onSight, onCamera, onExam, onEarGym, onReading, onToday, voiceLocked = false, plan = "", premium = false, freezeCount = 0, onAiReport, onAiPlan, onAnalytics, onUpsell, onRequireLogin, onPlay = null, onParent = null,
  detectOpen = false, setDetectOpen, detectNotes = [], setDetectNotes, detectMatch = null, setDetectMatch, detectListening = false, setDetectListening,
  battlePickOpen = false, setBattlePickOpen, battleData = null, setBattleData, songPhase = "ready", startSongPlay,
  mysteryChest = null, setMysteryChest, luckyToast = null, onSchoolJoined = null }) {
  const lc = L[lang];
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const isMax = isMaxPlan(plan);

  // B3: Quick 3-min modal
  const [quickOpen, setQuickOpen] = useState(false);
  // B5: Warmup banner
  const [warmupDone, setWarmupDone] = useState(() => readStreak().last === dayKey());
  // E2: Commute Mode (audio theory lessons via SpeechSynthesis)
  const [commuteOpen, setCommuteOpen] = useState(false);
  const [commutePlaying, setCommutePlaying] = useState(false);
  const [commuteIdx, setCommuteIdx] = useState<number|null>(null);
  // C4+F4: Kru/Teacher Mode
  const [kruOpen, setKruOpen] = useState(false);
  const [kruTab, setKruTab] = useState<"class"|"code"|"enter">("class");
  const [kruStudents, setKruStudents] = useState<any[]>(() => { try { return JSON.parse(localStorage.getItem("tg_kru") || "[]"); } catch { return []; } });
  const [kruNewName, setKruNewName] = useState("");
  const [kruCodeSong, setKruCodeSong] = useState("");
  const [kruInputCode, setKruInputCode] = useState("");
  const [kruMsg, setKruMsg] = useState("");
  const [kruGenResult, setKruGenResult] = useState("");
  // D4: Chord Mood Board
  const [moodBoardOpen, setMoodBoardOpen] = useState(false);
  const [activeMood, setActiveMood] = useState(null);
  const [playingChord, setPlayingChord] = useState(null);
  // E3: Mood-based session
  const [moodOpen, setMoodOpen] = useState(false);
  const [moodTime, setMoodTime] = useState(null);
  const [moodFeel, setMoodFeel] = useState(null);
  // E4: Event countdown
  const [eventOpen, setEventOpen] = useState(false);
  const [eventData, setEventData] = useState(() => { try { return JSON.parse(localStorage.getItem("tg_event") || "null"); } catch (_) { return null; } });
  const [evName, setEvName] = useState("");
  const [evDate, setEvDate] = useState("");

  // Days until event
  const eventDaysLeft = eventData ? Math.max(0, Math.ceil((new Date(eventData.date).getTime() - Date.now()) / 86400000)) : null;

  function saveEvent() {
    if (!evName.trim() || !evDate) return;
    const d = { name: evName.trim(), date: evDate };
    setEventData(d); try { localStorage.setItem("tg_event", JSON.stringify(d)); } catch (_) {}
    setEventOpen(false);
  }
  function clearEvent() {
    setEventData(null); try { localStorage.removeItem("tg_event"); } catch (_) {}
    setEventOpen(false);
  }

  function playChord(notesCsv) {
    const notes = notesCsv.split(",").map(n => n.trim());
    notes.forEach((n, i) => setTimeout(() => playPianoNote(n, 1.2), i * 60));
  }

  // E2: Commute Mode — pre-written audio theory lessons
  const COMMUTE_LESSONS = lang === "th" ? [
    { title: "คอร์ด Major คืออะไร?", text: "คอร์ด Major คือกลุ่มโน้ต 3 ตัวที่เล่นพร้อมกัน ประกอบด้วย Root, Third, และ Fifth ตัวอย่างเช่น คอร์ด C Major ใช้โน้ต C, E, G เสียงของคอร์ด Major จะดูสดใส มีพลัง คุณสามารถสร้างคอร์ด Major ได้ทุก key โดยนับ 4 ครึ่งเสียง แล้วนับอีก 3 ครึ่งเสียง" },
    { title: "ไมเนอร์ vs เมเจอร์", text: "คอร์ด Minor ฟังดูเศร้ากว่า Major เพราะ Third ถูกลดลง 1 ครึ่งเสียง ตัวอย่าง C Minor ใช้ C, อีแฟลต, G แทน C, E, G ความแตกต่างแค่ครึ่งเสียงเดียว แต่อารมณ์เพลงเปลี่ยนไปมาก เพลงแฮปปี้มักใช้เมเจอร์ เพลงอารมณ์ลึกใช้ไมเนอร์" },
    { title: "Octave คืออะไร?", text: "Octave คือระยะห่างระหว่างโน้ตที่ชื่อเดียวกัน เช่น C ตัวล่างกับ C ตัวบน มีระยะห่าง 12 ครึ่งเสียง โน้ตที่ห่างกัน 1 Octave มีเสียงเหมือนกันแต่ระดับต่างกัน นี่คือพื้นฐานที่สำคัญที่สุดในดนตรีสากล" },
    { title: "Circle of Fifths", text: "Circle of Fifths คือแผนที่ของ 12 keys ในดนตรี เรียงตาม Fifth ขึ้นไป คือ C G D A E B keys ที่อยู่ใกล้กันใน Circle มักฟังดูดีด้วยกัน และการเปลี่ยน key ระหว่างกันฟังดูลื่นไหลเป็นธรรมชาติ" },
    { title: "จังหวะ 4/4", text: "จังหวะ 4 ต่อ 4 คือจังหวะที่พบบ่อยที่สุดในเพลงสมัยใหม่ นับ 1 2 3 4 แต่ละห้องมี 4 beat โน้ต Quarter note เท่ากับ 1 beat Half note เท่ากับ 2 beat Whole note เท่ากับ 4 beat ลองฝึกนับจังหวะขณะฟังเพลงที่คุณชอบ" },
  ] : lang === "zh" ? [
    { title: "什么是大调和弦", text: "大调和弦由三个音组成：根音、大三度和纯五度。以C大调为例：C、E、G。听起来明亮积极。你可以在任何调上建立大调和弦：向上数4个半音，再数3个半音。" },
    { title: "小调与大调的区别", text: "小调和弦听起来比大调更忧郁，因为三度音降低了半个音。C小调是C、降E、G，而不是C、E、G。只差半音，情绪却截然不同。欢快的歌曲用大调，深情的歌曲用小调。" },
    { title: "什么是八度", text: "八度是两个同名音之间的距离，比如低C和高C。相距12个半音。相差一个八度的音听起来相似，只是高低不同。这是音乐中最基础的音程。" },
    { title: "五度圈", text: "五度圈将12个调按五度顺序排列成圆形：C、G、D、A、E、B。相邻的调共享很多音符和和弦，听起来很和谐，转调时也很流畅。" },
    { title: "拍号", text: "四四拍是流行音乐中最常见的拍号。每小节数一二三四。四分音符占一拍，二分音符占两拍，全音符占四拍。试着跟着喜欢的歌曲打拍子。" },
  ] : [
    { title: "What is a Major Chord?", text: "A major chord has three notes: the root, the major third, and the perfect fifth. Take C major: C, E, G. The sound is bright and positive. You can build it in any key by going up 4 half-steps, then 3 more." },
    { title: "Minor vs Major", text: "A minor chord sounds sadder because the third is lowered by one half step. C minor is C, E-flat, G instead of C, E, G. Just one half step changes the whole mood. Happy songs use major; emotional songs use minor." },
    { title: "What is an Octave?", text: "An octave is the distance between two notes with the same letter name, like low C and high C. It spans 12 half steps. Notes an octave apart sound similar but at different pitches. This is the most fundamental interval in music." },
    { title: "The Circle of Fifths", text: "The circle of fifths maps all 12 keys in a circle, each step being a fifth apart: C, G, D, A, E, B. Keys next to each other share many notes and chords, so they sound great together. Modulating between neighbors always sounds smooth." },
    { title: "Time Signatures", text: "Four-four time is the most common in popular music. Count one, two, three, four per measure. A quarter note gets one beat, a half note gets two, and a whole note fills all four beats. Try counting along to any song you like." },
  ];

  function speakLesson(idx: number) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const lesson = COMMUTE_LESSONS[idx];
    if (!lesson) return;
    setCommuteIdx(idx);
    const utt = new SpeechSynthesisUtterance(lesson.title + ". " + lesson.text);
    utt.lang = lang === "th" ? "th-TH" : lang === "zh" ? "zh-CN" : "en-US";
    utt.rate = 0.9;
    utt.onend = () => setCommutePlaying(false);
    utt.onerror = () => setCommutePlaying(false);
    setCommutePlaying(true);
    window.speechSynthesis.speak(utt);
  }
  function stopSpeaking() {
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setCommutePlaying(false);
  }

  // C4+F4: Kru/Teacher Mode helpers
  function kruSave(arr: any[]) {
    setKruStudents(arr);
    try { localStorage.setItem("tg_kru", JSON.stringify(arr)); } catch {}
  }
  function kruAddStudent() {
    if (!kruNewName.trim()) return;
    kruSave([...kruStudents, { name: kruNewName.trim(), songId: "", done: false }]);
    setKruNewName("");
  }
  function kruSetSong(idx: number, songId: string) {
    const arr = kruStudents.map((s, i) => i === idx ? { ...s, songId } : s);
    kruSave(arr);
  }
  function kruToggleDone(idx: number) {
    const arr = kruStudents.map((s, i) => i === idx ? { ...s, done: !s.done } : s);
    kruSave(arr);
  }
  function kruRemove(idx: number) {
    kruSave(kruStudents.filter((_, i) => i !== idx));
  }
  function kruMakeCode(songId: string): string {
    try { return btoa(JSON.stringify({ v: 1, t: "song", id: songId })); } catch { return ""; }
  }
  async function kruUseCode(code: string) {
    setKruMsg("");
    const raw = code.trim();
    try {
      const obj = JSON.parse(atob(raw));
      if (obj.t === "song") {
        const s = SONGS.find((x: any) => x.id === obj.id);
        if (s) { setKruOpen(false); onPlay && onPlay(s); return; }
      }
    } catch {}
    // Not a song-assignment code — try it as a real school join code (School Plan Pro).
    const { data, error } = await sb.rpc("school_join", { p_code: raw });
    if (error) { setKruMsg(T("โค้ดไม่ถูกต้อง", "Invalid code", "无效码")); return; }
    setKruOpen(false);
    onSchoolJoined && onSchoolJoined(data);
  }

  // B1: SRS — how many topics are due for review
  const [dueSRS] = useState(() => getDueSRS());
  const [srsOpen, setSrsOpen] = useState(false);

  // A2: Goal Planner
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalData, setGoalData] = useState<any>(() => { try { return JSON.parse(localStorage.getItem("tg_goal") || "null"); } catch (_) { return null; } });
  const [goalSongId, setGoalSongId] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const goalDaysLeft = goalData ? Math.max(0, Math.ceil((new Date(goalData.date).getTime() - Date.now()) / 86400000)) : null;

  function buildGoalPlan(song, days) {
    const d = song ? song.diff : 1;
    const steps: string[][] = [];
    if (d === 1) {
      steps.push([T("ฟังเพลงและจำทำนอง", "Listen & memorize the melody", "聆听并记住旋律")]);
      steps.push([T("ฝึกมือขวาช้าๆ ทีละวลี", "Practice right hand slowly, phrase by phrase", "慢速逐句练右手")]);
      steps.push([T("เล่นให้ครบ ค่อยๆ เร่งความเร็ว", "Play through — gradually increase tempo", "完整演奏，逐步提速")]);
    } else if (d === 2) {
      steps.push([T("ฟัง + ดูโน้ตทั้งเพลง", "Listen + study the full score", "聆听 + 学习全谱")]);
      steps.push([T("ฝึกมือขวา ท่อนที่ 1", "Right hand — first section", "右手 — 第一段")]);
      steps.push([T("ฝึกมือขวา ท่อนที่ 2", "Right hand — second section", "右手 — 第二段")]);
      steps.push([T("ทบทวนมือขวาทั้งเพลง", "Full right-hand run-through", "右手全曲复习")]);
      steps.push([T("เพิ่มความเร็ว + ฝึกซ้ำจุดยาก", "Speed up + loop the hard parts", "提速 + 反复练难点")]);
    } else {
      steps.push([T("ฟัง + แบ่งเพลงเป็นท่อนย่อย", "Listen + break the piece into sections", "聆听 + 分段分析")]);
      steps.push([T("ฝึกมือขวา ท่อน A (ช้า)", "Right hand section A (slow)", "右手A段（慢速）")]);
      steps.push([T("ฝึกมือซ้าย ท่อน A (ช้า)", "Left hand section A (slow)", "左手A段（慢速）")]);
      steps.push([T("รวมสองมือ ท่อน A", "Hands together — section A", "双手合奏A段")]);
      steps.push([T("ฝึกมือขวา ท่อน B (ช้า)", "Right hand section B (slow)", "右手B段（慢速）")]);
      steps.push([T("ฝึกมือซ้าย ท่อน B (ช้า)", "Left hand section B (slow)", "左手B段（慢速）")]);
      steps.push([T("รวมสองมือ ท่อน B", "Hands together — section B", "双手合奏B段")]);
      steps.push([T("เล่นทั้งเพลงช้าๆ ให้ไหล", "Full piece slowly — aim for flow", "全曲慢速 — 追求流畅")]);
      steps.push([T("เพิ่มความเร็วทีละน้อย", "Gradually bring up the tempo", "逐步提速")]);
      steps.push([T("เล่นเต็มความเร็ว ทำให้แม่น", "Full tempo — aim for accuracy", "全速演奏 — 追求准确")]);
    }
    // Distribute across days
    const plan: string[] = [];
    const totalSteps = steps.length;
    for (let i = 0; i < Math.min(days, totalSteps); i++) {
      plan.push(steps[i][0]);
    }
    return plan;
  }

  function saveGoal() {
    const song = SONGS.find(s => s.id === goalSongId);
    if (!song || !goalDate) return;
    const days = Math.max(1, Math.ceil((new Date(goalDate).getTime() - Date.now()) / 86400000));
    const plan = buildGoalPlan(song, days);
    const d = { songId: song.id, songName: lang === "th" ? song.th : lang === "zh" ? song.zh : song.en, date: goalDate, plan, days };
    setGoalData(d);
    try { localStorage.setItem("tg_goal", JSON.stringify(d)); } catch (_) {}
    setGoalOpen(false);
  }
  function clearGoal() {
    setGoalData(null);
    try { localStorage.removeItem("tg_goal"); } catch (_) {}
    setGoalOpen(false);
  }

  // F3: Thai Music Corner
  const [thaiOpen, setThaiOpen] = useState(false);

  // D3: AI Composition Starter
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMood, setComposeMood] = useState<string|null>(null);
  const [composeStyle, setComposeStyle] = useState<string|null>(null);
  const [composeKey, setComposeKey] = useState("C");
  const [composePage, setComposePage] = useState(1);
  const [composeLoading, setComposeLoading] = useState(false);
  const [composeErr, setComposeErr] = useState(false);

  async function composeGenerate() {
    if (!composeMood || !composeStyle || composeLoading) return;
    if (onRequireLogin && onRequireLogin()) return;
    if (!canUse("compose", premium)) { setComposeOpen(false); if (onUpsell) onUpsell(); return; }
    setComposeLoading(true); setComposeErr(false);
    try {
      const moods: Record<string,string> = { happy: "happy, bright, uplifting", sad: "melancholic, gentle, wistful", calm: "peaceful, serene, tranquil", energetic: "lively, energetic, playful" };
      const styles: Record<string,string> = { simple: "stepwise simple melody", flowing: "smooth flowing melody with a mix of quarter and half notes", rhythmic: "rhythmic melody with clear strong beats" };
      const moodDesc = moods[composeMood] || "pleasant";
      const styleDesc = styles[composeStyle] || "simple melody";
      const prompt = `Create a ${moodDesc} ${styleDesc} piano melody in ${composeKey} major, 24-32 notes, musical and satisfying for a beginner. The name should reflect the mood.`;
      const sys = "You turn a melody request into a simple one-hand beginner piano melody for a falling-notes game. Output ONLY valid minified JSON: {\"name\":string,\"bpm\":number,\"seq\":[[note,beats],...]}. Notes use scientific names C4-B5 only; \"R\"=rest; beats are 0.5,1,1.5,2. Keep it 24-32 notes, melodic and musical.";
      const acc = await streamChatCompletion({ message: prompt, conversationHistory: [], system: sys });
      const jm = acc.match(/\{[\s\S]*\}/); if (!jm) throw new Error("no json");
      const obj = JSON.parse(jm[0]);
      const seq = normalizeSeq(obj.seq || []);
      if (seq.length < 6 || !seq.some((x: any[]) => x[0] !== "R")) throw new Error("short");
      const name = String(obj.name || T("เพลงของฉัน", "My Melody", "我的旋律")).slice(0, 40);
      const bpm = Math.min(160, Math.max(60, Math.round(obj.bpm || 90)));
      const song = { id: "compose_" + Date.now(), diff: 1, bpm, custom: true, th: name, en: name, zh: name, seq };
      if (!premium) bumpUsage("compose");
      setComposeOpen(false);
      setComposeMood(null); setComposeStyle(null); setComposeKey("C"); setComposePage(1);
      if (onPlay) onPlay(song);
    } catch (e) { setComposeErr(true); }
    setComposeLoading(false);
  }

  // Quick 3-min: pick 3 shortest songs (fewest notes × BPM = fastest to play)
  const quickSongs = [...SONGS].filter(s => !s.maxOnly)
    .sort((a, b) => (a.seq.length / a.bpm) - (b.seq.length / b.bpm)).slice(0, 3);

  // Warmup: first diff-1 song
  const warmupSong = SONGS.find(s => s.diff === 1 && s.id === "scale") || SONGS[0];

  function handleMoodGo() {
    setMoodOpen(false);
    if (!moodFeel) { onToday && onToday(); return; }
    if (moodFeel === "learn") { onToday && onToday(); }
    else if (moodFeel === "play") {
      if (!moodTime || moodTime === "long") { onSongs && onSongs(); }
      else { setQuickOpen(true); }
    } else { onEarGym && onEarGym(); }
  }

  const cards = [
    // AI Voice Tutor — mobile app only (native STT; no reliable Web Speech API
    // inside a Capacitor WebView). Always shown with the MAX badge rather than
    // hidden for non-Max users: tapping it while locked opens the upgrade
    // prompt instead of the session (see onVoice's own gate where it's passed in).
    ...(isNative ? [{ k: "voice", ic: "🎙️", c: "#d97757", t: lc.studioVoice, s: lc.studioVoiceSub, fn: onVoice, badge: "👑 MAX" }] : []),
    { k: "today",   ic: "📅", c: "#d97757", t: lc.navToday,        s: T("แผนซ้อมวันนี้ — สร้างใหม่ทุกวันจากความคืบหน้าจริง", "Today's plan — rebuilt daily from your real progress", "今日计划 — 每天根据真实进度生成"), fn: onToday },
    { k: "songs",   ic: "🎵", c: "#d97757", t: lc.studioPlayAlong, s: lc.studioPlayAlongSub, fn: onSongs },
    { k: "quick",   ic: "⚡", c: "#d97757", t: lc.quickTitle,       s: lc.quickSub,          fn: () => { playUi("click"); setQuickOpen(true); } },
    { k: "eargym",  ic: "👂", c: "#ff76d8", t: lc.navEar,          s: lc.studioEarSub,       fn: onEarGym },
    { k: "reading", ic: "🎼", c: "#ff94e0", t: lc.navRead,         s: lc.studioReadSub,      fn: onReading },
    { k: "exam",    ic: "🎓", c: "#d97757", t: lc.studioExam,      s: lc.studioExamSub,      fn: onExam, badge: "PRO" },
    { k: "sight",   ic: "📄", c: "#d97757", t: lc.studioSight,     s: lc.studioSightSub,     fn: onSight },
    { k: "camera",  ic: "✋", c: "#d97757", t: lc.studioCamera,    s: lc.studioCameraSub,    fn: onCamera },
    { k: "chordmood",ic:"🎭", c: "#d97757", t: lc.moodBoard,       s: lc.moodBoardSub,       fn: () => { playUi("click"); setMoodBoardOpen(true); } },
    { k: "moodpick",ic: "🧭", c: "#d97757", t: lc.moodTitle,       s: T("เลือกเวลา+อารมณ์ → AI แนะนำกิจกรรม", "Pick time & mood → get the right activity", "按时间和心情推荐练习"), fn: () => { playUi("click"); setMoodTime(null); setMoodFeel(null); setMoodOpen(true); } },
    { k: "goal",    ic: "🎯", c: "#d97757", t: lc.goalTitle,        s: goalData ? T(`เพลง: ${goalData.songName} — เหลือ ${goalDaysLeft} วัน`, `Goal: "${goalData.songName}" — ${goalDaysLeft} days left`, `目标："${goalData.songName}" — 剩${goalDaysLeft}天`) : lc.goalSub, fn: () => { playUi("click"); setGoalSongId(goalData ? goalData.songId : ""); setGoalDate(goalData ? goalData.date : ""); setGoalOpen(true); } },
    { k: "srs",     ic: "🧠", c: dueSRS.length ? "#e55" : "#d97757", t: lc.srsTitle, s: dueSRS.length ? `${dueSRS.length} ${lc.srsItems} — ${lc.srsDue}` : lc.srsNone, fn: () => { playUi("click"); setSrsOpen(true); } },
    { k: "thai",    ic: "🇹🇭", c: "#d97757", t: lc.thaiTitle,       s: lc.thaiSub,             fn: () => { playUi("click"); setThaiOpen(true); } },
    { k: "compose", ic: "🎼", c: "#d97757", t: lc.composeTitle,     s: lc.composeSub,           fn: () => { playUi("click"); setComposeMood(null); setComposeStyle(null); setComposeKey("C"); setComposePage(1); setComposeErr(false); setComposeOpen(true); } },
    { k: "event",   ic: "🎪", c: eventData && eventDaysLeft !== null && eventDaysLeft <= 7 ? "#e55" : "#d97757",
      t: lc.eventTitle,
      s: eventData
          ? (eventDaysLeft !== null && eventDaysLeft <= 0 ? T("ผ่านมาแล้ว 🎉", "Event passed 🎉", "演出已结束 🎉") : `${eventData.name} — ${eventDaysLeft} ${lc.eventDays}`)
          : lc.eventSet,
      fn: () => { playUi("click"); setEvName(eventData ? eventData.name : ""); setEvDate(eventData ? eventData.date : ""); setEventOpen(true); } },
    { k: "detect",  ic: "🔍", c: "#d97757", t: T("ทายเพลงจากการเล่น", "Song Detector", "猜歌"), s: T("เล่นโน้ตสักไม่กี่ตัว — AI ทายชื่อเพลง", "Play a few notes — AI names the song", "弹几个音符 — AI 猜出歌名"), fn: () => { playUi("click"); setDetectNotes([]); setDetectMatch(null); setDetectListening(false); setDetectOpen(true); } },
    { k: "battle",  ic: "⚔️", c: "#d97757", t: T("Family Battle 👨‍👩‍👧", "Family Battle", "家庭对战"), s: T("ผลัดกันเล่นเพลงเดียวกัน — ดูว่าใครชนะ!", "Take turns playing the same song — see who wins!", "轮流弹同一首歌 — 看谁赢!"), fn: () => { playUi("click"); setBattleData(null); setBattlePickOpen(true); } },
    { k: "commute", ic: "🎧", c: "#d97757", t: lc.commuteTitle, s: lc.commuteSub, fn: () => { playUi("click"); stopSpeaking(); setCommuteIdx(null); setCommuteOpen(true); } },
    { k: "parent",  ic: "👨‍👩‍👧", c: "#d97757", t: lc.pdTitle, s: T("ดูพัฒนาการและรายงานความก้าวหน้า", "Track your child's progress", "查看孩子进度报告"), fn: () => { playUi("click"); onParent ? onParent() : null; } },
    { k: "kru",     ic: "📋", c: "#d97757", t: lc.kruTitle, s: lc.kruSub, fn: () => { playUi("click"); setKruMsg(""); setKruGenResult(""); setKruTab("class"); setKruOpen(true); } },
  ];

  // Max-exclusive feature cards
  const maxCards = [
    { k: "ai-report", ic: "📋", t: T("รายงาน AI รายสัปดาห์", "AI Weekly Report", "AI 周进度报告"), s: T("วิเคราะห์พัฒนาการ 7 วันที่ผ่านมาโดย AI", "AI-generated progress analysis every 7 days", "AI 自动生成7天进度分析"), fn: () => { playUi("click"); isMax ? onAiReport && onAiReport() : onUpsell && onUpsell(); } },
    { k: "ai-plan",   ic: "🗓️", t: T("แผนซ้อมส่วนตัว 7 วัน", "AI Practice Plan", "AI 7日练习计划"),   s: T("AI สร้างตารางซ้อม 7 วันเฉพาะสำหรับคุณ", "Personalised 7-day schedule built by AI", "AI 为你量身定制7天练习表"), fn: () => { playUi("click"); isMax ? onAiPlan && onAiPlan() : onUpsell && onUpsell(); } },
    { k: "analytics", ic: "📊", t: T("แดชบอร์ดวิเคราะห์ขั้นสูง", "Learning Analytics", "学习数据分析"),    s: T("EXP, สตรีค, ทักษะ — กราฟเจาะลึกทุกด้าน", "Deep charts: EXP, streak, skill breakdown", "深度图表：EXP、连击、技能分布"), fn: () => { playUi("click"); isMax ? onAnalytics && onAnalytics() : onUpsell && onUpsell(); } },
    { k: "maxsongs",  ic: "👑", t: T("เพลง Max Exclusive", "Max Exclusive Songs", "Max 专属歌曲"),        s: T("เพลงพิเศษสงวนไว้สำหรับ Max เท่านั้น", "Premium songs reserved for Max members only", "仅 Max 会员专享的特选曲目"), fn: () => { playUi("click"); isMax ? onSongs && onSongs() : onUpsell && onUpsell(); } },
  ];

  return (
    <div className="pathpage songpage">
      {/* B5: Daily Warmup Banner */}
      {!warmupDone && (
        <div className="warmup-banner">
          <div className="warmup-banner-ic">🌅</div>
          <div className="warmup-banner-body">
            <div className="warmup-banner-title">{lc.warmupTitle}</div>
            <div className="warmup-banner-sub">{lc.warmupSub}</div>
          </div>
          <button className="warmup-banner-btn" onClick={() => { playUi("click"); setWarmupDone(true); if (onPlay) onPlay(warmupSong); }}>
            {lc.warmupStart}
          </button>
          <button className="warmup-banner-skip" onClick={() => { setWarmupDone(true); }}>{lc.warmupSkip}</button>
        </div>
      )}

      {/* E4: Event Countdown */}
      {eventData && eventDaysLeft !== null && (
        <div className="event-countdown" onClick={() => { playUi("click"); setEvName(eventData.name); setEvDate(eventData.date); setEventOpen(true); }}>
          <span className="event-ic">🎯</span>
          <span className="event-name">{eventData.name}</span>
          <span className="event-days">{eventDaysLeft > 0 ? `${eventDaysLeft} ${lc.eventDays}` : T("วันนี้!", "Today!", "今天!")}</span>
          {eventDaysLeft > 0 && <span className="event-hint">{lc.eventPractice} ~{Math.round(30 / Math.max(1, eventDaysLeft) * 60)} {lc.eventMin}</span>}
        </div>
      )}
      {!eventData && (
        <button className="event-set-btn" onClick={() => { playUi("click"); setEvName(""); setEvDate(""); setEventOpen(true); }}>
          🎯 {lc.eventSet}
        </button>
      )}

      <div className="pathhero">
        <div className="pathhero-glow" />
        <div className="pathbadge">▶ STUDIO ▶</div>
        <h1 className="pathh1">{lc.studioTitle}</h1>
        <p className="pathguide">{lc.studioSub}</p>
      </div>
      <div className="songgrid">
        {cards.map(c => (
          <button key={c.k} className="songcard" style={{ "--sc": c.c } as React.CSSProperties} onClick={c.fn}>
            <div className="songcard-ic">{c.ic}</div>
            <div className="songcard-body">
              <div className="songcard-nm">{c.t}{c.badge && <span className="songcard-badge">{c.badge}</span>}</div>
              <div className="songcard-meta"><span>{c.s}</span></div>
            </div>
            <span className="songcard-go">▶</span>
          </button>
        ))}
      </div>

      {/* ── Max Exclusive section ── */}
      <div className="studio-max-hdr">
        <span className="studio-max-badge">👑 MAX</span>
        <span>{T("ฟีเจอร์พิเศษเฉพาะ Max", "Max Exclusive Features", "Max 专属功能")}</span>
        {!isMax && <button className="studio-max-unlock" onClick={() => { playUi("click"); onUpsell && onUpsell(); }}>
          {T("อัปเกรด →", "Upgrade →", "升级 →")}
        </button>}
      </div>
      <div className="songgrid">
        {maxCards.map(c => (
          <button key={c.k} className={`songcard studio-max-card${isMax ? "" : " locked"}${c.active ? " active" : ""}`}
            style={{ "--sc": "#d97757" } as React.CSSProperties} onClick={c.fn}>
            <div className="songcard-ic" style={{ position: "relative" }}>
              {c.ic}
              {!isMax && <span className="max-lock-ico">🔒</span>}
            </div>
            <div className="songcard-body">
              <div className="songcard-nm">{c.t}</div>
              <div className="songcard-meta"><span>{c.s}</span></div>
            </div>
            <span className="songcard-go">{isMax ? (c.active ? "✓" : "▶") : "👑"}</span>
          </button>
        ))}
      </div>

      {/* B3: Quick 3-min Modal */}
      {quickOpen && (
        <div className="modal-ov" onClick={() => setQuickOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><span>⚡ {lc.quickTitle}</span><button className="modal-x" onClick={() => setQuickOpen(false)}>✕</button></div>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)" }}>{lc.quickSub}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {quickSongs.map(s => (
                <button key={s.id} className="songcard" style={{ "--sc": "#d97757" } as React.CSSProperties}
                  onClick={() => { setQuickOpen(false); if (onPlay) onPlay(s); }}>
                  <div className="songcard-ic">🎵</div>
                  <div className="songcard-body">
                    <div className="songcard-nm">{lang === "th" ? s.th : lang === "zh" ? s.zh : s.en}</div>
                    <div className="songcard-meta"><span>{"★".repeat(s.diff)}{"☆".repeat(3 - s.diff)}</span><span>{s.bpm} BPM</span><span>{s.seq.length} {T("โน้ต", "notes", "音符")}</span></div>
                  </div>
                  <span className="songcard-go">▶</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* E3: Mood Picker Modal */}
      {moodOpen && (
        <div className="modal-ov" onClick={() => setMoodOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><span>🧭 {lc.moodTitle}</span><button className="modal-x" onClick={() => setMoodOpen(false)}>✕</button></div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{lc.moodTimePick}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[["short", lc.moodShort], ["med", lc.moodMed], ["long", lc.moodLong]].map(([k, label]) => (
                  <button key={k} className={`filter-chip${moodTime === k ? " on" : ""}`} onClick={() => setMoodTime(k)}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{T("อยากทำอะไร?", "What do you feel like?", "你想做什么?")}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[["learn", lc.moodLearn], ["play", lc.moodPlay], ["fun", lc.moodFun]].map(([k, label]) => (
                  <button key={k} className={`filter-chip${moodFeel === k ? " on" : ""}`} onClick={() => setMoodFeel(k)}>{label}</button>
                ))}
              </div>
            </div>
            <button className="pricebtn active" style={{ width: "100%", marginTop: 4 }} onClick={handleMoodGo}>
              {T("ไปเลย →", "Let's go →", "出发 →")}
            </button>
          </div>
        </div>
      )}

      {/* D4: Chord Mood Board Modal */}
      {moodBoardOpen && (
        <div className="modal-ov" onClick={() => setMoodBoardOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><span>🎭 {lc.moodBoard}</span><button className="modal-x" onClick={() => setMoodBoardOpen(false)}>✕</button></div>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)" }}>{lc.moodBoardSub}</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {CHORD_MOODS.map((m, i) => (
                <button key={i} className={`filter-chip${activeMood === i ? " on" : ""}`}
                  style={{ fontSize: 15 }} onClick={() => { playUi("click"); setActiveMood(activeMood === i ? null : i); }}>
                  {m.emoji} {lang === "th" ? m.th : lang === "zh" ? m.zh : m.en}
                </button>
              ))}
            </div>
            {activeMood !== null && (
              <div className="chord-mood-panel">
                <div className="chord-mood-desc">{CHORD_MOODS[activeMood].desc[lang === "zh" ? "zh" : lang === "th" ? "th" : "en"]}</div>
                <div className="chord-mood-grid">
                  {CHORD_MOODS[activeMood].prog.map(([name, notes], ci) => (
                    <button key={ci} className={`chord-btn${playingChord === `${activeMood}-${ci}` ? " playing" : ""}`}
                      onClick={() => {
                        setPlayingChord(`${activeMood}-${ci}`);
                        playChord(notes);
                        setTimeout(() => setPlayingChord(null), 1200);
                      }}>
                      <span className="chord-btn-name">{name}</span>
                      <span className="chord-btn-play">▶</span>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                  {T("แตะคอร์ดเพื่อฟัง — ฝึกเล่นทีละคอร์ด", "Tap each chord to hear it — practice them one by one", "点击每个和弦试听 — 逐个练习")}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* E4: Event Goal Modal */}
      {eventOpen && (
        <div className="modal-ov" onClick={() => setEventOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><span>🎯 {lc.eventTitle}</span><button className="modal-x" onClick={() => setEventOpen(false)}>✕</button></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: "var(--muted)" }}>{lc.eventName}</label>
              <input className="chat-input" style={{ fontSize: 14, padding: "10px 14px" }}
                value={evName} onChange={e => setEvName(e.target.value)}
                placeholder={T("ชื่องาน / ชื่อเพลง", "Event name / song title", "活动名称 / 歌曲名")} />
              <label style={{ fontSize: 13, color: "var(--muted)" }}>{lc.eventDate}</label>
              <input type="date" className="chat-input" style={{ fontSize: 14, padding: "10px 14px" }}
                value={evDate} onChange={e => setEvDate(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="pricebtn active" style={{ flex: 1 }} onClick={saveEvent}>{lc.eventSet}</button>
              {eventData && <button className="pricebtn" style={{ flex: 1 }} onClick={clearEvent}>{lc.eventClear}</button>}
            </div>
          </div>
        </div>
      )}

      {/* A2: Song Goal Planner Modal */}
      {goalOpen && (
        <div className="modal-ov" onClick={() => setGoalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><span>🎯 {lc.goalTitle}</span><button className="modal-x" onClick={() => setGoalOpen(false)}>✕</button></div>
            {goalData ? (
              <div>
                <div className="goal-song-name">{goalData.songName}</div>
                <div className="goal-days-left">{goalDaysLeft} {lc.goalDays}</div>
                <div className="goal-plan-list">
                  {(goalData.plan || []).map((step, i) => (
                    <div key={i} className="goal-plan-step">
                      <span className="goal-step-num">{lc.goalDay} {i + 1}</span>
                      <span className="goal-step-txt">{step}</span>
                    </div>
                  ))}
                </div>
                <button className="pricebtn" style={{ width: "100%", marginTop: 12 }} onClick={clearGoal}>{lc.goalClear}</button>
              </div>
            ) : (
              <div>
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--muted)" }}>{lc.goalSub}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
                  <label style={{ fontSize: 13, color: "var(--muted)" }}>{lc.goalPick}</label>
                  <select className="chat-input" style={{ fontSize: 14, padding: "10px 14px" }}
                    value={goalSongId} onChange={e => setGoalSongId(e.target.value)}>
                    <option value="">{T("— เลือกเพลง —", "— Choose a song —", "— 选择歌曲 —")}</option>
                    {SONGS.filter(s => !s.maxOnly).map(s => (
                      <option key={s.id} value={s.id}>{lang === "th" ? s.th : lang === "zh" ? s.zh : s.en} {"★".repeat(s.diff)}</option>
                    ))}
                  </select>
                  <label style={{ fontSize: 13, color: "var(--muted)" }}>{lc.goalDate}</label>
                  <input type="date" className="chat-input" style={{ fontSize: 14, padding: "10px 14px" }}
                    value={goalDate} onChange={e => setGoalDate(e.target.value)} />
                </div>
                <button className="pricebtn active" style={{ width: "100%" }}
                  onClick={saveGoal} disabled={!goalSongId || !goalDate}>
                  {lc.goalCreate}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* B1: SRS Review Modal */}
      {srsOpen && (
        <div className="modal-ov" onClick={() => setSrsOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><span>🧠 {lc.srsTitle}</span><button className="modal-x" onClick={() => setSrsOpen(false)}>✕</button></div>
            {dueSRS.length === 0 ? (
              <p style={{ margin: "12px 0", fontSize: 14, color: "var(--muted)", textAlign: "center" }}>{lc.srsNone} ✅</p>
            ) : (
              <div>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--muted)" }}>{lc.srsSub}</p>
                <div className="srs-list">
                  {dueSRS.map((item: any) => {
                    const [sid, kid] = item.id.split("/");
                    const stage = (typeof PATHWAY !== "undefined" ? PATHWAY : []).find((s: any) => s.id === sid);
                    const label = stage ? `${tr(stage.title, lang)} · ${kid?.toUpperCase() || ""}` : item.id;
                    return (
                      <div key={item.id} className="srs-item">
                        <span className="srs-ic">🔄</span>
                        <span className="srs-label">{label}</span>
                        <span className="srs-count">×{item.count}</span>
                      </div>
                    );
                  })}
                </div>
                <button className="pricebtn active" style={{ width: "100%", marginTop: 14 }}
                  onClick={() => { setSrsOpen(false); onToday && onToday(); }}>
                  {T("ไปทบทวนเลย →", "Start Review →", "开始复习 →")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* D3: AI Composition Starter Modal */}
      {composeOpen && (
        <div className="modal-ov" onClick={() => !composeLoading && setComposeOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr">
              <span>🎼 {lc.composeTitle}</span>
              {!composeLoading && <button className="modal-x" onClick={() => setComposeOpen(false)}>✕</button>}
            </div>
            {!composeLoading ? (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{lc.composeMood}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(lc.composeMoods as string[]).map((m, i) => {
                      const keys = ["happy","sad","calm","energetic"];
                      return <button key={keys[i]} className={`filter-chip${composeMood === keys[i] ? " on" : ""}`} onClick={() => setComposeMood(keys[i])}>{m}</button>;
                    })}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{lc.composeStyle}</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(lc.composeStyles as string[]).map((s, i) => {
                      const keys = ["simple","flowing","rhythmic"];
                      return <button key={keys[i]} className={`filter-chip${composeStyle === keys[i] ? " on" : ""}`} onClick={() => setComposeStyle(keys[i])}>{s}</button>;
                    })}
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{lc.composeKeyLbl}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["C","G","F","D","Am","Dm"].map(k => (
                      <button key={k} className={`filter-chip${composeKey === k ? " on" : ""}`} onClick={() => setComposeKey(k)}>{k}</button>
                    ))}
                  </div>
                </div>
                {composeErr && <div style={{ fontSize: 13, color: "#e55", marginBottom: 10 }}>{lc.composeErrMsg}</div>}
                <button className="pricebtn active" style={{ width: "100%" }}
                  onClick={composeGenerate} disabled={!composeMood || !composeStyle}>
                  {lc.composeGen}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>🎼</div>
                <div style={{ fontSize: 14, color: "var(--muted)" }}>{lc.composeGenning}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* F3: Thai Music Corner Modal */}
      {thaiOpen && (
        <div className="modal-ov" onClick={() => setThaiOpen(false)}>
          <div className="modal-box" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="modal-hdr"><span>🇹🇭 {lc.thaiTitle}</span><button className="modal-x" onClick={() => setThaiOpen(false)}>✕</button></div>
            <div className="thai-cards">
              <div className="thai-card">
                <div className="thai-card-h">🎵 {T("เพนทาโทนิก = รากของดนตรีไทย", "Pentatonic = Root of Thai Music", "五声音阶 = 泰国音乐的根")}</div>
                <div className="thai-card-b">{T("สเกล C Major มี 7 โน้ต แต่ถ้าตัดโน้ต F และ B ออก เหลือ C D E G A — นี่คือเพนทาโทนิก ซึ่งเป็นรากฐานของ 'ดนตรีไทยเดิม' และเพลงหมอลำ ลองเล่น C D E G A บนเปียโนดู!", "C Major has 7 notes. Remove F and B → C D E G A = pentatonic scale. This is the foundation of Thai classical and Mor Lam music. Try playing C D E G A on your piano!", "C大调有7个音。去掉F和B → C D E G A = 五声音阶。这是泰国传统音乐和摩喃音乐的基础。试试在钢琴上弹C D E G A!")}</div>
                <button className="thai-play-btn" onClick={() => { ["C4","D4","E4","G4","A4"].forEach((n,i) => setTimeout(() => playPianoNote(n,1), i*300)); }}>▶ {T("ฟังเพนทาโทนิก", "Hear Pentatonic", "听五声音阶")}</button>
              </div>
              <div className="thai-card">
                <div className="thai-card-h">🎶 {T("คอร์ดในเพลงลูกทุ่ง", "Chords in Thai Country Music", "泰国乡村音乐的和弦")}</div>
                <div className="thai-card-b">{T("เพลงลูกทุ่งส่วนใหญ่ใช้ progression ง่ายๆ คือ I–IV–V (C–F–G) หรือ I–V–vi–IV (C–G–Am–F) เพลงอย่าง 'สาวนา' ใช้แนวนี้ — ถ้าคุณเล่น C F G C ได้ คุณก็เล่นเพลงลูกทุ่งได้แล้ว!", "Thai country (Luk Thung) songs mostly use I–IV–V (C–F–G) or I–V–vi–IV (C–G–Am–F). If you can play C–F–G–C, you can play Thai country music!", "泰国乡村音乐(ลูกทุ่ง)多用I–IV–V(C–F–G)或I–V–vi–IV(C–G–Am–F)进行。掌握C–F–G–C，你就能弹泰国乡村歌曲了!")}</div>
                <button className="thai-play-btn" onClick={() => { [["C4,E4,G4"],["F4,A4,C5"],["G4,B4,D5"],["C4,E4,G4"]].forEach((ch,i) => setTimeout(() => ch[0].split(",").forEach(n => playPianoNote(n,1)),i*700)); }}>▶ {T("ฟัง I–IV–V", "Hear I–IV–V", "听I–IV–V")}</button>
              </div>
              <div className="thai-card">
                <div className="thai-card-h">🥁 {T("จังหวะฉิ่ง (Thai Rhythm)", "Ching Rhythm (Thai Beat)", "铃鼓节拍")}</div>
                <div className="thai-card-b">{T("ดนตรีไทยใช้เครื่องตีจังหวะที่เรียกว่า 'ฉิ่ง' เป็นตัวนับจังหวะ — เสียง 'ฉิ่ง' (เปิด) = จังหวะเบา เสียง 'ฉับ' (ปิด) = จังหวะหนัก แตกต่างจากดนตรีตะวันตกที่ beat 1 คือหนักสุด การเข้าใจจังหวะฉิ่งช่วยให้เล่นดนตรีไทยได้อย่างเป็นธรรมชาติ", "Thai music uses the 'ching' (small cymbals) as a time-keeper. 'Ching' (open) = light beat; 'chap' (closed) = heavy beat. Unlike Western music where beat 1 is strongest. Understanding ching rhythm makes Thai music feel natural.", "泰国音乐用'叮'(小铜锣)计时。'叮'(开放)= 轻拍；'恰'(闭合)= 重拍。与西方音乐beat 1最强不同。了解叮节拍让泰国音乐演奏更自然。")}</div>
              </div>
              <div className="thai-card">
                <div className="thai-card-h">🎼 {T("เชื่อม 2 โลก", "Bridge Two Worlds", "连接两个世界")}</div>
                <div className="thai-card-b">{T("เพลงไทยสมัยใหม่อย่าง 'Bird Thongchai' หรือวง 'Bodyslam' ผสมผสานทั้งสอง — ใช้คอร์ดตะวันตก (I–IV–V) แต่ใส่ทำนองแบบไทย เมื่อคุณเรียน Major Scale และ Triad บน TiGA คุณกำลังสร้างรากฐานเพื่อเล่นได้ทั้งสองแบบ!", "Modern Thai artists like Bird Thongchai or Bodyslam blend both — using Western chord progressions (I–IV–V) with Thai-style melodies. When you learn Major Scales and Triads on TiGA, you're building the foundation to play in both worlds!", "像Bird Thongchai或Bodyslam这样的现代泰国艺术家融合了两者 — 使用西方和弦进行(I–IV–V)加泰式旋律。在TiGA学习大调音阶和三和弦，就是为演奏两个世界打基础！")}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* E5: Song Detector Modal */}
      {detectOpen && (
        <div className="practiceov" onClick={() => { stopPracticeListeners(); setDetectOpen(false); }}>
          <div className="practiceov-box" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="practicetitle">🔍 {T("ทายเพลงจากการเล่น", "Song Detector", "猜歌")}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
              {T("เล่นโน้ต 6–8 ตัวบนเปียโน/คีย์บอร์ด แล้ว AI จะทายว่าเป็นเพลงอะไร", "Play 6–8 notes on your piano/keyboard — AI will guess the song", "在钢琴上弹6-8个音 — AI 猜出歌名")}
            </div>
            {!detectListening && !detectMatch && (
              <button className="songbtn go" style={{ width: "100%" }} onClick={async () => {
                setDetectListening(true); setDetectNotes([]); setDetectMatch(null);
                const collected: string[] = []; let lastNote = "";
                await startMicListener((d: any) => {
                  if (!d.note || d.note === lastNote) return;
                  lastNote = d.note;
                  collected.push(d.note);
                  setDetectNotes([...collected]);
                  if (collected.length >= 8) {
                    stopPracticeListeners();
                    setDetectListening(false);
                    setDetectMatch(detectSongMatch(collected));
                  }
                }, () => {}, () => { setDetectListening(false); }, { mono: true });
              }}>🎤 {T("เริ่มฟัง", "Start Listening", "开始聆听")}</button>
            )}
            {detectListening && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, margin: "8px 0" }}>🎵 {detectNotes.map(n => n.replace(/\d/, "")).join(" ")}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{detectNotes.length}/8 {T("โน้ต", "notes", "音符")}</div>
                <button className="songbtn ghost" style={{ marginTop: 8 }} onClick={() => { stopPracticeListeners(); setDetectListening(false); }}>⏹ {T("หยุด", "Stop", "停止")}</button>
              </div>
            )}
            {detectMatch && detectMatch.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{T("น่าจะเป็น...", "This could be...", "可能是...")}</div>
                {detectMatch.map((m: any, i: number) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--bdr)" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{tr(m.song, lang)}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)" }}>{"★".repeat(Math.round(m.score / 4))}</div>
                    </div>
                    <button className="songbtn go" style={{ fontSize: 12, padding: "4px 10px" }}
                      onClick={() => { setDetectOpen(false); if (onPlay) onPlay(m.song); }}>▶ {T("เล่น", "Play", "弹")}</button>
                  </div>
                ))}
                <button className="songbtn ghost" style={{ width: "100%", marginTop: 10 }} onClick={() => { setDetectNotes([]); setDetectMatch(null); }}>
                  {T("ลองใหม่", "Try Again", "再试")}
                </button>
              </div>
            )}
            {detectMatch && detectMatch.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--muted)", padding: 16 }}>
                {T("ไม่พบเพลงที่ตรงกัน ลองเล่นใหม่", "No match found — try again", "未找到匹配 — 再试一次")}
              </div>
            )}
            <button className="practicex" onClick={() => { stopPracticeListeners(); setDetectOpen(false); }}>×</button>
          </div>
        </div>
      )}

      {/* C5: Family Battle — song picker */}
      {battlePickOpen && !battleData && (
        <div className="practiceov" onClick={() => setBattlePickOpen(false)}>
          <div className="practiceov-box" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="practicetitle">⚔️ {T("Family Battle", "Family Battle", "家庭对战")}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
              {T("เลือกเพลงแล้วผลัดกันเล่น — ดูว่าใครได้คะแนนสูงกว่า!", "Pick a song and take turns — see who scores higher!", "选一首歌轮流弹 — 看谁得分更高!")}
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {SONGS.filter(s => !s.maxOnly || isMaxPlan(plan)).map(s => (
                <button key={s.id} className="songbtn ghost" style={{ width: "100%", marginBottom: 6, textAlign: "left" }}
                  onClick={() => { setBattlePickOpen(false); setBattleData({ song: s, scores: [], phase: "p1" }); if (onPlay) onPlay(s); }}>
                  {tr(s, lang)} · {["","⭐","⭐⭐","⭐⭐⭐"][s.diff] || "⭐"} · {s.bpm} BPM
                </button>
              ))}
            </div>
            <button className="practicex" onClick={() => setBattlePickOpen(false)}>×</button>
          </div>
        </div>
      )}

      {/* C5: Family Battle — between-round & result overlay */}
      {battleData && songPhase === "done" && (
        <div className="lvup lvup-badge" onClick={e => e.stopPropagation()}>
          {battleData.phase === "p2" && (
            <>
              <div className="lvup-burst">🎮</div>
              <div className="lvup-title">{T("Player 1 เสร็จแล้ว!", "Player 1 done!", "玩家1完成!")}</div>
              <div className="lvup-rank">{battleData.scores[0]?.acc}% · {"★".repeat(battleData.scores[0]?.stars)}</div>
              <button className="lvup-share" style={{ background: "var(--accent)", color: "#fff" }}
                onClick={() => { setBattleData((bd: any) => ({ ...bd, phase: "p2" })); startSongPlay(); }}>
                🎹 {T("Player 2 เล่นเลย!", "Player 2, go!", "玩家2，出发!")}
              </button>
            </>
          )}
          {battleData.phase === "done" && battleData.scores.length >= 2 && (
            <>
              <div className="lvup-burst">{battleData.scores[0].acc >= battleData.scores[1].acc ? "🥇" : "🥈"}</div>
              <div className="lvup-title">{T("ผลการแข่งขัน", "Battle Result!", "对战结果!")}</div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", margin: "8px 0", fontSize: 14 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 700 }}>P1</div>
                  <div>{battleData.scores[0].acc}% · {"★".repeat(battleData.scores[0].stars)}</div>
                </div>
                <div style={{ color: "var(--accent)", fontWeight: 700, alignSelf: "center" }}>VS</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 700 }}>P2</div>
                  <div>{battleData.scores[1].acc}% · {"★".repeat(battleData.scores[1].stars)}</div>
                </div>
              </div>
              <div className="lvup-rank">
                {battleData.scores[0].acc > battleData.scores[1].acc
                  ? T("🏆 Player 1 ชนะ!", "🏆 Player 1 wins!", "🏆 玩家1胜利!")
                  : battleData.scores[1].acc > battleData.scores[0].acc
                  ? T("🏆 Player 2 ชนะ!", "🏆 Player 2 wins!", "🏆 玩家2胜利!")
                  : T("🤝 เสมอ!", "🤝 Draw!", "🤝 平局!")}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="lvup-share" onClick={() => { setBattleData(null); setBattlePickOpen(true); }}>↻ {T("เล่นใหม่", "Play Again", "再玩")}</button>
                <button className="lvup-share" style={{ background: "#06c755", color: "#fff" }}
                  onClick={() => { const s = battleData.scores; shareLine(T(`⚔️ Family Battle บน TiGA Piano AI! P1: ${s[0].acc}% vs P2: ${s[1].acc}% — ${s[0].acc > s[1].acc ? "P1 ชนะ!" : s[1].acc > s[0].acc ? "P2 ชนะ!" : "เสมอ!"} tigaalpha.github.io`, `⚔️ Family Battle on TiGA Piano AI! P1: ${s[0].acc}% vs P2: ${s[1].acc}% — ${s[0].acc > s[1].acc ? "P1 wins!" : s[1].acc > s[0].acc ? "P2 wins!" : "Draw!"} tigaalpha.github.io`, `⚔️ TiGA Piano AI家庭对战! P1: ${s[0].acc}% vs P2: ${s[1].acc}% — ${s[0].acc > s[1].acc ? "P1胜!" : s[1].acc > s[0].acc ? "P2胜!" : "平局!"} tigaalpha.github.io`)); }}>🟢 LINE</button>
                <button className="lvup-share" onClick={() => { setBattleData(null); }}>✕</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Gamification: Mystery Chest overlay */}
      {mysteryChest && (
        <div className="practiceov" style={{ zIndex: 2200 }} onClick={() => setMysteryChest(null)}>
          <div className="practiceov-box" style={{ maxWidth: 320, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 64, marginBottom: 8, animation: "pop 0.5s ease" }}>{mysteryChest.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
              {T("🎊 กล่องลึกลับ!", "🎊 Mystery Chest!", "🎊 神秘宝箱！")}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#d97757", marginBottom: 4 }}>+{mysteryChest.xp} EXP</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#f5a623", marginBottom: 16 }}>+{mysteryChest.coins} 🪙</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16 }}>
              {T("รางวัลพิเศษสำหรับการเล่นที่ดีเยี่ยม!", "Special reward for your great play!", "超水平发挥的特别奖励！")}
            </div>
            <button className="songbtn go" style={{ width: "100%" }} onClick={() => setMysteryChest(null)}>
              {T("เก็บรางวัล ✨", "Collect ✨", "领取奖励 ✨")}
            </button>
          </div>
        </div>
      )}

      {/* Gamification: Lucky Bonus toast */}
      {luckyToast && (
        <div style={{ position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)", zIndex: 2300,
          background: "linear-gradient(135deg,#d97757,#f5a623)", color: "#fff", borderRadius: 20,
          padding: "10px 22px", fontWeight: 700, fontSize: 15, pointerEvents: "none",
          boxShadow: "0 4px 20px rgba(217,119,87,0.5)", animation: "pop 0.4s ease" }}>
          ⚡ {T(`LUCKY BONUS! +${luckyToast.xp} EXP`, `LUCKY BONUS! +${luckyToast.xp} EXP`, `幸运奖励! +${luckyToast.xp} EXP`)}
        </div>
      )}

      {/* E2: Commute Mode — audio theory lessons */}
      {commuteOpen && (
        <div className="practiceov" onClick={() => { stopSpeaking(); setCommuteOpen(false); }}>
          <div className="practiceov-box" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="practicetitle">🎧 {lc.commuteTitle}</div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 14 }}>{lc.commuteSub}</div>
            {commutePlaying && commuteIdx !== null && (
              <div style={{ background: "var(--accent)", color: "#fff", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 14 }}>
                🔊 {COMMUTE_LESSONS[commuteIdx].title}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {COMMUTE_LESSONS.map((lesson, i) => (
                <button key={i} className={`songbtn${commuteIdx === i && commutePlaying ? " go" : " ghost"}`}
                  style={{ textAlign: "left", fontSize: 13, padding: "10px 14px" }}
                  onClick={() => commutePlaying && commuteIdx === i ? stopSpeaking() : speakLesson(i)}>
                  {commuteIdx === i && commutePlaying ? "⏹ " : "▶ "}{lesson.title}
                </button>
              ))}
            </div>
            {commutePlaying && (
              <button className="songbtn ghost" style={{ width: "100%", color: "#e55" }} onClick={stopSpeaking}>
                ⏹ {lc.commuteStop}
              </button>
            )}
            <button className="songbtn ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => { stopSpeaking(); setCommuteOpen(false); }}>
              {lc.close}
            </button>
          </div>
        </div>
      )}

      {/* C4+F4: Kru / Teacher Mode */}
      {kruOpen && (
        <div className="practiceov" onClick={() => setKruOpen(false)}>
          <div className="practiceov-box" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="practicetitle">📋 {lc.kruTitle}</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {(["class", "code", "enter"] as const).map(tab => (
                <button key={tab} className={`songfilter${kruTab === tab ? " on" : ""}`} onClick={() => { setKruTab(tab); setKruMsg(""); setKruGenResult(""); }}>
                  {tab === "class" ? lc.kruClass : tab === "code" ? lc.kruCode : lc.kruEnter}
                </button>
              ))}
            </div>

            {kruTab === "class" && (
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input className="aicreate-in" style={{ flex: 1 }} value={kruNewName}
                    onChange={e => setKruNewName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && kruAddStudent()}
                    placeholder={lc.kruAddPh} />
                  <button className="songbtn go" style={{ padding: "0 14px" }} onClick={kruAddStudent}>{lc.kruAdd}</button>
                </div>
                {kruStudents.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, padding: 16 }}>{lc.kruNoStudents}</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
                    {kruStudents.map((st, i) => (
                      <div key={i} style={{ background: "var(--glass)", borderRadius: 10, padding: "8px 12px", display: "flex", gap: 8, alignItems: "center" }}>
                        <button style={{ fontSize: 18, background: "none", border: "none", cursor: "pointer" }} onClick={() => kruToggleDone(i)}>
                          {st.done ? "✅" : "⬜"}
                        </button>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{st.name}</div>
                          {st.songId && <div style={{ fontSize: 11, color: "var(--muted)" }}>
                            {(SONGS as any[]).find((s: any) => s.id === st.songId) ? tr((SONGS as any[]).find((s: any) => s.id === st.songId), lang) : st.songId}
                          </div>}
                        </div>
                        <select style={{ fontSize: 12, border: "1px solid var(--glass2)", borderRadius: 6, padding: "2px 4px", background: "var(--bg)", color: "var(--fg)" }}
                          value={st.songId || ""}
                          onChange={e => kruSetSong(i, e.target.value)}>
                          <option value="">{lc.kruAssign}…</option>
                          {(SONGS as any[]).map((s: any) => <option key={s.id} value={s.id}>{tr(s, lang)}</option>)}
                        </select>
                        <button style={{ background: "none", border: "none", color: "#e55", cursor: "pointer", fontSize: 16 }} onClick={() => kruRemove(i)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {kruTab === "code" && (
              <div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>{T("เลือกเพลงแล้วกดสร้างโค้ด — ส่งโค้ดให้นักเรียน", "Pick a song and generate a code to share with students", "选歌后生成练习码发给学生")}</div>
                <select className="aicreate-in" value={kruCodeSong} onChange={e => { setKruCodeSong(e.target.value); setKruGenResult(""); }}>
                  <option value="">{T("เลือกเพลง...", "Select a song...", "选择歌曲...")}</option>
                  {(SONGS as any[]).map((s: any) => <option key={s.id} value={s.id}>{tr(s, lang)}</option>)}
                </select>
                <button className="songbtn go" style={{ width: "100%", marginTop: 10 }}
                  disabled={!kruCodeSong}
                  onClick={() => {
                    const code = kruMakeCode(kruCodeSong);
                    setKruGenResult(code);
                    try { navigator.clipboard.writeText(code); setKruMsg(lc.kruCopied); } catch {}
                  }}>
                  {lc.kruMakeCode}
                </button>
                {kruGenResult && (
                  <div style={{ background: "var(--glass)", borderRadius: 8, padding: "10px 12px", marginTop: 10, fontSize: 12, wordBreak: "break-all", fontFamily: "monospace" }}>
                    {kruGenResult}
                  </div>
                )}
                {kruMsg && <div style={{ textAlign: "center", color: "var(--accent)", fontSize: 13, marginTop: 6 }}>{kruMsg}</div>}
              </div>
            )}

            {kruTab === "enter" && (
              <div>
                <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>{T("วางโค้ดที่ครูส่งให้แล้วกดเปิด", "Paste the code from your teacher and tap Open", "粘贴老师发的练习码后点击打开")}</div>
                <input className="aicreate-in" value={kruInputCode}
                  onChange={e => { setKruInputCode(e.target.value); setKruMsg(""); }}
                  placeholder={lc.kruPastePh} />
                {kruMsg && <div style={{ color: "#e55", fontSize: 13, marginTop: 6 }}>{kruMsg}</div>}
                <button className="songbtn go" style={{ width: "100%", marginTop: 10 }}
                  disabled={!kruInputCode.trim()}
                  onClick={() => kruUseCode(kruInputCode)}>
                  🎹 {lc.kruApply}
                </button>
              </div>
            )}

            <button className="songbtn ghost" style={{ width: "100%", marginTop: 12 }} onClick={() => setKruOpen(false)}>{lc.close}</button>
          </div>
        </div>
      )}
    </div>
  );
});

// Extract a Google Drive file ID from any share-link format, or accept a bare ID —
// admin.google.com/.../file/d/ID/view, .../open?id=ID, .../uc?id=ID, or just the ID itself.
function driveFileId(input) {
  const s = String(input || "").trim();
  let m = s.match(/\/d\/([a-zA-Z0-9_-]{15,})/);
  if (m) return m[1];
  m = s.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{15,}$/.test(s)) return s;
  return null;
}
// Extract a Google Drive FOLDER id from a folder share link — drive.google.com/drive/folders/ID(...).
// Whole-folder mode needs no Google API key: Google's own embeddedfolderview page shows the
// folder's file browser (grid/list of everything shared "Anyone with the link"), opened directly
// rather than embedded, so connecting a folder works immediately without any extra setup.
function driveFolderId(input) {
  const s = String(input || "").trim();
  const m = s.match(/\/folders\/([a-zA-Z0-9_-]{15,})/);
  return m ? m[1] : null;
}
// Extract a YouTube playlist id from a playlist share link (youtube.com/playlist?list=ID,
// or any watch URL with a &list= param), or accept a bare id (playlist ids are typically
// 13–34 chars, usually starting "PL"/"UU"/"LL"/"FL"). Playlists are the actual per-category
// video source — the app fetches each playlist's contents server-side via the YouTube Data
// API (see the youtube-playlist edge function) and shows every item as its own swipeable slide.
function youtubePlaylistId(input) {
  const s = String(input || "").trim();
  const m = s.match(/[?&]list=([a-zA-Z0-9_-]{10,64})/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{10,64}$/.test(s)) return s;
  return null;
}

/* ── Vertical video lessons — teaching videos hosted on the admin's own Google
   Drive (not stored on our servers — Drive serves the bytes straight to the
   viewer's browser), TikTok-style feed. Only the slide currently in view has
   its embed loaded, so at most one video plays at a time and nothing loads
   until it's actually scrolled to. ── */
// TikTok-style count formatting: 999 → "999", 1400 → "1.4K", 2.3M …
function fmtLikes(n) {
  if (!n) return "";
  if (n < 1000) return String(n);
  if (n < 1000000) return (n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, "") + "K";
  return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
}
// local bookmark (🔖) state per video
function readVidFav(id) { try { return !!JSON.parse(localStorage.getItem("tg_vidfavs") || "{}")[id]; } catch (e) { return false; } }
function writeVidFav(id, v) { try { const m = JSON.parse(localStorage.getItem("tg_vidfavs") || "{}"); if (v) m[id] = 1; else delete m[id]; localStorage.setItem("tg_vidfavs", JSON.stringify(m)); } catch (e) {} }
function VideoSlide({ s, active, lang, onAsk, likeN, likedByMe, onToggleLike }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [faved, setFaved] = useState(() => readVidFav(s.key));
  if (!active) return <div className="vidplaceholder">🎬</div>;
  const rail = (
    <div className="vidrail" onClick={e => e.stopPropagation()}>
      <button className={`vidact${likedByMe ? " on" : ""}`} onClick={(e) => { e.stopPropagation(); if (onToggleLike) onToggleLike(); }}>
        <span className="vidact-ic">❤️</span>
        <span className="vidact-n">{fmtLikes(likeN) || T("ถูกใจ", "Like", "赞")}</span>
      </button>
      <button className="vidact" onClick={(e) => { e.stopPropagation(); if (onAsk) onAsk(s.title); }}>
        <span className="vidact-ic">💬</span>
        <span className="vidact-n">{T("ถามครู", "Ask AI", "问老师")}</span>
      </button>
      <button className={`vidact${faved ? " fav" : ""}`} onClick={(e) => { e.stopPropagation(); const v = !faved; setFaved(v); writeVidFav(s.key, v); }}>
        <span className="vidact-ic">🔖</span>
        <span className="vidact-n">{T("บันทึก", "Save", "收藏")}</span>
      </button>
    </div>
  );
  // YouTube's iframe embed is built for third-party sites — unlike Google Drive's
  // viewer (see the git history on this file for why that never worked in-page),
  // it plays fine cross-origin with no cookie dependency, so this is a real
  // in-app TikTok-style player, not just a launcher into another app.
  if (s.youtubeId) {
    return (
      <>
        <iframe className="vidplayer"
          src={`https://www.youtube-nocookie.com/embed/${s.youtubeId}?autoplay=1&mute=1&playsinline=1&modestbranding=1&rel=0&iv_load_policy=3`}
          allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen frameBorder="0" title={s.title} />
        {rail}
      </>
    );
  }
  // Legacy Google Drive rows (pre-YouTube-migration): no reliable in-page embed
  // exists for Drive content, so this opens it in a new tab instead — a normal
  // top-level navigation to google.com, which plays fine (iframing it does not,
  // regardless of which Drive embed URL is used — verified live).
  const url = s.folderId
    ? `https://drive.google.com/embeddedfolderview?id=${s.folderId}#grid`
    : `https://drive.google.com/file/d/${s.fileId}/view`;
  return (
    <>
      <div className="vidopen" onClick={() => window.open(url, "_blank", "noopener")}>
        <div className="vidopen-ic">{s.folderId ? "🎬" : "▶️"}</div>
        <div className="vidopen-t">{s.title}</div>
        <div className="vidopen-h">{T("แตะเพื่อเปิดใน Google Drive", "Tap to open in Google Drive", "点击在 Google Drive 中打开")}</div>
      </div>
      {rail}
    </>
  );
}
const VideoLessonsPage = memo(function VideoLessonsPage({ lang, onAsk }) {
  const lc = L[lang];
  const [categories, setCategories] = useState(null);  // null = loading; each row is one published lesson_videos entry
  const [activeCat, setActiveCat] = useState(null);     // lesson_videos.id of the selected category
  const [slides, setSlides] = useState(null);           // null = loading this category's videos
  const [activeKey, setActiveKey] = useState(null);
  const [likes, setLikes] = useState({});               // slide key -> {n, me} — REAL cross-user like counts
  const slideRefs = useRef([]);
  function toggleLike(key) {
    const cur = likes[key] || { n: 0, me: false };
    const next = cur.me ? { n: Math.max(0, cur.n - 1), me: false } : { n: cur.n + 1, me: true };
    setLikes(p => ({ ...p, [key]: next })); // optimistic — the write follows in the background
    playUi("click"); haptic(8);
    sb.auth.getSession().then(({ data }) => {
      const uid = data && data.session && data.session.user && data.session.user.id;
      if (!uid) return;
      if (cur.me) sb.from("video_likes").delete().eq("user_id", uid).eq("file_id", key).then(() => {}, () => {});
      else sb.from("video_likes").insert({ user_id: uid, file_id: key }).then(() => {}, () => {});
    }, () => {});
  }

  // Each published lesson_videos row is one CATEGORY (its title is the chip
  // label) — pointing at a YouTube playlist, or (legacy) a Drive folder/file.
  useEffect(() => {
    let cancelled = false;
    sb.from("lesson_videos").select("*").eq("published", true).order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        const rows = error ? [] : (data || []);
        setCategories(rows);
        if (rows.length) setActiveCat(rows[0].id);
      });
    return () => { cancelled = true; };
  }, []);

  // Expand the SELECTED category into individual slides. A YouTube playlist is
  // resolved server-side via the official YouTube Data API (see the
  // youtube-playlist edge function) — one slide per video in the playlist, so
  // switching categories only pays for the API call of the one you picked.
  useEffect(() => {
    if (!categories) return;
    const cat = categories.find(c => c.id === activeCat);
    if (!cat) { setSlides([]); return; }
    let cancelled = false;
    setSlides(null);
    setActiveKey(null);
    (async () => {
      let out = [];
      if (cat.youtube_playlist_id) {
        try {
          const { data: pl, error } = await sb.functions.invoke("youtube-playlist", { body: { playlistId: cat.youtube_playlist_id } });
          if (!error && pl && pl.items) out = pl.items.map(it => ({ key: cat.id + "-" + it.videoId, youtubeId: it.videoId, title: it.title }));
        } catch (e) {}
      } else if (cat.drive_folder_id) {
        out = [{ key: cat.id, folderId: cat.drive_folder_id, title: cat.title, desc: cat.description }];
      } else if (cat.drive_file_id) {
        out = [{ key: cat.id, fileId: cat.drive_file_id, title: cat.title, desc: cat.description }];
      }
      if (cancelled) return;
      setSlides(out);
      if (out.length) setActiveKey(out[0].key);
      // pull the real like counts for every video in one call
      const ids = [...new Set(out.map(x => x.key))];
      if (ids.length) {
        sb.rpc("get_video_like_counts", { ids }).then(({ data: lk }) => {
          if (cancelled || !lk) return;
          const m = {};
          for (const r of lk) m[r.file_id] = { n: Number(r.likes) || 0, me: !!r.liked_by_me };
          setLikes(m);
        }, () => {});
      }
    })();
    return () => { cancelled = true; };
  }, [activeCat, categories]);

  // TikTok-style: whichever slide is mostly in view becomes "active" — only ITS
  // player is mounted (loads/plays); scrolling away unmounts it (stops audio + bandwidth).
  useEffect(() => {
    if (!slides || !slides.length) return;
    const els = slideRefs.current.filter(Boolean);
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting && e.intersectionRatio > 0.6) setActiveKey(e.target.dataset.vid);
    }, { threshold: [0, 0.6, 1] });
    els.forEach(v => io.observe(v));
    return () => io.disconnect();
  }, [slides]);

  if (categories === null) return <div className="pathpage"><div className="admstu-empty">…</div></div>;
  if (!categories.length) return (
    <div className="pathpage">
      <div className="pathhero"><div className="pathhero-glow" /><div className="pathbadge">🎬 {lc.navVideos}</div></div>
      <div className="admstu-empty">{lc.videosEmpty}</div>
    </div>
  );
  return (
    <div className="vidwrap">
      {categories.length > 1 && (
        <div className="vidcatbar">
          {categories.map(c => (
            <button key={c.id} className={"vidcat" + (activeCat === c.id ? " on" : "")} onClick={() => { playUi("click"); setActiveCat(c.id); }}>
              {c.title}
            </button>
          ))}
        </div>
      )}
      <div className="vidfeed">
        {slides === null ? (
          <div className="vidplaceholder">…</div>
        ) : !slides.length ? (
          <div className="vidplaceholder" style={{ opacity: .6, fontSize: 15 }}>{lc.videosEmpty}</div>
        ) : slides.map((s, i) => (
          <div className="vidslide" key={s.key} data-vid={s.key} ref={el => (slideRefs.current[i] = el)}>
            <VideoSlide s={s} active={activeKey === s.key} lang={lang} onAsk={onAsk}
              likeN={(likes[s.key] || {}).n || 0} likedByMe={!!(likes[s.key] || {}).me} onToggleLike={() => toggleLike(s.key)} />
            <div className="vidtopfade" />
          </div>
        ))}
      </div>
    </div>
  );
});

/* ── Song picker page (falling-notes play-along) ── */
const SONG_REQ = { 1: 1, 2: 2, 3: 4 };   // level required to unlock by difficulty
const SongListPage = memo(function SongListPage({ lang, onPlay, onBack, level = 1, premium = false, onUpsell, onRequireLogin, plan = "" }) {
  const lc = L[lang];
  const [filter, setFilter] = useState(-1);   // -1 all · 0 favorites · 1/2/3 by difficulty
  const [favs, setFavs] = useState(() => { try { return JSON.parse(localStorage.getItem("tg_favs") || "[]"); } catch (e) { return []; } });
  const toggleFav = (id) => setFavs(prev => {
    const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
    try { localStorage.setItem("tg_favs", JSON.stringify(next)); } catch (e) {}
    return next;
  });
  const [mySongs, setMySongs] = useState(() => { try { return JSON.parse(localStorage.getItem("tg_mysongs") || "[]"); } catch (e) { return []; } });
  const [createOpen, setCreateOpen] = useState(false);
  const [genText, setGenText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genErr, setGenErr] = useState(false);
  // A3: Hum / Play-to-Create
  const [humming, setHumming] = useState(false);
  const [humNotes, setHumNotes] = useState<string[]>([]);
  const humTimerRef = useRef<any>(null);
  // Play-Along categories: songs · scales · chords · intervals (all on this one page)
  const [cat, setCat] = useState("songs");
  const [genreFilter, setGenreFilter] = useState("all");
  const [minorType, setMinorType] = useState("natural minor");
  const [triadQual, setTriadQual] = useState("major");
  const [seventhQual, setSeventhQual] = useState("maj7");
  const play = (s) => { try { localStorage.setItem("tg_last_song", s.id); } catch (e) {} onPlay(s); };
  let lastId = null; try { lastId = localStorage.getItem("tg_last_song"); } catch (e) {}
  const ALL = [...mySongs, ...SONGS];
  const lastSong = lastId ? ALL.find(s => s.id === lastId) : null;

  async function generateSong() {
    if (!genText.trim() || generating) return;
    if (onRequireLogin && onRequireLogin()) return;
    if (!canUse("song", premium)) { setCreateOpen(false); if (onUpsell) onUpsell(); return; }
    setGenerating(true); setGenErr(false);
    try {
      const sys = "You turn a song request into a simple one-hand beginner piano melody for a falling-notes game. Output ONLY valid minified JSON, no prose, no markdown: {\"name\":string,\"bpm\":number,\"seq\":[[note,beats],...]}. Notes use scientific names from C4 to B5 only; use \"R\" for a rest; beats are 0.5, 1, 1.5 or 2. Keep it 16-48 notes and recognizable.";
      const acc = await streamChatCompletion({ message: "Create this song: " + genText, conversationHistory: [], system: sys });
      const jm = acc.match(/\{[\s\S]*\}/); if (!jm) throw new Error("no json");
      const obj = JSON.parse(jm[0]);
      const seq = normalizeSeq(obj.seq || []);
      if (seq.length < 6 || !seq.some(x => x[0] !== "R")) throw new Error("short");
      const name = String(obj.name || genText).slice(0, 40);
      const bpm = Math.min(180, Math.max(60, Math.round(obj.bpm || 100)));
      const song = { id: "my_" + Date.now(), diff: 1, bpm, custom: true, th: name, en: name, zh: name, seq };
      const saved = [song, ...mySongs].slice(0, 20);
      setMySongs(saved); try { localStorage.setItem("tg_mysongs", JSON.stringify(saved)); } catch (e) {}
      if (!premium) bumpUsage("song");
      setCreateOpen(false); setGenText(""); setGenerating(false);
      play(song);
    } catch (e) { setGenErr(true); setGenerating(false); }
  }
  function delSong(id) {
    const saved = mySongs.filter(s => s.id !== id);
    setMySongs(saved); try { localStorage.setItem("tg_mysongs", JSON.stringify(saved)); } catch (e) {}
  }

  // A3: Hum/Play-to-Create — mic records notes, fills AI prompt
  async function startHum() {
    if (humming) return;
    const notes: string[] = [];
    const ok = await startMicListener(
      (e: any) => {
        const pc = (e.note as string).replace(/\d/, "");
        if (notes.length < 10 && (notes.length === 0 || notes[notes.length - 1] !== pc)) {
          notes.push(pc); setHumNotes([...notes]);
        }
      },
      () => setHumming(true),
      () => setHumming(false),
      {}
    );
    if (!ok) return;
    humTimerRef.current = setTimeout(() => {
      stopPracticeListeners();
      setHumming(false);
      if (notes.length >= 2) setGenText("melody using these notes: " + notes.join("-"));
    }, 8000);
  }
  function stopHum() {
    clearTimeout(humTimerRef.current);
    stopPracticeListeners();
    setHumming(false);
  }

  const filters = [
    { k: -1, label: lc.songAll }, { k: 0, label: "★ " + lc.songFav },
    { k: 1, label: "★" }, { k: 2, label: "★★" }, { k: 3, label: "★★★" },
  ];
  let list = ALL.slice();
  if (filter === 0) list = list.filter(s => favs.includes(s.id));
  else if (filter > 0) list = list.filter(s => s.diff === filter && !s.custom);
  if (genreFilter !== "all") list = list.filter(s => s.custom ? false : (SONG_GENRES[s.id] || "classical") === genreFilter);
  list.sort((a, b) => (b.custom ? 1 : 0) - (a.custom ? 1 : 0) || (favs.includes(b.id) ? 1 : 0) - (favs.includes(a.id) ? 1 : 0) || a.diff - b.diff);

  const Card = (s, pfx = "") => {
    const hue = laneHue((s.seq.find(x => x[0] !== "R") || ["C4"])[0]);
    const isFav = favs.includes(s.id);
    const req = SONG_REQ[s.diff] || 1;
    const locked = !s.custom && level < req;
    const maxLocked = !s.custom && s.maxOnly && !isMaxPlan(plan);
    let pb = 0; try { pb = +(localStorage.getItem("tg_best_" + s.id) || 0); } catch (_) {}
    return (
      <button key={pfx + s.id} className={`songcard${locked || maxLocked ? " locked" : ""}`} style={{ "--sc": `hsl(${hue},70%,56%)` }}
        onClick={() => { if (locked) { haptic(20); playMiss(); } else if (maxLocked) { haptic(20); if (onUpsell) onUpsell(); } else play(s); }}>
        <div className="songcard-ic">{locked ? "🔒" : maxLocked ? "👑" : s.custom ? "🎼" : "🎵"}</div>
        <div className="songcard-body">
          <div className="songcard-nm">{tr(s, lang)}</div>
          <div className="songcard-meta">
            <span className="songdiff" aria-label={`difficulty ${s.diff}`}>{s.custom ? "✨ AI" : "★".repeat(s.diff) + "☆".repeat(3 - s.diff)}</span>
            <span>{locked ? lc.lockedLv + req : maxLocked ? (lang === "th" ? "👑 Max เท่านั้น" : lang === "zh" ? "👑 Max 专属" : "👑 Max only") : s.bpm + " BPM"}</span>
            {pb > 0 && <span className="songcard-pb">PB {pb.toLocaleString()}</span>}
          </div>
        </div>
        <span className="songcard-go">{locked ? "🔒" : maxLocked ? "👑" : "▶"}</span>
        {s.custom
          ? <span className="favbtn del" role="button" tabIndex={0} aria-label="Delete" onClick={(e) => { e.stopPropagation(); haptic(); delSong(s.id); }}>🗑</span>
          : !locked && !maxLocked && <span className={`favbtn${isFav ? " on" : ""}`} role="button" tabIndex={0} aria-label="Favorite" aria-pressed={isFav}
            onClick={(e) => { e.stopPropagation(); haptic(); toggleFav(s.id); }}>{isFav ? "★" : "☆"}</span>}
      </button>
    );
  };
  // A drill card (scale / chord / interval) — no lock, no fav, just launch.
  const DrillCard = (s, icon) => {
    const fn = s.seq.find(x => x[0] !== "R") || ["C4"];
    const nNotes = s.seq.filter(x => x[0] !== "R").length;
    return (
      <button key={s.id} className="songcard" style={{ "--sc": `hsl(${laneHue(fn[0])},70%,56%)` }} onClick={() => play(s)}>
        <div className="songcard-ic">{icon}</div>
        <div className="songcard-body">
          <div className="songcard-nm">{tr(s, lang)}</div>
          <div className="songcard-meta"><span>{s.bpm} BPM</span><span>{nNotes} {lang === "th" ? "โน้ต" : lang === "zh" ? "音符" : "notes"}</span></div>
        </div>
        <span className="songcard-go">▶</span>
      </button>
    );
  };

  // top-level Play-Along categories (everything lives on this one page)
  const cats = [
    { k: "songs",    ic: "🎵", t: { th: "เพลง",        en: "Songs",       zh: "歌曲" } },
    { k: "major",    ic: "🎼", t: { th: "เมเจอร์สเกล",  en: "Major Scales", zh: "大调音阶" } },
    { k: "minor",    ic: "🎹", t: { th: "ไมเนอร์สเกล",  en: "Minor Scales", zh: "小调音阶" } },
    { k: "triad",    ic: "🎶", t: { th: "ไทรแอด",       en: "Triads",      zh: "三和弦" } },
    { k: "seventh",  ic: "🎷", t: { th: "คอร์ด 7",      en: "7th Chords",  zh: "七和弦" } },
    { k: "interval", ic: "📏", t: { th: "ขั้นคู่",        en: "Intervals",   zh: "音程" } },
  ];
  const drillList = cat === "major" ? MAJOR_SCALE_SONGS
    : cat === "minor" ? (MINOR_SCALE_SONGS[minorType] || [])
    : cat === "triad" ? (TRIAD_SONGS[triadQual] || [])
    : cat === "seventh" ? (SEVENTH_SONGS[seventhQual] || [])
    : cat === "interval" ? INTERVAL_SONGS : [];
  const drillIcon = cat === "interval" ? "📏" : (cat === "triad" || cat === "seventh") ? "🎶" : cat === "minor" ? "🎹" : "🎼";
  const drillHint = lang === "th" ? "แตะการ์ดเพื่อเริ่ม — โน้ตจะไหลลงมา เล่นตามให้ตรง (ขึ้นแล้วลง)"
    : lang === "zh" ? "点击卡片开始 — 音符会落下，跟着弹（上行再下行）"
    : "Tap a card to start — notes fall, play along up then down";

  return (
    <div className="pathpage songpage">
      <div className="pathhero">
        <div className="pathhero-glow" />
        {onBack && <button className="studioback" onClick={onBack}>‹ {lc.back}</button>}
        <div className="pathbadge">♪ PLAY ALONG ♪</div>
        <h1 className="pathh1">{lc.songsTitle}</h1>
        <p className="pathguide">{lc.songsSub}</p>
      </div>
      {/* category selector — Songs · Scales · Chords · Intervals */}
      <div className="songfilters">
        {cats.map(c => (
          <button key={c.k} className={`songfilter${cat === c.k ? " on" : ""}`} onClick={() => { haptic(); setCat(c.k); }}>
            {c.ic} {tr(c.t, lang)}
          </button>
        ))}
      </div>

      {cat === "songs" ? (
        <>
          <div className="songfilters">
            {filters.map(f => <button key={f.k} className={`songfilter${filter === f.k ? " on" : ""}`} onClick={() => setFilter(f.k)}>{f.label}</button>)}
          </div>
          <div className="genrefilters">
            {([
              { code:"all",       label:{ th:"🎵 ทั้งหมด",     en:"🎵 All",       zh:"🎵 全部" } },
              { code:"kids",      label:{ th:"👶 เด็ก",         en:"👶 Kids",      zh:"👶 儿歌" } },
              { code:"classical", label:{ th:"🎹 คลาสสิก",     en:"🎹 Classical", zh:"🎹 古典" } },
              { code:"folk",      label:{ th:"🌿 โฟล์ค",        en:"🌿 Folk",      zh:"🌿 民谣" } },
              { code:"gospel",    label:{ th:"🙏 กอสเปล",       en:"🙏 Gospel",    zh:"🙏 福音" } },
              { code:"jazz",      label:{ th:"🎷 แจ๊ส",         en:"🎷 Jazz",      zh:"🎷 爵士" } },
              { code:"soul",      label:{ th:"🎤 โซล",          en:"🎤 Soul",      zh:"🎤 灵魂乐" } },
              { code:"neosoul",   label:{ th:"🌙 นีโอโซล",      en:"🌙 Neo-Soul",  zh:"🌙 新灵魂乐" } },
              { code:"carol",     label:{ th:"🎄 คริสต์มาส",   en:"🎄 Carols",    zh:"🎄 圣诞" } },
              { code:"cn",        label:{ th:"🀄 จีน",          en:"🀄 Chinese",   zh:"🀄 中文" } },
            ] as const).map(g => (
              <button key={g.code} className={"genrechip" + (genreFilter === g.code ? " active" : "")}
                onClick={() => { haptic(); setGenreFilter(g.code); }}>
                {g.label[lang] ?? g.label.en}
              </button>
            ))}
          </div>
          <button className="aicreate" onClick={() => { setGenErr(false); setCreateOpen(true); }}>✨ {lc.aiCreate}</button>
          {createOpen && (
            <div className="setov" onClick={() => !generating && setCreateOpen(false)}>
              <div className="setcard" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                <div className="sethdr"><span>✨ {lc.aiCreate}</span><button className="cbtn" onClick={() => !generating && setCreateOpen(false)}>{lc.close}</button></div>
                <div className="setbody">
                  <p className="aicreate-hint">{lc.aiCreateHint}</p>
                  {/* A3: Hum / Play-to-Create button */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <button className="songbtn ghost" style={{ flex: 1, fontSize: 13 }}
                      onClick={humming ? stopHum : startHum} disabled={generating}>
                      {humming ? `⏹ ${lc.aiHumStop} (${humNotes.length})` : lc.aiHumBtn}
                    </button>
                  </div>
                  {humNotes.length > 0 && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6, textAlign: "center", letterSpacing: 1 }}>
                      {humNotes.join(" · ")}
                    </div>
                  )}
                  <input className="aicreate-in" value={genText} onChange={e => setGenText(e.target.value)}
                    placeholder={lc.aiCreatePh} onKeyDown={e => { if (e.key === "Enter") generateSong(); }} disabled={generating} />
                  {genErr && <div className="aicreate-err">{lc.aiCreateErr}</div>}
                  <button className="songbtn go" style={{ width: "100%", marginTop: 12 }} onClick={generateSong} disabled={generating || !genText.trim()}>
                    {generating ? "⏳ " + lc.aiCreating : "✨ " + lc.aiCreateGo}
                  </button>
                </div>
              </div>
            </div>
          )}
          {lastSong && filter === -1 && (
            <div className="songcontinue">
              <div className="songcontinue-lbl">↻ {lc.songContinue}</div>
              {Card(lastSong, "c-")}
            </div>
          )}
          <div className="songgrid">
            {list.length ? list.map(s => Card(s)) : <div className="songempty">{lc.songFavEmpty}</div>}
          </div>
        </>
      ) : (
        <>
          {cat === "minor" && (
            <div className="songfilters">
              {MINOR_TYPES.map(t => <button key={t.key} className={`songfilter${minorType === t.key ? " on" : ""}`} onClick={() => { haptic(); setMinorType(t.key); }}>{tr(t, lang)}</button>)}
            </div>
          )}
          {cat === "triad" && (
            <div className="songfilters">
              {TRIAD_TYPES.map(t => <button key={t.key} className={`songfilter${triadQual === t.key ? " on" : ""}`} onClick={() => { haptic(); setTriadQual(t.key); }}>{tr(t, lang)}</button>)}
            </div>
          )}
          {cat === "seventh" && (
            <div className="songfilters">
              {SEVENTH_TYPES.map(t => <button key={t.key} className={`songfilter${seventhQual === t.key ? " on" : ""}`} onClick={() => { haptic(); setSeventhQual(t.key); }}>{tr(t, lang)}</button>)}
            </div>
          )}
          <p className="drillhint">{drillHint}</p>
          <div className="songgrid">
            {drillList.map(s => DrillCard(s, drillIcon))}
          </div>
        </>
      )}
    </div>
  );
});

/* ── Single note on a treble OR bass staff (for sight-reading) ── */

/* ── Reading staff overlaid on the Play Along falling-notes stage — the same
   note stream driving the game, shown left-to-right on a standard staff so
   every song doubles as sight-reading practice. Every song stays within
   C4–B5 (see songs-data.ts), so treble clef alone covers all of it — no
   auto bass-clef switch needed here, unlike StaffNotes above. Colors are
   fixed rather than theme-variable: this sits on the game's own dark
   starfield canvas regardless of the app's light/dark mode.
   `notes` is a sliding window of {note, beat, state}, state one of
   past|current|future — already-played, the one to read right now, and
   what's coming — each rendered in a clearly different color/weight so a
   learner always knows exactly where they are on the page. Bar lines are
   drawn wherever the beat count crosses a measure boundary, using the
   song's own time signature (SONG_TIMESIG, defaulting to 4/4).
   Key signature: every song's notes are natural-only (no sharps/flats
   anywhere in songs-data.ts, by this app's own beginner-friendly design),
   so the true key signature is always empty (C major/A minor) — drawing
   sharp/flat glyphs here would be actively wrong. Instead this shows a
   plain "Key: <letter>" label using the song's last note as its tonic
   (the same beginner heuristic — "a tune usually resolves home" — the
   AI-accompaniment backing chords already use via songTonic()). ── */

/* ── Leaderboard (top players by EXP) — privacy-safe RPC, names + stats only ── */
/* Weekly League — a resetting, tier-scoped companion to the all-time global
   leaderboard above. A user's tier is DERIVED live (server-side, via
   get_my_league) from how much EXP they earned THIS week — no stored
   promotion/demotion state, so there's nothing to get stuck. See
   supabase-gamification-leagues-migration.sql for the RPCs. */
const LEAGUE_TIERS = [
  { tier: 1, icon: "🥉", th: "บรอนซ์", en: "Bronze", zh: "青铜" },
  { tier: 2, icon: "🥈", th: "ซิลเวอร์", en: "Silver", zh: "白银" },
  { tier: 3, icon: "🥇", th: "โกลด์", en: "Gold", zh: "黄金" },
  { tier: 4, icon: "💎", th: "แพลทินัม", en: "Platinum", zh: "铂金" },
  { tier: 5, icon: "👑", th: "ไดมอนด์", en: "Diamond", zh: "钻石" },
];
/* School-scoped leaderboard — the teacher-facing SchoolDashboard already shows
   every student's stats; students themselves had zero peer visibility until
   now. Reuses profiles.school_id (School Plan Pro) — no new table needed, see
   get_school_leaderboard in supabase-gamification-school-migration.sql. */
const SchoolLeaderboardSection = memo(function SchoolLeaderboardSection({ lang, schoolId }) {
  const lc = L[lang];
  const [rows, setRows] = useState(null); // null=loading, false=error
  useEffect(() => {
    if (!schoolId) return;
    let alive = true;
    sb.rpc("get_school_leaderboard", { p_school_id: schoolId }).then(({ data, error }) => {
      if (alive) setRows(error ? false : (data || []));
    });
    return () => { alive = false; };
  }, [schoolId]);
  if (rows === false || (rows && rows.length === 0)) return null; // quiet — this is a bonus, not core
  return (
    <div className="profsec" style={{ margin: "0 14px 10px" }}>
      <div className="profsec-h">🏫 {lc.schoolLbTitle}</div>
      {rows == null ? <div className="lbempty">{lc.lbLoad}</div> : (
        <div className="lblist">
          {rows.map((r, i) => (
            <div key={i} className={`lbrow${r.is_me ? " me" : ""}`} style={{ animationDelay: (i * 35) + "ms" }}>
              <span className="lbrank">{i + 1}</span>
              <span className="lbname">{r.name}{r.is_me ? ` · ${lc.lbYouTag}` : ""}</span>
              <span className="lbexp">{(r.exp || 0).toLocaleString()} <small>EXP</small></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

/* Class Quest — a teacher-set, cooperative (not competitive) shared EXP goal
   for the whole school. See school_set_quest/school_quest_bump/get_school_quest
   in supabase-gamification-school-migration.sql. Deliberately shown only when
   a quest is actually active — most schools most of the time have none set,
   and an empty "no quest" card every time would just be clutter. */
const ClassQuestSection = memo(function ClassQuestSection({ lang, schoolId }) {
  const lc = L[lang];
  const [q, setQ] = useState(null); // null=loading, false=error, {active:false}, or full quest data
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (!schoolId) return;
    let alive = true;
    sb.rpc("get_school_quest", { p_school_id: schoolId }).then(({ data, error }) => {
      if (alive) setQ(error ? false : data);
    });
    return () => { alive = false; };
  }, [schoolId]);
  useEffect(() => {
    if (q && q.active && q.complete && !celebratedRef.current) { celebratedRef.current = true; playUi("levelup"); }
  }, [q]);
  if (q === false || (q && q.active === false)) return null;
  const pct = q ? Math.min(100, Math.round((q.total_exp / q.goal_exp) * 100)) : 0;
  return (
    <div className="profsec" style={{ margin: "0 14px 10px" }}>
      <div className="profsec-h">🎯 {lc.cqTitle}</div>
      {q == null ? <div className="lbempty">{lc.lbLoad}</div> : (
        <>
          <div className="cqbar"><div style={{ width: pct + "%" }} /></div>
          <div className="cqstat">{q.total_exp.toLocaleString()} / {q.goal_exp.toLocaleString()} EXP {q.complete ? "🎉" : ""}</div>
          <div className="leaguereset">{lc.cqMine}: {q.my_exp.toLocaleString()} EXP</div>
        </>
      )}
    </div>
  );
});

const WeeklyLeagueSection = memo(function WeeklyLeagueSection({ lang }) {
  const lc = L[lang];
  const [data, setData] = useState(null); // null=loading, false=fetch failed
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: d, error } = await sb.rpc("get_my_league", { p_week_key: weekKey() });
        if (error) throw error;
        if (alive) setData(d);
      } catch (e) { if (alive) setData(false); }
    })();
    return () => { alive = false; };
  }, []);
  if (data === false) return null; // bonus section — fail quietly rather than show an error block
  const tierInfo = data ? LEAGUE_TIERS[Math.max(0, Math.min(LEAGUE_TIERS.length - 1, data.tier - 1))] : null;
  const members = data ? (data.members || []) : [];
  return (
    <div className="profsec">
      <div className="profsec-h">
        {lc.leagueTitle}
        {tierInfo && <span className="lbmine">{tierInfo.icon} {tr(tierInfo, lang)}</span>}
      </div>
      {data == null ? <div className="lbempty">{lc.lbLoad}</div>
        : members.length === 0 ? <div className="lbempty">{lc.leagueEmpty}</div>
        : <div className="lblist">
            {members.map((m, i) => (
              <div key={i} className={`lbrow${m.is_me ? " me" : ""}`} style={{ animationDelay: (i * 35) + "ms" }}>
                <span className="lbrank">{i + 1}</span>
                <span className="lbname">{m.name}{m.is_me ? ` · ${lc.lbYouTag}` : ""}</span>
                <span className="lbexp">{m.exp.toLocaleString()} <small>EXP</small></span>
              </div>
            ))}
          </div>}
      <div className="leaguereset">{lc.leagueReset}</div>
    </div>
  );
});

const LeaderboardSection = memo(function LeaderboardSection({ lang }) {
  const lc = L[lang];
  const [rows, setRows] = useState(null); // null = loading
  const [myRank, setMyRank] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await sb.rpc("get_leaderboard", { limit_n: 20 });
        if (error) throw error;
        if (!alive) return;
        setRows(data || []);
        const me = (data || []).find(r => r.is_me);
        if (me) { setMyRank(me.rank); return; }
        const r = await sb.rpc("get_my_rank");
        if (alive && !r.error) setMyRank(r.data);
      } catch (e) { if (alive) setErr(true); }
    })();
    return () => { alive = false; };
  }, []);
  const medals = ["", "🥇", "🥈", "🥉"];
  return (
    <div className="profsec">
      <div className="profsec-h">
        {lc.lbTitle}
        {myRank != null && <span className="lbmine">{lc.lbYou} #{myRank}</span>}
      </div>
      {err ? <div className="lbempty">{lc.lbErr}</div>
        : rows == null ? <div className="lbempty">{lc.lbLoad}</div>
        : rows.length === 0 ? <div className="lbempty">{lc.lbEmpty}</div>
        : <>
            {rows.length >= 3 && (
              <div className="lbpodium">
                {[2, 1, 3].map(pos => {
                  const r = rows[pos - 1];
                  return (
                    <div key={pos} className={`lbpod p${pos}${r.is_me ? " me" : ""}`}>
                      <div className="lbpod-medal">{medals[pos]}</div>
                      <div className="lbpod-ava">{(r.name || "?").trim().slice(0, 1).toUpperCase()}</div>
                      <div className="lbpod-nm">{r.name}</div>
                      <div className="lbpod-exp">{r.exp.toLocaleString()}</div>
                    </div>
                  );
                })}
              </div>
            )}
            {(() => {
              const meIdx = rows.findIndex(r => r.is_me);
              if (meIdx > 0) {
                const gap = rows[meIdx - 1].exp - rows[meIdx].exp;
                if (gap > 0) return <div className="lbtonext">↑ {gap.toLocaleString()} EXP → #{rows[meIdx].rank - 1}</div>;
              }
              return null;
            })()}
            <div className="lblist">
              {rows.filter(r => r.rank > 3).map((r, i) => (
                <div key={i} className={`lbrow${r.is_me ? " me" : ""}`} style={{ animationDelay: (i * 35) + "ms" }}>
                  <span className="lbrank">{r.rank}</span>
                  <span className="lbname">{r.name}{r.is_me ? ` · ${lc.lbYouTag}` : ""}</span>
                  <span className="lbexp">{r.exp.toLocaleString()} <small>EXP</small></span>
                </div>
              ))}
            </div>
          </>}
    </div>
  );
});

/* Friends + async duels (also powers Family Battle, via the same duels table
   with mode:'family' — see supabase-gamification-social-migration.sql). A
   duel's real result always comes from the player's own recorded game log
   (readGameLog) — never a typed-in number — so a challenge score is exactly
   as trustworthy as any other score already shown in this app's own stats. */
const FriendsModal = memo(function FriendsModal({ lang, onClose }) {
  const lc = L[lang];
  const [tab, setTab] = useState("friends"); // friends | requests | duels
  const [data, setData] = useState(null);    // {friends, incoming, outgoing} | false=error
  const [duels, setDuels] = useState(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [challengeFor, setChallengeFor] = useState(null);
  const busyRef = useRef(false);

  const load = useCallback(() => {
    sb.rpc("friend_list").then(({ data: d, error }) => setData(error ? false : (d || { friends: [], incoming: [], outgoing: [] })));
    sb.rpc("duel_list").then(({ data: d, error }) => setDuels(error ? [] : (d || [])));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function sendRequest() {
    if (!email.trim() || busyRef.current) return;
    busyRef.current = true; setBusy(true); setMsg("");
    const { data: r, error } = await sb.rpc("friend_request", { p_email: email.trim() });
    busyRef.current = false; setBusy(false);
    if (error) { setMsg(error.message || "error"); return; }
    setEmail(""); setMsg(r && r.status === "accepted" ? lc.frAutoAccept : lc.frSent);
    load();
  }
  async function respond(id, accept) { await sb.rpc("friend_respond", { p_id: id, p_accept: accept }); load(); }
  async function removeFriend(id) { await sb.rpc("friend_remove", { p_id: id }); load(); }
  async function sendChallenge(friend, song) {
    const best = readGameLog().filter(g => g.song === song.id).reduce((m, g) => Math.max(m, g.score || 0), 0);
    if (!best) { setMsg(lc.frNoScore); return; }
    const { error } = await sb.rpc("duel_challenge", { p_friend_id: friend.user_id, p_song_id: song.id, p_score: best, p_mode: "duel" });
    if (error) setMsg(error.message || "error"); else { setMsg(lc.frChallengeSent); setChallengeFor(null); load(); }
  }
  async function respondDuel(duel) {
    const best = readGameLog().filter(g => g.song === duel.song_id).reduce((m, g) => Math.max(m, g.score || 0), 0);
    if (!best) { setMsg(lc.frNoScore); return; }
    const { error } = await sb.rpc("duel_respond", { p_id: duel.id, p_score: best });
    if (!error) { playUi("reward"); load(); }
  }
  const playedSongs = challengeFor
    ? Array.from(new Set(readGameLog().map(g => g.song))).map(id => SONGS.find(s => s.id === id)).filter(Boolean)
    : [];

  return (
    <div className="setov" onClick={onClose}>
      <div className="setcard" onClick={e => e.stopPropagation()}>
        <div className="sethdr">
          <span>👥 {lc.frTitle}</span>
          <button className="cbtn" onClick={onClose}>{lc.close}</button>
        </div>
        <div className="frtabs">
          <button className={tab === "friends" ? "active" : ""} onClick={() => setTab("friends")}>{lc.frTabFriends}</button>
          <button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}>
            {lc.frTabRequests}{data && data.incoming && data.incoming.length > 0 ? ` (${data.incoming.length})` : ""}
          </button>
          <button className={tab === "duels" ? "active" : ""} onClick={() => setTab("duels")}>{lc.frTabDuels}</button>
        </div>
        <div className="setbody">
          {msg && <div className="frmsg">{msg}</div>}
          {data === false ? <div className="lbempty">{lc.lbErr}</div> : tab === "friends" ? (
            <>
              <div className="fradd">
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder={lc.frEmailPh} type="email" />
                <button disabled={busy} onClick={sendRequest}>{lc.frAdd}</button>
              </div>
              {!data ? <div className="lbempty">{lc.lbLoad}</div>
                : data.friends.length === 0 ? <div className="lbempty">{lc.frEmpty}</div>
                : data.friends.map(f => (
                  <div key={f.id} className="frrow">
                    <div className="frrow-nm">{f.name}<span className="frrow-sub">Lv{levelInfo(f.exp || 0).level} · 🔥{f.streak || 0}</span></div>
                    <button className="frrow-go" onClick={() => setChallengeFor(f)}>🎯 {lc.frChallenge}</button>
                    <button className="frrow-x" onClick={() => removeFriend(f.id)}>✕</button>
                  </div>
                ))}
            </>
          ) : tab === "requests" ? (
            <>
              <div className="profsec-h" style={{ fontSize: "11px" }}>{lc.frIncoming}</div>
              {(!data || data.incoming.length === 0) ? <div className="lbempty">{lc.frNoneIncoming}</div> : data.incoming.map(r => (
                <div key={r.id} className="frrow">
                  <div className="frrow-nm">{r.name}</div>
                  <button className="frrow-go" onClick={() => respond(r.id, true)}>✓ {lc.frAccept}</button>
                  <button className="frrow-x" onClick={() => respond(r.id, false)}>✕</button>
                </div>
              ))}
              <div className="profsec-h" style={{ fontSize: "11px", marginTop: 14 }}>{lc.frOutgoing}</div>
              {(!data || data.outgoing.length === 0) ? <div className="lbempty">{lc.frNoneOutgoing}</div> : data.outgoing.map(r => (
                <div key={r.id} className="frrow"><div className="frrow-nm">{r.name}</div><span className="frrow-pending">{lc.frPending}</span></div>
              ))}
            </>
          ) : (
            <>
              {(!duels || duels.length === 0) ? <div className="lbempty">{lc.frNoDuels}</div> : duels.map(d => (
                <div key={d.id} className="frduel">
                  <div className="frduel-top">
                    <span>{d.mode === "family" ? "👨‍👩‍👧 " : "⚔️ "}{lc.frVs} {d.opp_name}</span>
                    <span className={`frduel-status ${d.status}`}>{d.status === "done" ? lc.frDone : d.status === "expired" ? lc.frExpired : lc.frPending}</span>
                  </div>
                  <div className="frduel-score">
                    <span>{lc.frYou}: {d.my_score ?? "—"}</span>
                    <span>{d.opp_name}: {d.opp_score ?? "—"}</span>
                  </div>
                  {d.status === "pending" && !d.i_am_a && (
                    <button className="frrow-go" onClick={() => respondDuel(d)}>{lc.frRespond}</button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {challengeFor && (
          <div className="setov" onClick={() => setChallengeFor(null)}>
            <div className="setcard" style={{ maxWidth: 320 }} onClick={e => e.stopPropagation()}>
              <div className="sethdr"><span>🎯 {challengeFor.name}</span><button className="cbtn" onClick={() => setChallengeFor(null)}>{lc.close}</button></div>
              <div className="setbody">
                {playedSongs.length === 0 ? <div className="lbempty">{lc.frPlayFirst}</div> : (
                  <div className="frsonglist">
                    {playedSongs.map(s => <button key={s.id} className="frsongpick" onClick={() => sendChallenge(challengeFor, s)}>{tr(s, lang)}</button>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export function logPractice(acc) {
  try {
    const log = readPracticeLog();
    const k = dayKey();
    const e = log[k] || { n: 0, accSum: 0 };
    e.n += 1; e.accSum += Math.round(acc || 0);
    log[k] = e;
    const recent = Array.isArray(log._recent) ? log._recent : [];
    recent.push({ d: k, acc: Math.round(acc || 0) });
    log._recent = recent.slice(-30);
    localStorage.setItem(PRACTICE_LOG_KEY, JSON.stringify(log));
  } catch (e) {}
  bumpStreak();   // a finished session counts toward the daily streak
}
// record EXP earned per day so the dashboard can chart growth over time
export function logExpGain(amount) {
  try {
    if (!amount) return;
    const log = readPracticeLog(), k = dayKey();
    const e = log[k] || { n: 0, accSum: 0 };
    e.exp = (e.exp || 0) + Math.round(amount);
    log[k] = e;
    localStorage.setItem(PRACTICE_LOG_KEY, JSON.stringify(log));
  } catch (e) {}
}
// per-play log of falling-notes song games (for the profile game-stats bars)
const GAME_LOG_KEY = "tg_game_log";
function readGameLog() { try { return JSON.parse(localStorage.getItem(GAME_LOG_KEY) || "[]") || []; } catch (e) { return []; } }
export function logGame(g) {
  try {
    const log = readGameLog();
    log.push({ d: dayKey(), t: Date.now(), song: g.song || "", acc: Math.round(g.acc || 0), score: g.score || 0, stars: g.stars || 0 });
    localStorage.setItem(GAME_LOG_KEY, JSON.stringify(log.slice(-80)));
  } catch (e) {}
}
// One-time repair: logGame() used to store the localized song TITLE in `song`
// instead of its id, which silently broke every id-based lookup against this
// log (Friends/Duels challenge scores, the "songs you've played" picker, and
// the evergreen practice-recommendation engine all compare `g.song` to a real
// SONGS id). Rewrites any already-stored title strings back to their real id
// by matching against all three languages; runs once per browser, ever.
function migrateGameLogSongIds() {
  try {
    if (localStorage.getItem("tg_gamelog_id_fix") === "1") return;
    const log = readGameLog();
    let changed = false;
    for (const g of log) {
      if (!g.song || SONGS.some(s => s.id === g.song)) continue;
      const match = SONGS.find(s => s.th === g.song || s.en === g.song || s.zh === g.song);
      if (match) { g.song = match.id; changed = true; }
    }
    if (changed) localStorage.setItem(GAME_LOG_KEY, JSON.stringify(log));
    localStorage.setItem("tg_gamelog_id_fix", "1");
  } catch (e) {}
}
migrateGameLogSongIds();
const HEAT_COLORS = ["#231c17", "#5c3a24", "#a3602f", "#d97757"];
function heatColor(l) { return HEAT_COLORS[l] || HEAT_COLORS[0]; }


// Admin broadcast popup — which id this device has already dismissed, so a re-check
// (poll, reload, relaunch) doesn't show the same announcement again.
const BROADCAST_SEEN_KEY = "tg_broadcast_seen";
function readBroadcastSeen() { try { return localStorage.getItem(BROADCAST_SEEN_KEY); } catch (e) { return null; } }
function markBroadcastSeen(id) { try { localStorage.setItem(BROADCAST_SEEN_KEY, String(id)); } catch (e) {} }

// Auto Teaching tip history (local, same pattern as the practice/activity logs above) —
// powers the small "recent tips" dashboard list. Not synced server-side.
const AUTOTEACH_LOG_KEY = "tg_autoteach_log";
function readAutoTeachLog() { try { return JSON.parse(localStorage.getItem(AUTOTEACH_LOG_KEY) || "[]") || []; } catch (e) { return []; } }
function logAutoTeachTip(weakness, tip, feature) {
  try {
    const log = readAutoTeachLog();
    log.push({ t: Date.now(), d: dayKey(), weakness: String(weakness || ""), tip: String(tip || ""), feature: feature || "pathway" });
    localStorage.setItem(AUTOTEACH_LOG_KEY, JSON.stringify(log.slice(-50)));
  } catch (e) {}
}
// friendly display label for an activity entry (drill ids, "stage/key" lessons, …)
function actTopicLabel(e, lang) {
  if (e.k === "lesson" || e.k === "read-chapter") {
    const [sid, key] = e.id.split("/");
    const st = PATHWAY.find(s => s.id === sid);
    const base = st ? tr(st.title, lang) : sid;
    return key ? base + " · " + key.toUpperCase() : base;
  }
  if (e.k === "game") {
    const all = [...SONGS, ...MAJOR_SCALE_SONGS, ...INTERVAL_SONGS,
      ...Object.values(MINOR_SCALE_SONGS).flat(), ...Object.values(TRIAD_SONGS).flat(), ...Object.values(SEVENTH_SONGS).flat()];
    const s = all.find(x => x.id === e.id);
    return s ? tr(s, lang) : e.id;
  }
  if (e.k === "ear") return (lang === "th" ? "ยิมหู · " : lang === "zh" ? "听力房 · " : "Ear gym · ") + e.id;
  if (e.k === "read") return (lang === "th" ? "อ่านโน้ต · " : lang === "zh" ? "识谱 · " : "Reading · ") + e.id;
  if (e.k === "voice") return lang === "th" ? "คาบเรียนโหมดเสียง" : lang === "zh" ? "语音课" : "Voice lesson";
  return e.id;
}
// find the runnable game/drill meta for an activity entry (for "practice this now")
function actSongOf(e) {
  if (e.k !== "game") return null;
  const all = [...SONGS, ...MAJOR_SCALE_SONGS, ...INTERVAL_SONGS,
    ...Object.values(MINOR_SCALE_SONGS).flat(), ...Object.values(TRIAD_SONGS).flat(), ...Object.values(SEVENTH_SONGS).flat()];
  return all.find(x => x.id === e.id) || null;
}

/* ── "Practice Today" plan — deterministic per calendar day ── */
function daySeed() { return [...dayKey()].reduce((s, c) => s + c.charCodeAt(0), 0); }
function todayEntries() { const d = dayKey(); return readActLog().filter(e => e.d === d); }
function hwDoneToday() { try { return localStorage.getItem("tg_hw_done") === dayKey(); } catch (e) { return false; } }
function markHwDone() { try { localStorage.setItem("tg_hw_done", dayKey()); } catch (e) {} }
function todayBonusClaimed() { try { return localStorage.getItem("tg_today_bonus") === dayKey(); } catch (e) { return false; } }
function claimTodayBonus() { try { localStorage.setItem("tg_today_bonus", dayKey()); } catch (e) {} }

/* ── Reading-course progress (stars per level) ── */
function readCourseStars() { try { return JSON.parse(localStorage.getItem("tg_readcourse") || "{}") || {}; } catch (e) { return {}; } }
function setReadCourseStars(lvl, stars) {
  try { const s = readCourseStars(); if ((s[lvl] || 0) < stars) { s[lvl] = stars; localStorage.setItem("tg_readcourse", JSON.stringify(s)); } } catch (e) {}
}
/* ── Ear-gym personal bests ── */
function earBest() { try { return JSON.parse(localStorage.getItem("tg_eargym") || "{}") || {}; } catch (e) { return {}; } }
function setEarBest(game, score) {
  try { const s = earBest(); if ((s[game] || 0) < score) { s[game] = score; localStorage.setItem("tg_eargym", JSON.stringify(s)); } } catch (e) {}
}

/* ════════════════════════════════════════════════════════════
   CERTIFICATES & SHARE CARDS — drawn on a canvas so the learner gets a
   real PNG they can keep, print, or post. No servers, no libraries.
════════════════════════════════════════════════════════════ */
function downloadDataURL(url, fname) {
  try { const a = document.createElement("a"); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {}
}
async function renderCertificatePNG({ name, course, dateStr, lang }) {
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
  const W = 1200, H = 850;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const bg = x.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1c1b19"); bg.addColorStop(0.55, "#0d0d0c"); bg.addColorStop(1, "#171514");
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  // twin border
  x.strokeStyle = "#d97757"; x.lineWidth = 3; x.strokeRect(28, 28, W - 56, H - 56);
  x.strokeStyle = "#d9775788"; x.lineWidth = 1.5; x.strokeRect(44, 44, W - 88, H - 88);
  // corner sparks
  x.fillStyle = "#d97757";
  for (const [cx, cy] of [[44, 44], [W - 44, 44], [44, H - 44], [W - 44, H - 44]]) {
    x.beginPath(); x.arc(cx, cy, 5, 0, Math.PI * 2); x.fill();
  }
  x.textAlign = "center";
  x.fillStyle = "#d97757";
  x.font = "700 30px Orbitron, sans-serif";
  x.fillText("TG · TIGA.AI PIANO ACADEMY", W / 2, 118);
  x.fillStyle = "#faf9f5";
  x.font = "900 64px Orbitron, sans-serif";
  x.fillText(lang === "th" ? "ประกาศนียบัตร" : lang === "zh" ? "结业证书" : "CERTIFICATE", W / 2, 226);
  x.fillStyle = "#a8a49b";
  x.font = "600 26px Rajdhani, sans-serif";
  x.fillText(lang === "th" ? "มอบให้เพื่อรับรองว่า" : lang === "zh" ? "兹证明" : "This certifies that", W / 2, 300);
  x.fillStyle = "#d97757";
  x.font = "700 58px Rajdhani, sans-serif";
  x.fillText(name, W / 2, 386);
  x.strokeStyle = "#d9775755"; x.lineWidth = 1;
  x.beginPath(); x.moveTo(W / 2 - 300, 408); x.lineTo(W / 2 + 300, 408); x.stroke();
  x.fillStyle = "#a8a49b";
  x.font = "600 26px Rajdhani, sans-serif";
  x.fillText(lang === "th" ? "ได้เรียนจบหลักสูตร" : lang === "zh" ? "已完成课程" : "has successfully completed", W / 2, 464);
  x.fillStyle = "#faf9f5";
  x.font = "700 40px Rajdhani, sans-serif";
  x.fillText(course, W / 2, 528);
  x.fillStyle = "#8f8b82";
  x.font = "500 22px Rajdhani, sans-serif";
  x.fillText((lang === "th" ? "เส้นทางเรียนรู้เปียโน TiGA · " : lang === "zh" ? "TiGA 钢琴学习之路 · " : "TiGA Piano Pathway of Learning · ") + dateStr, W / 2, 596);
  // signature block
  x.strokeStyle = "#a8a49b66"; x.beginPath(); x.moveTo(W / 2 - 170, 700); x.lineTo(W / 2 + 170, 700); x.stroke();
  x.fillStyle = "#d97757";
  x.font = "700 26px Orbitron, sans-serif";
  x.fillText("TiGA AI", W / 2, 738);
  x.fillStyle = "#8f8b82";
  x.font = "500 19px Rajdhani, sans-serif";
  x.fillText(lang === "th" ? "ครูผู้สอน — TiGA AI Piano Studio" : lang === "zh" ? "指导老师 — TiGA AI 钢琴工作室" : "Instructor — TiGA AI Piano Studio", W / 2, 768);
  return c.toDataURL("image/png");
}
async function renderWeeklyPNG({ name, mins, days, acc, topics, streak, lang }) {
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
  const W = 1080, H = 1080;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d");
  const bg = x.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1c1b19"); bg.addColorStop(1, "#0d0d0c");
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  x.strokeStyle = "#d97757"; x.lineWidth = 3; x.strokeRect(26, 26, W - 52, H - 52);
  x.textAlign = "center";
  x.fillStyle = "#d97757"; x.font = "700 30px Orbitron, sans-serif";
  x.fillText("TG · TIGA.AI", W / 2, 112);
  x.fillStyle = "#faf9f5"; x.font = "900 56px Orbitron, sans-serif";
  x.fillText(lang === "th" ? "สมุดพกประจำสัปดาห์" : lang === "zh" ? "本周成绩单" : "WEEKLY REPORT", W / 2, 200);
  x.fillStyle = "#d97757"; x.font = "700 44px Rajdhani, sans-serif";
  x.fillText(name, W / 2, 272);
  const rows = [
    [lang === "th" ? "นาทีที่ซ้อม" : lang === "zh" ? "练习分钟" : "Minutes practiced", String(mins)],
    [lang === "th" ? "วันที่ได้ซ้อม" : lang === "zh" ? "练习天数" : "Days practiced", days + " / 7"],
    [lang === "th" ? "ความแม่นยำ" : lang === "zh" ? "准确率" : "Accuracy", acc == null ? "—" : acc + "%"],
    [lang === "th" ? "หัวข้อที่เรียน" : lang === "zh" ? "学习主题" : "Topics studied", String(topics)],
    [lang === "th" ? "สตรีคต่อเนื่อง" : lang === "zh" ? "连续打卡" : "Streak", streak + (lang === "th" ? " วัน" : lang === "zh" ? " 天" : " days")],
  ];
  let y = 380;
  for (const [k, v] of rows) {
    x.fillStyle = "#171615cc";
    x.fillRect(120, y - 52, W - 240, 84);
    x.strokeStyle = "#ffffff18"; x.lineWidth = 1; x.strokeRect(120, y - 52, W - 240, 84);
    x.textAlign = "left"; x.fillStyle = "#a8a49b"; x.font = "600 30px Rajdhani, sans-serif";
    x.fillText(k, 152, y + 2);
    x.textAlign = "right"; x.fillStyle = "#d97757"; x.font = "800 40px Orbitron, sans-serif";
    x.fillText(v, W - 152, y + 4);
    y += 118;
  }
  x.textAlign = "center";
  x.fillStyle = "#8f8b82"; x.font = "500 24px Rajdhani, sans-serif";
  x.fillText(lang === "th" ? "เรียนเปียโนกับครู AI ที่ TiGA AI" : lang === "zh" ? "在 TiGA AI 与 AI 老师学钢琴" : "Learning piano with an AI teacher at TiGA AI", W / 2, H - 96);
  return c.toDataURL("image/png");
}

/* ── coins (soft currency) + daily reward chest, all localStorage ── */
export function getCoins() { try { return +(localStorage.getItem("tg_coins") || 0); } catch (e) { return 0; } }
export function setCoinsLS(v) { try { localStorage.setItem("tg_coins", String(Math.max(0, Math.round(v)))); } catch (e) {} }
export function chestAvailable() { try { return localStorage.getItem("tg_chest_date") !== dayKey(); } catch (e) { return false; } }
function chestStreak() { try { return +(localStorage.getItem("tg_chest_streak") || 0); } catch (e) { return 0; } }
export function claimChest() {
  let streak = 1;
  try {
    const last = localStorage.getItem("tg_chest_date");
    const y = new Date(); y.setDate(y.getDate() - 1);
    streak = last === dayKey(y) ? chestStreak() + 1 : 1;
    localStorage.setItem("tg_chest_date", dayKey());
    localStorage.setItem("tg_chest_streak", String(streak));
  } catch (e) {}
  const day = ((streak - 1) % 7) + 1;            // base escalates across a 7-day cycle
  // VARIABLE reward (variable-ratio reinforcement — the habit-forming core):
  const r = Math.random();
  let mult, kind;
  if (r < 0.05) { mult = 5; kind = "jackpot"; }       // 5% jackpot
  else if (r < 0.22) { mult = 2; kind = "big"; }      // 17% big
  else { mult = 1 + Math.random() * 0.6; kind = "normal"; } // variable 1x–1.6x
  return { coins: Math.round(20 * day * mult), exp: Math.round(15 * day * mult), streak, day, kind };
}

/* Spin-wheel presentation for the chest above — the reward MATH is already fully
   resolved by claimChest() before the wheel ever spins; this only picks which of
   the wheel's 8 fixed wedges to land the pointer on, so the animation always
   agrees with the real payout (never "looks like jackpot, pays normal"). */
const CHEST_WHEEL = ["normal", "normal", "big", "normal", "jackpot", "normal", "big", "normal"];
export function chestSpinAngle(kind) {
  const idxs = CHEST_WHEEL.map((k, i) => k === kind ? i : -1).filter(i => i >= 0);
  const idx = idxs[Math.floor(Math.random() * idxs.length)];
  const center = idx * 45 + 22.5; // ° clockwise from the pointer at top (0°)
  return 5 * 360 - center; // a few extra full spins, landing exactly on `center`
}

/* ── engagement streak (consecutive practice days) + streak-freeze ── */
function readStreak() { try { return JSON.parse(localStorage.getItem("tg_streak") || "null") || { count: 0, last: "", freezes: 0 }; } catch (e) { return { count: 0, last: "", freezes: 0 }; } }
function writeStreak(s) { try { localStorage.setItem("tg_streak", JSON.stringify(s)); } catch (e) {} }
function bumpStreak() {  // call when the learner actually practices
  const s = readStreak(), today = dayKey();
  if (s.last === today) return s;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const y2 = new Date(); y2.setDate(y2.getDate() - 2);
  if (s.last === dayKey(y)) s.count = (s.count || 0) + 1;
  else if (s.last === dayKey(y2) && (s.freezes || 0) > 0) { s.count = (s.count || 0) + 1; s.freezes -= 1; }
  else s.count = 1;
  s.last = today; writeStreak(s); return s;
}
function streakAtRisk() { const s = readStreak(); return (s.count || 0) > 0 && s.last !== dayKey(); }
export function addFreeze(n) { const s = readStreak(); s.freezes = (s.freezes || 0) + n; writeStreak(s); return s; }
function grantMonthlyFreezes() {
  try {
    if (!isMaxPlan()) return;
    const mk = new Date().toISOString().slice(0, 7);
    if (localStorage.getItem("tg_freeze_month") === mk) return;
    addFreeze(4);
    localStorage.setItem("tg_freeze_month", mk);
  } catch (e) {}
}

// the teacher's own forward plan for the NEXT lesson — set via [plan: …], recalled every session
function readLessonPlan() { try { return JSON.parse(localStorage.getItem("tg_lessonplan") || "null"); } catch (e) { return null; } }
export function setLessonPlanLS(p) { try { p ? localStorage.setItem("tg_lessonplan", JSON.stringify(p)) : localStorage.removeItem("tg_lessonplan"); } catch (e) {} }
// A human teacher teaches TO A SYLLABUS, not turn by turn. This injects the
// learner's REAL position in the app's own Pathway curriculum (stages done,
// keys studied, what's next) plus the teacher's saved next-lesson plan — so the
// voice teacher always knows where this student is on the road, like a human
// who keeps a notebook per student.
export function curriculumContext(lang) {
  try {
    const done = pathDoneSet();
    const keys = keyDoneMap();
    // Skip the "advanced" group here too (extended/tension harmony, block/slash/pad-
    // chord voicings) — matches nextRecommendedAction()'s own boundary, so the Voice
    // Tutor's sense of "current/next stage" never drifts ahead of what AI Mentor
    // itself would ever actively recommend.
    const cur = PATHWAY.find(s => !done.has(s.id) && s.group !== "advanced") || null;
    const nxt = cur ? PATHWAY.find((s, i) => i > PATHWAY.indexOf(cur) && s.group !== "advanced") : null;
    const parts = [];
    parts.push((lang === "th" ? "ผ่านแล้ว " : lang === "zh" ? "已完成 " : "Stages done: ") + done.size + "/" + PATHWAY.length);
    if (cur) {
      const kd = keys[cur.id] || [];
      parts.push((lang === "th" ? "ขั้นปัจจุบัน: " : lang === "zh" ? "当前阶段: " : "Current stage: ") + tr(cur.title, lang) + (kd.length ? ` (${lang === "th" ? "คีย์ที่เรียนแล้ว" : lang === "zh" ? "已学调" : "keys learned"}: ${kd.join(", ")})` : ""));
    }
    if (nxt) parts.push((lang === "th" ? "ขั้นถัดไป: " : lang === "zh" ? "下一阶段: " : "Next stage: ") + tr(nxt.title, lang));
    const action = nextRecommendedAction();
    if (action.type === "fundamentals") {
      const fLabel = action.feature === "hand_coach" ? L[lang].studioCamera : action.feature === "ear_training" ? L[lang].navEar : L[lang].studioPlayAlong;
      parts.push((lang === "th" ? "ผู้เรียนเพิ่งเริ่มต้น — ควรเน้น: " : lang === "zh" ? "学员刚起步 — 应重点: " : "Learner is brand new — priority: ") + fLabel
        + (lang === "th" ? " (ยังไม่ควรสอนทฤษฎีเปียโนซับซ้อน เน้นพื้นฐานจับต้องได้ก่อน)" : lang === "zh" ? "（还不适合讲复杂乐理，先打好实际基础）" : " (hold off on complex theory — focus on hands-on fundamentals first)"));
    } else if (action.type === "remediate") {
      parts.push((lang === "th" ? "จุดที่ควรเน้นตอนนี้: " : lang === "zh" ? "当前应重点加强: " : "Priority right now: ") + tr(SKILL_LABELS[action.skill], lang)
        + (lang === "th" ? " (คะแนนยังอ่อน — แนะนำให้ฝึกจุดนี้ก่อนเรื่องใหม่ แต่ไม่บังคับ)" : lang === "zh" ? "（得分偏弱 — 建议先练这里，但不强制）" : " (a weak score — recommend practicing this before new content, but don't force it)"));
    } else if (action.type === "new_song" || action.type === "replay_song") {
      parts.push((lang === "th" ? "เรียนจบหลักสูตรพื้นฐานทั้งหมดแล้ว — ลองแนะนำเพลง: " : lang === "zh" ? "已学完所有基础课程 — 可以建议歌曲: " : "Finished the whole non-advanced curriculum — consider suggesting the song: ") + tr(action.song, lang));
    }
    const plan = readLessonPlan();
    if (plan && plan.text) parts.push((lang === "th" ? "แผนคาบนี้ที่คุณตั้งไว้: " : lang === "zh" ? "你为本课定的计划: " : "Your saved plan for this lesson: ") + plan.text);
    const guide = lang === "th"
      ? "จัดคาบให้เดินตามหลักสูตรนี้ทีละขั้น เริ่มด้วยวอร์มอัพสั้น ๆ ที่เข้ากับขั้นปัจจุบันก่อนเสมอ และก่อนจบคาบให้ตั้งแผนคาบหน้าด้วย [plan: ...]"
      : lang === "zh"
      ? "按此大纲逐级授课，开课先做贴合当前阶段的简短热身，下课前用 [plan: ...] 定好下节课计划"
      : "Run the lesson along this syllabus, always open with a short warm-up matched to the current stage, and before ending set next lesson's plan with [plan: ...]";
    const lbl = lang === "th" ? "หลักสูตรของผู้เรียน" : lang === "zh" ? "学员课程进度" : "Learner's curriculum";
    return "\n\n[" + lbl + ": " + parts.join(" · ") + ". " + guide + "]";
  } catch (e) { return ""; }
}

// Auto Teaching (Max-only real-time coaching popups): resolve the effective interval in
// minutes — the learner's own override if they picked one, else the admin's platform
// default, else a safe built-in fallback. 0 = off.
const AUTO_TEACH_FALLBACK_MIN = 15;
const AUTO_TEACH_INTERVALS = [5, 10, 15, 30, 60];
function resolveAutoTeachMin(profile, adminDefaultMin) {
  const own = profile && profile.auto_teach_interval_min;
  if (own != null) return own;
  if (adminDefaultMin != null) return adminDefaultMin;
  return AUTO_TEACH_FALLBACK_MIN;
}

// Fixed, safe set of real in-app destinations the AI coach can point a learner to — the
// model only ever picks a KEY from this list (never invents one), and the actual navigation
// for each key is wired up in PianoApp, so a recommendation is always a working link.
// Gathers the same data the Profile page's own dashboards (My Stats heatmap/trend, badges,
// daily quest, streak) are built from, as a plain structured object — the single source
// both the AI prompt text (coachStatsToText below) and Daily Mentor's on-screen chart
// render from, so what the learner reads and what the AI reasons over never disagree.
// Reuses the exact aggregation InsightsPage already uses for "My Stats".
// Learning Intelligence: per-skill scoring, derived from tg_act_log entries.
// Most skills are inferred from the existing kind+id (no new logging call
// sites needed); Dynamics/Rhythm/Technique are captured via an explicit
// `skill` tag on the entry (see logActivity's 6th param) at the few new call
// sites that actually measure them. Improvisation still has no capture path
// at all today and stays deliberately absent rather than faked.
const SKILLS = ["note_accuracy", "sight_reading", "ear_training", "chord_knowledge", "dynamics", "rhythm", "technique"];
const SKILL_LABELS = {
  note_accuracy: { th: "ความแม่นยำโน้ต", en: "Note Accuracy", zh: "音符准确度" },
  sight_reading: { th: "การอ่านโน้ต (Sight Reading)", en: "Sight Reading", zh: "视奏（Sight Reading）" },
  ear_training: { th: "โสตประสาท (Ear Training)", en: "Ear Training", zh: "听力训练（Ear Training）" },
  // framed honestly — this measures identifying a chord's quality by ear, not chord theory recall
  chord_knowledge: { th: "การฟังแยกคอร์ด", en: "Chord Recognition (by ear)", zh: "和弦听辨" },
  // MIDI-only (mic input can't supply loudness — see scoreDynamics) — measures
  // touch consistency, not any single "correct" volume
  dynamics: { th: "การควบคุมน้ำหนักเสียง (Dynamics)", en: "Dynamics Control", zh: "力度控制（Dynamics）" },
  rhythm: { th: "จังหวะ (Rhythm)", en: "Rhythm", zh: "节奏感（Rhythm）" },
  // narrow proxy — hand curvature/shape while playing, not full technique
  technique: { th: "ท่ามือ (Hand Shape)", en: "Hand Technique", zh: "手型（Technique）" },
};
function skillsOfActivity(e) {
  if (e.skill) return [e.skill]; // explicit tag (Dynamics/Rhythm/Technique) — trust it over the kind/id guess below
  switch (e.k) {
    case "drill": case "game": return ["note_accuracy"];
    case "read": return ["sight_reading"];
    // Ear Gym's "chord" tab is the only place chord *correctness* (not just
    // viewing a lesson) is ever measured — it doubles as the sole Chord
    // Knowledge signal, framed to the learner as "chord recognition by ear".
    case "ear": return e.id === "chord" ? ["ear_training", "chord_knowledge"] : ["ear_training"];
    default: return []; // "voice"/"lesson"/"read-chapter" carry no correctness signal
  }
}
const SKILL_MIN_N = 8;            // fewer attempts than this -> null ("not enough data"), never a guessed number
const SKILL_HALFLIFE_DAYS = 14;   // recent practice counts more; mirrors computeCoachStats' own 7-day/prev-7-day cadence
function computeSkillScores() {
  const log = readActLog(), now = Date.now();
  const buckets = {};
  for (const e of log) {
    if (e.ok + e.miss < 1) continue;
    const w = Math.pow(0.5, (now - e.t) / 86400000 / SKILL_HALFLIFE_DAYS);
    for (const sk of skillsOfActivity(e)) {
      const b = buckets[sk] || (buckets[sk] = { wOk: 0, wTot: 0, n: 0 });
      b.wOk += e.ok * w; b.wTot += (e.ok + e.miss) * w; b.n += e.ok + e.miss;
    }
  }
  return SKILLS.map(sk => {
    const b = buckets[sk];
    return { skill: sk, score: b && b.n >= SKILL_MIN_N ? Math.round(b.wOk / b.wTot * 100) : null, n: b ? b.n : 0 };
  });
}
function weakestSkills(scores, n = 2) {
  return scores.filter(s => s.score != null).sort((a, b) => a.score - b.score).slice(0, n);
}
// Dynamics scoring (MIDI velocity only — mic input's autoGainControl flattens
// loudness before it ever reaches the pitch detector, so there's nothing to
// measure from a mic session). There's no single "correct" volume for a
// piece, so this measures touch *consistency* — how close each note's
// velocity stayed to the session's own average — not an absolute target.
export function scoreDynamics(vels) {
  if (!vels || vels.length < 5) return null;
  const mean = vels.reduce((s, v) => s + v, 0) / vels.length;
  let ok = 0, miss = 0;
  for (const v of vels) { if (Math.abs(v - mean) <= mean * 0.35) ok++; else miss++; }
  return { ok, miss };
}
function computeCoachStats(profile, lang) {
  const log = readActLog();
  const now = Date.now(), dayMs = 86400000;
  let ok7 = 0, miss7 = 0, sec7 = 0, okPrev = 0, missPrev = 0;
  const days7 = new Set();
  const byTopic = {};
  for (const e of log) {
    if (e.t >= now - 7 * dayMs) {
      ok7 += e.ok; miss7 += e.miss; sec7 += e.sec;
      if (e.sec > 0 || e.ok > 0) days7.add(e.d);
    } else if (e.t >= now - 14 * dayMs) {
      okPrev += e.ok; missPrev += e.miss;
    }
    if (e.k !== "voice" && e.ok + e.miss >= 1) {
      const key = e.k + "|" + e.id;
      const b = byTopic[key] || (byTopic[key] = { e, ok: 0, miss: 0 });
      b.ok += e.ok; b.miss += e.miss;
    }
  }
  const acc7 = ok7 + miss7 > 0 ? Math.round(ok7 / (ok7 + miss7) * 100) : null;
  const accPrev = okPrev + missPrev > 0 ? Math.round(okPrev / (okPrev + missPrev) * 100) : null;
  const weakest = Object.values(byTopic)
    .filter(b => b.ok + b.miss >= 4 && b.miss > 0)
    .map(b => ({ label: actTopicLabel(b.e, lang), rate: Math.round(b.miss / (b.ok + b.miss) * 100), n: b.ok + b.miss }))
    .sort((a, b) => b.rate - a.rate).slice(0, 5);
  const info = levelInfo((profile && profile.exp) || 0);
  // per-day breakdown for 7 days (index 0 = 6 days ago, index 6 = today)
  const daily = [];
  for (let i = 6; i >= 0; i--) {
    const dKey = dayKey(new Date(now - i * dayMs));
    const de = log.filter(e => e.d === dKey);
    const dok = de.reduce((s, e) => s + e.ok, 0);
    const dmiss = de.reduce((s, e) => s + e.miss, 0);
    const dsec = de.reduce((s, e) => s + e.sec, 0);
    daily.push({ dKey, practiced: de.length > 0, acc: dok + dmiss > 0 ? Math.round(dok / (dok + dmiss) * 100) : null, min: Math.round(dsec / 60) });
  }
  return {
    level: info.level, streak: (profile && profile.streak) || 0, lessonsDone: (profile && profile.lessons_done) || 0,
    badgeCount: unlockedBadgeIds(profile).length, badgeTotal: BADGES.length, questOk: questToday(profile) >= QUEST_GOAL,
    days7: days7.size, min7: Math.round(sec7 / 60), acc7, accPrev, weakest, daily, skills: computeSkillScores(),
  };
}
function coachStatsToText(s) {
  const weakestTxt = s.weakest.length ? s.weakest.map(w => `${w.label} (${w.rate}% miss over ${w.n} tries)`).join("; ") : "none with enough attempts yet";
  const skillsTxt = s.skills.filter(sk => sk.score != null).map(sk => `${sk.skill}: ${sk.score}/100`).join(", ") || "not enough data yet for any skill";
  return `Level ${s.level}, ${s.streak}-day streak, ${s.lessonsDone} lessons completed, ${s.badgeCount}/${s.badgeTotal} badges earned, today's quest ${s.questOk ? "done" : "not done yet"}. Last 7 days: practiced ${s.days7}/7 days (${s.min7} min total), accuracy ${s.acc7 == null ? "no data" : s.acc7 + "%"}${s.accPrev != null ? ` (previous week was ${s.accPrev}%)` : ""}. Weakest topics by miss rate across all history: ${weakestTxt}. Skill scores (0-100, higher is better): ${skillsTxt}.`;
}
// Shared core of the AI coaching analysis — used by both the Auto Teaching popup (timer-driven,
// PianoApp) and the dedicated Coach nav page (on-demand, CoachPage). Module-level (not inside
// either component) since it only needs `lang`/`profile` and the module-level helpers above.
async function generateCoachTip(lang, profile) {
  const mem = readMemory();
  const struggle = (mem.struggles || [])[0];
  const recentTxt = (mem.recent || []).slice(0, 5).map(r => `${r.label} (${r.acc}%)`).join(", ") || "—";
  const struggleTxt = struggle ? `${struggle.label} (${struggle.acc}%, missed ${struggle.count}x)` : "—";
  const profileTxt = coachStatsToText(computeCoachStats(profile, lang));
  const featureKeys = Object.keys(COACH_FEATURE_LABELS).join(", ");
  // Short system = far fewer tokens → avoids Gemini rate-limit. All learner data goes in
  // message. Persona/tone line added deliberately (researched): specialized in absolute
  // beginners, praise-before-correction, always specific, never advanced theory — still
  // one short paragraph, not a token-heavy prompt.
  const sysByLang = {
    th: `คุณคือครูเปียโน TiGA ผู้เชี่ยวชาญสอนคนเริ่มต้นจากศูนย์โดยเฉพาะ ชมสิ่งที่ทำได้ดีก่อนเสมอแล้วค่อยแนะนำจุดที่ควรฝึกต่อ ให้กำลังใจมากกว่าตำหนิ ไม่แนะนำทฤษฎีขั้นสูง เจาะจงเสมอไม่พูดกว้างๆ ตอบเป็น JSON ดิบเท่านั้น ไม่มีข้อความอื่น: {"weakness":"...","steps":["...","...","..."],"feature":"..."}`,
    zh: `你是TiGA钢琴AI老师，专门教零基础初学者。总是先表扬做得好的地方，再给出下一步建议，鼓励多于批评，不要建议高阶乐理，反馈必须具体。只回原始JSON，无其他文字：{"weakness":"...","steps":["...","...","..."],"feature":"..."}`,
    en: `You are TiGA AI piano teacher, specialized in teaching absolute beginners from zero. Always acknowledge what's going well before suggesting what's next, encouraging not critical, never suggest advanced theory, always specific never generic. Reply ONLY with raw JSON, no other text: {"weakness":"...","steps":["...","...","..."],"feature":"..."}`,
  };
  const msgByLang = {
    th: `ข้อมูลผู้เรียน: ${profileTxt}\nซ้อมล่าสุด: ${recentTxt}\nจุดอ่อน: ${struggleTxt}\nfeature ที่เลือกได้: ${featureKeys}\n\nวิเคราะห์แล้วตอบ JSON: weakness ไม่เกิน 12 คำ, steps สูงสุด 3 ข้อ (เจาะจงชื่อเพลง/หัวข้อ ไม่ใช่คำแนะนำทั่วไป), feature เลือกจากรายการเท่านั้น`,
    zh: `学员数据：${profileTxt}\n最近练习：${recentTxt}\n薄弱点：${struggleTxt}\n可选feature：${featureKeys}\n\n分析后回JSON：weakness≤12字，steps最多3条（具体指明曲目/主题），feature必须从列表选`,
    en: `Learner data: ${profileTxt}\nRecent sessions: ${recentTxt}\nWeak spot: ${struggleTxt}\nAvailable features: ${featureKeys}\n\nAnalyze and reply JSON: weakness ≤12 words, steps max 3 (name specific song/topic, not generic advice), feature from list only`,
  };
  const sys = sysByLang[lang] || sysByLang.en;
  const msg = msgByLang[lang] || msgByLang.en;
  // One attempt: fetch + pull the JSON substring out of the model's text. Wrapped so
  // any failure (network, non-JSON reply, a stray markdown fence, extra prose around
  // the object) degrades to null instead of throwing — the retry below tries once
  // more rather than letting a single flaky reply surface as a hard error.
  async function attempt() {
    try {
      const txt = await fetchChatCompletion({ message: msg, conversationHistory: [], system: sys, stream: false });
      if (!txt) return null;
      const fenced = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const body2 = fenced ? fenced[1] : txt;
      const m = body2.match(/\{[\s\S]*\}/);
      return m ? m[0] : null;
    } catch (e) { return null; }
  }
  const isValidTxt = t => { try { const o = JSON.parse(t); return !!(o && o.weakness && Array.isArray(o.steps) && o.steps.length); } catch (e) { return false; } };
  // Cached for an hour, content-addressed on the exact prompt sent — if the learner
  // does more practice in the meantime, profileTxt/recentTxt/struggleTxt (baked into
  // msg) change, the hash changes, and this naturally misses instead of serving
  // stale advice. Protects repeat opens of the Auto Teaching popup / CoachPage's
  // on-demand button against re-paying for an unchanged tip. Never caches a failed
  // pair of attempts (withAiCache only stores a truthy result), so a flaky reply
  // still gets a fresh real retry on the next call rather than replaying null.
  const jsonTxt = await withAiCache("coachTip", { msg, sys }, 60 * 60 * 1000, async () => {
    let t = await attempt();
    if (!isValidTxt(t)) t = await attempt(); // a single malformed/non-JSON reply shouldn't be a dead end
    return isValidTxt(t) ? t : null;
  });
  if (!jsonTxt) return null;
  const obj = JSON.parse(jsonTxt);
  if (!COACH_FEATURE_LABELS[obj.feature]) obj.feature = "pathway"; // guard against a hallucinated key
  obj.steps = obj.steps.slice(0, 3); // enforce the "at most 3" cap even if the model overshoots
  return obj;
}
// Adaptive routing: a soft nudge toward fixing a critically weak skill instead
// of always pushing new Pathway content — never a hard block, "something new"
// stays one tap away regardless (see recommendNext/TodayPage call sites).
// Note Accuracy/Dynamics/Rhythm have no single dedicated remediation
// destination (they're practiced everywhere already), so they're surfaced via
// the skill callouts/AI narrative but deliberately can't redirect navigation.
const CRITICAL_SKILL_SCORE = 55; // starting guess — tune once there's real usage data
const SKILL_REMEDIATION = {
  sight_reading: "reading_course", ear_training: "ear_training", chord_knowledge: "ear_training",
  technique: "hand_coach",
};
// Absolute-beginner fundamentals, in the order real beginner-piano method books use
// (hand position -> hands-on rhythm/playing -> simple ear work -> only then theory) —
// researched against Faber Piano Adventures' Primer sequence. PATHWAY itself has no
// true from-zero content to offer here: its "skill" stages are music theory that
// already assumes note-reading (stage 1 covers scale-formula theory and thumb-under
// fingering), so a genuinely new learner is routed through features that already
// exist elsewhere in the app instead, before ever reaching Pathway's theory stages.
const FUNDAMENTALS_SAMPLE_N = 6; // below this many total practiced (not just chatted/read) attempts, treat as starting from zero
function nextRecommendedAction() {
  const log = readActLog();
  const practicedN = log.filter(e => e.k === "drill" || e.k === "game" || e.k === "read" || e.k === "ear").length;
  if (practicedN < FUNDAMENTALS_SAMPLE_N) {
    if (!log.some(e => e.id === "hand_coach")) return { type: "fundamentals", feature: "hand_coach" };
    if (!log.some(e => e.k === "game")) return { type: "fundamentals", feature: "play_along" };
    if (!log.some(e => e.k === "ear")) return { type: "fundamentals", feature: "ear_training" };
  }
  const critical = computeSkillScores()
    .filter(s => s.score != null && s.score < CRITICAL_SKILL_SCORE && SKILL_REMEDIATION[s.skill])
    .sort((a, b) => a.score - b.score)[0];
  if (critical) return { type: "remediate", skill: critical.skill, feature: SKILL_REMEDIATION[critical.skill], score: critical.score };
  // Never actively route into PATHWAY's "advanced" group (extended/tension harmony,
  // block/slash/pad-chord voicings) — product decision to serve Super Basic/Basic/
  // Intermediate only for now. Still fully reachable by anyone who browses Pathway
  // themselves; just never pushed by the AI Mentor.
  const stage = PATHWAY.find(s => !pathDoneSet().has(s.id) && s.group !== "advanced");
  if (stage) return { type: "next_stage", stage };

  // Finished every non-advanced Pathway stage with no critical weakness — the
  // curriculum is "done," but the recommendation must never just shrug at this
  // point (a returning learner with nothing suggested is exactly the moment
  // retention dies). Keep cycling the song library instead: an unattempted
  // song first (easiest-first), then a replay of whatever attempted song
  // scored the fewest stars, before ever truly running out of ideas.
  const eligibleSongs = SONGS.filter(s => !s.maxOnly && !s.custom && !s.drill && s.seq && s.seq.length >= 6)
    .sort((a, b) => a.diff - b.diff);
  const attempted = new Set(readGameLog().map(g => g.song));
  const freshSong = eligibleSongs.find(s => !attempted.has(s.id));
  if (freshSong) return { type: "new_song", song: freshSong };

  const bestStarsBySong = {};
  for (const g of readGameLog()) {
    if (bestStarsBySong[g.song] == null || g.stars > bestStarsBySong[g.song]) bestStarsBySong[g.song] = g.stars;
  }
  const polishSong = eligibleSongs
    .filter(s => (bestStarsBySong[s.id] || 0) < 3)
    .sort((a, b) => (bestStarsBySong[a.id] || 0) - (bestStarsBySong[b.id] || 0))[0];
  if (polishSong) return { type: "replay_song", song: polishSong, stars: bestStarsBySong[polishSong.id] || 0 };

  return { type: "warmup" };
}
// RecommendationEngine — wraps nextRecommendedAction()'s decision into a richer,
// UI-ready shape (target/feature/duration/reason/action) instead of duplicating its
// signal computation. `difficulty` is deliberately left null: no real per-learner
// difficulty-tier signal exists anywhere in this app (see UX audit), so it's left
// honestly absent rather than a fabricated number.
function buildRecommendation(lang) {
  const action = nextRecommendedAction();
  if (action.type === "fundamentals") {
    // Praise-first, specific framing (researched: beginner-teaching feedback works
    // best at roughly a 5:1 encouragement-to-correction ratio, and specific beats
    // generic) — each of these names the concrete first-ever reason to do it, not
    // a vague "get started."
    const copyByFeature = {
      hand_coach: {
        th: "เริ่มจากสิ่งสำคัญที่สุดก่อนเลย: ท่าวางมือบนเปียโนที่ถูกต้อง — วางรากฐานตรงนี้ตั้งแต่ต้นจะเล่นได้คล่องขึ้นเร็วกว่ามาก",
        en: "Let's start with the single most important thing first: proper hand position at the piano — getting this right from day one pays off fast.",
        zh: "先从最重要的一件事开始：正确的弹琴手型 — 一开始就打好这个基础，进步会快很多。",
      },
      play_along: {
        th: "มาเล่นเพลงแรกกันเลย — จับคีย์จริง ฟังเสียงจริง นี่คือวิธีที่ดีที่สุดที่จะเริ่มคุ้นเคยกับเปียโน",
        en: "Time to play your first song — real keys, real sound. This is the best way to start getting comfortable at the piano.",
        zh: "来弹第一首歌吧 — 真实按键，真实声音，这是熟悉钢琴最好的方式。",
      },
      ear_training: {
        th: "ลองฝึกฟังเสียงง่ายๆ สักหน่อย — หูที่ไวจะช่วยให้ทุกเรื่องต่อจากนี้ง่ายขึ้นมาก",
        en: "A little ear training goes a long way — a trained ear makes everything else about playing easier.",
        zh: "练一点听力吧 — 敏锐的耳朵会让接下来的学习轻松很多。",
      },
    };
    const copy = copyByFeature[action.feature] || copyByFeature.hand_coach;
    return { type: "fundamentals", target: action.feature, feature: action.feature, duration: 5, difficulty: null, reason: copy[lang] || copy.en, action: "start" };
  }
  if (action.type === "remediate") {
    const label = tr(SKILL_LABELS[action.skill], lang);
    const reasonByLang = {
      th: `${label} กำลังไปได้ดี (${action.score}/100) — ฝึกเพิ่มอีกนิดวันนี้ จะเห็นความต่างชัดเลย`,
      en: `${label} is coming along (${action.score}/100) — a bit more practice today and you'll feel the difference.`,
      zh: `${label}正在进步中（${action.score}/100）— 今天再练一点，会明显感觉到不同。`,
    };
    return { type: "remediate", target: action.skill, feature: action.feature, skill: action.skill, duration: 5, difficulty: null, reason: reasonByLang[lang] || reasonByLang.en, action: "start" };
  }
  if (action.type === "next_stage") {
    const title = tr(action.stage.title, lang);
    const reasonByLang = {
      th: `พร้อมสำหรับหัวข้อถัดไปแล้ว: ${title}`,
      en: `You're ready for the next topic: ${title}`,
      zh: `你已经准备好学习下一个主题：${title}`,
    };
    return { type: "next_stage", target: action.stage.id, feature: "pathway", duration: 8, difficulty: null, reason: reasonByLang[lang] || reasonByLang.en, action: "start", stage: action.stage };
  }
  if (action.type === "new_song") {
    const title = tr(action.song, lang);
    const reasonByLang = {
      th: `มาลองเพลงใหม่กันไหม: "${title}" — ยังไม่เคยเล่นเพลงนี้ และเหมาะกับระดับตอนนี้พอดี`,
      en: `Ready for a new song? "${title}" — you haven't tried this one yet, and it's a good fit for where you're at.`,
      zh: `来试试新歌吧："${title}" — 你还没弹过这首，难度也刚好适合你现在的水平。`,
    };
    return { type: "new_song", target: action.song.id, feature: "play_along", duration: 4, difficulty: null, reason: reasonByLang[lang] || reasonByLang.en, action: "start", song: action.song };
  }
  if (action.type === "replay_song") {
    const title = tr(action.song, lang);
    const reasonByLang = {
      th: `กลับไปฝึก "${title}" อีกรอบไหม — ครั้งก่อนได้ ${action.stars}/3 ดาว ลองทำให้ดีขึ้นอีกนิด`,
      en: `Want another go at "${title}"? You scored ${action.stars}/3 stars last time — a bit more practice could get you to full marks.`,
      zh: `再练一次"${title}"怎么样？上次拿到了${action.stars}/3颗星，再练练说不定能满分。`,
    };
    return { type: "replay_song", target: action.song.id, feature: "play_along", duration: 4, difficulty: null, reason: reasonByLang[lang] || reasonByLang.en, action: "start", song: action.song };
  }
  const reasonByLang = {
    th: "เยี่ยมมาก! ตอนนี้เรียนและฝึกจบทุกอย่างที่มีในระดับนี้แล้ว — มาวอร์มอัพเบาๆ กันต่อเพื่อรักษาฟอร์มไว้",
    en: "Amazing — you've completed everything we've got at this level! Let's keep the streak going with a light warm-up.",
    zh: "太棒了！这个级别的内容你都学完了 — 来轻松热身一下，保持状态吧。",
  };
  return { type: "warmup", target: null, feature: "play_along", duration: 3, difficulty: null, reason: reasonByLang[lang] || reasonByLang.en, action: "start" };
}
// Song-result-screen variant of buildRecommendation(): reacts to how the learner
// JUST did on THIS song specifically, rather than only the global cycle. Under
// 3 stars means they're not fluent on it yet, so say so and offer it again
// immediately — don't wait for the library to cycle back around to it. 3
// stars means they've got it, so defer to the normal engine (which now
// correctly excludes this song from "unattempted" and moves on).
function buildSongResultRecommendation(lang, songMeta, songResult) {
  if (songMeta && songResult && songResult.stars < 3) {
    const title = tr(songMeta, lang);
    const reasonByLang = {
      th: `เพลงนี้ยังไม่คล่องนัก (${songResult.stars}/3 ดาว) — ลองฝึก "${title}" อีกรอบก่อนไปต่อดีกว่า`,
      en: `You're not quite fluent on this one yet (${songResult.stars}/3 stars) — give "${title}" another go before moving on.`,
      zh: `这首还不太熟练（${songResult.stars}/3颗星）— 再练一次"${title}"，然后再继续吧。`,
    };
    return { type: "replay_song", target: songMeta.id, feature: "play_along", duration: 4, difficulty: null, reason: reasonByLang[lang] || reasonByLang.en, action: "start", song: songMeta };
  }
  return buildRecommendation(lang);
}
// Admin tier badge — ★★★ Top Tier / ★★ Ops / ★ Support / "" not an admin.
function adminTierStars(t) { return t >= 3 ? "★★★" : t === 2 ? "★★" : t === 1 ? "★" : ""; }
const FREE_LIMITS = { song: 2, critique: 3, compose: 2 };   // free actions per day
function usageToday(key) { try { const u = JSON.parse(localStorage.getItem("tg_usage") || "{}"); return u.d === dayKey() ? (u[key] || 0) : 0; } catch (e) { return 0; } }
function bumpUsage(key) { try { let u = JSON.parse(localStorage.getItem("tg_usage") || "{}"); if (u.d !== dayKey()) u = { d: dayKey() }; u[key] = (u[key] || 0) + 1; localStorage.setItem("tg_usage", JSON.stringify(u)); } catch (e) {} }
// `premium` must be the caller's real, server-synced plan state — never isPremium(),
// which reads raw localStorage. localStorage.setItem("tg_premium","1") is a one-line
// browser-console edit that would otherwise remove these daily caps on two endpoints
// that call a real, real-money AI backend (generateSong/critiqueRecording → piano-chat).
function canUse(key, premium) { return premium || usageToday(key) < (FREE_LIMITS[key] || 0); }




/* ── weekly challenges (rotating pool, localStorage, auto-rewarded) ──
   9 challenges across the 3 stats bumpWeekly() already tracks (games/exp/
   perfect) at 3 difficulty tiers each — every week's 3 active picks are
   derived deterministically from weekKey() (a simple hash, no server call),
   so every device/client picks the SAME 3 without needing to sync anything. */
const CHALLENGE_POOL = [
  { id: "games_s", type: "games",   goal: 3,   icon: "🎮", th: "เล่นเกม 3 รอบ",    en: "Play 3 games",    zh: "玩 3 局游戏" },
  { id: "games_m", type: "games",   goal: 8,   icon: "🎮", th: "เล่นเกม 8 รอบ",    en: "Play 8 games",    zh: "玩 8 局游戏" },
  { id: "games_l", type: "games",   goal: 15,  icon: "🕹️", th: "เล่นเกม 15 รอบ",   en: "Play 15 games",   zh: "玩 15 局游戏" },
  { id: "exp_s",   type: "exp",     goal: 150, icon: "✦",  th: "เก็บ 150 EXP",     en: "Earn 150 EXP",    zh: "赚 150 EXP" },
  { id: "exp_m",   type: "exp",     goal: 400, icon: "✦",  th: "เก็บ 400 EXP",     en: "Earn 400 EXP",    zh: "赚 400 EXP" },
  { id: "exp_l",   type: "exp",     goal: 900, icon: "💫", th: "เก็บ 900 EXP",     en: "Earn 900 EXP",    zh: "赚 900 EXP" },
  { id: "perf_s",  type: "perfect", goal: 15,  icon: "🎯", th: "ทำ 15 Perfect",   en: "Hit 15 Perfects", zh: "打出 15 完美" },
  { id: "perf_m",  type: "perfect", goal: 40,  icon: "🎯", th: "ทำ 40 Perfect",   en: "Hit 40 Perfects", zh: "打出 40 完美" },
  { id: "perf_l",  type: "perfect", goal: 80,  icon: "🏹", th: "ทำ 80 Perfect",   en: "Hit 80 Perfects", zh: "打出 80 完美" },
];
export const CHALLENGE_REWARD = 50;
export function weekKey(d = new Date()) {
  const x = dayDate(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day);
  return x.getFullYear() + "-" + (x.getMonth() + 1) + "-" + x.getDate();
}
function monthKey(d = new Date()) { const x = dayDate(d); return x.getFullYear() + "-" + (x.getMonth() + 1); }
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
/* This week's 3 active challenges — same result on every device for the same
   weekKey(), since it depends only on that string, never on local state. */
export function activeChallenges(wk = weekKey()) {
  const seed = hashStr(wk), n = CHALLENGE_POOL.length;
  const idxs = Array.from(new Set([seed % n, (seed * 7 + 3) % n, (seed * 13 + 11) % n]));
  for (let k = 17; idxs.length < 3; k++) { const c = (seed + k * 29) % n; if (!idxs.includes(c)) idxs.push(c); }
  return idxs.slice(0, 3).map(i => CHALLENGE_POOL[i]);
}
export function readWeekly() {
  try {
    const w = JSON.parse(localStorage.getItem("tg_weekly") || "{}");
    if (w && w.week === weekKey()) return w;
  } catch (e) {}
  return { week: weekKey(), games: 0, exp: 0, perfect: 0, claimed: [] };
}
export function writeWeekly(w) { try { localStorage.setItem("tg_weekly", JSON.stringify(w)); } catch (e) {} }

/* ── learning-pathway progress (journey map) ── */
function pathDoneSet() { try { return new Set(JSON.parse(localStorage.getItem("tg_path_done") || "[]")); } catch (e) { return new Set(); } }
function markPathDone(id) { try { const s = pathDoneSet(); s.add(id); localStorage.setItem("tg_path_done", JSON.stringify([...s])); } catch (e) {} }
/* Per-key learning record: which keys of each topic (scale/interval/chord/…) the
   learner has studied, so the pathway can show what's already been covered. */
function keyDoneMap() { try { return JSON.parse(localStorage.getItem("tg_key_done") || "{}") || {}; } catch (e) { return {}; } }
function markKeyDone(stageId, keyId) {
  try {
    const m = keyDoneMap(), k = String(keyId || "").toLowerCase();
    if (!k) return;
    const arr = m[stageId] || [];
    if (!arr.includes(k)) { arr.push(k); m[stageId] = arr; localStorage.setItem("tg_key_done", JSON.stringify(m)); }
  } catch (e) {}
}

/* ── progress sync to Supabase: a snapshot of the learner's local progress so a
   teacher/admin can review each student's learning from the back office ── */
function buildProgressSnapshot() {
  try {
    const plog = readPracticeLog();
    const glog = readGameLog().slice(-60);
    const mem = readMemory();
    const pathDone = Array.from(pathDoneSet());
    const keyDone = keyDoneMap();
    const st = readStreak();
    let accSum = 0, accN = 0;
    for (const g of glog) { if (typeof g.acc === "number") { accSum += g.acc; accN++; } }
    const keysLearned = Object.values(keyDone).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
    return {
      v: 1, updated: new Date().toISOString(),
      practiceLog: plog, gameLog: glog, memory: mem, pathDone, keyDone,
      plan: getPlan(), streak: st,
      summary: { games: glog.length, avgAcc: accN ? Math.round(accSum / accN) : 0, pathDone: pathDone.length, keysLearned },
    };
  } catch (e) { return null; }
}
// Dirty-check so the 90s interval (plus the tab-hide/pagehide triggers, all
// funneled through this one function) only actually writes when the
// learner's progress genuinely changed since the last successful sync -
// found by the scale audit as the single biggest per-user write source in
// the app (every logged-in tab, unconditionally, every 90s). Hash excludes
// `updated` (always a fresh timestamp) so an unchanged session correctly
// no-ops instead of comparing against itself and always "changing". Only
// remembered as synced on a SUCCESSFUL write - a failed one leaves the hash
// stale so the next tick naturally retries it, matching what unconditional
// writes already did for failures (this only removes REDUNDANT successful
// writes, not retry coverage).
let _lastSyncedProgressHash = null;
function syncProgress(uid) {
  if (!uid) return;
  try {
    const snap = buildProgressSnapshot();
    if (!snap) return;
    const { updated, ...rest } = snap;
    const hash = JSON.stringify(rest);
    if (hash === _lastSyncedProgressHash) return;
    sb.from("profiles").update({ progress: snap, last_active: ymd(), updated_at: new Date().toISOString() }).eq("id", uid).then(
      () => { _lastSyncedProgressHash = hash; },
      () => {}
    );
  } catch (e) {}
}
// At most once per calendar month per device: snapshots the learner's current
// skill scores server-side (skill_monthly_snapshot table) so a real trend can
// be shown later. Best-effort — if the RPC fails (network, or the migration
// hasn't been applied yet), the local flag is left unset so it simply retries
// on the next app open this month; there is no server-side scheduler to
// re-trigger it otherwise (same constraint as every other "period" table in
// this project).
function maybeSnapshotSkills(uid) {
  if (!uid) return;
  try {
    const mk = monthKey();
    if (localStorage.getItem("tg_skill_snap_month") === mk) return;
    const scores = computeSkillScores().filter(s => s.score != null);
    if (!scores.length) { try { localStorage.setItem("tg_skill_snap_month", mk); } catch (e) {} return; }
    Promise.all(scores.map(s => sb.rpc("upsert_skill_snapshot", { p_month_key: mk, p_skill: s.skill, p_score: s.score, p_n: s.n })))
      .then(() => { try { localStorage.setItem("tg_skill_snap_month", mk); } catch (e) {} })
      .catch(() => {});
  } catch (e) {}
}

/* ── cosmetics shop: key-skins + background themes (bought with coins) ── */
const SHOP_SKINS = [
  { id: "aqua",   icon: "🩵", cost: 0,   rarity: "common",    th: "อความารีน", en: "Aqua",   zh: "水蓝", sw: ["#8ad4ff", "#0e7ab0"] },
  { id: "sunset", icon: "🧡", cost: 120, rarity: "common",    th: "ตะวันตกดิน", en: "Sunset", zh: "日落", sw: ["#ff9e00", "#ff5d3a"] },
  { id: "neon",   icon: "💚", cost: 180, rarity: "rare",      th: "นีออน",      en: "Neon",   zh: "霓虹", sw: ["#06ffa5", "#00d488"] },
  { id: "candy",  icon: "💗", cost: 180, rarity: "rare",      th: "แคนดี้",     en: "Candy",  zh: "糖果", sw: ["#ff76d8", "#cc1b7a"] },
  { id: "ocean",  icon: "🌊", cost: 200, rarity: "rare",      th: "มหาสมุทร",   en: "Ocean",  zh: "海洋", sw: ["#00d4ff", "#0077b6"], isNew: true },
  { id: "ice",    icon: "❄️", cost: 200, rarity: "rare",      th: "น้ำแข็ง",    en: "Ice",    zh: "冰霜", sw: ["#d0f4ff", "#0891b2"], isNew: true },
  { id: "gold",   icon: "💛", cost: 320, rarity: "epic",      th: "ทองคำ",      en: "Gold",   zh: "黄金", sw: ["#ffd23f", "#9a7400"] },
  { id: "fire",   icon: "🔥", cost: 260, rarity: "epic",      th: "เพลิง",      en: "Fire",   zh: "烈焰", sw: ["#ff6b35", "#6b0f16"], isNew: true },
  { id: "galaxy", icon: "🪐", cost: 300, rarity: "epic",      th: "กาแล็กซี่",  en: "Galaxy", zh: "银河", sw: ["#c084fc", "#4c1d95"], isNew: true },
  { id: "prism",  icon: "🌈", cost: 550, rarity: "legendary", th: "ปริซึม",     en: "Prism",  zh: "棱镜", sw: ["#ff5252", "#a855f7", "#00d4ff"], isNew: true },
];
const SHOP_THEMES = [
  { id: "midnight",  icon: "🌌", cost: 0,   rarity: "common",    th: "เที่ยงคืน", en: "Midnight",  zh: "午夜", sw: ["#150c12", "#0a0608"] },
  { id: "aurora",    icon: "🌠", cost: 150, rarity: "rare",      th: "ออโรร่า",   en: "Aurora",    zh: "极光", sw: ["#0b2a3a", "#0a1326"] },
  { id: "ember",     icon: "🔥", cost: 150, rarity: "rare",      th: "ถ่านไฟ",    en: "Ember",     zh: "余烬", sw: ["#2a1012", "#180b10"] },
  { id: "forest",    icon: "🌲", cost: 150, rarity: "rare",      th: "ป่าไม้",    en: "Forest",    zh: "森林", sw: ["#0c2a1c", "#0a1a16"] },
  { id: "sakura",    icon: "🌸", cost: 200, rarity: "epic",      th: "ซากุระ",    en: "Sakura",    zh: "樱花", sw: ["#3a1a2e", "#220f1c"], isNew: true },
  { id: "deepsea",   icon: "🐋", cost: 240, rarity: "epic",      th: "ใต้สมุทร",  en: "Deep Sea",  zh: "深海", sw: ["#052030", "#031824"], isNew: true },
  { id: "volcano",   icon: "🌋", cost: 260, rarity: "epic",      th: "ภูเขาไฟ",   en: "Volcano",   zh: "火山", sw: ["#3a1005", "#220a08"], isNew: true },
  { id: "starlight", icon: "✨", cost: 450, rarity: "legendary", th: "แสงดาว",    en: "Starlight", zh: "星光", sw: ["#1a0a3a", "#12082a"], isNew: true },
];
const SHOP_FRAMES = [
  { id: "fr-none",    icon: "⭕", cost: 0,   rarity: "common",    th: "ไม่มีกรอบ", en: "No Frame", zh: "无边框", sw: ["#b0aea5", "#b0aea5"] },
  { id: "fr-bronze",  icon: "🥉", cost: 100, rarity: "common",    th: "บรอนซ์",    en: "Bronze",   zh: "青铜", sw: ["#cd7f32", "#8a531f"], isNew: true },
  { id: "fr-silver",  icon: "🥈", cost: 280, rarity: "rare",      th: "เงิน",      en: "Silver",   zh: "白银", sw: ["#d7d7de", "#9a9aa5"], isNew: true },
  { id: "fr-gold",    icon: "🥇", cost: 500, rarity: "epic",      th: "ทอง",       en: "Gold",     zh: "黄金", sw: ["#ffd23f", "#c9960a"], isNew: true },
  { id: "fr-diamond", icon: "💎", cost: 900, rarity: "legendary", th: "เพชร",      en: "Diamond",  zh: "钻石", sw: ["#8ad4ff", "#a855f7"], isNew: true },
];
// F2: LINE achievement share — opens LINE app on mobile, fallback clipboard on desktop
function shareLine(text: string) {
  const url = "https://line.me/R/share?text=" + encodeURIComponent(text);
  if (!window.open(url, "_blank", "noopener")) {
    try { navigator.clipboard.writeText(text); } catch (_) {}
  }
}
// D1: Backing chord helpers
// generate a shareable achievement card image (Web Share API, else download)
async function shareCard({ title, big, sub, lines = [] }) {
  try {
    const W = 640, H = 800, c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#1c1b19"); g.addColorStop(1, "#0d0d0c");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = "#d97757"; x.lineWidth = 5; x.strokeRect(26, 26, W - 52, H - 52);
    x.textAlign = "center";
    x.fillStyle = "#d97757"; x.font = "bold 30px Arial"; x.fillText("TiGA AI", W / 2, 112);
    x.fillStyle = "#faf9f5"; x.font = "bold 38px Arial"; x.fillText(String(title).slice(0, 22), W / 2, 210);
    x.fillStyle = "#d97757"; x.font = "900 150px Arial"; x.fillText(String(big), W / 2, 410);
    if (sub) { x.fillStyle = "#d97757"; x.font = "bold 56px Arial"; x.fillText(sub, W / 2, 490); }
    x.fillStyle = "#c9c6bd"; x.font = "30px Arial";
    lines.forEach((ln, i) => x.fillText(ln, W / 2, 570 + i * 50));
    x.fillStyle = "#8f8b82"; x.font = "24px Arial"; x.fillText("tigaalpha.github.io", W / 2, H - 56);
    const blob = await new Promise(res => c.toBlob(res, "image/png"));
    const file = new File([blob], "tiga-score.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "TiGA AI" });
    } else {
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "tiga-score.png"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }
  } catch (e) {}
}
function downloadCertificate(lang, name) {
  try {
    const W = 1000, H = 700, c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    // Background
    const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#1c1b19"); bg.addColorStop(1, "#0e0d0b");
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    // Outer border
    x.strokeStyle = "#d97757"; x.lineWidth = 6; x.strokeRect(22, 22, W - 44, H - 44);
    x.strokeStyle = "rgba(217,119,87,.3)"; x.lineWidth = 2; x.strokeRect(34, 34, W - 68, H - 68);
    // Corner ornaments
    [[ 22, 22], [W - 22, 22], [22, H - 22], [W - 22, H - 22]].forEach(([cx, cy]) => {
      x.beginPath(); x.arc(cx, cy, 10, 0, Math.PI * 2); x.fillStyle = "#d97757"; x.fill();
    });
    x.textAlign = "center";
    // Logo & title
    x.fillStyle = "#d97757"; x.font = "bold 22px Arial"; x.fillText("TiGA Piano AI", W / 2, 90);
    x.fillStyle = "rgba(217,119,87,.35)"; x.fillRect(100, 106, W - 200, 2);
    // Certificate word
    const certWord = lang === "th" ? "ใบประกาศนียบัตร" : lang === "zh" ? "结业证书" : "CERTIFICATE OF COMPLETION";
    x.fillStyle = "#faf9f5"; x.font = "bold 42px Arial"; x.fillText(certWord, W / 2, 175);
    // Presented to
    const toWord = lang === "th" ? "มอบให้แก่" : lang === "zh" ? "颁发给" : "This is presented to";
    x.fillStyle = "#8f8b82"; x.font = "22px Arial"; x.fillText(toWord, W / 2, 245);
    // Name
    x.fillStyle = "#d97757"; x.font = "bold 52px Arial"; x.fillText(name || "___________________", W / 2, 310);
    x.fillStyle = "rgba(217,119,87,.3)"; x.fillRect(200, 330, W - 400, 2);
    // Course
    const courseWord = lang === "th" ? "สำหรับการผ่านหลักสูตร TiGA Piano Learning Pathway ครบทุกบทเรียน"
      : lang === "zh" ? "完成 TiGA Piano 学习路径的全部课程"
      : "for completing the full TiGA Piano Learning Pathway";
    x.fillStyle = "#c9c6bd"; x.font = "22px Arial";
    const words = courseWord.split(" ");
    let line = "", lines = [], maxW = W - 200;
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (x.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    lines.forEach((ln, i) => x.fillText(ln, W / 2, 390 + i * 36));
    // Date
    const dateStr = new Date().toLocaleDateString(lang === "th" ? "th-TH" : lang === "zh" ? "zh-CN" : "en-US", { year: "numeric", month: "long", day: "numeric" });
    x.fillStyle = "#8f8b82"; x.font = "20px Arial"; x.fillText(dateStr, W / 2, 520);
    // Signature line
    x.fillStyle = "#8f8b82"; x.fillRect(W / 2 - 100, 590, 200, 1);
    x.fillStyle = "#d97757"; x.font = "bold 18px Arial"; x.fillText("TiGA Piano AI", W / 2, 610);
    x.fillStyle = "#8f8b82"; x.font = "16px Arial"; x.fillText("tigaalpha.github.io", W / 2, 640);
    // Download
    c.toBlob(blob => {
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "tiga-certificate.png"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }, "image/png");
  } catch (e) {}
}

function getOwned() { try { return JSON.parse(localStorage.getItem("tg_owned") || "[\"aqua\",\"midnight\",\"fr-none\"]"); } catch (e) { return ["aqua", "midnight", "fr-none"]; } }
function setOwnedLS(a) { try { localStorage.setItem("tg_owned", JSON.stringify(a)); } catch (e) {} }
function getEquip(k, def) { try { return localStorage.getItem("tg_" + k) || def; } catch (e) { return def; } }
function setEquipLS(k, v) { try { localStorage.setItem("tg_" + k, v); } catch (e) {} }

/* ── Interactive progress dashboard: pick a time range, see activity / accuracy /
   EXP, each compared with the previous equal period. Reads the daily practice log. ── */
const DASH_RANGES = [{ d: 1, k: "r1" }, { d: 7, k: "r7" }, { d: 30, k: "r1m" }, { d: 90, k: "r3m" }, { d: 180, k: "r6m" }, { d: 365, k: "r1y" }];
// Shared dashboard: own data (Profile) OR a student's snapshot (Admin) via props.
const ProgressDashboard = memo(function ProgressDashboard({ lang, plog: plogProp, gameLog: gameLogProp }) {
  const lc = L[lang];
  const [range, setRange] = useState(30);
  const [sel, setSel] = useState(null);
  const [gsel, setGsel] = useState(null);
  const plog = plogProp || readPracticeLog();
  const gameLog = gameLogProp || readGameLog();
  const today = new Date();
  const entryAgo = (off) => {
    const dd = new Date(today); dd.setDate(today.getDate() - off);
    const e = plog[dayKey(dd)] || {};
    return { n: e.n || 0, accSum: e.accSum || 0, exp: e.exp || 0, date: dd };
  };
  const agg = (arr) => {
    let sessions = 0, accSum = 0, accN = 0, exp = 0, active = 0;
    for (const e of arr) { sessions += e.n; accSum += e.accSum; accN += e.n; exp += e.exp; if (e.n > 0 || e.exp > 0) active++; }
    return { sessions, active, exp, acc: accN ? Math.round(accSum / accN) : 0 };
  };
  const cur = [], prev = [];
  for (let i = range - 1; i >= 0; i--) cur.push(entryAgo(i));
  for (let i = range * 2 - 1; i >= range; i--) prev.push(entryAgo(i));
  const A = agg(cur), B = agg(prev);
  const delta = (a, b) => (b > 0 ? Math.round((a - b) / b * 100) : (a > 0 ? 100 : 0));
  // bucket the chart: daily ≤30d, weekly ≤180d, else monthly
  const bd = range <= 30 ? 1 : range <= 180 ? 7 : 30;
  const buckets = [];
  for (let i = 0; i < cur.length; i += bd) {
    const slice = cur.slice(i, i + bd), b = agg(slice);
    buckets.push({ ...b, from: slice[0].date, to: slice[slice.length - 1].date, days: slice.length });
  }
  const maxS = Math.max(1, ...buckets.map(b => b.sessions));
  const fmtD = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
  const accPts = buckets.map((b, i) => {
    const x = buckets.length > 1 ? (i / (buckets.length - 1)) * 100 : 50;
    const y = 30 - (Math.max(0, Math.min(100, b.acc)) / 100) * 28;
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  const cards = [
    { lbl: lc.dashActive, val: A.active, prev: B.active, suffix: "/" + range },
    { lbl: lc.dashSessions, val: A.sessions, prev: B.sessions },
    { lbl: lc.dashAcc, val: A.acc, prev: B.acc, suffix: "%" },
    { lbl: lc.dashExp, val: A.exp, prev: B.exp },
  ];
  const selB = sel != null ? buckets[sel] : null;
  // game plays within the selected range (so the range controls game data too)
  const cutoff = Date.now() - range * 86400000;
  const gr = gameLog.filter(g => (g.t || 0) >= cutoff);
  const gRecent = gr.slice(-16);
  const gPlays = gr.length;
  const gAvg = gPlays ? Math.round(gr.reduce((s, g) => s + (g.acc || 0), 0) / gPlays) : 0;
  const gBest = Math.max(0, ...gr.map(g => g.score || 0));
  const starC = (s) => s >= 3 ? "#d97757" : s >= 2 ? "#ff76d8" : s >= 1 ? "#ff94e0" : "#a8329a";
  const selG = gsel != null ? gRecent[gsel] : null;
  const fmtT = (ts) => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()}`; };
  return (
    <div className="profsec">
      <div className="profsec-h">{lc.dashTitle}</div>
      <div className="dashranges">
        {DASH_RANGES.map(r => (
          <button key={r.d} className={`dashrange${range === r.d ? " on" : ""}`} onClick={() => { setRange(r.d); setSel(null); setGsel(null); }}>{lc[r.k]}</button>
        ))}
      </div>
      <div className="dashcards">
        {cards.map((c, i) => {
          const dl = delta(c.val, c.prev), up = dl >= 0;
          return (
            <div key={i} className="dashcard">
              <div className="dashcard-v">{c.val.toLocaleString()}{c.suffix || ""}</div>
              <div className="dashcard-l">{c.lbl}</div>
              <div className={`dashcard-d ${up ? "up" : "down"}`}>{up ? "▲" : "▼"} {Math.abs(dl)}%</div>
            </div>
          );
        })}
      </div>
      <div className="dashchart">
        <div className="dashchart-h">{lc.dashActivity}{selB && <span className="dashtip">{fmtD(selB.from)}{selB.days > 1 ? `–${fmtD(selB.to)}` : ""} · {selB.sessions} · {selB.acc}%</span>}</div>
        <div className="dashbars">
          {buckets.map((b, i) => (
            <button key={i} className={`dashbar${sel === i ? " sel" : ""}`} onClick={() => setSel(sel === i ? null : i)} title={`${fmtD(b.from)} · ${b.sessions}`}>
              <span style={{ height: Math.round((b.sessions / maxS) * 100) + "%" }} />
            </button>
          ))}
        </div>
      </div>
      {selB && (
        <div className="dashdetail">
          <div className="dashdetail-h">{fmtD(selB.from)}{selB.days > 1 ? ` – ${fmtD(selB.to)}` : ""}</div>
          <div className="dashdetail-stats">
            <span>{lc.dashSessions} <b>{selB.sessions}</b></span>
            <span>{lc.dashAcc} <b>{selB.acc}%</b></span>
            <span>{lc.dashExp} <b>{selB.exp}</b></span>
          </div>
          {selB.days === 1 && (() => {
            const k = dayKey(selB.from), games = gameLog.filter(g => g.d === k);
            return games.length ? (
              <div className="dashdetail-games">
                {games.slice(-8).map((g, i) => (
                  <div key={i} className="dashgame-row">
                    <span className="dashgame-song"><b style={{ color: "#d97757" }}>{"★".repeat(g.stars)}</b> {g.song}</span>
                    <span className="dashgame-acc">{g.acc}%</span>
                  </div>
                ))}
              </div>
            ) : null;
          })()}
        </div>
      )}
      {buckets.some(b => b.acc > 0) ? (
        <div className="dashchart">
          <div className="dashchart-h">{lc.dashAccTrend}</div>
          <svg className="dashline" viewBox="0 0 100 30" preserveAspectRatio="none"><polyline points={accPts} fill="none" stroke="#d97757" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" /></svg>
        </div>
      ) : <div className="trendempty">{lc.profNoData}</div>}

      {/* falling-notes game stats — filtered to the same range */}
      <div className="profsec-h" style={{ marginTop: 18 }}>{lc.gameStatsTitle}</div>
      <div className="dashcards three">
        <div className="dashcard"><div className="dashcard-v">{gPlays}</div><div className="dashcard-l">{lc.gameStatsPlays}</div></div>
        <div className="dashcard"><div className="dashcard-v">{gAvg}%</div><div className="dashcard-l">{lc.dashAcc}</div></div>
        <div className="dashcard"><div className="dashcard-v">{gBest.toLocaleString()}</div><div className="dashcard-l">{lc.gameStatsBest}</div></div>
      </div>
      {gRecent.length ? (
        <div className="dashchart">
          <div className="dashchart-h">{lc.gameStatsAcc}{selG && <span className="dashtip">{"★".repeat(selG.stars)} {selG.song} · {selG.score.toLocaleString()}</span>}</div>
          <div className="dashbars">
            {gRecent.map((g, i) => (
              <button key={i} className={`dashbar${gsel === i ? " sel" : ""}`} onClick={() => setGsel(gsel === i ? null : i)} title={`${g.song} · ${g.acc}%`}>
                <span style={{ height: Math.max(4, g.acc) + "%", background: starC(g.stars) }} />
              </button>
            ))}
          </div>
          <div className="dashgame-x">{gRecent.map((g, i) => <span key={i}>{fmtT(g.t)}</span>)}</div>
        </div>
      ) : <div className="trendempty">{lc.profNoData}</div>}
    </div>
  );
});

/* ── Falling-notes game stats: recent plays as easy bar graphs (accuracy per play,
   colored by stars), with totals. ── */
const GameStats = memo(function GameStats({ lang }) {
  const lc = L[lang];
  const [sel, setSel] = useState(null);
  const log = readGameLog();
  if (!log.length) return null;
  const recent = log.slice(-12);
  const plays = log.length;
  const avg = Math.round(log.reduce((s, g) => s + (g.acc || 0), 0) / plays);
  const best = Math.max(0, ...log.map(g => g.score || 0));
  const starC = (s) => s >= 3 ? "#d97757" : s >= 2 ? "#ff76d8" : s >= 1 ? "#ff94e0" : "#a8329a";
  const selG = sel != null ? recent[sel] : null;
  const fmtD = (ts) => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()}`; };
  return (
    <div className="profsec">
      <div className="profsec-h">{lc.gameStatsTitle}</div>
      <div className="dashcards three">
        <div className="dashcard"><div className="dashcard-v">{plays}</div><div className="dashcard-l">{lc.gameStatsPlays}</div></div>
        <div className="dashcard"><div className="dashcard-v">{avg}%</div><div className="dashcard-l">{lc.dashAcc}</div></div>
        <div className="dashcard"><div className="dashcard-v">{best.toLocaleString()}</div><div className="dashcard-l">{lc.gameStatsBest}</div></div>
      </div>
      <div className="dashchart">
        <div className="dashchart-h">{lc.gameStatsAcc}{selG && <span className="dashtip">{"★".repeat(selG.stars)} {selG.song} · {selG.score.toLocaleString()}</span>}</div>
        <div className="dashbars">
          {recent.map((g, i) => (
            <button key={i} className={`dashbar${sel === i ? " sel" : ""}`} onClick={() => setSel(sel === i ? null : i)} title={`${g.song} · ${g.acc}%`}>
              <span style={{ height: Math.max(4, g.acc) + "%", background: starC(g.stars) }} />
            </button>
          ))}
        </div>
        <div className="dashgame-x">{recent.map((g, i) => <span key={i}>{fmtD(g.t)}</span>)}</div>
      </div>
    </div>
  );
});

const ProfilePage = memo(function ProfilePage({ lang, session, profile, onSignOut, onOpenShop, onOpenHelp, onOpenFriends, onExchangeGems, coins, gems = 0 }) {
  const lc = L[lang];
  const meta = (session && session.user && session.user.user_metadata) || {};
  const exp = (profile && profile.exp) || 0;
  const info = levelInfo(exp);
  const tier = info.tier;
  const color = tier.c;
  const name = (profile && profile.full_name) || meta.full_name || meta.name ||
    ((session && session.user && session.user.email) || "").split("@")[0] || "TiGA";
  const avatar = (profile && profile.avatar_url) || meta.avatar_url || meta.picture || null;
  const initials = (name || "TG").trim().slice(0, 2).toUpperCase();
  const lessons = (profile && profile.lessons_done) || 0;
  const streak = (profile && profile.streak) || 0;
  const qToday = questToday(profile);
  const qDone = qToday >= QUEST_GOAL;
  const gotBadges = unlockedBadgeIds(profile);

  const pInfo = prestigeInfo(exp);
  const toNext = info.isMax
    ? (lang === "th" ? `⭐ ${pInfo.tier > 0 ? `${lc.prestigeWord} ${pInfo.tier} · ` : ""}อีก ${pInfo.need.toLocaleString()} EXP → ดาวถัดไป`
      : lang === "zh" ? `⭐ ${pInfo.tier > 0 ? `${lc.prestigeWord} ${pInfo.tier} · ` : ""}还差 ${pInfo.need.toLocaleString()} EXP → 下一星`
      : `⭐ ${pInfo.tier > 0 ? `${lc.prestigeWord} ${pInfo.tier} · ` : ""}${pInfo.need.toLocaleString()} EXP → next star`)
    : lang === "th" ? `อีก ${info.need.toLocaleString()} EXP → เลเวลถัดไป`
    : lang === "zh" ? `还差 ${info.need.toLocaleString()} EXP → 升级`
    : `${info.need.toLocaleString()} EXP → next level`;

  // contact fields are optional at signup now — let people fill them in later
  // right here instead of only on the one-time onboarding screen.
  const [contactEdit, setContactEdit] = useState(false);
  const [cLine, setCLine] = useState((profile && profile.line_id) || "");
  const [cPhone, setCPhone] = useState((profile && profile.phone) || "");
  const [cIg, setCIg] = useState((profile && profile.instagram) || "");
  const [cSaving, setCSaving] = useState(false);
  const [localContact, setLocalContact] = useState(null); // optimistic override after save
  const liveLine = localContact ? localContact.line_id : (profile && profile.line_id);
  const livePhone = localContact ? localContact.phone : (profile && profile.phone);
  const liveIg = localContact ? localContact.instagram : (profile && profile.instagram);
  async function saveContact() {
    if (!session || !session.user) return; // guest — already-safe no-op, same as today
    setCSaving(true);
    const vals = { line_id: cLine.trim() || null, phone: cPhone.trim() || null, instagram: cIg.trim() || null };
    const { error } = await sb.from("profiles").update({ ...vals, updated_at: new Date().toISOString() }).eq("id", session.user.id);
    setCSaving(false);
    if (!error) { setLocalContact(vals); setContactEdit(false); }
  }
  const contacts = [
    { ico: "📧", val: (profile && profile.email) || (session && session.user && session.user.email) },
    { ico: "💬", val: liveLine },
    { ico: "📱", val: livePhone },
    { ico: "📸", val: liveIg },
  ];
  const missingContact = !liveLine && !livePhone;

  // ── progress dashboard data (practice heatmap + accuracy trend) ──
  const plog = readPracticeLog();
  const heatDays = [];
  const _today = new Date();
  for (let i = 83; i >= 0; i--) {
    const dd = new Date(_today); dd.setDate(_today.getDate() - i);
    const key = dayKey(dd);
    const n = plog[key] ? plog[key].n : 0;
    heatDays.push({ date: key, n, lvl: n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3 });
  }
  const activeDays = heatDays.filter(d => d.n > 0).length;
  const weekly = readWeekly();
  const weekChallenges = activeChallenges();
  const weekDoneCount = weekChallenges.filter(ch => weekly.claimed && weekly.claimed.includes(ch.id)).length;
  const trend = (Array.isArray(plog._recent) ? plog._recent : []).slice(-14);
  const trendPts = trend.map((p, i) => {
    const x = trend.length > 1 ? (i / (trend.length - 1)) * 100 : 50;
    const y = 29 - (Math.max(0, Math.min(100, p.acc)) / 100) * 27;
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");

  return (
    <div className="profpage" style={{ "--lv-c": color }}>
      <div className="profhero">
        <div className="profhero-glow" />
        <div className="profava-wrap">
          <div className="profava-ring" />
          <div className="profava-frame" />
          <div className="profava">
            {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : <span>{initials}</span>}
          </div>
        </div>
        <div className="profname">{name}</div>
        <div className="profrankbadge">
          <span aria-hidden="true">{tier.icon}</span>
          <span>{lc.profLevelWord} {info.level} · {tr(tier, lang)}</span>
        </div>

        <div className="expwrap">
          <div className="exprow">
            <span><span className="expnum">{exp.toLocaleString()}</span> EXP</span>
            <span>{info.isMax ? "MAX" : `${info.nextMin.toLocaleString()} EXP`}</span>
          </div>
          <div className="expbar">
            <div className="expfill" style={{ width: `${Math.round(info.progress * 100)}%` }} />
          </div>
          <div className="expnext">{toNext}</div>
        </div>
      </div>

      <div className="profstats">
        <div className="statcard">
          <div className="statval">{exp.toLocaleString()}</div>
          <div className="statlbl">{lc.profExpStat}</div>
        </div>
        <div className="statcard">
          <div className="statval">{lessons}</div>
          <div className="statlbl">{lc.profLessonsStat}</div>
        </div>
        <div className="statcard">
          <div className="statval">{streak}<span className="em"> 🔥</span></div>
          <div className="statlbl">{lc.profStreakBest}</div>
        </div>
      </div>

      {/* Weakest-skill callout — free for everyone (incl. guests); the full per-skill
          breakdown lives behind the Max gate on Daily Mentor (CoachPage). */}
      {(() => {
        const weak = weakestSkills(computeSkillScores(), 2);
        if (!weak.length) return null;
        return (
          <div className="profsec">
            <div className="profsec-h">🎯 {lang === "th" ? "จุดที่ควรฝึกเพิ่ม" : lang === "zh" ? "待加强项目" : "Where to focus next"}</div>
            <div className="pd-tags">
              {weak.map(w => <span key={w.skill} className="pd-tag focus">{tr(SKILL_LABELS[w.skill], lang)} · {w.score}</span>)}
            </div>
          </div>
        );
      })()}

      {/* interactive progress dashboard — range selector + period comparison + charts + game stats */}
      <ProgressDashboard lang={lang} />

      {/* Auto Teaching recap — current weak spots + the most recent real-time tip (Premium plan and up) */}
      {effectivePlan(profile) !== "free" && (() => {
        const atLog = readAutoTeachLog();
        const last = atLog[atLog.length - 1];
        const struggles = (readMemory().struggles || []).slice(0, 5);
        return (
          <div className="profsec">
            <div className="profsec-h">🎯 Auto Teaching</div>
            {struggles.length > 0 && (
              <div className="pd-tags">{struggles.map((s, i) => <span key={i} className="pd-tag focus">{s.label}</span>)}</div>
            )}
            {last ? (
              <div className="atdash-last">
                <div className="atdash-last-w">{last.weakness}</div>
                <div className="atdash-last-t">{last.tip}</div>
                <div className="atdash-last-d">{new Date(last.t).toLocaleString(TTS_LOCALES[lang] || "en-US")}</div>
              </div>
            ) : (
              <div className="atdash-empty">{lang === "th" ? "ยังไม่มีคำแนะนำ — กลับไปหน้าเส้นทางการเรียนรู้เพื่อรับคำแนะนำแบบเรียลไทม์" : lang === "zh" ? "暂无建议——返回学习路径页面以获得实时指导" : "No tips yet — head to the Pathway page to get real-time coaching"}</div>
            )}
          </div>
        );
      })()}

      {/* practice heatmap (consistency) + accuracy trend */}
      <div className="profsec">
        <div className="profsec-h">
          {lc.profProgress}
          <span style={{ marginLeft: "auto", fontFamily: "'Share Tech Mono',monospace", fontSize: "10px", fontWeight: 400, color: "var(--muted)" }}>
            {activeDays} {lc.profActiveDays}
          </span>
        </div>
        <div className="heatcard">
          <div className="heatgrid">
            {heatDays.map((d, i) => (
              <div key={i} className="heatcell" style={{ background: heatColor(d.lvl) }} title={d.date + (d.n ? ` · ${d.n}×` : "")} />
            ))}
          </div>
          <div className="heatlegend">
            <span>{lc.profLess}</span>
            {[0, 1, 2, 3].map(l => <i key={l} style={{ background: heatColor(l) }} />)}
            <span>{lc.profMore}</span>
          </div>
          {trend.length >= 2 ? (
            <div className="trendwrap">
              <div className="trendlbl">{lc.profAccTrend} <b>{trend[trend.length - 1].acc}%</b></div>
              <svg className="trendsvg" viewBox="0 0 100 30" preserveAspectRatio="none">
                <polyline points={trendPts} fill="none" stroke="#d97757" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </div>
          ) : (
            <div className="trendempty">{lc.profNoData}</div>
          )}
        </div>
      </div>

      {/* B2: Note Weakness Heatmap */}
      {(() => {
        const NOTE_WHITE = ["C","D","E","F","G","A","B"];
        const NOTE_BLACK: (string|null)[] = ["C#","D#",null,"F#","G#","A#",null];
        const missData: Record<string,number> = (() => { try { return JSON.parse(localStorage.getItem("tg_note_miss") || "{}"); } catch (_) { return {}; } })();
        const maxMiss = Math.max(1, ...Object.values(missData));
        const heatC = (pc: string) => {
          const v = missData[pc] || 0;
          if (!v) return "var(--card)";
          const ratio = v / maxMiss;
          return `rgba(${Math.round(200 + 55*ratio)},${Math.round(80*(1-ratio))},40,${0.35 + ratio * 0.55})`;
        };
        const hasMiss = Object.values(missData).some(v => v > 0);
        if (!hasMiss) return null;
        return (
          <div className="profsec">
            <div className="profsec-h">{lc.noteWeakTitle}</div>
            <div className="noteheat-card">
              <div className="noteheat-sub">{lc.noteWeakSub}</div>
              <div className="noteheat-keys">
                <div className="noteheat-white-row">
                  {NOTE_WHITE.map(pc => (
                    <div key={pc} className="noteheat-white" style={{ background: heatC(pc) }}>
                      <span className="noteheat-pc">{pc}</span>
                      {missData[pc] ? <span className="noteheat-n">{missData[pc]}</span> : null}
                    </div>
                  ))}
                </div>
                <div className="noteheat-black-row">
                  {NOTE_BLACK.map((pc, i) => pc !== null ? (
                    <div key={pc} className="noteheat-black" style={{ left: `${(i / 7) * 100 + (100/14)}%`, background: missData[pc] ? heatC(pc) : "var(--fg)" }}>
                      <span className="noteheat-bpc">{pc.replace("#","♯")}</span>
                    </div>
                  ) : <div key={i} className="noteheat-gap" />)}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* daily quest — drives daily return */}
      <div className="profsec">
        <div className="profsec-h">{lc.profQuests}</div>
        <div className={`questcard${qDone ? " done" : ""}`}>
          <div className="questrow">
            <span className="questname">🎯 {lc.questText}</span>
            <span className="questrew">{qDone ? lc.questDoneText : `+${QUEST_BONUS} EXP`}</span>
          </div>
          <div className="questbar">
            <div className="questfill" style={{ width: `${Math.round(Math.min(qToday, QUEST_GOAL) / QUEST_GOAL * 100)}%` }} />
          </div>
          <div className="questcount">{Math.min(qToday, QUEST_GOAL)} / {QUEST_GOAL}</div>
        </div>
      </div>

      {/* weekly challenges — pool rotates every week (see activeChallenges) */}
      <div className="profsec">
        <div className="profsec-h">
          {lc.weeklyTitle}
          <span style={{ marginLeft: "auto", fontFamily: "'Share Tech Mono',monospace", fontSize: "10px", fontWeight: 400, color: "var(--muted)", letterSpacing: ".5px" }}>
            {weekDoneCount}/{weekChallenges.length}
          </span>
        </div>
        <div className="wktrack">
          {weekChallenges.map((ch, i) => <div key={ch.id} className={`wktrack-seg${i < weekDoneCount ? " done" : ""}`} />)}
        </div>
        {weekChallenges.map(ch => {
          const v = Math.min(weekly[ch.type] || 0, ch.goal), done = v >= ch.goal;
          return (
            <div key={ch.id} className={`wkrow${done ? " done" : ""}`}>
              <span className="wkic">{ch.icon}</span>
              <div className="wkbody">
                <div className="wktop"><span>{tr(ch, lang)}</span><b>{done ? `✓ +${CHALLENGE_REWARD}🪙` : `${v}/${ch.goal}`}</b></div>
                <div className="wkbar"><div style={{ width: (v / ch.goal * 100) + "%" }} /></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* achievements / badges to collect */}
      <div className="profsec">
        <div className="profsec-h">
          {lc.profBadges}
          <span style={{ marginLeft: "auto", fontFamily: "'Share Tech Mono',monospace", fontSize: "10px", fontWeight: 400, color: "var(--muted)", letterSpacing: ".5px" }}>
            {gotBadges.length}/{BADGES.length}
          </span>
        </div>
        <div className="badgegrid">
          {BADGES.map(b => {
            const got = gotBadges.includes(b.id);
            return (
              <div key={b.id} className={`badge${got ? " got" : ""}`} title={tr(b, lang)}>
                <span className="badge-ic" aria-hidden="true">{got ? b.icon : "🔒"}</span>
                <span className="badge-nm">{tr(b, lang)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <WeeklyLeagueSection lang={lang} />

      <LeaderboardSection lang={lang} />

      <div className="profsec">
        <div className="profsec-h">{lc.profRanks}</div>
        {LEVELS.map((lv, i) => {
          const lvNum = i + 1;
          const state = lvNum === info.level ? "cur" : lv.min <= exp ? "done" : "locked";
          const range = i + 1 < LEVELS.length
            ? `${lv.min.toLocaleString()} – ${(LEVELS[i + 1].min - 1).toLocaleString()} EXP`
            : `${lv.min.toLocaleString()}+ EXP`;
          return (
            <div key={i} className={`rankrow ${state}`} style={{ "--lv-c": lv.c }}>
              <span className="rankicon" aria-hidden="true">{lv.icon}</span>
              <div className="rankmeta">
                <div className="rankname">{lc.profLevelWord} {lvNum} · {tr(lv, lang)}</div>
                <div className="rankexp">{range}</div>
              </div>
              <span className="ranktick">{state === "done" ? "✓" : state === "cur" ? "▶" : "🔒"}</span>
            </div>
          );
        })}
      </div>

      <div className="profsec">
        <div className="profsec-h" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{lc.profContact}</span>
          {!contactEdit && (
            <button className="memberlink" style={{ fontSize: 12 }} onClick={() => { setCLine(liveLine || ""); setCPhone(livePhone || ""); setCIg(liveIg || ""); setContactEdit(true); }}>
              ✎ {lc.profContactEdit}
            </button>
          )}
        </div>
        {contactEdit ? (
          <div className="contactcard" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12 }}>
            <input className="memberinput" placeholder="LINE ID" value={cLine} onChange={e => setCLine(e.target.value)} />
            <input className="memberinput" placeholder="เบอร์โทรศัพท์ (Phone)" value={cPhone} onChange={e => setCPhone(e.target.value)} inputMode="tel" />
            <input className="memberinput" placeholder="Instagram" value={cIg} onChange={e => setCIg(e.target.value)} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="lockbtn" style={{ flex: 1 }} disabled={cSaving} onClick={saveContact}>{cSaving ? "…" : lc.profContactSave}</button>
              <button className="memberlink" onClick={() => setContactEdit(false)}>{lc.profContactCancel}</button>
            </div>
          </div>
        ) : (
          <>
            <div className="contactcard">
              {contacts.map((c, i) => (
                <div key={i} className="contactrow">
                  <span className="contactico" aria-hidden="true">{c.ico}</span>
                  <span className={`contactval${c.val ? "" : " empty"}`}>{c.val || "—"}</span>
                </div>
              ))}
            </div>
            {missingContact && (
              <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6, cursor: "pointer" }}
                onClick={() => { setCLine(""); setCPhone(""); setCIg(liveIg || ""); setContactEdit(true); }}>
                💡 {lc.profContactNudge}
              </div>
            )}
          </>
        )}
      </div>

      {gems > 0 && onExchangeGems && (
        <div className="profsec">
          <div className="gemrow">
            <span className="gemrow-bal">💎 {gems} {lc.gemsLabel}</span>
            <button className="gemrow-x" disabled={gems < 5} onClick={() => onExchangeGems(5)}>{lc.gemExchange}</button>
          </div>
          <div className="leaguereset">{lc.gemHint}</div>
        </div>
      )}

      {(onOpenShop || onOpenFriends || onOpenHelp) && (
        <div className="profsec">
          {onOpenShop && <button className="songbtn ghost" style={{ width: "100%", marginBottom: 8 }} onClick={onOpenShop}>🪙 {lc.shopTitle} · {coins}</button>}
          {onOpenFriends && <button className="songbtn ghost" style={{ width: "100%", marginBottom: 8 }} onClick={onOpenFriends}>👥 {lc.frTitle}</button>}
          {onOpenHelp && <button className="songbtn ghost" style={{ width: "100%" }} onClick={onOpenHelp}>❓ {lc.helpTitle}</button>}
        </div>
      )}
      {onSignOut && <button className="profsignout" onClick={onSignOut}>⏻ {lc.profSignOut}</button>}
    </div>
  );
});

/* ── Daily Mentor page: shows practice stats, 7-day activity chart, and weak spots. ── */
const CoachPage = memo(function CoachPage({ lang, profile, onNavigate }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const stats = useMemo(() => computeCoachStats(profile, lang), [profile, lang]);
  const accDelta = stats.acc7 != null && stats.accPrev != null ? stats.acc7 - stats.accPrev : null;
  const hasData = readActLog().length > 0;

  // Monthly skill trend — best-effort: silently empty (not an error) if the
  // RPC isn't deployed yet, or if there's under 2 months of history so far.
  // There's no way to backfill history that predates this feature.
  const [skillHistory, setSkillHistory] = useState([]);
  useEffect(() => {
    let alive = true;
    sb.rpc("get_my_skill_history", { p_limit: 6 }).then(
      ({ data }) => { if (alive) setSkillHistory(Array.isArray(data) ? data : []); },
      () => { if (alive) setSkillHistory([]); }
    );
    return () => { alive = false; };
  }, []);
  const trendBySkill = useMemo(() => {
    const bySkill = {};
    for (const row of skillHistory) (bySkill[row.skill] || (bySkill[row.skill] = [])).push(row);
    return Object.values(bySkill)
      .map(rows => rows.sort((a, b) => a.month_key < b.month_key ? -1 : 1))
      .filter(rows => rows.length >= 2)
      .map(rows => ({ skill: rows[0].skill, first: rows[0].score, latest: rows[rows.length - 1].score, months: rows.length }));
  }, [skillHistory]);

  return (
    <div className="profscroll">
      <div className="profsec">
        <div className="profsec-h">🎯 {T("Daily Mentor", "Daily Mentor", "Daily Mentor")}</div>
        <div className="admstu-row-sub" style={{ marginBottom: 12, whiteSpace: "normal", overflow: "visible", textOverflow: "clip" }}>
          {T("สถิติการซ้อมและจุดที่ควรฝึกเพิ่ม อัปเดตอัตโนมัติหลังทุกเซสชัน",
            "Your practice stats and weak spots — updated automatically after every session.",
            "练习统计与待提升项目——每次练习后自动更新。")}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div className="instile" style={{ minWidth: 0 }}><b>{stats.level}</b><span>{T("เลเวล", "Level", "等级")}</span></div>
          <div className="instile" style={{ minWidth: 0 }}><b>{stats.streak}🔥</b><span>{T("สตรีค", "Streak", "连续")}</span></div>
          <div className="instile" style={{ minWidth: 0 }}><b>{stats.days7}/7</b><span>{T("วันที่ซ้อม", "Days practiced", "练习天数")}</span></div>
          <div className="instile" style={{ minWidth: 0 }}>
            <b>{stats.acc7 == null ? "—" : stats.acc7 + "%"}
              {accDelta != null && accDelta !== 0 && (
                <span style={{ fontSize: 9, marginLeft: 3, color: accDelta > 0 ? "#d97757" : "#ff5252" }}>
                  {accDelta > 0 ? "▲" : "▼"}{Math.abs(accDelta)}
                </span>
              )}
            </b>
            <span>{T("แม่นยำ 7 วัน", "7-day accuracy", "7天准确率")}</span>
          </div>
        </div>

        {stats.daily && stats.daily.some(d => d.practiced) && (() => {
          const maxMin = Math.max(1, ...stats.daily.map(d => d.min));
          const dayLabels = ["Su","Mo","Tu","We","Th","Fr","Sa"];
          const accent = "#d97757";
          return (
            <div style={{ marginBottom: 16 }}>
              <div className="admstu-sec" style={{ marginBottom: 8 }}>📈 {T("กิจกรรม 7 วัน", "7-Day Activity", "近7天练习")}</div>
              <svg viewBox="0 0 280 72" style={{ width: "100%", height: 72, overflow: "visible" }}>
                {stats.daily.map((d, i) => {
                  const x = i * 40 + 4;
                  const isToday = i === 6;
                  const barH = d.practiced ? Math.max(6, Math.round((d.min / maxMin) * 46)) : 4;
                  const barY = 56 - barH;
                  const barColor = d.practiced ? (isToday ? accent : "rgba(217,119,87,.55)") : "var(--card3)";
                  const realDate = new Date(Date.now() - (6 - i) * 86400000);
                  const dow = dayDate(realDate).getDay();
                  return (
                    <g key={i}>
                      <rect x={x} y={barY} width={32} height={barH} rx={4} fill={barColor} />
                      {d.acc != null && (
                        <text x={x + 16} y={barY - 3} textAnchor="middle" fontSize={8} fill={d.practiced ? accent : "var(--muted)"} fontWeight="600">{d.acc}%</text>
                      )}
                      {d.min > 0 && (
                        <text x={x + 16} y={56} textAnchor="middle" fontSize={7} fill="var(--text2)">{d.min}m</text>
                      )}
                      <text x={x + 16} y={68} textAnchor="middle" fontSize={8} fill={isToday ? accent : "var(--muted)"} fontWeight={isToday ? "700" : "400"}>
                        {isToday ? T("วันนี้", "Today", "今天") : dayLabels[dow]}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          );
        })()}

        {/* Skill Score breakdown — this page is already Max/Max Family-only via the nav
            lock, so no extra plan check is needed here. */}
        {stats.skills.some(s => s.score != null) && (
          <div style={{ marginBottom: 16 }}>
            <div className="admstu-sec" style={{ marginBottom: 6 }}>🧭 {T("คะแนนทักษะ", "Skill Scores", "技能评分")}</div>
            {stats.skills.map(s => (
              <div key={s.skill} className="wkrow">
                <div className="wkbody">
                  <div className="wktop">
                    <span>{tr(SKILL_LABELS[s.skill], lang)}</span>
                    <b style={{ color: s.score == null ? "var(--muted)" : "#d97757" }}>
                      {s.score == null ? T("ข้อมูลยังไม่พอ", "not enough data", "数据不足") : s.score + "/100"}
                    </b>
                  </div>
                  <div className="wkbar"><div style={{ width: (s.score || 0) + "%", background: "#d97757" }} /></div>
                </div>
              </div>
            ))}
            {(() => {
              const weakest = weakestSkills(stats.skills, 1)[0];
              const feature = weakest && SKILL_REMEDIATION[weakest.skill];
              if (!feature) return null;
              return (
                <button className="songbtn go" style={{ width: "100%", marginTop: 10 }}
                  onClick={() => onNavigate(feature, weakest.skill === "chord_knowledge" ? "chord" : undefined)}>
                  🎯 {T("ฝึกตอนนี้เลย", "Practice this now", "现在就练")}
                </button>
              );
            })()}
          </div>
        )}

        {/* Monthly trend — only renders once 2+ months of history exist; the
            snapshot mechanism starts counting from zero the day it ships, so
            this is expected to show nothing for a while on every account. */}
        {trendBySkill.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="admstu-sec" style={{ marginBottom: 6 }}>📅 {T("แนวโน้มรายเดือน", "Monthly Trend", "月度趋势")}</div>
            {trendBySkill.map(t => {
              const delta = t.latest - t.first;
              return (
                <div key={t.skill} className="admstu-row-sub" style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                  <span>{tr(SKILL_LABELS[t.skill], lang)}</span>
                  <span>
                    {t.first} → {t.latest}
                    <b style={{ marginLeft: 6, color: delta > 0 ? "#d97757" : delta < 0 ? "#ff5252" : "var(--muted)" }}>
                      {delta > 0 ? "▲" : delta < 0 ? "▼" : "–"}{Math.abs(delta)}
                    </b>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {stats.weakest.length > 0 ? (
          <div style={{ marginBottom: 8 }}>
            <div className="admstu-sec" style={{ marginBottom: 6 }}>📊 {T("จุดที่ควรเก็บ (อัตราพลาด)", "Spots to polish (miss rate)", "待加强项目（错误率）")}</div>
            {stats.weakest.map((w, i) => (
              <div key={i} className="wkrow">
                <div className="wkbody">
                  <div className="wktop"><span>{w.label}</span><b style={{ color: "#ff5252" }}>{w.rate}% · {w.n}×</b></div>
                  <div className="wkbar"><div style={{ width: w.rate + "%", background: "#ff5252" }} /></div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--card2)", borderRadius: 12, borderLeft: "3px solid #d97757" }}>
              <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, marginBottom: 4 }}>
                💡 {T("คำแนะนำ", "Recommendation", "建议")}
              </div>
              <div style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.8 }}>
                {stats.weakest.slice(0, 3).map((w, wi) => {
                  const mins = w.rate > 50 ? 15 : w.rate > 20 ? 10 : 5;
                  const intensity = w.rate > 50 ? T("พลาดบ่อยมาก — ซ้อมเพิ่ม", "miss rate high — practice", "错误率高，练习") : w.rate > 20 ? T("พลาดปานกลาง — ซ้อมเพิ่ม", "moderate misses — practice", "中等错误率，练习") : T("พลาดเล็กน้อย — ทบทวน", "few misses — review", "少量失误，复习");
                  return (
                    <div key={wi} style={{ padding: "4px 0", borderBottom: wi < Math.min(2, stats.weakest.length - 1) ? "1px solid var(--border)" : "none" }}>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>• {w.label}</span>
                      {" — "}<span style={{ color: "var(--muted)" }}>{intensity}</span>{" "}
                      <span style={{ fontWeight: 700, color: "#d97757" }}>
                        {T(`${mins} นาที/วัน`, `${mins} min/day`, `每天 ${mins} 分钟`)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : hasData ? (
          <div style={{ padding: "14px", background: "var(--card2)", borderRadius: 12, textAlign: "center", color: "var(--text2)", fontSize: 13 }}>
            🎉 {T("ยอดเยี่ยม! ยังไม่มีจุดที่พลาดซ้ำในช่วงนี้ ฝึกต่อไปเลย!", "Great job! No repeated mistakes found yet. Keep practicing!", "太棒了！目前没有重复失误。继续加油！")}
          </div>
        ) : (
          <div style={{ padding: "14px", background: "var(--card2)", borderRadius: 12, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            {T("ยังไม่มีข้อมูลการซ้อม — เริ่มฝึกในสตูดิโอแล้วกลับมาดูข้อมูลที่นี่", "No practice data yet — start a session in Studio to see your stats here.", "暂无练习数据——先去练习，数据会自动显示在这里。")}
          </div>
        )}
      </div>
    </div>
  );
});

/* ── Admin lock screen ── */
function LockScreen({ lang, onUnlock }) {
  const lc = L[lang];
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  function tryUnlock() {
    if (onUnlock(code)) { setErr(""); }
    else { setErr(lc.lockErr); setCode(""); }
  }
  return (
    <div className="lockwrap">
      <div className="lockicon">🔐</div>
      <div className="locktitle">{lc.lockTitle}</div>
      <div className="locksub">{lc.lockSub}</div>
      <input className="lockinput" type="password" value={code}
        placeholder={lc.lockPlace}
        onChange={e => setCode(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") tryUnlock(); }} />
      <div className="lockerr">{err}</div>
      <button className="lockbtn" onClick={tryUnlock}>{lc.lockEnter}</button>
    </div>
  );
}

/* ── Share gate: free users share FB + TikTok to keep playing past the free limit ── */

/* ── Admin: all students' progress (reads every profile via admin RLS) ── */
function AdminStudents({ lang, viewerTier }) {
  const tier = viewerTier || 0;
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [rows, setRows] = useState(null);   // null = loading
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");
  const [mgPlan, setMgPlan] = useState("max");
  const [mgDays, setMgDays] = useState(30);
  const [mgBusy, setMgBusy] = useState(false);
  const [appointTier, setAppointTier] = useState(0);
  const openUser = (r) => { setSel(r); setMgPlan((r.plan && r.plan !== "free") ? r.plan : "max"); setMgDays(30); setAppointTier(r.admin_tier || 0); };
  async function applyPlan() {
    if (!sel) return; setMgBusy(true);
    const { error } = await sb.rpc("admin_set_plan", { target: sel.id, new_plan: mgPlan, days: Number(mgDays) || 30 });
    setMgBusy(false); if (!error) { playUi("levelup"); setSel(null); load(); }
  }
  async function suspendPlan() {
    if (!sel) return; setMgBusy(true);
    const { error } = await sb.rpc("admin_set_plan", { target: sel.id, new_plan: "free", days: 0 });
    setMgBusy(false); if (!error) { setSel(null); load(); }
  }
  async function toggleBan() {
    if (!sel) return; setMgBusy(true);
    const { error } = await sb.rpc("admin_set_ban", { target: sel.id, ban: !sel.banned });
    setMgBusy(false); if (!error) { setSel(null); load(); }
  }
  async function doAppoint() {
    if (!sel) return; setMgBusy(true);
    const { error } = await sb.rpc("admin_appoint", { target: sel.id, new_tier: appointTier });
    setMgBusy(false); if (!error) { setSel(null); load(); } else { alert(error.message || "error"); }
  }
  // admin_list_students_v2 — bounded (server-side LIMIT) and server-side searched,
  // replacing the old admin_list_students() (unbounded, no search, client-side
  // sort/filter over the entire user base). See
  // supabase-security-hardening-migration.sql for why this is a new function
  // rather than an edit to the old one.
  const load = useCallback((searchQ) => {
    setErr(""); setRows(null);
    sb.rpc("admin_list_students_v2", { p_search: searchQ || null, p_limit: 200 })
      .then(({ data, error }) => {
        if (error) { setErr(error.message || "error"); setRows([]); return; }
        setRows(data || []);
      }, (e) => { setErr("" + (e && e.message || e)); setRows([]); });
  }, []);
  // loads immediately on mount; debounces subsequent calls as the admin types into
  // the search box, instead of the old instant client-side filter over an
  // unbounded already-fetched array
  const firstLoadRef = useRef(true);
  useEffect(() => {
    if (firstLoadRef.current) { firstLoadRef.current = false; load(q); return; }
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  if (rows === null) return <div className="admstu"><div className="admstu-msg">⏳ {T("กำลังโหลดข้อมูลนักเรียน...", "Loading students...", "正在加载学生...")}</div></div>;

  if (sel) {
    const li = levelInfo(sel.exp || 0);
    const pr = sel.progress || {};
    const sum = pr.summary || {};
    const mem = pr.memory || {};
    const struggles = (mem.struggles || []).slice(0, 8);
    const mastered = (mem.mastered || []).slice(0, 12);
    const recent = (mem.recent || []).slice(0, 6);
    const plog = pr.practiceLog || {};
    const Stat = (num, lbl) => <div className="pd-stat"><div className="pd-num">{num}</div><div className="pd-lbl">{lbl}</div></div>;
    return (
      <div className="admstu">
        <button className="admstu-back" onClick={() => setSel(null)}>‹ {T("กลับ", "Back", "返回")}</button>
        <div className="admstu-head">
          <div className="admstu-av">{(sel.full_name || sel.email || "?").trim().charAt(0).toUpperCase()}</div>
          <div>
            <div className="admstu-nm">{sel.full_name || "—"} {sel.admin_tier > 0 && <span className="admstu-badge">{adminTierStars(sel.admin_tier)} ADMIN</span>}{sel.banned && <span className="adminpay-badge rejected">BANNED</span>}</div>
            <div className="admstu-em">{sel.email || "—"}</div>
            <div className="admstu-lv">{li.tier && li.tier.icon} {T("ระดับ", "Level", "等级")} {li.level} · {(sel.plan || "free").toUpperCase()} · {T("ใช้ล่าสุด", "Last active", "最近活跃")}: {sel.last_active || "—"}</div>
          </div>
        </div>
        {/* ⚙️ manage: change/suspend plan (Top Tier only) · ban (tier ≥2) */}
        {(tier >= 2) && (
          <div className="admmg">
            <div className="admmg-h">⚙️ {T("จัดการผู้ใช้", "Manage user", "用户管理")}</div>
            {tier >= 3 && (<>
              <div className="admmg-cur">{T("แพลนปัจจุบัน", "Current plan", "当前套餐")}: <b>{(sel.plan || "free").toUpperCase()}</b>{sel.plan_until ? " · " + T("ถึง", "until", "至") + " " + String(sel.plan_until).slice(0, 10) : ""}</div>
              <div className="admmg-row">
                <select className="admmg-sel" value={mgPlan} onChange={e => setMgPlan(e.target.value)}>
                  <option value="premium">⭐ Premium</option>
                  <option value="family">👨‍👩‍👧 Family</option>
                  <option value="max">👑 Max</option>
                  <option value="maxfamily">👑 Max Family</option>
                </select>
                <input className="admmg-days" type="number" min="1" value={mgDays} onChange={e => setMgDays(e.target.value)} />
                <span className="admmg-d">{T("วัน", "days", "天")}</span>
              </div>
              <button className="songbtn go" style={{ width: "100%", marginTop: 8 }} disabled={mgBusy} onClick={applyPlan}>💾 {T("ตั้ง / เปลี่ยนแพลน", "Set / change plan", "设置/更改套餐")}</button>
            </>)}
            <div className="admmg-row2">
              {tier >= 3 && <button className="songbtn ghost" disabled={mgBusy} onClick={suspendPlan}>⏸ {T("ระงับ (เป็นฟรี)", "Suspend (free)", "暂停（免费）")}</button>}
              <button className={`songbtn ${sel.banned ? "go" : "ghost"}`} disabled={mgBusy} onClick={toggleBan}>{sel.banned ? "✓ " + T("ปลดแบน", "Unban", "解封") : "🚫 " + T("แบน ID", "Ban ID", "封禁")}</button>
            </div>
          </div>
        )}
        {/* 👑 appoint / re-tier admin — Top Tier only */}
        {tier >= 3 && (
          <div className="admmg">
            <div className="admmg-h">👑 {T("สิทธิ์แอดมิน", "Admin access", "管理员权限")}</div>
            <div className="admmg-cur">{T("ระดับปัจจุบัน", "Current tier", "当前等级")}: <b>{sel.admin_tier > 0 ? adminTierStars(sel.admin_tier) : T("ไม่ใช่แอดมิน", "Not an admin", "非管理员")}</b></div>
            <div className="admmg-row">
              <select className="admmg-sel" value={appointTier} onChange={e => setAppointTier(Number(e.target.value))}>
                <option value={0}>{T("ไม่ใช่แอดมิน", "Not an admin", "非管理员")}</option>
                <option value={1}>★ {T("ซัพพอร์ต (ดูอย่างเดียว)", "Support (view only)", "支持（仅查看）")}</option>
                <option value={2}>★★ {T("ปฏิบัติการ (แบน/ตั้งค่าสอน)", "Operations (ban / Auto Teaching)", "运营（封禁/自动教学）")}</option>
                <option value={3}>★★★ {T("Top Tier (สิทธิ์เต็ม)", "Top Tier (full access)", "最高级（完全权限）")}</option>
              </select>
            </div>
            <button className="songbtn go" style={{ width: "100%", marginTop: 8 }} disabled={mgBusy} onClick={doAppoint}>👑 {T("บันทึกระดับแอดมิน", "Save admin tier", "保存管理员等级")}</button>
          </div>
        )}
        <div className="pd-stats">
          {Stat((sel.exp || 0).toLocaleString(), "EXP")}
          {Stat(sel.lessons_done || 0, T("บทเรียน", "Lessons", "课程"))}
          {Stat((sel.streak || 0) + "🔥", T("ต่อเนื่อง", "Streak", "连续"))}
          {Stat(sum.games || (pr.gameLog || []).length || 0, T("เล่นเกม", "Games", "游戏"))}
          {Stat((sum.avgAcc || 0) + "%", T("แม่นยำเฉลี่ย", "Avg acc", "平均准确"))}
          {Stat(sum.keysLearned || 0, T("คีย์ที่เรียน", "Keys learned", "已学键"))}
          {Stat(sum.pathDone != null ? sum.pathDone : (pr.pathDone || []).length, T("บทเส้นทาง", "Pathway", "路径"))}
        </div>
        <ProgressDashboard lang={lang} plog={plog} gameLog={pr.gameLog || []} />
        {struggles.length > 0 &&<><div className="admstu-sec">{T("ต้องฝึกเพิ่ม", "Needs work", "需加强")}</div><div className="pd-tags">{struggles.map((s, i) => <span key={i} className="pd-tag focus">{s.label || s}</span>)}</div></>}
        {mastered.length > 0 && <><div className="admstu-sec">{T("ทำได้ดีแล้ว", "Mastered", "已掌握")}</div><div className="pd-tags">{mastered.map((s, i) => <span key={i} className="pd-tag good">{s}</span>)}</div></>}
        {recent.length > 0 && <><div className="admstu-sec">{T("ฝึกล่าสุด", "Recently practiced", "最近练习")}</div><div className="pd-tags">{recent.map((s, i) => <span key={i} className="pd-tag">{s.label || s}</span>)}</div></>}
        {!pr.updated && <div className="admstu-empty" style={{ marginTop: 12 }}>{T("นักเรียนยังไม่ได้ซิงค์ข้อมูลละเอียด (เปิดแอปอีกครั้งเพื่อซิงค์)", "No detailed progress synced yet (opens after they use the app again)", "尚未同步详细进度（学生再次使用后同步）")}</div>}
      </div>
    );
  }

  const list = rows; // search now happens server-side (admin_list_students_v2), not client-side
  return (
    <div className="admstu">
      <div className="admstu-top">
        <input className="admstu-search" value={q} onChange={e => setQ(e.target.value)} placeholder={T("ค้นหานักเรียน...", "Search students...", "搜索学生...")} />
        <button className="admstu-refresh" onClick={() => load(q)}>↻</button>
      </div>
      {err && <div className="admstu-err">{T("อ่านข้อมูลไม่ได้ (ต้องเข้าสู่ระบบด้วยบัญชีแอดมิน)", "Can't read data (sign in with an admin account)", "无法读取（需用管理员账号登录）")}: {err}</div>}
      <div className="admstu-count">{list.length} {T("นักเรียน", "students", "名学生")}</div>
      <div className="admstu-list">
        {list.map(r => {
          const li = levelInfo(r.exp || 0);
          const sum = (r.progress && r.progress.summary) || {};
          return (
            <button key={r.id} className="admstu-row" onClick={() => openUser(r)}>
              <div className="admstu-av sm">{(r.full_name || r.email || "?").trim().charAt(0).toUpperCase()}</div>
              <div className="admstu-row-body">
                <div className="admstu-row-nm">{r.full_name || r.email || "—"} {r.admin_tier > 0 && <span className="admstu-badge">{adminTierStars(r.admin_tier)}</span>}{r.banned && <span className="adminpay-badge rejected">BAN</span>}{r.plan && r.plan !== "free" && <span className="adminpay-badge approved">{r.plan.toUpperCase()}</span>}</div>
                <div className="admstu-row-meta">Lv {li.level} · {(r.exp || 0).toLocaleString()} EXP · {r.lessons_done || 0} {T("บท", "lessons", "课")} · {(r.streak || 0)}🔥{sum.games ? " · " + sum.games + " " + T("เกม", "games", "游戏") : ""}</div>
                <div className="admstu-row-sub">{r.email}{r.last_active ? " · " + r.last_active : ""}</div>
              </div>
              <span className="admstu-row-go">›</span>
            </button>
          );
        })}
        {!list.length && <div className="admstu-empty">{T("ไม่พบนักเรียน", "No students found", "未找到学生")}</div>}
      </div>
    </div>
  );
}

/* ── School Dashboard (teacher-facing, School Plan Pro) — tenant-scoped roster,
   real per-student progress, real cross-device song assignments. Reached only
   via a hidden link handed to onboarded teachers directly, never a nav item —
   but that hidden link is a discoverability veil, not the real lock: every
   RPC re-checks is_school_teacher() against the school_members table server
   side, so a teacher structurally cannot see another studio's roster even if
   they somehow found this page. ── */
const SchoolDashboard = memo(function SchoolDashboard({ lang, profile, onBack }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const lc = L[lang];
  const schoolId = profile.school_id;
  const [tab, setTab] = useState("roster");
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [sel, setSel] = useState(null);
  const [q, setQ] = useState("");
  const [school, setSchool] = useState(null);
  const [assignSong, setAssignSong] = useState("");
  const [busy, setBusy] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("student");
  const [addMsg, setAddMsg] = useState("");
  const [questGoal, setQuestGoal] = useState(500);
  const [questBusy, setQuestBusy] = useState(false);
  const [questMsg, setQuestMsg] = useState("");
  const [curQuest, setCurQuest] = useState(null);
  const loadQuest = useCallback(() => {
    sb.rpc("get_school_quest", { p_school_id: schoolId }).then(({ data, error }) => setCurQuest(error ? null : data));
  }, [schoolId]);
  useEffect(() => { loadQuest(); }, [loadQuest]);
  async function startQuest() {
    const goal = Number(questGoal) || 0;
    if (goal <= 0 || questBusy) return;
    setQuestBusy(true); setQuestMsg("");
    const { error } = await sb.rpc("school_set_quest", { p_school_id: schoolId, p_goal_exp: goal, p_days: 7 });
    setQuestBusy(false);
    if (error) { setQuestMsg(error.message || "error"); return; }
    setQuestMsg("✓"); loadQuest();
  }

  const load = useCallback(() => {
    setErr(""); setRows(null);
    sb.rpc("school_roster", { p_school_id: schoolId }).then(({ data, error }) => {
      if (error) { setErr(error.message || "error"); setRows([]); return; }
      const r = (data || []).slice().sort((a, b) => (b.role || "").localeCompare(a.role || "") || (b.last_active || "").localeCompare(a.last_active || ""));
      setRows(r);
    }, (e) => { setErr("" + (e && e.message || e)); setRows([]); });
  }, [schoolId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    sb.from("schools").select("*").eq("id", schoolId).maybeSingle().then(({ data }) => setSchool(data || null));
  }, [schoolId]);

  async function assign() {
    if (!sel || !assignSong) return; setBusy(true);
    const { error } = await sb.rpc("school_assign_song", { p_member_id: sel.member_id, p_song_id: assignSong });
    setBusy(false); if (!error) { setAssignSong(""); load(); }
  }
  async function removeMember() {
    if (!sel) return;
    if (!window.confirm(lc.schoolRemoveConfirm)) return;
    setBusy(true);
    const { error } = await sb.rpc("school_remove_member", { p_member_id: sel.member_id });
    setBusy(false); if (!error) { setSel(null); load(); }
  }
  async function addByEmail() {
    if (!addEmail.trim()) return; setBusy(true); setAddMsg("");
    const { error } = await sb.rpc("school_add_member_by_email", { p_school_id: schoolId, p_email: addEmail.trim(), p_role: addRole });
    setBusy(false);
    if (error) { setAddMsg(error.message || "error"); return; }
    setAddEmail(""); setAddMsg(lc.schoolAddBtn + " ✓"); load();
  }
  async function regenCode() {
    setBusy(true);
    const { data, error } = await sb.rpc("school_rotate_join_code", { p_school_id: schoolId });
    setBusy(false); if (!error && data) setSchool(s => s ? { ...s, join_code: data } : s);
  }
  function copyCode() {
    if (!school) return;
    try { navigator.clipboard.writeText(school.join_code); } catch {}
  }

  if (rows === null) return <div className="admstu"><div className="admstu-msg">⏳ {T("กำลังโหลด...", "Loading...", "正在加载...")}</div></div>;

  if (sel) {
    const li = levelInfo(sel.exp || 0);
    const pr = sel.progress || {};
    const sum = pr.summary || {};
    const mem = pr.memory || {};
    const struggles = (mem.struggles || []).slice(0, 8);
    const mastered = (mem.mastered || []).slice(0, 12);
    const plog = pr.practiceLog || {};
    const Stat = (num, lbl) => <div className="pd-stat"><div className="pd-num">{num}</div><div className="pd-lbl">{lbl}</div></div>;
    return (
      <div className="admstu schooldash">
        <button className="admstu-back" onClick={() => setSel(null)}>‹ {T("กลับ", "Back", "返回")}</button>
        <div className="admstu-head">
          <div className="admstu-av">{(sel.full_name || sel.email || "?").trim().charAt(0).toUpperCase()}</div>
          <div>
            <div className="admstu-nm">{sel.full_name || "—"} <span className="schoolrole-badge">{sel.role === "teacher" ? lc.schoolMyRoleTeacher : lc.schoolMyRoleStudent}</span></div>
            <div className="admstu-em">{sel.email || "—"}</div>
            <div className="admstu-lv">{li.tier && li.tier.icon} {T("ระดับ", "Level", "等级")} {li.level} · {T("ใช้ล่าสุด", "Last active", "最近活跃")}: {sel.last_active || "—"}</div>
          </div>
        </div>
        {sel.role === "student" && (
          <div className="admmg">
            <div className="admmg-h">🎵 {lc.schoolAssignBtn}</div>
            {sel.assigned_song_id && (
              <div className="admmg-cur">{lc.schoolAssignedTo}: <b>{tr(SONGS.find(s => s.id === sel.assigned_song_id), lang) || sel.assigned_song_id}</b>
                {" · "}{sel.ack_at ? "✅ " + lc.schoolAckYes : "⏳ " + lc.schoolAckNo}</div>
            )}
            <div className="admmg-row">
              <select className="admmg-sel" value={assignSong} onChange={e => setAssignSong(e.target.value)}>
                <option value="">{T("เลือกเพลง...", "Select a song...", "选择歌曲...")}</option>
                {SONGS.map(s => <option key={s.id} value={s.id}>{tr(s, lang)}</option>)}
              </select>
            </div>
            <button className="songbtn go" style={{ width: "100%", marginTop: 8 }} disabled={busy || !assignSong} onClick={assign}>🎵 {lc.schoolAssignBtn}</button>
          </div>
        )}
        <div className="pd-stats">
          {Stat((sel.exp || 0).toLocaleString(), "EXP")}
          {Stat(sel.lessons_done || 0, T("บทเรียน", "Lessons", "课程"))}
          {Stat((sel.streak || 0) + "🔥", T("ต่อเนื่อง", "Streak", "连续"))}
          {Stat(sum.games || (pr.gameLog || []).length || 0, T("เล่นเกม", "Games", "游戏"))}
          {Stat((sum.avgAcc || 0) + "%", T("แม่นยำเฉลี่ย", "Avg acc", "平均准确"))}
        </div>
        <ProgressDashboard lang={lang} plog={plog} gameLog={pr.gameLog || []} />
        {struggles.length > 0 && <><div className="admstu-sec">{T("ต้องฝึกเพิ่ม", "Needs work", "需加强")}</div><div className="pd-tags">{struggles.map((s, i) => <span key={i} className="pd-tag focus">{s.label || s}</span>)}</div></>}
        {mastered.length > 0 && <><div className="admstu-sec">{T("ทำได้ดีแล้ว", "Mastered", "已掌握")}</div><div className="pd-tags">{mastered.map((s, i) => <span key={i} className="pd-tag good">{s}</span>)}</div></>}
        {sel.role === "student" && (
          <button className="songbtn ghost" style={{ width: "100%", marginTop: 12 }} disabled={busy} onClick={removeMember}>✕ {lc.schoolRemoveBtn}</button>
        )}
      </div>
    );
  }

  const list = rows.filter(r => { const s = ((r.full_name || "") + " " + (r.email || "")).toLowerCase(); return s.includes(q.toLowerCase()); });
  const studentCount = rows.filter(r => r.role === "student").length;
  return (
    <div className="admstu schooldash">
      <div className="schoolhdr">
        <button className="admstu-back" onClick={onBack}>‹ {lc.schoolBack}</button>
        <div className="admstu-nm">🏫 {(school && school.name) || lc.schoolDashTitle}</div>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", margin: "2px 0 10px" }}>{lc.schoolDashSub}</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {["roster", "invite"].map(t => (
          <button key={t} className={`songfilter${tab === t ? " on" : ""}`} onClick={() => setTab(t)}>
            {t === "roster" ? lc.schoolRoster : lc.schoolInvite}
          </button>
        ))}
      </div>

      {tab === "roster" && (<>
        {school && <div className="schoolseat">{studentCount}/{school.seat_quota} {lc.schoolSeats}</div>}
        <div className="admstu-top">
          <input className="admstu-search" value={q} onChange={e => setQ(e.target.value)} placeholder={T("ค้นหานักเรียน...", "Search students...", "搜索学生...")} />
          <button className="admstu-refresh" onClick={load}>↻</button>
        </div>
        {err && <div className="admstu-err">{err}</div>}
        <div className="admstu-list">
          {list.map(r => {
            const li = levelInfo(r.exp || 0);
            return (
              <button key={r.member_id} className="admstu-row" onClick={() => setSel(r)}>
                <div className="admstu-av sm">{(r.full_name || r.email || "?").trim().charAt(0).toUpperCase()}</div>
                <div className="admstu-row-body">
                  <div className="admstu-row-nm">{r.full_name || r.email || "—"} <span className="schoolrole-badge">{r.role === "teacher" ? lc.schoolMyRoleTeacher : lc.schoolMyRoleStudent}</span></div>
                  <div className="admstu-row-meta">Lv {li.level} · {(r.exp || 0).toLocaleString()} EXP · {(r.streak || 0)}🔥{r.assigned_song_id ? " · " + (r.ack_at ? "✅" : "⏳") + " " + (tr(SONGS.find(s => s.id === r.assigned_song_id), lang) || r.assigned_song_id) : ""}</div>
                  <div className="admstu-row-sub">{r.email}{r.last_active ? " · " + r.last_active : ""}</div>
                </div>
                <span className="admstu-row-go">›</span>
              </button>
            );
          })}
          {!list.length && <div className="admstu-empty">{lc.schoolNoRoster}</div>}
        </div>
      </>)}

      {tab === "invite" && (<>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 8 }}>{lc.schoolCodeHint}</div>
        {school && <div className="schoolcode">{school.join_code}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button className="songbtn go" style={{ flex: 1 }} onClick={copyCode}>📋 {lc.schoolCodeCopy}</button>
          <button className="songbtn ghost" style={{ flex: 1 }} disabled={busy} onClick={regenCode}>↻ {lc.schoolCodeRegen}</button>
        </div>
        <div className="admmg" style={{ marginTop: 16 }}>
          <div className="admmg-h">✉️ {lc.schoolAddByEmail}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input className="aicreate-in" style={{ flex: 1 }} value={addEmail} onChange={e => { setAddEmail(e.target.value); setAddMsg(""); }} placeholder={lc.schoolAddByEmailPh} />
            <select className="admmg-sel" style={{ maxWidth: 110 }} value={addRole} onChange={e => setAddRole(e.target.value)}>
              <option value="student">{lc.schoolMyRoleStudent}</option>
              <option value="teacher">{lc.schoolMyRoleTeacher}</option>
            </select>
          </div>
          <button className="songbtn go" style={{ width: "100%", marginTop: 8 }} disabled={busy || !addEmail.trim()} onClick={addByEmail}>➕ {lc.schoolAddBtn}</button>
          {addMsg && <div style={{ textAlign: "center", color: "var(--accent)", fontSize: 13, marginTop: 6 }}>{addMsg}</div>}
        </div>
        <div className="admmg" style={{ marginTop: 16 }}>
          <div className="admmg-h">🎯 {lc.cqTitle}</div>
          {curQuest && curQuest.active ? (
            <div className="cqstat" style={{ marginBottom: 8 }}>{curQuest.total_exp.toLocaleString()} / {curQuest.goal_exp.toLocaleString()} EXP {curQuest.complete ? "🎉" : ""}</div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{T("ยังไม่มีภารกิจที่กำลังทำงาน", "No active quest right now", "目前没有进行中的任务")}</div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input className="aicreate-in" style={{ flex: 1 }} type="number" min="1" value={questGoal} onChange={e => setQuestGoal(e.target.value)} placeholder="500" />
            <button className="songbtn go" disabled={questBusy} onClick={startQuest}>{T("เริ่มภารกิจใหม่ (7 วัน)", "Start new (7d)", "开始新任务(7天)")}</button>
          </div>
          {questMsg && <div style={{ textAlign: "center", color: "var(--accent)", fontSize: 13, marginTop: 6 }}>{questMsg}</div>}
        </div>
      </>)}
    </div>
  );
});

/* ── Admin: Schools — staff-facing B2B provisioning (School Plan Pro). Tier ≥1
   can view (same floor as AdminStudents), tier ≥3 can create/renew/adjust seats
   (same floor as plan changes there). ── */
function AdminSchools({ lang, viewerTier }) {
  const tier = viewerTier || 0;
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPlan, setNewPlan] = useState("school_standard");
  const [newSeats, setNewSeats] = useState(15);
  const [newTeacherSeats, setNewTeacherSeats] = useState(3);
  const [newDays, setNewDays] = useState(365);
  const [msg, setMsg] = useState("");
  const [sel, setSel] = useState(null);
  const [seatEdit, setSeatEdit] = useState(0);
  const [teacherSeatEdit, setTeacherSeatEdit] = useState(0);
  const [renewPlan, setRenewPlan] = useState("school_standard");
  const [renewDays, setRenewDays] = useState(365);
  const [fulfillingReqId, setFulfillingReqId] = useState(null); // payment-request id the create-school form below is currently fulfilling, if any
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("teacher");
  const [addMsg, setAddMsg] = useState("");

  const load = useCallback(() => {
    setErr(""); setRows(null);
    sb.rpc("admin_list_schools").then(({ data, error }) => {
      if (error) { setErr(error.message || "error"); setRows([]); return; }
      setRows((data || []).slice());
    }, (e) => { setErr("" + (e && e.message || e)); setRows([]); });
  }, []);
  useEffect(() => { load(); }, [load]);

  // B2B payment requests (real School Plan Pro checkout) — pending/paid ones need a
  // human look before the school actually gets provisioned, same as every other
  // manual-review payment channel in this app.
  const [payReqs, setPayReqs] = useState([]);
  const loadPayReqs = useCallback(() => {
    // only surface what still needs a human look — fulfilled/rejected requests stay in
    // the table for audit history but drop out of this "needs attention" panel so it
    // can't grow unbounded as the school gradually accumulates fulfilled contracts
    sb.rpc("admin_list_school_payment_requests").then(({ data }) => setPayReqs((data || []).filter(r => r.status !== "rejected" && !r.fulfilled_at)), () => {});
  }, []);
  useEffect(() => { loadPayReqs(); }, [loadPayReqs]);
  async function reviewPayReq(id, approve) {
    setBusy(true);
    const { error } = await sb.rpc("admin_review_school_payment", { p_id: id, p_approve: approve });
    setBusy(false);
    if (!error) loadPayReqs();
  }
  function prefillFromPayReq(r) {
    setNewName(r.institution_name); setNewEmail(r.contact_email);
    setNewPlan(r.tier); setNewSeats(r.seats); setNewDays(r.cycle === "year" ? 365 : 30);
    setFulfillingReqId(r.id); setShowNew(true);
  }
  async function viewSlip(path) {
    const { data } = await sb.storage.from("slips").createSignedUrl(path, 600);
    if (data && data.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  async function createSchool() {
    if (!newName.trim() || !newEmail.trim()) return;
    setBusy(true); setMsg("");
    const { error } = await sb.rpc("admin_create_school", {
      p_name: newName.trim(), p_owner_email: newEmail.trim(), p_plan: newPlan,
      p_seat_quota: Number(newSeats) || 0, p_teacher_seat_quota: Number(newTeacherSeats) || 3, p_days: Number(newDays) || 365,
    });
    if (error) { setBusy(false); setMsg(error.message || "error"); return; }
    // mark the originating payment request fulfilled so it can't be double-provisioned
    // or silently forgotten — separate from admin_create_school's own success/failure,
    // this best-effort call intentionally doesn't block the school from having been
    // created even if it itself fails (e.g. transient network blip)
    if (fulfillingReqId) { await sb.rpc("admin_mark_school_payment_fulfilled", { p_id: fulfillingReqId }); loadPayReqs(); }
    setBusy(false);
    setNewName(""); setNewEmail(""); setNewSeats(15); setShowNew(false); setFulfillingReqId(null); load();
  }
  function openSchool(s) {
    setSel(s); setSeatEdit(s.seat_quota); setTeacherSeatEdit(s.teacher_seat_quota); setRenewPlan(s.plan); setRenewDays(365);
    setAddEmail(""); setAddRole("teacher"); setAddMsg("");
  }
  async function saveSeats() {
    if (!sel) return; setBusy(true);
    const { error } = await sb.rpc("admin_set_school_seats", { p_school_id: sel.id, p_seat_quota: Number(seatEdit) || 0, p_teacher_seat_quota: Number(teacherSeatEdit) || 0 });
    setBusy(false); if (!error) { setSel(null); load(); }
  }
  async function renew() {
    if (!sel) return; setBusy(true);
    const { error } = await sb.rpc("admin_renew_school", { p_school_id: sel.id, p_plan: renewPlan, p_days: Number(renewDays) || 365 });
    setBusy(false); if (!error) { setSel(null); load(); }
  }
  // Recovery path for a "headless" school (every teacher left) — school_add_member_by_email
  // requires the caller to already be a teacher there, which a headless school has none of.
  async function addMemberAdmin() {
    if (!sel || !addEmail.trim()) return;
    setBusy(true); setAddMsg("");
    const { error } = await sb.rpc("admin_add_school_member", { p_school_id: sel.id, p_email: addEmail.trim(), p_role: addRole });
    setBusy(false);
    if (error) { setAddMsg(error.message || "error"); return; }
    setAddEmail(""); setAddMsg(T("เพิ่มแล้ว ✓", "Added ✓", "已添加 ✓")); load();
  }

  if (rows === null) return <div className="admstu"><div className="admstu-msg">⏳ {T("กำลังโหลด...", "Loading...", "正在加载...")}</div></div>;

  if (sel) {
    return (
      <div className="admstu">
        <button className="admstu-back" onClick={() => setSel(null)}>‹ {T("กลับ", "Back", "返回")}</button>
        <div className="admstu-head">
          <div className="admstu-av">🏫</div>
          <div>
            <div className="admstu-nm">{sel.name}</div>
            <div className="admstu-em">{sel.owner_email}</div>
            <div className="admstu-lv">{sel.plan.toUpperCase()} · {sel.student_count}/{sel.seat_quota} {T("นักเรียน", "students", "学生")} · {sel.teacher_count}/{sel.teacher_seat_quota} {T("ครู", "teachers", "教师")}</div>
          </div>
        </div>
        {tier >= 3 && (<>
          <div className="admmg">
            <div className="admmg-h">🪑 {T("ปรับที่นั่ง", "Adjust seats", "调整席位")}</div>
            <div className="admmg-row">
              <input className="admmg-days" type="number" min="0" value={seatEdit} onChange={e => setSeatEdit(e.target.value)} />
              <span className="admmg-d">{T("นักเรียน", "students", "学生")}</span>
              <input className="admmg-days" type="number" min="0" value={teacherSeatEdit} onChange={e => setTeacherSeatEdit(e.target.value)} />
              <span className="admmg-d">{T("ครู", "teachers", "教师")}</span>
            </div>
            <button className="songbtn go" style={{ width: "100%", marginTop: 8 }} disabled={busy} onClick={saveSeats}>💾 {T("บันทึก", "Save", "保存")}</button>
          </div>
          <div className="admmg">
            <div className="admmg-h">🔄 {T("ต่ออายุ / เปลี่ยนแพลน", "Renew / change plan", "续费/更改套餐")}</div>
            <div className="admmg-cur">{sel.plan_until ? T("ถึง", "Until", "至") + " " + String(sel.plan_until).slice(0, 10) : ""}</div>
            <div className="admmg-row">
              <select className="admmg-sel" value={renewPlan} onChange={e => setRenewPlan(e.target.value)}>
                <option value="school_standard">Standard</option>
                <option value="school_plus">Plus</option>
              </select>
              <input className="admmg-days" type="number" min="1" value={renewDays} onChange={e => setRenewDays(e.target.value)} />
              <span className="admmg-d">{T("วัน", "days", "天")}</span>
            </div>
            <button className="songbtn go" style={{ width: "100%", marginTop: 8 }} disabled={busy} onClick={renew}>🔄 {T("ต่ออายุ", "Renew", "续费")}</button>
          </div>
          <div className="admmg">
            <div className="admmg-h">🛟 {T("เพิ่มสมาชิก (กู้คืน)", "Add member (recovery)", "添加成员（恢复）")}</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>{T("ใช้เมื่อโรงเรียนไม่มีครูเหลืออยู่เลย — ครูปกติเชิญกันเองได้ผ่านโค้ดเข้าร่วม ใช้ตรงนี้เฉพาะกรณีกู้คืนเท่านั้น", "For when a school has no active teacher left to invite anyone — normal invites go through the join code; use this only to recover", "仅用于该学校已无在职教师、无法自行邀请的恢复场景 — 正常邀请请使用加入码")}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input className="aicreate-in" style={{ flex: 1 }} value={addEmail} onChange={e => { setAddEmail(e.target.value); setAddMsg(""); }} placeholder={T("อีเมล (ต้องเคยล็อกอินแล้ว)", "Email (must have signed in once)", "邮箱（须已登录过）")} />
              <select className="admmg-sel" style={{ maxWidth: 110 }} value={addRole} onChange={e => setAddRole(e.target.value)}>
                <option value="teacher">{T("ครู", "Teacher", "教师")}</option>
                <option value="student">{T("นักเรียน", "Student", "学生")}</option>
              </select>
            </div>
            <button className="songbtn go" style={{ width: "100%", marginTop: 8 }} disabled={busy || !addEmail.trim()} onClick={addMemberAdmin}>➕ {T("เพิ่ม", "Add", "添加")}</button>
            {addMsg && <div style={{ textAlign: "center", color: "var(--accent)", fontSize: 13, marginTop: 6 }}>{addMsg}</div>}
          </div>
        </>)}
      </div>
    );
  }

  return (
    <div className="admstu">
      {payReqs.length > 0 && (
        <div className="admmg" style={{ borderColor: "#4caf5033" }}>
          <div className="admmg-h" style={{ color: "#4caf50" }}>💰 {T("คำขอชำระเงิน B2B", "B2B payment requests", "B2B付款请求")} ({payReqs.length})</div>
          {payReqs.map(r => (
            <div key={r.id} style={{ background: "var(--card3)", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
              <div className="admstu-row-nm">{r.institution_name} <span className="adminpay-badge approved">{r.fulfilled_at ? T("จัดเตรียมแล้ว", "PROVISIONED", "已开通") : r.status.toUpperCase()}</span></div>
              <div className="admstu-row-meta">{r.tier.replace("school_", "")} × {r.seats} {T("ที่นั่ง", "seats", "席位")} · {r.cycle === "year" ? T("รายปี", "yearly", "年付") : T("รายเดือน", "monthly", "月付")} · ฿{Number(r.amount).toLocaleString()} · {r.method}</div>
              <div className="admstu-row-sub">{r.contact_email}</div>
              {tier >= 3 && !r.fulfilled_at && (r.status === "pending" || r.status === "paid") && (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  {r.slip_path && <button className="songbtn ghost" style={{ padding: "8px 12px" }} onClick={() => viewSlip(r.slip_path)}>📎 {T("ดูสลิป", "View slip", "查看凭证")}</button>}
                  <button className="songbtn go" style={{ flex: 1, padding: 8 }} disabled={busy} onClick={() => { reviewPayReq(r.id, true); prefillFromPayReq(r); }}>✓ {T("อนุมัติ", "Approve", "批准")}</button>
                  <button className="songbtn ghost" style={{ flex: 1, padding: 8 }} disabled={busy} onClick={() => reviewPayReq(r.id, false)}>✕ {T("ปฏิเสธ", "Reject", "拒绝")}</button>
                </div>
              )}
              {tier >= 3 && !r.fulfilled_at && r.status === "approved" && (
                <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                  {r.slip_path && <button className="songbtn ghost" style={{ padding: "8px 12px" }} onClick={() => viewSlip(r.slip_path)}>📎 {T("ดูสลิป", "View slip", "查看凭证")}</button>}
                  <span style={{ fontSize: 11, color: "#d97757" }}>⏳ {T("อนุมัติแล้ว รอสร้างโรงเรียน", "Approved — still needs the school created", "已批准——仍需创建学校")}</span>
                  <button className="songbtn go" style={{ padding: "8px 12px" }} disabled={busy} onClick={() => prefillFromPayReq(r)}>🏫 {T("เติมฟอร์ม", "Prefill form", "填充表单")}</button>
                </div>
              )}
            </div>
          ))}
          {tier >= 3 && <div style={{ fontSize: 11, color: "var(--muted)" }}>{T("กด อนุมัติ จะเติมฟอร์ม \"สร้างโรงเรียนใหม่\" ด้านล่างให้อัตโนมัติ — ต้องกด สร้าง อีกครั้งเพื่อเปิดใช้งานจริง", "Approve pre-fills the \"Create new school\" form below — you still need to hit Create to actually provision it.", "点击批准会自动填充下方\"创建新学校\"表单——仍需再点创建才会真正开通。")}</div>}
        </div>
      )}
      <div className="admstu-top">
        <div className="admstu-count">{rows.length} {T("โรงเรียน", "schools", "学校")}</div>
        {tier >= 3 && <button className="admstu-refresh" onClick={() => setShowNew(v => !v)}>{showNew ? "✕" : "➕"}</button>}
      </div>
      {showNew && tier >= 3 && (
        <div className="admmg">
          <div className="admmg-h">🏫 {T("สร้างโรงเรียนใหม่", "Create new school", "创建新学校")}</div>
          <input className="aicreate-in" style={{ marginBottom: 8 }} value={newName} onChange={e => setNewName(e.target.value)} placeholder={T("ชื่อสถาบัน", "Institution name", "机构名称")} />
          <input className="aicreate-in" style={{ marginBottom: 8 }} value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder={T("อีเมลเจ้าของ/ครูใหญ่ (ต้องเคยล็อกอินแล้ว)", "Owner/head-teacher email (must have signed in once)", "负责人邮箱（须已登录过）")} />
          <div className="admmg-row">
            <select className="admmg-sel" value={newPlan} onChange={e => setNewPlan(e.target.value)}>
              <option value="school_standard">Standard</option>
              <option value="school_plus">Plus</option>
            </select>
            <input className="admmg-days" type="number" min="1" value={newSeats} onChange={e => setNewSeats(e.target.value)} />
            <span className="admmg-d">{T("ที่นั่ง", "seats", "席位")}</span>
          </div>
          <div className="admmg-row">
            <input className="admmg-days" type="number" min="1" value={newTeacherSeats} onChange={e => setNewTeacherSeats(e.target.value)} />
            <span className="admmg-d">{T("ครู", "teachers", "教师")}</span>
            <input className="admmg-days" type="number" min="1" value={newDays} onChange={e => setNewDays(e.target.value)} />
            <span className="admmg-d">{T("วัน", "days", "天")}</span>
          </div>
          <button className="songbtn go" style={{ width: "100%", marginTop: 8 }} disabled={busy || !newName.trim() || !newEmail.trim()} onClick={createSchool}>✓ {T("สร้าง", "Create", "创建")}</button>
          {msg && <div style={{ textAlign: "center", color: "#e55", fontSize: 13, marginTop: 6 }}>{msg}</div>}
        </div>
      )}
      {err && <div className="admstu-err">{err}</div>}
      <div className="admstu-list">
        {rows.map(s => (
          <button key={s.id} className="admstu-row" onClick={() => openSchool(s)}>
            <div className="admstu-av sm">🏫</div>
            <div className="admstu-row-body">
              <div className="admstu-row-nm">{s.name} <span className="adminpay-badge approved">{s.plan.replace("school_", "").toUpperCase()}</span></div>
              <div className="admstu-row-meta">{s.student_count}/{s.seat_quota} {T("นักเรียน", "students", "学生")} · {s.teacher_count}/{s.teacher_seat_quota} {T("ครู", "teachers", "教师")}</div>
              <div className="admstu-row-sub">{s.owner_email}{s.plan_until ? " · " + T("ถึง", "until", "至") + " " + String(s.plan_until).slice(0, 10) : ""}</div>
            </div>
            <span className="admstu-row-go">›</span>
          </button>
        ))}
        {!rows.length && <div className="admstu-empty">{T("ยังไม่มีโรงเรียน", "No schools yet", "还没有学校")}</div>}
      </div>
    </div>
  );
}

/* ── Admin: payment review — PromptPay config, slip list, AI slip read, approve ── */
function AdminPayments({ lang }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState(null);
  const [cfg, setCfg] = useState({ promptpay: "", name: "", bank: "", stripe: false, alipay_qr: "", wechat_qr: "" });
  const [cfgSaved, setCfgSaved] = useState(false);
  const [slipUrl, setSlipUrl] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiText, setAiText] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    setRows(null);
    sb.from("payments").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => setRows(error ? [] : (data || [])), () => setRows([]));
  }, []);
  useEffect(() => {
    load();
    sb.from("app_settings").select("value").eq("key", "payment").maybeSingle()
      .then(({ data }) => {
        if (data && data.value) {
          const v = data.value;
          setCfg({ promptpay: v.promptpay || "", name: v.name || "", bank: v.bank || "", stripe: !!v.stripe, alipay_qr: v.alipay_qr || "", wechat_qr: v.wechat_qr || "" });
        }
      });
  }, [load]);
  async function saveCfg() {
    setCfgSaved(false);
    const value = { promptpay: cfg.promptpay.trim(), name: cfg.name.trim(), bank: cfg.bank.trim(), stripe: cfg.stripe, alipay_qr: cfg.alipay_qr.trim(), wechat_qr: cfg.wechat_qr.trim() };
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "payment", p_value: value });
    if (!error) { setCfgSaved(true); setTimeout(() => setCfgSaved(false), 2500); }
  }
  async function openSel(p) {
    setSel(p); setAiText(p.ai_check ? aiSummary(p.ai_check, p.amount) : ""); setSlipUrl(null);
    if (p.slip_path) { const { data } = await sb.storage.from("slips").createSignedUrl(p.slip_path, 600); setSlipUrl((data && data.signedUrl) || null); }
  }
  function aiSummary(c, amount) {
    if (!c) return "";
    if (c.raw) return c.raw;
    const match = c.match != null ? c.match : (Math.abs((c.amount || 0) - amount) < 1);
    return `฿${c.amount} · ${c.date || ""} ${c.time || ""}\n→ ${c.recipient || "?"}\n${T("จาก", "from", "来自")} ${c.sender || "?"} · ref ${c.ref || "-"}\n` +
      (match ? T("✅ ยอดตรง", "✅ amount matches", "✅ 金额相符") : T("⚠️ ยอดไม่ตรง (ควรเป็น ฿", "⚠️ amount mismatch (expected ฿", "⚠️ 金额不符（应为 ฿") + amount + ")");
  }
  async function aiRead() {
    if (!sel || !sel.slip_path) return;
    setAiBusy(true); setAiText("");
    try {
      const { data } = await sb.storage.from("slips").createSignedUrl(sel.slip_path, 600);
      const url = data && data.signedUrl; if (!url) throw new Error("no url");
      const blob = await (await fetch(url)).blob();
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
      const media = blob.type || "image/jpeg";
      const sys = "You verify Thai bank-transfer / PromptPay slips. Read the slip image and return ONLY minified JSON: {\"amount\":number,\"date\":string,\"time\":string,\"sender\":string,\"recipient\":string,\"ref\":string,\"bank\":string}. Use null for any unreadable field.";
      const body = { model: API_MODEL, max_tokens: 600, system: sys, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: media, data: String(b64).split(",")[1] } }, { type: "text", text: "Extract the payment details from this slip. The expected amount is " + sel.amount + " THB." }] }] };
      const txt = await fetchChatCompletion(body);
      let parsed = null; try { const m = txt.match(/\{[\s\S]*\}/); parsed = m ? JSON.parse(m[0]) : null; } catch (e) {}
      if (parsed) parsed.match = Math.abs((parsed.amount || 0) - sel.amount) < 1;
      const store = parsed || { raw: txt.slice(0, 500) };
      setAiText(aiSummary(store, sel.amount));
      sb.from("payments").update({ ai_check: store }).eq("id", sel.id).then(() => {}, () => {});
    } catch (e) { setAiText(T("อ่านสลิปไม่สำเร็จ (ฟีเจอร์รูปภาพต้องรันนอก preview)", "Couldn't read slip (image AI needs to run outside preview)", "读取失败（图片AI需在预览外运行）")); }
    setAiBusy(false);
  }
  async function review(approve) {
    if (!sel) return; setBusy(true);
    const { error } = await sb.rpc("admin_review_payment", { pid: sel.id, approve, days: sel.days || 30 });
    setBusy(false);
    if (!error) { setSel(null); load(); }
  }

  if (sel) {
    const st = sel.status;
    return (
      <div className="adminpay">
        <button className="admstu-back" onClick={() => setSel(null)}>‹ {T("กลับ", "Back", "返回")}</button>
        <div className="admstu-head">
          <div className="admstu-av">{(sel.full_name || sel.email || "?").trim().charAt(0).toUpperCase()}</div>
          <div>
            <div className="admstu-nm">{sel.full_name || sel.email || "—"} <span className={`adminpay-badge ${st}`}>{st.toUpperCase()}</span></div>
            <div className="admstu-em">{sel.email}</div>
            <div className="admstu-lv">{(PLAN_LABEL[sel.plan] || sel.plan)} · <b style={{ color: "#d97757" }}>฿{(sel.amount || 0).toLocaleString()}</b> · {(sel.created_at || "").slice(0, 16).replace("T", " ")}</div>
          </div>
        </div>
        {slipUrl ? <img className="payslip" src={slipUrl} alt="slip" /> : <div className="admstu-empty">{sel.slip_path ? T("กำลังโหลดสลิป…", "Loading slip…", "加载中…") : T("ไม่มีสลิป", "No slip", "无凭证")}</div>}
        <button className="songbtn ghost" style={{ width: "100%" }} disabled={aiBusy || !sel.slip_path} onClick={aiRead}>
          {aiBusy ? "⏳ " + T("AI กำลังอ่าน…", "AI reading…", "AI 读取中…") : "🤖 " + T("ให้ AI อ่านสลิป", "AI: read this slip", "AI 读取凭证")}
        </button>
        {aiText && <div className="aibox">{aiText}</div>}
        {st === "pending" ? (
          <div className="songready-btns" style={{ marginTop: 10 }}>
            <button className="songbtn go" disabled={busy} onClick={() => review(true)}>✅ {T("อนุมัติ เปิดสิทธิ์ ", "Approve — ", "批准 — ")}{sel.days || 30} {T("วัน", "days", "天")}</button>
            <button className="songbtn ghost" disabled={busy} onClick={() => review(false)}>✕ {T("ปฏิเสธ", "Reject", "拒绝")}</button>
          </div>
        ) : <div className="admstu-empty">{T("ตรวจแล้ว", "Already reviewed", "已处理")}: {st}</div>}
      </div>
    );
  }

  const list = rows || [];
  const pending = list.filter(p => p.status === "pending");
  return (
    <div className="adminpay">
      <div className="adminpay-cfg">
        <div className="admstu-nm" style={{ fontSize: 15 }}>⚙️ {T("ตั้งค่าช่องทางรับเงิน", "Payment channel settings", "收款渠道设置")}</div>

        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, marginTop: 8, marginBottom: 2 }}>🇹🇭 PromptPay (ไทย)</div>
        <input value={cfg.promptpay} onChange={e => setCfg({ ...cfg, promptpay: e.target.value })} placeholder={T("เบอร์ PromptPay หรือเลขผู้เสียภาษี", "PromptPay number or tax ID", "PromptPay 号码或税号")} inputMode="numeric" />
        <input value={cfg.name} onChange={e => setCfg({ ...cfg, name: e.target.value })} placeholder={T("ชื่อบัญชี / ชื่อร้าน", "Account / shop name", "账户/店名")} />
        <input value={cfg.bank} onChange={e => setCfg({ ...cfg, bank: e.target.value })} placeholder={T("ธนาคาร (ไม่บังคับ)", "Bank (optional)", "银行（可选）")} />

        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, marginTop: 12, marginBottom: 2 }}>💳 Stripe (ไทย + อังกฤษ)</div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
          <input type="checkbox" checked={!!cfg.stripe} onChange={e => setCfg({ ...cfg, stripe: e.target.checked })} style={{ width: 16, height: 16 }} />
          {T("เปิดใช้ Stripe (เชื่อม edge function stripe-checkout)", "Enable Stripe (connects stripe-checkout edge function)", "启用 Stripe（连接 stripe-checkout 边缘函数）")}
        </label>

        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, marginTop: 12, marginBottom: 2 }}>🔵 Alipay 支付宝 (中文)</div>
        <input value={cfg.alipay_qr} onChange={e => setCfg({ ...cfg, alipay_qr: e.target.value })} placeholder="QR image path — e.g. ./payqr/alipay.jpg" />

        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, marginTop: 8, marginBottom: 2 }}>🟢 WeChat Pay 微信支付 (中文)</div>
        <input value={cfg.wechat_qr} onChange={e => setCfg({ ...cfg, wechat_qr: e.target.value })} placeholder="QR image path — e.g. ./payqr/wechat.png" />

        <button className="songbtn go" style={{ width: "100%", marginTop: 12 }} onClick={saveCfg}>{cfgSaved ? "✓ " + T("บันทึกแล้ว", "Saved", "已保存") : T("บันทึกการตั้งค่า", "Save settings", "保存设置")}</button>
      </div>
      <div className="admstu-count">{pending.length} {T("รอตรวจ", "pending", "待处理")} · {list.length} {T("ทั้งหมด", "total", "全部")}</div>
      {rows === null ? <div className="admstu-msg">⏳</div> : !list.length ? <div className="admstu-empty">{T("ยังไม่มีรายการชำระเงิน", "No payments yet", "暂无付款")}</div> : (
        <div className="admstu-list">
          {list.map(p => (
            <button key={p.id} className={`adminpay-row ${p.status}`} onClick={() => openSel(p)}>
              <div className="admstu-av sm">{(p.full_name || p.email || "?").trim().charAt(0).toUpperCase()}</div>
              <div className="admstu-row-body">
                <div className="admstu-row-nm">{p.full_name || p.email || "—"} <span className={`adminpay-badge ${p.status}`}>{p.status}</span></div>
                <div className="admstu-row-meta">{(PLAN_LABEL[p.plan] || p.plan)} · ฿{(p.amount || 0).toLocaleString()} · {(p.created_at || "").slice(0, 10)}</div>
              </div>
              <span className="admstu-row-go">›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Admin: upload + manage vertical teaching videos ── */
function AdminVideos({ lang }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [rows, setRows] = useState(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  const load = useCallback(() => {
    setRows(null);
    sb.from("lesson_videos").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => setRows(error ? [] : (data || [])), () => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addVideo() {
    if (!title.trim()) { setErr("notitle"); return; }
    // A YouTube playlist becomes one CATEGORY — every video in it shows as its own
    // swipeable slide, resolved server-side via the YouTube Data API. Google Drive
    // links still work for backward compatibility, but Drive content can't embed
    // in-page (third-party cookie restrictions) and only opens in a new tab.
    const ytPlaylistId = youtubePlaylistId(link);
    const folderId = ytPlaylistId ? null : driveFolderId(link);
    const fileId = (ytPlaylistId || folderId) ? null : driveFileId(link);
    if (!ytPlaylistId && !folderId && !fileId) { setErr("badlink"); return; }
    setErr(false); setBusy(true);
    try {
      const row = { title: title.trim(), description: desc.trim() || null, published: true };
      if (ytPlaylistId) row.youtube_playlist_id = ytPlaylistId;
      else if (folderId) row.drive_folder_id = folderId;
      else row.drive_file_id = fileId;
      const ins = await sb.from("lesson_videos").insert(row);
      if (ins.error) throw ins.error;
      setTitle(""); setDesc(""); setLink("");
      playUi("levelup");
      load();
    } catch (e) { setErr("fail"); }
    setBusy(false);
  }
  async function toggle(v) { await sb.from("lesson_videos").update({ published: !v.published }).eq("id", v.id); load(); }
  async function del(v) { await sb.from("lesson_videos").delete().eq("id", v.id); load(); }

  const list = rows || [];
  return (
    <div className="adminpay">
      <div className="adminpay-cfg">
        <div className="admstu-nm" style={{ fontSize: 15 }}>🎬 {T("เพิ่มหมวดหมู่วิดีโอใหม่ (YouTube Playlist)", "Add a new video category (YouTube playlist)", "添加新的视频分类（YouTube 播放列表）")}</div>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder={T("ชื่อหมวดหมู่ (แสดงเป็นชื่อแท็บ)", "Category name (shown as the tab label)", "分类名称（显示为标签）")} />
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder={T("คำอธิบาย (ไม่บังคับ)", "Description (optional)", "描述（可选）")} />
        <input value={link} onChange={e => setLink(e.target.value)} placeholder={T("วางลิงก์ YouTube playlist (หรือลิงก์ Google Drive)", "Paste a YouTube playlist link (or a Google Drive link)", "粘贴 YouTube 播放列表链接（或 Google Drive 链接）")} />
        <button className="songbtn go" style={{ width: "100%", marginTop: 9 }} disabled={busy} onClick={addVideo}>
          {busy ? "⏳ " + T("กำลังเพิ่ม…", "Adding…", "添加中…") : "➕ " + T("เพิ่ม", "Add", "添加")}
        </button>
        {err === "notitle" && <div className="admstu-empty" style={{ color: "#ff5252" }}>{T("ใส่ชื่อวิดีโอก่อนนะ", "Add a title first", "请先填写标题")}</div>}
        {err === "badlink" && <div className="admstu-empty" style={{ color: "#ff5252" }}>{T("อ่านลิงก์ไม่ออก ลองคัดลอกลิงก์ playlist จาก YouTube มาใหม่", "Couldn't read that link — copy the playlist link from YouTube again", "无法识别该链接，请重新从 YouTube 复制播放列表链接")}</div>}
        {err === "fail" && <div className="admstu-empty" style={{ color: "#ff5252" }}>{T("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง", "Save failed — try again", "保存失败，请重试")}</div>}
        <div className="admstu-empty" style={{ fontSize: 11, marginTop: 6 }}>{T("💡 เปิด playlist บน YouTube → กด Share → คัดลอกลิงก์ (ต้องตั้งเป็น Public หรือ Unlisted ไม่ใช่ Private) แล้ววางที่นี่ — ทุกวิดีโอใน playlist จะแสดงเป็นหมวดหมู่เดียวกัน", "💡 Open the playlist on YouTube → Share → copy the link (must be Public or Unlisted, not Private) and paste it here — every video in it becomes one category", "💡 在 YouTube 上打开播放列表 → 分享 → 复制链接（必须是公开或不公开列出，不能是私享）粘贴到这里 — 播放列表中的所有视频将归为同一分类")}</div>
      </div>
      <div className="admstu-count">{list.length} {T("หมวดหมู่ทั้งหมด", "categories total", "个分类")}</div>
      {rows === null ? <div className="admstu-msg">⏳</div> : !list.length ? <div className="admstu-empty">{T("ยังไม่มีวิดีโอ เพิ่มอันแรกได้เลย", "No videos yet — add the first one", "还没有视频，添加第一个吧")}</div> : (
        <div className="admstu-list">
          {list.map(v => (
            <div key={v.id} className="adminpay-row" style={{ cursor: "default" }}>
              <div className="admstu-av sm">{v.youtube_playlist_id ? "▶️" : v.drive_folder_id ? "📁" : "🎬"}</div>
              <div className="admstu-row-body">
                <div className="admstu-row-nm">{v.title} <span className={`adminpay-badge ${v.published ? "approved" : "pending"}`}>{v.published ? T("เผยแพร่แล้ว", "Published", "已发布") : T("ฉบับร่าง", "Draft", "草稿")}</span></div>
                <div className="admstu-row-meta">{v.youtube_playlist_id ? T("YouTube playlist · ", "YouTube playlist · ", "YouTube 播放列表 · ") : v.drive_folder_id ? T("โฟลเดอร์ · ", "Folder · ", "文件夹 · ") : ""}{(v.created_at || "").slice(0, 10)}{v.description ? " · " + v.description : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button className="songbtn ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => toggle(v)}>{v.published ? T("ซ่อน", "Unpublish", "取消发布") : T("เผยแพร่", "Publish", "发布")}</button>
                <button className="songbtn ghost" style={{ padding: "6px 10px", fontSize: 12, color: "#ff5252" }} onClick={() => del(v)}>{T("ลบ", "Delete", "删除")}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Admin: usage analytics — which Pathway topics / nav buttons / pages get
   used most, so development effort can follow real usage. ── */
function AdminAnalytics({ lang }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [range, setRange] = useState("all"); // '7' | '30' | 'all'
  const [stats, setStats] = useState(null);
  const NAV_LABELS = { pathway: "⬡ PATHWAY", sensei: "◈ TIGA AI", studio: "▶ STUDIO", videos: "🎬 " + T("วิดีโอสอน", "Video Lessons", "视频课程"), profile: "PROFILE", admin: "ADMIN" };

  const load = useCallback(() => {
    setStats(null);
    const since = range === "all" ? null : new Date(Date.now() - Number(range) * 86400000).toISOString();
    sb.rpc("get_usage_stats", { p_kind: null, p_since: since })
      .then(({ data, error }) => setStats(error ? [] : (data || [])), () => setStats([]));
  }, [range]);
  useEffect(() => { load(); }, [load]);

  const byKind = (k) => (stats || []).filter(r => r.kind === k);
  const Panel = ({ title, rows, labelFor }) => {
    const max = rows.length ? Math.max(...rows.map(r => Number(r.hits))) : 1;
    return (
      <div className="adminpay-cfg">
        <div className="admstu-nm" style={{ fontSize: 15, marginBottom: 8 }}>{title}</div>
        {!rows.length ? <div className="admstu-empty">{T("ยังไม่มีข้อมูล", "No data yet", "暂无数据")}</div> : rows.map((r, i) => (
          <div key={r.item_id} className="anrow">
            <span className="anrow-rank">#{i + 1}</span>
            <span className="anrow-name">{labelFor ? labelFor(r.item_id) : r.item_id}</span>
            <span className="anrow-barwrap"><span className="anrow-bar" style={{ width: `${Math.max(6, (Number(r.hits) / max) * 100)}%` }} /></span>
            <span className="anrow-hits">{r.hits}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="adminpay">
      <div className="billtoggle">
        {[["1", T("1 วัน", "1d", "1天")], ["7", T("7 วัน", "7d", "7天")], ["30", T("30 วัน", "30d", "30天")], ["all", T("ทั้งหมด", "All time", "全部")]].map(([v, l]) => (
          <button key={v} className={`billtog${range === v ? " on" : ""}`} onClick={() => setRange(v)}>{l}</button>
        ))}
      </div>
      {stats === null ? <div className="admstu-msg">⏳</div> : (
        <>
          <Panel title={T("⬡ หัวข้อเส้นทางการเรียนรู้ (Pathway)", "⬡ Pathway topics", "⬡ 学习路径主题")} rows={byKind("pathway")}
            labelFor={(id) => { const st = PATHWAY.find(s => s.id === id); return st ? tr(st.title, lang) : id; }} />
          <Panel title={T("☰ ปุ่มนำทาง (Nav bar)", "☰ Nav bar buttons", "☰ 导航栏按钮")} rows={byKind("nav")}
            labelFor={(id) => NAV_LABELS[id] || id} />
          <Panel title={T("📄 หน้าที่เข้าชม", "📄 Pages visited", "📄 访问的页面")} rows={byKind("page")}
            labelFor={(id) => NAV_LABELS[id] || id} />
        </>
      )}
    </div>
  );
}

/* ── Admin: Auto Teaching platform-default interval (tier ≥2) ── */
function AdminAutoTeach({ lang }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [min, setMin] = useState(null);   // null = loading
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    sb.from("app_settings").select("value").eq("key", "auto_teach").maybeSingle()
      .then(({ data }) => setMin((data && data.value && data.value.default_min) ?? AUTO_TEACH_FALLBACK_MIN), () => setMin(AUTO_TEACH_FALLBACK_MIN));
  }, []);
  useEffect(() => { load(); }, [load]);
  async function save(v) {
    setBusy(true); setSaved(false);
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "auto_teach", p_value: { default_min: v } });
    setBusy(false);
    if (!error) { setMin(v); setSaved(true); setTimeout(() => setSaved(false), 2500); } else { alert(error.message || "error"); }
  }
  if (min === null) return <div className="admstu"><div className="admstu-msg">⏳</div></div>;
  return (
    <div className="admstu">
      <div className="admmg">
        <div className="admmg-h">⏱️ {T("ความถี่ Auto Teaching (ค่าเริ่มต้นทั้งระบบ)", "Auto Teaching frequency (platform default)", "自动教学频率（系统默认）")}</div>
        <div className="admstu-row-sub" style={{ marginBottom: 10 }}>
          {T("ทุกกี่นาทีจะมี pop up จากครู AI แนะนำจุดอ่อนระหว่างที่ผู้เรียน Max อยู่หน้าเส้นทางการเรียนรู้ ผู้เรียนสามารถตั้งค่าของตัวเองทับค่านี้ได้",
            "How often the AI coach pops up with a real-time tip while a Max learner is on the Pathway (home) page. Learners can override this with their own pick.",
            "Max 学员在学习路径页面时，AI 教练多久弹出一次实时建议。学员可以设置自己的偏好覆盖此默认值。")}
        </div>
        <div className="setlangs">
          <button className={`setlangbtn${min === 0 ? " on" : ""}`} disabled={busy} onClick={() => save(0)}>{T("ปิด", "Off", "关闭")}</button>
          {AUTO_TEACH_INTERVALS.map(m => (
            <button key={m} className={`setlangbtn${min === m ? " on" : ""}`} disabled={busy} onClick={() => save(m)}>{m}{T("น.", "m", "分")}</button>
          ))}
        </div>
        {saved && <div className="admstu-row-sub" style={{ color: "#d97757", marginTop: 10 }}>✓ {T("บันทึกแล้ว", "Saved", "已保存")}</div>}
      </div>
    </div>
  );
}

/* ── Admin: which LLM the STUDENT-FACING chat/tutor calls — reads/writes the
   same app_settings "ai_model" key the piano-chat edge function checks on
   every request for its {message,conversationHistory,system} path. Lets Tiga
   flip to a cheaper model instantly (no redeploy) if usage spikes. Does NOT
   touch the admin "Teach AI" tab, which always calls Anthropic directly since
   it needs Anthropic-specific web-search/vision tools the edge function's
   raw-passthrough path is built around. ── */
const AI_MODEL_PRESETS = [
  { id: "claude", provider: "anthropic", model: "claude-sonnet-4-6", label: "Claude Sonnet" },
  { id: "gemini-lite", provider: "gemini", model: "gemini-2.5-flash-lite", label: "Gemini Flash-Lite" },
  { id: "gemini-flash", provider: "gemini", model: "gemini-2.5-flash", label: "Gemini Flash" },
];
function AdminAIModel({ lang }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [cfg, setCfg] = useState(null); // null = loading, else {provider, model}
  const [modelInput, setModelInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const load = useCallback(() => {
    sb.from("app_settings").select("value").eq("key", "ai_model").maybeSingle()
      .then(({ data }) => {
        const v = (data && data.value && data.value.provider && data.value.model) ? data.value : AI_MODEL_PRESETS[0];
        setCfg(v); setModelInput(v.model);
      }, () => { setCfg(AI_MODEL_PRESETS[0]); setModelInput(AI_MODEL_PRESETS[0].model); });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(provider, model) {
    if (!model || !model.trim()) return;
    setBusy(true); setSaved(false);
    const value = { provider, model: model.trim() };
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "ai_model", p_value: value });
    setBusy(false);
    if (!error) { setCfg(value); setModelInput(value.model); setSaved(true); playUi("levelup"); setTimeout(() => setSaved(false), 2500); }
    else alert(error.message || "error");
  }

  if (cfg === null) return <div className="admstu"><div className="admstu-msg">⏳</div></div>;
  return (
    <div className="admstu">
      <div className="admmg">
        <div className="admmg-h">🧠 {T("โมเดล AI สำหรับแชทผู้เรียน", "AI model for the student-facing chat", "学员聊天使用的 AI 模型")}</div>
        <div className="admstu-row-sub" style={{ marginBottom: 10 }}>
          {T('สลับได้ทันที ไม่ต้อง deploy ใหม่ — ใช้เมื่อผู้ใช้เยอะและต้องการลดต้นทุน AI ไม่กระทบแท็บ "สอน AI" (ใช้ Claude เสมอ เพราะต้องใช้ฟีเจอร์ค้นเน็ต/รูปภาพ)',
            'Switches instantly, no redeploy — use this to cut AI cost when usage is high. Doesn’t affect the "Teach AI" tab (always Claude, since it needs web-search/vision).',
            '立即切换，无需重新部署 — 用户量大时用来降低 AI 成本。不影响"训练 AI"标签页（始终使用 Claude，因为需要联网/图片功能）。')}
        </div>
        <div className="setlangs">
          {AI_MODEL_PRESETS.map(p => (
            <button key={p.id} className={`setlangbtn${cfg.provider === p.provider && cfg.model === p.model ? " on" : ""}`}
              disabled={busy} onClick={() => save(p.provider, p.model)}>{p.label}</button>
          ))}
        </div>
        <div className="admstu-row-sub" style={{ marginTop: 14, marginBottom: 6 }}>
          {T("ชื่อโมเดลที่ใช้จริง (แก้ได้ถ้าต้องการระบุเวอร์ชันอื่น):", "Exact model ID in use (editable if you need a different version):", "实际使用的模型 ID（如需其他版本可编辑）：")}
        </div>
        <div className="admmg-row">
          <input className="aicreate-in" value={modelInput} onChange={e => setModelInput(e.target.value)} placeholder="e.g. gemini-2.5-flash" />
          <button className="songbtn go" disabled={busy || !modelInput.trim()} onClick={() => save(cfg.provider, modelInput)}>{T("บันทึก", "Save", "保存")}</button>
        </div>
        <div className="admstu-row-sub" style={{ marginTop: 10 }}>
          {T("ผู้ให้บริการปัจจุบัน:", "Current provider:", "当前提供商：")} <b>{cfg.provider === "gemini" ? "Google Gemini" : "Anthropic"}</b>
        </div>
        {saved && <div className="admstu-row-sub" style={{ color: "#d97757", marginTop: 10 }}>✓ {T("บันทึกแล้ว — มีผลกับข้อความถัดไปทันที", "Saved — takes effect on the next message", "已保存 — 下一条消息即生效")}</div>}
      </div>
    </div>
  );
}

/* ── Admin: broadcast a popup announcement (text + optional image) to every learner's
   home page, on demand — a one-off push, not a recurring schedule like Auto Teaching. ── */
function AdminBroadcast({ lang }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [cur, setCur] = useState(undefined); // undefined = loading, null = never sent one, object = current
  const [msg, setMsg] = useState("");
  const [img, setImg] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const load = useCallback(() => {
    sb.from("app_settings").select("value").eq("key", "broadcast").maybeSingle()
      .then(({ data }) => setCur((data && data.value) || null), () => setCur(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function send() {
    if (!msg.trim()) return;
    setBusy(true); setSaved(false);
    const value = { id: Date.now(), message: msg.trim(), image_url: img.trim() || null, active: true };
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "broadcast", p_value: value });
    setBusy(false);
    if (!error) { setCur(value); setMsg(""); setImg(""); setSaved(true); playUi("levelup"); setTimeout(() => setSaved(false), 2500); } else { alert(error.message || "error"); }
  }
  async function takeDown() {
    if (!cur) return;
    setBusy(true);
    const value = { ...cur, active: false };
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "broadcast", p_value: value });
    setBusy(false);
    if (!error) setCur(value);
  }

  if (cur === undefined) return <div className="admstu"><div className="admstu-msg">⏳</div></div>;
  return (
    <div className="admstu">
      <div className="admmg">
        <div className="admmg-h">📢 {T("ส่งประกาศเด้งหน้าแรก", "Send a home-page popup", "发送首页弹窗公告")}</div>
        <div className="admstu-row-sub" style={{ marginBottom: 10, whiteSpace: "normal" }}>
          {T("ข้อความนี้จะเด้งเป็น pop-up ที่หน้าเส้นทางการเรียนรู้ของผู้เรียนทุกคน (เห็นภายในไม่ถึงนาที)",
            "This shows as a popup on every learner's Pathway (home) page — live within under a minute.",
            "此消息将以弹窗形式出现在所有学员的学习路径（首页）——不到一分钟内生效。")}
        </div>
        <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={3} className="admstu-search"
          placeholder={T("พิมพ์ข้อความประกาศ...", "Write the announcement...", "输入公告内容…")}
          style={{ width: "100%", resize: "vertical", boxSizing: "border-box", marginBottom: 8, fontFamily: "'Rajdhani',sans-serif" }} />
        <input value={img} onChange={e => setImg(e.target.value)} className="admstu-search"
          placeholder={T("ลิงก์รูปภาพ (ไม่บังคับ)", "Image URL (optional)", "图片链接（可选）")}
          style={{ width: "100%", boxSizing: "border-box", marginBottom: 10 }} />
        {img.trim() && <img src={img.trim()} alt="" style={{ maxWidth: "100%", borderRadius: 10, marginBottom: 10, display: "block" }} onError={e => { e.target.style.display = "none"; }} />}
        <button className="songbtn go" style={{ width: "100%" }} disabled={busy || !msg.trim()} onClick={send}>
          {busy ? "⏳" : "📢"} {T("ส่งเลย", "Send now", "立即发送")}
        </button>
        {saved && <div className="admstu-row-sub" style={{ color: "#d97757", marginTop: 10, whiteSpace: "normal" }}>✓ {T("ส่งแล้ว — ขึ้นหน้าแรกผู้เรียนทันที", "Sent — now live on every learner's home page", "已发送——已在学员首页生效")}</div>}
      </div>

      {cur && cur.active && (
        <div className="admmg" style={{ marginTop: 12 }}>
          <div className="admmg-h">{T("กำลังแสดงอยู่ตอนนี้", "Currently live", "当前正在展示")}</div>
          <div className="admstu-row-sub" style={{ marginBottom: 8, whiteSpace: "normal" }}>{cur.message}</div>
          {cur.image_url && <img src={cur.image_url} alt="" style={{ maxWidth: "100%", borderRadius: 10, marginBottom: 8, display: "block" }} />}
          <button className="songbtn ghost" style={{ width: "100%", color: "#ff5252" }} disabled={busy} onClick={takeDown}>
            {T("ยกเลิกประกาศนี้", "Take this down", "撤下此公告")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Admin: seasonal/limited-time event — same app_settings + admin_set_app_setting
   mechanism as AdminBroadcast above (key "event" instead of "broadcast"), applying
   temporary EXP/coin multipliers instead of a popup message. See the activeEvent
   poll + gainExp/earnCoins in PianoApp for how the client consumes this. ── */
function AdminEvent({ lang }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [cur, setCur] = useState(undefined); // undefined = loading, null = none, object = current
  const [nameTh, setNameTh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [expMult, setExpMult] = useState(2);
  const [coinMult, setCoinMult] = useState(2);
  const [days, setDays] = useState(2);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const load = useCallback(() => {
    sb.from("app_settings").select("value").eq("key", "event").maybeSingle()
      .then(({ data }) => setCur((data && data.value) || null), () => setCur(null));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function start() {
    if (!nameTh.trim() && !nameEn.trim()) return;
    setBusy(true); setSaved(false);
    const value = {
      active: true,
      name_th: nameTh.trim() || nameEn.trim(), name_en: nameEn.trim() || nameTh.trim(), name_zh: nameZh.trim() || nameEn.trim() || nameTh.trim(),
      expMult: Number(expMult) || 1, coinMult: Number(coinMult) || 1,
      ends_at: new Date(Date.now() + (Number(days) || 1) * 86400000).toISOString(),
    };
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "event", p_value: value });
    setBusy(false);
    if (!error) { setCur(value); setSaved(true); playUi("levelup"); setTimeout(() => setSaved(false), 2500); } else { alert(error.message || "error"); }
  }
  async function stop() {
    if (!cur) return;
    setBusy(true);
    const value = { ...cur, active: false };
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "event", p_value: value });
    setBusy(false);
    if (!error) setCur(value);
  }

  if (cur === undefined) return <div className="admstu"><div className="admstu-msg">⏳</div></div>;
  const isLive = cur && cur.active && (!cur.ends_at || new Date(cur.ends_at).getTime() > Date.now());
  return (
    <div className="admstu">
      {isLive && (
        <div className="admmg" style={{ marginBottom: 12 }}>
          <div className="admmg-h">{T("กำลังจัดอีเว้นท์อยู่ตอนนี้", "Currently live", "当前正在进行")}</div>
          <div className="admstu-row-sub" style={{ marginBottom: 8, whiteSpace: "normal" }}>
            {tr({ th: cur.name_th, en: cur.name_en, zh: cur.name_zh }, lang)} · {cur.expMult}× EXP · {cur.coinMult}× 🪙 · {T("จนถึง", "until", "至")} {new Date(cur.ends_at).toLocaleString()}
          </div>
          <button className="songbtn ghost" style={{ width: "100%", color: "#ff5252" }} disabled={busy} onClick={stop}>{T("จบอีเว้นท์นี้ตอนนี้", "End this event now", "立即结束此活动")}</button>
        </div>
      )}
      <div className="admmg">
        <div className="admmg-h">🎉 {T("เริ่มอีเว้นท์ใหม่", "Start a new event", "开始新活动")}</div>
        <input className="admstu-search" value={nameTh} onChange={e => setNameTh(e.target.value)} placeholder={T("ชื่ออีเว้นท์ (ไทย) เช่น สงกรานต์ EXP คูณ 2", "Event name (Thai)", "活动名称（泰文）")} style={{ width: "100%", boxSizing: "border-box", marginBottom: 8 }} />
        <input className="admstu-search" value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder={T("ชื่ออีเว้นท์ (อังกฤษ)", "Event name (English)", "活动名称（英文）")} style={{ width: "100%", boxSizing: "border-box", marginBottom: 8 }} />
        <input className="admstu-search" value={nameZh} onChange={e => setNameZh(e.target.value)} placeholder={T("ชื่ออีเว้นท์ (จีน) — ไม่บังคับ", "Event name (Chinese) — optional", "活动名称（中文）— 可选")} style={{ width: "100%", boxSizing: "border-box", marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <div className="admstu-row-sub" style={{ marginBottom: 4 }}>{T("ตัวคูณ EXP", "EXP multiplier", "EXP 倍数")}</div>
            <input className="admstu-search" type="number" min="1" max="10" step="0.5" value={expMult} onChange={e => setExpMult(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="admstu-row-sub" style={{ marginBottom: 4 }}>{T("ตัวคูณเหรียญ", "Coin multiplier", "金币倍数")}</div>
            <input className="admstu-search" type="number" min="1" max="10" step="0.5" value={coinMult} onChange={e => setCoinMult(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="admstu-row-sub" style={{ marginBottom: 4 }}>{T("จำนวนวัน", "Days", "天数")}</div>
            <input className="admstu-search" type="number" min="1" max="30" value={days} onChange={e => setDays(e.target.value)} style={{ width: "100%", boxSizing: "border-box" }} />
          </div>
        </div>
        <button className="songbtn go" style={{ width: "100%" }} disabled={busy || (!nameTh.trim() && !nameEn.trim())} onClick={start}>
          {busy ? "⏳" : "🎉"} {T("เริ่มเลย", "Start now", "立即开始")}
        </button>
        {saved && <div className="admstu-row-sub" style={{ color: "#d97757", marginTop: 10, whiteSpace: "normal" }}>✓ {T("เริ่มแล้ว — ผู้เรียนเห็นแบนเนอร์ทันที", "Started — the banner is now live for every learner", "已开始——横幅已对所有学员生效")}</div>}
      </div>
    </div>
  );
}

/* ── Admin chat (free-form AI + web search + image/link learning) ── */
/* ── Admin: manage Music Games list (stored in app_settings key "music_games") ── */
function AdminGames({ lang }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [games, setGames] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [editId, setEditId] = useState<number | null>(null);

  // Add-form state
  const [aTitle, setATitle] = useState("");
  const [aDesc, setADesc] = useState("");
  const [aLink, setALink] = useState("");
  const [aCover, setACover] = useState("");       // data URL or https URL
  const [aImgBusy, setAImgBusy] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const aFileRef = useRef<HTMLInputElement>(null);

  // Edit-form state
  const [eTitle, setETitle] = useState("");
  const [eDesc, setEDesc] = useState("");
  const [eLink, setELink] = useState("");
  const [eCover, setECover] = useState("");
  const [eImgBusy, setEImgBusy] = useState(false);
  const eFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setGames(null);
    sb.from("app_settings").select("value").eq("key", "music_games").maybeSingle()
      .then(({ data }) => setGames(data && data.value ? data.value : []), () => setGames([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Compress image file → JPEG data URL (max 600px wide, quality 0.78)
  function compressImg(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const MAX = 600;
          let w = img.width, h = img.height;
          if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d")!.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/jpeg", 0.78));
        };
        img.onerror = reject;
        img.src = ev.target!.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleImgPick(file: File, setter: (v: string) => void, setBusy: (v: boolean) => void) {
    if (!file.type.startsWith("image/")) return;
    setBusy(true);
    try { setter(await compressImg(file)); } catch (_) {}
    setBusy(false);
  }

  async function saveList(next: any[]) {
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "music_games", p_value: next });
    if (!error) { setGames(next); return true; }
    return false;
  }

  async function addGame() {
    if (!aTitle.trim()) { setErr("notitle"); return; }
    if (!aLink.trim() || !aLink.startsWith("http")) { setErr("badlink"); return; }
    setErr(""); setBusy(true);
    const cur = games || [];
    const next = [...cur, { id: Date.now(), title: aTitle.trim(), desc: aDesc.trim(), link: aLink.trim(), cover: aCover }];
    const ok = await saveList(next);
    setBusy(false);
    if (ok) { setATitle(""); setADesc(""); setALink(""); setACover(""); setShowAddForm(false); try { playUi("levelup"); } catch(_) {} }
    else setErr("fail");
  }

  async function saveEdit(id: number) {
    if (!eTitle.trim()) return;
    if (!eLink.trim() || !eLink.startsWith("http")) { setErr("elink"); return; }
    setBusy(true);
    const next = (games || []).map((g: any) => g.id === id ? { ...g, title: eTitle.trim(), desc: eDesc.trim(), link: eLink.trim(), cover: eCover } : g);
    const ok = await saveList(next);
    setBusy(false);
    if (ok) { setEditId(null); setErr(""); }
    else setErr("fail");
  }

  function startEdit(g: any) {
    setEditId(g.id); setETitle(g.title); setEDesc(g.desc || ""); setELink(g.link); setECover(g.cover || ""); setErr("");
  }

  async function delGame(id: number) {
    if (!confirm(T("ลบเกมนี้?", "Delete this game?", "删除此游戏？"))) return;
    const next = (games || []).filter((g: any) => g.id !== id);
    await saveList(next);
    if (editId === id) setEditId(null);
  }

  async function moveGame(idx: number, dir: -1 | 1) {
    const arr = [...(games || [])];
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= arr.length) return;
    [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
    await saveList(arr);
  }

  const list = games || [];
  const inputStyle: any = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 10, border: "1.5px solid var(--bd6)", background: "var(--input)", color: "var(--fg)", fontSize: 13, marginBottom: 8, outline: "none" };
  const errMsg = (key: string, msg: string) => err === key && <div style={{ color: "#ff5252", fontSize: 12, marginBottom: 6 }}>{msg}</div>;

  // Shared cover-picker UI (used in both add and edit forms)
  function CoverPicker({ cover, setCover, fileRef, imgBusy, setImgBusy }: any) {
    return (
      <div style={{ gridColumn: "1/-1" }}>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>{T("รูปหน้าปก", "Cover Image", "封面图片")}</div>
        {/* Upload zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImgPick(f, setCover, setImgBusy); }}
          style={{ border: "2px dashed var(--bd6)", borderRadius: 12, padding: cover ? "10px" : "20px 10px", textAlign: "center", cursor: "pointer", background: "var(--bg2)", marginBottom: 8, transition: "border-color .2s" }}>
          {imgBusy ? (
            <div style={{ color: "var(--muted)", fontSize: 13 }}>⏳ {T("กำลังประมวลผล…", "Processing…", "处理中…")}</div>
          ) : cover ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src={cover} alt="" style={{ width: 72, height: 54, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{T("รูปที่เลือก", "Image selected", "已选择图片")} ✅</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{T("คลิกเพื่อเปลี่ยนรูป", "Click to change", "点击更换")}</div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{T("คลิกหรือลากรูปมาวางที่นี่", "Click or drag image here", "点击或拖拽图片到这里")}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{T("รองรับ JPG, PNG, WebP · ย่อขนาดอัตโนมัติ", "JPG, PNG, WebP — auto-compressed", "支持 JPG/PNG/WebP · 自动压缩")}</div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleImgPick(f, setCover, setImgBusy); e.target.value = ""; }} />
        {/* OR: paste URL */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ flex: 1, height: 1, background: "var(--bd6)" }} />
          <div style={{ fontSize: 11, color: "var(--muted)" }}>{T("หรือวาง URL", "or paste URL", "或粘贴网址")}</div>
          <div style={{ flex: 1, height: 1, background: "var(--bd6)" }} />
        </div>
        <input style={{ ...inputStyle, marginBottom: 0 }}
          value={cover.startsWith("data:") ? "" : cover}
          onChange={e => setCover(e.target.value)}
          placeholder="https://example.com/cover.jpg" />
        {cover && (
          <button onClick={() => setCover("")} style={{ background: "none", border: "none", color: "#ff5252", fontSize: 11, cursor: "pointer", marginTop: 4, padding: 0 }}>
            ✕ {T("ลบรูปออก", "Remove image", "删除图片")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "0 4px 24px" }}>
      {/* Header + Add button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>🎮 {T("จัดการเกมดนตรี", "Manage Music Games", "管理音乐游戏")}</div>
          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 2 }}>{list.length} {T("เกมทั้งหมด", "games total", "个游戏")}</div>
        </div>
        <button className="songbtn go" style={{ padding: "9px 18px", fontSize: 13 }} onClick={() => { setShowAddForm(f => !f); setErr(""); }}>
          {showAddForm ? "✕ " + T("ยกเลิก", "Cancel", "取消") : "➕ " + T("เพิ่มเกมใหม่", "Add Game", "添加游戏")}
        </button>
      </div>

      {/* Add-form panel */}
      {showAddForm && (
        <div style={{ background: "var(--card)", borderRadius: 16, border: "1.5px solid var(--bd6)", padding: "18px 16px", marginBottom: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>➕ {T("เพิ่มเกมใหม่", "New Game", "添加新游戏")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{T("ชื่อเกม *", "Game Name *", "游戏名称 *")}</div>
              <input style={inputStyle} value={aTitle} onChange={e => setATitle(e.target.value)} placeholder={T("เช่น Piano Tiles 2", "e.g. Piano Tiles 2", "例如 Piano Tiles 2")} />
              {errMsg("notitle", T("ใส่ชื่อเกมก่อน", "Game name required", "请填写游戏名称"))}
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{T("ลิงก์ URL *", "Game URL *", "游戏链接 *")}</div>
              <input style={inputStyle} value={aLink} onChange={e => setALink(e.target.value)} placeholder="https://..." />
              {errMsg("badlink", T("URL ต้องขึ้นต้นด้วย https://", "URL must start with https://", "URL必须以https://"))}
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{T("คำอธิบาย", "Description", "描述")}</div>
              <input style={inputStyle} value={aDesc} onChange={e => setADesc(e.target.value)} placeholder={T("อธิบายเกมสั้นๆ", "Short description", "简短描述")} />
            </div>
            <CoverPicker cover={aCover} setCover={setACover} fileRef={aFileRef} imgBusy={aImgBusy} setImgBusy={setAImgBusy} />
          </div>
          {errMsg("fail", T("บันทึกไม่สำเร็จ ลองใหม่", "Save failed. Try again.", "保存失败，请重试"))}
          <button className="songbtn go" style={{ width: "100%", marginTop: 14 }} disabled={busy || aImgBusy} onClick={addGame}>
            {busy ? "⏳" : "✅ " + T("บันทึกเกม", "Save Game", "保存游戏")}
          </button>
        </div>
      )}

      {/* Game list */}
      {games === null ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>⏳</div>
      ) : !list.length ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 14, background: "var(--card)", borderRadius: 16, border: "1.5px dashed var(--bd6)" }}>
          🎮 {T("ยังไม่มีเกม กด \"เพิ่มเกมใหม่\" เพื่อเริ่ม", "No games yet — click \"Add Game\" to start", "还没有游戏 — 点击\"添加游戏\"开始")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((g: any, idx: number) => (
            <div key={g.id} style={{ background: "var(--card)", borderRadius: 16, border: editId === g.id ? "2px solid var(--acc)" : "1.5px solid var(--bd6)", overflow: "hidden" }}>
              {/* Row header */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}>
                {/* Order controls */}
                <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
                  <button onClick={() => moveGame(idx, -1)} disabled={idx === 0} style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", fontSize: 14, opacity: idx === 0 ? 0.25 : 0.7, padding: "0 4px", lineHeight: 1 }}>▲</button>
                  <button onClick={() => moveGame(idx, 1)} disabled={idx === list.length - 1} style={{ background: "none", border: "none", cursor: idx === list.length - 1 ? "default" : "pointer", fontSize: 14, opacity: idx === list.length - 1 ? 0.25 : 0.7, padding: "0 4px", lineHeight: 1 }}>▼</button>
                </div>
                {/* Cover thumbnail */}
                {g.cover ? (
                  <img src={g.cover} alt="" style={{ width: 60, height: 45, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 60, height: 45, borderRadius: 10, background: "linear-gradient(135deg,#d97757,#f5a623)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🎮</div>
                )}
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.title}</div>
                  {g.desc && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.desc}</div>}
                  <a href={g.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: "var(--acc)", wordBreak: "break-all", display: "block", marginTop: 2, textDecoration: "none" }} onClick={e => e.stopPropagation()}>🔗 {g.link.replace(/^https?:\/\//, "").slice(0, 38)}{g.link.length > 48 ? "…" : ""}</a>
                </div>
                {/* Action buttons */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <button className="songbtn ghost" style={{ padding: "5px 12px", fontSize: 12 }}
                    onClick={() => editId === g.id ? setEditId(null) : startEdit(g)}>
                    {editId === g.id ? "✕" : "✏️ " + T("แก้ไข", "Edit", "编辑")}
                  </button>
                  <button className="songbtn ghost" style={{ padding: "5px 12px", fontSize: 12, color: "#ff5252" }}
                    onClick={() => delGame(g.id)}>
                    🗑 {T("ลบ", "Delete", "删除")}
                  </button>
                </div>
              </div>

              {/* Inline edit form */}
              {editId === g.id && (
                <div style={{ borderTop: "1.5px solid var(--bd6)", padding: "14px 16px", background: "var(--bg2)" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>✏️ {T("แก้ไขข้อมูลเกม", "Edit Game Details", "编辑游戏信息")}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{T("ชื่อเกม *", "Game Name *", "游戏名称 *")}</div>
                      <input style={inputStyle} value={eTitle} onChange={e => setETitle(e.target.value)} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{T("ลิงก์ URL *", "Game URL *", "游戏链接 *")}</div>
                      <input style={inputStyle} value={eLink} onChange={e => setELink(e.target.value)} />
                      {errMsg("elink", T("URL ต้องขึ้นต้นด้วย https://", "URL must start with https://", "URL必须以https://"))}
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>{T("คำอธิบาย", "Description", "描述")}</div>
                      <input style={inputStyle} value={eDesc} onChange={e => setEDesc(e.target.value)} />
                    </div>
                    <CoverPicker cover={eCover} setCover={setECover} fileRef={eFileRef} imgBusy={eImgBusy} setImgBusy={setEImgBusy} />
                  </div>
                  {errMsg("fail", T("บันทึกไม่สำเร็จ", "Save failed", "保存失败"))}
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button className="songbtn go" style={{ flex: 1 }} disabled={busy || eImgBusy} onClick={() => saveEdit(g.id)}>
                      {busy ? "⏳" : "✅ " + T("บันทึก", "Save Changes", "保存更改")}
                    </button>
                    <button className="songbtn ghost" style={{ flex: 1 }} onClick={() => { setEditId(null); setErr(""); }}>
                      {T("ยกเลิก", "Cancel", "取消")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Music Games page — shows game cards loaded from admin-managed list ── */
const GamesPage = memo(function GamesPage({ lang }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [games, setGames] = useState<any[] | null>(null);

  useEffect(() => {
    sb.from("app_settings").select("value").eq("key", "music_games").maybeSingle()
      .then(({ data }) => setGames(data && data.value ? data.value : []), () => setGames([]));
  }, []);

  return (
    <div className="profilewrap">
      <div className="profhdr">
        <div className="profavwrap">
          <div style={{ fontSize: 36 }}>🎮</div>
        </div>
        <div className="profname">Music Games</div>
        <div className="profxp-lbl" style={{ color: "var(--muted)", fontSize: 13 }}>
          {T("เกมดนตรีจากทั่วโลก — กดเพื่อเล่น!", "Music games from around the world — tap to play!", "来自世界各地的音乐游戏 — 点击即玩！")}
        </div>
      </div>
      <div style={{ padding: "0 14px 24px" }}>
        {games === null ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>⏳</div>
        ) : games.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--muted)", fontSize: 14 }}>
            {T("ยังไม่มีเกม — แอดมินกำลังเพิ่มเกมใหม่เร็วๆ นี้!", "No games yet — admin is adding games soon!", "暂无游戏 — 管理员即将添加新游戏！")}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 14, marginTop: 12 }}>
            {games.map((g: any) => (
              <a key={g.id} href={g.link} target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: "none", display: "flex", flexDirection: "column", background: "var(--card)", borderRadius: 16, overflow: "hidden", border: "1px solid var(--bd6)", transition: "transform .15s", boxShadow: "0 2px 12px rgba(0,0,0,.12)" }}
                onClick={() => { try { playUi("click"); } catch(_) {} }}>
                {g.cover ? (
                  <img src={g.cover} alt={g.title} style={{ width: "100%", height: 110, objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: 110, background: "linear-gradient(135deg,#d97757,#f5a623)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44 }}>🎮</div>
                )}
                <div style={{ padding: "10px 12px 14px" }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)", marginBottom: 4 }}>{g.title}</div>
                  {g.desc && <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>{g.desc}</div>}
                  <div style={{ marginTop: 10, display: "inline-block", background: "#d97757", color: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>
                    ▶ {T("เล่น", "Play", "开始游戏")}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

function AdminPage({ lang, onExit, adminTier }) {
  const tier = adminTier || 0;
  const lc = L[lang];
  const [msgs, setMsgs] = useState([{
    role: "ai",
    text: lang === "th"
      ? "🔓 เข้าสู่ ADMIN CONSOLE สำเร็จ\n\nโหมดนี้ผมตอบได้ทุกเรื่อง และ:\n🌐 ค้นข้อมูลจากอินเทอร์เน็ตได้ (เปิดสวิตช์ WEB ด้านล่าง)\n🖼️ ส่งรูปภาพให้ผมวิเคราะห์ได้ (ปุ่ม +)\n🔗 วางลิงก์ให้ผมอ่านได้\n\nส่งข้อมูลใหม่มาให้ผมเรียนรู้ได้เลยครับ Tiga"
      : lang === "zh"
      ? "🔓 已进入 ADMIN CONSOLE\n\n此模式我可以回答任何问题，并且：\n🌐 可从互联网搜索信息（开启下方WEB开关）\n🖼️ 可发送图片让我分析（+按钮）\n🔗 可粘贴链接让我阅读\n\n请发送新信息让我学习。"
      : "🔓 ADMIN CONSOLE unlocked\n\nIn this mode I answer anything, plus:\n🌐 Search the internet (toggle WEB below)\n🖼️ Send images to analyze (+ button)\n🔗 Paste links to read\n\nFeed me new info to learn from, Tiga."
  }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [attachedImg, setAttachedImg] = useState(null); // {dataUrl, mediaType, name}
  const [adminTab, setAdminTab] = useState(tier >= 3 ? "ai" : "students"); // "ai" chat · "students" back-office · "autoteach"
  const endRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  function buildHist() {
    return buildAlternatingHistory(msgs, 0); // admin: keep full history
  }

  function pickImage() { fileRef.current?.click(); }

  function onFileChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert(lang === "th" ? "รองรับเฉพาะรูปภาพครับ" : lang === "zh" ? "仅支持图片" : "Images only");
      e.target.value = "";
      return;
    }
    // guard against huge uploads: FileReader loads the whole file into memory
    // and base64 inflates it ~33%, so an oversized image can crash the tab.
    const MAX_MB = 5;
    if (file.size > MAX_MB * 1024 * 1024) {
      alert(lang === "th" ? `ไฟล์ใหญ่เกินไป (จำกัด ${MAX_MB}MB)`
        : lang === "zh" ? `文件太大（上限 ${MAX_MB}MB）`
        : `File too large (max ${MAX_MB}MB)`);
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImg({ dataUrl: reader.result, mediaType: file.type, name: file.name });
    };
    reader.onerror = () => {
      alert(lang === "th" ? "อ่านไฟล์ไม่สำเร็จ" : lang === "zh" ? "读取文件失败" : "Failed to read file");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function sendAdmin() {
    const t = input.trim();
    if ((!t && !attachedImg) || loading) return;

    const userText = t || (lang === "th" ? "(ส่งรูปภาพ)" : lang === "zh" ? "(已发送图片)" : "(image sent)");
    const imgForMsg = attachedImg;
    setInput("");
    setAttachedImg(null);
    setMsgs(p => [...p, { role: "user", text: userText, img: imgForMsg?.dataUrl }]);
    setLoading(true);

    const hist = buildHist();

    try {
      // Build the user content — supports image blocks + web search tool
      let userContent;
      if (imgForMsg) {
        userContent = [
          { type: "image", source: { type: "base64", media_type: imgForMsg.mediaType, data: imgForMsg.dataUrl.split(",")[1] } },
          { type: "text", text: t || (lang === "th" ? "ช่วยวิเคราะห์รูปนี้ และเรียนรู้จากมัน" : lang === "zh" ? "请分析这张图片并学习" : "Analyze this image and learn from it.") }
        ];
      } else {
        userContent = t;
      }

      const body = {
        model: API_MODEL,
        max_tokens: 2000,
        system: lc.adminSys,
        messages: [...hist, { role: "user", content: userContent }]
      };
      if (webSearch) {
        body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
      }

      // image + web search require the direct API (window.claude.complete is text-only)
      const needDirect = !!imgForMsg || webSearch;
      let reply;

      if (!needDirect && window.claude && typeof window.claude.complete === "function") {
        reply = await window.claude.complete(buildTextPrompt(lc.adminSys, hist, t));
      } else {
        reply = await fetchChatCompletion(body);
      }

      setMsgs(p => [...p, { role: "ai", text: (reply || "").trim() || lc.err }]);
    } catch (e) {
      console.error("Admin chat error:", e); // full detail for devs only
      const msg = "" + (e?.message || "");
      const isNetwork = msg.includes("Failed to fetch") || msg.includes("CSP") || msg.includes("NetworkError");
      const hint = lang === "th"
        ? "\n\n💡 ฟีเจอร์ค้นเน็ต/รูปภาพ ต้องเปิดนอก preview — กด \"Open in new tab\" หรือ host บนเว็บของคุณ"
        : lang === "zh"
        ? "\n\n💡 联网/图片功能需在预览外运行 — 点击\"Open in new tab\"或托管在您的网站"
        : "\n\n💡 Web/image features need to run outside preview — use \"Open in new tab\" or host on your site.";
      // show the actionable hint for known network/CSP cases; otherwise a clean
      // generic message (never leak raw internal error text to the user)
      setMsgs(p => [...p, { role: "ai", text: lc.err + (isNetwork ? hint : "") }]);
    }
    setLoading(false);
  }

  return (
    <div className="adminpage">
      <div className="adminbar">
        <div className="adminbar-l">
          <div className="adminorb"><span>⬢</span></div>
          <div className="adminmeta">
            <div className="admintitle">{lc.adminTitle}</div>
            <div className="adminsub">{lc.adminSub}</div>
          </div>
        </div>
        <button className="adminexit" onClick={onExit}>✕ EXIT</button>
      </div>

      <div className="admintabs">
        {tier >= 3 && <button className={`admintab${adminTab === "ai" ? " on" : ""}`} onClick={() => setAdminTab("ai")}>🤖 {lang === "th" ? "สอน AI" : lang === "zh" ? "训练 AI" : "Teach AI"}</button>}
        <button className={`admintab${adminTab === "students" ? " on" : ""}`} onClick={() => setAdminTab("students")}>👥 {lang === "th" ? "นักเรียน" : lang === "zh" ? "学生" : "Students"}</button>
        <button className={`admintab${adminTab === "schools" ? " on" : ""}`} onClick={() => setAdminTab("schools")}>🏫 {lang === "th" ? "โรงเรียน" : lang === "zh" ? "学校" : "Schools"}</button>
        {tier >= 3 && <button className={`admintab${adminTab === "payments" ? " on" : ""}`} onClick={() => setAdminTab("payments")}>💳 {lang === "th" ? "ชำระเงิน" : lang === "zh" ? "付款" : "Payments"}</button>}
        {tier >= 3 && <button className={`admintab${adminTab === "videos" ? " on" : ""}`} onClick={() => setAdminTab("videos")}>🎬 {lang === "th" ? "วิดีโอ" : lang === "zh" ? "视频" : "Videos"}</button>}
        {tier >= 3 && <button className={`admintab${adminTab === "analytics" ? " on" : ""}`} onClick={() => setAdminTab("analytics")}>📊 {lang === "th" ? "สถิติ" : lang === "zh" ? "统计" : "Analytics"}</button>}
        {tier >= 2 && <button className={`admintab${adminTab === "autoteach" ? " on" : ""}`} onClick={() => setAdminTab("autoteach")}>⏱️ {lang === "th" ? "ตั้งเวลาสอน" : lang === "zh" ? "自动教学" : "Auto Teaching"}</button>}
        {tier >= 3 && <button className={`admintab${adminTab === "broadcast" ? " on" : ""}`} onClick={() => setAdminTab("broadcast")}>📢 {lang === "th" ? "ประกาศ" : lang === "zh" ? "公告" : "Broadcast"}</button>}
        {tier >= 3 && <button className={`admintab${adminTab === "event" ? " on" : ""}`} onClick={() => setAdminTab("event")}>🎉 {lang === "th" ? "อีเว้นท์" : lang === "zh" ? "活动" : "Event"}</button>}
        {tier >= 3 && <button className={`admintab${adminTab === "games" ? " on" : ""}`} onClick={() => setAdminTab("games")}>🎮 {lang === "th" ? "เกม" : lang === "zh" ? "游戏" : "Games"}</button>}
        {tier >= 3 && <button className={`admintab${adminTab === "aimodel" ? " on" : ""}`} onClick={() => setAdminTab("aimodel")}>🧠 {lang === "th" ? "โมเดล AI" : lang === "zh" ? "AI 模型" : "AI Model"}</button>}
      </div>

      {adminTab === "students" ? <AdminStudents lang={lang} viewerTier={tier} />
        : adminTab === "schools" ? <AdminSchools lang={lang} viewerTier={tier} />
        : adminTab === "payments" && tier >= 3 ? <AdminPayments lang={lang} />
        : adminTab === "videos" && tier >= 3 ? <AdminVideos lang={lang} />
        : adminTab === "analytics" && tier >= 3 ? <AdminAnalytics lang={lang} />
        : adminTab === "autoteach" && tier >= 2 ? <AdminAutoTeach lang={lang} />
        : adminTab === "broadcast" && tier >= 3 ? <AdminBroadcast lang={lang} />
        : adminTab === "event" && tier >= 3 ? <AdminEvent lang={lang} />
        : adminTab === "games" && tier >= 3 ? <AdminGames lang={lang} />
        : adminTab === "aimodel" && tier >= 3 ? <AdminAIModel lang={lang} />
        : adminTab === "ai" && tier >= 3 ? (<>

      <div className="mmsgs">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role === "user" ? "u" : "a"}`}>
            <div className={`bbl${m.role === "ai" ? " adminbbl" : ""}`}>
              {m.role === "ai" && <div className="atag adminatag">◈ ADMIN AI</div>}
              {m.img && <img src={m.img} alt="" className="adminimg" />}
              <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{m.text}</p>
            </div>
          </div>
        ))}
        {loading && <Typing />}
        <div ref={endRef} />
      </div>

      {msgs.length <= 1 && !attachedImg && (
        <div className="adminchips">
          {lc.adminChips.map((c, i) => (
            <button key={i} className="adminchip" onClick={() => { setInput(c); }}>
              {c}
            </button>
          ))}
        </div>
      )}

      {attachedImg && (
        <div className="adminpreview">
          <img src={attachedImg.dataUrl} alt="" />
          <span className="adminpreviewname">{attachedImg.name}</span>
          <button className="adminpreviewx" onClick={() => setAttachedImg(null)} aria-label="Remove image">✕</button>
        </div>
      )}

      <div className="admintools">
        <button className={`webtoggle${webSearch ? " on" : ""}`}
          onClick={() => setWebSearch(v => !v)}
          title={lc.webHint} aria-label={lc.webLabel} aria-pressed={webSearch}>
          <span className="webdot" />
          🌐 {lc.webLabel} {webSearch ? "ON" : "OFF"}
        </button>
      </div>

      <div className="miw adminmiw">
        <div className="ir">
          <button className="attachbtn" onClick={pickImage} title={lc.attachHint} aria-label={lc.attachHint}>+</button>
          <textarea className="tin" value={input} placeholder={lc.adminPh} rows={1}
            onChange={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 110) + "px"; setInput(e.target.value); }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAdmin(); } }} />
          <button className="snd" disabled={loading || (!input.trim() && !attachedImg)} onClick={sendAdmin} aria-label="Send">➤</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFileChosen} />
      </div>

      </>) : <AdminStudents lang={lang} viewerTier={tier} />}
    </div>
  );
}


/* ════ MAIN ════ */
export default function App() {
  useInjectCSS();
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    sb.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session || null);
      setAccessToken((data.session && data.session.access_token) || null);
      setAuthReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s || null);
      setAccessToken((s && s.access_token) || null); // kept fresh across silent token refreshes too
      setAuthReady(true);
    });
    // completes signInWith()'s native OAuth flow when the OS hands the app back
    // control via the custom URL scheme; no-op (returns a no-op cleanup) on web
    const stopAuthRedirect = listenForNativeAuthRedirect(sb, (err) => {
      if (err) alert("Sign-in error: " + (err.message || err));
    });
    return () => { mounted = false; if (sub && sub.subscription) sub.subscription.unsubscribe(); stopAuthRedirect(); };
  }, []);

  useEffect(() => { initNativeUpdater(APP_VER); }, []); // no-op on web

  const loadProfile = useCallback((uid) => {
    setProfileReady(false);
    sb.from("profiles").select("*").eq("id", uid).maybeSingle().then(async ({ data }) => {
      let finalData = data;
      // A guest who just logged in for the first time (or an existing member
      // who tried the app as a guest before logging back in) — fold whatever
      // they earned as a guest into the now-real row. Self-limiting: once
      // merged, clearGuestProfile() empties tg_guest_profile, so this is a
      // no-op on every subsequent loadProfile() call (focus re-checks, etc.)
      if (data && guestHasProgress(loadGuestProfile())) {
        finalData = await mergeGuestProgressIntoProfile(uid, data);
      }
      setProfile(finalData || null);
      setProfileReady(true);
      // Supabase is the authoritative subscription now — sync it to localStorage so
      // the freemium gates can't be unlocked by editing localStorage. Admins always
      // get full access; a paid plan counts only while plan_until is in the future.
      // (PianoApp reads this on mount and re-syncs from the profile prop.)
      if (finalData) {
        const active = effectivePlan(finalData);
        try { setPlanLS(active); } catch (e) {}
      }
    });
  }, []);

  useEffect(() => {
    if (session && session.user && session.user.id) loadProfile(session.user.id);
    // no session (fresh visitor, or just signed out) = guest mode, not a locked
    // door — same synthetic profile object PianoApp already knows how to read.
    else { setProfile(loadGuestProfile()); setProfileReady(true); }
  }, [session, loadProfile]);

  // banned/plan/admin_tier are otherwise only re-checked once per session (on the
  // initial loadProfile above) — a tab left open through a ban stays fully usable
  // until the next reload, and there's no realtime subscription on `profiles`. This
  // silently re-fetches (no setProfileReady(false), so no splash-screen flash) whenever
  // the tab regains focus, closing most of that gap without needing a full realtime
  // channel. Still not a substitute for server-side enforcement of `banned` on
  // sensitive RPCs — a still-valid JWT used outside this SPA is unaffected either way.
  useEffect(() => {
    const uid = session && session.user && session.user.id;
    if (!uid) return;
    const recheck = () => { if (document.visibilityState === "visible") sb.from("profiles").select("*").eq("id", uid).maybeSingle().then(({ data }) => { if (data) setProfile(data); }); };
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    return () => { document.removeEventListener("visibilitychange", recheck); window.removeEventListener("focus", recheck); };
  }, [session && session.user && session.user.id]);

  async function signOut() {
    try { await sb.auth.signOut(); } catch (e) {}
    setSession(null); setProfile(null);
  }

  if (!authReady) return <Splash />;
  if (!profileReady) return <Splash />;
  if (profile && profile.banned && !profile.is_admin) return <BannedScreen onSignOut={signOut} />;
  if (!profile || !profile.onboarded) {
    return <ProfileForm session={session} onSignOut={signOut} onSaved={() => loadProfile(session.user.id)} />;
  }
  return <PianoApp session={session} profile={profile} setProfile={setProfile} onSignOut={signOut} />;
}


function PianoApp({ session, profile, setProfile, onSignOut }) {
  const cssReady = useInjectCSS();
  const isGuest = !session; // no Supabase session at all — synthetic local profile, see loadGuestProfile()

  // one-time "why we ask for mic/camera" disclosure, native app only — the OS's
  // own permission dialog (with the Info.plist/AndroidManifest usage strings)
  // still does the real asking; this just explains it first, shown once ever.
  const [permPrimerOpen, setPermPrimerOpen] = useState(false);
  useEffect(() => {
    if (!isNative) return;
    try { if (!localStorage.getItem("tg_permprimed")) setPermPrimerOpen(true); } catch (e) {}
  }, []);
  function dismissPermPrimer() {
    setPermPrimerOpen(false);
    try { localStorage.setItem("tg_permprimed", "1"); } catch (e) {}
  }

  const [lang, setLang] = useState("en");   // English is the default language on entry
  const lc = L[lang];
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;

  const { litNote, setLitNote, litSet, setLitSet, fingerMap, setFingerMap, fingerChart, setFingerChart, chordStyle, setChordStyle, seqIsChord, setSeqIsChord, hand, setHand, pianoOct, setPianoOct, recording, setRecording, hasClip, setHasClip, playingClip, setPlayingClip, hasSeq, setHasSeq, seqPlaying, setSeqPlaying, seqTimers, lastSeq, recordingRef, recStartRef, recEventsRef, clipRef, clipTimersRef, clearSeq, playSequence, togglePlayPause, toggleChordStyle, replayLast, handleMainKey, stopClip, toggleRecord, playClip } = useKeyboard();
  const [flagOpen, setFlagOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // ── settings / tools ──
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sfxVol, setSfxVolState] = useState(getSfxVol());
  const [sfxMuted, setSfxMutedState] = useState(getSfxMuted());
  const [metroOn, setMetroOn] = useState(false);
  const [metroBpm, setMetroBpm] = useState(90);
  const [ambientOn, setAmbientOn] = useState(false);
  // coins · daily chest · mascot companion
  const { coins, setCoins, gems, setGems, chestAvail, setChestAvail, chestOpen, setChestOpen, chestOpening, setChestOpening, chestReward, setChestReward, chestSpinDeg, setChestSpinDeg, mascotMood, setMascotMood, mascotT, expToast, setExpToast, levelUp, setLevelUp, badgeUp, setBadgeUp, mysteryChest, setMysteryChest, luckyToast, setLuckyToast, luckyToastTimer, expRef, lessonsRef, streakRef, questDateRef, questCountRef, expToastTimer, lvUpTimer, badgeTimer, planRef, activeEventRef, celebrateNewBadges, showExpToast, gainExp, earnCoins, exchangeGems, buyFreeze, bumpWeekly, mascot, openChestNow } = useGamification({ session, profile, setProfile });
  const [shopOpen, setShopOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const { premium, setPremium, plan, setPlan, pricingOpen, setPricingOpen, checkout, setCheckout, schoolCheckout, setSchoolCheckout, billCycle, setBillCycle, payCfg, stripeReturn, schoolPayReturn, choosePlan, startCheckout, activatePremium } = usePayment({ profile, session, setProfile, lang, mascot, requireLogin });
  // useGamification() is called before usePayment() (mascot must exist in time
  // to pass into usePayment's params) — so earnCoins/gainExp read plan via this
  // ref, kept fresh here now that `plan` exists. See use-gamification.ts header.
  useEffect(() => { planRef.current = plan; }, [plan]);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handler = (e) => { if (e.data && e.data.type === "SW_RELOAD") window.location.reload(); };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);
  useEffect(() => { if (isMaxPlan(plan)) grantMonthlyFreezes(); }, [plan]);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiModalType, setAiModalType] = useState<"report"|"plan">("report");
  const [aiModalText, setAiModalText] = useState("");
  const [aiModalLoading, setAiModalLoading] = useState(false);
  // E1: Register service worker; auto-reload when a new version activates
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onMsg = (e) => { if (e.data && e.data.type === "SW_UPDATED") window.location.reload(); };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);
  // C1: Friend Challenge — parse ?challenge=songId:score:name from URL
  const { songOpen, setSongOpen, songMeta, setSongMeta, songPhase, setSongPhase, songTempo, setSongTempo, songHud, setSongHud, songResult, setSongResult, songAnalysis, setSongAnalysis, songAnalysisBusy, setSongAnalysisBusy, stylePickOpen, setStylePickOpen, styleLoading, setStyleLoading, challengeData, setChallengeData, backingOn, setBackingOn, backingTimerRef, detectOpen, setDetectOpen, detectNotes, setDetectNotes, detectMatch, setDetectMatch, detectListening, setDetectListening, detectStopRef, battleData, setBattleData, battlePickOpen, setBattlePickOpen, songJudge, setSongJudge, songNextLit, setSongNextLit, songStaffNotes, setSongStaffNotes, songBest, setSongBest, songBursts, setSongBursts, songShake, setSongShake, songGo, setSongGo, songJudgeTimerRef, songShakeT, songGoT, songPerfectsRef, songDebounceRef, songEchoRef, songGhost, setSongGhost, songSamplesRef, songGhostDataRef, songBonus, setSongBonus, songBonusT, songFever, setSongFever, songFeverRef, songPops, setSongPops, songAnnounce, setSongAnnounce, songAnnounceT, songSrc, setSongSrc, songCountdown, setSongCountdown, songAutoLoop, setSongAutoLoop, songAutoLoopRef, songLoopRetryT, songCanvasRef, songDataRef, songNotesRef, songLanesRef, songTotalRef, songLastTimeRef, songStartClockRef, songTempoRef, songRunRef, songRafRef, songHudTimerRef, songScoreRef, songComboRef, songMaxComboRef, songHitsRef, songMissRef, songTimingRef, songVelsRef, songLaneFlashRef, songStarsRef, songRocketsRef, songBlastsRef, songNebulaRef, songCountdownRef, songFinishedRef, songPreviewRef, songLoopRef, songInputRef, songFinishRef, chooseSong, previewSong, startSongPlay, exitSong, styleTransform } = usePlayAlong({ lang, isGuest, requireLogin, earnCoins, gainExp, bumpWeekly, setMysteryChest, setLuckyToast, luckyToastTimer });

  // ── Auto Teaching (Max-only real-time coaching popup, fires on a timer while on the Pathway page) ──
  const [autoTeachDefaultMin, setAutoTeachDefaultMin] = useState(null); // admin platform default, from app_settings
  useEffect(() => {
    if (!session) return;
    sb.from("app_settings").select("value").eq("key", "auto_teach").maybeSingle()
      .then(({ data }) => setAutoTeachDefaultMin((data && data.value && data.value.default_min) ?? AUTO_TEACH_FALLBACK_MIN), () => {});
  }, [session]);
  const [autoTeachTip, setAutoTeachTip] = useState(null);   // {weakness, tip} currently shown, or null
  const autoTeachBusyRef = useRef(false);
  const autoTeachTimer = useRef(null);
  // ── Admin broadcast: an announcement (text + optional image) an admin can push to
  // every learner's home page on demand — checked on load and polled while the app is
  // open, so it appears without needing a reload; shown once per broadcast id per device. ──
  const [broadcast, setBroadcast] = useState(null); // {id, message, image_url, active} currently shown, or null
  useEffect(() => {
    if (!session) return;
    let alive = true;
    const check = () => {
      sb.from("app_settings").select("value").eq("key", "broadcast").maybeSingle()
        .then(({ data }) => {
          if (!alive) return;
          const v = data && data.value;
          if (v && v.active && String(v.id) !== readBroadcastSeen()) setBroadcast(v);
        }, () => {});
    };
    check();
    const t = setInterval(check, 45000);
    return () => { alive = false; clearInterval(t); };
  }, [session]);
  function dismissBroadcast() {
    if (broadcast) markBroadcastSeen(broadcast.id);
    setBroadcast(null);
  }
  // ── Seasonal / limited-time event: same app_settings + admin_set_app_setting
  // mechanism as broadcast above (key "event" instead of "broadcast"), polled the
  // same way. Applies EXP/coin multipliers while live (see gainExp/earnCoins). ──
  const [activeEvent, setActiveEvent] = useState(null);
  useEffect(() => {
    if (!session) return;
    let alive = true;
    const check = () => {
      sb.from("app_settings").select("value").eq("key", "event").maybeSingle()
        .then(({ data }) => {
          if (!alive) return;
          const v = data && data.value;
          setActiveEvent(v && v.active && (!v.ends_at || new Date(v.ends_at).getTime() > Date.now()) ? v : null);
        }, () => {});
    };
    check();
    const t = setInterval(check, 45000);
    return () => { alive = false; clearInterval(t); };
  }, [session]);
  // mirrored into activeEventRef for the same reason as planRef above
  useEffect(() => { activeEventRef.current = activeEvent; }, [activeEvent]);
  const [upsell, setUpsell] = useState(null);   // {feat} when a gated action is blocked
  const [parentOpen, setParentOpen] = useState(false);
  const [examOpen, setExamOpen] = useState(false);
  const [examProgress, setExamProgress] = useState(() => { try { return JSON.parse(localStorage.getItem("tg_exam") || "{}"); } catch (e) { return {}; } });
  const [homework, setHomework] = useState(readHomework());
  // School Plan Pro: a real, DB-backed, cross-device assignment from a linked
  // teacher — takes priority over the local AI-assigned homework below when present.
  const [schoolHW, setSchoolHW] = useState(null);
  useEffect(() => {
    if (!(profile && profile.school_role === "student")) { setSchoolHW(null); return; }
    sb.from("school_assignments").select("*").order("assigned_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setSchoolHW(data || null));
  }, [profile && profile.school_id, profile && profile.school_role]);
  const [mySchoolName, setMySchoolName] = useState("");
  useEffect(() => {
    if (!(profile && profile.school_id)) { setMySchoolName(""); return; }
    sb.from("schools").select("name").eq("id", profile.school_id).maybeSingle().then(({ data }) => setMySchoolName((data && data.name) || ""));
  }, [profile && profile.school_id]);
  function leaveSchool() {
    if (!(profile && profile.school_id)) return;
    if (!window.confirm(L[lang].schoolRemoveConfirm)) return;
    sb.rpc("school_leave", { p_school_id: profile.school_id }).then(() => {
      sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle().then(({ data }) => { if (data) setProfile(data); });
    });
  }
  const [welcomeOpen, setWelcomeOpen] = useState(() => { try { return !localStorage.getItem("tg_welcomed"); } catch (e) { return false; } });
  const [owned, setOwned] = useState(getOwned());
  const [skin, setSkin] = useState(getEquip("skin", "aqua"));
  const [theme, setTheme] = useState(getEquip("theme", "midnight"));
  const [frame, setFrame] = useState(getEquip("frame", "fr-none"));
  const [mode, setMode] = useState(getEquip("mode", "light"));   // "dark" | "light" — whole-app color scheme; light is the preset for first-time visitors, a saved preference always wins




  // ── studio sub-nav + sight-reading + hand coach ──
  const [studioView, setStudioView] = useState("menu");    // menu | songs
  const [earGymInitialTab, setEarGymInitialTab] = useState("int"); // which Ear Gym tab to land on — set before navigating there for skill remediation

  const [setAdvancedOpen, setSetAdvancedOpen] = useState(false); // progressive disclosure for Metronome BPM/tap-tempo
  const { sightOpen, setSightOpen, sightTarget, setSightTarget, sightClef, setSightClef, sightNoteClef, setSightNoteClef, sightIdx, setSightIdx, sightScore, setSightScore, sightFeedback, setSightFeedback, sightHint, setSightHint, sightDone, setSightDone, sightSrc, setSightSrc, sightTargetRef, sightClefRef, sightNoteClefRef, sightActiveRef, sightHandlerRef, sightScoreRef, sightMissRef, sightIdxRef, sightFbTimer, newSightNote, pickSightClef, openSight, sightInput, finishSight, exitSight } = useSightReading({ SIGHT_ROUND, lang, earnCoins, gainExp });
  const { camOpen, setCamOpen, camStatus, setCamStatus, camMsg, setCamMsg, camCoach, setCamCoach, camTry, setCamTry, camVideoRef, camCanvasRef, camStreamRef, camRafRef, camRunRef, camMsgRef, handRoundFramesRef, openCamera, exitCamera, analyzeHands, retryCamera } = useCameraCoach({ lang, premium, setPricingOpen });


  // ── routing + secret admin unlock ──
  // Pathway is the app's one and only starting screen — free navigation via the
  // drawer. Navigation stays drawer-only — a bottom tab bar was tried and
  // removed after it read as more confusing, not less.
  const [page, setPage] = useState("pathway");
  useEffect(() => { logUsage("page", page); }, [page]); // usage analytics: which page ends up viewed, however it was reached
  useEffect(() => { if (page !== "sensei") clearSeq(); }, [page]); // stop any Sensei demo audio the instant the learner navigates away

  // null | "time" | "ai" — which GuestGateScreen (if any) currently covers the
  // screen. Two distinct producers, one shared consumer (see render below).
  const [guestGateReason, setGuestGateReason] = useState(null);
  const [guestMsLeft, setGuestMsLeft] = useState(GUEST_TRIAL_MS); // soft, non-blocking countdown — see corner pill
  // Returns true (and raises the gate) if this guest needs to log in before
  // continuing — call at the top of anything that needs a real account, and
  // bail out if it returns true. reason picks GuestGateScreen's copy:
  // "ai" for AI-backed features, "account" for everything else account-bound.
  function requireLogin(reason = "account") { if (isGuest) { setGuestGateReason(reason); return true; } return false; }
  // Ticks tg_guest_ms forward by real elapsed time, mirroring syncProgress's own
  // interval/visibility wiring (~10226 below) rather than inventing a new style.
  useEffect(() => {
    if (!isGuest) return;
    let last = Date.now();
    const flush = () => { const now = Date.now(); addGuestMs(now - last); last = now; setGuestMsLeft(Math.max(0, GUEST_TRIAL_MS - getGuestMs())); };
    flush();
    const iv = setInterval(flush, 10000);
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    const onPageHide = () => flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => { flush(); clearInterval(iv); document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", onPageHide); };
  }, [isGuest]);
  // Only actually raise the gate on a fresh top-level navigation, never mid-exercise
  // (exercises/overlays are their own state, layered on top of `page` — `page`
  // itself only changes once the guest has returned to a list/menu).
  useEffect(() => {
    if (isGuest && getGuestMs() >= GUEST_TRIAL_MS) setGuestGateReason("time");
  }, [isGuest, page]);

  // School Plan Pro: the teacher dashboard has no nav entry anywhere — it's reached
  // only via a hidden link TIGA hands directly to onboarded teachers. The link is
  // just a discoverability veil, not the real lock: every RPC/RLS check the dashboard
  // makes still re-verifies real school_members membership server-side regardless of
  // how this page was reached, so this client-side hash check is safe to keep simple.
  useEffect(() => {
    if (window.location.hash === "#teacher-portal" && profile && profile.school_role === "teacher") {
      setPage("school");
    }
  }, [profile]);

  // ── Auto Teaching: while a Max-plan learner is on the Home page, fire a short
  // real-time coaching card every N minutes (learner's own pick, else the admin's platform default). ──
  const autoTeachTipRef = useRef(null);
  useEffect(() => { autoTeachTipRef.current = autoTeachTip; }, [autoTeachTip]);
  // Read fresh inside the timer callback instead of gating the effect below on `page` —
  // `page` changes on every navigation, and putting it in that effect's deps was clearing
  // + restarting the countdown from zero every time the learner left the Pathway page, so
  // in practice it needed 15+ *uninterrupted* minutes there to ever fire even once.
  const pageRef = useRef(page);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { songAutoLoopRef.current = songAutoLoop; }, [songAutoLoop]);
  async function fetchAutoTeachTip() {
    if (pageRef.current !== "pathway") return; // only surface the card while actually on Pathway
    if (autoTeachTipRef.current || autoTeachBusyRef.current) return; // don't clobber an unread tip
    autoTeachBusyRef.current = true;
    try {
      const obj = await generateCoachTip(lang, profile);
      if (obj) {
        setAutoTeachTip(obj);
        logAutoTeachTip(obj.weakness, obj.steps.join(" / "), obj.feature);
      }
    } catch (e) { /* a missed real-time tip silently skips — not worth an error popup mid-practice */ }
    autoTeachBusyRef.current = false;
  }
  // resolves to a primitive (not the whole profile object), so unrelated profile writes
  // (EXP gain, streak bump, etc. all replace the profile object on every practice round)
  // don't restart this effect and keep resetting the countdown before it ever fires
  const autoTeachMin = resolveAutoTeachMin(profile, autoTeachDefaultMin);
  useEffect(() => {
    clearInterval(autoTeachTimer.current);
    if (!premium || !(autoTeachMin > 0)) return;
    autoTeachTimer.current = setInterval(fetchAutoTeachTip, autoTeachMin * 60 * 1000);
    return () => clearInterval(autoTeachTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, autoTeachMin, lang]);

  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showLock, setShowLock] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef(null);

  // secret: tap the TG logo 5 times quickly to reveal the lock screen
  function handleLogoTap() {
    // Any admin tier can reveal the lock screen — everyone else tapping the logo does
    // nothing. This plus the code is the ONLY way into /admin; no nav-bar entry point,
    // so a regular learner never even sees that an admin console exists.
    if (!(profile && profile.admin_tier > 0)) return;
    tapCount.current += 1;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 1500);
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      setShowLock(true);
      setPage("admin");
    }
  }

  // secret code — change this to your own
  const ADMIN_CODE = "tiga2026";
  function tryUnlock(code) {
    if (code === ADMIN_CODE) {
      setAdminUnlocked(true);
      setShowLock(false);
      return true;
    }
    return false;
  }
  function exitAdmin() {
    setAdminUnlocked(false);
    setShowLock(false);
    setActiveStageId(null);
    setActiveStageType(null);
    setPage("sensei");
  }

  const { msgs, setMsgs, input, setInput, loading, setLoading, modal, setModal, activeSpk, setActiveSpk, endRef, mendRef, topicHint, lessonKey, send, callClaude, pushMessage, setLessonContext } = useChat({ lang, hand, playSequence, seqTimers, gainExp, requireLogin });
  // Which Pathway topic is currently being studied on the Sensei page, so a
  // "back" button can jump straight to that topic's key picker re-opened —
  // instead of the ☰ menu → Pathway → find-the-card-again round trip.
  const [activeStageId, setActiveStageId] = useState(null);
  const [activeStageType, setActiveStageType] = useState(null); // chosen chord/interval type, if any — lets "Change Key" reopen straight at the key picker

  const uid = session && session.user && session.user.id;

  // Periodically snapshot the learner's progress to Supabase so a teacher/admin
  // can review each student's learning from the back office (also on app hide).
  useEffect(() => {
    if (!uid) return;
    const t = setTimeout(() => { syncProgress(uid); maybeSnapshotSkills(uid); }, 4000);
    const iv = setInterval(() => syncProgress(uid), 90000);
    const onHide = () => { if (document.visibilityState === "hidden") syncProgress(uid); };
    const onPageHide = () => syncProgress(uid);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => { clearTimeout(t); clearInterval(iv); document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", onPageHide); };
  }, [uid]);


  const { practiceOpen, setPracticeOpen, practiceTarget, setPracticeTarget, practiceFingers, setPracticeFingers, practiceLabel, setPracticeLabel, practiceIdx, setPracticeIdx, practiceHitIdxs, setPracticeHitIdxs, practiceMiss, setPracticeMiss, practiceHeard, setPracticeHeard, practiceSrc, setPracticeSrc, practiceTune, setPracticeTune, practiceActiveRef, practiceTargetRef, practiceKeyRef, practiceModeRef, practiceAscRef, practiceIdxRef, practiceHitSetRef, practiceHitsRef, practiceMissRef, practiceVelsRef, practiceLabelRef, practiceHandlerRef, practiceHeardTimer, tuneOffsetRef, notePitchMatches, handlePlayedNote, startPractice, restartPractice, switchPracticeChordStyle, exitPractice, finishPractice } = usePracticeMode({ hand, chordStyle, setChordStyle, lastSeq, clearSeq, earnCoins, gainExp, setPage, setMsgs, topicHint, lessonKey, isGuest, callClaude, lang });


  const { vmOpen, setVmOpen, vmState, vmCaption, setVmCaption, vmMsgs, setVmMsgs, vmNotes, setVmNotes, vmErr, setVmErr, vmActiveRef, vmStateRef, vmRecRef, vmMsgsRef, vmNotesRef, vmFrozenRef, vmPlayReactT, vmSilenceT, vmRestartT, vmWatchdogT, vmListenSeqRef, vmEndRef, vmLastActivityRef, vmIdleNudgedRef, vmIdleTimerRef, vmSelfSpeakingRef, vmEarResetRef, vmEarFlushRef, vmDeafCountRef, vmTallyOkRef, vmTallyMissRef, vmFast, setVmFast, vmFastRef, vmSpeed, setVmSpeed, vmSpeedRef, vmVoice, setVmVoice, vmPoly, setVmPoly, vmPolyRef, vmLangOpen, setVmLangOpen, vmMenuOpen, setVmMenuOpen, langRef, vmLastDemoRef, vmStreakRef, vmMissRef, vmFillersRef, vmFillerSrcRef, vmCloudDeadRef, vmLit, setVmLit, vmLitT, vmStaff, setVmStaff, vmInstant, setVmInstant, vmInstantT, vmExpectRef, vmSeqRef, vmEarRef, vmInterruptRef, vmTurnRef, vmSpokenRef, vmSpokeAtRef, vmSessionStartRef, vmActStartRef, vmFillerLastRef, vmInput, setVmInput, openVoice, exitVoice, vmOrbTap, vmOnNote, vmTogglePoly, vmProcess, vmToggle } = useVoiceTutor({ lang, session, profile, homework, setHomework, setPage, setStudioView, setMetroOn, setMetroBpm, metroTimingReport, openCamera, chooseSong, startPractice, lastSeq });


  // close flag menu on outside click
  useEffect(() => {
    if (!flagOpen) return;
    const close = () => setFlagOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [flagOpen]);



  // on unmount: cancel any pending playback timers and stop TTS so we never
  // call setState after the component is gone (avoids leaks + React warnings)
  useEffect(() => {
    return () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (practiceHeardTimer.current) clearTimeout(practiceHeardTimer.current);
      cancelAnimationFrame(songRafRef.current);
      clearInterval(songHudTimerRef.current);
      songPreviewRef.current.forEach(id => clearTimeout(id));
      clearTimeout(sightFbTimer.current);
      stopPracticeListeners();
      if (vmRecRef.current) { try { vmRecRef.current.abort(); } catch (e) {} }
      stopCloudTTS(); stopSpeaking();
      stopPracticeListeners();
      stopCloudTTS();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);







  // send the recorded performance to the AI teacher for a critique
  function critiqueRecording() {
    const clip = clipRef.current;
    if (!clip.length || recordingRef.current || loading) return;
    if (!canUse("critique", premium)) { setPricingOpen(true); return; }
    if (requireLogin("ai")) return; // don't burn the daily quota on a call that can't complete
    if (!premium) bumpUsage("critique");
    stopClip();
    setPage("sensei");
    const secs = ((clip[clip.length - 1].t) / 1000).toFixed(1);
    const noteList = clip.map(e => e.note).join(" ");
    const q = `${lc.recCritiqueUser}\n\n(${clip.length} ${lc.songNotes} · ${secs}s: ${noteList})`;
    setLessonContext(LESSON_MODE);
    pushMessage({ role: "user", text: q });
    playPianoNote("C5", 0.1);
    callClaude(q);
  }




  // Where the Coach page's "▶ Practice: …" button sends the learner — maps a fixed,
  // known-safe COACH_FEATURE_LABELS key to a real navigation action.
  function handleCoachNavigate(key, tab) {
    playUi("click"); haptic(6); stopPracticeListeners();
    if (key === "sight_reading") { setPage("studio"); setStudioView("menu"); openSight(); }
    else if (key === "hand_coach") { setPage("studio"); setStudioView("menu"); openCamera(); }
    else if (key === "play_along") { setPage("studio"); setStudioView("songs"); }
    else if (key === "ear_training") { logUsage("nav", "studio-eargym"); setEarGymInitialTab(tab || "int"); setPage("eargym"); }
    else if (key === "reading_course") { logUsage("nav", "studio-reading"); setPage("reading"); }
    else { setPage("pathway"); }
  }
  // Translates a buildRecommendation()/buildSongResultRecommendation() result into an
  // actual navigation — used by the Play-Along result screen's "what's next" nudge.
  function goToRecommendation(r) {
    playUi("click");
    if (r.type === "fundamentals") handleCoachNavigate(r.feature);
    else if (r.type === "remediate") handleCoachNavigate(r.feature, r.skill === "chord_knowledge" ? "chord" : undefined);
    else if (r.type === "next_stage") {
      // Go straight into the topic itself (same as tapping it on the Pathway page
      // or TodayPage's own "new" step) — landing on the Pathway list first and
      // making the learner find and tap it again was a confusing extra step.
      // Also open the expanded chat modal directly: reading a lesson explanation
      // is much more comfortable full-screen than the compact in-page chat strip,
      // and this is specifically the AI Mentor's own "go" action, not a manual
      // Pathway browse — the expand-arrow shouldn't be a second tap the learner
      // has to know to look for.
      const stage = r.stage;
      if (stage.content) { readChapter(stage); }
      else {
        const keyMap = keyDoneMap();
        const key = KEYS_12.find(k => !(keyMap[stage.id] || []).includes(k.id.toLowerCase())) || KEYS_12[0];
        learnTopic(stage, key, stage.types ? stage.types[0] : null);
      }
      setModal(true);
    }
    else if (r.type === "new_song" || r.type === "replay_song") {
      // Same "go straight into it" philosophy as next_stage — jump directly into
      // the specific recommended song instead of dropping the learner on the
      // ~180-song list to go find it themselves.
      setPage("studio"); setStudioView("songs");
      chooseSong(r.song);
    }
    else { setPage("studio"); setStudioView("songs"); }
  }


  // ── metronome engine ──
  const metroBeatRef = useRef(0);
  const metroBeatTimesRef = useRef([]);   // recent metronome beat timestamps → grade timing vs the click
  useEffect(() => {
    if (!metroOn) { metroBeatTimesRef.current = []; return; }
    getAC();
    metroBeatRef.current = 0;
    const tick = () => {
      playClick(metroBeatRef.current % 4 === 0); metroBeatRef.current++;
      const a = metroBeatTimesRef.current; a.push(Date.now()); if (a.length > 64) a.shift();
    };
    tick();
    const id = setInterval(tick, 60000 / metroBpm);
    return () => clearInterval(id);
  }, [metroOn, metroBpm]);
  // grade the learner's note onsets against the actual metronome clicks (ms-precise)
  function metroTimingReport(noteTimes) {
    const beats = metroBeatTimesRef.current;
    if (!metroOn || beats.length < 2 || !noteTimes || noteTimes.length < 2) return null;
    const offs = [];
    for (const t of noteTimes) {
      let best = 1e9; for (const b of beats) { const d = t - b; if (Math.abs(d) < Math.abs(best)) best = d; }
      if (Math.abs(best) < 60000 / metroBpm) offs.push(best);   // ignore notes with no nearby beat
    }
    if (offs.length < 2) return null;
    const avg = Math.round(offs.reduce((s, x) => s + x, 0) / offs.length);
    const offBeat = offs.filter(o => Math.abs(o) > 70).length;
    const dir = avg > 25 ? "behind/dragging" : avg < -25 ? "ahead/rushing" : "right on the beat";
    return `vs metronome: avg ${avg >= 0 ? "+" : ""}${avg}ms (${dir}); ${offBeat}/${offs.length} notes off by >70ms`;
  }
  useEffect(() => { if (ambientOn) startAmbient(); else stopAmbient(); return () => stopAmbient(); }, [ambientOn]);
  // capture the install prompt → lets us offer "Add to home screen" (external trigger)
  const [installEvt, setInstallEvt] = useState(null);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setInstallEvt(e); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  async function doInstall() {
    if (!installEvt) return;
    installEvt.prompt();
    try { await installEvt.userChoice; } catch (e) {}
    setInstallEvt(null);
  }
  // A one-time "add to home screen" nudge shown right after the learner's first
  // real win, instead of only sitting buried in Settings where nobody finds it.
  // A home-screen icon is one of the biggest levers for people actually opening
  // the app again — so the ask needs to land the moment they're happiest, not later.
  const [installBannerSeen, setInstallBannerSeen] = useState(() => { try { return localStorage.getItem("tg_install_banner_seen") === "1"; } catch (e) { return false; } });
  const showInstallBanner = !!installEvt && !installBannerSeen && getCoins() > 0;
  function dismissInstallBanner() {
    setInstallBannerSeen(true);
    try { localStorage.setItem("tg_install_banner_seen", "1"); } catch (e) {}
  }
  async function installFromBanner() { dismissInstallBanner(); await doInstall(); }
  // Direct-download Android app (no Play Store listing for now — see version.json).
  // Takes priority over the generic PWA install banner above: the real native app
  // unlocks the AI Voice Tutor, which the PWA install can never do.
  const [apkInfo, setApkInfo] = useState(null);
  useEffect(() => {
    if (isNative || !/Android/i.test(navigator.userAgent || "")) return;
    fetch("./version.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(j => setApkInfo(j), () => {});
  }, []);
  const [apkBannerSeen, setApkBannerSeen] = useState(() => { try { return localStorage.getItem("tg_apk_banner_seen") === "1"; } catch (e) { return false; } });
  const showApkBanner = !isNative && apkInfo && apkInfo.apkReady && !apkBannerSeen;
  function dismissApkBanner() {
    setApkBannerSeen(true);
    try { localStorage.setItem("tg_apk_banner_seen", "1"); } catch (e) {}
  }
  // Re-engagement push: toggle in Settings, plus a one-time prompt the first
  // time a real streak is actually at risk — the exact moment a reminder
  // would matter, tied to the same streakAtRisk() the in-app UI already uses.
  const [pushOn, setPushOn] = useState(() => typeof Notification !== "undefined" && Notification.permission === "granted");
  async function togglePush() {
    if (requireLogin()) return;
    if (pushOn) { await unsubscribePush(); setPushOn(false); }
    else { const ok = await subscribePush(session.user.id); setPushOn(ok); }
  }
  function saveAutoTeachInterval(min) {
    if (requireLogin()) return;
    setProfile(p => (p ? { ...p, auto_teach_interval_min: min } : p));
    sb.from("profiles").update({ auto_teach_interval_min: min }).eq("id", session.user.id).then(() => {}, () => {});
  }
  const [pushBannerSeen, setPushBannerSeen] = useState(() => { try { return localStorage.getItem("tg_push_banner_seen") === "1"; } catch (e) { return false; } });
  const showPushBanner = pushSupported() && !pushOn && !pushBannerSeen && streakAtRisk() && (profile && profile.streak > 0);
  function dismissPushBanner() {
    setPushBannerSeen(true);
    try { localStorage.setItem("tg_push_banner_seen", "1"); } catch (e) {}
  }
  async function enablePushFromBanner() { dismissPushBanner(); await togglePush(); }
  const tapTimesRef = useRef([]);
  function tapTempo() {
    const now = Date.now();
    const arr = tapTimesRef.current.filter(t => now - t < 2000);
    arr.push(now); tapTimesRef.current = arr;
    if (arr.length >= 2) {
      let sum = 0; for (let i = 1; i < arr.length; i++) sum += arr[i] - arr[i - 1];
      const bpm = Math.round(60000 / (sum / (arr.length - 1)));
      if (bpm >= 40 && bpm <= 240) setMetroBpm(bpm);
    }
  }
  function reviewTopic(t) {
    if (requireLogin("ai")) return; // always a live-AI ask, no local fallback
    setActiveStageId(null); // free-text question, not a Pathway topic+key — no "change key" back button
    setActiveStageType(null);
    setPage("sensei");
    setLessonContext(null);
    const q = lc.recAsk.replace("{x}", t);
    pushMessage({ role: "user", text: q });
    playPianoNote("C5", 0.1);
    callClaude(q);
  }
  function reviewSchools() {
    setActiveStageId(null);
    setActiveStageType(null);
    setPage("sensei");
    pushMessage({ role: "ai", text: lc.schoolInfo });
  }
  function recommendNext() {
    const action = nextRecommendedAction();
    if (action.type === "fundamentals") {
      const FUNDAMENTALS_ICONS = { hand_coach: "🖐️", play_along: "🎵", ear_training: "👂" };
      const FUNDAMENTALS_LABELS = { hand_coach: lc.studioCamera, play_along: lc.studioPlayAlong, ear_training: lc.navEar };
      return {
        icon: FUNDAMENTALS_ICONS[action.feature] || "🖐️",
        label: lc.recFundamentals.replace("{x}", FUNDAMENTALS_LABELS[action.feature] || ""),
        fn: () => handleCoachNavigate(action.feature),
      };
    }
    if (action.type === "remediate") {
      return {
        icon: "🎯", label: lc.recWeakSkill.replace("{x}", tr(SKILL_LABELS[action.skill], lang)),
        fn: () => handleCoachNavigate(action.feature, action.skill === "chord_knowledge" ? "chord" : undefined),
      };
    }
    if (action.type === "next_stage") {
      return { icon: "📘", label: lc.recNext + " " + tr(action.stage.title, lang), fn: () => { playUi("click"); setPage("pathway"); } };
    }
    if (action.type === "new_song" || action.type === "replay_song") {
      return {
        icon: action.type === "replay_song" ? "🔁" : "🎵",
        label: (action.type === "replay_song" ? lc.recReplaySong : lc.recNewSong) + " " + tr(action.song, lang),
        fn: () => { playUi("click"); setPage("studio"); setStudioView("songs"); chooseSong(action.song); },
      };
    }
    return { icon: "🎮", label: lc.recWarm, fn: () => { playUi("click"); setPage("studio"); setStudioView("songs"); } };
  }
  function toggleExamTask(gid, i) {
    setExamProgress(prev => {
      const cur = prev[gid] || [];
      const next = cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i];
      const all = { ...prev, [gid]: next };
      try { localStorage.setItem("tg_exam", JSON.stringify(all)); } catch (e) {}
      if (!cur.includes(i)) { playUi("reward"); earnCoins(5); }
      return all;
    });
  }
  useEffect(() => {
    document.body.dataset.skin = skin; document.body.dataset.theme = theme; document.body.dataset.frame = frame;
    document.documentElement.dataset.theme = mode;
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute("content", mode === "dark" ? "#0d0d0c" : "#faf9f5");
  }, [skin, theme, frame, mode]);
  const EQUIP_SETTERS = { skin: setSkin, theme: setTheme, frame: setFrame };
  function buyOrEquip(kind, item) {
    const setEquip = EQUIP_SETTERS[kind];
    if (owned.includes(item.id)) {
      setEquip(item.id); setEquipLS(kind, item.id);
      playUi("click"); haptic(6);
      return;
    }
    if (coins < item.cost) { mascot("sad", 1200); return; }
    const v = getCoins() - item.cost; setCoinsLS(v); setCoins(v); if (uid) sb.from("profiles").update({ coins: v }).eq("id", uid).then(() => {}, () => {});
    const no = [...owned, item.id]; setOwned(no); setOwnedLS(no);
    setEquip(item.id); setEquipLS(kind, item.id);
    playUi("reward"); mascot("celebrate", 1800);
  }
  const RARITY_LABEL = { common: lc.shopRareC, rare: lc.shopRareR, epic: lc.shopRareE, legendary: lc.shopRareL };
  function renderShopItem(kind, it, equippedId) {
    const own = owned.includes(it.id), eq = equippedId === it.id;
    return (
      <button key={it.id} className={`shopitem ${it.rarity}${eq ? " equipped" : ""}`} onClick={() => buyOrEquip(kind, it)}>
        {it.isNew && !own && <span className="shopitem-new">{lc.shopNew}</span>}
        <span className="shopitem-swwrap">
          <span className="shopitem-sw" style={{ background: `linear-gradient(135deg,${it.sw.join(",")})` }} />
          <span className="shopitem-ic">{it.icon}</span>
        </span>
        <span className="shopitem-nm">{tr(it, lang)}</span>
        <span className="shopitem-rare">{RARITY_LABEL[it.rarity]}</span>
        <span className="shopitem-tag">{eq ? "✓ " + lc.shopEquipped : own ? lc.shopEquip : "🪙 " + it.cost}</span>
      </button>
    );
  }


  // ── learn a topic+key from the pathway menu: send to AI + go to sensei page ──
  function learnTopic(stage, key, chordType = null) {
    if (stage && stage.id) { markPathDone(stage.id); if (key && key.id) markKeyDone(stage.id, key.id); setActiveStageId(stage.id); setActiveStageType(chordType); }
    const basePrompt = stage.learn[lang] || stage.learn.en;
    const keyId = key ? key.id : "C";
    const keyLabel = key ? key.name : "C";
    logActivity("lesson", stage.id + "/" + keyId.toLowerCase(), 0, 0, 180); // ~3 min of study per topic-in-key
    recordSRS(stage.id + "/" + keyId.toLowerCase());

    // Use chord-type's demo notes if a type was selected, otherwise stage defaults
    const demoSrc = chordType || stage;
    const semis = semisFromC(keyId);
    const demoNotes = transposeNotes(demoSrc.demo || stage.demo, semis);
    let demoFingers = demoSrc.demoFingers || stage.demoFingers || null;
    let chartKey = null;   // canonical key so the chart can recompute fingering on a hand switch
    if (stage.demoMode === "scale") {
      // Per-key scale fingering is irregular — reusing C's is wrong for F/B/flat keys.
      // Look up the verified fingering for the ACTUAL key; show nothing if unknown
      // (an honest blank beats teaching a wrong fingering). Use the picker's own
      // spelling (keyId) directly — routing it through CHROMA (sharps-only) would
      // silently respell Db/Ab/Eb/Bb as C#/G#/D#/A# and miss the lookup entirely.
      const scaleKey = keyId.toLowerCase() + " major scale";
      const map = hand === "left" ? FINGERINGS_LH : FINGERINGS_RH;
      const fk = map[scaleKey];
      demoFingers = fk ? fk.slice(0, demoNotes.length) : null;
      // Keep the key ONLY when we have verified data — then switching L/R hand
      // recomputes the correct fingering instead of keeping the other hand's.
      chartKey = fk ? scaleKey : null;
    } else if (demoFingers && hand === "left") {
      demoFingers = demoFingers.slice().reverse();   // triads/intervals mirror for the left hand
    }
    setLessonContext(LESSON_MODE);

    const sTitle = tr(stage.title, lang);
    const typeName = chordType ? tr(chordType.label, lang) : null;
    const fullTitle = typeName ? `${typeName} ${sTitle}` : sTitle;

    const demoParsed = {
      notes: demoNotes,
      mode: stage.demoMode,
      fingers: demoFingers,
      label: `${fullTitle} · ${keyLabel}`,
      key: chartKey,
      stageId: stage.id,
    };

    // strict instruction scoped to the specific chord type (if any)
    let strict;
    if (chordType) {
      const sym = chordType.symbol;
      if (lang === "th") {
        strict = `สอนเฉพาะ "${typeName}" ใน "${sTitle}" คีย์ ${keyId} (${keyLabel}) เท่านั้น อธิบายสูตร โน้ตทุกตัว และความรู้สึกของเสียง ระบุชื่อโน้ตทุกตัวในคีย์ ${keyId} (${keyLabel}). `;
      } else if (lang === "zh") {
        strict = `只教授"${typeName}(${sym})"这一种类型的${sTitle}，使用${keyId}(${keyLabel})调。解释公式、所有音符和音色感受，列出${keyId}调的所有音名。`;
      } else {
        strict = `Teach ONLY the "${typeName} (${sym})" type of ${sTitle} in the key of ${keyId} (${keyLabel}). Explain the formula, every note, and the character of this specific chord type. List all note names in ${keyId}. `;
      }
    } else {
      if (lang === "th") {
        strict = `สอนเฉพาะหัวข้อ "${sTitle}" ในคีย์ ${keyId} (${keyLabel}) เท่านั้น ห้ามสอนหรือยกตัวอย่างหัวข้ออื่น เช่น ถ้าหัวข้อคือ "ขั้นคู่ (Interval)" ให้สอนเรื่องขั้นคู่เท่านั้น ห้ามสอน triad หรือคอร์ด ตอบให้ตรงหัวข้อ ระบุชื่อโน้ตในคีย์ ${keyId}. `;
      } else if (lang === "zh") {
        strict = `只讲解主题"${sTitle}"，使用 ${keyId} (${keyLabel}) 调。不要讲解或举例其他主题，例如主题是"音程(Interval)"就只讲音程，不要讲三和弦或和弦。回答要切题，列出 ${keyId} 调的音名。`;
      } else {
        strict = `Teach ONLY "${sTitle}" in the key of ${keyId} (${keyLabel}). Do not teach or give examples of any other topic — e.g. if the topic is "Interval", teach intervals only, never triads or chords. Stay exactly on topic and list note names in ${keyId}. `;
      }
    }
    const prompt = strict + basePrompt;

    setPage("sensei");
    const intro = [{ role: "user", text: `📚 ${stage.icon} ${fullTitle} · ${keyLabel}` }];
    // when no specific type chosen, show the curated type reference card
    if (stage.typesInfo && !chordType) intro.push({ role: "ai", text: tr(stage.typesInfo, lang) });
    // tier 1: scale/interval/triad/7th topics are formulaic — answer instantly from
    // the app's own theory engine instead of asking the live AI every time
    const local = localPathwayLesson(stage, keyId, keyLabel, chordType, demoNotes, fullTitle, lang);
    if (local) intro.push({ role: "ai", text: local });
    intro.forEach(m => pushMessage(m));
    const dt = setTimeout(() => playSequence(demoParsed), 300);
    seqTimers.current.push(dt);
    // tier 1 (local theory engine) is free for guests same as any other pathway
    // content; only tier 2 (the live AI) needs a real login — same split as send()
    if (local) {
      gainExp(EXP.lesson, { lesson: true, quest: true }); // reward practicing a pathway topic
    } else if (!requireLogin("ai")) {
      callClaude(prompt); // tier 2: no prepared answer — ask the live AI
      gainExp(EXP.lesson, { lesson: true, quest: true });
    }
  }

  // open a "benefits of music" knowledge chapter — show curated content in the chat
  function readChapter(stage, caseObj) {
    if (!caseObj && stage && stage.id) logUsage("pathway", stage.id); // top-level card tap only, not a case-study drill-down
    if (stage && stage.id) markPathDone(stage.id);
    if (stage && stage.id) logActivity("read-chapter", stage.id, 0, 0, 120); // ~2 min of reading
    const title = caseObj ? tr(caseObj.title, lang) : tr(stage.title, lang);
    const body = caseObj ? tr(caseObj.content, lang) : tr(stage.content, lang);
    const icon = caseObj ? (caseObj.icon || stage.icon) : stage.icon;
    setLessonContext(LESSON_MODE);   // don't auto-detect/play notes from this text
    setActiveStageId(null); // reading chapters have no key picker — no "change key" back button
    setActiveStageType(null);
    setPage("sensei");
    pushMessage({ role: "user", text: `📚 ${icon} ${title}` });
    pushMessage({ role: "ai", text: body });
    gainExp(EXP.chapter, { quest: true }); // reward reading a knowledge chapter
  }

  return (
    <div className="tg" style={{ opacity: cssReady ? 1 : 0, transition: "opacity .15s" }}>
      <div className="scan" />

      {guestGateReason && (
        <GuestGateScreen reason={guestGateReason} onLogin={() => { saveGuestProfile(profile); signInWith("google"); }} />
      )}

      {permPrimerOpen && (() => {
        const PERM_PRIMER_COPY = {
          th: { title: "TiGA AI ขอสิทธิ์เข้าถึงบางอย่าง", body: "แอพจะขอใช้ไมโครโฟนสำหรับ AI Voice Tutor และฟังโน้ตที่คุณเล่น และขอใช้กล้องสำหรับ Hand-Posture Coach — ระบบปฏิบัติการจะถามอนุญาตแยกอีกครั้งตอนคุณเปิดใช้ฟีเจอร์นั้นจริง", btn: "เข้าใจแล้ว" },
          en: { title: "TiGA AI needs a couple of permissions", body: "The app will ask for your microphone for the AI Voice Tutor and to hear the notes you play, and your camera for the Hand-Posture Coach — your OS will prompt you separately the moment you actually open one of those features.", btn: "Got it" },
          zh: { title: "TiGA AI 需要一些权限", body: "应用会请求麦克风权限用于 AI 语音导师和听取你弹的音符，并请求摄像头权限用于手型指导 — 系统会在你实际打开该功能时另行询问。", btn: "知道了" },
        };
        const c = PERM_PRIMER_COPY[lang] || PERM_PRIMER_COPY.en;
        return (
          <div className="permprimer-overlay">
            <div className="permprimer-card">
              <div className="permprimer-ic">🎙️📷</div>
              <div className="permprimer-title">{c.title}</div>
              <div className="permprimer-body">{c.body}</div>
              <button className="permprimer-btn" onClick={dismissPermPrimer}>{c.btn}</button>
            </div>
          </div>
        );
      })()}

      {/* HEADER — hidden on the video feed so it plays truly full-screen (a floating ☰ replaces it there) */}
      {page !== "videos" && <div className="hdr">
        <div className="logo">
          <button className="hamb" onClick={() => { playUi("click"); setNavOpen(true); }} aria-label="Menu">
            <span /><span /><span />
          </button>
          <div className="lbox flicker" onClick={handleLogoTap}
            style={{ cursor: "pointer" }} title="TIGA">TIGA</div>
        </div>
        <div className="hdr-r">
          {isGuest && (
            <button className="guestloginpill" onClick={() => { saveGuestProfile(profile); signInWith("google"); }} title="Login with Google">
              <span className="oauthico">G</span> {T("ล็อกอิน", "Login", "登录")}
              {guestMsLeft > 0 && guestMsLeft < GUEST_TRIAL_MS && (() => {
                const totalSec = Math.ceil(guestMsLeft / 1000); // whole seconds left, rounded up so it never shows 0:00 while time remains
                return <span className="guestloginpill-timer">{Math.floor(totalSec / 60)}:{String(totalSec % 60).padStart(2, "0")}</span>;
              })()}
            </button>
          )}
          {premium && plan !== "trial" && (() => { const b = planBadge(plan) || { t: "⭐ PRO", c: "" }; return <span className={`probadge ${b.c}`} title={PLAN_LABEL[plan] || "Premium"}>{b.t}</span>; })()}
          {/* Daily-reward chest button removed from the header per feedback (decluttering) —
              still fully reachable from ProfilePage's own dailyhub chest button, same openChestNow(). */}
          {metroOn && <button className="metropill" onClick={() => setMetroOn(false)} title="Metronome" aria-label="Metronome on">🥁 {metroBpm}</button>}
          <div className="flagwrap" onClick={e => e.stopPropagation()}>
            <button className="flagbtn" onClick={() => setFlagOpen(o => !o)}
              aria-label="Language" aria-expanded={flagOpen}>
              <span>{FLAGS[lang]}</span>
              <span className="caret">{flagOpen ? "▲" : "▼"}</span>
            </button>
            {flagOpen && (
              <div className="flagmenu">
                {["th", "en", "zh"].map(lg => (
                  <button key={lg}
                    className={`flagitem${lang === lg ? " active" : ""}`}
                    onClick={() => { setLang(lg); setFlagOpen(false); }}>
                    <span>{FLAGS[lg]}</span>
                    <span className="fn">{FLAG_NAMES[lg]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>}

      {/* ─── TRIAL BANNER — shown on all pages while trial is active ─── */}
      {plan === "trial" && (() => {
        const dLeft = trialDaysLeft(profile);
        if (dLeft <= 0) return null;
        return (
          <div className="trial-banner">
            <span className="trial-banner-txt">{lc.trialBanner} · {dLeft} {lc.trialDaysLeft}</span>
            <button className="trial-banner-btn" onClick={() => { playUi("click"); setPricingOpen(true); }}>{lc.trialUpgrade}</button>
          </div>
        );
      })()}


      {/* ─── PAGE: ADMIN — reachable ONLY via the 5-tap logo + code, never a nav link ─── */}
      {page === "admin" && (
        adminUnlocked
          ? <AdminPage lang={lang} onExit={exitAdmin} adminTier={(profile && profile.admin_tier) || (profile && profile.is_admin ? 3 : 0)} />
          : <LockScreen lang={lang} onUnlock={tryUnlock} />
      )}

      {/* ─── PAGE: HOME (new landing page — UX refactor) ─── */}
      {/* ─── PAGE: PATHWAY ─── */}
      {page === "pathway" && (
        <PathwayPage lang={lang} onLearn={learnTopic} onRead={readChapter} initialOpenStageId={activeStageId} initialSelectedType={activeStageType} userName={(profile && profile.full_name) || ""} />
      )}

      {/* ─── PAGE: PRACTICE TODAY / EAR GYM / READING / INSIGHTS / REPORT ─── */}
      {page === "today" && (
        <TodayPage lang={lang} exp={(profile && profile.exp) || 0} homework={homework}
          onLearn={learnTopic} onRead={readChapter} onSong={chooseSong} onNavigate={handleCoachNavigate}
          onReward={(xp, c) => { if (xp) gainExp(xp, { quest: true }); if (c) earnCoins(c); }}
          onBack={() => { setPage("studio"); setStudioView("menu"); }} />
      )}
      {page === "eargym" && (
        <EarGymPage lang={lang} initialTab={earGymInitialTab} onReward={(xp, c) => { if (xp) gainExp(xp, { quest: true }); if (c) earnCoins(c); }} onBack={() => { setPage("studio"); setStudioView("menu"); }} />
      )}
      {page === "reading" && (
        <ReadingPage lang={lang} onReward={(xp, c) => { if (xp) gainExp(xp, { quest: true }); if (c) earnCoins(c); }} onBack={() => { setPage("studio"); setStudioView("menu"); }} />
      )}
      {page === "insights" && (
        <InsightsPage lang={lang} profile={profile} onSong={chooseSong} onBack={() => setPage("profile")} />
      )}
      {page === "report" && (
        <ReportPage lang={lang} profile={profile} onBack={() => setPage("profile")} />
      )}

      {/* ─── PAGE: VIDEO LESSONS ─── */}
      {page === "videos" && (
        <button className="vidfab" aria-label="Menu" onClick={() => { playUi("click"); setNavOpen(true); }}>
          <span /><span /><span />
        </button>
      )}
      {page === "videos" && (
        <VideoLessonsPage lang={lang} onAsk={(t) => {
          playUi("click");
          setInput((lang === "th" ? 'ช่วยสอนเพิ่มเติมจากวิดีโอบทเรียน "' : lang === "zh" ? '请给我详细讲讲视频课程 "' : 'Teach me more about the video lesson "') + t + '"');
          setActiveStageId(null);
          setActiveStageType(null);
          setPage("sensei");
        }} />
      )}

      {/* ─── PAGE: STUDIO (play-along / sight-reading / hand coach) ─── */}
      {page === "studio" && (
        studioView === "songs"
          ? <SongListPage lang={lang} level={levelInfo((profile && profile.exp) || 0).level} premium={premium} plan={plan} onUpsell={() => setPricingOpen(true)} onRequireLogin={() => requireLogin("ai")} onPlay={chooseSong} onBack={() => setStudioView("menu")} />
          : <StudioPage lang={lang} plan={plan} premium={premium} freezeCount={readStreak().freezes || 0} onRequireLogin={() => requireLogin("ai")}
              voiceLocked={!isMaxPlan(plan) && !(profile && profile.is_admin)}
              onVoice={() => { if (!isMaxPlan(plan) && !(profile && profile.is_admin)) { playUi("click"); setPricingOpen(true); } else openVoice(); }}
              onSongs={() => setStudioView("songs")}
              onSight={openSight} onCamera={openCamera}
              onExam={() => { playUi("click"); premium ? setExamOpen(true) : setPricingOpen(true); }}
              onEarGym={() => { playUi("click"); logUsage("nav", "studio-eargym"); setPage("eargym"); }}
              onReading={() => { playUi("click"); logUsage("nav", "studio-reading"); setPage("reading"); }}
              onToday={() => { playUi("click"); logUsage("nav", "studio-today"); setPage("today"); }}
              onAiReport={() => { logUsage("nav", "studio-ai-report"); setAiModalType("report"); setAiModalText(""); setAiModalLoading(false); setAiModalOpen(true); }}
              onAiPlan={() => { logUsage("nav", "studio-ai-plan"); setAiModalType("plan"); setAiModalText(""); setAiModalLoading(false); setAiModalOpen(true); }}
              onAnalytics={() => { logUsage("nav", "studio-analytics"); setPage("insights"); }}
              onUpsell={() => setPricingOpen(true)}
              onPlay={(s) => { logUsage("nav", "studio-quick"); chooseSong(s); }}
              onParent={() => { playUi("click"); premium ? setParentOpen(true) : setPricingOpen(true); }}
              detectOpen={detectOpen} setDetectOpen={setDetectOpen} detectNotes={detectNotes} setDetectNotes={setDetectNotes}
              detectMatch={detectMatch} setDetectMatch={setDetectMatch} detectListening={detectListening} setDetectListening={setDetectListening}
              battlePickOpen={battlePickOpen} setBattlePickOpen={setBattlePickOpen} battleData={battleData} setBattleData={setBattleData}
              songPhase={songPhase} startSongPlay={startSongPlay}
              mysteryChest={mysteryChest} setMysteryChest={setMysteryChest} luckyToast={luckyToast}
              onSchoolJoined={() => {
                sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle()
                  .then(({ data }) => { if (data) setProfile(data); });
              }} />
      )}

      {/* ─── PAGE: SCHOOL DASHBOARD (School Plan Pro, teacher-only, hidden entry) ─── */}
      {page === "school" && profile && profile.school_id && profile.school_role === "teacher" && (
        <SchoolDashboard lang={lang} profile={profile} onBack={() => setPage("pathway")} />
      )}

      {/* ─── PAGE: PROFILE ─── */}
      {page === "profile" && <ProfileDashboardPanel lang={lang} profile={profile} plan={plan} chestAvail={chestAvail} schoolHW={schoolHW} setSchoolHW={setSchoolHW} homework={homework} setHomework={setHomework} setHomeworkLS={setHomeworkLS} mySchoolName={mySchoolName} coins={coins} gems={gems} session={session} onSignOut={onSignOut} setPage={setPage} setStudioView={setStudioView} setPricingOpen={setPricingOpen} setShopOpen={setShopOpen} setHelpOpen={setHelpOpen} setFriendsOpen={setFriendsOpen} setAiModalType={setAiModalType} setAiModalText={setAiModalText} setAiModalLoading={setAiModalLoading} setAiModalOpen={setAiModalOpen} earnCoins={earnCoins} buyFreeze={buyFreeze} openChestNow={openChestNow} exchangeGems={exchangeGems} questToday={questToday} readStreak={readStreak} streakAtRisk={streakAtRisk} leaveSchool={leaveSchool} QUEST_GOAL={QUEST_GOAL} ClassQuestSection={ClassQuestSection} SchoolLeaderboardSection={SchoolLeaderboardSection} ProfilePage={ProfilePage} />}

      {/* ─── PAGE: COACH (Max plan) ─── */}
      {page === "coach" && <CoachPage lang={lang} profile={profile} onNavigate={handleCoachNavigate} />}

      {/* ─── PAGE: MUSIC GAMES ─── */}
      {page === "gamepage" && <GamesPage lang={lang} />}

      {/* ─── PAGE: SENSEI (default) ─── */}
      {page === "sensei" && <SenseiView lang={lang} activeStageId={activeStageId} setPage={setPage} recommendNext={recommendNext} pianoOct={pianoOct} setPianoOct={setPianoOct} replayLast={replayLast} seqIsChord={seqIsChord} chordStyle={chordStyle} toggleChordStyle={toggleChordStyle} litNote={litNote} litSet={litSet} fingerMap={fingerMap} handleMainKey={handleMainKey} recording={recording} toggleRecord={toggleRecord} hasSeq={hasSeq} togglePlayPause={togglePlayPause} seqPlaying={seqPlaying} hasClip={hasClip} playingClip={playingClip} playClip={playClip} critiqueRecording={critiqueRecording} fingerChart={fingerChart} hand={hand} setHand={setHand} startPractice={startPractice} msgs={msgs} activeSpk={activeSpk} setActiveSpk={setActiveSpk} playSequence={playSequence} loading={loading} endRef={endRef} input={input} setInput={setInput} send={send} setModal={setModal} />}

      {/* ─── SIDE DRAWER NAV (hamburger) ─── */}
      {navOpen && <div className="drawer-scrim" onClick={() => setNavOpen(false)} />}
      <nav className={`drawer${navOpen ? " open" : ""}`} aria-hidden={!navOpen}>
        <div className="drawer-brand" style={{ cursor: "pointer" }}
          onClick={() => { playUi("click"); stopPracticeListeners(); setPage("pathway"); setNavOpen(false); }}
          title={lang === "th" ? "กลับไปหน้า Pathway" : lang === "zh" ? "返回学习路径" : "Back to Pathway"}>
          <div className="lbox">TG</div>
          <div>
            <div className="lname">TIGA.AI</div>
            <div className="lsub">v{APP_VER}</div>
          </div>
        </div>
        {[
          { p: "pathway", ic: "⬡", c: "#d97757", t: lc.navPath },
          { p: "sensei", ic: "◈", c: "#d97757", t: lc.navSensei },
          { p: "coach", ic: "🎯", c: "#d97757", t: "Daily Mentor", locked: !isMaxPlan(plan) && !(profile && profile.is_admin) },
          { p: "studio", sv: "songs", ic: "🎵", c: "#d97757", t: lc.studioPlayAlong },
          { p: "studio", sv: "menu", ic: "▶", c: "#d97757", t: lc.navStudio },
          { p: "videos", ic: "🎬", c: "#d97757", t: lc.navVideos },
          { p: "profile", ic: levelInfo((profile && profile.exp) || 0).tier.icon, c: levelInfo((profile && profile.exp) || 0).tier.c, t: lc.navProfile },
          { p: "gamepage", ic: "🎮", c: "#d97757", t: lang === "th" ? "เกมดนตรี" : lang === "zh" ? "音乐游戏" : "Music Games", locked: !isMaxPlan(plan) && !(profile && profile.is_admin) },
          // no "admin" entry here on purpose — /admin is reachable ONLY via the 5-tap
          // logo gesture + code (handleLogoTap/tryUnlock), never a visible nav link.
        ].map(it => {
          const isOn = it.p === "studio" ? (page === "studio" && studioView === it.sv) : page === it.p;
          return (
          <button key={it.p + (it.sv || "")} className={`draweritem${isOn ? " on" : ""}`} style={{ "--nav-c": it.c }}
            onClick={() => {
              playUi("click"); haptic(6);
              if (it.locked) { setNavOpen(false); setPricingOpen(true); return; }
              logUsage("nav", it.p + (it.sv ? "-" + it.sv : "")); stopPracticeListeners(); setPage(it.p); if (it.p === "studio") setStudioView(it.sv); setNavOpen(false);
            }}>
            <span className="drawericon" aria-hidden="true">{it.ic}</span>
            <span className="drawerlabel">{it.t}{it.locked && " 🔒"}</span>
            {isOn && <span className="drawerdot" />}
          </button>
          );
        })}
        <div className="drawer-foot">
          <button className="draweritem sub" onClick={() => { playUi("click"); setNavOpen(false); setPricingOpen(true); }}><span className="drawericon">✦</span><span className="drawerlabel">{premium ? lc.prManage : lc.upgrade}</span></button>
          <button className="draweritem sub" onClick={() => { playUi("click"); setNavOpen(false); setSettingsOpen(true); }}><span className="drawericon">⚙️</span><span className="drawerlabel">{lc.setTitle}</span></button>
          {onSignOut && <button className="draweritem sub" onClick={() => { playUi("click"); onSignOut(); }}><span className="drawericon">⏻</span><span className="drawerlabel">{lc.signOut}</span></button>}
        </div>
      </nav>

      {/* MODAL (sensei expanded) */}
      <div className={`mov${modal ? " open" : ""}`}>
        <div className="mhdr">
          <div className="mlbl"><div className="dot" />⤢ {lc.aiLabel}</div>
          <button className="cbtn" onClick={() => setModal(false)}>{lc.close}</button>
        </div>
        <div className="mpw"><Piano litNote={litNote} litSet={litSet} fingerMap={fingerMap} small /></div>
        <div className="mmsgs">
          {msgs.map((m, i) => (
            <Msg key={i} m={m} idx={i} lang={lang}
              activeSpk={activeSpk} setActiveSpk={setActiveSpk} onPlay={playSequence} />
          ))}
          {loading && <Typing />}
          <div ref={mendRef} />
        </div>
        <div className="miw">
          <Input val={input} onChange={setInput} onSend={send} loading={loading} ph={lc.ph} />
        </div>
      </div>

      {/* PRACTICE MODE overlay — listens to the learner and checks each note */}
      {practiceOpen && <PracticeOverlay practiceModeRef={practiceModeRef} chordStyle={chordStyle} practiceTarget={practiceTarget} practiceHitIdxs={practiceHitIdxs} practiceFingers={practiceFingers} lang={lang} practiceLabel={practiceLabel} exitPractice={exitPractice} practiceSrc={practiceSrc} practiceTune={practiceTune} hand={hand} setHand={setHand} practiceIdx={practiceIdx} practiceHeard={practiceHeard} practiceMiss={practiceMiss} restartPractice={restartPractice} practiceHandlerRef={practiceHandlerRef} switchPracticeChordStyle={switchPracticeChordStyle} />}

      {/* PLAY-ALONG overlay — falling-notes song mode */}
      {songOpen && songMeta && <SongPlayOverlay songMeta={songMeta} lang={lang} songPhase={songPhase} songResult={songResult} songHud={songHud} songGhost={songGhost} songStaffNotes={songStaffNotes} songShake={songShake} songFever={songFever} songCanvasRef={songCanvasRef} songCountdown={songCountdown} songGo={songGo} songBonus={songBonus} songAnnounce={songAnnounce} songPops={songPops} songJudge={songJudge} songBursts={songBursts} songDataRef={songDataRef} songTempo={songTempo} setSongTempo={setSongTempo} songAutoLoop={songAutoLoop} setSongAutoLoop={setSongAutoLoop} backingOn={backingOn} setBackingOn={setBackingOn} songSrc={songSrc} songNextLit={songNextLit} songInputRef={songInputRef} songAnalysisBusy={songAnalysisBusy} songAnalysis={songAnalysis} stylePickOpen={stylePickOpen} setStylePickOpen={setStylePickOpen} styleLoading={styleLoading} profile={profile} exitSong={exitSong} goToRecommendation={goToRecommendation} startSongPlay={startSongPlay} previewSong={previewSong} shareCard={shareCard} shareLine={shareLine} styleTransform={styleTransform} buildSongResultRecommendation={buildSongResultRecommendation} />}

      {/* SIGHT-READING overlay */}
      {sightOpen && <SightReadingOverlay lang={lang} exitSight={exitSight} sightDone={sightDone} sightIdx={sightIdx} SIGHT_ROUND={SIGHT_ROUND} sightScore={sightScore} sightClef={sightClef} pickSightClef={pickSightClef} sightFeedback={sightFeedback} sightTarget={sightTarget} sightHint={sightHint} sightNoteClef={sightNoteClef} sightHandlerRef={sightHandlerRef} sightSrc={sightSrc} openSight={openSight} />}

      {/* HAND-POSTURE COACH overlay (camera) */}
      {camOpen && <CameraCoachOverlay lang={lang} exitCamera={exitCamera} camVideoRef={camVideoRef} camCanvasRef={camCanvasRef} camStatus={camStatus} camMsg={camMsg} camCoach={camCoach} retryCamera={retryCamera} setCamCoach={setCamCoach} analyzeHands={analyzeHands} premium={premium} />}

      {/* AI VOICE TUTOR overlay */}
      {vmOpen && <VoiceTutorOverlay lang={lang} setLang={setLang} vmLangOpen={vmLangOpen} setVmLangOpen={setVmLangOpen} exitVoice={exitVoice} vmState={vmState} vmErr={vmErr} vmOrbTap={vmOrbTap} vmInstant={vmInstant} vmCaption={vmCaption} vmStaff={vmStaff} vmNotes={vmNotes} vmMsgs={vmMsgs} vmEndRef={vmEndRef} vmLit={vmLit} vmOnNote={vmOnNote} vmMenuOpen={vmMenuOpen} setVmMenuOpen={setVmMenuOpen} vmSpeed={vmSpeed} setVmSpeed={setVmSpeed} vmSpeedRef={vmSpeedRef} vmVoice={vmVoice} setVmVoice={setVmVoice} vmFast={vmFast} setVmFast={setVmFast} vmFastRef={vmFastRef} vmCloudDeadRef={vmCloudDeadRef} vmPoly={vmPoly} vmTogglePoly={vmTogglePoly} vmInput={vmInput} setVmInput={setVmInput} vmEarResetRef={vmEarResetRef} vmActiveRef={vmActiveRef} vmProcess={vmProcess} vmToggle={vmToggle} />}

      {/* PRICING / UPGRADE */}
      {pricingOpen && <PricingOverlay plan={plan} profile={profile} billCycle={billCycle} setBillCycle={setBillCycle} lang={lang} startCheckout={startCheckout} choosePlan={choosePlan} setPricingOpen={setPricingOpen} setSchoolCheckout={setSchoolCheckout} />}

      {/* CHECKOUT — Stripe / PromptPay / Alipay / WeChat */}
      {checkout && <CheckoutModal lang={lang} checkout={checkout} payCfg={payCfg} session={session} isAdmin={!!(profile && profile.is_admin)} onClose={() => setCheckout(null)} playUi={playUi} />}
      {schoolCheckout && <SchoolCheckoutModal lang={lang} schoolCheckout={schoolCheckout} payCfg={payCfg} session={session} onClose={() => setSchoolCheckout(null)} playUi={playUi} />}

      {/* AI WEEKLY REPORT / AI PRACTICE PLAN MODAL (Max exclusive) */}
      {aiModalOpen && (
        <div className="setov" onClick={() => { if (!aiModalLoading) setAiModalOpen(false); }}>
          <div className="setcard" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div className="sethdr">
              <span>{aiModalType === "report"
                ? (lang === "th" ? "📋 รายงานพัฒนาการ AI" : lang === "zh" ? "📋 AI 进度报告" : "📋 AI Weekly Report")
                : (lang === "th" ? "🗓️ แผนซ้อมส่วนตัว AI" : lang === "zh" ? "🗓️ AI 练习计划" : "🗓️ AI Practice Plan")}</span>
              <button className="cbtn" onClick={() => { if (!aiModalLoading) setAiModalOpen(false); }}>{lc.close}</button>
            </div>
            <div className="setbody" style={{ padding: "12px 16px" }}>
              {!aiModalText && !aiModalLoading && (
                <button className="songbtn go" style={{ width: "100%", marginTop: 8 }}
                  onClick={async () => {
                    if (requireLogin("ai")) return;
                    setAiModalLoading(true);
                    const log = readPracticeLog();
                    const mem = readMemory();
                    const st = readStreak();
                    let sessW = 0, accSumW = 0, accNW = 0;
                    for (let i = 0; i < 7; i++) {
                      const d = new Date(); d.setDate(d.getDate() - i);
                      const e = log[dayKey(d)]; if (e) { sessW += e.n; accSumW += (e.accSum || 0); accNW += e.n; }
                    }
                    const wkAcc = accNW ? Math.round(accSumW / accNW) : null;
                    const struggles = (mem.struggles || []).slice(0, 3).map((s) => s.label).join(", ");
                    const mastered = (mem.mastered || []).slice(0, 3).join(", ");
                    const ctx = `Streak: ${st.count || 0} days. This week: ${sessW} sessions, accuracy ${wkAcc != null ? wkAcc + "%" : "no data"}. Weak spots: ${struggles || "none"}. Mastered: ${mastered || "none"}.`;
                    const prompt = aiModalType === "report"
                      ? (lang === "th"
                        ? `คุณเป็นครูสอนเปียโน AI ที่เป็นกันเอง เขียนรายงานพัฒนาการเปียโนรายสัปดาห์ที่อบอุ่นและให้กำลังใจ (ประมาณ 150-200 คำ) โดยอิงจากข้อมูลนี้: ${ctx} เขียนเป็นภาษาไทย`
                        : lang === "zh"
                        ? `你是一位亲切的AI钢琴老师。根据以下数据撰写一份温暖、鼓励性的每周钢琴进度报告（约150-200字）：${ctx} 请用中文撰写。`
                        : `You are a friendly AI piano teacher. Write a warm, encouraging weekly piano progress report (~150-200 words) based on: ${ctx}`)
                      : (lang === "th"
                        ? `คุณเป็นครูสอนเปียโน AI ที่เชี่ยวชาญ สร้างแผนซ้อมเปียโนส่วนตัว 7 วัน (รายวัน) โดยอิงจากข้อมูลนี้: ${ctx} รายละเอียดแต่ละวัน: ชื่อกิจกรรม เวลาโดยประมาณ เหตุผลที่เหมาะกับผู้เรียน เขียนเป็นภาษาไทย`
                        : lang === "zh"
                        ? `你是一位专业的AI钢琴老师。根据以下数据，为学生制定一份7天个性化练习计划（每天详细说明练习内容和大概时长）：${ctx} 请用中文撰写。`
                        : `You are an expert AI piano teacher. Create a personalized 7-day piano practice schedule (with daily details: activity, estimated time, why it suits this learner) based on: ${ctx}`);
                    try {
                      // Cached 24h, content-addressed on the exact prompt (which already
                      // embeds the day's streak/accuracy/struggles via ctx) — closing and
                      // reopening this modal without any new practice in between reuses the
                      // same report/plan instead of re-paying for an unchanged one; any real
                      // change to the underlying stats changes the prompt text and naturally
                      // busts the cache.
                      const txt = await withAiCache("aiReport", { prompt }, 24 * 60 * 60 * 1000, () => fetchChatCompletion({ message: prompt, conversationHistory: [], stream: false }));
                      setAiModalText(txt || (lang === "th" ? "ไม่สามารถสร้างได้ในขณะนี้ กรุณาลองใหม่" : lang === "zh" ? "暂时无法生成，请重试" : "Could not generate. Please try again."));
                    } catch (_) {
                      setAiModalText(lang === "th" ? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" : lang === "zh" ? "出错了，请重试" : "An error occurred. Please try again.");
                    }
                    setAiModalLoading(false);
                  }}>
                  {lang === "th" ? "✨ สร้างเลย" : lang === "zh" ? "✨ 立即生成" : "✨ Generate"}
                </button>
              )}
              {aiModalLoading && (
                <div style={{ textAlign: "center", padding: "28px 0", color: "var(--muted)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, fontSize: "14px" }}>
                  ⏳ {lang === "th" ? "กำลังสร้าง..." : lang === "zh" ? "生成中..." : "Generating..."}
                </div>
              )}
              {aiModalText && (
                <>
                  <div style={{ fontSize: "13.5px", lineHeight: 1.75, color: "var(--text)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 600, whiteSpace: "pre-wrap", padding: "4px 0 8px" }}>
                    {aiModalText}
                  </div>
                  <button className="songbtn" style={{ width: "100%", marginTop: 4 }}
                    onClick={() => { setAiModalText(""); setAiModalLoading(false); }}>
                    {lang === "th" ? "🔄 สร้างใหม่" : lang === "zh" ? "🔄 重新生成" : "🔄 Regenerate"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PARENT DASHBOARD (premium) */}
      {parentOpen && (() => {
        const plog = readPracticeLog(), mem = readMemory(), st = readStreak(), wk = readWeekly();
        const li = levelInfo((profile && profile.exp) || 0);
        const meta = (session && session.user && session.user.user_metadata) || {};
        const nm = (profile && profile.full_name) || meta.full_name || meta.name || "TiGA";
        let sess = 0, accSum = 0, accN = 0;
        for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); const e = plog[dayKey(d)]; if (e) { sess += e.n; accSum += (e.accSum || 0); accN += e.n; } }
        const wkAcc = accN ? Math.round(accSum / accN) : 0;
        const heat = [];
        for (let i = 41; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const n = plog[dayKey(d)] ? plog[dayKey(d)].n : 0; heat.push(n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3); }
        return (
          <div className="setov" onClick={() => setParentOpen(false)}>
            <div className="setcard pricing" onClick={e => e.stopPropagation()}>
              <div className="sethdr"><span>👨‍👩‍👧 {lc.pdTitle}</span><button className="cbtn" onClick={() => setParentOpen(false)}>{lc.close}</button></div>
              <div className="setbody">
                <div className="pd-head">{li.tier.icon} <b>{nm}</b> · {lc.profLevelWord} {li.level} · {tr(li.tier, lang)}</div>
                <div className="pd-stats">
                  <div className="pd-stat"><div className="pd-num">{st.count || 0}🔥</div><div className="pd-lbl">{lc.dhStreak}</div></div>
                  <div className="pd-stat"><div className="pd-num">{sess}</div><div className="pd-lbl">{lc.pdSessions}</div></div>
                  <div className="pd-stat"><div className="pd-num">{wkAcc}%</div><div className="pd-lbl">{lc.pdAcc}</div></div>
                  <div className="pd-stat"><div className="pd-num">{(profile && profile.lessons_done) || 0}</div><div className="pd-lbl">{lc.profLessonsStat}</div></div>
                </div>
                <div className="pd-sec">{lc.pdActivity}</div>
                <div className="heatgrid" style={{ gridTemplateRows: "repeat(7,1fr)" }}>
                  {heat.map((l, i) => <div key={i} className="heatcell" style={{ background: heatColor(l) }} />)}
                </div>
                {mem.struggles && mem.struggles.length > 0 && <><div className="pd-sec">{lc.pdFocus}</div><div className="pd-tags">{mem.struggles.slice(0, 5).map((s, i) => <span key={i} className="pd-tag focus">{s.label}</span>)}</div></>}
                {mem.mastered && mem.mastered.length > 0 && <><div className="pd-sec">{lc.pdMastered}</div><div className="pd-tags">{mem.mastered.slice(0, 6).map((s, i) => <span key={i} className="pd-tag good">{s}</span>)}</div></>}
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button className="songbtn ghost" style={{ flex: 1 }} onClick={() => shareCard({ title: nm, big: (st.count || 0) + "🔥", sub: lc.profLevelWord + " " + li.level, lines: [`${sess} ${lc.pdSessions} · ${wkAcc}% ${lc.pdAcc}`] })}>📤 {lc.shareBtn}</button>
                  <button className="songbtn ghost" style={{ flex: 1, borderColor: "#06c755", color: "#06c755" }} onClick={() => shareLine(`🎹 ${nm} ${lc.profLevelWord} ${li.level} · ${(st.count || 0)}🔥 streak — TiGA Piano AI tigaalpha.github.io`)}>🟢 LINE</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* GRADE EXAM PREP (premium) */}
      {examOpen && (
        <div className="setov" onClick={() => setExamOpen(false)}>
          <div className="setcard pricing" onClick={e => e.stopPropagation()}>
            <div className="sethdr"><span>🎓 {lc.exTitle}</span><button className="cbtn" onClick={() => setExamOpen(false)}>{lc.close}</button></div>
            <div className="setbody">
              <p className="pr-sub">{lc.exSub}</p>
              {EXAM_GRADES.map(g => {
                const done = examProgress[g.id] || [];
                const pct = Math.round(done.length / g.tasks.length * 100);
                return (
                  <div key={g.id} className="exgrade">
                    <div className="exgrade-top"><b>{tr(g, lang)}</b><span>{done.length}/{g.tasks.length}</span></div>
                    <div className="wkbar"><div style={{ width: pct + "%" }} /></div>
                    <div className="extasks">
                      {g.tasks.map((tk, i) => {
                        const ok = done.includes(i);
                        return <button key={i} className={`extask${ok ? " ok" : ""}`} onClick={() => toggleExamTask(g.id, i)}>
                          <span>{ok ? "✓" : "○"}</span> {tr(tk, lang)}
                        </button>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS / TOOLS overlay */}
      {settingsOpen && (
        <div className="setov" onClick={() => setSettingsOpen(false)}>
          <div className="setcard" onClick={e => e.stopPropagation()}>
            <div className="sethdr">
              <span>⚙️ {lc.setTitle}</span>
              <button className="cbtn" onClick={() => setSettingsOpen(false)}>{lc.close}</button>
            </div>
            <div className="setbody">
              <SkinThemeSettings mode={mode} setMode={setMode} setEquipLS={setEquipLS} lang={lang} />
              <div className="setdiv" />
              <SfxMetronomeSettings lang={lang} sfxVol={sfxVol} setSfxVol={setSfxVol} setSfxVolState={setSfxVolState} sfxMuted={sfxMuted} setSfxMuted={setSfxMuted} setSfxMutedState={setSfxMutedState} ambientOn={ambientOn} setAmbientOn={setAmbientOn} getAC={getAC} metroOn={metroOn} setMetroOn={setMetroOn} setAdvancedOpen={setAdvancedOpen} setSetAdvancedOpen={setSetAdvancedOpen} metroBpm={metroBpm} setMetroBpm={setMetroBpm} tapTempo={tapTempo} pushOn={pushOn} togglePush={togglePush} />
              <div className="setrow">
                <label>⭐ Premium</label>
                <button className={`settoggle${premium ? " on" : ""}`} onClick={() => { const v = !premium; setPremiumLS(v); setPremium(v); const np = v ? (plan === "free" ? "premium" : plan) : "free"; setPlanLS(np); setPlan(np); }}>
                  {premium ? lc.setOn : lc.setOff}
                </button>
              </div>
              <button className="setbtn wide" style={{ width: "100%" }} onClick={() => { setSettingsOpen(false); premium ? setParentOpen(true) : setPricingOpen(true); }}>👨‍👩‍👧 {lc.pdTitle}{!premium && " 🔒"}</button>
              <div className="setdiv" />
              {premium && (
                <div className="setrow col">
                  <label>🎯 Auto Teaching</label>
                  <div className="setlangs">
                    <button className={`setlangbtn${profile.auto_teach_interval_min === 0 ? " on" : ""}`}
                      onClick={() => saveAutoTeachInterval(0)}>{lang === "th" ? "ปิด" : lang === "zh" ? "关闭" : "Off"}</button>
                    {AUTO_TEACH_INTERVALS.map(m => (
                      <button key={m} className={`setlangbtn${profile.auto_teach_interval_min === m ? " on" : ""}`}
                        onClick={() => saveAutoTeachInterval(m)}>{m}{lang === "th" ? "น." : lang === "zh" ? "分" : "m"}</button>
                    ))}
                  </div>
                  <span className="setsub">{profile.auto_teach_interval_min == null
                    ? (lang === "th" ? `ตามค่าระบบ (ทุก ${autoTeachDefaultMin ?? AUTO_TEACH_FALLBACK_MIN} นาที)` : lang === "zh" ? `跟随系统默认（每 ${autoTeachDefaultMin ?? AUTO_TEACH_FALLBACK_MIN} 分钟）` : `Following the platform default (every ${autoTeachDefaultMin ?? AUTO_TEACH_FALLBACK_MIN} min)`)
                    : (lang === "th" ? "ครู AI จะแนะนำจุดอ่อนแบบสั้นๆ ตอนอยู่หน้าเส้นทางการเรียนรู้" : lang === "zh" ? "AI 会在你查看学习路径页面时提示薄弱环节" : "The AI coach flags a weak spot while you're on the Pathway page")}</span>
                </div>
              )}
              <div className="setdiv" />
              <LanguageSettings lang={lang} setLang={setLang} />
              {installEvt && (
                <>
                  <div className="setdiv" />
                  <button className="setbtn wide" style={{ width: "100%" }} onClick={doInstall}>📲 {lc.setInstall}</button>
                </>
              )}
              <div className="setver">TiGA AI v{APP_VER}</div>
            </div>
          </div>
        </div>
      )}

      {/* HELP — kid-friendly "how to use" (self-serve) */}
      {helpOpen && (
        <div className="chestov" onClick={() => setHelpOpen(false)}>
          <div className="setcard wlc" onClick={e => e.stopPropagation()}>
            <div className="wlc-title">❓ {lc.helpTitle}</div>
            <div className="wlc-tips">
              <div className="wlc-tip"><span>☰</span><b>{lc.help1}</b></div>
              <div className="wlc-tip"><span>🎹</span><b>{lc.help2}</b></div>
              <div className="wlc-tip"><span>🎙️</span><b>{lc.help3}</b></div>
              <div className="wlc-tip"><span>🎮</span><b>{lc.help4}</b></div>
              <div className="wlc-tip"><span>🔁</span><b>{lc.help5}</b></div>
            </div>
            <button className="vmbig" onClick={() => setHelpOpen(false)}>{lc.helpOk}</button>
          </div>
        </div>
      )}

      {/* WELCOME / first-run onboarding */}
      {welcomeOpen && (
        <div className="chestov" onClick={() => {}}>
          <div className="setcard wlc" onClick={e => e.stopPropagation()}>
            <div className="wlc-mascot">🎹</div>
            <div className="wlc-title">{lc.wlcTitle}</div>
            <div className="wlc-tips">
              <div className="wlc-tip"><span>🎹</span><b>{lc.wlcTip1}</b></div>
              <div className="wlc-tip"><span>🎮</span><b>{lc.wlcTip2}</b></div>
              <div className="wlc-tip"><span>🏆</span><b>{lc.wlcTip3}</b></div>
            </div>
            <button className="vmbig" onClick={() => { try { localStorage.setItem("tg_welcomed", "1"); } catch (e) {} setWelcomeOpen(false); getAC(); playUi("levelup"); mascot("celebrate", 2600); }}>{lc.wlcStart}</button>
          </div>
        </div>
      )}

      {/* COSMETICS SHOP */}
      {friendsOpen && <FriendsModal lang={lang} onClose={() => setFriendsOpen(false)} />}

      {shopOpen && (
        <div className="setov" onClick={() => setShopOpen(false)}>
          <div className="setcard" onClick={e => e.stopPropagation()}>
            <div className="sethdr">
              <span>🛍️ {lc.shopTitle}</span>
              <span className="coinpill" style={{ marginLeft: "auto", marginRight: 10 }}>🪙 {coins}</span>
              <button className="cbtn" onClick={() => setShopOpen(false)}>{lc.close}</button>
            </div>
            <div className="setbody">
              <div className="shopsec">🎹 {lc.shopSkins}</div>
              <div className="shopgrid">
                {SHOP_SKINS.map(it => renderShopItem("skin", it, skin))}
              </div>
              <div className="shopsec">🎨 {lc.shopThemes}</div>
              <div className="shopgrid">
                {SHOP_THEMES.map(it => renderShopItem("theme", it, theme))}
              </div>
              <div className="shopsec">🖼️ {lc.shopFrames}</div>
              <div className="shopgrid">
                {SHOP_FRAMES.map(it => renderShopItem("frame", it, frame))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DAILY CHEST modal — the reward is already resolved before this shows
          (see openChestNow); the wheel only plays back that real outcome */}
      {chestOpen && (
        <div className="chestov" onClick={() => { if (!chestOpening) setChestOpen(false); }}>
          <div className="chestcard" onClick={e => e.stopPropagation()}>
            {chestOpening ? (
              <>
                <div className="chestwheel">
                  <div className="chestwheel-ring" style={{ transform: `rotate(${chestSpinDeg}deg)` }}>
                    {CHEST_WHEEL.map((k, i) => (
                      <span key={i} className={`cw-seg cw-${k}`} style={{ transform: `rotate(${i * 45 + 22.5}deg) translateY(-52px) rotate(${-(i * 45 + 22.5)}deg)` }}>
                        {k === "jackpot" ? "🎉" : k === "big" ? "✨" : "🪙"}
                      </span>
                    ))}
                  </div>
                  <div className="chestwheel-ptr">▼</div>
                  <div className="chestwheel-hub">🎁</div>
                </div>
                <div className="chesttitle">{lc.chestOpening}</div>
              </>
            ) : (
              <>
                <div className="chestbig open">🎁</div>
                <div className={`chesttitle${chestReward.kind === "jackpot" ? " jackpot" : ""}`}>
                  {chestReward.kind === "jackpot" ? "🎉 JACKPOT! 🎉" : chestReward.kind === "big" ? "✨ " + lc.chestBig + " ✨" : lc.chestGot}
                </div>
                <div className="chestrewards">
                  <span>🪙 +{chestReward.coins}</span>
                  <span>✦ +{chestReward.exp} EXP</span>
                </div>
                <div className="cheststreak">🔥 {lc.chestDay} {chestReward.streak}</div>
                <button className="songbtn go" onClick={() => setChestOpen(false)}>{lc.chestClaim}</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Stripe payment success banner */}
      {stripeReturn && (
        <div className="exptoast" style={{ background: stripeReturn === "done" ? "#4caf50" : "#d97757", top: 72 }}>
          <span>{stripeReturn === "done" ? "✅" : "⏳"}</span>
          <span>{stripeReturn === "done"
            ? (lang === "th" ? "เปิดใช้งานแผนแล้ว!" : lang === "zh" ? "套餐已激活！" : "Plan activated!")
            : (lang === "th" ? "ชำระเงินสำเร็จ กำลังเปิดใช้งาน..." : lang === "zh" ? "支付成功，正在激活..." : "Payment received, activating...")}</span>
        </div>
      )}

      {schoolPayReturn && (
        <div className="exptoast" style={{ background: schoolPayReturn === "paid" ? "#4caf50" : schoolPayReturn === "error" ? "#e55" : "#d97757", top: 72 }}>
          <span>{schoolPayReturn === "paid" ? "✅" : schoolPayReturn === "error" ? "⚠️" : "⏳"}</span>
          <span>{schoolPayReturn === "paid"
            ? (lang === "th" ? "รับชำระเงินแล้ว ทีมงานจะติดต่อกลับเพื่อเปิดใช้งาน" : lang === "zh" ? "已收到付款，团队将联系您开通" : "Payment received — our team will follow up to activate")
            : schoolPayReturn === "error"
            ? (lang === "th" ? "ยืนยันการชำระเงินไม่สำเร็จ ติดต่อทีมงานหากถูกตัดเงินแล้ว" : lang === "zh" ? "支付确认失败，如已扣款请联系我们" : "Couldn't confirm payment — contact us if you were charged")
            : (lang === "th" ? "กำลังตรวจสอบการชำระเงิน..." : lang === "zh" ? "正在核实付款..." : "Verifying payment...")}</span>
        </div>
      )}

      {/* floating EXP reward toast */}
      {expToast && (
        <div className="exptoast" key={expToast.id}>
          <span aria-hidden="true">⚡</span>
          <span>+{expToast.amount} EXP</span>
        </div>
      )}

      {/* seasonal / limited-time event banner — see the activeEvent poll above */}
      {activeEvent && (
        <div className="eventbanner">
          <span className="eventbanner-ic" aria-hidden="true">🎉</span>
          <span className="eventbanner-tx">{tr({ th: activeEvent.name_th, en: activeEvent.name_en, zh: activeEvent.name_zh }, lang)}</span>
          {(activeEvent.expMult > 1 || activeEvent.coinMult > 1) && (
            <span className="eventbanner-mult">
              {activeEvent.expMult > 1 ? `${activeEvent.expMult}× EXP` : ""}
              {activeEvent.expMult > 1 && activeEvent.coinMult > 1 ? " · " : ""}
              {activeEvent.coinMult > 1 ? `${activeEvent.coinMult}× 🪙` : ""}
            </span>
          )}
        </div>
      )}

      {/* Floating mascot companion widget removed per feedback (the floating
          face read as visual clutter). mascotMood/mascot() are left in place
          since they're harmless mood-tracking with no other UI depending on
          rendering them here. */}

      {/* level-up celebration overlay */}
      {levelUp && (
        <div className="lvup" onClick={() => { clearTimeout(lvUpTimer.current); setLevelUp(null); }}>
          <div className="lvup-rays" aria-hidden="true" />
          <div className="confetti" aria-hidden="true">{Array.from({ length: 24 }).map((_, i) => <i key={i} style={{ left: (i * 4.1) + "%", animationDelay: (i % 6 * 0.08) + "s", background: ["#d97757", "#ffd23f", "#6a9bcc", "#788c5d", "#ff5252"][i % 5] }} />)}</div>
          <div className="lvup-burst" aria-hidden="true">{levelUp.prestige ? "⭐" : levelUp.tier.icon}</div>
          <div className="lvup-title">{levelUp.prestige ? lc.prestigeUpWord : lc.levelUpWord}</div>
          <div className="lvup-rank">{levelUp.prestige ? `${lc.prestigeWord} ${levelUp.prestige}` : `${lc.profLevelWord} ${levelUp.level} · ${tr(levelUp.tier, lang)}`}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="lvup-share" onClick={(e) => { e.stopPropagation(); clearTimeout(lvUpTimer.current); shareCard({ title: levelUp.prestige ? lc.prestigeUpWord : lc.levelUpWord, big: levelUp.prestige ? `⭐ ${levelUp.prestige}` : lc.profLevelWord + " " + levelUp.level, sub: levelUp.prestige ? lc.prestigeWord : tr(levelUp.tier, lang), lines: ["TiGA Piano AI"] }); }}>📤 {lc.shareBtn}</button>
            <button className="lvup-share" style={{ background: "#06c755", color: "#fff" }} onClick={(e) => { e.stopPropagation(); clearTimeout(lvUpTimer.current); shareLine(levelUp.prestige ? `🎹 ${lc.prestigeUpWord} ${lc.prestigeWord} ${levelUp.prestige} — TiGA Piano AI tigaalpha.github.io` : `🎹 ${lc.levelUpWord}! ${lc.profLevelWord} ${levelUp.level} — TiGA Piano AI tigaalpha.github.io`); }}>🟢 LINE</button>
          </div>
        </div>
      )}

      {/* achievement-unlock celebration overlay */}
      {badgeUp && !levelUp && (
        <div className="lvup lvup-badge" onClick={() => { clearTimeout(badgeTimer.current); setBadgeUp(null); }}>
          <div className="lvup-burst" aria-hidden="true">{badgeUp.icon}</div>
          <div className="lvup-title">{lc.badgeUnlocked}</div>
          <div className="lvup-rank">{tr(badgeUp, lang)}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="lvup-share" onClick={(e) => { e.stopPropagation(); clearTimeout(badgeTimer.current); shareCard({ title: lc.badgeUnlocked, big: badgeUp.icon, sub: tr(badgeUp, lang), lines: ["TiGA Piano AI"] }); }}>📤 {lc.shareBtn}</button>
            <button className="lvup-share" style={{ background: "#06c755", color: "#fff" }} onClick={(e) => { e.stopPropagation(); clearTimeout(badgeTimer.current); shareLine(`🎹 ${lc.badgeUnlocked} ${badgeUp.icon} "${tr(badgeUp, lang)}" — TiGA Piano AI tigaalpha.github.io`); }}>🟢 LINE</button>
          </div>
        </div>
      )}

      {/* C1: Friend Challenge banner — shown when app launched with ?challenge= URL param */}
      {challengeData && !songOpen && (
        <div className="lvup lvup-badge" onClick={() => setChallengeData(null)}>
          <div className="lvup-burst" aria-hidden="true">🏆</div>
          <div className="lvup-title">{lang === "th" ? "ถูกท้า!" : lang === "zh" ? "挑战来了!" : "You're Challenged!"}</div>
          <div className="lvup-rank" style={{ fontSize: 13, margin: "4px 0" }}>
            {challengeData.name} · {lang === "th" ? "ทำได้" : lang === "zh" ? "得了" : "scored"} {challengeData.score}%
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{tr(challengeData.song, lang)}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="lvup-share" style={{ background: "var(--accent)", color: "#fff" }}
              onClick={(e) => { e.stopPropagation(); setChallengeData(null); setSongMeta(challengeData.song); songDataRef.current = expandSong(challengeData.song); setSongPhase("ready"); setSongResult(null); setSongOpen(true); }}>
              🎹 {lang === "th" ? "รับคำท้า!" : lang === "zh" ? "接受挑战!" : "Accept!"}
            </button>
            <button className="lvup-share" onClick={(e) => { e.stopPropagation(); setChallengeData(null); }}>✕</button>
          </div>
        </div>
      )}
      {showApkBanner && (() => {
        const APK_BANNER_COPY = {
          th: { title: "โหลดแอพ Android ตัวเต็ม", sub: "รวมโหมดเสียง AI Voice Tutor — เว็บทำไม่ได้", btn: "ดาวน์โหลด" },
          en: { title: "Get the full Android app", sub: "Includes the AI Voice Tutor — not available on the web", btn: "Download" },
          zh: { title: "获取完整版 Android 应用", sub: "包含 AI 语音导师 — 网页版没有", btn: "下载" },
        };
        const c = APK_BANNER_COPY[lang] || APK_BANNER_COPY.en;
        return (
          <div className="installbanner">
            <span className="installbanner-ic" aria-hidden="true">🎙️</span>
            <div className="installbanner-tx">
              <b>{c.title}</b>
              <span>{c.sub}</span>
            </div>
            <a className="installbanner-go" href={apkInfo && apkInfo.apkUrl} onClick={dismissApkBanner}>{c.btn}</a>
            <button className="installbanner-x" onClick={dismissApkBanner} aria-label="close">×</button>
          </div>
        );
      })()}
      {!showApkBanner && showInstallBanner && (
        <div className="installbanner">
          <span className="installbanner-ic" aria-hidden="true">📲</span>
          <div className="installbanner-tx">
            <b>{lc.installBannerTitle}</b>
            <span>{lc.installBannerSub}</span>
          </div>
          <button className="installbanner-go" onClick={installFromBanner}>{lc.setInstall}</button>
          <button className="installbanner-x" onClick={dismissInstallBanner} aria-label="close">×</button>
        </div>
      )}
      {!showApkBanner && !showInstallBanner && showPushBanner && (
        <div className="installbanner">
          <span className="installbanner-ic" aria-hidden="true">🔥</span>
          <div className="installbanner-tx">
            <b>{lc.pushBannerTitle}</b>
            <span>{lc.pushBannerSub}</span>
          </div>
          <button className="installbanner-go" onClick={enablePushFromBanner}>{lc.pushBannerBtn}</button>
          <button className="installbanner-x" onClick={dismissPushBanner} aria-label="close">×</button>
        </div>
      )}

      {/* Admin broadcast — an announcement pushed on demand, shown once per device; takes
          priority over the Auto Teaching tip if both would otherwise be eligible at once. */}
      {broadcast && page === "pathway" && (
        <div className="atpopup" onClick={dismissBroadcast}>
          <div className="atpopup-card" onClick={e => e.stopPropagation()}>
            <div className="atpopup-hd">
              <span className="atpopup-ic" aria-hidden="true">📢</span>
              <div className="atpopup-tt">{lang === "th" ? "ประกาศจาก TiGA" : lang === "zh" ? "TiGA 公告" : "Announcement"}</div>
              <button className="atpopup-x" onClick={dismissBroadcast} aria-label="close">×</button>
            </div>
            {broadcast.image_url && (
              <img src={broadcast.image_url} alt="" style={{ width: "100%", borderRadius: 12, marginBottom: 10, display: "block" }}
                onError={e => { e.target.style.display = "none"; }} />
            )}
            <div className="atpopup-weak" style={{ whiteSpace: "pre-wrap" }}>{broadcast.message}</div>
            <button className="atpopup-ok" onClick={dismissBroadcast}>{lang === "th" ? "รับทราบ" : lang === "zh" ? "知道了" : "Got it"}</button>
          </div>
        </div>
      )}

      {/* Auto Teaching — real-time coaching card (Max plan, fires on a timer while on the Pathway page) */}
      {autoTeachTip && !(broadcast && page === "pathway") && (
        <div className="atpopup" onClick={() => setAutoTeachTip(null)}>
          <div className="atpopup-card" onClick={e => e.stopPropagation()}>
            <div className="atpopup-hd">
              <span className="atpopup-ic" aria-hidden="true">🎯</span>
              <div className="atpopup-tt">{lang === "th" ? "ครู TiGA แนะนำ" : lang === "zh" ? "TiGA老师建议" : "Coach TiGA's Tip"}</div>
              <button className="atpopup-x" onClick={() => setAutoTeachTip(null)} aria-label="close">×</button>
            </div>
            <div className="atpopup-weak">{autoTeachTip.weakness}</div>
            <ol className="atpopup-steps">
              {autoTeachTip.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="songbtn ghost" style={{ flex: 1 }} onClick={() => { setAutoTeachTip(null); setPage("coach"); }}>
                {lang === "th" ? "ดูรายละเอียด" : lang === "zh" ? "查看详情" : "Details"}
              </button>
              <button className="atpopup-ok" style={{ flex: 1 }} onClick={() => { setAutoTeachTip(null); handleCoachNavigate(autoTeachTip.feature); }}>{lang === "th" ? "เข้าใจแล้ว ลองเลย" : lang === "zh" ? "知道了，试试看" : "Got it, let's try"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

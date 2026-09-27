import { useState, useRef, useEffect } from "react";
import {
  getAC, playPianoNote, playMiss, playUi, playWhoosh, playBoom, playComboTone, playClickAt,
  pcOf, stopPracticeListeners, startMidiListener, startMicListener, laneHue, roundRect,
  SONG_LEAD, SONG_DEBOUNCE_MS, SONG_ECHO_MS,
  expandSong, normalizeSeq, noteKeyFrac, _PC, playBackingChord, songTonic, pickupBeatsOf,
  songTechniqueProfile, estimateSongDifficulty,
  THEORY_REF,
} from "./music-engine";
import { teacherJudgeNote } from "./piano-guard";
import { tr } from "./i18n";
import { SONGS, SONG_TIMESIG } from "./songs-data";
import { logActivity, recordNoteMisses, logUsage } from "./shared-infra";
import { jevTask, jevScore, jevChoice, jevNoul } from "./jev";
import { recordMemory, readMemory } from "./ai-chat-context";
import { streamChatCompletion, fetchChatCompletion } from "./ai-backend";
import { hostOnlineDuel, joinOnlineDuel, leaveOnlineRoom, sendAccept, sendStart, sendScore, sendResult, sendRematch } from "./pvp-online";
import { analyzeSongRun, buildSongFallback } from "./song-analysis";
import { buildDrillPlan, nextDrillTempo, firstDrillTempo, bossRewardCoins, knowledgeDropFor, smartBackingPlan } from "./mistake-drill";
import { runTeachingLoopForPractice, tigaHub } from "./tigamodel/web.js"; // tigaHub: intent-based model access — smarter engines upgrade the result screen with no UI change
import { logPractice, scoreDynamics, logGame, canUse, bumpUsage } from "./App";
import { createGameStore } from "./play-along-store";
import { receiveWindow, judgeOffset, accuracyOf, starsFor, nextStarGoal, pressIsMash, calibrate, comboMult as comboMultOf, bossHp as bossHpOf, bossHit, POINTS, WEIGHT, MASH_WINDOW, CALIB_HITS } from "./play-along-judge";
import { recordSongResult, songStars, songBestAcc, claimDaily, readDailyState, DAILY_SONG_REWARD, beatsPerBarOf, nextSongAfter } from "./play-along-progress";

export { DAILY_SONG_REWARD };

/* The reading staff's window before a song starts (see setSongStaffNotes). */
const EMPTY_STAFF_WIN = { list: [], startBeat: 0, spanBeats: 20 };

/* Everything the overlay reads while a song is running. These live in the
   game store (play-along-store.ts), not React state, so updating them never
   re-renders PianoApp — see the store's header. */
const GAME_INIT = {
  songHud: { score: 0, combo: 0, acc: 100, progress: 0 },
  songJudge: null, songNextLit: null, songNextLit2: null, songFingerMap: {},
  songStaffNotes: EMPTY_STAFF_WIN, songBursts: [], songShake: false, songGo: false,
  songGhost: null, songBonus: null, songLoopRecap: null, songSetlistPos: null,
  songFever: false, songPops: [], songAnnounce: null, songSrc: null, songCountdown: null,
  bossHp: 0, bossFx: null, kDrop: null,
  songPause: null,      // null | { n } — n = resume countdown (0 = paused, waiting)
  drillHud: null,       // null | { idx, rung, pass, need } while a section is looping
  songHeardMic: false,  // the first note the mic heard (the intro's sound check)
};
const HOT_KEYS = Object.keys(GAME_INIT);

/* The eight-note first song: five neighbouring white keys, up and back. */
export const INTRO_SONG = {
  id: "pa_intro", intro: true, custom: true, diff: 1, bpm: 80,
  th: "ลองก่อน 8 โน้ต", en: "First 8 notes", zh: "先试 8 个音",
  // up the five fingers and home again, ending on C so the staff reads plain C major
  seq: [["C4", 1], ["D4", 1], ["E4", 1], ["F4", 1], ["G4", 1], ["E4", 1], ["D4", 1], ["C4", 2]],
};
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

/* The canvas's resolution steps down on a device that cannot keep up. The
   city, the gems and their glow are drawn at up to 2 canvas pixels per CSS
   pixel, and on a slow phone the frame goes to filling those pixels — at
   1.5× the throttled bot run went from ~31 to ~43 fps, and in motion it looks
   the same. It only steps down during a run, measured over ~1.5 s of frames,
   and back up one step after three smooth runs in a row; it is kept per
   device. A steady 30 fps (a phone's power saving) is a cap, not a struggle,
   and fewer pixels cannot help it, so that is left alone. */
const GFX_TIERS = [2, 1.5, 1.25, 1];
const GFX_WINDOW = 90;          // frames per measurement
const GFX_SLOW_MS = 20;         // a window averaging slower than this (under 50 fps) steps down
const GFX_SMOOTH_MS = 18;       // a run whose every window beats this (55+ fps) counts as smooth
/* ── use-play-along.ts ──
   Owns play-along: the falling-notes song-game itself (chooseSong through
   finishSong, the rAF game loop, mic/MIDI input grading), plus everything
   else originally grouped under the same "── play-along" section in
   App.tsx because it shares the same played-a-song lifecycle - the Style
   Transformer (D2), AI backing-chord accompaniment (D1), the friend-
   challenge invite toast (C1, URL ?challenge=...), the Song Detector (E5)
   and Family Battle (C5) state. SongPlayOverlay.tsx (Phase 2) is this
   hook's only external consumer for the falling-notes overlay itself;
   every prop it already receives keeps its exact original name.

   Song Detector and Family Battle have NO logic living here beyond state
   (+ finishSong()'s one setBattleData score-capture call) - their actual
   UI/behavior (calling startMicListener/stopPracticeListeners/
   detectSongMatch directly) lives entirely inside StudioPage, an
   already-top-level component that just receives this state as plain
   props, unchanged by this extraction.

   shareCard/shareLine/buildSongResultRecommendation are NOT imported
   here - they're top-level App.tsx functions referenced only inside
   PianoApp's own JSX (passed down as props to SongPlayOverlay, or used
   directly inside StudioPage's battle-share button), never called by any
   function this hook owns, so PianoApp keeps referencing them with zero
   change. handleCoachNavigate()/goToRecommendation() - the same broader
   navigation dispatchers noted in use-camera-coach.ts's header - stay in
   PianoApp untouched, calling chooseSong() by its same bare name (now a
   hook-returned const). studioView/setStudioView also stay in PianoApp:
   shared studio-nav coordination state used by all three studio overlays'
   routing, not owned by any single hook.

   requireLogin is a PianoApp closure threaded as a param, same convention
   as use-payment.ts. earnCoins/gainExp/bumpWeekly/setMysteryChest/
   setLuckyToast/luckyToastTimer all come from use-gamification.ts's
   return, threaded the same way earnCoins/gainExp already are elsewhere.
   logPractice/scoreDynamics are already exported from App.tsx (Phase 3.4)
   - plain new imports here, not new exports. logGame IS a new export in
   place from App.tsx: it's a top-level helper whose only call site was
   inside PianoApp's closure, but it depends on readGameLog()/
   GAME_LOG_KEY, which stay in App.tsx because they're genuinely
   multi-consumer (SongListPage's challenge/duel best-score lookups, the
   evergreen recommendation engine, ProfilePage's game-stats bars all read
   them directly) - same convention as API_MODEL/logPractice/
   scoreDynamics. ── */
/* ── crystal sprites ──
   A cut gem, six facets round a centre, turning about its vertical axis: the
   width breathes with the spin and the centre slides across, so the facets
   trade light as it goes — which is what makes it read as a solid rather than
   a flat hexagon. Each facet is shaded by how squarely it faces a key light up
   and to the left. Rendered once per (hue, letter, size, turn step) and then
   blitted; the cache is bounded because a song only has a dozen lanes. */
const CRYSTAL_CACHE = new Map();
const HALO_CACHE = new Map();
// the glow round a crystal, one small bitmap per lane colour and size
function haloSprite(hue, rr) {
  const key = `${Math.round(hue)}|${Math.round(rr)}`;
  let cv = HALO_CACHE.get(key);
  if (cv) return cv;
  if (HALO_CACHE.size > 200) HALO_CACHE.clear();
  const R = Math.max(4, Math.round(rr * 2.2)), S = R * 2;
  cv = document.createElement("canvas"); cv.width = S; cv.height = S;
  const c = cv.getContext("2d");
  const g = c.createRadialGradient(R, R, R * 0.18, R, R, R);
  g.addColorStop(0, `hsla(${hue},100%,64%,0.55)`); g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g; c.fillRect(0, 0, S, S);
  HALO_CACHE.set(key, cv);
  return cv;
}
const CRYSTAL_STEPS = 24;
function crystalSprite(hue, letter, rr, spin, missed, noteScale, dpr) {
  const step = ((Math.round(spin / (Math.PI * 2) * CRYSTAL_STEPS) % CRYSTAL_STEPS) + CRYSTAL_STEPS) % CRYSTAL_STEPS;
  const r = Math.round(rr * 2) / 2;
  const key = `${Math.round(hue)}|${letter}|${r}|${step}|${missed ? 1 : 0}|${dpr}`;
  let sp = CRYSTAL_CACHE.get(key);
  if (sp) return sp;
  if (CRYSTAL_CACHE.size > 1500) CRYSTAL_CACHE.clear();
  const a = step / CRYSTAL_STEPS * Math.PI * 2;
  const pad = 3, w = Math.ceil(r * 2 + pad * 2), h = Math.ceil(r * 2.2 + pad * 2);
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cx = w / 2, cy = h / 2;
  const sw = 0.72 + 0.28 * Math.abs(Math.cos(a));
  const ox = Math.sin(a) * r * 0.28;
  const V = [[0, -1.1], [0.92, -0.38], [0.92, 0.42], [0, 1.1], [-0.92, 0.42], [-0.92, -0.38]];
  const vx = (k) => cx + V[k][0] * r * sw, vy = (k) => cy + V[k][1] * r;
  const ccx = cx + ox, ccy = cy - r * 0.08;
  for (let k = 0; k < 6; k++) {
    const k2 = (k + 1) % 6;
    const nxm = (V[k][0] + V[k2][0]) / 2 + ox / r * 0.6, nym = (V[k][1] + V[k2][1]) / 2;
    const lit = Math.max(0, (-nxm * 0.62 - nym * 0.78) / Math.hypot(nxm || 0.001, nym || 0.001));
    c.fillStyle = missed
      ? `rgba(${Math.round(70 + lit * 60)},${Math.round(74 + lit * 60)},${Math.round(88 + lit * 60)},0.5)`
      : `hsl(${hue},${Math.round(80 + lit * 15)}%,${Math.round(24 + lit * 50)}%)`;
    c.beginPath(); c.moveTo(ccx, ccy); c.lineTo(vx(k), vy(k)); c.lineTo(vx(k2), vy(k2)); c.closePath(); c.fill();
  }
  c.strokeStyle = missed ? "rgba(170,176,190,0.4)" : `hsla(${hue},100%,86%,0.9)`; c.lineWidth = 1;
  c.beginPath();
  for (let k = 0; k < 6; k++) { c.moveTo(ccx, ccy); c.lineTo(vx(k), vy(k)); }
  c.stroke();
  c.strokeStyle = missed ? "rgba(170,176,190,0.5)" : "rgba(255,255,255,0.92)"; c.lineWidth = 1.3;
  c.beginPath(); c.moveTo(vx(0), vy(0)); for (let k = 1; k < 6; k++) c.lineTo(vx(k), vy(k)); c.closePath(); c.stroke();
  if (!missed) {
    c.fillStyle = "rgba(255,255,255,0.9)";
    c.beginPath(); c.arc(cx - r * 0.34 * sw, cy - r * 0.46, Math.max(1.2, r * 0.11), 0, Math.PI * 2); c.fill();
    // the letter shrinks with the crystal, or it would overflow a half-size
    // one in landscape; a dark halo keeps it legible on any facet
    const fs = Math.max(8, Math.round(13 * noteScale));
    c.font = `500 ${fs}px Prompt, sans-serif`; c.textAlign = "center";
    c.lineWidth = 3; c.lineJoin = "round"; c.strokeStyle = `hsla(${hue},80%,14%,0.85)`;
    c.strokeText(letter, cx, cy + fs * 0.34);
    c.fillStyle = "rgba(255,255,255,0.98)";
    c.fillText(letter, cx, cy + fs * 0.34);
  }
  sp = { cv, w, h, ox: cx, oy: cy };
  CRYSTAL_CACHE.set(key, sp);
  return sp;
}

export function usePlayAlong({ lang, isGuest, requireLogin, earnCoins, gainExp, bumpWeekly, setMysteryChest, setLuckyToast, luckyToastTimer, premium, onUpsell, profile = null, level = 1, plan = "" }) {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    // ?pvp=CODE — an online-duel invite: prefill the room code and open the PvP panel
    // so joining is one tap away on the song's ready screen (plan #10).
    const rawPvp = p.get("pvp");
    if (rawPvp) {
      const url2 = new URL(window.location.href); url2.searchParams.delete("pvp");
      window.history.replaceState({}, "", url2.pathname + (url2.search || ""));
      const pvpCode = String(rawPvp).trim().toUpperCase();
      if (/^[A-Z0-9]{6}$/.test(pvpCode)) { setCodeInput(pvpCode); openPvpOnline(); }
    }
    const raw = p.get("challenge");
    if (!raw) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("challenge");
    window.history.replaceState({}, "", url.pathname + (url.search || ""));
    const parts = raw.split(":");
    if (parts.length < 2) return;
    const [cSongId, cScore, ...rest] = parts;
    const cName = rest.join(":") || "Friend";
    const cSong = SONGS.find(s => s.id === cSongId);
    if (cSong) setChallengeData({ song: cSong, score: Number(cScore) || 0, name: decodeURIComponent(cName) });
  }, []);

  // ── play-along (falling-notes song mode) ──
  const [songOpen, setSongOpen] = useState(false);
  const [songMeta, setSongMeta] = useState(null);          // the SONGS entry being played
  const songMetaRef = useRef(null);                        // the same, for timers and chained runs (a concert's next song)
  songMetaRef.current = songMeta;
  const [songPhase, setSongPhase] = useState("ready");     // ready | playing | done
  const [songTempo, setSongTempo] = useState(1);
  const [songResult, setSongResult] = useState(null);
  const [songAnalysis, setSongAnalysis] = useState(null);   // {weakness, steps} — per-song mistake breakdown, this page only
  const [songAnalysisBusy, setSongAnalysisBusy] = useState(false);
  /* The game store: every value the overlay reads while a song runs. The
     setters below keep their old names, so the game code reads the same. */
  const gameStoreRef = useRef(null);
  if (!gameStoreRef.current) gameStoreRef.current = createGameStore(GAME_INIT);
  const gameStore = gameStoreRef.current;
  const setSongHud = gameStore.setter("songHud");
  const setSongJudge = gameStore.setter("songJudge");
  const setSongNextLit = gameStore.setter("songNextLit");
  const setSongNextLit2 = gameStore.setter("songNextLit2");
  const setSongFingerMap = gameStore.setter("songFingerMap");
  const setSongStaffNotes = gameStore.setter("songStaffNotes");
  const setSongBursts = gameStore.setter("songBursts");
  const setSongShake = gameStore.setter("songShake");
  const setSongGo = gameStore.setter("songGo");
  const setSongGhost = gameStore.setter("songGhost");
  const setSongBonus = gameStore.setter("songBonus");
  const setSongLoopRecap = gameStore.setter("songLoopRecap");
  const setSongSetlistPos = gameStore.setter("songSetlistPos");
  const setSongFever = gameStore.setter("songFever");
  const setSongPops = gameStore.setter("songPops");
  const setSongAnnounce = gameStore.setter("songAnnounce");
  const setSongSrc = gameStore.setter("songSrc");
  const setSongCountdown = gameStore.setter("songCountdown");
  const setBossHp = gameStore.setter("bossHp");
  const setBossFx = gameStore.setter("bossFx");
  const setKDrop = gameStore.setter("kDrop");
  const setSongPause = gameStore.setter("songPause");
  const setDrillHud = gameStore.setter("drillHud");
  const setSongHeardMic = gameStore.setter("songHeardMic");
  // D2: Style Transformer
  const [stylePickOpen, setStylePickOpen] = useState(false);
  const [styleLoading, setStyleLoading] = useState(false);
  // C1: Friend Challenge — detected from URL param ?challenge=songId:score:playerName
  const [challengeData, setChallengeData] = useState<any>(null);
  // D1: AI Accompaniment — backing chord loop during song play
  const [backingOn, setBackingOn] = useState(false);
  const backingTimerRef = useRef<any>(null);
  /* ── Practising the section you missed ──
     After a run, the missed notes are bucketed into loopable sections
     (buildDrillPlan). Picking one plays JUST that section, after a one-bar
     count-in, over and over: 90% accuracy moves it up the tempo ladder
     (75 → 85 → 100%), and passing at full tempo clears it. It is practice,
     not a run of the song — nothing outside the section is graded or
     recorded as a weak spot, and it never produces a song result. */
  const [drillPlan, setDrillPlan] = useState(null);      // null | [{idx,start,end,misses,notes}]
  const [drillActive, setDrillActive] = useState(false); // true while a section is looping
  const [drillCleared, setDrillCleared] = useState([]);  // section idx cleared at full tempo, this result screen
  const drillRef = useRef(null);                         // { seg, start, end, rung, savedTempo, passes }
  // Boss — every hit chips HP (more for Perfect, more on each 10× combo),
  // a dropped note makes it strike back. The bar reads the store directly.
  const [bossOn, setBossOn] = useState(false);
  const [bossMax, setBossMax] = useState(0);             // HP ceiling for the bar
  const bossOnRef = useRef(false);
  const bossHpRef = useRef(0);
  const bossMaxRef = useRef(1);
  const bossFxT = useRef(null);
  const bossFxSeqRef = useRef(0);
  const staffBaseRef = useRef(null);   // the staff's layout beat (see hudTick)
  const staffSigRef = useRef("");      // what the staff last drew
  // #4 Knowledge Drops — perfect hits sometimes drop a one-line fact about
  // the pitch just played; facts collect into a per-device shelf.
  const [kShelfOpen, setKShelfOpen] = useState(false);
  const [kShelf, setKShelf] = useState([]);              // [{pc, note, text, at}]
  const kDropT = useRef(null);
  const kDroppedRef = useRef({});                        // one drop per pitch-class per run
  const LANG_KEY = (l) => l === "th" ? "th" : l === "zh" ? "zh" : "en";
  // E5: Song Detector — "What song am I playing?"
  const [detectOpen, setDetectOpen] = useState(false);
  const [detectNotes, setDetectNotes] = useState<string[]>([]);
  const [detectMatch, setDetectMatch] = useState<any>(null);
  const [detectListening, setDetectListening] = useState(false);
  const detectStopRef = useRef<any>(null);
  // C5: Family Battle — same device turn-based competition
  const [battleData, setBattleData] = useState<any>(null); // null | {song, scores:[{score,acc,stars},...], phase:'p1'|'p2'|'done'}
  const [battlePickOpen, setBattlePickOpen] = useState(false);
  const [songBest, setSongBest] = useState(0);
  const songJudgeTimerRef = useRef(null);
  const songShakeT = useRef(null);
  const songGoT = useRef(null);
  const songPerfectsRef = useRef(0);
  const songDebounceRef = useRef({});                 // per-pitch-class onset debounce — one press = one note
  const songEchoRef = useRef({});                     // per-pitch-class time the app last made a sound (mic echo guard)
  const songSamplesRef = useRef([]);
  const songGhostDataRef = useRef(null);
  const [songTigaTip, setSongTigaTip] = useState(null); // TIGA hub coach line for the finished song ({tip,stars,acc,via} | null) — cleared on every startSongPlay
  // Setlist / Concert mode — chain N songs into one continuous run. The queue
  // itself lives in a ref; the store's songSetlistPos drives the "Song 2/4"
  // badge during play.
  const songSetlistRef = useRef(null);
  const songSetlistIdxRef = useRef(0);
  const songSetlistLogRef = useRef([]);
  const songBonusT = useRef(null);
  const songFeverRef = useRef(false);
  const songAnnounceT = useRef(null);
  // Hand mode for Play Along: "right" (melody), "left" (bass), "both" (melody+bass)
  const [playAlongHand, setPlayAlongHand] = useState("right");
  const playAlongHandRef = useRef(playAlongHand);
  useEffect(() => { playAlongHandRef.current = playAlongHand; }, [playAlongHand]);
  const [songAutoLoop, setSongAutoLoop] = useState(false);
  const songAutoLoopRef = useRef(false);
  const songLoopRetryT = useRef(null);
  /* Kind mode: a wider window, and a single wrong key only breaks the combo
     instead of costing accuracy (mashing still costs). The profile has no
     age, so it starts on for players at level 1–2 until they choose. */
  const [songKind, setSongKindState] = useState(() => { const v = lsGet("tg_pa_kind", null); return v == null ? (level || 1) <= 2 : v === "1"; });
  const songKindRef = useRef(songKind);
  songKindRef.current = songKind;
  function setSongKind(v) { setSongKindState(v); lsSet("tg_pa_kind", v ? "1" : "0"); }
  /* The song's own click: scheduled on the audio clock against the song's
     beat grid (bar lines and pickups included), on by default. */
  const [songMetro, setSongMetroState] = useState(() => lsGet("tg_pa_metro", "1") === "1");
  const songMetroRef = useRef(songMetro);
  songMetroRef.current = songMetro;
  function setSongMetro(v) { const nv = typeof v === "function" ? v(songMetroRef.current) : v; songMetroRef.current = nv; setSongMetroState(nv); lsSet("tg_pa_metro", nv ? "1" : "0"); }
  // The first-song intro: offered once per device, before the first real song.
  const [songIntro, setSongIntro] = useState(null);      // null | { next: meta } while the intro is offered or playing
  const introNextRef = useRef(null);

  // play-along runtime refs (driven by rAF; kept off React state for 60fps)
  const songCanvasRef = useRef(null);
  const songDataRef = useRef(null);
  const songNotesRef = useRef([]);
  const songLanesRef = useRef([]);
  const songTotalRef = useRef(0);
  const songLastTimeRef = useRef(0);
  const songStartClockRef = useRef(0);
  const drillPlanRef = useRef(null);       // #1 mirrors drillPlan state for HUD-timer closures
  const songPopsRef = useRef(0);           // #4 cheap eligibility guard
  const songTempoRef = useRef(1);
  const songRunRef = useRef(false);
  const songRafRef = useRef(0);
  const songHudTimerRef = useRef(null);
  const songScoreRef = useRef(0);
  const songComboRef = useRef(0);
  const songMaxComboRef = useRef(0);
  const songHitsRef = useRef(0);
  const songMissRef = useRef(0);
  // The grades of this run (or this drill pass) and the presses that cost.
  const songGradesRef = useRef({ perfect: 0, great: 0, good: 0, wrong: 0, mash: 0 });
  const pressTimesRef = useRef([]);        // real seconds of recent presses, for the mash rule
  // Learned input delay per input kind; seeded from this device's last runs.
  const calibRef = useRef({ tap: +lsGet("tg_pa_cal_tap", 0) || 0, mic: +lsGet("tg_pa_cal_mic", 0) || 0, midi: +lsGet("tg_pa_cal_midi", 0) || 0 });
  const calibSamplesRef = useRef({ tap: [], mic: [], midi: [] });
  const pausedRef = useRef(null);          // null | { at: songTime } while paused
  const resumeTRef = useRef(null);
  const metroBeatRef = useRef(null);       // next beat index the click scheduler will place
  const runMetaRef = useRef(null);         // { id, startedAt, ctx, via } for the usage rows
  const lastEndRef = useRef(null);         // { id, at } — "played again within a minute"
  const againViaRef = useRef(null);        // which button started the next run
  const frameStatRef = useRef({ n: 0, t0: 0, last: 0, long: 0, active: 0 });
  const gfxRef = useRef(null);
  if (!gfxRef.current) {
    const t = Math.round(+lsGet("tg_pa_gfx", 0));
    gfxRef.current = { tier: t >= 0 && t < GFX_TIERS.length ? t : 0, smooth: +lsGet("tg_pa_gfx_ok", 0) || 0, win: [], windows: 0, slow: false };
  }
  const songTimingRef = useRef({ ok: 0, miss: 0 }); // Rhythm skill: perfect vs good hits, separate from note-pitch ok/miss
  const songVelsRef = useRef([]); // MIDI velocities of hit notes — see scoreDynamics()
  const songLaneFlashRef = useRef({});
  const songStarsRef = useRef([]);     // parallax starfield, generated once per song
  const songRocketsRef = useRef([]);   // in-flight "rocket launch" anims (a hit → rocket climbs to the meteor)
  const songBlastsRef = useRef([]);    // impact explosions (particle bursts, purely time-derived — no per-frame physics state)
  const songNebulaRef = useRef(null);  // pre-rendered deep-space nebula backdrop (rebuilt only on resize — cheap to draw each frame)
  const songCountdownRef = useRef(null);
  const songFinishedRef = useRef(false);
  const songPreviewRef = useRef([]);
  const songLoopRef = useRef(() => {});
  const songInputRef = useRef(() => {});
  const songFinishRef = useRef(() => {});

  /* ════ ONLINE PvP (plan #10) — realtime duel rooms ════
     Supabase Realtime broadcast channels (pvp-online.ts): host creates a
     6-char room, guest joins by code, both play the same song, host fires a
     synchronized start (startAt = wall clock + ~4s), live scores stream both
     ways, final results decide the winner. Trust model deliberately matches
     the existing ?challenge= links (self-reported) — friendly duel, not a
     ranked ladder. */
  const [pvpOnline, setPvpOnline] = useState(null); // null | {phase:"idle"|"hosting"|"joining"|"waiting"|"racing"|"waiting-result"|"done", code, role, guestName, hostName, songId, startAt, opp, oppResult, myResult, err, accepted, peerSeen}
  const [codeInput, setCodeInput] = useState("");
  const pvpScoreTickRef = useRef(null);
  const pvpRacingRef = useRef(false);   // a live duel is running: no pause (the other player keeps going)
  const clearPvpScoreTick = () => { clearInterval(pvpScoreTickRef.current); pvpScoreTickRef.current = null; };
  useEffect(() => () => { clearPvpScoreTick(); leaveOnlineRoom(); }, []);
  function openPvpOnline() {
    if (pvpOnline && (pvpOnline.phase === "hosting" || pvpOnline.phase === "waiting")) return;
    setPvpOnline({ phase: "idle", code: null, role: null, guestName: null, hostName: null, songId: null, startAt: null, opp: null, oppResult: null, myResult: null, err: null, accepted: false, peerSeen: false });
  }
  function closePvpOnline() { clearPvpScoreTick(); leaveOnlineRoom(); pvpRacingRef.current = false; setPvpOnline(null); }
  async function hostPvpOnline() {
    const name = (profile && (profile.full_name || profile.email)) || "Host";
    setPvpOnline({ phase: "hosting", code: null, role: "host", guestName: null, hostName: name, songId: songMeta ? songMeta.id : null, startAt: null, opp: null, oppResult: null, myResult: null, err: null, accepted: false, peerSeen: false });
    try {
      await hostOnlineDuel(name, {
        onReady: ({ code }) => setPvpOnline(p => p && { ...p, phase: "waiting", code }),
        onPresence: ({ count }) => setPvpOnline(p => p && p.phase === "waiting" ? { ...p, peerSeen: count > 1 } : p),
        onJoinRequest: ({ name: gn }) => setPvpOnline(p => p && { ...p, guestName: gn || "Challenger" }),
        onLeave: () => setPvpOnline(p => p && ["idle", "hosting", "joining", "waiting"].includes(p.phase) ? { ...p, guestName: null, peerSeen: false } : p),
      });
    } catch (e) { setPvpOnline(p => p && { ...p, err: String(e && e.message || e) }); }
  }
  async function joinPvpOnline(code) {
    const name = (profile && (profile.full_name || profile.email)) || "Challenger";
    setPvpOnline({ phase: "joining", code, role: "guest", guestName: name, hostName: null, songId: null, startAt: null, opp: null, oppResult: null, myResult: null, err: null, accepted: false, peerSeen: false });
    try {
      await joinOnlineDuel(code, name, {
        onReady: () => setPvpOnline(p => p && { ...p, phase: "waiting" }),
        onAccept: ({ ok, name: hn }) => setPvpOnline(p => p && (ok ? { ...p, hostName: hn || "Host", accepted: true } : { ...p, err: "declined" })),
        onStart: ({ songId, startAt }) => beginPvpRace({ songId, startAt }),
        onScore: (o) => setPvpOnline(p => p && { ...p, opp: o }),
        onResult: (r) => setPvpOnline(p => p && { ...p, oppResult: r }),
        onRematch: () => setPvpOnline(p => p && { ...p, phase: "waiting", opp: null, oppResult: null, myResult: null, startAt: null }),
        onLeave: () => setPvpOnline(p => p && (p.phase === "racing" || p.phase === "waiting-result") ? { ...p, err: "opponent-left" } : p),
      });
    } catch (e) { setPvpOnline(p => p && { ...p, err: String(e && e.message || e) }); }
  }
  function acceptPvpOnline(ok) {
    if (ok) { setPvpOnline(p => p && ({ ...p, phase: "waiting", accepted: true })); sendAccept(true, (profile && (profile.full_name || profile.email)) || "Host"); }
    else { sendAccept(false); closePvpOnline(); }
  }
  function startPvpTogether() {
    const p = pvpOnline;
    if (!p || !songMeta) return;
    const startAt = Date.now() + 4000;
    sendStart(songMeta.id, startAt);
    beginPvpRace({ songId: songMeta.id, startAt });
  }
  function beginPvpRace({ songId, startAt }) {
    clearPvpScoreTick();
    // the host's chosen song becomes THIS client's song too (both clients
    // already have every built-in song locally — nothing to download)
    const target = (SONGS.find(x => x.id === songId)) || songMeta;
    if (!target) { setPvpOnline(p => p && { ...p, err: "song-not-found" }); return; }
    setPvpOnline(p => p && ({ ...p, phase: "racing", songId, startAt, opp: null, oppResult: null, myResult: null }));
    chooseSong(target, { noIntro: true });
    pvpRacingRef.current = true;
    const wait = Math.max(0, startAt - Date.now());
    setTimeout(() => startSongPlay(), wait);
    pvpScoreTickRef.current = setInterval(() => {
      const done = songHitsRef.current + songMissRef.current;
      sendScore(songScoreRef.current, songComboRef.current, done > 0 ? Math.round(songHitsRef.current / done * 100) : 100);
    }, 1000);
  }
  function reportPvpResult(res) {
    pvpRacingRef.current = false;
    if (!pvpOnline || pvpOnline.phase === "done") return;
    setPvpOnline(p => p && ({ ...p, phase: "waiting-result", myResult: { score: res.score, acc: res.acc, stars: res.stars } }));
    sendResult(res.score, res.acc, res.stars);
    clearPvpScoreTick();
  }
  function rematchPvpOnline() { sendRematch(); setPvpOnline(p => p && ({ ...p, phase: "waiting", opp: null, oppResult: null, myResult: null, startAt: null })); }

  // ════ PLAY-ALONG (falling-notes) controls ════
  const songTempoStateRef = useRef(1);   // the tempo buttons' value, for timers and chained runs
  songTempoStateRef.current = songTempo;
  const songResultRef = useRef(null);
  songResultRef.current = songResult;
  const listenersOnRef = useRef(false);
  const lastSrcRef = useRef("tap");      // the input kind of the latest press, for the late edge of the window
  const pickupRef = useRef(0);           // beats before the first bar line (the click scheduler's accents)
  function clearSongPreview() {
    songPreviewRef.current.forEach(id => clearTimeout(id));
    songPreviewRef.current = [];
  }
  const songIdOf = (m) => m ? (m.id || m.en || tr(m, "en") || "x") : "x";
  function chooseSong(meta, opts = null) {
    clearSongPreview();
    songDataRef.current = expandSong(meta, playAlongHand);
    songMetaRef.current = meta;
    setSongMeta(meta);
    setSongResult(null); setSongTigaTip(null);
    setSongAnalysis(null);
    setDrillPlan(null); drillPlanRef.current = null; setDrillCleared([]);
    setSongPhase("ready");
    setSongSrc(null);
    setSongCountdown(null);
    setSongPause(null);
    setSongOpen(true);
    // the first-song intro is offered once per device, before a real song
    if (!(opts && opts.noIntro) && !meta.intro && lsGet("tg_pa_intro", "") !== "1") setSongIntro({ next: meta, playing: false });
    getAC(); // unlock audio within the tap gesture
  }
  function startIntro() {
    const next = (songIntro && songIntro.next) || songMetaRef.current;
    introNextRef.current = next;
    songDataRef.current = expandSong(INTRO_SONG, "right");
    songMetaRef.current = INTRO_SONG;
    setSongMeta(INTRO_SONG);
    setSongIntro({ next, playing: true });
    startSongPlay();
  }
  function skipIntro() { lsSet("tg_pa_intro", "1"); setSongIntro(null); }
  function finishIntro() {
    lsSet("tg_pa_intro", "1");
    const next = introNextRef.current;
    introNextRef.current = null;
    setSongIntro(null);
    if (next) {
      chooseSong(next, { noIntro: true });
      announce(lang === "th" ? "เก่งมาก! ต่อด้วยเพลงจริงเลย" : lang === "zh" ? "太棒了！来弹真的歌吧" : "Nice! Now the real song");
    } else exitSong();
  }
  // Setlist / Concert mode — queue up 2-5 songs and land on the first one's
  // normal "ready" screen (the learner still taps Start themselves, same as
  // any other song); finishSong() takes over chaining into the rest once
  // playing actually begins.
  function startSetlist(songs) {
    if (!songs || songs.length < 2) return;
    songSetlistRef.current = songs;
    songSetlistIdxRef.current = 0;
    songSetlistLogRef.current = [];
    setSongSetlistPos({ idx: 0, total: songs.length });
    chooseSong(songs[0]);
  }
  function previewSong() {
    const data = songDataRef.current;
    if (!data) return;
    getAC();
    clearSongPreview();
    const tempo = songTempo || 1;
    for (const n of data.notes) {
      const id = setTimeout(() => playPianoNote(n.note, Math.min(0.6, n.durSec)), (n.t / tempo) * 1000);
      songPreviewRef.current.push(id);
    }
  }
  const songKey = () => "tg_best_" + songIdOf(songMetaRef.current);
  function loadBest() { try { return +(localStorage.getItem(songKey()) || 0); } catch (e) { return 0; } }

  /* ── usage rows (usage_events, kind "pa") ──
     One row per event, the fields joined by ":" in item_id the way the rest
     of the app logs (e.g. "spot:start"); play time rides duration_ms. No
     table change is needed. A practice section and the intro are not runs. */
  function logPa(item, ms = null) { try { logUsage("pa", item, ms); } catch (e) {} }
  function runCtx(meta) {
    if (pvpRacingRef.current) return "duel";
    if (songSetlistRef.current) return "concert";
    const d = readDailyState();
    return d.id && meta && d.id === meta.id ? "daily" : "free";
  }
  function logRunStart() {
    const rm = runMetaRef.current;
    if (!rm || rm.intro) return;
    const le = lastEndRef.current;
    if (le && performance.now() - le.at < 60000) logPa(`again:${rm.id}:${le.id === rm.id ? "same" : "new"}:${rm.via || "other"}`);
    lastEndRef.current = null;
    const st = gameStore.get().songSrc && gameStore.get().songSrc.type;
    const src = st === "mic" || st === "midi" ? st : "tap"; // no mic/MIDI → the on-screen keys
    logPa(`start:${rm.id}:${rm.ctx}:${songKindRef.current ? "kind" : "std"}:${playAlongHandRef.current}:${Math.round((songTempoRef.current || 1) * 100)}:${src}`);
  }
  function logFps() {
    const fs = frameStatRef.current;
    if (!fs.n || !fs.t0 || !fs.last) return;
    const secs = fs.active / 1000; // time actually drawing: a pause is not slow frames
    if (secs < 3) return;
    logPa(`fps:${Math.round(fs.n / secs)}:${fs.long}:x${GFX_TIERS[gfxRef.current.tier]}`);
  }
  function logRunQuit() {
    const rm = runMetaRef.current;
    if (!rm || rm.intro || !songRunRef.current || songFinishedRef.current || drillRef.current) return;
    const total = songTotalRef.current || 1, done = songHitsRef.current + songMissRef.current;
    logPa(`quit:${rm.id}:${Math.round(done / total * 100)}`, performance.now() - rm.startedAt);
    logFps();
    gfxRunEnd();
    runMetaRef.current = null;
  }

  function resetRunCounters() {
    songHitsRef.current = 0; songMissRef.current = 0; songPerfectsRef.current = 0;
    songGradesRef.current = { perfect: 0, great: 0, good: 0, wrong: 0, mash: 0 };
    pressTimesRef.current = [];
    calibSamplesRef.current = { tap: [], mic: [], midi: [] };
    songTimingRef.current = { ok: 0, miss: 0 }; songVelsRef.current = [];
    staffBaseRef.current = null; staffSigRef.current = "";
  }
  async function ensureListeners() {
    if (listenersOnRef.current) return;
    listenersOnRef.current = true;
    stopPracticeListeners(); // release any mic/MIDI another mode left open — never stack listeners
    const onDetect = (d) => songInputRef.current(d);
    const midiOk = await startMidiListener(onDetect, () => setSongSrc({ type: "midi" }));
    if (!midiOk) await startMicListener(onDetect, () => setSongSrc({ type: "mic" }), () => setSongSrc({ type: "error" }));
  }
  function stopListeners() { stopPracticeListeners(); listenersOnRef.current = false; }
  function startLoops() {
    cancelAnimationFrame(songRafRef.current);
    songRafRef.current = requestAnimationFrame(() => songLoopRef.current());
    clearInterval(songHudTimerRef.current);
    songHudTimerRef.current = setInterval(() => hudTick(), 120);
  }
  // continueSetlist=true skips the score/combo/max-combo reset — called by
  // finishSong() when chaining into the next song of a concert, so a combo
  // built across the boundary survives instead of snapping back to 0.
  async function startSongPlay(continueSetlist = false) {
    const data = songDataRef.current;
    if (!data) return;
    const meta = songMetaRef.current;
    clearTimeout(resumeTRef.current); pausedRef.current = null; setSongPause(null);
    drillRef.current = null; setDrillHud(null); setDrillActive(false);
    setSongBest(loadBest());
    songSamplesRef.current = [];
    try { songGhostDataRef.current = JSON.parse(localStorage.getItem("tg_ghost_" + songIdOf(meta)) || "null"); } catch (e) { songGhostDataRef.current = null; }
    setSongGhost(null);
    clearSongPreview();
    for (const n of data.notes) { n.hit = false; n.missed = false; n.skip = false; }
    songNotesRef.current = data.notes;
    songLanesRef.current = data.lanes;
    songTotalRef.current = data.total;
    songLastTimeRef.current = data.lastT;
    if (!continueSetlist) { songScoreRef.current = 0; songComboRef.current = 0; songMaxComboRef.current = 0; }
    resetRunCounters();
    songFeverRef.current = false; setSongFever(false); setSongPops([]); setSongAnnounce(null);
    songLaneFlashRef.current = {}; songCountdownRef.current = null; songFinishedRef.current = false;
    // Boss: HP from the note count (play-along-judge bossHp), armed every run
    // except the intro. The bar reads the store, so it moves on every hit.
    bossOnRef.current = !(meta && meta.intro);
    bossHpRef.current = bossHpOf(songTotalRef.current || data.total || 0);
    bossMaxRef.current = Math.max(1, bossHpRef.current);
    setBossHp(bossHpRef.current); setBossFx(null);
    setBossMax(bossMaxRef.current);
    setBossOn(bossOnRef.current);
    kDroppedRef.current = {};
    songRocketsRef.current = []; songBlastsRef.current = [];
    if (!songStarsRef.current.length) songStarsRef.current = Array.from({ length: 50 }, () => ({ fx: Math.random(), fy: Math.random(), r: 0.4 + Math.random() * 1.3, tw: Math.random() * Math.PI * 2 }));
    songDebounceRef.current = {}; songEchoRef.current = {};
    songTempoRef.current = (meta && meta.intro) ? 1 : (songTempoStateRef.current || 1);
    pickupRef.current = meta ? pickupBeatsOf(meta.seq || [], beatsPerBarOf(meta)) : 0;
    setSongHud({ score: continueSetlist ? songScoreRef.current : 0, combo: continueSetlist ? songComboRef.current : 0, acc: 100, progress: 0 });
    setSongResult(null); setSongTigaTip(null);
    setSongAnalysis(null);
    setSongCountdown(null);
    setSongSrc(null);
    setSongPhase("playing");
    getAC();
    songStartClockRef.current = getAC().currentTime;
    metroBeatRef.current = null;
    frameStatRef.current = { n: 0, t0: 0, last: 0, long: 0, active: 0 };
    songRunRef.current = true;
    runMetaRef.current = { id: songIdOf(meta), startedAt: performance.now(), ctx: runCtx(meta), via: againViaRef.current, intro: !!(meta && meta.intro) };
    againViaRef.current = null;
    // D1 (upgraded, plan #8): real per-song progression — major songs get
    // I–V–vi–IV, minor songs i–VI–III–VII (smartBackingPlan reads the song's
    // own notes to pick tonic + mode) instead of the old I–IV–V–I loop.
    if (backingOn && meta) {
      const plan = smartBackingPlan(meta);
      if (plan && plan.chords.length) {
        const beatMs = (60 / (meta.bpm || 90)) * 1000;
        let ci = 0;
        const tick = () => { if (!songRunRef.current) return; playBackingChord(plan.chords[ci % plan.chords.length]); ci++; backingTimerRef.current = setTimeout(tick, beatMs * 4); };
        backingTimerRef.current = setTimeout(tick, 200);
      }
    }
    await ensureListeners();
    logRunStart();
    startLoops();
  }
  /* Straight into another run of the same song — the result screen's main
     button. The whole point of a short song is "one more go" in one tap. */
  function playAgain() {
    if (!songDataRef.current) return;
    againViaRef.current = "retry";
    songDataRef.current = expandSong(songMetaRef.current, playAlongHandRef.current);
    startSongPlay();
  }
  function nextSongFor(meta) { return nextSongAfter(meta || songMetaRef.current, level, plan); }
  function playNext() {
    const nx = nextSongFor(songMetaRef.current);
    if (!nx) return;
    againViaRef.current = "next";
    lastEndRef.current = lastEndRef.current || null;
    chooseSong(nx, { noIntro: true });
  }
  function hudTick() {
    if (pausedRef.current) return;
    const meta = songMetaRef.current;
    const total = songTotalRef.current || 1;
    const done = songHitsRef.current + songMissRef.current;
    const g = songGradesRef.current;
    const earned = g.perfect * WEIGHT.perfect + g.great * WEIGHT.great + g.good * WEIGHT.good;
    const cost = ((songKindRef.current ? 0 : g.wrong) + g.mash) * 0.5;
    setSongHud({
      score: songScoreRef.current,
      combo: songComboRef.current,
      acc: done > 0 ? Math.max(0, Math.min(100, Math.round((earned - cost) / done * 100))) : 100,
      progress: Math.round(done / total * 100),
    });
    // guide: light the next-due note on the in-game piano — both hands' next
    // note when two are simultaneously in play — and feed a sliding window
    // to the reading staff so the learner can see where they are, not just
    // what's next. In two-hand mode BOTH voices go to the staff, which
    // draws them as a real grand staff (melody in treble, accompaniment in
    // bass) rather than the single treble line it used to be limited to.
    const allNotes = songNotesRef.current;
    const nextByHand = {};
    for (const n of allNotes) {
      if (n.hit || n.missed || n.skip) continue;
      const h = n.hand === "left" ? "left" : "right";
      if (!nextByHand[h]) nextByHand[h] = n;
      if (nextByHand.right && nextByHand.left) break;
    }
    const primaryNext = nextByHand.right || nextByHand.left || null;
    const secondaryNext = (nextByHand.right && nextByHand.left) ? nextByHand.left : null;
    setSongNextLit(primaryNext ? primaryNext.note : null);
    setSongNextLit2(secondaryNext ? secondaryNext.note : null);
    const prevFm = gameStore.get().songFingerMap;
    const fm = {};
    if (primaryNext) fm[primaryNext.note] = primaryNext.finger;
    if (secondaryNext) fm[secondaryNext.note] = secondaryNext.finger;
    const fmSame = Object.keys(fm).length === Object.keys(prevFm).length && Object.keys(fm).every(k => prevFm[k] === fm[k]);
    if (!fmSame) setSongFingerMap(fm);
    // Sight-reading window, measured in BEATS rather than in note count:
    // one bar already played + four bars ahead. A fixed beat span is what
    // lets the staff space notes by their real rhythmic position (and keeps
    // both staves of a grand staff aligned on the beat) instead of spacing
    // them evenly by array index, which made every rhythm look identical.
    const beatsPerBar = beatsPerBarOf(meta);
    const spanBeats = beatsPerBar * 5;
    // "Where we are" is read off the SAME CLOCK the falling notes are drawn
    // from: a meteor is at the hit line when songTime === note.t + SONG_LEAD,
    // so the moment being played is (songTime - SONG_LEAD), in beats.
    const spb = 60 / ((meta && meta.bpm) || 90);
    const nowSec = songNow() - SONG_LEAD;
    const nowBeat = Math.max(0, nowSec / spb);
    /* The staff scrolls smoothly: it slides every frame on its own (see
       staffClock and PlayAlongStaff), so the glyphs are laid out against a
       BASE beat that moves only every half bar, and the window is drawn one
       bar wider than what shows so the slide never uncovers an empty edge.
       It used to be redrawn ten times a second at a new position — a
       stepping staff and a full SVG repaint each time. */
    const liveStart = Math.max(0, nowBeat - beatsPerBar);
    let base = staffBaseRef.current;
    if (base == null || liveStart - base > beatsPerBar / 2 || liveStart < base - 0.01) base = staffBaseRef.current = liveStart;
    const winStartBeat = base;
    const winEndBeat = winStartBeat + spanBeats + beatsPerBar;
    // the note being played right now = the one whose span contains the
    // clock, else the next one due
    const melody = allNotes.filter(n => n.hand !== "left");
    const lead = (melody.length ? melody : allNotes);
    const curNote = lead.find(n => nowBeat >= n.beat - 0.001 && nowBeat < n.beat + (n.durBeats || 1) - 0.001)
      || lead.find(n => n.beat >= nowBeat - 0.001) || null;
    // The staff draws ENGRAVED glyphs (bar-split, tied, rests filled in —
    // see buildNotation), not the raw played notes; srcIdx links a drawn
    // head back to the note being graded.
    const notation = (songDataRef.current && songDataRef.current.notation) || null;
    const stateOf = (g2, voice) => {
      if (g2.kind === "rest" || g2.srcIdx == null) return "future";
      const src = voice[g2.srcIdx];
      if (!src) return "future";
      if (src.hit || src.missed) return "past";
      return src === curNote ? "current" : "future";
    };
    const inWin = g2 => g2.beat >= winStartBeat - 0.001 && g2.beat <= winEndBeat + 0.001;
    const staffList = [];
    if (notation) {
      for (const g2 of notation.right) if (inWin(g2)) staffList.push({ ...g2, hand: "right", state: stateOf(g2, allNotes) });
      for (const g2 of notation.left) if (inWin(g2)) staffList.push({ ...g2, hand: "left", state: stateOf(g2, allNotes) });
    }
    // republish only when what is drawn changes: a glyph in or out, a state
    // (played / current) or a new base
    const sig = base.toFixed(3) + "|" + staffList.map(g2 => g2.beat + g2.hand[0] + g2.state[0]).join(",");
    if (sig !== staffSigRef.current) { staffSigRef.current = sig; setSongStaffNotes({ startBeat: winStartBeat, spanBeats, margin: beatsPerBar, list: staffList }); }
    // ghost race vs your best run
    const st = (getAC().currentTime - songStartClockRef.current) * songTempoRef.current;
    songSamplesRef.current.push({ t: +st.toFixed(2), s: songScoreRef.current });
    const gd = songGhostDataRef.current;
    if (gd && gd.length && !drillRef.current) {
      let gs = 0; for (let i = 0; i < gd.length; i++) { if (gd[i].t <= st) gs = gd[i].s; else break; }
      const diff = songScoreRef.current - gs;
      const prev = gameStore.get().songGhost;
      if (!prev || prev.diff !== diff) setSongGhost({ diff });
    }
  }
  function exitSong() {
    logRunQuit();
    songRunRef.current = false;
    cancelAnimationFrame(songRafRef.current);
    clearInterval(songHudTimerRef.current);
    clearTimeout(resumeTRef.current); pausedRef.current = null;
    clearTimeout(songLoopRetryT.current);
    clearSongPreview();
    stopListeners();
    clearTimeout(backingTimerRef.current); backingTimerRef.current = null;
    setSongOpen(false);
    setSongPhase("ready");
    setSongResult(null); setSongTigaTip(null);
    gameStore.reset(HOT_KEYS); staffBaseRef.current = null; staffSigRef.current = "";
    songFeverRef.current = false;
    setDrillPlan(null); setDrillActive(false); setDrillCleared([]); drillRef.current = null;
    drillPlanRef.current = null;
    bossOnRef.current = false; setBossOn(false); setKShelfOpen(false);
    clearTimeout(bossFxT.current); clearTimeout(kDropT.current);
    songSetlistRef.current = null; // leaving mid-concert ends the concert
    setSongIntro(null); introNextRef.current = null;
  }
  /* ── Pause ──
     The song clock is the audio clock, so pausing is: remember where the
     song was, stop drawing and grading, and on resume re-anchor the clock
     there after a 3-2-1. Switching away from the app pauses too. A live
     online duel never pauses — the other player keeps going. */
  function songNow() { return (getAC().currentTime - songStartClockRef.current) * (songTempoRef.current || 1); }
  function canPause() { return songRunRef.current && !songFinishedRef.current && !pausedRef.current && !pvpRacingRef.current; }
  function pauseSong() {
    if (!canPause()) return;
    pausedRef.current = { at: songNow() };
    cancelAnimationFrame(songRafRef.current);
    clearTimeout(resumeTRef.current);
    setSongPause({ n: 0 });
  }
  function resumeSong() {
    if (!pausedRef.current) return;
    clearTimeout(resumeTRef.current);
    let n = 3;
    setSongPause({ n });
    playClickAt(getAC().currentTime, true, 0.6);
    const tick = () => {
      n--;
      if (n > 0) { setSongPause({ n }); playClickAt(getAC().currentTime, false, 0.6); resumeTRef.current = setTimeout(tick, 700); return; }
      const p = pausedRef.current;
      if (!p) return;
      songStartClockRef.current = getAC().currentTime - p.at / (songTempoRef.current || 1);
      pausedRef.current = null;
      setSongPause(null);
      metroBeatRef.current = null;
      frameStatRef.current.last = 0;
      songRafRef.current = requestAnimationFrame(() => songLoopRef.current());
    };
    resumeTRef.current = setTimeout(tick, 700);
  }
  function restartSong() {
    clearTimeout(resumeTRef.current); pausedRef.current = null; setSongPause(null);
    if (drillRef.current) { beginDrillPass(); startLoops(); return; }
    logRunQuit();
    againViaRef.current = "restart";
    songDataRef.current = expandSong(songMetaRef.current, playAlongHandRef.current);
    startSongPlay();
  }
  useEffect(() => {
    const onVis = () => { if (document.hidden) pauseSong(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* Test hook for the Play Along bots (scripts in the session scratchpad):
     only on a device where tg_pa_testhook is "1", never otherwise. It reads
     the song clock and the notes and presses keys through the same handler
     the on-screen keyboard uses — nothing a player could reach. */
  /* Where the reading staff's window starts right now, in beats — read by
     PlayAlongStaff every frame to slide itself (null: nothing is playing, so
     it holds still; paused: it holds where the song stopped). It lives on
     the store as one stable function, so the staff reaches the song clock
     without anything new passing through the app root. */
  if (!gameStore.staffClock) gameStore.staffClock = () => {
    if (!songRunRef.current) return null;
    const meta = songMetaRef.current;
    const t = pausedRef.current ? pausedRef.current.at : songNow();
    const spb = 60 / ((meta && meta.bpm) || 90);
    return Math.max(0, Math.max(0, (t - SONG_LEAD) / spb) - beatsPerBarOf(meta));
  };
  useEffect(() => {
    let on = false; try { on = localStorage.getItem("tg_pa_testhook") === "1"; } catch (e) {}
    if (!on) return;
    (window as any).__paTest = {
      lead: SONG_LEAD,
      now: () => songRunRef.current && !pausedRef.current ? (getAC().currentTime - songStartClockRef.current) * songTempoRef.current : null,
      notes: () => (songNotesRef.current || []).map(n => ({ t: n.t, note: n.note, hit: !!n.hit, missed: !!n.missed, skip: !!n.skip, hand: n.hand })),
      tempo: () => songTempoRef.current,
      press: (note, source = "tap") => songInputRef.current({ note, freq: null, source }),
      meta: () => songMetaRef.current && songMetaRef.current.id,
      paused: () => !!pausedRef.current,
      drill: () => drillRef.current ? { rung: drillRef.current.rung, passes: drillRef.current.passes, start: drillRef.current.start, end: drillRef.current.end } : null,
      boss: () => ({ hp: bossHpRef.current, max: bossMaxRef.current, on: bossOnRef.current }),
      ghost: () => !!songGhostDataRef.current,
      calib: () => ({ ...calibRef.current }),
      gfx: () => GFX_TIERS[gfxRef.current.tier],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* ── The song's click, on the song's beat grid ──
     Beat k sits at songTime = LEAD + k·spb (beat 0 = the first note). Clicks
     are placed up to 150 ms ahead on the audio clock, so a late frame never
     makes a late click. Before the first note lands the click is the
     count-in and always plays; after it, only with the metronome on. */
  function scheduleClicks(songTime) {
    const meta = songMetaRef.current;
    if (!meta || !meta.bpm) return;
    const dr = drillRef.current;
    const spb = 60 / meta.bpm;
    const bpb = beatsPerBarOf(meta);
    const tempo = songTempoRef.current || 1;
    let k = metroBeatRef.current;
    if (k == null) k = Math.ceil((songTime - SONG_LEAD) / spb - 1e-6);
    const countInEnd = dr ? (dr.firstHit || SONG_LEAD) : SONG_LEAD;
    const endT = dr ? dr.end + SONG_LEAD : songLastTimeRef.current + SONG_LEAD;
    for (let guard = 0; guard < 16; guard++) {
      const bt = SONG_LEAD + k * spb;
      if (bt > songTime + 0.15 * tempo) break;
      if (bt >= songTime - 0.03 && bt <= endT + 0.01) {
        const countIn = bt < countInEnd - 1e-3;
        if (countIn || songMetroRef.current) {
          const accent = (((k - pickupRef.current) % bpb) + bpb) % bpb === 0;
          playClickAt(songStartClockRef.current + bt / tempo, accent, countIn ? 1 : 0.7);
        }
      }
      k++;
    }
    metroBeatRef.current = k;
  }
  /* one frame interval into the resolution control (see GFX_TIERS) */
  function gfxSample(dt) {
    const g = gfxRef.current;
    if (dt > 250) { g.win = []; return; }   // a stall (app switched away, a hiccup) says nothing about the frame rate
    g.win.push(dt);
    if (g.win.length < GFX_WINDOW) return;
    const w = g.win.sort((a, b) => a - b); g.win = [];
    g.windows++;
    // the slowest tenth is left out, so one hiccup on a fast phone never costs it pixels
    const kept = w.slice(0, Math.ceil(w.length * 0.9));
    const avg = kept.reduce((a, b) => a + b, 0) / kept.length;
    const med = w[w.length >> 1], p90 = w[Math.floor(w.length * 0.9)];
    const capped = med > 31 && med < 36 && p90 < 37;
    if (avg > GFX_SMOOTH_MS) g.slow = true;
    if (avg > GFX_SLOW_MS && !capped && g.tier < GFX_TIERS.length - 1) {
      g.tier = Math.min(GFX_TIERS.length - 1, g.tier + (avg > 28 ? 2 : 1)); // far behind (under ~35 fps): two steps at once
      g.smooth = 0; lsSet("tg_pa_gfx", String(g.tier)); lsSet("tg_pa_gfx_ok", "0");
    }
  }
  /* a finished run: three smooth ones in a row earn one step back up */
  function gfxRunEnd() {
    const g = gfxRef.current;
    if (g.windows >= 3) {
      if (g.slow) g.smooth = 0;
      else if (g.tier > 0 && ++g.smooth >= 3) { g.tier--; g.smooth = 0; lsSet("tg_pa_gfx", String(g.tier)); }
      lsSet("tg_pa_gfx_ok", String(g.smooth));
    }
    g.slow = false; g.windows = 0; g.win = [];
  }
  function songLoop() {
    if (!songRunRef.current || pausedRef.current) return;
    const cv = songCanvasRef.current;
    if (!cv) { songRafRef.current = requestAnimationFrame(() => songLoopRef.current()); return; }
    const ac = getAC();
    const songTime = (ac.currentTime - songStartClockRef.current) * songTempoRef.current;
    { // frame pacing for the "fps" usage row: frames, and frames held past 50 ms
      const fs = frameStatRef.current, tms = performance.now();
      if (fs.last) { const dt = tms - fs.last; fs.n++; if (dt > 50) fs.long++; if (dt < 1000) fs.active += dt; gfxSample(dt); } else if (!fs.t0) fs.t0 = tms;
      fs.last = tms;
    }
    scheduleClicks(songTime);
    const notes = songNotesRef.current;
    const lanes = songLanesRef.current;
    const nLane = Math.max(1, lanes.length);
    const dpr = Math.min(GFX_TIERS[gfxRef.current.tier], window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const now = performance.now();
    const tSec = now / 1000;
    const fever = songFeverRef.current;
    // Rotating the phone leaves the play area wide but SHORT, so meteors that
    // look well-spaced in portrait end up stacked on top of each other with
    // barely any gap between them. Halve them in landscape — same lane
    // positions, just smaller heads, so consecutive notes read as separate.
    const landscape = W > H;
    const noteScale = landscape ? 0.5 : 1;
    /* ── the backdrop: a neon city under a rune-wheel ──
       Play Along used to be deep space with meteors falling on Earth. The
       arena the robots fight in is a cyberpunk city at night with a summoning
       sigil in its sky, and the two modes are one game, so this is the same
       place seen from the street: a dark skyline, a perspective grid floor
       running up to it, and the rune-wheel hanging over the lanes. Every bit
       of it is static, so it is painted ONCE per canvas size into an
       offscreen and blitted each frame — the per-frame cost is one drawImage,
       exactly what the nebula it replaces cost. */
    const hitY = H - 8;
    const pxPerSec = hitY / SONG_LEAD;
    // Each lane's x-position is the actual key it maps to, so a falling note lands
    // directly above the piano key (and the lit key) the learner must press.
    // Map each lane to its real piano key position using noteKeyFrac.
    // The GamePiano component adjusts its octave range (baseOct) to match
    // the hand mode, so noteKeyFrac positions always align with visible keys.
    const hand = playAlongHandRef.current;
    const handBaseOct = hand === "left" ? 2 : 4;
    const handNW = hand === "both" ? 28 : 14;
    const laneFrac = lanes.map(ln => noteKeyFrac(ln, handBaseOct, handNW) || { cx: 0.5, w: 1 / 14 });
    const bakeKey = `${W}|${H}|${dpr}|${hand}|${noteScale}|${lanes.join(",")}`;
    let neb = songNebulaRef.current;
    if (!neb || neb.key !== bakeKey) {
      /* Baked at device resolution, so the per-frame blit is 1:1 rather than
         a 2x upscale, and the lanes, rails and hit-line are baked into it
         too: they only move when the song or the hand changes, and stroking
         them live measured at a third of the frame on a throttled phone. */
      const nc = document.createElement("canvas"); nc.width = Math.max(1, Math.round(W * dpr)); nc.height = Math.max(1, Math.round(H * dpr));
      const nx = nc.getContext("2d");
      nx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const sky = nx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#070318"); sky.addColorStop(0.55, "#0c0626"); sky.addColorStop(1, "#030110");
      nx.fillStyle = sky; nx.fillRect(0, 0, W, H);
      for (const [fx, fy, fr, col] of [[0.18, 0.2, 0.55, "rgba(255,43,214,0.13)"], [0.86, 0.16, 0.5, "rgba(40,220,255,0.12)"], [0.5, 0.72, 0.6, "rgba(140,70,255,0.1)"]]) {
        const g0 = nx.createRadialGradient(fx * W, fy * H, 0, fx * W, fy * H, fr * Math.max(W, H));
        g0.addColorStop(0, col); g0.addColorStop(1, "rgba(0,0,0,0)");
        nx.fillStyle = g0; nx.fillRect(0, 0, W, H);
      }
      nx.globalCompositeOperation = "lighter";
      // the rune-wheel: rings, a star of two triangles, clock ticks
      const sx = W * 0.5, sy = H * 0.3, R = Math.min(W * 0.42, H * 0.24);
      const halo = nx.createRadialGradient(sx, sy, R * 0.2, sx, sy, R * 1.4);
      halo.addColorStop(0, "rgba(255,60,220,0.1)"); halo.addColorStop(1, "rgba(255,60,220,0)");
      nx.fillStyle = halo; nx.beginPath(); nx.arc(sx, sy, R * 1.4, 0, 7); nx.fill();
      nx.strokeStyle = "rgba(255,70,220,0.26)"; nx.lineWidth = 1.5;
      nx.beginPath(); nx.arc(sx, sy, R, 0, 7); nx.stroke();
      nx.strokeStyle = "rgba(255,70,220,0.1)"; nx.lineWidth = 6;
      nx.beginPath(); nx.arc(sx, sy, R, 0, 7); nx.stroke();
      nx.strokeStyle = "rgba(60,230,255,0.22)"; nx.lineWidth = 1;
      nx.beginPath(); nx.arc(sx, sy, R * 0.82, 0, 7); nx.stroke();
      nx.setLineDash([2, 5, 9, 5]); nx.beginPath(); nx.arc(sx, sy, R * 0.9, 0, 7); nx.stroke(); nx.setLineDash([]);
      for (let k = 0; k < 24; k++) {
        const a = k / 24 * Math.PI * 2, r0 = R * (k % 2 ? 0.93 : 0.86);
        nx.beginPath(); nx.moveTo(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0); nx.lineTo(sx + Math.cos(a) * R * 0.98, sy + Math.sin(a) * R * 0.98); nx.stroke();
      }
      nx.strokeStyle = "rgba(255,70,220,0.18)"; nx.lineWidth = 1.2;
      for (const off of [-Math.PI / 2, Math.PI / 2]) {
        nx.beginPath();
        for (let k = 0; k < 3; k++) { const a = off + k * Math.PI * 2 / 3; const px = sx + Math.cos(a) * R * 0.8, py = sy + Math.sin(a) * R * 0.8; k ? nx.lineTo(px, py) : nx.moveTo(px, py); }
        nx.closePath(); nx.stroke();
      }
      nx.strokeStyle = "rgba(60,230,255,0.24)";
      nx.beginPath(); nx.arc(sx, sy, R * 0.3, 0, 7); nx.stroke();
      nx.globalCompositeOperation = "source-over";
      // the skyline: two planes of towers, the far one lighter behind more air
      const hz = H * 0.8;
      let seed = 7;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let L = 0; L < 2; L++) {
        let x = -10;
        while (x < W + 10) {
          const bw = 18 + rnd() * 34, bh = H * (L ? 0.1 + rnd() * 0.16 : 0.16 + rnd() * 0.26);
          nx.fillStyle = L ? "rgba(6,3,18,0.96)" : "rgba(22,12,52,0.85)";
          nx.fillRect(x, hz - bh, bw, bh + 2);
          const roof = L ? "rgba(60,230,255,0.55)" : "rgba(255,60,210,0.4)";
          nx.fillStyle = roof; nx.fillRect(x, hz - bh, bw, 1.3);
          for (let wy = hz - bh + 5; wy < hz - 3; wy += 6) for (let wx = x + 3; wx < x + bw - 3; wx += 5) {
            if (rnd() < 0.72) continue;
            nx.fillStyle = rnd() < 0.5 ? `rgba(255,90,220,${L ? 0.55 : 0.3})` : `rgba(80,230,255,${L ? 0.55 : 0.3})`;
            nx.fillRect(wx, wy, 2, 2.4);
          }
          if (L && rnd() < 0.3) { // a vertical sign down the face of a tower
            const sc = rnd() < 0.5 ? "255,60,210" : "60,230,255", sy0 = hz - bh + 6, sh = Math.min(bh - 10, 26);
            nx.globalCompositeOperation = "lighter";
            nx.fillStyle = `rgba(${sc},0.18)`; nx.fillRect(x + bw / 2 - 4, sy0 - 3, 8, sh + 6);
            nx.fillStyle = `rgba(${sc},0.85)`; nx.fillRect(x + bw / 2 - 1.2, sy0, 2.4, sh);
            nx.globalCompositeOperation = "source-over";
          }
          x += bw + (L ? 1 : 4);
        }
      }
      // street glow where the city meets the floor
      const sg = nx.createLinearGradient(0, hz - 30, 0, hz + 6);
      sg.addColorStop(0, "rgba(255,60,210,0)"); sg.addColorStop(1, "rgba(255,60,210,0.28)");
      nx.fillStyle = sg; nx.fillRect(0, hz - 30, W, 36);
      // the grid floor, in perspective, running out from under the keys
      nx.fillStyle = "#04020d"; nx.fillRect(0, hz, W, H - hz);
      nx.strokeStyle = "rgba(60,230,255,0.22)"; nx.lineWidth = 1;
      for (let k = 1; k <= 6; k++) { const q = k / 6, gy = hz + (H - hz) * q * q; nx.beginPath(); nx.moveTo(0, gy); nx.lineTo(W, gy); nx.stroke(); }
      for (let k = -8; k <= 8; k++) { nx.beginPath(); nx.moveTo(W / 2 + k * 10, hz); nx.lineTo(W / 2 + k * W / 7, H); nx.stroke(); }
      nx.fillStyle = "rgba(255,120,230,0.7)"; nx.fillRect(0, hz - 0.6, W, 1.2);
      // vignette
      const vg = nx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.45, Math.max(W, H) * 0.8);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,8,0.55)");
      nx.fillStyle = vg; nx.fillRect(0, 0, W, H);
      // the energy the crystals are falling into, pooled along the hit-line
      const earthGrad = nx.createLinearGradient(0, hitY - 34, 0, hitY + 20);
      earthGrad.addColorStop(0, "rgba(255,50,210,0)"); earthGrad.addColorStop(1, "rgba(255,50,210,0.3)");
      nx.fillStyle = earthGrad; nx.fillRect(0, hitY - 34, W, 42);
      /* lanes are light-rails now: a faint tint and a neon edge on each side
         that fades out toward the sky, all edges in ONE stroked path */
      const rail = nx.createLinearGradient(0, 0, 0, hitY);
      rail.addColorStop(0, "rgba(90,235,255,0)"); rail.addColorStop(1, "rgba(90,235,255,0.32)");
      nx.beginPath();
      for (let i = 0; i < nLane; i++) {
        const f = laneFrac[i], hue = laneHue(lanes[i]);
        const cw = f.w * W, cx = f.cx * W - cw / 2;
        nx.fillStyle = `hsla(${hue},90%,55%,0.07)`;
        nx.fillRect(cx, 0, cw, H);
        nx.moveTo(cx + 0.5, 0); nx.lineTo(cx + 0.5, hitY);
        nx.moveTo(cx + cw - 0.5, 0); nx.lineTo(cx + cw - 0.5, hitY);
      }
      nx.strokeStyle = rail; nx.lineWidth = 1; nx.stroke();
      // the hit-line: a charged bar, magenta through cyan, with a glow round it
      nx.globalCompositeOperation = "lighter";
      const hb = nx.createLinearGradient(0, 0, W, 0);
      hb.addColorStop(0, "rgba(255,60,210,0.9)"); hb.addColorStop(0.5, "rgba(80,240,255,0.95)"); hb.addColorStop(1, "rgba(255,60,210,0.9)");
      nx.fillStyle = "rgba(255,60,210,0.14)"; nx.fillRect(0, hitY - 7, W, 14);
      nx.fillStyle = hb; nx.fillRect(0, hitY - 1.4, W, 2.8);
      nx.fillStyle = "rgba(255,255,255,0.7)"; nx.fillRect(0, hitY - 0.4, W, 0.8);
      // a receptor sigil where each lane meets it
      for (let i = 0; i < nLane; i++) {
        const f = laneFrac[i], rx0 = f.cx * W, rs = Math.min(9, f.w * W * 0.28) * noteScale + 3;
        nx.strokeStyle = `hsla(${laneHue(lanes[i])},100%,70%,0.8)`; nx.lineWidth = 1.2;
        nx.beginPath(); nx.moveTo(rx0, hitY - rs); nx.lineTo(rx0 + rs, hitY); nx.lineTo(rx0, hitY + rs); nx.lineTo(rx0 - rs, hitY); nx.closePath(); nx.stroke();
      }
      nx.globalCompositeOperation = "source-over"; nx.lineWidth = 1;
      neb = songNebulaRef.current = { cv: nc, key: bakeKey };
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(neb.cv, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (fever) { ctx.fillStyle = "rgba(255,40,200,0.07)"; ctx.fillRect(0, 0, W, H); } // fever = the whole city overloads
    // data motes: drifting sparks in the two sign colours, fever = overdrive
    const drift = fever ? 0.06 : 0.012;
    for (let si = 0; si < songStarsRef.current.length; si++) {
      const s = songStarsRef.current[si];
      const tw = 0.5 + 0.5 * Math.sin(tSec * 1.4 + s.tw);
      ctx.globalAlpha = 0.2 + 0.55 * tw;
      ctx.fillStyle = si % 2 ? "#6ff4ff" : "#ff7ae6";
      ctx.fillRect(s.fx * W, ((s.fy + tSec * drift * s.r) % 1) * H, s.r * 1.4, s.r * 1.4);
    }
    ctx.globalAlpha = 1;
    // a light-trail streaks across the sky every ~7s (deterministic from time — no per-frame state)
    const winId = Math.floor(tSec / 7), winT = (tSec % 7) / 0.9;
    if (winT < 1) {
      const rnd = Math.abs(Math.sin(winId * 127.1) * 43758.5453) % 1;
      const sx = (0.15 + rnd * 0.7 + winT * 0.25) * W, sy = (0.05 + (rnd * 7 % 1) * 0.3 + winT * 0.22) * H;
      const st = ctx.createLinearGradient(sx, sy, sx - 40, sy - 28);
      st.addColorStop(0, "rgba(160,250,255,0.9)"); st.addColorStop(1, "rgba(255,60,210,0)");
      ctx.globalAlpha = Math.sin(winT * Math.PI);
      ctx.strokeStyle = st; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 40, sy - 28); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = 1;
    }
    // A note is missed once the late edge of its window has passed (the
    // window of the input the player is using, with its learned delay).
    const lateSrc = lastSrcRef.current;
    const lateEdge = receiveWindow(songKindRef.current, lateSrc) + (calibRef.current[lateSrc] || 0);
    for (const n of notes) {
      if (n.skip) continue; // outside the section being practised: not drawn, not graded
      const hitAt = n.t + SONG_LEAD;
      if (!n.hit && !n.missed && songTime > hitAt + lateEdge) {
        n.missed = true; songComboRef.current = 0; songMissRef.current++;
        if (songFeverRef.current) { songFeverRef.current = false; setSongFever(false); }
        songLaneFlashRef.current[n.lane] = { ok: false, until: now + 220 };
        playMiss(); flashJudge("miss");
        if (bossOnRef.current && bossHpRef.current > 0) bossFlash("attack"); // the boss strikes back on every dropped note
      }
      if (n.hit) continue;
      const yFrac = (songTime - n.t) / SONG_LEAD;
      if (yFrac < -0.05 || yFrac > 1.4) continue;
      const y = yFrac * hitY;
      const h = Math.max(14, n.durSec * pxPerSec);
      const f = laneFrac[n.lane] || noteKeyFrac(n.note, handBaseOct, handNW) || { cx: 0.5, w: 1 / 14 };
      const w = Math.max(10, f.w * W - 4), top = y - h, hue = laneHue(n.note);
      const mcx = f.cx * W;
      const rr = Math.max(7 * noteScale, Math.min(w / 2 - 1, 21) * noteScale); // crystal half-width (+15% cap), halved in landscape
      const hy = y - rr * 1.1;                         // the crystal's tip rides the leading (falling) edge
      const spin = tSec * 1.6 + n.t * 2.3;             // slow turn, phase unique per note
      if (!n.missed) {
        // the energy ribbon — its length IS the note's duration, drawn additively so it truly glows
        ctx.globalCompositeOperation = "lighter";
        const flick = 0.85 + 0.15 * Math.sin(now / 55 + n.t * 9);
        const tailTop = top - 6;
        const tg = ctx.createLinearGradient(mcx, hy, mcx, tailTop);
        tg.addColorStop(0, `hsla(${hue},100%,62%,${0.46 * flick})`);
        tg.addColorStop(0.5, `hsla(${(hue + 40) % 360},100%,58%,0.18)`);
        tg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.moveTo(mcx - rr * 0.7, hy);
        ctx.quadraticCurveTo(mcx - rr * 0.22, (hy + tailTop) / 2, mcx, tailTop);
        ctx.quadraticCurveTo(mcx + rr * 0.22, (hy + tailTop) / 2, mcx + rr * 0.7, hy);
        ctx.closePath(); ctx.fill();
        // the glow round the crystal
        const hs = haloSprite(hue, rr);
        ctx.globalAlpha = flick;
        ctx.drawImage(hs, mcx - rr * 2.2, hy - rr * 2.2, rr * 4.4, rr * 4.4);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      /* The crystal itself comes from a sprite cache: six shaded facets, the
         edges and the letter are a dozen path fills and a stroked glyph, and
         paying that for every note on every frame measured at a third of the
         frame rate on a throttled phone. The turn is quantised to 24 steps,
         which at this size is indistinguishable from continuous. */
      const spr = crystalSprite(hue, n.missed ? "" : pcOf(n.note), rr, spin, n.missed, noteScale, dpr);
      ctx.drawImage(spr.cv, mcx - spr.ox, hy - spr.oy, spr.w, spr.h);
    }
    // ── rockets: a hit launches one from the hit-line, climbing to blow the meteor up ──
    const liveRockets = [];
    for (const r of songRocketsRef.current) {
      const t = (now - r.t0) / r.dur;
      const rx = (laneFrac[r.lane] || { cx: 0.5 }).cx * W, rTop = hitY - 95;
      if (t >= 1) {
        songBlastsRef.current.push({
          x: rx, y: rTop, t0: now, dur: 520, hue: r.hue, big: r.big,
          parts: Array.from({ length: 16 }, (_, k) => ({ a: (k / 16) * Math.PI * 2 + (Math.random() - 0.5) * 0.5, sp: 55 + Math.random() * (r.big ? 120 : 85), sz: 2 + Math.random() * 3 })),
        });
        playBoom(r.big); // 💥 the payoff
        continue;
      }
      liveRockets.push(r);
      const ry = hitY + (rTop - hitY) * t;
      /* a plasma dart, not a cartoon rocket: a bright spindle of the lane's
         colour with a white core and a trail of light behind it */
      ctx.globalCompositeOperation = "lighter";
      const fl = 0.7 + 0.3 * Math.sin(now / 28 + r.t0);
      const trail = ctx.createLinearGradient(rx, ry, rx, ry + 46);
      trail.addColorStop(0, `hsla(${r.hue},100%,70%,${0.75 * fl})`); trail.addColorStop(1, `hsla(${r.hue},100%,60%,0)`);
      ctx.fillStyle = trail;
      ctx.beginPath(); ctx.moveTo(rx - 4, ry); ctx.lineTo(rx + 4, ry); ctx.lineTo(rx, ry + 46); ctx.closePath(); ctx.fill();
      const dg = ctx.createRadialGradient(rx, ry, 0, rx, ry, 16);
      dg.addColorStop(0, `hsla(${r.hue},100%,75%,0.8)`); dg.addColorStop(1, `hsla(${r.hue},100%,60%,0)`);
      ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(rx, ry, 16, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `hsl(${r.hue},100%,62%)`;
      ctx.beginPath(); ctx.moveTo(rx, ry - 13); ctx.lineTo(rx + 4.6, ry); ctx.lineTo(rx, ry + 8); ctx.lineTo(rx - 4.6, ry); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.moveTo(rx, ry - 9); ctx.lineTo(rx + 1.8, ry); ctx.lineTo(rx, ry + 5); ctx.lineTo(rx - 1.8, ry); ctx.closePath(); ctx.fill();
    }
    songRocketsRef.current = liveRockets;
    // ── blasts: white-hot core + expanding shockwave + gravity-pulled embers ──
    const liveBlasts = [];
    for (const b of songBlastsRef.current) {
      const t = (now - b.t0) / b.dur;
      if (t >= 1) continue;
      liveBlasts.push(b);
      const fade = 1 - t;
      ctx.globalCompositeOperation = "lighter";
      const core = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 26 * (0.5 + t));
      core.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
      core.addColorStop(0.4, `hsla(${b.hue},100%,70%,${0.6 * fade})`);
      core.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(b.x, b.y, 26 * (0.5 + t), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.75 * fade;
      ctx.strokeStyle = `hsla(${b.hue},100%,80%,1)`;
      ctx.lineWidth = 1 + 2.5 * fade;
      { // a hexagonal shockwave — the crystal's own shape, blown outward
        const rr2 = (b.big ? 95 : 66) * t + 6;
        ctx.beginPath();
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3 + Math.PI / 6 + t * 0.6; const px = b.x + Math.cos(a) * rr2, py = b.y + Math.sin(a) * rr2; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
        ctx.closePath(); ctx.stroke();
      }
      ctx.lineWidth = 1; ctx.globalAlpha = 1;
      for (let pi = 0; pi < b.parts.length; pi++) {
        const p = b.parts[pi];
        const dist = p.sp * t;
        const ex = b.x + Math.cos(p.a) * dist, ey = b.y + Math.sin(p.a) * dist + 55 * t * t; // embers arc downward
        ctx.fillStyle = pi % 2 ? `hsla(${b.hue},95%,65%,${fade})` : `hsla(332,100%,62%,${fade})`;
        ctx.beginPath(); ctx.arc(ex, ey, p.sz * fade, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    songBlastsRef.current = liveBlasts;
    for (let i = 0; i < nLane; i++) {
      const fl = songLaneFlashRef.current[i];
      if (fl && fl.until > now) {
        const a = (fl.until - now) / 220;
        const f = laneFrac[i], cw = f.w * W, cx = f.cx * W - cw / 2;
        ctx.fillStyle = fl.ok ? `rgba(70,235,255,${0.45 * a})` : `rgba(255,60,90,${0.42 * a})`;
        ctx.fillRect(cx, hitY - 42, cw, 50);
      }
    }
    // Ghost-race trail — the ▲/▼ HUD number (songGhost) only ever tells you the
    // gap right now; this draws the whole race as it develops, both curves
    // plotted across a thin strip along the very top of the canvas so you can
    // actually watch yourself pull ahead or fall behind over the run instead
    // of just reading one number. Drawn last (on top of the meteors) so a
    // falling note passing behind it never hides it.
    const ghostData = drillRef.current ? null : songGhostDataRef.current;
    if (ghostData && ghostData.length > 1) {
      const dur = Math.max(1, songLastTimeRef.current);
      const maxS = Math.max(ghostData[ghostData.length - 1].s, songScoreRef.current, 100);
      const stripY = 5, stripH = 16;
      const xOf = (t) => Math.min(W, Math.max(0, (t / dur) * W));
      const yOf = (s) => stripY + stripH - Math.min(stripH, (s / maxS) * stripH);
      ctx.save();
      ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.globalAlpha = 0.5; ctx.strokeStyle = "#c4b5fd"; ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < ghostData.length; i++) {
        const p = ghostData[i]; if (p.t > songTime + 0.5) break;
        const x = xOf(p.t), y = yOf(p.s);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      let ghostScoreNow = 0;
      for (let i = 0; i < ghostData.length; i++) { if (ghostData[i].t <= songTime) ghostScoreNow = ghostData[i].s; else break; }
      const samples = songSamplesRef.current;
      if (samples.length > 1) {
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = songScoreRef.current >= ghostScoreNow ? "#4ade80" : "#ff5252";
        ctx.lineWidth = 2.2;
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 4;
        ctx.beginPath();
        for (let i = 0; i < samples.length; i++) {
          const p = samples[i]; const x = xOf(p.t), y = yOf(p.s);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    if (drillRef.current) { /* a section loop counts itself in with clicks, no 3-2-1 */ }
    else if (songTime < SONG_LEAD) {
      const c = Math.ceil(SONG_LEAD - songTime);
      if (c !== songCountdownRef.current) { songCountdownRef.current = c; setSongCountdown(c); }
    } else if (songCountdownRef.current !== 0) { songCountdownRef.current = 0; setSongCountdown(null); flashGo(); }
    const dr = drillRef.current;
    if (dr) {
      if (!dr.waiting && songTime > dr.end + SONG_LEAD + receiveWindow(true, "mic") + 0.3) endDrillPass();
    } else if (songTime > songLastTimeRef.current + SONG_LEAD + 1.0) { songFinishRef.current(); return; }
    songRafRef.current = requestAnimationFrame(() => songLoopRef.current());
  }
  // Tuning-aware pitch-class match for play-along grading (piano-guard.ts).
  // MIDI/tap are digital — exact class, as always. A MIC note is judged by the
  // shared listening-teacher rule: right pitch class AFTER re-centering by the
  // per-piano tuning offset (learned with practice mode, persisted), ±95c
  // tolerance. This is what makes a detuned piano playable in songs, not just
  // in drills — a raw reading that lands between two pitch classes may match
  // either candidate, and the hit-window search picks the nearest one in time.
  function songPCMatches(d, targetPC) {
    if (d.freq == null) return pcOf(d.note) === targetPC;
    return teacherJudgeNote({ freq: d.freq, targetPC }).ok;
  }
  function handleSongInput(d) {
    if (!songRunRef.current || pausedRef.current) return;
    const ac = getAC();
    const songTime = (ac.currentTime - songStartClockRef.current) * songTempoRef.current;
    const inPC = pcOf(d.note);
    const tnow = performance.now();
    const src = d.source === "mic" ? "mic" : d.source === "midi" ? "midi" : "tap";
    // Echo/debounce guards key off the EXACT note (pitch + octave), not just
    // pitch class — a real physical press always lands on one exact key, and
    // this matters once a two-hand song can have the melody and the
    // accompaniment sharing a pitch class in different octaves close
    // together in time.
    //
    // Echo guard: when you TAP, the app plays that note and the mic hears it ~100ms
    // later — ignore a mic onset of the same pitch right after a tap so one tap can't
    // become 2–3 hits. (Pure real-piano play never sets this, so repeats stay fine.)
    if (src === "mic" && tnow - (songEchoRef.current[d.note] || 0) < SONG_ECHO_MS) return;
    // Debounce: one press = one note (a sustained key can re-fire the same pitch).
    if (tnow - (songDebounceRef.current[d.note] || 0) < SONG_DEBOUNCE_MS) return;
    songDebounceRef.current[d.note] = tnow;
    if (src === "tap") songEchoRef.current[d.note] = tnow; // this tap's sound will echo into the mic
    if (src === "mic" && !gameStore.get().songHeardMic) setSongHeardMic(true);
    lastSrcRef.current = src;
    const kind = songKindRef.current;
    const win = receiveWindow(kind, src);
    const tq = songTime - (calibRef.current[src] || 0); // the press, with this device's delay taken out
    // How many notes the music asks for right now (hit or not) and whether
    // any of them is still open — the mash rule and the wrong-key rule.
    let due = 0, openDue = 0;
    for (const n of songNotesRef.current) {
      if (n.skip) continue;
      if (Math.abs(tq - (n.t + SONG_LEAD)) <= win) { due++; if (!n.hit && !n.missed) openDue++; }
    }
    const nowS = tnow / 1000;
    const recent = pressTimesRef.current.filter(t => nowS - t < MASH_WINDOW);
    const before = recent.length;
    recent.push(nowS);
    pressTimesRef.current = recent;
    const now = performance.now();
    if (pressIsMash(before, due)) { wrongPress("mash", inPC, now); return; }
    // Prefer an exact note (pitch + octave) match first — same two-hand
    // reason as above — and fall back to a pitch-class match (an octave off
    // still counts; a mic reading is judged tuning-aware) inside the window.
    let best = null, bestd = 1e9;
    for (const n of songNotesRef.current) {
      if (n.hit || n.missed || n.skip || n.note !== d.note) continue;
      const dt = Math.abs(tq - (n.t + SONG_LEAD));
      if (dt < bestd) { bestd = dt; best = n; }
    }
    if (!best || bestd > win) {
      best = null; bestd = 1e9;
      for (const n of songNotesRef.current) {
        if (n.hit || n.missed || n.skip || !songPCMatches(d, pcOf(n.note))) continue;
        const dt = Math.abs(tq - (n.t + SONG_LEAD));
        if (dt < bestd) { bestd = dt; best = n; }
      }
    }
    const grade = best ? judgeOffset(bestd, kind, src) : null;
    if (best && grade) hitNote(best, grade, tq - (best.t + SONG_LEAD), songTime - (best.t + SONG_LEAD), src, d, now);
    else if (openDue > 0) wrongPress("wrong", inPC, now);
    else {
      // a stray key with nothing due: no cost, just the lane's red flicker
      const lane = songLanesRef.current.findIndex(x => pcOf(x) === inPC);
      if (lane >= 0) songLaneFlashRef.current[lane] = { ok: false, until: now + 150 };
    }
  }
  /* A graded hit. `off` is how early (−) or late (+) it was after the learned
     delay; `rawOff` is the same before it, which is what the delay is
     learned from. */
  function hitNote(best, grade, off, rawOff, src, d, now) {
    best.hit = true;
    const g = songGradesRef.current;
    g[grade]++;
    const perfect = grade === "perfect";
    const practice = !!(drillRef.current || (songMetaRef.current && songMetaRef.current.intro));
    const cs = calibSamplesRef.current[src];
    if (cs && cs.length < CALIB_HITS) {
      cs.push(rawOff);
      if (cs.length === CALIB_HITS) {
        const c = calibrate(cs);
        calibRef.current[src] = c;
        lsSet("tg_pa_cal_" + src, c.toFixed(3));
      }
    }
    songRocketsRef.current.push({ lane: best.lane, hue: laneHue(best.note), t0: now, dur: 170, big: perfect }); // launch a rocket to blow up the meteor
    playWhoosh(); // 🚀 lift-off
    songHitsRef.current++;
    songComboRef.current++;
    const combo = songComboRef.current;
    if (combo > songMaxComboRef.current) songMaxComboRef.current = combo;
    if (perfect) songPerfectsRef.current++;
    // Rhythm/Dynamics skill tracking — timing precision given the note was
    // already right (kept separate from note-accuracy's own ok/miss so the
    // same failure is never double-counted across two skills), and MIDI
    // touch consistency when a velocity is available.
    if (perfect) songTimingRef.current.ok++; else songTimingRef.current.miss++;
    if (d.vel != null) songVelsRef.current.push(d.vel);
    if (bossOnRef.current) bossDamage(bossHit(grade, combo));
    if (perfect && !practice) maybeKnowledgeDrop(best.note);
    // FEVER MODE — at a big combo the screen goes wild and score doubles.
    if (!songFeverRef.current && combo >= 15) { songFeverRef.current = true; setSongFever(true); playUi("levelup"); triggerShake(); announce("🔥 FEVER!"); }
    else if (songFeverRef.current && combo === 60) { triggerShake(); spawnBurst("combo"); spawnBurst("combo"); playUi("levelup"); announce("🔥🔥 MEGA FEVER!"); }
    const feverMult = songFeverRef.current ? 2 : 1;
    const gained = Math.round(POINTS[grade] * comboMultOf(combo) * feverMult);
    songScoreRef.current += gained;
    pushPop("+" + gained, perfect);     // flying score number
    playComboTone(combo);               // rising musical ladder
    if (perfect) spawnBurst("perfect");
    // combo-tier shout-outs
    if (combo % 10 === 0) { triggerShake(); spawnBurst("combo"); announce(comboWord(combo)); }
    if (!practice) {
      // milestone bonus XP — 25/50/100, then every 50 combo beyond that,
      // ramping up to a 500 EXP cap so a marathon run always has a next target.
      if (combo === 25 || combo === 50 || (combo >= 100 && combo % 50 === 0)) {
        const bonusXp = combo <= 100 ? (combo === 25 ? 50 : combo === 50 ? 100 : 200) : Math.round(Math.min(500, 200 + (combo - 100) * 1.5));
        gainExp(bonusXp, {});
        spawnBurst("combo"); spawnBurst("combo"); spawnBurst("combo");
        setSongBonus({ id: Date.now(), text: `🎯 x${combo} +${bonusXp} EXP!` });
        clearTimeout(songBonusT.current); songBonusT.current = setTimeout(() => setSongBonus(null), 1500);
        playUi("levelup");
      }
      // surprise variable bonus on a lucky perfect
      if (perfect && Math.random() < 0.06) {
        const bonus = 8 + Math.floor(Math.random() * 18);
        earnCoins(bonus); spawnBurst("combo"); playUi("reward");
        setSongBonus({ id: Date.now(), text: "+" + bonus + " 🪙" });
        clearTimeout(songBonusT.current); songBonusT.current = setTimeout(() => setSongBonus(null), 900);
      }
    }
    songLaneFlashRef.current[best.lane] = { ok: true, until: now + 220 };
    flashJudge(grade, perfect ? null : off < 0 ? "early" : "late");
    // Voice the hit only for a silent MIDI controller. A tap already sounded via
    // the keyboard, and mic input means the real piano already sounded — replaying
    // it would just echo back into the mic and cause phantom extra hits.
    if (src === "midi") { playPianoNote(best.note, 0.5); songEchoRef.current[pcOf(best.note)] = performance.now(); }
  }
  /* A key that is not the note (or one key too many in a burst): the combo
     breaks, and the press counts against accuracy — a single wrong key is
     forgiven in kind mode, mashing never is (see accuracyOf). */
  function wrongPress(kind, inPC, now) {
    const g = songGradesRef.current;
    g[kind]++;
    songComboRef.current = 0;
    if (songFeverRef.current) { songFeverRef.current = false; setSongFever(false); }
    const lane = songLanesRef.current.findIndex(x => pcOf(x) === inPC);
    if (lane >= 0) songLaneFlashRef.current[lane] = { ok: false, until: now + 150 };
    if (kind === "wrong" || g.mash % 4 === 1) flashJudge("wrong");
  }
  // ════ plan items 1/3/4/8 helpers ════
  // #3: one boss-fx flash at a time (hit / defeat / attack)
  function bossFlash(kind) {
    setBossFx({ id: ++bossFxSeqRef.current, kind }); // a counter: consecutive events alternate (see PaBoss)
    clearTimeout(bossFxT.current);
    bossFxT.current = setTimeout(() => setBossFx(null), 700);
  }
  /* The bar moves on every hit now. It used to be flushed to React from the
     HUD timer, whose closure had captured bossOn=false before the run began,
     so the flush never happened and the bar sat at 100% for the whole song. */
  function bossDamage(dmg) {
    if (!bossOnRef.current || bossHpRef.current <= 0) return;
    bossHpRef.current = Math.max(0, bossHpRef.current - dmg);
    setBossHp(bossHpRef.current);
    if (bossHpRef.current <= 0) { bossFlash("defeat"); playUi("levelup"); }
    else bossFlash("hit");
  }
  // #4: maybe drop a knowledge card on a PERFECT hit — max one per pitch
  // class per run, ~8% of eligible perfects, capped at 3 cards mid-game.
  function maybeKnowledgeDrop(noteName) {
    if (kDroppedRef.current[noteName]) return;
    const live = songPopsRef.current || [];
    if (Object.keys(kDroppedRef.current).length >= 3) return;
    if (Math.random() >= 0.08) return;
    const f0 = knowledgeDropFor(noteName);
    if (!f0) return;
    /* TIGA hub (P6): the theory specialist ranks the candidate fact —
       unheard ones first (this learner's shelf is the filter). No engine →
       the played note's own fact, exactly as before. */
    let f = f0;
    try {
      const shelf = JSON.parse(localStorage.getItem("tg_kdrops") || "[]");
      const ranked = tigaHub.knowledgeForNote(noteName, { candidates: { [f0.pc]: f0 }, shelf });
      if (ranked && ranked.fact) f = ranked.fact; else if (ranked === null && shelf.some(x => x.pc === f0.pc)) return; // specialist says "already learned" → keep the drop budget for fresh facts
    } catch (e) { /* hub absent → own-note fact */ }
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
    const plan = buildDrillPlan((notes || []).filter(n => !n.skip), { max: 4 });
    drillPlanRef.current = plan;
    setDrillPlan(plan);
    setDrillActive(false);
  }
  /* Loop JUST this section. It used to restart the whole song from 0:00
     with everything outside the section marked missed — a blank screen for
     as long as the section was into the song, a few notes, then more blank
     screen, then a 0-star result, and the tempo never climbed because the
     timer that should have noticed the pass had captured drillActive=false. */
  function startDrill(seg) {
    if (!seg || !songDataRef.current) return;
    const saved = songTempoStateRef.current || 1;
    const rung = firstDrillTempo(saved);
    drillRef.current = { seg, start: Math.max(0, seg.start - 0.5), end: seg.end + 0.5, rung, savedTempo: saved, passes: 0, waiting: false, firstHit: 0 };
    setDrillActive(true);
    clearSongPreview();
    clearTimeout(resumeTRef.current); pausedRef.current = null; setSongPause(null);
    songFinishedRef.current = false;
    runMetaRef.current = null; // practice, not a run of the song
    bossOnRef.current = false; setBossOn(false);
    setSongPhase("playing");
    songRunRef.current = true;
    logPa(`drill:${songIdOf(songMetaRef.current)}:${seg.idx}:start`);
    beginDrillPass();
    ensureListeners();
    startLoops();
  }
  function beginDrillPass() {
    const dr = drillRef.current, data = songDataRef.current;
    if (!dr || !data) return;
    let first = Infinity;
    for (const n of data.notes) {
      const inWin = n.t >= dr.start && n.t <= dr.end;
      n.hit = false; n.missed = false; n.skip = !inWin;
      if (inWin && n.t < first) first = n.t;
    }
    if (!isFinite(first)) first = dr.start;
    songNotesRef.current = data.notes;
    songLanesRef.current = data.lanes;
    songTotalRef.current = data.notes.filter(n => !n.skip).length;
    songLastTimeRef.current = dr.end;
    songScoreRef.current = 0; songComboRef.current = 0; songMaxComboRef.current = 0;
    resetRunCounters();
    songFeverRef.current = false; setSongFever(false); setSongPops([]);
    songLaneFlashRef.current = {}; songRocketsRef.current = []; songBlastsRef.current = [];
    songDebounceRef.current = {}; songEchoRef.current = {};
    songTempoRef.current = dr.rung;
    // one bar of count-in clicks, then the section's first note lands
    const meta = songMetaRef.current;
    const spb = 60 / ((meta && meta.bpm) || 90);
    const barSec = beatsPerBarOf(meta) * spb;
    const s0 = Math.max(0, first + SONG_LEAD - barSec);
    dr.firstHit = first + SONG_LEAD;
    dr.waiting = false;
    songStartClockRef.current = getAC().currentTime - s0 / dr.rung;
    metroBeatRef.current = null;
    pickupRef.current = meta ? pickupBeatsOf(meta.seq || [], beatsPerBarOf(meta)) : 0;
    songCountdownRef.current = 0; setSongCountdown(null);
    setSongHud({ score: 0, combo: 0, acc: 100, progress: 0 });
    setDrillHud({ idx: dr.seg.idx, rung: dr.rung, pass: dr.passes + 1, need: 90 });
  }
  function endDrillPass() {
    const dr = drillRef.current;
    if (!dr || dr.waiting) return;
    dr.waiting = true;
    const g = songGradesRef.current, total = songTotalRef.current || 1;
    const acc = accuracyOf({ ...g, total, kind: songKindRef.current });
    dr.passes++;
    const id = songIdOf(songMetaRef.current);
    const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
    if (acc >= 90) {
      gainExp(10, { reason: "pa-drill" });
      logPa(`drill:${id}:${dr.seg.idx}:${Math.round(dr.rung * 100)}`);
      if (dr.rung >= 1 - 1e-9) {
        announce(T("✅ ผ่านท่อนนี้แล้ว!", "✅ Section cleared!", "✅ 这一段过关了！"));
        setDrillCleared(c => c.includes(dr.seg.idx) ? c : [...c, dr.seg.idx]);
        setTimeout(() => { if (drillRef.current === dr) endDrill(); }, 1100);
        return;
      }
      dr.rung = nextDrillTempo(dr.rung);
      announce(T(`⏫ ผ่าน! เท็มโป ${Math.round(dr.rung * 100)}%`, `⏫ Passed! Tempo ${Math.round(dr.rung * 100)}%`, `⏫ 通过！速度 ${Math.round(dr.rung * 100)}%`));
    } else {
      announce(T(`อีกรอบ — แม่น ${acc}% ต้องได้ 90%`, `Again — ${acc}%, need 90%`, `再来 — ${acc}%，需要 90%`));
    }
    setTimeout(() => { if (drillRef.current === dr && songRunRef.current && !pausedRef.current) beginDrillPass(); }, 1100);
  }
  function endDrill() {
    const dr = drillRef.current;
    drillRef.current = null;
    setDrillActive(false); setDrillHud(null);
    songRunRef.current = false;
    cancelAnimationFrame(songRafRef.current);
    clearInterval(songHudTimerRef.current);
    clearTimeout(resumeTRef.current); pausedRef.current = null; setSongPause(null);
    stopListeners();
    if (dr) songTempoRef.current = dr.savedTempo;
    for (const n of (songNotesRef.current || [])) n.skip = false;
    setSongPhase(songResultRef.current ? "done" : "ready");
  }

  // Used to hard-cap at "UNSTOPPABLE!" forever past combo 50 — the shout-out
  // stopped growing long before a skilled player's combo actually did.
  function comboWord(c) {
    return c >= 300 ? "GODLIKE!" : c >= 200 ? "LEGENDARY!" : c >= 150 ? "PHENOMENAL!" : c >= 100 ? "UNREAL!"
      : c >= 50 ? "UNSTOPPABLE!" : c >= 40 ? "INCREDIBLE!" : c >= 30 ? "AMAZING!" : c >= 20 ? "GREAT!" : "NICE!";
  }
  function announce(text) {
    setSongAnnounce({ id: Date.now(), text });
    clearTimeout(songAnnounceT.current);
    songAnnounceT.current = setTimeout(() => setSongAnnounce(null), 1100);
  }
  function pushPop(text, perfect) {
    const id = Date.now() + Math.random();
    setSongPops(prev => [...prev.slice(-7), { id, text, perfect, x: 26 + Math.random() * 48 }]);
    setTimeout(() => setSongPops(prev => prev.filter(p => p.id !== id)), 780);
  }
  // kind: perfect | great | good | miss | wrong; el: "early" | "late" | null
  function flashJudge(kind, el = null) {
    setSongJudge({ kind, el, id: Date.now() });
    clearTimeout(songJudgeTimerRef.current);
    songJudgeTimerRef.current = setTimeout(() => setSongJudge(null), 650);
  }
  function triggerShake() { setSongShake(true); clearTimeout(songShakeT.current); songShakeT.current = setTimeout(() => setSongShake(false), 380); }
  function spawnBurst(kind) {
    const id = Date.now() + Math.random();
    setSongBursts(prev => [...prev.slice(-4), { id, kind }]);
    setTimeout(() => setSongBursts(prev => prev.filter(b => b.id !== id)), 760);
  }
  function flashGo() { setSongGo(true); clearTimeout(songGoT.current); songGoT.current = setTimeout(() => setSongGo(false), 700); }
  function finishSong() {
    if (songFinishedRef.current) return;
    songFinishedRef.current = true;
    songRunRef.current = false;
    cancelAnimationFrame(songRafRef.current);
    clearInterval(songHudTimerRef.current);
    stopListeners();
    const meta = songMetaRef.current;
    if (meta && meta.intro) { finishIntro(); return; }
    const total = songTotalRef.current || 1;
    const hits = songHitsRef.current;
    const g = songGradesRef.current;
    const kind = songKindRef.current;
    // Stars come from accuracy under the timing rules (play-along-judge):
    // Perfect 100%, Great 80%, Good 50% of a note, minus wrong keys.
    const acc = accuracyOf({ ...g, total, kind });
    const stars = starsFor(acc);
    const maxCombo = songMaxComboRef.current;
    const perfects = songPerfectsRef.current;
    const clean = g.wrong + g.mash === 0;
    const fullCombo = songMissRef.current === 0 && hits === total && total > 0 && clean;
    const allPerfect = perfects === total && total > 0 && clean;
    const reward = Math.round(40 + acc * 0.4 + Math.min(maxCombo, 20) + (allPerfect ? 50 : fullCombo ? 25 : 0));
    const prevBest = loadBest();
    const score = songScoreRef.current;
    const newBest = score > prevBest;
    const songId = songIdOf(meta);
    if (newBest) {
      try { localStorage.setItem(songKey(), String(score)); } catch (e) {} setSongBest(score);
      try { localStorage.setItem("tg_ghost_" + songId, JSON.stringify(songSamplesRef.current.slice(-240))); } catch (e) {}
    }
    const rec = recordSongResult(songId, stars, acc);
    logPractice(acc);
    recordMemory(tr(meta, lang), acc);
    logGame({ song: songId, acc, score, stars });
    logActivity("game", songId, hits, Math.max(0, total - hits),
      songDataRef.current && songDataRef.current.dur ? songDataRef.current.dur / (songTempoRef.current || 1) + SONG_LEAD : 60);
    if (songTimingRef.current.ok + songTimingRef.current.miss >= 3) {
      logActivity("game", songId, songTimingRef.current.ok, songTimingRef.current.miss, 0, "rhythm");
    }
    const dyn = scoreDynamics(songVelsRef.current);
    if (dyn) logActivity("game", songId, dyn.ok, dyn.miss, 0, "dynamics");
    // Today's song, played to at least one star, pays once (play-along-progress claimDaily).
    let dailyPaid = false;
    try {
      if (claimDaily(songId, stars)) {
        dailyPaid = true;
        earnCoins(DAILY_SONG_REWARD.coins); gainExp(DAILY_SONG_REWARD.exp);
        setSongBonus({ id: Date.now(), text: "📆 +" + DAILY_SONG_REWARD.coins + " 🪙 +" + DAILY_SONG_REWARD.exp + " EXP!" });
        clearTimeout(songBonusT.current); songBonusT.current = setTimeout(() => setSongBonus(null), 2200);
        playUi("reward");
        logPa(`daily:${songId}`);
      }
    } catch (e) { /* the quest is best-effort — never block the result screen */ }
    const coinReward = 5 + stars * 10 + (allPerfect ? 20 : fullCombo ? 10 : 0);
    earnCoins(coinReward);
    bumpWeekly("games", 1); if (perfects) bumpWeekly("perfect", perfects);
    setSongCountdown(null);
    setSongNextLit(null);
    setSongStaffNotes(EMPTY_STAFF_WIN); staffBaseRef.current = null; staffSigRef.current = "";
    const missedNotes = songNotesRef.current.filter(n => n.missed && !n.skip).map(n => n.note);
    if (missedNotes.length) recordNoteMisses(missedNotes);
    captureDrillPlan(songNotesRef.current); // the heat map behind "practise the part you missed"
    setDrillCleared([]);
    let bossWon = false;
    if (bossOnRef.current) { // defeat bounty — killed the boss, paid by stars
      bossWon = bossHpRef.current <= 0;
      if (bossWon && stars >= 1) {
        const bounty = bossRewardCoins(stars);
        if (bounty > 0) {
          earnCoins(bounty);
          setSongBonus({ id: Date.now(), text: "👾 +" + bounty + " 🪙" });
          clearTimeout(songBonusT.current); songBonusT.current = setTimeout(() => setSongBonus(null), 2000);
        }
      }
      bossOnRef.current = false; setBossOn(false);
    }
    // Setlist mode: this song's own log entry, always recorded even though the
    // combined concert score (songScoreRef.current, not reset between songs —
    // see startSongPlay's continueSetlist param) is what actually gets shown.
    if (songSetlistRef.current) songSetlistLogRef.current.push({ song: meta, acc, stars });
    const setlistDone = songSetlistRef.current && songSetlistIdxRef.current >= songSetlistRef.current.length - 1;
    const bestAcc = Math.max(acc, rec.prevAcc);
    setSongResult({
      acc, score, maxCombo, stars, exp: reward, coins: coinReward, total, hits, best: Math.max(score, prevBest), newBest, fullCombo, allPerfect, missedNotes,
      grades: { perfect: g.perfect, great: g.great, good: g.good, miss: songMissRef.current, wrong: g.wrong, mash: g.mash },
      prevStars: rec.prevStars, newStars: rec.newStars, bestAcc, goal: nextStarGoal(bestAcc), kind, dailyPaid, bossWon,
      // only present once every song in a setlist has finished — the concert's
      // combined numbers, for a dedicated recap treatment on the result screen
      setlist: setlistDone ? songSetlistLogRef.current.slice() : null,
    });
    reportPvpResult({ score, acc, stars }); // online PvP: my final result → the room (decides the winner on both sides)
    // TIGA hub: real-data coach line for this run (what engine answered shows
    // in the badge). Real MIDI velocity/timing evidence rides along; — never invents.
    try { setSongTigaTip(tigaHub.explainSongResult({ acc, stars, maxCombo, missedNotes, dyn: scoreDynamics(songVelsRef.current), timing: (songTimingRef.current.ok + songTimingRef.current.miss >= 3) ? songTimingRef.current : null, topic: 8 }, readMemory())); } catch (e) { setSongTigaTip(null); }
    gainExp(reward, { quest: true });
    // Gamification: variable reward — mystery chest (20% chance on acc >= 70%)
    if (acc >= 70 && Math.random() < 0.20) {
      const chestRewards = [[50,5,"💎"],[100,10,"🎁"],[75,8,"⭐"],[150,15,"🏆"],[30,3,"🎵"]];
      const [cxp, ccoins, cicon] = chestRewards[Math.floor(Math.random() * chestRewards.length)];
      setTimeout(() => {
        gainExp(cxp, {}); earnCoins(ccoins);
        setMysteryChest({ xp: cxp, coins: ccoins, icon: cicon });
        playUi("levelup");
      }, 2200);
    }
    // Gamification: lucky bonus XP (15% chance after any song completion)
    if (Math.random() < 0.15) {
      const bonusXp = [50, 75, 100][Math.floor(Math.random() * 3)];
      setTimeout(() => {
        gainExp(bonusXp, {});
        setLuckyToast({ xp: bonusXp });
        clearTimeout(luckyToastTimer.current);
        luckyToastTimer.current = setTimeout(() => setLuckyToast(null), 3000);
      }, 1000);
    }
    // C5: Family Battle — capture score for current player
    setBattleData((bd: any) => {
      if (!bd || bd.phase === "done") return bd;
      const newScores = [...(bd.scores || []), { acc, stars, score }];
      return { ...bd, scores: newScores, phase: bd.phase === "p1" ? "p2" : "done" };
    });
    // D1: stop backing chords when song finishes
    clearTimeout(backingTimerRef.current); backingTimerRef.current = null;
    // usage rows: the finished run, then the frame pacing it had
    const rm = runMetaRef.current;
    if (rm && !rm.intro) { logPa(`end:${songId}:${stars}:${acc}`, performance.now() - rm.startedAt); logFps(); }
    gfxRunEnd();
    runMetaRef.current = null;
    lastEndRef.current = { id: songId, at: performance.now() };
    if (songSetlistRef.current && !setlistDone) {
      // Setlist mode: chain straight into the next song instead of ending.
      // Score/combo are refs and deliberately NOT reset here (see
      // startSongPlay's continueSetlist param). The next song's data goes
      // into songMetaRef now, so its own best, ghost and backing load —
      // the delayed start used to reach them through a stale closure.
      songSetlistIdxRef.current++;
      const nextSong = songSetlistRef.current[songSetlistIdxRef.current];
      setSongSetlistPos({ idx: songSetlistIdxRef.current, total: songSetlistRef.current.length });
      songDataRef.current = expandSong(nextSong, playAlongHandRef.current);
      songMetaRef.current = nextSong;
      setSongMeta(nextSong);
      setSongLoopRecap({ acc, score, maxCombo, stars, exp: reward, nextSong: tr(nextSong, lang) });
      clearTimeout(songLoopRetryT.current);
      songLoopRetryT.current = setTimeout(() => { setSongLoopRecap(null); againViaRef.current = "concert"; startSongPlay(true); }, 1800);
    } else if (songAutoLoopRef.current) {
      // auto-loop: if enabled, restart after a brief pause instead of showing result
      // screen — songResult above is fully populated either way, but the result
      // screen itself never mounts here, so without this the run's own outcome
      // (score, stars, combo, EXP) went completely unseen between restarts.
      setSongLoopRecap({ acc, score, maxCombo, stars, exp: reward });
      clearTimeout(songLoopRetryT.current);
      songLoopRetryT.current = setTimeout(() => { setSongLoopRecap(null); againViaRef.current = "loop"; startSongPlay(); }, 1800);
    } else {
      if (setlistDone) { songSetlistRef.current = null; setSongSetlistPos(null); }
      setSongPhase("done");
    }
  }
  // Per-song mistake breakdown — Play Along plan #7 (strategy-first, same
  // architecture as the Auto Teaching accuracy upgrade): the TIGA teaching
  // loop decides strategy/diagnosis from the real run numbers, the external
  // AI only renders the language (validated — generic advice can never show),
  // and a real-data fallback catches every failure layer. Guests skip the AI
  // call entirely and get the real-data fallback directly.
  async function fetchSongAnalysis(result, label) {
    if (isGuest) { setSongAnalysis(buildSongFallback(lang, label, result)); return; }
    setSongAnalysisBusy(true);
    try {
      // ── Jev run-classify (task: run-classify): score the run's mistake profile
      // first (fast, ~0.1-0.5s, parallel) — note_misses 0..3, rhythm/dynamics
      // yes/no, biggest_fix one of notes/rhythm/dynamics/confidence. The hint is
      // appended to the askAi message so the TIGA-model pipeline (strategy
      // selection → external AI rendering → validateTip) still owns the result;
      // unavailable Jev → empty hint, analysis identical to pre-Jev.
      let jevHint = "";
      try {
        const missedJ = (result.missedNotes || []).slice(0, 30);
        const jr = await jevTask("run-classify",
          `Song: ${label}. Accuracy ${result.acc}% (${result.hits}/${result.total} notes hit). Missed notes in play order: ${missedJ.length ? missedJ.join(", ") : "none — every note was hit"}.`,
          {}, 2000);
        if (jr.ok && jr.answers) {
          const nm = jevScore(jr.answers.note_misses);
          const rh = jevNoul(jr.answers.rhythm_issue);
          const dy = jevNoul(jr.answers.dynamics_issue);
          const bf = jevChoice(jr.answers.biggest_fix);
          const dims = [];
          if (nm != null) dims.push(`wrong-note severity ${nm.toFixed(1)}/3${nm >= 2 ? " (pattern/spot-specific, not random)" : ""}`);
          if (rh != null) dims.push(`rhythm/timing dominant issue: ${rh >= 0.6 ? "yes" : "no"}`);
          if (dy != null) dims.push(`touch/dynamics issue: ${dy >= 0.6 ? "yes" : "no"}`);
          if (bf) dims.push(`highest-impact next fix: ${bf}`);
          if (dims.length) jevHint = `\n\n[Pre-scored run profile (from structured analysis): ${dims.join("; ")}. Base your weakness + steps on this profile.]`;
        }
      } catch (e) {}
      const analysis = await analyzeSongRun(lang, label, result, runTeachingLoopForPractice, ({ system, message }) =>
        fetchChatCompletion({ message: message + jevHint, conversationHistory: [], system, feature: "song-analysis" }), profile);
      if (analysis) setSongAnalysis(analysis); // analyzeSongRun never returns null
    } catch (e) { /* silent — the score/stars result above already shown, this is a bonus */ }
    setSongAnalysisBusy(false);
  }
  // D2: Style Transformer — regenerate current song in a different style
  async function styleTransform(style: string) {
    if (!songMeta || styleLoading) return;
    if (requireLogin("ai")) return;
    // Same daily cap as its sibling AI-song generators (Compose, the plain
    // song generator) — this calls the same real, real-money AI backend and
    // had no limit at all before, unlike either of them.
    if (!canUse("styleTransform", premium)) { setStylePickOpen(false); onUpsell && onUpsell(); return; }
    setStyleLoading(true); setStylePickOpen(false);
    try {
      const styleDesc: Record<string, string> = {
        jazz: "jazz arrangement with swung notes and syncopated rhythm",
        pop: "modern pop arrangement with simple clear melody and strong beat",
        classical: "classical arrangement with smooth legato phrasing",
      };
      const songName = tr(songMeta, lang);
      const seqStr = JSON.stringify((songMeta.seq || []).slice(0, 20));
      // Same weakness-targeting as Compose (App.tsx composeGenerate) — prefer this
      // song's own post-play analysis when it exists (most specific to what just
      // happened), but fall back to the app-wide struggle signal (tg_memory, shared
      // with the SRS review modal/Auto Teaching) so a first-ever play of this song —
      // which has no analysis yet — still gets a targeted remix instead of a blind one.
      const memStruggle = (readMemory().struggles || [])[0];
      const weaknessNote = songAnalysis && songAnalysis.weakness
        ? ` Also, gently work in a little extra practice for this weak spot from the last run without making it feel like a drill: ${songAnalysis.weakness}.`
        : memStruggle
        ? ` Also, gently work in a little extra practice for this weak spot the learner has struggled with recently, without making it feel like a drill: ${memStruggle.label}.`
        : "";
      const prompt = `Rearrange the piano melody "${songName}" in a ${styleDesc[style] || style} style for a beginner falling-notes game. The original melody starts: ${seqStr}. Keep it recognizable but add ${style} character. 20-32 notes.${weaknessNote}`;
      const sys = "Output ONLY valid minified JSON: {\"name\":string,\"bpm\":number,\"seq\":[[note,beats],...]}. Notes: C4-B5 only; R=rest; beats: 0.5,1,1.5,2.";
      const acc = await streamChatCompletion({ message: prompt, conversationHistory: [], system: sys + THEORY_REF, feature: "song-style" });
      const jm = acc.match(/\{[\s\S]*\}/); if (!jm) throw new Error("no json");
      const obj = JSON.parse(jm[0]);
      const seq = normalizeSeq(obj.seq || []);
      if (seq.length < 6 || !seq.some((x: any[]) => x[0] !== "R")) throw new Error("short");
      const styleLabel = { jazz: "Jazz", pop: "Pop", classical: "Classical" }[style] || style;
      const name = `${songName} (${styleLabel})`;
      const bpm = Math.min(180, Math.max(60, Math.round(obj.bpm || (songMeta.bpm || 90))));
      // Re-scored from the actual rearranged notes, not inherited from the original —
      // a jazz/syncopated rework can be genuinely harder than the source song even
      // though the melody is "the same," so the old song's diff can't be trusted here.
      const diff = estimateSongDifficulty(songTechniqueProfile({ seq }));
      const newSong = { id: "style_" + Date.now(), diff, bpm, custom: true, th: name, en: name, zh: name, seq };
      // Persist like every other AI-generated song (App.tsx's generateSong) — a remix
      // used to vanish the moment you left the play screen, unlike anything else the
      // AI ever makes for you. Read-modify-write raw storage (not React state: this
      // hook has no live mySongs of its own, and SongListPage re-reads storage fresh
      // on its next mount anyway, same convention as every other tg_* store this app
      // uses).
      try {
        const existing = JSON.parse(localStorage.getItem("tg_mysongs") || "[]");
        localStorage.setItem("tg_mysongs", JSON.stringify([newSong, ...existing].slice(0, 20)));
      } catch (e) {}
      if (!premium) bumpUsage("styleTransform");
      songDataRef.current = expandSong(newSong, playAlongHandRef.current);
      setSongResult(null); setSongTigaTip(null); setSongAnalysis(null); setSongPhase("ready");
      setSongMeta(newSong);
    } catch (e) { /* silent fail — user stays on result screen */ }
    setStyleLoading(false);
  }

  /* The run analysis is fetched when the player opens it, not after every
     song: it is a paid AI call, and on the result screen it was one of three
     competing pieces of advice. */
  function requestSongAnalysis() {
    if (songResult && !songAnalysis && !songAnalysisBusy) fetchSongAnalysis(songResult, tr(songMeta, lang));
  }
  songLoopRef.current = songLoop;
  songInputRef.current = handleSongInput;
  songFinishRef.current = finishSong;
  // ════ HAND MODE (right/left/both) ════
  function changePlayAlongHand(h) {
    if (h === playAlongHand) return;
    setPlayAlongHand(h);
    if (songMeta && songPhase === "ready") {
      songDataRef.current = expandSong(songMeta, h);
    }
  }
  return { gameStore, pvpOnline, openPvpOnline, closePvpOnline, hostPvpOnline, joinPvpOnline, acceptPvpOnline, startPvpTogether, rematchPvpOnline, codeInput, setCodeInput,
    songOpen, setSongOpen, songMeta, setSongMeta, songPhase, setSongPhase, songTempo, setSongTempo, songResult, setSongResult, songAnalysis, setSongAnalysis, songAnalysisBusy, setSongAnalysisBusy, requestSongAnalysis,
    stylePickOpen, setStylePickOpen, styleLoading, setStyleLoading, challengeData, setChallengeData, backingOn, setBackingOn, backingTimerRef,
    detectOpen, setDetectOpen, detectNotes, setDetectNotes, detectMatch, setDetectMatch, detectListening, setDetectListening, detectStopRef,
    battleData, setBattleData, battlePickOpen, setBattlePickOpen, songBest, setSongBest,
    songAutoLoop, setSongAutoLoop, songAutoLoopRef, songCanvasRef, songDataRef, songInputRef, songTigaTip, songRafRef, songHudTimerRef, songPreviewRef,
    chooseSong, previewSong, startSongPlay, startSetlist, exitSong, styleTransform, playAlongHand, changePlayAlongHand,
    pauseSong, resumeSong, restartSong, playAgain, playNext, nextSongFor, songKind, setSongKind, songMetro, setSongMetro,
    songIntro, startIntro, skipIntro,
    drillPlan, drillActive, drillCleared, startDrill, endDrill, bossOn, bossMax, kShelfOpen, setKShelfOpen, kShelf, openKnowledgeShelf };
}

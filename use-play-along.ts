import { useState, useRef, useEffect } from "react";
import {
  getAC, playPianoNote, playMiss, playUi, playWhoosh, playBoom, playComboTone,
  pcOf, stopPracticeListeners, startMidiListener, startMicListener, laneHue, roundRect,
  SONG_LEAD, SONG_HITWINDOW, SONG_PERFECT, SONG_DEBOUNCE_MS, SONG_ECHO_MS, SONG_MISSWINDOW,
  expandSong, normalizeSeq, noteKeyFrac, _PC, playBackingChord, songTonic,
  songTechniqueProfile, estimateSongDifficulty,
} from "./music-engine";
import { tr } from "./i18n";
import { SONGS, SONG_TIMESIG } from "./songs-data";
import { logActivity, recordNoteMisses } from "./shared-infra";
import { recordMemory, readMemory } from "./ai-chat-context";
import { streamChatCompletion, fetchChatCompletion } from "./ai-backend";
import { logPractice, scoreDynamics, logGame, canUse, bumpUsage } from "./App";
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
export function usePlayAlong({ lang, isGuest, requireLogin, earnCoins, gainExp, bumpWeekly, setMysteryChest, setLuckyToast, luckyToastTimer, premium, onUpsell }) {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
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
  const [songPhase, setSongPhase] = useState("ready");     // ready | playing | done
  const [songTempo, setSongTempo] = useState(1);
  const [songHud, setSongHud] = useState({ score: 0, combo: 0, acc: 100, progress: 0 });
  const [songResult, setSongResult] = useState(null);
  const [songAnalysis, setSongAnalysis] = useState(null);   // {weakness, steps} — per-song mistake breakdown, this page only
  const [songAnalysisBusy, setSongAnalysisBusy] = useState(false);
  // D2: Style Transformer
  const [stylePickOpen, setStylePickOpen] = useState(false);
  const [styleLoading, setStyleLoading] = useState(false);
  // C1: Friend Challenge — detected from URL param ?challenge=songId:score:playerName
  const [challengeData, setChallengeData] = useState<any>(null);
  // D1: AI Accompaniment — backing chord loop during song play
  const [backingOn, setBackingOn] = useState(false);
  const backingTimerRef = useRef<any>(null);
  // E5: Song Detector — "What song am I playing?"
  const [detectOpen, setDetectOpen] = useState(false);
  const [detectNotes, setDetectNotes] = useState<string[]>([]);
  const [detectMatch, setDetectMatch] = useState<any>(null);
  const [detectListening, setDetectListening] = useState(false);
  const detectStopRef = useRef<any>(null);
  // C5: Family Battle — same device turn-based competition
  const [battleData, setBattleData] = useState<any>(null); // null | {song, scores:[{score,acc,stars},...], phase:'p1'|'p2'|'done'}
  const [battlePickOpen, setBattlePickOpen] = useState(false);
  const [songJudge, setSongJudge] = useState(null);   // {kind, id} transient Perfect/Good/Miss
  const [songNextLit, setSongNextLit] = useState(null); // next note to light on the in-game piano
  // The reading staff's current window: {list, startBeat, spanBeats}. The
  // beat bounds travel with the notes because the staff positions everything
  // by real beat, so it needs to know the window it's drawing, not just what
  // happens to be in it.
  const EMPTY_STAFF_WIN = { list: [], startBeat: 0, spanBeats: 20 };
  const [songStaffNotes, setSongStaffNotes] = useState(EMPTY_STAFF_WIN);
  const [songBest, setSongBest] = useState(0);
  const [songBursts, setSongBursts] = useState([]);   // particle bursts
  const [songShake, setSongShake] = useState(false);  // screen shake on milestones
  const [songGo, setSongGo] = useState(false);        // "GO!" flash at start
  const songJudgeTimerRef = useRef(null);
  const songShakeT = useRef(null);
  const songGoT = useRef(null);
  const songPerfectsRef = useRef(0);
  const songDebounceRef = useRef({});                 // per-pitch-class onset debounce — one press = one note
  const songEchoRef = useRef({});                     // per-pitch-class time the app last made a sound (mic echo guard)
  const [songGhost, setSongGhost] = useState(null);   // {diff} vs your best run
  const songSamplesRef = useRef([]);
  const songGhostDataRef = useRef(null);
  const [songBonus, setSongBonus] = useState(null);   // surprise reward popup {id, text}
  const [songLoopRecap, setSongLoopRecap] = useState(null); // brief run-summary toast shown between auto-loop restarts, since the full result screen is skipped there — {acc,score,maxCombo,stars,exp}
  // Setlist / Concert mode — chain N songs into one continuous run. The queue
  // itself lives in a ref (read every frame's worth of bookkeeping in
  // finishSong, no need to trigger a re-render just to advance it);
  // songSetlistPos is the one piece the UI actually needs reactively, for a
  // small "Song 2/4" badge during play.
  const songSetlistRef = useRef(null);
  const songSetlistIdxRef = useRef(0);
  const songSetlistLogRef = useRef([]);
  const [songSetlistPos, setSongSetlistPos] = useState(null);
  const songBonusT = useRef(null);
  const [songFever, setSongFever] = useState(false);
  const songFeverRef = useRef(false);
  const [songPops, setSongPops] = useState([]);       // flying "+N" score numbers
  const [songAnnounce, setSongAnnounce] = useState(null); // big combo-tier shout
  const songAnnounceT = useRef(null);
  const [songSrc, setSongSrc] = useState(null);            // {type:"midi"|"mic"|"error"}
  const [songCountdown, setSongCountdown] = useState(null);
  const [songAutoLoop, setSongAutoLoop] = useState(false);
  const songAutoLoopRef = useRef(false);
  const songLoopRetryT = useRef(null);
  // Hand-mode: "right" (default, unchanged behavior) | "left" (same melody,
  // re-fingered for the left hand) | "both" (adds a generated left-hand
  // accompaniment voice as real, separately-scored gameplay). Sticky across
  // song choices, same convention as songTempo.
  const [songHandMode, setSongHandMode] = useState("right");
  const [songFingerMap, setSongFingerMap] = useState({});   // {noteName: finger} for whichever key(s) are currently lit
  const [songNextLit2, setSongNextLit2] = useState(null);   // second hand's next-due note — only set when both hands are simultaneously active

  // play-along runtime refs (driven by rAF; kept off React state for 60fps)
  const songCanvasRef = useRef(null);
  const songDataRef = useRef(null);
  const songNotesRef = useRef([]);
  const songLanesRef = useRef([]);
  const songTotalRef = useRef(0);
  const songLastTimeRef = useRef(0);
  const songStartClockRef = useRef(0);
  const songTempoRef = useRef(1);
  const songRunRef = useRef(false);
  const songRafRef = useRef(0);
  const songHudTimerRef = useRef(null);
  const songScoreRef = useRef(0);
  const songComboRef = useRef(0);
  const songMaxComboRef = useRef(0);
  const songHitsRef = useRef(0);
  const songMissRef = useRef(0);
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

  // ════ PLAY-ALONG (falling-notes) controls ════
  function clearSongPreview() {
    songPreviewRef.current.forEach(id => clearTimeout(id));
    songPreviewRef.current = [];
  }
  function chooseSong(meta) {
    clearSongPreview();
    songDataRef.current = expandSong(meta, { hand: songHandMode });
    setSongMeta(meta);
    setSongResult(null);
    setSongAnalysis(null);
    setSongPhase("ready");
    setSongSrc(null);
    setSongCountdown(null);
    setSongOpen(true);
    getAC(); // unlock audio within the tap gesture
  }
  // Hand-mode picker (ready screen) — re-expands the already-chosen song so a
  // switch to/from "both" regenerates or drops the accompaniment voice and
  // its fingering immediately, without needing to re-pick the song.
  function pickHandMode(mode) {
    setSongHandMode(mode);
    if (songMeta) songDataRef.current = expandSong(songMeta, { hand: mode });
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
  const songKey = () => "tg_best_" + (songMeta ? (songMeta.id || songMeta.en || tr(songMeta, "en") || "x") : "x");
  function loadBest() { try { return +(localStorage.getItem(songKey()) || 0); } catch (e) { return 0; } }
  // continueSetlist=true skips the score/combo/max-combo reset — called by
  // finishSong() when chaining into the next song of a concert, so a combo
  // built across the boundary survives instead of snapping back to 0.
  async function startSongPlay(continueSetlist = false) {
    const data = songDataRef.current;
    if (!data) return;
    setSongBest(loadBest());
    songSamplesRef.current = [];
    try { songGhostDataRef.current = JSON.parse(localStorage.getItem("tg_ghost_" + (songMeta ? (songMeta.id || songMeta.en) : "x")) || "null"); } catch (e) { songGhostDataRef.current = null; }
    setSongGhost(null);
    clearSongPreview();
    for (const n of data.notes) { n.hit = false; n.missed = false; }
    songNotesRef.current = data.notes;
    songLanesRef.current = data.lanes;
    songTotalRef.current = data.total;
    songLastTimeRef.current = data.lastT;
    if (!continueSetlist) { songScoreRef.current = 0; songComboRef.current = 0; songMaxComboRef.current = 0; }
    songHitsRef.current = 0; songMissRef.current = 0; songPerfectsRef.current = 0;
    songTimingRef.current = { ok: 0, miss: 0 }; songVelsRef.current = [];
    songFeverRef.current = false; setSongFever(false); setSongPops([]); setSongAnnounce(null);
    songLaneFlashRef.current = {}; songCountdownRef.current = null; songFinishedRef.current = false;
    songRocketsRef.current = []; songBlastsRef.current = [];
    if (!songStarsRef.current.length) songStarsRef.current = Array.from({ length: 50 }, () => ({ fx: Math.random(), fy: Math.random(), r: 0.4 + Math.random() * 1.3, tw: Math.random() * Math.PI * 2 }));
    songDebounceRef.current = {}; songEchoRef.current = {};
    songTempoRef.current = songTempo || 1;
    setSongHud({ score: continueSetlist ? songScoreRef.current : 0, combo: continueSetlist ? songComboRef.current : 0, acc: 100, progress: 0 });
    setSongResult(null);
    setSongAnalysis(null);
    setSongCountdown(null);
    setSongSrc(null);
    setSongPhase("playing");
    getAC();
    songStartClockRef.current = getAC().currentTime;
    songRunRef.current = true;
    // D1: Start backing chord loop if enabled
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
    }
    stopPracticeListeners(); // release any mic/MIDI another mode left open — never stack listeners
    const onDetect = (d) => songInputRef.current(d);
    const midiOk = await startMidiListener(onDetect, () => setSongSrc({ type: "midi" }));
    if (!midiOk) await startMicListener(onDetect, () => setSongSrc({ type: "mic" }), () => setSongSrc({ type: "error" }));
    cancelAnimationFrame(songRafRef.current);
    songRafRef.current = requestAnimationFrame(() => songLoopRef.current());
    clearInterval(songHudTimerRef.current);
    songHudTimerRef.current = setInterval(() => {
      const total = songTotalRef.current || 1;
      const done = songHitsRef.current + songMissRef.current;
      setSongHud({
        score: songScoreRef.current,
        combo: songComboRef.current,
        acc: done > 0 ? Math.round(songHitsRef.current / done * 100) : 100,
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
        if (n.hit || n.missed) continue;
        const h = n.hand === "left" ? "left" : "right";
        if (!nextByHand[h]) nextByHand[h] = n;
        if (nextByHand.right && nextByHand.left) break;
      }
      const primaryNext = nextByHand.right || nextByHand.left || null;
      const secondaryNext = (nextByHand.right && nextByHand.left) ? nextByHand.left : null;
      setSongNextLit(primaryNext ? primaryNext.note : null);
      setSongNextLit2(secondaryNext ? secondaryNext.note : null);
      const fm = {};
      if (primaryNext) fm[primaryNext.note] = primaryNext.finger;
      if (secondaryNext) fm[secondaryNext.note] = secondaryNext.finger;
      setSongFingerMap(fm);
      // Sight-reading window, measured in BEATS rather than in note count:
      // one bar already played + four bars ahead. A fixed beat span is what
      // lets the staff space notes by their real rhythmic position (and keeps
      // both staves of a grand staff aligned on the beat) instead of spacing
      // them evenly by array index, which made every rhythm look identical.
      const timeSig = (songMeta && SONG_TIMESIG[songMeta.id]) || "4/4";
      const beatsPerBar = parseInt(String(timeSig).split("/")[0], 10) || 4;
      const spanBeats = beatsPerBar * 5;
      // "where we are" = the earliest still-unplayed note of the leading
      // voice, so the window follows the melody rather than the accompaniment.
      const melody = allNotes.filter(n => n.hand !== "left");
      const lead = (melody.length ? melody : allNotes);
      const curNote = lead.find(n => !n.hit && !n.missed);
      const curBeat = curNote ? curNote.beat : (lead.length ? lead[lead.length - 1].beat : 0);
      const winStartBeat = Math.max(0, curBeat - beatsPerBar);
      const winEndBeat = winStartBeat + spanBeats;
      // The staff draws ENGRAVED glyphs (bar-split, tied, rests filled in —
      // see buildNotation), not the raw played notes: a note held across a
      // bar line is two tied heads on the page but one note in the game, and
      // a bar's worth of silence is a rest glyph with no note behind it at
      // all. srcIdx is what links a drawn head back to the note being graded.
      const notation = (songDataRef.current && songDataRef.current.notation) || null;
      const stateOf = (g, voice) => {
        if (g.kind === "rest" || g.srcIdx == null) return "future";
        const src = voice[g.srcIdx];
        if (!src) return "future";
        if (src.hit || src.missed) return "past";
        return src === curNote ? "current" : "future";
      };
      const inWin = g => g.beat >= winStartBeat - 0.001 && g.beat <= winEndBeat + 0.001;
      const staffList = [];
      if (notation) {
        for (const g of notation.right) if (inWin(g)) staffList.push({ ...g, hand: "right", state: stateOf(g, allNotes) });
        for (const g of notation.left) if (inWin(g)) staffList.push({ ...g, hand: "left", state: stateOf(g, allNotes) });
      }
      setSongStaffNotes({ startBeat: winStartBeat, spanBeats, list: staffList });
      // ghost race vs your best run
      const st = (getAC().currentTime - songStartClockRef.current) * songTempoRef.current;
      songSamplesRef.current.push({ t: +st.toFixed(2), s: songScoreRef.current });
      const g = songGhostDataRef.current;
      if (g && g.length) {
        let gs = 0; for (let i = 0; i < g.length; i++) { if (g[i].t <= st) gs = g[i].s; else break; }
        setSongGhost({ diff: songScoreRef.current - gs });
      }
    }, 120);
  }
  function exitSong() {
    songRunRef.current = false;
    cancelAnimationFrame(songRafRef.current);
    clearInterval(songHudTimerRef.current);
    clearSongPreview();
    stopPracticeListeners();
    clearTimeout(backingTimerRef.current); backingTimerRef.current = null;
    setSongOpen(false);
    setSongPhase("ready");
    setSongResult(null);
    setSongCountdown(null);
    setSongNextLit(null);
    setSongStaffNotes(EMPTY_STAFF_WIN);
    setSongJudge(null);
    setSongBursts([]); setSongShake(false); setSongGo(false); setSongGhost(null); setSongBonus(null);
    songFeverRef.current = false; setSongFever(false); setSongPops([]); setSongAnnounce(null);
  }
  function songLoop() {
    if (!songRunRef.current) return;
    const cv = songCanvasRef.current;
    if (!cv) { songRafRef.current = requestAnimationFrame(() => songLoopRef.current()); return; }
    const ac = getAC();
    const songTime = (ac.currentTime - songStartClockRef.current) * songTempoRef.current;
    const notes = songNotesRef.current;
    const lanes = songLanesRef.current;
    const nLane = Math.max(1, lanes.length);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
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
    // deep-space nebula backdrop — pre-rendered offscreen once per size, drawn each frame
    let neb = songNebulaRef.current;
    if (!neb || neb.w !== W || neb.h !== H) {
      const nc = document.createElement("canvas"); nc.width = Math.max(1, W); nc.height = Math.max(1, H);
      const nx = nc.getContext("2d");
      nx.fillStyle = "#050414"; nx.fillRect(0, 0, W, H);
      const blobs = [[0.22, 0.24, 0.55, "rgba(148,60,100,0.17)"], [0.82, 0.14, 0.45, "rgba(6,150,214,0.14)"], [0.55, 0.72, 0.6, "rgba(255,82,82,0.08)"], [0.1, 0.85, 0.4, "rgba(217,119,87,0.06)"]];
      for (const [fx, fy, fr, col] of blobs) {
        const g0 = nx.createRadialGradient(fx * W, fy * H, 0, fx * W, fy * H, fr * Math.max(W, H));
        g0.addColorStop(0, col); g0.addColorStop(1, "rgba(0,0,0,0)");
        nx.fillStyle = g0; nx.fillRect(0, 0, W, H);
      }
      neb = songNebulaRef.current = { cv: nc, w: W, h: H };
    }
    ctx.drawImage(neb.cv, 0, 0);
    if (fever) { ctx.fillStyle = "rgba(255,82,82,0.06)"; ctx.fillRect(0, 0, W, H); } // fever = the whole sky heats up
    // twinkling parallax starfield — bigger stars drift faster (depth), fever = warp speed
    const drift = fever ? 0.06 : 0.012;
    for (const s of songStarsRef.current) {
      const tw = 0.5 + 0.5 * Math.sin(tSec * 1.4 + s.tw);
      ctx.globalAlpha = 0.2 + 0.55 * tw;
      ctx.fillStyle = "#ffbcd9";
      ctx.beginPath(); ctx.arc(s.fx * W, ((s.fy + tSec * drift * s.r) % 1) * H, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // a lone shooting star streaks by every ~7s (deterministic from time — no per-frame state)
    const winId = Math.floor(tSec / 7), winT = (tSec % 7) / 0.9;
    if (winT < 1) {
      const rnd = Math.abs(Math.sin(winId * 127.1) * 43758.5453) % 1;
      const sx = (0.15 + rnd * 0.7 + winT * 0.25) * W, sy = (0.05 + (rnd * 7 % 1) * 0.3 + winT * 0.22) * H;
      ctx.globalAlpha = Math.sin(winT * Math.PI) * 0.8;
      ctx.strokeStyle = "#faf0f5"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 26, sy - 18); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = 1;
    }
    const hitY = H - 8;
    const pxPerSec = hitY / SONG_LEAD;
    // a faint glowing Earth horizon along the hit-line — what the meteors are falling toward
    const earthGrad = ctx.createLinearGradient(0, hitY - 30, 0, hitY + 20);
    earthGrad.addColorStop(0, "rgba(6,150,214,0)"); earthGrad.addColorStop(1, "rgba(6,150,214,0.28)");
    ctx.fillStyle = earthGrad; ctx.fillRect(0, hitY - 30, W, 38);
    // Each lane's x-position is the actual key it maps to, so a falling note lands
    // directly above the piano key (and the lit key) the learner must press.
    const laneFrac = lanes.map(ln => noteKeyFrac(ln) || { cx: 0.5, w: 1 / 14 });
    for (let i = 0; i < nLane; i++) {
      const f = laneFrac[i], hue = laneHue(lanes[i]);
      const cw = f.w * W, cx = f.cx * W - cw / 2;
      ctx.fillStyle = `hsla(${hue},70%,50%,0.07)`;
      ctx.fillRect(cx, 0, cw, H);
    }
    ctx.strokeStyle = "rgba(217,119,87,0.55)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(W, hitY); ctx.stroke(); ctx.lineWidth = 1;
    for (const n of notes) {
      const hitAt = n.t + SONG_LEAD;
      if (!n.hit && !n.missed && songTime > hitAt + SONG_MISSWINDOW) {
        n.missed = true; songComboRef.current = 0; songMissRef.current++;
        if (songFeverRef.current) { songFeverRef.current = false; setSongFever(false); }
        songLaneFlashRef.current[n.lane] = { ok: false, until: now + 220 };
        playMiss(); flashJudge("miss");
      }
      if (n.hit) continue;
      const yFrac = (songTime - n.t) / SONG_LEAD;
      if (yFrac < -0.05 || yFrac > 1.4) continue;
      const y = yFrac * hitY;
      const h = Math.max(14, n.durSec * pxPerSec);
      const f = laneFrac[n.lane] || noteKeyFrac(n.note) || { cx: 0.5, w: 1 / 14 };
      const w = Math.max(10, f.w * W - 4), top = y - h, hue = laneHue(n.note);
      const mcx = f.cx * W;
      const rr = Math.max(7 * noteScale, Math.min(w / 2 - 1, 21) * noteScale); // meteor head radius (+15% cap), halved in landscape
      const hy = y - rr;                               // head rides the leading (falling) edge
      const spin = tSec * 1.6 + n.t * 2.3;             // slow tumble, phase unique per note
      if (!n.missed) {
        // fiery tail — its length IS the note's duration, drawn additively so it truly glows
        ctx.globalCompositeOperation = "lighter";
        const flick = 0.85 + 0.15 * Math.sin(now / 55 + n.t * 9);
        const tailTop = top - 6;
        const tg = ctx.createLinearGradient(mcx, hy, mcx, tailTop);
        tg.addColorStop(0, `hsla(${hue},100%,62%,${0.5 * flick})`);
        tg.addColorStop(0.5, `hsla(${(hue + 30) % 360},100%,55%,0.22)`);
        tg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.moveTo(mcx - rr * 0.85, hy);
        ctx.quadraticCurveTo(mcx - rr * 0.3, (hy + tailTop) / 2, mcx, tailTop);
        ctx.quadraticCurveTo(mcx + rr * 0.3, (hy + tailTop) / 2, mcx + rr * 0.85, hy);
        ctx.closePath(); ctx.fill();
        // heat halo hugging the head
        const halo = ctx.createRadialGradient(mcx, hy, rr * 0.4, mcx, hy, rr * 2.1);
        halo.addColorStop(0, `hsla(${hue},100%,64%,${0.5 * flick})`);
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(mcx, hy, rr * 2.1, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      // the rock itself — an off-center highlight fakes a lit 3D sphere
      const body = ctx.createRadialGradient(mcx - rr * 0.4, hy - rr * 0.4, rr * 0.15, mcx, hy, rr);
      if (n.missed) { body.addColorStop(0, "rgba(150,156,168,0.5)"); body.addColorStop(0.7, "rgba(84,88,100,0.45)"); body.addColorStop(1, "rgba(52,56,66,0.4)"); }
      else { body.addColorStop(0, `hsla(${hue},55%,72%,1)`); body.addColorStop(0.55, `hsla(${hue},50%,38%,1)`); body.addColorStop(1, `hsla(${hue},60%,16%,1)`); }
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(mcx, hy, rr, 0, Math.PI * 2); ctx.fill();
      // tumbling craters sell the rotation
      ctx.fillStyle = n.missed ? "rgba(40,44,54,0.5)" : `hsla(${hue},45%,14%,0.75)`;
      for (let k = 0; k < 3; k++) {
        const a = spin + k * 2.1;
        const cxk = mcx + Math.cos(a) * rr * 0.5, cyk = hy + Math.sin(a) * rr * 0.42;
        const crr = rr * (0.14 + k * 0.045);
        ctx.beginPath(); ctx.ellipse(cxk, cyk, crr, crr * 0.75, a, 0, Math.PI * 2); ctx.fill();
      }
      if (!n.missed) {
        // the note letter shrinks with the head, or it would overflow a
        // half-size meteor in landscape
        const fs = Math.max(8, Math.round(13 * noteScale));
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.font = `bold ${fs}px Rajdhani, sans-serif`; ctx.textAlign = "center";
        ctx.fillText(pcOf(n.note), mcx, hy + fs * 0.32);
      }
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
      // exhaust flame — additive + flickering
      ctx.globalCompositeOperation = "lighter";
      const fl = 0.7 + 0.3 * Math.sin(now / 28 + r.t0);
      const fg = ctx.createRadialGradient(rx, ry + 13, 0, rx, ry + 13, 14 * fl);
      fg.addColorStop(0, "rgba(255,235,170,0.95)"); fg.addColorStop(0.4, "rgba(255,150,40,0.7)"); fg.addColorStop(1, "rgba(255,60,10,0)");
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.ellipse(rx, ry + 14, 5, 13 * fl, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      // brushed-metal body + hue-tinted nose cone, fins and a glowing porthole
      const met = ctx.createLinearGradient(rx - 5, 0, rx + 5, 0);
      met.addColorStop(0, "#a67e95"); met.addColorStop(0.5, "#fbf2f7"); met.addColorStop(1, "#bb8fa7");
      ctx.fillStyle = met;
      roundRect(ctx, rx - 4.5, ry - 6, 9, 15, 3); ctx.fill();
      ctx.fillStyle = `hsl(${r.hue},85%,60%)`;
      ctx.beginPath(); ctx.moveTo(rx, ry - 15); ctx.lineTo(rx - 4.5, ry - 5); ctx.lineTo(rx + 4.5, ry - 5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(rx - 4.5, ry + 4); ctx.lineTo(rx - 9, ry + 10); ctx.lineTo(rx - 4.5, ry + 9); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(rx + 4.5, ry + 4); ctx.lineTo(rx + 9, ry + 10); ctx.lineTo(rx + 4.5, ry + 9); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#ff94e0";
      ctx.beginPath(); ctx.arc(rx, ry - 1, 2.2, 0, Math.PI * 2); ctx.fill();
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
      ctx.beginPath(); ctx.arc(b.x, b.y, (b.big ? 95 : 66) * t + 6, 0, Math.PI * 2); ctx.stroke();
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
        ctx.fillStyle = fl.ok ? `rgba(217,119,87,${0.5 * a})` : `rgba(255,82,82,${0.42 * a})`;
        ctx.fillRect(cx, hitY - 42, cw, 50);
      }
    }
    // Ghost-race trail — the ▲/▼ HUD number (songGhost) only ever tells you the
    // gap right now; this draws the whole race as it develops, both curves
    // plotted across a thin strip along the very top of the canvas so you can
    // actually watch yourself pull ahead or fall behind over the run instead
    // of just reading one number. Drawn last (on top of the meteors) so a
    // falling note passing behind it never hides it.
    const ghostData = songGhostDataRef.current;
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
    if (songTime < SONG_LEAD) {
      const c = Math.ceil(SONG_LEAD - songTime);
      if (c !== songCountdownRef.current) { songCountdownRef.current = c; setSongCountdown(c); }
    } else if (songCountdownRef.current !== 0) { songCountdownRef.current = 0; setSongCountdown(null); flashGo(); }
    if (songTime > songLastTimeRef.current + SONG_LEAD + 1.0) { songFinishRef.current(); return; }
    songRafRef.current = requestAnimationFrame(() => songLoopRef.current());
  }
  function handleSongInput(d) {
    if (!songRunRef.current) return;
    const ac = getAC();
    const songTime = (ac.currentTime - songStartClockRef.current) * songTempoRef.current;
    const inPC = pcOf(d.note);
    const tnow = performance.now();
    const src = d.source;
    // Echo/debounce guards key off the EXACT note (pitch + octave), not just
    // pitch class — a real physical press always lands on one exact key, and
    // this matters once a two-hand song can have the melody and the
    // accompaniment sharing a pitch class in different octaves close
    // together in time (e.g. a right-hand C5 and a left-hand C3 root in the
    // same beat): keying by pitch class alone would let the second genuine
    // press wrongly suppress the first as if it were an echo/repeat of it.
    //
    // Echo guard: when you TAP, the app plays that note and the mic hears it ~100ms
    // later — ignore a mic onset of the same pitch right after a tap so one tap can't
    // become 2–3 hits. (Pure real-piano play never sets this, so repeats stay fine.)
    if (src === "mic" && tnow - (songEchoRef.current[d.note] || 0) < SONG_ECHO_MS) return;
    // Debounce: one press = one note (a sustained key can re-fire the same pitch).
    if (tnow - (songDebounceRef.current[d.note] || 0) < SONG_DEBOUNCE_MS) return;
    songDebounceRef.current[d.note] = tnow;
    if (src === "tap") songEchoRef.current[d.note] = tnow; // this tap's sound will echo into the mic
    // Prefer an exact note (pitch + octave) match first — same two-hand reason
    // as above — and fall back to the original pitch-class-only search
    // (deliberately lenient: playing the right note an octave off still
    // counts) only when no exact candidate is in the hit window.
    let best = null, bestd = 1e9;
    for (const n of songNotesRef.current) {
      if (n.hit || n.missed || n.note !== d.note) continue;
      const dt = Math.abs(songTime - (n.t + SONG_LEAD));
      if (dt < bestd) { bestd = dt; best = n; }
    }
    if (!best) {
      for (const n of songNotesRef.current) {
        if (n.hit || n.missed || pcOf(n.note) !== inPC) continue;
        const dt = Math.abs(songTime - (n.t + SONG_LEAD));
        if (dt < bestd) { bestd = dt; best = n; }
      }
    }
    const now = performance.now();
    if (best && bestd <= SONG_HITWINDOW) {
      best.hit = true;
      const perfect = bestd <= SONG_PERFECT;
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
      // FEVER MODE — at a big combo the screen goes wild and score doubles.
      // A sustained fever gets one further escalation moment at combo 60 (past
      // where the old comboWord/score-mult tiers used to flatline) — a second
      // "the game still notices you" beat without also inflating the numeric
      // multiplier, which stays a clean, easy-to-read flat 2x.
      if (!songFeverRef.current && combo >= 15) { songFeverRef.current = true; setSongFever(true); playUi("levelup"); triggerShake(); announce("🔥 FEVER!"); }
      else if (songFeverRef.current && combo === 60) { triggerShake(); spawnBurst("combo"); spawnBurst("combo"); playUi("levelup"); announce("🔥🔥 MEGA FEVER!"); }
      const feverMult = songFeverRef.current ? 2 : 1;
      // Score multiplier — used to hard-cap at 2x forever past combo 10
      // (Math.min(combo,10)). Keeps that same fast 1x→2x ramp over the first
      // 10 notes (unchanged early-game feel), then keeps growing slowly all
      // the way to 300 instead of flatlining, so a long run/Setlist chain
      // keeps paying off instead of going numb.
      const comboMult = combo <= 10 ? 1 + combo * 0.1 : 2 + Math.min(combo - 10, 290) * 0.01;
      const gained = Math.round((perfect ? 150 : 100) * comboMult * feverMult);
      songScoreRef.current += gained;
      pushPop("+" + gained, perfect);     // flying score number
      playComboTone(combo);               // rising musical ladder
      if (perfect) spawnBurst("perfect");
      // combo-tier shout-outs
      if (combo % 10 === 0) { triggerShake(); spawnBurst("combo"); announce(comboWord(combo)); }
      // milestone bonus XP — 25/50/100 as before, then every 50 combo beyond
      // that (150, 200, 250...) instead of stopping dead at 100, ramping up to
      // a 500 EXP cap so a marathon run always has a next target ahead.
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
      songLaneFlashRef.current[best.lane] = { ok: true, until: now + 220 };
      flashJudge(perfect ? "perfect" : "good");
      // Voice the hit only for a silent MIDI controller. A tap already sounded via
      // the keyboard, and mic input means the real piano already sounded — replaying
      // it would just echo back into the mic and cause phantom extra hits.
      if (src === "midi") { playPianoNote(best.note, 0.5); songEchoRef.current[pcOf(best.note)] = performance.now(); }
    } else {
      const lane = songLanesRef.current.findIndex(x => pcOf(x) === inPC);
      if (lane >= 0) songLaneFlashRef.current[lane] = { ok: false, until: now + 150 };
    }
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
  function flashJudge(kind) {
    setSongJudge({ kind, id: Date.now() });
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
    stopPracticeListeners();
    const total = songTotalRef.current || 1;
    const hits = songHitsRef.current;
    const acc = Math.round(hits / total * 100);
    const stars = acc >= 90 ? 3 : acc >= 70 ? 2 : acc >= 40 ? 1 : 0;
    const maxCombo = songMaxComboRef.current;
    const perfects = songPerfectsRef.current;
    const fullCombo = songMissRef.current === 0 && hits === total && total > 0;
    const allPerfect = perfects === total && total > 0;
    const reward = Math.round(40 + acc * 0.4 + Math.min(maxCombo, 20) + (allPerfect ? 50 : fullCombo ? 25 : 0));
    const prevBest = loadBest();
    const score = songScoreRef.current;
    const newBest = score > prevBest;
    if (newBest) {
      try { localStorage.setItem(songKey(), String(score)); } catch (e) {} setSongBest(score);
      try { localStorage.setItem("tg_ghost_" + (songMeta ? (songMeta.id || songMeta.en) : "x"), JSON.stringify(songSamplesRef.current.slice(-240))); } catch (e) {}
    }
    logPractice(acc);
    recordMemory(tr(songMeta, lang), acc);
    logGame({ song: (songMeta && songMeta.id) || "song", acc, score, stars });
    logActivity("game", (songMeta && songMeta.id) || "song", hits, Math.max(0, total - hits),
      songDataRef.current && songDataRef.current.dur ? songDataRef.current.dur / (songTempoRef.current || 1) + SONG_LEAD : 60);
    const songId = (songMeta && songMeta.id) || "song";
    if (songTimingRef.current.ok + songTimingRef.current.miss >= 3) {
      logActivity("game", songId, songTimingRef.current.ok, songTimingRef.current.miss, 0, "rhythm");
    }
    const dyn = scoreDynamics(songVelsRef.current);
    if (dyn) logActivity("game", songId, dyn.ok, dyn.miss, 0, "dynamics");
    const coinReward = 5 + stars * 10 + (allPerfect ? 20 : fullCombo ? 10 : 0);
    earnCoins(coinReward);
    bumpWeekly("games", 1); if (perfects) bumpWeekly("perfect", perfects);
    setSongCountdown(null);
    setSongNextLit(null);
    setSongStaffNotes(EMPTY_STAFF_WIN);
    const missedNotes = songNotesRef.current.filter(n => n.missed).map(n => n.note);
    if (missedNotes.length) recordNoteMisses(missedNotes);
    // Setlist mode: this song's own log entry, always recorded even though the
    // combined concert score (songScoreRef.current, not reset between songs —
    // see startSongPlay's continueSetlist param) is what actually gets shown.
    if (songSetlistRef.current) songSetlistLogRef.current.push({ song: songMeta, acc, stars });
    const setlistDone = songSetlistRef.current && songSetlistIdxRef.current >= songSetlistRef.current.length - 1;
    setSongResult({
      acc, score, maxCombo, stars, exp: reward, coins: coinReward, total, hits, best: Math.max(score, prevBest), newBest, fullCombo, allPerfect, missedNotes,
      // only present once every song in a setlist has finished — the concert's
      // combined numbers, for a dedicated recap treatment on the result screen
      setlist: setlistDone ? songSetlistLogRef.current.slice() : null,
    });
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
    if (songSetlistRef.current && !setlistDone) {
      // Setlist mode: chain straight into the next song instead of ending.
      // Score/combo are refs and deliberately NOT reset here (see
      // startSongPlay's continueSetlist param) — a concert-length combo only
      // means something if surviving the boundary between songs actually
      // matters, same reasoning as a real medley.
      songSetlistIdxRef.current++;
      const nextSong = songSetlistRef.current[songSetlistIdxRef.current];
      setSongSetlistPos({ idx: songSetlistIdxRef.current, total: songSetlistRef.current.length });
      songDataRef.current = expandSong(nextSong, { hand: songHandMode });
      setSongMeta(nextSong);
      setSongLoopRecap({ acc, score, maxCombo, stars, exp: reward, nextSong: tr(nextSong, lang) });
      clearTimeout(songLoopRetryT.current);
      songLoopRetryT.current = setTimeout(() => { setSongLoopRecap(null); startSongPlay(true); }, 1800);
    } else if (songAutoLoopRef.current) {
      // auto-loop: if enabled, restart after a brief pause instead of showing result
      // screen — songResult above is fully populated either way, but the result
      // screen itself never mounts here, so without this the run's own outcome
      // (score, stars, combo, EXP) went completely unseen between restarts.
      setSongLoopRecap({ acc, score, maxCombo, stars, exp: reward });
      clearTimeout(songLoopRetryT.current);
      songLoopRetryT.current = setTimeout(() => { setSongLoopRecap(null); startSongPlay(); }, 1800);
    } else {
      if (setlistDone) { songSetlistRef.current = null; setSongSetlistPos(null); }
      setSongPhase("done");
    }
  }
  // Per-song mistake breakdown — separate from Auto Teaching, only ever shown on this
  // song-result screen. Fires once automatically when a song finishes.
  async function fetchSongAnalysis(result, label) {
    if (isGuest) return; // silent bonus feature — same no-op-for-guests treatment as finishPractice's AI comment
    setSongAnalysisBusy(true);
    try {
      const missed = (result.missedNotes || []).slice(0, 30);
      const missedTxt = missed.length ? missed.join(", ") : "none — every note was hit";
      const sysByLang = {
        th: `คุณคือ "ครู TiGA" ผู้เรียนเพิ่งเล่นเพลง "${label}" จบ ความแม่นยำ ${result.acc}% (เล่นถูก ${result.hits}/${result.total} โน้ต) โน้ตที่พลาด (เรียงตามลำดับที่เล่น): ${missedTxt}\n\nวิเคราะห์ว่าพลาดตรงไหน/รูปแบบอะไร แล้วให้วิธีฝึกแก้ ตอบเป็น JSON เท่านั้น {"weakness":"...","steps":["...","..."]} — weakness สั้นไม่เกิน 15 คำ บอกจุด/รูปแบบที่พลาด (หรือชมถ้าไม่พลาดเลย) steps มี 2-4 ข้อ วิธีฝึกแก้ทีละขั้น แต่ละข้อไม่เกิน 15 คำ ภาษาไทย ห้ามมีข้อความอื่นนอก JSON`,
        zh: `你是"TiGA老师"，学员刚弹完歌曲"${label}"，准确率 ${result.acc}%（弹对 ${result.hits}/${result.total} 个音）。弹错的音（按演奏顺序）：${missedTxt}\n\n分析弹错的位置/模式，并给出练习建议。只回JSON {"weakness":"...","steps":["...","..."]} — weakness 不超过15字，说明错误的位置/模式（若全对则给予表扬），steps 为2-4个简短练习步骤，每条不超过15字，用中文，JSON外不要任何文字`,
        en: `You are "Teacher TiGA". The learner just finished playing "${label}" at ${result.acc}% accuracy (${result.hits}/${result.total} notes hit). Notes they missed, in play order: ${missedTxt}.\n\nAnalyze where/what pattern they missed, then give a fix. Reply with JSON only: {"weakness":"...","steps":["...","..."]} — weakness under 15 words naming the spot/pattern they missed (or praise if nothing was missed), steps has 2-4 short fix-it practice steps, each under 15 words, in English. No text outside the JSON.`,
      };
      const txt = await fetchChatCompletion({ message: "Analyze my run of this song.", conversationHistory: [], system: sysByLang[lang] || sysByLang.en, feature: "song-analysis" });
      const m = txt.match(/\{[\s\S]*\}/);
      const obj = m ? JSON.parse(m[0]) : null;
      if (obj && obj.weakness && Array.isArray(obj.steps) && obj.steps.length) setSongAnalysis(obj);
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
      const acc = await streamChatCompletion({ message: prompt, conversationHistory: [], system: sys, feature: "song-style" });
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
      songDataRef.current = expandSong(newSong, { hand: songHandMode });
      setSongResult(null); setSongAnalysis(null); setSongPhase("ready");
      setSongMeta(newSong);
    } catch (e) { /* silent fail — user stays on result screen */ }
    setStyleLoading(false);
  }

  useEffect(() => {
    if (songPhase === "done" && songResult && !songAnalysis && !songAnalysisBusy) {
      fetchSongAnalysis(songResult, tr(songMeta, lang));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songPhase, songResult]);
  songLoopRef.current = songLoop;
  songInputRef.current = handleSongInput;
  songFinishRef.current = finishSong;
  return { songOpen, setSongOpen, songMeta, setSongMeta, songPhase, setSongPhase, songTempo, setSongTempo, songHud, setSongHud, songResult, setSongResult, songAnalysis, setSongAnalysis, songAnalysisBusy, setSongAnalysisBusy, stylePickOpen, setStylePickOpen, styleLoading, setStyleLoading, challengeData, setChallengeData, backingOn, setBackingOn, backingTimerRef, detectOpen, setDetectOpen, detectNotes, setDetectNotes, detectMatch, setDetectMatch, detectListening, setDetectListening, detectStopRef, battleData, setBattleData, battlePickOpen, setBattlePickOpen, songJudge, setSongJudge, songNextLit, setSongNextLit, songNextLit2, songFingerMap, songHandMode, pickHandMode, songStaffNotes, setSongStaffNotes, songBest, setSongBest, songBursts, setSongBursts, songShake, setSongShake, songGo, setSongGo, songJudgeTimerRef, songShakeT, songGoT, songPerfectsRef, songDebounceRef, songEchoRef, songGhost, setSongGhost, songSamplesRef, songGhostDataRef, songBonus, setSongBonus, songBonusT, songFever, setSongFever, songFeverRef, songPops, setSongPops, songAnnounce, setSongAnnounce, songAnnounceT, songSrc, setSongSrc, songCountdown, setSongCountdown, songAutoLoop, setSongAutoLoop, songAutoLoopRef, songLoopRetryT, songCanvasRef, songDataRef, songNotesRef, songLanesRef, songTotalRef, songLastTimeRef, songStartClockRef, songTempoRef, songRunRef, songRafRef, songHudTimerRef, songScoreRef, songComboRef, songMaxComboRef, songHitsRef, songMissRef, songTimingRef, songVelsRef, songLaneFlashRef, songStarsRef, songRocketsRef, songBlastsRef, songNebulaRef, songCountdownRef, songFinishedRef, songPreviewRef, songLoopRef, songInputRef, songFinishRef, songLoopRecap, songSetlistPos, chooseSong, previewSong, startSongPlay, startSetlist, exitSong, styleTransform };
}

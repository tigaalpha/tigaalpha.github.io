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
import { recordMemory } from "./ai-chat-context";
import { streamChatCompletion, fetchChatCompletion } from "./ai-backend";
import { logPractice, scoreDynamics, logGame } from "./App";
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
export function usePlayAlong({ lang, isGuest, requireLogin, earnCoins, gainExp, bumpWeekly, setMysteryChest, setLuckyToast, luckyToastTimer }) {
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
  const [songStaffNotes, setSongStaffNotes] = useState([]); // upcoming notes shown on the reading staff
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
    songDataRef.current = expandSong(meta);
    setSongMeta(meta);
    setSongResult(null);
    setSongAnalysis(null);
    setSongPhase("ready");
    setSongSrc(null);
    setSongCountdown(null);
    setSongOpen(true);
    getAC(); // unlock audio within the tap gesture
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
  async function startSongPlay() {
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
    songScoreRef.current = 0; songComboRef.current = 0; songMaxComboRef.current = 0;
    songHitsRef.current = 0; songMissRef.current = 0; songPerfectsRef.current = 0;
    songTimingRef.current = { ok: 0, miss: 0 }; songVelsRef.current = [];
    songFeverRef.current = false; setSongFever(false); setSongPops([]); setSongAnnounce(null);
    songLaneFlashRef.current = {}; songCountdownRef.current = null; songFinishedRef.current = false;
    songRocketsRef.current = []; songBlastsRef.current = [];
    if (!songStarsRef.current.length) songStarsRef.current = Array.from({ length: 50 }, () => ({ fx: Math.random(), fy: Math.random(), r: 0.4 + Math.random() * 1.3, tw: Math.random() * Math.PI * 2 }));
    songDebounceRef.current = {}; songEchoRef.current = {};
    songTempoRef.current = songTempo || 1;
    setSongHud({ score: 0, combo: 0, acc: 100, progress: 0 });
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
      // guide: light the next upcoming note on the in-game piano, and feed a
      // sliding window (a couple already-played + the current + a few ahead)
      // to the reading staff so the learner can see where they are, not just
      // what's next — sight-reading while playing, not just a note preview.
      const allNotes = songNotesRef.current;
      let curIdx = allNotes.findIndex(n => !n.hit && !n.missed);
      if (curIdx === -1) curIdx = allNotes.length;
      setSongNextLit(curIdx < allNotes.length ? allNotes[curIdx].note : null);
      const winStart = Math.max(0, curIdx - 2);
      // sight-reading window: 2 already-played + the current + FOUR full bars
      // ahead (16 quarter-notes in 4/4), so the learner can read ahead
      const timeSig = (songMeta && SONG_TIMESIG[songMeta.id]) || "4/4";
      const beatsPerBar = parseInt(String(timeSig).split("/")[0], 10) || 4;
      const curBeat = curIdx < allNotes.length ? allNotes[curIdx].beat : (allNotes.length ? allNotes[allNotes.length - 1].beat : 0);
      let winEnd = curIdx + 1;
      while (winEnd < allNotes.length && winEnd - winStart < 24 && allNotes[winEnd].beat <= curBeat + beatsPerBar * 4) winEnd++;
      setSongStaffNotes(allNotes.slice(winStart, winEnd).map((n, i) => ({
        note: n.note, beat: n.beat,
        state: (winStart + i) < curIdx ? "past" : (winStart + i) === curIdx ? "current" : "future",
      })));
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
    setSongStaffNotes([]);
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
      const rr = Math.max(7, Math.min(w / 2 - 1, 21)); // meteor head radius (+15% cap)
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
        ctx.fillStyle = "rgba(255,255,255,0.96)";
        ctx.font = "bold 13px Rajdhani, sans-serif"; ctx.textAlign = "center";
        ctx.fillText(pcOf(n.note), mcx, hy + 4);
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
    // Echo guard: when you TAP, the app plays that note and the mic hears it ~100ms
    // later — ignore a mic onset of the same pitch right after a tap so one tap can't
    // become 2–3 hits. (Pure real-piano play never sets this, so repeats stay fine.)
    if (src === "mic" && tnow - (songEchoRef.current[inPC] || 0) < SONG_ECHO_MS) return;
    // Debounce: one press = one note (a sustained key can re-fire the same pitch).
    if (tnow - (songDebounceRef.current[inPC] || 0) < SONG_DEBOUNCE_MS) return;
    songDebounceRef.current[inPC] = tnow;
    if (src === "tap") songEchoRef.current[inPC] = tnow; // this tap's sound will echo into the mic
    let best = null, bestd = 1e9;
    for (const n of songNotesRef.current) {
      if (n.hit || n.missed || pcOf(n.note) !== inPC) continue;
      const dt = Math.abs(songTime - (n.t + SONG_LEAD));
      if (dt < bestd) { bestd = dt; best = n; }
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
      // FEVER MODE — at a big combo the screen goes wild and score doubles
      if (!songFeverRef.current && combo >= 15) { songFeverRef.current = true; setSongFever(true); playUi("levelup"); triggerShake(); announce("🔥 FEVER!"); }
      const feverMult = songFeverRef.current ? 2 : 1;
      const gained = Math.round((perfect ? 150 : 100) * (1 + Math.min(combo, 10) * 0.1) * feverMult);
      songScoreRef.current += gained;
      pushPop("+" + gained, perfect);     // flying score number
      playComboTone(combo);               // rising musical ladder
      if (perfect) spawnBurst("perfect");
      // combo-tier shout-outs
      if (combo % 10 === 0) { triggerShake(); spawnBurst("combo"); announce(comboWord(combo)); }
      // milestone bonus XP at 25/50/100 combo
      if (combo === 25 || combo === 50 || combo === 100) {
        const bonusXp = combo === 100 ? 200 : combo === 50 ? 100 : 50;
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
  function comboWord(c) { return c >= 50 ? "UNSTOPPABLE!" : c >= 40 ? "INCREDIBLE!" : c >= 30 ? "AMAZING!" : c >= 20 ? "GREAT!" : "NICE!"; }
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
    setSongStaffNotes([]);
    const missedNotes = songNotesRef.current.filter(n => n.missed).map(n => n.note);
    if (missedNotes.length) recordNoteMisses(missedNotes);
    setSongResult({ acc, score, maxCombo, stars, exp: reward, coins: coinReward, total, hits, best: Math.max(score, prevBest), newBest, fullCombo, allPerfect, missedNotes });
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
    // auto-loop: if enabled, restart after a brief pause instead of showing result screen
    if (songAutoLoopRef.current) {
      clearTimeout(songLoopRetryT.current);
      songLoopRetryT.current = setTimeout(() => { startSongPlay(); }, 1800);
    } else {
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
    setStyleLoading(true); setStylePickOpen(false);
    try {
      const styleDesc: Record<string, string> = {
        jazz: "jazz arrangement with swung notes and syncopated rhythm",
        pop: "modern pop arrangement with simple clear melody and strong beat",
        classical: "classical arrangement with smooth legato phrasing",
      };
      const songName = tr(songMeta, lang);
      const seqStr = JSON.stringify((songMeta.seq || []).slice(0, 20));
      // Same weakness-targeting as Compose (App.tsx composeGenerate) — if this song's
      // own post-play analysis flagged a weak spot, ask the rearrangement to work it in.
      const weaknessNote = songAnalysis && songAnalysis.weakness
        ? ` Also, gently work in a little extra practice for this weak spot from the last run without making it feel like a drill: ${songAnalysis.weakness}.`
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
      songDataRef.current = expandSong(newSong);
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
  return { songOpen, setSongOpen, songMeta, setSongMeta, songPhase, setSongPhase, songTempo, setSongTempo, songHud, setSongHud, songResult, setSongResult, songAnalysis, setSongAnalysis, songAnalysisBusy, setSongAnalysisBusy, stylePickOpen, setStylePickOpen, styleLoading, setStyleLoading, challengeData, setChallengeData, backingOn, setBackingOn, backingTimerRef, detectOpen, setDetectOpen, detectNotes, setDetectNotes, detectMatch, setDetectMatch, detectListening, setDetectListening, detectStopRef, battleData, setBattleData, battlePickOpen, setBattlePickOpen, songJudge, setSongJudge, songNextLit, setSongNextLit, songStaffNotes, setSongStaffNotes, songBest, setSongBest, songBursts, setSongBursts, songShake, setSongShake, songGo, setSongGo, songJudgeTimerRef, songShakeT, songGoT, songPerfectsRef, songDebounceRef, songEchoRef, songGhost, setSongGhost, songSamplesRef, songGhostDataRef, songBonus, setSongBonus, songBonusT, songFever, setSongFever, songFeverRef, songPops, setSongPops, songAnnounce, setSongAnnounce, songAnnounceT, songSrc, setSongSrc, songCountdown, setSongCountdown, songAutoLoop, setSongAutoLoop, songAutoLoopRef, songLoopRetryT, songCanvasRef, songDataRef, songNotesRef, songLanesRef, songTotalRef, songLastTimeRef, songStartClockRef, songTempoRef, songRunRef, songRafRef, songHudTimerRef, songScoreRef, songComboRef, songMaxComboRef, songHitsRef, songMissRef, songTimingRef, songVelsRef, songLaneFlashRef, songStarsRef, songRocketsRef, songBlastsRef, songNebulaRef, songCountdownRef, songFinishedRef, songPreviewRef, songLoopRef, songInputRef, songFinishRef, chooseSong, previewSong, startSongPlay, exitSong, styleTransform };
}

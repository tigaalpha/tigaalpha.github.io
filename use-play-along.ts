import { useState, useRef, useEffect } from "react";
import {
  getAC, playPianoNote, playMiss, playUi, playWhoosh, playBoom, playClickAt,
  pcOf, stopPracticeListeners, startMidiListener, startMicListener, laneHue, roundRect,
  SONG_LEAD, SONG_DEBOUNCE_MS, SONG_ECHO_MS, setMicSafe, _micSafe,
  expandSong, normalizeSeq, noteKeyFrac, _PC, playBackingChord, songTonic, pickupBeatsOf, songChordBars,
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
import { queuedUntilTiga, tigaNow } from "./tiga-gateway";   // tigamodel loads lazy (plan v3 1.5) — hub reads guard on tigaNow() and keep their existing fallbacks
import { logPractice, scoreDynamics, logGame, canUse, bumpUsage } from "./App";
import { createGameStore } from "./play-along-store";
import { createBand, playChordDing } from "./play-along-band";
import { paintWorld, getWorld, composeStage, drawStageFx } from "./play-along-stage";
import { receiveWindow, judgeOffset, accuracyOf, starsFor, nextStarGoal, pressIsMash, calibrate, comboMult as comboMultOf, bossHp as bossHpOf, bossHit, POINTS, WEIGHT, MASH_WINDOW, CALIB_HITS, feverAt, comboMarkExp, medalOf, MEDAL_REWARD, runCoins, RUN_COIN_RUNS, chestChance, runPlayed, megaAt } from "./play-along-judge";
import { recordSongResult, songStars, songBestAcc, claimDaily, readDailyState, DAILY_SONG_REWARD, beatsPerBarOf, nextSongAfter, recordMedal, countRunToday } from "./play-along-progress";

/* ── PLAN v3.8 ระลอก 12 (12.1) — the share signal JoyIndex reads ──
   One row into the unified journal (k="share") from the same shared-
   infrastructure every other mode reports to, plus a usage event. Called
   from the result card's existing share buttons — no new UI flow. ── */
export function logShare(what, ref = null) {
  try { logActivity("share", String(what || ""), 0, 0, 0); } catch (e) {}
  try { logUsage("share", String(what || "")); } catch (e) {}
  return true;
}

export { DAILY_SONG_REWARD };

/* The reading staff's window before a song starts (see setSongStaffNotes). */
const EMPTY_STAFF_WIN = { list: [], startBeat: 0, spanBeats: 20 };

/* Everything the overlay reads while a song is running. These live in the
   game store (play-along-store.ts), not React state, so updating them never
   re-renders PianoApp — see the store's header. */
const GAME_INIT = {
  songHud: { score: 0, combo: 0, acc: 100, progress: 0 },
  songNextLit: null, songNextLit2: null, songFingerMap: {},
  songStaffNotes: EMPTY_STAFF_WIN, songShake: false, songGo: false,
  songGhost: null, songBonus: null, songLoopRecap: null, songSetlistPos: null,
  songFever: false, songAnnounce: null, songSrc: null, songCountdown: null,
  bossHp: 0, bossFx: null, bossVerdict: null, kDrop: null,   // bossVerdict: plan 2.4 — the engine's verdict the moment the boss falls ({id, text:{th,en,zh}} | null)
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
/* The size the stage had when a run last began, per screen, hand and view (the sheet view's stage is a strip above a big
   staff). The ready screen's canvas is taller than the playing one (no score row, staff or keyboard yet), so the world it
   paints in idle time (play-along-stage.ts) is painted for this remembered size; the first run on a new screen just paints
   it at Start, and remembers. */
const STAGE_SIZE_LS = "tg_pa_stage";
const stageSizeKey = (hand, sheet) => `${window.innerWidth}x${window.innerHeight}|${hand}|${sheet ? "s" : "f"}`;
function readStageSize(hand, sheet) {
  try { const v = JSON.parse(lsGet(STAGE_SIZE_LS, "{}"))[stageSizeKey(hand, sheet)]; return v && v[0] > 0 && v[1] > 0 ? v : null; } catch (e) { return null; }
}
function rememberStageSize(hand, sheet, W, H) {
  try {
    const o = JSON.parse(lsGet(STAGE_SIZE_LS, "{}")), k = stageSizeKey(hand, sheet);
    if (o[k] && o[k][0] === W && o[k][1] === H) return;
    delete o[k]; o[k] = [W, H];
    for (const old of Object.keys(o).slice(0, -6)) delete o[old];       // a handful of screens is plenty
    lsSet(STAGE_SIZE_LS, JSON.stringify(o));
  } catch (e) {}
}
// the pause screen's choice: auto learns the step; the others fix it
// (high = everything at 2×, medium = 1.5× without drifting motes and long
// trails, low = 1× with the essentials)
const GFX_MODES = { high: 0, mid: 1, low: 3 };
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
/* ── hit effects, drawn in the scene ──
   The judge word, the score and the sparks used to be DOM boxes created on
   every hit (a layout and a paint each, plus a big "PERFECT!" over the
   falling notes). They are drawn on the canvas now, at the lane that was
   hit, from text rendered once into small bitmaps. */
const FX_FONT = '"Prompt","Noto Sans Thai","Sukhumvit Set","Thonburi","Leelawadee UI",system-ui,sans-serif';
const JUDGE_WORD = {
  th: { perfect: "เพอร์เฟกต์!", great: "เกรท!", good: "ดี!", miss: "พลาด", wrong: "ผิดคีย์", early: "เร็วไป", late: "ช้าไป" },
  en: { perfect: "PERFECT!", great: "GREAT!", good: "GOOD", miss: "MISS", wrong: "WRONG KEY", early: "early", late: "late" },
  zh: { perfect: "完美!", great: "很好!", good: "不错", miss: "失误", wrong: "按错", early: "早了", late: "晚了" },
};
const JUDGE_COLOR = { perfect: ["#ffe27a", "rgba(255,60,210,0.9)"], great: ["#8ff3ff", "rgba(60,230,255,0.85)"], good: ["#d6c4ff", "rgba(140,70,255,0.8)"], miss: ["#ff8fb0", "rgba(255,60,120,0.7)"], wrong: ["#ff8fb0", "rgba(255,60,120,0.7)"] };
const TEXT_CACHE = new Map();
function textSprite(key, lines, dpr) {
  const k = key + "|" + dpr;
  let sp = TEXT_CACHE.get(k);
  if (sp) return sp;
  if (TEXT_CACHE.size > 160) TEXT_CACHE.clear();
  const cv = document.createElement("canvas"), c = cv.getContext("2d");
  const pad = 12;
  let w = 0, h = pad * 2;
  for (const ln of lines) { c.font = `${ln.weight || 800} ${ln.size}px ${FX_FONT}`; w = Math.max(w, c.measureText(ln.text).width); h += ln.size * 1.05; }
  w = Math.ceil(w + pad * 2); h = Math.ceil(h);
  cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.textAlign = "center"; c.textBaseline = "top";
  let y = pad;
  for (const ln of lines) {
    c.font = `${ln.weight || 800} ${ln.size}px ${FX_FONT}`;
    c.shadowColor = ln.glow || "transparent"; c.shadowBlur = ln.glow ? 10 : 0;   // the glow, paid once here
    c.fillStyle = ln.color;
    c.fillText(ln.text, w / 2, y);
    y += ln.size * 1.05;
  }
  sp = { cv, w, h };
  TEXT_CACHE.set(k, sp);
  return sp;
}
function judgeSprite(kind, el, lang, dpr) {
  const words = JUDGE_WORD[lang] || JUDGE_WORD.en;
  const [color, glow] = JUDGE_COLOR[kind] || JUDGE_COLOR.good;
  const lines = [{ text: words[kind] || kind, size: kind === "perfect" ? 20 : 17, color, glow }];
  if (el) lines.push({ text: words[el], size: 11, weight: 600, color: el === "early" ? "#8ff3ff" : "#ffb38f" });
  return textSprite(`j|${lang}|${kind}|${el || ""}`, lines, dpr);
}
/* The score pops are numbers that differ on almost every hit, so they are
   set from a strip of glyphs ("+0123456789") drawn once per style, one
   drawImage per character — a bitmap per number cost a canvas and a
   blurred fillText on nearly every hit. */
const GLYPHS = "+0123456789";
const GLYPH_CACHE = new Map();
function glyphStrip(perfect, dpr) {
  const key = (perfect ? 1 : 0) + "|" + dpr;
  let g = GLYPH_CACHE.get(key);
  if (g) return g;
  const size = 14, pad = 6, cell = Math.ceil(size * 0.72) + pad * 2, h = Math.ceil(size * 1.3) + pad * 2;
  const cv = document.createElement("canvas");
  cv.width = Math.ceil(cell * GLYPHS.length * dpr); cv.height = Math.ceil(h * dpr);
  const c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.font = `800 ${size}px ${FX_FONT}`;
  c.textAlign = "center"; c.textBaseline = "middle";
  c.shadowColor = perfect ? "rgba(255,190,60,0.7)" : "rgba(140,70,255,0.6)"; c.shadowBlur = 8;
  c.fillStyle = perfect ? "#ffe27a" : "#e9e4ff";
  const adv = [];
  for (let i = 0; i < GLYPHS.length; i++) { c.fillText(GLYPHS[i], cell * i + cell / 2, h / 2); adv.push(Math.ceil(c.measureText(GLYPHS[i]).width)); }
  g = { cv, cell, h, pad, adv, dpr };
  GLYPH_CACHE.set(key, g);
  return g;
}
function drawNumberPop(ctx, text, perfect, dpr, cx, cy) {
  const g = glyphStrip(perfect, dpr);
  let w = 0;
  for (const ch of text) { const i = GLYPHS.indexOf(ch); if (i >= 0) w += g.adv[i]; }
  let x = cx - w / 2;
  for (const ch of text) {
    const i = GLYPHS.indexOf(ch);
    if (i < 0) continue;
    const adv = g.adv[i];
    // each glyph sits centred in its cell; place the cell so the glyph lands at x
    ctx.drawImage(g.cv, i * g.cell * g.dpr, 0, g.cell * g.dpr, g.h * g.dpr, x + adv / 2 - g.cell / 2, cy - g.h / 2, g.cell, g.h);
    x += adv;
  }
  return w;
}
const FX_DUR = { judge: 520, pop: 720, spark: 440, ring: 620 };
let _rmq = null;
function reducedMotion() {
  try { if (!_rmq) _rmq = window.matchMedia("(prefers-reduced-motion: reduce)"); return !!_rmq.matches; } catch (e) { return false; }
}

/* A note's light ribbon, for one lane colour: a tapered streak, bright
   where it meets the crystal and fading up the tail. Drawn once, stretched
   to each note's length. */
const RIBBON_CACHE = new Map();
function ribbonSprite(hue) {
  const key = Math.round(hue);
  let cv = RIBBON_CACHE.get(key);
  if (cv) return cv;
  const w = 48, h = 256;
  cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const c = cv.getContext("2d");
  const g = c.createLinearGradient(0, h, 0, 0);
  g.addColorStop(0, `hsla(${key},100%,64%,0.5)`);
  g.addColorStop(0.35, `hsla(${(key + 40) % 360},100%,60%,0.22)`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(0, h);
  c.quadraticCurveTo(w * 0.34, h / 2, w / 2, 0);
  c.quadraticCurveTo(w * 0.66, h / 2, w, h);
  c.closePath(); c.fill();
  // a bright core down the middle
  const core = c.createLinearGradient(0, h, 0, 0);
  core.addColorStop(0, "rgba(255,255,255,0.35)"); core.addColorStop(0.5, "rgba(255,255,255,0.06)"); core.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = core; c.fillRect(w / 2 - 1.5, 0, 3, h);
  RIBBON_CACHE.set(key, cv);
  return cv;
}
/* A lane lighting up from the hit-line as its note comes in. */
const LANE_GLOW_CACHE = new Map();
function laneGlowSprite(hue) {
  const key = Math.round(hue);
  let cv = LANE_GLOW_CACHE.get(key);
  if (cv) return cv;
  cv = document.createElement("canvas"); cv.width = 16; cv.height = 128;
  const c = cv.getContext("2d");
  const g = c.createLinearGradient(0, 128, 0, 0);
  g.addColorStop(0, `hsla(${key},100%,62%,0.55)`); g.addColorStop(0.4, `hsla(${key},100%,60%,0.16)`); g.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = g; c.fillRect(0, 0, 16, 128);
  LANE_GLOW_CACHE.set(key, cv);
  return cv;
}

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
  const setSongNextLit = gameStore.setter("songNextLit");
  const setSongNextLit2 = gameStore.setter("songNextLit2");
  const setSongFingerMap = gameStore.setter("songFingerMap");
  const setSongStaffNotes = gameStore.setter("songStaffNotes");
  const setSongShake = gameStore.setter("songShake");
  const setSongGo = gameStore.setter("songGo");
  const setSongGhost = gameStore.setter("songGhost");
  const setSongBonus = gameStore.setter("songBonus");
  const setSongLoopRecap = gameStore.setter("songLoopRecap");
  const setSongSetlistPos = gameStore.setter("songSetlistPos");
  const setSongFever = gameStore.setter("songFever");
  const setSongAnnounce = gameStore.setter("songAnnounce");
  const setSongSrc = gameStore.setter("songSrc");
  const setSongCountdown = gameStore.setter("songCountdown");
  const setBossHp = gameStore.setter("bossHp");
  const setBossFx = gameStore.setter("bossFx");
  const setBossVerdict = gameStore.setter("bossVerdict");
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
  const bossVerdictRef = useRef(null);                   // plan 2.4: verdict for the CURRENT boss (reset on each boss spawn)
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
  /* What plays with the song (owner, 2026-09-30): a backing track — the band —
     or a metronome, the one or the other, chosen in the top right corner. The
     metronome's click is scheduled on the audio clock against the song's own
     beat grid (bar lines and pickups included); the band's volume is its own
     setting and only means something in track mode. */
  const [songAccomp, setSongAccompState] = useState(() => {
    const v = lsGet("tg_pa_accomp", null);
    if (v === "track" || v === "metro") return v;
    // no choice yet: someone who had turned the band off and left the click on keeps hearing the click
    return +lsGet("tg_pa_band", 2) === 0 && lsGet("tg_pa_metro", "1") !== "0" ? "metro" : "track";
  });
  const songAccompRef = useRef(songAccomp);
  songAccompRef.current = songAccomp;
  function setSongAccomp(v) {
    const nv = v === "metro" ? "metro" : "track";
    if (nv === songAccompRef.current) return;
    songAccompRef.current = nv; setSongAccompState(nv); lsSet("tg_pa_accomp", nv);
    if (bandRef.current) bandRef.current.setLevel(nv === "track" ? songBandRef.current : 0);
    if (songRunRef.current) announce(nv === "track" ? "🎼 Backing track" : "⏱ Metronome");
  }
  /* How the song is shown (owner, 2026-09-30): "fall" — gems falling to the keys, the staff above — or "sheet": no falling
     notes at all, the staff big and sitting on the keys, and no key lit to point the way, for a player who reads and plays
     without them. Chosen in the header beside the accompaniment and kept. The first-song intro teaches the gems, so it is
     always shown falling (sheetOn). */
  const [songView, setSongViewState] = useState(() => lsGet("tg_pa_view", "fall") === "sheet" ? "sheet" : "fall");
  const songViewRef = useRef(songView);
  songViewRef.current = songView;
  const sheetOn = () => songViewRef.current === "sheet" && !(songMetaRef.current && songMetaRef.current.intro);
  function setSongView(v) {
    const nv = v === "sheet" ? "sheet" : "fall";
    if (nv === songViewRef.current) return;
    songViewRef.current = nv; setSongViewState(nv); lsSet("tg_pa_view", nv);
    if (songRunRef.current) announce(nv === "sheet" ? "📖 Sheet music" : "☄ Falling notes");
  }
  // the band's volume: 0 off, 1 soft, 2 normal (play-along-band.ts)
  const [songBand, setSongBandState] = useState(() => { const v = Math.round(+lsGet("tg_pa_band", 2)); return v >= 0 && v <= 2 ? v : 2; });
  const songBandRef = useRef(songBand);
  songBandRef.current = songBand;
  const bandRef = useRef(null);
  const bandTimerRef = useRef(null);
  // Practice mode: the song waits at each note until the right key (no
  // score, stars, coins or records; 20 EXP for finishing). practiceRef is
  // the running run; songPractice tells the screens.
  const practiceRef = useRef(null);         // null | { waitSince, hinted }
  const fxListRef = useRef([]);             // the scene's hit effects (see pushFx)
  const [songPractice, setSongPractice] = useState(false);
  const PRACTICE_EXP = 20;
  // Play Along's own effect sounds (hit ding, miss, rocket, boom, shouts) —
  // off here keeps the piano and the band; the app-wide mute silences all
  const [songFx, setSongFxState] = useState(() => lsGet("tg_pa_fx", "1") === "1");
  const songFxRef = useRef(songFx);
  songFxRef.current = songFx;
  function setSongFx(v) { const nv = !!(typeof v === "function" ? v(songFxRef.current) : v); songFxRef.current = nv; setSongFxState(nv); lsSet("tg_pa_fx", nv ? "1" : "0"); }
  const fx = (f) => { if (songFxRef.current) f(); };
  function setSongBand(v) {
    const nv = Math.max(0, Math.min(2, Math.round(typeof v === "function" ? v(songBandRef.current) : v)));
    songBandRef.current = nv; setSongBandState(nv); lsSet("tg_pa_band", String(nv));
    if (bandRef.current && songAccompRef.current === "track") bandRef.current.setLevel(nv);
  }
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
  const clickLogRef = useRef([]);          // the run's clicks and count-in ticks (the test hook reads it)
  const runMetaRef = useRef(null);         // { id, startedAt, ctx, via } for the usage rows
  const lastEndRef = useRef(null);         // { id, at } — "played again within a minute"
  const againViaRef = useRef(null);        // which button started the next run
  const frameStatRef = useRef({ n: 0, t0: 0, last: 0, long: 0, active: 0 });
  const gfxRef = useRef(null);
  if (!gfxRef.current) {
    let small = false;
    try { const nav: any = navigator; small = (nav.deviceMemory && nav.deviceMemory <= 3) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4); } catch (e) {}
    const t = Math.round(+lsGet("tg_pa_gfx", small ? 1 : 0));
    const mode = lsGet("tg_pa_gfx_mode", "auto");
    gfxRef.current = { auto: t >= 0 && t < GFX_TIERS.length ? t : 0, tier: 0, mode: GFX_MODES[mode] != null || mode === "auto" ? mode : "auto", smooth: +lsGet("tg_pa_gfx_ok", 0) || 0, win: [], windows: 0, slow: false, stalls: [] };
    gfxRef.current.tier = gfxRef.current.mode === "auto" ? gfxRef.current.auto : GFX_MODES[gfxRef.current.mode];
  }
  const songTimingRef = useRef({ ok: 0, miss: 0 }); // Rhythm skill: perfect vs good hits, separate from note-pitch ok/miss
  const songVelsRef = useRef([]); // MIDI velocities of hit notes — see scoreDynamics()
  const songLaneFlashRef = useRef({});
  const songStarsRef = useRef([]);     // parallax starfield, generated once per song
  const gemsDrawnRef = useRef(0);      // how many falling notes the last frame drew (the bots read it)
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
  const tappedRef = useRef(false);       // a press has come from the screen in this run (until then the player may be on a real piano)
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
    if (practiceRef.current) return "practice";
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
    logPa(`start:${rm.id}:${rm.ctx}:${songKindRef.current ? "kind" : "std"}:${playAlongHandRef.current}:${Math.round((songTempoRef.current || 1) * 100)}:${src}${sheetOn() ? ":sheet" : ""}`);
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
    tappedRef.current = false;
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
  function stopListeners() { stopPracticeListeners(); listenersOnRef.current = false; setMicSafe(false); }
  function startLoops() {
    cancelAnimationFrame(songRafRef.current);
    songRafRef.current = requestAnimationFrame(() => songLoopRef.current());
    clearInterval(songHudTimerRef.current);
    songHudTimerRef.current = setInterval(() => hudTick(), 120);
    clearInterval(bandTimerRef.current);
    bandTimerRef.current = setInterval(() => { if (songRunRef.current && !pausedRef.current) bandPump(songNow()); }, 60);
  }
  /* ── the band ── */
  function makeBand(meta, data) {
    if (bandRef.current) bandRef.current.cut();
    bandRef.current = null;
    if (!meta || !meta.bpm || !data) return;
    const spb = 60 / meta.bpm;
    bandRef.current = createBand({
      bars: songChordBars(meta, pickupRef.current, { split: true, primary: true }),
      beatsPerBar: beatsPerBarOf(meta), pickup: pickupRef.current, spb, lead: SONG_LEAD,
      endBeat: (data.dur || 0) / spb, hand: playAlongHandRef.current, level: songAccompRef.current === "track" ? songBandRef.current : 0,
    });
  }
  // ring: the song ended by itself, so its last chord fades out instead of being cut
  function stopBand(ring = false) {
    clearInterval(bandTimerRef.current); bandTimerRef.current = null;
    if (bandRef.current) { if (ring) bandRef.current.ringOut(1.8); else bandRef.current.cut(); }
  }
  /* Who the band plays for right now: while the mic listens, a player who has
     not tapped the screen (their presses come from the mic, or none yet — the
     mic cannot tell a pianist from a tapper before the first press) is taken
     for a pianist and gets soft drums only, and the game's own sounds switch
     to their mic-safe voice (music-engine setMicSafe); a player tapping the
     screen gets the full band, its notes kept out of the mic's hearing (see
     play-along-band.ts) and the mic itself put aside (see handleSongInput). */
  function bandPump(songTime) {
    const b = bandRef.current;
    if (!b || pausedRef.current) return;
    const src = gameStore.get().songSrc;
    const micOpen = !!(src && src.type === "mic");
    const onPiano = micOpen && !(lastSrcRef.current === "tap" && tappedRef.current);
    setMicSafe(onPiano);
    b.setState({ combo: songComboRef.current, fever: !!songFeverRef.current, mega: !!songFeverRef.current && songComboRef.current >= megaAt(songTotalRef.current), pitched: !onPiano, soft: onPiano, micOpen });
    const tempo = songTempoRef.current || 1, clock = songStartClockRef.current;
    const dr = drillRef.current;
    b.pump(songTime, st => clock + st / tempo, tempo, dr ? (dr.firstHit || 0) : 0);
  }
  // continueSetlist=true skips the score/combo/max-combo reset — called by
  // finishSong() when chaining into the next song of a concert, so a combo
  // built across the boundary survives instead of snapping back to 0.
  async function startSongPlay(continueSetlist = false, opts: any = {}) {
    const data = songDataRef.current;
    if (!data) return;
    const meta = songMetaRef.current;
    const practice = !!(opts && opts.practice) && !continueSetlist && !(meta && meta.intro);
    practiceRef.current = practice ? { waitSince: 0, hinted: false } : null;
    setSongPractice(practice);
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
    songFeverRef.current = false; setSongFever(false); setSongAnnounce(null);
    songLaneFlashRef.current = {}; songCountdownRef.current = null; songFinishedRef.current = false;
    // Boss: HP from the note count (play-along-judge bossHp), armed every run
    // except the intro. The bar reads the store, so it moves on every hit.
    bossOnRef.current = !(meta && meta.intro) && !practice;
    bossHpRef.current = bossHpOf(songTotalRef.current || data.total || 0);
    bossMaxRef.current = Math.max(1, bossHpRef.current);
    setBossHp(bossHpRef.current); setBossFx(null);
    bossVerdictRef.current = null; setBossVerdict(null);   // plan 2.4: fresh boss = fresh verdict
    setBossMax(bossMaxRef.current);
    setBossOn(bossOnRef.current);
    kDroppedRef.current = {};
    songRocketsRef.current = []; songBlastsRef.current = []; fxListRef.current = [];
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
    clickLogRef.current = [];
    frameStatRef.current = { n: 0, t0: 0, last: 0, long: 0, active: 0 };
    songRunRef.current = true;
    runMetaRef.current = { id: songIdOf(meta), startedAt: performance.now(), ctx: runCtx(meta), via: againViaRef.current, intro: !!(meta && meta.intro) };
    againViaRef.current = null;
    // The band (play-along-band.ts) plays along on the audio clock; it
    // replaces the old chord loop that ran on setTimeout and drifted.
    if (practice) { if (bandRef.current) bandRef.current.cut(); bandRef.current = null; } // a song that stops and waits has no groove to keep
    else makeBand(meta, data);
    // The song starts now; the mic and MIDI join when they are ready. They
    // used to be awaited first, so a permission prompt the player had not
    // answered (Chrome asks before Web MIDI now) held the whole song back.
    startLoops();
    await Promise.race([ensureListeners(), new Promise(r => setTimeout(r, 1500))]);
    logRunStart();
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
    const sheet = sheetOn();
    const primaryNext = nextByHand.right || nextByHand.left || null;
    const secondaryNext = (nextByHand.right && nextByHand.left) ? nextByHand.left : null;
    // sheet view lights no key: the point of it is to read the note, not to be shown the key
    setSongNextLit(!sheet && primaryNext ? primaryNext.note : null);
    setSongNextLit2(!sheet && secondaryNext ? secondaryNext.note : null);
    const prevFm = gameStore.get().songFingerMap;
    const fm = {};
    if (!sheet && primaryNext) fm[primaryNext.note] = primaryNext.finger;
    if (!sheet && secondaryNext) fm[secondaryNext.note] = secondaryNext.finger;
    const fmSame = Object.keys(fm).length === Object.keys(prevFm).length && Object.keys(fm).every(k => prevFm[k] === fm[k]);
    if (!fmSame) setSongFingerMap(fm);
    // Sight-reading window, measured in BEATS rather than in note count:
    // one bar already played + four bars ahead. A fixed beat span is what
    // lets the staff space notes by their real rhythmic position (and keeps
    // both staves of a grand staff aligned on the beat) instead of spacing
    // them evenly by array index, which made every rhythm look identical.
    const beatsPerBar = beatsPerBarOf(meta);
    /* the sheet view draws the notation larger (see .pl-sheet), so it shows fewer bars: a bar behind the playhead and two
       ahead on a phone, more where the screen is wider */
    const spanBeats = beatsPerBar * (!sheet ? 5 : window.innerWidth >= 900 ? 5 : window.innerWidth >= 640 ? 4 : 3);
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
      if (src.hit || src.missed) return sheet ? (src.hit ? "hit" : "miss") : "past";      // the sheet view keeps the verdict on the page
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
    const sig = spanBeats + "|" + base.toFixed(3) + "|" + staffList.map(g2 => g2.beat + g2.hand[0] + g2.state[0]).join(",");
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
    stopBand();
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
    bossVerdictRef.current = null; setBossVerdict(null);
    clearTimeout(bossFxT.current); clearTimeout(kDropT.current);
    songSetlistRef.current = null; // leaving mid-concert ends the concert
    practiceRef.current = null; setSongPractice(false);
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
    if (bandRef.current) bandRef.current.cut(); // booked notes fall silent; resuming books afresh
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
  /* Test hook for the Play Along bots (scripts/verify-playalong-bots.mjs):
     only on a device where tg_pa_testhook is "1", never otherwise. It reads
     the song clock and the notes and presses keys through the same handler
     the on-screen keyboard uses — nothing a player could reach. */
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
      bake: () => { const n = songNebulaRef.current; return n ? { ms: n.bakeMs, fx: !!n.spr, world: n.worldMs, prebaked: !!n.prebaked, sheet: !!n.sheet } : null; },
      view: () => ({ pref: songViewRef.current, sheet: sheetOn() }),
      setView: (v) => setSongView(v),
      gems: () => gemsDrawnRef.current,
      band: () => bandRef.current ? { log: bandRef.current.log.slice(), state: { ...bandRef.current.state }, clock: songStartClockRef.current, tempo: songTempoRef.current, lead: SONG_LEAD, spb: 60 / ((songMetaRef.current && songMetaRef.current.bpm) || 90), audioNow: getAC().currentTime } : null,
      setSrc: (type) => setSongSrc(type ? { type } : null),
      clicks: () => clickLogRef.current.slice(),
      setBand: (v) => setSongBand(v),
      setAccomp: (v) => setSongAccomp(v),
      accomp: () => songAccompRef.current,
      micSafe: () => _micSafe,
      grades: () => ({ ...songGradesRef.current }),
      combo: () => songComboRef.current,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* ── The song's click, on the song's beat grid ──
     Beat k sits at songTime = LEAD + k·spb (beat 0 = the first note). Clicks
     are placed up to 150 ms ahead on the audio clock, so a late frame never
     makes a late click. Before the first note lands the click is the
     count-in and always plays; after it, only in metronome mode — and never
     in a practice pass, which stops and waits, so it has no beat to keep. */
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
        if (countIn || (songAccompRef.current === "metro" && !practiceRef.current)) {
          const accent = (((k - pickupRef.current) % bpb) + bpb) % bpb === 0;
          const when = songStartClockRef.current + bt / tempo;
          // the count-in is the band's drum sticks; the click when there is no band
          if (!(countIn && bandRef.current && bandRef.current.stick(when, accent))) playClickAt(when, accent, countIn ? 1 : 0.7);
          const cl = clickLogRef.current;
          cl.push({ beat: k, countIn });
          if (cl.length > 200) cl.shift();
        }
      }
      k++;
    }
    metroBeatRef.current = k;
  }
  /* one frame interval into the resolution control (see GFX_TIERS) */
  const [songGfx, setSongGfxState] = useState(() => (gfxRef.current ? gfxRef.current.mode : "auto"));
  function setSongGfx(mode) {
    const g = gfxRef.current;
    g.mode = GFX_MODES[mode] != null ? mode : "auto";
    g.tier = g.mode === "auto" ? g.auto : GFX_MODES[g.mode];
    g.win = []; g.stalls = [];
    lsSet("tg_pa_gfx_mode", g.mode);
    setSongGfxState(g.mode);
  }
  function gfxSample(dt) {
    const g = gfxRef.current;
    if (g.mode !== "auto") return;          // the player chose a level in the pause screen
    if (dt > 250) { g.win = []; return; }   // a stall (app switched away, a hiccup) says nothing about the frame rate
    // three frames held past 50 ms within 2 s: step down now, don't wait for the window
    if (dt > 50) {
      const tms = performance.now();
      g.stalls = g.stalls.filter(x => tms - x < 2000); g.stalls.push(tms);
      if (g.stalls.length >= 3 && g.tier < GFX_TIERS.length - 1) {
        g.stalls = []; g.win = []; g.slow = true;
        g.tier++; g.auto = g.tier; g.smooth = 0; lsSet("tg_pa_gfx", String(g.tier)); lsSet("tg_pa_gfx_ok", "0");
        return;
      }
    }
    g.win.push(dt);
    if (g.win.length < (g.windows === 0 && g.tier === 0 ? GFX_WINDOW / 2 : GFX_WINDOW)) return;
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
      g.auto = g.tier; g.smooth = 0; lsSet("tg_pa_gfx", String(g.tier)); lsSet("tg_pa_gfx_ok", "0");
    }
  }
  /* a finished run: three smooth ones in a row earn one step back up */
  function gfxRunEnd() {
    const g = gfxRef.current;
    if (g.mode === "auto" && g.windows >= 3) {
      if (g.slow) g.smooth = 0;
      else if (g.tier > 0 && ++g.smooth >= 3) { g.tier--; g.auto = g.tier; g.smooth = 0; lsSet("tg_pa_gfx", String(g.tier)); }
      lsSet("tg_pa_gfx_ok", String(g.smooth));
    }
    g.slow = false; g.windows = 0; g.win = [];
  }
  function songLoop() {
    if (!songRunRef.current || pausedRef.current) return;
    const cv = songCanvasRef.current;
    if (!cv) { songRafRef.current = requestAnimationFrame(() => songLoopRef.current()); return; }
    const ac = getAC();
    let songTime = (ac.currentTime - songStartClockRef.current) * songTempoRef.current;
    const pr = practiceRef.current;
    if (pr) {
      // Practice: the song waits. When the next note reaches the line
      // unplayed, the clock is held there (its start slides forward), so the
      // notes, the staff and the keys all stand still until the right key.
      let wait = null;
      for (const n of songNotesRef.current) { if (!n.hit && !n.skip) { wait = n; break; } }
      const at = wait ? wait.t + SONG_LEAD : null;
      if (at != null && songTime > at) {
        songStartClockRef.current += (songTime - at) / (songTempoRef.current || 1);
        songTime = at;
        const tms = performance.now();
        if (!pr.waitSince) { pr.waitSince = tms; pr.hinted = false; }
        else if (!pr.hinted && tms - pr.waitSince > 3000) { pr.hinted = true; playPianoNote(wait.note, 0.5, 0.3); } // a hint: this is the note
      } else pr.waitSince = 0;
    }
    { // frame pacing for the "fps" usage row: frames, and frames held past 50 ms
      const fs = frameStatRef.current, tms = performance.now();
      if (fs.last) { const dt = tms - fs.last; fs.n++; if (dt > 50) fs.long++; if (dt < 1000) fs.active += dt; if (fs.skip > 0) fs.skip--; else gfxSample(dt); } else if (!fs.t0) fs.t0 = tms;
      fs.last = tms;
    }
    scheduleClicks(songTime);
    bandPump(songTime);
    const notes = songNotesRef.current;
    const lanes = songLanesRef.current;
    const nLane = Math.max(1, lanes.length);
    const dpr = Math.min(GFX_TIERS[gfxRef.current.tier], window.devicePixelRatio || 1);
    // Sprites (crystals, words, numbers) are drawn at the screen's own
    // density whatever the canvas step, so a step change never redraws them
    // all mid-song — drawImage scales them down for free.
    const sdpr = Math.min(2, window.devicePixelRatio || 1);
    // what the scene draws: 2 everything, 1 no drifting motes or long trails, 0 the essentials
    const fxLevel = reducedMotion() ? 0 : gfxRef.current.tier === 0 ? 2 : gfxRef.current.tier === 1 ? 1 : 0;
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
    const sheet = sheetOn();
    const bakeKey = `${W}|${H}|${dpr}|${hand}|${noteScale}|${lanes.join(",")}|${fxLevel >= 2 ? 1 : 0}|${sheet ? "s" : "f"}`;
    const wheelX = W * 0.5, wheelY = H * 0.3, wheelR = Math.min(W * 0.42, H * 0.24);
    /* The world (sky, city, floor) is painted once per size and kept (play-along-stage.ts); a song only adds its lanes
       and hit-line to a copy of it. The ready screen has usually painted the world already, in the browser's idle
       time (the effect near the end of this hook), so Start finds it done. */
    let neb = songNebulaRef.current;
    if (!neb || neb.key !== bakeKey) {
      const bakeT0 = performance.now();
      const prebaked = !!getWorld(W, H, dpr, fxLevel >= 2);
      const world = paintWorld(W, H, dpr, fxLevel >= 2);
      rememberStageSize(hand, sheet, W, H);
      // the sheet view has no lanes, hit-line or receptors to add: the world itself is the stage (it is only ever read)
      const stage = sheet ? world.cv : composeStage(world, { hitY, noteScale, lanes: lanes.map((ln, i) => ({ cx: laneFrac[i].cx, w: laneFrac[i].w, hue: laneHue(ln) })) });
      neb = songNebulaRef.current = { cv: stage, key: bakeKey, sheet, world, win: world.win, winTop: world.winTop, hz: world.hz, wheel: world.wheel, spr: world.spr, prebaked, worldMs: world.bakeMs, bakeMs: performance.now() - bakeT0 };
      // a bake is a long frame the player is not to blame for: keep the frame-rate
      // control from stepping the picture down over it
      frameStatRef.current.skip = 2;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(neb.cv, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The stage keeps time with the song: beatPhase runs 0→1 through each
    // beat of the song clock (0 on the beat), downbeat on the bar's first.
    const metaNow = songMetaRef.current;
    const spbNow = 60 / ((metaNow && metaNow.bpm) || 90);
    const beatF = (songTime - SONG_LEAD) / spbNow;
    const beatPhase = beatF >= 0 ? beatF - Math.floor(beatF) : 1;
    const downbeat = beatF >= 0 && ((((Math.floor(beatF) - pickupRef.current) % beatsPerBarOf(metaNow)) + beatsPerBarOf(metaNow)) % beatsPerBarOf(metaNow)) === 0;
    const pulse = Math.pow(1 - beatPhase, 3);
    if (neb.wheel) { // the rune-wheel turns, slowly (faster in Fever)
      const sp = neb.wheel;
      ctx.save(); ctx.translate(wheelX, wheelY); ctx.rotate(tSec * (fever ? 0.22 : 0.05));
      ctx.drawImage(sp.cv, -sp.size / 2, -sp.size / 2, sp.size, sp.size);
      ctx.restore();
    }
    if (neb.spr) { // the core beats, an outer ring turns against the wheel, a shock-ring on the downbeat, a line of light down the floor, beams in Fever
      const mega = !!fever && songComboRef.current >= megaAt(songTotalRef.current);
      drawStageFx(ctx, { W, H, hz: neb.hz, wx: wheelX, wy: wheelY, wR: wheelR, tSec, beatF, beatPhase, pulse, downbeat, fever: !!fever, mega, calm: spbNow / (songTempoRef.current || 1) < 0.34, spr: neb.spr, world: neb.world });
    }
    // Never more than 3 flashes a second (children sensitive to flashing
    // light): past 180 bpm the windows flash on every other beat.
    const flashBeat = spbNow / (songTempoRef.current || 1) >= 0.34 || (Math.floor(Math.max(0, beatF)) % 2 === 0);
    if (neb.win && pulse > 0.02 && flashBeat) { // the city's windows flash on the beat
      ctx.globalAlpha = pulse * (downbeat ? 0.7 : 0.4);
      ctx.drawImage(neb.win, 0, neb.winTop, W, neb.win.height / dpr);
      ctx.globalAlpha = 1;
    }
    if (fever) { ctx.fillStyle = "rgba(255,40,200,0.07)"; ctx.fillRect(0, 0, W, H); } // fever = the whole city overloads
    if (fever && fxLevel >= 2) { // Fever rain: streaks of light falling through the city
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(150,240,255,0.35)"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < 28; k++) {
        const rx = ((k * 0.6180339 + 0.13) % 1) * W, speed = 520 + (k % 5) * 90;
        const ry = ((tSec * speed + k * 97) % (H + 60)) - 30;
        ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 16);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
    }
    // data motes: drifting sparks in the two sign colours, fever = overdrive (top level only)
    const drift = fever ? 0.06 : 0.012;
    for (let si = 0; fxLevel >= 2 && si < songStarsRef.current.length; si++) {
      const s = songStarsRef.current[si];
      const tw = 0.5 + 0.5 * Math.sin(tSec * 1.4 + s.tw);
      ctx.globalAlpha = 0.2 + 0.55 * tw;
      ctx.fillStyle = si % 2 ? "#6ff4ff" : "#ff7ae6";
      ctx.fillRect(s.fx * W, ((s.fy + tSec * drift * s.r) % 1) * H, s.r * 1.4, s.r * 1.4);
    }
    ctx.globalAlpha = 1;
    // Each lane brightens as its next note comes in (the last half-second),
    // and the hit-line pulses on the song's beat — brighter on the downbeat.
    // (The sheet view has neither lanes nor a hit-line.)
    if (!sheet) {
      const near = new Array(nLane).fill(0);
      for (const n of notes) {
        if (n.hit || n.missed || n.skip) continue;
        const dt = n.t + SONG_LEAD - songTime;
        if (dt > 0.55) break;
        if (dt > -0.1 && n.lane < nLane) near[n.lane] = Math.max(near[n.lane], 1 - Math.max(0, dt) / 0.55);
      }
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < nLane; i++) {
        if (near[i] < 0.02) continue;
        const f = laneFrac[i], cw = f.w * W, cx = f.cx * W - cw / 2;
        ctx.globalAlpha = near[i] * 0.5;
        ctx.drawImage(laneGlowSprite(laneHue(lanes[i])), cx, hitY - H * 0.34, cw, H * 0.34);
      }
      if (beatF >= 0 && pulse > 0.02) {
        ctx.globalAlpha = pulse * (downbeat ? 0.55 : 0.3);
        ctx.fillStyle = "rgba(255,120,235,1)";
        ctx.fillRect(0, hitY - 3.5, W, 7);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
    // A note is missed once the late edge of its window has passed (the
    // window of the input the player is using, with its learned delay).
    let gemsDrawn = 0;
    const lateSrc = lastSrcRef.current;
    const lateEdge = receiveWindow(songKindRef.current, lateSrc) + (calibRef.current[lateSrc] || 0);
    for (const n of notes) {
      if (n.skip) continue; // outside the section being practised: not drawn, not graded
      const hitAt = n.t + SONG_LEAD;
      if (!pr && !n.hit && !n.missed && songTime > hitAt + lateEdge) {
        n.missed = true; songComboRef.current = 0; songMissRef.current++;
        if (songFeverRef.current) { songFeverRef.current = false; setSongFever(false); }
        songLaneFlashRef.current[n.lane] = { ok: false, until: now + 220 };
        fx(playMiss); flashJudge("miss", null, n.lane);
        // the melody guide: in kind mode the right note sounds, softly, so a
        // beginner hears what it should have been (playPianoNote keeps it out
        // of the mic's hearing)
        if (songKindRef.current) playPianoNote(n.note, 0.45, 0.3);
        if (bossOnRef.current && bossHpRef.current > 0) bossFlash("attack"); // the boss strikes back on every dropped note
      }
      if (n.hit) continue;
      if (sheet) continue;                             // the sheet view draws no falling notes: the staff is the score
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
        // the energy ribbon — its length IS the note's duration, drawn
        // additively so it glows; one bitmap per colour, stretched to fit
        ctx.globalCompositeOperation = "lighter";
        const flick = 0.85 + 0.15 * Math.sin(now / 55 + n.t * 9);
        const tailTop = top - 6;
        const rb = ribbonSprite(hue);
        ctx.globalAlpha = flick;
        ctx.drawImage(rb, mcx - rr * 0.7, tailTop, rr * 1.4, Math.max(1, hy - tailTop));
        // the glow round the crystal
        const hs = haloSprite(hue, rr);
        ctx.drawImage(hs, mcx - rr * 2.2, hy - rr * 2.2, rr * 4.4, rr * 4.4);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
      /* The crystal itself comes from a sprite cache: six shaded facets, the
         edges and the letter are a dozen path fills and a stroked glyph, and
         paying that for every note on every frame measured at a third of the
         frame rate on a throttled phone. The turn is quantised to 24 steps,
         which at this size is indistinguishable from continuous. */
      const spr = crystalSprite(hue, n.missed ? "" : pcOf(n.note), rr, spin, n.missed, noteScale, sdpr);
      ctx.drawImage(spr.cv, mcx - spr.ox, hy - spr.oy, spr.w, spr.h);
      gemsDrawn++;
    }
    gemsDrawnRef.current = gemsDrawn;
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
        fx(() => playBoom(r.big)); // 💥 the payoff
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
    // ── hit effects: the judge word and the score at the lane, sparks and
    //    rings from the hit point (see pushFx; the text is cached bitmaps) ──
    {
      const fxl = fxListRef.current;
      const sparkN = fxLevel >= 2 ? 12 : fxLevel === 1 ? 8 : 5;
      let keep = 0;
      for (let i = 0; i < fxl.length; i++) {
        const e = fxl[i], age = now - e.t0, dur = FX_DUR[e.k] || 500;
        if (age >= dur || age < 0) continue;
        fxl[keep++] = e;
        const t = age / dur;
        const f = (e.lane != null && laneFrac[e.lane]) || null;
        const lx = f ? f.cx * W : W / 2;
        const hue = f ? laneHue(lanes[e.lane]) : 300;
        if (e.k === "judge") {
          const spr = judgeSprite(e.kind, e.el, lang, sdpr);
          const ease = 1 - (1 - t) * (1 - t);
          const sc = e.kind === "perfect" ? 1 + 0.22 * Math.max(0, 1 - t * 5) : 1;
          const w = spr.w * sc, h = spr.h * sc;
          const x = Math.max(w / 2 + 2, Math.min(W - w / 2 - 2, lx));
          ctx.globalAlpha = Math.min(1, t / 0.12) * (t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1);
          ctx.drawImage(spr.cv, x - w / 2, hitY - 30 - 16 * ease - h / 2, w, h);
        } else if (e.k === "pop") {
          const ease = 1 - (1 - t) * (1 - t);
          const x = Math.max(34, Math.min(W - 34, lx));
          ctx.globalAlpha = Math.min(1, t / 0.12) * (t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1);
          drawNumberPop(ctx, e.text, e.perfect, sdpr, x, hitY - 58 - 44 * ease);
        } else if (e.k === "spark") {
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = `hsl(${hue},100%,70%)`;
          for (let k = 0; k < sparkN; k++) {
            const a = -Math.PI * (0.12 + 0.76 * ((k + 0.5) / sparkN)) + Math.sin(e.seed + k * 1.7) * 0.18;
            const sp = 90 + 70 * ((Math.sin(e.seed * 3 + k * 2.3) + 1) / 2);
            const tt = age / 1000;
            const px = lx + Math.cos(a) * sp * tt, py = hitY + Math.sin(a) * sp * tt + 260 * tt * tt;
            const r = (1 - t) * (k % 3 === 0 ? 3 : 2);
            ctx.globalAlpha = 1 - t;
            ctx.fillRect(px - r, py - r, r * 2, r * 2);
          }
          ctx.globalCompositeOperation = "source-over";
        } else if (e.k === "ring") {
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = (1 - t) * 0.9;
          ctx.strokeStyle = `hsl(${hue},100%,72%)`;
          ctx.lineWidth = 1 + 2.5 * (1 - t);
          ctx.beginPath(); ctx.arc(lx, hitY, 10 + 56 * t, 0, Math.PI * 2); ctx.stroke();
          ctx.globalCompositeOperation = "source-over"; ctx.lineWidth = 1;
        }
      }
      fxl.length = keep;
      ctx.globalAlpha = 1;
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
  /* The open note a press lands on: the exact note (pitch and octave) first —
     a two-hand song can have the melody and the accompaniment sharing a pitch
     class close together in time — then any note of its pitch class (an octave
     off still counts; a mic reading is judged tuning-aware), inside the window. */
  function dueNoteFor(d, tq, win) {
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
    return { best, bestd };
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
    // A player who taps the screen has no use for the microphone: what it hears of
    // the band or of the game's own sounds must not cost them a combo. Their mic
    // counts only when it lands on a note the music asks for right now — which a
    // real piano played beside the phone does, and a false reading almost never.
    if (src === "mic" && tappedRef.current && lastSrcRef.current === "tap") {
      const m = dueNoteFor(d, songTime - (calibRef.current.mic || 0), receiveWindow(songKindRef.current, "mic"));
      if (!m.best || !judgeOffset(m.bestd, songKindRef.current, "mic")) return;
    }
    // Debounce: one press = one note (a sustained key can re-fire the same pitch).
    if (tnow - (songDebounceRef.current[d.note] || 0) < SONG_DEBOUNCE_MS) return;
    songDebounceRef.current[d.note] = tnow;
    if (src === "tap") { songEchoRef.current[d.note] = tnow; tappedRef.current = true; } // this tap's sound will echo into the mic
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
    const { best, bestd } = dueNoteFor(d, tq, win);
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
    const waitMode = !!practiceRef.current; // practice mode: the song waited for this note
    const practice = !!(drillRef.current || (songMetaRef.current && songMetaRef.current.intro) || waitMode);
    if (waitMode) practiceRef.current.waitSince = 0;
    const cs = calibSamplesRef.current[src];
    // (a press into a waiting song says nothing about the device's delay)
    if (!waitMode && cs && cs.length < CALIB_HITS) {
      cs.push(rawOff);
      if (cs.length === CALIB_HITS) {
        const c = calibrate(cs);
        calibRef.current[src] = c;
        lsSet("tg_pa_cal_" + src, c.toFixed(3));
      }
    }
    if (!sheetOn()) songRocketsRef.current.push({ lane: best.lane, hue: laneHue(best.note), t0: now, dur: 170, big: perfect }); // launch a rocket to blow up the meteor (the sheet view has none)
    fx(playWhoosh); // 🚀 lift-off
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
    // FEVER — once the combo reaches 30% of the song's notes (at least 10),
    // score doubles until a miss, and the band adds its arpeggio.
    const totalNotes = songTotalRef.current || 0;
    if (waitMode) {
      // practice: the hit lands, no score, no Fever — just the note and its sparkle
      songLaneFlashRef.current[best.lane] = { ok: true, until: now + 220 };
      flashJudge(grade, null, best.lane);
      if (src === "midi") { playPianoNote(best.note, 0.5); songEchoRef.current[pcOf(best.note)] = performance.now(); }
      return;
    }
    if (!songFeverRef.current && combo >= feverAt(totalNotes)) { songFeverRef.current = true; setSongFever(true); fx(() => playUi("levelup")); triggerShake(); announce("🔥 FEVER!"); }
    else if (songFeverRef.current && combo === megaAt(totalNotes)) { triggerShake(); spawnBurst("combo"); spawnBurst("combo"); fx(() => playUi("levelup")); announce("🔥🔥 MEGA FEVER!"); }
    const feverMult = songFeverRef.current ? 2 : 1;
    const gained = Math.round(POINTS[grade] * comboMultOf(combo) * feverMult);
    songScoreRef.current += gained;
    pushPop("+" + gained, perfect, best.lane);     // the score, rising off the lane
    fx(() => playChordDing(bandRef.current ? bandRef.current.chordAt(best.beat || 0) : null, combo)); // a chord tone, climbing with the combo
    if (perfect) spawnBurst("perfect", best.lane);
    // combo-tier shout-outs
    if (combo % 10 === 0) { triggerShake(); spawnBurst("combo", best.lane); announce(comboWord(combo)); }
    if (!practice) {
      // combo marks at 25 / 50 / 75 / 100% of the song's notes without a
      // miss (play-along-judge COMBO_MARKS) — every song can reach all four.
      // The random coin drop on a lucky Perfect is gone: the run's rewards
      // come at the end, including its one chest.
      const bonusXp = comboMarkExp(combo, totalNotes);
      if (bonusXp) {
        gainExp(bonusXp, {});
        spawnBurst("combo", best.lane);
        const pct = Math.round(combo / Math.max(1, totalNotes) * 100);
        setSongBonus({ id: Date.now(), text: `🎯 ${pct >= 100 ? "100%" : "x" + combo} +${bonusXp} EXP!` });
        clearTimeout(songBonusT.current); songBonusT.current = setTimeout(() => setSongBonus(null), 1500);
        fx(() => playUi("levelup"));
      }
    }
    songLaneFlashRef.current[best.lane] = { ok: true, until: now + 220 };
    flashJudge(grade, perfect ? null : off < 0 ? "early" : "late", best.lane);
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
    if (practiceRef.current) {
      // practice: no cost — the right note sounds, softly, as the guide
      const lane = songLanesRef.current.findIndex(x => pcOf(x) === inPC);
      if (lane >= 0) songLaneFlashRef.current[lane] = { ok: false, until: now + 150 };
      const wait = (songNotesRef.current || []).find(n => !n.hit && !n.skip);
      if (wait && now - (practiceRef.current.guideAt || 0) > 600) { practiceRef.current.guideAt = now; playPianoNote(wait.note, 0.45, 0.3); }
      flashJudge("wrong", null, lane >= 0 ? lane : null);
      return;
    }
    songComboRef.current = 0;
    if (songFeverRef.current) { songFeverRef.current = false; setSongFever(false); }
    const lane = songLanesRef.current.findIndex(x => pcOf(x) === inPC);
    if (lane >= 0) songLaneFlashRef.current[lane] = { ok: false, until: now + 150 };
    if (kind === "wrong" || g.mash % 4 === 1) flashJudge("wrong", null, lane >= 0 ? lane : null);
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
    if (bossHpRef.current <= 0) {
      bossFlash("defeat"); fx(() => playUi("levelup"));
      if (!bossVerdictRef.current) {   // plan 2.4: one engine verdict per boss
        const hub = tigaNow();
        const hits = songHitsRef.current || 0, miss = songMissRef.current || 0;
        const v = hub ? hub.tigaHub.explainSongResult({ acc: Math.round(hits * 100 / Math.max(1, hits + miss)), stars: null, maxCombo: songMaxComboRef.current || 0, missedNotes: [], topic: 8 }, readMemory()) : null;
        bossVerdictRef.current = v && v.tip ? { id: Date.now(), text: v.tip } : null;
        setBossVerdict(bossVerdictRef.current);
      }
    }
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
      const hub = tigaNow();   // plan v3 1.5: model loads lazy — no engine yet → keep the note's own fact
      const ranked = hub && hub.tigaHub.knowledgeForNote ? hub.tigaHub.knowledgeForNote(noteName, { candidates: { [f0.pc]: f0 }, shelf }) : null;
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
    if (!bandRef.current) makeBand(songMetaRef.current, songDataRef.current);
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
    songFeverRef.current = false; setSongFever(false);
    songLaneFlashRef.current = {}; songRocketsRef.current = []; songBlastsRef.current = []; fxListRef.current = [];
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
    if (bandRef.current) bandRef.current.cut();
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
    stopBand();
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
  // The scene's hit effects (drawn by songLoop): one list, newest last.
  function pushFx(e) {
    const l = fxListRef.current;
    if (e.k === "judge" && e.lane != null) for (let i = l.length - 1; i >= 0; i--) if (l[i].k === "judge" && l[i].lane === e.lane) l.splice(i, 1); // one word per lane
    l.push(e);
    if (l.length > 40) l.shift();
  }
  function pushPop(text, perfect, lane = null) { pushFx({ k: "pop", text, perfect, lane, t0: performance.now() }); }
  // kind: perfect | great | good | miss | wrong; el: "early" | "late" | null
  function flashJudge(kind, el = null, lane = null) { pushFx({ k: "judge", kind, el, lane, t0: performance.now() }); }
  function triggerShake() { setSongShake(true); clearTimeout(songShakeT.current); songShakeT.current = setTimeout(() => setSongShake(false), 380); }
  function spawnBurst(kind, lane = null) { pushFx({ k: kind === "perfect" ? "spark" : "ring", lane, t0: performance.now(), seed: Math.random() * 6.283 }); }
  function flashGo() { setSongGo(true); clearTimeout(songGoT.current); songGoT.current = setTimeout(() => setSongGo(false), 700); }
  /* The end of a practice run: 20 EXP, nothing recorded (no stars, best,
     ghost, medal, coins, weak spots or daily quest), and the result card
     invites the real round. */
  function finishPractice() {
    const meta = songMetaRef.current, id = songIdOf(meta);
    practiceRef.current = null;
    gainExp(PRACTICE_EXP, {});
    const rm = runMetaRef.current;
    logPa(`practice:${id}:done`, rm ? performance.now() - rm.startedAt : 0);
    logFps();
    gfxRunEnd();
    runMetaRef.current = null;
    lastEndRef.current = { id, at: performance.now() };
    setSongCountdown(null); setSongNextLit(null);
    setSongStaffNotes(EMPTY_STAFF_WIN); staffBaseRef.current = null; staffSigRef.current = "";
    const g = songGradesRef.current;
    setSongResult({ practice: true, exp: PRACTICE_EXP, total: songTotalRef.current || 0, wrong: g.wrong + g.mash });
    setSongPhase("done");
  }
  function finishSong() {
    if (songFinishedRef.current) return;
    songFinishedRef.current = true;
    songRunRef.current = false;
    cancelAnimationFrame(songRafRef.current);
    clearInterval(songHudTimerRef.current);
    stopBand(true);
    stopListeners();
    const meta = songMetaRef.current;
    if (meta && meta.intro) { finishIntro(); return; }
    if (practiceRef.current) { finishPractice(); return; }
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
    // A run where nothing was really played (left to play out on its own, or
    // mashed — play-along-judge runPlayed) is not practice: it earns no EXP,
    // and it does not count toward the day's streak (which opens the daily
    // chest), the daily quest or the weekly "play N games" challenges — each
    // of those pays coins or EXP, and they are for playing, not for pressing
    // Start.
    const played = runPlayed({ hits, mash: g.mash, acc });
    // EXP by how the run went
    const reward = played ? Math.round(40 + acc * 0.4 + Math.min(maxCombo, 20) + (allPerfect ? 50 : fullCombo ? 25 : 0)) : 0;
    const prevBest = loadBest();
    const score = songScoreRef.current;
    const newBest = score > prevBest;
    const songId = songIdOf(meta);
    if (newBest) {
      try { localStorage.setItem(songKey(), String(score)); } catch (e) {} setSongBest(score);
      try { localStorage.setItem("tg_ghost_" + songId, JSON.stringify(songSamplesRef.current.slice(-240))); } catch (e) {}
    }
    const rec = recordSongResult(songId, stars, acc);
    if (played) logPractice(acc);
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
    // Coins for the run: 10 / 15 / 20 by stars, for the song's first three
    // runs of the day; after that the song still pays EXP, medals and the
    // chest, not coins (play-along-judge runCoins / RUN_COIN_RUNS).
    const runNo = countRunToday(songId);
    const coinReward = runNo <= RUN_COIN_RUNS ? runCoins(stars) : 0;
    if (coinReward) earnCoins(coinReward);
    // The song's medal (bronze → crown); each medal reached for the first
    // time pays once — coins and EXP, through the same channels as the rest.
    const medal = recordMedal(songId, medalOf({ stars, fullCombo, tempo: songTempoRef.current || 1 }));
    let medalCoins = 0, medalExp = 0;
    for (const t of medal.gained) { medalCoins += MEDAL_REWARD[t].coins; medalExp += MEDAL_REWARD[t].exp; }
    if (medalCoins) earnCoins(medalCoins);
    if (medalExp) gainExp(medalExp, {});
    if (played) bumpWeekly("games", 1);
    if (perfects) bumpWeekly("perfect", perfects);
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
      medal: medal.now, medalNew: medal.gained, medalCoins, medalExp, runNo, coinCapped: runNo > RUN_COIN_RUNS && stars >= 1,
      // 12.2: the mood taps write ONE row per song per run — reset now
      moodLogged: false,
      // only present once every song in a setlist has finished — the concert's
      // combined numbers, for a dedicated recap treatment on the result screen
      setlist: setlistDone ? songSetlistLogRef.current.slice() : null,
    });
    reportPvpResult({ score, acc, stars }); // online PvP: my final result → the room (decides the winner on both sides)
    // TIGA hub: real-data coach line for this run (what engine answered shows
    // in the badge). Real MIDI velocity/timing evidence rides along; — never invents.
    try {
  const hub = tigaNow();
  if (!hub) setSongTigaTip(null);
  else {
    const tip = hub.tigaHub.explainSongResult({ acc, stars, maxCombo, missedNotes, dyn: scoreDynamics(songVelsRef.current), timing: (songTimingRef.current.ok + songTimingRef.current.miss >= 3) ? songTimingRef.current : null, topic: 8 }, readMemory());
    // plan v3.4 6.3: the KB-grounded one-step-up next-song advice rides on the same card
    const next = hub.tigaNextSongAdvice ? hub.tigaNextSongAdvice(readMemory(), lang) : null;
    setSongTigaTip(next ? { ...tip, nextSong: next } : tip);
  }
} catch (e) { setSongTigaTip(null); }
    if (played) gainExp(reward, { quest: true });
    // One chest at the end, its chance by stars (5 / 10 / 20%) — it replaced
    // the lucky-Perfect coins, the 20% mystery chest and the 15% lucky EXP.
    if (Math.random() < chestChance(stars)) {
      const chestRewards = [[50,5,"💎"],[100,10,"🎁"],[75,8,"⭐"],[150,15,"🏆"],[30,3,"🎵"]];
      const [cxp, ccoins, cicon] = chestRewards[Math.floor(Math.random() * chestRewards.length)];
      setTimeout(() => {
        gainExp(cxp, {}); earnCoins(ccoins);
        setMysteryChest({ xp: cxp, coins: ccoins, icon: cicon });
        fx(() => playUi("levelup"));
      }, 2200);
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
    if (rm && !rm.intro) { logPa(`end:${songId}:${stars}:${acc}:${medal.gained.length ? medal.now : 0}`, performance.now() - rm.startedAt); logFps(); }
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
      const analysis = await analyzeSongRun(lang, label, result, (stats, opts) => queuedUntilTiga(m => m.runTeachingLoopForPractice(stats, opts)), ({ system, message }) =>
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
  /* While a song waits on the ready screen, the stage's world (sky, city, floor) is painted in the browser's idle time,
     one slice at a time, for the size the stage had when a run last began on this screen, in this view (readStageSize), so that pressing
     Start finds it done. play-along-stage.ts keeps it, and what is half painted, for the next visit; a song only adds its lanes. */
  useEffect(() => {
    if (!songOpen || songPhase !== "ready") return;
    const hasIdle = typeof requestIdleCallback === "function";
    let dead = false, h = null;
    const idle = (fn) => { h = hasIdle ? requestIdleCallback(fn, { timeout: 700 }) : setTimeout(fn, 80); };
    const slice = () => {
      if (dead) return;
      const size = readStageSize(playAlongHand, sheetOn());
      if (!size) return;                                                   // a screen this app has not run a song on yet
      const dpr = Math.min(GFX_TIERS[gfxRef.current.tier], window.devicePixelRatio || 1);
      let world = null;
      try { world = paintWorld(size[0], size[1], dpr, !reducedMotion() && gfxRef.current.tier === 0, 1); } catch (e) { return; }
      if (!world) idle(slice);
    };
    idle(slice);
    return () => { dead = true; if (h != null) { try { hasIdle ? cancelIdleCallback(h) : clearTimeout(h); } catch (e) {} } };
  }, [songOpen, songPhase, playAlongHand, songView]);
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
    pauseSong, resumeSong, restartSong, playAgain, playNext, nextSongFor, songKind, setSongKind, songAccomp, setSongAccomp, songView, setSongView, songBand, setSongBand, songFx, setSongFx, songPractice, songGfx, setSongGfx,
    songIntro, startIntro, skipIntro,
    drillPlan, drillActive, drillCleared, startDrill, endDrill, bossOn, bossMax, kShelfOpen, setKShelfOpen, kShelf, openKnowledgeShelf };
}

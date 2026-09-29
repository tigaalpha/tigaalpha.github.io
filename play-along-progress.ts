/* ── play-along-progress.ts ──
   What a player has earned in Play Along, per song, and what is open to
   them: best stars and best accuracy under the current scoring rules, the
   unlock rule, the song's length, today's daily song and the next song to
   suggest. Plain localStorage reads and writes, no React.

   Stars live in their own numeric keys (tg_stars_<id>, tg_acc_<id>) so the
   account sync can merge them with its "max" rule — the same way it already
   merges tg_best_ — without any change to the stored shape. ── */
import { SONGS, SONG_TIMESIG } from "./songs-data";
import { isMaxPlan } from "./payment";
import { ymd } from "./shared-infra";
import { readMemory } from "./ai-chat-context";
import { tigaNow } from "./tiga-gateway";   // plan v3 1.5: tigamodel loads lazy — a null hub before it lands means the day-hash picks, same as before

export const SONG_REQ = { 1: 1, 2: 2, 3: 4 };   // player level needed, by difficulty

const num = (k) => { try { const v = Number(localStorage.getItem(k)); return isFinite(v) ? v : 0; } catch (e) { return 0; } };

export function songStars(id) { return Math.max(0, Math.min(3, num("tg_stars_" + id))); }
export function songMedal(id) { return Math.max(0, Math.min(4, num("tg_medal_" + id))); }
/* A medal only ever goes up. Returns the tiers reached for the first time
   (each pays once — see MEDAL_REWARD in play-along-judge.ts). */
export function recordMedal(id, tier) {
  const prev = songMedal(id);
  if (tier <= prev) return { prev, now: prev, gained: [] };
  try { localStorage.setItem("tg_medal_" + id, String(tier)); } catch (e) {}
  const gained = [];
  for (let t = prev + 1; t <= tier; t++) gained.push(t);
  return { prev, now: tier, gained };
}
/* Runs of each song finished today ({d, <songId>: n}), for the coin limit. */
export function countRunToday(id) {
  const d = todayKey();
  let st = {};
  try { st = JSON.parse(localStorage.getItem("tg_pa_runs") || "{}") || {}; } catch (e) {}
  if (st.d !== d) st = { d };
  st[id] = (+st[id] || 0) + 1;
  try { localStorage.setItem("tg_pa_runs", JSON.stringify(st)); } catch (e) {}
  return st[id];
}
export function songBestAcc(id) { return Math.max(0, Math.min(100, num("tg_acc_" + id))); }

/* Keeps the best of each; reports whether this run raised the stars. */
export function recordSongResult(id, stars, acc) {
  const prevStars = songStars(id), prevAcc = songBestAcc(id);
  try {
    if (stars > prevStars) localStorage.setItem("tg_stars_" + id, String(stars));
    if (acc > prevAcc) localStorage.setItem("tg_acc_" + id, String(acc));
  } catch (e) {}
  return { prevStars, prevAcc, newStars: stars > prevStars };
}

export function songLockInfo(song, level, plan) {
  if (!song || song.custom) return { locked: false, maxLocked: false, req: 1 };
  const req = SONG_REQ[song.diff] || 1;
  return { locked: (level || 1) < req, maxLocked: !!song.maxOnly && !isMaxPlan(plan), req };
}
export function songPlayable(song, level, plan) {
  const l = songLockInfo(song, level, plan);
  return !l.locked && !l.maxLocked;
}

/* Seconds at the song's own tempo — the count-in is not part of it. */
export function songLengthSec(song) {
  if (!song || !Array.isArray(song.seq) || !song.bpm) return 0;
  const beats = song.seq.reduce((a, x) => a + (Number(x[1]) || 0), 0);
  return Math.round(beats * 60 / song.bpm);
}
export function beatsPerBarOf(song) {
  const ts = (song && SONG_TIMESIG[song.id]) || "4/4";
  return parseInt(String(ts).split("/")[0], 10) || 4;
}

/* ── Daily song ──
   Picked ONCE per day and written down with the day's state, so the song on
   the card is the song that pays. It used to be re-derived after every run
   from a record the run had just changed, so the pick moved away from the
   song that was just finished and the quest never paid out. The day follows
   the app's one daily-reset clock (ymd), same as the streak and gift box. */
const DAILY_KEY = "tg_daily_song";
export const DAILY_SONG_REWARD = { coins: 30, exp: 60 };
export function todayKey() { return ymd(new Date()); }

export function readDailyState() {
  const d = todayKey();
  try {
    const raw = JSON.parse(localStorage.getItem(DAILY_KEY) || "null");
    if (raw && raw.d === d) return raw;
  } catch (e) {}
  return { d, id: null, done: false, stars: 0 };
}
function writeDailyState(st) { try { localStorage.setItem(DAILY_KEY, JSON.stringify(st)); } catch (e) {} }

export function dailySong(level, plan) {
  const st = readDailyState();
  const fixed = st.id && SONGS.find(s => s.id === st.id);
  if (fixed) return fixed;
  const open = SONGS.filter(s => songPlayable(s, level, plan));
  const pool = open.length ? open : SONGS.filter(s => !s.maxOnly);
  const starMap = {};
  for (const s of pool) starMap[s.id] = songStars(s.id);
  let pick = null;
  try {
    const hub = tigaNow();
    const rec = hub && hub.tigaHub ? hub.tigaHub.recommendDailySong(pool, { memory: readMemory(), practiceLog: {}, starMap, dayKey: st.d }) : null;
    if (rec && rec.song && pool.includes(rec.song)) pick = rec.song;
  } catch (e) { /* hub absent → the day hash below */ }
  if (!pick) {
    const fresh = pool.filter(s => starMap[s.id] < 3);
    const list = fresh.length ? fresh : pool;
    let h = 0; for (let i = 0; i < st.d.length; i++) h = (h * 31 + st.d.charCodeAt(i)) | 0;
    pick = list[Math.abs(h) % list.length] || null;
  }
  if (pick) writeDailyState({ ...st, id: pick.id });
  return pick;
}

/* Called when a song finishes. Pays at most once a day, and only for the
   day's song played to at least one star — letting it run with no keys
   pressed is not playing it. Returns true when the reward should be paid. */
export function claimDaily(songId, stars) {
  const st = readDailyState();
  if (!st.id || st.id !== songId) return false;
  if (st.done) {
    if (stars > (st.stars || 0)) writeDailyState({ ...st, stars });
    return false;
  }
  if (stars < 1) return false;
  writeDailyState({ ...st, done: true, stars });
  return true;
}

/* The song "Next song" opens: today's song while it is still unpaid, else the
   next open song after this one (same difficulty first) that is short of 3
   stars, else any open song. Never a locked one, never this one. */
export function nextSongAfter(song, level, plan, { skipDaily = false } = {}) {
  const st = readDailyState();
  // skipDaily: the song list shows the day's song on its own card already
  const open = SONGS.filter(s => songPlayable(s, level, plan) && (!song || s.id !== song.id) && !(skipDaily && s.id === st.id));
  if (!open.length) return null;
  if (!skipDaily && st.id && !st.done) { const d = open.find(s => s.id === st.id); if (d) return d; }
  const idx = song ? SONGS.findIndex(s => s.id === song.id) : -1;
  const after = idx >= 0 ? SONGS.slice(idx + 1).concat(SONGS.slice(0, idx)) : SONGS;
  const pickFrom = (arr) => arr.find(s => open.includes(s) && songStars(s.id) < 3);
  const sameDiff = song ? after.filter(s => s.diff === song.diff) : after;
  return pickFrom(sameDiff) || pickFrom(after) || open[0];
}

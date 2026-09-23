import { sb } from "./supabase-client";

/* ── cloud-sync.ts ──
   Two-way sync of the learner's localStorage learning state (pathway
   progress, SRS schedule, learner memory, best scores, favorites, activity
   log, user songs...) to Supabase, so progress survives device switches and
   cache clears — and the business finally has the real per-learner data the
   AI features are supposed to run on.

   Design (see supabase-cloud-state-sync-migration.sql for the server side):
   * One cloud row per user per key; conflicts resolve per-key by the
     CLIENT's wall clock (client_ts) — last write wins.
   * This module detects local changes by POLLING raw localStorage strings
     (no wrapping localStorage — too invasive across 40+ call sites). Raw
     string diffing is cheap: getItem only, no JSON.parse until a change.
   * On pull, value-level merging is SHAPE-AWARE per key (union of done-sets,
     max of best-scores/counters, per-topic SRS merge...). Every merge that
     actually changes local state is immediately re-pushed, so the server
     converges.
   * All numeric counters merge by MAX, never sum: max is idempotent across
     devices that share history, sum can double-count the same sessions.
   * Every failure is silently swallowed — this must never degrade the
     learner experience or block the UI. If the RPC doesn't exist yet
     (migration not applied), sync stays off without a crash.

   Device-local keys with a server-side home are excluded (coins/streak/
   premium/plan live in `profiles` and are already handled by the existing
   merge-on-login paths); guest state stays device-local by design. ── */

/* ═══════════ per-key strategy config ═══════════
   union      array of values            → concat + dedupe by JSON string
   objunion   {k: v}                     → union of keys (arrays per key also union)
   objmax     {k: number}                → per-key Math.max (best scores / counters)
   objmerge   {k: obj}                   → per-key LWW by embedded ts (lastDone/updated/t) else row ts
   max        scalar number              → Math.max
   lww        scalar                     → newer client_ts wins
   usage      {d: day, k: count}         → d last-write-wins, counters max
   pathacc    {stageId: {best,last,lastAt,interval,nextDue}} → per-stage: best
              never regresses, scheduling fields take the newer attempt
   memory     {struggles[],mastered[],recent[],lastSession,sessions}
   practicelog {date: {n,accSum,exp}, _recent[]} → per-date max + _recent union-by-day
*/
const STRATEGY: Record<string, string> = {
  // sets / arrays of ids
  tg_path_done: "union",
  tg_owned: "union",
  tg_favs: "union",
  tg_kru: "union",
  tg_mysongs: "union",             // user-created songs
  tg_act_log: "union",             // unified activity journal (see shared-infra)
  tg_game_log: "union",            // per-play falling-notes game log
  // {id: true/1} favorite maps
  tg_vidfavs: "objunion",
  // best-score / counter objects
  tg_readcourse: "objmax",         // {level: stars}
  tg_eargym: "objmax",             // {game: best}
  tg_exam: "objunion",             // {examId: [done task indexes]}
  tg_note_miss: "objmax",          // {pitchClass: cumulative misses}
  tg_usage: "usage",               // {d: day, key: count}
  // {stage: [key ids]}
  tg_key_done: "objunion",
  // composite objects
  tg_path_acc: "pathacc",          // per-stage best accuracy + SM-2-lite review schedule (unified SRS)
  tg_memory: "memory",             // learner memory (ai-chat-context)
  tg_practice_log: "practicelog",  // per-day practice stats
  // scalar last-write-wins
  tg_last_song: "lww",
  tg_vmvoice: "lww",
  tg_vmpoly: "lww",
  tg_skill_snap_month: "lww",
  tg_freeze_month: "lww",
  tg_chest_date: "lww",
  tg_chest_streak: "lww",
  tg_today_bonus: "lww",
  tg_hw_done: "lww",
  tg_welcomed: "lww",
  tg_permprimed: "lww",
  tg_push_primed: "lww",
  tg_push_banner_seen: "lww",
  tg_install_banner_seen: "lww",
  tg_apk_banner_seen: "lww",
  tg_gamelog_id_fix: "lww",
  tg_weekly: "lww",
  tg_goal: "lww",
  tg_event: "lww",
  tg_homework: "lww",
  tg_lessonplan: "lww",
};
// dynamic-suffix keys (song id appended)
const PREFIX_STRATEGY: Record<string, string> = {
  tg_best_: "max",     // best accuracy % per song (scalar number)
  tg_ghost_: "union",  // per-song ghost-note samples (array)
};
// keys that have a server-side home or are device/guest-local — never synced
const EXCLUDE = new Set([
  "tg_coins", "tg_streak", "tg_premium", "tg_plan",
  "tg_guest_profile", "tg_guest_ms", "tg_sync_meta",
]);
// post-merge caps (match the app's own slice() caps)
const CAPS: Record<string, number> = {
  tg_act_log: 1500, tg_game_log: 80, tg_mysongs: 200, tg_owned: 500,
  tg_ghost_: 240,
};

const META_KEY = "tg_sync_meta";
const POLL_MS = 20000;

let uid: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let lastRaw = new Map<string, string>(); // key -> raw localStorage string ("" = absent)
let dirty = new Map<string, number>();   // key -> client_ts ms when change detected
let inFlight = false;
let rerun = false;
let firstPullDone = false;

/* ── helpers ── */
function strategyOf(k: string): string | null {
  if (STRATEGY[k]) return STRATEGY[k];
  for (const p of Object.keys(PREFIX_STRATEGY)) if (k.startsWith(p)) return PREFIX_STRATEGY[p];
  return null;
}
function isSyncedKey(k: string): boolean {
  if (!k || !k.startsWith("tg_")) return false;
  if (EXCLUDE.has(k)) return false;
  return strategyOf(k) !== null;
}
function capOf(k: string): number | null {
  if (CAPS[k] != null) return CAPS[k];
  for (const p of Object.keys(CAPS)) if (k.startsWith(p)) return CAPS[p];
  return null;
}
function safeGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch (e) { return null; }
}
function safeSet(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch (e) {}
}
function safeRemove(k: string) {
  try { localStorage.removeItem(k); } catch (e) {}
}
function parseRaw(raw: string | null): any {
  if (raw === null || raw === "") return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}
function readMeta(): Record<string, { ts: number }> {
  try { return JSON.parse(localStorage.getItem(META_KEY) || "{}") || {}; } catch (e) { return {}; }
}
function writeMeta(meta: Record<string, { ts: number }>) {
  try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {}
}
function localWriteTs(k: string): number {
  const m = readMeta();
  return (m[k] && m[k].ts) || 0;
}
// FNV-1a hash of a raw localStorage string — lets the next login detect
// changes that happened while the app was closed (no poll ran), and tell
// them apart from values that were already pushed.
function hashOf(raw: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(36);
}
function dedupe(arr: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const x of arr) {
    const id = x && typeof x === "object" ? JSON.stringify(x) : "s:" + String(x);
    if (!seen.has(id)) { seen.add(id); out.push(x); }
  }
  return out;
}
const num = (v: any): number => (typeof v === "number" && isFinite(v) ? v : 0);

/* ── merge implementations (all idempotent — safe to apply repeatedly) ── */
function mergeUnion(a: any, b: any): any[] {
  const c = dedupe([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]);
  return c;
}
function mergeObjUnion(a: any, b: any): any {
  const out: any = {};
  for (const k of Object.keys(a || {})) out[k] = a[k];
  for (const k of Object.keys(b || {})) {
    if (!(k in out)) out[k] = b[k];
    else if (Array.isArray(out[k]) && Array.isArray(b[k])) out[k] = dedupe([...out[k], ...b[k]]);
    // else keep existing value (boolean/flag maps: true already wins)
  }
  return out;
}
function mergeObjMax(a: any, b: any): any {
  const out: any = {};
  for (const k of Object.keys(a || {})) out[k] = a[k];
  for (const k of Object.keys(b || {})) out[k] = Math.max(num(out[k]), num(b[k]));
  return out;
}
function mergeObjMerge(a: any, b: any, rowTsA: number, rowTsB: number): any {
  const subTs = (v: any): number => {
    if (v && typeof v === "object") {
      for (const f of ["lastDone", "updated_at", "updated", "t"]) {
        if (typeof v[f] === "number" || typeof v[f] === "string") { const n = +v[f]; if (n) return n; }
      }
    }
    return 0;
  };
  const out: any = {};
  for (const k of Object.keys(a || {})) out[k] = a[k];
  for (const k of Object.keys(b || {})) {
    if (!(k in out)) out[k] = b[k];
    else if (subTs(b[k]) || rowTsB > (subTs(a[k]) || rowTsA)) out[k] = b[k];
  }
  return out;
}
function mergeUsage(a: any, b: any): any {
  const out: any = {};
  for (const k of Object.keys(a || {})) out[k] = a[k];
  for (const k of Object.keys(b || {})) {
    if (k === "d") { if (!("d" in out)) out.d = b.d; }
    else out[k] = Math.max(num(out[k]), num(b[k]));
  }
  return out;
}
// normalizes a per-stage record that might still be in the pre-unification
// shape (a bare best-accuracy number) — same migration pathAccMap() does on
// local reads, needed here too since a cloud row can predate that migration.
function normPathAcc(v: any): any {
  if (typeof v === "number") return { best: v, last: v, lastAt: 0, interval: 0, nextDue: 0 };
  return v || { best: 0, last: 0, lastAt: 0, interval: 0, nextDue: 0 };
}
function mergePathAcc(a: any, b: any): any {
  const out: any = {};
  for (const k of Object.keys(a || {})) out[k] = normPathAcc(a[k]);
  for (const k of Object.keys(b || {})) {
    const av = out[k], bv = normPathAcc(b[k]);
    if (!av) { out[k] = bv; continue; }
    // best (the tier badge) never regresses regardless of which side is
    // newer; the review-scheduling fields take whichever attempt actually
    // happened more recently, since that's the one that should drive when
    // it's next due.
    const newer = (bv.lastAt || 0) > (av.lastAt || 0) ? bv : av;
    out[k] = { ...newer, best: Math.max(av.best || 0, bv.best || 0) };
  }
  return out;
}
function mergeMemory(a: any, b: any): any {
  const a0 = a && typeof a === "object" ? a : {};
  const b0 = b && typeof b === "object" ? b : {};
  const byLabel = (arr: any[]) => { const m: any = {}; for (const s of arr || []) if (s && s.label) m[s.label] = s; return m; };
  const struggles = Object.values(byLabel([...(a0.struggles || []), ...(b0.struggles || [])]))
    .sort((x: any, y: any) => (y.last || 0) - (x.last || 0)).slice(0, 6);
  const recentM: any = {};
  for (const r of [...(a0.recent || []), ...(b0.recent || [])]) {
    if (r && r.label) { const ex = recentM[r.label]; if (!ex || (r.t || "") > (ex.t || "")) recentM[r.label] = r; }
  }
  return {
    struggles,
    mastered: dedupe([...(a0.mastered || []), ...(b0.mastered || [])]).slice(0, 12),
    recent: Object.values(recentM).slice(0, 12),
    lastSession: Math.max(a0.lastSession || 0, b0.lastSession || 0) || undefined,
    sessions: Math.max(a0.sessions || 0, b0.sessions || 0),
  };
}
function mergePracticeLog(a: any, b: any): any {
  const ak = a && typeof a === "object" ? a : {};
  const bk = b && typeof b === "object" ? b : {};
  const out: any = {};
  for (const k of Object.keys(ak)) if (k !== "_recent") out[k] = { ...ak[k] };
  for (const k of Object.keys(bk)) {
    if (k === "_recent") continue;
    const av = out[k], bv = bk[k];
    if (!av) out[k] = { ...bv };
    else for (const f of ["n", "accSum", "exp"]) if (typeof bv[f] === "number") av[f] = Math.max(num(av[f]), num(bv[f]));
  }
  const dayM: any = {};
  for (const r of [...(ak._recent || []), ...(bk._recent || [])]) if (r && r.d) dayM[r.d] = r;
  out._recent = Object.values(dayM).slice(-30);
  return out;
}
function mergeByMode(mode: string, local: any, cloud: any, localTs: number, cloudTs: number): any {
  if (cloud === null && local !== null) return null; // tombstone: key was deleted
  switch (mode) {
    case "union": return mergeUnion(local, cloud);
    case "objunion": return mergeObjUnion(local, cloud);
    case "objmax": return mergeObjMax(local, cloud);
    case "objmerge": return mergeObjMerge(local, cloud, localTs, cloudTs);
    case "usage": return mergeUsage(local, cloud);
    case "pathacc": return mergePathAcc(local, cloud);
    case "memory": return mergeMemory(local, cloud);
    case "practicelog": return mergePracticeLog(local, cloud);
    case "max": return Math.max(num(local), num(cloud));
    default: return null; // unreachable
  }
}

/* ═══════════ polling (detect local changes by raw-string diff) ═══════════ */
function allSyncedKeys(): string[] {
  const set = new Set<string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isSyncedKey(k)) set.add(k);
    }
  } catch (e) {}
  for (const k of lastRaw.keys()) set.add(k); // keys that just disappeared
  return [...set];
}
function poll() {
  if (!uid) return;
  const now = Date.now();
  let changed = false;
  for (const k of allSyncedKeys()) {
    const raw = safeGet(k) || "";
    if (raw !== (lastRaw.get(k) || "")) {
      dirty.set(k, now);
      lastRaw.set(k, raw);
      const meta = readMeta();
      meta[k] = { ts: now, h: hashOf(raw) };
      writeMeta(meta);
      changed = true;
    }
  }
  if (changed && dirty.size) schedulePush();
}

/* ═══════════ pull + merge cloud rows into local ═══════════ */
function applyPull(rows: any[]) {
  for (const row of rows || []) {
    const k = row && row.key;
    if (!k || !isSyncedKey(k)) continue;
    const mode = strategyOf(k)!;
    const cloudVal = row.value === null ? null : row.value;
    const cloudTs = row.client_ts ? new Date(row.client_ts).getTime() : 0;
    const localRaw = safeGet(k);
    const localVal = parseRaw(localRaw);
    const localTs = localWriteTs(k);

    let merged: any;
    if (mode === "lww") {
      // scalar: prefer newer; an untracked local value (no meta yet) is kept
      if (cloudVal === null) { if (cloudTs > localTs) { safeRemove(k); lastRaw.set(k, ""); const m = readMeta(); delete m[k]; writeMeta(m); } continue; }
      if (localRaw === null) merged = cloudVal;
      else if (cloudTs > localTs) merged = cloudVal;
      else continue;
    } else if (mode === "max") {
      merged = mergeByMode("max", localVal === null ? 0 : localVal, cloudVal === null ? 0 : cloudVal, localTs, cloudTs);
    } else {
      if (cloudVal === null && localVal === null) continue; // both absent — nothing to restore
      merged = mergeByMode(mode, localVal, cloudVal === null ? null : cloudVal, localTs, cloudTs);
      if (merged === null && cloudVal === null) {
        // local deleted + cloud deleted → stay deleted
        continue;
      }
    }
    if (merged === null) { if (localRaw !== null) { safeRemove(k); lastRaw.set(k, ""); const m = readMeta(); delete m[k]; writeMeta(m); } continue; }
    const cap = capOf(k);
    if (cap && Array.isArray(merged)) merged = merged.slice(-cap);
    const raw = JSON.stringify(merged);
    if (raw !== (localRaw || "")) {
      safeSet(k, raw);
      lastRaw.set(k, raw);
      const now = Date.now();
      dirty.set(k, now);
      const meta = readMeta();
      meta[k] = { ts: now, h: hashOf(raw) };
      writeMeta(meta);
    }
  }
}

/* ═══════════ push dirty keys ═══════════ */
function schedulePush() {
  if (!uid || !dirty.size) return;
  if (inFlight) { rerun = true; return; }
  pushNow();
}
async function pushNow() {
  if (!uid || !dirty.size) { inFlight = false; return; }
  inFlight = true;
  const payload: any = {};
  const sentRaw: Record<string, string | null> = {};
  for (const [k, ts] of dirty) {
    const raw = safeGet(k);
    sentRaw[k] = raw;
    payload[k] = { v: raw === null ? null : parseRaw(raw), ts };
  }
  if (!Object.keys(payload).length) { dirty.clear(); inFlight = false; return; }
  try {
    const { data, error } = await sb.rpc("sync_cloud_state", { p_updates: payload });
    if (error) throw error;
    applyPull(data || []);
    // a key whose local value changed during the round trip (a merge or a
    // concurrent local write) stays dirty for the next cycle; the rest are
    // now in sync — stamp them in meta so the one-time full backup (below)
    // doesn't re-push them on every login
    const meta = readMeta();
    for (const k of Object.keys(payload)) {
      const cur = safeGet(k);
      if (cur !== sentRaw[k]) dirty.set(k, Date.now());
      else { dirty.delete(k); meta[k] = { ts: payload[k].ts, h: hashOf(sentRaw[k] || "") }; }
    }
    writeMeta(meta);
  } catch (e) {
    // offline / RPC missing / anything — leave dirty for the next retry
  }
  inFlight = false;
  if (rerun) { rerun = false; schedulePush(); }
}

/* ═══════════ lifecycle ═══════════ */
export function startCloudSync(userId: string) {
  if (!userId) return;
  if (uid === userId) return; // already running for this user
  stopCloudSync();
  uid = userId;
  dirty.clear();
  lastRaw = new Map();
  // seed lastRaw so pre-existing local data doesn't read as "changed"
  for (const k of allSyncedKeys()) lastRaw.set(k, safeGet(k) || "");
  // pull everything once (empty payload = pure pull), then start watching
  pullNow();
  timer = setInterval(poll, POLL_MS);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("beforeunload", onPageHide);
}
export function stopCloudSync() {
  flushCloudSync();
  uid = null;
  if (timer) { clearInterval(timer); timer = null; }
  if (typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onVisibility);
  }
  window.removeEventListener("pagehide", onPageHide);
  window.removeEventListener("beforeunload", onPageHide);
}
export function flushCloudSync() {
  if (!uid) return;
  poll();
  if (dirty.size && !inFlight) pushNow();
}
function onVisibility() {
  if (document.visibilityState === "hidden") flushCloudSync();
  else if (document.visibilityState === "visible") poll();
}
function onPageHide() { flushCloudSync(); }
async function pullNow() {
  if (!uid) return;
  try {
    const { data, error } = await sb.rpc("sync_cloud_state", { p_updates: {} });
    if (error) throw error;
    applyPull(data || []);
  } catch (e) { /* offline or RPC not deployed yet — retried on next poll */ }
  if (!firstPullDone) {
    firstPullDone = true;
    // one-time FULL BACKUP per device: keys with no meta entry were written
    // before the sync feature existed (or a previous backup failed offline) —
    // push them now so the cloud gets a complete copy, not just the diffs
    // detected this session. Successfully-pushed keys get meta-stamped in
    // pushNow, so this only re-fires for keys that genuinely never synced.
    const meta = readMeta();
    const now = Date.now();
    for (const k of allSyncedKeys()) {
      const raw = safeGet(k) || "";
      const mk = meta[k];
      // never synced before, or changed while the app was closed (hash drift) →
      // push it so the cloud converges; successfully-pushed keys get a fresh
      // meta stamp in pushNow, so this only re-fires when genuinely needed
      if (!mk || (mk.h && mk.h !== hashOf(raw))) dirty.set(k, now);
    }
  }
  if (dirty.size) schedulePush();
}

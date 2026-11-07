import { sb } from "./supabase-client";

/* ── cloud-sync.ts ──
   Two-way sync of everything that BELONGS TO THE PLAYER (learning progress, games,
   cosmetics, saved songs, settings that describe the person and not the phone) to
   Supabase, so the player can pick up any device and find the same app
   (owner, 2026-11-05: "ผู้เล่นย้ายไปเครื่องไหน ข้อมูลทั้งหมดใน TIGA ALPHA ต้องตามไปด้วย").

   Design (server side: supabase-cloud-state-sync-migration.sql, unchanged — no new SQL):
   * One cloud row per user per key (jsonb, key <= 64 chars); the server keeps the row with
     the newer client_ts and returns every row on every call. ALL real merging happens here,
     per key, by SHAPE (see "strategies").
   * Local changes are found by POLLING raw localStorage strings (no wrapping of
     localStorage: 40+ call sites). A pull merges, then re-pushes whatever differs.
   * What is NEVER synced is written down in this file (EXCLUDE / LOCAL_ONLY / SERVER_HOMED)
     and `classify(key)` + scripts/smoke-cloud-sync-registry.mjs fail the build checks when a
     new tg_ key is added without a decision. Money, plan, EXP, gems, streak, Game Power,
     PvP rank / season, tokens, device preferences, test flags and caches stay out.
   * Rule for anything that pays out or limits a reward (daily caps, once-only claims):
     a cloud value can only TIGHTEN local state (raise a counter, set a claimed flag) and a
     day more than 1 day from today is ignored — never loosen it.
   * Every failure is silent and never blocks the UI. If the RPC is missing sync stays off.

   Strategies (all merges are idempotent: applying the same pull twice changes nothing):
     union / objunion / objmax / nestmax / objmin / max / objmerge   sets and best-of numbers
     lww        scalar or whole object, newer client_ts wins
     flag       one-time marker: any truthy value wins and is never reverted
     maxstr     day / month marker: the later day wins (future days ignored)
     dayrec     day-keyed record (daily caps): later day wins, same day only tightens
     unionsort  time-ordered capped list: dedupe, sort by time, keep the newest `cap`
     set3       three-way set against the last synced base, so a deletion sticks
     pncounter  soft currency: per-device earned/spent ledger (two devices both keep their earnings)
     practicebest / ghostbest / kstats / recbest / pathacc / memory / practicelog / ahcamp / petpath
     group      values that only make sense together (daily chest, pets)
     packmax    per-song numbers, packed into ONE cloud row per family (tg_pk_*) */

/* ═══════════ the registry ═══════════ */
type Mode = string;
const STRATEGY: Record<string, Mode> = {
  // ── learning ──
  tg_path_done: "union", tg_owned: "union", tg_boss_done: "union", tg_cert_claimed: "union", tg_case_read: "union",
  tg_video_paid: "union",
  tg_key_done: "objunion", tg_exam: "objunion", tg_conv_seen: "objunion", tg_edu_seen: "objunion", tg_chat_badges: "objunion",
  tg_readcourse: "objmax", tg_eargym: "objmax", tg_note_miss: "objmax", tg_item_lv: "objmax", tg_skl_lv: "objmax",
  tg_skillsp: "objmax", tg_chat_know: "objmax", tg_sight_best_sprint: "objmax", tg_sight_best_streak: "objmax",
  tg_teacher_outcome_ts: "objmax", tg_adv_ship_car: "objmax",
  tg_note_miss_d: "nestmax", tg_pvp_weak: "nestmax",
  tg_read_besttime: "objmin",
  tg_sight_total: "max", tg_eargym_ladder: "max", tg_proof_last: "max",
  tg_plan_tempo: "objmerge",
  tg_path_acc: "pathacc", tg_memory: "memory", tg_practice_log: "practicelog", tg_practice_best: "practicebest", tg_kstats: "kstats",
  tg_act_log: "unionsort", tg_song_mood: "unionsort", tg_game_log: "unionsort", tg_atip_outcomes: "unionsort",
  tg_autoteach_log: "unionsort", tg_camhistory: "unionsort", tg_learning_traj: "unionsort", tg_plan_fx: "unionsort",
  tg_reportcards: "unionsort", tg_self_reports: "unionsort", tg_kdrops: "unionsort", tg_chat_days: "unionsort",
  // ── daily limits and once-a-day claims (only ever TIGHTENED, see dayrec) ──
  tg_adv_q: "dayrec", tg_chat_quest: "dayrec", tg_chat_stats: "dayrec", tg_daily_song: "dayrec", tg_adv_coin_day: "dayrec",
  tg_ah_coin_day: "dayrec", tg_earn_day: "dayrec", tg_game_day: "dayrec", tg_sell_day: "dayrec", tg_tts_day: "dayrec",
  tg_pettrain: "dayrec", tg_trace_state: "dayrec", tg_usage: "dayrec", tg_pa_runs: "dayrec",
  tg_weekly: "dayrec", tg_memory_streak: "dayrec", tg_posture_streak: "dayrec",
  tg_today_bonus: "maxstr", tg_hw_done: "maxstr", tg_skill_snap_month: "maxstr",
  tg_chest_date: "group", tg_chest_streak: "group",
  // ── saved things the player can delete (a deletion must stick) ──
  tg_favs: "set3", tg_mysongs: "set3", tg_vidfavs: "set3",
  // ── one-time markers ──
  tg_adv_finale: "flag", tg_adv_seen: "flag", tg_adv_howto: "flag", tg_adv_tip: "flag", tg_adv_prologue: "flag",
  tg_charModelSet: "flag", tg_pa_intro: "flag", tg_pvp_tut_seen: "flag", tg_paid_activated: "flag", tg_song_gift: "flag", tg_welcomed: "flag",
  // ── settings that describe the person (newest edit wins) ──
  tg_adv_career: "lww", tg_adv_diff: "lww", tg_adv_sub: "lww", tg_adv_vo: "lww", tg_detail: "lww", tg_loadouts: "lww",
  tg_skl_eq: "lww", tg_pa_fx: "lww", tg_pa_kind: "lww", tg_pa_band: "lww", tg_pa_accomp: "lww", tg_pa_view: "lww",
  tg_pvp_tier: "lww", tg_pvp_squad: "lww", tg_pvp_colorway: "lww", tg_vidsub_lang: "lww", tg_last_song: "lww",
  tg_vmvoice: "lww", tg_vmpoly: "lww", tg_adv_quiz: "lww", tg_adv_weak: "lww", tg_petbag: "lww", tg_petexped: "lww",
  tg_coach_skip_day: "lww", tg_broadcast_seen: "lww", tg_atip_last_delivered: "lww", tg_kid: "lww", tg_goal: "lww",
  tg_event: "lww", tg_homework: "lww", tg_lessonplan: "lww", tg_adv_load: "lww", tg_adv_energy: "lww", tg_kru: "lww",
  // equipped cosmetics (getEquip / setEquipLS write "tg_" + name)
  tg_skin: "lww", tg_theme: "lww", tg_sticker: "lww", tg_frame: "lww", tg_keyboard: "lww", tg_charModel: "lww",
  tg_charHat: "lww", tg_charOutfit: "lww", tg_charWeapon: "lww", tg_charAccessory: "lww",
  // ── games ──
  tg_adv_done: "union", tg_adv_found: "union", tg_adv_built: "union",
  tg_petroom: "union", tg_ranch_helpers: "union", tg_pvp_colorways_owned: "union", tg_pvp_trials: "union", tg_pvp_weekly_badges: "union",
  tg_adv_up: "objmax", tg_adv_wlv: "objmax", tg_ark: "objmax",
  tg_adv_best: "objmin",
  tg_earth_ore: "max", tg_earth_dyson: "max", tg_arena_best: "max",
  tg_ah_camp: "ahcamp",
  tg_adv_crystals: "pncounter", tg_pvp_valor: "pncounter",
  tg_pvp_rpg: "recbest", tg_petpath: "petpath",
  tg_pet: "group", tg_petbox: "group",
};
// dynamic-suffix keys (song id / date appended)
const PREFIX_STRATEGY: Record<string, Mode> = {
  tg_best_: "packmax", tg_stars_: "packmax", tg_acc_: "packmax", tg_medal_: "packmax", tg_count_: "packmax",
  tg_ghost_: "ghostbest",
  tg_plan_in_: "union",   // the plan steps entered on one day; only the last 7 days travel
};
// per-song numbers travel as ONE row per family: {songId: n}
const PACKS: Record<string, string> = {
  tg_best_: "tg_pk_best", tg_stars_: "tg_pk_stars", tg_acc_: "tg_pk_acc", tg_medal_: "tg_pk_medal", tg_count_: "tg_pk_count",
};
const PACK_CLOUD = new Set(Object.values(PACKS));
// day-keyed records: which field holds the day
const DAYREC: Record<string, string> = {
  tg_adv_q: "d", tg_chat_quest: "d", tg_chat_stats: "d", tg_daily_song: "d", tg_adv_coin_day: "d", tg_ah_coin_day: "d",
  tg_earn_day: "d", tg_game_day: "d", tg_sell_day: "d", tg_tts_day: "d", tg_pettrain: "d",
  tg_trace_state: "day", tg_usage: "d", tg_pa_runs: "d", tg_weekly: "week", tg_memory_streak: "last", tg_posture_streak: "last",
};
// time-ordered capped lists (cap = the app's own slice() cap)
const UNIONSORT: Record<string, { cap: number; by?: string; desc?: boolean; earliest?: boolean }> = {
  tg_act_log: { cap: 1500 }, tg_song_mood: { cap: 1500 }, tg_game_log: { cap: 80 }, tg_atip_outcomes: { cap: 40 },
  tg_autoteach_log: { cap: 50 }, tg_camhistory: { cap: 10 }, tg_learning_traj: { cap: 40 }, tg_plan_fx: { cap: 60 },
  tg_reportcards: { cap: 8 }, tg_self_reports: { cap: 30 }, tg_kdrops: { cap: 30, by: "pc", desc: true, earliest: true },
  tg_chat_days: { cap: 60 },
};
const CAPS: Record<string, number> = { tg_owned: 500, tg_mysongs: 200 };
// keys whose deletion on one device really is a deletion on every device
const TOMBSTONE_OK = new Set(["tg_event", "tg_goal", "tg_homework", "tg_lessonplan", "tg_kid", "tg_vidsub_lang", "tg_pa_kind", "tg_petexped"]);
// a value that must not travel at all (only the listed values are pushed / accepted)
const ONLY_VALUES: Record<string, string[]> = { tg_adv_prologue: ["1"] };
// big keys are pushed at most once a minute (except on page hide)
const BIG_KEYS = new Set(["tg_act_log", "tg_mysongs", "tg_song_mood"]);

/* never synced, each with the reason (the registry test reads these tables) */
// money, plan, server-owned numbers, competitive standing, identity and the sync's own bookkeeping
const EXCLUDE_WHY: Record<string, string> = {
  tg_coins: "money: profiles.coins is the home", tg_gems: "money: profiles.gems", tg_exp: "profiles.exp", tg_streak: "profiles.streak (incl. Max freezes)",
  tg_premium: "plan: server decides", tg_plan: "plan: server decides", tg_modelCores: "a local edit would mint coins through a legacy refund path",
  tg_notif_reward_done: "cache of a server flag", tg_game_power: "pacing resource: a client value must not refill every device",
  tg_gp_seen: "Game Power UI state", tg_pvp_rank: "competitive standing", tg_pvp_season: "competitive standing",
  tg_pvp_ghost: "local opponent", tg_pvp_rival: "local opponent", tg_pvp_daily: "PvP daily reward state", tg_pvp_stage: "PvP stage state",
  tg_pvp_stage_force: "test door", tg_guest_profile: "guest state stays on the device", tg_guest_ms: "guest state",
  tg_sync_meta: "sync bookkeeping", tg_sync_base: "sync bookkeeping", tg_sync_pn: "sync bookkeeping", tg_sync_owner: "sync bookkeeping",
  tg_sync_dev: "sync bookkeeping", tg_anon_id: "anonymous identity of this browser", tg_user_signed_out: "auth state of this browser",
  tg_auth_bk: "a copy of a credential",
};
const EXCLUDE = new Set(Object.keys(EXCLUDE_WHY));
// device-local: preferences about THIS phone, caches, banners, calibration, test and cheat doors, other people's data
const LOCAL_WHY: Record<string, string> = {
  tg_3d_dbg: "device gfx", tg_3d_tier: "device gfx", tg_3d_tier_auto: "device gfx", tg_gfx_tier: "device gfx", tg_adv_gfx: "device gfx",
  tg_adv_music: "device sound", tg_pa_gfx: "device gfx", tg_pa_gfx_mode: "device gfx", tg_pa_gfx_ok: "device gfx", tg_pa_stage: "device canvas size",
  tg_ah_snd: "device sound", tg_col3d: "test / gfx switch", tg_ranch3d: "test / gfx switch", tg_fpv: "device view mode", tg_ux2: "device ui switch",
  tg_mode: "light / dark of this screen", tg_chat_piano: "device ui", tg_chat_active: "view state", tg_adv_sector: "view state",
  tg_admin_pay_seen: "the admin device in hand must still see a payment", tg_adv_raid: "display copy of a server counter",
  tg_adv_recent: "other people's names", tg_blog_vid: "random id of this browser for the blog reader count, never an account", tg_pvp_gfx: "device gfx", tg_pvp_gfx_auto: "device gfx", tg_tts_denied: "per-device cost guard for the read-aloud head start", tg_adv_crash: "test door", tg_adv_nocine: "test door", tg_adv_nogate: "test door",
  tg_adv_unlockall: "test door", tg_ah_unlockall: "test door", tg_gp_free: "test door", tg_msd: "test door", tg_fullscore: "test door",
  tg_pa_testhook: "test door", tg_pa_stage_force: "test door", tg_test_forcelogin: "test door", tg_test_hook: "test door",
  tg_test_myclass_done: "test door", tg_tts_free: "test door", tg_tts_round: "this device's paid read-aloud rounds (a per-device cost limit, not a player state)", tg_tts_pf: "test door",
  tg_ai_cache_v1: "cache", tg_apk_banner_seen: "per-device banner", tg_apk_update_dismissed: "per-device banner", tg_install_banner_seen: "per-device banner",
  tg_push_banner_seen: "per-device banner", tg_push_primed: "per-device permission", tg_permprimed: "per-device permission",
  tg_orient_hint_seen: "per-device hint", tg_freeze_month: "Max freezes live in the excluded tg_streak",
  tg_gamelog_id_fix: "one-time repair of THIS device's log", tg_tts_aff: "this device's read-aloud habit", tg_tts_pf_day: "this device's prefetch cap",
  tg_attr: "attribution of this device", tg_attr_sig: "attribution of this device", tg_src: "attribution", tg_variant: "attribution",
  tg_origin_ua: "attribution", tg_landing_origin: "attribution", tg_dev: "device id", tg_visits: "analytics of this device",
  tg_visit_counted: "analytics of this device", tg_skip_onboard: "per-device", tg_pa_metro: "dead key",
  tg_pa_cal_mic: "this device's microphone calibration", tg_pa_cal_midi: "this device's MIDI latency", tg_pa_cal_tap: "this device's tap latency",
  tg_piano_tune_v1: "this piano and room", tg_charGender: "legacy key", tg_pa_cal_: "this device's input latency (prefix)",
};
const LOCAL_PREFIX = ["tg_pa_cal_", "tg_bio_cred_", "tg_stitched_", "tiga_"];
// has its own home on the server (chat_threads RLS per user, learning_* tables)
const SERVER_HOMED = ["tg_chat_idx", "tg_chat_history", "tg_learning_queue", "tg_learning_session"];
const SERVER_PREFIX = ["tg_chat_t_"];

const META_KEY = "tg_sync_meta", BASE_KEY = "tg_sync_base", PN_KEY = "tg_sync_pn", OWNER_KEY = "tg_sync_owner", DEV_KEY = "tg_sync_dev";
const CLAIM_KEY = "tg_sync_claimed", STASH_PREFIX = "tg_sync_stash_";
const POLL_MS = 20000;
const PULL_MIN_GAP = 8000;
const RPC_TIMEOUT_MS = 30000;
const MAX_ROW_BYTES = 400000, BATCH_KEYS = 30, BATCH_BYTES = 200000;
const GHOST_KEEP = 40, PLAN_IN_DAYS = 7;

/* ═══════════ module state ═══════════ */
let uid: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let lastRaw = new Map<string, string>();     // key -> raw localStorage string ("" = absent)
let dirty = new Map<string, number>();       // key -> client_ts ms when the change was seen
let inFlight = false, rerun = false, rerunPush = false;
let firstPullDone = false, firstAttemptDone = false;
let lastPullAt = 0, failCount = 0, nextTryAt = 0, pollCount = 0;
let readyWaiters: Array<() => void> = [];
let gen = 0;   // bumped by stopCloudSync: a round that started before it must not touch the state of the next account's round
const bigSkipped = new Map<string, number>();   // ck -> serialized length last found too big
const lastBigPush = new Map<string, number>();
const packCloud = new Map<string, Record<string, number>>();   // cloud pack key -> last seen map
const pnCloud = new Map<string, Record<string, { e: number; s: number }>>();   // pncounter key -> last seen slots
let lastCloudKeys = new Set<string>();
const guestAdopt = new Set<string>();   // soft-currency keys holding a guest's local balance when the first account signed in

/* ═══════════ helpers ═══════════ */
function safeGet(k: string): string | null { try { return localStorage.getItem(k); } catch (e) { return null; } }
function safeSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch (e) {} }
function safeRemove(k: string) { try { localStorage.removeItem(k); } catch (e) {} }
function readJson(k: string): any { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; } }
function writeJson(k: string, v: any) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
const isObj = (v: any) => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: any): number => { if (typeof v === "number") return isFinite(v) ? v : 0; if (typeof v === "string" && v.trim() !== "" && isFinite(+v)) return +v; return 0; };
function canon(v: any): any {
  if (Array.isArray(v)) return v.map(canon);
  if (isObj(v)) { const o: any = {}; for (const k of Object.keys(v).sort()) o[k] = canon(v[k]); return o; }
  return v;
}
const same = (a: any, b: any) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
// same members, order ignored (sets and lists of ids: two devices may hold the same set in a different order)
function sameSet(a: any, b: any): boolean {
  const norm = (v: any): any => (Array.isArray(v) ? v.map((x) => JSON.stringify(canon(x))).sort() : isObj(v) ? Object.keys(v).sort().map((k) => k + "=" + JSON.stringify(canon(Array.isArray(v[k]) ? norm(v[k]) : v[k]))) : v);
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}
// when two sides tie, both devices must pick the SAME one, or they never converge
const detPick = (x: any, y: any) => (JSON.stringify(canon(y)) > JSON.stringify(canon(x)) ? y : x);
function dedupe(arr: any[]): any[] {
  const seen = new Set<string>(); const out: any[] = [];
  for (const x of arr) {
    const id = x && typeof x === "object" ? JSON.stringify(canon(x)) : "s:" + String(x);
    if (!seen.has(id)) { seen.add(id); out.push(x); }
  }
  return out;
}
// FNV-1a hash of a raw localStorage string
function hashOf(raw: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) { h ^= raw.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h.toString(36);
}

/* ── codec: a localStorage string that is not JSON travels as {"__s": raw} ── */
function isRawS(v: any): boolean { return isObj(v) && typeof v.__s === "string" && Object.keys(v).length === 1; }
function enc(raw: string | null): any {
  if (raw === null || raw === "") return null;
  try { return JSON.parse(raw); } catch (e) { return { __s: raw }; }
}
function dec(v: any): string { return isRawS(v) ? v.__s : JSON.stringify(v); }
const scal = (v: any): any => (isRawS(v) ? v.__s : v);

/* ── days (E8): compare as numbers, ignore a day from the future ── */
function dayNum(s: any): number {
  if (typeof s !== "string") return NaN;
  const t = s.trim();
  let m = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec(t);
  if (m) return Math.floor(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1) / 864e5);
  m = /^[A-Za-z]{3} ([A-Za-z]{3}) (\d{1,2}) (\d{4})$/.exec(t);
  if (m) { const mi = "JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(m[1]); if (mi >= 0 && mi % 3 === 0) return Math.floor(Date.UTC(+m[3], mi / 3, +m[2]) / 864e5); }
  return NaN;
}
function todayMax(): number {
  const d = new Date();
  return Math.max(Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5), Math.floor(Date.now() / 864e5));
}
// the app's own day (shared-infra.ts dayKey: a fixed zone, DAY_TZ_OFFSET_MIN = 0 there; keep the two equal). A cloud day AFTER the device's own current day is never accepted
const DAY_TZ_OFFSET_MIN = 0;
function appToday(): number {
  const d = new Date(), z = new Date(d.getTime() + (d.getTimezoneOffset() + DAY_TZ_OFFSET_MIN) * 60000);
  return Math.floor(Date.UTC(z.getFullYear(), z.getMonth(), z.getDate()) / 864e5);
}
function localToday(): number { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); }
// "Wed Nov 05 2026" (toDateString) is the device's LOCAL day; every other format is the app's dayKey
const futureDay = (n: number, s?: any) => n > (typeof s === "string" && /^[A-Za-z]{3} /.test(s.trim()) ? localToday() : appToday());

/* ═══════════ merge implementations ═══════════ */
function mergeUnion(a: any, b: any, key?: string): any {
  if ((isObj(a) || a == null) && isObj(b) && !Array.isArray(a)) return mergeObjUnion(a, b);
  if (isObj(a) && Array.isArray(b) && !(a == null)) return a;
  const c = dedupe([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]);
  const cap = key ? capOf(key) : null;
  return cap ? c.slice(-cap) : c;
}
function mergeObjUnion(a: any, b: any): any {
  const out: any = {};
  for (const k of Object.keys(a || {})) out[k] = a[k];
  for (const k of Object.keys(b || {})) {
    if (!(k in out)) out[k] = b[k];
    else if (Array.isArray(out[k]) && Array.isArray(b[k])) out[k] = dedupe([...out[k], ...b[k]]);
    else if (typeof out[k] === "number" && typeof b[k] === "number") out[k] = Math.max(out[k], b[k]);
    else if (!same(out[k], b[k])) out[k] = detPick(out[k], b[k]);
  }
  return out;
}
function mergeObjMax(a: any, b: any): any {
  const out: any = {};
  for (const k of Object.keys(a || {})) out[k] = a[k];
  for (const k of Object.keys(b || {})) out[k] = Math.max(num(out[k]), num(b[k]));
  return out;
}
function mergeNestMax(a: any, b: any): any {
  if (typeof a === "number" || typeof b === "number") return Math.max(num(a), num(b));
  const A = isObj(a) ? a : {}, B = isObj(b) ? b : {}, out: any = { ...A };
  for (const k of Object.keys(B)) out[k] = k in A ? mergeNestMax(A[k], B[k]) : B[k];
  return out;
}
// {id: seconds}: the SMALLER positive time is the better one
function mergeObjMin(a: any, b: any): any {
  const out: any = {};
  const good = (x: any) => typeof x === "number" && isFinite(x) && x > 0;
  for (const k of Object.keys(a || {})) out[k] = a[k];
  for (const k of Object.keys(b || {})) {
    if (!good(b[k])) continue;
    out[k] = good(out[k]) ? Math.min(out[k], b[k]) : b[k];
  }
  return out;
}
function mergeAhCamp(a: any, b: any): any {
  const A = a || {}, B = b || {}, sa = Array.isArray(A.stars) ? A.stars : [], sb2 = Array.isArray(B.stars) ? B.stars : [], n = Math.max(sa.length, sb2.length);
  return { cleared: Math.max(num(A.cleared), num(B.cleared)), stars: Array.from({ length: n }, (_, i) => Math.max(num(sa[i]), num(sb2[i]))) };
}
function mergeObjMerge(a: any, b: any, rowTsA: number, rowTsB: number): any {
  const subTs = (v: any): number => {
    if (v && typeof v === "object") for (const f of ["lastDone", "updated_at", "updated", "t"]) { if (typeof v[f] === "number" || typeof v[f] === "string") { const n = +v[f]; if (n) return n; } }
    return 0;
  };
  const out: any = {};
  for (const k of Object.keys(a || {})) out[k] = a[k];
  for (const k of Object.keys(b || {})) {
    if (!(k in out)) out[k] = b[k];
    else if (subTs(b[k]) ? subTs(b[k]) > subTs(a[k]) : rowTsB > (subTs(a[k]) || rowTsA)) out[k] = b[k];
  }
  return out;
}
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
    const newer = (bv.lastAt || 0) > (av.lastAt || 0) ? bv : (bv.lastAt || 0) < (av.lastAt || 0) ? av : detPick(av, bv);
    out[k] = { ...newer, best: Math.max(av.best || 0, bv.best || 0) };
  }
  return out;
}
/* learner memory (E9). Struggles by label (the newer `last` wins); a label that is MASTERED on a side whose
   latest practice of it is on or after the other side's struggle removes that struggle; recent by label;
   noteMisses by label (max count, newest 12). Unknown fields come from the side with more sessions. */
function dayOfMs(ms: any): number { const n = +ms; return isFinite(n) && n > 0 ? Math.floor(n / 864e5) : NaN; }
function mergeMemory(a: any, b: any): any {
  const A = isObj(a) ? a : {}, B = isObj(b) ? b : {};
  const byLabel = (arr: any[], pick: (x: any, y: any) => any) => { const m = new Map<string, any>(); for (const s of arr || []) if (s && s.label) { const ex = m.get(s.label); m.set(s.label, ex ? pick(ex, s) : s); } return m; };
  const newerLast = (x: any, y: any) => ((y.last || 0) > (x.last || 0) ? y : x);
  const strug = byLabel([...(A.struggles || []), ...(B.struggles || [])], newerLast);
  const recentM = byLabel([...(A.recent || []), ...(B.recent || [])], (x, y) => (String(y.t || "") > String(x.t || "") ? y : x));
  const mastered = dedupe([...(A.mastered || []), ...(B.mastered || [])]).slice(0, 12);
  // a struggle disappears when the label was mastered on a side at (or after) the day it was last struggled with
  for (const side of [A, B]) {
    for (const label of side.mastered || []) {
      const st = strug.get(label); if (!st) continue;
      const rec = (side.recent || []).find((r: any) => r && r.label === label);
      const md = rec ? dayNum(String(rec.t || "")) : dayOfMs(side.lastSession);
      const sd = dayOfMs(st.last);
      if (!isNaN(md) && !isNaN(sd) && md >= sd) strug.delete(label);
    }
  }
  const miss = byLabel([...(A.noteMisses || []), ...(B.noteMisses || [])], (x, y) => ({ ...(((y.last || 0) > (x.last || 0)) ? y : x), count: Math.max(num(x.count), num(y.count)), last: Math.max(num(x.last), num(y.last)) }));
  const rich = num(B.sessions) > num(A.sessions) ? B : A;
  const out: any = {
    ...rich,
    struggles: [...strug.values()].sort((x: any, y: any) => (y.last || 0) - (x.last || 0)).slice(0, 6),
    mastered,
    recent: [...recentM.values()].sort((x: any, y: any) => String(y.t || "").localeCompare(String(x.t || ""))).slice(0, 12),
  };
  const nm = [...miss.values()].sort((x: any, y: any) => (y.last || 0) - (x.last || 0)).slice(0, 12);
  if (nm.length) out.noteMisses = nm; else delete out.noteMisses;
  const ls = Math.max(num(A.lastSession), num(B.lastSession)); if (ls) out.lastSession = ls; else delete out.lastSession;
  out.sessions = Math.max(num(A.sessions), num(B.sessions));
  return out;
}
function mergePracticeLog(a: any, b: any): any {
  const ak = isObj(a) ? a : {}, bk = isObj(b) ? b : {}, out: any = {};
  for (const k of Object.keys(ak)) if (k !== "_recent") out[k] = { ...ak[k] };
  for (const k of Object.keys(bk)) {
    if (k === "_recent") continue;
    const av = out[k], bv = bk[k];
    if (!av) out[k] = { ...bv };
    else for (const f of ["n", "accSum", "exp"]) if (typeof bv[f] === "number") av[f] = Math.max(num(av[f]), num(bv[f]));
  }
  const dayM: any = {};
  for (const r of [...(ak._recent || []), ...(bk._recent || [])]) {
    if (!r || !r.d) continue;
    const ex = dayM[r.d];
    if (!ex) { dayM[r.d] = { ...r }; continue; }
    const o: any = { ...ex };   // the same day on both sides: every number takes the larger value
    for (const f of Object.keys(r)) o[f] = typeof o[f] === "number" && typeof r[f] === "number" ? Math.max(o[f], r[f]) : f in o && !same(o[f], r[f]) ? detPick(o[f], r[f]) : r[f];
    dayM[r.d] = o;
  }
  out._recent = Object.values(dayM).sort((x: any, y: any) => String(x.d).localeCompare(String(y.d))).slice(-30);
  return out;
}
// best practice round per drill: accuracy and streak only go up; the rest comes from the later round
function mergePracticeBest(a: any, b: any): any {
  const A = isObj(a) ? a : {}, B = isObj(b) ? b : {}, out: any = { ...A };
  for (const k of Object.keys(B)) {
    const x = A[k], y = B[k];
    if (!isObj(x)) { out[k] = y; continue; }
    if (!isObj(y)) continue;
    const later = num(y.at) > num(x.at) ? y : num(y.at) < num(x.at) ? x : detPick(x, y);
    out[k] = { ...later, accuracy: Math.max(num(x.accuracy), num(y.accuracy)), bestStreak: Math.max(num(x.bestStreak), num(y.bestStreak)) };
  }
  return out;
}
// ghost run: keep the whole run with the higher final score (never mix two runs)
function mergeGhost(a: any, b: any): any {
  const A = Array.isArray(a) ? a : [], B = Array.isArray(b) ? b : [];
  if (!A.length) return B; if (!B.length) return A;
  const fa = num(A[A.length - 1] && A[A.length - 1].s), fb = num(B[B.length - 1] && B[B.length - 1].s);
  if (fb > fa) return B; if (fa > fb) return A;
  return B.length > A.length ? B : B.length < A.length ? A : detPick(A, B);
}
function mergeKStats(a: any, b: any): any {
  const A = isObj(a) ? a : {}, B = isObj(b) ? b : {};
  const la = dayNum(A.lastDay), lb = dayNum(B.lastDay);
  let later = A, sameDay = false;
  if (!isNaN(lb) && (isNaN(la) || lb > la)) later = B; else if (!isNaN(lb) && lb === la) sameDay = true;
  const seen: any = { ...(isObj(A.seen) ? A.seen : {}) };
  for (const [id, d] of Object.entries(isObj(B.seen) ? B.seen : {})) seen[id] = (!(id in seen) || dayNum(d) > dayNum(seen[id])) ? d : seen[id];
  return { ...A, ...B, ...later, correct: Math.max(num(A.correct), num(B.correct)), answered: Math.max(num(A.answered), num(B.answered)),
    bestStreak: Math.max(num(A.bestStreak), num(B.bestStreak)), streak: sameDay ? Math.max(num(A.streak), num(B.streak)) : num(later.streak), seen };
}
// robot level records: the whole record with the larger EXP wins (points stay legal for the EXP they were earned with)
function mergeRecBest(a: any, b: any): any {
  const A = isObj(a) ? a : {}, B = isObj(b) ? b : {}, out: any = { ...A };
  const pts = (r: any) => (isObj(r && r.pts) ? Object.values(r.pts).reduce((s: number, v: any) => s + num(v), 0) : 0);
  for (const k of Object.keys(B)) {
    const x = A[k], y = B[k];
    if (!isObj(x)) { out[k] = y; continue; }
    if (!isObj(y)) continue;
    out[k] = num(y.exp) !== num(x.exp) ? (num(y.exp) > num(x.exp) ? y : x) : pts(y) !== pts(x) ? (pts(y) > pts(x) ? y : x) : detPick(x, y);
  }
  return out;
}
// pet evolution choices: the first slot chosen is permanent, holes are filled from the other side
function mergePetPath(a: any, b: any): any {
  const A = isObj(a) ? a : {}, B = isObj(b) ? b : {}, out: any = { ...A };
  for (const sp of Object.keys(B)) {
    const x = Array.isArray(A[sp]) ? A[sp] : [], y = Array.isArray(B[sp]) ? B[sp] : [];
    const n = Math.max(x.length, y.length), r: any[] = [];
    for (let i = 0; i < n; i++) r[i] = x[i] != null && y[i] != null ? (same(x[i], y[i]) ? x[i] : detPick(x[i], y[i])) : x[i] != null ? x[i] : (y[i] != null ? y[i] : undefined);
    out[sp] = Array.from(r, (v) => (v === undefined ? null : v));
  }
  return out;
}
// a one-time marker: any truthy value wins, a local value is never touched
const truthy = (v: any): boolean => { v = scal(v); return v === true || (typeof v === "number" && v !== 0) || (typeof v === "string" && v !== "" && v !== "0" && v !== "false") || (isObj(v) || Array.isArray(v)); };
function mergeFlag(key: string, local: any, cloud: any): any {
  const only = ONLY_VALUES[key];
  if (only && !only.includes(String(scal(cloud)))) return undefined;
  if (truthy(local)) return undefined;
  return truthy(cloud) ? cloud : undefined;
}
// a day / month marker: the later wins, a future one is ignored
function mergeMaxStr(local: any, cloud: any): any {
  const c = scal(cloud), cn = dayNum(c);
  if (isNaN(cn) || futureDay(cn, c)) return undefined;
  const l = scal(local), ln = dayNum(l);
  if (local == null || isNaN(ln)) return cloud;
  return cn > ln ? cloud : undefined;
}
/* day-keyed record: cloud day older than local → keep local; newer (and not from the future) → take it; the same
   day → numbers max, booleans OR, arrays union — so a limit can only go up within a day */
function tighten(a: any, b: any): any {
  if (a === undefined || a === null) return b;
  if (b === undefined || b === null) return a;
  if (typeof a === "number" && typeof b === "number") return Math.max(a, b);
  if (typeof a === "boolean" && typeof b === "boolean") return a || b;
  if (Array.isArray(a) && Array.isArray(b)) return dedupe([...a, ...b]);
  if (isObj(a) && isObj(b)) { const out: any = { ...a }; for (const k of Object.keys(b)) out[k] = k in a ? tighten(a[k], b[k]) : b[k]; return out; }
  return same(a, b) ? a : detPick(a, b);
}
function mergeDayRec(local: any, cloud: any, field: string): any {
  if (!isObj(cloud)) return undefined;
  const cd = dayNum(cloud[field]);
  if (isNaN(cd) || futureDay(cd, cloud[field])) return undefined;
  if (!isObj(local)) return cloud;
  const ld = dayNum(local[field]);
  if (isNaN(ld)) return cloud;
  if (cd < ld) return undefined;
  if (cd > ld) return cloud;
  return tighten(local, cloud);
}
// time-ordered capped list
function timeOf(x: any): number {
  if (typeof x === "string") { const n = dayNum(x); return isNaN(n) ? NaN : n * 864e5; }
  if (x && typeof x === "object") {
    for (const f of ["t", "ts", "at", "time", "created", "updated"]) { const v = x[f]; if (typeof v === "number" && isFinite(v)) return v; }
    if (typeof x.d === "string") { const n = dayNum(x.d); if (!isNaN(n)) return n * 864e5; }
  }
  return NaN;
}
function mergeUnionSort(a: any, b: any, cfg: { cap: number; by?: string; desc?: boolean; earliest?: boolean }): any[] {
  const items: Array<{ x: any; t: number; i: number }> = [];
  for (const src of [a, b]) {
    let last = 0;
    for (const x of Array.isArray(src) ? src : []) { let t = timeOf(x); if (isNaN(t)) t = last; else last = t; items.push({ x, t, i: items.length }); }
  }
  const keyOf = (x: any) => (cfg.by && x && typeof x === "object" && x[cfg.by] != null ? "k:" + String(x[cfg.by]) : x && typeof x === "object" ? JSON.stringify(canon(x)) : "s:" + String(x));
  const best = new Map<string, { x: any; t: number; i: number }>();
  for (const it of items) {
    const k = keyOf(it.x), ex = best.get(k);
    if (!ex || (cfg.earliest && it.t < ex.t)) best.set(k, ex && !(cfg.earliest && it.t < ex.t) ? ex : it);
  }
  const asc = [...best.values()].sort((p, q) => p.t - q.t || p.i - q.i).map((v) => v.x).slice(-cfg.cap);
  return cfg.desc ? asc.reverse() : asc;
}
// three-way set: union, then a deletion on either side (an id in the last synced base that one side no longer has) sticks
function idOf(it: any): string { return it && typeof it === "object" ? String(it.id != null ? it.id : JSON.stringify(canon(it))) : String(it); }
function idsOf(v: any): string[] { return Array.isArray(v) ? v.map(idOf) : isObj(v) ? Object.keys(v) : []; }
function readBase(): Record<string, string[]> { return readJson(BASE_KEY); }
function setBase(key: string, ids: string[]) { const b = readBase(); b[key] = ids; writeJson(BASE_KEY, b); }
function mergeSet3(key: string, local: any, cloud: any, cloudNewer = false): any {
  const base = readBase()[key];
  const asObj = isObj(local) || (local == null && isObj(cloud));
  const lIds = new Set(idsOf(local)), cIds = new Set(idsOf(cloud)), bIds = new Set(Array.isArray(base) ? base : []);
  const dead = (id: string) => bIds.has(id) && ((local != null && !lIds.has(id)) || (cloud != null && !cIds.has(id)));
  if (asObj) {
    const out: any = {};
    for (const src of [isObj(local) ? local : {}, isObj(cloud) ? cloud : {}]) for (const k of Object.keys(src)) if (!(k in out) && !dead(k)) out[k] = src[k];
    return out;
  }
  const out: any[] = [], seen = new Set<string>();
  for (const src of [Array.isArray(local) ? local : [], Array.isArray(cloud) ? cloud : []]) {
    for (const it of src) { const id = idOf(it); if (seen.has(id) || dead(id)) continue; seen.add(id); out.push(it); }
  }
  if (key === "tg_mysongs") {
    // objects with the same id: keep the newer one; newest song first, as the app saves them
    const tsOf = (s: any) => { const m = /(\d{10,})$/.exec(String(s && s.id)); return m ? +m[1] : 0; };
    const pick = new Map<string, any>();
    for (const src of cloudNewer ? [Array.isArray(local) ? local : [], Array.isArray(cloud) ? cloud : []] : [Array.isArray(cloud) ? cloud : [], Array.isArray(local) ? local : []]) for (const it of src) if (!dead(idOf(it))) pick.set(idOf(it), it);   // the same song edited on both sides: the side written last wins
    return [...pick.values()].sort((p, q) => tsOf(q) - tsOf(p)).slice(0, CAPS.tg_mysongs);
  }
  return out;
}
/* pets: the active pet and the stable are merged as one thing (two separately merged rows could contradict each other) */
function mergePet(a: any, b: any): any {
  const newer = num(b.seen) > num(a.seen) ? b : a, bigger = num(b.bond) > num(a.bond) ? b : a;
  const out: any = { ...newer, bond: Math.max(num(a.bond), num(b.bond)) };
  if (bigger.name !== undefined) out.name = bigger.name;
  if (bigger.born !== undefined) out.born = bigger.born;
  const pa = dayNum(a.paid), pb = dayNum(b.paid);
  if (!isNaN(pa) || !isNaN(pb)) out.paid = (isNaN(pa) || pb > pa) ? b.paid : a.paid;
  return out;
}
function mergePets(lp: any, lb: any, cp: any, cb: any): { pet: any; box: any[] } {
  const ok = (r: any) => isObj(r) && r.species;
  const lbox = (Array.isArray(lb) ? lb : []).filter(ok), cbox = (Array.isArray(cb) ? cb : []).filter(ok);
  const by = new Map<string, any>();
  for (const r of [lp, ...lbox, cp, ...cbox]) if (ok(r)) by.set(r.species, by.has(r.species) ? mergePet(by.get(r.species), r) : r);
  let active: string | null = null;
  const cands = [lp, cp].filter(ok);
  if (cands.length === 2) active = num(cp.seen) > num(lp.seen) ? cp.species : lp.species; else if (cands.length === 1) active = cands[0].species;
  const order: string[] = [];
  for (const r of [lp, ...lbox, cp, ...cbox]) if (ok(r) && r.species !== active && !order.includes(r.species)) order.push(r.species);
  return { pet: active ? by.get(active) : null, box: order.map((s) => by.get(s)) };
}

/* generic dispatcher for the simple strategies; returns the merged value, or undefined = "leave local alone" */
function mergeValue(mode: string, key: string, local: any, cloud: any, localTs: number, cloudTs: number): any {
  switch (mode) {
    case "union": return mergeUnion(local, cloud, key);
    case "objunion": return mergeObjUnion(local, cloud);
    case "objmax": return mergeObjMax(local, cloud);
    case "nestmax": return mergeNestMax(local, cloud);
    case "objmin": return mergeObjMin(local, cloud);
    case "ahcamp": return mergeAhCamp(local, cloud);
    case "objmerge": return mergeObjMerge(local, cloud, localTs, cloudTs);
    case "pathacc": return mergePathAcc(local, cloud);
    case "memory": return mergeMemory(local, cloud);
    case "practicelog": return mergePracticeLog(local, cloud);
    case "practicebest": return mergePracticeBest(local, cloud);
    case "kstats": return mergeKStats(local, cloud);
    case "recbest": return mergeRecBest(local, cloud);
    case "petpath": return mergePetPath(local, cloud);
    case "ghostbest": return mergeGhost(local, cloud);
    case "flag": return mergeFlag(key, local, cloud);
    case "maxstr": return mergeMaxStr(local, cloud);
    case "dayrec": return mergeDayRec(local, cloud, DAYREC[key] || "d");
    case "unionsort": return mergeUnionSort(local, cloud, UNIONSORT[key] || { cap: 1500 });
    case "set3": return mergeSet3(key, local, cloud, cloudTs > localTs);
    case "max": return Math.max(num(local), num(cloud));
    case "lww": {
      if (local == null) return cloud;
      return cloudTs > localTs ? cloud : undefined;
    }
    default: return undefined;
  }
}
// merges that are a true join (the result contains both sides): a device that already holds more than the cloud row pushes it
const LATTICE = new Set(["union", "objunion", "objmax", "nestmax", "objmin", "max", "ahcamp", "unionsort", "set3", "dayrec", "practicelog"]);
const sameLoose = (a: any, b: any) => (same(a, b) || sameSet(a, b));
// merges whose result should contain both sides but are not in the lattice list above: a device holding more than the cloud row pushes it too
const JOIN = new Set(["recbest", "practicebest", "kstats", "pathacc", "memory", "objmerge", "petpath", "ghostbest", "flag", "maxstr"]);
// the timestamp for pushing a merge result back: strictly newer than the cloud row we just saw (the server keeps only a newer client_ts), whatever this clock says
const stamp = (cloudTs: number) => Math.max(Date.now(), (cloudTs || 0) + 1);
// the shape each strategy can merge. A raw string that is not JSON (or a scalar where a record belongs) is never pushed and never accepted for these keys
const OBJ_MODES = new Set(["objunion", "objmax", "nestmax", "objmin", "objmerge", "pathacc", "memory", "practicelog", "practicebest", "kstats", "recbest", "petpath", "ahcamp", "dayrec"]);
const ARR_MODES = new Set(["ghostbest", "unionsort"]);
const EITHER_MODES = new Set(["union", "set3"]);
function shapeOk(mode: string, v: any): boolean {
  if (OBJ_MODES.has(mode)) return isObj(v) && !isRawS(v);
  if (ARR_MODES.has(mode)) return Array.isArray(v);
  if (EITHER_MODES.has(mode)) return Array.isArray(v) || (isObj(v) && !isRawS(v));
  return true;
}
/* sets that other keys refer to are applied first */
const FIRST = ["tg_owned", "tg_adv_done", "tg_adv_found", "tg_adv_built", "tg_path_done"];

/* ═══════════ key classification (E12) ═══════════ */
function prefixOf(k: string): string | null {
  for (const p of Object.keys(PREFIX_STRATEGY)) if (k.startsWith(p) && k.length > p.length) return p;
  return null;
}
function strategyOf(k: string): string | null {
  if (STRATEGY[k]) return STRATEGY[k];
  const p = prefixOf(k);
  return p ? PREFIX_STRATEGY[p] : null;
}
function planInDayOk(k: string): boolean {
  const n = dayNum(k.slice("tg_plan_in_".length));
  return !isNaN(n) && n >= todayMax() - PLAN_IN_DAYS && n <= todayMax() + 1;
}
function isSyncedKey(k: string, anyDate = false): boolean {
  if (!k || !k.startsWith("tg_") || EXCLUDE.has(k)) return false;
  if (k.startsWith("tg_plan_in_")) return k.length > 11 && (anyDate || planInDayOk(k));
  return strategyOf(k) !== null;
}
const packOf = (k: string): string | null => { const p = prefixOf(k); return p && PACKS[p] ? p : null; };
function capOf(k: string): number | null { return CAPS[k] != null ? CAPS[k] : null; }
/** 'synced' | 'excluded' (money, server-authoritative, bookkeeping) | 'local' (this device only) | 'server' (own table) | 'unclassified' */
export function classify(key: string): string {
  if (!key) return "unclassified";
  if (EXCLUDE.has(key)) return "excluded";
  if (isSyncedKey(key, true) || PACK_CLOUD.has(key)) return "synced";
  if (SERVER_HOMED.includes(key) || SERVER_PREFIX.some((p) => key.startsWith(p))) return "server";
  if (key in LOCAL_WHY || key === "tg_mode" || LOCAL_PREFIX.some((p) => key.startsWith(p))) return "local";
  return "unclassified";
}
export const SYNC_REGISTRY = { STRATEGY, PREFIX_STRATEGY, PACKS, EXCLUDE_WHY, LOCAL_WHY, LOCAL_PREFIX, SERVER_HOMED, SERVER_PREFIX };

/* ═══════════ meta (per-key write time of THIS device) ═══════════ */
function readMeta(): Record<string, any> { return readJson(META_KEY); }
function writeMeta(meta: Record<string, any>) { writeJson(META_KEY, meta); }

/* ═══════════ pncounter: a soft currency kept as a per-device earned / spent ledger ═══════════
   Cloud value {pn: {<device>: {e, s}}}; balance = max(0, sum(e) - sum(s)). A device only ever writes its own slot
   (both numbers only grow), so max per slot converges and earnings on two devices both survive. A legacy plain number
   in the cloud counts as slot "_legacy". */
// the device id lives INSIDE the ledger blob (tg_sync_pn.__dev): the slot name and the ledger that fills it can never be separated by a partial clean-up
function devId(): string {
  const pn: any = readJson(PN_KEY);
  if (typeof pn.__dev === "string" && pn.__dev) return pn.__dev;
  let d = safeGet(DEV_KEY);   // an id written by the first version of this file is carried over once
  if (!d) d = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
  pn.__dev = d; writeJson(PN_KEY, pn);
  safeRemove(DEV_KEY);
  return d;
}
type Slots = Record<string, { e: number; s: number }>;
function slotsOf(v: any): Slots {
  if (typeof v === "number" || (typeof v === "string" && isFinite(+v))) return v > 0 ? { _legacy: { e: Math.floor(+v), s: 0 } } : {};
  const out: Slots = {};
  if (isObj(v) && isObj(v.pn)) for (const [d, r] of Object.entries<any>(v.pn)) if (isObj(r)) out[d] = { e: Math.max(0, Math.floor(num(r.e))), s: Math.max(0, Math.floor(num(r.s))) };
  return out;
}
const balanceOf = (sl: Slots): number => Math.max(0, Object.values(sl).reduce((t, r) => t + r.e - r.s, 0));
function localBalance(k: string): number { return Math.max(0, Math.floor(num(safeGet(k)))); }
type Led = { last: number; e: number; s: number };
function readPn(): Record<string, Led> { devId(); return readJson(PN_KEY); }
function writePn(p: Record<string, Led>) { writeJson(PN_KEY, p); }
// attribute a local change (earned / spent) to this device's slot; only once the first pull settled the base
function pnObserve(k: string) {
  if (!firstPullDone) return;
  const pn = readPn(), led = pn[k], L = localBalance(k);
  if (!led) { if (!pnCloud.has(k) || !Object.keys(pnCloud.get(k)!).length) { pn[k] = { last: L, e: L, s: 0 }; writePn(pn); } return; }
  if (L === led.last) return;
  if (L > led.last) led.e += L - led.last; else led.s += led.last - L;
  led.last = L; writePn(pn);
}
function pnSlotsForPush(k: string): Slots {
  const cloud = { ...(pnCloud.get(k) || {}) }, led = readPn()[k];
  if (led) { const mine = cloud[devId()]; cloud[devId()] = { e: Math.max(led.e, mine ? mine.e : 0), s: Math.max(led.s, mine ? mine.s : 0) }; }
  return cloud;
}
// merge a pulled pn row; returns the balance to write locally, and whether the cloud row must be rewritten
function pnMerge(k: string, cloudVal: any): { balance: number; repush: boolean } {
  pnObserve(k);
  const cloud = slotsOf(cloudVal), pn = readPn(), me = devId();
  pnCloud.set(k, cloud);
  const L = localBalance(k), base = balanceOf(cloud);
  let led = pn[k];
  // a guest's crystals (this browser had no owner marker, so the local number was earned here, before any account): they are this device's own earnings,
  // added on top of the account's balance. Not done when the cloud holds a legacy plain number (it may be an older copy of this very balance: counting both would double it)
  const legacyPlain = typeof cloudVal === "number" || (typeof cloudVal === "string" && isFinite(+cloudVal));
  if (!led && guestAdopt.has(k) && L > 0 && !legacyPlain) led = pn[k] = { last: L, e: L, s: 0 };
  guestAdopt.delete(k);
  if (!led) led = pn[k] = { last: Math.max(L, base), e: Math.max(0, L - base), s: 0 };   // a joining device adopts the shared balance, keeps extra earnings
  const slots: Slots = { ...cloud };
  const mine = cloud[me];
  slots[me] = { e: Math.max(led.e, mine ? mine.e : 0), s: Math.max(led.s, mine ? mine.s : 0) };
  led.e = slots[me].e; led.s = slots[me].s;
  const balance = balanceOf(slots);
  led.last = balance; writePn(pn);
  pnCloud.set(k, slots);
  const wasPlain = typeof cloudVal === "number" || typeof cloudVal === "string";
  return { balance, repush: wasPlain || !same(slotsOf({ pn: cloud }), slots) || !isObj(cloudVal) };
}

/* ═══════════ polling (detect local changes by raw-string diff) ═══════════ */
function allSyncedKeys(): string[] {
  const set = new Set<string>();
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && isSyncedKey(k)) set.add(k); } } catch (e) {}
  for (const k of lastRaw.keys()) if (isSyncedKey(k)) set.add(k);
  return [...set];
}
// an expedition that was claimed (or ended) HERE: the cloud may still hold its row, and it must not bring the trip (and its payout) back
function readClaimed(): string[] { try { const v = JSON.parse(localStorage.getItem(CLAIM_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function expedId(v: any): string | null { return isObj(v) && v.id != null && v.until != null ? String(v.id) + "@" + String(v.until) : null; }
function noteClaimed(prevRaw: string) {
  const id = expedId(enc(prevRaw)); if (!id) return;
  const l = readClaimed().filter((x) => x !== id); l.push(id); writeJson(CLAIM_KEY, l.slice(-30));
}
function poll() {
  if (!uid) return;
  const now = Date.now();
  let changed = false, meta: Record<string, any> | null = null;
  for (const k of allSyncedKeys()) {
    const raw = safeGet(k) || "";
    if (raw !== (lastRaw.get(k) || "")) {
      if (k === "tg_petexped" && raw === "") noteClaimed(lastRaw.get(k) || "");
      dirty.set(k, now); lastRaw.set(k, raw); changed = true;
      if (!packOf(k)) { meta = meta || readMeta(); meta[k] = { ts: now, h: hashOf(raw) }; }
      if (STRATEGY[k] === "pncounter") pnObserve(k);
    }
  }
  if (meta) writeMeta(meta);
  void changed;
}

/* ═══════════ pull + merge cloud rows into local ═══════════ */
function writeLocal(k: string, raw: string, cloudSame: boolean, cloudTs: number, meta: Record<string, any>, changedKeys: string[]) {
  safeSet(k, raw); lastRaw.set(k, raw); changedKeys.push(k);
  if (!packOf(k)) meta[k] = cloudSame ? { ts: cloudTs || Date.now(), h: hashOf(raw) } : { ts: Date.now(), h: hashOf(raw) };
  if (!cloudSame) dirty.set(k, stamp(cloudTs));
}
function removeLocal(k: string, meta: Record<string, any>, changedKeys: string[]) { safeRemove(k); lastRaw.set(k, ""); delete meta[k]; changedKeys.push(k); }

function packMap(p: string): Record<string, number> {
  const out: Record<string, number> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(p) && k.length > p.length) { const n = +(localStorage.getItem(k) || ""); if (isFinite(n) && n > 0) out[k.slice(p.length)] = n; }
    }
  } catch (e) {}
  return out;
}
function packNeedsPush(p: string): boolean {
  const cloud = packCloud.get(PACKS[p]) || {}, loc = packMap(p);
  return Object.keys(loc).some((id) => !(id in cloud) || loc[id] > cloud[id]);
}
function applyPack(p: string, cloudVal: any, changedKeys: string[], cloudTs = 0) {
  const cm: Record<string, number> = {};
  if (isObj(cloudVal)) for (const [id, n] of Object.entries<any>(cloudVal)) { const v = num(n); if (v > 0 && (p + id).length <= 64) cm[id] = v; }
  packCloud.set(PACKS[p], cm);
  for (const [id, n] of Object.entries(cm)) {
    const k = p + id, cur = num(safeGet(k));
    if (n > cur) { safeSet(k, String(n)); lastRaw.set(k, String(n)); changedKeys.push(k); }
  }
  if (packNeedsPush(p)) dirty.set("@pack:" + p, stamp(cloudTs));
}

function applyChest(rows: Map<string, any>, meta: Record<string, any>, changedKeys: string[]) {
  const rd = rows.get("tg_chest_date"); if (!rd || rd.value == null) return;
  const cd = scal(rd.value), cdn = dayNum(cd);
  if (isNaN(cdn) || futureDay(cdn, cd)) return;
  const rs = rows.get("tg_chest_streak"), cs = rs ? num(rs.value) : 0;
  const ld = safeGet("tg_chest_date") || "", ldn = dayNum(ld), ls = num(safeGet("tg_chest_streak"));
  let date = ld, streak = ls;
  if (isNaN(ldn) || cdn > ldn) { date = cd; streak = cs; } else if (cdn === ldn) streak = Math.max(ls, cs);
  const cloudSame = date === cd && streak === cs;
  const ts = rd.client_ts ? new Date(rd.client_ts).getTime() : 0;
  if (date !== ld) writeLocal("tg_chest_date", date, cloudSame, ts, meta, changedKeys);
  if (String(streak) !== (safeGet("tg_chest_streak") || "")) writeLocal("tg_chest_streak", String(streak), cloudSame, ts, meta, changedKeys);
  if (!cloudSame) { dirty.set("tg_chest_date", stamp(ts)); dirty.set("tg_chest_streak", stamp(ts)); }
}
function applyPets(rows: Map<string, any>, meta: Record<string, any>, changedKeys: string[]) {
  const rp = rows.get("tg_pet"), rb = rows.get("tg_petbox");
  if (!rp && !rb) return;
  const lp = enc(safeGet("tg_pet")), lb = enc(safeGet("tg_petbox"));
  const cp = rp ? rp.value : null, cb = rb ? rb.value : null;
  const m = mergePets(isObj(lp) ? lp : null, lb, isObj(cp) ? cp : null, cb);
  const wantPet = m.pet, wantBox = m.box;
  const tsOf = (r: any) => (r && r.client_ts ? new Date(r.client_ts).getTime() : 0);
  const petSame = same(wantPet, isObj(cp) ? cp : null), boxSame = same(wantBox, Array.isArray(cb) ? cb : []);
  const curPet = enc(safeGet("tg_pet")), curBox = enc(safeGet("tg_petbox"));
  if (wantPet && !same(wantPet, curPet)) writeLocal("tg_pet", JSON.stringify(wantPet), petSame, tsOf(rp), meta, changedKeys);
  else if (!wantPet && curPet && !isObj(cp)) { /* nothing on either side wants a pet: leave it */ }
  if (!same(wantBox, Array.isArray(curBox) ? curBox : [])) { if (wantBox.length || Array.isArray(curBox)) writeLocal("tg_petbox", JSON.stringify(wantBox), boxSame, tsOf(rb), meta, changedKeys); }
  if (!petSame && wantPet) dirty.set("tg_pet", stamp(tsOf(rp)));
  if (!boxSame && (wantBox.length || Array.isArray(cb))) dirty.set("tg_petbox", stamp(tsOf(rb)));
}

function applyPull(rows: any[]): string[] {
  poll();   // edits and deletions made since the last poll are marked first, so the merge sees them as this device's newest word
  const changedKeys: string[] = [];
  const meta = readMeta();
  const rowMap = new Map<string, any>();
  const list = (rows || []).filter((r) => r && typeof r.key === "string");
  lastCloudKeys = new Set(list.map((r) => r.key));
  for (const r of list) rowMap.set(r.key, r);
  // ghosts: only the newest GHOST_KEEP cloud runs are taken
  const ghostRows = list.filter((r) => r.key.startsWith("tg_ghost_") && r.value != null).sort((a, b) => +new Date(b.client_ts) - +new Date(a.client_ts));
  const ghostOk = new Set(ghostRows.slice(0, GHOST_KEEP).map((r) => r.key));
  const prio = (k: string) => { const i = FIRST.indexOf(k); return i < 0 ? 99 : i; };
  const ordered = [...list].sort((a, b) => prio(a.key) - prio(b.key));
  for (const row of ordered) {
    const k = row.key;
    if (PACK_CLOUD.has(k)) { const p = Object.keys(PACKS).find((q) => PACKS[q] === k)!; applyPack(p, row.value, changedKeys, row.client_ts ? new Date(row.client_ts).getTime() : 0); continue; }
    if (!isSyncedKey(k)) continue;
    const mode = strategyOf(k)!;
    if (mode === "group") continue;
    if (k.startsWith("tg_ghost_") && !ghostOk.has(k)) continue;
    const cloudTs = row.client_ts ? new Date(row.client_ts).getTime() : 0;
    const localRaw = safeGet(k);
    const localTs = (meta[k] && meta[k].ts) || 0;
    const cloud = row.value === undefined ? null : row.value;
    if (localRaw === null && TOMBSTONE_OK.has(k) && dirty.has(k) && (dirty.get(k) as number) >= cloudTs) continue;   // deleted here after the cloud copy was written: push the deletion, do not bring the value back
    if (mode === "packmax") {   // legacy per-song row: still read, with the max rule
      const cur = num(localRaw), n = num(cloud);
      if (n > cur) { safeSet(k, String(n)); lastRaw.set(k, String(n)); changedKeys.push(k); dirty.set("@pack:" + packOf(k), stamp(cloudTs)); }
      continue;
    }
    if (mode === "pncounter") {
      if (cloud == null) continue;
      const r = pnMerge(k, cloud);
      if (String(r.balance) !== (localRaw || "")) { safeSet(k, String(r.balance)); lastRaw.set(k, String(r.balance)); changedKeys.push(k); }
      if (r.repush) dirty.set(k, stamp(cloudTs));
      continue;
    }
    if (cloud === null) {   // a tombstone only deletes keys that are meant to be deletable, and only if it is newer
      if (TOMBSTONE_OK.has(k) && localRaw !== null && cloudTs > localTs) removeLocal(k, meta, changedKeys);
      else if (!TOMBSTONE_OK.has(k) && localRaw !== null) dirty.set(k, stamp(cloudTs));   // a stale null row (the old raw-string bug): write the real value over it
      continue;
    }
    if (k === "tg_petexped") {   // a trip already claimed here stays claimed: the cloud copy is the old row
      const id = expedId(cloud);
      if (id && readClaimed().includes(id)) { if (localRaw === null) dirty.set(k, stamp(cloudTs)); continue; }
    }
    if (!shapeOk(mode, cloud)) { if (localRaw !== null && shapeOk(mode, enc(localRaw))) dirty.set(k, stamp(cloudTs)); continue; }   // garbage in the cloud row: not accepted, the real value is written over it
    const local0 = enc(localRaw);
    const local = localRaw !== null && !shapeOk(mode, local0) ? null : local0;
    let merged: any;
    try { merged = mergeValue(mode, k, local, cloud, localTs, cloudTs); } catch (e) { continue; }
    if (mode === "set3" && merged !== undefined) setBase(k, idsOf(merged));
    const joinMode = LATTICE.has(mode) || JOIN.has(mode);
    if (merged === undefined || merged === null) {
      // the local side won: if it holds something the cloud row does not, the cloud must catch up (a join-type merge)
      if (JOIN.has(mode) && local != null && (mode === "flag" ? truthy(local) : mode === "maxstr" ? !isNaN(dayNum(scal(local))) : true) && !sameLoose(local, cloud)) dirty.set(k, stamp(cloudTs));
      continue;
    }
    const raw = dec(merged);
    if (raw === (localRaw || "")) {
      // nothing to write here, but if this device already holds MORE than the cloud row the cloud must catch up
      if (joinMode && !sameLoose(merged, cloud)) dirty.set(k, stamp(cloudTs));
      continue;
    }
    writeLocal(k, raw, joinMode ? sameLoose(merged, cloud) : same(merged, cloud), cloudTs, meta, changedKeys);
  }
  applyChest(rowMap, meta, changedKeys);
  applyPets(rowMap, meta, changedKeys);
  writeMeta(meta);
  if (changedKeys.length && typeof window !== "undefined") {
    try { window.dispatchEvent(new CustomEvent("tiga:cloud-pulled", { detail: { keys: changedKeys } })); } catch (e) {}
  }
  return changedKeys;
}
/** Calls `cb(keys)` after a pull changed local data (screens that cache a value in React state re-read it then). Returns an unsubscribe. */
export function onCloudPulled(cb: (keys: string[]) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const h = (e: any) => { try { cb((e && e.detail && e.detail.keys) || []); } catch (err) {} };
  window.addEventListener("tiga:cloud-pulled", h);
  return () => window.removeEventListener("tiga:cloud-pulled", h);
}

/* ═══════════ push dirty keys ═══════════ */
type Row = { ck: string; v: any; ts: number; snap: Array<[string, number]>; sent: Array<[string, string | null]>; ids?: string[] };
function buildRows(force: boolean): Row[] {
  const rows = new Map<string, Row>();
  const now = Date.now();
  const ghostKeep = new Set<string>();
  const gh = [...dirty.keys()].filter((k) => k.startsWith("tg_ghost_"));
  if (gh.length > GHOST_KEEP) { const meta = readMeta(); gh.sort((a, b) => ((meta[b] && meta[b].ts) || 0) - ((meta[a] && meta[a].ts) || 0)); gh.slice(0, GHOST_KEEP).forEach((k) => ghostKeep.add(k)); } else gh.forEach((k) => ghostKeep.add(k));
  for (const [k, dts] of dirty) {
    const pk = k.startsWith("@pack:") ? k.slice(6) : packOf(k);
    if (pk) {
      const ck = PACKS[pk];
      let r = rows.get(ck);
      if (!r) { r = { ck, v: null, ts: now, snap: [], sent: [] }; rows.set(ck, r); }
      r.snap.push([k, dts]);
      continue;
    }
    if (!isSyncedKey(k)) { dirty.delete(k); continue; }
    const mode = strategyOf(k)!;
    if (k.startsWith("tg_ghost_") && !ghostKeep.has(k)) { dirty.delete(k); continue; }
    if (BIG_KEYS.has(k) && !force && now - (lastBigPush.get(k) || 0) < 60000) continue;
    const raw = safeGet(k);
    let v: any;
    if (mode === "pncounter") { pnObserve(k); v = { pn: pnSlotsForPush(k) }; if (!Object.keys(v.pn).length) { dirty.delete(k); continue; } }
    else {
      v = fitList(k, enc(raw));
      if (v === null) { if (TOMBSTONE_OK.has(k) && lastCloudKeys.has(k)) v = null; else { dirty.delete(k); continue; } }
      else if (!shapeOk(mode, v)) { dirty.delete(k); continue; }   // a non-JSON string where a record belongs is never pushed
      const only = ONLY_VALUES[k]; if (only && !only.includes(String(scal(v)))) { dirty.delete(k); continue; }
    }
    rows.set(k, { ck: k, v, ts: dts, snap: [[k, dts]], sent: [[k, raw]] });
  }
  for (const r of rows.values()) {
    if (PACK_CLOUD.has(r.ck)) {
      const p = Object.keys(PACKS).find((q) => PACKS[q] === r.ck)!;
      const merged: Record<string, number> = { ...(packCloud.get(r.ck) || {}) };   // never drop ids that other devices wrote
      const loc = packMap(p);
      for (const id of Object.keys(loc)) merged[id] = Math.max(merged[id] || 0, loc[id]);
      r.v = merged;
    }
  }
  return [...rows.values()].filter((r) => r.ck.length <= 64);
}
// a request that never answers must not hold the whole sync (inFlight) forever
function callRpc(updates: any): Promise<{ data: any; error: any }> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), RPC_TIMEOUT_MS);
    Promise.resolve(sb.rpc("sync_cloud_state", { p_updates: updates })).then((r: any) => { clearTimeout(t); resolve(r); }, (e: any) => { clearTimeout(t); reject(e); });
  });
}
// a capped list that is too big for one row is pushed without its oldest entries (the local copy keeps them)
function fitList(k: string, v: any): any {
  const cfg = UNIONSORT[k];
  if (!cfg || cfg.desc || !Array.isArray(v)) return v;
  while (v.length > 20 && JSON.stringify(v).length > MAX_ROW_BYTES - 20000) v = v.slice(Math.ceil(v.length * 0.1));
  return v;
}
async function doPush(my: string, force: boolean): Promise<boolean> {
  const rows = buildRows(force);
  if (!rows.length) return true;
  // split into batches (keys and bytes), skipping rows that are too big to be a state row
  const batches: Row[][] = []; let cur: Row[] = [], bytes = 0;
  for (const r of rows) {
    const len = JSON.stringify(r.v === undefined ? null : r.v).length;
    if (len > MAX_ROW_BYTES) { if (bigSkipped.get(r.ck) !== len) bigSkipped.set(r.ck, len); r.snap.forEach(([k, t]) => { if (dirty.get(k) === t) dirty.delete(k); }); continue; }
    if (cur.length >= BATCH_KEYS || (cur.length && bytes + len > BATCH_BYTES)) { batches.push(cur); cur = []; bytes = 0; }
    cur.push(r); bytes += len;
  }
  if (cur.length) batches.push(cur);
  let allOk = true;
  for (const batch of batches) {
    const payload: any = {};
    for (const r of batch) payload[r.ck] = { v: r.v, ts: r.ts };
    try {
      const { data, error } = await callRpc(payload);
      if (error) throw error;
      if (uid !== my) { stashDrop(my, batch.flatMap((r) => r.sent)); return false; }   // the account left while this ran: the server has it, so its stash entry is not needed
      lastPullAt = Date.now();
      applyPull(data || []);
      const meta = readMeta();
      for (const r of batch) {
        for (const [k, t] of r.snap) {
          const sentRaw = r.sent.find((s) => s[0] === k);
          const curRaw = safeGet(k);
          if (sentRaw && curRaw !== sentRaw[1]) { if (!dirty.has(k) || dirty.get(k) === t) dirty.set(k, Date.now()); continue; }
          if (dirty.get(k) === t) dirty.delete(k);
          if (sentRaw && sentRaw[1] != null && !packOf(k)) meta[k] = { ts: r.ts, h: hashOf(sentRaw[1] as string) };
          if (STRATEGY[k] === "set3" && sentRaw) setBase(k, idsOf(enc(sentRaw[1])));
        }
        if (BIG_KEYS.has(r.ck)) lastBigPush.set(r.ck, Date.now());
      }
      writeMeta(meta);
    } catch (e) { allOk = false; }
  }
  return allOk;
}
async function doPull(my: string): Promise<boolean> {
  try {
    const { data, error } = await callRpc({});
    if (error) throw error;
    if (uid !== my) return false;
    lastPullAt = Date.now();
    applyPull(data || []);
    if (!firstPullDone) {
      firstPullDone = true;
      // one-time FULL BACKUP per device: keys never pushed (no meta) or changed while the app was closed (hash drift)
      const meta = readMeta(), now = Date.now();
      for (const k of allSyncedKeys()) {
        if (packOf(k)) continue;
        const raw = safeGet(k) || "", mk = meta[k];
        if (!mk || (mk.h && mk.h !== hashOf(raw))) dirty.set(k, now);
      }
      for (const p of Object.keys(PACKS)) if (packNeedsPush(p)) dirty.set("@pack:" + p, now);
      for (const k of allSyncedKeys()) if (STRATEGY[k] === "pncounter" && safeGet(k)) { pnMerge(k, pnCloudRaw(k, data)); if (!dirty.has(k)) dirty.set(k, now); }
    }
    return true;
  } catch (e) { return false; }
}
function pnCloudRaw(k: string, rows: any[]): any { const r = (rows || []).find((x: any) => x && x.key === k); return r ? r.value : null; }

function settleReady() { firstAttemptDone = true; const w = readyWaiters; readyWaiters = []; w.forEach((f) => { try { f(); } catch (e) {} }); }
/** One sync round: pull first (so a long-open tab never overwrites another device's additions), then push what is dirty. */
type CycleOpts = { force?: boolean; noPull?: boolean };
let roundP: Promise<void> = Promise.resolve();
let rerunForce = false, rerunNoPull = true;
async function cycle(wantPush: boolean, opts: CycleOpts = {}): Promise<void> {
  if (!uid) return;
  if (inFlight) {
    // a request that arrives while a round runs is not dropped: it runs as ONE more round right after (a flush must still push what changed during the round)
    rerun = true; rerunPush = rerunPush || wantPush; rerunForce = rerunForce || !!opts.force; rerunNoPull = rerunNoPull && !!opts.noPull;
    return roundP;
  }
  const p = runRound(wantPush, opts);
  roundP = p;
  return p;
}
async function runRound(wantPush: boolean, opts: CycleOpts): Promise<void> {
  inFlight = true;
  const my = uid, g = gen;
  let ok = true;
  try {
    if (!opts.noPull && (opts.force || !firstPullDone || Date.now() - lastPullAt > PULL_MIN_GAP)) ok = await doPull(my);
    if (uid === my && g === gen && ok && wantPush && dirty.size) ok = await doPush(my, !!opts.force);
  } catch (e) { ok = false; }
  if (g !== gen) return;   // the account changed while this round ran: its state was reset, leave it alone
  if (uid === my) {
    if (ok) { failCount = 0; nextTryAt = 0; } else { failCount++; nextTryAt = Date.now() + Math.min(300000, 20000 * Math.pow(2, failCount - 1)); }
    settleReady();
  }
  inFlight = false;
  if (rerun && uid === my) {
    const p = rerunPush, o: CycleOpts = { force: rerunForce, noPull: rerunNoPull };
    rerun = false; rerunPush = false; rerunForce = false; rerunNoPull = true;
    await cycle(p, o);
  }
}

/* ═══════════ lifecycle ═══════════ */
function pruneLocal() {
  // plan-entry marks older than two weeks are never read again
  try {
    const dead: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("tg_plan_in_")) { const n = dayNum(k.slice(11)); if (!isNaN(n) && n < todayMax() - 14) dead.push(k); }
    }
    dead.forEach(safeRemove);
    const nm = enc(safeGet("tg_note_miss_d"));
    if (isObj(nm)) { const days = Object.keys(nm).sort(); if (days.length > 30) { const keep: any = {}; days.slice(-30).forEach((d) => (keep[d] = nm[d])); safeSet("tg_note_miss_d", JSON.stringify(keep)); } }
  } catch (e) {}
}
// per-person data that lives OUTSIDE the sync (own tables, other people's names, answers written for one learner)
const PER_USER_LOCAL = ["tg_adv_recent", "tg_adv_raid", "tg_ai_cache_v1", "tg_chat_active", ...SERVER_HOMED];
function wipeSyncedLocal() {
  const dead: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (isSyncedKey(k, true) || k === META_KEY || k === BASE_KEY || k === PN_KEY || k === CLAIM_KEY || k === DEV_KEY || PER_USER_LOCAL.includes(k) || SERVER_PREFIX.some((p) => k.startsWith(p)))) dead.push(k);
    }
  } catch (e) {}
  dead.forEach(safeRemove);
}
/* ── per-account stash: what one account changed and had not yet reached the cloud when another account takes the browser ──
   The previous account's data is wiped on a switch; if its last changes were not flushed (offline, a round that never answered) they would be lost with it.
   They are kept under tg_sync_stash_<first 8 of the uid> (never synced) as {key: {raw, ts}} and put back when THAT account signs in again,
   where they take part in the normal merge and are pushed. A stash entry is dropped as soon as a push of the same value is acknowledged. */
type Stash = { uid: string; at: number; keys: Record<string, { raw: string | null; ts: number }> };
function stashKeyOf(u: string): string {
  const k = STASH_PREFIX + u.slice(0, 8);
  const ex: any = readJson(k);
  return ex && ex.uid && ex.uid !== u ? STASH_PREFIX + u.slice(0, 8) + "_" + hashOf(u) : k;   // two accounts that share the first 8 characters do not share a stash
}
function readStash(u: string): Stash | null { const v: any = readJson(stashKeyOf(u)); return v && v.uid === u && isObj(v.keys) ? v : null; }
function stashDirty(u: string, entries: Array<[string, number]>) {
  if (!entries.length) return;
  const st: Stash = readStash(u) || { uid: u, at: Date.now(), keys: {} };
  let bytes = 0;
  for (const [k, ts] of entries) {
    if (k.startsWith("@pack:")) {
      const p = k.slice(6), m = packMap(p);
      for (const id of Object.keys(m)) st.keys[p + id] = { raw: String(m[id]), ts };
    } else if (isSyncedKey(k, true) || packOf(k)) st.keys[k] = { raw: safeGet(k), ts };
  }
  for (const v of Object.values(st.keys)) bytes += (v.raw || "").length;
  if (bytes > 900000) return;   // too big to keep safely: the cloud push (flush) stays the only path
  st.at = Date.now(); writeJson(stashKeyOf(u), st);
}
function stashDrop(u: string, sent: Array<[string, string | null]>) {
  const st = readStash(u); if (!st) return;
  for (const [k, raw] of sent) if (st.keys[k] && st.keys[k].raw === raw) delete st.keys[k];
  if (Object.keys(st.keys).length) writeJson(stashKeyOf(u), st); else safeRemove(stashKeyOf(u));
}
// put an account's stash back after the wipe: keys the device does not hold yet get the stashed value (and the time it was changed), marked dirty so the next push carries them
function replayStash(u: string): Array<[string, number]> {
  const st = readStash(u), out: Array<[string, number]> = [];
  if (!st) return out;
  const meta = readMeta();
  for (const [k, e] of Object.entries(st.keys)) {
    if (e.raw === null || safeGet(k) !== null) continue;
    if (!(isSyncedKey(k, true) || packOf(k))) continue;
    safeSet(k, e.raw);
    if (!packOf(k)) meta[k] = { ts: e.ts, h: hashOf(e.raw) };
    out.push([k, e.ts]);
  }
  writeMeta(meta); safeRemove(stashKeyOf(u));
  return out;
}
// the changes of the account that is running now, kept before a switch or a sign-out resets the module
function stashRunning() {
  if (!uid) return;
  poll();
  stashDirty(uid, [...dirty.entries()]);
  stashedUid = uid;
}
let stashedUid: string | null = null;   // the account whose changes stopCloudSync stashed in this page (after a reload nothing is in memory, so then everything it holds is kept)
export function startCloudSync(userId: string) {
  if (!userId) return;
  if (uid === userId) return;
  stopCloudSync();
  // a DIFFERENT account on this device must never see or merge the previous account's data
  // Only a KNOWN different owner is wiped. An unknown owner (a browser that predates the marker, or a guest) is ADOPTED with everything it holds:
  // guessing "someone else was here" from leftovers wiped real progress. Trade-off, accepted: a pre-marker browser shared by two accounts lets the
  // first marker-less sign-in inherit what is on it (the owner marker ends this from then on).
  const owner = safeGet(OWNER_KEY);
  if (owner && owner !== userId) {
    // the previous account's unflushed changes: when the page was reloaded since (nothing in memory) everything it holds is kept, a merge makes it harmless
    if (stashedUid !== owner) stashDirty(owner, allSyncedKeys().map((k) => [packOf(k) ? "@pack:" + packOf(k) : k, Date.now()] as [string, number]));
    wipeSyncedLocal();
  } else if (!owner) {
    for (const k of Object.keys(STRATEGY)) if (STRATEGY[k] === "pncounter" && localBalance(k) > 0) guestAdopt.add(k);
  }
  stashedUid = null;
  safeSet(OWNER_KEY, userId);
  uid = userId;
  pruneLocal();
  dirty.clear(); lastRaw = new Map();
  const replayed = replayStash(userId);
  for (const k of allSyncedKeys()) lastRaw.set(k, safeGet(k) || "");
  for (const [k, ts] of replayed) dirty.set(packOf(k) ? "@pack:" + packOf(k) : k, ts);
  cycle(true);
  timer = setInterval(onTick, POLL_MS);
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", onPageHide); window.addEventListener("beforeunload", onPageHide);
    window.addEventListener("focus", onWake); window.addEventListener("online", onWake);
  }
}
export function stopCloudSync() {
  stashRunning();   // before anything is reset: a flush that never reaches the server must not lose the changes with the next wipe
  flushCloudSync();
  uid = null; gen++;
  if (timer) { clearInterval(timer); timer = null; }
  if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
  if (typeof window !== "undefined") {
    window.removeEventListener("pagehide", onPageHide); window.removeEventListener("beforeunload", onPageHide);
    window.removeEventListener("focus", onWake); window.removeEventListener("online", onWake);
  }
  // reset every bit of module state so nothing of one account can reach the next
  dirty = new Map(); lastRaw = new Map(); inFlight = false; rerun = false; rerunPush = false; rerunForce = false; rerunNoPull = true; guestAdopt.clear();
  firstPullDone = false; lastPullAt = 0; failCount = 0; nextTryAt = 0; pollCount = 0;
  packCloud.clear(); pnCloud.clear(); bigSkipped.clear(); lastBigPush.clear(); lastCloudKeys = new Set();
  settleReady(); firstAttemptDone = false;
}
/** Pushes what is dirty right now (page hide / sign-out): no pull first, nothing is delayed. */
export function flushCloudSync(): Promise<void> {
  if (!uid) return Promise.resolve();
  poll();
  if (dirty.size) { nextTryAt = 0; return cycle(true, { force: true, noPull: true }); }
  return Promise.resolve();
}
/** One full round right now (poll, pull, push): for tests, and for a screen that wants the cloud settled before it goes on. */
export async function cloudSyncNow(): Promise<void> {
  if (!uid) return;
  poll(); nextTryAt = 0;
  await cycle(true, { force: true });
}
/** Resolves when the first pull has been applied (or failed, or `ms` passed): the app can then paint with the pulled data. */
export function cloudSyncReady(ms = 2500): Promise<void> {
  if (!uid || firstAttemptDone) return Promise.resolve();
  return new Promise<void>((res) => { let done = false; const fin = () => { if (!done) { done = true; res(); } }; readyWaiters.push(fin); setTimeout(fin, ms); });
}
function onTick() {
  if (!uid) return;
  pollCount++;
  poll();
  const visible = typeof document === "undefined" || document.visibilityState !== "hidden";
  if (Date.now() < nextTryAt) return;
  if (!firstPullDone) { cycle(true, { force: true }); return; }
  if (visible && pollCount % 3 === 0) cycle(true, { force: true });
  else if (dirty.size) cycle(true);
}
function onVisibility() {
  if (document.visibilityState === "hidden") flushCloudSync();
  else if (document.visibilityState === "visible") onWake();
}
function onWake() { if (!uid) return; poll(); nextTryAt = 0; cycle(true, { force: true }); }
function onPageHide() { flushCloudSync(); }

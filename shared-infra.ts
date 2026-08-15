import { sb } from "./supabase-client";

/* ── shared-infra.ts ──
   Cross-cutting app infrastructure that isn't specific to any one feature:
   the daily-reset date/timezone utilities (dayDate/ymd/dayKey — used by
   streaks, quests, and the activity log alike), web push subscription,
   generic usage-tracking, the unified local activity-log journal (feeds
   Today/Insights/Report Card), and the guest-mode profile system. Extracted
   from App.tsx verbatim — no logic changes — as part of the App.tsx
   modularization.

   Note: logPractice()/logExpGain() stay in App.tsx for now — logPractice
   calls bumpStreak() (gamification, not yet extracted); moving just
   readPracticeLog()/dayKey() here still resolves the useful half of that
   coupling for logActivity() and everything that reads the practice log
   directly. ── */


/* Daily reset (streak, daily quest, gift box) runs on ONE fixed time zone so the
   day boundary is the SAME on every device instead of each phone's local clock.
   0 = GMT/UTC. Bangkok/ICT is 420 (UTC+7) — flip this one number to change it. */
export const DAY_TZ_OFFSET_MIN = 0;
/* Shift a real instant so its LOCAL date fields read as the chosen zone's wall clock. */
export function dayDate(d = new Date()) {
  return new Date(d.getTime() + (d.getTimezoneOffset() + DAY_TZ_OFFSET_MIN) * 60000);
}

/* Date as YYYY-MM-DD in the daily-reset zone (used by daily streak + daily quest). */
export function ymd(d) {
  const z = dayDate(d);
  return z.getFullYear() + "-" +
    String(z.getMonth() + 1).padStart(2, "0") + "-" +
    String(z.getDate()).padStart(2, "0");
}

/* ── Web Push (re-engagement notifications) ──
   This public key is safe to ship in client code — VAPID public keys are
   meant to be public, the matching private key (kept only as a Supabase Edge
   Function secret, never in this file) is what actually authorizes sending.
   REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY: generate a pair with
   `npx web-push generate-vapid-keys`, paste the public half here, and set
   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY as secrets on the send-reminders
   function. Push stays silently unavailable (no crash) until this is set. */
export const VAPID_PUBLIC_KEY = "BOgCv6bbh5kTAMtJEttVE10xpWE1ej2qNEAyuF6fX6tSu449wUYGAB1srvlZcYIMM5AYpWui_ZYFNhTQMo3KyRo";
export function urlBase64ToUint8Array(base64) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
export function pushSupported() {
  return VAPID_PUBLIC_KEY !== "REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY" &&
    "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
}
export async function subscribePush(userId) {
  if (!pushSupported()) return false;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  const j = sub.toJSON();
  await sb.from("push_subscriptions").upsert({
    user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
  }, { onConflict: "endpoint" });
  return true;
}
export async function unsubscribePush() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg && await reg.pushManager.getSubscription();
  if (!sub) return;
  try { await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint); } catch (e) {}
  await sub.unsubscribe();
}
// Fire-and-forget usage tracking (nav clicks / pathway topics / page visits) so
// the admin can see what's actually used. Never awaited, never blocks the UI,
// and any failure (offline, RLS, whatever) is silently swallowed — a missed
// analytics row is never worth degrading the learner's experience.
export function logUsage(kind, itemId) {
  sb.auth.getSession().then(({ data }) => {
    const uid = data && data.session && data.session.user && data.session.user.id;
    if (!uid || !itemId) return;
    sb.from("usage_events").insert({ user_id: uid, kind, item_id: String(itemId) }).then(() => {}, () => {});
  }, () => {});
}

/* ── practice activity log (localStorage) powering the progress dashboard ── */
export const PRACTICE_LOG_KEY = "tg_practice_log";
export function dayKey(d = new Date()) { const z = dayDate(d); return z.getFullYear() + "-" + String(z.getMonth() + 1).padStart(2, "0") + "-" + String(z.getDate()).padStart(2, "0"); }
export function readPracticeLog() { try { return JSON.parse(localStorage.getItem(PRACTICE_LOG_KEY) || "{}") || {}; } catch (e) { return {}; } }

/* ════════════════════════════════════════════════════════════
   ACTIVITY LOG — one unified local journal of everything practiced
   (what, how accurate, how long). The Today plan, Insights page and
   weekly Report Card are all views over this single stream, so every
   mode only has to report here once.
════════════════════════════════════════════════════════════ */
export const ACT_LOG_KEY = "tg_act_log";
export function readActLog() { try { return JSON.parse(localStorage.getItem(ACT_LOG_KEY) || "[]") || []; } catch (e) { return []; } }
export function logActivity(kind, id, ok, miss, sec, skill = null) {
  try {
    const a = readActLog();
    const entry = { t: Date.now(), d: dayKey(), k: kind, id: String(id || ""), ok: Math.max(0, Math.round(ok || 0)), miss: Math.max(0, Math.round(miss || 0)), sec: Math.max(0, Math.round(sec || 0)) };
    if (skill) entry.skill = skill; // explicit skill tag — see skillsOfActivity(); older entries infer skill from kind/id instead
    a.push(entry);
    localStorage.setItem(ACT_LOG_KEY, JSON.stringify(a.slice(-1500)));
  } catch (e) {}
}

// B1: Spaced Repetition Review (SRS) — schedule topics at 1/3/7/14/30 day intervals
export function recordSRS(topicId) {
  try {
    const data = JSON.parse(localStorage.getItem("tg_srs") || "{}");
    const e = data[topicId] || { count: 0 };
    e.count = (e.count || 0) + 1;
    e.lastDone = Date.now();
    const intervals = [1, 3, 7, 14, 30];
    const days = intervals[Math.min(e.count - 1, intervals.length - 1)];
    e.nextReview = Date.now() + days * 86400000;
    data[topicId] = e;
    localStorage.setItem("tg_srs", JSON.stringify(data));
  } catch (_) {}
}
export function getDueSRS() {
  try {
    const data = JSON.parse(localStorage.getItem("tg_srs") || "{}");
    const now = Date.now();
    return Object.entries(data)
      .filter(([, e]: [string, any]) => (e as any).nextReview && (e as any).nextReview <= now)
      .map(([id, e]: [string, any]) => ({ id, ...(e as any) }));
  } catch (_) { return []; }
}

// B2: Note Weakness — track which pitch classes are missed most across song plays
export function recordNoteMisses(notes) {
  try {
    const data = JSON.parse(localStorage.getItem("tg_note_miss") || "{}");
    for (const n of notes) {
      const pc = n.replace(/\d/g, ""); // strip octave → pitch class C, D#, etc.
      data[pc] = (data[pc] || 0) + 1;
    }
    localStorage.setItem("tg_note_miss", JSON.stringify(data));
  } catch (_) {}
}

/* ── Guest mode ──
   No session = no locked door: land straight in the app with a synthetic
   profile-shaped object standing in for a real Supabase row. Every existing
   `profile.x` read, gainExp(), earnCoins() etc. work unchanged against it —
   the one real difference is nothing here reaches Supabase until the guest
   actually logs in, at which point mergeGuestProgressIntoProfile() folds it
   into their new real row (see loadProfile's caller). Free for GUEST_TRIAL_MS
   of cumulative use (persists across visits — refreshing buys no extra time),
   tracked separately from any one page's `profile.exp` etc. so it survives
   a guest bouncing between pages. */
export const GUEST_TRIAL_MS = 5 * 60 * 1000;
export const GUEST_PROFILE_KEY = "tg_guest_profile";
export const GUEST_MS_KEY = "tg_guest_ms";
export function freshGuestProfile() {
  return {
    id: "guest", full_name: "", email: "",
    exp: 0, coins: 0, streak: 0, lessons_done: 0, gems: 0,
    plan: "free", plan_until: null, onboarded: true,
    admin_tier: 0, is_admin: false, banned: false,
    progress: {}, created_at: new Date().toISOString(),
  };
}
export function loadGuestProfile() {
  try {
    const raw = localStorage.getItem(GUEST_PROFILE_KEY);
    if (raw) return { ...freshGuestProfile(), ...JSON.parse(raw) };
  } catch (e) {}
  return freshGuestProfile();
}
export function saveGuestProfile(p) {
  try { localStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(p)); } catch (e) {}
}
export function clearGuestProfile() {
  try { localStorage.removeItem(GUEST_PROFILE_KEY); localStorage.removeItem(GUEST_MS_KEY); } catch (e) {}
}
export function getGuestMs() {
  try { return parseInt(localStorage.getItem(GUEST_MS_KEY) || "0", 10) || 0; } catch (e) { return 0; }
}
export function addGuestMs(deltaMs) {
  const next = getGuestMs() + Math.max(0, deltaMs);
  try { localStorage.setItem(GUEST_MS_KEY, String(next)); } catch (e) {}
  return next;
}
export function guestHasProgress(p) {
  return !!p && (p.exp > 0 || p.coins > 0 || p.lessons_done > 0 || p.streak > 0);
}
// Folds guest progress into a real profile row the moment one exists for this
// uid — same "keep the better number" idea as the coins-merge-on-load effect
// elsewhere in this file, just extended to every field a guest can earn.
// Never destructive: every field is max(server, guest), never overwritten
// downward, so a returning member who also poked around as a guest can only
// gain, never lose, existing progress.
export async function mergeGuestProgressIntoProfile(uid, real) {
  const guest = loadGuestProfile();
  const merged = {
    exp: Math.max(real.exp || 0, guest.exp || 0),
    coins: Math.max(real.coins || 0, guest.coins || 0),
    streak: Math.max(real.streak || 0, guest.streak || 0),
    lessons_done: Math.max(real.lessons_done || 0, guest.lessons_done || 0),
    updated_at: new Date().toISOString(),
  };
  try {
    const { data } = await sb.from("profiles").update(merged).eq("id", uid).select("*").maybeSingle();
    clearGuestProfile();
    return data || { ...real, ...merged };
  } catch (e) {
    // offline/error — leave tg_guest_profile in place, try again next loadProfile()
    return real;
  }
}

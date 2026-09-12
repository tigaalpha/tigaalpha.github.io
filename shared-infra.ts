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
/* A stable id for THIS BROWSER, with no account behind it. Lets the admin see
   that one person opened six pages and left, rather than six unrelated hits —
   and, because it keeps being sent after login too, lets a visit be matched to
   the account it eventually became. Not an identity: it is a random value in
   this browser's own localStorage, it never leaves the device except on these
   rows, and clearing site data resets it. */
const ANON_ID_KEY = "tg_anon_id";
export function anonId() {
  try {
    let v = localStorage.getItem(ANON_ID_KEY);
    if (!v) {
      v = (crypto && crypto.randomUUID) ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(ANON_ID_KEY, v);
    }
    return v;
  } catch (e) { return null; }
}

/* Where this visit came from, captured ONCE on the first page of the visit —
   document.referrer is blank after the first client-side navigation, and
   utm_source only ever appears on the landing URL, so reading either later
   gives "direct" for traffic that was actually paid for. */
const SRC_KEY = "tg_src";
export function trafficSource() {
  try {
    const saved = localStorage.getItem(SRC_KEY);
    if (saved) return saved;
    const q = new URLSearchParams(window.location.search);
    const utm = q.get("utm_source") || q.get("source") || q.get("fbclid") && "facebook" || "";
    let v = utm;
    if (!v && document.referrer) {
      try { v = new URL(document.referrer).hostname.replace(/^www\./, ""); } catch (e) {}
    }
    v = (v || "direct").slice(0, 60);
    localStorage.setItem(SRC_KEY, v);
    return v;
  } catch (e) { return "direct"; }
}

/* Which browser this is, bucketed. The whole reason this column exists: on
   2026-09-11 a paid campaign produced 393 visits and zero accounts because
   Google refuses OAuth inside a social app's WebView, and nothing in the data
   would have shown that. Now the share of visitors stuck in one is countable. */
export function uaKind() {
  try {
    const ua = navigator.userAgent || "";
    if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "facebook-webview";
    if (/Instagram/i.test(ua)) return "instagram-webview";
    if (/Messenger/i.test(ua)) return "messenger-webview";
    if (/Line\/|LIFF/i.test(ua)) return "line-webview";
    if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return "tiktok-webview";
    if (/Android/i.test(ua) && /;\s*wv\)/i.test(ua)) return "android-webview";
    if (/CriOS/i.test(ua)) return "ios-chrome";
    if (/iPhone|iPad|iPod/i.test(ua)) return /Safari\//i.test(ua) ? "ios-safari" : "ios-webview";
    if (/Android/i.test(ua)) return "android-chrome";
    return "desktop";
  } catch (e) { return "?"; }
}

/* Fire-and-forget usage tracking. This used to `return` whenever there was no
   session, which meant a visitor who never logged in left no trace at all —
   the admin could see what members did and nothing whatsoever about the people
   the advertising actually brought in. usage_events.user_id was already
   nullable; the row just was not being written. */
export function logUsage(kind, itemId, durationMs = null) {
  if (!itemId) return;
  const row = {
    kind, item_id: String(itemId),
    anon_id: anonId(), src: trafficSource(), ua: uaKind(),
  };
  if (durationMs != null) row.duration_ms = Math.max(0, Math.round(durationMs)); // page dwell time (admin analytics)
  const send = (uid) => {
    // user_id must stay null for a signed-out visitor: the anon insert policy
    // only accepts rows that claim no user.
    sb.from("usage_events").insert(uid ? { ...row, user_id: uid } : row).then(() => {}, () => {});
  };
  sb.auth.getSession().then(
    ({ data }) => send((data && data.session && data.session.user && data.session.user.id) || null),
    () => send(null),
  );
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
/* Five seconds, set by the owner.

   The historical argument against going this low is kept below, because it is
   the only measured thing the app has on the question:

     0-5 s   40 people   0 signed up
     5-10 s   4 people   0
     10-14 s  3 people   0
     14-20 s  3 people   1          <- first unprompted sign-up
     20-30 s  3 people   2
     30 s+    5 people   0

   Every unprompted sign-up landed between 14 and 26 seconds.

   What changed is that a later look at a full day of arrivals showed the
   number was never the binding constraint: of 90 signed-out visitors, 5 used
   the menu and 9 opened a lesson. Roughly 80 left without touching anything,
   most of them inside an in-app browser, and 0 of the 90 signed up. Whatever
   is losing people happens well before any gate, so the gate is cheap to move
   and the honest next step is to watch post-gate sign-ups by method on the
   dashboard rather than argue the second-mark again. */
export const GUEST_TRIAL_MS = 10 * 1000;
/* How often the guest clock is written down. It has to stay well under the
   gate: the gate can only fire on a flushed total, so a tick coarser than
   GUEST_TRIAL_MS silently postpones it to the next tick. That is not
   hypothetical — this was a flat 10 s while the gate was 15 s, which made the
   real gate 20 s, and a 5 s gate would likewise have behaved as a 10 s one.
   Deriving it from the gate means the two cannot drift apart again. */
export const GUEST_TICK_MS = Math.max(1000, Math.min(5000, Math.round(GUEST_TRIAL_MS / 4)));
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

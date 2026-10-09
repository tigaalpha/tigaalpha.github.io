import { sb } from "./supabase-client";
import { anonId, trafficSource, uaKind, deviceInfo, deviceWidth, setSkipOnboard, consumeSkipOnboard, GUEST_PROFILE_KEY, readLandingOrigin, clearLandingOrigin } from "./local-identity";
export { anonId, trafficSource, uaKind, deviceInfo, deviceWidth, setSkipOnboard, consumeSkipOnboard, GUEST_PROFILE_KEY, readLandingOrigin, clearLandingOrigin };
/* anonId/trafficSource/uaKind and the skip-onboard flag moved VERBATIM to
   local-identity.ts, which imports nothing — the landing bundle needs them
   and must not reach this file's supabase import. Re-exported so every
   existing app import keeps resolving. */

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

/* The owner's LINE Official Account add-friend link ("https://lin.ee/…"). EMPTY on purpose: the
   2026-10-02 report asked for LINE as the way to reach people the app cannot otherwise reach
   (2 of 70 had push on), but the channel does not exist yet — creating it is the owner's step
   (LINE Developers console). While this is empty no LINE button is drawn anywhere; paste the link
   here and the "add us on LINE" row appears under the result of a song. */
export const LINE_OA_URL = "";

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
    dev: deviceInfo(), dev_w: deviceWidth(),
  };
  if (durationMs != null) row.duration_ms = Math.max(0, Math.round(durationMs)); // page dwell time (admin analytics)
  const send = (uid) => {
    // user_id must stay null for a signed-out visitor: the anon insert policy
    // only accepts rows that claim no user.
    const base = uid ? { ...row, user_id: uid } : row;
    sb.from("usage_events").insert(base).then(() => {}, (err) => {
      /* PGRST204 = "column not found in the schema cache": the dev/dev_w
         columns ship in this bundle BEFORE supabase-usage-device-migration.sql
         has been applied to the live project. Dropping just the two new
         fields and resending keeps every event flowing (analytics loses two
         columns on a few early rows; losing whole rows loses everything).
         The dev/dev_w pair is the only addition this row has made, so one
         stripped retry is a complete fallback, not a heuristic. */
      if (err && err.code === "PGRST204") {
        const { dev, dev_w, ...rest } = base;
        sb.from("usage_events").insert(rest).then(() => {}, () => {});
      }
    });
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
/* ปลายทางของ trace (แผน 18) — learning-data.ts ติดตั้งตัวรับตอนบูต. ว่าง = มีแค่
   localStorage ตามเดิม ไม่มีใครฟัง ไม่มีอะไรเขียนออกไปที่ไหน */
let actTraceSink = null;
export function setActTraceSink(fn) { actTraceSink = typeof fn === "function" ? fn : null; }
export function logActivity(kind, id, ok, miss, sec, skill = null) {
  try {
    const a = readActLog();
    const entry = { t: Date.now(), d: dayKey(), k: kind, id: String(id || ""), ok: Math.max(0, Math.round(ok || 0)), miss: Math.max(0, Math.round(miss || 0)), sec: Math.max(0, Math.round(sec || 0)) };
    if (skill) entry.skill = skill; // explicit skill tag — see skillsOfActivity(); older entries infer skill from kind/id instead
    a.push(entry);
    localStorage.setItem(ACT_LOG_KEY, JSON.stringify(a.slice(-1500)));
    // แผน 18: ทุกอย่างที่ซ้อมควรเป็นหลักฐาน 1 รอบ ไม่ใช่แค่ practice-mode
    // ตัวตัดสินใจ (ควรส่งไหม/โควตา) อยู่ใน activity-trace.ts จริง ๆ และถูกติดตั้งจาก
    // learning-data.ts ตอนบูต (มันรู้สถานะผู้เรียนอยู่แล้ว) — การเชื่อมแบบ
    // register/listen ตรง ๆ แทนการ import ทั้งสองทาง กันวงจรนอก (shared-infra
    // อยู่ล่าง learning-data แล้ว) และไม่แตะของผู้เรียนเลยเมื่อไม่มีผู้ฟัง
    try { if (actTraceSink) actTraceSink(entry); } catch (e) {}
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
    // plan 27 · P0-3: the same misses by DAY, so the page can say "this week" instead of a lifetime total
    const byDay = JSON.parse(localStorage.getItem("tg_note_miss_d") || "{}") || {};
    const today = new Date().toISOString().slice(0, 10);
    const row = byDay[today] || (byDay[today] = {});
    for (const n of notes) { const pc = String(n).replace(/\d/g, ""); if (pc) row[pc] = (row[pc] || 0) + 1; }
    const keep = Object.keys(byDay).sort().slice(-30);
    const out = {}; for (const k of keep) out[k] = byDay[k];
    localStorage.setItem("tg_note_miss_d", JSON.stringify(out));
  } catch (_) {}
}
/* Misses of the last `days` days (plan 27 · P0-3), same shape as readNoteMisses(): [{pc, n}] most missed first. Only misses recorded
   since the by-day log began are here — the old lifetime total is not guessed into a week. */
export function readRecentNoteMisses(days = 7) {
  try {
    const byDay = JSON.parse(localStorage.getItem("tg_note_miss_d") || "{}") || {};
    const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);
    const sum: Record<string, number> = {};
    for (const d of Object.keys(byDay)) if (d >= from) for (const pc in byDay[d]) sum[pc] = (sum[pc] || 0) + (Number(byDay[d][pc]) || 0);
    return Object.keys(sum).filter(pc => sum[pc] > 0).map(pc => ({ pc, n: sum[pc] })).sort((a, b) => b.n - a.n || a.pc.localeCompare(b.pc));
  } catch (_) { return []; }
}

/* The reader for exactly what recordNoteMisses() writes — pitch class (no
   octave) → how many times the learner has missed it. Added for plan 26 · P6,
   which shows these counts on the practice page; before this the numbers were
   written on every drill and never once read back by anything in the UI. */
export function readNoteMisses() {
  try {
    const raw = JSON.parse(localStorage.getItem("tg_note_miss") || "{}") || {};
    const out = [];
    for (const pc in raw) {
      const n = Number(raw[pc]) || 0;
      if (n > 0) out.push({ pc, n });
    }
    out.sort((a, b) => b.n - a.n || a.pc.localeCompare(b.pc));
    return out;
  } catch (_) { return []; }
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

/* ── Kid mode (plan 27 · P1-5; owner 2026-10-09: "even a 6-year-old must understand") ──
   Shorter words on the practice screens. On by choice (Settings), or by itself when the profile's age says child (≤ 9) and the
   learner has not chosen. `tg_kid`: "1" on, "0" off, absent = follow the age. */
export function readKidPref(): string | null { try { return localStorage.getItem("tg_kid"); } catch (e) { return null; } }
export function writeKidPref(on: boolean) { try { localStorage.setItem("tg_kid", on ? "1" : "0"); } catch (e) {} }
export function kidModeOn(profile: any, pref: string | null = readKidPref()): boolean {
  if (pref === "1") return true;
  if (pref === "0") return false;
  try {
    const age = profile && profile.age != null ? Number(profile.age) : null;
    if (age != null && Number.isFinite(age) && age > 0 && age <= 9) return true;
    return !!(profile && profile.ageBand === "child");
  } catch (e) { return false; }
}

/* The kid-mode flag as the non-React code (prompt builders) sees it: PianoApp sets it on every render from kidModeOn(). */
let _kidNow = false;
export function setKidNow(on: boolean) { _kidNow = !!on; }
export function isKidNow() { return _kidNow; }
/* What the AI tutor is told in kid mode. Appended to the system prompt of the chat and of the coaching tip. */
export function kidPromptBlock(lang: string): string {
  if (!_kidNow) return "";
  return lang === "th"
    ? "\n\n[โหมดเด็ก: ผู้เรียนอาจอายุเพียง 6 ขวบ — ใช้คำง่ายมาก ประโยคสั้น ๆ ไม่เกิน 2 ประโยค ห้ามใช้ศัพท์ทฤษฎีโดยไม่อธิบายด้วยของใกล้ตัว ใช้ชื่อโน้ต โด เร มี ฟา ซอล ลา ที คู่กับตัวอักษร และชวนให้ลองกดคีย์ทีละอย่าง ใจดีและให้กำลังใจเสมอ]"
    : lang === "zh"
    ? "\n\n[儿童模式：学习者可能只有 6 岁——用很简单的词，句子很短，最多 2 句；不解释就不用理论术语，用身边的东西打比方；音名用 Do Re Mi 加字母；一次只让他按一个键；永远温柔、多鼓励]"
    : "\n\n[Kid mode: the learner may be only 6 years old — use very simple words and short sentences, at most 2; never use a theory word without explaining it with something from daily life; name notes Do Re Mi next to their letters; ask for one key at a time; always kind and encouraging]";
}

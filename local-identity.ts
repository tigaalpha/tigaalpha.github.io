/* ── local-identity.ts ──
   Pure-localStorage identity + guest-profile helpers, split out of
   shared-infra.ts VERBATIM. shared-infra statically imports the Supabase
   client, and the landing page needs three of these helpers — so importing
   them from shared-infra dragged ~40 kB gzip of supabase-js into the landing
   bundle on every ad click, before the piano had rendered a single key.
   Median dwell on that page is ~2 s; those kilobytes ARE the bounce.

   This module imports NOTHING. Both the app (via shared-infra's re-exports,
   so no app call site changes) and the landing bundle (directly) use these.
   If a helper here changes meaningfully, shared-infra's copy is a re-export,
   so there is exactly one definition to update. */

/* ── VERBATIM from shared-infra.ts ──
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
   not per event.utm_source wins, then the first referrer's hostname; "direct"
   when there is neither. Written down because later pages of the same visit
   have nothing to read a source from. */
const SRC_KEY = "tg_src";
export function trafficSource() {
  try {
    const saved = localStorage.getItem(SRC_KEY);
    if (saved) return saved;
    const q = new URLSearchParams(window.location.search);
    const utm = q.get("utm_source") || q.get("source") || (q.get("fbclid") && "facebook") || "";
    let v = utm;
    if (!v && document.referrer) {
      try { v = new URL(document.referrer).hostname.replace(/^www\./, ""); } catch (e) {}
    }
    v = (v || "direct").slice(0, 60);
    localStorage.setItem(SRC_KEY, v);
    return v;
  } catch (e) { return "direct"; }
}

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

/* ── "this account came from the landing page — skip the second form" flag ──
   The landing page's sign-up card already collects a name (email path) or
   arrives with one (Google/LINE OAuth); asking the same person to fill the
   app's ProfileForm — email, LINE ID, phone, Instagram — before they ever
   see the app lost people at exactly the moment they had just said yes.
   Written by the landing page before the OAuth redirect (localStorage
   survives it), consumed ONCE by the app's onboarding gate, then cleared —
   so it can never skip onboarding for an unrelated later login. */
const SKIP_ONBOARD_KEY = "tg_skip_onboard";
export function setSkipOnboard() {
  try { localStorage.setItem(SKIP_ONBOARD_KEY, "1"); } catch (e) {}
}
export function consumeSkipOnboard() {
  try {
    if (localStorage.getItem(SKIP_ONBOARD_KEY) === "1") {
      localStorage.removeItem(SKIP_ONBOARD_KEY);
      return true;
    }
  } catch (e) {}
  return false;
}

/* Guest profile lives under its own key; the landing page writes only the
   language field so a language picked on the landing survives into the app. */
export const GUEST_PROFILE_KEY = "tg_guest_profile";

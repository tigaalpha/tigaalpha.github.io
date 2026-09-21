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

/* ── which marketing landing page an account was born on ──
   The landing page STAMPS its own language here at the sign-up moment (not on
   first paint — a visitor who browses and leaves must not leave a stamp that
   would mislabel a later, different-language signup on the same device). The
   app reads it ONCE at first login, writes profiles.signup_landing + a
   usage_events row ("signed_up_landing", item_id "landing-en" …), then
   clears it — one-shot, so re-logins never overwrite the original answer.
   Lives in this module (imports nothing) so the landing bundle can use it
   without dragging supabase-js in. Value: "th" | "en" | "zh" only. */
export const LANDING_ORIGIN_KEY = "tg_landing_origin";
export function stampLandingOrigin(lg) {
  if (lg !== "th" && lg !== "en" && lg !== "zh") return;
  try { localStorage.setItem(LANDING_ORIGIN_KEY, lg); } catch (e) {}
}
export function readLandingOrigin() {
  try { const v = localStorage.getItem(LANDING_ORIGIN_KEY); return (v === "th" || v === "en" || v === "zh") ? v : null; } catch (e) { return null; }
}
export function clearLandingOrigin() { try { localStorage.removeItem(LANDING_ORIGIN_KEY); } catch (e) {} }

/* ── device classification, for usage analytics ──
   usage_events.ua already says WHICH BROWSER APP a visit came through
   (uaKind above — the Facebook/iPad webview question), but nothing anywhere
   said what KIND OF DEVICE the audience actually owns: the admin was choosing
   piano-key layouts and screen sizes blind. That decision was made from an
   anecdote ("an iPad user complained"), and the whole point of this column
   is to stop guessing.

   Three coarse buckets only, because a column nobody can remember the
   meaning of is a column nobody reads:
     phone    — phones (iPhone, Android handsets, mobile-width anything)
     tablet   — iPads (including iPadOS 13+ masquerading as desktop Safari —
                Apple reports those UAs as a Mac on purpose, so the Mac UA has
                to be interrogated for touch support) and Android tablets
     desktop  — real mice-and-keyboards (Windows/Mac/Linux desktop browsers)

   CAPTURED ONCE per visit, same convention as trafficSource(): a value that
   changes when a tablet rotates is a value that can't be grouped by. The
   width is read at first paint, when the layout being measured is the one
   the visitor actually got. Landing and app share this via local-identity so
   a landing visitor and the app session they become land on the same rows
   with the same vocabulary. */
const DEV_KEY = "tg_dev";
export function deviceInfo() {
  try {
    const saved = localStorage.getItem(DEV_KEY);
    if (saved) return saved;
    const ua = navigator.userAgent || "";
    const touch = (navigator.maxTouchPoints || 0) > 1;
    let v;
    /* iPadOS 13+ lies about being a Mac: "Macintosh" in the UA but touch
       points like a tablet. Every other iPad ships iPad|iPhone|iPod in the
       UA directly. iPhone/iPod are phones, not tablets — they share the
       iPad branch only because both are Apple touchscreen classifications. */
    if (/iPad|iPhone|iPod/.test(ua)) {
      v = (/iPhone|iPod/.test(ua)) ? "phone" : "tablet";
    } else if (/Macintosh/.test(ua) && touch) {
      v = "tablet";                       // iPadOS 13+ pretending to be a Mac
    } else if (/Android/i.test(ua)) {
      v = (Math.min(window.screen.width, window.screen.height) >= 600) ? "tablet" : "phone";
    } else if (/Windows Phone|IEMobile|Mobile/i.test(ua)) {
      v = "phone";
    } else if (touch && Math.min(window.screen.width, window.screen.height) < 600) {
      v = "phone";                        // touch+small: a phone-like device
    } else {
      v = "desktop";
    }
    v = v.slice(0, 20);
    localStorage.setItem(DEV_KEY, v);
    return v;
  } catch (e) { return "?"; }
}

/* Screen width at capture time, in CSS px — one number, capped, so the SQL
   side can bucket portrait phones vs tablets vs desktops without a second
   column. Read once per visit alongside deviceInfo(), for the same reason. */
export function deviceWidth() {
  try {
    return Math.min(4000, Math.max(200, Math.round(window.innerWidth || 0)));
  } catch (e) { return null; }
}

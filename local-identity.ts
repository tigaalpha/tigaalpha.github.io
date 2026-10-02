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

/* ── which campaign, ad set and creative, from where in the world ──
   usage_events.src says only WHICH SITE sent a visit ("fb", "ig", "tiktok.com").
   The 2026-10-02 users report could not say which campaign, ad set or creative
   a visitor came from, which landing variant they saw, or from which country
   (the Chinese page's sign-ups could not be explained without it), so no
   money could be moved from what failed to what worked. The usage_events table
   has no column for any of that and a column needs a migration, so it travels
   as ONE row of its own — kind "attr", item_id "first;s=fb;c=…;k=…;tz=…" — that
   the admin funnel joins back on anon_id. Nothing about a person is stored: the
   values are the ad's own tags, the time zone name and the browser language.

   FIRST touch is always logged (even a bare "direct" visit — it is what tells a
   cold visit from a tagged one). A later visit is logged as "touch" only when
   its URL carries tags that differ from the last tags logged, so a refresh or a
   revisit through the same ad does not repeat itself. */
const ATTR_KEY = "tg_attr";          // JSON of the FIRST touch of this device
const ATTR_SIG_KEY = "tg_attr_sig";  // the URL tags last written to usage_events
const ORIGIN_UA_KEY = "tg_origin_ua"; // the in-app browser this visit escaped from, if it did

/* Values go into a "k=v;k=v" string: strip the separators, collapse space, cap. */
function tidy(v, n = 40) {
  return String(v == null ? "" : v).replace(/[;=|\n\r\t]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);
}
function encodeTags(o) {
  return Object.keys(o).filter(k => o[k] !== "" && o[k] != null).map(k => k + "=" + o[k]).join(";");
}
/* What THIS url says about where the visit came from (utm_source is already
   trafficSource()'s business). Ad-click ids are recorded as presence only —
   the id itself is a tracking token that has no use here. */
function urlTags() {
  const q = new URLSearchParams(window.location.search);
  const click = q.get("fbclid") ? "fbclid" : q.get("ttclid") ? "ttclid" : q.get("gclid") ? "gclid"
    : q.get("msclkid") ? "msclkid" : q.get("igshid") ? "igshid" : "";
  return {
    m: tidy(q.get("utm_medium")), c: tidy(q.get("utm_campaign")), k: tidy(q.get("utm_content")),
    t: tidy(q.get("utm_term")), id: tidy(q.get("utm_id"), 24), ck: click, v: tidy(q.get("v"), 12),
  };
}
/* Which landing variant this visit is on: ?v=b, ?v=c … ("a" and no tag are the
   control). Kept for the whole device's life once seen, so a person who taps
   around the page, or comes back without the tag, stays in the arm they began in. */
const VARIANT_KEY = "tg_variant";
export function landingVariant() {
  try {
    const q = new URLSearchParams(window.location.search).get("v");
    const v = tidy(q, 12).toLowerCase();
    if (/^[a-z][a-z0-9]{0,11}$/.test(v)) { localStorage.setItem(VARIANT_KEY, v); return v; }
    return localStorage.getItem(VARIANT_KEY) || "a";
  } catch (e) { return "a"; }
}
/* Returns the item_id to log under kind "attr", or null when there is nothing
   new to say. `lg` is the page language (landing: th|en|zh, app: "app"). */
export function attributionEvent(lg = "") {
  try {
    const cur = urlTags();
    const has = !!(cur.m || cur.c || cur.k || cur.t || cur.id || cur.ck || cur.v);
    const lgp = tidy(lg, 4);
    const raw = localStorage.getItem(ATTR_KEY);
    if (!raw) {
      let tz = "";
      try { tz = tidy(Intl.DateTimeFormat().resolvedOptions().timeZone, 40); } catch (e) {}
      const rec = {
        s: trafficSource(), ...cur, lg: lgp, tz, nl: tidy(navigator.language, 12),
        oua: tidy(localStorage.getItem(ORIGIN_UA_KEY), 24),
      };
      localStorage.setItem(ATTR_KEY, JSON.stringify(rec));
      localStorage.setItem(ATTR_SIG_KEY, encodeTags(cur));
      return "first;" + encodeTags(rec);
    }
    if (has) {
      const sig = encodeTags(cur);
      if (sig !== localStorage.getItem(ATTR_SIG_KEY)) {
        localStorage.setItem(ATTR_SIG_KEY, sig);
        return "touch;" + encodeTags({ ...cur, lg: lgp });
      }
    }
    return null;
  } catch (e) { return null; }
}

/* ── carrying a visitor across the jump out of an in-app browser ──
   79% of the paid traffic opens inside Facebook's or Instagram's own browser
   (4,277 of 5,389 visitors in 30 days) and those visitors sign up at 0.12%
   against 2.2% for people in a real browser. 115 of them tapped "open in your
   browser" — and then vanished: the real browser has its own storage, so the
   same person arrived as a stranger with no source ("direct") and no past, and
   nobody could say whether the escape hatch led to a sign-up or to nothing.

   So the escape URL carries four short fields — the anon id, the minute it was
   made, the original source and the original browser kind. The page that opens
   on the other side adopts the id when (and only when) it has none of its own
   and the link is fresh (≤30 min), then removes the fields from the address bar
   so a copied or shared link cannot pass an identity on. The id is the random
   value this device already writes to every usage_events row; it names no one. */
export function handoffUrl(href, extra = {}) {
  try {
    const u = new URL(href);
    const aid = anonId();
    if (aid) {
      u.searchParams.set("hid", aid);
      u.searchParams.set("hat", String(Math.floor(Date.now() / 60000)));
    }
    u.searchParams.set("hsrc", trafficSource());
    u.searchParams.set("hua", uaKind());
    // hlg: the landing language the sign-up started on; hvia=mail: this URL rides
    // a magic-link email, which gets opened later and usually in ANOTHER browser
    if (extra.lg) u.searchParams.set("hlg", String(extra.lg).slice(0, 2));
    if (extra.via) u.searchParams.set("hvia", String(extra.via).slice(0, 8));
    return u.toString();
  } catch (e) { return href; }
}
/* Run ONCE, before anything reads anonId()/trafficSource() — the first call of
   either one fixes the value for the device's life. Returns null when the URL
   carried no handoff, else { aid, src, ua, adopted }: `adopted` is false when
   this browser already had an identity of its own (a returning visitor) or the
   link had gone stale — the arrival is still worth counting, the identity is
   simply not replaced.

   Two kinds of link carry it. An escape from an in-app browser is opened within
   minutes, so it is honoured for 30. A magic-link EMAIL is opened whenever the
   person gets to their inbox — and, as the 6 email accounts of the last month
   showed (only 2 of them could be tied back to a landing visit), in the mail
   app's own browser, which has none of the landing page's storage. It carries
   the landing language too, so the account is filed under the landing it came
   from, and is honoured for 24 hours. */
export function adoptHandoff() {
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams;
    if (!q.has("hid") && !q.has("hsrc") && !q.has("hua") && !q.has("hlg")) return null;
    const aid = q.get("hid") || "";
    const at = Number(q.get("hat"));
    const mail = q.get("hvia") === "mail";
    const ageMin = Math.floor(Date.now() / 60000) - at;
    const fresh = at > 0 && ageMin >= 0 && ageMin <= (mail ? 24 * 60 : 30);
    const src = tidy(q.get("hsrc"), 60);
    const ua = tidy(q.get("hua"), 24);
    const lg = tidy(q.get("hlg"), 2);
    let adopted = false;
    if (fresh && /^[A-Za-z0-9_-]{8,64}$/.test(aid) && !localStorage.getItem(ANON_ID_KEY)) {
      localStorage.setItem(ANON_ID_KEY, aid);
      if (src) localStorage.setItem(SRC_KEY, src);
      if (ua) localStorage.setItem(ORIGIN_UA_KEY, ua);
      adopted = true;
    }
    // the account this link is about to create is a landing sign-up of that language
    if (fresh && mail && (lg === "th" || lg === "en" || lg === "zh")) stampLandingOrigin(lg);
    ["hid", "hat", "hsrc", "hua", "hlg", "hvia"].forEach(k => q.delete(k));
    window.history.replaceState(window.history.state, "", url.pathname + (q.toString() ? "?" + q.toString() : "") + url.hash);
    return { aid, src, ua, adopted };
  } catch (e) { return null; }
}

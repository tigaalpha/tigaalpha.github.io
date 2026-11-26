/* analytics.ts — one small module for GA4 + Meta Pixel + TikTok Pixel events and the cookie choice (Step 2.3, owner 2026-11-26).
   Plain module: it imports only local-identity.ts (no supabase), so the landing bundle can use it too (landing/landing-analytics.ts re-exports this file; landing must never import app code).

   - track(name, params) sends a GA4 event through window.gtag (Consent Mode v2 decides what Google may store) and, ONLY after the visitor accepted marketing AND a pixel id is configured
     (VITE_META_PIXEL_ID / VITE_TIKTOK_PIXEL_ID), the matching Meta / TikTok standard event. With no id configured no pixel script is ever loaded. IDs are never written in code.
   - Nothing personal is ever sent: params named like a name / e-mail / phone / password are dropped and any string that looks like an e-mail address is removed.
   - The choice lives in localStorage tg_consent = {v, a, m, t} (v = CONSENT_VERSION, a = analytics 0|1, m = marketing 0|1) plus the older tg_ga ("1" | "0") kept in step. The banner itself is
     public/ga.js (vanilla, shared by the app, the landing and the blog pages); it writes the same two keys and fires the "tg:consent" event this module listens to.
   - Pixel scripts load async, once, after marketing consent. A visitor who withdraws marketing consent stops being sent events at once (the page reloads clean on the next visit). */
import { captureUtm, utmForSignup, landingVariant } from "./local-identity";

/* Owner switch: is analytics (GA4 storage) ON before the visitor chooses? false = wait for the choice (PDPA-safe); true = measure everybody who has not declined (the old behaviour).
   public/ga.js, index.template.html and landing/index.template.html carry the same default through their own copy of this constant — change all three together (scripts/verify-analytics-consent.mjs pins that). */
export const ANALYTICS_DEFAULT_GRANTED = false;
export const CONSENT_VERSION = "2026-11-26";

/* try/catch: a few node-side checks load this file with no import.meta.env at all. In the real build Vite replaces the two literal reads below. */
const META_ID: string = (() => { try { return import.meta.env.VITE_META_PIXEL_ID || ""; } catch (e) { return ""; } })();
const TIKTOK_ID: string = (() => { try { return import.meta.env.VITE_TIKTOK_PIXEL_ID || ""; } catch (e) { return ""; } })();

export function readConsent(): { a: boolean; m: boolean; chosen: boolean } {
  try {
    const j = JSON.parse(localStorage.getItem("tg_consent") || "null");
    if (j && typeof j === "object") return { a: j.a === 1 || j.a === true, m: j.m === 1 || j.m === true, chosen: true };
    const ga = localStorage.getItem("tg_ga");
    if (ga === "1") return { a: true, m: false, chosen: false };
    if (ga === "0") return { a: false, m: false, chosen: false };
  } catch (e) {}
  return { a: ANALYTICS_DEFAULT_GRANTED, m: false, chosen: false };
}

/* Called by anything that wants to write the choice from code (the banner in ga.js writes the same keys itself). */
export function setConsent(a: boolean, m: boolean) {
  try { localStorage.setItem("tg_consent", JSON.stringify({ v: CONSENT_VERSION, a: a ? 1 : 0, m: m ? 1 : 0, t: Date.now() })); localStorage.setItem("tg_ga", a ? "1" : "0"); } catch (e) {}
  try {
    const g = (window as any).gtag;
    if (typeof g === "function") g("consent", "update", { analytics_storage: a ? "granted" : "denied", ad_storage: m ? "granted" : "denied", ad_user_data: m ? "granted" : "denied", ad_personalization: m ? "granted" : "denied" });
  } catch (e) {}
  try { window.dispatchEvent(new Event("tg:consent")); } catch (e) {}
}

const realHost = () => { try { const h = location.hostname.toLowerCase(); return h === "www.tigaalpha.com" || h === "tigaalpha.com"; } catch (e) { return false; } };

let pixelsLoaded = false;
function loadPixels() {
  if (pixelsLoaded || !realHost() || !readConsent().m) return;
  pixelsLoaded = true;
  const w: any = window, d = document;
  try {
    if (META_ID && !w.fbq) {
      const n: any = (w.fbq = function (...a: any[]) { n.callMethod ? n.callMethod.apply(n, a) : n.queue.push(a); });
      if (!w._fbq) w._fbq = n; n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
      const s = d.createElement("script"); s.async = true; s.src = "https://connect.facebook.net/en_US/fbevents.js"; d.head.appendChild(s);
      w.fbq("init", META_ID); w.fbq("track", "PageView");
    }
  } catch (e) {}
  try {
    if (TIKTOK_ID && !w.ttq) {
      const t: any = (w.ttq = []); t._i = {}; t._t = {};
      ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"].forEach((m) => { t[m] = function (...a: any[]) { t.push([m].concat(a)); }; });
      t.load = function (id: string) { t._i[id] = []; const s = d.createElement("script"); s.async = true; s.src = "https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=" + id + "&lib=ttq"; d.head.appendChild(s); };
      t.load(TIKTOK_ID); t.page();
    }
  } catch (e) {}
}
if (typeof window !== "undefined") {
  try { window.addEventListener("tg:consent", loadPixels); } catch (e) {}
  try { captureUtm(); loadPixels(); } catch (e) {}
}

/* GA4 event name → { meta standard event, tiktok standard event }. Only these reach the ad platforms. */
export const PIXEL_MAP: Record<string, { meta?: string; tiktok?: string }> = {
  sign_up: { meta: "CompleteRegistration", tiktok: "CompleteRegistration" },
  trial_start: { meta: "StartTrial", tiktok: "StartTrial" },
  begin_checkout: { meta: "InitiateCheckout", tiktok: "InitiateCheckout" },
  purchase: { meta: "Purchase", tiktok: "CompletePayment" },
  signup_open: { meta: "Lead" },
};

const PRIVATE_KEY = /(name|mail|phone|tel|mobile|line_?id|password|pass|token|address|birth)/i;
export function cleanParams(p: Record<string, any> = {}) {
  const o: Record<string, any> = {};
  Object.keys(p).forEach((k) => {
    if (PRIVATE_KEY.test(k)) return;
    const v = p[k];
    if (v == null) return;
    if (typeof v === "string") { if (/[^\s@]+@[^\s@]+/.test(v)) return; o[k] = v.slice(0, 100); }
    else if (typeof v === "number" || typeof v === "boolean") o[k] = v;
  });
  return o;
}

export function track(name: string, params: Record<string, any> = {}) {
  try {
    const clean = cleanParams(params), w: any = window;
    if (typeof w.gtag === "function") w.gtag("event", name, clean);
    const map = PIXEL_MAP[name];
    if (map && readConsent().m && realHost()) {
      if (map.meta && typeof w.fbq === "function") { const px: any = {}; if (clean.value != null) { px.value = clean.value; px.currency = clean.currency; } w.fbq("track", map.meta, px); }
      if (map.tiktok && w.ttq && typeof w.ttq.track === "function") { const px: any = {}; if (clean.value != null) { px.value = clean.value; px.currency = clean.currency; } w.ttq.track(map.tiktok, px); }
    }
  } catch (e) {}
}

/* The campaign tags to put on a sign-up (last touch, else first): utm_source / utm_medium / utm_campaign, empty when none. */
export const signupUtm = utmForSignup;

/* What the central loggers (logUsage in the app, logLand on the landing) hand over, mapped to the GA4 names of the conversion plan. One place, so no screen needs its own track() call for these. */
const seenOnce: Record<string, boolean> = {};
export function mirrorUsage(kind: string, itemId: string) {
  try {
    const id = String(itemId || "");
    if (kind === "land") {
      if (id === "piano" && !seenOnce.piano) { seenOnce.piano = true; track("piano_first_key", {}); }
      else if (id === "ai" && !seenOnce.ai) { seenOnce.ai = true; track("ai_answer", {}); }
      else if (id.startsWith("page:")) track("page_view_landing", { lang: id.slice(5, 9), variant: landingVariant() });
      else if (id === "try:google") track("sign_up_attempt", { method: "google" });
      else if (id === "try:line") track("sign_up_attempt", { method: "line" });
      else if (id === "try:email-otp" || id === "signup:email-otp") track("sign_up_attempt", { method: "email_otp" });
      else if (id === "try:email" || id === "signup:email") track("sign_up_attempt", { method: "email_password" });
    } else if (kind === "gate" && id) {
      if (id === "value:cta" || id === "value:close") return;   // the card's own taps are usage rows only
      track("trial_invite_shown", { method: id === "value:shown" ? "value" : id.slice(0, 20) });
    }
  } catch (e) {}
}

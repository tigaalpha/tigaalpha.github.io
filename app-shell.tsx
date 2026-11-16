import { isChunkLoadError, reloadForNewBuild } from "./chunk-reload";
import { useState, useEffect, Component } from "react";
import { sb } from "./supabase-client";
import { saveGuestProfile, setSkipOnboard, logUsage } from "./shared-infra";
import { handoffUrl } from "./local-identity";
import { by, ALL_LANGS, LANG_META, isRtl, isExtraLang, xl, hasCatalog, loadCatalog } from "./lang-extra";
import { useCatalog } from "./use-catalog";
/* ── app-shell.tsx ──
   Small presentational components clustered around the App() root: the
   membership-gate screens (Splash/BannedScreen/GuestGateScreen/ProfileForm,
   shown before PianoApp itself ever mounts), ErrorBoundary (main.tsx's
   crash safety net), and CountUp, a tiny animated-number helper reused by
   result screens. Extracted from App.tsx verbatim as part of the App.tsx
   modularization — App() itself and PianoApp stay in App.tsx, since
   they're the file's own root/entry point. ── */

/* ── the language of the early screens (2026-11-16) ──
   Everything below mounts before PianoApp has a `lang` (the gate screens), beside it (the sign-up card, the corner Login modal) or after it has died (the two crash fallbacks).
   Thai, English and Chinese read exactly what they always read: Thai-only text, or the owner's bilingual "Thai · English" pair. The seven extra languages (ja ko ru hi es fr ar) read ONLY their
   own language: the English half goes through the catalog (xl) and the Thai half is never shown, so a Japanese learner no longer reads Thai + English.
   Where the language comes from: profile.lang when the learner has chosen one (any of the ten); else the language this device used last (tg_lang_hint: PianoApp writes it on every change and main.tsx
   loads that catalog before the first paint); else nothing, which means the Thai / English text. LoginWall keeps its own rule (the browser's language as the last resort), it only ever needs the three. */
function deviceLang(): string {
  try { const h = localStorage.getItem("tg_lang_hint"); if (h && ALL_LANGS.includes(h)) return h; } catch (e) {}
  try { const l = (document.documentElement.getAttribute("lang") || "").slice(0, 2).toLowerCase(); if (ALL_LANGS.includes(l)) return l; } catch (e) {}
  return "";
}
function screenLang(profile?: any): string {
  const p = profile && profile.lang;
  return ALL_LANGS.includes(p) ? p : deviceLang();
}
/* "Thai · English" for th / en / zh (sep "\n" for the two-line ones), the translated English alone for the extra languages. `en` is the xl(lg, "...") the caller writes, so the extractor sees the
   English literal; for th / en / zh xl hands it back untouched, which is what keeps their text byte for byte what it was. solo() is the same for a text that has no English half (or whose English
   half is a different sentence from the one the extra languages translate). */
const pair = (lg: string, th: string, en: string, sep = " · ") => (isExtraLang(lg) ? en : th + sep + en);
const solo = (lg: string, th: string, en: string) => (isExtraLang(lg) ? en : th);

/* ════ ERROR BOUNDARY (crash safety net) ════ */

// Must be a class component - componentDidCatch/getDerivedStateFromError
// have no hook equivalent, by design (a hook can't interrupt React's own
// render phase the way a boundary does). Wraps <App/> in main.tsx so a
// render-phase throw anywhere in the tree shows this recovery screen
// instead of a fully blank one - confirmed by the stability audit that no
// boundary existed anywhere before this, so any uncaught render bug
// (including ones not yet found) white-screened the entire app with no
// way back except a reload the user has to think to try themselves.
// Deliberately app-wide rather than wrapped around individual overlays
// (Voice Tutor/Camera Coach/chat) - this is the safety net every one of
// those already sits inside; per-feature boundaries would only narrow the
// blast radius of a future crash, not add any protection that's missing
// today, so they're left as a possible follow-up rather than done here.

/* SafeZone — the per-feature boundary mentioned above, added 2026-09-21
   after the owner hit a full-app crash ON the practice result screen: one
   glitchy data field (e.g. a malformed saved record from localStorage) took
   the WHOLE app down to the "Something went wrong" screen, losing the drill
   and the session. A SafeZone renders the SAME children but contains any
   throw to a small in-place fallback (with a dismiss), so a broken panel
   costs its panel — not the app. Used around the practice result, the
   camera overlay and the song overlay (the three data-driven surfaces).
   The app-wide boundary stays as the last line of defense. */
export class SafeZone extends Component {
  constructor(props) { super(props); this.state = { failed: false, err: "" }; }
  static getDerivedStateFromError(error) { return { failed: true, err: String((error && error.message) || error).slice(0, 160) }; }
  componentDidCatch(error, info) { if (isChunkLoadError(error)) reloadForNewBuild(); console.error("SafeZone caught:", error, info && info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    const lg = deviceLang(), ext = isExtraLang(lg);
    /* the call sites hand in Thai text; an extra language never reads Thai, so a prop with Thai in it gives way to the translated default */
    const own = (s) => (ext && s && /[\u0E00-\u0E7F]/.test(s) ? "" : s);
    return (
      <div className="presultai" style={{ borderColor: "#e55" }}>
        <div className="presultai-h">⚠️ {own(this.props.label) || solo(lg, "ส่วนนี้แสดงผลไม่สำเร็จ", xl(lg, "This part could not be shown"))}</div>
        <div className="presultai-tx" style={{ fontSize: 12, opacity: 0.8 }}>
          {own(this.props.fallbackText) || solo(lg, "ข้อมูลส่วนนี้มีปัญหา แต่แอปยังใช้งานได้ตามปกติ — กดปิดเพื่อซ่อนกล่องนี้", xl(lg, "This part has a problem, but the app still works normally — tap close to hide this box"))}
        </div>
        {this.state.err ? <div style={{ fontSize: 10, opacity: 0.6, marginTop: 6, wordBreak: "break-all" }}>{this.state.err}</div> : null}
        <button className="cbtn" style={{ marginTop: 8 }} onClick={() => this.setState({ failed: false })}>{solo(lg, "✕ ปิด", "✕ " + xl(lg, "Close"))}</button>
      </div>
    );
  }
}
export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, errText: "", errStack: "", copied: false }; }
  static getDerivedStateFromError(error) { return { hasError: true, errText: String((error && error.message) || error), errStack: String((error && error.stack) || "") }; }
  componentDidCatch(error, info) {
    if (isChunkLoadError(error)) reloadForNewBuild(); console.error("Uncaught render error:", error, info);
    // an extra language's catalog is a lazy chunk (main.tsx waits for it for 2.5 s at most): if it is still on its way, this screen is drawn again when it lands
    try { const l = deviceLang(); if (isExtraLang(l) && !hasCatalog(l)) loadCatalog(l).then(() => { try { this.forceUpdate(); } catch (e) {} }); } catch (e) {}
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    // Recovery must beat the two real ways this screen appears:
    // 1) A deploy raced the page load: cached HTML pointed at a hashed bundle
    //    the new deploy deleted -> import failed -> crash. A plain reload can
    //    get the SAME stale HTML back (browser HTTP cache), so before giving
    //    up we re-fetch index.html with cache:"no-store" once and hard-
    //    navigate if its bundle hash differs from ours.
    // 2) A genuine render bug: reloading lands on the same crash, so after
    //    one automatic attempt we stop (two crashless loads in a row means
    //    the bug is gone; a third bounce would be a reload loop).
    const K = "tiga_crash_recover";
    let attempts = 0;
    try { attempts = Number(sessionStorage.getItem(K) || "0"); } catch (e) {}
    const go = (url) => { try { sessionStorage.setItem(K, String(attempts + 1)); } catch (e) {} window.location.replace(url); };
    const reload = () => {
      if (attempts >= 1) { try { sessionStorage.removeItem(K); } catch (e) {} return; }
      try {
        fetch(window.location.href, { cache: "no-store" })
          .then(r => r.text())
          .then(html => {
            const m = html && html.match(/bundle\/index\.template-[A-Za-z0-9_-]+\.js/);
            const mine = (document.querySelector('script[src*="bundle/index.template"]') || {}).src || "";
            if (m && mine && mine.indexOf(m[0]) === -1) go(window.location.href); // fresher build exists -> hard navigate
            else go(window.location.href);                                        // same build -> one honest retry
          })
          .catch(() => go(window.location.href));
      } catch (e) { go(window.location.href); }
    };
    // Show the actual error (collapsed by default) so a crash report is one
    // screenshot away instead of a dead end — every session of debugging this
    // app has started with "เกิดข้อผิดพลาด" and zero information about where.
    const report = (this.state.errStack || this.state.errText || "unknown").slice(0, 1200);
    const lg = deviceLang(), ext = isExtraLang(lg);   // the crash screen cannot use a hook: the language is read straight from the device
    return (
      <div className="tg" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="scan" />
        <div className="banscreen">
          <div style={{ fontSize: 52 }}>🎹</div>
          <div className="locktitle">{pair(lg, "เกิดข้อผิดพลาด", xl(lg, "Something went wrong"))}</div>
          <div className="locksub">{ext ? xl(lg, "Sorry about that — please reload the page to continue.") : <>ขออภัยในความไม่สะดวก กรุณาโหลดหน้าใหม่อีกครั้ง<br />Sorry about that — please reload the page to continue.</>}</div>
          <button className="lockbtn" onClick={reload}>{pair(lg, "โหลดใหม่", xl(lg, "Reload"))}</button>
          <details style={{ marginTop: 14, maxWidth: 420, width: "92%", textAlign: "left" }}>
            <summary style={{ cursor: "pointer", opacity: 0.75, fontSize: 13, fontFamily: "var(--f-num, monospace)" }}>
              {solo(lg, "รายละเอียด error (แตะเพื่อคัดลอก) · Show error", xl(lg, "Show error (tap to copy)"))}
            </summary>
            <pre onClick={() => { try { navigator.clipboard.writeText(report); this.setState({ copied: true }); } catch (e) {} }}
              style={{ marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(0,0,0,0.45)", color: "#fca5a5", fontSize: 11, lineHeight: 1.5, maxHeight: 220, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word", cursor: "pointer", fontFamily: "var(--f-num, monospace)" }}>
              {report}{this.state.copied ? (ext ? "\n\n✓ " + xl(lg, "Copied!") : "\n\n✓ copied") : ""}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}

/* ════ MEMBERSHIP GATE (required login) ════ */

export function Splash() {
  return (
    <div className="tg" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="scan" />
      <div className="lockicon" style={{ fontSize: 44 }}>🎹</div>
    </div>
  );
}

export function BannedScreen({ onSignOut, profile }) {   // profile is optional: when the caller hands it in, its lang decides; otherwise the device's last language
  const lg = screenLang(profile), ext = isExtraLang(lg);
  useCatalog(lg);
  return (
    <div className="tg" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="scan" />
      <div className="banscreen">
        <div style={{ fontSize: 52 }}>🚫</div>
        <div className="locktitle">{pair(lg, "บัญชีถูกระงับ", xl(lg, "Account suspended"))}</div>
        <div className="locksub">{ext ? xl(lg, "This account has been suspended. Please contact the studio if you think this is a mistake.") : <>บัญชีนี้ถูกระงับการใช้งาน หากคิดว่าผิดพลาด กรุณาติดต่อผู้ดูแล<br />This account has been suspended. Please contact the studio if you think this is a mistake.</>}</div>
        <button className="lockbtn" onClick={onSignOut}>{pair(lg, "ออกจากระบบ", xl(lg, "Sign out"))}</button>
      </div>
    </div>
  );
}

// Maps a Supabase Auth error to a friendly bilingual message. Used both when
// signUp/signInWithPassword/resetPasswordForEmail resolve with {error} (the
// normal auth-level-failure shape) AND from a catch block (a genuine network
// drop rejects instead of resolving) — GoTrue's client doesn't consistently
// pick one or the other for a raw fetch failure, so both paths need the same
// mapping or a plain "Failed to fetch" can leak straight to the screen.
export function friendlyAuthError(msg, lang = "") {
  const m = msg || "";
  if (isExtraLang(lang)) {
    // ja ko ru hi es fr ar: their own language only (the Thai · English pairs below stay for Thai, English and Chinese). A message the server wrote that we do not know is shown as it came, as it is for the three.
    if (/already registered|already exists/i.test(m)) return xl(lang, "This email is already registered — try logging in instead");
    if (/invalid login credentials/i.test(m)) return xl(lang, "Incorrect email or password");
    if (/email not confirmed/i.test(m)) return xl(lang, "Please confirm your email first — check your inbox");
    if (/rate limit|only request this after|too many requests/i.test(m)) return xl(lang, "Too many tries — please wait a moment and try again");
    if (/unable to validate email|email address.*invalid|invalid format/i.test(m)) return xl(lang, "That email address doesn't look right — please check it");
    if (/fetch|network|internet|offline/i.test(m)) return xl(lang, "Couldn't connect — please try again");
    return m || xl(lang, "Something went wrong — please try again");
  }
  if (/already registered|already exists/i.test(m)) return "อีเมลนี้สมัครไว้แล้ว — ลองเข้าสู่ระบบแทน · This email is already registered — try logging in instead";
  if (/invalid login credentials/i.test(m)) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง · Incorrect email or password";
  if (/fetch|network|internet|offline/i.test(m)) return "เชื่อมต่อไม่ได้ ลองอีกครั้ง · Couldn't connect — please try again";
  return m || "เกิดข้อผิดพลาด ลองอีกครั้ง · Something went wrong — please try again";
}

// Google + email/password, side by side — a real account no longer requires
// a Google account specifically, since a student who's a child may not have
// one yet. Shared by GuestGateScreen (embedded inline, no dismiss) and
// LoginModal below (the corner pill's dismissable version). Bilingual
// Thai · English for Thai, English and Chinese, matching every other string on
// these screens; the seven extra languages read their own language only (see
// screenLang / pair / solo at the top of this file — `lang` is PianoApp-local
// state, so each root here reads profile.lang or the device's last language).
/* ════ IN-APP BROWSER DETECTION ════
   2026-09-11, found by reading auth logs against a live ad campaign: real
   visitors WERE tapping "Continue with Google" — Supabase logged
   `/authorize → Redirecting to external provider, provider=google` with
   referer https://tigaalpha.github.io/ — and not one of them ever came back.
   Zero accounts were created in the seven days the ads ran, against 393
   paid visits.

   The reason is not our code: Google refuses to serve its consent screen
   inside an embedded WebView and answers `disallowed_useragent`. Facebook,
   Instagram, YouTube, TikTok and LINE all open links in exactly such a
   WebView, so every visitor arriving from a social ad on a phone hit a dead
   end that looked like our login was broken. native-auth.ts already documents
   this for the Capacitor build (it side-steps it by opening the system
   browser); the WEBSITE had no handling at all.

   So: detect the WebView, and in it stop leading with the button that cannot
   work. Email sign-up works perfectly in a WebView and becomes the primary
   path, with a one-tap escape to a real browser for anyone who prefers
   Google. */
function isNativeShell() {
  try { return !!(window as any).Capacitor && (window as any).Capacitor.isNativePlatform && (window as any).Capacitor.isNativePlatform(); }
  catch (e) { return false; }
}
export function inAppBrowser() {
  if (typeof navigator === "undefined") return false;
  // our own native build has a WORKING OAuth path (native-auth.ts) — it must
  // not be told to go and find a different browser
  if (isNativeShell()) return false;
  const ua = navigator.userAgent || "";
  if (/FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Line\/|LIFF|TikTok|musical_ly|BytedanceWebview|MicroMessenger|KAKAOTALK|Snapchat|Pinterest|Twitter/i.test(ua)) return true;
  // Android WebViews (YouTube's link handler among them) carry the "; wv)" token
  if (/Android/i.test(ua) && /;\s*wv\)/i.test(ua)) return true;
  // iOS WKWebView inside another app: Safari-like UA with no "Safari/" token
  if (/iPhone|iPad|iPod/i.test(ua) && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua)) return true;
  return false;
}

/* Best-effort jump out of the in-app WebView into the phone's real browser.
   Android takes an intent: URL that names Chrome directly. iOS has no such
   thing — googlechrome:// only works if Chrome is installed and silently does
   nothing otherwise — so the caller always keeps the copy-link fallback
   visible rather than relying on this having worked. */
export function openInRealBrowser() {
  // handoffUrl() adds the anon id / original source / browser kind, so the real
  // browser on the other side continues the same visitor (local-identity.ts).
  const url = handoffUrl(window.location.href);
  const ua = navigator.userAgent || "";
  try {
    if (/Android/i.test(ua)) {
      window.location.href = "intent://" + url.replace(/^https?:\/\//, "") +
        "#Intent;scheme=https;package=com.android.chrome;end";
      return true;
    }
    if (/iPhone|iPad|iPod/i.test(ua)) {
      window.location.href = url.replace(/^https?:\/\//, "googlechrome://");
      return true;
    }
    window.open(url, "_blank", "noopener");
    return true;
  } catch (e) { return false; }
}

/* The privacy notice this sign-up form asks people to agree to. Bump it
   whenever privacy-policy.html changes in a way that alters what is collected
   or why: consent is given to a specific notice, and a policy that changes
   underneath a stored "true" is not consent to the new one. The stored version
   is what makes it possible to tell who agreed to what. */
export const PDPA_VERSION = "2026-09-11";
const PRIVACY_URL = "privacy-policy.html";

/* A sentence with the privacy-policy link inside it, for the extra languages. The English key carries the link as [[Privacy Policy]] and the translator keeps the [[ ]] around the words that become the
   link, wherever they fall in the sentence (word order differs between languages, so the sentence is ONE string, not "I accept" + link + "and consent"). A translation that lost its markers still shows the link. */
function PolicyLine({ lg, text }) {
  const m = /^([\s\S]*?)\[\[([\s\S]*?)\]\]([\s\S]*)$/.exec(text);
  const link = (label) => <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">{label}</a>;
  return m ? <>{m[1]}{link(m[2])}{m[3]}</> : <>{text} {link(xl(lg, "Privacy Notice"))}</>;
}

function GoogleMark() {
  return (
    <svg className="au-gico" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.5C3 17.1 2.1 20.4 2.1 24s.9 6.9 2.4 9.9l7.3-5.7z" />
      <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.2 29.9 2 24 2 15.4 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z" />
    </svg>
  );
}

/* One panel, two equally visible ways in. The previous version made Google the
   only real button and hid e-mail behind a link reading "log in with existing
   account" — so someone with no Google account, or in a WebView where Google
   refuses to work at all, saw no way to create one. */
function LoginOptions({ profile, onGoogleLogin, lg }) {   // lg: the language of the caller (LoginModal / GuestGateScreen read it once and use the catalog hook)
  const ext = isExtraLang(lg);
  const [inApp] = useState(() => inAppBrowser());
  const [mode, setMode] = useState("signup"); // signup | login
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);      // required purpose — never pre-ticked
  const [marketing, setMarketing] = useState(false); // separate optional purpose
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const signup = mode === "signup";

  async function submit() {
    if (busy) return;
    setErr(""); setMsg("");
    // (a "solo" line below borrows the sentence LoginWall already has in the catalog: same meaning, no new string to translate)
    if (signup && !name.trim()) { setErr(solo(lg, "กรุณากรอกชื่อที่อยากให้ครูเรียก · Please enter a name", xl(lg, "Please enter your name"))); return; }
    if (!email.trim() || !password) { setErr(pair(lg, "กรุณากรอกอีเมลและรหัสผ่าน", xl(lg, "Please enter your email and password"))); return; }
    if (password.length < 6) { setErr(pair(lg, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร", xl(lg, "Password must be at least 6 characters"))); return; }
    if (signup && password !== confirm) { setErr(pair(lg, "รหัสผ่านไม่ตรงกัน", xl(lg, "Passwords don't match"))); return; }
    // PDPA: processing may not begin without a freely given, specific,
    // informed consent — so this is a hard stop, not a nudge.
    if (signup && !agree) { setErr(solo(lg, "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนสมัคร · Please accept the privacy notice to continue", xl(lg, "Please accept the Privacy Notice"))); return; }
    setBusy(true);
    try {
      saveGuestProfile(profile); // progress made as a guest follows them in
      const { data, error } = signup
        ? await sb.auth.signUp({
            email: email.trim(),
            password,
            // Carried as auth metadata so handle_new_user() can land the
            // consent record even when e-mail confirmation means there is no
            // session yet to write with.
            options: { data: {
              full_name: name.trim(),
              pdpa_version: PDPA_VERSION,
              marketing_consent: !!marketing,
            } },
          })
        : await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) { setErr(friendlyAuthError(error.message, lg)); return; }
      if (signup && data && data.user && !data.session) {
        setMsg(solo(lg, "สมัครสำเร็จ! ตรวจสอบอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ · Account created — check your email to confirm it, then log in.", xl(lg, "Account created! Check your email to confirm, then log in")));
      }
      // A live session completes through App()'s own onAuthStateChange.
    } catch (e) {
      setErr(friendlyAuthError(e && e.message, lg));
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (!email.trim()) { setErr(solo(lg, "กรอกอีเมลก่อนเพื่อรีเซ็ตรหัสผ่าน · Enter your email above first", xl(lg, "Enter your email first, then tap Forgot password"))); return; }
    setBusy(true); setErr(""); setMsg("");
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname });
      if (error) setErr(friendlyAuthError(error.message, lg));
      else setMsg(solo(lg, "ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว · Reset link sent — check your inbox", xl(lg, "We sent a password reset link to your email")));
    } catch (e) { setErr(friendlyAuthError(e && e.message, lg)); }
    finally { setBusy(false); }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      setErr(pair(lg, "คัดลอกไม่สำเร็จ กดค้างที่แถบที่อยู่เพื่อคัดลอก", xl(lg, "Copy failed — long-press the address bar instead")));
    }
  }

  return (
    <div className="au">
      <div className="au-head">
        <div className="au-title">{signup ? solo(lg, "สมัครสมาชิกฟรี", xl(lg, "Sign up free")) : solo(lg, "ยินดีต้อนรับกลับมา", xl(lg, "Welcome back"))}</div>
        <div className="au-sub">
          {!signup
            ? pair(lg, "เข้าสู่ระบบเพื่อเล่นต่อจากที่ค้างไว้", xl(lg, "Log in to pick up where you left off"), "\n")
            : inApp
            // promising Google here would be a lie: it cannot work in a WebView
            ? pair(lg, "สมัครด้วยอีเมลได้เลย ไม่ต้องมีบัญชี Google", xl(lg, "Sign up with an email — no Google account needed"), "\n")
            : pair(lg, "เลือกได้เลย — สมัครด้วยอีเมล หรือใช้บัญชี Google", xl(lg, "Sign up with an email, or use Google"), "\n")}
        </div>
      </div>

      <div className="au-seg" role="tablist">
        <button className={`au-segb${signup ? " on" : ""}`} role="tab" aria-selected={signup}
          onClick={() => { setMode("signup"); setErr(""); setMsg(""); }}>{solo(lg, "สมัครสมาชิกใหม่", xl(lg, "Sign up"))}</button>
        <button className={`au-segb${!signup ? " on" : ""}`} role="tab" aria-selected={!signup}
          onClick={() => { setMode("login"); setErr(""); setMsg(""); }}>{solo(lg, "เข้าสู่ระบบ", xl(lg, "Log in"))}</button>
      </div>

      {inApp ? (
        <>
          <div className="au-warn">
            {ext ? (
              <>
                <b>{"⚠️ " + xl(lg, "Google doesn't work in this app's browser")}</b>
                {xl(lg, "Did you open this from Facebook, YouTube or TikTok? Google doesn't allow sign-in inside those apps. You can sign up with the email form below as usual, or open it in a real browser.")}
              </>
            ) : (
              <>
                <b>⚠️ Google ใช้ไม่ได้ในเบราว์เซอร์ของแอปนี้</b>
                เปิดจาก Facebook / YouTube / TikTok ใช่ไหมคะ — Google ไม่ยอมให้ล็อกอินในนี้
                {" "}สมัครด้วยอีเมลด้านล่างได้ตามปกติ หรือกดเปิดในเบราว์เซอร์จริง
              </>
            )}
          </div>
          <div className="au-esc">
            <button className="au-escb" onClick={() => openInRealBrowser()}>{solo(lg, "🌐 เปิดในเบราว์เซอร์", "🌐 " + xl(lg, "Open in browser"))}</button>
            <button className="au-escb" onClick={copyLink}>{copied ? solo(lg, "✓ คัดลอกแล้ว", "✓ " + xl(lg, "Copied!")) : solo(lg, "🔗 คัดลอกลิงก์", "🔗 " + xl(lg, "Copy link"))}</button>
          </div>
        </>
      ) : (
        <>
          <button className="au-g" onClick={onGoogleLogin}>
            <GoogleMark /> {signup ? solo(lg, "สมัครด้วย Google", xl(lg, "Sign up with Google")) : solo(lg, "เข้าสู่ระบบด้วย Google", xl(lg, "Log in with Google"))}
          </button>
          <div className="au-or">{pair(lg, "หรือ", xl(lg, "or"))}</div>
        </>
      )}

      <div className="au-f">
        {signup && (
          <input className="au-in" type="text" autoComplete="name" placeholder={pair(lg, "ชื่อที่อยากให้ครูเรียก", xl(lg, "Your name"))}
            value={name} onChange={e => setName(e.target.value)} />
        )}
        <input className="au-in" type="email" inputMode="email" autoComplete="email" placeholder={pair(lg, "อีเมล", xl(lg, "Email"))}
          value={email} onChange={e => setEmail(e.target.value)} />
        <input className="au-in" type="password" autoComplete={signup ? "new-password" : "current-password"}
          placeholder={solo(lg, "รหัสผ่าน (อย่างน้อย 6 ตัว) · Password", xl(lg, "Password (at least 6 characters)"))} value={password} onChange={e => setPassword(e.target.value)} />
        {signup && (
          <input className="au-in" type="password" autoComplete="new-password" placeholder={pair(lg, "ยืนยันรหัสผ่าน", xl(lg, "Confirm password"))}
            value={confirm} onChange={e => setConfirm(e.target.value)} />
        )}
      </div>

      {signup && (
        <div className="au-pdpa">
          <div className="au-pdpa-h">{pair(lg, "ความเป็นส่วนตัว", xl(lg, "Privacy"))}</div>
          <div className="au-pdpa-p">
            {ext ? xl(lg, "We keep your name, email and learning progress only to open your account and save your learning. We never sell your data, and you can ask to delete your account at any time.") : <>
            เราเก็บชื่อ อีเมล และความคืบหน้าการเรียนของคุณ เพื่อใช้เปิดบัญชีและบันทึกการเรียนเท่านั้น
            ไม่ขายข้อมูลให้ใคร และคุณขอลบบัญชีได้ทุกเมื่อ
            </>}
          </div>
          <label className="au-ck">
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <span>
              {ext ? (
                <>
                  <span className="au-req">*</span>{" "}
                  <PolicyLine lg={lg} text={xl(lg, "I accept the [[Privacy Policy]] and consent to the collection of the data above to provide the service")} />
                </>
              ) : (
                <>
              <span className="au-req">*</span> ฉันยอมรับ
              {" "}<a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">นโยบายความเป็นส่วนตัว</a>
              {" "}และยินยอมให้เก็บข้อมูลข้างต้นเพื่อให้บริการ
                </>
              )}
            </span>
          </label>
          <label className="au-ck">
            <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} />
            <span>
              {solo(lg, "(ไม่บังคับ) ส่งข่าวคอร์สใหม่และโปรโมชันให้ฉันทางอีเมล — ไม่เลือกก็สมัครได้ตามปกติ", xl(lg, "(Optional) Email me news about new courses and promotions — you can sign up without ticking this"))}
            </span>
          </label>
        </div>
      )}

      {err && <div className="au-err">{err}</div>}
      {msg && <div className="au-ok">{msg}</div>}

      <button className="au-cta" disabled={busy} onClick={submit}>
        {busy ? solo(lg, "กำลังดำเนินการ...", xl(lg, "Processing…")) : signup ? solo(lg, "สมัครสมาชิกฟรี", xl(lg, "Sign up free")) : solo(lg, "เข้าสู่ระบบ", xl(lg, "Log in"))}
      </button>

      {!signup && <button className="au-link" onClick={forgotPassword}>{pair(lg, "ลืมรหัสผ่าน?", xl(lg, "Forgot password?"))}</button>}

      {inApp && (
        <button className="au-link" style={{ opacity: .6, fontSize: 12 }} onClick={onGoogleLogin}>
          {pair(lg, "ลองใช้ Google ต่อไป (อาจไม่ทำงานในนี้)", xl(lg, "Try Google anyway"))}
        </button>
      )}

      <div className="au-fine">
        {ext ? (
          <>
            {xl(lg, "No credit card needed")}<br />
            <PolicyLine lg={lg} text={xl(lg, `By signing up you accept the [[Privacy Policy]] (version ${PDPA_VERSION})`)} />
          </>
        ) : (
          <>
        ฟรี ไม่ต้องใช้บัตรเครดิต · No credit card needed<br />
        การสมัครถือว่ายอมรับ <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">นโยบายความเป็นส่วนตัว</a> (ฉบับ {PDPA_VERSION})
          </>
        )}
      </div>
    </div>
  );
}

// The corner Login pill's version — same LoginOptions, wrapped as a
// dismissable modal since (unlike GuestGateScreen) this entry point is
// always optional, never a forced stop.
export function LoginModal({ profile, onGoogleLogin, onClose }) {
  const lg = screenLang(profile);
  useCatalog(lg);   // PianoApp already holds the catalog of profile.lang; this keeps the modal right if it is ever mounted on its own
  return (
    <div className="setov" onClick={onClose}>
      <div className="setcard" style={{ maxWidth: 340 }} onClick={e => e.stopPropagation()}>
        <div className="sethdr"><span>{solo(lg, "🔐 เข้าสู่ระบบ · Login", "🔐 " + xl(lg, "Login"))}</span><button className="cbtn" onClick={onClose}>{pair(lg, "ปิด", xl(lg, "Close"))}</button></div>
        <div className="setbody" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "14px 6px" }}>
          <LoginOptions profile={profile} onGoogleLogin={onGoogleLogin} lg={lg} />
        </div>
      </div>
    </div>
  );
}

// The forced side of guest mode (the corner Login pill is the optional
// side) — shown when the free trial runs out or a guest taps an AI-backed
// feature that structurally cannot work without a real session. No dismiss
// button by design (matches "ต้องล็อกอิน" — login is genuinely required to
// continue past this point), but it always appears at a natural stopping
// point (next navigation / on tap), never yanked up mid-exercise.
/* ── one field: e-mail me a link ──
   The guest gate used to offer only the long forms below (name, password, a
   consent tick, LINE, Facebook, Instagram, TikTok, YouTube) and Google — which
   is refused inside Facebook/Instagram. The landing page's one-field e-mail
   link is what real people actually completed there (6 of the 51 accounts since
   7 Sep came that way, every one of the 4 who tried it finished), so the gate,
   which is where a guest who just played a song is asked to join, gets the same
   door at the top. The link is opened later and usually in another browser, so
   it carries the visit across (local-identity.handoffUrl) like the landing's. */
function MagicLinkForm({ profile, lg }) {
  const ext = isExtraLang(lg);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  async function send(e) {
    e.preventDefault();
    if (busy) return;
    if (!email.trim()) { setErr(pair(lg, "กรุณากรอกอีเมล", xl(lg, "Please enter your email"))); return; }
    setBusy(true); setErr("");
    try {
      saveGuestProfile(profile);
      setSkipOnboard();
      const { error } = await sb.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: handoffUrl(window.location.origin + "/", { via: "mail" }),
          data: { pdpa_version: PDPA_VERSION, marketing_consent: false, via: "app-gate-otp" },
        },
      });
      if (error) { setErr(friendlyAuthError(error.message, lg)); return; }
      logUsage("gate", "otp:sent");
      setDone(true);
    } catch (e2) {
      setErr(friendlyAuthError(e2 && e2.message, lg));
    } finally {
      setBusy(false);
    }
  }
  if (done) {
    return (
      <div className="au-warn" role="status" style={{ width: "100%", textAlign: "left" }}>
        <b>{solo(lg, "✉️ ส่งลิงก์แล้ว · Link sent", "✉️ " + xl(lg, "Link sent"))}</b>
        {pair(lg, "เปิดอีเมลแล้วกดลิงก์เพื่อเข้าเล่นต่อ ไม่ต้องมีรหัสผ่าน", xl(lg, "Open your email and tap the link — no password needed."))}
      </div>
    );
  }
  return (
    <form onSubmit={send} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
      <input type="email" inputMode="email" autoComplete="email" enterKeyHint="go" placeholder="your@email.com"
        value={email} onChange={e => setEmail(e.target.value)} aria-label={xl(lg, "Email")}
        style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "inherit", fontSize: 15, outline: "none", boxSizing: "border-box" }} />
      <button type="submit" disabled={busy}
        style={{ width: "100%", padding: "12px 22px", borderRadius: 13, border: "2px solid #d97757", background: busy ? "rgba(217,119,87,0.5)" : "linear-gradient(135deg, #d97757, #c25e3f)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: busy ? "default" : "pointer" }}>
        {busy ? "..." : solo(lg, "✉️ ส่งลิงก์เข้าสู่ระบบฟรี · Email me a free link", "✉️ " + xl(lg, "Email me a free link"))}
      </button>
      {err && <div style={{ fontSize: 12.5, color: "#ff8a80", lineHeight: 1.4 }}>{err}</div>}
      <div style={{ fontSize: 11, opacity: 0.55, lineHeight: 1.5, textAlign: "center" }}>
        {ext ? <PolicyLine lg={lg} text={xl(lg, "Just one field, no password to set · By signing up you acknowledge the [[Privacy Policy]]")} /> : <>
        ช่องเดียว ไม่ต้องตั้งรหัสผ่าน · การสมัครถือว่ารับทราบ <a href="privacy-policy.html" target="_blank" rel="noopener noreferrer">นโยบายความเป็นส่วนตัว</a>
        </>}
      </div>
    </form>
  );
}


/* The standard sign-in screen for the members-only domain: one card, Google first, then e-mail + password with a Log in / Sign up switch,
   forgot password and the privacy tick on sign-up only. Same Supabase calls and PDPA fields as LoginOptions, with the app's own colours. */
const WALL_T: Record<string, Record<string, string>> = {
  th: { welcome: "ยินดีต้อนรับสู่ TIGA ALPHA", sub: "เรียนเปียโนด้วย AI — เข้าสู่ระบบเพื่อเริ่มเรียน", login: "เข้าสู่ระบบ", signup: "สมัครสมาชิก", google: "ดำเนินการต่อด้วย Google", or: "หรือ", name: "ชื่อ", email: "อีเมล", pass: "รหัสผ่าน", forgot: "ลืมรหัสผ่าน?", noacc: "ยังไม่มีบัญชี?", haveacc: "มีบัญชีอยู่แล้ว?", agree: "ฉันยอมรับ", policy: "นโยบายความเป็นส่วนตัว", free: "สมัครฟรี ใช้งานได้ทันที", inapp: "Google ใช้ไม่ได้ในเบราว์เซอร์ของแอปนี้ — เปิดในเบราว์เซอร์จริงหรือใช้อีเมลด้านล่าง", openb: "เปิดในเบราว์เซอร์", reset: "ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว", created: "สมัครสำเร็จ! ตรวจอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ", needName: "กรุณากรอกชื่อ", needMail: "กรุณากรอกอีเมลและรหัสผ่าน", short: "รหัสผ่านอย่างน้อย 6 ตัวอักษร", needAgree: "กรุณายอมรับนโยบายความเป็นส่วนตัว", needEmailReset: "กรอกอีเมลก่อน แล้วกด ลืมรหัสผ่าน" },
  en: { welcome: "Welcome to TIGA ALPHA", sub: "Learn piano with AI — log in to start", login: "Log in", signup: "Sign up", google: "Continue with Google", or: "or", name: "Name", email: "Email", pass: "Password", forgot: "Forgot password?", noacc: "No account yet?", haveacc: "Already have an account?", agree: "I accept the", policy: "Privacy Notice", free: "Free to join, start right away", inapp: "Google doesn't work inside this app's browser — open your real browser, or use email below", openb: "Open in browser", reset: "We sent a password reset link to your email", created: "Account created! Check your email to confirm, then log in", needName: "Please enter your name", needMail: "Please enter your email and password", short: "Password must be at least 6 characters", needAgree: "Please accept the Privacy Notice", needEmailReset: "Enter your email first, then tap Forgot password" },
  zh: { welcome: "欢迎来到 TIGA ALPHA", sub: "用 AI 学钢琴 — 登录后开始学习", login: "登录", signup: "注册", google: "使用 Google 继续", or: "或", name: "姓名", email: "邮箱", pass: "密码", forgot: "忘记密码？", noacc: "还没有账号？", haveacc: "已有账号？", agree: "我接受", policy: "隐私政策", free: "免费注册，立即开始", inapp: "此应用内的浏览器无法使用 Google — 请在浏览器中打开，或使用下方邮箱", openb: "在浏览器中打开", reset: "重置密码链接已发送到你的邮箱", created: "注册成功！请查收邮件确认后再登录", needName: "请输入姓名", needMail: "请输入邮箱和密码", short: "密码至少 6 位", needAgree: "请接受隐私政策", needEmailReset: "请先输入邮箱，再点忘记密码" },
};
function LoginWall({ profile, onGoogleLogin }) {
  const [inApp] = useState(() => inAppBrowser());
  /* the language the learner already chose (any of the ten; the card used to honour th / en / zh only and showed English to someone who had picked Spanish); a visitor who chose none gets the browser's, as before */
  const lg = (() => { const p = profile && profile.lang; if (ALL_LANGS.includes(p)) return p; try { const n = (navigator.language || "").toLowerCase(); return n.startsWith("th") ? "th" : n.startsWith("zh") ? "zh" : "en"; } catch (e) { return "en"; } })();
  useCatalog(lg);   // an extra language's catalog is a lazy chunk: this loads it if main.tsx did not, and the card redraws when it arrives
  const t = by(WALL_T, lg);
  /* ?wall=signup | ?wall=login opens the card on that tab: the blog pop-up (scripts/build-blog-pages.mjs) sends "sign up free" and "log in" here */
  const [mode, setMode] = useState(() => { try { return new URLSearchParams(window.location.search).get("wall") === "signup" ? "signup" : "login"; } catch (e) { return "login"; } });
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [pass, setPass] = useState("");
  const [agree, setAgree] = useState(false), [show, setShow] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [ok, setOk] = useState("");
  const signup = mode === "signup";
  async function submit() {
    if (busy) return; setErr(""); setOk("");
    if (signup && !name.trim()) { setErr(t.needName); return; }
    if (!email.trim() || !pass) { setErr(t.needMail); return; }
    if (pass.length < 6) { setErr(t.short); return; }
    if (signup && !agree) { setErr(t.needAgree); return; }
    setBusy(true);
    try {
      saveGuestProfile(profile);
      const { data, error } = signup
        ? await sb.auth.signUp({ email: email.trim(), password: pass, options: { data: { full_name: name.trim(), pdpa_version: PDPA_VERSION, marketing_consent: false } } })
        : await sb.auth.signInWithPassword({ email: email.trim(), password: pass });
      if (error) { setErr(friendlyAuthError(error.message, lg)); return; }   // lg: an extra language reads its own language, Thai / English / Chinese keep the "Thai · English" pair
      if (signup && data && data.user && !data.session) setOk(t.created);
    } catch (e) { setErr(friendlyAuthError(e && e.message, lg)); } finally { setBusy(false); }
  }
  async function forgot() {
    if (!email.trim()) { setErr(t.needEmailReset); return; }
    setErr(""); try { const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin }); if (error) setErr(friendlyAuthError(error.message, lg)); else setOk(t.reset); } catch (e) { setErr(friendlyAuthError(e && e.message, lg)); }
  }
  const clay = "#d97757", inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "13px 14px", borderRadius: 10, border: "1.5px solid #e2d8cf", background: "#fff", color: "#2a211b", fontSize: 16, outline: "none", fontFamily: "inherit" };
  return (
    <div data-login-wall dir={isRtl(lg) ? "rtl" : undefined} style={{ position: "fixed", inset: 0, zIndex: 100000, overflowY: "auto", background: "#faf6f1", color: "#2a211b", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "28px 16px", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 400, background: "#fff", borderRadius: 18, padding: "26px 22px 22px", boxShadow: "0 10px 40px rgba(120,70,40,.14)", border: "1px solid #eee3d8" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ display: "inline-block", border: "2px solid " + clay, color: clay, borderRadius: 12, padding: "6px 16px", fontWeight: 800, fontSize: 22, letterSpacing: 1 }}>TIGA ALPHA</div>
          <h1 style={{ fontSize: 22, margin: "14px 0 4px", fontWeight: 800 }}>{t.welcome}</h1>
          <div style={{ fontSize: 14, color: "#7a6a5e" }}>{t.sub}</div>
        </div>
        <div style={{ display: "flex", background: "#f4ece4", borderRadius: 12, padding: 4, marginBottom: 16 }}>
          {["login", "signup"].map(m => (
            <button key={m} type="button" data-wall-tab={m} onClick={() => { setMode(m); setErr(""); setOk(""); }}
              style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 15, fontWeight: 700, fontFamily: "inherit", background: mode === m ? "#fff" : "transparent", color: mode === m ? clay : "#7a6a5e", boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,.12)" : "none" }}>{m === "login" ? t.login : t.signup}</button>
          ))}
        </div>
        {inApp ? (
          <div style={{ background: "#fff4e5", border: "1px solid #f3d2a3", borderRadius: 10, padding: "10px 12px", fontSize: 13, marginBottom: 12 }}>
            {t.inapp} <button type="button" onClick={() => openInRealBrowser()} style={{ marginLeft: 6, color: clay, fontWeight: 700, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: 13 }}>{t.openb}</button>
          </div>
        ) : (
          <button type="button" data-wall-google onClick={() => { saveGuestProfile(profile); onGoogleLogin(); }}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "13px 14px", borderRadius: 10, border: "1.5px solid #dadce0", background: "#fff", color: "#1f1f1f", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            <GoogleMark /> {t.google}
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0", color: "#a39486", fontSize: 13 }}><span style={{ flex: 1, height: 1, background: "#eadfd4" }} />{t.or}<span style={{ flex: 1, height: 1, background: "#eadfd4" }} /></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {signup && <input style={inp} placeholder={t.name} value={name} autoComplete="name" onChange={e => setName(e.target.value)} />}
          <input style={inp} type="email" inputMode="email" placeholder={t.email} value={email} autoComplete="email" onChange={e => setEmail(e.target.value)} />
          <div style={{ position: "relative" }}>
            <input style={{ ...inp, paddingRight: 64 }} type={show ? "text" : "password"} placeholder={t.pass} value={pass} autoComplete={signup ? "new-password" : "current-password"} onChange={e => setPass(e.target.value)} onKeyDown={e => { if (e.key === "Enter") submit(); }} />
            <button type="button" onClick={() => setShow(v => !v)} style={{ position: "absolute", right: 10, top: 0, bottom: 0, background: "none", border: "none", color: "#7a6a5e", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>{show ? "🙈" : "👁"}</button>
          </div>
          {!signup && <div style={{ textAlign: "right" }}><button type="button" onClick={forgot} style={{ background: "none", border: "none", color: clay, cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>{t.forgot}</button></div>}
          {signup && (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "#5a4c42" }}>
              <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, accentColor: clay }} />
              <span>{t.agree} <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" style={{ color: clay }}>{t.policy}</a></span>
            </label>
          )}
          {err && <div role="alert" style={{ color: "#b3261e", fontSize: 13, background: "#fdecea", borderRadius: 8, padding: "8px 10px" }}>{err}</div>}
          {ok && <div style={{ color: "#1e6b3a", fontSize: 13, background: "#e7f5ec", borderRadius: 8, padding: "8px 10px" }}>{ok}</div>}
          <button type="button" data-wall-submit disabled={busy} onClick={submit} style={{ padding: "14px 0", borderRadius: 10, border: "none", background: clay, color: "#fff", fontSize: 16, fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, fontFamily: "inherit" }}>{busy ? "…" : signup ? t.signup : t.login}</button>
        </div>
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 14, color: "#7a6a5e" }}>
          {signup ? t.haveacc : t.noacc}{" "}
          <button type="button" onClick={() => { setMode(signup ? "login" : "signup"); setErr(""); setOk(""); }} style={{ background: "none", border: "none", color: clay, fontWeight: 800, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>{signup ? t.login : t.signup}</button>
        </div>
        {signup && <div style={{ textAlign: "center", marginTop: 8, fontSize: 12, color: "#a39486" }}>{t.free}</div>}
      </div>
    </div>
  );
}

export function GuestGateScreen({ reason, profile, onLogin }) {
  const lg = screenLang(profile), ext = isExtraLang(lg);
  useCatalog(lg);   // PianoApp already holds the catalog of profile.lang; this keeps the gate right if it is ever mounted on its own
  const [gateInApp] = useState(() => inAppBrowser());
  const [showSignup, setShowSignup] = useState(false);
  // PDPA: never pre-ticked, and the optional marketing purpose is asked for
  // separately so refusing it cannot cost them the account.
  const [gateAgree, setGateAgree] = useState(false);
  const [gateMarketing, setGateMarketing] = useState(false);
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupLine, setSignupLine] = useState("");
  const [signupIg, setSignupIg] = useState("");
  const [signupFb, setSignupFb] = useState("");
  const [signupTiktok, setSignupTiktok] = useState("");
  const [signupYoutube, setSignupYoutube] = useState("");
  const [signupBusy, setSignupBusy] = useState(false);
  const [signupErr, setSignupErr] = useState("");
  const [signupDone, setSignupDone] = useState(false);

  async function handleSignupSubmit() {
    if (signupBusy) return;
    setSignupErr("");
    if (!signupName.trim()) { setSignupErr(pair(lg, "กรุณากรอกชื่อ", xl(lg, "Please enter your name"))); return; }
    if (!signupPassword || signupPassword.length < 6) { setSignupErr(pair(lg, "รหัสผ่านต้องมีอย่างน้อย 6 ตัว", xl(lg, "Password must be at least 6 characters"))); return; }
    // Without an email this branch finishes by handing off to Google, and in a
    // social app's WebView that is the one door that is shut (see
    // inAppBrowser). Ask for the email instead of walking them into it.
    if (gateInApp && !signupEmail.trim()) { setSignupErr(pair(lg, "กรุณากรอกอีเมล (ในเบราว์เซอร์ของแอปนี้ต้องใช้อีเมลสมัคร)", xl(lg, "Email is required in this app's browser"))); return; }
    if (!gateAgree) { setSignupErr(solo(lg, "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนสมัคร · Please accept the privacy notice to continue", xl(lg, "Please accept the Privacy Notice"))); return; }
    setSignupBusy(true);
    try {
      saveGuestProfile(profile);
      if (signupEmail.trim()) {
        const { data, error } = await sb.auth.signUp({
          email: signupEmail.trim(),
          password: signupPassword,
          // handle_new_user() lands these on the profile, so the consent is
          // recorded even when e-mail confirmation leaves no session to write
          // with — which is exactly when the old client-side upsert below
          // silently did nothing.
          options: { data: {
            full_name: signupName.trim(),
            pdpa_version: PDPA_VERSION,
            marketing_consent: !!gateMarketing,
          } },
        });
        if (error) { setSignupErr(friendlyAuthError(error.message, lg)); setSignupBusy(false); return; }
        if (data && data.user) {
          await sb.from("profiles").upsert({
            id: data.user.id,
            full_name: signupName.trim(),
            email: signupEmail.trim(),
            line_id: signupLine.trim() || null,
            instagram: signupIg.trim() || null,
            facebook: signupFb.trim() || null,
            tiktok: signupTiktok.trim() || null,
            youtube: signupYoutube.trim() || null,
            onboarded: true,
            updated_at: new Date().toISOString(),
          }).eq("id", data.user.id);
        }
      }
      const extraProfile = {
        full_name: signupName.trim(),
        line_id: signupLine.trim() || null,
        instagram: signupIg.trim() || null,
        facebook: signupFb.trim() || null,
        tiktok: signupTiktok.trim() || null,
        youtube: signupYoutube.trim() || null,
      };
      localStorage.setItem("tiga_signup_extra", JSON.stringify(extraProfile));
      setSignupDone(true);
      if (!signupEmail.trim()) {
        setTimeout(() => onLogin(), 1500);
      }
    } catch (e) {
      setSignupErr(ext ? friendlyAuthError(e && e.message, lg) : (e && e.message || "เกิดข้อผิดพลาด · Something went wrong"));
    } finally {
      setSignupBusy(false);
    }
  }

  const copy = {
    time: {
      icon: "⏳",
      title: solo(lg, "สมัครฟรี แล้วเล่นต่อได้อีก 30 วัน", xl(lg, "Sign up free to keep playing for 30 more days")),
      sub: pair(lg, "ล็อกอินหรือสมัครสมาชิกฟรีเพื่อเล่นต่อ — ความคืบหน้าที่ทำไว้จะถูกเก็บไว้ให้ครบ", xl(lg, "Log in or sign up free to keep playing — everything you did stays saved."), "\n"),
    },
    ai: {
      icon: "🤖",
      title: pair(lg, "AI ครูสอนต้องล็อกอินก่อน", xl(lg, "The AI teacher needs a login")),
      sub: pair(lg, "ฟีเจอร์นี้ต้องใช้บัญชีจริง ล็อกอินหรือสมัครสมาชิกฟรีได้เลย — ความคืบหน้าที่ทำไว้จะถูกเก็บไว้ให้ครบ", xl(lg, "This feature needs a real account. Log in or sign up free — everything you did stays saved."), "\n"),
    },
    wall: {   // never drawn: reason "wall" returns LoginWall (ten languages) before this is read
      icon: "🎹",
      title: "ยินดีต้อนรับสู่ TIGA · Welcome to TIGA ALPHA",
      sub: "ล็อกอินด้วย Google เพื่อเริ่มเรียน — ความคืบหน้าของคุณจะถูกเก็บไว้ทุกอุปกรณ์ · Log in with Google to start learning — your progress follows you everywhere.",
    },
    account: {
      icon: "🔐",
      title: pair(lg, "ฟีเจอร์นี้ต้องมีบัญชี", xl(lg, "This needs a real account")),
      sub: pair(lg, "ล็อกอินหรือสมัครสมาชิกฟรีเพื่อใช้งานส่วนนี้ — ความคืบหน้าที่ทำไว้จะถูกเก็บไว้ให้ครบ", xl(lg, "Log in or sign up free to use this — everything you did stays saved."), "\n"),
    },
  };
  const c = copy[reason] || copy.time;
  if (reason === "wall") return <LoginWall profile={profile} onGoogleLogin={onLogin} />;

  if (showSignup) {
    const inputStyle: React.CSSProperties = {
      width: "100%", padding: "12px 14px", borderRadius: 12,
      border: "1.5px solid rgba(255,255,255,0.15)",
      background: "rgba(255,255,255,0.08)",
      color: "#fff", fontSize: 15, outline: "none",
      boxSizing: "border-box",
    };
    const labelStyle: React.CSSProperties = {
      fontSize: 12, fontWeight: 600, opacity: 0.7, marginBottom: 4, display: "block",
      color: "rgba(255,255,255,0.8)",
    };
    const optionalTag = solo(lg, "(ไม่บังคับ · optional)", "(" + xl(lg, "optional") + ")");

    return (
      <div className="tg" style={{ position: "fixed", inset: 0, zIndex: 2000, alignItems: "center", justifyContent: "center" }}>
        <div className="scan" />
        <div className="gatecard" style={{
          width: "100%", maxWidth: 380, overflowY: "auto",
          background: "linear-gradient(160deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
          borderRadius: 24, padding: "32px 24px",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "column", gap: 0,
        }}>
          <button
            onClick={() => { setShowSignup(false); setSignupErr(""); setSignupDone(false); }}
            style={{
              alignSelf: "flex-start", background: "none", border: "none",
              color: "rgba(255,255,255,0.6)", fontSize: 22, cursor: "pointer",
              padding: "0 0 8px 0", marginBottom: 4,
            }}
          >{solo(lg, "← กลับ", "← " + xl(lg, "Back"))}</button>

          {signupDone ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 12 }}>
                {solo(lg, "สมัครสำเร็จ! 🎹", xl(lg, "Sign-up successful!") + " 🎹")}
              </div>
              <div style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.6 }}>
                {signupEmail.trim()
                  ? pair(lg, "ตรวจสอบอีเมลเพื่อยืนยันบัญชี", xl(lg, "Check your email to confirm"), "\n")
                  : solo(lg, "กำลังเข้าสู่ระบบด้วย Google...", xl(lg, "Signing in with Google..."))}
              </div>
              {signupEmail.trim() && (
                <button
                  onClick={() => { setShowSignup(false); onLogin(); }}
                  style={{
                    marginTop: 20, padding: "12px 32px", borderRadius: 12,
                    border: "none", background: "linear-gradient(135deg, #d97757, #c25e3f)",
                    color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
                  }}
                >{pair(lg, "เข้าสู่ระบบ", xl(lg, "Log in"))}</button>
              )}
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🎹</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
                  {solo(lg, "สมัครสมาชิกฟรี", xl(lg, "Sign up free"))}
                </div>
                <div style={{ fontSize: 13, opacity: 0.5 }}>
                  {pair(lg, "สมัครง่ายใน 10 วินาที", xl(lg, "Free signup in 10 seconds"))}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={labelStyle}>{solo(lg, "👤 ชื่อ-นามสกุล · Name *", "👤 " + xl(lg, "Name") + " *")}</label>
                  <input style={inputStyle} type="text" placeholder={pair(lg, "ชื่อของคุณ", xl(lg, "Your name"))} value={signupName} onChange={e => setSignupName(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{solo(lg, "📧 อีเมล · Email ", "📧 " + xl(lg, "Email") + " ")}<span style={{ opacity: 0.4 }}>{optionalTag}</span></label>
                  <input style={inputStyle} type="email" inputMode="email" autoComplete="email" placeholder="your@email.com" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{solo(lg, "🔒 รหัสผ่าน · Password *", "🔒 " + xl(lg, "Password") + " *")}</label>
                  <input style={inputStyle} type="password" autoComplete="new-password" placeholder={pair(lg, "อย่างน้อย 6 ตัวอักษร", xl(lg, "At least 6 characters"))} value={signupPassword} onChange={e => setSignupPassword(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>💬 LINE ID <span style={{ opacity: 0.4 }}>{optionalTag}</span></label>
                  <input style={inputStyle} type="text" placeholder="@yourlineid" value={signupLine} onChange={e => setSignupLine(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>{solo(lg, "🌐 Social Network ", "🌐 " + xl(lg, "Social Network") + " ")}<span style={{ opacity: 0.4 }}>{optionalTag}</span></label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input style={{ ...inputStyle, flex: 1 }} type="text" placeholder="📱 Facebook" value={signupFb} onChange={e => setSignupFb(e.target.value)} />
                      <input style={{ ...inputStyle, flex: 1 }} type="text" placeholder="📸 Instagram" value={signupIg} onChange={e => setSignupIg(e.target.value)} />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input style={{ ...inputStyle, flex: 1 }} type="text" placeholder="🎵 TikTok" value={signupTiktok} onChange={e => setSignupTiktok(e.target.value)} />
                      <input style={{ ...inputStyle, flex: 1 }} type="text" placeholder="▶️ YouTube" value={signupYoutube} onChange={e => setSignupYoutube(e.target.value)} />
                    </div>
                  </div>
                </div>

                {signupErr && (
                  <div style={{
                    padding: "10px 14px", borderRadius: 10,
                    background: "rgba(255,82,82,0.15)", border: "1px solid rgba(255,82,82,0.3)",
                    color: "#ff8a80", fontSize: 13, lineHeight: 1.4,
                  }}>{signupErr}</div>
                )}

                <div className="au-pdpa">
                  <div className="au-pdpa-h">{pair(lg, "ความเป็นส่วนตัว", xl(lg, "Privacy"))}</div>
                  <div className="au-pdpa-p">
                    {ext ? xl(lg, "We keep your name, email and learning progress only to open your account and save your learning. We never sell your data, and you can ask to delete your account at any time.") : <>
                    เราเก็บชื่อ อีเมล และความคืบหน้าการเรียนของคุณ เพื่อเปิดบัญชีและบันทึกการเรียนเท่านั้น
                    ไม่ขายข้อมูลให้ใคร และคุณขอลบบัญชีได้ทุกเมื่อ
                    </>}
                  </div>
                  <label className="au-ck">
                    <input type="checkbox" checked={gateAgree} onChange={e => setGateAgree(e.target.checked)} />
                    <span>
                      {ext ? (
                        <>
                          <span className="au-req">*</span>{" "}
                          <PolicyLine lg={lg} text={xl(lg, "I accept the [[Privacy Policy]] and consent to the collection of the data above to provide the service")} />
                        </>
                      ) : (
                        <>
                      <span className="au-req">*</span> ฉันยอมรับ
                      {" "}<a href="privacy-policy.html" target="_blank" rel="noopener noreferrer">นโยบายความเป็นส่วนตัว</a>
                      {" "}และยินยอมให้เก็บข้อมูลข้างต้นเพื่อให้บริการ
                        </>
                      )}
                    </span>
                  </label>
                  <label className="au-ck">
                    <input type="checkbox" checked={gateMarketing} onChange={e => setGateMarketing(e.target.checked)} />
                    <span>{solo(lg, "(ไม่บังคับ) ส่งข่าวคอร์สใหม่และโปรโมชันให้ฉันทางอีเมล", xl(lg, "(Optional) Email me news about new courses and promotions"))}</span>
                  </label>
                </div>

                <button
                  onClick={handleSignupSubmit}
                  disabled={signupBusy}
                  style={{
                    width: "100%", padding: "14px 24px", borderRadius: 14,
                    border: "none",
                    background: signupBusy ? "rgba(217,119,87,0.5)" : "linear-gradient(135deg, #d97757, #c25e3f)",
                    color: "#fff", fontSize: 16, fontWeight: 700,
                    cursor: signupBusy ? "default" : "pointer",
                    boxShadow: signupBusy ? "none" : "0 4px 16px rgba(217,119,87,0.35)",
                    letterSpacing: 0.3, marginTop: 4,
                  }}
                >
                  {signupBusy ? "..." : solo(lg, "🎹 สมัครสมาชิก · Sign up", "🎹 " + xl(lg, "Sign up"))}
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
                  <span style={{ fontSize: 12, opacity: 0.4 }}>{pair(lg, "หรือ", xl(lg, "or"))}</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
                </div>

                {gateInApp ? (
                  <button className="memberlink" style={{ width: "100%", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "10px" }}
                    onClick={() => openInRealBrowser()}>
                    {solo(lg, "🌐 เปิดในเบราว์เซอร์จริงเพื่อใช้ Google · Open in a real browser for Google", "🌐 " + xl(lg, "Open in a real browser for Google"))}
                  </button>
                ) : (
                  <button
                    className="oauthbtn google"
                    onClick={() => { saveGuestProfile(profile); onLogin(); }}
                    style={{ width: "100%" }}
                  >
                    <span className="oauthico">G</span>{solo(lg, " เข้าสู่ระบบด้วย Google", " " + xl(lg, "Log in with Google"))}
                  </button>
                )}

                <div style={{ fontSize: 11, opacity: 0.35, textAlign: "center", lineHeight: 1.5, marginTop: 4 }}>
                  {solo(lg, "ไม่ต้องบัตรเครดิต · No credit card required", xl(lg, "No credit card needed"))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="tg" style={{ position: "fixed", inset: 0, zIndex: 2000, alignItems: "center", justifyContent: "center" }}>
      <div className="scan" />
      <div className="banscreen">
        <div style={{ fontSize: 52 }}>{c.icon}</div>
        {/* .welcome, not the bare alarm-red .locktitle — this screen is an
            invitation to join, not a suspension notice */}
        <div className="locktitle welcome">{c.title}</div>
        <div className="locksub">{c.sub}</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%", maxWidth: 300, marginTop: 8 }}>
          {reason === "wall" && !gateInApp && (
            <button type="button" data-wall-google onClick={() => { saveGuestProfile(profile); onLogin(); }}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px 16px", borderRadius: 14, border: "1.5px solid #dadce0", background: "#fff", color: "#1f1f1f", fontSize: 16, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 10px rgba(0,0,0,.12)" }}>
              <GoogleMark /> เข้าสู่ระบบด้วย Google · Continue with Google
            </button>
          )}
          {reason === "wall" && !gateInApp && <div style={{ fontSize: 12, opacity: 0.55 }}>หรือใช้อีเมล · or use email</div>}
          <MagicLinkForm profile={profile} lg={lg} />
          <div style={{ fontSize: 12, opacity: 0.55 }}>{pair(lg, "หรือ", xl(lg, "or"))}</div>
          <LoginOptions profile={profile} onGoogleLogin={onLogin} lg={lg} />
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 10 }}>{pair(lg, "หรือสมัครสมาชิกฟรีด้านล่าง", xl(lg, "Or sign up free below"))}</div>
            <button
              onClick={() => setShowSignup(true)}
              style={{
                width: "100%", padding: "12px 22px", borderRadius: 13,
                border: "2px solid #d97757",
                background: "linear-gradient(135deg, #d97757, #c25e3f)",
                color: "#fff", fontSize: 15, fontWeight: 700,
                cursor: "pointer", letterSpacing: 0.3,
                boxShadow: "0 4px 16px rgba(217,119,87,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {solo(lg, "🎹 สมัครสมาชิกฟรี · Sign up free", "🎹 " + xl(lg, "Sign up free"))}
            </button>
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 8, lineHeight: 1.5 }}>
              {ext ? xl(lg, "No credit card · Sign up in 10 seconds") : <>ไม่ต้องบัตรเครดิต · สมัครง่ายใน 10 วินาที<br />No credit card · Sign up in 10 seconds</>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// One-time language choice, shown right after ProfileForm (or immediately
// for a guest, who skips ProfileForm entirely) and before PianoApp ever
// mounts — gated on profile.lang being unset. Persists to profiles.lang for
// a real account (follows the learner to any device) or into the guest's
// own already-persisted local profile object otherwise, so PianoApp's own
// `lang` state can simply initialize from profile.lang and never needs to
// ask again. Each option is self-labeled in its own script, so — unlike
// every other string on these pre-login screens — this one genuinely has no
// language to translate itself into yet.
const LANG_CHOICES = ALL_LANGS.map(code => ({ code, flag: LANG_META[code].flag, label: LANG_META[code].name }));   // all ten languages, flag + native name (this screen is not mounted today; see LANG_PICKER_ENABLED in App.tsx)
export function LangPickerScreen({ session, profile, setProfile }) {
  const lg = screenLang(profile), ext = isExtraLang(lg);   // a device that last used an extra language is asked in it; a first-time visitor keeps the three-language title
  useCatalog(lg);
  const [saving, setSaving] = useState(null); // which code is currently being saved
  async function pick(code) {
    if (saving) return;
    setSaving(code);
    const next = { ...profile, lang: code };
    if (session && session.user && session.user.id) {
      const { error } = await sb.from("profiles").update({ lang: code }).eq("id", session.user.id);
      if (error) { setSaving(null); return; } // stay on the picker — better than silently losing the choice
    } else {
      saveGuestProfile(next);
    }
    setProfile(next);
  }
  return (
    <div className="tg" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="scan" />
      <div className="memberwrap">
        <div className="lockicon" style={{ fontSize: 36 }}>🌐</div>
        <div className="locktitle welcome">{ext ? xl(lg, "Choose your language") : "เลือกภาษา · Choose your language · 选择语言"}</div>
        <div className="locksub">
          {ext ? xl(lg, "This will be used every time you come back — change it later in Settings anytime.") : <>
          จะใช้ภาษานี้ทุกครั้งที่เข้ามา เปลี่ยนได้ทีหลังในตั้งค่า<br />
          This will be used every time you come back — change it later in Settings anytime.
          </>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 300, marginTop: 6, maxHeight: "min(52vh, 420px)", overflowY: "auto" }}>
          {LANG_CHOICES.map(o => (
            <button key={o.code} className="lockbtn" disabled={!!saving} style={{ width: "100%" }} onClick={() => pick(o.code)}>
              {saving === o.code ? "..." : `${o.flag}  ${o.label}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProfileForm({ session, onSaved, onSignOut, profile }) {   // profile is optional (App() renders this when it has none): the device's last language decides then
  const lg = screenLang(profile);
  useCatalog(lg);
  const meta = (session && session.user && session.user.user_metadata) || {};
  const userEmail = (session && session.user && session.user.email) || meta.email || "";
  const [email, setEmail] = useState(userEmail);
  const [line, setLine] = useState("");
  const [phone, setPhone] = useState("");
  const [ig, setIg] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  async function save() {
    if (!email.trim()) { setErr(solo(lg, "กรุณากรอกอีเมล", xl(lg, "Please enter your email"))); return; }
    setSaving(true); setErr("");
    const { error } = await sb.from("profiles").update({
      email: email.trim(),
      line_id: line.trim() || null,
      phone: phone.trim() || null,
      instagram: ig.trim() || null,
      onboarded: true,
      updated_at: new Date().toISOString(),
    }).eq("id", session.user.id);
    setSaving(false);
    if (error) { setErr(error.message || solo(lg, "บันทึกไม่สำเร็จ", xl(lg, "Save failed"))); return; }
    onSaved();
  }
  return (
    <div className="tg" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="scan" />
      <div className="memberwrap">
        <div className="lockicon" style={{ fontSize: 36 }}>👋</div>
        <div className="locktitle welcome">{solo(lg, "ยินดีต้อนรับ", xl(lg, "Welcome"))}</div>
        <div className="locksub">{solo(lg, "แค่นี้ก็เริ่มเรียนได้เลย — ส่วนที่เหลือกรอกทีหลังก็ได้", xl(lg, "That's all you need to start learning — fill in the rest later"))}<br />{meta.full_name || userEmail}</div>
        <input className="memberinput" type="email" placeholder={solo(lg, "อีเมล (Email)", xl(lg, "Email"))} value={email} onChange={e => setEmail(e.target.value)} inputMode="email" />
        <input className="memberinput" placeholder={solo(lg, "LINE ID (ไม่บังคับ)", xl(lg, "LINE ID (optional)"))} value={line} onChange={e => setLine(e.target.value)} />
        <input className="memberinput" placeholder={solo(lg, "เบอร์โทรศัพท์ (ไม่บังคับ)", xl(lg, "Phone number (optional)"))} value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" />
        <input className="memberinput" placeholder={solo(lg, "Instagram (ไม่บังคับ)", xl(lg, "Instagram (optional)"))} value={ig} onChange={e => setIg(e.target.value)} />
        <div className="lockerr">{err}</div>
        <button className="lockbtn" disabled={saving} onClick={save}>{saving ? solo(lg, "กำลังบันทึก...", xl(lg, "Saving…")) : solo(lg, "เริ่มเรียนเลย ▶", xl(lg, "Start learning") + " ▶")}</button>
        <button className="memberlink" onClick={onSignOut}>{solo(lg, "ออกจากระบบ", xl(lg, "Sign out"))}</button>
      </div>
    </div>
  );
}

// animated count-up number for juicy result screens
export function CountUp({ value, dur = 900, className }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, start; const to = value || 0;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / dur);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));   // ease-out cubic
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, dur]);
  return <span className={className}>{v.toLocaleString()}</span>;
}

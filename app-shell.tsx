import { useState, useEffect, Component } from "react";
import { sb } from "./supabase-client";
import { saveGuestProfile } from "./shared-infra";
/* ── app-shell.tsx ──
   Small presentational components clustered around the App() root: the
   membership-gate screens (Splash/BannedScreen/GuestGateScreen/ProfileForm,
   shown before PianoApp itself ever mounts), ErrorBoundary (main.tsx's
   crash safety net), and CountUp, a tiny animated-number helper reused by
   result screens. Extracted from App.tsx verbatim as part of the App.tsx
   modularization — App() itself and PianoApp stay in App.tsx, since
   they're the file's own root/entry point. ── */

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
export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error("Uncaught render error:", error, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="tg" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="scan" />
        <div className="banscreen">
          <div style={{ fontSize: 52 }}>🎹</div>
          <div className="locktitle">เกิดข้อผิดพลาด · Something went wrong</div>
          <div className="locksub">ขออภัยในความไม่สะดวก กรุณาโหลดหน้าใหม่อีกครั้ง<br />Sorry about that — please reload the page to continue.</div>
          <button className="lockbtn" onClick={() => window.location.reload()}>โหลดใหม่ · Reload</button>
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

export function BannedScreen({ onSignOut }) {
  return (
    <div className="tg" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="scan" />
      <div className="banscreen">
        <div style={{ fontSize: 52 }}>🚫</div>
        <div className="locktitle">บัญชีถูกระงับ · Account suspended</div>
        <div className="locksub">บัญชีนี้ถูกระงับการใช้งาน หากคิดว่าผิดพลาด กรุณาติดต่อผู้ดูแล<br />This account has been suspended. Please contact the studio if you think this is a mistake.</div>
        <button className="lockbtn" onClick={onSignOut}>ออกจากระบบ · Sign out</button>
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
function friendlyAuthError(msg) {
  const m = msg || "";
  if (/already registered|already exists/i.test(m)) return "อีเมลนี้สมัครไว้แล้ว — ลองเข้าสู่ระบบแทน · This email is already registered — try logging in instead";
  if (/invalid login credentials/i.test(m)) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง · Incorrect email or password";
  if (/fetch|network|internet|offline/i.test(m)) return "เชื่อมต่อไม่ได้ ลองอีกครั้ง · Couldn't connect — please try again";
  return m || "เกิดข้อผิดพลาด ลองอีกครั้ง · Something went wrong — please try again";
}

// Google + email/password, side by side — a real account no longer requires
// a Google account specifically, since a student who's a child may not have
// one yet. Shared by GuestGateScreen (embedded inline, no dismiss) and
// LoginModal below (the corner pill's dismissable version). Bilingual
// Thai+English only, matching every other string on these screens — `lang`
// is PianoApp-local state that doesn't exist yet this early (these screens
// render before PianoApp ever mounts), so there's no language to switch on.
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
  const url = window.location.href;
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
function LoginOptions({ profile, onGoogleLogin }) {
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
    if (signup && !name.trim()) { setErr("กรุณากรอกชื่อที่อยากให้ครูเรียก · Please enter a name"); return; }
    if (!email.trim() || !password) { setErr("กรุณากรอกอีเมลและรหัสผ่าน · Please enter your email and password"); return; }
    if (password.length < 6) { setErr("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร · Password must be at least 6 characters"); return; }
    if (signup && password !== confirm) { setErr("รหัสผ่านไม่ตรงกัน · Passwords don't match"); return; }
    // PDPA: processing may not begin without a freely given, specific,
    // informed consent — so this is a hard stop, not a nudge.
    if (signup && !agree) { setErr("กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนสมัคร · Please accept the privacy notice to continue"); return; }
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
      if (error) { setErr(friendlyAuthError(error.message)); return; }
      if (signup && data && data.user && !data.session) {
        setMsg("สมัครสำเร็จ! ตรวจสอบอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ · Account created — check your email to confirm it, then log in.");
      }
      // A live session completes through App()'s own onAuthStateChange.
    } catch (e) {
      setErr(friendlyAuthError(e && e.message));
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (!email.trim()) { setErr("กรอกอีเมลก่อนเพื่อรีเซ็ตรหัสผ่าน · Enter your email above first"); return; }
    setBusy(true); setErr(""); setMsg("");
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname });
      if (error) setErr(friendlyAuthError(error.message));
      else setMsg("ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว · Reset link sent — check your inbox");
    } catch (e) { setErr(friendlyAuthError(e && e.message)); }
    finally { setBusy(false); }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      setErr("คัดลอกไม่สำเร็จ กดค้างที่แถบที่อยู่เพื่อคัดลอก · Copy failed — long-press the address bar instead");
    }
  }

  return (
    <div className="au">
      <div className="au-head">
        <div className="au-title">{signup ? "สมัครสมาชิกฟรี" : "ยินดีต้อนรับกลับมา"}</div>
        <div className="au-sub">
          {!signup
            ? "เข้าสู่ระบบเพื่อเล่นต่อจากที่ค้างไว้\nLog in to pick up where you left off"
            : inApp
            // promising Google here would be a lie: it cannot work in a WebView
            ? "สมัครด้วยอีเมลได้เลย ไม่ต้องมีบัญชี Google\nSign up with an email — no Google account needed"
            : "เลือกได้เลย — สมัครด้วยอีเมล หรือใช้บัญชี Google\nSign up with an email, or use Google"}
        </div>
      </div>

      <div className="au-seg" role="tablist">
        <button className={`au-segb${signup ? " on" : ""}`} role="tab" aria-selected={signup}
          onClick={() => { setMode("signup"); setErr(""); setMsg(""); }}>สมัครสมาชิกใหม่</button>
        <button className={`au-segb${!signup ? " on" : ""}`} role="tab" aria-selected={!signup}
          onClick={() => { setMode("login"); setErr(""); setMsg(""); }}>เข้าสู่ระบบ</button>
      </div>

      {inApp ? (
        <>
          <div className="au-warn">
            <b>⚠️ Google ใช้ไม่ได้ในเบราว์เซอร์ของแอปนี้</b>
            เปิดจาก Facebook / YouTube / TikTok ใช่ไหมคะ — Google ไม่ยอมให้ล็อกอินในนี้
            {" "}สมัครด้วยอีเมลด้านล่างได้ตามปกติ หรือกดเปิดในเบราว์เซอร์จริง
          </div>
          <div className="au-esc">
            <button className="au-escb" onClick={() => openInRealBrowser()}>🌐 เปิดในเบราว์เซอร์</button>
            <button className="au-escb" onClick={copyLink}>{copied ? "✓ คัดลอกแล้ว" : "🔗 คัดลอกลิงก์"}</button>
          </div>
        </>
      ) : (
        <>
          <button className="au-g" onClick={onGoogleLogin}>
            <GoogleMark /> {signup ? "สมัครด้วย Google" : "เข้าสู่ระบบด้วย Google"}
          </button>
          <div className="au-or">หรือ · or</div>
        </>
      )}

      <div className="au-f">
        {signup && (
          <input className="au-in" type="text" autoComplete="name" placeholder="ชื่อที่อยากให้ครูเรียก · Your name"
            value={name} onChange={e => setName(e.target.value)} />
        )}
        <input className="au-in" type="email" inputMode="email" autoComplete="email" placeholder="อีเมล · Email"
          value={email} onChange={e => setEmail(e.target.value)} />
        <input className="au-in" type="password" autoComplete={signup ? "new-password" : "current-password"}
          placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว) · Password" value={password} onChange={e => setPassword(e.target.value)} />
        {signup && (
          <input className="au-in" type="password" autoComplete="new-password" placeholder="ยืนยันรหัสผ่าน · Confirm password"
            value={confirm} onChange={e => setConfirm(e.target.value)} />
        )}
      </div>

      {signup && (
        <div className="au-pdpa">
          <div className="au-pdpa-h">ความเป็นส่วนตัว · Privacy</div>
          <div className="au-pdpa-p">
            เราเก็บชื่อ อีเมล และความคืบหน้าการเรียนของคุณ เพื่อใช้เปิดบัญชีและบันทึกการเรียนเท่านั้น
            ไม่ขายข้อมูลให้ใคร และคุณขอลบบัญชีได้ทุกเมื่อ
          </div>
          <label className="au-ck">
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <span>
              <span className="au-req">*</span> ฉันยอมรับ
              {" "}<a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">นโยบายความเป็นส่วนตัว</a>
              {" "}และยินยอมให้เก็บข้อมูลข้างต้นเพื่อให้บริการ
            </span>
          </label>
          <label className="au-ck">
            <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} />
            <span>
              (ไม่บังคับ) ส่งข่าวคอร์สใหม่และโปรโมชันให้ฉันทางอีเมล — ไม่เลือกก็สมัครได้ตามปกติ
            </span>
          </label>
        </div>
      )}

      {err && <div className="au-err">{err}</div>}
      {msg && <div className="au-ok">{msg}</div>}

      <button className="au-cta" disabled={busy} onClick={submit}>
        {busy ? "กำลังดำเนินการ..." : signup ? "สมัครสมาชิกฟรี" : "เข้าสู่ระบบ"}
      </button>

      {!signup && <button className="au-link" onClick={forgotPassword}>ลืมรหัสผ่าน? · Forgot password?</button>}

      {inApp && (
        <button className="au-link" style={{ opacity: .6, fontSize: 12 }} onClick={onGoogleLogin}>
          ลองใช้ Google ต่อไป (อาจไม่ทำงานในนี้) · Try Google anyway
        </button>
      )}

      <div className="au-fine">
        ฟรี ไม่ต้องใช้บัตรเครดิต · No credit card needed<br />
        การสมัครถือว่ายอมรับ <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">นโยบายความเป็นส่วนตัว</a> (ฉบับ {PDPA_VERSION})
      </div>
    </div>
  );
}

// The corner Login pill's version — same LoginOptions, wrapped as a
// dismissable modal since (unlike GuestGateScreen) this entry point is
// always optional, never a forced stop.
export function LoginModal({ profile, onGoogleLogin, onClose }) {
  return (
    <div className="setov" onClick={onClose}>
      <div className="setcard" style={{ maxWidth: 340 }} onClick={e => e.stopPropagation()}>
        <div className="sethdr"><span>🔐 เข้าสู่ระบบ · Login</span><button className="cbtn" onClick={onClose}>ปิด · Close</button></div>
        <div className="setbody" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "14px 6px" }}>
          <LoginOptions profile={profile} onGoogleLogin={onGoogleLogin} />
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
export function GuestGateScreen({ reason, profile, onLogin }) {
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
    if (!signupName.trim()) { setSignupErr("กรุณากรอกชื่อ · Please enter your name"); return; }
    if (!signupPassword || signupPassword.length < 6) { setSignupErr("รหัสผ่านต้องมีอย่างน้อย 6 ตัว · Password must be at least 6 characters"); return; }
    // Without an email this branch finishes by handing off to Google, and in a
    // social app's WebView that is the one door that is shut (see
    // inAppBrowser). Ask for the email instead of walking them into it.
    if (gateInApp && !signupEmail.trim()) { setSignupErr("กรุณากรอกอีเมล (ในเบราว์เซอร์ของแอปนี้ต้องใช้อีเมลสมัคร) · Email is required in this app's browser"); return; }
    if (!gateAgree) { setSignupErr("กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนสมัคร · Please accept the privacy notice to continue"); return; }
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
        if (error) { setSignupErr(friendlyAuthError(error.message)); setSignupBusy(false); return; }
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
      setSignupErr(e && e.message || "เกิดข้อผิดพลาด · Something went wrong");
    } finally {
      setSignupBusy(false);
    }
  }

  const copy = {
    time: {
      icon: "⏳",
      title: "กรุณาล็อกอินเพื่อเล่นฟรีต่อ 7 วัน",
      sub: "ล็อกอินหรือสมัครสมาชิกฟรีเพื่อเล่นต่อ — ความคืบหน้าที่ทำไว้จะถูกเก็บไว้ให้ครบ\nLog in or sign up free to keep playing — everything you did stays saved.",
    },
    ai: {
      icon: "🤖",
      title: "AI ครูสอนต้องล็อกอินก่อน · The AI teacher needs a login",
      sub: "ฟีเจอร์นี้ต้องใช้บัญชีจริง ล็อกอินหรือสมัครสมาชิกฟรีได้เลย — ความคืบหน้าที่ทำไว้จะถูกเก็บไว้ให้ครบ\nThis feature needs a real account. Log in or sign up free — everything you did stays saved.",
    },
    account: {
      icon: "🔐",
      title: "ฟีเจอร์นี้ต้องมีบัญชี · This needs a real account",
      sub: "ล็อกอินหรือสมัครสมาชิกฟรีเพื่อใช้งานส่วนนี้ — ความคืบหน้าที่ทำไว้จะถูกเก็บไว้ให้ครบ\nLog in or sign up free to use this — everything you did stays saved.",
    },
  };
  const c = copy[reason] || copy.time;

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

    return (
      <div className="tg" style={{ position: "fixed", inset: 0, zIndex: 2000, alignItems: "center", justifyContent: "center" }}>
        <div className="scan" />
        <div style={{
          width: "100%", maxWidth: 380, maxHeight: "90vh", overflowY: "auto",
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
          >← กลับ</button>

          {signupDone ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 12 }}>
                สมัครสำเร็จ! 🎹
              </div>
              <div style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.6 }}>
                {signupEmail.trim()
                  ? "ตรวจสอบอีเมลเพื่อยืนยันบัญชี\nCheck your email to confirm"
                  : "กำลังเข้าสู่ระบบด้วย Google..."}
              </div>
              {signupEmail.trim() && (
                <button
                  onClick={() => { setShowSignup(false); onLogin(); }}
                  style={{
                    marginTop: 20, padding: "12px 32px", borderRadius: 12,
                    border: "none", background: "linear-gradient(135deg, #d97757, #c25e3f)",
                    color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
                  }}
                >เข้าสู่ระบบ · Log in</button>
              )}
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ fontSize: 40, marginBottom: 8 }}>🎹</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
                  สมัครสมาชิกฟรี
                </div>
                <div style={{ fontSize: 13, opacity: 0.5 }}>
                  สมัครง่ายใน 10 วินาที · Free signup in 10 seconds
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={labelStyle}>👤 ชื่อ-นามสกุล · Name *</label>
                  <input style={inputStyle} type="text" placeholder="ชื่อของคุณ · Your name" value={signupName} onChange={e => setSignupName(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>📧 อีเมล · Email <span style={{ opacity: 0.4 }}>(ไม่บังคับ · optional)</span></label>
                  <input style={inputStyle} type="email" inputMode="email" autoComplete="email" placeholder="your@email.com" value={signupEmail} onChange={e => setSignupEmail(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>🔒 รหัสผ่าน · Password *</label>
                  <input style={inputStyle} type="password" autoComplete="new-password" placeholder="อย่างน้อย 6 ตัวอักษร · At least 6 characters" value={signupPassword} onChange={e => setSignupPassword(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>💬 LINE ID <span style={{ opacity: 0.4 }}>(ไม่บังคับ · optional)</span></label>
                  <input style={inputStyle} type="text" placeholder="@yourlineid" value={signupLine} onChange={e => setSignupLine(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>🌐 Social Network <span style={{ opacity: 0.4 }}>(ไม่บังคับ · optional)</span></label>
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
                  <div className="au-pdpa-h">ความเป็นส่วนตัว · Privacy</div>
                  <div className="au-pdpa-p">
                    เราเก็บชื่อ อีเมล และความคืบหน้าการเรียนของคุณ เพื่อเปิดบัญชีและบันทึกการเรียนเท่านั้น
                    ไม่ขายข้อมูลให้ใคร และคุณขอลบบัญชีได้ทุกเมื่อ
                  </div>
                  <label className="au-ck">
                    <input type="checkbox" checked={gateAgree} onChange={e => setGateAgree(e.target.checked)} />
                    <span>
                      <span className="au-req">*</span> ฉันยอมรับ
                      {" "}<a href="privacy-policy.html" target="_blank" rel="noopener noreferrer">นโยบายความเป็นส่วนตัว</a>
                      {" "}และยินยอมให้เก็บข้อมูลข้างต้นเพื่อให้บริการ
                    </span>
                  </label>
                  <label className="au-ck">
                    <input type="checkbox" checked={gateMarketing} onChange={e => setGateMarketing(e.target.checked)} />
                    <span>(ไม่บังคับ) ส่งข่าวคอร์สใหม่และโปรโมชันให้ฉันทางอีเมล</span>
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
                  {signupBusy ? "..." : "🎹 สมัครสมาชิก · Sign up"}
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
                  <span style={{ fontSize: 12, opacity: 0.4 }}>หรือ · or</span>
                  <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.1)" }} />
                </div>

                {gateInApp ? (
                  <button className="memberlink" style={{ width: "100%", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "10px" }}
                    onClick={() => openInRealBrowser()}>
                    🌐 เปิดในเบราว์เซอร์จริงเพื่อใช้ Google · Open in a real browser for Google
                  </button>
                ) : (
                  <button
                    className="oauthbtn google"
                    onClick={() => { saveGuestProfile(profile); onLogin(); }}
                    style={{ width: "100%" }}
                  >
                    <span className="oauthico">G</span> เข้าสู่ระบบด้วย Google
                  </button>
                )}

                <div style={{ fontSize: 11, opacity: 0.35, textAlign: "center", lineHeight: 1.5, marginTop: 4 }}>
                  ไม่ต้องบัตรเครดิต · No credit card required
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
        <div className="locktitle">{c.title}</div>
        <div className="locksub">{c.sub}</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%", maxWidth: 300, marginTop: 8 }}>
          <LoginOptions profile={profile} onGoogleLogin={onLogin} />
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 10 }}>หรือสมัครสมาชิกฟรีด้านล่าง · Or sign up free below</div>
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
              🎹 สมัครสมาชิกฟรี · Sign up free
            </button>
            <div style={{ fontSize: 11, opacity: 0.5, marginTop: 8, lineHeight: 1.5 }}>
              ไม่ต้องบัตรเครดิต · สมัครง่ายใน 10 วินาที<br />No credit card · Sign up in 10 seconds
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
const LANG_CHOICES = [
  { code: "th", flag: "🇹🇭", label: "ไทย" },
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
];
export function LangPickerScreen({ session, profile, setProfile }) {
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
        <div className="locktitle">เลือกภาษา · Choose your language · 选择语言</div>
        <div className="locksub">
          จะใช้ภาษานี้ทุกครั้งที่เข้ามา เปลี่ยนได้ทีหลังในตั้งค่า<br />
          This will be used every time you come back — change it later in Settings anytime.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 300, marginTop: 6 }}>
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

export function ProfileForm({ session, onSaved, onSignOut }) {
  const meta = (session && session.user && session.user.user_metadata) || {};
  const userEmail = (session && session.user && session.user.email) || meta.email || "";
  const [email, setEmail] = useState(userEmail);
  const [line, setLine] = useState("");
  const [phone, setPhone] = useState("");
  const [ig, setIg] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  async function save() {
    if (!email.trim()) { setErr("กรุณากรอกอีเมล"); return; }
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
    if (error) { setErr(error.message || "บันทึกไม่สำเร็จ"); return; }
    onSaved();
  }
  return (
    <div className="tg" style={{ alignItems: "center", justifyContent: "center" }}>
      <div className="scan" />
      <div className="memberwrap">
        <div className="lockicon" style={{ fontSize: 36 }}>👋</div>
        <div className="locktitle">ยินดีต้อนรับ</div>
        <div className="locksub">แค่นี้ก็เริ่มเรียนได้เลย — ส่วนที่เหลือกรอกทีหลังก็ได้<br />{meta.full_name || userEmail}</div>
        <input className="memberinput" type="email" placeholder="อีเมล (Email)" value={email} onChange={e => setEmail(e.target.value)} inputMode="email" />
        <input className="memberinput" placeholder="LINE ID (ไม่บังคับ)" value={line} onChange={e => setLine(e.target.value)} />
        <input className="memberinput" placeholder="เบอร์โทรศัพท์ (ไม่บังคับ)" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" />
        <input className="memberinput" placeholder="Instagram (ไม่บังคับ)" value={ig} onChange={e => setIg(e.target.value)} />
        <div className="lockerr">{err}</div>
        <button className="lockbtn" disabled={saving} onClick={save}>{saving ? "กำลังบันทึก..." : "เริ่มเรียนเลย ▶"}</button>
        <button className="memberlink" onClick={onSignOut}>ออกจากระบบ</button>
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

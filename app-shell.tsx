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
function LoginOptions({ profile, onGoogleLogin }) {
  const [showEmail, setShowEmail] = useState(false);
  const [mode, setMode] = useState("signup"); // signup | login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function submit() {
    if (busy) return;
    setErr(""); setMsg("");
    if (!email.trim() || !password) { setErr("กรุณากรอกอีเมลและรหัสผ่าน · Please enter your email and password"); return; }
    if (password.length < 6) { setErr("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร · Password must be at least 6 characters"); return; }
    if (mode === "signup" && password !== confirm) { setErr("รหัสผ่านไม่ตรงกัน · Passwords don't match"); return; }
    setBusy(true);
    try {
      // Same guest-progress-carries-over handoff the Google button already
      // does — loadProfile() in App() merges it into the real row once this
      // account's session lands, regardless of which method created it.
      saveGuestProfile(profile);
      const { data, error } = mode === "signup"
        ? await sb.auth.signUp({ email: email.trim(), password })
        : await sb.auth.signInWithPassword({ email: email.trim(), password });
      if (error) { setErr(friendlyAuthError(error.message)); return; }
      // A fresh session (Google's OAuth redirect and this both end here)
      // completes App()'s own sb.auth.onAuthStateChange listener, which is
      // what actually carries the app forward — nothing more to do here. If
      // the project requires email confirmation, signUp() instead returns a
      // user with no session yet, so say so instead of looking like nothing
      // happened.
      if (mode === "signup" && data && data.user && !data.session) {
        setMsg("สมัครสำเร็จ! ตรวจสอบอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ · Account created! Check your email to confirm it, then come back and log in.");
      }
    } catch (e) {
      // A genuine network drop can reject instead of resolving with
      // {error} — without this, that would skip setBusy(false) entirely
      // and leave the form stuck showing "..." forever with no way to
      // retry short of a reload.
      setErr(friendlyAuthError(e && e.message));
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (!email.trim()) { setErr("กรอกอีเมลก่อนเพื่อรีเซ็ตรหัสผ่าน · Enter your email above first to reset your password"); return; }
    setBusy(true); setErr(""); setMsg("");
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname });
      if (error) setErr(friendlyAuthError(error.message));
      else setMsg("ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว ตรวจสอบกล่องจดหมาย · Reset link sent — check your inbox");
    } catch (e) {
      setErr(friendlyAuthError(e && e.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="oauthbtn google" onClick={onGoogleLogin}>
        <span className="oauthico">G</span> เข้าสู่ระบบด้วย Google · Continue with Google
      </button>
      {!showEmail ? (
        <button className="memberlink" onClick={() => setShowEmail(true)}>หรือใช้อีเมล · or use email</button>
      ) : (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, marginTop: 2 }}>
          <input className="memberinput" type="email" inputMode="email" autoComplete="email"
            placeholder="อีเมล · Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="memberinput" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder="รหัสผ่าน · Password" value={password} onChange={e => setPassword(e.target.value)} />
          {mode === "signup" && (
            <input className="memberinput" type="password" autoComplete="new-password"
              placeholder="ยืนยันรหัสผ่าน · Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          )}
          {err && <div className="lockerr">{err}</div>}
          {msg && <div className="locksub" style={{ color: "#4caf82" }}>{msg}</div>}
          <button className="lockbtn" disabled={busy} onClick={submit} style={{ width: "100%" }}>
            {busy ? "..." : mode === "signup" ? "สมัครสมาชิก ▶ Sign up" : "เข้าสู่ระบบ ▶ Log in"}
          </button>
          <button className="memberlink" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setErr(""); setMsg(""); }}>
            {mode === "signup" ? "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ · Already have an account? Log in" : "ยังไม่มีบัญชี? สมัครสมาชิก · New here? Sign up"}
          </button>
          {mode === "login" && (
            <button className="memberlink" onClick={forgotPassword}>ลืมรหัสผ่าน? · Forgot password?</button>
          )}
        </div>
      )}
    </>
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
  return (
    <div className="tg" style={{ position: "fixed", inset: 0, zIndex: 2000, alignItems: "center", justifyContent: "center" }}>
      <div className="scan" />
      <div className="banscreen">
        <div style={{ fontSize: 52 }}>{c.icon}</div>
        <div className="locktitle">{c.title}</div>
        <div className="locksub">{c.sub}</div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%", maxWidth: 300, marginTop: 8 }}>
          <LoginOptions profile={profile} onGoogleLogin={onLogin} />
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

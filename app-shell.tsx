import { useState, useEffect } from "react";
import { sb } from "./supabase-client";
/* ── app-shell.tsx ──
   Small presentational components clustered around the App() root: the
   membership-gate screens (Splash/BannedScreen/GuestGateScreen/ProfileForm,
   shown before PianoApp itself ever mounts) and CountUp, a tiny animated-
   number helper reused by result screens. Extracted from App.tsx verbatim
   as part of the App.tsx modularization — App() itself and PianoApp stay
   in App.tsx, since they're the file's own root/entry point. ── */

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

// The forced side of guest mode (the corner Login pill is the optional
// side) — shown when the free trial runs out or a guest taps an AI-backed
// feature that structurally cannot work without a real session. No dismiss
// button by design (matches "ต้องล็อกอิน" — login is genuinely required to
// continue past this point), but it always appears at a natural stopping
// point (next navigation / on tap), never yanked up mid-exercise.
export function GuestGateScreen({ reason, onLogin }) {
  const copy = {
    time: {
      icon: "⏳",
      title: "กรุณาล็อกอินเพื่อเล่นฟรีต่อ 7 วัน",
      sub: "ล็อกอินด้วย Google เพื่อเล่นต่อ — ความคืบหน้าที่ทำไว้จะถูกเก็บไว้ให้ครบ\nLog in with Google to keep playing — everything you did stays saved.",
    },
    ai: {
      icon: "🤖",
      title: "AI ครูสอนต้องล็อกอินก่อน · The AI teacher needs a login",
      sub: "ฟีเจอร์นี้ต้องใช้บัญชีจริง ล็อกอินฟรีด้วย Google ได้เลย — ความคืบหน้าที่ทำไว้จะถูกเก็บไว้ให้ครบ\nThis feature needs a real account. Log in free with Google — everything you did stays saved.",
    },
    account: {
      icon: "🔐",
      title: "ฟีเจอร์นี้ต้องมีบัญชี · This needs a real account",
      sub: "ล็อกอินฟรีด้วย Google เพื่อใช้งานส่วนนี้ — ความคืบหน้าที่ทำไว้จะถูกเก็บไว้ให้ครบ\nLog in free with Google to use this — everything you did stays saved.",
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
        <button className="oauthbtn google" onClick={onLogin} style={{ marginTop: 8 }}>
          <span className="oauthico">G</span> เข้าสู่ระบบด้วย Google
        </button>
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

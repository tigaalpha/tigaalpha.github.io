import { Component } from "react";

/* ── landing/landing-utils.tsx ──
   The landing page imported ErrorBoundary, inAppBrowser, openInRealBrowser,
   PDPA_VERSION and friendlyAuthError from ../app-shell. That made app-shell —
   and everything app-shell reaches — part of the landing bundle's module
   graph, paid for on every ad click before the piano could render. Median
   dwell on this page is ~2s, so every kilobyte before first paint is a
   visitor who leaves on the boot screen.

   These are VERBATIM copies of the app-shell implementations (each marked
   below). If the original changes in a way that matters — a new WebView in
   the UA list, a new PDPA version, a new friendly-error mapping — update both.
   They are deliberately small, stable, and self-contained: that is what makes
   the duplication cheaper than the import. Nothing here may import from the
   app (that is the entire point of this file). ── */

/* ── VERBATIM from app-shell.tsx ErrorBoundary ── */
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

/* ── VERBATIM from app-shell.tsx friendlyAuthError ── */
export function friendlyAuthError(msg) {
  const m = msg || "";
  if (/already registered|already exists/i.test(m)) return "อีเมลนี้สมัครไว้แล้ว — ลองเข้าสู่ระบบแทน · This email is already registered — try logging in instead";
  if (/invalid login credentials/i.test(m)) return "อีเมลหรือรหัสผ่านไม่ถูกต้อง · Incorrect email or password";
  if (/fetch|network|internet|offline/i.test(m)) return "เชื่อมต่อไม่ได้ ลองอีกครั้ง · Couldn't connect — please try again";
  return m || "เกิดข้อผิดพลาด ลองอีกครั้ง · Something went wrong — please try again";
}

/* ── VERBATIM from app-shell.tsx inAppBrowser (incl. its isNativeShell) ── */
function isNativeShell() {
  try { return !!(window as any).Capacitor && (window as any).Capacitor.isNativePlatform && (window as any).Capacitor.isNativePlatform(); }
  catch (e) { return false; }
}
export function inAppBrowser() {
  if (typeof navigator === "undefined") return false;
  if (isNativeShell()) return false;
  const ua = navigator.userAgent || "";
  if (/FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger|Line\/|LIFF|TikTok|musical_ly|BytedanceWebview|MicroMessenger|KAKAOTALK|Snapchat|Pinterest|Twitter/i.test(ua)) return true;
  if (/Android/i.test(ua) && /;\s*wv\)/i.test(ua)) return true;
  if (/iPhone|iPad|iPod/i.test(ua) && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua)) return true;
  return false;
}

/* ── VERBATIM from app-shell.tsx openInRealBrowser ── */
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

/* ── VERBATIM from app-shell.tsx PDPA_VERSION — keep in lockstep! ── */
export const PDPA_VERSION = "2026-09-11";

/* ── landing-only: how long the page took to become usable ──
   The dashboard says visitors leave at a median of ~2s, which is around when
   the bundle finishes parsing on a webview connection — but "around" is not a
   number you can fix against. Logged once, when React first paints.
   Written through land-log (plain REST, no supabase-js): importing
   shared-infra here even lazily pulls the whole auth chunk back into the
   byte budget 1.2 s after load, on the webview connections this number
   exists to measure. Same table, same kind/shape — there is never a session
   on this page, so dropping supabase-js changes nothing about the row. */
import { logLand } from "./land-log";
export function logReadyMs() {
  try {
    const nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
    const t = Math.round((nav && nav.domContentLoadedEventEnd) || performance.now());
    setTimeout(() => logLand("land", "ready:" + t), 1200);
  } catch (e) {}
}

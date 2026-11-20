import { isChunkLoadError, reloadForNewBuild } from "../chunk-reload";
import { handoffUrl } from "../local-identity";
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

/* ── ErrorBoundary: VERBATIM from app-shell.tsx for th / en / zh, plus ja / ko / ru / hi / es / fr / ar / de ──
   The fallback is read before anything else on the page can help, so it picks
   its wording from <html lang> directly instead of from landing-copy. Thai +
   English stays the default for every other language, exactly as before. */
const CRASH_COPY = {
  ja: { title: "問題が発生しました · Something went wrong", sub: "ご不便をおかけして申し訳ありません。ページを再読み込みしてください。", btn: "再読み込み · Reload" },
  ko: { title: "문제가 발생했어요 · Something went wrong", sub: "불편을 드려 죄송해요. 페이지를 다시 불러와 주세요.", btn: "다시 불러오기 · Reload" },
  ru: { title: "Что-то пошло не так · Something went wrong", sub: "Приносим извинения. Пожалуйста, перезагрузите страницу.", btn: "Перезагрузить · Reload" },
  hi: { title: "कुछ गड़बड़ हो गई · Something went wrong", sub: "असुविधा के लिए खेद है। कृपया पेज को दोबारा लोड करें।", btn: "दोबारा लोड करें · Reload" },
  es: { title: "Algo salió mal · Something went wrong", sub: "Perdona las molestias. Recarga la página para continuar.", btn: "Recargar · Reload" },
  fr: { title: "Une erreur s'est produite · Something went wrong", sub: "Toutes nos excuses. Veuillez recharger la page.", btn: "Recharger · Reload" },
  ar: { title: "حدث خطأ ما · Something went wrong", sub: "نعتذر عن الإزعاج. يرجى إعادة تحميل الصفحة.", btn: "إعادة التحميل · Reload" },
  de: { title: "Etwas ist schiefgelaufen · Something went wrong", sub: "Entschuldige die Umstände. Lade die Seite bitte neu.", btn: "Neu laden · Reload" },
};
function crashCopy() {
  try {
    const l = (document.documentElement.getAttribute("lang") || "").slice(0, 2).toLowerCase();
    return CRASH_COPY[l] || null;
  } catch (e) { return null; }
}
export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { if (isChunkLoadError(error)) reloadForNewBuild(); console.error("Uncaught render error:", error, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    const cc = crashCopy();
    if (cc) return (
      <div className="tg" style={{ alignItems: "center", justifyContent: "center" }}>
        <div className="scan" />
        <div className="banscreen">
          <div style={{ fontSize: 52 }}>🎹</div>
          <div className="locktitle">{cc.title}</div>
          <div className="locksub">{cc.sub}</div>
          <button className="lockbtn" onClick={() => window.location.reload()}>{cc.btn}</button>
        </div>
      </div>
    );
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

/* ── friendlyAuthError: VERBATIM from app-shell.tsx for th / en / zh; ja / ko / ru / hi / es / fr / ar / de
   get the same sentences in their language, followed by the English one, the
   same "native · English" shape the Thai text already has ── */
const AUTH_ERR = {
  ja: {
    exists: "このメールアドレスは登録済みです — 代わりにログインしてください · This email is already registered — try logging in instead",
    creds: "メールアドレスまたはパスワードが正しくありません · Incorrect email or password",
    net: "接続できませんでした。もう一度お試しください · Couldn't connect — please try again",
    other: "エラーが発生しました。もう一度お試しください · Something went wrong — please try again",
  },
  ko: {
    exists: "이미 가입된 이메일이에요 — 대신 로그인해 주세요 · This email is already registered — try logging in instead",
    creds: "이메일 또는 비밀번호가 올바르지 않아요 · Incorrect email or password",
    net: "연결하지 못했어요. 다시 시도해 주세요 · Couldn't connect — please try again",
    other: "문제가 발생했어요. 다시 시도해 주세요 · Something went wrong — please try again",
  },
  ru: {
    exists: "Этот e-mail уже зарегистрирован — попробуйте войти · This email is already registered — try logging in instead",
    creds: "Неверный e-mail или пароль · Incorrect email or password",
    net: "Не удалось подключиться — попробуйте ещё раз · Couldn't connect — please try again",
    other: "Что-то пошло не так — попробуйте ещё раз · Something went wrong — please try again",
  },
  hi: {
    exists: "इस ईमेल से अकाउंट पहले से बना हुआ है — इसके बजाय लॉग इन करें · This email is already registered — try logging in instead",
    creds: "ईमेल या पासवर्ड ग़लत है · Incorrect email or password",
    net: "कनेक्ट नहीं हो सका — कृपया फिर से कोशिश करें · Couldn't connect — please try again",
    other: "कुछ गड़बड़ हो गई — कृपया फिर से कोशिश करें · Something went wrong — please try again",
  },
  es: {
    exists: "Este correo ya está registrado — intenta iniciar sesión · This email is already registered — try logging in instead",
    creds: "Correo o contraseña incorrectos · Incorrect email or password",
    net: "No se pudo conectar — inténtalo de nuevo · Couldn't connect — please try again",
    other: "Algo salió mal — inténtalo de nuevo · Something went wrong — please try again",
  },
  fr: {
    exists: "Cette adresse e-mail est déjà enregistrée — essayez plutôt de vous connecter · This email is already registered — try logging in instead",
    creds: "E-mail ou mot de passe incorrect · Incorrect email or password",
    net: "Connexion impossible — veuillez réessayer · Couldn't connect — please try again",
    other: "Une erreur est survenue — veuillez réessayer · Something went wrong — please try again",
  },
  ar: {
    exists: "هذا البريد الإلكتروني مسجّل بالفعل — جرّب تسجيل الدخول بدلًا من ذلك · This email is already registered — try logging in instead",
    creds: "البريد الإلكتروني أو كلمة المرور غير صحيحة · Incorrect email or password",
    net: "تعذّر الاتصال — حاول مرة أخرى · Couldn't connect — please try again",
    other: "حدث خطأ ما — حاول مرة أخرى · Something went wrong — please try again",
  },
  de: {
    exists: "Diese E-Mail-Adresse ist schon registriert — melde dich stattdessen an · This email is already registered — try logging in instead",
    creds: "E-Mail oder Passwort ist falsch · Incorrect email or password",
    net: "Keine Verbindung — bitte versuche es noch einmal · Couldn't connect — please try again",
    other: "Etwas ist schiefgelaufen — bitte versuche es noch einmal · Something went wrong — please try again",
  },
};
export function friendlyAuthError(msg, lang = "") {
  const m = msg || "";
  const L = AUTH_ERR[lang];
  if (L) {
    if (/already registered|already exists/i.test(m)) return L.exists;
    if (/invalid login credentials/i.test(m)) return L.creds;
    if (/fetch|network|internet|offline/i.test(m)) return L.net;
    return m || L.other;
  }
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

/* ── from app-shell.tsx openInRealBrowser, plus the handoff fields ──
   The URL that leaves the in-app browser carries the visitor's anon id, original
   source and browser kind (local-identity.handoffUrl) so the page that opens on
   the other side can pick the same person up instead of meeting a stranger.
   escapeUrl() is exported because the copy-link fallback must copy THE SAME
   address: a link pasted into Safari has to stitch just like the Chrome jump. */
export function escapeUrl() { return handoffUrl(window.location.href); }
export function openInRealBrowser() {
  const url = escapeUrl();
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

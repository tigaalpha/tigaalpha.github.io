import { useState, useEffect } from "react";
import { pickT, xl } from "./lang-extra";
import { logUsage } from "./shared-infra";
import { inAppBrowser, escapeNow, EscapeGuide } from "./app-shell";
import { TRIAL_DAYS_STANDARD } from "./payment";
import { trialPriceFor } from "./use-conversion";

/* ── the two inline strips a guest sees at the top of the Learning Pathway (owner 2026-11-26) ──
   They scroll away with the lesson table (they are the first children of .pathpage, drawn by PathwayPage through its `top` prop), they never cover it, and they are only ever drawn for a guest
   outside the Play build (App.tsx decides). AGENTS.md "Guest-first entry": nothing may sit OVER the Pathway; an inline strip above the table is the exception the owner approved on 2026-11-26.
   1. the hero strip: one sentence, "Try it now" (opens the first recommended lesson THROUGH the card, so the free-preview count still happens in learnTopic -> guestStart), "Try Premium free for 7 days"
      (the log-in card) and the price line; the cross remembers the choice on this device (tg_guest_hero_closed, device-only in cloud-sync.ts).
   2. the in-app browser notice: Google refuses to sign anybody in inside Facebook / LINE / TikTok, so a guest in one is told once, shortly, with the two ways out. */
const HERO_KEY = "tg_guest_hero_closed";
let shownLogged = false;   // one "shown" row per page load (StrictMode runs an effect twice in development)

export function GuestHeroStrips({ lang, onTrial }: { lang: string; onTrial: () => void }) {
  const T = (th: string, en: string, zh: string) => pickT(lang, th, en, zh);
  const [closed, setClosed] = useState(() => { try { return localStorage.getItem(HERO_KEY) === "1"; } catch (e) { return false; } });
  const [inApp] = useState(() => inAppBrowser());
  const [copied, setCopied] = useState(false);
  const [copyErr, setCopyErr] = useState(false);
  const [guide, setGuide] = useState(false);
  useEffect(() => { if (!closed && !shownLogged) { shownLogged = true; logUsage("guesthero", "shown"); } }, []);

  const price = trialPriceFor(lang || "th");
  const days = String(TRIAL_DAYS_STANDARD);
  const title = T("เรียนเปียโนกับครู AI ของ TIGA ALPHA — เริ่มได้เลย ไม่ต้องสมัคร", "Learn piano with the AI teacher of TIGA ALPHA — start now, no sign-up", "和 TIGA ALPHA 的 AI 老师一起学钢琴 — 马上开始，无需注册");
  const tryLabel = T("ลองเล่นทันที", "Try it now", "马上试玩");
  const trialLabel = T("ทดลอง Premium ฟรี " + days + " วัน", xl(lang, "Try Premium free for {0} days").split("{0}").join(days), "免费试用 Premium " + days + " 天");
  const fine = lang === "th" ? "จากนั้น " + price + " บาท/เดือน ไม่ต้องผูกบัตร"
    : lang === "zh" ? "之后每月 " + price + "，无需绑定银行卡"
    : xl(lang, "Then {0} per month, no card needed").split("{0}").join(price);

  /* "Try it now": open the first recommended lesson the way a tap on its card does. The card (the stage the learner is on, else the first one) opens its key panel; picking a key starts the
     lesson through learnTopic -> guestStart, so the preview count is spent exactly as before. Nothing here starts an activity by itself. */
  function tryNow() {
    logUsage("guesthero", "try");
    const card = document.querySelector(".pathpage .pcard.current") || document.getElementById("pcard-scale");
    if (card) { try { (card as HTMLElement).scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {} (card as HTMLElement).click(); }
  }
  function close() {
    logUsage("guesthero", "close");
    try { localStorage.setItem(HERO_KEY, "1"); } catch (e) {}
    setClosed(true);
  }
  async function copyLink() {
    logUsage("guesthero", "inapp-copy");
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setCopyErr(false); setTimeout(() => setCopied(false), 2500); }
    catch (e) { setCopyErr(true); }
  }

  return (
    <>
      {inApp && (
        <div className="gnotice" data-inapp-notice role="note">
          <div className="gnotice-t">{T("คุณเปิดผ่านแอปโซเชียล — ปุ่ม Google อาจใช้ไม่ได้ แนะนำเปิดในเบราว์เซอร์ หรือสมัครด้วยอีเมลได้เลย", "You opened this inside a social app — Google sign-in may not work. Open it in your browser, or sign up with your email.", "你是通过社交应用打开的 — Google 登录可能无法使用。建议在浏览器中打开，或直接用邮箱注册。")}</div>
          <div className="gnotice-act">
            <button type="button" className="gnotice-b" data-inapp-open onClick={() => { logUsage("guesthero", "inapp-open"); escapeNow(() => setGuide(true)); }}>{T("🌐 เปิดในเบราว์เซอร์", "🌐 " + xl(lang, "Open in browser"), "🌐 在浏览器中打开")}</button>
            <button type="button" className="gnotice-b" data-inapp-copy onClick={copyLink}>{copied ? T("✓ คัดลอกแล้ว", "✓ " + xl(lang, "Copied!"), "✓ 已复制") : T("🔗 คัดลอกลิงก์", "🔗 " + xl(lang, "Copy link"), "🔗 复制链接")}</button>
          </div>
          {guide && <EscapeGuide lg={lang} onClose={() => setGuide(false)} />}
          {copyErr && <div className="gnotice-e" role="alert">{T("คัดลอกไม่สำเร็จ กดค้างที่แถบที่อยู่เพื่อคัดลอก", xl(lang, "Copy failed — long-press the address bar instead"), "复制失败 — 请改为长按地址栏")}</div>}
        </div>
      )}
      {!closed && (
        <div className="ghero" data-guest-hero role="region" aria-label="TIGA ALPHA">
          <button type="button" className="ghero-x" data-guest-hero-close aria-label={T("ปิด", xl(lang, "Close"), "关闭")} onClick={close}>×</button>
          <div className="ghero-t">{title}</div>
          <div className="ghero-act">
            <button type="button" className="ghero-try" data-guest-hero-try onClick={tryNow}>{tryLabel}</button>
            <button type="button" className="ghero-trial" data-guest-hero-trial onClick={() => { logUsage("guesthero", "trial"); onTrial(); }}>{trialLabel}</button>
          </div>
          <div className="ghero-fine">{fine}</div>
        </div>
      )}
    </>
  );
}

/* ── day-5 / day-6 reminder of a member on the free trial (Step 3.2): an inline strip at the top of the Pathway, never a pop-up, once ── */
export function TrialReminderStrip({ lang, daysLeft, onKeep, onClose }: { lang: string; daysLeft: number; onKeep: () => void; onClose: () => void }) {
  const T = (th: string, en: string, zh: string) => pickT(lang, th, en, zh);
  const price = trialPriceFor(lang || "th"), p = lang === "th" ? price + " บาท" : price, n = String(daysLeft);
  useEffect(() => { logUsage("conv", "d5strip:shown"); }, []);
  const msg = T("เหลืออีก " + n + " วัน — ต่อ Premium " + p + "/เดือน เพื่อเรียนต่อไม่สะดุด",
    "Only " + n + " days left — keep Premium at " + p + " per month and carry on learning without a break",
    "还剩 " + n + " 天 — 每月 " + p + " 继续使用 Premium，学习不中断");
  const text = (lang === "th" || lang === "en" || lang === "zh") ? msg : xl(lang, "{0} days left — keep Premium at {1} per month and carry on learning without a break").split("{0}").join(n).split("{1}").join(p);
  return (
    <div className="ghero" data-trial-reminder role="region" aria-label="TIGA ALPHA">
      <button type="button" className="ghero-x" data-trial-reminder-close aria-label={T("ปิด", xl(lang, "Close"), "关闭")} onClick={() => { logUsage("conv", "d5strip:close"); onClose(); }}>×</button>
      <div className="ghero-t">{text}</div>
      <div className="ghero-act">
        <button type="button" className="ghero-trial" data-trial-reminder-keep onClick={() => { logUsage("conv", "d5strip:cta"); onKeep(); }}>{T("ต่อ Premium", "Keep Premium", "继续 Premium")}</button>
        <button type="button" className="ghero-try" data-trial-reminder-later onClick={() => { logUsage("conv", "d5strip:close"); onClose(); }}>{T("ยังไม่ตอนนี้", xl(lang, "Not now"), "暂不")}</button>
      </div>
    </div>
  );
}

/* ── the soft invitation after a guest's FIRST value moment (Step 2.4, owner 2026-11-26) ──
   A value moment = the first finished practice round / lesson drill, or the first finished song with at least one star. App.tsx shows this ONCE per browser (tg_guest_value_seen), only for a
   guest, only while that result screen is open, and never together with the log-in card. It is a short strip at the bottom of the result screen (above the result overlays, below every dialog),
   never a modal and never over the Pathway (it disappears with the result screen). It spends no free use. "Try Premium" opens the standard invitation (reason "value"); "Keep playing first" closes it. */
export const VALUE_SEEN_KEY = "tg_guest_value_seen";
export function valueSeen(): boolean { try { return !!localStorage.getItem(VALUE_SEEN_KEY); } catch (e) { return true; } }
export function markValueSeen() { try { localStorage.setItem(VALUE_SEEN_KEY, new Date().toISOString().slice(0, 10)); } catch (e) {} }
export function GuestValueCard({ lang, onJoin, onClose }: { lang: string; onJoin: () => void; onClose: () => void }) {
  const T = (th: string, en: string, zh: string) => pickT(lang, th, en, zh);
  const days = String(TRIAL_DAYS_STANDARD);
  useEffect(() => { logUsage("gate", "value:shown"); }, []);
  const msg = T("เยี่ยมมาก! เก็บความคืบหน้านี้ไว้ — ทดลอง Premium ฟรี " + days + " วัน ไม่ต้องผูกบัตร",
    xl(lang, "Great job! Keep this progress — try Premium free for {0} days, no card needed").split("{0}").join(days),
    "太棒了！保存你的进度 — 免费试用 Premium " + days + " 天，无需绑定银行卡");
  return (
    <div className="gvalue" data-guest-value role="region" aria-label="TIGA ALPHA">
      <div className="gvalue-t">{msg}</div>
      <div className="gvalue-act">
        <button type="button" className="gvalue-go" data-guest-value-cta onClick={() => { logUsage("gate", "value:cta"); onJoin(); }}>{T("ทดลอง Premium ฟรี " + days + " วัน", xl(lang, "Try Premium free for {0} days").split("{0}").join(days), "免费试用 Premium " + days + " 天")}</button>
        <button type="button" className="gvalue-x" data-guest-value-close onClick={() => { logUsage("gate", "value:close"); onClose(); }}>{T("เล่นต่อก่อน", xl(lang, "Keep playing first"), "先继续玩")}</button>
      </div>
    </div>
  );
}

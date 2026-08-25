import { useState, useRef, useEffect, useMemo } from "react";
import qrcode from "qrcode-generator";
import { sb, SUPABASE_URL } from "./supabase-client";
import { apiHeaders } from "./ai-backend";

/* ── PromptPay QR (EMVCo) — generate a payable QR straight to the owner's bank.
   No gateway, no fees: money goes directly to the configured PromptPay ID. ── */
function _ppTLV(id, val) { const l = String(val.length).padStart(2, "0"); return id + l + val; }
function _ppCrc16(s) {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
// target = mobile number (0xxxxxxxxx) or national/tax id (13 digits); amount in THB
function promptPayPayload(target, amount) {
  const digits = String(target || "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  let acc, tag;
  if (digits.length >= 13) { acc = digits.slice(0, 13); tag = "02"; }      // national / tax id
  else {                                                                    // mobile → 0066 + 9 digits (13 total)
    let local = digits; if (local.startsWith("66")) local = local.slice(2); local = local.replace(/^0+/, "");
    acc = "0066" + local; tag = "01";
  }
  const merchant = _ppTLV("00", "A000000677010111") + _ppTLV(tag, acc);
  let s = _ppTLV("00", "01") + _ppTLV("01", amount > 0 ? "12" : "11") + _ppTLV("29", merchant) + _ppTLV("53", "764") + _ppTLV("58", "TH");
  if (amount > 0) s += _ppTLV("54", Number(amount).toFixed(2));
  s += "6304";
  return s + _ppCrc16(s);
}
export function promptPayQR(target, amount) {
  try {
    const payload = promptPayPayload(target, amount);
    if (!payload) return null;
    const qr = qrcode(0, "M"); qr.addData(payload); qr.make();
    return qr.createDataURL(6, 12);   // PNG data URL
  } catch (e) { return null; }
}

/* The Alipay / WeChat QR images the owner uploaded. These paths are relative
   to the page, and the files live in payqr/ — pointing them at the site root
   (which is where they used to point) makes every Chinese customer's checkout
   show a broken image instead of a QR to scan, which is exactly as bad as
   having no Chinese payment method at all. Keep in step with the real files. */
export const ALIPAY_QR = "./payqr/alipay.jpg";
export const WECHAT_QR = "./payqr/wechat.png";

/* A payment QR that says so when it fails to load. A QR is the whole payment
   method here — if the file 404s the customer sees a broken-image icon, has no
   idea anything is wrong, and simply cannot pay. This turns a silent failure
   into a visible one, for the buyer AND for whoever is watching the launch. */
export function PayQrImg({ src, alt, lang }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [src]);
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  if (broken) {
    return (
      <div className="aicreate-err" style={{ textAlign: "center", lineHeight: 1.6 }}>
        {T("โหลด QR ไม่สำเร็จ — ทักแอดมินเพื่อรับ QR โดยตรงได้เลย",
           "This QR failed to load — please contact us and we'll send it to you directly.",
           "二维码加载失败，请联系我们，我们会直接发给您。")}
        <div style={{ opacity: .6, fontSize: 11, marginTop: 4, wordBreak: "break-all" }}>{src}</div>
      </div>
    );
  }
  return <img className="payqr ext" src={src} alt={alt} onError={() => setBroken(true)}
    style={{ width: "100%", maxWidth: 260, display: "block", margin: "10px auto", borderRadius: 12 }} />;
}

/* ── premium / freemium + daily free-tier usage limits ── */
export function isPremium() { try { return localStorage.getItem("tg_premium") === "1"; } catch (e) { return false; } }
export function setPremiumLS(v) { try { localStorage.setItem("tg_premium", v ? "1" : "0"); } catch (e) {} }
/* Subscription tier — switchable any time: "free" | "premium" | "family" | "max". */
export function getPlan() { try { return localStorage.getItem("tg_plan") || (isPremium() ? "premium" : "free"); } catch (e) { return "free"; } }
export function setPlanLS(p) { try { localStorage.setItem("tg_plan", p); localStorage.setItem("tg_premium", p === "free" ? "0" : "1"); } catch (e) {} }
// Voice Mode (AI voice teacher) is a Max / Max Family exclusive.
export function isMaxPlan(p) { const v = p || getPlan(); return v === "max" || v === "maxfamily"; }
/* The published price list. These three tables are duplicated in the
   supabase/functions/stripe-checkout edge function, which is what actually
   charges the card — CHANGE BOTH TOGETHER. A sale is refused outright if they
   disagree (see `expect` in openStripe below), so a one-sided edit shows up as
   a failed checkout rather than as a customer billed the wrong amount. */
export const PLAN_PRICE     = { premium: 1490,  family: 2900,  max: 3999,   maxfamily: 9999  }; // THB
export const PLAN_PRICE_USD = { premium: 44.99, family: 89.99, max: 119.99, maxfamily: 149.99 }; // USD
export const PLAN_PRICE_CNY = { premium: 328,   family: 648,   max: 888,    maxfamily: 1088  }; // CNY
export const CURRENCY_BY_LANG: Record<string,string> = { th: "thb", en: "usd", zh: "cny" };
export const PLAN_LABEL = { premium: "⭐ Premium", family: "👨‍👩‍👧 Family", max: "👑 Max", maxfamily: "👑👨‍👩‍👧 Max Family" };
// yearly = 12 months − 3% off
export function yearPrice(p: string) { return Math.round((PLAN_PRICE[p] || 0) * 12 * 0.97); }
export function planPriceByCur(cur: string, p: string): number {
  return cur === "usd" ? (PLAN_PRICE_USD[p] || 0) : cur === "cny" ? (PLAN_PRICE_CNY[p] || 0) : (PLAN_PRICE[p] || 0);
}
export function yearPriceByCur(cur: string, p: string): number {
  const n = planPriceByCur(cur, p) * 12 * 0.97;
  return cur === "usd" ? Math.round(n * 100) / 100 : Math.round(n);
}
export function fmtPrice(cur: string, amount: number): string {
  if (cur === "usd") return "US$" + amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (cur === "cny") return "¥" + amount.toLocaleString();
  return "฿" + amount.toLocaleString();
}
// B2B "Studio Partner Plan": always at least 15% above the matching individual plan,
// in every currency and cadence, by deliberate design — no volume discount, the premium
// is justified by dedicated account service (see prB2bPerk*), not a cheaper per-seat
// deal. Standard tracks Premium, Plus tracks Max, so a price change to either consumer
// tier keeps B2B correctly pegged automatically instead of needing a manual re-sync.
// Math.ceil (never round-to-nearest) is what guarantees the ≥15% floor survives rounding.
export const B2B_MULT = 1.15;
export function b2bBaseTier(tier: string) { return tier === "plus" ? "max" : "premium"; }
export function b2bPriceByCur(cur: string, tier: string): number {
  const n = planPriceByCur(cur, b2bBaseTier(tier)) * B2B_MULT;
  return cur === "usd" ? Math.ceil(n) - 0.01 : Math.ceil(n / 10) * 10;
}
export function b2bYearPriceByCur(cur: string, tier: string): number {
  const n = yearPriceByCur(cur, b2bBaseTier(tier)) * B2B_MULT;
  return cur === "usd" ? Math.ceil(n) - 0.01 : Math.ceil(n / 10) * 10;
}
export const YEAR_PLANS = ["premium", "max", "maxfamily"];   // tiers that offer a yearly option
/* How long a free trial runs. The founding-member trial (the first 100 signups
   ever — profiles.founding_member, set once at signup by the handle_new_user()
   trigger, see supabase-founding-member-trial-migration.sql) was three months;
   it is one month now. A trial is Premium-level and uncapped, so every trial
   day is real AI cost, and ninety of them per head does not pay for itself.
   Thirty is still four times what the competition offers.

   The length is NOT stored anywhere — effectivePlan() measures it from
   profiles.created_at on every read — so changing this number changes the
   trial for existing accounts too, not only new ones. At the time of the cut
   that moved three not-yet-paying founding accounts from trial to free. */
export const TRIAL_DAYS_FOUNDING = 30;   // the first 100 signups ever
export const TRIAL_DAYS_STANDARD = 7;    // everyone after them
export function trialLenDays(p) { return p && p.founding_member ? TRIAL_DAYS_FOUNDING : TRIAL_DAYS_STANDARD; }
// the live, authoritative plan for a profile row (admins = full; paid only while not expired)
export function effectivePlan(p) {
  if (!p) return "free";
  if (p.is_admin) return "maxfamily";
  if (p.plan && p.plan !== "free" && p.plan_until && new Date(p.plan_until).getTime() > Date.now()) return p.plan;
  if (p.created_at && (Date.now() - new Date(p.created_at).getTime()) < trialLenDays(p) * 24 * 60 * 60 * 1000) return "trial";
  return "free";
}
// days remaining in the trial (1–trialLenDays), or -1 if not in trial / expired
export function trialDaysLeft(p) {
  if (!p || !p.created_at) return -1;
  const elapsed = Date.now() - new Date(p.created_at).getTime();
  const left = trialLenDays(p) - elapsed / (24 * 60 * 60 * 1000);
  return left > 0 ? Math.ceil(left) : -1;
}

// short header badge per tier
export function planBadge(p) {
  return p === "maxfamily" ? { t: "👑 MAX FAMILY", c: "maxfam" }
    : p === "max" ? { t: "👑 MAX", c: "max" }
    : p === "family" ? { t: "👨‍👩‍👧 FAMILY", c: "fam" }
    : p === "premium" ? { t: "⭐ PRO", c: "" }
    : p === "trial" ? { t: "🎁 TRIAL", c: "trial" }
    : null;
}

/* ── Checkout modal — multi-gateway: Stripe (th+en), PromptPay (th), Alipay+WeChat (zh) ── */
export function CheckoutModal({ lang, checkout, payCfg, session, isAdmin, onClose, playUi }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [st, setSt] = useState("idle");   // idle · uploading · done · error · stripe-err
  const [cfg, setCfg] = useState(payCfg);
  const [savingCfg, setSavingCfg] = useState(false);
  const [pp, setPp] = useState(""); const [nm, setNm] = useState(""); const [bk, setBk] = useState("");
  const [aliQrField, setAliQrField] = useState(""); const [wxQrField, setWxQrField] = useState("");
  const [zhTab, setZhTab] = useState<"ali"|"wx">("ali"); // Chinese tab: alipay | wechat
  const zhFileRef = useRef(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const fileRef = useRef(null);
  // guards against a fast double-click/double-tap firing openStripe/onFile twice before
  // React re-renders with the disabled button — state (stripeLoading/st) alone isn't
  // enough since its updated value isn't visible to a second click that dispatches
  // before the first render commits; a ref updates synchronously so it closes that gap
  const submittingRef = useRef(false);
  const amountThb = checkout.amount;                        // always THB (for slip DB record)
  const cur = checkout.cur || CURRENCY_BY_LANG[lang] || "thb";
  const dispAmt = checkout.disp != null ? checkout.disp : amountThb;
  const planLabel = PLAN_LABEL[checkout.plan] || checkout.plan;
  const cnySt = checkout.cycle === "year" ? yearPriceByCur("cny", checkout.plan) : planPriceByCur("cny", checkout.plan);

  useEffect(() => {
    sb.from("app_settings").select("value").eq("key", "payment").maybeSingle()
      .then(({ data }) => { if (data && data.value) setCfg(data.value); }, () => {});
  }, []);

  const ppId   = cfg && cfg.promptpay;
  const aliQr  = (cfg && cfg.alipay_qr) || ALIPAY_QR;
  const wxQr   = (cfg && cfg.wechat_qr) || WECHAT_QR;
  const stripeOn = !!(cfg && cfg.stripe);

  const acct = (cfg && cfg.bank_account && String(cfg.bank_account).trim()) || "";
  const swift = (cfg && cfg.bank_swift && String(cfg.bank_swift).trim()) || "";

  /* Ways to pay that land straight in the owner's own account — no gateway
     between the buyer and the money. PromptPay is Thailand's instant rail, and
     the plain bank transfer is what everyone else uses (a Thai buyer reading
     the app in English can still use PromptPay, and an overseas buyer wires to
     the account/SWIFT). Both were previously Thai-only, which left the English
     edition with a card as its ONLY option. The Chinese pair are rendered by
     their own tabbed block further down. */
  const transferChans = [
    ...(ppId ? [{ k: "pp", ic: "🇹🇭", label: "PromptPay", method: "promptpay" }] : []),
    ...(acct ? [{ k: "bank", ic: "🏦", label: T("โอนเข้าบัญชี", "Bank transfer", "银行转账"), method: "banktransfer" }] : []),
  ];
  const channels = (lang === "th" || lang === "en") ? transferChans : [];
  const [chanKey, setChanKey] = useState("");
  const selChan = channels.find(c => c.k === chanKey) || channels[0] || null;

  const qr = useMemo(() => ppId ? promptPayQR(ppId, amountThb) : null, [ppId, amountThb]);
  const uid = session && session.user && session.user.id;

  async function openStripe() {
    if (!uid || stripeLoading || submittingRef.current) return;
    submittingRef.current = true;
    setStripeLoading(true);
    try {
      const res = await fetch(SUPABASE_URL + "/functions/v1/stripe-checkout", {
        method: "POST",
        headers: { ...apiHeaders(), "Content-Type": "application/json" },
        // `expect` is the price on the card the buyer just clicked. The server
        // still computes the real amount itself and never trusts this number —
        // it only compares, and refuses the sale if the two disagree. That is
        // what stops the app and the checkout function drifting apart into
        // charging a price nobody was ever shown.
        body: JSON.stringify({ plan: checkout.plan, cycle: checkout.cycle || "month", cur, expect: dispAmt }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "no url");
      window.location.href = data.url;
    } catch { setSt("stripe-err"); setStripeLoading(false); submittingRef.current = false; }
  }

  async function onFile(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f || !uid || !selChan || submittingRef.current) return;
    if (f.size > 6 * 1024 * 1024) { setSt("error"); return; }
    submittingRef.current = true;
    setSt("uploading");
    try {
      const ext = ((f.type.split("/")[1]) || "jpg").replace("jpeg", "jpg");
      const path = `${uid}/${Date.now()}.${ext}`;
      const up = await sb.storage.from("slips").upload(path, f, { contentType: f.type, upsert: false });
      if (up.error) throw up.error;
      const meta = (session.user.user_metadata) || {};
      const ins = await sb.from("payments").insert({
        user_id: uid, email: session.user.email || null, full_name: meta.full_name || meta.name || null,
        plan: checkout.plan, amount: amountThb, method: selChan.method, slip_path: path, status: "pending", days: checkout.days || 30,
      });
      if (ins.error) throw ins.error;
      setSt("done"); playUi("levelup");
    } catch { setSt("error"); submittingRef.current = false; }
  }

  async function saveCfgInline() {
    if (!pp.trim()) return;
    setSavingCfg(true);
    const value = {
      ...cfg, promptpay: pp.trim(), name: nm.trim(), bank: bk.trim(),
      ...(aliQrField.trim() ? { alipay_qr: aliQrField.trim() } : {}),
      ...(wxQrField.trim() ? { wechat_qr: wxQrField.trim() } : {}),
    };
    // admin_set_app_setting (not a raw client upsert) — this row controls where every
    // paying customer's PromptPay/Alipay/WeChat payment gets sent app-wide, so it goes
    // through the same admin-gated RPC path already used for auto_teach/broadcast
    // rather than relying solely on app_settings' table-level RLS.
    const { error } = await sb.rpc("admin_set_app_setting", { p_key: "payment", p_value: value });
    setSavingCfg(false);
    if (!error) { setCfg(value); playUi("levelup"); }
  }

  const showStripeBtn = lang === "th" || lang === "en";
  const hasQrChannel = channels.length > 0;
  const nothingConfigured = !showStripeBtn && !hasQrChannel && lang !== "zh";
  // Stripe is the ONLY rail in English until a transfer account is filled in, so
  // say so where the owner will actually see it rather than leaving a silent gap.
  const transferMissing = lang === "en" && !hasQrChannel;

  return (
    <div className="setov" onClick={onClose}>
      <div className="setcard pricing" onClick={e => e.stopPropagation()}>
        <div className="sethdr"><span>💳 {T("ชำระเงิน", "Checkout", "结账")}</span><button className="cbtn" onClick={onClose}>✕</button></div>
        <div className="setbody">
          {st === "done" ? (
            <div className="payok">
              <div style={{ fontSize: 46 }}>✅</div>
              <div className="payok-h">{T("ได้รับสลิปแล้ว!", "Slip received!", "已收到凭证！")}</div>
              <p className="pr-sub">{T("กำลังตรวจสอบการชำระเงิน — ระบบจะเปิดสิทธิ์ให้อัตโนมัติเมื่อตรวจผ่าน (ปกติไม่เกิน 24 ชม.)", "We're verifying your payment — your plan unlocks automatically once approved (usually within 24h).", "正在核对付款，通过后自动开通（通常24小时内）。")}</p>
              <button className="songbtn go" style={{ width: "100%" }} onClick={onClose}>{T("เสร็จสิ้น", "Done", "完成")}</button>
            </div>
          ) : (
            <>
              {/* ── price summary ── */}
              <div className="paysum">
                <span>{planLabel}{checkout.cycle === "year" ? " · " + T("รายปี", "yearly", "年付") : ""}</span>
                <b className="prtier-price">{fmtPrice(cur, dispAmt)}<small>/{checkout.cycle === "year" ? T("ปี", "yr", "年") : T("เดือน", "mo", "月")}</small></b>
              </div>

              {/* ── Chinese: Alipay + WeChat QR (hardcoded, no config needed) ── */}
              {lang === "zh" && (
                <>
                  <div className="paychans">
                    <button className={`paychanbtn${zhTab === "ali" ? " on" : ""}`} onClick={() => { playUi("click"); setZhTab("ali"); }}>
                      <span className="paychan-ic">🔵</span> Alipay 支付宝
                    </button>
                    <button className={`paychanbtn${zhTab === "wx" ? " on" : ""}`} onClick={() => { playUi("click"); setZhTab("wx"); }}>
                      <span className="paychan-ic">🟢</span> WeChat 微信
                    </button>
                  </div>
                  {/* aliQr/wxQr — the ADMIN-CONFIGURED image, falling back to the
                      bundled one. This used to render the bundled constants
                      directly, so replacing a QR from the admin panel changed
                      nothing on the page it was supposed to change. */}
                  <PayQrImg src={zhTab === "wx" ? wxQr : aliQr} alt={zhTab === "wx" ? "WeChat Pay QR" : "Alipay QR"} lang={lang} />
                  <p className="pr-sub" style={{ textAlign: "center" }}>
                    {zhTab === "wx"
                      ? `打开微信 → 扫一扫 → 支付 ¥${cnySt.toLocaleString()}`
                      : `打开支付宝 → 扫一扫 → 支付 ¥${cnySt.toLocaleString()}`}
                  </p>
                  <p className="pr-sub" style={{ textAlign: "center", marginTop: 0 }}>付款后上传截图以确认订单</p>
                  <button className="songbtn go" style={{ width: "100%" }} disabled={st === "uploading"} onClick={() => zhFileRef.current && zhFileRef.current.click()}>
                    {st === "uploading" ? "⏳ 上传中..." : "📤 上传付款截图"}
                  </button>
                  {st === "error" && <div className="aicreate-err">上传失败，请重试</div>}
                  <input ref={zhFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFile} />
                </>
              )}

              {/* ── Stripe button (Thai + English) ── */}
              {showStripeBtn && (
                <>
                  <button className="songbtn go" style={{ width: "100%", marginBottom: 6 }} disabled={stripeLoading} onClick={openStripe}>
                    {stripeLoading ? "⏳ " + T("กำลังเปิดหน้าชำระเงินปลอดภัย...", "Opening secure checkout...", "正在打开安全支付页...") : "💳 " + T("จ่ายด้วยบัตร (รองรับทั่วโลก)", "Pay by card — worldwide", "银行卡支付（支持全球）")}
                  </button>
                  {st === "stripe-err" && <div className="aicreate-err">{T("ไม่สามารถเชื่อมต่อ Stripe ได้ ลองใหม่หรือใช้ QR", "Stripe unavailable — try again or use QR below", "Stripe 连接失败，请重试或用下方二维码")}</div>}
                  {hasQrChannel && <div className="aiNotice">🌍 {T("หรือสแกน QR ด้านล่าง", "Or scan a QR below", "或扫描下方二维码")}</div>}
                </>
              )}

              {/* ── pick a transfer rail, when more than one is set up ── */}
              {channels.length > 1 && (
                <div className="paychans">
                  {channels.map(c => (
                    <button key={c.k} className={`paychanbtn${selChan && selChan.k === c.k ? " on" : ""}`}
                      onClick={() => { playUi("click"); setChanKey(c.k); }}>
                      <span className="paychan-ic">{c.ic}</span> {c.label}
                    </button>
                  ))}
                </div>
              )}

              {/* ── direct bank transfer — the owner's own account, any country ── */}
              {selChan && selChan.k === "bank" && (
                <>
                  <div className="payinfo">
                    {cfg && cfg.bank && <div>🏦 {T("ธนาคาร", "Bank", "银行")}: <b>{cfg.bank}</b></div>}
                    {cfg && cfg.name && <div>👤 {T("ชื่อบัญชี", "Account name", "账户名")}: <b>{cfg.name}</b></div>}
                    <div>#️⃣ {T("เลขที่บัญชี", "Account number", "账号")}: <b>{acct}</b></div>
                    {swift && <div>🌐 SWIFT / BIC: <b>{swift}</b></div>}
                    <div>💰 {T("ยอดที่ต้องโอน", "Amount to transfer", "转账金额")}: <b>{fmtPrice(cur, dispAmt)}</b>
                      {cur !== "thb" && <> · {T("หรือ", "or", "或")} <b>{fmtPrice("thb", amountThb)}</b></>}</div>
                  </div>
                  <p className="pr-sub">{T(
                    "โอนตามยอดด้านบนเข้าบัญชีนี้ แล้วอัปโหลดสลิปเพื่อยืนยัน",
                    "Transfer the amount above to this account, then upload your transfer receipt to confirm.",
                    "请按上述金额转账至该账户，然后上传转账凭证。")}</p>
                  <button className="songbtn go" style={{ width: "100%" }} disabled={st === "uploading"} onClick={() => fileRef.current && fileRef.current.click()}>
                    {st === "uploading" ? "⏳ " + T("กำลังอัป...", "Uploading...", "上传中...") : "📤 " + T("อัปโหลดสลิป", "Upload receipt", "上传凭证")}
                  </button>
                  {st === "error" && <div className="aicreate-err">{T("อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง", "Upload failed, try again", "上传失败，请重试")}</div>}
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFile} />
                </>
              )}

              {/* ── PromptPay ── */}
              {selChan && selChan.k === "pp" && (
                <>
                  {qr ? <img className="payqr" src={qr} alt="PromptPay QR" /> : <div className="aicreate-err">{T("สร้าง QR ไม่ได้", "Couldn't make QR", "无法生成二维码")}</div>}
                  <div className="payinfo">
                    <div>📱 PromptPay: <b>{ppId}</b></div>
                    {cfg && cfg.name && <div>👤 {cfg.name}</div>}
                    {cfg && cfg.bank && <div>🏦 {cfg.bank}</div>}
                  </div>
                  <p className="pr-sub">{T("สแกน QR ด้วยแอปธนาคาร โอนตามยอด แล้วอัปโหลดสลิปเพื่อยืนยัน", "Scan with your banking app, pay the exact amount, then upload the slip.", "用银行App扫码付款，然后上传凭证。")}</p>
                  <button className="songbtn go" style={{ width: "100%" }} disabled={st === "uploading"} onClick={() => fileRef.current && fileRef.current.click()}>
                    {st === "uploading" ? "⏳ " + T("กำลังอัป...", "Uploading...", "上传中...") : "📤 " + T("อัปโหลดสลิป", "Upload slip", "上传凭证")}
                  </button>
                  {st === "error" && <div className="aicreate-err">{T("อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง", "Upload failed, try again", "上传失败，请重试")}</div>}
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFile} />
                </>
              )}

              {/* ── Admin config (Thai/English only, when nothing is configured) ── */}
              {nothingConfigured && isAdmin && (
                <div className="adminpay-cfg" style={{ marginBottom: 0 }}>
                  <div className="admstu-nm" style={{ fontSize: 14 }}>⚙️ {T("ตั้งค่าช่องทางรับเงิน (แอดมิน)", "Configure payment channels (admin)", "配置收款渠道（管理员）")}</div>
                  <input value={pp} onChange={e => setPp(e.target.value)} placeholder={T("เบอร์ PromptPay หรือเลขผู้เสียภาษี", "PromptPay number or tax ID", "PromptPay 号码或税号")} inputMode="numeric" />
                  <input value={nm} onChange={e => setNm(e.target.value)} placeholder={T("ชื่อบัญชี / ร้าน", "Account / shop name", "账户/店名")} />
                  <input value={bk} onChange={e => setBk(e.target.value)} placeholder={T("ธนาคาร", "Bank (optional)", "银行（可选）")} />
                  <button className="songbtn go" style={{ width: "100%", marginTop: 9 }} disabled={savingCfg || !pp.trim()} onClick={saveCfgInline}>
                    {savingCfg ? "⏳ " + T("กำลังบันทึก…", "Saving…", "保存中…") : "💾 " + T("บันทึก", "Save", "保存")}
                  </button>
                </div>
              )}

              {transferMissing && isAdmin && (
                <div className="aiNotice">⚙️ {T(
                  "ยังไม่ได้ตั้งค่าเลขบัญชีสำหรับโอนตรง — เพิ่มได้ที่ แอดมิน › ตั้งค่าช่องทางรับเงิน",
                  "No transfer account configured yet — add one in Admin › Payment channel settings and buyers get a direct-transfer option beside the card.",
                  "尚未配置转账账户 — 请在管理员 › 收款渠道设置中添加。")}</div>
              )}

              {nothingConfigured && !isAdmin && (
                <div className="aicreate-err">{T("ร้านกำลังตั้งค่าการรับเงิน ลองใหม่อีกครั้งภายหลัง หรือทักแอดมินได้เลย", "Payment is being set up — please try again shortly or contact us.", "收款正在设置中，请稍后再试或联系我们。")}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── School Plan Pro (B2B) checkout — real payment page behind the pricing modal's
   "Contact us" CTA. Two steps: collect institution/seats/cycle, then pay. The amount
   shown here is a client-side preview only (same b2bPriceByCur math the pricing cards
   already use) — the authoritative amount is recomputed server-side by
   school_submit_payment_request() the moment a channel is chosen, so nothing typed
   here can under-pay. Reuses the exact same QR/slip-upload machinery as CheckoutModal
   (promptPayQR, ALIPAY_QR/WECHAT_QR, the "slips" storage bucket) for visual and
   behavioral consistency, but writes to a separate school_payment_requests table
   rather than touching the existing consumer `payments` table at all. ── */
export function SchoolCheckoutModal({ lang, schoolCheckout, payCfg, session, onClose, playUi }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const tier = schoolCheckout.tier === "plus" ? "school_plus" : "school_standard";
  const tierLabel = schoolCheckout.tier === "plus" ? "Plus" : "Standard";
  const cur = CURRENCY_BY_LANG[lang] || "thb";
  const uid = session && session.user && session.user.id;

  const [step, setStep] = useState("details"); // details | pay
  const [instName, setInstName] = useState("");
  const [seats, setSeats] = useState(15);
  const [cycle, setCycle] = useState("month");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);

  const [reqId, setReqId] = useState(null);
  const [amount, setAmount] = useState(0);       // THB, authoritative once set (from the RPC response)
  const [activeChan, setActiveChan] = useState(null); // "promptpay" | "alipay" | "wechat" once chosen
  const [zhTab, setZhTab] = useState<"alipay"|"wechat">("alipay");
  const [st, setSt] = useState("idle");          // idle · uploading · done · error
  const fileRef = useRef(null);
  // ref-based guards (not state) against a fast double-click firing submitRequest or
  // onFile twice before React re-renders with the disabled button — see CheckoutModal's
  // submittingRef for why a ref is needed here instead of relying on busy/st alone
  const submitRef = useRef(false);
  const uploadRef = useRef(false);

  const unitPreview = cycle === "year" ? b2bYearPriceByCur(cur, schoolCheckout.tier) : b2bPriceByCur(cur, schoolCheckout.tier);
  const totalPreview = unitPreview * (Number(seats) || 0);

  const ppId = payCfg && payCfg.promptpay;
  const aliQr = (payCfg && payCfg.alipay_qr) || ALIPAY_QR;
  const wxQr = (payCfg && payCfg.wechat_qr) || WECHAT_QR;
  const qr = useMemo(() => (activeChan === "promptpay" && ppId && amount) ? promptPayQR(ppId, amount) : null, [activeChan, ppId, amount]);

  function continueToPay() {
    if (!instName.trim()) { setErr(T("กรอกชื่อสถาบันก่อน", "Enter an institution name", "请输入机构名称")); return; }
    if ((Number(seats) || 0) < 15) { setErr(T("ขั้นต่ำ 15 ที่นั่ง", "Minimum 15 seats", "最低15个席位")); return; }
    setErr(""); setStep("pay");
  }

  const [submittedMethod, setSubmittedMethod] = useState(null);

  // Idempotent by method: if this exact method already has a submitted request (e.g.
  // the Stripe redirect step failed on a flaky connection and the user retries the
  // same button), reuse it instead of creating a second school_payment_requests row.
  // Switching to a DIFFERENT method after a failure still submits a fresh one — the
  // row's `method` column is set at creation and not worth reconciling for what should
  // be a rare path, staff can tell from context which one the buyer actually paid.
  async function submitRequest(method) {
    if (reqId && submittedMethod === method) return { id: reqId, amount };
    if (!uid || busy || submitRef.current) return null;
    submitRef.current = true;
    setBusy(true); setErr("");
    const { data, error } = await sb.rpc("school_submit_payment_request", {
      p_institution_name: instName.trim(), p_tier: tier, p_seats: Number(seats), p_cycle: cycle, p_method: method,
    });
    setBusy(false);
    if (error) { setErr(error.message || T("ส่งคำขอไม่สำเร็จ ลองใหม่อีกครั้ง", "Couldn't submit — try again", "提交失败，请重试")); submitRef.current = false; return null; }
    setReqId(data.id); setAmount(data.amount); setSubmittedMethod(method);
    return data;
  }

  async function payWithStripe() {
    if (stripeLoading) return;
    const data = await submitRequest("stripe");
    if (!data) return;
    setStripeLoading(true);
    try {
      const res = await fetch(SUPABASE_URL + "/functions/v1/school-stripe-checkout", {
        method: "POST",
        headers: { ...apiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: data.id }),
      });
      const j = await res.json();
      if (!res.ok || !j.url) throw new Error(j.error || "no url");
      window.location.href = j.url;
    } catch { setErr(T("เชื่อมต่อ Stripe ไม่ได้ ลองใหม่หรือใช้ QR", "Stripe unavailable — try again or use QR", "Stripe 连接失败，请重试或用二维码")); setStripeLoading(false); }
  }

  async function payWithQr(method) {
    const data = await submitRequest(method);
    if (!data) return;
    setActiveChan(method);
  }

  async function onFile(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f || !uid || !reqId || uploadRef.current) return;
    if (f.size > 6 * 1024 * 1024) { setSt("error"); return; }
    uploadRef.current = true;
    setSt("uploading");
    try {
      const ext = ((f.type.split("/")[1]) || "jpg").replace("jpeg", "jpg");
      const path = `${uid}/school-${Date.now()}.${ext}`;
      const up = await sb.storage.from("slips").upload(path, f, { contentType: f.type, upsert: false });
      if (up.error) throw up.error;
      const { error } = await sb.rpc("school_attach_slip", { p_id: reqId, p_slip_path: path });
      if (error) throw error;
      setSt("done"); playUi("levelup");
    } catch { setSt("error"); uploadRef.current = false; }
  }

  const showStripeBtn = lang === "th" || lang === "en";
  const showPromptPay = lang === "th" && !!ppId;

  return (
    <div className="setov" onClick={onClose}>
      <div className="setcard pricing" onClick={e => e.stopPropagation()}>
        <div className="sethdr"><span>🏫 {T("สมัคร School Plan", "School Plan sign-up", "学校方案申请")} — {tierLabel}</span><button className="cbtn" onClick={onClose}>✕</button></div>
        <div className="setbody">
          {st === "done" ? (
            <div className="payok">
              <div style={{ fontSize: 46 }}>✅</div>
              <div className="payok-h">{T("ได้รับสลิปแล้ว!", "Slip received!", "已收到凭证！")}</div>
              <p className="pr-sub">{T("ทีมงานจะตรวจสอบและติดต่อกลับเพื่อเปิดใช้งานภายใน 24 ชม.", "Our team will verify and reach out to activate your school within 24h.", "我们将核实并在24小时内联系您开通账户。")}</p>
              <button className="songbtn go" style={{ width: "100%" }} onClick={onClose}>{T("เสร็จสิ้น", "Done", "完成")}</button>
            </div>
          ) : step === "details" ? (
            <>
              <p className="pr-sub">{T("กรอกข้อมูลสถาบันเพื่อคำนวณยอดชำระ", "Tell us about your institution to calculate the total", "填写机构信息以计算总额")}</p>
              <input className="aicreate-in" style={{ marginBottom: 10 }} value={instName} onChange={e => setInstName(e.target.value)} placeholder={T("ชื่อสถาบัน/โรงเรียน", "Institution / school name", "机构/学校名称")} />
              <div className="admmg-row" style={{ marginBottom: 10 }}>
                <input className="admmg-days" style={{ width: 80 }} type="number" min={15} value={seats} onChange={e => setSeats(e.target.value)} />
                <span className="admmg-d">{T("ที่นั่ง (ขั้นต่ำ 15)", "seats (min. 15)", "个席位（最低15）")}</span>
              </div>
              <div className="billtoggle" style={{ marginBottom: 14 }}>
                <button className={`billtog${cycle === "month" ? " on" : ""}`} onClick={() => setCycle("month")}>{T("รายเดือน", "Monthly", "按月")}</button>
                <button className={`billtog${cycle === "year" ? " on" : ""}`} onClick={() => setCycle("year")}>{T("รายปี", "Yearly", "按年")}</button>
              </div>
              <div className="paysum">
                <span>{tierLabel} × {Number(seats) || 0} {T("ที่นั่ง", "seats", "席位")}</span>
                <b className="prtier-price">{fmtPrice(cur, totalPreview)}<small>/{cycle === "year" ? T("ปี", "yr", "年") : T("เดือน", "mo", "月")}</small></b>
              </div>
              {err && <div className="aicreate-err">{err}</div>}
              <button className="songbtn go" style={{ width: "100%", marginTop: 10 }} onClick={continueToPay}>{T("ถัดไป: เลือกวิธีชำระเงิน", "Next: choose payment method", "下一步：选择付款方式")}</button>
            </>
          ) : (
            <>
              <div className="paysum">
                <span>{instName} · {tierLabel} × {seats}</span>
                <b className="prtier-price">{fmtPrice(cur, totalPreview)}<small>/{cycle === "year" ? T("ปี", "yr", "年") : T("เดือน", "mo", "月")}</small></b>
              </div>

              {!activeChan && (<>
                {showStripeBtn && (
                  <button className="songbtn go" style={{ width: "100%", marginBottom: 6 }} disabled={busy || stripeLoading} onClick={payWithStripe}>
                    {stripeLoading ? "⏳ " + T("กำลังเปิดหน้าชำระเงินปลอดภัย...", "Opening secure checkout...", "正在打开安全支付页...") : "💳 " + T("จ่ายด้วยบัตร (รองรับทั่วโลก)", "Pay by card — worldwide", "银行卡支付（支持全球）")}
                  </button>
                )}
                {showPromptPay && (
                  <button className="songbtn go" style={{ width: "100%", marginBottom: 6 }} disabled={busy} onClick={() => payWithQr("promptpay")}>🇹🇭 {T("จ่ายผ่าน PromptPay", "Pay via PromptPay", "PromptPay 付款")}</button>
                )}
                {lang === "zh" && (<>
                  <button className="songbtn go" style={{ width: "100%", marginBottom: 6 }} disabled={busy} onClick={() => { setZhTab("alipay"); payWithQr("alipay"); }}>🔵 {T("จ่ายผ่าน Alipay", "Pay via Alipay", "支付宝付款")}</button>
                  <button className="songbtn go" style={{ width: "100%", marginBottom: 6 }} disabled={busy} onClick={() => { setZhTab("wechat"); payWithQr("wechat"); }}>🟢 {T("จ่ายผ่าน WeChat", "Pay via WeChat", "微信付款")}</button>
                </>)}
                {err && <div className="aicreate-err">{err}</div>}
                <button className="songbtn ghost" style={{ width: "100%", marginTop: 4 }} onClick={() => setStep("details")}>‹ {T("กลับ", "Back", "返回")}</button>
              </>)}

              {activeChan === "promptpay" && (
                <>
                  {qr ? <img className="payqr" src={qr} alt="PromptPay QR" /> : <div className="aicreate-err">{T("สร้าง QR ไม่ได้", "Couldn't make QR", "无法生成二维码")}</div>}
                  <div className="payinfo">
                    <div>📱 PromptPay: <b>{ppId}</b></div>
                    {payCfg && payCfg.name && <div>👤 {payCfg.name}</div>}
                  </div>
                  <p className="pr-sub">{T("สแกน QR ด้วยแอปธนาคาร โอนตามยอด แล้วอัปโหลดสลิปเพื่อยืนยัน", "Scan with your banking app, pay the exact amount, then upload the slip.", "用银行App扫码付款，然后上传凭证。")}</p>
                  <button className="songbtn go" style={{ width: "100%" }} disabled={st === "uploading"} onClick={() => fileRef.current && fileRef.current.click()}>
                    {st === "uploading" ? "⏳ " + T("กำลังอัป...", "Uploading...", "上传中...") : "📤 " + T("อัปโหลดสลิป", "Upload slip", "上传凭证")}
                  </button>
                  {st === "error" && <div className="aicreate-err">{T("อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง", "Upload failed, try again", "上传失败，请重试")}</div>}
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFile} />
                </>
              )}

              {(activeChan === "alipay" || activeChan === "wechat") && (
                <>
                  <PayQrImg src={activeChan === "wechat" ? wxQr : aliQr} alt={activeChan === "wechat" ? "WeChat Pay QR" : "Alipay QR"} lang={lang} />
                  <p className="pr-sub" style={{ textAlign: "center" }}>
                    {activeChan === "wechat"
                      ? `打开微信 → 扫一扫 → 支付 ¥${amount.toLocaleString()}`
                      : `打开支付宝 → 扫一扫 → 支付 ¥${amount.toLocaleString()}`}
                  </p>
                  <p className="pr-sub" style={{ textAlign: "center", marginTop: 0 }}>付款后上传截图以确认订单</p>
                  <button className="songbtn go" style={{ width: "100%" }} disabled={st === "uploading"} onClick={() => fileRef.current && fileRef.current.click()}>
                    {st === "uploading" ? "⏳ 上传中..." : "📤 上传付款截图"}
                  </button>
                  {st === "error" && <div className="aicreate-err">上传失败，请重试</div>}
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFile} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Currency purchases (coins/gems bought with real money) — connects the
   existing gamification currency to the same PromptPay/Alipay/WeChat
   slip-upload + admin-review pipeline CheckoutModal already uses, rather
   than inventing a new payment mechanism. Deliberately QR/slip-only for
   now, not Stripe: unlike the subscription and School Plan Pro flows
   (whose stripe-checkout/school-stripe-checkout edge functions this repo
   never had source for either, per those features' own commit history),
   a currency-purchase Stripe path would mean writing an edge function
   fully blind AND with no way to test it in this sandbox (no Stripe keys,
   no deploy access) - too much risk for a payment-processing code path to
   ship unverified. QR/slip is fully buildable and testable end-to-end
   here; Stripe support is a clean, separately-scoped follow-up.

   Prices are display-only, same principle as SchoolCheckoutModal's
   client-side preview — the authoritative price for a given package
   always comes from submit_currency_purchase() server-side (see the
   accompanying migration's _currency_package_price()), so nothing typed
   or tampered with in the browser can under-pay. Crediting itself only
   ever happens via admin_review_currency_payment() doing an ADDITIVE
   `coins = coins + amount` update after a human approves the slip — never
   a client-writable absolute value, which is exactly the class of hole
   the security-hardening migration's exp/coins clamp trigger exists to
   catch if it were ever attempted directly. */
export const COIN_PACKAGES = [
  { coins: 500,  thb: 49 },
  { coins: 1200, thb: 99,  bonus: true },
  { coins: 3000, thb: 199, bonus: true },
];
export const GEM_PACKAGES = [
  { gems: 50,  thb: 59 },
  { gems: 120, thb: 129, bonus: true },
  { gems: 300, thb: 299, bonus: true },
];

export function BuyCurrencyModal({ lang, payCfg, session, onClose, playUi }) {
  const T = (th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;
  const [currencyType, setCurrencyType] = useState<"coins"|"gems">("coins");
  const [pkgIdx, setPkgIdx] = useState(0);
  const [st, setSt] = useState("idle");   // idle · submitting · uploading · done · error
  const [reqId, setReqId] = useState(null);
  const [price, setPrice] = useState(null);       // THB, authoritative once set (from the RPC response)
  const [chanKey, setChanKey] = useState("");      // "" | "promptpay" | "alipay" | "wechat" once chosen
  const [zhTab, setZhTab] = useState<"alipay"|"wechat">("alipay");
  const fileRef = useRef(null);
  // ref-guards against a fast double-click firing chooseChannel/onFile twice before
  // React re-renders with a disabled button — same reasoning as CheckoutModal's
  // submittingRef / SchoolCheckoutModal's submitRef+uploadRef.
  const submitRef = useRef(false);
  const uploadRef = useRef(false);
  const uid = session && session.user && session.user.id;

  const packages = currencyType === "coins" ? COIN_PACKAGES : GEM_PACKAGES;
  const pkg = packages[pkgIdx] || packages[0];

  function switchType(t) {
    if (t === currencyType) return;
    setCurrencyType(t); setPkgIdx(0); setReqId(null); setPrice(null); setChanKey("");
  }

  const ppId = payCfg && payCfg.promptpay;
  const aliQr = (payCfg && payCfg.alipay_qr) || ALIPAY_QR;
  const wxQr = (payCfg && payCfg.wechat_qr) || WECHAT_QR;
  const acct = (payCfg && payCfg.bank_account && String(payCfg.bank_account).trim()) || "";
  const swift = (payCfg && payCfg.bank_swift && String(payCfg.bank_swift).trim()) || "";
  // Same rails as the plan checkout. These were Thai/Chinese only, so the coin
  // and gem shop told English customers "no payment channel configured for this
  // language" — i.e. they could not spend money here at all.
  const channels = [
    ...(lang === "zh" ? [{ k: "alipay", ic: "🔵", label: "Alipay 支付宝" }] : []),
    ...(lang === "zh" ? [{ k: "wechat", ic: "🟢", label: "WeChat 微信" }] : []),
    ...((lang === "th" || lang === "en") && ppId ? [{ k: "promptpay", ic: "🇹🇭", label: "PromptPay" }] : []),
    ...((lang === "th" || lang === "en") && acct ? [{ k: "banktransfer", ic: "🏦", label: T("โอนเข้าบัญชี", "Bank transfer", "银行转账") }] : []),
  ];
  const qr = useMemo(() => (chanKey === "promptpay" && ppId && price) ? promptPayQR(ppId, price) : null, [chanKey, ppId, price]);

  async function chooseChannel(k) {
    if (!uid || st === "submitting" || submitRef.current) return;
    submitRef.current = true;
    setSt("submitting");
    const amount = currencyType === "coins" ? pkg.coins : pkg.gems;
    const { data, error } = await sb.rpc("submit_currency_purchase", { p_currency_type: currencyType, p_amount: amount, p_method: k });
    submitRef.current = false;
    if (error || !data) { setSt("error"); return; }
    setReqId(data.id); setPrice(data.price); setChanKey(k); setSt("idle");
    if (k === "alipay" || k === "wechat") setZhTab(k);
  }

  async function onFile(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = "";
    if (!f || !uid || !reqId || uploadRef.current) return;
    if (f.size > 6 * 1024 * 1024) { setSt("error"); return; }
    uploadRef.current = true;
    setSt("uploading");
    try {
      const ext = ((f.type.split("/")[1]) || "jpg").replace("jpeg", "jpg");
      const path = `${uid}/coins-${Date.now()}.${ext}`;
      const up = await sb.storage.from("slips").upload(path, f, { contentType: f.type, upsert: false });
      if (up.error) throw up.error;
      const { error } = await sb.rpc("attach_currency_purchase_slip", { p_id: reqId, p_slip_path: path });
      if (error) throw error;
      setSt("done"); playUi("levelup");
    } catch (e) { setSt("error"); uploadRef.current = false; }
  }

  const cur = CURRENCY_BY_LANG[lang] || "thb";
  const showQrPicker = channels.length > 0 && !chanKey;

  return (
    <div className="setov" onClick={onClose}>
      <div className="setcard pricing" onClick={e => e.stopPropagation()}>
        <div className="sethdr"><span>🪙 {T("ซื้อเหรียญ/เพชร", "Buy Coins/Gems", "购买金币/宝石")}</span><button className="cbtn" onClick={onClose}>✕</button></div>
        <div className="setbody">
          {st === "done" ? (
            <div className="payok">
              <div style={{ fontSize: 46 }}>✅</div>
              <div className="payok-h">{T("ได้รับสลิปแล้ว!", "Slip received!", "已收到凭证！")}</div>
              <p className="pr-sub">{T("กำลังตรวจสอบการชำระเงิน — เหรียญ/เพชรจะเข้าบัญชีอัตโนมัติเมื่อตรวจผ่าน (ปกติไม่เกิน 24 ชม.)", "We're verifying your payment — your coins/gems land automatically once approved (usually within 24h).", "正在核对付款，通过后自动到账（通常24小时内）。")}</p>
              <button className="songbtn go" style={{ width: "100%" }} onClick={onClose}>{T("เสร็จสิ้น", "Done", "完成")}</button>
            </div>
          ) : (
            <>
              {!chanKey && (
                <>
                  <div className="billtoggle" style={{ marginBottom: 14 }}>
                    <button className={`billtog${currencyType === "coins" ? " on" : ""}`} onClick={() => switchType("coins")}>🪙 {T("เหรียญ", "Coins", "金币")}</button>
                    <button className={`billtog${currencyType === "gems" ? " on" : ""}`} onClick={() => switchType("gems")}>💎 {T("เพชร", "Gems", "宝石")}</button>
                  </div>
                  <div className="genrefilters" style={{ marginBottom: 14 }}>
                    {packages.map((p, i) => (
                      <button key={i} className={"genrechip" + (pkgIdx === i ? " active" : "")} onClick={() => setPkgIdx(i)}>
                        {currencyType === "coins" ? "🪙" : "💎"} {(currencyType === "coins" ? p.coins : p.gems).toLocaleString()}
                        {p.bonus ? " ✨" : ""} · {fmtPrice(cur, p.thb)}
                      </button>
                    ))}
                  </div>
                  <div className="paysum">
                    <span>{currencyType === "coins" ? "🪙" : "💎"} {(currencyType === "coins" ? pkg.coins : pkg.gems).toLocaleString()} {currencyType === "coins" ? T("เหรียญ", "Coins", "金币") : T("เพชร", "Gems", "宝石")}</span>
                    <b className="prtier-price">{fmtPrice(cur, pkg.thb)}</b>
                  </div>
                </>
              )}

              {showQrPicker && (
                <>
                  {channels.map(c => (
                    <button key={c.k} className="songbtn go" style={{ width: "100%", marginBottom: 6 }} disabled={st === "submitting"} onClick={() => chooseChannel(c.k)}>
                      {st === "submitting" ? "⏳ " + T("กำลังเตรียม...", "Preparing...", "准备中...") : c.ic + " " + T("จ่ายผ่าน ", "Pay via ", "通过 ") + c.label}
                    </button>
                  ))}
                  {st === "error" && <div className="aicreate-err">{T("ไม่สามารถสร้างคำขอได้ ลองใหม่อีกครั้ง", "Couldn't start the request — try again", "无法创建请求，请重试")}</div>}
                </>
              )}
              {!channels.length && !chanKey && (
                <div className="aicreate-err">{T("ยังไม่ได้ตั้งค่าช่องทางรับเงินสำหรับภาษานี้", "No payment channel configured for this language yet", "此语言尚未配置收款渠道")}</div>
              )}

              {chanKey === "banktransfer" && (
                <>
                  <div className="payinfo">
                    {payCfg && payCfg.bank && <div>🏦 {T("ธนาคาร", "Bank", "银行")}: <b>{payCfg.bank}</b></div>}
                    {payCfg && payCfg.name && <div>👤 {T("ชื่อบัญชี", "Account name", "账户名")}: <b>{payCfg.name}</b></div>}
                    <div>#️⃣ {T("เลขที่บัญชี", "Account number", "账号")}: <b>{acct}</b></div>
                    {swift && <div>🌐 SWIFT / BIC: <b>{swift}</b></div>}
                    {price ? <div>💰 {T("ยอดที่ต้องโอน", "Amount to transfer", "转账金额")}: <b>{fmtPrice("thb", price)}</b></div> : null}
                  </div>
                  <p className="pr-sub">{T(
                    "โอนตามยอดด้านบนเข้าบัญชีนี้ แล้วอัปโหลดสลิปเพื่อยืนยัน",
                    "Transfer the amount above to this account, then upload your transfer receipt to confirm.",
                    "请按上述金额转账至该账户，然后上传转账凭证。")}</p>
                  <button className="songbtn go" style={{ width: "100%" }} disabled={st === "uploading"} onClick={() => fileRef.current && fileRef.current.click()}>
                    {st === "uploading" ? "⏳ " + T("กำลังอัป...", "Uploading...", "上传中...") : "📤 " + T("อัปโหลดสลิป", "Upload receipt", "上传凭证")}
                  </button>
                  {st === "error" && <div className="aicreate-err">{T("อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง", "Upload failed, try again", "上传失败，请重试")}</div>}
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFile} />
                </>
              )}

              {chanKey === "promptpay" && (
                <>
                  {qr ? <img className="payqr" src={qr} alt="PromptPay QR" /> : <div className="aicreate-err">{T("สร้าง QR ไม่ได้", "Couldn't make QR", "无法生成二维码")}</div>}
                  <div className="payinfo">
                    <div>📱 PromptPay: <b>{ppId}</b></div>
                    {payCfg && payCfg.name && <div>👤 {payCfg.name}</div>}
                    {payCfg && payCfg.bank && <div>🏦 {payCfg.bank}</div>}
                  </div>
                  <p className="pr-sub">{T("สแกน QR ด้วยแอปธนาคาร โอนตามยอด แล้วอัปโหลดสลิปเพื่อยืนยัน", "Scan with your banking app, pay the exact amount, then upload the slip.", "用银行App扫码付款，然后上传凭证。")}</p>
                  <button className="songbtn go" style={{ width: "100%" }} disabled={st === "uploading"} onClick={() => fileRef.current && fileRef.current.click()}>
                    {st === "uploading" ? "⏳ " + T("กำลังอัป...", "Uploading...", "上传中...") : "📤 " + T("อัปโหลดสลิป", "Upload slip", "上传凭证")}
                  </button>
                  {st === "error" && <div className="aicreate-err">{T("อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง", "Upload failed, try again", "上传失败，请重试")}</div>}
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFile} />
                </>
              )}

              {(chanKey === "alipay" || chanKey === "wechat") && (
                <>
                  <PayQrImg src={zhTab === "wechat" ? wxQr : aliQr} alt={zhTab === "wechat" ? "WeChat Pay QR" : "Alipay QR"} lang={lang} />
                  <p className="pr-sub" style={{ textAlign: "center" }}>
                    {zhTab === "wechat"
                      ? `打开微信 → 扫一扫 → 支付 ¥${(price || 0).toLocaleString()}`
                      : `打开支付宝 → 扫一扫 → 支付 ¥${(price || 0).toLocaleString()}`}
                  </p>
                  <p className="pr-sub" style={{ textAlign: "center", marginTop: 0 }}>付款后上传截图以确认订单</p>
                  <button className="songbtn go" style={{ width: "100%" }} disabled={st === "uploading"} onClick={() => fileRef.current && fileRef.current.click()}>
                    {st === "uploading" ? "⏳ 上传中..." : "📤 上传付款截图"}
                  </button>
                  {st === "error" && <div className="aicreate-err">上传失败，请重试</div>}
                  <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onFile} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

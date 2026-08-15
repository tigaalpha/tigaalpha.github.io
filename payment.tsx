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

export const ALIPAY_QR = "./alipay.jpg";
export const WECHAT_QR = "./wechat.png";

/* ── premium / freemium + daily free-tier usage limits ── */
export function isPremium() { try { return localStorage.getItem("tg_premium") === "1"; } catch (e) { return false; } }
export function setPremiumLS(v) { try { localStorage.setItem("tg_premium", v ? "1" : "0"); } catch (e) {} }
/* Subscription tier — switchable any time: "free" | "premium" | "family" | "max". */
export function getPlan() { try { return localStorage.getItem("tg_plan") || (isPremium() ? "premium" : "free"); } catch (e) { return "free"; } }
export function setPlanLS(p) { try { localStorage.setItem("tg_plan", p); localStorage.setItem("tg_premium", p === "free" ? "0" : "1"); } catch (e) {} }
// Voice Mode (AI voice teacher) is a Max / Max Family exclusive.
export function isMaxPlan(p) { const v = p || getPlan(); return v === "max" || v === "maxfamily"; }
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
// the live, authoritative plan for a profile row (admins = full; paid only while not expired)
export function effectivePlan(p) {
  if (!p) return "free";
  if (p.is_admin) return "maxfamily";
  if (p.plan && p.plan !== "free" && p.plan_until && new Date(p.plan_until).getTime() > Date.now()) return p.plan;
  // 7-day free trial: new accounts get premium-tier access for their first 7 days
  if (p.created_at && (Date.now() - new Date(p.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000) return "trial";
  return "free";
}
// returns days remaining in trial (1–7), or -1 if not in trial / trial has expired
export function trialDaysLeft(p) {
  if (!p || !p.created_at) return -1;
  const elapsed = Date.now() - new Date(p.created_at).getTime();
  const left = 7 - elapsed / (24 * 60 * 60 * 1000);
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

  // payment channels available for this language
  const channels = [
    ...(lang === "zh" ? [{ k: "ali", ic: "🔵", label: "Alipay 支付宝", method: "alipay" }] : []),
    ...(lang === "zh" ? [{ k: "wx",  ic: "🟢", label: "WeChat 微信",   method: "wechat"  }] : []),
    ...(lang === "th" && ppId  ? [{ k: "pp",  ic: "🇹🇭", label: "PromptPay",    method: "promptpay" }] : []),
  ];
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
        body: JSON.stringify({ plan: checkout.plan, cycle: checkout.cycle || "month", cur }),
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
                  <img className="payqr ext" src={zhTab === "wx" ? WECHAT_QR : ALIPAY_QR} alt={zhTab === "wx" ? "WeChat Pay QR" : "Alipay QR"} style={{ width: "100%", maxWidth: 260, display: "block", margin: "10px auto", borderRadius: 12 }} />
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

              {/* ── Thai: PromptPay ── */}
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
                  <img className="payqr ext" src={activeChan === "wechat" ? wxQr : aliQr} alt={activeChan === "wechat" ? "WeChat Pay QR" : "Alipay QR"} style={{ width: "100%", maxWidth: 260, display: "block", margin: "10px auto", borderRadius: 12 }} />
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

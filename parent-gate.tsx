import { useState, useEffect } from "react";
import { hasParentPin, setParentPin, verifyParentPin, clearParentPin, getSpendCap, setSpendCap, getMonthSpend, SPEND_CAP_MIN, SPEND_CAP_MAX, PIN_THRESHOLD_THB, fetchPurchaseHistory } from "./kid-safety";
import { fmtPrice } from "./payment";
import { logUsage } from "./shared-infra";

/* ── ParentGateModal — Kid-Safety Gate M1+M2+M3 UI (gem plan v4 §3) ──────
   ประตูเดียวของ "โหมดผู้ปกครอง":
   mode "verify" — ขอ PIN ก่อนทำธุรกรรม (ซื้อ >99฿, แก้เพดาน, เปิดประวัติ)
   mode "setup"  — ตั้ง PIN ครั้งแรก (4 หลัก + ยืนยัน)
   mode "manage" — เพดานรายเดือน + ประวัติการซื้อของลูก (เรียกหลัง verify ผ่าน)
   ทุกอย่างเป็น client-side ล้วน ไม่มี SQL/edge ใหม่ — ความจริงฝั่ง server
   คือตาราง payments ที่ RLS คุมอยู่แล้ว ──────────────────────────────────── */

const T = (lang, th, en, zh) => lang === "th" ? th : lang === "zh" ? zh : en;

export function ParentGateModal({ lang, uid, mode: initMode, onClose, onVerified, playUi }) {
  const [mode, setMode] = useState(initMode || (hasParentPin(uid) ? "verify" : "setup"));
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [stage, setStage] = useState("enter");      // setup: enter → confirm
  const [err, setErr] = useState("");
  const [cap, setCap] = useState(getSpendCap());
  const [capSaved, setCapSaved] = useState(false);
  const [hist, setHist] = useState(null);           // null = loading, [] = empty
  const [spend, setSpend] = useState(getMonthSpend());

  /* history loads only in manage mode, only after PIN verified (or none set) */
  useEffect(() => {
    if (mode !== "manage") return;
    let alive = true;
    fetchPurchaseHistory(uid, 30).then(({ data }) => { if (alive) setHist(Array.isArray(data) ? data : []); });
    return () => { alive = false; };
  }, [mode, uid]);

  function press(d) {
    if (stage === "confirm") { if (confirmPin.length >= 4) return; setConfirmPin(p => p + d); }
    else { if (pin.length >= 4) return; setPin(p => p + d); }
    setErr("");
    if (playUi) playUi("click");
  }
  function back() {
    if (stage === "confirm") setConfirmPin(p => p.slice(0, -1)); else setPin(p => p.slice(0, -1));
  }

  /* advance when 4 digits entered */
  useEffect(() => {
    if (mode === "setup" && stage === "enter" && pin.length === 4) setStage("confirm");
    if (mode === "setup" && stage === "confirm" && confirmPin.length === 4) finishSetup();
    if ((mode === "verify") && pin.length === 4) finishVerify();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, confirmPin, mode, stage]);

  async function finishSetup() {
    if (pin !== confirmPin) { setErr(T(lang, "รหัสไม่ตรงกัน ลองใหม่", "PINs don't match — try again", "两次输入不一致")); setPin(""); setConfirmPin(""); setStage("enter"); return; }
    await setParentPin(uid, pin);
    logUsage("kid", "pin:set");
    if (playUi) playUi("levelup");
    if (onVerified) onVerified(); else setMode("manage");
    setPin(""); setConfirmPin(""); setStage("enter"); setErr("");
  }
  async function finishVerify() {
    const ok = await verifyParentPin(uid, pin);
    if (!ok) {
      logUsage("kid", "pin:fail");
      setErr(T(lang, "รหัสไม่ถูกต้อง", "Wrong PIN", "密码错误")); setPin("");
      if (playUi) playUi("bad");
      return;
    }
    logUsage("kid", "pin:ok");
    if (playUi) playUi("levelup");
    if (onVerified) { onClose(); onVerified(); } else setMode("manage");
    setPin(""); setErr("");
  }

  function saveCap(v) {
    const nv = setSpendCap(v);
    setCap(nv); setCapSaved(true);
    logUsage("kid", "cap:" + nv);
    setTimeout(() => setCapSaved(false), 2000);
  }

  const dots = (v) => [0, 1, 2, 3].map(i => (
    <span key={i} style={{ width: 14, height: 14, borderRadius: "50%", display: "inline-block", margin: "0 6px", border: "2px solid var(--bd2,rgba(0,0,0,0.2))", background: v.length > i ? "var(--accent)" : "transparent" }} />
  ));

  const title = mode === "setup" ? T(lang, "ตั้งรหัสผู้ปกครอง", "Set parent PIN", "设置家长密码")
    : mode === "verify" ? T(lang, "ใส่รหัสผู้ปกครอง", "Enter parent PIN", "输入家长密码")
    : T(lang, "โหมดผู้ปกครอง", "Parent mode", "家长模式");

  return (
    <div className="setov" onClick={onClose}>
      <div className="setcard pricing" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className="sethdr"><span>🔒 {title}</span><button className="cbtn" onClick={onClose}>✕</button></div>
        <div className="setbody">

          {(mode === "setup" || mode === "verify") && (
            <>
              <p className="pr-sub" style={{ marginTop: 0 }}>
                {mode === "setup"
                  ? T(lang,
      `ใช้กับการซื้อทุกครั้งที่เกิน ${PIN_THRESHOLD_THB}฿ เด็กกดเองไม่ได้`,
      `Required for purchases over ${PIN_THRESHOLD_THB}฿ — kids can't check out past it`,
      `超过 ${PIN_THRESHOLD_THB}฿ 的购买都需要输入，孩子无法自行支付`)
                  : T(lang, "เฉพาะผู้ปกครองเท่านั้น", "Parents only", "仅限家长")}
              </p>
              <div style={{ textAlign: "center", padding: "10px 0 14px" }}>
                {stage === "confirm" ? dots(confirmPin) : dots(pin)}
                {stage === "confirm" && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>{T(lang, "ใส่รหัสเดิมอีกครั้ง", "Re-enter the PIN", "再次输入密码")}</div>}
              </div>
              {err && <div className="aicreate-err">{err}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, maxWidth: 240, margin: "0 auto" }}>
                {["1","2","3","4","5","6","7","8","9"].map(d => (
                  <button key={d} className="songbtn ghost" style={{ fontSize: 18, padding: "10px 0" }} onClick={() => press(d)}>{d}</button>
                ))}
                <button className="songbtn ghost" style={{ fontSize: 14 }} onClick={() => { setPin(""); setConfirmPin(""); setStage("enter"); setErr(""); }}>{T(lang, "ล้าง", "Clear", "清空")}</button>
                <button className="songbtn ghost" style={{ fontSize: 18, padding: "10px 0" }} onClick={() => press("0")}>0</button>
                <button className="songbtn ghost" style={{ fontSize: 18, padding: "10px 0" }} onClick={back}>⌫</button>
              </div>
              {mode === "setup" && stage === "enter" && pin.length === 0 && (
                <button className="songbtn ghost" style={{ width: "100%", marginTop: 12 }} onClick={onClose}>
                  {T(lang, "ไว้ก่อน — ยังซื้อได้ปกติ", "Skip for now — purchases still work", "暂时跳过——购买不受影响")}
                </button>
              )}
            </>
          )}

          {mode === "manage" && (
            <>
              <div className="paysum" style={{ marginBottom: 12 }}>
                <span>{T(lang, "ยอดจ่ายเดือนนี้", "Spent this month", "本月已消费")}</span>
                <b className="prtier-price">{fmtPrice("thb", spend)} / {fmtPrice("thb", cap)}</b>
              </div>
              <div style={{ margin: "0 0 6px", fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>
                {T(lang, "เพดานการใช้จ่ายรายเดือน", "Monthly spend cap", "每月消费上限")}
              </div>
              <input type="range" min={SPEND_CAP_MIN} max={SPEND_CAP_MAX} step={100} value={cap}
                style={{ width: "100%" }}
                onChange={e => setCap(parseInt(e.target.value, 10))}
                onMouseUp={e => saveCap(e.target.value)} onTouchEnd={e => saveCap(e.target.value)} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
                <span>฿{SPEND_CAP_MIN}</span><span>฿{SPEND_CAP_MAX}</span>
              </div>
              {capSaved && <div style={{ fontSize: 12, color: "var(--ok,#16a34a)", fontWeight: 700, marginBottom: 8 }}>✓ {T(lang, "บันทึกแล้ว", "Saved", "已保存")}</div>}

              <div style={{ margin: "10px 0 6px", fontSize: 12.5, fontWeight: 700, color: "var(--text)" }}>
                {T(lang, "การซื้อของลูก", "Your child's purchases", "孩子的购买记录")}
              </div>
              {hist === null
                ? <div className="pr-sub">⏳</div>
                : hist.length === 0
                  ? <p className="pr-sub" style={{ marginTop: 0 }}>{T(lang, "ยังไม่มีประวัติการซื้อ", "No purchases yet", "暂无购买记录")}</p>
                  : <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid var(--bd2,rgba(0,0,0,0.08))", borderRadius: 10 }}>
                      {hist.map(p => (
                        <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", borderBottom: "1px solid var(--bd2,rgba(0,0,0,0.05))", fontSize: 12.5 }}>
                          <span>
                            {p.currency_type === "gems" ? "💎" : "🪙"} {(p.currency_amount || 0).toLocaleString()}
                            <span style={{ color: "var(--muted)" }}> · {(p.created_at || "").slice(0, 10)}</span>
                          </span>
                          <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                            {fmtPrice("thb", p.amount || 0)}{" "}
                            <span style={{ fontSize: 10.5, color: p.status === "approved" ? "var(--ok,#16a34a)" : "var(--muted)" }}>
                              {p.status === "approved" ? "✓" : p.status === "pending" ? T(lang, "รอตรวจ", "pending", "待审核") : p.status}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>}

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button className="songbtn ghost" style={{ flex: 1 }} onClick={() => { if (window.confirm(T(lang, "ลบรหัสผู้ปกครอง?", "Remove parent PIN?", "删除家长密码？"))) { clearParentPin(); logUsage("kid", "pin:clear"); onClose(); } }}>
                  {T(lang, "ลบรหัส PIN", "Remove PIN", "删除密码")}
                </button>
                <button className="atpopup-ok" style={{ flex: 1 }} onClick={onClose}>{T(lang, "เสร็จสิ้น", "Done", "完成")}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

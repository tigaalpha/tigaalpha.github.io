/* ── Payment alerts for the top-tier admin (owner, 2026-10-12: "when someone upgrades from free to premium and pays, show a notification to the top-tier admin so I
   know a transfer came in and can go confirm it") ──
   A customer's payment is a row in `payments` with status "pending" (slip uploaded, waiting for the admin to confirm). This watches that table for a tier-3
   admin: a Realtime subscription for the instant case (works when the table is in the Realtime publication) and a 25 s poll plus a check whenever the app
   is shown again as the fallback that always works. A pending payment the admin has not yet been told about gets a pop-up card, a chime, a vibration and,
   if the browser allows it, a system notification; a chip with the number of payments waiting stays on screen until they are confirmed or rejected.
   Nothing is written to the database. It only works while the app is open (a closed app needs web push, which needs a server function: not built). */
import { useEffect, useRef, useState } from "react";
import { sb } from "./supabase-client";

const T = (lang: string, th: string, en: string, zh: string) => (lang === "th" ? th : lang === "zh" ? zh : en);
const SEEN = "tg_admin_pay_seen";
const readSeen = (): string[] => { try { const v = JSON.parse(localStorage.getItem(SEEN) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const writeSeen = (ids: string[]) => { try { localStorage.setItem(SEEN, JSON.stringify(ids.slice(-300))); } catch (e) {} };
const PLAN_NAME: Record<string, string> = { premium: "Premium", max: "Max", maxfamily: "Max Family", family: "Family" };

function chime() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return;
    const ac = new AC(), t0 = ac.currentTime;
    [[880, 0], [1175, 0.16], [1568, 0.32]].forEach(([f, d]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.25, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.35); o.connect(g); g.connect(ac.destination); o.start(t0 + d); o.stop(t0 + d + 0.4); });
    setTimeout(() => { try { ac.close(); } catch (e) {} }, 1200);
  } catch (e) {}
}

export default function AdminPayAlert({ adminTier, lang, onOpen }: { adminTier: number; lang: string; onOpen: () => void }) {
  const [pending, setPending] = useState<any[]>([]), [toast, setToast] = useState<any[] | null>(null);
  const seenRef = useRef<string[]>(readSeen()), firstRef = useRef(true);
  useEffect(() => {
    if (adminTier < 3) return;
    let dead = false, ch: any = null;
    const check = async () => {
      try {
        const { data, error } = await sb.from("payments").select("id,full_name,email,plan,amount,created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(50);
        if (dead || error || !data) return;
        setPending(data);
        const fresh = data.filter((r: any) => !seenRef.current.includes(String(r.id)));
        if (fresh.length) {
          seenRef.current = [...seenRef.current, ...fresh.map((r: any) => String(r.id))]; writeSeen(seenRef.current);
          setToast(fresh); chime(); try { (navigator as any).vibrate && (navigator as any).vibrate([220, 90, 220]); } catch (e) {}
          try { if ("Notification" in window && Notification.permission === "granted") { const r = fresh[0]; new Notification(T(lang, "💰 มีการโอนเงินเข้ามา", "💰 A payment came in", "💰 收到付款"), { body: (r.full_name || r.email || "—") + " · " + (PLAN_NAME[r.plan] || r.plan) + " · ฿" + Number(r.amount || 0).toLocaleString() + (fresh.length > 1 ? " (+" + (fresh.length - 1) + ")" : ""), tag: "tiga-pay" }); } } catch (e) {}
        }
        firstRef.current = false;
      } catch (e) {}
    };
    check();
    const iv = setInterval(check, 25000);
    const vis = () => { if (!document.hidden) check(); };
    document.addEventListener("visibilitychange", vis); window.addEventListener("focus", vis);
    try { ch = (sb as any).channel("admin-pay-alert").on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => check()).subscribe(); } catch (e) {}
    return () => { dead = true; clearInterval(iv); document.removeEventListener("visibilitychange", vis); window.removeEventListener("focus", vis); try { ch && (sb as any).removeChannel(ch); } catch (e) {} };
  }, [adminTier]);
  if (adminTier < 3 || !pending.length) return null;
  const t = (a: string, b: string, c: string) => T(lang, a, b, c);
  const open = () => { setToast(null); onOpen(); };
  const askNotif = () => { try { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); } catch (e) {} };
  const canAsk = (() => { try { return "Notification" in window && Notification.permission === "default"; } catch (e) { return false; } })();
  return (
    <>
      <style>{`.payal-chip{position:fixed;top:calc(8px + env(safe-area-inset-top,0px));right:10px;z-index:5200;display:flex;align-items:center;gap:6px;padding:8px 13px;border-radius:999px;border:0;background:linear-gradient(135deg,#ffb020,#ff6a3d);color:#2a1200;font:800 13px system-ui,sans-serif;box-shadow:0 6px 18px rgba(255,120,40,.5);cursor:pointer;animation:payalPulse 1.8s ease-in-out infinite}
.payal-toast{position:fixed;left:50%;top:calc(58px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:5201;width:min(92vw,380px);padding:14px 15px;border-radius:20px;background:#16110a;border:1.5px solid #ffb020;color:#fff3dc;box-shadow:0 14px 40px rgba(0,0,0,.55);font-family:system-ui,sans-serif;animation:payalIn .35s ease-out}
.payal-toast b{display:block;font-size:15px;margin-bottom:4px}.payal-toast p{margin:2px 0;font-size:13px;opacity:.92}.payal-toast .row{display:flex;gap:8px;margin-top:10px}
.payal-toast button{flex:1;padding:10px;border-radius:999px;border:0;font:800 13px system-ui,sans-serif;cursor:pointer}.payal-toast .go{background:#ffb020;color:#2a1200}.payal-toast .no{background:rgba(255,255,255,.12);color:#fff}
@keyframes payalPulse{50%{transform:scale(1.06)}}@keyframes payalIn{from{opacity:0;transform:translate(-50%,-14px)}}
@media (prefers-reduced-motion:reduce){.payal-chip{animation:none}.payal-toast{animation:none}}`}</style>
      <button className="payal-chip" data-payal="chip" onClick={open} aria-label="pending payments">💰 {pending.length} {t("รอยืนยัน", "to confirm", "待确认")}</button>
      {toast && (
        <div className="payal-toast" data-payal="toast" role="alert">
          <b>💰 {t("มีการโอนเงินเข้ามา!", "A payment came in!", "收到一笔付款！")}</b>
          {toast.slice(0, 3).map((r: any) => <p key={r.id}>{r.full_name || r.email || "—"} · <strong>{PLAN_NAME[r.plan] || r.plan}</strong> · ฿{Number(r.amount || 0).toLocaleString()}</p>)}
          {toast.length > 3 && <p>+{toast.length - 3} {t("รายการ", "more", "更多")}</p>}
          <p style={{ opacity: 0.7 }}>{t("เข้าไปตรวจสลิปแล้วกดยืนยันเพื่อเปิดแพลนให้ลูกค้า", "Check the slip, then confirm to activate the plan", "核对凭证后确认即可开通套餐")}</p>
          <div className="row"><button className="go" onClick={open}>{t("ตรวจสลิป", "Review slip", "查看凭证")}</button><button className="no" onClick={() => { setToast(null); askNotif(); }}>{canAsk ? t("ปิด + เปิดแจ้งเตือนเครื่อง", "Close + enable alerts", "关闭并开启通知") : t("ปิด", "Close", "关闭")}</button></div>
        </div>
      )}
    </>
  );
}

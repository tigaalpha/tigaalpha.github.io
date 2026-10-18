import { useEffect, useRef, useState } from "react";
import { readPower, POWER_MAX, COST, POWER_DAILY_EARN_CAP, DRAIN_SECS, drainPower } from "./game-power";

/* The GAME POWER bar and its "how do I charge it" sheet (owner, 2026-10-17). The numbers live in game-power.ts; this file only draws them.
   Neon capsule (cyan to violet, the arena's palette) because it sits on the arena's dark hero in both app themes. */
export function usePower(): number {
  const [v, setV] = useState(() => readPower());
  useEffect(() => {
    const on = () => setV(readPower());
    window.addEventListener("tg:power", on); window.addEventListener("storage", on); on();
    return () => { window.removeEventListener("tg:power", on); window.removeEventListener("storage", on); };
  }, []);
  return v;
}
/* While `active`, take 1 power every DRAIN_SECS seconds; at 0 call onEmpty() once (the game stops and the pop-up opens). */
export function usePlayDrain(active: boolean, adminTier: number, onEmpty: () => void) {
  const cb = useRef(onEmpty); cb.current = onEmpty;
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => { if (!drainPower(adminTier)) { clearInterval(id); cb.current(); } }, DRAIN_SECS * 1000);
    return () => clearInterval(id);
  }, [active, adminTier]);
}
const SEGS = 10;
export function GamePowerBar({ lang, onOpen }: { lang: string; onOpen: () => void }) {
  const v = usePower(), T = (th: string, en: string, zh: string) => lang === "th" ? th : lang === "zh" ? zh : en;
  const lit = Math.ceil((v / POWER_MAX) * SEGS), low = v < COST.adventure;
  return (
    <button type="button" className={`gpbar${low ? " low" : ""}`} data-gpbar={v} onClick={onOpen} aria-label={T("พลังเกม", "Game power", "游戏能量") + " " + v + "/" + POWER_MAX}>
      <span className="gpbar-ic" aria-hidden="true">⚡</span>
      <span className="gpbar-main">
        <span className="gpbar-k">GAME POWER<i> · {T("พลังเกม", "POWER", "能量")}</i></span>
        <span className="gpbar-segs" aria-hidden="true">{Array.from({ length: SEGS }, (_, i) => <b key={i} className={i < lit ? "on" : ""} />)}</span>
        <span className="gpbar-v"><b>{v}</b><em>/{POWER_MAX}</em><u>{T("ชาร์จ ›", "Charge ›", "充能 ›")}</u></span>
      </span>
    </button>
  );
}
export function PowerSheet({ lang, need = 0, onClose, onLearn }: { lang: string; need?: number; onClose: () => void; onLearn?: () => void }) {
  const v = usePower(), T = (th: string, en: string, zh: string) => lang === "th" ? th : lang === "zh" ? zh : en;
  const go = () => { onClose(); if (onLearn) onLearn(); else { try { window.dispatchEvent(new CustomEvent("tg:goto", { detail: { page: "myclass" } })); } catch (e) {} } };
  const rows: [string, string, string, string][] = [
    ["🧠", "+20", "เรียนเรื่องใหม่ (บทเรียนใหม่)", "Learn something new"], ["🔁", "+12", "ทบทวนบทเรียนเก่า", "Review an old lesson"],
    ["🎹", "+10", "ซ้อมเปียโน (Practice)", "A practice round"], ["👂", "+8", "ฝึกหู · อ่านโน้ต · เล่นเพลง", "Ear · reading · a song"],
  ];
  return (
    <div className="gpsheet-bg" data-gpsheet role="dialog" aria-modal="true" onClick={onClose}>
      <div className="gpsheet" onClick={e => e.stopPropagation()}>
        <button type="button" className="gpsheet-x" onClick={onClose} aria-label="close">✕</button>
        <div className="gpsheet-hd"><span>⚡</span><div><b>{need ? T("พลังเกมหมด", "Out of game power", "游戏能量用完了") : T("พลังเกม", "Game power", "游戏能量")}</b>
          <i>{need ? T(`คุณต้องไปเรียนรู้เพื่อเติมพลังเกมก่อน · ตอนนี้มี ${v}`, `Go learn to refill your game power first · you have ${v}`, `请先去学习来补充游戏能量 · 现有 ${v}`) : T(`ตอนนี้มี ${v} จาก ${POWER_MAX}`, `You have ${v} of ${POWER_MAX}`, `现有 ${v} / ${POWER_MAX}`)}</i></div></div>
        <div className="gpsheet-t">{T("ได้พลังจากการเรียนในแอป", "Charge it by learning in the app", "通过学习获得能量")}</div>
        {rows.map((r, i) => <div className="gpsheet-r" key={i}><span>{r[0]}</span><em>{r[1]}</em><b>{lang === "th" ? r[2] : r[3]}</b></div>)}
        <div className="gpsheet-t">{T("พลังลดลงขณะเล่น PvP และผจญภัย", "It drains while you play PvP and Adventure", "玩 PvP 和冒险时会消耗")}</div>
        <div className="gpsheet-r"><span>⏱</span><em className="neg">−1</em><b>{T(`ทุก ${DRAIN_SECS} วินาทีที่เล่น (เต็ม 100 ≈ ${Math.round(100 * DRAIN_SECS / 60)} นาที)`, `every ${DRAIN_SECS} s of play (a full bar ≈ ${Math.round(100 * DRAIN_SECS / 60)} min)`, `每玩 ${DRAIN_SECS} 秒（满格约 ${Math.round(100 * DRAIN_SECS / 60)} 分钟）`)}</b></div>
        <div className="gpsheet-n">{T(`เรียนวันละไม่เกิน ${POWER_DAILY_EARN_CAP} พลัง · พลังซื้อด้วยเงินไม่ได้`, `Up to ${POWER_DAILY_EARN_CAP} power a day from learning · it can't be bought`, `每天最多通过学习获得 ${POWER_DAILY_EARN_CAP} 能量 · 不能用钱购买`)}</div>
        <button type="button" className="gpsheet-go" data-gplearn onClick={go}>{T("ไปเรียนเพื่อชาร์จพลัง →", "Go learn to charge →", "去学习充能 →")}</button>
      </div>
    </div>
  );
}
/* a small "+12 game power" toast, shown wherever the app is when learning pays out */
export function PowerToast({ lang }: { lang: string }) {
  const [t, setT] = useState<{ n: number; k: number; v: number; sum: number } | null>(null);
  useEffect(() => {
    let k = 0, sum = 0, timer: any = 0;
    const on = (e: any) => { const d = e && e.detail; if (d && d.delta > 0) { k++; sum += d.delta; setT({ n: d.delta, k, v: d.v, sum }); clearTimeout(timer); timer = setTimeout(() => { setT(null); sum = 0; }, 4200); } };
    window.addEventListener("tg:power", on); return () => { window.removeEventListener("tg:power", on); clearTimeout(timer); };
  }, []);
  if (!t) return null;
  return <div className="gptoast" key={t.k} data-gptoast role="status">⚡ +{t.n} {lang === "th" ? "พลังเกม" : lang === "zh" ? "游戏能量" : "game power"} · {t.v}/{POWER_MAX}{t.sum > t.n ? (lang === "th" ? ` · รอบนี้ได้ +${t.sum}` : lang === "zh" ? ` · 本轮 +${t.sum}` : ` · +${t.sum} this round`) : ""}</div>;
}

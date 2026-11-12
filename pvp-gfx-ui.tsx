/* ── pvp-gfx-ui.tsx ── the gear button and the small "Graphics quality" card
   (owner, 2026-11-05). One gear in the Games lobby header and one in the fight
   header, in the place the first-person button used to be. Two levels, Low and
   High; the level is the one in pvp-gfx.ts, so both screens follow a change
   at once. The card is a centred pop-up in a portal, not a page. */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGfx, useGfxAuto, setGfx, type PvpGfx } from "./pvp-gfx";

import { pickT } from "./lang-extra";
const tr = (lang, th, en, zh) => pickT(lang, th, en, zh);

/** A gear that draws on every phone (an SVG, not an emoji). */
export function GearIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function GfxCard({ lang, onClose }) {
  const level = useGfx();
  const auto = useGfxAuto();
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", k, true);
    try { first.current && first.current.focus(); } catch (e) {}
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose]);
  const rows: Array<[PvpGfx, string, string]> = [
    ["low", tr(lang, "ต่ำ", "Low", "低"), tr(lang, "สำหรับมือถือรุ่นเก่า ลื่นที่สุด", "For older phones, smoothest", "适合旧手机，最流畅")],
    ["high", tr(lang, "สูง", "High", "高"), tr(lang, "สวยที่สุด สำหรับเครื่องแรง", "Best look, for strong phones", "画面最佳，适合高性能手机")],
  ];
  const node = (
    <div className="pvpgfx-back" data-gfx-card onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pvpgfx-card" role="dialog" aria-modal="true" aria-label={tr(lang, "คุณภาพกราฟิก", "Graphics quality", "画质")}>
        <div className="pvpgfx-h">{tr(lang, "คุณภาพกราฟิก", "Graphics quality", "画质")}</div>
        <div className="pvpgfx-rows" role="radiogroup">
          {rows.map(([k, name, line], i) => (
            <button key={k} type="button" ref={i === 0 ? first : undefined} role="radio" aria-checked={level === k} data-gfx-opt={k}
              className={"pvpgfx-row" + (level === k ? " on" : "")} onClick={() => setGfx(k, "user")}>
              <span className="pvpgfx-dot" aria-hidden="true">{level === k ? "✓" : ""}</span>
              <span className="pvpgfx-t"><b>{name}</b><i>{line}</i></span>
              {level === k && <u>{tr(lang, "ใช้อยู่", "In use", "当前")}</u>}
            </button>
          ))}
        </div>
        {auto && <div className="pvpgfx-auto" data-gfx-auto>{tr(lang, "เกมลดคุณภาพให้อัตโนมัติ เพราะเครื่องนี้ไม่ลื่น", "The game lowered the quality on this device", "游戏已自动为此设备降低画质")}</div>}
        <button type="button" className="pvpgfx-x" onClick={onClose}>{tr(lang, "ปิด", "Close", "关闭")}</button>
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(node, document.body) : null;
}

/** The round gear button and the card it opens. `onOpenChange` lets the fight hold its clock while the card is up. */
export function GfxGear({ lang, className = "", onOpenChange = null }: { lang: string; className?: string; onOpenChange?: ((open: boolean) => void) | null }) {
  const [open, setOpen] = useState(false);
  const set = (v: boolean) => { setOpen(v); try { onOpenChange && onOpenChange(v); } catch (e) {} };
  useEffect(() => () => { try { onOpenChange && onOpenChange(false); } catch (e) {} }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <button type="button" className={"pvpgfxbtn" + (className ? " " + className : "") + (open ? " on" : "")} data-gfx-gear
        aria-label={tr(lang, "คุณภาพกราฟิก", "Graphics quality", "画质")} title={tr(lang, "คุณภาพกราฟิก", "Graphics quality", "画质")}
        onClick={() => set(!open)}>
        <GearIcon />
      </button>
      {open && <GfxCard lang={lang} onClose={() => set(false)} />}
    </>
  );
}

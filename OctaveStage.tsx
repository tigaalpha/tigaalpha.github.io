import { useEffect, useMemo, useRef, useState } from "react";
import { playPianoNote } from "./music-engine";
import { FingerHand } from "./PracticeOverlay";
/* ── OctaveStage ──
   Full-screen, landscape practice view for a scale or chord pattern played over 2, 3 or 4 octaves (Teacher page, owner 2026-10-13).
   The pattern comes from the one-octave demo (`notes`: name with octave + finger); each extra octave repeats it one octave higher.
   The keys are a wide horizontal keyboard, a hand shows the finger, and the note names are listed on top. */
const SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midiOf = (n: string) => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(n); if (!m) return null; return (parseInt(m[3], 10) + 1) * 12 + SEMI[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0); };
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const nameOf = (m: number) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
export function extendPattern(notes: { note: string; finger: number | null }[], octaves: number) {
  const base = notes.map(p => ({ m: midiOf(p.note), f: p.finger })).filter(p => p.m != null) as { m: number; f: number | null }[];
  if (base.length < 2) return [] as { m: number; f: number | null }[];
  const out: { m: number; f: number | null }[] = [];
  for (let o = 0; o < octaves; o++) base.forEach((p, i) => { if (o > 0 && i === 0) return; out.push({ m: p.m + 12 * o, f: i === base.length - 1 && o < octaves - 1 ? base[0].f : p.f }); });
  return out;
}
export function OctaveStage({ notes, label, octaves, hand, setHand, lang, onClose }: any) {
  const seq = useMemo(() => extendPattern(notes, octaves), [notes, octaves]);
  const [cur, setCur] = useState(-1); const [playing, setPlaying] = useState(false); const [portrait, setPortrait] = useState(false);
  const timer = useRef<any>(null);
  const T = { th: { play: "เล่นให้ดู", stop: "หยุด", close: "ปิด", notes: "โน้ต", left: "มือซ้าย", right: "มือขวา", tap: "แตะคีย์เพื่อเล่นเอง" }, en: { play: "Play it", stop: "Stop", close: "Close", notes: "Notes", left: "Left hand", right: "Right hand", tap: "Tap the keys to play" }, zh: { play: "示范", stop: "停止", close: "关闭", notes: "音符", left: "左手", right: "右手", tap: "点击琴键自己弹" } }[lang as "th" | "en" | "zh"] || ({} as any);
  useEffect(() => {
    try { const el: any = document.documentElement; if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {}); (screen.orientation as any)?.lock?.("landscape").catch(() => {}); } catch (e) {}
    const chk = () => setPortrait(window.innerHeight > window.innerWidth); chk(); window.addEventListener("resize", chk);
    return () => { window.removeEventListener("resize", chk); clearInterval(timer.current); try { (screen.orientation as any)?.unlock?.(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch (e) {} };
  }, []);
  const run = () => {
    if (playing) { clearInterval(timer.current); setPlaying(false); return; }
    setPlaying(true); let i = 0; const step = () => { if (i >= seq.length) { clearInterval(timer.current); setPlaying(false); return; } setCur(i); try { playPianoNote(nameOf(seq[i].m), 0.6, 1); } catch (e) {} i++; };
    step(); timer.current = setInterval(step, 520);
  };
  if (!seq.length) return null;
  const lo = Math.floor((Math.min(...seq.map(s => s.m)) - 12) / 12) * 12 + 12, hi = Math.ceil((Math.max(...seq.map(s => s.m)) - 11) / 12) * 12 + 12 + 11;
  const whites: number[] = [], blacks: number[] = []; for (let m = lo; m <= hi; m++) (NAMES[m % 12].length === 1 ? whites : blacks).push(m);
  const wIndex = (m: number) => whites.indexOf(m), wW = 100 / whites.length;
  const litM = cur >= 0 ? seq[cur].m : -1, finger = cur >= 0 ? seq[cur].f : 0;
  const tap = (m: number) => { try { playPianoNote(nameOf(m), 0.7, 1); } catch (e) {} const j = seq.findIndex(s => s.m === m); if (j >= 0) setCur(j); };
  const inSeq = new Set(seq.map(s => s.m));
  return (
    <div className={"ost" + (portrait ? " rot" : "")} role="dialog" aria-label="octave practice">
      <div className="ost-top">
        <b className="ost-title">{label}</b><span className="ost-oct">{octaves}×</span>
        <div className="ost-notes" aria-label={T.notes}>{seq.map((s, i) => <span key={i} className={i === cur ? "on" : ""}>{NAMES[s.m % 12]}</span>)}</div>
        <button className="ost-btn" onClick={() => setHand(hand === "left" ? "right" : "left")}>{hand === "left" ? T.left : T.right} ⇄</button>
        <button className="ost-btn go" onClick={run}>{playing ? "⏸ " + T.stop : "▶ " + T.play}</button>
        <button className="ost-btn" onClick={onClose} aria-label={T.close}>✕</button>
      </div>
      <div className="ost-mid">
        <div className="ost-hand"><FingerHand finger={finger || 0} hand={hand} /></div>
        <div className="ost-kb">
          {whites.map(m => <button key={m} className={"ow" + (m === litM ? " lit" : inSeq.has(m) ? " in" : "")} style={{ left: wIndex(m) * wW + "%", width: wW + "%" }} onClick={() => tap(m)} aria-label={nameOf(m)}><i>{NAMES[m % 12] === "C" ? nameOf(m) : NAMES[m % 12]}</i></button>)}
          {blacks.map(m => { const w = wIndex(m - 1); return <button key={m} className={"ob" + (m === litM ? " lit" : inSeq.has(m) ? " in" : "")} style={{ left: (w + 1) * wW - wW * 0.3 + "%", width: wW * 0.6 + "%" }} onClick={() => tap(m)} aria-label={nameOf(m)} />; })}
        </div>
      </div>
      <div className="ost-hint">{T.tap}</div>
    </div>
  );
}
export const OCTAVE_CSS = `
.ost{position:fixed;inset:0;z-index:3000;display:flex;flex-direction:column;gap:10px;padding:12px calc(14px + env(safe-area-inset-right,0px)) 10px calc(14px + env(safe-area-inset-left,0px));background:var(--bg,#fff);color:var(--text,#222);font-family:var(--f-app,system-ui)}
.ost.rot{inset:auto;top:0;left:100vw;width:100vh;height:100vw;transform-origin:top left;transform:rotate(90deg)}
.ost-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.ost-title{font-size:18px}.ost-oct{font-weight:800;color:var(--clay,#d97757)}
.ost-notes{flex:1;display:flex;flex-wrap:wrap;gap:4px;min-width:140px}.ost-notes span{padding:3px 7px;border-radius:999px;background:var(--card2,#f3f3f3);font-size:12px;font-weight:700}.ost-notes span.on{background:var(--clay,#d97757);color:#fff}
.ost-btn{min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid var(--bd3,rgba(0,0,0,.2));background:var(--card,#fff);color:var(--text);font-weight:800;cursor:pointer}.ost-btn.go{background:var(--clay,#d97757);color:#fff;border-color:transparent}
.ost-mid{flex:1;display:flex;gap:14px;min-height:0;align-items:stretch}.ost-hand{flex:0 0 150px;display:flex;align-items:center;justify-content:center;border-radius:22px;background:var(--card,#fff);border:1px solid var(--bd2,rgba(0,0,0,.12))}
.ost-kb{position:relative;flex:1;border-radius:14px;overflow:hidden;background:#111;min-height:120px}
.ost-kb .ow{position:absolute;top:0;bottom:0;border:1px solid #888;border-top:0;background:#fff;border-radius:0 0 8px 8px;padding:0;cursor:pointer;display:flex;align-items:flex-end;justify-content:center}.ost-kb .ow i{font-style:normal;font-size:11px;font-weight:700;color:#666;margin-bottom:6px}
.ost-kb .ow.in{background:#fde7de}.ost-kb .ow.lit{background:var(--clay,#d97757)}.ost-kb .ow.lit i{color:#fff}
.ost-kb .ob{position:absolute;top:0;height:60%;background:#1b1b1b;border:0;border-radius:0 0 6px 6px;z-index:2;cursor:pointer}.ost-kb .ob.in{background:#a8543a}.ost-kb .ob.lit{background:var(--clay,#d97757)}
.ost-hint{font-size:12px;color:var(--muted,#777);text-align:center}
`;

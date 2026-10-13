import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const LETTER: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
// Four bars of the taught notes on ONE five-line staff (four quarter notes a bar, 4/4 shown in colour); the note being taught is orange. Treble staff, bottom line E4.
function StaffCard({ notes, active, title, bass }: { notes: { m: number }[]; active: number; title: string; bass?: boolean }) {
  const N = 16, W = 640, H = 112, left = 78, gap = (W - left - 12) / N, half = 7, bottom = 84;
  const stepOf = (m: number) => { const nm = NAMES[m % 12].replace("#", ""), oct = Math.floor(m / 12) - 1; return oct * 7 + LETTER[nm]; };
  const base = bass ? 18 : 30;   // diatonic step of the bottom line: G2 in the bass clef, E4 in the treble clef
  const yOf = (st: number) => bottom - (st - base) * half;
  const top = bottom - 8 * half, mid = bottom - 4 * half;
  // Notes far above or below the staff (long ranges) would run off the card: stretch the view box to hold them, the drawing then scales down to fit.
  const ys = notes.slice(0, N).map(q => yOf(stepOf(q.m))), vbTop = Math.min(0, Math.min(...ys, 99) - 32), vbBot = Math.max(H, Math.max(...ys, 0) + 32);
  return (
    <svg className="ost-staff" viewBox={`0 ${vbTop} ${W} ${vbBot - vbTop}`} role="img" aria-label={title}>
      {[0, 1, 2, 3, 4].map(i => <line key={i} x1={10} x2={W - 4} y1={bottom - i * 2 * half} y2={bottom - i * 2 * half} stroke="currentColor" strokeWidth="1" opacity=".55" />)}
      {bass ? (
      <g transform={`translate(18 ${top - 1})`} aria-hidden="true">
        <path d="M4 8 C4 -2 22 -2 25 11 C27 24 16 34 3 42" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" /><circle cx="5" cy="8" r="4.2" fill="currentColor" /><circle cx="31" cy="6" r="2.3" fill="currentColor" /><circle cx="31" cy="17" r="2.3" fill="currentColor" />
      </g>
      ) : (
      <g transform={`translate(14 ${top - 22}) scale(1.2)`} aria-hidden="true">
        {/* a calligraphic G clef: a thick spine that starts in the tail below the staff, rises to the top loop, comes back down and winds round the G line */}
        <path d="M16.5 80 C16.5 87 8 88 7 82 C6 77 11 76 13 79" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M14.5 78 C19 76 20 66 20.5 56 C21 44 27 33 26 20 C25.5 11 21 3 17.5 3 C13.500 3 12 12 16 23 C20 34 30 44 30 56 C30 67 22 72 15 68 C8 64 8 53 17 50.500 C25 48.500 29.500 57 24 61.500 C20.500 64 16 61 18 57.500" fill="none" stroke="currentColor" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12.600" cy="79.200" r="2.500" fill="currentColor" />
      </g>
      )}
      <g aria-hidden="true" fontFamily="Georgia,'Times New Roman',serif" fontWeight="900" fontSize="30" textAnchor="middle">
        <text x={64} y={mid - 6} fill="#d97757">4</text><text x={64} y={bottom - 6} fill="#2f9e8f">4</text>
      </g>
      <line x1={10} x2={10} y1={top} y2={bottom} stroke="currentColor" strokeWidth="1.5" />
      {[1, 2, 3].map(k => <line key={k} x1={left + gap * 4 * k} x2={left + gap * 4 * k} y1={top} y2={bottom} stroke="currentColor" strokeWidth="1" opacity=".7" />)}
      <line x1={W - 8} x2={W - 8} y1={top} y2={bottom} stroke="currentColor" strokeWidth="1.5" /><line x1={W - 4} x2={W - 4} y1={top} y2={bottom} stroke="currentColor" strokeWidth="3" />
      {notes.slice(0, N).map((q, i) => { const st = stepOf(q.m), y = yOf(st), x = left + gap * (i + 0.5), on = i === active, sharp = NAMES[q.m % 12].includes("#");
        const ledgers: number[] = []; for (let l = base - 2; l >= st; l -= 2) ledgers.push(l); for (let l = base + 10; l <= st; l += 2) ledgers.push(l);
        return (<g key={i} className={on ? "on" : ""}>
          {ledgers.map(l => <line key={l} x1={x - 11} x2={x + 11} y1={yOf(l)} y2={yOf(l)} stroke="currentColor" strokeWidth="1" opacity=".7" />)}
          {sharp && <text x={x - 17} y={y + 5} fontSize="14" fill={on ? "#d97757" : "currentColor"}>♯</text>}
          <ellipse cx={x} cy={y} rx="6.5" ry="5" fill={on ? "#d97757" : "currentColor"} transform={`rotate(-18 ${x} ${y})`} />
          <line x1={st >= base + 4 ? x - 6 : x + 6} x2={st >= base + 4 ? x - 6 : x + 6} y1={y} y2={st >= base + 4 ? y + 26 : y - 26} stroke={on ? "#d97757" : "currentColor"} strokeWidth="1.6" />
        </g>); })}
    </svg>
  );
}
export function extendPattern(notes: { note: string; finger: number | null }[], octaves: number) {
  const base = notes.map(p => ({ m: midiOf(p.note), f: p.finger })).filter(p => p.m != null) as { m: number; f: number | null }[];
  if (base.length < 2) return [] as { m: number; f: number | null }[];
  const out: { m: number; f: number | null }[] = [];
  // A chord / arpeggio demo does not reach the next root: each octave repeats every note, and the run ends on the root one octave above the last group.
  if (base[base.length - 1].m - base[0].m < 12) {
    for (let o = 0; o < octaves; o++) base.forEach(p => out.push({ m: p.m + 12 * o, f: p.f }));
    out.push({ m: base[0].m + 12 * octaves, f: base[base.length - 1].f });
    return out;
  }
  for (let o = 0; o < octaves; o++) base.forEach((p, i) => { if (o > 0 && i === 0) return; out.push({ m: p.m + 12 * o, f: i === base.length - 1 && o < octaves - 1 ? base[0].f : p.f }); });
  return out;
}
export function OctaveStage({ notes, label, octaves, hand, setHand, lang, onClose }: any) {
  const [both, setBoth] = useState(false);
  // The left hand starts an octave lower (C3, bass clef), the way a left-hand scale is taught.
  const shift = hand === "left" ? -12 : 0, upBase = useMemo(() => extendPattern(notes, octaves).map(q => ({ ...q, m: q.m + shift })), [notes, octaves, shift]);
  const seq = useMemo(() => both ? [...upBase, ...upBase.slice(0, -1).reverse()] : upBase, [upBase, both]);
  const staffSeq = useMemo(() => [...upBase, ...upBase.slice(0, -1).reverse()], [upBase]);   // the staff always shows the lesson going up and coming back down
  const [cur, setCur] = useState(-1); const [next, setNext] = useState(0); const [bad, setBad] = useState(-1); const [misses, setMisses] = useState(0); const [rounds, setRounds] = useState(0); const [praise, setPraise] = useState<string | null>(null); const [playing, setPlaying] = useState(false); const [portrait, setPortrait] = useState(false);
  const timer = useRef<any>(null);
  const T = { th: { play: "เล่นให้ดู", stop: "หยุด", close: "ปิด", notes: "โน้ต", left: "มือซ้าย", perfect: "เยี่ยม! รอบนี้ไม่พลาดเลย", done: "จบรอบแล้ว พลาด {n} ครั้ง ลองอีกรอบ", round: "รอบที่ผ่าน", right: "มือขวา", tap: "ถึงตาคุณ: กดคีย์ที่ไฟส้มรออยู่" }, en: { play: "Play it", stop: "Stop", close: "Close", notes: "Notes", left: "Left hand", perfect: "Perfect! No slips this round", done: "Round done, {n} slips. Go again", round: "Rounds", right: "Right hand", tap: "Your turn: press the key the orange light is on" }, zh: { play: "示范", stop: "停止", close: "关闭", notes: "音符", left: "左手", perfect: "太棒了！这一轮没有失误", done: "本轮完成，失误 {n} 次，再来一轮", round: "完成轮数", right: "右手", tap: "轮到你：按橙色灯亮着的琴键" } }[lang as "th" | "en" | "zh"] || ({} as any);
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
  // While the demo plays, the light follows it; otherwise it waits on the key the learner has to press next ("your turn").
  const idx = playing ? cur : Math.min(next, seq.length - 1), litM = idx >= 0 ? seq[idx].m : -1, finger = idx >= 0 ? seq[idx].f : 0;
  const tap = (m: number) => { try { playPianoNote(nameOf(m), 0.7, 1); } catch (e) {} if (playing) return; if (m === seq[idx].m) {
      if (idx + 1 >= seq.length) {   // one full round done: a short word of praise with the honest count of slips, no reward attached
        setRounds(r => r + 1);
        setPraise(misses === 0 ? T.perfect : T.done.replace("{n}", String(misses)));
        setTimeout(() => setPraise(null), 2600); setMisses(0);
      }
      setNext((idx + 1) % seq.length);
    } else { setBad(m); setMisses(x => x + 1); setTimeout(() => setBad(-1), 350); }
  };
  const staffIdx = idx < 0 ? -1 : both ? idx : idx;
  const inSeq = new Set(seq.map(s => s.m)); const fmap: Record<number, number | null> = {}; for (const q of seq) if (fmap[q.m] == null) fmap[q.m] = q.f;   // the finger to use on each taught key
  const litBlack = litM >= 0 && NAMES[litM % 12].length > 1, litW = litM >= 0 ? (litBlack ? wIndex(litM - 1) + 1 - 0.3 : wIndex(litM)) : 0, runLeft = litW * wW, runW = litBlack ? wW * 0.6 : wW;   // the orange running light sits on the key being taught and glides to the next
  return createPortal(
    <div className={"ost" + (portrait ? " rot" : "")} role="dialog" aria-label="octave practice">
      <div className="ost-top">
        <b className="ost-title">{label}</b><span className="ost-oct">{octaves}×</span>
        <div className="ost-notes" aria-label={T.notes}>{seq.map((s, i) => <span key={i} className={i === idx ? "on" : ""}>{NAMES[s.m % 12]}</span>)}</div>
        <button className="ost-btn" onClick={() => setHand(hand === "left" ? "right" : "left")}>{hand === "left" ? T.left : T.right} ⇄</button>
        <button className="ost-btn" onClick={() => { clearInterval(timer.current); setPlaying(false); setCur(-1); setNext(0); setBoth(!both); }} aria-pressed={both}>{both ? "↑↓" : "↑"}</button>
        <button className="ost-btn go" onClick={run}>{playing ? "⏸ " + T.stop : "▶ " + T.play}</button>
        <button className="ost-btn" onClick={onClose} aria-label={T.close}>✕</button>
      </div>
      <div className="ost-hands">
        {(["left", "right"] as const).map(h => (
          <div key={h} className={"ost-hand" + (hand === h ? " act" : "")} onClick={() => setHand(h)}>
            <FingerHand finger={hand === h ? (finger || 0) : 0} hand={h} />
            <span>{h === "left" ? T.left : T.right}</span>
          </div>
        ))}
        {(() => { const start = Math.floor(Math.max(0, staffIdx) / 16) * 16, here = staffIdx - start; return (
          <div className="ost-card"><StaffCard notes={staffSeq.slice(start, start + 16)} active={here >= 0 && here < 16 ? here : -1} title={"bars " + (start / 4 + 1) + "-" + (start / 4 + 4)} bass={hand === "left"} /></div>); })()}
      </div>
      <div className="ost-kbwrap">
        <div className="ost-kb">
          {whites.map(m => <button key={m} className={"ow" + (m === litM ? " lit" : inSeq.has(m) ? " in" : "") + (m === bad ? " bad" : "")} style={{ left: wIndex(m) * wW + "%", width: wW + "%" }} onClick={() => tap(m)} aria-label={nameOf(m)}>{fmap[m] != null && <b className="fn">{fmap[m]}</b>}<i>{NAMES[m % 12] === "C" ? nameOf(m) : NAMES[m % 12]}</i></button>)}
          {blacks.map(m => { const w = wIndex(m - 1); return <button key={m} className={"ob" + (m === litM ? " lit" : inSeq.has(m) ? " in" : "") + (m === bad ? " bad" : "")} style={{ left: (w + 1) * wW - wW * 0.3 + "%", width: wW * 0.6 + "%" }} onClick={() => tap(m)} aria-label={nameOf(m)}>{fmap[m] != null && <b className="fn">{fmap[m]}</b>}</button>; })}
          {litM >= 0 && <div className="ost-run" style={{ left: runLeft + "%", width: runW + "%" }} />}
        </div>
      </div>
      {praise && <div className="ost-praise" role="status">{praise}</div>}
      <div className="ost-hint">{T.tap}{rounds > 0 ? " · " + T.round + " " + rounds : ""}</div>
    </div>,
    document.body
  );
}
export const OCTAVE_CSS = `
.ost{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;gap:10px;padding:12px calc(14px + env(safe-area-inset-right,0px)) 10px env(safe-area-inset-left,0px);background:var(--bg,#fff);color:var(--text,#222);font-family:var(--f-app,system-ui)}
.ost.rot{inset:auto;top:0;left:100vw;width:100vh;height:100vw;transform-origin:top left;transform:rotate(90deg)}
.ost-top{padding-left:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.ost-title{font-size:18px}.ost-oct{font-weight:800;color:var(--clay,#d97757)}
.ost-notes{flex:1;display:flex;flex-wrap:wrap;gap:4px;min-width:140px}.ost-notes span{padding:3px 7px;border-radius:999px;background:var(--card2,#f3f3f3);font-size:12px;font-weight:700}.ost-notes span.on{background:var(--clay,#d97757);color:#fff}
.ost-btn{min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid var(--bd3,rgba(0,0,0,.2));background:var(--card,#fff);color:var(--text);font-weight:800;cursor:pointer}.ost-btn.go{background:var(--clay,#d97757);color:#fff;border-color:transparent}
.ost-hands{flex:1;min-height:0;display:flex;gap:10px;justify-content:flex-start;align-items:stretch}.ost-hand{flex:0 0 112px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px;border-radius:18px;background:var(--card,#fff);border:1.5px solid var(--bd2,rgba(0,0,0,.12));opacity:.55;cursor:pointer;overflow:hidden}.ost-hand.act{opacity:1;border-color:var(--clay,#d97757)}.ost-hand span{font-size:11px;font-weight:800}.ost-hand svg{max-height:78%;width:auto;max-width:100%}
.ost-card{flex:1 1 0;min-width:0;display:flex;align-items:center;justify-content:center;border-radius:18px;background:var(--card,#fff);border:1.5px solid var(--bd2,rgba(0,0,0,.12));color:var(--text,#222);padding:2px 6px;overflow:hidden}.ost-staff{width:100%;height:100%;max-height:100%}
.ost-kbwrap{flex:1;min-height:0;display:flex}.ost-kb{position:relative;flex:1;border-radius:14px;overflow:hidden;background:#111}
.ost-kb .ow{position:absolute;top:0;bottom:0;border:1px solid #888;border-top:0;background:#fff;border-radius:0 0 8px 8px;padding:0;cursor:pointer;display:flex;align-items:flex-end;justify-content:center}.ost-kb .ow i{font-style:normal;font-size:11px;font-weight:700;color:#666;margin-bottom:6px}
.ost-kb .ow.in{background:#fde7de}.ost-kb .ow.lit{background:#ff9a5a;box-shadow:inset 0 0 18px rgba(217,119,87,.9)}.ost-kb .ow.lit i{color:#fff}
.ost-kb .ob{position:absolute;top:0;height:60%;background:#1b1b1b;border:0;border-radius:0 0 6px 6px;z-index:2;cursor:pointer}.ost-kb .ob.in{background:#a8543a}.ost-kb .ob.lit{background:#ff7a2a;box-shadow:0 0 14px #ff7a2a}
.ost-kb .ow.bad{background:#ffb4b4!important}.ost-kb .ob.bad{background:#c0392b!important}
.ost-kb .fn{position:absolute;left:50%;bottom:30px;transform:translateX(-50%);min-width:22px;height:22px;line-height:22px;border-radius:50%;background:#fff;color:#c4562f;font-size:13px;font-weight:900;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.3);pointer-events:none}.ost-kb .ob .fn{bottom:8px;background:#ff9a5a;color:#fff}.ost-kb .lit .fn{background:#c4562f;color:#fff;min-width:30px;height:30px;line-height:30px;font-size:17px;bottom:34px;box-shadow:0 0 12px rgba(255,255,255,.9)}
.ost-run{position:absolute;top:0;height:8px;z-index:3;background:linear-gradient(90deg,#ffb36b,#ff6a1f);border-radius:0 0 8px 8px;box-shadow:0 0 18px 4px rgba(255,122,42,.85);transition:left .16s ease-out,width .16s ease-out;pointer-events:none}
@media (prefers-reduced-motion:reduce){.ost-run{transition:none}}
.ost-praise{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);background:var(--clay,#d97757);color:#fff;font-weight:800;padding:10px 20px;border-radius:999px;box-shadow:0 6px 20px rgba(0,0,0,.25);z-index:5;pointer-events:none}
.ost-hint{font-size:12px;color:var(--muted,#777);text-align:center}
`;

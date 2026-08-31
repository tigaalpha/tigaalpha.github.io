/* ══════════════════════════════════════════════════════════════════════
   ANSWER REVEAL — the part of a music quiz that actually teaches.

   Four options and a green tick tell a learner whether they were right.
   They do not tell them what the answer WAS, and a multiple-choice question
   answered correctly by elimination teaches nothing at all. So every answer,
   right or wrong, now resolves onto the two representations a musician
   actually reads: where the note sits under the hand, and where it sits on
   the staff.

   Deliberately standalone — no imports from the arena or the RPG that use
   it, so neither can pull the other in through this file.
   ══════════════════════════════════════════════════════════════════════ */

import { memo, useEffect, useMemo, useRef } from "react";

const LET = ["C", "D", "E", "F", "G", "A", "B"];
const LET_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/* Which white key each black key sits after, and how it is spelled either
   way — a keyboard has to light F# and Gb on the same key. */
const BLACK_AFTER = [0, 1, 3, 4, 5];   // C# D# F# G# A#, as indices into LET

function parse(n) {
  const name = String(n || "").trim();
  const L = name.charAt(0).toUpperCase();
  const acc = name.slice(1).split("").reduce((a, c) => a + (c === "#" ? 1 : c === "b" ? -1 : 0), 0);
  return { L, li: Math.max(0, LET.indexOf(L)), acc, pc: ((LET_PC[L] || 0) + acc + 120) % 12 };
}

/* Notes arrive as pitch classes with no octave, but an interval only reads
   as an interval if the second note is ABOVE the first. Walk the list and
   push each note into the first octave that keeps it ascending — which also
   gives the staff the diatonic step number it needs. */
function layout(names) {
  let oct = 4, prev = -1;
  return (names || []).filter(Boolean).map(n => {
    const p = parse(n);
    let abs = oct * 7 + p.li;
    while (abs <= prev) { oct += 1; abs = oct * 7 + p.li; }
    prev = abs;
    return { ...p, name: n, oct, abs, midi: (oct + 1) * 12 + p.pc };
  });
}

/* ── the staff ──
   Treble clef. The bottom line is E4, and one staff STEP is half a line gap,
   so the whole thing is one subtraction once the notes carry a diatonic
   number. Ledger lines are drawn for anything past either end, which is what
   makes middle C legible rather than a dot floating under the stave. */
const E4 = 4 * 7 + 2;          // diatonic index of the bottom line
const GAP = 11;                // pixels between staff lines
const STAFF_W = 250, STAFF_H = 142, BOT = 108;   // BOT = y of the bottom line
const yOf = (abs) => BOT - (abs - E4) * (GAP / 2);

/* The clef is generated, not typed. The glyph is missing from plenty of
   system fonts and a tofu box where the clef should be is worse than no
   clef at all, so the head is a real logarithmic spiral wound onto the G
   line — the one part of the shape that carries information — with the bow
   and the tail drawn around it. */
const CLEF = (() => {
  const cx = 41, gy = BOT - GAP;                       // spiral centre = G4
  const turns = 1.55, steps = 84, r0 = 16.5, r1 = 1.8;
  const pt = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const th = Math.PI / 2 - turns * 2 * Math.PI * t;  // bottom, then anticlockwise
    const r = r0 * Math.pow(r1 / r0, t);
    pt.push(`${(cx + r * Math.cos(th)).toFixed(1)} ${(gy + r * Math.sin(th)).toFixed(1)}`);
  }
  const head = `M 46 50 C 47 39 37 35 33 44 C 29 54 27 66 29 78 C 31 92 34 105 ${pt[0]} L ` + pt.slice(1).join(" L ");
  const stem = `M 40 46 L 41 120 C 41 130 33 134 29 129 C 26 125 28 120 33 121`;
  return { head, stem };
})();

const Staff = memo(function Staff({ notes, hi, bad }) {
  /* Fit the group to the stave. A fixed step ran an eight-note scale clean
     off the right-hand edge, which is exactly the question type where seeing
     every note matters most. */
  const n = notes.length;
  const room = STAFF_W - 96 - 18;
  const step = n > 1 ? Math.max(15, Math.min(34, room / (n - 1))) : 0;
  const x0 = 84 + Math.max(0, (room - step * (n - 1))) / 2;
  const xs = notes.map((_, i) => x0 + i * step);
  return (
    <svg viewBox={`0 0 ${STAFF_W} ${STAFF_H}`} width="100%" height="100%" aria-hidden="true" className="nrv-staff">
      {[0, 1, 2, 3, 4].map(i => (
        <line key={i} x1="14" x2={STAFF_W - 10} y1={BOT - i * GAP} y2={BOT - i * GAP}
          stroke="#8fa6c8" strokeWidth="1.2" opacity=".65" />
      ))}
      <g stroke="#dbe6f7" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={CLEF.stem} />
        <path d={CLEF.head} />
      </g>
      {notes.map((n, i) => {
        const y = yOf(n.abs), x = xs[i];
        const isHi = hi.includes(n.name), isBad = bad.includes(n.name);
        const col = isBad ? "#ff6a6a" : isHi ? "#3fb9ff" : "#c3d2ea";
        // ledger lines above and below the stave
        const led = [];
        for (let a = E4 - 2; a >= n.abs; a -= 2) led.push(a);
        for (let a = E4 + 10; a <= n.abs; a += 2) led.push(a);
        return (
          <g key={i}>
            {led.map(a => <line key={a} x1={x - 12} x2={x + 12} y1={yOf(a)} y2={yOf(a)} stroke="#8fa6c8" strokeWidth="1.2" opacity=".8" />)}
            {isHi && <ellipse cx={x} cy={y} rx="14" ry="11" fill={col} opacity=".22" />}
            <ellipse cx={x} cy={y} rx="7.4" ry="5.6" fill={col} transform={`rotate(-18 ${x} ${y})`} />
            <line x1={x + 7} x2={x + 7} y1={y} y2={Math.max(18, y - 32)} stroke={col} strokeWidth="1.9" />
            {n.acc !== 0 && (
              <text x={x - 15} y={y + 5} fontSize="17" fontWeight="700" fill={col} textAnchor="middle"
                fontFamily="Georgia, 'Times New Roman', serif">{n.acc > 0 ? "♯" : "♭"}</text>
            )}
            <text x={x} y={Math.max(11, y - 40)} fontSize="11.5" fontWeight="700" fill={col} textAnchor="middle"
              fontFamily="'Rajdhani', sans-serif">{n.name}</text>
          </g>
        );
      })}
    </svg>
  );
});

/* ── the keyboard ──
   Two octaves from C4, drawn with a lip and a shadow so it reads as keys you
   could press rather than as a barcode. A lit key gets the blue glow, a wrong
   one red, and both carry the note name on the key itself — the whole point
   is to connect the name to the place. */
const KB_W = 336, KB_H = 96, WHITES = 14, WW = KB_W / WHITES;

const Keys = memo(function Keys({ notes, hi, bad }) {
  const litPc = useMemo(() => {
    const m = new Map();
    for (const n of notes) m.set(n.midi, bad.includes(n.name) ? "bad" : hi.includes(n.name) ? "hi" : "on");
    return m;
  }, [notes, hi, bad]);
  const nameOf = (midi) => (notes.find(n => n.midi === midi) || {}).name || "";

  const whites = [];
  for (let i = 0; i < WHITES; i++) {
    const oct = 4 + Math.floor(i / 7), li = i % 7;
    whites.push({ i, midi: (oct + 1) * 12 + LET_PC[LET[li]], li });
  }
  const blacks = [];
  for (let i = 0; i < WHITES; i++) {
    const li = i % 7;
    if (!BLACK_AFTER.includes(li)) continue;
    if (i === WHITES - 1) continue;
    const oct = 4 + Math.floor(i / 7);
    blacks.push({ i, midi: (oct + 1) * 12 + LET_PC[LET[li]] + 1 });
  }

  return (
    <svg viewBox={`0 0 ${KB_W} ${KB_H}`} width="100%" height="100%" aria-hidden="true" className="nrv-keys">
      <defs>
        <linearGradient id="nrv-w" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" /><stop offset="72%" stopColor="#eef2f8" /><stop offset="100%" stopColor="#c8d1e0" />
        </linearGradient>
        <linearGradient id="nrv-b" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#39415a" /><stop offset="72%" stopColor="#161c2b" /><stop offset="100%" stopColor="#080c16" />
        </linearGradient>
        <linearGradient id="nrv-lit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d8f2ff" /><stop offset="55%" stopColor="#5cc8ff" /><stop offset="100%" stopColor="#1d7fc4" />
        </linearGradient>
        <linearGradient id="nrv-badg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffdede" /><stop offset="55%" stopColor="#ff7a7a" /><stop offset="100%" stopColor="#b83030" />
        </linearGradient>
      </defs>

      {whites.map(w => {
        const st = litPc.get(w.midi);
        return (
          <g key={"w" + w.i}>
            {st && <rect x={w.i * WW - 3} y={-4} width={WW + 6} height={KB_H + 8}
              fill={st === "bad" ? "#ff6a6a" : "#3fb9ff"} opacity=".3" />}
            <rect x={w.i * WW + 0.6} y={0} width={WW - 1.2} height={KB_H - 4} rx="3"
              fill={st === "bad" ? "url(#nrv-badg)" : st ? "url(#nrv-lit)" : "url(#nrv-w)"}
              stroke="#0d1424" strokeWidth="1" />
            <rect x={w.i * WW + 0.6} y={KB_H - 10} width={WW - 1.2} height="6" rx="2" fill="#00060f" opacity=".18" />
            {st && <text x={w.i * WW + WW / 2} y={KB_H - 16} fontSize="11" fontWeight="800" textAnchor="middle"
              fill="#06243a" fontFamily="'Rajdhani',sans-serif">{nameOf(w.midi)}</text>}
          </g>
        );
      })}

      {blacks.map(b => {
        const st = litPc.get(b.midi);
        const x = (b.i + 1) * WW - WW * 0.3;
        return (
          <g key={"b" + b.i}>
            {st && <rect x={x - 4} y={-4} width={WW * 0.6 + 8} height={KB_H * 0.64 + 8}
              fill={st === "bad" ? "#ff6a6a" : "#3fb9ff"} opacity=".34" />}
            <rect x={x} y={0} width={WW * 0.6} height={KB_H * 0.62} rx="2.5"
              fill={st === "bad" ? "url(#nrv-badg)" : st ? "url(#nrv-lit)" : "url(#nrv-b)"}
              stroke="#00060f" strokeWidth="1" />
            <rect x={x + 1} y={1} width={WW * 0.6 - 2} height="5" rx="2" fill="#ffffff" opacity={st ? ".5" : ".14"} />
            {st && <text x={x + WW * 0.3} y={KB_H * 0.62 - 7} fontSize="9.5" fontWeight="800" textAnchor="middle"
              fill="#06243a" fontFamily="'Rajdhani',sans-serif">{nameOf(b.midi)}</text>}
          </g>
        );
      })}
    </svg>
  );
});

/** The reveal itself. `q` is a question from the arena's bank, `chosen` is
    what the player pressed. Shows for both outcomes on purpose: being right
    by elimination and being right by knowing look identical on a scoreboard
    and are not the same thing. */
export const AnswerReveal = memo(function AnswerReveal({ q, chosen, lang, onNext, nextLabel }) {
  const T = (th, en, zh) => (lang === "th" ? th : lang === "zh" ? zh : en);
  const teach = (q && q.teach) || { notes: [q && q.ans].filter(Boolean), hi: [q && q.ans].filter(Boolean) };
  const notes = useMemo(() => layout(teach.notes), [teach.notes]);
  const hi = teach.hi || [];
  const bad = teach.bad || [];
  const right = chosen === q.ans;

  /* On a phone the fight fills the screen and the reveal opens below the
     fold, so the lesson would be a card the learner never scrolls down to. */
  const box = useRef(null);
  useEffect(() => {
    const el = box.current;
    if (el && el.scrollIntoView) { try { el.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {} }
  }, [q]);

  return (
    <div className={`nrv${right ? " ok" : " no"}`} ref={box}>
      <div className="nrv-head">
        <span className="nrv-verdict">{right ? T("ถูกต้อง", "Correct", "正确") : T("ยังไม่ใช่", "Not quite", "还不对")}</span>
        <span className="nrv-ans">{q.ans}</span>
        {teach.label && <span className="nrv-lab">{teach.label}</span>}
      </div>
      {!right && <div className="nrv-you">{T("คุณตอบ", "You chose", "你选了")} <b>{chosen}</b></div>}
      <div className="nrv-staffwrap"><Staff notes={notes} hi={hi} bad={bad} /></div>
      <div className="nrv-keyswrap"><Keys notes={notes} hi={hi} bad={bad} /></div>
      {onNext && <button className="nrv-next" onClick={onNext}>{nextLabel || T("ต่อไป", "Continue", "继续")}</button>}
    </div>
  );
});

export default AnswerReveal;

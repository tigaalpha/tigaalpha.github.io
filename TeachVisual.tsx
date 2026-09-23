import { memo } from "react";

/* ── TeachVisual.tsx — Auto Teaching 2.0 visual engine (plan §4.3) ──
   All-SVG, zero dependencies, theme-aware via the app's CSS variables
   (light/dark safe — same approach as TigamodelLab). Two families:
   • learner DATA charts  — mini-keyboard (their missed pitch classes),
     bars (their 7-day accuracy), donut (their level progress),
     before-after (their measured improvement). Data comes only from real
     practice records; when there's not enough data App.tsx never mounts one.
   • concept DIAGRAMS     — rhythm-grid, kb-scale, half-steps, dynamics —
     static textbook-style figures attached to teach-cards (no fake stats). ── */

const C = {
  text: "var(--text,#1c160e)",
  muted: "var(--muted,#8a8177)",
  accent: "var(--accent,#d97757)",
  line: "var(--bd1,rgba(0,0,0,0.12))",
  miss: "#f97316",
  ok: "#22c55e",
  keyFill: "var(--card,#ffffff)",
  keyDark: "#1f2937",
};

function Svg({ children, label }) {
  return (
    <svg viewBox="0 0 320 92" style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

/* one octave of white keys + the five black keys; missed pitch classes glow orange */
const WHITES = ["C", "D", "E", "F", "G", "A", "B"];
const BLACKS = [{ pc: "C#", i: 1 }, { pc: "D#", i: 2 }, { pc: "F#", i: 4 }, { pc: "G#", i: 5 }, { pc: "A#", i: 6 }];

function KeyboardBase({ miss = {}, highlights = [] }) {
  const W = 320 / 7;
  const isMissPc = (pc) => !!(miss && miss[pc] != null && miss[pc] > 0);
  const hl = new Set(highlights);
  return (
    <g>
      {WHITES.map((pc, i) => {
        const missed = isMissPc(pc);
        const hot = hl.has(pc);
        return (
          <g key={pc}>
            <rect x={i * W + 1.5} y={6} width={W - 3} height={66} rx={5}
              fill={missed ? C.miss : hot ? C.accent : C.keyFill}
              stroke={missed || hot ? "transparent" : C.line} strokeWidth={1} />
            <text x={i * W + W / 2} y={86} textAnchor="middle" fontSize={9}
              fill={missed || hot ? C.accent : C.muted} fontWeight={missed || hot ? 700 : 500}>{pc}</text>
          </g>
        );
      })}
      {BLACKS.map(({ pc, i }) => {
        const missed = isMissPc(pc);
        return (
          <rect key={pc} x={i * W - 8} y={6} width={16} height={40} rx={3}
            fill={missed ? C.miss : C.keyDark} stroke={missed ? "transparent" : "rgba(255,255,255,0.18)"} strokeWidth={1} />
        );
      })}
    </g>
  );
}

const MiniKeyboard = memo(function MiniKeyboard({ miss, lang }) {
  const total = Object.values(miss || {}).reduce((a, b) => a + (b || 0), 0);
  const cap = lang === "th" ? `โน้ตที่พลาดบ่อย (ทั้งหมด ${total} ครั้ง)` : lang === "zh" ? `常错音（共${total}次）` : `Most-missed notes (${total} total)`;
  return <Svg label={cap}><KeyboardBase miss={miss} /></Svg>;
});

const AccuracyBars = memo(function AccuracyBars({ days, lang }) {
  const list = (days || []).slice(-7);
  if (!list.length) return null;
  const n = list.length;
  const slot = 320 / n;
  const bw = Math.min(26, slot * 0.55);
  const base = 74;
  return (
    <Svg label="accuracy last 7 days">
      <line x1={0} y1={base} x2={320} y2={base} stroke={C.line} strokeWidth={1} />
      {list.map((d, i) => {
        const h = Math.max(3, 58 * Math.min(100, Math.max(0, d.pct)) / 100);
        const x = i * slot + (slot - bw) / 2;
        const last = i === n - 1;
        return (
          <g key={i}>
            <rect x={x} y={base - h} width={bw} height={h} rx={4} fill={C.accent} opacity={last ? 1 : 0.45} />
            {last && <text x={x + bw / 2} y={base - h - 4} textAnchor="middle" fontSize={10} fontWeight={800} fill={C.text}>{d.pct}%</text>}
            <text x={x + bw / 2} y={base + 12} textAnchor="middle" fontSize={8.5} fill={C.muted}>{d.d}</text>
          </g>
        );
      })}
    </Svg>
  );
});

const DonutProgress = memo(function DonutProgress({ pct, label, lang }) {
  const R = 30, CIRC = 2 * Math.PI * R;
  const v = Math.max(0, Math.min(100, pct || 0));
  const cap = lang === "th" ? "ความคืบหน้า" : lang === "zh" ? "进度" : "Progress";
  return (
    <Svg label={cap}>
      <circle cx={46} cy={46} r={R} fill="none" stroke={C.line} strokeWidth={9} />
      <circle cx={46} cy={46} r={R} fill="none" stroke={C.accent} strokeWidth={9} strokeLinecap="round"
        strokeDasharray={`${(v / 100) * CIRC} ${CIRC}`} transform="rotate(-90 46 46)" />
      <text x={46} y={50} textAnchor="middle" fontSize={14} fontWeight={800} fill={C.text}>{Math.round(v)}%</text>
      <text x={96} y={43} fontSize={11.5} fontWeight={700} fill={C.text}>{label || cap}</text>
      <text x={96} y={59} fontSize={9.5} fill={C.muted}>{cap}</text>
    </Svg>
  );
});

const BeforeAfter = memo(function BeforeAfter({ before, after, label, lang }) {
  const b = Math.max(0, Math.min(100, before ?? 0));
  const a = Math.max(0, Math.min(100, after ?? 0));
  const delta = Math.round(a - b);
  const cap = lang === "th" ? "ก่อน" : lang === "zh" ? "之前" : "Before";
  const cap2 = lang === "th" ? "หลังซ้อมตามคำแนะนำ" : lang === "zh" ? "按建议练习后" : "After coaching";
  return (
    <Svg label="before after">
      <text x={0} y={16} fontSize={9.5} fill={C.muted}>{cap}</text>
      <rect x={52} y={6} width={Math.max(4, 200 * b / 100)} height={14} rx={4} fill={C.line} />
      <text x={52 + Math.max(4, 200 * b / 100) + 6} y={17} fontSize={9.5} fill={C.muted}>{b}%</text>
      <text x={0} y={44} fontSize={9.5} fill={C.muted}>{cap2}</text>
      <rect x={52} y={34} width={Math.max(4, 200 * a / 100)} height={14} rx={4} fill={C.accent} />
      <text x={52 + Math.max(4, 200 * a / 100) + 6} y={45} fontSize={9.5} fontWeight={700} fill={C.text}>{a}%</text>
      {delta !== 0 && (
        <g>
          <rect x={52} y={60} width={64} height={20} rx={10} fill={delta > 0 ? "rgba(34,197,94,0.14)" : "rgba(249,115,22,0.14)"} />
          <text x={84} y={74} textAnchor="middle" fontSize={10.5} fontWeight={800}
            fill={delta > 0 ? C.ok : C.miss}>{delta > 0 ? "+" : ""}{delta}%</text>
        </g>
      )}
      {label ? <text x={128} y={74} fontSize={9.5} fill={C.muted}>{String(label).slice(0, 34)}</text> : null}
    </Svg>
  );
});

/* concept diagram: strong/weak beats of a bar */
const RhythmGrid = memo(function RhythmGrid({ beats, lang }) {
  const list = beats || [1, 0.4, 0.6, 0.4];
  const n = list.length;
  const slot = 320 / n;
  const bw = slot * 0.6;
  const base = 66;
  return (
    <Svg label="beat pattern">
      {list.map((v, i) => {
        const h = 14 + 44 * v;
        const strong = v >= 1;
        return (
          <g key={i}>
            <rect x={i * slot + (slot - bw) / 2} y={base - h} width={bw} height={h} rx={5}
              fill={strong ? C.accent : C.accent} opacity={strong ? 1 : 0.35 + 0.4 * v} />
            <text x={i * slot + slot / 2} y={base + 14} textAnchor="middle" fontSize={9.5}
              fill={strong ? C.accent : C.muted} fontWeight={strong ? 800 : 500}>{i + 1}</text>
          </g>
        );
      })}
      <text x={320} y={86} textAnchor="end" fontSize={8.5} fill={C.muted}>
        {lang === "th" ? "ตัวหนา = จังหวะหนัก" : lang === "zh" ? "深色 = 重拍" : "dark = strong beat"}
      </text>
    </Svg>
  );
});

/* concept diagram: highlighted notes on one octave */
const KbScale = memo(function KbScale({ notes }) {
  return <Svg label="keyboard highlight"><KeyboardBase highlights={notes || []} /></Svg>;
});

/* concept diagram: the two no-black-key neighbour pairs */
const HalfSteps = memo(function HalfSteps({ notes, lang }) {
  const [a, b] = (notes && notes.length >= 2) ? notes : ["E", "F"];
  const W = 64;
  const x0 = 96;
  return (
    <Svg label="semitone pair">
      <rect x={x0} y={10} width={W} height={62} rx={6} fill={C.keyFill} stroke={C.accent} strokeWidth={1.6} />
      <rect x={x0 + W + 46} y={10} width={W} height={62} rx={6} fill={C.keyFill} stroke={C.accent} strokeWidth={1.6} />
      <text x={x0 + W / 2} y={48} textAnchor="middle" fontSize={17} fontWeight={800} fill={C.text}>{a}</text>
      <text x={x0 + W + 46 + W / 2} y={48} textAnchor="middle" fontSize={17} fontWeight={800} fill={C.text}>{b}</text>
      <text x={x0 + W + 23} y={48} textAnchor="middle" fontSize={15} fontWeight={800} fill={C.accent}>½</text>
      <text x={x0 + W + 23} y={64} textAnchor="middle" fontSize={8} fill={C.muted}>
        {lang === "th" ? "ไม่มีดำคั่น" : lang === "zh" ? "无黑键" : "no black key"}
      </text>
      <text x={160} y={88} textAnchor="middle" fontSize={8.5} fill={C.muted}>
        {lang === "th" ? "คู่เดียวกัน: B–C" : lang === "zh" ? "另一对: B–C" : "the other pair: B–C"}
      </text>
    </Svg>
  );
});

/* concept diagram: p→f volume range with the learner's target marked */
const DynamicsBar = memo(function DynamicsBar({ mark, lang }) {
  const marks = ["pp", "p", "mp", "mf", "f", "ff"];
  const n = marks.length;
  const slot = 320 / n;
  const bw = slot * 0.55;
  const m = Math.max(0, Math.min(n - 1, mark ?? 3));
  return (
    <Svg label="dynamics range">
      {marks.map((s, i) => (
        <g key={s}>
          <rect x={i * slot + (slot - bw) / 2} y={14} width={bw} height={50} rx={5}
            fill={C.accent} opacity={0.12 + (0.88 * i) / (n - 1)} />
          {i === m && <rect x={i * slot + (slot - bw) / 2 - 3} y={11} width={bw + 6} height={56} rx={7} fill="none" stroke={C.text} strokeWidth={1.8} />}
          <text x={i * slot + slot / 2} y={82} textAnchor="middle" fontSize={9.5}
            fill={i === m ? C.text : C.muted} fontWeight={i === m ? 800 : 500}>{s}</text>
        </g>
      ))}
    </Svg>
  );
});

export function TeachVisual({ type, data, lang = "th" }) {
  if (!type || !data) return null;
  switch (type) {
    case "mini-keyboard": return <MiniKeyboard miss={data.miss} lang={lang} />;
    case "bars": return <AccuracyBars days={data.days} lang={lang} />;
    case "donut": return <DonutProgress pct={data.pct} label={data.label} lang={lang} />;
    case "before-after": return <BeforeAfter before={data.before} after={data.after} label={data.label} lang={lang} />;
    case "rhythm-grid": return <RhythmGrid beats={data.beats} lang={lang} />;
    case "kb-scale": return <KbScale notes={data.notes} />;
    case "half-steps": return <HalfSteps notes={data.notes} lang={lang} />;
    case "dynamics": return <DynamicsBar mark={data.mark} lang={lang} />;
    default: return null;
  }
}

export default memo(TeachVisual);

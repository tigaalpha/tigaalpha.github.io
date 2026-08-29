/* ── item-art.tsx ──
   Every piece of gear used to be an emoji. An emoji is somebody else's drawing,
   at somebody else's scale, in somebody else's palette — a wrench next to a
   firework next to a die-cut shield, none of them lit the same way and none of
   them the colour of the thing they are supposed to be. Ninety-nine items drawn
   by hand would be ninety-nine chances to be inconsistent, so instead there are
   archetypes: a blaster, a coil, a helm, a plating, a core. An item names the
   archetype it is and hands over its own two or three swatch colours, and one
   renderer draws it with the same light every other item gets.

   The lighting is the same rig the character uses — fill, form shadow, key
   highlight, outline, all in object-bounding-box space so each shape shades
   from its own geometry. Gradients, not filters: an inventory screen can have
   sixty of these on it at once. ── */

import { useId } from "react";

/* ── colour ──
   Swatches arrive as flat hex. A material needs a ramp, so each one is bent
   toward white for the lit face and toward a cold near-black for the shadow —
   cold rather than pure black because metal in daylight picks up sky in its
   dark end, and pure black is what makes vector art look printed. */
const hx = (h) => {
  const s = String(h || "#8fa6c8").replace("#", "");
  const v = s.length === 3 ? s.split("").map(c => c + c).join("") : s;
  return [parseInt(v.slice(0, 2), 16) || 0, parseInt(v.slice(2, 4), 16) || 0, parseInt(v.slice(4, 6), 16) || 0];
};
const toHex = (r, g, b) => "#" + [r, g, b].map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
const mix = (a, b, t) => { const A = hx(a), B = hx(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
const lite = (c, t = .5) => mix(c, "#ffffff", t);
const dim = (c, t = .5) => mix(c, "#0b1020", t);

export function ItemArt({ art = "module", sw = [], size, className = "" }) {
  const uid = "ia" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const A = sw[0] || "#9fb2d2";
  const B = sw[1] || "#26324a";
  const C = sw[2] || A;
  const edge = dim(A, .58);
  const edgeB = dim(B, .4);
  const GA = `url(#${uid}-a)`, GB = `url(#${uid}-b)`, GC = `url(#${uid}-c)`, GLOW = `url(#${uid}-glow)`;

  /* one plate, five passes — the same treatment the character's armour gets */
  const P = (d, f, o = {}) => (
    <g key={o.k}>
      <path d={d} fill={f} />
      <path d={d} fill={`url(#${uid}-occ)`} opacity={o.occ == null ? 1 : o.occ} />
      <path d={d} fill={`url(#${uid}-spec)`} opacity={o.spec == null ? 1 : o.spec} />
      <path d={d} fill="none" stroke={o.line || edge} strokeWidth={o.lw || 1.4} strokeLinejoin="round" strokeLinecap="round" opacity={o.lineOp == null ? .95 : o.lineOp} />
    </g>
  );
  const R = (x, y, w, h, r, f, o = {}) =>
    P(`M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`, f, o);
  const E = (cx, cy, rx, ry, f, o = {}) =>
    P(`M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z`, f, o);
  // a lit element: the thing itself plus the bloom it throws
  const lit = (cx, cy, r, col = C) => (
    <g>
      <circle cx={cx} cy={cy} r={r * 2.4} fill={GLOW} />
      <circle cx={cx} cy={cy} r={r} fill={lite(col, .3)} />
      <circle cx={cx} cy={cy} r={r * .45} fill="#fff" opacity=".95" />
    </g>
  );
  const seam = (d, w = 1.1) => (
    <g>
      <path d={d} fill="none" stroke="#050a14" strokeWidth={w} strokeLinecap="round" opacity=".45" />
      <path d={d} fill="none" stroke="#ffffff" strokeWidth={w * .5} strokeLinecap="round" opacity=".4" transform="translate(0 .9)" />
    </g>
  );
  const beamLine = (d, w) => (
    <g>
      <path d={d} fill="none" stroke={C} strokeWidth={w * 2.6} strokeLinecap="round" opacity=".2" />
      <path d={d} fill="none" stroke={lite(C, .3)} strokeWidth={w} strokeLinecap="round" opacity=".9" />
      <path d={d} fill="none" stroke="#fff" strokeWidth={w * .42} strokeLinecap="round" />
    </g>
  );


  /* Each outfit is one of these surface passes over the same plate. */
  const PATTERNS = {
    "out-tshirt": <>{seam("M32 8 V56")}{seam("M16 26 H48")}</>,
    "out-hoodie": <>{[0, 1, 2].map(i => <g key={i}>{[0, 1, 2].map(j => <circle key={j} cx={20 + j * 12} cy={20 + i * 13} r="5" fill="none" stroke={lite(C, .3)} strokeWidth="2.2" />)}</g>)}</>,
    "out-jacket": <>{[0, 1, 2, 3].map(i => <path key={i} d={`M8 ${14 + i * 12} L56 ${20 + i * 12}`} stroke={lite(C, .25)} strokeWidth="3.4" strokeLinecap="round" strokeDasharray="7 4" />)}</>,
    "out-dress": <>{[[32, 22], [22, 36], [42, 36], [32, 48]].map(([x, y], i) => <path key={i} d={`M${x} ${y - 8} L${x + 7} ${y} L${x} ${y + 8} L${x - 7} ${y} Z`} fill={lite(C, .35)} stroke={lite(C, .6)} strokeWidth=".9" opacity=".85" />)}</>,
    "out-kimono": <>{[0, 1, 2].map(i => <path key={i} d={`M10 ${20 + i * 12} C20 ${14 + i * 12} 26 ${26 + i * 12} 34 ${20 + i * 12} C42 ${14 + i * 12} 48 ${26 + i * 12} 56 ${20 + i * 12}`} fill="none" stroke={lite(C, .2)} strokeWidth="3" strokeLinecap="round" opacity=".85" />)}</>,
    "out-armor": <>{P("M32 14 L46 20 C46 34 40 44 32 50 C24 44 18 34 18 20 Z", GC, { line: lite(C, .3), lw: 1.2 })}{lit(32, 30, 4)}</>,
    "out-tuxedo": <>{P("M32 4 L56 12 C56 34 46 50 32 60 Z", "#0a0d18", { spec: .35, occ: .4 })}{seam("M32 8 V56")}</>,
    "out-royal": <>{[[32, 20], [21, 33], [43, 33], [32, 44]].map(([x, y], i) => <g key={i}><path d={`M${x} ${y - 9} L${x + 8} ${y} L${x} ${y + 9} L${x - 8} ${y} Z`} fill={lite(C, .55)} stroke="#fff" strokeWidth="1" opacity=".9" /><path d={`M${x} ${y - 9} L${x} ${y + 9} M${x - 8} ${y} L${x + 8} ${y}`} stroke="#fff" strokeWidth=".8" opacity=".7" /></g>)}</>,
    "out-celestial": <>{[[20, 18], [42, 24], [28, 36], [46, 42], [22, 48]].map(([x, y], i) => <g key={i}><path d={`M${x} ${y - 6} L${x + 1.8} ${y - 1.8} L${x + 6} ${y} L${x + 1.8} ${y + 1.8} L${x} ${y + 6} L${x - 1.8} ${y + 1.8} L${x - 6} ${y} L${x - 1.8} ${y - 1.8} Z`} fill={lite(C, .6)} opacity=".95" /></g>)}</>,
    "out-alloy": <>{[0, 1, 2, 3, 4].map(i => <path key={i} d={`M${10 + i * 11} 8 L${18 + i * 11} 60`} stroke={lite(C, .22)} strokeWidth="3.4" opacity=".8" />)}</>,
    "out-carbon": <>{Array.from({ length: 5 }).map((_, r) => Array.from({ length: 5 }).map((_, c) => <rect key={`${r}${c}`} x={8 + c * 10 + (r % 2 ? 5 : 0)} y={10 + r * 10} width="8" height="8" rx="1.5" fill="none" stroke={lite(C, .18)} strokeWidth="1.4" />))}</>,
    "out-cryo": <>{[[24, 22], [42, 34], [26, 46]].map(([x, y], i) => <g key={i} stroke={lite(C, .55)} strokeWidth="1.8" strokeLinecap="round"><path d={`M${x} ${y - 8} V${y + 8} M${x - 7} ${y - 4} L${x + 7} ${y + 4} M${x + 7} ${y - 4} L${x - 7} ${y + 4}`} /></g>)}</>,
    "out-magma": <>{[0, 1, 2].map(i => <path key={i} d={`M${12 + i * 6} 56 C${18 + i * 8} 42 ${14 + i * 10} 30 ${24 + i * 10} 12`} fill="none" stroke={lite(C, .3)} strokeWidth="3.2" strokeLinecap="round" opacity=".9" />)}</>,
    "out-prism": <>{[[32, 14, 52, 24, 32, 34], [32, 34, 52, 24, 44, 48], [32, 14, 12, 24, 32, 34], [32, 34, 12, 24, 20, 48]].map((t, i) => <path key={i} d={`M${t[0]} ${t[1]} L${t[2]} ${t[3]} L${t[4]} ${t[5]} Z`} fill={lite(C, i % 2 ? .5 : .25)} stroke="#fff" strokeWidth=".7" opacity=".8" />)}</>,
    "out-titan": <>{P("M14 16 H50 V26 H14 Z", GC, { line: lite(C, .3), lw: 1 })}{P("M18 30 H46 V40 H18 Z", GB, { line: edgeB, lw: 1 })}{lit(32, 48, 4)}</>,
  };

  const SHAPES = {
    /* ── weapons ── */
    sword: () => <>
      {P("M21 45 C27 35 37 20 46 9 L53 15 C45 27 33 42 26 51 Z", GA)}
      {beamLine("M46 9 L53 15", 1.6)}
      {seam("M25 43 C31 34 39 22 47 12")}
      {P("M13 43 L26 56 L21 61 L8 48 Z", GB, { line: edgeB })}
      {P("M9 51 L17 59 L12 62 L6 56 Z", GB, { line: edgeB })}
      {lit(16.5, 51.5, 2.2)}
    </>,
    cutter: () => <>
      {P("M40 10 L46 16 L34 28 L28 22 Z", GB, { line: edgeB })}
      <g>
        <path d="M38 36 m-16 0 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0" fill={GA} stroke={edge} strokeWidth="1.4" />
        <path d="M38 36 m-16 0 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0" fill={`url(#${uid}-occ)`} />
        {Array.from({ length: 10 }).map((_, i) => (
          <path key={i} d="M38 20 l3.2 -5 l3 5 Z" fill={GC} stroke={edge} strokeWidth=".6"
            transform={`rotate(${i * 36} 38 36) translate(-1.6 0)`} />
        ))}
      </g>
      {E(38, 36, 6, 6, GB, { line: edgeB })}
      {lit(38, 36, 2.6)}
      {R(6, 30, 20, 12, 5, GB, { line: edgeB })}
      {seam("M10 36 H22")}
    </>,
    driver: () => <>
      {R(10, 20, 30, 22, 7, GA)}
      {seam("M15 27 H35 M15 33 H31")}
      {R(38, 26, 12, 10, 3, GB, { line: edgeB })}
      {P("M50 28 L60 30 L60 32 L50 34 Z", GC, { line: edge })}
      {R(14, 40, 13, 20, 5, GB, { line: edgeB })}
      {lit(18, 25, 2.2)}
    </>,
    coil: () => <>
      {R(27, 16, 10, 44, 5, GB, { line: edgeB })}
      {[22, 32, 42].map((y, i) => <g key={i}>{E(32, y, 15 - i * 1.5, 5, GA)}</g>)}
      {beamLine("M32 16 C24 10 22 6 24 3 M32 16 C40 10 42 6 40 3", 1.4)}
      {lit(32, 12, 4)}
      {seam("M32 46 V58")}
    </>,
    hammer: () => <>
      {P("M12 12 L46 12 L50 20 L50 30 L46 38 L12 38 L8 30 L8 20 Z", GA)}
      {seam("M20 16 V34 M38 16 V34")}
      {R(26, 34, 10, 28, 4, GB, { line: edgeB })}
      {lit(14, 25, 2.6)}
      {lit(44, 25, 2.6)}
    </>,
    multitool: () => <>
      {P("M8 46 L24 12 L31 15 L15 50 Z", GA)}
      {P("M56 46 L40 12 L33 15 L49 50 Z", GB, { line: edgeB })}
      {E(32, 32, 9, 9, GC, { line: edge })}
      {lit(32, 32, 3.2)}
      {R(24, 50, 16, 10, 4, GB, { line: edgeB })}
    </>,
    lance: () => <>
      {P("M8 56 L38 26 L44 32 L14 62 Z", GB, { line: edgeB })}
      {P("M34 22 L44 12 L60 4 L52 20 L42 30 Z", GA)}
      {P("M42 14 L54 8 L50 18 Z", "#fff", { spec: .2, occ: .1, line: lite(A, .5), lw: .8 })}
      {R(31, 27, 12, 8, 3, GC, { line: edge })}
      {beamLine("M46 16 L59 5", 1.8)}
      {lit(52, 13, 3)}
      <g opacity=".55">{beamLine("M16 50 C10 54 7 58 5 62", 1.2)}</g>
    </>,
    wrench: () => <>
      {P("M32 4 C42 4 50 12 50 22 C50 30 45 37 38 40 L38 46 L26 46 L26 40 C19 37 14 30 14 22 C14 12 22 4 32 4 Z", GA)}
      {P("M32 13 L40 17.5 L40 26.5 L32 31 L24 26.5 L24 17.5 Z", "#0c1220", { spec: .3, occ: .2, line: edge, lw: 1 })}
      {R(26, 42, 12, 12, 3, GB, { line: edgeB })}
      {P("M22 50 L42 50 L42 60 L34 60 L34 55 L30 55 L30 60 L22 60 Z", GC, { line: edge })}
      {seam("M32 44 V50")}
    </>,
    magnet: () => <>
      {P("M12 46 C12 24 20 12 32 12 C44 12 52 24 52 46 L40 46 C40 30 37 24 32 24 C27 24 24 30 24 46 Z", GA)}
      {R(11, 44, 14, 14, 2, GB, { line: edgeB })}
      {R(39, 44, 14, 14, 2, GC, { line: edge })}
      <g opacity=".8">{beamLine("M18 40 C28 34 36 34 46 40", 1.2)}</g>
    </>,
    keytar: () => <>
      {P("M6 40 L40 18 L48 30 L14 52 Z", GB, { line: edgeB })}
      {[0, 1, 2, 3, 4].map(i => (
        <g key={i} transform={`translate(${i * 6.4} ${-4.2 * i})`}>
          <path d="M11 41 L17 37 L21 44 L15 48 Z" fill="#f4f8ff" stroke={edgeB} strokeWidth=".7" />
        </g>
      ))}
      {[0, 1, 2, 3].map(i => (
        <path key={i} d="M14 39 L18 36.5 L20 40 L16 42.5 Z" fill="#131a2a"
          transform={`translate(${i * 6.4} ${-4.2 * i})`} />
      ))}
      {R(42, 14, 16, 12, 5, GA)}
      {lit(50, 20, 2.6)}
    </>,
    speaker: () => <>
      {R(8, 22, 14, 20, 4, GB, { line: edgeB })}
      {P("M22 24 L40 12 L40 52 L22 40 Z", GA)}
      {[0, 1, 2].map(i => (
        <path key={i} d={`M${44 + i * 6} ${26 - i * 4} A${10 + i * 6} ${10 + i * 6} 0 0 1 ${44 + i * 6} ${38 + i * 4}`}
          fill="none" stroke={C} strokeWidth={2 - i * .35} strokeLinecap="round" opacity={.9 - i * .22} />
      ))}
    </>,
    arm: () => <>
      {R(10, 12, 18, 16, 6, GA)}
      {E(22, 30, 7, 7, GB, { line: edgeB })}
      {R(16, 32, 16, 18, 6, GA)}
      {E(28, 52, 7, 7, GB, { line: edgeB })}
      {P("M30 50 L46 42 L52 48 L36 57 Z", GA)}
      {P("M46 40 L58 34 L60 40 L50 46 Z", GC, { line: edge })}
      {lit(18, 20, 2.6)}
    </>,
    torch: () => <>
      {R(10, 24, 30, 16, 6, GA)}
      {seam("M16 30 H34")}
      {P("M40 20 L52 14 L52 50 L40 44 Z", GB, { line: edgeB })}
      <path d="M52 16 L62 6 L62 58 L52 48 Z" fill={GLOW} opacity=".85" />
      {beamLine("M53 32 H61", 2)}
      {lit(46, 32, 3.4)}
    </>,
    beam: () => <>
      <path d="M32 2 L36 26 L60 30 L36 34 L32 60 L28 34 L4 30 L28 26 Z" fill={GLOW} />
      {beamLine("M32 6 V56", 2.6)}
      {beamLine("M8 30 H56", 2.6)}
      {beamLine("M17 15 L47 45 M47 15 L17 45", 1.4)}
      {lit(32, 30, 5)}
    </>,
    blaster: () => <>
      {P("M8 22 L44 22 L52 26 L52 34 L20 34 L18 30 L8 30 Z", GA)}
      {seam("M14 26 H40")}
      {P("M52 24 L62 27 L62 33 L52 36 Z", GB, { line: edgeB })}
      {P("M18 34 L30 34 L26 54 L14 54 Z", GB, { line: edgeB })}
      {R(30, 32, 14, 8, 3, GC, { line: edge })}
      {lit(58, 30, 3.2)}
    </>,
    barrier: () => <>
      <path d="M32 4 L56 17 V47 L32 60 L8 47 V17 Z" fill={GLOW} opacity=".8" />
      {P("M32 6 L54 18 V46 L32 58 L10 46 V18 Z", GA, { spec: .8, occ: .5, lw: 1.8, line: lite(C, .1) })}
      <path d="M32 14 L47 22 V42 L32 50 L17 42 V22 Z" fill="none" stroke={lite(C, .5)} strokeWidth="1.2" opacity=".8" />
      <path d="M32 6 L32 58 M10 18 L54 46 M54 18 L10 46" stroke={lite(C, .55)} strokeWidth=".8" opacity=".45" fill="none" />
      {lit(32, 32, 4)}
    </>,
    charge: () => <>
      {R(20, 18, 24, 42, 7, GA)}
      {R(20, 18, 24, 11, 5, GB, { line: edgeB })}
      {seam("M25 36 H39 M25 45 H39")}
      <path d="M32 18 C30 12 34 10 32 4" fill="none" stroke={dim(B, .2)} strokeWidth="2.4" strokeLinecap="round" />
      {lit(32, 4, 3.6, C)}
      {lit(32, 52, 3)}
    </>,
    grenade: () => <>
      {E(32, 38, 19, 19, GA)}
      <path d="M32 38 m-19 0 a19 19 0 0 1 19 -19 a19 19 0 0 1 6 1 A19 19 0 0 0 13 38 Z" fill="#fff" opacity=".22" />
      {R(26, 14, 12, 10, 3, GB, { line: edgeB })}
      {P("M38 14 L50 12 L50 17 L38 21 Z", GB, { line: edgeB })}
      {seam("M20 32 C26 28 38 28 44 32 M18 42 C26 47 38 47 46 42")}
      {lit(32, 38, 4.4)}
    </>,
    boomerang: () => <>
      {P("M32 54 C23 49 12 33 6 17 C4 11 10 5 15 9 C23 20 29 31 32 39 C35 31 41 20 49 9 C54 5 60 11 58 17 C52 33 41 49 32 54 Z", GA)}
      {beamLine("M13 13 C21 24 28 34 31 42", 1.4)}
      {beamLine("M51 13 C43 24 36 34 33 42", 1.4)}
      {E(32, 46, 5, 5, GC, { line: edge })}
      {lit(32, 46, 2.2)}
    </>,
    burst: () => <>
      <circle cx="32" cy="32" r="28" fill={GLOW} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
        <g key={a} transform={`rotate(${a} 32 32)`}>
          {beamLine("M32 26 V6", 1.8)}
          <circle cx="32" cy="5" r="2.4" fill={lite(C, .4)} />
        </g>
      ))}
      {[22, 67, 112, 157, 202, 247, 292, 337].map(a => (
        <g key={a} transform={`rotate(${a} 32 32)`} opacity=".7">{beamLine("M32 26 V13", 1.2)}</g>
      ))}
      {lit(32, 32, 6)}
    </>,

    /* ── head gear ── */
    visor: () => <>
      {P("M6 26 C6 20 14 17 32 17 C50 17 58 20 58 26 L58 36 C58 43 50 46 32 46 C14 46 6 43 6 36 Z", GB, { line: edgeB })}
      {P("M11 25 C13 22 22 21 30 21 L30 41 C22 41 13 39 11 36 Z", GC, { line: lite(C, .3), spec: .9 })}
      {P("M53 25 C51 22 42 21 34 21 L34 41 C42 41 51 39 53 36 Z", GC, { line: lite(C, .3), spec: .9 })}
      {seam("M32 20 V43", 1.6)}
      <path d="M13 25 C17 23 24 22 28 22" stroke="#fff" strokeWidth="1.6" opacity=".55" fill="none" strokeLinecap="round" />
    </>,
    helm: () => <>
      {P("M32 8 C48 8 58 19 58 34 L58 40 L44 40 L44 34 C44 26 39 22 32 22 C25 22 20 26 20 34 L20 40 L6 40 L6 34 C6 19 16 8 32 8 Z", GA)}
      {P("M6 38 L58 38 L58 46 C58 50 54 52 48 52 L16 52 C10 52 6 50 6 46 Z", GB, { line: edgeB })}
      {seam("M32 9 V22")}
      {lit(15, 45, 2.4)}
      {lit(49, 45, 2.4)}
    </>,
    phones: () => <>
      <path d="M10 40 C6 22 16 8 32 8 C48 8 58 22 54 40" fill="none" stroke={dim(A, .25)} strokeWidth="6" strokeLinecap="round" />
      <path d="M10 40 C6 22 16 8 32 8 C48 8 58 22 54 40" fill="none" stroke={lite(A, .45)} strokeWidth="2.4" strokeLinecap="round" opacity=".7" />
      {R(2, 34, 16, 24, 7, GB, { line: edgeB })}
      {R(46, 34, 16, 24, 7, GB, { line: edgeB })}
      {E(10, 46, 4.5, 5.5, GC, { line: edge })}
      {E(54, 46, 4.5, 5.5, GC, { line: edge })}
      {lit(10, 46, 2)}
      {lit(54, 46, 2)}
    </>,
    crown: () => <>
      {P("M8 46 L6 16 L20 28 L32 10 L44 28 L58 16 L56 46 Z", GA)}
      {R(7, 44, 50, 10, 3, GB, { line: edgeB })}
      {lit(32, 22, 3.4)}
      {lit(15, 30, 2.4)}
      {lit(49, 30, 2.4)}
      {seam("M12 49 H52")}
    </>,
    brain: () => <>
      {P("M32 8 C48 8 58 20 58 34 C58 46 47 54 32 54 C17 54 6 46 6 34 C6 20 16 8 32 8 Z", GA)}
      <path d="M16 26 C24 20 24 34 32 28 C40 22 40 36 48 30 M14 40 C22 34 24 46 32 40 C40 34 42 46 50 40"
        fill="none" stroke={lite(C, .2)} strokeWidth="2" strokeLinecap="round" opacity=".9" />
      {seam("M32 10 V52")}
      {lit(32, 20, 2.8)}
    </>,
    halo: () => <>
      <circle cx="32" cy="32" r="26" fill={GLOW} opacity=".55" />
      {E(32, 32, 26, 9, "none", { line: lite(C, .35), lw: 4, spec: 0, occ: 0 })}
      {E(32, 32, 26, 9, "none", { line: "#ffffff", lw: 1.4, spec: 0, occ: 0, lineOp: .8 })}
      {[0, 60, 120, 180, 240, 300].map(a => (
        <circle key={a} r="2.4" fill={lite(C, .5)}
          cx={32 + 26 * Math.cos(a * Math.PI / 180)} cy={32 + 9 * Math.sin(a * Math.PI / 180)} />
      ))}
    </>,
    crest: () => <>
      {P("M32 4 L40 18 L36 46 L28 46 L24 18 Z", GA)}
      {P("M12 30 L24 22 L26 38 L14 44 Z", GB, { line: edgeB })}
      {P("M52 30 L40 22 L38 38 L50 44 Z", GB, { line: edgeB })}
      <circle cx="32" cy="34" r="9" fill="none" stroke={lite(C, .3)} strokeWidth="1.6" />
      <path d="M32 22 V28 M32 40 V46 M20 34 H26 M38 34 H44" stroke={lite(C, .3)} strokeWidth="1.6" strokeLinecap="round" />
      {lit(32, 34, 2.6)}
    </>,
    antenna: () => <>
      {R(24, 42, 16, 18, 4, GB, { line: edgeB })}
      {P("M29 8 L35 8 L37 44 L27 44 Z", GA)}
      {[0, 1, 2].map(i => (
        <path key={i} d={`M${38 + i * 5} ${18 - i * 5} A${9 + i * 5} ${9 + i * 5} 0 0 1 ${38 + i * 5} ${30 + i * 5}`}
          fill="none" stroke={C} strokeWidth={2 - i * .4} strokeLinecap="round" opacity={.9 - i * .22} />
      ))}
      {lit(32, 7, 3.4)}
    </>,
    rivets: () => <>
      {R(6, 16, 52, 32, 8, GA)}
      {seam("M6 32 H58")}
      {[[16, 25], [32, 25], [48, 25], [16, 40], [32, 40], [48, 40]].map(([x, y], i) => (
        <g key={i}>
          {E(x, y, 5, 5, GB, { line: edgeB })}
          <path d={`M${x - 2.6} ${y - 2.6} L${x + 2.6} ${y + 2.6} M${x + 2.6} ${y - 2.6} L${x - 2.6} ${y + 2.6}`} stroke={lite(C, .3)} strokeWidth="1.3" strokeLinecap="round" />
        </g>
      ))}
    </>,
    scope: () => <>
      {R(4, 24, 56, 18, 9, GA)}
      {R(14, 20, 12, 26, 4, GB, { line: edgeB })}
      {E(57, 33, 6, 10, GC, { line: edge })}
      <circle cx="57" cy="33" r="4.4" fill="none" stroke="#fff" strokeWidth="1" opacity=".8" />
      <path d="M53 33 H61 M57 27 V39" stroke="#fff" strokeWidth=".9" opacity=".8" />
      {R(24, 44, 14, 14, 4, GB, { line: edgeB })}
      {lit(10, 33, 2.6)}
    </>,
    beacon: () => <>
      {R(22, 44, 20, 14, 4, GB, { line: edgeB })}
      {seam("M25 50 H39")}
      {P("M32 6 C44 6 52 16 52 28 C52 38 44 44 32 44 C20 44 12 38 12 28 C12 16 20 6 32 6 Z", GC, { line: lite(C, .25), spec: .85 })}
      <circle cx="32" cy="28" r="24" fill={GLOW} opacity=".55" />
      <path d="M20 20 C24 14 30 12 34 12" stroke="#fff" strokeWidth="2.6" opacity=".6" fill="none" strokeLinecap="round" />
      {lit(32, 28, 5)}
    </>,
    satellite: () => <>
      {P("M32 50 C18 50 8 38 8 24 L56 24 C56 38 46 50 32 50 Z", GA, { spec: .9 })}
      <path d="M32 48 C20 48 11 38 11 26 L53 26 C53 38 44 48 32 48 Z" fill="none" stroke={lite(C, .3)} strokeWidth="1" opacity=".6" />
      {R(28, 6, 8, 20, 3, GB, { line: edgeB })}
      {E(32, 6, 5, 5, GC, { line: edge })}
      {R(2, 30, 12, 22, 2, GB, { line: edgeB })}
      {R(50, 30, 12, 22, 2, GB, { line: edgeB })}
      {seam("M8 34 V48 M56 34 V48")}
      {lit(32, 6, 2.6)}
    </>,
    atom: () => <>
      <circle cx="32" cy="32" r="24" fill={GLOW} opacity=".45" />
      {[0, 60, 120].map(a => (
        <ellipse key={a} cx="32" cy="32" rx="26" ry="10" fill="none" stroke={lite(C, .25)} strokeWidth="2"
          transform={`rotate(${a} 32 32)`} opacity=".9" />
      ))}
      {E(32, 32, 8, 8, GA, { lw: 1.6 })}
      {lit(32, 32, 3.6)}
      <circle cx="58" cy="32" r="3" fill={lite(C, .4)} />
      <circle cx="19" cy="10" r="2.6" fill={lite(C, .4)} />
    </>,
    orb: () => <>
      <circle cx="32" cy="32" r="27" fill={GLOW} opacity=".5" />
      {E(32, 32, 20, 20, GA, { spec: .9 })}
      {[0, 45, 90, 135].map(a => (
        <ellipse key={a} cx="32" cy="32" rx="20" ry="7" fill="none" stroke={lite(C, .3)} strokeWidth="1.4"
          transform={`rotate(${a} 32 32)`} opacity=".75" />
      ))}
      <path d="M20 22 C24 17 29 15 34 15" stroke="#fff" strokeWidth="3" opacity=".55" fill="none" strokeLinecap="round" />
      {lit(32, 32, 4.6)}
    </>,

    /* ── plating ──
       Fifteen outfits are fifteen finishes on one chest plate, not fifteen
       different objects. Drawing them as one silhouette with a surface pass
       each is what makes them read as a set you are collecting rather than as
       unrelated icons that happen to share a shop tab. */
    plate: (pat) => <>
      {P("M32 6 L54 14 C54 34 46 50 32 58 C18 50 10 34 10 14 Z", GA, { lw: 1.6 })}
      <clipPath id={`${uid}-cp`}><path d="M32 6 L54 14 C54 34 46 50 32 58 C18 50 10 34 10 14 Z" /></clipPath>
      <g clipPath={`url(#${uid}-cp)`}>{pat}</g>
      <path d="M32 6 L54 14 C54 34 46 50 32 58 C18 50 10 34 10 14 Z" fill="none" stroke={edge} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M32 8 L52 15 C52 33 45 47 32 55" fill="none" stroke="#ffffff" strokeWidth="1.2" opacity=".3" />
    </>,

    /* ── accessories ── */
    shield: () => SHAPES.plate(<>
      {seam("M32 6 V58")}
      <path d="M14 20 L50 20 M16 34 L48 34" stroke={lite(C, .3)} strokeWidth="1.6" opacity=".7" />
      {lit(32, 27, 4)}
    </>),
    eye: () => <>
      {P("M4 32 C14 16 24 10 32 10 C40 10 50 16 60 32 C50 48 40 54 32 54 C24 54 14 48 4 32 Z", GB, { line: edgeB })}
      {E(32, 32, 15, 15, GC, { line: lite(C, .3), spec: .9 })}
      {E(32, 32, 7, 7, "#0a1020", { spec: .3, occ: 0, line: dim(C, .3) })}
      <circle cx="27" cy="26" r="3.6" fill="#fff" opacity=".9" />
      <circle cx="32" cy="32" r="20" fill={GLOW} opacity=".4" />
    </>,
    rotor: () => <>
      {[0, 60, 120].map(a => (
        <g key={a} transform={`rotate(${a} 32 32)`}>{P("M32 30 L58 24 L60 32 L32 34 Z", GA, { spec: .8 })}</g>
      ))}
      {E(32, 32, 9, 9, GB, { line: edgeB })}
      {lit(32, 32, 3.4)}
      {R(26, 44, 12, 16, 4, GB, { line: edgeB })}
    </>,
    plug: () => <>
      {R(6, 22, 30, 20, 7, GA)}
      {seam("M12 28 H28")}
      {P("M36 26 L48 26 L48 30 L58 30 L58 34 L48 34 L48 38 L36 38 Z", GC, { line: edge })}
      {beamLine("M50 32 H60", 1.6)}
      {lit(14, 32, 2.8)}
    </>,
    pad: () => <>
      {R(6, 18, 52, 30, 9, GA)}
      {R(12, 24, 18, 18, 4, GB, { line: edgeB })}
      <path d="M21 28 V38 M16 33 H26" stroke={lite(C, .35)} strokeWidth="2.4" strokeLinecap="round" />
      {lit(41, 30, 3)}
      {lit(50, 36, 3)}
      {seam("M6 44 H58")}
    </>,
    limb: () => <>
      {R(19, 4, 22, 24, 8, GA)}
      {seam("M24 11 H36")}
      {E(30, 31, 8, 8, GB, { line: edgeB })}
      {lit(30, 31, 2.4)}
      {R(21, 34, 19, 22, 7, GA)}
      {seam("M26 40 H35 M26 46 H35")}
      {P("M15 54 L44 54 L52 62 L9 62 Z", GC, { line: edge })}
      {lit(24, 10, 2.4)}
    </>,
    trail: () => <>
      <circle cx="32" cy="32" r="27" fill={GLOW} opacity=".45" />
      {[0, 1, 2, 3].map(i => (
        <g key={i} opacity={.95 - i * .18}>
          {beamLine(`M${6 + i * 3} ${12 + i * 8} C${24 + i * 2} ${18 + i * 6} ${40} ${34 + i * 4} ${58 - i * 2} ${28 + i * 8}`, 2.2 - i * .35)}
        </g>
      ))}
      {lit(10, 14, 3.4)}
    </>,
    fusion: () => <>
      <circle cx="32" cy="32" r="30" fill={GLOW} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
        <g key={a} transform={`rotate(${a} 32 32)`}>{P("M32 8 L36 20 L28 20 Z", GC, { line: lite(C, .3), lw: .9 })}</g>
      ))}
      {E(32, 32, 15, 15, GA, { spec: .9 })}
      {E(32, 32, 8, 8, "none", { line: lite(C, .45), lw: 2, spec: 0, occ: 0 })}
      {lit(32, 32, 5.4)}
    </>,
    singularity: () => <>
      <circle cx="32" cy="32" r="30" fill={GLOW} opacity=".7" />
      {[0, 30, 60].map((a, i) => (
        <ellipse key={a} cx="32" cy="32" rx={27 - i * 2} ry={9 - i * 2} fill="none" stroke={lite(C, .35 - i * .1)} strokeWidth={2.2 - i * .5}
          transform={`rotate(${a - 20} 32 32)`} opacity={.9 - i * .2} />
      ))}
      {E(32, 32, 11, 11, "#070b16", { spec: .25, occ: 0, line: lite(C, .4), lw: 1.6 })}
      <circle cx="32" cy="32" r="4.4" fill="#0a0f1e" />
      <circle cx="27" cy="27" r="2" fill={lite(C, .6)} opacity=".7" />
    </>,
    battery: () => <>
      {R(18, 10, 28, 48, 7, GA)}
      {R(26, 4, 12, 8, 3, GB, { line: edgeB })}
      {R(23, 18, 18, 34, 4, GB, { line: edgeB, spec: .5 })}
      {[0, 1, 2].map(i => R(25, 21 + i * 11, 14, 8, 2, GC, { line: edge, k: i, lw: .8 }))}
      {lit(32, 15, 2.6)}
    </>,
    chip: () => <>
      {R(14, 14, 36, 36, 5, GA)}
      {R(21, 21, 22, 22, 3, GB, { line: edgeB })}
      <path d="M26 26 H38 M26 32 H38 M26 38 H34" stroke={lite(C, .35)} strokeWidth="1.6" strokeLinecap="round" />
      {[0, 1, 2, 3].map(i => (
        <g key={i}>
          <path d={`M${20 + i * 8} 14 V6 M${20 + i * 8} 50 V58`} stroke={dim(A, .3)} strokeWidth="3" strokeLinecap="round" />
          <path d={`M14 ${20 + i * 8} H6 M50 ${20 + i * 8} H58`} stroke={dim(A, .3)} strokeWidth="3" strokeLinecap="round" />
        </g>
      ))}
      {lit(32, 32, 3)}
    </>,
    gyro: () => <>
      {[[26, 10, 0], [20, 20, 0], [11, 11, 0]].map(([rx, ry], i) => (
        <ellipse key={i} cx="32" cy="32" rx={rx} ry={ry} fill="none" stroke={i % 2 ? lite(C, .3) : lite(A, .35)} strokeWidth="3"
          transform={`rotate(${i * 55} 32 32)`} />
      ))}
      {E(32, 32, 7, 7, GA, { lw: 1.4 })}
      {lit(32, 32, 3)}
    </>,
    vent: () => <>
      {R(8, 12, 48, 40, 8, GA)}
      {[0, 1, 2, 3].map(i => (
        <g key={i}>
          {P(`M14 ${19 + i * 9} H50 L46 ${25 + i * 9} H18 Z`, GB, { line: edgeB, lw: .8 })}
        </g>
      ))}
      <path d="M20 16 L23 20 L20 24 M44 40 L47 44 L44 48" stroke={lite(C, .4)} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".85" />
      {lit(50, 17, 2.4)}
    </>,
    thruster: () => <>
      {R(20, 4, 24, 30, 7, GA)}
      {seam("M25 12 H39 M25 20 H39")}
      {P("M18 32 L46 32 L52 46 L12 46 Z", GB, { line: edgeB })}
      <path d="M16 46 C22 56 26 60 32 63 C38 60 42 56 48 46 Z" fill={GLOW} />
      {beamLine("M32 48 V61", 2.4)}
      {lit(32, 12, 3)}
    </>,
    drone: () => <>
      {[[12, 16], [52, 16]].map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx="13" ry="3.4" fill={lite(A, .3)} opacity=".7" />
          {E(x, y + 4, 4, 4, GB, { line: edgeB })}
        </g>
      ))}
      {P("M20 26 L44 26 L50 34 L44 46 L20 46 L14 34 Z", GA)}
      {E(32, 36, 8, 8, GC, { line: lite(C, .25), spec: .9 })}
      {lit(32, 36, 3.4)}
      {seam("M18 22 L24 28 M46 22 L40 28")}
    </>,
    module: () => <>
      {R(10, 14, 44, 36, 8, GA)}
      {R(17, 21, 30, 22, 4, GB, { line: edgeB })}
      {seam("M22 27 H42 M22 34 H38")}
      {lit(32, 38, 3.4)}
    </>,
  };

  const draw = art && art.startsWith("out-") ? () => SHAPES.plate(PATTERNS[art] || PATTERNS["out-tshirt"]) : SHAPES[art];
  return (
    <svg className={`ia ${className}`} viewBox="0 0 64 64" width={size || "100%"} height={size || "100%"} aria-hidden="true" overflow="visible">
      <defs>
        <linearGradient id={`${uid}-a`} x1="0.12" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor={lite(A, .62)} />
          <stop offset="34%" stopColor={lite(A, .16)} />
          <stop offset="72%" stopColor={A} />
          <stop offset="100%" stopColor={dim(A, .42)} />
        </linearGradient>
        <linearGradient id={`${uid}-b`} x1="0.12" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor={lite(B, .48)} />
          <stop offset="40%" stopColor={B} />
          <stop offset="100%" stopColor={dim(B, .45)} />
        </linearGradient>
        <linearGradient id={`${uid}-c`} x1="0.1" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={lite(C, .7)} />
          <stop offset="45%" stopColor={C} />
          <stop offset="100%" stopColor={dim(C, .35)} />
        </linearGradient>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0%" stopColor={lite(C, .5)} stopOpacity=".85" />
          <stop offset="45%" stopColor={C} stopOpacity=".32" />
          <stop offset="100%" stopColor={C} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-occ`} x1="0.14" y1="0.02" x2="0.86" y2="1">
          <stop offset="0%" stopColor="#000814" stopOpacity="0" />
          <stop offset="45%" stopColor="#000814" stopOpacity=".04" />
          <stop offset="100%" stopColor="#000814" stopOpacity=".42" />
        </linearGradient>
        <linearGradient id={`${uid}-spec`} x1="0.06" y1="0" x2="0.7" y2="0.9">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".6" />
          <stop offset="26%" stopColor="#ffffff" stopOpacity=".16" />
          <stop offset="56%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {draw ? draw() : SHAPES.orb()}
    </svg>
  );
}

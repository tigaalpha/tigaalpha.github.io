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


  /* ── motif tables ──
     Five whole shop categories — key skins, themes, avatar frames, keyboards,
     stickers — were still shipping raw emoji while everything else was drawn.
     Forty-one items in somebody else's art style, sitting next to gear lit by
     our own rig. They work like the outfits do: one archetype draws the object,
     and the item hands it a motif so no two read the same. */
  const KEY_MOTIF = {
    "key-jade":   <g><path d="M32 2 L41 11 L32 21 L23 11 Z" fill={lite(C, .4)} stroke="#fff" strokeWidth=".9" /><path d="M23 11 H41" stroke="#fff" strokeWidth=".8" opacity=".7" /></g>,
    "key-magma":  <g><path d="M22 20 C25 12 29 16 32 8 C35 16 39 12 42 20 Z" fill={lite(C, .45)} stroke="#fff" strokeWidth=".8" />{[26, 32, 38].map(x => <circle key={x} cx={x} cy="5" r="1.4" fill={lite(C, .6)} />)}</g>,
    "key-void":   <g><circle cx="32" cy="11" r="8" fill="#080a12" stroke={lite(C, .5)} strokeWidth="1.6" /><ellipse cx="32" cy="11" rx="13" ry="4" fill="none" stroke={lite(C, .35)} strokeWidth="1.2" opacity=".8" /></g>,
    "key-sakura": <g>{[0, 72, 144, 216, 288].map(a => <ellipse key={a} cx="32" cy="6" rx="2.6" ry="4.6" fill={lite(C, .45)} stroke="#fff" strokeWidth=".6" transform={`rotate(${a} 32 11)`} />)}<circle cx="32" cy="11" r="2" fill="#fff" opacity=".9" /></g>,
    "key-aqua":   <path d="M22 12 C25 7 29 15 32 11 C35 7 39 15 42 11" fill="none" stroke={lite(C, .4)} strokeWidth="2.6" strokeLinecap="round" />,
    "key-sunset": <g>{lit(32, 11, 4)}{[0, 45, 90, 135].map(a => <path key={a} d="M32 1 V5 M32 17 V21" transform={`rotate(${a} 32 11)`} stroke={lite(C, .5)} strokeWidth="1.8" strokeLinecap="round" />)}</g>,
    "key-neon":   <path d="M35 2 L25 13 L31 13 L28 21 L39 9 L33 9 Z" fill={lite(C, .45)} stroke="#fff" strokeWidth=".8" />,
    "key-candy":  <path d="M32 20 C21 12 22 3 27 3 C30 3 32 6 32 7 C32 6 34 3 37 3 C42 3 43 12 32 20 Z" fill={lite(C, .45)} stroke="#fff" strokeWidth=".8" />,
    "key-ocean":  <path d="M32 2 C38 9 41 13 41 16 C41 20 37 23 32 23 C27 23 23 20 23 16 C23 13 26 9 32 2 Z" fill={lite(C, .4)} stroke="#fff" strokeWidth=".8" />,
    "key-ice":    <g stroke={lite(C, .55)} strokeWidth="2.1" strokeLinecap="round"><path d="M32 2 V20 M24 6 L40 16 M40 6 L24 16" /></g>,
    "key-gold":   <path d="M22 19 L24 4 L28 11 L32 2 L36 11 L40 4 L42 19 Z" fill={lite(C, .45)} stroke="#fff" strokeWidth=".8" />,
    "key-fire":   <path d="M32 1 C36 8 41 10 41 15 C41 20 37 23 32 23 C27 23 23 20 23 15 C23 11 27 10 28 6 C30 10 32 9 32 1 Z" fill={lite(C, .45)} stroke="#fff" strokeWidth=".8" />,
    "key-galaxy": <g>{E(32, 11, 7, 7, GC, { lw: .8, line: "#fff" })}<ellipse cx="32" cy="11" rx="13" ry="4" fill="none" stroke={lite(C, .5)} strokeWidth="1.8" transform="rotate(-18 32 11)" /></g>,
    "key-prism":  <g><path d="M32 2 L44 20 H20 Z" fill={lite(C, .3)} stroke="#fff" strokeWidth=".9" />{[0, 1, 2].map(i => <path key={i} d={`M32 8 L${38 + i * 3} 20`} stroke={["#ff4d6a", "#ffd23f", "#4de1ff"][i]} strokeWidth="1.6" strokeLinecap="round" />)}</g>,
  };
  const THEME_MOTIF = {
    "thm-neon":     <g>{[0, 1, 2, 3, 4].map(i => <path key={i} d={`M6 ${46 - i * 8} H58`} stroke={lite(C, .45)} strokeWidth={1.6 - i * .2} opacity={.9 - i * .15} />)}{[0, 1, 2, 3, 4, 5].map(i => <path key={"v" + i} d={`M32 30 L${-14 + i * 22} 54`} stroke={lite(C, .4)} strokeWidth="1.2" opacity=".7" />)}<circle cx="32" cy="24" r="8" fill={GLOW} /></g>,
    "thm-arcade":   <g>{[[14, 20], [26, 20], [38, 20], [50, 20], [20, 30], [32, 30], [44, 30]].map(([x, y], i) => <rect key={i} x={x} y={y} width="7" height="6" rx="1.4" fill={lite(C, .45)} opacity=".9" />)}<rect x="24" y="44" width="16" height="5" rx="2" fill={lite(A, .5)} /><rect x="30" y="38" width="4" height="5" fill={lite(C, .55)} /></g>,
    "thm-zen":      <g><circle cx="44" cy="20" r="7" fill="none" stroke={lite(C, .5)} strokeWidth="2" />{[0, 1, 2, 3].map(i => <path key={i} d={`M8 ${34 + i * 5} C20 ${30 + i * 5} 44 ${38 + i * 5} 58 ${33 + i * 5}`} fill="none" stroke={lite(A, .35)} strokeWidth="1.3" opacity=".7" />)}{[[18, 42, 5], [27, 45, 3.4]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r * .7} fill={dim(A, .5)} />)}</g>,
    "thm-nebula":   <g>{[[24, 26, 13], [42, 34, 10]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={GLOW} opacity=".85" />)}{[[12, 18], [30, 14], [48, 20], [20, 40], [50, 44], [36, 46]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 1 : 1.7} fill="#fff" opacity=".8" />)}</g>,
    "thm-midnight":  <g><circle cx="46" cy="21" r="6" fill={lite(A, .6)} opacity=".9" /><path d="M6 44 L14 34 L20 40 L28 28 L36 38 L44 31 L52 40 L58 36 V54 H6 Z" fill={dim(A, .72)} />{[[13, 40], [27, 36], [41, 39], [50, 43]].map(([x, y], i) => <rect key={i} x={x} y={y} width="2" height="2" fill={lite(C, .5)} />)}</g>,
    "thm-aurora":    <g>{[0, 1, 2].map(i => <path key={i} d={`M4 ${26 + i * 5} C18 ${16 + i * 5} 30 ${34 + i * 5} 44 ${22 + i * 5} C52 ${16 + i * 5} 56 ${20 + i * 5} 60 ${18 + i * 5}`} fill="none" stroke={[lite(C, .35), lite("#7fffd4", .2), lite("#aa88ff", .25)][i]} strokeWidth="4.5" strokeLinecap="round" opacity=".75" />)}<path d="M6 46 H58 V54 H6 Z" fill={dim(A, .7)} /></g>,
    "thm-ember":     <g><path d="M6 42 L18 32 L30 40 L42 30 L58 42 V54 H6 Z" fill={dim(A, .78)} />{[[16, 30], [26, 22], [36, 27], [46, 19], [22, 16]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.4 - i * .25} fill={lite(C, .4)} opacity=".9" />)}</g>,
    "thm-forest":    <g>{[[16, 46, 11], [32, 48, 14], [47, 45, 10]].map(([x, y, h], i) => <path key={i} d={`M${x} ${y - h * 2.1} L${x + h * .8} ${y - h} L${x + h * .45} ${y - h} L${x + h} ${y} H${x - h} L${x - h * .45} ${y - h} L${x - h * .8} ${y - h} Z`} fill={dim(C, .3 + i * .12)} />)}<path d="M6 46 H58 V54 H6 Z" fill={dim(A, .74)} /></g>,
    "thm-sakura":    <g><path d="M4 16 C16 22 24 20 34 28 C42 34 50 34 60 30" fill="none" stroke={dim(A, .6)} strokeWidth="2.4" strokeLinecap="round" />{[[14, 20], [28, 25], [42, 33], [22, 40], [48, 22], [36, 45]].map(([x, y], i) => <g key={i}>{[0, 72, 144, 216, 288].map(a => <ellipse key={a} cx={x} cy={y - 3} rx="1.7" ry="3" fill={lite(C, .45)} transform={`rotate(${a} ${x} ${y})`} opacity=".92" />)}</g>)}</g>,
    "thm-deepsea":   <g><path d="M12 34 C18 26 34 24 44 30 C50 34 52 38 50 40 C44 44 24 44 16 40 Z" fill={dim(C, .18)} /><path d="M50 32 L58 26 L57 38 Z" fill={dim(C, .18)} /><circle cx="20" cy="31" r="1.5" fill="#fff" />{[[16, 18], [24, 14], [34, 19], [44, 15]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2 - i * .2} fill="none" stroke={lite(C, .5)} strokeWidth="1" opacity=".8" />)}</g>,
    "thm-volcano":   <g><path d="M6 54 L26 24 L32 30 L38 24 L58 54 Z" fill={dim(A, .68)} /><path d="M26 27 C28 33 30 30 32 34 C34 30 36 33 38 27 L44 42 H20 Z" fill={lite(C, .3)} />{[[30, 18], [37, 14], [24, 13]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.2 - i * .3} fill={lite(C, .5)} opacity=".9" />)}</g>,
    "thm-starlight": <g>{[[12, 18], [22, 30], [34, 16], [46, 26], [52, 40], [18, 44], [40, 44], [28, 40], [56, 16]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.8 : 1} fill="#fff" opacity={i % 3 === 0 ? .95 : .6} />)}<path d="M14 40 L34 22" stroke={lite(C, .5)} strokeWidth="1.6" strokeLinecap="round" /><path d="M34 22 L38 18" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></g>,
  };
  const FRAME_MOTIF = {
    "frm-fr-neon":    <g>{[[10, 10, 54, 10], [10, 54, 54, 54], [10, 10, 10, 54], [54, 10, 54, 54]].map(([a, b, c2, d], i) => <path key={i} d={`M${a} ${b} L${c2} ${d}`} stroke={lite(C, .5)} strokeWidth="2.4" strokeLinecap="round" opacity=".9" />)}{lit(32, 8, 2.6)}</g>,
    "frm-fr-circuit": <g>{[[10, 22], [10, 42], [54, 22], [54, 42]].map(([x, y], i) => <g key={i}><path d={`M${x} ${y} H${x < 32 ? x + 5 : x - 5}`} stroke={lite(C, .5)} strokeWidth="1.6" /><circle cx={x < 32 ? x + 6 : x - 6} cy={y} r="1.8" fill={lite(C, .55)} /></g>)}{[[22, 10], [42, 10], [22, 54], [42, 54]].map(([x, y], i) => <rect key={"r" + i} x={x - 3} y={y - 2} width="6" height="4" rx="1" fill={lite(A, .5)} />)}</g>,
    "frm-fr-laurel":  <g>{[-1, 1].map(sd => <g key={sd}>{[0, 1, 2, 3].map(i => { const x = 32 + sd * (10 + i * 5), y = 56 - i * 4; return <ellipse key={i} cx={x} cy={y} rx="4.6" ry="2.3" fill={lite(C, .35)} stroke={edge} strokeWidth=".6" transform={`rotate(${sd * (26 - i * 10)} ${x} ${y})`} />; })}</g>)}<path d="M26 9 L32 3 L38 9 Z" fill={GC} stroke={edge} strokeWidth=".9" /></g>,
    "frm-fr-prism":   <g>{[[32, 6], [6, 32], [58, 32], [32, 58]].map(([x, y], i) => <path key={i} d={`M${x} ${y - 5} L${x + 4.5} ${y} L${x} ${y + 5} L${x - 4.5} ${y} Z`} fill={["#ff4d6a", "#ffd23f", "#4de1ff", "#a86bff"][i]} stroke="#fff" strokeWidth=".8" opacity=".92" />)}</g>,
    "frm-fr-mecha":   <g>{[[9, 9], [55, 9], [9, 55], [55, 55]].map(([x, y], i) => <path key={i} d={`M${x - 4} ${y} L${x} ${y - 4} L${x + 4} ${y} L${x} ${y + 4} Z`} fill={GC} stroke={edge} strokeWidth=".9" />)}{seam("M32 7 V13 M32 51 V57 M7 32 H13 M51 32 H57")}{lit(32, 32, 0)}</g>,
    "frm-fr-none":    <g />,
    "frm-fr-bronze":  <g>{[[13, 13], [51, 13], [13, 51], [51, 51]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="3.4" fill={GC} stroke={edge} strokeWidth="1" /><circle cx={x - .8} cy={y - .8} r="1.1" fill="#fff" opacity=".7" /></g>)}</g>,
    "frm-fr-silver":  <g>{[[8, 32, 56, 32], [32, 8, 32, 56]].map(([a, b, c2, d], i) => <path key={i} d={`M${a} ${b} L${c2} ${d}`} stroke={lite(A, .55)} strokeWidth="1.4" opacity=".5" />)}{[[10, 10, 54, 10], [10, 54, 54, 54]].map(([a, b, c2, d], i) => <path key={i} d={`M${a} ${b} L${c2} ${d}`} stroke={lite(A, .7)} strokeWidth="2" opacity=".8" />)}</g>,
    "frm-fr-gold":    <g><path d="M25 8 L32 2 L39 8 Z" fill={GC} stroke={edge} strokeWidth="1" />{[-1, 1].map(s => <g key={s}>{[0, 1, 2].map(i => <ellipse key={i} cx={32 + s * (9 + i * 6)} cy={57 - i * 1.5} rx="4.4" ry="2.2" fill={lite(C, .3)} stroke={edge} strokeWidth=".7" transform={`rotate(${s * (18 + i * 8)} ${32 + s * (9 + i * 6)} ${57 - i * 1.5})`} />)}</g>)}</g>,
    "frm-fr-diamond": <g>{[[12, 12], [52, 12], [12, 52], [52, 52]].map(([x, y], i) => <path key={i} d={`M${x} ${y - 6} L${x + 5} ${y} L${x} ${y + 6} L${x - 5} ${y} Z`} fill={lite(C, .5)} stroke="#fff" strokeWidth=".9" opacity=".92" />)}{lit(32, 8, 3)}</g>,
  };
  const KBD_MOTIF = {
    "kbd-kb-jade":    <g>{beamLine("M9 23 H55", 2.2)}<path d="M32 6 L40 14 L32 22 L24 14 Z" fill={lite(C, .4)} stroke="#fff" strokeWidth=".8" /></g>,
    "kbd-kb-sunset":  <g>{beamLine("M9 23 H55", 2.4)}<path d="M18 19 A14 14 0 0 1 46 19 Z" fill={lite(C, .4)} />{[12, 32, 52].map(x => <path key={x} d={`M${x} 19 H${x + 6}`} stroke={lite(C, .5)} strokeWidth="1.4" />)}</g>,
    "kbd-kb-carbon":  <g>{seam("M10 23 H54")}{Array.from({ length: 4 }).map((_, r) => Array.from({ length: 6 }).map((_, c) => <rect key={`${r}${c}`} x={10 + c * 8 + (r % 2 ? 4 : 0)} y={7 + r * 4} width="6" height="3" rx=".8" fill="none" stroke={lite(A, .3)} strokeWidth=".8" />))}</g>,
    "kbd-kb-aurora":  <g>{beamLine("M9 23 H55", 2.2)}{[0, 1, 2].map(i => <path key={i} d={`M8 ${12 + i * 3} C20 ${6 + i * 3} 34 ${18 + i * 3} 56 ${9 + i * 3}`} fill="none" stroke={[lite(C, .35), "#7fffd4", "#a86bff"][i]} strokeWidth="2.6" strokeLinecap="round" opacity=".7" />)}</g>,
    "kbd-kb-classic":  <g>{seam("M10 24 H54")}</g>,
    "kbd-kb-neon":     <g>{beamLine("M9 23 H55", 2.2)}</g>,
    "kbd-kb-rose":     <g>{beamLine("M9 23 H55", 2.2)}<path d="M32 17 C27 13 28 9 30.5 9 C31.6 9 32 10 32 10.6 C32 10 32.4 9 33.5 9 C36 9 37 13 32 17 Z" fill={lite(C, .45)} /></g>,
    "kbd-kb-midnight": <g>{beamLine("M9 23 H55", 1.6)}<circle cx="50" cy="14" r="5" fill={lite(A, .55)} /><circle cx="47.5" cy="12.5" r="4.2" fill={GB} /></g>,
    "kbd-kb-ice":      <g>{beamLine("M9 23 H55", 2.2)}{[16, 32, 48].map(x => <g key={x} stroke={lite(C, .55)} strokeWidth="1.5" strokeLinecap="round"><path d={`M${x} 9 V17 M${x - 3.6} 11 L${x + 3.6} 15 M${x + 3.6} 11 L${x - 3.6} 15`} /></g>)}</g>,
    "kbd-kb-fire":     <g>{beamLine("M9 23 H55", 2.6)}{[20, 32, 44].map((x, i) => <path key={x} d={`M${x} 6 C${x + 3} 11 ${x + 5} 12 ${x + 5} 15 C${x + 5} 18 ${x + 2.6} 19 ${x} 19 C${x - 2.6} 19 ${x - 5} 18 ${x - 5} 15 C${x - 5} 12 ${x - 3} 11 ${x} 6 Z`} fill={lite(C, .3 + i * .06)} opacity=".9" />)}</g>,
    "kbd-kb-galaxy":   <g>{beamLine("M9 23 H55", 2.2)}{E(32, 13, 6, 6, GC, { lw: .8, line: "#fff" })}<ellipse cx="32" cy="13" rx="12" ry="3.6" fill="none" stroke={lite(C, .5)} strokeWidth="1.6" transform="rotate(-16 32 13)" />{[[12, 9], [52, 17], [46, 8]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.1" fill="#fff" opacity=".8" />)}</g>,
    "kbd-kb-gold":     <g>{beamLine("M9 23 H55", 2.8)}<path d="M22 18 L24 6 L28 12 L32 4 L36 12 L40 6 L42 18 Z" fill={lite(C, .45)} stroke="#fff" strokeWidth=".8" /></g>,
    "kbd-kb-rainbow":  <g>{["#ff2d55", "#ff9a3c", "#ffd23f", "#3ddc84", "#4dc3ff", "#a86bff"].map((c, i) => <path key={i} d={`M${8 + i * 8} 23 H${16 + i * 8}`} stroke={c} strokeWidth="3.2" strokeLinecap="round" />)}{[16, 32, 48].map((x, i) => <path key={x} d={`M${x} 8 L${x + 2} 13 L${x + 7} 14 L${x + 2} 16 L${x} 21 L${x - 2} 16 L${x - 7} 14 L${x - 2} 13 Z`} fill="#fff" opacity=".85" />)}</g>,
  };
  const STK_MOTIF = {
    "stk-st-note8":    <g><path d="M26 44 A5 4 0 1 0 36 44 V19 C42 21 46 24 46 30 C50 26 48 19 36 14 V44" fill="none" stroke={lite(C, .55)} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" /><ellipse cx="31" cy="44" rx="5" ry="4" fill={lite(C, .5)} stroke="#fff" strokeWidth="1" transform="rotate(-16 31 44)" /></g>,
    "stk-st-metro":    <g><path d="M22 46 L32 16 L42 46 Z" fill={lite(A, .5)} stroke="#fff" strokeWidth="1.1" /><path d="M32 20 L41 32" stroke={lite(C, .6)} strokeWidth="2.2" strokeLinecap="round" /><rect x="28" y="30" width="8" height="5" rx="1.2" fill={lite(C, .5)} stroke="#fff" strokeWidth=".7" /></g>,
    "stk-st-medal":    <g><path d="M24 14 L30 30 H34 L40 14" stroke={lite(C, .5)} strokeWidth="4" fill="none" strokeLinecap="round" />{E(32, 39, 11, 11, GC, { line: "#fff", lw: 1.2 })}<path d="M32 32 L34 37 L39 37.6 L35.3 41 L36.4 46 L32 43.4 L27.6 46 L28.7 41 L25 37.6 L30 37 Z" fill="#fff" opacity=".9" /></g>,
    "stk-st-bolt":     <path d="M37 12 L21 36 H30 L26 52 L44 27 H34 Z" fill={lite(C, .5)} stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />,
    "stk-st-paw":      <g>{[[23, 26, 4], [31, 22, 4.4], [39, 24, 4], [45, 31, 3.6]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 1.2} fill={lite(C, .5)} stroke="#fff" strokeWidth=".8" />)}<path d="M32 33 C40 33 45 38 45 42 C45 47 39 49 32 49 C25 49 19 47 19 42 C19 38 24 33 32 33 Z" fill={lite(C, .45)} stroke="#fff" strokeWidth="1" /></g>,
    "stk-st-star":    <g><path d="M32 18 L36 28 L47 29 L38.5 36 L41 47 L32 41 L23 47 L25.5 36 L17 29 L28 28 Z" fill={lite(C, .5)} stroke="#fff" strokeWidth="1.1" />{lit(32, 32, 2.6)}</g>,
    "stk-st-heart":   <path d="M32 46 C15 34 17 21 24.5 21 C28 21 31 24.5 32 26.5 C33 24.5 36 21 39.5 21 C47 21 49 34 32 46 Z" fill={lite(C, .45)} stroke="#fff" strokeWidth="1.2" />,
    "stk-st-music":   <g><path d="M28 42 A5 4 0 1 0 38 42 V20 L46 17 V24" fill="none" stroke={lite(C, .55)} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><ellipse cx="33" cy="42" rx="5" ry="4" fill={lite(C, .5)} stroke="#fff" strokeWidth="1" transform="rotate(-16 33 42)" /></g>,
    "stk-st-flame":   <path d="M32 14 C38 24 45 27 45 35 C45 42 39 47 32 47 C25 47 19 42 19 35 C19 29 25 27 27 20 C30 27 32 26 32 14 Z" fill={lite(C, .42)} stroke="#fff" strokeWidth="1.1" />,
    "stk-st-crown":   <g><path d="M18 44 L21 20 L27 30 L32 16 L37 30 L43 20 L46 44 Z" fill={lite(C, .45)} stroke="#fff" strokeWidth="1.1" />{[24, 32, 40].map(x => <circle key={x} cx={x} cy="38" r="2" fill="#fff" opacity=".85" />)}</g>,
    "stk-st-diamond": <g><path d="M32 15 L46 29 L32 49 L18 29 Z" fill={lite(C, .4)} stroke="#fff" strokeWidth="1.2" /><path d="M18 29 H46 M32 15 L25 29 L32 49 M32 15 L39 29 L32 49" stroke="#fff" strokeWidth=".9" opacity=".75" fill="none" /></g>,
    "stk-st-rocket":  <g><path d="M32 13 C38 20 40 28 40 36 H24 C24 28 26 20 32 13 Z" fill={lite(A, .55)} stroke="#fff" strokeWidth="1.1" /><path d="M24 30 L17 42 L24 39 Z M40 30 L47 42 L40 39 Z" fill={lite(C, .4)} stroke="#fff" strokeWidth=".9" /><circle cx="32" cy="24" r="3.4" fill={GB} stroke="#fff" strokeWidth=".9" /><path d="M27 38 C29 44 31 47 32 50 C33 47 35 44 37 38 Z" fill={lite(C, .5)} /></g>,
    "stk-st-trophy":  <g><path d="M23 15 H41 V26 C41 33 37 37 32 37 C27 37 23 33 23 26 Z" fill={lite(C, .45)} stroke="#fff" strokeWidth="1.1" /><path d="M23 18 H17 V23 C17 27 20 29 23 29 M41 18 H47 V23 C47 27 44 29 41 29" fill="none" stroke={lite(C, .5)} strokeWidth="2.2" /><path d="M29 37 H35 V44 H29 Z M23 44 H41 V49 H23 Z" fill={lite(A, .35)} stroke="#fff" strokeWidth=".9" /></g>,
    "stk-st-magic":   <g>{[[32, 30, 14], [20, 21, 6], [45, 41, 7]].map(([x, y, r], i) => <path key={i} d={`M${x} ${y - r} L${x + r * .28} ${y - r * .28} L${x + r} ${y} L${x + r * .28} ${y + r * .28} L${x} ${y + r} L${x - r * .28} ${y + r * .28} L${x - r} ${y} L${x - r * .28} ${y - r * .28} Z`} fill={i ? lite(C, .55) : "#fff"} opacity={i ? .85 : .95} />)}</g>,
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

    /* ── top-tier variants ──
       Seven items were sharing an archetype with a cheaper sibling, so a 600-coin
       legendary was a recoloured 150-coin common. A player has to be able to see
       what the money bought. */
    greatsword: () => <>
      {P("M32 2 L40 12 L38 44 L32 50 L26 44 L24 12 Z", GA, { lw: 1.6 })}
      {beamLine("M32 6 V46", 2.2)}
      {P("M14 44 H50 L46 51 H18 Z", GB, { line: edgeB })}
      {P("M28 51 H36 V60 H28 Z", GB, { line: edgeB })}
      {[20, 44].map(x => <g key={x}>{lit(x, 47.5, 2.4)}</g>)}
      {seam("M32 14 V42")}
    </>,
    piston: () => <>
      {R(6, 24, 20, 16, 4, GB, { line: edgeB })}
      {R(24, 27, 14, 10, 2, GA)}
      {P("M38 22 L54 22 L58 32 L54 42 L38 42 Z", GA, { lw: 1.5 })}
      {beamLine("M40 32 H58", 2.6)}
      {seam("M11 29 H21 M11 35 H21")}
      {lit(16, 32, 3)}
    </>,
    reactor: () => <>
      {E(32, 32, 22, 22, GB, { line: edgeB, lw: 1.4 })}
      {[0, 60, 120].map(a => <ellipse key={a} cx="32" cy="32" rx="21" ry="8" fill="none" stroke={lite(C, .45)} strokeWidth="2.2" opacity=".85" transform={`rotate(${a} 32 32)`} />)}
      {E(32, 32, 10, 10, GA, { lw: 1.2 })}
      {lit(32, 32, 5)}
      {[[32, 8], [11, 44], [53, 44]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill={lite(C, .5)} stroke="#fff" strokeWidth=".8" />)}
    </>,
    railgun: () => <>
      {P("M4 26 H40 L46 22 H58 L58 42 H46 L40 38 H4 Z", GA, { lw: 1.5 })}
      {[0, 1, 2].map(i => <g key={i}>{R(12 + i * 10, 18, 6, 28, 2, GB, { line: edgeB, lw: 1 })}</g>)}
      {beamLine("M44 32 H62", 3.2)}
      {P("M8 40 L20 40 L16 54 L6 54 Z", GB, { line: edgeB })}
      {lit(50, 32, 3.4)}
    </>,
    aegis: () => <>
      {P("M32 4 C46 4 54 14 54 26 C54 36 48 44 42 48 L22 48 C16 44 10 36 10 26 C10 14 18 4 32 4 Z", GA, { lw: 1.6 })}
      {P("M14 26 H50 V34 C50 38 44 41 32 41 C20 41 14 38 14 34 Z", "#0a1220", { spec: .5, occ: .35, line: lite(C, .4), lw: 1.2 })}
      {beamLine("M18 30 H46", 2)}
      {P("M26 4 L32 -2 L38 4 L35 12 H29 Z", GC, { line: lite(C, .3) })}
      {seam("M32 8 V22 M20 48 H44")}
      {[18, 46].map(x => <circle key={x} cx={x} cy="20" r="2.4" fill={lite(C, .5)} />)}
    </>,
    diadem: () => <>
      {P("M10 46 L14 16 L22 28 L32 8 L42 28 L50 16 L54 46 Z", GA, { lw: 1.6 })}
      {P("M10 46 H54 V54 H10 Z", GB, { line: edgeB })}
      {[16, 32, 48].map((x, i) => <g key={x}>{lit(x, i === 1 ? 12 : 20, i === 1 ? 4.2 : 3)}</g>)}
      {[[22, 40], [32, 40], [42, 40]].map(([x, y], i) => <path key={i} d={`M${x} ${y - 5} L${x + 4} ${y} L${x} ${y + 5} L${x - 4} ${y} Z`} fill={lite(C, .5)} stroke="#fff" strokeWidth=".7" />)}
    </>,
    sigil: () => <>
      {P("M32 4 L52 14 V32 C52 44 43 54 32 60 C21 54 12 44 12 32 V14 Z", GA, { lw: 1.5 })}
      {P("M32 14 L44 20 V32 C44 39 39 45 32 49 C25 45 20 39 20 32 V20 Z", GB, { line: edgeB, lw: 1.1 })}
      {[0, 1, 2].map(i => <path key={i} d={`M24 ${26 + i * 7} H40`} stroke={lite(C, .5)} strokeWidth="2" strokeLinecap="round" opacity={.9 - i * .2} />)}
      {lit(32, 10, 3)}
    </>,

    /* ── the music bench ──
       A piano app's gear rack ought to contain the tools a musician actually
       owns. These are the ones a robot can hold: a fork it strikes for pitch, a
       pendulum it sets for tempo, a baton it conducts with, a disc it throws. */
    fork: () => <>
      {P("M24 10 L24 30 C24 38 28 40 32 40 C36 40 40 38 40 30 L40 10 L34 10 L34 30 C34 33 33 34 32 34 C31 34 30 33 30 30 L30 10 Z", GA)}
      {P("M28 40 H36 V56 A4 4 0 0 1 28 56 Z", GB, { line: edgeB })}
      {beamLine("M18 16 C14 20 14 26 18 30", 1.8)}
      {beamLine("M46 16 C50 20 50 26 46 30", 1.8)}
      {lit(32, 46, 3)}
    </>,
    pendulum: () => <>
      {P("M20 56 L32 6 L44 56 Z", GA)}
      {P("M24 50 H40 V56 H24 Z", GB, { line: edgeB, lw: 1 })}
      {seam("M32 12 V48")}
      {P("M27 26 L37 26 L37 33 L27 33 Z", GC, { line: lite(C, .3), lw: 1 })}
      <path d="M32 10 L44 22" stroke={lite(A, .45)} strokeWidth="1.4" opacity=".7" />
      {lit(32, 48, 2.6)}
    </>,
    baton: () => <>
      {P("M14 50 C12 46 14 42 18 42 L44 12 L50 18 L22 46 C22 50 18 53 14 50 Z", GA)}
      {P("M42 10 L52 20 C55 17 55 12 52 9 C49 6 45 7 42 10 Z", GC, { line: lite(C, .3) })}
      {beamLine("M48 6 L58 2", 1.6)}
      {lit(17, 47, 3)}
    </>,
    disc: () => <>
      {E(32, 32, 25, 25, GB, { line: edgeB, lw: 1.3 })}
      {[21, 17, 13].map(r => <circle key={r} cx="32" cy="32" r={r} fill="none" stroke={lite(A, .3)} strokeWidth=".9" opacity=".55" />)}
      {E(32, 32, 9, 9, GA, { lw: 1 })}
      <circle cx="32" cy="32" r="2.4" fill={dim(B, .6)} />
      <path d="M14 22 A22 22 0 0 1 40 10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".3" />
      {lit(32, 32, 2.2)}
    </>,
    mask: () => <>
      {P("M8 20 C8 12 20 8 32 8 C44 8 56 12 56 20 C56 36 46 52 32 56 C18 52 8 36 8 20 Z", GA)}
      {P("M14 22 C18 18 24 18 27 22 C24 28 18 28 14 22 Z", "#0a0f1c", { spec: .4, occ: .3, line: lite(C, .35) })}
      {P("M37 22 C40 18 46 18 50 22 C46 28 40 28 37 22 Z", "#0a0f1c", { spec: .4, occ: .3, line: lite(C, .35) })}
      {seam("M32 30 V40 M24 46 C28 49 36 49 40 46")}
      {lit(20, 22, 2.2)}{lit(44, 22, 2.2)}
    </>,
    wreath: () => <>
      {[-1, 1].map(sd => (
        <g key={sd}>
          <path d={`M32 56 C${32 + sd * 22} 50 ${32 + sd * 26} 26 ${32 + sd * 12} 8`} fill="none" stroke={dim(A, .25)} strokeWidth="2.6" strokeLinecap="round" />
          {[0, 1, 2, 3, 4].map(i => {
            const t = i / 4, x = 32 + sd * (22 * (1 - t) * 1.1 + 4), y = 52 - i * 10;
            return <ellipse key={i} cx={x} cy={y} rx="6.2" ry="3.1" fill={GC} stroke={lite(C, .35)} strokeWidth=".8" transform={`rotate(${sd * (32 - i * 10)} ${x} ${y})`} />;
          })}
        </g>
      ))}
      {lit(32, 12, 3.4)}
    </>,
    holo: () => <>
      {P("M18 52 H46 L50 58 H14 Z", GB, { line: edgeB })}
      {E(32, 48, 12, 3.4, GA, { lw: 1 })}
      <path d="M20 46 L32 8 L44 46 Z" fill={GLOW} opacity=".9" />
      {[0, 1, 2].map(i => <ellipse key={i} cx="32" cy={22 + i * 9} rx={6 + i * 4.6} ry={1.9 + i * .5} fill="none" stroke={lite(C, .5)} strokeWidth="1.5" opacity={.9 - i * .18} />)}
      {lit(32, 12, 3.2)}
    </>,

    /* ── the five categories that used to be emoji ── */
    // a key skin is the colour a keybed wears, so it is sold as keys
    keycap: (motif) => <>
      {[6, 23, 40].map(x => <g key={x}>{R(x, 20, 17, 36, 2.5, "#f4f7fc", { line: edge, lw: 1.1, spec: .55 })}</g>)}
      {[6, 23, 40].map(x => <g key={"f" + x}>{P(`M${x} 44 H${x + 17} V53.5 A2.5 2.5 0 0 1 ${x + 14.5} 56 H${x + 2.5} A2.5 2.5 0 0 1 ${x} 53.5 Z`, GA, { lw: 1.1 })}</g>)}
      {[17.5, 34.5].map(x => <g key={"s" + x}>{R(x, 20, 12, 22, 2, GB, { line: edgeB, lw: 1 })}</g>)}
      {seam("M23 20 V44 M40 20 V44")}
      {motif}
    </>,
    // a theme is a place, so it is sold as a window on to that place
    scene: (motif) => <>
      <clipPath id={`${uid}-sc`}><rect x="7" y="11" width="50" height="42" rx="6" /></clipPath>
      {R(6, 10, 52, 44, 7, GB, { line: edgeB, lw: 1.5 })}
      <g clipPath={`url(#${uid}-sc)`}>
        <rect x="6" y="10" width="52" height="44" fill={`url(#${uid}-sky)`} />
        {motif}
      </g>
      <rect x="6.7" y="10.7" width="50.6" height="42.6" rx="6.4" fill="none" stroke={lite(A, .45)} strokeWidth="1.4" opacity=".7" />
      <path d="M12 14 H24" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".35" />
    </>,
    // an avatar frame only means anything round a face, so it gets one
    frame: (motif) => <>
      {R(7, 7, 50, 50, 9, GA, { lw: 1.5 })}
      {R(14, 14, 36, 36, 6, dim(B, .35), { spec: .3, occ: .55, line: edgeB, lw: 1.1 })}
      <g opacity=".8">
        <circle cx="32" cy="27" r="7.2" fill={lite(A, .55)} />
        <path d="M20 47 C21.5 38 26 34.5 32 34.5 C38 34.5 42.5 38 44 47 Z" fill={lite(A, .38)} />
      </g>
      {motif}
    </>,
    // a keyboard skin is a keybed with its light bar lit
    keybed: (motif) => <>
      {R(4, 18, 56, 30, 4, GA, { lw: 1.4 })}
      {Array.from({ length: 7 }).map((_, i) => <g key={i}>{R(7.5 + i * 7, 27, 6, 18, 1.2, "#f2f6fc", { line: edge, lw: .7, spec: .5 })}</g>)}
      {[0, 1, 3, 4, 5].map(i => <g key={"b" + i}>{R(11 + i * 7, 27, 4, 11, .8, GB, { line: edgeB, lw: .6 })}</g>)}
      {motif}
    </>,
    // a sticker is a die-cut vinyl disc, white border and all
    badge: (motif) => <>
      {E(32, 32, 25, 25, "#ffffff", { spec: .3, occ: .25, line: "#dfe5ef", lw: 1 })}
      {E(32, 32, 21, 21, GA, { lw: 1.2 })}
      {E(32, 32, 21, 21, "none", { line: lite(A, .55), lw: 1.4, lineOp: .55 })}
      {motif}
    </>,
  };

  const byPrefix = [
    ["out-", () => SHAPES.plate(PATTERNS[art] || PATTERNS["out-tshirt"])],
    ["key-", () => SHAPES.keycap(KEY_MOTIF[art])],
    ["thm-", () => SHAPES.scene(THEME_MOTIF[art])],
    ["frm-", () => SHAPES.frame(FRAME_MOTIF[art])],
    ["kbd-", () => SHAPES.keybed(KBD_MOTIF[art])],
    ["stk-", () => SHAPES.badge(STK_MOTIF[art])],
  ].find(([pre]) => art && art.startsWith(pre));
  const draw = byPrefix ? byPrefix[1] : SHAPES[art];
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
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%" stopColor={dim(B, .1)} />
          <stop offset="55%" stopColor={mix(B, C, .28)} />
          <stop offset="100%" stopColor={dim(B, .45)} />
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

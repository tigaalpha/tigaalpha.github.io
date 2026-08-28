/* ── cyber-avatar.tsx ──
   The character, drawn from specific references rather than invented, and
   drawn as a TURNTABLE rather than a portrait: every model is built on one
   parametric rig so the whole figure can be spun a full 360° and still hold
   together from any angle.

   ── THE RIG ──
   The head is treated as an ellipsoid standing on a vertical axis. Two kinds
   of geometry hang off it and they behave differently as it turns, which is
   the whole trick:

     · SHELL — the silhouette itself (skull, helm, hair mass). A rotated
       ellipse still projects to an ellipse, so the shell is simply the
       front-view artwork scaled horizontally by
           k = √( cos²φ + (D·sin φ)² ),  D = depth ÷ width ≈ 1.1
       which widens at profile because a head is deeper than it is wide. Its
       centre also drifts by −E·sin φ, because the neck axis runs behind the
       face: turning right swings the face right and the cranium left.

     · FEATURES — eyes, optics, mouth, LED, vents. Each one sits on the
       surface at its own azimuth θ, recovered from where it is drawn in the
       front view: θ = asin((x − 60) ÷ R). Turning by φ moves it to
           x = cx − E·sin φ + R·sin(θ + φ)
       and squashes it by cos(θ + φ), which also says when it has gone round
       the far side and must stop being drawn. Ears live at ±90°, so they
       swing into view exactly when they should; back-of-skull plating lives
       at 180° and takes over as the figure turns away.

   A nose/brow/chin wedge fades in on the leading edge with |sin φ|, since a
   profile is mostly read from that outline.

   ── THE FIVE BUILDS ──
   Two looks were asked for by name, so the details that make each recognisable
   were looked up rather than guessed.

   T-800 endoskeleton (The Terminator): a skull in polished, worn chrome; deep
   recessed sockets holding red optics with a real iris and lens; and above all
   the exposed dental grille — individually set teeth, an infiltration unit's
   deliberately imperfect human mouth. Sharp zygomatic arches, hollow temples,
   a visible jaw hinge, hydraulic rods in the neck. → VANGUARD.

   CyberLife android (Detroit: Become Human): essentially a human face, marked
   only by the LED ring high on the android's right temple, set level with the
   skin. Blue when calm, yellow while processing hard — in-story legally
   required, as the thing that distinguishes an android from a person. → SPECTER,
   passing as human; and NOVA, the same chassis with its skin panels
   deactivated, which ends up reading as the friendly one because white plating
   with lit seams is soft where chrome and bared teeth are not.

   Two more fill out the roster: SENTINEL, a heavy assault helm — full
   faceplate, one visor band, jaw vents, crest fin; and PHANTOM, mimetic
   polyalloy, a mirror-smooth face with no features at all beyond the contours
   the alloy holds and a fissure that keeps closing itself.

   Everything else still follows what is EQUIPPED: `armorA`/`armorB` come from
   the worn outfit's swatch so a change of gear re-plates the body, and `glow`
   is the chamber's key light. The endoskeleton's optics deliberately ignore
   both and stay red — a T-800 with cyan eyes is not a T-800. ── */

import { useId } from "react";

/* The five base chassis. No gender axis — these are models, the way a car or a
   rifle is a model, and further customisation rides on top of whichever is
   picked. Order runs heavy → light so the row reads as a spectrum. */
export const CHAR_MODELS = [
  { id: "vanguard", code: "V-01",  th: "แวนการ์ด", en: "VANGUARD", zh: "先锋",
    cls: { th: "โครงกระดูกรบ",   en: "Combat endoskeleton", zh: "战斗骨架" } },
  { id: "sentinel", code: "S-02",  th: "เซนทิเนล", en: "SENTINEL", zh: "哨兵",
    cls: { th: "หน่วยจู่โจมหนัก", en: "Heavy assault unit",  zh: "重装突击" } },
  { id: "specter",  code: "SP-03", th: "สเปกเตอร์", en: "SPECTER",  zh: "幻影",
    cls: { th: "แอนดรอยด์แฝงตัว", en: "Infiltration android", zh: "潜行仿生人" } },
  { id: "nova",     code: "N-04",  th: "โนวา",      en: "NOVA",     zh: "新星",
    cls: { th: "โครงขาวสนับสนุน", en: "Support chassis",     zh: "支援机体" } },
  { id: "phantom",  code: "PH-05", th: "แฟนธ่อม",   en: "PHANTOM",  zh: "液金",
    cls: { th: "โลหะเหลวเปลี่ยนรูป", en: "Mimetic polyalloy", zh: "液态合金" } },
];

/* The picker used to be a boy/girl/cute switch, so saved choices are carried
   across to the model that actually looks like what they had rather than
   silently resetting anyone to the default. */
const LEGACY = { boy: "vanguard", girl: "specter", cute: "nova" };
export function normalizeModel(v) {
  if (LEGACY[v]) return LEGACY[v];
  return CHAR_MODELS.some(m => m.id === v) ? v : "vanguard";
}

/* ── RobotGlyph ──
   A humanoid android bust at UI scale, for places the full model is too much
   detail to survive: head, jaw taper, optic band, temple LED, neck and
   shoulders. Monoline and painted in currentColor, so it inherits whatever
   colour the row it sits in is already using and holds up in both themes. */
export function RobotGlyph({ size = 22, className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.6c4.1 0 6.3 2.5 6.3 6.1 0 2.4-.7 4.3-2 5.6-1.2 1.2-2.6 1.9-4.3 1.9s-3.1-.7-4.3-1.9c-1.3-1.3-2-3.2-2-5.6 0-3.6 2.2-6.1 6.3-6.1Z" />
      <path d="M8.9 9.6h2M13.1 9.6h2" />
      <path d="M10.3 13.1h3.4" />
      <circle cx="7.2" cy="6.9" r=".95" />
      <path d="M9.8 16.1v1.9M14.2 16.1v1.9" />
      <path d="M3.9 21.6c1.1-2.3 4.1-3.6 8.1-3.6s7 1.3 8.1 3.6" />
    </svg>
  );
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
/* wrap any angle into −180…180 so callers can spin the yaw counter forever */
export const wrapYaw = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

export function CyberAvatar({ model = "vanguard", yaw = 0, headOnly = false, armorA = "#1a2233", armorB = "#38506e", glow = "#00f0ff", accent = "#aa00ff" }) {
  const id = "ca" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const v = normalizeModel(model);
  const term = v === "vanguard";     // endoskeleton build
  const bare = v === "nova";         // skin deactivated, chassis showing
  const helm = v === "sentinel";     // sealed faceplate
  const morph = v === "phantom";     // liquid metal

  /* ── the rig ── */
  const Y = wrapYaw(yaw);
  const c = Math.cos(Y * RAD), s = Math.sin(Y * RAD);
  const HR = 23;                 // head radius features are mounted on
  const E = 4.2;                 // face plane's offset ahead of the neck axis
  const k = 1;                   // the drawn profile carries the turn, not a stretch
  const cxs = 60 - E * s;                          // silhouette centre
  /* Three views of the same head, weighted by where it is pointing and painted
     back to front. The drawn profile always sits underneath, so at a three-
     quarter angle the front face is intact and only the nose and jaw of the
     profile show past its leading edge — which is exactly what a 3/4 head is. */
  const front = clamp((c - 0.02) / 0.24, 0, 1);    // face plane toward us
  const rear = clamp((-c - 0.02) / 0.24, 0, 1);    // back of the head toward us
  const side = Math.abs(s);

  /* place artwork drawn at front-view centre x0 onto the surface at azimuth th */
  const place = (th, x0, node, key, R = HR) => {
    const a = (th + Y) * RAD;
    const z = Math.cos(a);
    if (z <= 0.015) return null;
    const px = 60 - E * s + R * Math.sin(a);
    const fs = Math.max(0.03, z);
    return (
      <g key={key} opacity={clamp((z - 0.015) / 0.24, 0, 1)}
        transform={`translate(${px.toFixed(2)} 0) scale(${fs.toFixed(3)} 1) translate(${(-x0).toFixed(2)} 0)`}>{node}</g>
    );
  };
  const azOf = (x0) => Math.asin(clamp((x0 - 60) / HR, -1, 1)) * DEG;
  // a feature on the face: azimuth is recovered from where it is drawn
  const face = (x0, node, key) => place(azOf(x0), x0, node, key);
  // a feature on the back of the skull, drawn as it should look from behind
  const back = (x0, node, key) => place(180 + azOf(x0), x0, node, key);
  // the shell: silhouette geometry, which stays an ellipse however it turns
  const shell = (node, key) => (
    <g key={key} transform={`translate(${cxs.toFixed(2)} 0) scale(${k.toFixed(3)} 1) translate(-60 0)`}>{node}</g>
  );

  /* ── the T-800 dental grille ──
     The most recognisable thing about the skull, so it is built tooth by tooth
     rather than faked with a hatched rectangle: an upper and a lower row, each
     tooth its own shape, widths slightly uneven because the original prop's
     teeth were individually mounted to look imperfectly human. Every tooth is
     projected on its own, so the grille curves round the jaw as the head turns
     instead of shearing flat. */
  const teeth = () => {
    const upper = [45.5, 50, 54.5, 59, 63.5, 68, 72.5];
    const lower = [46.5, 51, 55.5, 60, 64.5, 69];
    return (
      <g className="ca-teeth">
        {face(60, <path d="M42 53 Q60 49 78 53 L76 65 Q60 70 44 65 Z" fill="#0a0d14" />, "tg")}
        {upper.map((x, i) => face(x, (
          <rect x={x - 2} y="53.4" width={i % 3 === 1 ? 4.2 : 3.6} height="5.4" rx="1.1"
            fill={`url(#${id}-chrome)`} stroke="#e8f0ff" strokeWidth=".28" opacity=".97" />
        ), "u" + i))}
        {lower.map((x, i) => face(x, (
          <rect x={x - 2} y="60.2" width={i % 2 ? 4 : 3.4} height="4.6" rx="1"
            fill={`url(#${id}-chrome)`} stroke="#e8f0ff" strokeWidth=".28" opacity=".93" />
        ), "l" + i))}
        {face(60, <path d="M43 59.4 Q60 62 77 59.4" fill="none" stroke="#05070c" strokeWidth="1.1" />, "tl")}
      </g>
    );
  };

  /* ── the CyberLife LED ring ──
     High on the android's right temple — which, facing us, is the viewer's
     LEFT — set in a shallow indent level with the skin, cycling blue → yellow
     the way it does while an android is working something out. */
  const ledRing = (cx, cy) => (
    <g className="ca-led">
      <circle cx={cx} cy={cy} r="5.4" fill="#0d1520" opacity=".8" />
      <circle cx={cx} cy={cy} r="4.3" fill="none" stroke="#8fa6c8" strokeWidth=".5" opacity=".6" />
      <circle cx={cx} cy={cy} r="4.3" fill="none" strokeWidth="1.9" strokeLinecap="round"
        stroke="currentColor" strokeDasharray="20 8" transform={`rotate(-90 ${cx} ${cy})`} />
      <circle cx={cx} cy={cy} r="1.5" fill="currentColor" opacity=".9" />
    </g>
  );

  // a human eye for the android builds: lid, iris, pupil, catchlight
  const humanEye = (cx, cy, rx, ry) => (
    <g className="ca-eye">
      <path d={`M${cx - rx} ${cy} Q${cx} ${cy - ry * 1.55} ${cx + rx} ${cy} Q${cx} ${cy + ry * 1.25} ${cx - rx} ${cy} Z`} fill="#f2f7ff" />
      <circle cx={cx} cy={cy} r={ry * 0.86} fill={`url(#${id}-iris)`} />
      <circle cx={cx} cy={cy} r={ry * 0.38} fill="#050a14" />
      <circle cx={cx + rx * 0.2} cy={cy - ry * 0.34} r={ry * 0.24} fill="#fff" />
    </g>
  );

  // the T-800 optic: recessed socket, iris ring, glass lens, hard red core
  const optic = (cx, cy) => (
    <g>
      <path d={`M${cx - 9} ${cy - 3} Q${cx} ${cy - 9} ${cx + 9} ${cy - 3} Q${cx + 8} ${cy + 8} ${cx} ${cy + 9} Q${cx - 8} ${cy + 8} ${cx - 9} ${cy - 3} Z`} fill="#05070c" />
      <circle cx={cx} cy={cy} r="5.4" fill="#1a0206" />
      <circle cx={cx} cy={cy} r="4.6" fill={`url(#${id}-red)`} className="ca-optic" />
      <circle cx={cx} cy={cy} r="4.6" fill="none" stroke="#ff4d5e" strokeWidth=".6" opacity=".8" />
      <circle cx={cx} cy={cy} r="1.7" fill="#fff1f2" opacity=".95" />
      <circle cx={cx - 1.6} cy={cy - 1.8} r=".9" fill="#fff" opacity=".8" />
    </g>
  );

  /* Three side silhouettes, all facing right and mirrored when the model turns
     the other way. They are drawn, not derived — a brow, a nose, the step down
     to the lip and the line of the jaw are what a head is read by in profile,
     and none of that survives being computed from a front view. */
  const SIDE_ORGANIC = "M60 5 C74 5 84 15 84 28 L82 32 L79.5 36 Q85.5 39.5 85.8 42.4 Q85.4 44.4 79 45 L81.5 49 L78 52 L81 56 L77.5 60 Q80.6 62.6 79.6 65.4 C75 72 65 74 56 71 C44 68 36.5 58 36 44 C35.5 28 42 5 60 5 Z";
  const SIDE_SKULL = "M60 3 C74 3 84 12 84 26 L81 30 L77.5 34 Q84.6 37.6 85 41 Q84.4 43.2 77 44 L80 48 L73.5 51 L78 56 L72 61 L76 67 C71 72 61 73 54 69 C43 64 37 55 37 42 C36.5 26 43 3 60 3 Z";
  const SIDE_HELM = "M60 3 L74 6 L84 16 L85 29 L82.5 34 L85.8 41 L83.6 47 L79 51 L80.5 59 L74 67 L63 72 L53 70 L43 63 L36.5 51 L35 35 L38 19 L46 8 Z";
  // the audio/servo port that only exists in profile
  const sideEar = (fill, ln) => (
    <g>
      <path d="M52 36 Q60 33 61 42 Q62 51 53 51 Q49 44 52 36 Z" fill={fill} stroke={ln} strokeWidth=".7" strokeLinejoin="round" />
      <path d="M54 40 Q58 42 55 47" fill="none" stroke={ln} strokeWidth=".8" opacity=".85" />
    </g>
  );

  const HEAD = {
    /* ── VANGUARD · T-800 endoskeleton ── */
    vanguard: {
      skull: "M60 3 C74 3 84 13 84 27 C84 36 81 42 78 47 C75 56 68 66 60 72 C52 66 45 56 42 47 C39 42 36 36 36 27 C36 13 46 3 60 3 Z",
      fill: "chrome", line: "#e6eeff",
      side: SIDE_SKULL,
      sideArt: <>
        {/* sunken socket with the optic burning inside it, seen edge-on */}
        <path d="M70 28 Q80 26 82 33 Q80 39 71 38 Q67 33 70 28 Z" fill="#05070c" />
        <ellipse cx="76" cy="33" rx="3" ry="4.4" fill={`url(#${id}-red)`} className="ca-optic" />
        <ellipse cx="75.4" cy="31.6" rx="1" ry="1.5" fill="#fff1f2" opacity=".9" />
        {/* zygomatic arch running back to the jaw hinge */}
        <path d="M58 38 Q66 42 71 47" fill="none" stroke="#dbe6fb" strokeWidth="2" strokeLinecap="round" opacity=".9" />
        <circle cx="55" cy="43" r="3.4" fill={`url(#${id}-chrome)`} stroke="#9fb4d8" strokeWidth=".6" />
        <circle cx="55" cy="43" r="1.2" fill="#05070c" opacity=".7" />
        {/* the dental grille in profile */}
        <path d="M60 49 L79 51 L78.5 57 L60 57 Z" fill="#0a0d14" />
        {[62.5, 66, 69.5, 73, 76.5].map((x, i) => (
          <g key={i}>
            <rect x={x} y="49.6" width="3" height="4.2" rx=".9" fill={`url(#${id}-chrome)`} stroke="#e8f0ff" strokeWidth=".25" />
            <rect x={x + .4} y="54.4" width="2.6" height="3.4" rx=".8" fill={`url(#${id}-chrome)`} stroke="#e8f0ff" strokeWidth=".25" opacity=".92" />
          </g>
        ))}
        <path d="M48 14 Q60 8 74 12" fill="none" stroke="#c9d8f2" strokeWidth=".8" opacity=".5" />
        <path d="M41 30 Q44 44 50 56" fill="none" stroke="#8fa6c8" strokeWidth=".8" opacity=".45" />
      </>,
      prof: { brow: 22, nose: 34, lip: 54, chin: 68 },
      shellArt: <>
        <path d="M60 4 L60 24" stroke="#c9d8f2" strokeWidth=".7" opacity=".55" />
        <path d="M40 20 Q60 14 80 20" fill="none" stroke="#c9d8f2" strokeWidth=".7" opacity=".45" />
      </>,
      art: <>
        {face(41.5, <path d="M38 26 Q42 24 45 27 L44 36 Q39 34 38 30 Z" fill="#151b26" opacity=".75" />, "t1")}
        {face(78.5, <path d="M82 26 Q78 24 75 27 L76 36 Q81 34 82 30 Z" fill="#151b26" opacity=".75" />, "t2")}
        {face(49, optic(49, 33), "o1")}
        {face(71, optic(71, 33), "o2")}
        {face(60, <path d="M60 39 L64.5 48 L60 50 L55.5 48 Z" fill="#05070c" />, "nas")}
        {/* zygomatic arches — the struts that give the skull its width */}
        {face(42, <path d="M38 38 Q44 44 47 50" fill="none" stroke="#dbe6fb" strokeWidth="2.1" strokeLinecap="round" opacity=".9" />, "z1")}
        {face(78, <path d="M82 38 Q76 44 73 50" fill="none" stroke="#dbe6fb" strokeWidth="2.1" strokeLinecap="round" opacity=".9" />, "z2")}
        {teeth()}
        {face(38.5, <circle cx="38.5" cy="50" r="2.6" fill={`url(#${id}-chrome)`} stroke="#9fb4d8" strokeWidth=".5" />, "h1")}
        {face(81.5, <circle cx="81.5" cy="50" r="2.6" fill={`url(#${id}-chrome)`} stroke="#9fb4d8" strokeWidth=".5" />, "h2")}
      </>,
      rear: <>
        <path d="M44 16 Q60 10 76 16 L74 46 Q60 54 46 46 Z" fill={`url(#${id}-chrome)`} stroke="#9fb4d8" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M60 12 L60 52" stroke="#05070c" strokeWidth="1.4" opacity=".7" />
        <path d="M48 24 L72 24 M48 34 L72 34" stroke="#05070c" strokeWidth=".9" opacity=".5" />
        <circle cx="52" cy="44" r="2.2" fill="#ff2d46" className="ca-optic" />
        <circle cx="68" cy="44" r="2.2" fill="#ff2d46" className="ca-optic" />
      </>,
      neck: <>
        <path d="M52 70 L52 86 M60 72 L60 88 M68 70 L68 86" stroke={`url(#${id}-chrome)`} strokeWidth="3.4" strokeLinecap="round" />
        <path d="M52 70 L52 86 M60 72 L60 88 M68 70 L68 86" stroke="#e6eeff" strokeWidth=".7" strokeLinecap="round" opacity=".55" />
        <circle cx="52" cy="78" r="2" fill="#8fa6c8" /><circle cx="68" cy="78" r="2" fill="#8fa6c8" />
        <circle cx="60" cy="82" r="2.3" fill="#ff2d46" opacity=".85" className="ca-optic" />
      </>,
    },

    /* ── SENTINEL · heavy assault helm ── */
    sentinel: {
      skull: "M60 4 C75 4 85 14 85 29 C85 39 83 46 80 52 L74 66 Q60 74 46 66 L40 52 C37 46 35 39 35 29 C35 14 45 4 60 4 Z",
      fill: "plate", line: "#9fb6de",
      side: SIDE_HELM,
      sideArt: <>
        <path d="M60 3 L66 8 L64 30 L59 32 L57 10 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth=".8" strokeLinejoin="round" />
        {/* the visor band, wrapping round the side of the helm */}
        <path d="M66 28 L84 30 L83 41 L67 41 Z" fill="#05070c" />
        <path d="M67.5 29.6 L82.6 31.4 L81.8 39.4 L68.4 39.4 Z" fill={`url(#${id}-visor)`} className="ca-visor" />
        <path d="M68.5 31.4 L81.6 33" fill="none" stroke="#fff" strokeWidth=".8" opacity=".55" />
        <path d="M62 46 L76 48 L75 54 L62 53 Z" fill="#0d1422" stroke="#7b90b6" strokeWidth=".6" />
        <path d="M64 49 L74 50 M64 51.4 L74 52.2" stroke={glow} strokeWidth=".6" opacity=".6" />
        {sideEar(`url(#${id}-trim)`, glow)}
        <path d="M40 22 Q38 42 44 58" fill="none" stroke={glow} strokeWidth=".8" opacity=".5" />
        <circle cx="46" cy="24" r="1.9" fill={accent} className="ca-optic" />
      </>,
      prof: { brow: 24, nose: 36, lip: 56, chin: 66 },
      shellArt: <>
        {/* crest fin down the crown */}
        <path d="M60 2 L64 10 L62 30 L60 34 L58 30 L56 10 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth=".8" strokeLinejoin="round" />
        <path d="M37 24 Q60 17 83 24" fill="none" stroke={glow} strokeWidth=".9" opacity=".55" />
        <path d="M40 52 Q60 60 80 52" fill="none" stroke="#7b90b6" strokeWidth="1" opacity=".7" />
      </>,
      art: <>
        {/* the visor band — one continuous slit, the whole face of the helm */}
        {face(60, <>
          <path d="M38 30 Q60 24 82 30 L80 41 Q60 47 40 41 Z" fill="#05070c" />
          <path d="M40 31.5 Q60 26 80 31.5 L78.6 39.6 Q60 45 41.4 39.6 Z" fill={`url(#${id}-visor)`} className="ca-visor" />
          <path d="M41 33 Q60 28.5 79 33" fill="none" stroke="#fff" strokeWidth=".9" opacity=".55" />
          <path d="M52 29 L52 44 M68 29 L68 44" stroke="#05070c" strokeWidth="1" opacity=".55" />
        </>, "vis")}
        {/* jaw vents */}
        {face(52, <path d="M48 54 L56 56 L56 62 L49 60 Z" fill="#0d1422" stroke="#7b90b6" strokeWidth=".6" />, "jv1")}
        {face(68, <path d="M72 54 L64 56 L64 62 L71 60 Z" fill="#0d1422" stroke="#7b90b6" strokeWidth=".6" />, "jv2")}
        {face(60, <>
          <path d="M60 47 L60 66" stroke="#7b90b6" strokeWidth=".9" opacity=".7" />
          <path d="M53 64 Q60 68 67 64" fill="none" stroke={glow} strokeWidth="1.4" strokeLinecap="round" opacity=".85" />
        </>, "chin")}
        {face(38, <path d="M35 34 L42 38 L41 50 L36 44 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth=".6" />, "cp1")}
        {face(82, <path d="M85 34 L78 38 L79 50 L84 44 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth=".6" />, "cp2")}
        {face(44, <circle cx="44" cy="24" r="1.9" fill={accent} className="ca-optic" />, "ld")}
      </>,
      rear: <>
        <path d="M42 14 Q60 8 78 14 L76 50 Q60 58 44 50 Z" fill={`url(#${id}-plate)`} stroke="#7b90b6" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M60 10 L60 54" stroke={glow} strokeWidth="1.1" opacity=".6" />
        <path d="M47 22 L73 22 M47 32 L73 32 M47 42 L73 42" stroke="#0b1120" strokeWidth="1.2" opacity=".6" />
        <circle cx="60" cy="27" r="4.4" fill="none" stroke={glow} strokeWidth="1.2" opacity=".8" />
        <circle cx="60" cy="27" r="1.8" fill={glow} className="ca-optic" />
      </>,
      neck: null,
    },

    /* ── SPECTER · CyberLife android, skin active ── */
    specter: {
      skull: "M60 8 C72 8 80 17 81 30 C82 42 78 52 72 60 C68 66 64 70 60 70 C56 70 52 66 48 60 C42 52 38 42 39 30 C40 17 48 8 60 8 Z",
      fill: "skin", line: "#c8ab9e",
      side: SIDE_ORGANIC,
      sideArt: <>
        {/* the hair mass and one long strand, seen from the side */}
        <path d="M60 3 C76 3 85 14 84 27 C80 18 70 15 60 16 C48 17 40 22 37 32 C35 16 44 3 60 3 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" />
        <path d="M37 28 Q31 48 33 70 Q34 82 29 94 L40 94 Q45 78 44 60 Q43 42 46 32 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" opacity=".95" />
        <path d="M68 30 Q74 27 79 31" fill="none" stroke="#8b9bb8" strokeWidth="1.4" strokeLinecap="round" opacity=".8" />
        <g className="ca-eye">
          <path d="M71 36 Q76 32.5 80.5 36 Q76 39.5 71 36 Z" fill="#f2f7ff" />
          <circle cx="76.4" cy="36" r="2.5" fill={`url(#${id}-iris)`} />
          <circle cx="76.4" cy="36" r="1.1" fill="#050a14" />
        </g>
        <path d="M73.5 50.5 Q77 49.5 79.5 51" fill="none" stroke="#c98f96" strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
        {sideEar(`url(#${id}-skin)`, "#b99283")}
        <path d="M46 42 Q47 58 56 68" fill="none" stroke={glow} strokeWidth=".6" opacity=".4" />
        {ledRing(45, 25)}
      </>,
      prof: { brow: 27, nose: 38, lip: 56, chin: 68 },
      shellArt: <>
        <path d="M60 5 C75 5 84 15 84 29 C79 21 71 18 60 18 C49 18 41 21 36 29 C36 15 45 5 60 5 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".8" strokeLinejoin="round" opacity=".95" />
        <path d="M38 26 Q30 44 32 68 Q33 80 28 92 L36 92 Q42 76 41 60 Q40 42 44 32 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" opacity=".9" />
        <path d="M82 26 Q90 44 88 68 Q87 80 92 92 L84 92 Q78 76 79 60 Q80 42 76 32 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" opacity=".9" />
      </>,
      art: <>
        {face(49.5, <path d="M43 30 Q50 27 56 29" fill="none" stroke="#8b9bb8" strokeWidth="1.5" strokeLinecap="round" opacity=".8" />, "b1")}
        {face(70.5, <path d="M64 29 Q70 27 77 30" fill="none" stroke="#8b9bb8" strokeWidth="1.5" strokeLinecap="round" opacity=".8" />, "b2")}
        {face(50, humanEye(50, 36, 7.4, 4.3), "e1")}
        {face(70, humanEye(70, 36, 7.4, 4.3), "e2")}
        {face(60, <path d="M60 38 L60 47 M57 48.6 Q60 50.2 63 48.6" fill="none" stroke="#7f8fac" strokeWidth="1" strokeLinecap="round" opacity=".85" />, "n")}
        {face(60, <path d="M53 56 Q56.5 53.6 60 55 Q63.5 53.6 67 56 Q63.5 60 60 60 Q56.5 60 53 56 Z" fill="#c98f96" opacity=".55" />, "m")}
        {/* the seam where the skin panel meets the jaw */}
        {face(45, <path d="M41 40 Q40 56 52 66" fill="none" stroke={glow} strokeWidth=".6" opacity=".45" />, "s1")}
        {face(75, <path d="M79 40 Q80 56 68 66" fill="none" stroke={glow} strokeWidth=".6" opacity=".45" />, "s2")}
        {face(41.5, ledRing(41.5, 29), "led")}
      </>,
      rear: <>
        <path d="M38 14 Q60 4 82 14 Q88 40 84 70 Q80 86 76 94 L44 94 Q40 86 36 70 Q32 40 38 14 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" opacity=".97" />
        <path d="M52 20 Q60 44 56 92 M68 20 Q60 44 64 92" fill="none" stroke="#5b6489" strokeWidth=".8" opacity=".55" />
      </>,
      neck: null,
    },

    /* ── NOVA · android with its skin panels deactivated ── */
    nova: {
      skull: "M60 10 C76 10 86 21 86 36 C86 51 78 63 68 68 C64 70 56 70 52 68 C42 63 34 51 34 36 C34 21 44 10 60 10 Z",
      fill: "white", line: "#dbe6f7",
      side: SIDE_ORGANIC,
      sideArt: <>
        <path d="M50 15 Q62 10 74 15 L72 21 Q61 17 51 21 Z" fill="#dce8f7" stroke={glow} strokeWidth=".8" opacity=".95" />
        <path d="M38 30 Q60 24 82 30 M42 52 Q60 58 78 54" fill="none" stroke={glow} strokeWidth=".8" opacity=".6" />
        <g className="ca-eye">
          <path d="M70 38 Q76 34 81 38 Q76 42.5 70 38 Z" fill="#f2f7ff" />
          <circle cx="76" cy="38" r="3.1" fill={`url(#${id}-iris)`} />
          <circle cx="76" cy="38" r="1.3" fill="#050a14" />
        </g>
        <path d="M72 54 Q77 57 80 54" fill="none" stroke={glow} strokeWidth="1.7" strokeLinecap="round" />
        {sideEar(`url(#${id}-white)`, glow)}
        <path d="M40 36 L46 40 L45 50 L39 44 Z" fill="#c3d2e6" stroke={glow} strokeWidth=".6" opacity=".8" />
        {ledRing(43, 30)}
      </>,
      prof: { brow: 30, nose: 42, lip: 60, chin: 68 },
      shellArt: <>
        <path d="M60 11 L60 26 M36 34 Q60 28 84 34" fill="none" stroke={glow} strokeWidth=".8" opacity=".7" />
        <path d="M46 20 Q60 16 74 20 L72 26 Q60 22 48 26 Z" fill="#dce8f7" stroke={glow} strokeWidth=".8" opacity=".95" />
      </>,
      art: <>
        {face(39, <path d="M36 40 L42 44 L40 54 L35 46 Z" fill="#c3d2e6" stroke={glow} strokeWidth=".6" opacity=".8" />, "p1")}
        {face(81, <path d="M84 40 L78 44 L80 54 L85 46 Z" fill="#c3d2e6" stroke={glow} strokeWidth=".6" opacity=".8" />, "p2")}
        {face(49, humanEye(49, 40, 9, 6.2), "e1")}
        {face(71, humanEye(71, 40, 9, 6.2), "e2")}
        {face(60, <path d="M60 44 L60 52 M57 53.4 Q60 55 63 53.4" fill="none" stroke="#7f8fac" strokeWidth="1" strokeLinecap="round" opacity=".8" />, "n")}
        {face(60, <>
          <path d="M42 54 Q60 60 78 54" fill="none" stroke={glow} strokeWidth=".8" opacity=".7" />
          <path d="M52 60 Q60 65 68 60" fill="none" stroke={glow} strokeWidth="1.9" strokeLinecap="round" />
          <path d="M55 62.4 Q60 65 65 62.4" fill="none" stroke={glow} strokeWidth=".9" strokeLinecap="round" opacity=".5" />
        </>, "m")}
        {face(37, ledRing(37, 34), "led")}
      </>,
      rear: <>
        <path d="M40 16 Q60 8 80 16 Q84 42 78 62 Q60 72 42 62 Q36 42 40 16 Z" fill={`url(#${id}-white)`} stroke={glow} strokeWidth=".8" strokeLinejoin="round" />
        <path d="M60 12 L60 68" stroke={glow} strokeWidth="1" opacity=".65" />
        <path d="M44 28 Q60 22 76 28 M44 44 Q60 38 76 44" fill="none" stroke={glow} strokeWidth=".8" opacity=".5" />
        <circle cx="60" cy="36" r="5" fill="#dce8f7" stroke={glow} strokeWidth=".9" />
        <circle cx="60" cy="36" r="2" fill={glow} className="ca-optic" />
      </>,
      neck: null,
    },

    /* ── PHANTOM · mimetic polyalloy ── */
    phantom: {
      skull: "M60 6 C74 6 83 16 83 30 C83 44 76 58 68 66 Q60 72 52 66 C44 58 37 44 37 30 C37 16 46 6 60 6 Z",
      fill: "chrome", line: "#f0f6ff",
      side: SIDE_ORGANIC,
      sideArt: <>
        <path d="M44 12 Q60 6 78 14" fill="none" stroke="#fff" strokeWidth="1.2" opacity=".34" />
        <path d="M40 30 Q42 50 52 64" fill="none" stroke="#fff" strokeWidth="1" opacity=".26" />
        <path d="M70 33 Q76 30 81 34 Q76 37.5 70 33 Z" fill="#8fa3c4" opacity=".45" />
        <path d="M71.5 33.4 Q76 31.4 79.5 34 Q76 36 71.5 33.4 Z" fill="#05070c" opacity=".55" />
        <path d="M62 42 Q68 46 66 52" fill="none" stroke="#fff" strokeWidth="1.1" opacity=".24" />
        {sideEar(`url(#${id}-chrome)`, "#c9d8f2")}
        <g className="ca-morph">
          <path d="M48 16 L52 28 L48 38 L53 49" fill="none" stroke="#05070c" strokeWidth="1.3" strokeLinecap="round" opacity=".5" />
          <path d="M48 16 L52 28 L48 38 L53 49" fill="none" stroke="#eaf3ff" strokeWidth=".55" strokeLinecap="round" />
        </g>
        <ellipse cx="58" cy="20" rx="16" ry="5" fill="#fff" opacity=".22" transform="rotate(-14 58 20)" />
      </>,
      prof: { brow: 24, nose: 36, lip: 54, chin: 66 },
      shellArt: <>
        {/* the alloy holds a face only as contours — light bending on liquid metal */}
        <path d="M60 8 Q66 26 60 66" fill="none" stroke="#ffffff" strokeWidth=".8" opacity=".38" />
        <path d="M41 22 Q60 12 79 22" fill="none" stroke="#ffffff" strokeWidth="1.1" opacity=".3" />
      </>,
      art: <>
        {face(49, <>
          <path d="M42 32 Q49 27 56 32 Q49 38 42 32 Z" fill="#8fa3c4" opacity=".5" />
          <path d="M43.5 32 Q49 29 54.5 32 Q49 35 43.5 32 Z" fill="#05070c" opacity=".65" />
          <circle cx="50.5" cy="31" r="1.1" fill="#fff" opacity=".85" />
        </>, "e1")}
        {face(71, <>
          <path d="M64 32 Q71 27 78 32 Q71 38 64 32 Z" fill="#8fa3c4" opacity=".5" />
          <path d="M65.5 32 Q71 29 76.5 32 Q71 35 65.5 32 Z" fill="#05070c" opacity=".65" />
          <circle cx="72.5" cy="31" r="1.1" fill="#fff" opacity=".85" />
        </>, "e2")}
        {face(60, <>
          <path d="M60 34 Q62.6 42 60 48 Q57.4 46 57.6 43" fill="none" stroke="#ffffff" strokeWidth=".9" opacity=".45" />
          <path d="M52 55 Q60 52 68 55 Q60 59 52 55 Z" fill="#7d90b0" opacity=".45" />
          <path d="M52 55 Q60 57 68 55" fill="none" stroke="#05070c" strokeWidth=".8" opacity=".5" />
        </>, "m")}
        {/* the fissure the alloy keeps closing — kept off the face's centre line
            so it reads as damage healing, not as a feature */}
        {face(43, <g className="ca-morph">
          <path d="M40 20 L44 30 L41 39 L45 49" fill="none" stroke="#05070c" strokeWidth="1.4" strokeLinecap="round" opacity=".55" />
          <path d="M40 20 L44 30 L41 39 L45 49" fill="none" stroke="#eaf3ff" strokeWidth=".55" strokeLinecap="round" />
        </g>, "fis")}
        {face(60, <ellipse cx="60" cy="24" rx="14" ry="4" fill="#fff" opacity=".3" />, "spec")}
        {/* cheekbones and brow ridge, held in the alloy as reflections only */}
        {face(45, <path d="M41 40 Q46 46 50 50" fill="none" stroke="#fff" strokeWidth="1.2" opacity=".26" />, "ck1")}
        {face(75, <path d="M79 40 Q74 46 70 50" fill="none" stroke="#fff" strokeWidth="1.2" opacity=".26" />, "ck2")}
        {face(49, <path d="M42 27 Q49 24 56 27" fill="none" stroke="#05070c" strokeWidth="1" opacity=".3" />, "br1")}
        {face(71, <path d="M64 27 Q71 24 78 27" fill="none" stroke="#05070c" strokeWidth="1" opacity=".3" />, "br2")}
      </>,
      rear: <>
        <path d="M40 14 Q60 6 80 14 Q84 40 74 62 Q60 70 46 62 Q36 40 40 14 Z" fill={`url(#${id}-chrome)`} stroke="#dbe6f7" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M46 22 Q60 16 74 22" fill="none" stroke="#fff" strokeWidth="1" opacity=".35" />
        <path d="M60 12 Q56 40 60 66" fill="none" stroke="#fff" strokeWidth=".7" opacity=".28" />
      </>,
      neck: null,
    },
  }[v];

  const shellFill = `url(#${id}-${HEAD.fill})`;
  /* ── the profile ──
     A parametric squash alone cannot turn a head: past about 45° there is
     nothing left of the face and the silhouette reads as a blank egg. So each
     build also carries a DRAWN side view, and it cross-fades in with |sin φ|
     over the front one — the union of the two at 45° is a real three-quarter
     head, and at 90° the profile has taken over completely. It is mirrored
     wholesale when the model turns the other way, and its own detailing fades
     out as the head passes 90° and starts showing its back. */
  const dir = s >= 0 ? 1 : -1;
  const ws = clamp((side - 0.08) / 0.45, 0, 1);
  // the side view's own detailing yields to whichever face is actually toward us
  const profArt = ws * (1 - front * 0.85) * clamp((c + 0.3) / 0.35, 0, 1);
  const profile = ws > 0.02 && (
    <g opacity={ws.toFixed(3)} transform={`translate(${(cxs - 60).toFixed(2)} 0)${dir < 0 ? " translate(120 0) scale(-1 1)" : ""}`}>
      <path d={HEAD.side} fill={shellFill} stroke={HEAD.line} strokeWidth="1" strokeLinejoin="round" />
      <path d={HEAD.side} fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1.4" strokeLinejoin="round" />
      <path d={HEAD.side} fill="none" stroke="#fff" strokeWidth="1.1" opacity={HEAD.fill === "chrome" ? ".55" : ".3"} strokeDasharray="26 84" />
      <g opacity={profArt.toFixed(3)}>{HEAD.sideArt}</g>
    </g>
  );

  // torso is far shallower than it is wide, so it narrows hard at profile
  const kt = Math.sqrt(c * c + 0.58 * 0.58 * s * s);

  return (
    <svg className={`ca ca-${v}`} viewBox={headOnly ? "31 1 58 74" : "0 0 120 152"} width="100%" height="100%" aria-hidden="true">
      <defs>
        {/* Polished, worn chrome. A hard specular band with dark falloff either
            side is what separates chrome from flat grey — the T-800's finish is
            plated metal, not paint. */}
        <linearGradient id={`${id}-chrome`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#e9f1ff" />
          <stop offset="18%" stopColor="#9fb2d2" />
          <stop offset="34%" stopColor="#f4f8ff" />
          <stop offset="52%" stopColor="#6d7f9e" />
          <stop offset="74%" stopColor="#33405a" />
          <stop offset="100%" stopColor="#141b28" />
        </linearGradient>
        <linearGradient id={`${id}-skin`} x1="0.35" y1="0" x2="0.65" y2="1">
          <stop offset="0%" stopColor="#f3e2d8" />
          <stop offset="42%" stopColor="#dcc3b6" />
          <stop offset="78%" stopColor="#a98d84" />
          <stop offset="100%" stopColor="#6d5a58" />
        </linearGradient>
        <linearGradient id={`${id}-white`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#e2ebf6" />
          <stop offset="80%" stopColor="#a9b8cc" />
          <stop offset="100%" stopColor="#6f7f96" />
        </linearGradient>
        <radialGradient id={`${id}-red`}>
          <stop offset="0%" stopColor="#ffd9dc" />
          <stop offset="32%" stopColor="#ff2d46" />
          <stop offset="100%" stopColor="#8c0010" />
        </radialGradient>
        <radialGradient id={`${id}-iris`}>
          <stop offset="0%" stopColor="#bfe9ff" />
          <stop offset="55%" stopColor="#3aa8dd" />
          <stop offset="100%" stopColor="#12405e" />
        </radialGradient>
        <linearGradient id={`${id}-plate`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#8b9ec2" />
          <stop offset="26%" stopColor="#4a5a78" />
          <stop offset="62%" stopColor="#232d42" />
          <stop offset="100%" stopColor="#0d1220" />
        </linearGradient>
        <linearGradient id={`${id}-hair`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#4a5372" />
          <stop offset="55%" stopColor="#2b3149" />
          <stop offset="100%" stopColor="#161a2a" />
        </linearGradient>
        <linearGradient id={`${id}-trim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={armorB} />
          <stop offset="100%" stopColor={armorA} />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={term ? "#ff2d46" : glow} stopOpacity=".9" />
          <stop offset="55%" stopColor={glow} stopOpacity=".15" />
          <stop offset="100%" stopColor={accent} stopOpacity=".75" />
        </linearGradient>
        <linearGradient id={`${id}-visor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".95" />
          <stop offset="40%" stopColor={glow} />
          <stop offset="100%" stopColor={accent} stopOpacity=".85" />
        </linearGradient>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="70%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-mask`}><rect x="0" y="0" width="120" height="152" fill={`url(#${id}-fade)`} /></mask>
      </defs>

      <g mask={headOnly ? undefined : `url(#${id}-mask)`}>
        {/* ── torso ── */}
        {!headOnly && (
          <g>
            <g transform={`translate(60 0) scale(${kt.toFixed(3)} 1) translate(-60 0)`}>
              <path d="M60 76 L86 86 L92 108 L84 140 L36 140 L28 108 L34 86 Z"
                fill={`url(#${id}-${term || morph ? "chrome" : bare ? "white" : "plate"})`} stroke={term || morph ? "#cfdcf4" : bare ? "#dbe6f7" : "#8fa3c8"} strokeWidth="1.1" strokeLinejoin="round" />
              {/* front detailing — gone once the back is toward us */}
              <g opacity={front}>
                <path d="M60 78 L60 134" stroke={term ? "#cfdcf4" : glow} strokeWidth=".9" opacity=".5" />
                <path d="M40 96 L52 100 M80 96 L68 100" stroke={term ? "#cfdcf4" : glow} strokeWidth=".9" opacity=".45" />
                <path d="M40 122 L80 122 L78 134 L42 134 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth=".9" opacity=".95" />
                <g className="ca-core">
                  <circle cx="60" cy="106" r="11" fill="none" stroke={term ? "#ff2d46" : glow} strokeWidth="1.2" opacity=".85" />
                  <path d="M60 97 L69 106 L60 115 L51 106 Z" fill={term ? `url(#${id}-red)` : `url(#${id}-visor)`} />
                  <circle cx="60" cy="106" r="4" fill="#fff" opacity=".92" />
                </g>
              </g>
              {/* spine and dorsal vents — what you see from behind */}
              <g opacity={rear}>
                <path d="M60 80 L60 138" stroke="#05070c" strokeWidth="2.2" opacity=".7" />
                <path d="M48 92 L72 92 M46 104 L74 104 M46 116 L74 116" stroke="#05070c" strokeWidth="1.4" opacity=".55" />
                <path d="M50 86 L70 86 L72 100 L48 100 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth=".8" opacity=".9" />
                <circle cx="60" cy="93" r="2.6" fill={glow} className="ca-optic" />
              </g>
            </g>
            {/* shoulder pads ride on the shoulder line, so they swing round it */}
            {place(-74, 26, (
              <g>
                <path d="M34 84 L18 94 L16 112 L30 108 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth="1.2" strokeLinejoin="round" />
                <circle cx="24" cy="102" r="2.6" fill={term ? "#ff2d46" : glow} className="ca-optic" />
              </g>
            ), "sp1", 34)}
            {place(74, 94, (
              <g>
                <path d="M86 84 L102 94 L104 112 L90 108 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth="1.2" strokeLinejoin="round" />
                <circle cx="96" cy="102" r="2.6" fill={accent} className="ca-optic" />
              </g>
            ), "sp2", 34)}
          </g>
        )}

        {/* ── neck ── */}
        {HEAD.neck || (
          <g transform={`translate(60 0) scale(${(0.72 + 0.28 * kt).toFixed(3)} 1) translate(-60 0)`}>
            <path d="M52 62 L68 62 L70 80 L50 80 Z" fill={`url(#${id}-${bare || helm ? "white" : morph ? "chrome" : "skin"})`} stroke="#7f8fac" strokeWidth=".7" />
            <path d="M49 78 L71 78" stroke={glow} strokeWidth="1.3" opacity=".7" />
          </g>
        )}

        {/* ── head ── */}
        {profile}
        {rear > 0.01 && shell(<g opacity={rear.toFixed(3)}>
          <path d={HEAD.skull} fill={shellFill} stroke={HEAD.line} strokeWidth="1" strokeLinejoin="round" />
          <path d={HEAD.skull} fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1.5" strokeLinejoin="round" />
          {HEAD.rear}
        </g>, "rear")}
        {front > 0.01 && shell(<g opacity={front.toFixed(3)}>
          <path d={HEAD.skull} fill={shellFill} stroke={HEAD.line} strokeWidth="1" strokeLinejoin="round" />
          <path d={HEAD.skull} fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1.5" strokeLinejoin="round" />
          {HEAD.shellArt}
          {/* one specular sweep — what stops flat vector reading as flat */}
          <path d={HEAD.skull} fill="none" stroke="#fff" strokeWidth="1.2" opacity={HEAD.fill === "chrome" ? ".6" : ".32"} strokeDasharray="28 88" />
        </g>, "shell")}
        {front > 0.01 && <g opacity={front.toFixed(3)}>{HEAD.art}</g>}
      </g>
    </svg>
  );
}

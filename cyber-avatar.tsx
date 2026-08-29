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
    cls: { th: "โครงกระดูกรบ",     en: "Combat endoskeleton", zh: "战斗骨架" } },
  { id: "sentinel", code: "S-02",  th: "เซนทิเนล", en: "SENTINEL", zh: "哨兵",
    cls: { th: "หน่วยจู่โจมหนัก",   en: "Heavy assault unit",  zh: "重装突击" } },
  { id: "reaper",   code: "R-03",  th: "รีปเปอร์", en: "REAPER",   zh: "死神",
    cls: { th: "เครื่องจักรสงคราม", en: "War machine",         zh: "战争机器" } },
  { id: "ronin",    code: "RN-04", th: "โรนิน",    en: "RONIN",    zh: "浪人",
    cls: { th: "ซามูไรไซเบอร์",     en: "Cyber samurai",       zh: "赛博武士" } },
  { id: "phantom",  code: "PH-05", th: "แฟนธ่อม",  en: "PHANTOM",  zh: "液金",
    cls: { th: "โลหะเหลวเปลี่ยนรูป", en: "Mimetic polyalloy",  zh: "液态合金" } },
  { id: "specter",  code: "SP-06", th: "สเปกเตอร์", en: "SPECTER", zh: "幻影",
    cls: { th: "แอนดรอยด์แฝงตัว",   en: "Infiltration android", zh: "潜行仿生人" } },
  { id: "aurora",   code: "AU-07", th: "ออโรร่า",   en: "AURORA",  zh: "极光",
    cls: { th: "แอนดรอยด์ไอดอล",    en: "Idol android",        zh: "偶像仿生人" } },
  { id: "nova",     code: "N-08",  th: "โนวา",      en: "NOVA",    zh: "新星",
    cls: { th: "หุ่นผู้ช่วยตัวจิ๋ว",  en: "Little helper unit",  zh: "迷你助手" } },
  { id: "pixel",    code: "PX-09", th: "พิกเซล",    en: "PIXEL",   zh: "像素",
    cls: { th: "หุ่นหน้าจอจิ๋ว",     en: "Screen-face buddy",   zh: "屏幕脸小伙伴" } },
  { id: "mochi",    code: "MO-10", th: "โมจิ",      en: "MOCHI",   zh: "麻糬",
    cls: { th: "หุ่นนุ่มนิ่มสุดน่ารัก", en: "Squishy pocket bot", zh: "软萌口袋机器人" } },
];


/* The picker used to be a boy/girl/cute switch, so saved choices are carried
   across to the model that actually looks like what they had rather than
   silently resetting anyone to the default. */
/* How each model is proportioned. Exported because the stage has to hang
   equipped gear on the right body — a chibi's head is nearly twice the size and
   its hands sit higher, so headgear and held items cannot use one fixed offset. */
export const MODEL_RIG = {
  vanguard: { hs: 1.15 }, sentinel: { hs: 1.15 }, reaper: { hs: 1.15 }, ronin: { hs: 1.15 },
  phantom: { hs: 1.15 }, specter: { hs: 1.15 }, aurora: { hs: 1.15 },
  nova: { hs: 2.05, chibi: true }, pixel: { hs: 2.0, chibi: true }, mochi: { hs: 1.95, chibi: true },
};

const LEGACY = { boy: "vanguard", girl: "specter", cute: "nova" };
export function normalizeModel(v) {
  if (LEGACY[v]) return LEGACY[v];
  return CHAR_MODELS.some(m => m.id === v) ? v : "vanguard";
}

/* ── RobotGlyph ──
   A combat android's head at UI scale: a chamfered helm narrowing to a jaw, one
   lit visor slot with a pair of optics behind it, a crest antenna and two side
   ports. Monoline in currentColor, so it takes the colour of the row it sits in
   and holds up in both themes. At 21px it has to read as a robot in one glance,
   which is why it is a helm with a visor and not a portrait with a face. */
export function RobotGlyph({ size = 22, className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* crest antenna */}
      <path d="M12 1.3v2.4" />
      <circle cx="12" cy="1.1" r=".95" fill="currentColor" stroke="none" />
      {/* helm: chamfered at the crown, drawn in to a jaw */}
      <path d="M9.2 3.7h5.6l3 2.9v5.2l-2.4 3.1h-6.8l-2.4-3.1V6.6Z" />
      {/* side ports */}
      <path d="M6.4 8.4H4.3M17.6 8.4h2.1" />
      {/* visor slot with two optics burning behind it */}
      <path d="M8.7 7.7h6.6v2.6H8.7Z" />
      <circle cx="10.4" cy="9" r=".85" fill="currentColor" stroke="none" />
      <circle cx="13.6" cy="9" r=".85" fill="currentColor" stroke="none" />
      {/* jaw vent */}
      <path d="M10 12.7h4" />
      {/* neck struts and shoulder line, so it reads as a unit and not a mask */}
      <path d="M10.2 15.1v2.1M13.8 15.1v2.1" />
      <path d="M4.6 22.3c1.2-2.2 3.9-3.4 7.4-3.4s6.2 1.2 7.4 3.4" />
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
        <path d="M51 70 L51 92 M60 72 L60 94 M69 70 L69 92" stroke={`url(#${id}-chrome)`} strokeWidth="4.6" strokeLinecap="round" />
        <path d="M51 70 L51 92 M60 72 L60 94 M69 70 L69 92" stroke="#e6eeff" strokeWidth=".9" strokeLinecap="round" opacity=".55" />
        <circle cx="52" cy="80" r="2" fill="#8fa6c8" /><circle cx="68" cy="80" r="2" fill="#8fa6c8" />
        <circle cx="60" cy="85" r="2.3" fill="#ff2d46" opacity=".85" className="ca-optic" />
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
      fill: "skin", line: "#c8ab9e", neckFill: "skin",
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

    /* ── REAPER · war machine ── */
    reaper: {
      skull: "M60 2 L76 6 L86 18 L84 33 L79 46 L70 62 L60 73 L50 62 L41 46 L36 33 L34 18 L44 6 Z",
      fill: "plate", line: "#7a89a8", hv: "13 -3 94 84",
      prof: { brow: 24, nose: 36, lip: 54, chin: 70 },
      shellArt: <>
        {/* horns swept back off the temples — the whole silhouette of the thing */}
        <path d="M42 15 L16 1 L23 21 L40 28 Z" fill={`url(#${id}-trim)`} stroke="#ff2d46" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M78 15 L104 1 L97 21 L80 28 Z" fill={`url(#${id}-trim)`} stroke="#ff2d46" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M60 3 L60 24" stroke="#ff2d46" strokeWidth="1.1" opacity=".55" />
      </>,
      art: <>
        {face(60, <>
          <path d="M37 27 L83 27 L78 45 L42 45 Z" fill="#05070c" />
          <ellipse cx="60" cy="36" rx="14" ry="7" fill={`url(#${id}-red)`} className="ca-optic" />
          <ellipse cx="60" cy="36" rx="4.6" ry="3.1" fill="#fff1f2" opacity=".95" />
          <path d="M39 29.5 L81 29.5" stroke="#ff4d5e" strokeWidth=".9" opacity=".7" />
        </>, "opt")}
        {face(60, <>
          <path d="M44 49 L76 49 L71 67 L49 67 Z" fill="#0a0d14" />
          <path d="M46 53 L74 53 M47 57.5 L73 57.5 M48.5 62 L71.5 62" stroke="#ff2d46" strokeWidth="1.1" opacity=".5" />
        </>, "jaw")}
        {face(40, <circle cx="40" cy="34" r="2.1" fill="#ff2d46" className="ca-optic" />, "r1")}
        {face(80, <circle cx="80" cy="34" r="2.1" fill="#ff2d46" className="ca-optic" />, "r2")}
      </>,
      side: SIDE_HELM,
      sideArt: <>
        <path d="M56 14 L28 2 L34 22 L54 28 Z" fill={`url(#${id}-trim)`} stroke="#ff2d46" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M66 28 L84 30 L82 42 L67 42 Z" fill="#05070c" />
        <ellipse cx="77" cy="35.5" rx="6" ry="5" fill={`url(#${id}-red)`} className="ca-optic" />
        <ellipse cx="76" cy="34" rx="2" ry="1.8" fill="#fff1f2" opacity=".9" />
        <path d="M60 48 L78 50 L74 64 L60 64 Z" fill="#0a0d14" />
        <path d="M62 53 L76 54 M63 58 L75 59" stroke="#ff2d46" strokeWidth="1" opacity=".5" />
        <path d="M42 24 Q39 42 45 58" fill="none" stroke="#7a89a8" strokeWidth=".9" opacity=".5" />
      </>,
      rear: <>
        <path d="M42 14 Q60 8 78 14 L76 52 Q60 60 44 52 Z" fill={`url(#${id}-plate)`} stroke="#5d6a86" strokeWidth=".8" strokeLinejoin="round" />
        {/* exhaust stacks */}
        <path d="M46 10 L52 10 L52 30 L46 30 Z M68 10 L74 10 L74 30 L68 30 Z" fill="#0a0d14" stroke="#7a89a8" strokeWidth=".7" />
        <circle cx="49" cy="12" r="2.2" fill="#ff2d46" className="ca-optic" />
        <circle cx="71" cy="12" r="2.2" fill="#ff2d46" className="ca-optic" />
        <path d="M46 38 L74 38 M46 46 L74 46" stroke="#05070c" strokeWidth="1.4" opacity=".6" />
      </>,
      neck: null,
    },

    /* ── RONIN · cyber samurai ── */
    ronin: {
      skull: "M60 8 C76 8 85 18 85 32 C85 43 81 53 74 62 Q60 73 46 62 C39 53 35 43 35 32 C35 18 44 8 60 8 Z",
      fill: "lacquer", line: "#d98a8a", body: "lacquer", bodyLine: "#c07070", hv: "21 -5 78 84",
      prof: { brow: 26, nose: 37, lip: 55, chin: 70 },
      shellArt: <>
        {/* kabuto brim, and the maedate crest standing off the forehead */}
        <path d="M24 32 Q60 10 96 32 L93 41 Q60 21 27 41 Z" fill={`url(#${id}-lacquer)`} stroke="#e8a5a5" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M45 17 Q60 -3 75 17 Q60 5 45 17 Z" fill="#ffd23f" stroke="#8a6a00" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M60 6 L60 16" stroke="#ffd23f" strokeWidth="1.4" />
      </>,
      art: <>
        {face(48, <>
          <path d="M39 32 L57 29 L56 39 L40 40 Z" fill="#05070c" />
          <path d="M41 33.6 L55.4 31.2 L54.6 37.4 L41.8 38.2 Z" fill="#ff3b4d" className="ca-optic" />
        </>, "e1")}
        {face(72, <>
          <path d="M81 32 L63 29 L64 39 L80 40 Z" fill="#05070c" />
          <path d="M79 33.6 L64.6 31.2 L65.4 37.4 L78.2 38.2 Z" fill="#ff3b4d" className="ca-optic" />
        </>, "e2")}
        {/* menpo: the war mask over the lower face, with its fanged grille */}
        {face(60, <>
          <path d="M41 45 Q60 41 79 45 L74 66 Q60 75 46 66 Z" fill="#1d060b" stroke="#c0392b" strokeWidth=".9" strokeLinejoin="round" />
          <path d="M45 51 Q60 48 75 51" fill="none" stroke="#e8a5a5" strokeWidth=".8" opacity=".7" />
          {[48, 53, 58, 63, 68].map((x, i) => (
            <path key={i} d={`M${x} 55 L${x + 3.4} 55 L${x + 1.7} 63 Z`} fill="#e8e2d2" stroke="#8a6a00" strokeWidth=".25" />
          ))}
          <path d="M46 66 Q60 72 74 66" fill="none" stroke="#c0392b" strokeWidth="1.2" />
        </>, "mask")}
        {face(37, <path d="M35 40 L42 44 L41 54 L34 47 Z" fill={`url(#${id}-lacquer)`} stroke="#e8a5a5" strokeWidth=".6" />, "c1")}
        {face(83, <path d="M85 40 L78 44 L79 54 L86 47 Z" fill={`url(#${id}-lacquer)`} stroke="#e8a5a5" strokeWidth=".6" />, "c2")}
      </>,
      side: SIDE_ORGANIC,
      sideArt: <>
        <path d="M34 34 Q58 12 88 30 L86 39 Q58 23 36 43 Z" fill={`url(#${id}-lacquer)`} stroke="#e8a5a5" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M56 18 Q66 0 78 16 Q66 8 56 18 Z" fill="#ffd23f" stroke="#8a6a00" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M67 32 L81 30 L80 39 L68 40 Z" fill="#05070c" />
        <path d="M69 33.6 L79.4 32 L78.6 37.6 L69.8 38.4 Z" fill="#ff3b4d" className="ca-optic" />
        <path d="M58 45 Q72 42 82 47 L78 64 Q66 71 58 66 Z" fill="#1d060b" stroke="#c0392b" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M63 55 L66 55 L64.5 62 Z M70 55.5 L73 55.5 L71.5 62.5 Z" fill="#e8e2d2" />
        <path d="M40 44 Q42 58 50 66" fill="none" stroke="#c07070" strokeWidth=".8" opacity=".55" />
      </>,
      rear: <>
        <path d="M40 16 Q60 8 80 16 Q84 42 78 62 Q60 72 42 62 Q36 42 40 16 Z" fill={`url(#${id}-lacquer)`} stroke="#c07070" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M60 12 L60 66" stroke="#e8a5a5" strokeWidth="1" opacity=".5" />
        <path d="M44 28 Q60 22 76 28 M44 44 Q60 38 76 44" fill="none" stroke="#c0392b" strokeWidth=".9" opacity=".6" />
        {/* the knot of the mask's cord */}
        <path d="M52 50 L68 50 L64 62 L56 62 Z" fill="#c0392b" opacity=".8" />
      </>,
      neck: null,
    },

    /* ── AURORA · idol android ── */
    aurora: {
      skull: "M60 8 C73 8 81 18 82 31 C83 43 78 53 72 61 C68 67 64 71 60 71 C56 71 52 67 48 61 C42 53 37 43 38 31 C39 18 47 8 60 8 Z",
      fill: "aurora", line: "#efe6ff", body: "aurora", bodyLine: "#d9cdf5", hv: "23 0 74 78",
      prof: { brow: 27, nose: 39, lip: 57, chin: 69 },
      shellArt: <>
        {/* light-fibre hair, and a tiara fin that reads at any size */}
        <path d="M60 4 C77 4 86 15 85 30 C79 20 71 17 60 17 C49 17 40 20 35 30 C34 15 43 4 60 4 Z" fill={`url(#${id}-aurora)`} stroke={glow} strokeWidth=".9" strokeLinejoin="round" opacity=".97" />
        <path d="M36 28 Q26 50 30 74 Q32 88 26 100 L36 100 Q44 82 42 62 Q41 44 45 32 Z" fill={`url(#${id}-aurora)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" opacity=".9" />
        <path d="M84 28 Q94 50 90 74 Q88 88 94 100 L84 100 Q76 82 78 62 Q79 44 75 32 Z" fill={`url(#${id}-aurora)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" opacity=".9" />
        <path d="M48 12 L54 4 L60 11 L66 4 L72 12 Q60 7 48 12 Z" fill="#ffffff" stroke={accent} strokeWidth=".7" strokeLinejoin="round" />
      </>,
      art: <>
        {face(60, <path d="M56 20 L60 14 L64 20 L60 24 Z" fill={accent} className="ca-optic" />, "gem")}
        {face(49, <path d="M42 29 Q49 25.6 56 28" fill="none" stroke="#b6a6d8" strokeWidth="1.4" strokeLinecap="round" opacity=".8" />, "b1")}
        {face(71, <path d="M64 28 Q71 25.6 78 29" fill="none" stroke="#b6a6d8" strokeWidth="1.4" strokeLinecap="round" opacity=".8" />, "b2")}
        {face(49, <g className="ca-eye">
          <path d="M40 37 Q49 30 58 37 Q49 44 40 37 Z" fill="#fbf8ff" />
          <circle cx="49" cy="37" r="5.4" fill={`url(#${id}-bigiris)`} />
          <circle cx="49" cy="37" r="2.1" fill="#0a0f22" />
          <circle cx="51" cy="34.8" r="1.7" fill="#fff" />
          <circle cx="46.6" cy="39" r=".9" fill="#fff" opacity=".8" />
        </g>, "e1")}
        {face(71, <g className="ca-eye">
          <path d="M62 37 Q71 30 80 37 Q71 44 62 37 Z" fill="#fbf8ff" />
          <circle cx="71" cy="37" r="5.4" fill={`url(#${id}-bigiris)`} />
          <circle cx="71" cy="37" r="2.1" fill="#0a0f22" />
          <circle cx="73" cy="34.8" r="1.7" fill="#fff" />
          <circle cx="68.6" cy="39" r=".9" fill="#fff" opacity=".8" />
        </g>, "e2")}
        {face(60, <path d="M60 40 L60 48 M57.4 49.4 Q60 51 62.6 49.4" fill="none" stroke="#9c8cc0" strokeWidth=".9" strokeLinecap="round" opacity=".8" />, "n")}
        {face(60, <path d="M54 56 Q57 53.6 60 55 Q63 53.6 66 56 Q63 60 60 60 Q57 60 54 56 Z" fill="#e39ab4" opacity=".7" />, "m")}
        {face(42, <ellipse cx="42" cy="48" rx="5" ry="2.8" fill="#ffb3cd" opacity=".45" />, "bl1")}
        {face(78, <ellipse cx="78" cy="48" rx="5" ry="2.8" fill="#ffb3cd" opacity=".45" />, "bl2")}
        {face(39, ledRing(39, 30), "led")}
      </>,
      side: SIDE_ORGANIC,
      sideArt: <>
        <path d="M60 4 C77 4 86 16 85 29 C81 19 71 16 60 17 C48 18 40 23 37 33 C35 17 44 4 60 4 Z" fill={`url(#${id}-aurora)`} stroke={glow} strokeWidth=".8" strokeLinejoin="round" />
        <path d="M36 30 Q28 52 31 76 Q32 90 26 102 L38 102 Q46 84 44 62 Q43 44 46 34 Z" fill={`url(#${id}-aurora)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" opacity=".95" />
        <g className="ca-eye">
          <path d="M69 37 Q75 32 81 37 Q75 42 69 37 Z" fill="#fbf8ff" />
          <circle cx="75.6" cy="37" r="3.2" fill={`url(#${id}-bigiris)`} />
          <circle cx="75.6" cy="37" r="1.3" fill="#0a0f22" />
          <circle cx="76.8" cy="35.6" r="1" fill="#fff" />
        </g>
        <path d="M74 51.5 Q78 50.4 80.5 52" fill="none" stroke="#e39ab4" strokeWidth="1.6" strokeLinecap="round" opacity=".75" />
        <ellipse cx="66" cy="47" rx="4" ry="2.4" fill="#ffb3cd" opacity=".4" />
        {sideEar(`url(#${id}-aurora)`, "#cbb8f0")}
        {ledRing(45, 27)}
      </>,
      rear: <>
        <path d="M37 14 Q60 4 83 14 Q89 42 85 72 Q81 90 77 102 L43 102 Q39 90 35 72 Q31 42 37 14 Z" fill={`url(#${id}-aurora)`} stroke={glow} strokeWidth=".8" strokeLinejoin="round" />
        <path d="M52 20 Q60 46 56 100 M68 20 Q60 46 64 100" fill="none" stroke="#b7a7dc" strokeWidth=".8" opacity=".6" />
        <path d="M48 12 L54 4 L60 11 L66 4 L72 12 Q60 7 48 12 Z" fill="#ffffff" stroke={accent} strokeWidth=".7" strokeLinejoin="round" />
      </>,
      neck: null,
    },

    /* ── PIXEL · screen-face buddy ── */
    pixel: {
      skull: "M60 5 C82 5 91 16 91 34 C91 55 82 68 60 68 C38 68 29 55 29 34 C29 16 38 5 60 5 Z",
      fill: "white", line: "#cfe4ff", hv: "20 -15 80 88",
      prof: { brow: 26, nose: 38, lip: 54, chin: 66 },
      shellArt: <>
        <path d="M60 5 L60 -6" stroke={glow} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="60" cy="-9" r="4.4" fill={glow} className="ca-optic" />
        <path d="M29 34 Q60 28 91 34" fill="none" stroke={glow} strokeWidth=".9" opacity=".4" />
      </>,
      art: <>
        {face(60, <>
          <rect x="35" y="20" width="50" height="36" rx="10" fill="#0a1020" stroke={glow} strokeWidth="1.2" />
          <rect x="37" y="22" width="46" height="32" rx="8" fill="none" stroke="#1d3358" strokeWidth=".8" />
          <g className="ca-eye">
            <rect x="45" y="29" width="8" height="11" rx="2.6" fill={glow} />
            <rect x="67" y="29" width="8" height="11" rx="2.6" fill={glow} />
            <rect x="46.6" y="30.6" width="2.6" height="3.4" rx="1" fill="#fff" opacity=".9" />
            <rect x="68.6" y="30.6" width="2.6" height="3.4" rx="1" fill="#fff" opacity=".9" />
          </g>
          <path d="M50 45 Q60 52 70 45" fill="none" stroke={glow} strokeWidth="2.4" strokeLinecap="round" />
        </>, "screen")}
        {face(33, <rect x="28" y="45" width="10" height="6" rx="3" fill="#ff8fb0" opacity=".85" />, "bl1")}
        {face(87, <rect x="82" y="45" width="10" height="6" rx="3" fill="#ff8fb0" opacity=".85" />, "bl2")}
        {face(30, <rect x="24" y="28" width="7" height="14" rx="3.5" fill="#dce8f7" stroke={glow} strokeWidth=".8" />, "ear1")}
        {face(90, <rect x="89" y="28" width="7" height="14" rx="3.5" fill="#dce8f7" stroke={glow} strokeWidth=".8" />, "ear2")}
      </>,
      side: "M60 6 C80 6 88 17 88 34 C88 42 88 47 86 52 L84 58 C80 65 70 70 60 70 C42 70 32 56 32 36 C32 18 42 6 60 6 Z",
      sideArt: <>
        <path d="M60 6 L60 -6" stroke={glow} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="60" cy="-9" r="4.4" fill={glow} className="ca-optic" />
        <path d="M62 20 L84 22 L82 54 L62 56 Z" fill="#0a1020" stroke={glow} strokeWidth="1.1" strokeLinejoin="round" />
        <rect x="70" y="30" width="7.5" height="11" rx="2.6" fill={glow} className="ca-eye" />
        <path d="M68 46 Q75 51 80 46" fill="none" stroke={glow} strokeWidth="2" strokeLinecap="round" />
        <rect x="30" y="30" width="8" height="15" rx="4" fill="#dce8f7" stroke={glow} strokeWidth=".8" />
        <rect x="54" y="45" width="9" height="6" rx="3" fill="#ff8fb0" opacity=".8" />
      </>,
      rear: <>
        <path d="M34 14 Q60 6 86 14 Q90 42 84 60 Q60 70 36 60 Q30 42 34 14 Z" fill={`url(#${id}-white)`} stroke={glow} strokeWidth=".9" strokeLinejoin="round" />
        <circle cx="60" cy="36" r="9" fill="#dce8f7" stroke={glow} strokeWidth="1" />
        <circle cx="60" cy="36" r="3.4" fill={glow} className="ca-optic" />
        <path d="M42 20 L78 20 M42 54 L78 54" stroke={glow} strokeWidth=".9" opacity=".5" />
        <rect x="24" y="28" width="7" height="14" rx="3.5" fill="#dce8f7" stroke={glow} strokeWidth=".8" />
        <rect x="89" y="28" width="7" height="14" rx="3.5" fill="#dce8f7" stroke={glow} strokeWidth=".8" />
      </>,
      neck: null,
    },

    /* ── MOCHI · squishy pocket bot ── */
    mochi: {
      skull: "M60 5 C85 5 93 22 93 41 C93 60 80 71 60 71 C40 71 27 60 27 41 C27 22 35 5 60 5 Z",
      fill: "mochi", line: "#ffd7e3", body: "mochi", bodyLine: "#f6b8cd", hv: "20 -7 80 84",
      prof: { brow: 28, nose: 41, lip: 56, chin: 68 },
      shellArt: <>
        <ellipse cx="30" cy="36" rx="6.5" ry="9" fill={`url(#${id}-mochi)`} stroke="#f6b8cd" strokeWidth=".9" />
        <ellipse cx="90" cy="36" rx="6.5" ry="9" fill={`url(#${id}-mochi)`} stroke="#f6b8cd" strokeWidth=".9" />
        <path d="M53 6 Q60 -4 67 6 Q60 1 53 6 Z" fill="#ff8fb0" stroke="#e06d92" strokeWidth=".7" strokeLinejoin="round" />
      </>,
      art: <>
        {face(60, <path d="M60 13 C63 8 69 10 69 15 C69 19 63 22 60 25 C57 22 51 19 51 15 C51 10 57 8 60 13 Z" fill="#ff7aa5" stroke="#e06d92" strokeWidth=".6" className="ca-optic" />, "heart")}
        {face(47, <g className="ca-eye">
          <ellipse cx="47" cy="42" rx="9.5" ry="11" fill="#20182a" />
          <ellipse cx="47" cy="42" rx="8" ry="9.4" fill={`url(#${id}-bigiris)`} />
          <circle cx="50" cy="38" r="3.4" fill="#fff" />
          <circle cx="44" cy="46" r="1.8" fill="#fff" opacity=".9" />
          <circle cx="49.4" cy="46.6" r="1.1" fill="#fff" opacity=".7" />
        </g>, "e1")}
        {face(73, <g className="ca-eye">
          <ellipse cx="73" cy="42" rx="9.5" ry="11" fill="#20182a" />
          <ellipse cx="73" cy="42" rx="8" ry="9.4" fill={`url(#${id}-bigiris)`} />
          <circle cx="76" cy="38" r="3.4" fill="#fff" />
          <circle cx="70" cy="46" r="1.8" fill="#fff" opacity=".9" />
          <circle cx="75.4" cy="46.6" r="1.1" fill="#fff" opacity=".7" />
        </g>, "e2")}
        {face(34, <ellipse cx="34" cy="52" rx="6.5" ry="4.4" fill="#ff9ec0" opacity=".85" />, "bl1")}
        {face(86, <ellipse cx="86" cy="52" rx="6.5" ry="4.4" fill="#ff9ec0" opacity=".85" />, "bl2")}
        {face(60, <path d="M55 58 Q60 63 65 58" fill="none" stroke="#c76b8c" strokeWidth="2.2" strokeLinecap="round" />, "m")}
      </>,
      side: "M60 5 C84 5 92 22 92 41 C92 55 84 66 72 70 Q60 73 50 69 C36 63 28 52 28 40 C28 21 38 5 60 5 Z",
      sideArt: <>
        <ellipse cx="46" cy="36" rx="8" ry="10" fill={`url(#${id}-mochi)`} stroke="#f6b8cd" strokeWidth=".9" />
        <path d="M53 6 Q60 -4 67 6 Q60 1 53 6 Z" fill="#ff8fb0" stroke="#e06d92" strokeWidth=".7" strokeLinejoin="round" />
        <g className="ca-eye">
          <ellipse cx="76" cy="42" rx="8" ry="10.4" fill="#20182a" />
          <ellipse cx="76" cy="42" rx="6.6" ry="8.8" fill={`url(#${id}-bigiris)`} />
          <circle cx="78.4" cy="38.4" r="3" fill="#fff" />
          <circle cx="73.6" cy="46" r="1.5" fill="#fff" opacity=".85" />
        </g>
        <ellipse cx="62" cy="53" rx="6" ry="4" fill="#ff9ec0" opacity=".8" />
        <path d="M76 58 Q81 62 84 57" fill="none" stroke="#c76b8c" strokeWidth="2" strokeLinecap="round" />
      </>,
      rear: <>
        <path d="M30 16 Q60 4 90 16 Q95 44 88 62 Q60 74 32 62 Q25 44 30 16 Z" fill={`url(#${id}-mochi)`} stroke="#f6b8cd" strokeWidth=".9" strokeLinejoin="round" />
        <ellipse cx="30" cy="36" rx="6.5" ry="9" fill={`url(#${id}-mochi)`} stroke="#f6b8cd" strokeWidth=".9" />
        <ellipse cx="90" cy="36" rx="6.5" ry="9" fill={`url(#${id}-mochi)`} stroke="#f6b8cd" strokeWidth=".9" />
        <path d="M53 6 Q60 -4 67 6 Q60 1 53 6 Z" fill="#ff8fb0" stroke="#e06d92" strokeWidth=".7" strokeLinejoin="round" />
        <path d="M48 30 Q60 24 72 30 M46 46 Q60 40 74 46" fill="none" stroke="#e8a8c0" strokeWidth="1" opacity=".7" />
        <circle cx="60" cy="38" r="4" fill="#ff9ec0" opacity=".7" />
      </>,
      neck: null,
    },
  }[v];

  const rig = MODEL_RIG[v] || MODEL_RIG.vanguard;
  const hs = rig.hs;                          // head size against the body
  const chibi = !!rig.chibi;
  const shellFill = `url(#${id}-${HEAD.fill})`;
  // the chassis takes the model's own material; the outfit's swatch re-plates the trim
  const bodyKey = HEAD.body || (HEAD.fill === "skin" ? "plate" : HEAD.fill);
  const bPlate = `url(#${id}-${bodyKey})`;
  const bTrim = `url(#${id}-trim)`;
  const bLine = HEAD.bodyLine || HEAD.line;
  /* Every armour plate goes through here: fill, form shadow, key highlight,
     grazing rim, outline. Five passes over one path is what separates a plate
     from a coloured shape, and it is the whole reason the figure reads as
     metal rather than as a sticker. */
  const plate = (d, o = {}) => (
    <g>
      <path d={d} fill={o.fill || bPlate} stroke="none" />
      <path d={d} fill={`url(#${id}-occ)`} stroke="none" opacity={o.occ == null ? 1 : o.occ} />
      <path d={d} fill={`url(#${id}-spec)`} stroke="none" opacity={o.spec == null ? 1 : o.spec} />
      <path d={d} fill="none" stroke={`url(#${id}-graze)`} strokeWidth={(o.lw || 1) * 1.6} strokeLinejoin="round" opacity={o.graze == null ? .55 : o.graze} />
      <path d={d} fill="none" stroke={o.line || bLine} strokeWidth={o.lw || 1} strokeLinejoin="round" opacity={o.lineOp == null ? .9 : o.lineOp} />
    </g>
  );
  // an engraved seam: a cut, and the lit edge below where it catches the key
  const groove = (d, w = 1, op = .55) => (
    <g opacity={op}>
      <path d={d} fill="none" stroke="#00060f" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" opacity=".7" />
      <path d={d} fill="none" stroke="#eaf3ff" strokeWidth={w * .5} strokeLinecap="round" strokeLinejoin="round" transform="translate(0 .85)" opacity=".55" />
    </g>
  );
  // the dark that gathers where two parts meet
  const joint = (cx, cy, r) => <ellipse cx={cx} cy={cy} rx={r} ry={r * .78} fill={`url(#${id}-ao)`} />;

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

  return (
    <svg className={`ca ca-${v}`} viewBox={headOnly ? (HEAD.hv || "31 1 58 74") : "-20 -16 160 416"} width="100%" height="100%" aria-hidden="true">
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
        {/* lacquer: the black-and-crimson of a samurai's armour */}
        <linearGradient id={`${id}-lacquer`} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#8c2b34" />
          <stop offset="30%" stopColor="#4a1119" />
          <stop offset="70%" stopColor="#22070c" />
          <stop offset="100%" stopColor="#0c0306" />
        </linearGradient>
        {/* soft-serve: the whole point of MOCHI is that it is not metal */}
        <linearGradient id={`${id}-mochi`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#fffaf6" />
          <stop offset="42%" stopColor="#ffe6ee" />
          <stop offset="78%" stopColor="#ffc9dd" />
          <stop offset="100%" stopColor="#e59ab8" />
        </linearGradient>
        <linearGradient id={`${id}-aurora`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#e4e8ff" />
          <stop offset="58%" stopColor="#d6f5ee" />
          <stop offset="82%" stopColor="#cbb8f0" />
          <stop offset="100%" stopColor="#8b7bbf" />
        </linearGradient>
        <radialGradient id={`${id}-bigiris`}>
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="26%" stopColor="#8fe6ff" />
          <stop offset="62%" stopColor="#2f8ede" />
          <stop offset="100%" stopColor="#102a58" />
        </radialGradient>
        {/* ── the lighting rig ──
            Flat vector armour reads as paper because every plate is one colour.
            These three are painted over EVERY plate in object-bounding-box
            space, so each piece gets its own falloff from its own shape: a key
            light off the upper left, the form shadow turning away from it into
            the lower right, and a grazing edge where the light wraps round the
            far side. Done with gradients rather than SVG filters on purpose —
            filters on a figure this size cost real frames on a phone, and this
            costs nothing. */}
        <linearGradient id={`${id}-occ`} x1="0.12" y1="0.02" x2="0.88" y2="1">
          <stop offset="0%" stopColor="#000814" stopOpacity="0" />
          <stop offset="40%" stopColor="#000814" stopOpacity=".05" />
          <stop offset="72%" stopColor="#000814" stopOpacity=".26" />
          <stop offset="100%" stopColor="#000814" stopOpacity=".52" />
        </linearGradient>
        <linearGradient id={`${id}-spec`} x1="0.08" y1="0" x2="0.72" y2="0.92">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".62" />
          <stop offset="22%" stopColor="#ffffff" stopOpacity=".2" />
          <stop offset="52%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-graze`} x1="1" y1="1" x2="0.2" y2="0">
          <stop offset="0%" stopColor="#dbeaff" stopOpacity=".85" />
          <stop offset="34%" stopColor="#dbeaff" stopOpacity=".12" />
          <stop offset="100%" stopColor="#dbeaff" stopOpacity="0" />
        </linearGradient>
        {/* the shadow a body casts into its own joints */}
        <radialGradient id={`${id}-ao`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="55%" stopColor="#000814" stopOpacity=".45" />
          <stop offset="100%" stopColor="#000814" stopOpacity="0" />
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
      </defs>

      <g>
        {/* ── body ──
            The same three-view treatment as the head, for the same reason: a
            front-facing torso squashed sideways reads as a plank, so the figure
            carries a drawn side view that takes over as it turns. Arms hang in
            the silhouette rather than orbiting as separate parts, which is what
            keeps the shoulders attached at every angle. */}
        {!headOnly && chibi && <>
          {/* ── chibi build ──
              Two and a bit heads tall, all curves, stubby mitts and little
              boots. The cute models are not the tall chassis with a friendlier
              face painted on: making them cute meant changing the skeleton,
              because proportion reads first and it reads before any detailing
              does. The chassis stays the model's own material so a pink bot
              does not end up with gunmetal hands; the worn outfit shows through
              in the collar, belt and cuffs instead. */}
          {ws > 0.02 && (
            <g opacity={ws.toFixed(3)} transform={`translate(${(cxs - 60).toFixed(2)} 0)${dir < 0 ? " translate(120 0) scale(-1 1)" : ""}`}>
              <g opacity=".55">
                {plate("M38 154 C31 158 30 190 34 206 C37 216 50 218 53 208 C56 196 55 168 52 156 Z")}
                {plate("M50 214 C41 214 36 222 36 230 C36 239 43 245 51 245 C58 245 62 238 62 230 C62 221 57 214 50 214 Z")}
                {plate("M40 288 C36 292 35 330 37 350 C38 360 52 361 54 351 C57 332 56 294 53 288 Z")}
                {plate("M56 374 C44 374 36 380 36 384 C36 389 44 392 56 392 C70 392 78 388 78 383 C78 378 68 374 56 374 Z")}
              </g>
              {plate("M60 116 C84 116 95 141 95 182 L93 246 C91 277 79 293 60 293 C41 293 30 277 28 246 L26 182 C26 141 36 116 60 116 Z", { lw: 1.3 })}
              {plate("M46 152 C39 156 38 190 42 208 C45 218 60 220 63 209 C66 196 64 166 61 154 Z")}
              {plate("M58 216 C48 216 43 224 43 232 C43 242 51 248 59 248 C67 248 71 240 71 232 C71 222 66 216 58 216 Z")}
              {plate("M48 288 C44 292 43 332 45 352 C46 362 61 363 63 353 C66 334 65 294 62 288 Z")}
              {plate("M64 374 C51 374 42 380 42 385 C42 390 51 393 64 393 C79 393 88 389 88 384 C88 378 78 374 64 374 Z")}
              <path d="M40 130 Q60 121 82 132" fill="none" stroke={bTrim} strokeWidth="5.5" strokeLinecap="round" />
              {groove("M42 262 Q60 272 80 262", 1.4, .45)}
              <g opacity={profArt.toFixed(3)}>
                <ellipse cx="74" cy="206" rx="14" ry="27" fill="#ffffff" opacity=".2" />
                <circle cx="82" cy="198" r="5.4" fill="none" stroke={glow} strokeWidth="1.2" opacity=".85" />
                <circle cx="82" cy="198" r="2.1" fill={glow} className="ca-optic" />
              </g>
            </g>
          )}
          {(front > 0.01 || rear > 0.01) && (
            <g opacity={Math.max(front, rear).toFixed(3)}>
              {/* stubby arms, elbow-less, with mitten hands */}
              {plate("M22 152 C10 155 3 176 4 200 C5 216 12 224 21 222 C28 220 30 200 29 180 C28 166 26 156 22 152 Z")}
              {plate("M98 152 C110 155 117 176 116 200 C115 216 108 224 99 222 C92 220 90 200 91 180 C92 166 94 156 98 152 Z")}
              {plate("M13 216 C5 216 0 224 0 233 C0 243 7 250 15 250 C24 250 29 242 29 232 C29 222 22 216 13 216 Z")}
              {plate("M107 216 C115 216 120 224 120 233 C120 243 113 250 105 250 C96 250 91 242 91 232 C91 222 98 216 107 216 Z")}
              {/* barrel body */}
              {plate("M60 116 C89 116 103 141 103 182 L101 246 C99 278 82 294 60 294 C38 294 21 278 19 246 L17 182 C17 141 31 116 60 116 Z", { lw: 1.4 })}
              {/* little boots */}
              {plate("M34 288 C29 294 28 334 30 354 C31 366 55 367 57 355 C60 336 59 294 55 288 Z")}
              {plate("M65 288 C61 294 60 334 63 354 C64 366 88 367 90 355 C92 336 91 294 86 288 Z")}
              {plate("M42 372 C28 372 19 379 19 385 C19 391 29 394 43 394 C57 394 66 391 66 385 C66 379 56 372 42 372 Z")}
              {plate("M78 372 C64 372 55 379 55 385 C55 391 64 394 78 394 C92 394 101 391 101 385 C101 379 92 372 78 372 Z")}
              <path d="M18 206 h13 M89 206 h13" stroke={bTrim} strokeWidth="5.5" strokeLinecap="round" />
              <path d="M34 348 h23 M65 348 h23" stroke={bTrim} strokeWidth="5.5" strokeLinecap="round" />
              {/* collar: where the worn outfit shows on a chibi */}
              <path d="M37 130 Q60 120 83 130" fill="none" stroke={bTrim} strokeWidth="6.5" strokeLinecap="round" />
              {joint(60, 126, 26)}
              <g opacity={front.toFixed(3)}>
                <ellipse cx="60" cy="208" rx="33" ry="38" fill="#ffffff" opacity=".3" />
                <ellipse cx="60" cy="208" rx="33" ry="38" fill={`url(#${id}-spec)`} />
                <ellipse cx="60" cy="208" rx="33" ry="38" fill="none" stroke={glow} strokeWidth="1.1" opacity=".8" />
                <g className="ca-core">
                  <circle cx="60" cy="208" r="15" fill="none" stroke={glow} strokeWidth="1.5" opacity=".95" />
                  <path d="M60 195 L73 208 L60 221 L47 208 Z" fill={`url(#${id}-visor)`} />
                  <circle cx="60" cy="208" r="5.4" fill="#fff" opacity=".95" />
                </g>
                {groove("M34 264 Q60 276 86 264", 1.4, .4)}
                <ellipse cx="42" cy="379" rx="11" ry="5" fill="#ffffff" opacity=".35" />
                <ellipse cx="78" cy="379" rx="11" ry="5" fill="#ffffff" opacity=".35" />
              </g>
              <g opacity={rear.toFixed(3)}>
                {groove("M60 130 L60 282", 2.4, .5)}
                {plate("M42 158 L78 158 C81 158 82 160 82 163 L82 200 C82 203 81 205 78 205 L42 205 C39 205 38 203 38 200 L38 163 C38 160 39 158 42 158 Z", { fill: bTrim, line: glow, lw: 1.1 })}
                {groove("M48 170 L72 170 M48 181 L72 181 M48 192 L72 192", 1.5, .5)}
                <circle cx="60" cy="232" r="6.4" fill="none" stroke={glow} strokeWidth="1.3" opacity=".75" />
                <circle cx="60" cy="232" r="2.6" fill={glow} className="ca-optic" />
                {groove("M34 264 Q60 274 86 264", 1.4, .4)}
              </g>
            </g>
          )}
        </>}

        {!headOnly && !chibi && <>
          {/* ── hero build ──
              The same three-view treatment as the head, for the same reason: a
              front-facing torso squashed sideways reads as a plank, so the
              figure carries a drawn side view that takes over as it turns. Arms
              hang in the silhouette rather than orbiting as separate parts,
              which is what keeps the shoulders attached at every angle — and
              every plate is articulated at the joint it actually bends on:
              pauldron, bicep, elbow actuator, forearm, hand; hip, thigh, knee,
              shin, ankle, boot. */}
          {ws > 0.02 && (
            <g opacity={ws.toFixed(3)} transform={`translate(${(cxs - 60).toFixed(2)} 0)${dir < 0 ? " translate(120 0) scale(-1 1)" : ""}`}>
              {/* far arm and far leg, behind the body */}
              <g opacity=".55">
                {plate("M50 104 C44 114 43 132 45 150 L61 152 C63 134 63 116 62 106 Z")}
                {plate("M46 156 L61 158 L59 214 L48 212 Z")}
                {plate("M47 212 L59 214 L59 234 C54 241 48 240 46 233 Z")}
                {plate("M45 240 L64 240 L62 302 L47 302 Z")}
                {plate("M48 304 L62 304 L60 364 L50 364 Z")}
                {plate("M46 360 L60 360 L74 378 L74 391 L43 391 L43 375 Z")}
              </g>
              {/* torso, seen edge-on: chest forward, shoulder blade back */}
              {plate("M60 84 C71 84 79 92 82 102 L86 126 L84 156 L78 194 L42 194 L38 156 L38 126 L42 102 C46 92 52 84 60 84 Z", { lw: 1.2 })}
              {plate("M43 190 L79 190 L83 220 L77 248 L45 248 L39 220 Z", { fill: bTrim, lw: 1 })}
              {/* near arm, in front of the chest */}
              {plate("M52 100 C46 110 45 130 47 150 L65 153 C67 134 67 114 66 102 Z")}
              {joint(56, 155, 11)}
              {plate("M48 158 L64 161 L62 216 L51 214 Z")}
              {plate("M50 214 L62 217 L62 238 C57 245 51 244 49 237 Z", { fill: bTrim })}
              {/* near leg */}
              {plate("M49 240 L71 240 L69 302 L51 302 Z")}
              {joint(60, 303, 13)}
              {plate("M52 304 L68 304 L66 364 L54 364 Z")}
              {plate("M50 360 L66 360 L81 378 L81 391 L48 391 L48 375 Z", { fill: bTrim })}
              <g opacity={profArt.toFixed(3)}>
                {plate("M46 96 L36 104 L36 128 L48 122 Z", { fill: bTrim, line: glow, lw: 1 })}
                {groove("M44 132 Q60 140 80 134 M46 160 Q60 166 78 160", 1, .5)}
                <circle cx="80" cy="128" r="5" fill="none" stroke={term ? "#ff2d46" : glow} strokeWidth="1.2" opacity=".85" />
                <circle cx="80" cy="128" r="2" fill={term ? "#ff2d46" : glow} className="ca-optic" />
              </g>
            </g>
          )}
          {(front > 0.01 || rear > 0.01) && (
            <g opacity={Math.max(front, rear).toFixed(3)}>
              {/* arms: bicep, elbow actuator, forearm, hand */}
              {plate("M20 104 C11 114 7 134 9 156 L29 159 C32 138 33 116 33 106 Z")}
              {plate("M100 104 C109 114 113 134 111 156 L91 159 C88 138 87 116 87 106 Z")}
              {joint(19, 158, 13)} {joint(101, 158, 13)}
              {plate("M10 160 L30 163 L28 218 L14 216 Z")}
              {plate("M110 160 L90 163 L92 218 L106 216 Z")}
              {plate("M13 216 L28 219 L28 241 C23 250 15 249 12 240 Z", { fill: bTrim })}
              {plate("M107 216 L92 219 L92 241 C97 250 105 249 108 240 Z", { fill: bTrim })}
              {/* pauldrons */}
              {plate("M36 90 C21 90 9 99 4 113 L2 133 L31 124 Z", { fill: bTrim, line: glow, lw: 1.2 })}
              {plate("M84 90 C99 90 111 99 116 113 L118 133 L89 124 Z", { fill: bTrim, line: glow, lw: 1.2 })}
              <circle cx="13" cy="117" r="2.8" fill={term ? "#ff2d46" : glow} className="ca-optic" />
              <circle cx="107" cy="117" r="2.8" fill={accent} className="ca-optic" />
              {/* chest shell, then the pectoral plates that sit on it */}
              {plate("M60 84 C73 84 84 91 92 101 L98 126 L95 155 L60 163 L25 155 L22 126 L28 101 C36 91 47 84 60 84 Z", { lw: 1.3 })}
              {plate("M56 96 C45 96 35 104 31 117 L33 142 C42 151 50 154 56 155 Z")}
              {plate("M64 96 C75 96 85 104 89 117 L87 142 C78 151 70 154 64 155 Z")}
              {/* abdominal bands */}
              {plate("M28 157 L92 157 L89 172 L31 172 Z", { fill: bTrim })}
              {plate("M31 174 L89 174 L86 189 L34 189 Z", { fill: bTrim })}
              {/* pelvis and hip plates */}
              {plate("M32 187 L88 187 L92 217 L86 248 L34 248 L28 217 Z", { lw: 1.1 })}
              {plate("M31 196 L49 196 L47 231 L34 227 Z", { fill: bTrim })}
              {plate("M89 196 L71 196 L73 231 L86 227 Z", { fill: bTrim })}
              {/* thigh, knee actuator, shin, ankle, boot */}
              {plate("M34 240 L58 240 L56 302 L37 302 Z")}
              {plate("M62 240 L86 240 L83 302 L64 302 Z")}
              {joint(46, 303, 14)} {joint(74, 303, 14)}
              {plate("M37 298 C41 294 51 294 55 298 C57 306 57 312 55 316 C51 320 41 320 37 316 C35 312 35 306 37 298 Z", { fill: bTrim, line: glow, lw: .9 })}
              {plate("M65 298 C69 294 79 294 83 298 C85 306 85 312 83 316 C79 320 69 320 65 316 C63 312 63 306 65 298 Z", { fill: bTrim, line: glow, lw: .9 })}
              {plate("M38 314 L55 314 L53 364 L40 364 Z")}
              {plate("M65 314 L82 314 L80 364 L67 364 Z")}
              {plate("M36 360 L55 360 L60 379 L60 392 L29 392 L29 377 Z", { fill: bTrim })}
              {plate("M84 360 L65 360 L60 379 L60 392 L91 392 L91 377 Z", { fill: bTrim })}
              {/* chest plating and the power core — gone once the back is toward us */}
              <g opacity={front.toFixed(3)}>
                {groove("M60 88 L60 160", 1.2, .5)}
                {groove("M36 110 L53 118 M84 110 L67 118", 1, .45)}
                {groove("M29 164 L91 164 M32 181 L88 181", 1.1, .45)}
                <g className="ca-core">
                  <circle cx="60" cy="131" r="14.5" fill="#00060f" opacity=".55" />
                  <circle cx="60" cy="131" r="13" fill="none" stroke={term ? "#ff2d46" : glow} strokeWidth="1.4" opacity=".9" />
                  <path d="M60 119 L72 131 L60 143 L48 131 Z" fill={term ? `url(#${id}-red)` : `url(#${id}-visor)`} />
                  <circle cx="60" cy="131" r="4.8" fill="#fff" opacity=".95" />
                </g>
                {groove("M40 254 L54 254 M66 254 L80 254", 1, .45)}
                {groove("M34 372 L54 372 M66 372 L86 372", 1, .4)}
              </g>
              {/* spine, dorsal vents and heels — what you see from behind */}
              <g opacity={rear.toFixed(3)}>
                {groove("M60 88 L60 188", 2.4, .6)}
                {plate("M45 92 L75 92 L79 118 L41 118 Z", { fill: bTrim, line: glow, lw: 1 })}
                {groove("M40 128 L80 128 M36 146 L84 146", 1.6, .5)}
                <circle cx="60" cy="105" r="3.4" fill={glow} className="ca-optic" />
                {groove("M42 262 Q46 290 44 302 M78 262 Q74 290 76 302", 1.4, .45)}
                {groove("M30 385 L58 385 M62 385 L90 385", 1.6, .45)}
              </g>
            </g>
          )}
        </>}

        <g transform={headOnly ? undefined : `translate(60 -12) scale(${hs}) translate(-60 -3)`}>
        {/* ── neck ── */}
        {HEAD.neck || (
          <g transform={`translate(60 0) scale(${(0.72 + 0.28 * Math.abs(c)).toFixed(3)} 1) translate(-60 0)`}>
            <path d="M52 62 L68 62 L71 90 L49 90 Z" fill={`url(#${id}-${HEAD.neckFill || bodyKey})`} stroke="#7f8fac" strokeWidth=".7" />
            <path d="M48 84 L72 84" stroke={glow} strokeWidth="1.3" opacity=".7" />
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
      </g>
    </svg>
  );
}

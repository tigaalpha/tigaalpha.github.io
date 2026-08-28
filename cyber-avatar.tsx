/* ── cyber-avatar.tsx ──
   The character, drawn from two specific references rather than invented.

   RESEARCH → DESIGN. Two looks were asked for by name, so the details that
   actually make each recognisable were looked up rather than guessed:

   T-800 endoskeleton (The Terminator). A skull in polished, worn chrome; deep
   recessed sockets holding red optics that each have a real iris and lens; and
   above all the exposed dental grille — individually set teeth, an infiltration
   unit's deliberately imperfect human mouth. Sharp zygomatic arches, hollow
   temples, a narrow nasal cavity, a visible jaw hinge, hydraulic rods in the
   neck.

   CyberLife android (Detroit: Become Human). Essentially a human face, and the
   one thing that marks it is the LED ring high on the android's RIGHT temple,
   set level with the skin in a shallow indent. Blue when calm, yellow while
   processing hard, red under stress — and in-story legally required, as the
   thing that distinguishes an android from a person. Everything else is
   restraint: a faint seam where the skin panel meets the jaw, cool accents,
   and — where the skin is deactivated — a white chassis showing through with
   its seams lit.

   So the three builds are VANGUARD, the endoskeleton; SPECTER, the android
   passing as human; and KIT, an android with its skin panels deactivated,
   which ends up as the friendly one because a white chassis with lit seams
   reads soft where chrome and bared teeth read menacing.

   Everything else still follows what is EQUIPPED: `armorA`/`armorB` come from
   the worn outfit's swatch so a change of clothes re-plates the body, and
   `glow` is the chamber's key light. The endoskeleton's optics deliberately
   ignore both and stay red — a T-800 with cyan eyes is not a T-800. ── */

export function CyberAvatar({ variant = "boy", armorA = "#1a2233", armorB = "#38506e", glow = "#00f0ff", accent = "#aa00ff" }) {
  const id = "ca-" + variant;
  const term = variant === "boy";          // endoskeleton build
  const bare = variant === "cute";         // skin deactivated, chassis showing

  /* ── the T-800 dental grille ──
     The most recognisable thing about the skull, so it is built tooth by tooth
     rather than faked with a hatched rectangle: an upper and a lower row, each
     tooth its own shape, widths slightly uneven because the original prop's
     teeth were individually mounted to look imperfectly human. */
  const teeth = () => {
    const upper = [45.5, 50, 54.5, 59, 63.5, 68, 72.5];
    const lower = [46.5, 51, 55.5, 60, 64.5, 69];
    return (
      <g className="ca-teeth">
        <path d="M42 53 Q60 49 78 53 L76 65 Q60 70 44 65 Z" fill="#0a0d14" />
        {upper.map((x, i) => (
          <rect key={"u" + i} x={x - 2} y="53.4" width={i % 3 === 1 ? 4.2 : 3.6} height="5.4" rx="1.1"
            fill={`url(#${id}-chrome)`} stroke="#e8f0ff" strokeWidth=".28" opacity=".97" />
        ))}
        {lower.map((x, i) => (
          <rect key={"l" + i} x={x - 2} y="60.2" width={i % 2 ? 4 : 3.4} height="4.6" rx="1"
            fill={`url(#${id}-chrome)`} stroke="#e8f0ff" strokeWidth=".28" opacity=".93" />
        ))}
        <path d="M43 59.4 Q60 62 77 59.4" fill="none" stroke="#05070c" strokeWidth="1.1" />
        <circle cx="38.5" cy="50" r="2.6" fill={`url(#${id}-chrome)`} stroke="#9fb4d8" strokeWidth=".5" />
        <circle cx="81.5" cy="50" r="2.6" fill={`url(#${id}-chrome)`} stroke="#9fb4d8" strokeWidth=".5" />
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

  const HEAD = {
    /* ── VANGUARD · T-800 endoskeleton ── */
    boy: {
      skull: "M60 3 C74 3 84 13 84 27 C84 36 81 42 78 47 C75 56 68 66 60 72 C52 66 45 56 42 47 C39 42 36 36 36 27 C36 13 46 3 60 3 Z",
      chrome: true,
      extras: <>
        <path d="M60 4 L60 24" stroke="#c9d8f2" strokeWidth=".7" opacity=".55" />
        <path d="M40 20 Q60 14 80 20" fill="none" stroke="#c9d8f2" strokeWidth=".7" opacity=".45" />
        <path d="M38 26 Q42 24 45 27 L44 36 Q39 34 38 30 Z" fill="#151b26" opacity=".75" />
        <path d="M82 26 Q78 24 75 27 L76 36 Q81 34 82 30 Z" fill="#151b26" opacity=".75" />
        {optic(49, 33)}
        {optic(71, 33)}
        <path d="M60 39 L64.5 48 L60 50 L55.5 48 Z" fill="#05070c" />
        {/* zygomatic arches — the struts that give the skull its width */}
        <path d="M38 38 Q44 44 47 50" fill="none" stroke="#dbe6fb" strokeWidth="2.1" strokeLinecap="round" opacity=".9" />
        <path d="M82 38 Q76 44 73 50" fill="none" stroke="#dbe6fb" strokeWidth="2.1" strokeLinecap="round" opacity=".9" />
        {teeth()}
      </>,
      neck: <>
        <path d="M52 70 L52 86 M60 72 L60 88 M68 70 L68 86" stroke={`url(#${id}-chrome)`} strokeWidth="3.4" strokeLinecap="round" />
        <path d="M52 70 L52 86 M60 72 L60 88 M68 70 L68 86" stroke="#e6eeff" strokeWidth=".7" strokeLinecap="round" opacity=".55" />
        <circle cx="52" cy="78" r="2" fill="#8fa6c8" /><circle cx="68" cy="78" r="2" fill="#8fa6c8" />
        <circle cx="60" cy="82" r="2.3" fill="#ff2d46" opacity=".85" className="ca-optic" />
      </>,
    },

    /* ── SPECTER · CyberLife android, skin active ── */
    girl: {
      skull: "M60 8 C72 8 80 17 81 30 C82 42 78 52 72 60 C68 66 64 70 60 70 C56 70 52 66 48 60 C42 52 38 42 39 30 C40 17 48 8 60 8 Z",
      extras: <>
        <path d="M60 5 C75 5 84 15 84 29 C79 21 71 18 60 18 C49 18 41 21 36 29 C36 15 45 5 60 5 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".8" strokeLinejoin="round" opacity=".95" />
        <path d="M38 26 Q30 44 32 68 Q33 80 28 92 L36 92 Q42 76 41 60 Q40 42 44 32 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" opacity=".9" />
        <path d="M82 26 Q90 44 88 68 Q87 80 92 92 L84 92 Q78 76 79 60 Q80 42 76 32 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".7" strokeLinejoin="round" opacity=".9" />
        <path d="M43 30 Q50 27 56 29" fill="none" stroke="#8b9bb8" strokeWidth="1.5" strokeLinecap="round" opacity=".8" />
        <path d="M64 29 Q70 27 77 30" fill="none" stroke="#8b9bb8" strokeWidth="1.5" strokeLinecap="round" opacity=".8" />
        {humanEye(50, 36, 7.4, 4.3)}
        {humanEye(70, 36, 7.4, 4.3)}
        <path d="M60 38 L60 47 M57 48.6 Q60 50.2 63 48.6" fill="none" stroke="#7f8fac" strokeWidth="1" strokeLinecap="round" opacity=".85" />
        <path d="M53 56 Q56.5 53.6 60 55 Q63.5 53.6 67 56 Q63.5 60 60 60 Q56.5 60 53 56 Z" fill="#c98f96" opacity=".55" />
        {/* the seam where the skin panel meets the jaw */}
        <path d="M41 40 Q40 56 52 66" fill="none" stroke={glow} strokeWidth=".6" opacity=".45" />
        <path d="M79 40 Q80 56 68 66" fill="none" stroke={glow} strokeWidth=".6" opacity=".45" />
        {ledRing(41.5, 29)}
      </>,
      neck: null,
    },

    /* ── KIT · android with its skin panels deactivated ── */
    cute: {
      skull: "M60 10 C76 10 86 21 86 36 C86 51 78 63 68 68 C64 70 56 70 52 68 C42 63 34 51 34 36 C34 21 44 10 60 10 Z",
      white: true,
      extras: <>
        <path d="M60 11 L60 26 M36 34 Q60 28 84 34 M42 54 Q60 60 78 54" fill="none" stroke={glow} strokeWidth=".8" opacity=".7" />
        <path d="M46 20 Q60 16 74 20 L72 26 Q60 22 48 26 Z" fill="#dce8f7" stroke={glow} strokeWidth=".8" opacity=".95" />
        <path d="M36 40 L42 44 L40 54 L35 46 Z" fill="#c3d2e6" stroke={glow} strokeWidth=".6" opacity=".8" />
        <path d="M84 40 L78 44 L80 54 L85 46 Z" fill="#c3d2e6" stroke={glow} strokeWidth=".6" opacity=".8" />
        {humanEye(49, 40, 9, 6.2)}
        {humanEye(71, 40, 9, 6.2)}
        <path d="M60 44 L60 52 M57 53.4 Q60 55 63 53.4" fill="none" stroke="#7f8fac" strokeWidth="1" strokeLinecap="round" opacity=".8" />
        <path d="M52 60 Q60 65 68 60" fill="none" stroke={glow} strokeWidth="1.9" strokeLinecap="round" />
        <path d="M55 62.4 Q60 65 65 62.4" fill="none" stroke={glow} strokeWidth=".9" strokeLinecap="round" opacity=".5" />
        {ledRing(37, 34)}
      </>,
      neck: null,
    },
  }[variant] || {};

  const sx = term ? 1 : 0.92;

  return (
    <svg className={`ca ca-${variant}`} viewBox="0 0 120 152" width="100%" height="100%" aria-hidden="true">
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
        <radialGradient id={`${id}-bloom`}>
          <stop offset="0%" stopColor={term ? "#ff2d46" : glow} stopOpacity=".8" />
          <stop offset="55%" stopColor={term ? "#ff2d46" : glow} stopOpacity=".2" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="70%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={`${id}-mask`}><rect x="0" y="0" width="120" height="152" fill={`url(#${id}-fade)`} /></mask>
      </defs>

      <g mask={`url(#${id}-mask)`}>
        {/* ── torso ── */}
        <g transform={`translate(60 0) scale(${sx} 1) translate(-60 0)`}>
          <path d="M60 76 L86 86 L92 108 L84 140 L36 140 L28 108 L34 86 Z"
            fill={`url(#${id}-${term ? "chrome" : "plate"})`} stroke={term ? "#cfdcf4" : "#8fa3c8"} strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M34 84 L18 94 L16 112 L30 108 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M86 84 L102 94 L104 112 L90 108 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth="1.2" strokeLinejoin="round" />
          <circle cx="24" cy="102" r="2.6" fill={term ? "#ff2d46" : glow} className="ca-optic" />
          <circle cx="96" cy="102" r="2.6" fill={accent} className="ca-optic" />
          <path d="M60 78 L60 134" stroke={term ? "#cfdcf4" : glow} strokeWidth=".9" opacity=".5" />
          <path d="M40 96 L52 100 M80 96 L68 100" stroke={term ? "#cfdcf4" : glow} strokeWidth=".9" opacity=".45" />
          <path d="M40 122 L80 122 L78 134 L42 134 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth=".9" opacity=".95" />
          <g className="ca-core">
            <circle cx="60" cy="106" r="11" fill="none" stroke={term ? "#ff2d46" : glow} strokeWidth="1.2" opacity=".85" />
            <path d="M60 97 L69 106 L60 115 L51 106 Z" fill={term ? `url(#${id}-red)` : `url(#${id}-visor)`} />
            <circle cx="60" cy="106" r="4" fill="#fff" opacity=".92" />
          </g>
        </g>

        {/* ── neck ── */}
        {HEAD.neck || <>
          <path d="M52 62 L68 62 L70 80 L50 80 Z" fill={`url(#${id}-${bare ? "white" : "skin"})`} stroke="#7f8fac" strokeWidth=".7" />
          <path d="M49 78 L71 78" stroke={glow} strokeWidth="1.3" opacity=".7" />
        </>}

        {/* ── head ── */}
        <path d={HEAD.skull}
          fill={`url(#${id}-${HEAD.chrome ? "chrome" : HEAD.white ? "white" : "skin"})`}
          stroke={HEAD.chrome ? "#e6eeff" : HEAD.white ? "#dbe6f7" : "#c8ab9e"} strokeWidth="1" strokeLinejoin="round" />
        <path d={HEAD.skull} fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1.5" strokeLinejoin="round" />
        {HEAD.extras}
        {/* one specular sweep — what stops flat vector reading as flat */}
        <path d={HEAD.skull} fill="none" stroke="#fff" strokeWidth="1.2" opacity={HEAD.chrome ? ".6" : ".32"} strokeDasharray="28 88" />
      </g>
    </svg>
  );
}

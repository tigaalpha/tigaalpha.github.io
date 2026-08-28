/* ── cyber-avatar.tsx ──
   The character itself, drawn rather than borrowed.

   The dress-up screen used to stack colour emoji — a face, a shirt, a hat — and
   no amount of lighting around them makes that read as a character: emoji are
   flat, cheerful, and drawn in somebody else's style. This is a real vector
   avatar, so the silhouette, the panel lines and the visor glow all belong to
   the same world as the chamber it stands in.

   Three builds, one skeleton. VANGUARD is broad and armoured, SPECTER is
   slim with a trailing light-cable, KIT keeps the fox identity as a rounded
   helm with ears. Each is a bust that dissolves into the podium light instead
   of standing on drawn legs — a projected hologram, which is both the better
   look and the honest one for a 120px-tall figure.

   Colour is not baked in. `armorA`/`armorB` come from the equipped OUTFIT's own
   swatch, so changing clothes re-plates the whole suit, and `glow` is the
   chamber's key light, so the visor and seams always match the room. That is
   why the outfit no longer needs a garment emoji pasted on the chest — the
   armour IS the outfit. ── */

export function CyberAvatar({ variant = "boy", armorA = "#1a2233", armorB = "#38506e", glow = "#00f0ff", accent = "#aa00ff" }) {
  const id = "ca-" + variant;
  /* An ANDROID FACE, not a helmet with a letterbox slit. The first pass drew a
     blank plate with a light-bar across it, which reads as a machine rather than
     as somebody — so this has the structure a face actually has: a brow ridge, a
     nose bridge, cheek planes catching the key light, a tapered jaw to a chin,
     and two real eyes with an iris and a catchlight. The seams that make it
     obviously synthetic (the jaw split, the cheek vents, the vocaliser grille,
     the ear units) are laid OVER that human structure rather than replacing it,
     which is what makes it read as humanoid instead of as a mask. */
  const eye = (cx, cy, rx, ry) => (
    <g className="ca-eye">
      <ellipse cx={cx} cy={cy} rx={rx + 1.4} ry={ry + 1.2} fill={`url(#${id}-bloom)`} />
      <path d={`M${cx - rx} ${cy} Q${cx} ${cy - ry * 1.5} ${cx + rx} ${cy} Q${cx} ${cy + ry * 1.15} ${cx - rx} ${cy} Z`} fill={`url(#${id}-visor)`} />
      <circle cx={cx} cy={cy} r={ry * 0.62} fill="#eafcff" opacity=".95" />
      <circle cx={cx + rx * 0.22} cy={cy - ry * 0.28} r={ry * 0.24} fill="#fff" />
    </g>
  );
  // the parts every build shares: brow, nose, mouth grille, chin seam
  const faceCore = (chin) => (
    <>
      <path d="M40 30 Q60 26 80 30" fill="none" stroke="#9fb2d6" strokeWidth="1.5" strokeLinecap="round" opacity=".9" />
      <path d="M60 34 L60 46 M56.5 47.5 Q60 49.5 63.5 47.5" fill="none" stroke="#8fa3c8" strokeWidth="1.1" strokeLinecap="round" opacity=".8" />
      {/* A curved vocaliser rather than a straight dark bar — a rectangle across
          the lower face reads as a gag, a curve reads as a mouth. */}
      <g className="ca-mouth">
        <path d={`M52 ${chin - 12} Q60 ${chin - 7.5} 68 ${chin - 12}`} fill="none" stroke={glow} strokeWidth="1.9" strokeLinecap="round" />
        <path d={`M54.5 ${chin - 9.6} Q60 ${chin - 6.4} 65.5 ${chin - 9.6}`} fill="none" stroke={glow} strokeWidth="1" strokeLinecap="round" opacity=".55" />
        <circle cx="50" cy={chin - 12.5} r="1.1" fill={glow} opacity=".8" />
        <circle cx="70" cy={chin - 12.5} r="1.1" fill={glow} opacity=".8" />
      </g>
      <path d={`M60 ${chin - 5} L60 ${chin - 1}`} stroke="#7d90b4" strokeWidth=".9" opacity=".7" />
    </>
  );
  // ear / audio units, the give-away that this is built rather than born
  const ears = (y) => (
    <>
      <path d={`M32 ${y} L26 ${y + 2} L26 ${y + 13} L32 ${y + 15} Z`} fill={`url(#${id}-trim)`} stroke={glow} strokeWidth="1" strokeLinejoin="round" />
      <path d={`M88 ${y} L94 ${y + 2} L94 ${y + 13} L88 ${y + 15} Z`} fill={`url(#${id}-trim)`} stroke={glow} strokeWidth="1" strokeLinejoin="round" />
      <circle cx="29" cy={y + 7.5} r="1.8" fill={glow} className="ca-optic" />
      <circle cx="91" cy={y + 7.5} r="1.8" fill={accent} className="ca-optic" />
    </>
  );

  const HEAD = {
    // VANGUARD — squarer skull, heavy jaw, swept crown plate
    boy: {
      helm: "M60 5 C74 5 84 14 85 29 C86 40 84 49 79 57 C74 65 66 70 60 70 C54 70 46 65 41 57 C36 49 34 40 35 29 C36 14 46 5 60 5 Z",
      extras: <>
        {/* crown / hair plate, swept back */}
        <path d="M60 4 C75 4 85 13 86 27 C80 20 71 17 60 17 C49 17 40 20 34 27 C35 13 45 4 60 4 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth="1" strokeLinejoin="round" />
        {/* cheek planes */}
        <path d="M38 38 L46 44 L43 55 L37 47 Z" fill="#39465f" stroke="#8ea2c6" strokeWidth=".7" opacity=".85" />
        <path d="M82 38 L74 44 L77 55 L83 47 Z" fill="#39465f" stroke="#8ea2c6" strokeWidth=".7" opacity=".85" />
        {ears(36)}
        {eye(49, 37, 7.5, 4.4)}
        {eye(71, 37, 7.5, 4.4)}
        {faceCore(70)}
      </>,
    },
    // SPECTER — narrower skull, long swept side plates, softer eyes
    girl: {
      helm: "M60 6 C72 6 81 15 82 29 C83 41 80 50 75 58 C71 65 65 70 60 70 C55 70 49 65 45 58 C40 50 37 41 38 29 C39 15 48 6 60 6 Z",
      extras: <>
        <path d="M60 4 C74 4 83 14 84 28 C79 21 70 18 60 18 C50 18 41 21 36 28 C37 14 46 4 60 4 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth="1" strokeLinejoin="round" />
        {/* long swept side plates, read as hair */}
        <path d="M38 24 Q28 40 30 66 Q31 78 26 88 L34 88 Q40 74 39 58 Q38 40 43 30 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".9" strokeLinejoin="round" opacity=".95" />
        <path d="M82 24 Q92 40 90 66 Q89 78 94 88 L86 88 Q80 74 81 58 Q82 40 77 30 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".9" strokeLinejoin="round" opacity=".95" />
        <path d="M41 39 L48 45 L45 55 L40 47 Z" fill="#39465f" stroke="#8ea2c6" strokeWidth=".7" opacity=".85" />
        <path d="M79 39 L72 45 L75 55 L80 47 Z" fill="#39465f" stroke="#8ea2c6" strokeWidth=".7" opacity=".85" />
        {eye(50, 38, 7.8, 5) }
        {eye(70, 38, 7.8, 5) }
        {faceCore(70)}
      </>,
    },
    // KIT — rounder skull, oversized optics, fox ears kept from the old build
    cute: {
      helm: "M60 10 C76 10 86 21 86 35 C86 50 78 62 68 67 C64 69 56 69 52 67 C42 62 34 50 34 35 C34 21 44 10 60 10 Z",
      extras: <>
        <path d="M40 18 L30 2 L50 11 Z" fill={`url(#${id}-trim)`} stroke={accent} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M80 18 L90 2 L70 11 Z" fill={`url(#${id}-trim)`} stroke={accent} strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M40 17 L35 7 L47 12 Z" fill={accent} opacity=".6" />
        <path d="M80 17 L85 7 L73 12 Z" fill={accent} opacity=".6" />
        <path d="M60 12 C74 12 84 21 85 32 C79 25 71 22 60 22 C49 22 41 25 35 32 C36 21 46 12 60 12 Z" fill={`url(#${id}-hair)`} stroke={glow} strokeWidth=".9" strokeLinejoin="round" />
        {ears(38)}
        {eye(49, 40, 9, 6.4)}
        {eye(71, 40, 9, 6.4)}
        {faceCore(69)}
        {/* blush vents */}
        <path d="M39 52 L44 52 M76 52 L81 52" stroke={accent} strokeWidth="1.6" strokeLinecap="round" opacity=".75" />
      </>,
    },
  }[variant] || {};

  const slim = variant === "girl" || variant === "cute";
  const sx = slim ? 0.9 : 1;

  return (
    <svg className={`ca ca-${variant}`} viewBox="0 0 120 152" width="100%" height="100%" aria-hidden="true">
      <defs>
        {/* A fixed metal ramp, NOT the outfit colours. Several outfits are almost
            black (the starter Digital Suit is #1a1a2e on #0d0d15), and plating the
            whole figure in them turned the character into an unreadable silhouette.
            The suit's colours drive the trim and panels instead, where they show
            without costing the form its legibility. */}
        <linearGradient id={`${id}-plate`} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor="#8b9ec2" />
          <stop offset="26%" stopColor="#4a5a78" />
          <stop offset="62%" stopColor="#232d42" />
          <stop offset="100%" stopColor="#0d1220" />
        </linearGradient>
        {/* The face gets its own, brighter ramp. Sharing the body's plating left
            the sculpting — brow, cheek planes, jaw — sitting in shadow, so all the
            structure that makes it read as a face was invisible at this size. */}
        <linearGradient id={`${id}-face`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#c3d2ec" />
          <stop offset="30%" stopColor="#8496b8" />
          <stop offset="68%" stopColor="#4c5c7c" />
          <stop offset="100%" stopColor="#28344c" />
        </linearGradient>
        {/* hair / crown plating: dark enough to read as hair, light enough to see */}
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
          <stop offset="0%" stopColor={glow} stopOpacity=".95" />
          <stop offset="55%" stopColor={glow} stopOpacity=".15" />
          <stop offset="100%" stopColor={accent} stopOpacity=".8" />
        </linearGradient>
        <linearGradient id={`${id}-visor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity=".95" />
          <stop offset="40%" stopColor={glow} />
          <stop offset="100%" stopColor={accent} stopOpacity=".85" />
        </linearGradient>
        {/* the bust dissolves into the podium light rather than ending in a hard cut */}
        <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="1" />
          <stop offset="68%" stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-bloom`}>
          <stop offset="0%" stopColor={glow} stopOpacity=".85" />
          <stop offset="55%" stopColor={glow} stopOpacity=".22" />
          <stop offset="100%" stopColor={glow} stopOpacity="0" />
        </radialGradient>
        <mask id={`${id}-mask`}><rect x="0" y="0" width="120" height="152" fill={`url(#${id}-fade)`} /></mask>
      </defs>

      <g mask={`url(#${id}-mask)`}>
        {/* ── torso: pauldrons, chest plate, core ── */}
        <g transform={`translate(60 0) scale(${sx} 1) translate(-60 0)`}>
          <path d="M60 70 L86 80 L92 104 L84 138 L36 138 L28 104 L34 80 Z"
            fill={`url(#${id}-plate)`} stroke="#8fa3c8" strokeWidth="1.1" strokeLinejoin="round" />
          {/* pauldrons */}
          <path d="M34 78 L18 88 L16 108 L30 104 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M86 78 L102 88 L104 108 L90 104 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth="1.2" strokeLinejoin="round" />
          {/* pauldron status lights */}
          <circle cx="24" cy="96" r="2.6" fill={glow} className="ca-optic" />
          <circle cx="96" cy="96" r="2.6" fill={accent} className="ca-optic" />
          {/* chest seams */}
          <path d="M60 72 L60 132" stroke={glow} strokeWidth=".9" opacity=".55" />
          <path d="M40 92 L52 96 M80 92 L68 96" stroke={glow} strokeWidth=".9" opacity=".45" />
          <path d="M40 118 L80 118 L78 130 L42 130 Z" fill={`url(#${id}-trim)`} stroke={glow} strokeWidth=".9" opacity=".95" />
          {/* reactor core */}
          <g className="ca-core">
            <circle cx="60" cy="100" r="11" fill="none" stroke={glow} strokeWidth="1.2" opacity=".85" />
            <path d="M60 91 L69 100 L60 109 L51 100 Z" fill={`url(#${id}-visor)`} />
            <circle cx="60" cy="100" r="4" fill="#fff" opacity=".92" />
          </g>
        </g>

        {/* ── neck ── */}
        <path d="M52 58 L68 58 L70 74 L50 74 Z" fill="#1b2333" stroke="#6d80a4" strokeWidth=".8" />
        <path d="M49 72 L71 72" stroke={glow} strokeWidth="1.4" opacity=".8" />

        {/* ── head ── */}
        <path d={HEAD.helm} fill={`url(#${id}-face)`} stroke="#b8c8e8" strokeWidth="1.1" strokeLinejoin="round" />
        <path d={HEAD.helm} fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1.6" strokeLinejoin="round" />
        {HEAD.extras}
        {/* one specular sweep across the skull — what stops flat vector reading as flat */}
        <path d={HEAD.helm} fill="none" stroke="#fff" strokeWidth="1.1" opacity=".5" strokeDasharray="30 86" />
      </g>
    </svg>
  );
}

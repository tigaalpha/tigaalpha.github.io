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
  const HEAD = {
    // angular, heavy jaw, single wide visor
    boy: {
      helm: "M60 4 L86 16 L90 38 L82 56 L60 64 L38 56 L30 38 L34 16 Z",
      visor: "M39 28 L81 28 L77 42 L43 42 Z",
      crest: "M56 2 L64 2 L62 14 L58 14 Z",
      extras: <>
        <path d="M32 42 L38 44 L38 52 L34 50 Z" fill={`url(#${id}-plate)`} stroke={armorB} strokeWidth=".7" />
        <path d="M88 42 L82 44 L82 52 L86 50 Z" fill={`url(#${id}-plate)`} stroke={armorB} strokeWidth=".7" />
      </>,
    },
    // slim helm, split visor, side fins, trailing light-cable
    girl: {
      helm: "M60 5 L82 17 L86 38 L78 57 L60 64 L42 57 L34 38 L38 17 Z",
      visor: "M42 29 L58 29 L56 41 L45 41 Z M62 29 L78 29 L75 41 L64 41 Z",
      crest: "M57 3 L63 3 L61 12 L59 12 Z",
      extras: <>
        <path d="M34 34 L26 30 L25 44 L33 46 Z" fill={`url(#${id}-plate)`} stroke={glow} strokeWidth=".8" opacity=".9" />
        <path d="M86 34 L94 30 L95 44 L87 46 Z" fill={`url(#${id}-plate)`} stroke={glow} strokeWidth=".8" opacity=".9" />
        {/* light-cable falling past the shoulder */}
        <path d="M80 52 Q94 74 88 104 Q86 116 92 124" fill="none" stroke={glow} strokeWidth="2.4" strokeLinecap="round" opacity=".75" />
        <path d="M80 52 Q94 74 88 104 Q86 116 92 124" fill="none" stroke="#fff" strokeWidth=".8" strokeLinecap="round" opacity=".5" />
      </>,
    },
    // rounded helm, fox ears, twin optic dots
    cute: {
      helm: "M60 10 Q84 10 86 34 Q88 56 60 64 Q32 56 34 34 Q36 10 60 10 Z",
      visor: "M42 30 Q60 24 78 30 Q79 43 60 47 Q41 43 42 30 Z",
      crest: "",
      extras: <>
        <path d="M38 16 L30 0 L48 8 Z" fill={`url(#${id}-plate)`} stroke={accent} strokeWidth="1" strokeLinejoin="round" />
        <path d="M82 16 L90 0 L72 8 Z" fill={`url(#${id}-plate)`} stroke={accent} strokeWidth="1" strokeLinejoin="round" />
        <path d="M38 15 L34 5 L45 9 Z" fill={accent} opacity=".55" />
        <path d="M82 15 L86 5 L75 9 Z" fill={accent} opacity=".55" />
        <circle cx="51" cy="35" r="3.4" fill={glow} className="ca-optic" />
        <circle cx="69" cy="35" r="3.4" fill={glow} className="ca-optic" />
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
        {HEAD.crest ? <path d={HEAD.crest} fill={glow} opacity=".9" /> : null}
        <path d={HEAD.helm} fill={`url(#${id}-plate)`} stroke="#9fb2d6" strokeWidth="1.1" strokeLinejoin="round" />
        <path d={HEAD.helm} fill="none" stroke={`url(#${id}-rim)`} strokeWidth="1.6" strokeLinejoin="round" />
        {HEAD.extras}
        {HEAD.visor ? <>
          {/* bloom sits BEHIND the visor as a plain radial — a blur filter here is
              what made the whole layer rasterise opaque in the emoji version */}
          <ellipse cx="60" cy="35" rx="34" ry="16" fill={`url(#${id}-bloom)`} className="ca-visor" />
          <path d={HEAD.visor} fill={`url(#${id}-visor)`} className="ca-visor" />
          <path d={HEAD.visor} fill="none" stroke="#fff" strokeWidth=".6" opacity=".7" />
        </> : null}
        {/* helmet highlight — one specular sweep is what stops flat vector reading as flat */}
        <path d={HEAD.helm} fill="none" stroke="#fff" strokeWidth="1.1" opacity=".5" strokeDasharray="30 86" />
      </g>
    </svg>
  );
}

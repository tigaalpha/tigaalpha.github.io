/* ── sprite.tsx ──
   A robot or pet shown as a THUMBNAIL — a shop card, a picker chip, a friend's
   avatar — is a picture that never turns and never moves, yet each one used
   to be the whole live drawing: a shop shelf of forty robot heads was forty
   SVGs of 54 gradients apiece, the pet shelf ~200 paths and 16 clip paths per
   pet, well over ten thousand elements repainting every time an optic pulsed.

   scripts/bake-sprites.mjs draws each thumbnail once, at build time, from the
   same components, and saves it as a small WebP (sprites-manifest.ts lists
   them). <Sprite> shows that image instead: one <img>, decoded off the main
   thread, fetched only when it scrolls near the screen, and kept by the
   service worker for good because its filename changes whenever its bytes do.

   The live drawing is always passed in as children and is what renders when
   there is no image for the id (a model added after the last bake) or the
   image fails to load (offline on a first visit, a browser without WebP) —
   so a missing sprite is a slower thumbnail, never a blank one. */
import { useState } from "react";
import { SPRITES } from "./sprites-manifest";
import { ART_V2 } from "./art-flag";

const DIR = "./sprites/";
/* The baked stills are the standard art. A device previewing the redesign
   (ART_V2, see art-flag.ts) draws its thumbnails live instead, so the preview
   is one art style everywhere rather than old stills around new figures. */
const LIVE = ART_V2;

export const hasSprite = (id) => !LIVE && !!SPRITES[id];

/** The baked still for `id`, shown about `px` CSS pixels wide (which picks the
    file through srcset), or `children` when there is none. It fills its box
    with object-fit: cover — the baked frame is cut so that this lands where
    the live SVG would have (see `fit` in the bake script). */
export function Sprite({ id, px, children = null, className = "" }) {
  const s = SPRITES[id];
  const [bad, setBad] = useState(false);
  if (!s || bad || LIVE) return children;
  const last = s.f.length - 1;
  return (
    <img className={`spr${className ? " " + className : ""}`} alt="" aria-hidden="true" draggable={false}
      loading="lazy" decoding="async" src={DIR + s.f[last]}
      srcSet={last ? s.f.map((f, i) => `${DIR}${f} ${s.w[i]}w`).join(", ") : undefined}
      sizes={last ? `${Math.round(px)}px` : undefined}
      onError={() => setBad(true)} />
  );
}

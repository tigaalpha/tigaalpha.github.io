/* ── arena-hi.ts ── the High-only layers of the PvP effects canvas (High graphics upgrade, round 1, 2026-11-17) ──
   Everything here is drawn onto the fight's own FX canvas (arena-fx.tsx), in 2D, and nothing in it touches a
   fighter, the DOM structure, the pad or the numbers. It is a separate chunk: arena-fx.tsx fetches it with a
   dynamic import() the first time a HIGH fight draws a frame, so Low (and every first load) never downloads it.

     reflections  the polished floor shows each fighter and the pet upside down, faded and soft. The fighters on
                  a phone are stored pictures (figure-cache.tsx); the lower part of the picture on screen is
                  mirrored ONCE into a small cached sprite (half resolution = the softness), and each drawn frame
                  is one drawImage per subject. Live-SVG fighters (desktop High) already have the CSS reflection
                  of the dark theme and are left alone.
     light        a hit throws a wide, soft wash of the attacker's colour across the room and along the floor,
                  and a big one lifts the whole air for a moment: the room answers the fight instead of only
                  the fighters.
     bloom        tier 3 only: the FX canvas is shrunk to a quarter, and added back stretched (bilinear = a wide
                  soft blur), so bolts, flashes and sparks glow into the room. Only on frames that have effects.

   Safe by construction: every layer sits behind try/catch in the caller (a throw switches the layer set off for
   the rest of the fight and the previous High look stays), a failed sprite is skipped, and the watchdog below
   drops the costliest layer first when frames stay slow (bloom, then reflections, then light) — all of that
   before the old High -> Low step-down of pvp-arena.tsx, which still sits above it. dispose() frees every
   canvas; nothing here adds a listener or a timer. */

type Sub = "me" | "op" | "pet";
const SUBS: Sub[] = ["me", "op", "pet"];
const SEL: Record<Sub, string> = { me: ".pvpfighter.me", op: ".pvpfighter.op", pet: ".pvppet3" };
const SPR_MAX = 48;

/** the part of the picture that is mirrored, as a fraction of its height, measured up from the feet */
const STRIP: Record<Sub, number> = { me: 0.4, op: 0.4, pet: 0.5 };
/** how long a change keeps the effects canvas drawing every frame (CSS transitions of a lunge or a knock are still running) */
const SETTLE = 700;

const rgbOf = (hex: string) => {
  const m = /^#([0-9a-f]{6})/i.exec(hex || "");
  if (!m) return "255,255,255";
  const v = parseInt(m[1], 16);
  return ((v >> 16) & 255) + "," + ((v >> 8) & 255) + "," + (v & 255);
};

export function create(S: any, cv: HTMLCanvasElement, FXC: any) {
  const st: Element | null = cv.closest(".pvpstage");
  const els: Record<Sub, HTMLElement | null> = { me: null, op: null, pet: null };
  const imgs: Record<Sub, SVGImageElement | null> = { me: null, op: null, pet: null };
  const seen: Record<Sub, string> = { me: "", op: "", pet: "" };   // picture + inline transform + classes at the last change
  const until: Record<Sub, number> = { me: 0, op: 0, pet: 0 };      // draw every frame until this time
  const feet: Record<Sub, number> = { me: 0, op: 0, pet: 0 };       // where the feet sit in the picture, 0..1 (from its viewBox)
  const spr = new Map<string, any>();                              // picture url -> { cv, w, h } | "wait" | "bad"
  const flipOf: Record<Sub, boolean> = { me: false, op: false, pet: false };   // is the picture shown mirrored left-right by the page? (the art faces left; one side is flipped to face the other)
  const flipFor: Record<Sub, string> = { me: "", op: "", pet: "" };            // the picture that was measured: asked again only when it changes
  const soft = new Map<string, HTMLCanvasElement>();               // attacker colour -> a soft round glow, painted once and only scaled afterwards
  const washes: any[] = [];
  let off = 0;                                                     // layers switched off by the watchdog or by a failure: 1 bloom, 2 reflections, 4 light
  let flag = false;                                                // a sprite arrived: the next frame must draw
  let bc: HTMLCanvasElement | null = null, bg: CanvasRenderingContext2D | null = null;
  let box: DOMRect | null = null;                                  // the canvas in the page
  // the watchdog: the average gap between two effect frames over 45 frames, judged twice in a row
  let lastT = 0, acc = 0, cnt = 0, bad = 0;

  const refl = () => !(off & 2) && FXC.hi && FXC.tier >= 2;
  const lit = () => !(off & 4) && FXC.hi && FXC.tier >= 2;
  const glow = () => !(off & 1) && FXC.hi && FXC.tier >= 3;

  function find(k: Sub) {
    let el = els[k];
    if (!el || !el.isConnected) { el = els[k] = st ? (st.querySelector(SEL[k]) as HTMLElement | null) : null; imgs[k] = null; }
    if (!el) return null;
    let im = imgs[k];
    if (!im || !im.isConnected || !el.contains(im)) im = imgs[k] = el.querySelector("image") as SVGImageElement | null;
    return { el, im };
  }

  /** the lower part of a picture, mirrored, faded to nothing and soft: one small canvas per picture */
  function build(im: HTMLImageElement, w: number, h: number, k: Sub) {
    const sc = 0.5;                                    // half resolution: the stretch back up is the blur
    const sf = STRIP[k], ff = feet[k];
    const W = Math.max(8, Math.round(w * sc)), H = Math.max(8, Math.round(h * sf * sc));
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d"); if (!x) throw new Error("no 2d");
    const nw = im.naturalWidth, nh = im.naturalHeight;
    // the source strip: from (feet - strip) down to the feet, in picture rows
    const sy = Math.max(0, ff - sf) * nh, sh = Math.min(nh - sy, sf * nh);
    x.imageSmoothingQuality = "high";
    x.setTransform(1, 0, 0, -1, 0, H);                 // upside down
    x.drawImage(im, 0, sy, nw, sh, 0, 0, W, H);
    x.setTransform(1, 0, 0, 1, 0, 0);
    // the mirror fades with distance from the feet
    x.globalCompositeOperation = "destination-in";
    const f = x.createLinearGradient(0, 0, 0, H);
    f.addColorStop(0, "rgba(0,0,0,1)"); f.addColorStop(0.35, "rgba(0,0,0,.5)"); f.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = f; x.fillRect(0, 0, W, H);
    return { cv: c, w: W, h: H };
  }

  function want(url: string, w: number, h: number, k: Sub) {
    if (!url || spr.has(url)) return;
    if (spr.size >= SPR_MAX) {                         // the oldest goes, and its canvas with it
      const first = spr.keys().next().value as string;
      const old = spr.get(first); if (old && old.cv) { old.cv.width = 0; old.cv.height = 0; }
      spr.delete(first);
    }
    spr.set(url, "wait");
    const im = new Image();
    im.decoding = "async";
    im.onload = () => { try { spr.set(url, build(im, w, h, k)); flag = true; } catch (e) { spr.set(url, "bad"); } };
    im.onerror = () => { spr.set(url, "bad"); };
    im.src = url;
  }

  /** has anything that shows in a reflection changed? (cheap: strings only, no layout) */
  function dirty(now: number) {
    let d = flag; flag = false;
    if (!refl()) return d;
    for (const k of SUBS) {
      const f = find(k); if (!f) continue;
      const sig = (f.im ? f.im.getAttribute("href") || "" : "") + "|" + f.el.style.transform + "|" + f.el.className;
      if (sig !== seen[k]) { seen[k] = sig; until[k] = now + SETTLE; }
      if (now < until[k]) d = true;
    }
    return d;
  }

  function busy() { return washes.length > 0; }

  /** the mirror under each subject; drawn before the effects, on the polished floor */
  function floor(ctx: CanvasRenderingContext2D) {
    if (!refl()) return;
    ctx.globalCompositeOperation = "source-over";
    const A = S.plain ? 0.42 : 0.3;                    // a mirror floor in the room, a wet one on the painted stages
    box = cv.getBoundingClientRect();                  // read with the pictures every frame: a shaking stage moves both the same way
    if (!box.width) return;
    const kk = S.w / box.width, F0 = S.floorY || S.h * 0.9;
    for (const k of SUBS) {
      const f = find(k); if (!f || !f.im) continue;
      const u = f.im.getAttribute("href") || ""; if (!u) continue;
      const r = f.im.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const w = r.width * kk, h = r.height * kk;
      if (!feet[k]) {                                  // the feet are the bottom of the figure's viewBox; the picture reaches a little below it
        const svg = f.im.ownerSVGElement, vbs = svg && svg.getAttribute("viewBox");
        const vb = vbs ? vbs.split(/[\s,]+/).map(Number) : null;
        const iy = parseFloat(f.im.getAttribute("y") || "0"), ih = parseFloat(f.im.getAttribute("height") || "0");
        feet[k] = vb && vb.length === 4 && ih > 0 ? Math.max(0.3, Math.min(0.98, (vb[1] + vb[3] - iy) / ih)) : 0.8;
      }
      const s = spr.get(u);
      if (s === undefined) { want(u, w, h, k); continue; }
      if (s === "wait" || s === "bad") continue;
      const feetY = (r.top - box.top) * kk + feet[k] * h;
      const air = Math.max(0, F0 - feetY);             // how far off the floor the feet are: the mirror falls as far below it
      if (flipFor[k] !== u) { flipFor[k] = u; flipOf[k] = flipped(f.im); }
      ctx.globalAlpha = A * (1 - Math.min(0.7, air / 140));
      const x0 = (r.left - box.left) * kk, y0 = F0 + air, hh = (w * s.h) / s.w;
      if (flipOf[k]) { ctx.save(); ctx.translate(x0 + w, 0); ctx.scale(-1, 1); ctx.drawImage(s.cv, 0, y0, w, hh); ctx.restore(); }   // a figure turned to face the other way is reflected turned the same way
      else ctx.drawImage(s.cv, x0, y0, w, hh);
    }
    ctx.globalAlpha = 1;
  }

  /** is the picture shown mirrored left-right? The sign of the determinant of every transform between it and the stage, multiplied (rotations and scales keep the sign, a scaleX(-1) flips it). Asked once per picture, never per frame. */
  function flipped(el: Element) {
    let neg = false;
    try {
      for (let e: Element | null = el; e && e !== st; e = e.parentElement) {
        const t = getComputedStyle(e).transform;
        if (!t || t === "none") continue;
        const m = new DOMMatrixReadOnly(t);
        if (m.a * m.d - m.b * m.c < 0) neg = !neg;
      }
    } catch (e) { return false; }
    return neg;
  }

  /** a round glow in the attacker's colour, painted once per colour: a hit then only scales and fades it (no gradient or colour string made per frame) */
  function glowOf(rgb: string) {
    let c = soft.get(rgb); if (c) return c;
    if (soft.size >= 10) { const k = soft.keys().next().value as string; const o = soft.get(k); if (o) { o.width = 0; o.height = 0; } soft.delete(k); }
    c = document.createElement("canvas"); c.width = c.height = 96;
    const x = c.getContext("2d"); if (!x) throw new Error("no 2d");
    const g = x.createRadialGradient(48, 48, 0, 48, 48, 48);
    g.addColorStop(0, "rgba(" + rgb + ",1)"); g.addColorStop(0.5, "rgba(" + rgb + ",.32)"); g.addColorStop(1, "rgba(" + rgb + ",0)");
    x.fillStyle = g; x.fillRect(0, 0, 96, 96);
    soft.set(rgb, c);
    return c;
  }

  /** a hit sends light through the room */
  function hit(x: number, y: number, colour: string, power: number) {
    if (!lit() || !(power > 0.6)) return;
    try {
      if (washes.length >= 6) washes.shift();
      const p = Math.min(1.8, power);
      washes.push({ x, y, g: glowOf(rgbOf(colour)), p: 0, dur: 0.3 + 0.18 * p, a: Math.min(0.3, 0.1 * p), r: S.w * (0.26 + 0.14 * p), big: p > 1.15 });
    } catch (e) { fail(); }                            // called from the fight's own effects: a throw here must never reach them
  }

  /** additive: drawn first among the lights, so bolts and flashes sit on top of it */
  function light(ctx: CanvasRenderingContext2D, dt: number) {
    if (!washes.length) return;
    if (!lit()) { washes.length = 0; return; }
    const Y = S.floorY || S.h * 0.9;
    for (let i = washes.length - 1; i >= 0; i--) {
      const w = washes[i]; w.p += dt / w.dur;
      if (w.p >= 1) { washes.splice(i, 1); continue; }
      const f = 1 - w.p, a = f * f * w.a;
      // the air of the room, lit from the point of the hit
      ctx.globalAlpha = a;
      ctx.drawImage(w.g, w.x - w.r, w.y - w.r, w.r * 2, w.r * 2);
      // the floor under it takes the same colour, flattened to the floor's own perspective
      ctx.save(); ctx.translate(w.x, Y); ctx.scale(1, 0.24);
      const r2 = w.r * (w.big ? 1.1 : 0.8);
      ctx.globalAlpha = Math.min(1, a * 1.5);
      ctx.drawImage(w.g, -r2, -r2, r2 * 2, r2 * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /** tier 3: the canvas as it is now, a quarter of the size, added back stretched */
  function bloom(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    if (!glow()) return;
    const W = Math.max(8, Math.round(canvas.width / 4)), H = Math.max(8, Math.round(canvas.height / 4));
    if (!bc || bc.width !== W || bc.height !== H) {
      if (!bc) { bc = document.createElement("canvas"); bg = bc.getContext("2d"); }
      if (!bg) throw new Error("no 2d");
      bc.width = W; bc.height = H; bg.imageSmoothingQuality = "high";
    }
    if (!bg) return;
    bg.globalCompositeOperation = "copy";
    bg.drawImage(canvas, 0, 0, W, H);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.3;   // was 0.5: the first art review found a big hit washed out at tier 3
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bc, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  /** the watchdog: costliest layer first, and never below the old High */
  function tick(now: number, active: boolean) {
    if (!active) { lastT = 0; acc = 0; cnt = 0; return; }
    if (lastT && now - lastT < 120) {
      acc += now - lastT; cnt++;
      if (cnt >= 45) {
        const avg = acc / cnt; acc = 0; cnt = 0;
        if (avg > 26) { if (++bad >= 2) { bad = 0; if (!(off & 1)) off |= 1; else if (!(off & 2)) off |= 2; else off |= 4; } } else bad = 0;
      }
    }
    lastT = now;
  }

  function fail() { off = 7; washes.length = 0; }

  function dispose() {
    spr.forEach((s) => { if (s && s.cv) { s.cv.width = 0; s.cv.height = 0; } });
    spr.clear(); washes.length = 0;
    soft.forEach((c) => { c.width = 0; c.height = 0; }); soft.clear();
    if (bc) { bc.width = 0; bc.height = 0; bc = null; bg = null; }
    els.me = els.op = els.pet = null; imgs.me = imgs.op = imgs.pet = null; box = null;
  }

  return { dirty, busy, floor, light, bloom, hit, tick, fail, dispose, get off() { return off; } };
}

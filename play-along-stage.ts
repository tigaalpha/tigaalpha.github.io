/* ── play-along-stage.ts ──
   The world behind the falling notes: a night sky with a great moon behind
   the rune-wheel, a ringed planet, aurora, stars and shafts of light; three
   planes of a neon city with a needle tower, a twin tower and its sky-bridge,
   billboards, haze between the planes; and a mirror-dark floor that reflects
   the skyline under a glowing grid.

   All of that is painted ONCE per canvas size into the backdrop bitmap (see
   songLoop), so the per-frame cost is still the one drawImage it always was.
   Nothing is downloaded — it is all drawn here from a few gradients — and the
   bake is measured (the test hook reads it), because it happens in the first
   frame of the count-in and a slow one would be a hitch the player feels.

   What moves lives in drawStageFx, only at the top graphics level, and is
   built to cost almost nothing between beats: the wheel's core flares on the
   beat (and is not drawn between beats at all), the outer ring's dashes turn
   (a stroke, which costs by its length, not its area), a shock-ring leaves the
   wheel on the downbeat (every beat in Fever), a line of light runs down the
   floor on every beat, and in Fever five beams sweep out of the wheel (eight in
   MEGA Fever). Nothing builds a gradient per frame, and nothing flashes: every
   brightening rises and falls smoothly, the ring and the floor line only ever
   move, and on a fast tempo the flare is halved. ── */

const TAU = Math.PI * 2;
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function canvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

/* The sky, from the top of the canvas to the horizon at hz. */
export function bakeSky(nx, W, H, hz, wx, wy, wR) {
  const rnd = rng(31);
  // the night, deepening upward; a violet haze along the horizon
  const sky = nx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, "#03010b"); sky.addColorStop(0.42, "#0b0525"); sky.addColorStop(0.78, "#1c0a42"); sky.addColorStop(1, "#3a0f52");
  nx.fillStyle = sky; nx.fillRect(0, 0, W, hz + 2);
  for (const [fx, fy, fr, col] of [[0.14, 0.22, 0.5, "rgba(255,43,214,0.16)"], [0.9, 0.14, 0.46, "rgba(40,220,255,0.15)"], [0.5, 0.74, 0.62, "rgba(140,70,255,0.16)"]]) {
    const g = nx.createRadialGradient(fx * W, fy * H, 0, fx * W, fy * H, fr * Math.max(W, H));
    g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)");
    nx.fillStyle = g; nx.fillRect(0, 0, W, hz + 2);
  }
  // stars
  for (let i = 0; i < 120; i++) {
    const x = rnd() * W, y = rnd() * hz * 0.86, big = rnd();
    nx.globalAlpha = 0.25 + rnd() * 0.6;
    nx.fillStyle = big < 0.12 ? "#bff4ff" : big < 0.3 ? "#ffc8f2" : "#ffffff";
    const r = big < 0.1 ? 1.5 : big < 0.4 ? 1 : 0.65;
    nx.fillRect(x, y, r, r);
  }
  nx.globalAlpha = 1;
  // the great moon: a dim disc behind the wheel, its rim catching light
  nx.globalCompositeOperation = "lighter";
  const mR = wR * 1.62;
  const moon = nx.createRadialGradient(wx - mR * 0.25, wy - mR * 0.3, mR * 0.05, wx, wy, mR);
  moon.addColorStop(0, "rgba(200,150,255,0.30)"); moon.addColorStop(0.6, "rgba(130,70,230,0.16)"); moon.addColorStop(1, "rgba(90,40,190,0.0)");
  nx.fillStyle = moon; nx.beginPath(); nx.arc(wx, wy, mR, 0, TAU); nx.fill();
  nx.strokeStyle = "rgba(190,150,255,0.22)"; nx.lineWidth = 1.2; nx.beginPath(); nx.arc(wx, wy, mR * 0.98, 0, TAU); nx.stroke();
  nx.strokeStyle = "rgba(120,220,255,0.10)"; nx.lineWidth = 3; nx.beginPath(); nx.arc(wx, wy, mR * 1.05, 0, TAU); nx.stroke();
  // the outer ring's still parts: a faint circle, its ticks and six points (its turning dashes are drawn by drawStageFx)
  {
    const R = wR * 1.3;
    nx.strokeStyle = "rgba(120,225,255,0.14)"; nx.lineWidth = 1; nx.beginPath(); nx.arc(wx, wy, R, 0, TAU); nx.stroke();
    nx.strokeStyle = "rgba(255,90,220,0.3)";
    nx.beginPath();
    for (let k = 0; k < 36; k++) { const a = k / 36 * TAU, r1 = R * (k % 3 ? 1.02 : 1.06); nx.moveTo(wx + Math.cos(a) * R, wy + Math.sin(a) * R); nx.lineTo(wx + Math.cos(a) * r1, wy + Math.sin(a) * r1); }
    nx.stroke();
    nx.fillStyle = "rgba(200,250,255,0.8)";
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; nx.beginPath(); nx.arc(wx + Math.cos(a) * R, wy + Math.sin(a) * R, 2, 0, TAU); nx.fill(); }
  }
  // shafts of light spreading down from the wheel's lower rim
  {
    const oy = wy + wR * 0.92, len = Math.max(40, hz - oy) * 1.05;
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.26, half = 0.05 + Math.abs(i) * 0.012;
      const g = nx.createLinearGradient(wx, oy, wx, oy + len);
      g.addColorStop(0, "rgba(190,150,255,0.09)"); g.addColorStop(1, "rgba(190,150,255,0)");
      nx.fillStyle = g;
      nx.beginPath(); nx.moveTo(wx + Math.sin(a) * wR * 0.5, oy);
      nx.lineTo(wx + Math.tan(a - half) * len, oy + len); nx.lineTo(wx + Math.tan(a + half) * len, oy + len);
      nx.closePath(); nx.fill();
    }
  }
  // aurora: two ribbons of soft light, built from a stack of ever wider, fainter strokes
  for (let b = 0; b < 2; b++) {
    const base = hz * (0.2 + b * 0.13), amp = H * (0.03 + b * 0.012), wl = W * (0.9 + b * 0.5), ph = b * 2.1 + 0.6;
    const grad = nx.createLinearGradient(0, 0, W, 0);
    if (b === 0) { grad.addColorStop(0, "rgb(60,255,200)"); grad.addColorStop(0.5, "rgb(60,190,255)"); grad.addColorStop(1, "rgb(200,90,255)"); }
    else { grad.addColorStop(0, "rgb(255,90,220)"); grad.addColorStop(0.5, "rgb(140,90,255)"); grad.addColorStop(1, "rgb(60,220,255)"); }
    nx.strokeStyle = grad; nx.lineCap = "round"; nx.lineJoin = "round";
    for (let k = 0; k < 4; k++) {
      nx.globalAlpha = 0.02 + k * 0.02; nx.lineWidth = 32 - k * 8;
      nx.beginPath();
      for (let x = -10; x <= W + 10; x += 22) { const y = base + Math.sin(x / wl * TAU + ph) * amp + Math.sin(x / wl * TAU * 2.3 + ph * 1.7) * amp * 0.35; x < 0 ? nx.moveTo(x, y) : nx.lineTo(x, y); }
      nx.stroke();
    }
  }
  nx.globalAlpha = 1; nx.lineWidth = 1;
  // a small ringed planet, high in the corner
  const pr = Math.min(W, H) * 0.062, px = W * 0.83, py = H * 0.135;
  nx.save(); nx.translate(px, py); nx.rotate(-0.38);
  nx.strokeStyle = "rgba(170,150,255,0.5)"; nx.lineWidth = 1.6;
  nx.beginPath(); nx.ellipse(0, 0, pr * 2.15, pr * 0.55, 0, Math.PI, TAU); nx.stroke();          // the ring behind
  nx.restore();
  nx.globalCompositeOperation = "source-over";
  const pl = nx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, pr * 0.1, px, py, pr);
  pl.addColorStop(0, "#9df4ff"); pl.addColorStop(0.5, "#6a5cff"); pl.addColorStop(1, "#150a3c");
  nx.fillStyle = pl; nx.beginPath(); nx.arc(px, py, pr, 0, TAU); nx.fill();
  nx.save(); nx.translate(px, py); nx.rotate(-0.38);
  nx.globalCompositeOperation = "lighter";
  nx.strokeStyle = "rgba(200,190,255,0.75)"; nx.lineWidth = 1.8;
  nx.beginPath(); nx.ellipse(0, 0, pr * 2.15, pr * 0.55, 0, 0, Math.PI); nx.stroke();            // the ring in front
  nx.strokeStyle = "rgba(120,220,255,0.35)"; nx.lineWidth = 0.9;
  nx.beginPath(); nx.ellipse(0, 0, pr * 1.75, pr * 0.42, 0, 0, Math.PI); nx.stroke();
  nx.restore();
  nx.globalCompositeOperation = "source-over"; nx.lineWidth = 1;
}

/* The city, on a canvas of its own (transparent, W × hz): the floor mirrors
   it. Three planes — far and hazy, middle, near and dark — with a needle
   tower and a twin tower and its sky-bridge in the middle plane. `wx2` is the
   window layer the near towers' lit windows are also painted on, which the
   scene flashes softly on the beat. */
export function bakeCity(W, H, hz, dpr, wx2) {
  const cv = canvas(W * dpr, hz * dpr), nx = cv.getContext("2d");
  nx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rnd = rng(7);
  const PLANES = [
    { fill: "rgba(46,24,104,0.8)", roof: "rgba(255,60,210,0.30)", h0: 0.18, h1: 0.4, w0: 22, w1: 54, gap: 4, win: 0.13, wa: 0.24, sign: 0, fog: 0.28 },
    { fill: "rgba(22,11,60,0.94)", roof: "rgba(130,120,255,0.42)", h0: 0.12, h1: 0.3, w0: 18, w1: 44, gap: 3, win: 0.2, wa: 0.36, sign: 0.1, fog: 0.16 },
    { fill: "rgba(6,3,18,0.97)", roof: "rgba(60,230,255,0.55)", h0: 0.07, h1: 0.2, w0: 16, w1: 38, gap: 1, win: 0.28, wa: 0.55, sign: 0.3, fog: 0 },
  ];
  PLANES.forEach((P, L) => {
    let x = -10;
    while (x < W + 10) {
      const bw = P.w0 + rnd() * (P.w1 - P.w0), bh = H * (P.h0 + rnd() * (P.h1 - P.h0));
      nx.fillStyle = P.fill; nx.fillRect(x, hz - bh, bw, bh + 2);
      nx.fillStyle = P.roof; nx.fillRect(x, hz - bh, bw, 1.3);
      for (let wy = hz - bh + 5; wy < hz - 3; wy += 6) for (let wxx = x + 3; wxx < x + bw - 3; wxx += 5) {
        if (rnd() > P.win) continue;
        const pink = rnd() < 0.5;
        nx.fillStyle = pink ? `rgba(255,90,220,${P.wa})` : `rgba(80,230,255,${P.wa})`;
        nx.fillRect(wxx, wy, 2, 2.4);
        if (wx2 && L === 2) { wx2.fillStyle = pink ? "rgba(255,150,235,0.95)" : "rgba(150,245,255,0.95)"; wx2.fillRect(wxx - 0.5, wy - 0.5, 3, 3.4); }
      }
      if (P.sign && rnd() < P.sign) {                 // a vertical sign, or on the near plane sometimes a billboard
        const sc = rnd() < 0.5 ? "255,60,210" : "60,230,255";
        nx.globalCompositeOperation = "lighter";
        if (L === 2 && bw > 22 && rnd() < 0.55) {
          const bwid = bw * 0.55, bhgt = 10 + rnd() * 9, bx = x + (bw - bwid) / 2, by = hz - bh + 8;
          const g = nx.createLinearGradient(bx, by, bx + bwid, by + bhgt);
          g.addColorStop(0, `rgba(${sc},0.62)`); g.addColorStop(1, `rgba(${sc === "255,60,210" ? "140,70,255" : "80,140,255"},0.5)`);
          nx.fillStyle = `rgba(${sc},0.12)`; nx.fillRect(bx - 3, by - 3, bwid + 6, bhgt + 6);
          nx.fillStyle = g; nx.fillRect(bx, by, bwid, bhgt);
          nx.fillStyle = "rgba(255,255,255,0.4)";
          for (let s = 0; s < 2; s++) nx.fillRect(bx + 2, by + 3 + s * 4.5, bwid * (s ? 0.5 : 0.75), 1.1);
        } else {
          const sy0 = hz - bh + 6, sh = Math.min(bh - 10, 26);
          nx.fillStyle = `rgba(${sc},0.18)`; nx.fillRect(x + bw / 2 - 4, sy0 - 3, 8, sh + 6);
          nx.fillStyle = `rgba(${sc},0.85)`; nx.fillRect(x + bw / 2 - 1.2, sy0, 2.4, sh);
        }
        nx.globalCompositeOperation = "source-over";
      }
      x += bw + P.gap;
    }
    // haze: the farther the plane, the more the horizon's violet sits on it
    if (P.fog) {
      const f = nx.createLinearGradient(0, hz - H * 0.45, 0, hz);
      f.addColorStop(0, "rgba(120,50,170,0)"); f.addColorStop(1, `rgba(150,60,190,${P.fog})`);
      nx.fillStyle = f; nx.fillRect(0, hz - H * 0.45, W, H * 0.45);
    }
    if (L === 1) landmarks(nx, W, H, hz);
  });
  return cv;
}
function landmarks(nx, W, H, hz) {
  // the needle: a tall spire with lit collars and a beacon
  const nxp = W * 0.84, nh = H * 0.5, nw = Math.max(7, W * 0.022);
  nx.fillStyle = "rgba(14,7,40,0.97)";
  nx.beginPath(); nx.moveTo(nxp - nw / 2, hz); nx.lineTo(nxp - nw * 0.28, hz - nh * 0.82); nx.lineTo(nxp, hz - nh); nx.lineTo(nxp + nw * 0.28, hz - nh * 0.82); nx.lineTo(nxp + nw / 2, hz); nx.closePath(); nx.fill();
  nx.globalCompositeOperation = "lighter";
  for (const q of [0.42, 0.6, 0.76]) {
    const y = hz - nh * q, hw = nw * (0.62 - q * 0.3) + 1.5;
    nx.fillStyle = "rgba(60,230,255,0.22)"; nx.fillRect(nxp - hw - 3, y - 3, (hw + 3) * 2, 7);
    nx.fillStyle = "rgba(120,240,255,0.9)"; nx.fillRect(nxp - hw - 1.5, y - 0.8, (hw + 1.5) * 2, 1.6);
  }
  const bg = nx.createRadialGradient(nxp, hz - nh, 0, nxp, hz - nh, 16);
  bg.addColorStop(0, "rgba(255,255,255,0.95)"); bg.addColorStop(0.25, "rgba(255,90,220,0.6)"); bg.addColorStop(1, "rgba(255,60,210,0)");
  nx.fillStyle = bg; nx.beginPath(); nx.arc(nxp, hz - nh, 16, 0, TAU); nx.fill();
  nx.globalCompositeOperation = "source-over";
  // the twin towers and their sky-bridge
  const tx = W * 0.05, tw = Math.max(15, W * 0.05), h1 = H * 0.38, h2 = H * 0.33, gap = tw * 0.9;
  nx.fillStyle = "rgba(14,7,40,0.97)";
  nx.fillRect(tx, hz - h1, tw, h1 + 2); nx.fillRect(tx + tw + gap, hz - h2, tw, h2 + 2);
  const by = hz - Math.min(h1, h2) * 0.62;
  nx.fillRect(tx + tw, by - 2, gap, 4.5);
  nx.globalCompositeOperation = "lighter";
  nx.fillStyle = "rgba(255,60,210,0.55)"; nx.fillRect(tx, hz - h1, tw, 1.4); nx.fillRect(tx + tw + gap, hz - h2, tw, 1.4);
  nx.fillStyle = "rgba(255,90,225,0.16)"; nx.fillRect(tx + tw, by - 4, gap, 9);
  nx.fillStyle = "rgba(255,150,235,0.85)"; nx.fillRect(tx + tw, by - 0.6, gap, 1.3);
  for (let i = 0; i < 2; i++) for (let y = hz - (i ? h2 : h1) + 5; y < hz - 4; y += 6) {
    const wxp = tx + i * (tw + gap);
    nx.fillStyle = (Math.floor(y) + i) % 3 === 0 ? "rgba(255,120,230,0.5)" : "rgba(90,230,255,0.4)";
    nx.fillRect(wxp + 3, y, tw - 6, 1.2);
  }
  nx.globalCompositeOperation = "source-over";
}

/* The floor: dark, the skyline mirrored into it and fading out, a grid in
   perspective running out from under the keys, the horizon lit. */
export function bakeFloor(nx, cityCv, W, H, hz, dpr) {
  const fh = H - hz;
  const base = nx.createLinearGradient(0, hz, 0, H);
  base.addColorStop(0, "#0b0418"); base.addColorStop(1, "#03010a");
  nx.fillStyle = base; nx.fillRect(0, hz, W, fh + 1);
  if (cityCv && fh > 4) {                                   // the reflection
    const refH = Math.min(fh, hz * 0.55);
    const t = canvas(W * dpr, refH * dpr), tx = t.getContext("2d");
    tx.setTransform(1, 0, 0, -1, 0, cityCv.height);          // flip: the base of the towers meets the horizon
    tx.drawImage(cityCv, 0, 0);
    tx.setTransform(1, 0, 0, 1, 0, 0);
    tx.globalCompositeOperation = "destination-in";
    const m = tx.createLinearGradient(0, 0, 0, t.height);
    m.addColorStop(0, "rgba(0,0,0,0.42)"); m.addColorStop(1, "rgba(0,0,0,0)");
    tx.fillStyle = m; tx.fillRect(0, 0, t.width, t.height);
    nx.drawImage(t, 0, 0, t.width, t.height, 0, hz, W, refH);
  }
  // the grid: a soft wide stroke under a crisp one
  nx.strokeStyle = "rgba(60,230,255,1)";
  for (const [lw, a] of [[3, 0.07], [1, 0.24]]) {
    nx.lineWidth = lw; nx.globalAlpha = a; nx.beginPath();
    for (let k = 1; k <= 6; k++) { const q = k / 6, gy = hz + fh * q * q; nx.moveTo(0, gy); nx.lineTo(W, gy); }
    for (let k = -8; k <= 8; k++) { nx.moveTo(W / 2 + k * 10, hz); nx.lineTo(W / 2 + k * W / 7, H); }
    nx.stroke();
  }
  nx.globalAlpha = 1; nx.lineWidth = 1;
  // the horizon, lit
  const hg = nx.createLinearGradient(0, hz - 26, 0, hz + 10);
  hg.addColorStop(0, "rgba(255,60,210,0)"); hg.addColorStop(0.72, "rgba(255,70,215,0.3)"); hg.addColorStop(1, "rgba(255,70,215,0)");
  nx.fillStyle = hg; nx.fillRect(0, hz - 26, W, 36);
  nx.fillStyle = "rgba(255,120,230,0.7)"; nx.fillRect(0, hz - 0.6, W, 1.2);
}

/* The bitmaps drawStageFx draws every frame — built once with the backdrop. */
export function stageSprites(W, H, wR, dpr) {
  // the wheel's core glow
  const cs = Math.ceil(wR * 2.7), core = canvas(cs * dpr, cs * dpr), cx = core.getContext("2d");
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = cx.createRadialGradient(cs / 2, cs / 2, 0, cs / 2, cs / 2, cs / 2);
  g.addColorStop(0, "rgba(255,255,255,0.5)"); g.addColorStop(0.12, "rgba(230,190,255,0.34)"); g.addColorStop(0.42, "rgba(150,80,255,0.12)"); g.addColorStop(1, "rgba(120,60,255,0)");
  cx.fillStyle = g; cx.fillRect(0, 0, cs, cs);
  // a beam: a long thin wedge, bright at the wheel and gone at the far end
  const L = Math.ceil(Math.max(W, H) * 1.15), bw = 40, beam = canvas(bw, 256), bx = beam.getContext("2d");
  const bgr = bx.createLinearGradient(0, 0, 0, 256);
  bgr.addColorStop(0, "rgba(255,255,255,0.9)"); bgr.addColorStop(0.3, "rgba(255,255,255,0.4)"); bgr.addColorStop(1, "rgba(255,255,255,0)");
  bx.fillStyle = bgr; bx.beginPath(); bx.moveTo(bw / 2 - 1.5, 0); bx.lineTo(bw / 2 + 1.5, 0); bx.lineTo(bw, 256); bx.lineTo(0, 256); bx.closePath(); bx.fill();
  bx.globalCompositeOperation = "destination-in";
  const edge = bx.createLinearGradient(0, 0, bw, 0);
  edge.addColorStop(0, "rgba(0,0,0,0)"); edge.addColorStop(0.5, "rgba(0,0,0,1)"); edge.addColorStop(1, "rgba(0,0,0,0)");
  bx.fillStyle = edge; bx.fillRect(0, 0, bw, 256);
  return { core: { cv: core, size: cs }, beam: { cv: beam, len: L, w: bw } };
}

/* What moves, every frame, at the top graphics level. S: the stage's size and
   wheel (W, H, hz, wx, wy, wR), the clock (tSec, beatF, beatPhase, pulse,
   downbeat), the mode (fever, mega), `calm` (a fast tempo: the brightening
   on the beat is halved and the shock-ring keeps to the downbeat — nothing
   here may flash more than about three times a second) and the sprites from
   stageSprites. */
export function drawStageFx(ctx, S) {
  const { W, H, hz, wx, wy, wR, tSec, beatF, beatPhase, pulse, downbeat, fever, mega, calm, spr } = S;
  const started = beatF >= 0;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // the wheel's core flares on the beat — and is not drawn at all between beats, when it would only be a big soft rectangle to blend
  if (pulse > 0.12) {
    const amp = calm ? 0.5 : 1, k = 1 + 0.14 * pulse * amp, sz = spr.core.size * k;
    ctx.globalAlpha = 0.55 * pulse * amp * (downbeat ? 1 : 0.6);
    ctx.drawImage(spr.core.cv, wx - sz / 2, wy - sz / 2, sz, sz);
  }
  // the outer ring's dashes turn, the other way from the wheel (a dashed stroke costs by its length, not its area)
  {
    ctx.setLineDash([10, 7, 3, 7]); ctx.lineDashOffset = tSec * (fever ? 46 : 7);
    ctx.globalAlpha = 1; ctx.lineWidth = 1.2;
    ctx.strokeStyle = fever ? "rgba(150,240,255,0.75)" : "rgba(120,225,255,0.42)";
    ctx.beginPath(); ctx.arc(wx, wy, wR * 1.3, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (started) {
    // a shock-ring leaves the wheel on the downbeat (every beat in Fever): it only ever expands and fades
    const strength = downbeat ? (mega ? 0.65 : 0.5) : fever && !calm ? 0.3 : 0;
    if (strength) {
      const q = beatPhase;
      ctx.globalAlpha = (1 - q) * (1 - q) * strength;
      ctx.strokeStyle = "rgba(160,235,255,1)"; ctx.lineWidth = downbeat ? 2.4 : 1.6;
      ctx.beginPath(); ctx.arc(wx, wy, wR * (0.75 + 1.7 * q), 0, TAU); ctx.stroke();
    }
    // a line of light runs down the floor on every beat, from the horizon to the keys
    {
      const q = beatPhase, y = hz + (H - hz) * q * q;
      ctx.globalAlpha = (1 - q) * 0.55;
      ctx.fillStyle = "rgba(100,235,255,1)"; ctx.fillRect(0, y, W, 1.6);
    }
  }
  // Fever: five beams sweep out of the wheel (eight in MEGA Fever)
  if (fever) {
    const b = spr.beam, base = tSec * (mega ? 0.42 : 0.32), n = mega ? 8 : 5;
    for (let i = 0; i < n; i++) {
      const a = base + i * (TAU / n), sway = Math.sin(tSec * 0.9 + i * 1.3) * 0.25;
      ctx.save(); ctx.translate(wx, wy); ctx.rotate(a + sway + Math.PI / 2);
      ctx.globalAlpha = 0.28;
      ctx.drawImage(b.cv, -b.w * 0.5, 0, b.w, b.len);
      ctx.restore();
    }
  }
  ctx.restore();
}

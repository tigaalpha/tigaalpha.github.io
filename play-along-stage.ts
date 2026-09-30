/* ── play-along-stage.ts ──
   The world behind the falling notes: a night sky with a great moon behind
   the rune-wheel, a ringed planet, a milky way, aurora, clouds lit from below,
   stars and shafts of light; four planes of a neon city with a needle tower, a
   twin tower and its sky-bridge, lit floors, masts and billboards, haze between
   the planes, a sunset behind it all; and a wet street that mirrors the skyline
   under a glowing grid.

   How it stays cheap. The world is painted ONCE per canvas size (bakeWorld)
   and kept (getWorld): the next song, the next run and a rematch reuse it, and
   the first one is painted while the ready screen is still up, a slice at a
   time (worldSteps, run by the hook when the browser is idle), so pressing
   Start finds it done. A song then only adds its lanes and hit-line to a copy
   (composeStage — a blit and a few strokes), and the frame loop draws that one
   bitmap each frame, exactly what the plain backdrop it replaced cost. The
   painting itself is kept light: every soft layer of the sky (the night, the
   glows, the moon's disc, the clouds, the aurora, the milky way, the vignette)
   is drawn at a quarter of the pixels and stretched in one copy, which costs by
   area; buildings and their windows are batched into one path per colour, and
   so are the stars; nothing is downloaded. The bake is measured (the test hook
   reads it): on a phone-sized stage it takes about a fifth less than the plain
   backdrop's bake did with none of the prettier parts, and the ready screen
   usually pays it.

   What moves lives in drawStageFx, only at the top graphics level, and is
   built to cost almost nothing between beats: the wheel's core flares on the
   beat (and is not drawn between beats at all), the outer ring's dashes turn
   (a stroke, which costs by its length, not its area), a shock-ring leaves the
   wheel on the downbeat (every beat in Fever), a line of light runs down the
   floor on every beat, in Fever five beams sweep out of the wheel (eight in
   MEGA Fever), cars cross the city, a few stars twinkle, the masts' beacons
   pulse and now and then a shooting star crosses the sky. Nothing builds a
   gradient per frame, and nothing flashes: every brightening rises and falls
   smoothly (the slowest of them takes three seconds, the fastest a beat), the
   ring and the floor line only ever move, and on a fast tempo the flare is
   halved. ── */

const TAU = Math.PI * 2;
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }
function canvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

/* ── the rune-wheel: still when the level is low (baked into the sky), a sprite that turns at the top ── */
export function drawRuneWheel(nx, sx, sy, R) {
  nx.globalCompositeOperation = "lighter";
  const halo = nx.createRadialGradient(sx, sy, R * 0.2, sx, sy, R * 1.4);
  halo.addColorStop(0, "rgba(255,60,220,0.1)"); halo.addColorStop(1, "rgba(255,60,220,0)");
  nx.fillStyle = halo; nx.beginPath(); nx.arc(sx, sy, R * 1.4, 0, 7); nx.fill();
  nx.strokeStyle = "rgba(255,70,220,0.26)"; nx.lineWidth = 1.5;
  nx.beginPath(); nx.arc(sx, sy, R, 0, 7); nx.stroke();
  nx.strokeStyle = "rgba(255,70,220,0.1)"; nx.lineWidth = 6;
  nx.beginPath(); nx.arc(sx, sy, R, 0, 7); nx.stroke();
  nx.strokeStyle = "rgba(60,230,255,0.22)"; nx.lineWidth = 1;
  nx.beginPath(); nx.arc(sx, sy, R * 0.82, 0, 7); nx.stroke();
  nx.setLineDash([2, 5, 9, 5]); nx.beginPath(); nx.arc(sx, sy, R * 0.9, 0, 7); nx.stroke(); nx.setLineDash([]);
  for (let k = 0; k < 24; k++) {
    const a = k / 24 * Math.PI * 2, r0 = R * (k % 2 ? 0.93 : 0.86);
    nx.beginPath(); nx.moveTo(sx + Math.cos(a) * r0, sy + Math.sin(a) * r0); nx.lineTo(sx + Math.cos(a) * R * 0.98, sy + Math.sin(a) * R * 0.98); nx.stroke();
  }
  nx.strokeStyle = "rgba(255,70,220,0.18)"; nx.lineWidth = 1.2;
  for (const off of [-Math.PI / 2, Math.PI / 2]) {
    nx.beginPath();
    for (let k = 0; k < 3; k++) { const a = off + k * Math.PI * 2 / 3; const px = sx + Math.cos(a) * R * 0.8, py = sy + Math.sin(a) * R * 0.8; k ? nx.lineTo(px, py) : nx.moveTo(px, py); }
    nx.closePath(); nx.stroke();
  }
  nx.strokeStyle = "rgba(60,230,255,0.24)";
  nx.beginPath(); nx.arc(sx, sy, R * 0.3, 0, 7); nx.stroke();
  nx.globalCompositeOperation = "source-over"; nx.lineWidth = 1;
}
export function wheelSprite(R, dpr) {
  const size = Math.ceil(R * 2.9);
  const cv = canvas(size * dpr, size * dpr), c = cv.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawRuneWheel(c, size / 2, size / 2, R);
  return { cv, size };
}

/* ── the world, in slices ──
   worldSteps(...) → { world, steps }: the steps are run in order (all at once, or one per idle slice — see paintWorld);
   the world is complete when the last has run. */
export function worldSteps(W, H, dpr, fx2) {
  const hz = H * 0.8, wx = W * 0.5, wy = H * 0.3, wR = Math.min(W * 0.42, H * 0.24);
  const cv = canvas(W * dpr, H * dpr), nx = cv.getContext("2d");
  nx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const winTop = Math.floor(hz - H * 0.44);
  const world: any = { key: worldKey(W, H, dpr, fx2), cv, W, H, dpr, hz, wx, wy, wR, winTop, win: null, wheel: null, spr: null, stars: [], beacons: [], signs: [], bakeMs: 0 };
  const timed = (fn) => () => { const t0 = performance.now(); fn(); world.bakeMs += performance.now() - t0; };
  const steps = [
    timed(() => bakeSkySoft(nx, W, H, hz, wx, wy, wR, dpr)),
    timed(() => { bakeSkyDetail(nx, W, H, hz, wx, wy, wR, world); if (!fx2) drawRuneWheel(nx, wx, wy, wR); }),   // the wheel is still at the low levels; at the top it turns (the frame loop draws it)
    timed(() => {
      let wx2 = null;
      if (fx2) { const wl = canvas(W * dpr, (hz - winTop) * dpr); wx2 = wl.getContext("2d"); wx2.setTransform(dpr, 0, 0, dpr, 0, -winTop * dpr); world.win = wl; }
      bakeCity(nx, W, H, hz, dpr, wx2, world);
    }),
    timed(() => bakeFloor(nx, W, H, hz, dpr, world)),
    timed(() => { if (fx2) { world.wheel = wheelSprite(wR, dpr); world.spr = stageSprites(W, H, wR, dpr); } }),
  ];
  return { world, steps };
}
const worldKey = (W, H, dpr, fx2) => `${W}|${H}|${dpr}|${fx2 ? 1 : 0}`;
const flush = (world) => world.cv.getContext("2d").getImageData(0, 0, 1, 1);      // a canvas's work is deferred until something reads it: make the bake pay it, not the first frame
/* A world painted from start to finish, kept by no one (the tests and the profiler use it). */
export function bakeWorld(W, H, dpr, fx2) {
  const { world, steps } = worldSteps(W, H, dpr, fx2);
  for (const s of steps) s();
  flush(world);
  return world;
}
/* The worlds already painted, the newest two (a phone is held one way at a time), and those half-painted. */
const WORLDS = [], JOBS = [];
export function getWorld(W, H, dpr, fx2) { const k = worldKey(W, H, dpr, fx2); return WORLDS.find(w => w.key === k) || null; }
/* The world for this size: all of it, or at most `maxSteps` more slices of it (the ready screen paints one slice per idle
   moment). What is half-painted is kept, so whoever comes next — Start, a second visit to the ready screen — finishes it instead
   of starting over. Returns the world once it is complete, null before. */
export function paintWorld(W, H, dpr, fx2, maxSteps = Infinity) {
  const k = worldKey(W, H, dpr, fx2), done = WORLDS.find(w => w.key === k);
  if (done) return done;
  let job = JOBS.find(j => j.key === k);
  if (!job) { job = { key: k, ...worldSteps(W, H, dpr, fx2), i: 0 }; JOBS.push(job); while (JOBS.length > 2) JOBS.shift(); }
  for (let n = 0; n < maxSteps && job.i < job.steps.length; n++) { job.steps[job.i](); job.i++; }
  if (job.i < job.steps.length) return null;
  flush(job.world);
  JOBS.splice(JOBS.indexOf(job), 1);
  WORLDS.push(job.world); while (WORLDS.length > 2) WORLDS.shift();
  return job.world;
}

/* A song's stage: the world with its lanes, the receptors and the hit-line drawn on a copy.
   L = { hitY, noteScale, lanes: [{ cx, w, hue }] } — cx and w as fractions of the width. */
export function composeStage(world, L) {
  const { W, H, dpr } = world, cv = canvas(W * dpr, H * dpr), nx = cv.getContext("2d");
  nx.globalCompositeOperation = "copy"; nx.drawImage(world.cv, 0, 0); nx.globalCompositeOperation = "source-over";
  nx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { hitY, noteScale, lanes } = L, n = lanes.length;
  // the energy the crystals are falling into, pooled along the hit-line
  const earth = nx.createLinearGradient(0, hitY - 34, 0, hitY + 20);
  earth.addColorStop(0, "rgba(255,50,210,0)"); earth.addColorStop(1, "rgba(255,50,210,0.3)");
  nx.fillStyle = earth; nx.fillRect(0, hitY - 34, W, 42);
  /* lanes are light-rails: a faint tint and a neon edge on each side that fades out toward the sky,
     all edges in ONE stroked path */
  const rail = nx.createLinearGradient(0, 0, 0, hitY);
  rail.addColorStop(0, "rgba(90,235,255,0)"); rail.addColorStop(1, "rgba(90,235,255,0.32)");
  nx.beginPath();
  for (let i = 0; i < n; i++) {
    const f = lanes[i], cw = f.w * W, cx = f.cx * W - cw / 2;
    nx.fillStyle = `hsla(${f.hue},90%,55%,0.07)`;
    nx.fillRect(cx, 0, cw, H);
    nx.moveTo(cx + 0.5, 0); nx.lineTo(cx + 0.5, hitY);
    nx.moveTo(cx + cw - 0.5, 0); nx.lineTo(cx + cw - 0.5, hitY);
  }
  nx.strokeStyle = rail; nx.lineWidth = 1; nx.stroke();
  // the hit-line: a charged bar, magenta through cyan, with a glow round it
  nx.globalCompositeOperation = "lighter";
  const hb = nx.createLinearGradient(0, 0, W, 0);
  hb.addColorStop(0, "rgba(255,60,210,0.9)"); hb.addColorStop(0.5, "rgba(80,240,255,0.95)"); hb.addColorStop(1, "rgba(255,60,210,0.9)");
  nx.fillStyle = "rgba(255,60,210,0.14)"; nx.fillRect(0, hitY - 7, W, 14);
  nx.fillStyle = hb; nx.fillRect(0, hitY - 1.4, W, 2.8);
  nx.fillStyle = "rgba(255,255,255,0.7)"; nx.fillRect(0, hitY - 0.4, W, 0.8);
  // a receptor sigil where each lane meets it
  for (let i = 0; i < n; i++) {
    const f = lanes[i], rx0 = f.cx * W, rs = Math.min(9, f.w * W * 0.28) * noteScale + 3;
    nx.strokeStyle = `hsla(${f.hue},100%,70%,0.8)`; nx.lineWidth = 1.2;
    nx.beginPath(); nx.moveTo(rx0, hitY - rs); nx.lineTo(rx0 + rs, hitY); nx.lineTo(rx0, hitY + rs); nx.lineTo(rx0 - rs, hitY); nx.closePath(); nx.stroke();
  }
  nx.globalCompositeOperation = "source-over"; nx.lineWidth = 1;
  return cv;
}

function vignette(cx, W, H) {
  const vg = cx.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.45, Math.max(W, H) * 0.8);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,8,0.55)");
  return vg;
}

/* The sky, from the top of the canvas to the horizon at hz (bakeSkySoft). Every soft layer in it (the night, the sun's glow, the nebulae, the
   moon's disc, the shafts of light, the clouds, the aurora, the milky way, the vignette) is painted at a quarter of the pixels
   and stretched in one copy — a smooth glow loses nothing and costs by area. */
function bakeSkySoft(nx, W, H, hz, wx, wy, wR, dpr) {
  const rnd = rng(31);
  const qs = Math.max(0.5, dpr / 4), sk = canvas(W * qs, (hz + 2) * qs), sx = sk.getContext("2d");
  sx.setTransform(qs, 0, 0, qs, 0, 0);
  // the night, deepening upward, warming to a coral horizon
  const sky = sx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, "#03010b"); sky.addColorStop(0.38, "#0a0524"); sky.addColorStop(0.66, "#1a0a48"); sky.addColorStop(0.84, "#46125f"); sky.addColorStop(0.94, "#86206f"); sky.addColorStop(1, "#bd3a78");
  sx.fillStyle = sky; sx.fillRect(0, 0, W, hz + 2);
  sx.globalCompositeOperation = "lighter";
  // the sun that has just gone: a glow on the horizon the skyline stands against
  const sun = sx.createRadialGradient(W * 0.5, hz, 0, W * 0.5, hz, W * 0.75);
  sun.addColorStop(0, "rgba(255,150,70,0.8)"); sun.addColorStop(0.22, "rgba(255,90,130,0.46)"); sun.addColorStop(0.55, "rgba(255,60,190,0.16)"); sun.addColorStop(1, "rgba(255,60,190,0)");
  sx.save(); sx.translate(W * 0.5, hz); sx.scale(1, 0.5); sx.translate(-W * 0.5, -hz); sx.fillStyle = sun; sx.fillRect(0, hz - W, W, W * 2); sx.restore();
  for (const [fx, fy, fr, col] of [[0.14, 0.22, 0.5, "rgba(255,43,214,0.16)"], [0.9, 0.14, 0.46, "rgba(40,220,255,0.15)"], [0.5, 0.74, 0.62, "rgba(140,70,255,0.16)"], [0.04, 0.5, 0.34, "rgba(40,230,200,0.1)"], [0.68, 0.38, 0.3, "rgba(255,90,220,0.09)"]]) {
    const g = sx.createRadialGradient(fx * W, fy * H, 0, fx * W, fy * H, fr * Math.max(W, H));
    g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)");
    sx.fillStyle = g; sx.fillRect(0, 0, W, hz + 2);
  }
  // the great moon: a dim disc behind the wheel
  const mR = wR * 1.62;
  const moon = sx.createRadialGradient(wx - mR * 0.25, wy - mR * 0.3, mR * 0.05, wx, wy, mR);
  moon.addColorStop(0, "rgba(200,150,255,0.30)"); moon.addColorStop(0.6, "rgba(130,70,230,0.16)"); moon.addColorStop(1, "rgba(90,40,190,0.0)");
  sx.fillStyle = moon; sx.beginPath(); sx.arc(wx, wy, mR, 0, TAU); sx.fill();
  // shafts of light spreading down from the wheel's lower rim
  {
    const oy = wy + wR * 0.92, len = Math.max(40, hz - oy) * 1.05;
    for (let i = -3; i <= 3; i++) {
      const a = i * 0.26, half2 = 0.05 + Math.abs(i) * 0.012;
      const g = sx.createLinearGradient(wx, oy, wx, oy + len);
      g.addColorStop(0, "rgba(190,150,255,0.09)"); g.addColorStop(1, "rgba(190,150,255,0)");
      sx.fillStyle = g;
      sx.beginPath(); sx.moveTo(wx + Math.sin(a) * wR * 0.5, oy);
      sx.lineTo(wx + Math.tan(a - half2) * len, oy + len); sx.lineTo(wx + Math.tan(a + half2) * len, oy + len);
      sx.closePath(); sx.fill();
    }
  }
  // clouds lying on the horizon, lit from below
  for (let i = 0; i < 12; i++) {
    const cx = rnd() * W, cy = hz - H * (0.03 + rnd() * 0.15), rx = W * (0.12 + rnd() * 0.2), ry = H * (0.012 + rnd() * 0.022);
    sx.save(); sx.translate(cx, cy); sx.scale(1, ry / rx);
    const g = sx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, "rgba(255,120,160,0.17)"); g.addColorStop(0.55, "rgba(190,80,190,0.07)"); g.addColorStop(1, "rgba(120,50,170,0)");
    sx.fillStyle = g; sx.beginPath(); sx.arc(0, 0, rx, 0, TAU); sx.fill(); sx.restore();
  }
  // aurora: two ribbons of soft light, built from a stack of ever wider, fainter strokes
  for (let b = 0; b < 2; b++) {
    const base = hz * (0.2 + b * 0.13), amp = H * (0.03 + b * 0.012), wl = W * (0.9 + b * 0.5), ph = b * 2.1 + 0.6;
    const grad = sx.createLinearGradient(0, 0, W, 0);
    if (b === 0) { grad.addColorStop(0, "rgb(60,255,200)"); grad.addColorStop(0.5, "rgb(60,190,255)"); grad.addColorStop(1, "rgb(200,90,255)"); }
    else { grad.addColorStop(0, "rgb(255,90,220)"); grad.addColorStop(0.5, "rgb(140,90,255)"); grad.addColorStop(1, "rgb(60,220,255)"); }
    sx.strokeStyle = grad; sx.lineCap = "round"; sx.lineJoin = "round";
    for (let k = 0; k < 4; k++) {
      sx.globalAlpha = 0.02 + k * 0.02; sx.lineWidth = 32 - k * 8;
      sx.beginPath();
      for (let x = -10; x <= W + 10; x += 22) { const y = base + Math.sin(x / wl * TAU + ph) * amp + Math.sin(x / wl * TAU * 2.3 + ph * 1.7) * amp * 0.35; x < 0 ? sx.moveTo(x, y) : sx.lineTo(x, y); }
      sx.stroke();
    }
  }
  // the milky way: a broad soft band of light along the river of stars, brightest across the middle
  {
    const mg = sx.createLinearGradient(0, 0, W, 0);
    mg.addColorStop(0, "rgba(120,170,255,0)"); mg.addColorStop(0.5, "rgba(170,140,255,1)"); mg.addColorStop(1, "rgba(255,120,220,0)");
    sx.strokeStyle = mg; sx.lineCap = "round";
    for (const [lw, a] of [[H * 0.2, 0.03], [H * 0.11, 0.04], [H * 0.05, 0.05]]) {
      sx.globalAlpha = a; sx.lineWidth = lw;
      sx.beginPath(); sx.moveTo(-lw, hz * 0.02); sx.quadraticCurveTo(W * 0.5, hz * 0.22, W + lw, hz * 0.6); sx.stroke();
    }
  }
  sx.globalAlpha = 1;
  sx.globalCompositeOperation = "source-over";
  sx.fillStyle = vignette(sx, W, H); sx.fillRect(0, 0, W, hz + 2);          // the corners darkened (the floor gets the same over its own part)
  nx.globalCompositeOperation = "copy";                                       // the canvas is empty: a plain copy, no blending
  nx.drawImage(sk, 0, 0, sk.width, sk.height, 0, 0, W, hz + 2);
  nx.globalCompositeOperation = "source-over";
}
/* ...and what is painted at full resolution over it: the stars, the moon's rim, the outer ring's still parts, the planet. */
function bakeSkyDetail(nx, W, H, hz, wx, wy, wR, world) {
  const rnd = rng(32), mR = wR * 1.62;
  const lots = new Map();                                // the stars are gathered by colour and brightness, then one fill each
  const put = (col, a, x, y, r) => { const key = col + a; let l = lots.get(key); if (!l) lots.set(key, l = { col, a, r: [] }); l.r.push(x, y, r); };
  for (let i = 0; i < 120; i++) {                        // a scatter of stars
    const x = rnd() * W, y = rnd() * hz * 0.86, big = rnd(), a = 0.25 + rnd() * 0.6;
    put(big < 0.12 ? "#bff4ff" : big < 0.3 ? "#ffc8f2" : "#ffffff", Math.round(a * 4) / 4, x, y, big < 0.1 ? 1.5 : big < 0.4 ? 1 : 0.65);
  }
  for (let i = 0; i < 90; i++) {                         // and a denser band across the sky, a river of them
    const t = rnd(), x = W * (0.02 + t * 0.96), spread = (rnd() + rnd() - 1) * H * 0.07, y = hz * (0.06 + t * 0.5) + spread, a = 0.12 + rnd() * 0.32;
    put(rnd() < 0.3 ? "#ffd3f5" : "#d8f6ff", Math.round(a * 8) / 8, x, y, 0.8);
  }
  for (const l of lots.values()) { nx.globalAlpha = l.a; nx.fillStyle = l.col; nx.beginPath(); for (let q = 0; q < l.r.length; q += 3) nx.rect(l.r[q], l.r[q + 1], l.r[q + 2], l.r[q + 2]); nx.fill(); }
  nx.globalAlpha = 1;
  nx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 12; i++) {                         // the brightest, with a cross of light — the ones that twinkle at the top level
    const x = W * (0.06 + rnd() * 0.88), y = hz * (0.05 + rnd() * 0.5);
    if (Math.hypot(x - wx, y - wy) < wR * 1.5) continue;
    const c = rnd() < 0.5 ? "190,240,255" : "255,190,240", L = 4 + rnd() * 5;
    nx.fillStyle = `rgba(${c},0.95)`; nx.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
    const g1 = nx.createLinearGradient(x - L, y, x + L, y); g1.addColorStop(0, `rgba(${c},0)`); g1.addColorStop(0.5, `rgba(${c},0.55)`); g1.addColorStop(1, `rgba(${c},0)`);
    nx.fillStyle = g1; nx.fillRect(x - L, y - 0.4, L * 2, 0.8);
    const g2 = nx.createLinearGradient(x, y - L, x, y + L); g2.addColorStop(0, `rgba(${c},0)`); g2.addColorStop(0.5, `rgba(${c},0.55)`); g2.addColorStop(1, `rgba(${c},0)`);
    nx.fillStyle = g2; nx.fillRect(x - 0.4, y - L, 0.8, L * 2);
    world.stars.push({ x, y, ph: rnd() * TAU, sp: 0.5 + rnd() * 0.5 });
  }
  nx.strokeStyle = "rgba(190,150,255,0.22)"; nx.lineWidth = 1.2; nx.beginPath(); nx.arc(wx, wy, mR * 0.98, 0, TAU); nx.stroke();
  nx.strokeStyle = "rgba(120,220,255,0.10)"; nx.lineWidth = 3; nx.beginPath(); nx.arc(wx, wy, mR * 1.05, 0, TAU); nx.stroke();
  {                                                      // the outer ring's still parts: a faint circle, its ticks and six points (its turning dashes are drawn by drawStageFx)
    const R = wR * 1.3;
    nx.strokeStyle = "rgba(120,225,255,0.14)"; nx.lineWidth = 1; nx.beginPath(); nx.arc(wx, wy, R, 0, TAU); nx.stroke();
    nx.strokeStyle = "rgba(255,90,220,0.3)";
    nx.beginPath();
    for (let k = 0; k < 36; k++) { const a = k / 36 * TAU, r1 = R * (k % 3 ? 1.02 : 1.06); nx.moveTo(wx + Math.cos(a) * R, wy + Math.sin(a) * R); nx.lineTo(wx + Math.cos(a) * r1, wy + Math.sin(a) * r1); }
    nx.stroke();
    nx.fillStyle = "rgba(200,250,255,0.8)";
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; nx.beginPath(); nx.arc(wx + Math.cos(a) * R, wy + Math.sin(a) * R, 2, 0, TAU); nx.fill(); }
  }
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

/* The city, painted straight onto the sky: the floor mirrors the strip of the world above the horizon. Four planes — far and
   hazy, two between, near and dark — with a needle tower, a twin tower and its sky-bridge in the middle,
   crowns, masts with beacons, lit floors, billboards, haze between the planes. `wx2` is the window layer
   the near towers' lit windows are also painted on, which the scene flashes softly on the beat. */
function bakeCity(nx, W, H, hz, dpr, wx2, world) {
  const rnd = rng(7);
  const PLANES = [
    { fill: "rgba(78,34,124,0.5)", roof: "rgba(255,120,190,0.26)", h0: 0.12, h1: 0.3, w0: 12, w1: 30, gap: 2, win: 0.05, wa: 0.16, sign: 0, fog: 0.34, crown: 0.12, mast: 0 },
    { fill: "rgba(46,24,104,0.8)", roof: "rgba(255,60,210,0.30)", h0: 0.18, h1: 0.4, w0: 22, w1: 54, gap: 4, win: 0.13, wa: 0.24, sign: 0, fog: 0.16, crown: 0.16, mast: 0.08 },
    { fill: "rgba(22,11,60,0.94)", roof: "rgba(130,120,255,0.42)", h0: 0.12, h1: 0.3, w0: 18, w1: 44, gap: 3, win: 0.2, wa: 0.36, sign: 0.1, fog: 0, crown: 0.2, mast: 0.1 },
    { fill: "rgba(6,3,18,0.97)", roof: "rgba(60,230,255,0.55)", h0: 0.07, h1: 0.2, w0: 16, w1: 38, gap: 1, win: 0.28, wa: 0.55, sign: 0.3, fog: 0, crown: 0.22, mast: 0.1 },
  ];
  PLANES.forEach((P, L) => {
    const bodies = [], roofs = [], pinkW = [], cyanW = [], warm = [], cool = [], lit = [];
    let x = -10;
    while (x < W + 10) {
      const bw = P.w0 + rnd() * (P.w1 - P.w0), bh = H * (P.h0 + rnd() * (P.h1 - P.h0));
      bodies.push([x, hz - bh, bw, bh + 2]); roofs.push([x, hz - bh, bw, 1.3]);
      let top = hz - bh;
      if (rnd() < P.crown && bw > 14) {                    // a crown: a narrower block on the roof
        const cw = bw * (0.5 + rnd() * 0.3), ch = H * (0.02 + rnd() * 0.05), cx = x + (bw - cw) * (0.2 + rnd() * 0.6);
        bodies.push([cx, top - ch, cw, ch + 1]); roofs.push([cx, top - ch, cw, 1.2]); top -= ch;
      }
      if (P.mast && rnd() < P.mast) {                      // a mast, with a beacon
        const mh = H * (0.04 + rnd() * 0.06), mx = x + bw * (0.25 + rnd() * 0.5);
        bodies.push([mx - 0.6, top - mh, 1.2, mh + 1]);
        if (world.beacons.length < 9) world.beacons.push({ x: mx, y: top - mh, ph: rnd() * TAU });
        lit.push([mx, top - mh]);
      }
      const rows = [];
      for (let wy = hz - bh + 5; wy < hz - 3; wy += 6) rows.push(wy);
      for (const wy of rows) for (let wxx = x + 3; wxx < x + bw - 3; wxx += 5) {
        if (rnd() > P.win) continue;
        const pink = rnd() < 0.5;
        (pink ? pinkW : cyanW).push([wxx, wy, 2, 2.4]);
        if (wx2 && L === 3) { wx2.fillStyle = pink ? "rgba(255,150,235,0.95)" : "rgba(150,245,255,0.95)"; wx2.fillRect(wxx - 0.5, wy - 0.5, 3, 3.4); }
      }
      if (L >= 1 && rows.length > 3 && rnd() < 0.18 && bw > 16) {   // a few floors lit right across, in a warm or a cool light
        const n = 1 + Math.floor(rnd() * 3), arr = rnd() < 0.55 ? warm : cool;
        for (let q = 0; q < n; q++) arr.push([x + 2, rows[Math.floor(rnd() * rows.length)], bw - 4, 1.7]);
      }
      if (P.sign && rnd() < P.sign) {                      // a vertical sign, or on the near plane sometimes a billboard
        const sc = rnd() < 0.5 ? "255,60,210" : "60,230,255";
        nx.globalCompositeOperation = "lighter";
        if (L === 3 && bw > 22 && rnd() < 0.55) {
          const bwid = bw * 0.55, bhgt = 10 + rnd() * 9, bx = x + (bw - bwid) / 2, by = hz - bh + 8;
          const g = nx.createLinearGradient(bx, by, bx + bwid, by + bhgt);
          g.addColorStop(0, `rgba(${sc},0.62)`); g.addColorStop(1, `rgba(${sc === "255,60,210" ? "140,70,255" : "80,140,255"},0.5)`);
          nx.fillStyle = `rgba(${sc},0.12)`; nx.fillRect(bx - 3, by - 3, bwid + 6, bhgt + 6);
          nx.fillStyle = g; nx.fillRect(bx, by, bwid, bhgt);
          nx.fillStyle = "rgba(255,255,255,0.4)";
          for (let s = 0; s < 2; s++) nx.fillRect(bx + 2, by + 3 + s * 4.5, bwid * (s ? 0.5 : 0.75), 1.1);
          world.signs.push({ x: bx + bwid / 2, w: bwid, c: sc });
          { const gr = nx.createRadialGradient(bx + bwid / 2, by + bhgt / 2, 0, bx + bwid / 2, by + bhgt / 2, bwid * 1.3); gr.addColorStop(0, `rgba(${sc},0.3)`); gr.addColorStop(1, `rgba(${sc},0)`); nx.fillStyle = gr; nx.fillRect(bx - bwid * 1.3, by - bwid * 1.3 + bhgt / 2, bwid * 3.6, bwid * 2.6); }
        } else {
          const sy0 = hz - bh + 6, sh = Math.min(bh - 10, 26);
          nx.fillStyle = `rgba(${sc},0.18)`; nx.fillRect(x + bw / 2 - 4, sy0 - 3, 8, sh + 6);
          nx.fillStyle = `rgba(${sc},0.85)`; nx.fillRect(x + bw / 2 - 1.2, sy0, 2.4, sh);
          if (L === 3) world.signs.push({ x: x + bw / 2, w: 3, c: sc });
        }
        nx.globalCompositeOperation = "source-over";
      }
      x += bw + P.gap;
    }
    // one fill per colour: the plane's bodies, its roof lines, its windows, its lit floors, its beacons
    const paint = (list, style) => { if (!list.length) return; nx.fillStyle = style; nx.beginPath(); for (const r of list) nx.rect(r[0], r[1], r[2], r[3]); nx.fill(); };
    paint(bodies, P.fill); paint(roofs, P.roof);
    paint(pinkW, `rgba(255,90,220,${P.wa})`); paint(cyanW, `rgba(80,230,255,${P.wa})`);
    nx.globalCompositeOperation = "lighter";
    if (L >= 2) {                                            // the near planes glow: a soft halo on every roof line and lit window
      const halo = (list, style, dx, dy, grow) => { nx.fillStyle = style; nx.beginPath(); for (const r of list) nx.rect(r[0] - dx, r[1] - dy, r[2] + dx * 2, r[3] + dy * 2 + grow); nx.fill(); };
      halo(roofs, L === 3 ? "rgba(60,230,255,0.11)" : "rgba(150,130,255,0.09)", 0, 2.4, 2.4);
      halo(pinkW, "rgba(255,90,220,0.09)", 1.2, 1.2, 0); halo(cyanW, "rgba(80,230,255,0.09)", 1.2, 1.2, 0);
    }
    paint(warm, `rgba(255,190,110,${0.16 + L * 0.1})`); paint(cool, `rgba(110,225,255,${0.16 + L * 0.1})`);
    if (lit.length) { nx.fillStyle = "rgba(255,80,110,0.9)"; nx.beginPath(); for (const p of lit) nx.rect(p[0] - 0.9, p[1] - 0.9, 1.8, 1.8); nx.fill(); }
    nx.globalCompositeOperation = "source-over";
    // haze: the farther the plane, the more the horizon's warmth sits on it
    if (P.fog) { nx.globalAlpha = P.fog; nx.drawImage(fogStrip(), 0, 0, 1, 64, 0, hz - H * 0.34, W, H * 0.34); nx.globalAlpha = 1; }
    if (L === 2) landmarks(nx, W, H, hz);
  });
}
let FOG = null;
function fogStrip() {
  if (FOG) return FOG;
  FOG = canvas(1, 64); const fx = FOG.getContext("2d"), g = fx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, "rgba(140,50,150,0)"); g.addColorStop(1, "rgba(190,70,150,1)");
  fx.fillStyle = g; fx.fillRect(0, 0, 1, 64);
  return FOG;
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

/* The street: dark and wet, the skyline (and the glow behind it) mirrored into it and smeared, streaks of light under
   the signs, a grid in perspective running out from under the keys, the horizon lit. */
function bakeFloor(nx, W, H, hz, dpr, world) {
  const fh = H - hz;
  const base = nx.createLinearGradient(0, hz, 0, H);
  base.addColorStop(0, "#14061f"); base.addColorStop(0.35, "#0a0318"); base.addColorStop(1, "#03010a");
  nx.fillStyle = base; nx.fillRect(0, hz, W, fh + 1);
  if (fh > 4) {                                             // the reflection: the strip above the horizon, flipped, half the pixels (it is soft anyway)
    const refH = Math.min(fh, hz * 0.55);
    const t = canvas(W * dpr * 0.5, refH * dpr * 0.5), tx = t.getContext("2d");
    tx.setTransform(0.5, 0, 0, -0.5, 0, t.height);
    tx.drawImage(nx.canvas, 0, Math.round((hz - refH) * dpr), Math.round(W * dpr), Math.round(refH * dpr), 0, 0, Math.round(W * dpr), Math.round(refH * dpr));
    tx.setTransform(1, 0, 0, 1, 0, 0);
    tx.globalCompositeOperation = "destination-in";
    const m = tx.createLinearGradient(0, 0, 0, t.height);
    m.addColorStop(0, "rgba(0,0,0,0.55)"); m.addColorStop(1, "rgba(0,0,0,0)");
    tx.fillStyle = m; tx.fillRect(0, 0, t.width, t.height);
    nx.globalAlpha = 0.9; nx.drawImage(t, 0, 0, t.width, t.height, 0, hz, W, refH);
    nx.globalAlpha = 0.4; nx.drawImage(t, 0, 0, t.width, t.height, 0, hz + 2.5, W, refH);          // the smear: the same again, a little lower
    nx.globalAlpha = 1;
  }
  // streaks of light under the signs
  nx.globalCompositeOperation = "lighter";
  for (const s of world.signs) {
    const len = Math.min(fh * 0.5, 60), g = nx.createLinearGradient(0, hz, 0, hz + len);
    g.addColorStop(0, `rgba(${s.c},0.34)`); g.addColorStop(1, `rgba(${s.c},0)`);
    nx.fillStyle = g; nx.fillRect(s.x - Math.max(1.2, s.w * 0.35), hz, Math.max(2.4, s.w * 0.7), len);
  }
  nx.globalCompositeOperation = "source-over";
  // the grid: a soft wide stroke under a crisp one
  nx.strokeStyle = "rgba(60,230,255,1)";
  for (const [lw, a] of [[3, 0.07], [1, 0.24]]) {
    nx.lineWidth = lw; nx.globalAlpha = a; nx.beginPath();
    for (let k = 1; k <= 6; k++) { const q = k / 6, gy = hz + fh * q * q; nx.moveTo(0, gy); nx.lineTo(W, gy); }
    for (let k = -8; k <= 8; k++) { nx.moveTo(W / 2 + k * 10, hz); nx.lineTo(W / 2 + k * W / 7, H); }
    nx.stroke();
  }
  nx.globalAlpha = 1; nx.lineWidth = 1;
  // the horizon, lit — and the road's own glow beneath it
  nx.globalCompositeOperation = "lighter";
  const rg = nx.createRadialGradient(W / 2, hz, 0, W / 2, hz, W * 0.6);
  rg.addColorStop(0, "rgba(255,100,200,0.22)"); rg.addColorStop(1, "rgba(255,100,200,0)");
  nx.save(); nx.translate(W / 2, hz); nx.scale(1, 0.32); nx.translate(-W / 2, -hz); nx.fillStyle = rg; nx.fillRect(0, hz, W, W); nx.restore();
  nx.globalCompositeOperation = "source-over";
  const hg = nx.createLinearGradient(0, hz - 26, 0, hz + 10);
  hg.addColorStop(0, "rgba(255,60,210,0)"); hg.addColorStop(0.72, "rgba(255,90,200,0.34)"); hg.addColorStop(1, "rgba(255,70,215,0)");
  nx.fillStyle = hg; nx.fillRect(0, hz - 26, W, 36);
  nx.fillStyle = "rgba(255,150,225,0.75)"; nx.fillRect(0, hz - 0.6, W, 1.2);
  nx.fillStyle = vignette(nx, W, H); nx.fillRect(0, hz, W, fh + 1);
}

/* The bitmaps drawStageFx draws every frame — built once with the backdrop. */
export function stageSprites(W, H, wR, dpr) {
  // the wheel's core glow
  const cs = Math.ceil(wR * 2.7), cd = Math.max(1, dpr / 2), core = canvas(cs * cd, cs * cd), cx = core.getContext("2d");   // soft: half the pixels will do
  cx.setTransform(cd, 0, 0, cd, 0, 0);
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
  // a star's soft cross, and a beacon's red glow
  const star = canvas(16 * dpr, 16 * dpr), sx = star.getContext("2d"); sx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sg = sx.createRadialGradient(8, 8, 0, 8, 8, 8); sg.addColorStop(0, "rgba(255,255,255,0.95)"); sg.addColorStop(0.2, "rgba(210,235,255,0.5)"); sg.addColorStop(1, "rgba(180,200,255,0)");
  sx.fillStyle = sg; sx.fillRect(0, 0, 16, 16);
  const cross = sx.createLinearGradient(0, 8, 16, 8); cross.addColorStop(0, "rgba(255,255,255,0)"); cross.addColorStop(0.5, "rgba(255,255,255,0.7)"); cross.addColorStop(1, "rgba(255,255,255,0)");
  sx.fillStyle = cross; sx.fillRect(0, 7.6, 16, 0.8);
  const cross2 = sx.createLinearGradient(8, 0, 8, 16); cross2.addColorStop(0, "rgba(255,255,255,0)"); cross2.addColorStop(0.5, "rgba(255,255,255,0.7)"); cross2.addColorStop(1, "rgba(255,255,255,0)");
  sx.fillStyle = cross2; sx.fillRect(7.6, 0, 0.8, 16);
  const bea = canvas(14 * dpr, 14 * dpr), bcx = bea.getContext("2d"); bcx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = bcx.createRadialGradient(7, 7, 0, 7, 7, 7); bg.addColorStop(0, "rgba(255,255,255,0.95)"); bg.addColorStop(0.25, "rgba(255,90,120,0.85)"); bg.addColorStop(1, "rgba(255,40,90,0)");
  bcx.fillStyle = bg; bcx.fillRect(0, 0, 14, 14);
  // a shooting star: a thin streak, bright at its head (the right end) and gone at its tail
  const stl = 56, streak = canvas(stl * dpr, 4 * dpr), stx = streak.getContext("2d"); stx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const stg = stx.createLinearGradient(0, 0, stl, 0);
  stg.addColorStop(0, "rgba(160,220,255,0)"); stg.addColorStop(0.7, "rgba(200,235,255,0.55)"); stg.addColorStop(1, "rgba(255,255,255,1)");
  stx.fillStyle = stg; stx.beginPath(); stx.moveTo(0, 2); stx.lineTo(stl, 0.9); stx.lineTo(stl, 3.1); stx.closePath(); stx.fill();
  return { core: { cv: core, size: cs }, beam: { cv: beam, len: L, w: bw }, star: { cv: star }, beacon: { cv: bea }, streak: { cv: streak, len: stl } };
}

/* What moves, every frame, at the top graphics level. S: the stage's size and
   wheel (W, H, hz, wx, wy, wR), the clock (tSec, beatF, beatPhase, pulse,
   downbeat), the mode (fever, mega), `calm` (a fast tempo: the brightening
   on the beat is halved and the shock-ring keeps to the downbeat — nothing
   here may flash more than about three times a second), the world (its stars
   and beacons) and the sprites from stageSprites. */
export function drawStageFx(ctx, S) {
  const { W, H, hz, wx, wy, wR, tSec, beatF, beatPhase, pulse, downbeat, fever, mega, calm, spr, world } = S;
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
  if (world) {
    // cars in the sky: lights crossing the city on three lanes, each in its own time and direction
    for (let i = 0; i < 3; i++) {
      const dir = i % 2 ? -1 : 1, speed = 11 + i * 7, span = W + 80, u = ((tSec * speed + i * 137) % span + span) % span;
      const x = dir > 0 ? u - 40 : W + 40 - u, y = hz * (0.5 + i * 0.07) + Math.sin(tSec * 0.4 + i) * 2;
      const c = i === 1 ? "120,235,255" : "255,120,225";
      ctx.globalAlpha = 0.9; ctx.fillStyle = `rgba(${c},1)`; ctx.fillRect(x - 1, y - 0.8, 2.4, 1.6);
      ctx.globalAlpha = 0.35; ctx.fillRect(x - dir * 14, y - 0.5, 14 * dir + (dir < 0 ? 0 : 0), 1);
      ctx.globalAlpha = 0.12; ctx.fillRect(x - 3, y - 2.6, 6.4, 5.2);
    }
    // the brightest stars twinkle, each slowly (a rise and a fall over some four seconds) — a small soft cross laid over the baked one
    for (const s of world.stars) {
      const a = 0.5 + 0.5 * Math.sin(tSec * s.sp * 1.6 + s.ph);
      ctx.globalAlpha = 0.1 + 0.6 * a * a;
      ctx.drawImage(spr.star.cv, s.x - 8, s.y - 8, 16, 16);
    }
    // a shooting star crosses the upper sky about every seven seconds, drawing itself out and fading in under a second
    // (a sprite: the light-trail it replaces built a gradient on every frame it was in the sky)
    {
      const P = 7, D = 0.9, slot = Math.floor(tSec / P), q = (tSec - slot * P) / D;
      if (slot > 0 && q >= 0 && q < 1) {
        const h1 = Math.sin(slot * 12.9898) * 43758.5453, r1 = h1 - Math.floor(h1), h2 = Math.sin(slot * 78.233) * 12345.6789, r2 = h2 - Math.floor(h2);
        const dir = r1 < 0.5 ? 1 : -1, ang = dir > 0 ? 0.36 + r2 * 0.2 : Math.PI - 0.36 - r2 * 0.2, run = W * 0.34, e = q * (2 - q);
        const x = W * (dir > 0 ? 0.08 + r1 * 0.5 : 0.92 - (r1 - 0.5) * 1.0) + Math.cos(ang) * run * e, y = hz * (0.05 + r2 * 0.22) + Math.sin(ang) * run * e;
        ctx.globalAlpha = Math.sin(q * Math.PI) * 0.9;
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.drawImage(spr.streak.cv, -spr.streak.len, -2, spr.streak.len, 4); ctx.restore();
      }
    }
    // the masts' beacons pulse, once in about three seconds
    for (const b of world.beacons) {
      const a = 0.5 + 0.5 * Math.sin(tSec * 2.1 + b.ph);
      ctx.globalAlpha = 0.18 + 0.72 * a * a * a;
      ctx.drawImage(spr.beacon.cv, b.x - 7, b.y - 7, 14, 14);
    }
  }
  ctx.restore();
}

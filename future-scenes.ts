/* ── future-scenes.ts ──
   Nine hand-drawn futuristic places, shared by the PvP arena (arena-fx.tsx) and the Play Along stage
   (play-along-stage.ts). Each is one canvas routine that reads a palette and draws with a seeded
   sequence, never Math.random, so a place looks the same every time it is baked. */
/* ── ten places, drawn by hand (owner, 2026-10-10: "redraw the stages — futuristic, all different") ──
   One routine per stage, baked once into the backdrop with everything else, so none of it costs a
   frame. They read the stage's own palette (horizon, neon pair, face) and use a seeded sequence,
   never Math.random, so a stage looks the same every time it is baked. The two live layers (embers,
   stars, lanterns) still run on top where a stage has one. */
const sr = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export function drawFutureScene(ctx, SG, w, h, hz, lit, beacons) {
  const NP = SG.neon || ["255,43,214", "63,216,255"], HZ = SG.horizon, FC = SG.face || "16,22,44";
  const rgba = (c, a) => `rgba(${c},${a})`;
  const glow = (x, y, r, c, a) => { ctx.globalCompositeOperation = "lighter"; const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.globalCompositeOperation = "source-over"; };
  const id = SG.id;
  if (id === "magma") {                                   // Reactor Core
    // two cooling towers, a reactor stack in the middle with glowing rings, pipe runs along the base
    for (const [cx, tw, th] of [[w * 0.2, w * 0.13, hz * 0.62], [w * 0.8, w * 0.11, hz * 0.5]]) {
      ctx.fillStyle = rgba(FC, 0.78); ctx.beginPath(); ctx.moveTo(cx - tw / 2, hz); ctx.quadraticCurveTo(cx - tw * 0.28, hz - th * 0.5, cx - tw * 0.36, hz - th); ctx.lineTo(cx + tw * 0.36, hz - th); ctx.quadraticCurveTo(cx + tw * 0.28, hz - th * 0.5, cx + tw / 2, hz); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgba(NP[1], 0.5); ctx.fillRect(cx - tw * 0.36, hz - th, tw * 0.72, 2);
      glow(cx, hz - th, tw * 0.55, NP[1], 0.28);
      for (let k = 1; k < 4; k++) { ctx.fillStyle = rgba(HZ, 0.16); ctx.fillRect(cx - tw * (0.44 - k * 0.02), hz - th * k / 4.4, tw * (0.88 - k * 0.05), 1.4); }
    }
    const cx = w * 0.5, ch = hz * 0.74, cw = w * 0.075;
    ctx.fillStyle = rgba(FC, 0.85); ctx.fillRect(cx - cw / 2, hz - ch, cw, ch);
    const cg = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0); cg.addColorStop(0, rgba(NP[1], 0)); cg.addColorStop(0.5, rgba(NP[1], 0.8)); cg.addColorStop(1, rgba(NP[1], 0));
    ctx.fillStyle = cg; ctx.fillRect(cx - cw * 0.14, hz - ch, cw * 0.28, ch);
    for (let k = 0; k < 6; k++) { const yy = hz - ch * (0.12 + k * 0.15); ctx.strokeStyle = rgba(NP[k % 2], 0.65); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(cx, yy, cw * 0.78, cw * 0.16, 0, 0, 7); ctx.stroke(); }
    glow(cx, hz - ch * 0.5, w * 0.2, NP[1], 0.3); glow(cx, hz - ch, 26, "255,255,255", 0.5); beacons.push({ x: cx, y: hz - ch });
    ctx.fillStyle = rgba(FC, 0.9); ctx.fillRect(0, hz - 12, w, 12);
    for (let i = 0; i < 14; i++) { ctx.fillStyle = (i % 3 ? rgba(HZ, 0.35) : rgba(NP[0], 0.7)); ctx.fillRect(i / 14 * w + 6, hz - 9, 14, 3); }
    for (let i = 0; i < 8; i++) lit.push({ x: w * (0.08 + i * 0.12), w: 22, c: NP[1], a: 0.16 });
  } else if (id === "frost") {                            // Cryo Lab
    // a vaulted glass ceiling and a hall of cryo-pods in receding rows
    ctx.strokeStyle = rgba("190,240,255", 0.2); ctx.lineWidth = 1.4;
    for (let i = -5; i <= 5; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.02, hz * 0.2); ctx.quadraticCurveTo(w / 2 + i * w * 0.2, hz * 0.05, w / 2 + i * w * 0.34, hz); ctx.stroke(); }
    for (let r = 0; r < 4; r++) { ctx.beginPath(); ctx.ellipse(w / 2, hz * (0.55 + r * 0.12), w * (0.56 - r * 0.06), hz * 0.4, 0, Math.PI, 0); ctx.stroke(); }
    for (let row = 0; row < 3; row++) {
      const n = 9 - row * 2, sc = 1 - row * 0.28, py = hz - row * 3;
      for (let i = 0; i < n; i++) {
        const x = w * (0.04 + (i + 0.5) / n * 0.92), pw = w * 0.052 * sc, ph = hz * 0.55 * sc;
        ctx.fillStyle = rgba(FC, 0.8); ctx.fillRect(x - pw * 0.65, py - ph * 0.12, pw * 1.3, ph * 0.12);
        const g = ctx.createLinearGradient(0, py - ph, 0, py); g.addColorStop(0, rgba("220,250,255", 0.3 - row * 0.05)); g.addColorStop(1, rgba("90,190,255", 0.5 - row * 0.1));
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - pw / 2, py - ph * 0.12); ctx.lineTo(x - pw / 2, py - ph * 0.85); ctx.quadraticCurveTo(x, py - ph * 1.05, x + pw / 2, py - ph * 0.85); ctx.lineTo(x + pw / 2, py - ph * 0.12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = rgba("255,255,255", 0.4 - row * 0.08); ctx.fillRect(x - pw * 0.34, py - ph * 0.8, 2, ph * 0.55);
        if ((i + row) % 3 === 0) { ctx.fillStyle = rgba("255,255,255", 0.22); ctx.beginPath(); ctx.ellipse(x, py - ph * 0.5, pw * 0.16, ph * 0.22, 0, 0, 7); ctx.fill(); }
        ctx.fillStyle = rgba(NP[1], 0.8); ctx.fillRect(x - pw * 0.3, py - ph * 0.1, pw * 0.6, 2);
        if (row === 0) lit.push({ x, w: 14, c: "150,225,255", a: 0.16 });
      }
    }
  } else if (id === "ashfall") {                          // Fallen Megacity
    // broken towers with jagged tops, one fallen across the sky, a dead billboard, smoke
    for (let i = 0; i < 11; i++) {
      const bw = w * (0.05 + sr(i) * 0.05), bx = (i + sr(i + 20) * 0.6) / 11 * w, bh = hz * (0.28 + sr(i + 40) * 0.5);
      ctx.fillStyle = rgba(FC, 0.55 + sr(i + 7) * 0.3); ctx.beginPath(); ctx.moveTo(bx, hz); ctx.lineTo(bx, hz - bh);
      for (let k = 1; k <= 4; k++) ctx.lineTo(bx + bw * k / 4, hz - bh * (1 - (k % 2 ? 0.05 + sr(i * 7 + k) * 0.18 : 0.02)));
      ctx.lineTo(bx + bw, hz); ctx.closePath(); ctx.fill();
      ctx.fillStyle = rgba(NP[0], 0.14); for (let k = 0; k < 6; k++) if (sr(i * 13 + k) > 0.55) ctx.fillRect(bx + 3 + sr(i + k * 3) * (bw - 8), hz - bh * (0.15 + sr(i * 5 + k) * 0.7), 3, 3);
    }
    ctx.save(); ctx.translate(w * 0.62, hz * 0.18); ctx.rotate(0.6); ctx.fillStyle = rgba(FC, 0.8); ctx.fillRect(0, 0, w * 0.05, hz * 0.7); ctx.fillStyle = rgba(NP[0], 0.4); ctx.fillRect(0, 0, 2, hz * 0.7); ctx.restore();
    const bx = w * 0.3, by = hz * 0.3, bw2 = w * 0.17, bh2 = hz * 0.22;
    ctx.fillStyle = rgba("10,6,14", 0.8); ctx.fillRect(bx, by, bw2, bh2); ctx.strokeStyle = rgba(NP[1], 0.6); ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw2, bh2);
    for (let k = 0; k < 5; k++) { ctx.fillStyle = rgba(NP[0], 0.12 + (k % 2) * 0.12); ctx.fillRect(bx + 4, by + 5 + k * (bh2 / 5.5), bw2 * (0.3 + sr(k + 3) * 0.6), bh2 / 12); }
    glow(bx + bw2 / 2, by + bh2 / 2, w * 0.18, NP[0], 0.14); lit.push({ x: bx + bw2 / 2, w: 40, c: NP[0], a: 0.14 });
    for (let i = 0; i < 4; i++) { const sx = w * (0.15 + i * 0.22), g = ctx.createLinearGradient(0, hz * 0.3, 0, hz); g.addColorStop(0, rgba("60,40,50", 0)); g.addColorStop(1, rgba("60,40,50", 0.28)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx - 8, hz); ctx.quadraticCurveTo(sx + 30, hz * 0.6, sx + 10, hz * 0.28); ctx.lineTo(sx + 50, hz * 0.3); ctx.quadraticCurveTo(sx + 50, hz * 0.62, sx + 14, hz); ctx.closePath(); ctx.fill(); }
  } else if (id === "void") {                             // Orbital Station
    // a planet with an atmosphere rim, the station's window struts, solar arrays
    const px = w * 0.72, py = hz * 0.62, pr = hz * 0.78;
    const pg = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.1, px, py, pr); pg.addColorStop(0, "#5b6fd0"); pg.addColorStop(0.6, "#2c3a86"); pg.addColorStop(1, "#0b1030");
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, hz); ctx.clip(); ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, pr, 0, 7); ctx.fill();
    ctx.strokeStyle = rgba("140,200,255", 0.5); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(px, py, pr, Math.PI * 0.95, Math.PI * 1.6); ctx.stroke();
    ctx.fillStyle = rgba("255,255,255", 0.07); for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.ellipse(px, py + (k - 2.5) * pr * 0.22, pr * 0.95, pr * 0.05, 0, 0, 7); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = rgba(FC, 0.9);
    for (const sgn of [-1, 1]) { ctx.beginPath(); const ex = sgn < 0 ? 0 : w; ctx.moveTo(ex, 0); ctx.lineTo(ex - sgn * w * 0.2, 0); ctx.lineTo(ex - sgn * w * 0.06, hz); ctx.lineTo(ex, hz); ctx.closePath(); ctx.fill(); }
    ctx.fillRect(0, 0, w, hz * 0.07); ctx.fillStyle = rgba(NP[1], 0.5); ctx.fillRect(0, hz * 0.07, w, 1.6);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = rgba(NP[i % 2], 0.6); ctx.fillRect(w * (0.24 + i * 0.065), hz * 0.025, w * 0.03, 3); }
    ctx.fillStyle = rgba("20,26,60", 0.9); ctx.fillRect(w * 0.34, hz * 0.76, w * 0.3, hz * 0.04); for (let k = 0; k < 6; k++) { ctx.fillStyle = rgba("110,170,255", 0.5); ctx.fillRect(w * 0.345 + k * w * 0.049, hz * 0.765, w * 0.043, hz * 0.03); }
    glow(px - pr * 0.5, py - pr * 0.65, w * 0.14, "255,255,255", 0.12);
  } else if (id === "bloom") {                            // Bio-Dome Garden
    // a geodesic glass dome, giant glowing flora, floating spore lights
    ctx.strokeStyle = rgba("140,255,210", 0.2); ctx.lineWidth = 1.3;
    for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.012, hz); ctx.quadraticCurveTo(w / 2 + i * w * 0.2, -hz * 0.25, w / 2 + i * w * 0.095 + (i < 0 ? -1 : 1) * w * 0.4, hz); ctx.stroke(); }
    for (let r = 1; r <= 4; r++) { ctx.beginPath(); ctx.ellipse(w / 2, hz, w * 0.62, hz * 0.22 * r, 0, Math.PI, 0); ctx.stroke(); }
    for (let i = 0; i < 7; i++) {
      const x = (i + 0.5) / 7 * w, th = hz * (0.34 + sr(i) * 0.4), tw = w * (0.012 + sr(i + 5) * 0.012);
      ctx.fillStyle = rgba("6,40,30", 0.85); ctx.beginPath(); ctx.moveTo(x - tw, hz); ctx.quadraticCurveTo(x + sr(i + 2) * 20 - 10, hz - th * 0.5, x, hz - th); ctx.quadraticCurveTo(x + tw * 0.4, hz - th * 0.5, x + tw, hz); ctx.closePath(); ctx.fill();
      const cap = hz - th, cc = i % 2 ? NP[0] : NP[1], cr = w * (0.035 + sr(i + 9) * 0.03);
      ctx.fillStyle = rgba(cc, 0.55); ctx.beginPath(); ctx.ellipse(x, cap, cr, cr * 0.55, 0, Math.PI, 0); ctx.fill();
      glow(x, cap, cr * 2.3, cc, 0.25); lit.push({ x, w: 16, c: cc, a: 0.15 });
      for (let k = 0; k < 5; k++) { ctx.fillStyle = rgba("255,255,255", 0.5); ctx.fillRect(x + (k - 2) * cr * 0.3, cap - 1, 2, 2); }
    }
    for (let i = 0; i < 30; i++) glow(sr(i + 60) * w, sr(i + 90) * hz * 0.9, 5 + sr(i) * 6, i % 2 ? NP[0] : NP[1], 0.5);
  } else if (id === "gilt") {                              // Skyline Penthouse
    // far-below skyline through clouds, a huge moon, the gold glass balcony
    glow(w * 0.3, hz * 0.34, w * 0.28, "255,236,190", 0.28);
    ctx.fillStyle = rgba("255,244,214", 0.85); ctx.beginPath(); ctx.arc(w * 0.3, hz * 0.34, hz * 0.17, 0, 7); ctx.fill();
    ctx.fillStyle = rgba("200,170,110", 0.28); ctx.beginPath(); ctx.arc(w * 0.27, hz * 0.3, hz * 0.04, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(w * 0.33, hz * 0.4, hz * 0.025, 0, 7); ctx.fill();
    for (let i = 0; i < 26; i++) { const bx = i / 26 * w, bh = hz * (0.12 + sr(i) * 0.3); ctx.fillStyle = rgba(FC, 0.7); ctx.fillRect(bx, hz - bh * 0.6, w / 26 - 1, bh * 0.6); ctx.fillStyle = rgba(NP[0], 0.5); ctx.fillRect(bx, hz - bh * 0.6, w / 26 - 1, 1.4); for (let k = 0; k < 3; k++) if (sr(i * 3 + k) > 0.4) { ctx.fillStyle = rgba("255,214,140", 0.5); ctx.fillRect(bx + 2 + k * 3, hz - bh * 0.5 + sr(k + i) * 6, 1.6, 1.6); } }
    for (let c = 0; c < 4; c++) { const g = ctx.createLinearGradient(0, hz * (0.5 + c * 0.12), 0, hz * (0.66 + c * 0.12)); g.addColorStop(0, rgba("255,236,200", 0)); g.addColorStop(1, rgba("255,236,200", 0.1)); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(w * (0.2 + c * 0.25), hz * (0.62 + c * 0.1), w * 0.3, hz * 0.07, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = rgba("20,14,4", 0.85); ctx.fillRect(0, hz - hz * 0.14, w, hz * 0.14);
    ctx.fillStyle = rgba("255,200,90", 0.9); ctx.fillRect(0, hz - hz * 0.14, w, 2.4);
    for (let i = 0; i <= 14; i++) { const x = i / 14 * w; ctx.fillStyle = rgba("255,196,90", 0.75); ctx.fillRect(x - 1.6, hz - hz * 0.14, 3.2, hz * 0.14); glow(x, hz - hz * 0.14, 12, "255,200,90", 0.3); }
    for (let i = 0; i < 6; i++) lit.push({ x: w * (0.1 + i * 0.16), w: 22, c: "255,196,90", a: 0.14 });
  } else if (id === "tide") {                              // Deep-Sea Habitat
    // light shafts from the surface, a round-windowed habitat tube, tall kelp
    for (let i = 0; i < 6; i++) { const x = w * (0.08 + i * 0.17); const g = ctx.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, rgba("120,215,255", 0.2)); g.addColorStop(1, rgba("120,215,255", 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + w * 0.05, 0); ctx.lineTo(x + w * 0.12, hz); ctx.lineTo(x - w * 0.02, hz); ctx.closePath(); ctx.fill(); }
    const ty = hz * 0.5, th = hz * 0.34;
    ctx.fillStyle = rgba("6,26,46", 0.92); ctx.fillRect(0, ty, w, th); ctx.fillStyle = rgba("90,210,255", 0.4); ctx.fillRect(0, ty, w, 2); ctx.fillRect(0, ty + th - 2, w, 2);
    for (let i = 0; i < 9; i++) { const x = w * (0.06 + i * 0.11), r = th * 0.32; ctx.fillStyle = rgba("4,14,26", 1); ctx.beginPath(); ctx.arc(x, ty + th / 2, r + 3, 0, 7); ctx.fill(); const g = ctx.createRadialGradient(x, ty + th / 2, 1, x, ty + th / 2, r); g.addColorStop(0, rgba(i % 3 ? "150,230,255" : NP[1], 0.95)); g.addColorStop(1, rgba("40,130,200", 0.7)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, ty + th / 2, r, 0, 7); ctx.fill(); glow(x, ty + th / 2, r * 2.2, "120,215,255", 0.16); lit.push({ x, w: 16, c: "120,215,255", a: 0.14 }); }
    for (let i = 0; i < 12; i++) { const x = w * (i / 12 + 0.02), kh = hz * (0.3 + sr(i) * 0.35); ctx.strokeStyle = rgba("20,120,110", 0.7); ctx.lineWidth = 3 + sr(i + 4) * 2; ctx.beginPath(); ctx.moveTo(x, hz); ctx.bezierCurveTo(x + 14, hz - kh * 0.35, x - 14, hz - kh * 0.7, x + 6, hz - kh); ctx.stroke(); }
    for (let i = 0; i < 24; i++) { ctx.strokeStyle = rgba("200,240,255", 0.3); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sr(i + 30) * w, sr(i + 50) * hz, 1.5 + sr(i) * 3, 0, 7); ctx.stroke(); }
  } else if (id === "requiem") {                           // Data Cathedral
    // a nave of arches built from light, columns of scrolling data, a circuit rose window
    const rx = w / 2, ry = hz * 0.34, rr = hz * 0.26;
    for (let k = 0; k < 4; k++) { ctx.strokeStyle = rgba(k % 2 ? NP[1] : NP[0], 0.7 - k * 0.12); ctx.lineWidth = 2.4 - k * 0.4; ctx.beginPath(); ctx.arc(rx, ry, rr * (1 - k * 0.2), 0, 7); ctx.stroke(); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; ctx.strokeStyle = rgba(NP[1], 0.4); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(rx + Math.cos(a) * rr * 0.2, ry + Math.sin(a) * rr * 0.2); ctx.lineTo(rx + Math.cos(a) * rr, ry + Math.sin(a) * rr); ctx.stroke(); ctx.fillStyle = rgba("255,255,255", 0.7); ctx.fillRect(rx + Math.cos(a) * rr - 1.5, ry + Math.sin(a) * rr - 1.5, 3, 3); }
    glow(rx, ry, rr * 1.9, NP[0], 0.3);
    for (let n = 0; n < 4; n++) { const sc = 1 - n * 0.2; ctx.strokeStyle = rgba(NP[n % 2], 0.5 - n * 0.08); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * (0.5 - 0.46 * sc), hz); ctx.lineTo(w * (0.5 - 0.46 * sc), hz * (0.5 - 0.1 * n)); ctx.quadraticCurveTo(w * 0.5, hz * (-0.12 + n * 0.1), w * (0.5 + 0.46 * sc), hz * (0.5 - 0.1 * n)); ctx.lineTo(w * (0.5 + 0.46 * sc), hz); ctx.stroke(); }
    for (const sgn of [-1, 1]) for (let c = 0; c < 3; c++) { const x = w * (0.5 + sgn * (0.2 + c * 0.1)), cw = w * 0.018; ctx.fillStyle = rgba(FC, 0.85); ctx.fillRect(x - cw / 2, hz * (0.34 + c * 0.06), cw, hz * (0.66 - c * 0.06)); for (let k = 0; k < 14; k++) { ctx.fillStyle = rgba(sr(c * 20 + k + sgn) > 0.5 ? NP[0] : NP[1], 0.8); ctx.fillRect(x - cw * 0.35, hz * (0.4 + c * 0.06) + k * hz * 0.036, cw * 0.7, 2.4); } lit.push({ x, w: 12, c: NP[sgn > 0 ? 0 : 1], a: 0.16 }); }
  } else if (id === "dojo") {                              // Neon Dojo Alley
    // two walls closing in, tall neon signs and banners, a lit doorway, rain
    for (const sgn of [-1, 1]) {
      const ex = sgn < 0 ? 0 : w; ctx.fillStyle = rgba(FC, 0.92); ctx.beginPath(); ctx.moveTo(ex, 0); ctx.lineTo(ex - sgn * w * 0.26, hz * 0.18); ctx.lineTo(ex - sgn * w * 0.26, hz); ctx.lineTo(ex, hz); ctx.closePath(); ctx.fill();
      for (let k = 0; k < 4; k++) { const sy = hz * (0.26 + k * 0.17), sw = w * 0.05, sx = ex - sgn * (w * 0.06 + (k % 2) * w * 0.06) - (sgn > 0 ? 0 : -sw * 0.0); const c = NP[(k + (sgn > 0 ? 1 : 0)) % 2]; ctx.fillStyle = rgba(c, 0.85); ctx.fillRect(Math.min(sx, sx + sgn * 0) - (sgn > 0 ? sw : 0), sy, sw, hz * 0.12); glow(sx - (sgn > 0 ? sw / 2 : -sw / 2), sy + hz * 0.06, sw * 2.4, c, 0.3); ctx.fillStyle = rgba("255,255,255", 0.6); ctx.fillRect(Math.min(sx, sx) - (sgn > 0 ? sw : 0) + sw * 0.4, sy + hz * 0.02, 2, hz * 0.08); }
    }
    const dx = w * 0.5, dw = w * 0.14, dh = hz * 0.44;
    ctx.fillStyle = rgba("255,200,120", 0.12); ctx.fillRect(dx - dw / 2, hz - dh, dw, dh); ctx.strokeStyle = rgba(NP[0], 0.9); ctx.lineWidth = 2.4; ctx.strokeRect(dx - dw / 2, hz - dh, dw, dh);
    ctx.beginPath(); ctx.moveTo(dx - dw * 0.7, hz - dh); ctx.lineTo(dx, hz - dh - hz * 0.1); ctx.lineTo(dx + dw * 0.7, hz - dh); ctx.stroke();
    glow(dx, hz - dh * 0.5, w * 0.2, "255,200,120", 0.3); lit.push({ x: dx, w: 40, c: "255,200,120", a: 0.2 });
    ctx.strokeStyle = rgba("200,225,255", 0.14); ctx.lineWidth = 1; for (let i = 0; i < 70; i++) { const x = sr(i) * w, y = sr(i + 70) * hz; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 12); ctx.stroke(); }
  }
}

/* ── the backdrop, painted once ──────────────────────────────────────────
   Everything here is fixed for a given arena at a given size: the sky, the
   skyline, the overhead spots, the perspective floor. Redrawing it every
   frame cost more main-thread time than both fighters put together, so it
   goes into an offscreen canvas that the frame loop simply blits. The pieces
   that DO move are collected as they are laid out — flickering windows are
   baked at their dimmest and get their pulse added back live, beacons are
   recorded but not drawn — and `lit`, the list of bright things whose
   reflections streak down the wet road, is gathered here too. */

/* the palette each place is drawn with (the same ids the arena's stages use) */
export const FUTURE_PAL = {
  magma:   { id: "magma",   en: "Reactor Core",      sky: ["#4a1c10", "#2a0e0a", "#120505"], horizon: "255,120,50",  neon: ["255,47,94", "255,170,60"],  face: "36,16,14" },
  frost:   { id: "frost",   en: "Cryo Lab",          sky: ["#173a52", "#0e2436", "#050f18"], horizon: "150,225,255", neon: ["47,123,255", "77,240,255"], face: "10,32,52" },
  ashfall: { id: "ashfall", en: "Fallen Megacity",   sky: ["#3d0a20", "#22061a", "#0c0210"], horizon: "255,90,150",  neon: ["255,210,63", "255,63,143"], face: "34,8,26" },
  void:    { id: "void",    en: "Orbital Station",   sky: ["#2a1b4a", "#170f2e", "#06040f"], horizon: "170,130,255", neon: ["63,240,208", "176,125,255"], face: "24,14,58" },
  bloom:   { id: "bloom",   en: "Bio-Dome Garden",   sky: ["#0a2e26", "#06201c", "#020c0a"], horizon: "90,255,190",  neon: ["63,255,178", "255,214,102"], face: "8,34,28" },
  gilt:    { id: "gilt",    en: "Skyline Penthouse", sky: ["#2e2208", "#1c1405", "#0a0702"], horizon: "255,200,90",  neon: ["255,196,63", "186,125,255"], face: "36,26,8" },
  tide:    { id: "tide",    en: "Deep-Sea Habitat",  sky: ["#031a2e", "#021221", "#00070f"], horizon: "70,190,255",  neon: ["46,190,255", "126,102,255"], face: "4,22,40" },
  requiem: { id: "requiem", en: "Data Cathedral",    sky: ["#2a0714", "#18040e", "#080105"], horizon: "255,120,140", neon: ["255,80,110", "236,236,255"], face: "30,6,16" },
  dojo:    { id: "dojo",    en: "Neon Dojo Alley",   sky: ["#2f2418", "#1c1610", "#0a0806"], horizon: "255,190,120", neon: ["255,210,63", "255,90,120"], face: "38,26,16" },
};

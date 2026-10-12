// Re-implements adventure-farm.tsx's rules (same constants) to measure what a careful and a lazy player can reach in 150 s.
const TYPES = { plants: [["algae",12,6,.7],["greens",16,9,.8],["potato",24,16,1],["wheat",30,22,1.1],["rice",36,30,1.2]], herd: [["crickets",12,6,.7],["fish",18,12,.9],["chicken",24,18,1],["pig",32,28,1.2],["cow",40,40,1.3]] };
function run(kind, pol, ymulLvl = 0, techBuy = true) {
  const types = TYPES[kind]; let t = 0, made = 0, spent = 0; const res = [80, 80, 80], cd = [0, 0, 0], tech = [false, false, false];
  const cells = Array.from({ length: 6 }, () => ({ ty: null, p: 0, sick: 0 })); let sickT = 8; const dt = 0.1, ym = 1 + 0.08 * ymulLvl; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  while (t < 150) {
    t += dt; for (let i = 0; i < 3; i++) cd[i] = Math.max(0, cd[i] - dt);
    const gm = tech[0] ? 1.25 : 1, um = tech[2] ? 0.7 : 1; let growing = 0; for (const c of cells) if (c.ty && c.p < 100 && !c.sick) growing += c.ty[3];
    const drain = [1.1, .9, .7]; for (let i = 0; i < 3; i++) res[i] = Math.max(0, res[i] - drain[i] * growing * um * dt);
    const f = Math.min(1, res[0] / 25, res[1] / 25, res[2] / 25);
    for (const c of cells) if (c.ty && c.p < 100 && !c.sick) c.p = Math.min(100, c.p + 100 / c.ty[1] * gm * f * dt);
    sickT -= dt; if (sickT <= 0) { sickT = (kind === "herd" && tech[1] ? 24 : 13) - Math.min(4, t / 40); const live = cells.filter(c => c.ty && c.p < 100 && !c.sick); if (live.length) live[Math.floor(rnd() * live.length)].sick = 8; }
    for (const c of cells) if (c.sick > 0) { c.sick -= dt; if (c.sick <= 0) { c.sick = 0; c.ty = null; c.p = 0; } }
    // policy: reaction delay (s) and refill threshold
    const act = (Math.round(t / dt)) % Math.round(pol.every / dt) === 0; if (!act) continue;
    for (const c of cells) { if (c.sick > 0 && c.sick < 8 - pol.react) { c.sick = 0; } }
    for (const c of cells) if (c.ty && c.p >= 100) { made += c.ty[2] * ym * (tech[1] && kind === "plants" ? 1.3 : 1); c.ty = null; c.p = 0; }
    for (const c of cells) if (!c.ty) c.ty = types[pol.pick];
    for (let i = 0; i < 3; i++) if (res[i] < pol.thr && cd[i] <= 0) { res[i] = Math.min(100, res[i] + 38); cd[i] = 1.1; }
    if (techBuy) for (let i = 0; i < 3; i++) { const cost = [25, 40, 60][i]; if (!tech[i] && made - spent >= cost) { spent += cost; tech[i] = true; } }
  }
  return Math.round(made);
}
for (const kind of ["plants", "herd"]) for (const [name, pol] of [["careful", { every: 0.5, react: 1, thr: 45, pick: 2 }], ["careful, fast crops", { every: 0.5, react: 1, thr: 45, pick: 1 }], ["careful, slow crops", { every: 0.5, react: 1, thr: 45, pick: 4 }], ["lazy", { every: 3, react: 5, thr: 15, pick: 2 }], ["very lazy", { every: 6, react: 7, thr: 10, pick: 2 }]]) console.log(kind.padEnd(7), name.padEnd(20), "made in 150 s:", run(kind, pol), "| with farm lvl 5:", run(kind, pol, 5));

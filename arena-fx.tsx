/* ── arena-fx.tsx ──
   Sound and picture for the PvP arena, and nowhere else in the app.

   AUDIO is generated, not loaded. A battle loop as an mp3 would be a megabyte
   of payload on a PWA that already inlines its whole bundle, and it would be
   somebody else's music. This is six instruments — kick, snare, hat, bass,
   arp, pad — scheduled by a look-ahead clock over a four-bar minor loop, and
   it costs nothing to ship. It rides the app's existing audio bus, so the
   sound toggle the player already has silences it too, and it steps up a gear
   when either fighter drops under a third of their health.

   PICTURE is a canvas over the stage: bolts that travel between the two
   robots, impact sparks with real velocity and drag, shockwave rings, a
   perspective floor grid, and a screen flash. The robots themselves stay on
   the existing avatar rig — that rig is a genuine yaw-parametric projection
   (the head and body are re-projected at every angle, not sprite-swapped), so
   during a strike the attacker really does turn as it lunges. Rebuilding
   twenty chassis as polygon meshes would have thrown away the five-pass
   shading that makes them look like machined metal, and looked worse.

   Everything here checks prefers-reduced-motion and degrades to a static
   scene rather than switching itself off. ── */

import { useRef, useEffect, useCallback } from "react";
import { audioBus, getSfxMuted } from "./music-engine";

const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
const reduced = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

/* ══════════════════════ audio ══════════════════════ */

let _noiseBuf = null;
function noise(ac) {
  if (_noiseBuf && _noiseBuf.sampleRate === ac.sampleRate) return _noiseBuf;
  const n = Math.floor(ac.sampleRate * 1.2);
  const b = ac.createBuffer(1, n, ac.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  _noiseBuf = b;
  return b;
}

/* One bar of sixteenths. The second row of each pattern is the "pushed" mix
   that comes in when somebody is nearly down — same groove, more of it. */
const P = {
  kick:  [[0, 6, 8, 14], [0, 3, 6, 8, 11, 14]],
  snare: [[4, 12], [4, 12, 15]],
  hat:   [[0, 2, 4, 6, 8, 10, 12, 14], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]],
  bass:  [[0, 3, 6, 8, 11, 14], [0, 2, 3, 6, 8, 10, 11, 14]],
  arp:   [[0, 2, 4, 6, 8, 10, 12, 14], [0, 2, 4, 6, 8, 10, 12, 14]],
};

/* ══════════════════════ the arenas ══════════════════════
   Five places to fight in, each with its own light, its own floor and its own
   music. One arena was fine when the mode was new; eight rounds in the same
   blue room is the point at which a fighting game starts to feel small.

   A stage is a palette plus a backdrop routine plus a track. The canvas reads
   the palette for its floor, spots and horizon, so a new stage is a table
   entry rather than a new renderer — and the fighters, the effects and the
   pet are lit by whatever the stage says without any of them knowing.

   The music is four chords and a drum pattern per stage. They all avoid
   resolving, which is what a fight wants, but they sit in different keys at
   different tempos so the arenas do not blur into one loop. */
export const STAGES = [
  {
    id: "grid", th: "กริดไซเบอร์", en: "Cyber Grid", zh: "赛博网格",
    sky: ["#20304e", "#131b30", "#080b16"],
    grid: "rgba(122,170,255,.20)", horizon: "120,175,255",
    spots: [[0.24, "126,196,255"], [0.76, "255,150,110"]],
    mote: "170,210,255", back: "city",
    bpm: 150, chords: [
      { bass: 38, arp: [62, 65, 69, 74] }, { bass: 34, arp: [58, 62, 65, 70] },
      { bass: 41, arp: [65, 69, 72, 77] }, { bass: 36, arp: [60, 64, 67, 72] },
    ],
  },
  {
    id: "magma", th: "หลุมลาวา", en: "Magma Pit", zh: "熔岩坑",
    sky: ["#4a1c10", "#2a0e0a", "#120505"],
    grid: "rgba(255,140,70,.22)", horizon: "255,120,50",
    spots: [[0.22, "255,170,90"], [0.78, "255,90,40"]],
    mote: "255,180,120", back: "embers",
    bpm: 162, chords: [
      { bass: 33, arp: [57, 60, 64, 69] }, { bass: 40, arp: [64, 67, 71, 76] },
      { bass: 35, arp: [59, 62, 66, 71] }, { bass: 38, arp: [62, 66, 69, 74] },
    ],
  },
  {
    id: "frost", th: "ลานน้ำแข็ง", en: "Frost Vault", zh: "霜之殿",
    sky: ["#173a52", "#0e2436", "#050f18"],
    grid: "rgba(150,225,255,.26)", horizon: "150,225,255",
    spots: [[0.24, "180,240,255"], [0.76, "120,190,255"]],
    mote: "200,240,255", back: "shards",
    bpm: 142, chords: [
      { bass: 40, arp: [64, 68, 71, 76] }, { bass: 35, arp: [59, 63, 66, 71] },
      { bass: 43, arp: [67, 71, 74, 79] }, { bass: 38, arp: [62, 66, 69, 74] },
    ],
  },
  {
    id: "void", th: "ห้วงอวกาศ", en: "Deep Void", zh: "深空",
    sky: ["#2a1b4a", "#170f2e", "#06040f"],
    grid: "rgba(180,140,255,.20)", horizon: "170,130,255",
    spots: [[0.24, "190,150,255"], [0.76, "120,220,255"]],
    mote: "215,190,255", back: "stars",
    bpm: 134, chords: [
      { bass: 32, arp: [56, 59, 63, 68] }, { bass: 37, arp: [61, 64, 68, 73] },
      { bass: 39, arp: [63, 67, 70, 75] }, { bass: 34, arp: [58, 61, 65, 70] },
    ],
  },
  {
    id: "dojo", th: "โดโจกลางคืน", en: "Night Dojo", zh: "夜之道场",
    sky: ["#2f2418", "#1c1610", "#0a0806"],
    grid: "rgba(255,205,140,.18)", horizon: "255,190,120",
    spots: [[0.24, "255,215,160"], [0.76, "255,170,110"]],
    mote: "255,220,170", back: "lanterns",
    bpm: 128, chords: [
      { bass: 36, arp: [60, 63, 67, 72] }, { bass: 41, arp: [65, 68, 72, 77] },
      { bass: 34, arp: [58, 61, 65, 70] }, { bass: 39, arp: [63, 66, 70, 75] },
    ],
  },
];
export const stageById = (id) => STAGES.find(s => s.id === id) || STAGES[0];
/** A stage for this fight. Seeded so a rematch in the same arena stays there. */
export const pickStage = (seed) => STAGES[Math.abs(Number(seed) || Math.floor(Math.random() * 9999)) % STAGES.length];

export function createArenaAudio(stage) {
  let ST = stage || STAGES[0];
  let timer = null, step = 0, nextTime = 0, bpm = ST.bpm, gear = 0, live = false;
  let master = null, ac = null;
  const SPB = () => 60 / bpm / 4;               // seconds per sixteenth

  function ensure() {
    const { ac: a, bus } = audioBus();
    ac = a;
    if (!master || master.context !== ac) {
      master = ac.createGain();
      master.gain.value = 0.0001;
      master.connect(bus);
    }
    return ac;
  }

  const env = (g, t, peak, atk, dec) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec);
  };

  function kick(t) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    env(g, t, 0.5, 0.004, 0.16);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.22);
  }
  function snare(t) {
    const s = ac.createBufferSource(); s.buffer = noise(ac);
    const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1400;
    const g = ac.createGain(); env(g, t, 0.22, 0.003, 0.12);
    s.connect(hp); hp.connect(g); g.connect(master); s.start(t); s.stop(t + 0.2);
    const o = ac.createOscillator(), g2 = ac.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(190, t);
    env(g2, t, 0.14, 0.003, 0.07);
    o.connect(g2); g2.connect(master); o.start(t); o.stop(t + 0.12);
  }
  function hat(t, open) {
    const s = ac.createBufferSource(); s.buffer = noise(ac);
    const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 7200;
    const g = ac.createGain(); env(g, t, 0.07, 0.002, open ? 0.1 : 0.03);
    s.connect(hp); hp.connect(g); g.connect(master); s.start(t); s.stop(t + 0.16);
  }
  function bass(t, midi) {
    const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
    o.type = "sawtooth"; o.frequency.value = mf(midi);
    lp.type = "lowpass"; lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(240, t + 0.18);
    env(g, t, 0.3, 0.006, 0.16);
    o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + 0.26);
  }
  function pluck(t, midi) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "triangle"; o.frequency.value = mf(midi);
    env(g, t, 0.11, 0.004, 0.11);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.18);
  }
  function pad(t, midi, dur) {
    for (const d of [-5, 5]) {
      const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
      o.type = "sawtooth"; o.frequency.value = mf(midi); o.detune.value = d;
      lp.type = "lowpass"; lp.frequency.value = 1500;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.035, t + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.1);
    }
  }

  function schedule() {
    if (!live) return;
    const horizon = ac.currentTime + 0.14;
    while (nextTime < horizon) {
      const s = step % 16, bar = Math.floor(step / 16) % 4, ch = ST.chords[bar];
      if (P.kick[gear].includes(s)) kick(nextTime);
      if (P.snare[gear].includes(s)) snare(nextTime);
      if (P.hat[gear].includes(s)) hat(nextTime, s % 8 === 6);
      if (P.bass[gear].includes(s)) bass(nextTime, s === 11 ? ch.bass + 12 : s === 6 || s === 14 ? ch.bass + 7 : ch.bass);
      if (P.arp[gear].includes(s)) pluck(nextTime, ch.arp[(s / 2) % ch.arp.length]);
      if (s === 0) pad(nextTime, ch.arp[0] - 12, SPB() * 16);
      nextTime += SPB();
      step++;
    }
    timer = setTimeout(schedule, 25);
  }

  return {
    start() {
      if (live) return;
      try {
        ensure();
        if (getSfxMuted()) return;
        live = true; step = 0; gear = 0; bpm = ST.bpm;
        nextTime = ac.currentTime + 0.08;
        master.gain.cancelScheduledValues(ac.currentTime);
        master.gain.setValueAtTime(0.0001, ac.currentTime);
        master.gain.exponentialRampToValueAtTime(0.6, ac.currentTime + 1.2);
        schedule();
      } catch (e) { live = false; }
    },
    /** Move to another arena's track. Takes effect on the next bar. */
    setStage(next) { if (next) { ST = next; bpm = gear ? Math.round(ST.bpm * 1.09) : ST.bpm; } },
    /** 0 = normal, 1 = someone is nearly down and the mix leans in */
    setGear(g) {
      const n = g ? 1 : 0;
      if (n === gear) return;
      gear = n; bpm = n ? Math.round(ST.bpm * 1.09) : ST.bpm;
    },
    stop() {
      live = false;
      if (timer) { clearTimeout(timer); timer = null; }
      try {
        if (master && ac) {
          master.gain.cancelScheduledValues(ac.currentTime);
          master.gain.setValueAtTime(master.gain.value, ac.currentTime);
          master.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.5);
        }
      } catch (e) {}
    },
    /** One-shots. They go to the bus directly so they cut through the loop. */
    sfx(kind) {
      try {
        if (getSfxMuted()) return;
        const { ac: a, bus } = audioBus(), t = a.currentTime;
        const tone = (type, f0, f1, peak, dur, dest) => {
          const o = a.createOscillator(), g = a.createGain();
          o.type = type; o.frequency.setValueAtTime(f0, t);
          if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g); g.connect(dest || bus); o.start(t); o.stop(t + dur + 0.05);
        };
        const hiss = (hz, peak, dur, type = "highpass") => {
          const s = a.createBufferSource(); s.buffer = noise(a);
          const f = a.createBiquadFilter(); f.type = type; f.frequency.value = hz;
          const g = a.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.05);
        };
        if (kind === "hit")       { hiss(900, 0.3, 0.16, "bandpass"); tone("sine", 180, 55, 0.34, 0.18); }
        else if (kind === "crit") { hiss(2200, 0.3, 0.26, "bandpass"); tone("square", 900, 180, 0.2, 0.3); tone("sine", 150, 45, 0.4, 0.34); }
        else if (kind === "block"){ tone("square", 1500, 900, 0.16, 0.14); hiss(3000, 0.16, 0.1, "bandpass"); }
        else if (kind === "miss") { hiss(1600, 0.14, 0.2, "bandpass"); }
        else if (kind === "heal") { [0, .07, .14].forEach((d, i) => setTimeout(() => tone("sine", mf(72 + i * 4), mf(72 + i * 4), 0.18, 0.3), d * 1000)); }
        else if (kind === "ult")  {
          const o = a.createOscillator(), g = a.createGain();
          o.type = "sawtooth"; o.frequency.setValueAtTime(90, t);
          o.frequency.exponentialRampToValueAtTime(1600, t + 0.55);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.22, t + 0.5);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
          o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.7);
          setTimeout(() => { hiss(400, 0.45, 0.6, "lowpass"); tone("sine", 120, 35, 0.5, 0.7); }, 540);
        }
        else if (kind === "shot")   { tone("square", 1500, 320, 0.18, 0.14); hiss(2600, 0.12, 0.09, "bandpass"); }
        else if (kind === "laser")  { tone("sawtooth", 760, 700, 0.13, 0.42); tone("square", 1560, 1400, 0.07, 0.4); hiss(3200, 0.09, 0.4, "bandpass"); }
        else if (kind === "kick")   { tone("sine", 220, 48, 0.42, 0.24); hiss(600, 0.28, 0.14, "bandpass"); }
        else if (kind === "lob")    { tone("sine", 300, 900, 0.08, 0.4); }
        else if (kind === "boom")   {
          hiss(240, 0.6, 0.85, "lowpass"); tone("sine", 160, 28, 0.55, 0.8);
          setTimeout(() => hiss(700, 0.2, 0.7, "bandpass"), 90);
        }
        else if (kind === "charge") { tone("triangle", mf(76), mf(88), 0.16, 0.3); }
        else if (kind === "win")  { [69, 73, 76, 81].forEach((m, i) => setTimeout(() => { tone("triangle", mf(m), mf(m), 0.2, 0.42); tone("sine", mf(m - 12), mf(m - 12), 0.12, 0.5); }, i * 110)); }
        else if (kind === "lose") { [69, 66, 62, 57].forEach((m, i) => setTimeout(() => tone("triangle", mf(m), mf(m), 0.17, 0.4), i * 150)); }
        else if (kind === "bell") { tone("sine", mf(84), mf(84), 0.14, 0.5); }
      } catch (e) {}
    },
  };
}

/* ══════════════════════ picture ══════════════════════ */

/** Imperative canvas over the arena. Held by ref so a hit can fire an effect
    without a React render — sixty frames of state updates would be sixty
    reconciles of two full avatar SVGs. */
export function useArenaFx(stage) {
  const canvasRef = useRef(null);
  const stateRef = useRef(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const soft = reduced();
    const S = {
      parts: [], beams: [], rings: [], lasers: [], lobs: [], balls: [], smoke: [], flares: [],
      /* debris is chunks with mass that bounce off the floor; embers are the
         slow orange sparks that hang in the air after the blast has gone; a
         scorch is the mark it leaves behind; a shock is the pressure ring that
         travels faster than any of them */
      debris: [], embers: [], scorch: [], shock: [],
      /* melee: a swipe is the arc the limb travels, a star is the hard spiked
         flash at the moment of contact, and dust is what a kick kicks up */
      swipes: [], stars: [], dust: [],
      // radial speed lines — the single cheapest thing that says "this hit hard"
      lines: [],
      // where the two fighters actually are, as fractions of the stage width —
      // once they can walk, a bolt fired from a fixed 24% leaves from thin air
      pos: { me: 0.24, op: 0.76 }, air: { me: 0, op: 0 },
      flash: null, t: 0, raf: 0, w: 0, h: 0, dpr: 1, motes: [], stage: stage || STAGES[0],
    };
    stateRef.current = S;
    const ctx = cv.getContext("2d");

    const fit = () => {
      const r = cv.getBoundingClientRect();
      S.dpr = Math.min(2, window.devicePixelRatio || 1);
      S.w = Math.max(1, r.width); S.h = Math.max(1, r.height);
      cv.width = Math.round(S.w * S.dpr); cv.height = Math.round(S.h * S.dpr);
      ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      // ambient dust, so the arena has air in it even between hits
      S.motes = Array.from({ length: soft ? 0 : 22 }, () => ({
        x: Math.random() * S.w, y: Math.random() * S.h,
        r: 0.6 + Math.random() * 1.5, vy: -(4 + Math.random() * 12), a: 0.1 + Math.random() * 0.25,
      }));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(cv);

    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      S.t += dt;
      ctx.clearRect(0, 0, S.w, S.h);

      // ── floor: a perspective grid receding to a horizon behind the fighters
      const hz = S.h * 0.52;
      ctx.save();
      // a pool of light under each fighter, so they stand in the arena rather
      // than float over a wallpaper
      const SG = S.stage || STAGES[0];

      /* ── the backdrop ── what is BEHIND the horizon. One routine per stage,
         drawn before the floor so the fighters and the grid sit in front of
         it. Cheap shapes on purpose: this runs every frame on a phone. */
      ctx.save();
      if (SG.back === "city") {
        // a skyline of lit slabs receding into haze
        ctx.globalAlpha = .5;
        for (let i = 0; i < 14; i++) {
          const bw = S.w * (0.04 + ((i * 37) % 11) / 130);
          const bx = (i / 14) * S.w + ((i * 53) % 17) - 8;
          const bh = hz * (0.22 + ((i * 71) % 13) / 22);
          ctx.fillStyle = "rgba(30,48,86,.9)";
          ctx.fillRect(bx, hz - bh, bw, bh);
          ctx.fillStyle = `rgba(${SG.horizon},.5)`;
          for (let w = 0; w < 5; w++) {
            const wy = hz - bh + 6 + w * (bh / 6);
            if (wy < hz - 3 && (i + w) % 3) ctx.fillRect(bx + 3, wy, bw - 6, 1.6);
          }
        }
      } else if (SG.back === "embers") {
        // a lava seam along the horizon, breathing
        const puls = 0.6 + 0.4 * Math.sin(S.t * 1.7);
        const g = ctx.createLinearGradient(0, hz - 26, 0, hz + 10);
        g.addColorStop(0, "rgba(255,90,30,0)");
        g.addColorStop(0.6, `rgba(255,120,40,${0.32 * puls})`);
        g.addColorStop(1, "rgba(255,190,90,0)");
        ctx.fillStyle = g; ctx.fillRect(0, hz - 26, S.w, 36);
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < 7; i++) {
          const x = ((i * 137 + S.t * 12) % (S.w + 60)) - 30;
          ctx.fillStyle = `rgba(255,150,60,${.25 * puls})`;
          ctx.beginPath(); ctx.ellipse(x, hz - 4, 30, 6, 0, 0, 7); ctx.fill();
        }
        ctx.globalCompositeOperation = "source-over";
      } else if (SG.back === "shards") {
        // ice columns catching the light
        for (let i = 0; i < 9; i++) {
          const x = (i / 9) * S.w + ((i * 61) % 23);
          const h2 = hz * (0.3 + ((i * 47) % 15) / 26), w2 = 12 + ((i * 29) % 16);
          const g = ctx.createLinearGradient(x, hz - h2, x, hz);
          g.addColorStop(0, "rgba(190,240,255,.30)");
          g.addColorStop(1, "rgba(120,190,255,.05)");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(x, hz); ctx.lineTo(x + w2 / 2, hz - h2); ctx.lineTo(x + w2, hz); ctx.closePath(); ctx.fill();
        }
      } else if (SG.back === "stars") {
        // a star field with one slow nebula behind it
        const g = ctx.createRadialGradient(S.w * .68, hz * .5, 4, S.w * .68, hz * .5, S.w * .5);
        g.addColorStop(0, "rgba(150,110,255,.22)");
        g.addColorStop(1, "rgba(150,110,255,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, S.w, hz + 20);
        for (let i = 0; i < 60; i++) {
          const x = ((i * 149) % 997) / 997 * S.w, y = ((i * 233) % 811) / 811 * hz;
          const tw = 0.35 + 0.65 * Math.abs(Math.sin(S.t * 1.3 + i));
          ctx.fillStyle = `rgba(230,220,255,${0.5 * tw})`;
          ctx.fillRect(x, y, 1.6, 1.6);
        }
      } else if (SG.back === "lanterns") {
        // paper lanterns hanging in the dark, swinging a little
        for (let i = 0; i < 8; i++) {
          const x = (i + 0.5) / 8 * S.w + Math.sin(S.t * 0.7 + i) * 5;
          const y = hz * (0.22 + ((i * 53) % 9) / 30);
          const g = ctx.createRadialGradient(x, y, 1, x, y, 26);
          g.addColorStop(0, "rgba(255,205,130,.55)");
          g.addColorStop(1, "rgba(255,160,80,0)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 26, 0, 7); ctx.fill();
          ctx.fillStyle = "rgba(255,190,110,.9)";
          ctx.beginPath(); ctx.ellipse(x, y, 6, 8, 0, 0, 7); ctx.fill();
          ctx.strokeStyle = "rgba(255,200,140,.25)"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y - 8); ctx.stroke();
        }
      }
      ctx.restore();

      // two overhead spots, coloured by the stage, so the fighters are lit by
      // the arena rather than pasted onto it
      ctx.globalCompositeOperation = "lighter";
      for (const [fx, col] of SG.spots) {
        const g0 = ctx.createRadialGradient(S.w * fx, S.h * 0.9, 2, S.w * fx, S.h * 0.9, S.w * 0.26);
        g0.addColorStop(0, `rgba(${col},.30)`); g0.addColorStop(0.5, `rgba(${col},.10)`); g0.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g0; ctx.fillRect(0, hz - 20, S.w, S.h - hz + 20);
      }
      // a glow along the horizon line — the light the room is lit by
      const hg = ctx.createLinearGradient(0, hz - 34, 0, hz + 26);
      hg.addColorStop(0, `rgba(${SG.horizon},0)`); hg.addColorStop(0.55, `rgba(${SG.horizon},.22)`); hg.addColorStop(1, `rgba(${SG.horizon},0)`);
      ctx.fillStyle = hg; ctx.fillRect(0, hz - 34, S.w, 60);
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = SG.grid; ctx.lineWidth = 1;
      for (let i = 1; i <= 7; i++) {
        const p = i / 7, y = hz + (S.h - hz) * p * p;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S.w, y); ctx.stroke();
      }
      for (let i = -6; i <= 6; i++) {
        const x = S.w / 2 + i * (S.w / 9);
        ctx.beginPath(); ctx.moveTo(S.w / 2 + i * 8, hz); ctx.lineTo(x, S.h); ctx.stroke();
      }
      ctx.restore();

      // ── scorch marks: painted on the floor before anything else, so the
      //    fight leaves a record of where it has already gone off
      for (let i = S.scorch.length - 1; i >= 0; i--) {
        const k = S.scorch[i]; k.p += dt / k.dur;
        if (k.p >= 1) { S.scorch.splice(i, 1); continue; }
        const a2 = (1 - k.p) * 0.5;
        ctx.save();
        ctx.translate(k.x, k.y); ctx.scale(1, 0.3);
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, k.r);
        g.addColorStop(0, `rgba(28,20,16,${a2})`);
        g.addColorStop(0.6, `rgba(40,28,22,${a2 * 0.5})`);
        g.addColorStop(1, "rgba(40,28,22,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, k.r, 0, 7); ctx.fill();
        ctx.restore();
      }

      for (const m of S.motes) {
        m.y += m.vy * dt; if (m.y < 0) { m.y = S.h; m.x = Math.random() * S.w; }
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, 7); ctx.fillStyle = `rgba(${SG.mote},${m.a * 1.5})`; ctx.fill();
      }

      /* Everything from here to the smoke is LIGHT, so it composites additively:
         two beams crossing get brighter where they meet, a fireball blows out
         to white in its core, and sparks read as embers rather than as confetti.
         This one line is most of the difference between a particle system that
         looks drawn and one that looks lit. */
      ctx.globalCompositeOperation = "lighter";

      // ── bolts in flight
      for (let i = S.beams.length - 1; i >= 0; i--) {
        const b = S.beams[i]; b.p += dt / b.dur;
        if (b.p >= 1) { S.beams.splice(i, 1); continue; }
        const x = b.x0 + (b.x1 - b.x0) * b.p, y = b.y0 + (b.y1 - b.y0) * b.p;
        const tail = 96 * (b.x1 > b.x0 ? -1 : 1);
        // a soft halo under the streak, or the round vanishes against a pale floor
        const halo = ctx.createRadialGradient(x, y, 1, x, y, b.w * 4);
        halo.addColorStop(0, b.c + "cc"); halo.addColorStop(1, b.c + "00");
        ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y, b.w * 4, 0, 7); ctx.fill();
        const g = ctx.createLinearGradient(x + tail, y, x, y);
        g.addColorStop(0, b.c + "00"); g.addColorStop(1, b.c + "ff");
        ctx.strokeStyle = g; ctx.lineWidth = b.w * 1.7; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x + tail, y); ctx.lineTo(x, y); ctx.stroke();
        ctx.strokeStyle = "#ffffffdd"; ctx.lineWidth = b.w * 0.6;
        ctx.beginPath(); ctx.moveTo(x + tail * 0.55, y); ctx.lineTo(x, y); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, b.w * 1.15, 0, 7); ctx.fillStyle = "#fff"; ctx.fill();
        // a cross-flare on the round itself: bright things flare in a lens
        ctx.save(); ctx.globalAlpha = .7; ctx.strokeStyle = b.c; ctx.lineWidth = 1.6; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(x - b.w * 3, y); ctx.lineTo(x + b.w * 3, y);
        ctx.moveTo(x, y - b.w * 2); ctx.lineTo(x, y + b.w * 2); ctx.stroke(); ctx.restore();
      }

      // ── the swipe: the arc a fist or a foot travels through. A melee hit
      //    with no arc is just two figures standing near each other; the
      //    trail is what tells the eye something MOVED.
      for (let i = S.swipes.length - 1; i >= 0; i--) {
        const w = S.swipes[i]; w.p += dt / w.dur;
        if (w.p >= 1) { S.swipes.splice(i, 1); continue; }
        const e = 1 - Math.pow(1 - w.p, 2.4);        // fast out, trailing off
        const a2 = Math.pow(1 - w.p, 1.5);
        ctx.save(); ctx.lineCap = "round";
        // the arc is swept: head runs ahead, tail follows a fraction behind
        const head = e, tail = Math.max(0, e - 0.42);
        const pt = (t) => {
          const k = w.a0 + (w.a1 - w.a0) * t;
          return [w.x + Math.cos(k) * w.r, w.y + Math.sin(k) * w.r * w.sq];
        };
        for (const [lw, col, al] of [[w.w * 3.2, w.c, .28], [w.w * 1.5, w.c, .7], [w.w * .55, "#ffffff", 1]]) {
          ctx.globalAlpha = a2 * al; ctx.strokeStyle = col; ctx.lineWidth = lw;
          ctx.beginPath();
          for (let t = tail; t <= head + 0.001; t += 0.05) {
            const [px, py] = pt(Math.min(1, t));
            if (t === tail) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1; ctx.restore();
      }

      // ── the impact star: the hard spiked flash at the moment of contact.
      //    Spikes of uneven length, because an even star reads as a sticker.
      for (let i = S.stars.length - 1; i >= 0; i--) {
        const k = S.stars[i]; k.p += dt / k.dur;
        if (k.p >= 1) { S.stars.splice(i, 1); continue; }
        const e = 1 - Math.pow(1 - k.p, 3), a2 = Math.pow(1 - k.p, 1.8);
        // a hard white core that collapses as the spikes go out
        const cr = k.r * 0.3 * (1 - k.p * 0.7);
        const cg = ctx.createRadialGradient(k.x, k.y, 0, k.x, k.y, cr);
        cg.addColorStop(0, `rgba(255,255,255,${a2})`);
        cg.addColorStop(0.5, `rgba(255,246,214,${a2 * .8})`);
        cg.addColorStop(1, k.c + "00");
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(k.x, k.y, cr, 0, 7); ctx.fill();
        ctx.save(); ctx.globalAlpha = a2;
        for (let n = 0; n < k.n; n++) {
          const ang = k.a0 + (n / k.n) * Math.PI * 2;
          // uneven, but stable per spike — a hash, not a re-roll each frame
          const jag = 0.45 + 0.55 * Math.abs(Math.sin(n * 12.9898 + k.seed));
          const len = k.r * jag * e;
          const wdt = k.r * 0.13 * jag * (1 - k.p * 0.5);
          const cx2 = Math.cos(ang), sy = Math.sin(ang);
          const px = -sy, py = cx2;
          ctx.beginPath();
          ctx.moveTo(k.x + px * wdt, k.y + py * wdt);
          ctx.lineTo(k.x + cx2 * len, k.y + sy * len);
          ctx.lineTo(k.x - px * wdt, k.y - py * wdt);
          ctx.closePath();
          const sg = ctx.createLinearGradient(k.x, k.y, k.x + cx2 * len, k.y + sy * len);
          sg.addColorStop(0, "#ffffff"); sg.addColorStop(0.45, k.c); sg.addColorStop(1, k.c + "00");
          ctx.fillStyle = sg; ctx.fill();
        }
        ctx.restore();
      }

      // ── speed lines: thin white streaks flung straight out from the point of
      //    contact. Every fighting game draws these, because the eye reads
      //    radiating lines as force before it reads anything else.
      for (let i = S.lines.length - 1; i >= 0; i--) {
        const l = S.lines[i]; l.p += dt / l.dur;
        if (l.p >= 1) { S.lines.splice(i, 1); continue; }
        const e = 1 - Math.pow(1 - l.p, 2.6), a2 = Math.pow(1 - l.p, 1.4);
        ctx.save(); ctx.lineCap = "round"; ctx.globalAlpha = a2;
        for (let n = 0; n < l.n; n++) {
          const ang = l.a0 + (n / l.n) * Math.PI * 2;
          const jag = 0.5 + 0.5 * Math.abs(Math.sin(n * 7.331 + l.seed));
          const r0 = l.r * 0.28 + l.r * 0.95 * e * jag;
          const r1 = r0 + l.r * 0.42 * jag * (1 - l.p * 0.6);
          const g = ctx.createLinearGradient(
            l.x + Math.cos(ang) * r0, l.y + Math.sin(ang) * r0,
            l.x + Math.cos(ang) * r1, l.y + Math.sin(ang) * r1);
          g.addColorStop(0, l.c + "00"); g.addColorStop(0.5, "#ffffff"); g.addColorStop(1, l.c + "00");
          ctx.strokeStyle = g; ctx.lineWidth = 1.2 + 2.2 * a2 * jag;
          ctx.beginPath();
          ctx.moveTo(l.x + Math.cos(ang) * r0, l.y + Math.sin(ang) * r0);
          ctx.lineTo(l.x + Math.cos(ang) * r1, l.y + Math.sin(ang) * r1);
          ctx.stroke();
        }
        ctx.restore();
      }

      // ── sustained beams: a laser is a held line with a bloom, not a bolt
      for (let i = S.lasers.length - 1; i >= 0; i--) {
        const l = S.lasers[i]; l.p += dt / l.dur;
        if (l.p >= 1) { S.lasers.splice(i, 1); continue; }
        const k = l.p < .15 ? l.p / .15 : l.p > .7 ? (1 - l.p) / .3 : 1;   // strike, hold, cut
        // the beam breathes: a real high-energy line is never a steady width
        const puls = 1 + Math.sin(S.t * 46) * 0.12 + Math.sin(S.t * 121) * 0.05;
        ctx.save(); ctx.lineCap = "round";
        // outer haze — wide, dim, and what sells it as hot rather than painted
        ctx.globalAlpha = 0.13 * k; ctx.strokeStyle = l.c; ctx.lineWidth = l.w * 9 * puls;
        ctx.beginPath(); ctx.moveTo(l.x0, l.y0); ctx.lineTo(l.x1, l.y1); ctx.stroke();
        ctx.globalAlpha = 0.3 * k; ctx.lineWidth = l.w * 4.5 * puls;
        ctx.beginPath(); ctx.moveTo(l.x0, l.y0); ctx.lineTo(l.x1, l.y1); ctx.stroke();
        ctx.globalAlpha = 0.7 * k; ctx.lineWidth = l.w * 1.9 * puls;
        ctx.beginPath(); ctx.moveTo(l.x0, l.y0); ctx.lineTo(l.x1, l.y1); ctx.stroke();
        ctx.globalAlpha = k; ctx.strokeStyle = "#fff"; ctx.lineWidth = l.w * 0.75;
        ctx.beginPath(); ctx.moveTo(l.x0, l.y0); ctx.lineTo(l.x1, l.y1); ctx.stroke();
        // the emitter end blooms, and the far end splashes where it lands
        for (const [ex, ey, er] of [[l.x0, l.y0, l.w * 4.4], [l.x1, l.y1, l.w * 6.4]]) {
          const g = ctx.createRadialGradient(ex, ey, 1, ex, ey, er * (0.7 + 0.5 * puls));
          g.addColorStop(0, "#ffffff"); g.addColorStop(0.4, l.c); g.addColorStop(1, l.c + "00");
          ctx.globalAlpha = k * 0.9; ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(ex, ey, er * (0.7 + 0.5 * puls), 0, 7); ctx.fill();
        }
        ctx.globalAlpha = 1; ctx.restore();
      }

      // ── lobbed shells: a real parabola, so a grenade arcs instead of sliding
      for (let i = S.lobs.length - 1; i >= 0; i--) {
        const b = S.lobs[i]; b.p += dt / b.dur;
        if (b.p >= 1) { S.lobs.splice(i, 1); b.onLand && b.onLand(); continue; }
        const x = b.x0 + (b.x1 - b.x0) * b.p;
        const y = b.y0 + (b.y1 - b.y0) * b.p - b.arc * 4 * b.p * (1 - b.p);
        ctx.beginPath(); ctx.arc(x, y, 6, 0, 7);
        const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 8);
        g.addColorStop(0, "#fff"); g.addColorStop(1, b.c);
        ctx.fillStyle = g; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 10 + Math.sin(S.t * 40) * 2, 0, 7);
        ctx.strokeStyle = b.c; ctx.globalAlpha = .5; ctx.lineWidth = 1.4; ctx.stroke(); ctx.globalAlpha = 1;
        // a smoke trail behind it, so you can see the shell coming and where
        // from — a grenade that appears at the target is a magic trick
        b.trail = (b.trail || 0) + dt;
        if (b.trail > 0.028 && !reduced()) {
          b.trail = 0;
          S.smoke.push({ x, y, vx: (Math.random() - .5) * 22, vy: -8 - Math.random() * 14,
            r: 4 + Math.random() * 4, p: 0, dur: 0.5 + Math.random() * 0.35 });
          S.embers.push({ x, y, vx: (Math.random() - .5) * 40, vy: 10 + Math.random() * 30,
            r: 0.7 + Math.random(), life: 0.3 + Math.random() * 0.3, max: 0.6,
            fl: 30 + Math.random() * 20, ph: Math.random() * 7 });
        }
      }

      // ── fireballs: white core, hot shell, cooling edge, all expanding
      for (let i = S.balls.length - 1; i >= 0; i--) {
        const f = S.balls[i]; f.p += dt / f.dur;
        if (f.p >= 1) { S.balls.splice(i, 1); continue; }
        // the secondary blooms start on a NEGATIVE p so they bloom late; until
        // they reach zero there is nothing to draw, and sqrt of a negative
        // number is a NaN radius that throws out of createRadialGradient
        if (f.p <= 0) continue;
        const r = f.r * (0.25 + 0.75 * Math.sqrt(f.p)), a = Math.pow(1 - f.p, 1.6);
        const g = ctx.createRadialGradient(f.x, f.y, r * 0.05, f.x, f.y, r);
        // a real fireball cools outward AND over time: white → yellow → orange
        // → dull red, and the white core survives longest at the centre
        const cool = Math.min(1, f.p * 1.4);
        g.addColorStop(0, `rgba(255,255,255,${a})`);
        g.addColorStop(0.18, `rgba(255,247,205,${a * 0.98})`);
        g.addColorStop(0.38 + cool * 0.1, `rgba(255,198,64,${a * 0.92})`);
        g.addColorStop(0.66, `rgba(255,104,28,${a * 0.66})`);
        g.addColorStop(0.86, `rgba(196,44,14,${a * 0.3})`);
        g.addColorStop(1, "rgba(120,26,10,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 7); ctx.fill();
      }

      // ── the flare: spikes of light, which is what a camera does when
      //    something very bright goes off in front of it
      for (let i = S.flares.length - 1; i >= 0; i--) {
        const f = S.flares[i]; f.p += dt / f.dur;
        if (f.p >= 1) { S.flares.splice(i, 1); continue; }
        const al = Math.pow(1 - f.p, 2), r = f.r * (0.5 + f.p);
        ctx.save(); ctx.globalAlpha = al * 0.8; ctx.lineCap = "round";
        for (const [dx, dy, k] of [[1, 0, 1], [0, 1, 0.45], [0.7, 0.7, 0.3], [0.7, -0.7, 0.3]]) {
          const g = ctx.createLinearGradient(f.x - dx * r * k, f.y - dy * r * k, f.x + dx * r * k, f.y + dy * r * k);
          g.addColorStop(0, f.c + "00"); g.addColorStop(0.5, "#ffffff"); g.addColorStop(1, f.c + "00");
          ctx.strokeStyle = g; ctx.lineWidth = 3 + 5 * al;
          ctx.beginPath(); ctx.moveTo(f.x - dx * r * k, f.y - dy * r * k); ctx.lineTo(f.x + dx * r * k, f.y + dy * r * k); ctx.stroke();
        }
        ctx.restore();
      }

      // ── the pressure wave: a thin, very fast ring that outruns the fire and
      //    briefly whitens the air behind it
      for (let i = S.shock.length - 1; i >= 0; i--) {
        const k = S.shock[i]; k.p += dt / k.dur;
        if (k.p >= 1) { S.shock.splice(i, 1); continue; }
        const e = 1 - Math.pow(1 - k.p, 3);                 // fast out, then coasts
        const r = k.r0 + (k.r1 - k.r0) * e, a2 = Math.pow(1 - k.p, 2.2);
        const g = ctx.createRadialGradient(k.x, k.y, Math.max(1, r * 0.82), k.x, k.y, r * 1.06);
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(0.6, `rgba(255,246,220,${a2 * 0.5})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(k.x, k.y, r * 1.06, 0, 7); ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${a2 * 0.7})`; ctx.lineWidth = 1.6 * a2 + 0.4;
        ctx.beginPath(); ctx.arc(k.x, k.y, r, 0, 7); ctx.stroke();
      }

      // ── embers: the slow orange motes that hang after the fire has gone.
      //    They flicker, which is the cheapest thing that reads as burning.
      for (let i = S.embers.length - 1; i >= 0; i--) {
        const e = S.embers[i];
        e.life -= dt;
        if (e.life <= 0) { S.embers.splice(i, 1); continue; }
        e.vy += 40 * dt; e.vy *= 0.985; e.vx *= 0.98;
        e.x += e.vx * dt; e.y += e.vy * dt;
        const a2 = Math.max(0, e.life / e.max) * (0.55 + 0.45 * Math.sin(S.t * e.fl + e.ph));
        const g = ctx.createRadialGradient(e.x, e.y, 0.2, e.x, e.y, e.r * 3.4);
        g.addColorStop(0, `rgba(255,240,200,${a2})`);
        g.addColorStop(0.35, `rgba(255,150,50,${a2 * 0.8})`);
        g.addColorStop(1, "rgba(255,90,20,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 3.4, 0, 7); ctx.fill();
      }

      // ── smoke, which is what makes an explosion read as big
      for (let i = S.smoke.length - 1; i >= 0; i--) {
        const m = S.smoke[i]; m.p += dt / m.dur;
        if (m.p >= 1) { S.smoke.splice(i, 1); continue; }
        m.x += m.vx * dt; m.y += m.vy * dt; m.vy += 26 * dt; m.vx *= 0.99;
        const r = m.r * (0.5 + m.p * 1.5), a = (1 - m.p) * 0.34;
        // smoke lit from inside early on, cooling to plain grey as it drifts
        const g = ctx.createRadialGradient(m.x, m.y, r * 0.1, m.x, m.y, r);
        const warm = Math.max(0, 1 - m.p * 2.2);
        g.addColorStop(0, `rgba(${Math.round(110 + 120 * warm)},${Math.round(112 + 70 * warm)},${Math.round(126 + 10 * warm)},${a})`);
        g.addColorStop(1, "rgba(96,100,116,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x, m.y, r, 0, 7); ctx.fill();
      }

      // ── shockwave rings
      for (let i = S.rings.length - 1; i >= 0; i--) {
        const r = S.rings[i]; r.p += dt / r.dur;
        if (r.p >= 1) { S.rings.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * r.p, 0, 7);
        ctx.strokeStyle = r.c; ctx.globalAlpha = (1 - r.p) * 0.8;
        ctx.lineWidth = 3 * (1 - r.p) + 0.6; ctx.stroke(); ctx.globalAlpha = 1;
      }

      // ── sparks: real velocity, gravity and drag, so they arc instead of fan
      for (let i = S.parts.length - 1; i >= 0; i--) {
        const p = S.parts[i];
        p.life -= dt;
        if (p.life <= 0) { S.parts.splice(i, 1); continue; }
        p.vy += 620 * dt; p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx * dt; p.y += p.vy * dt;
        const a = Math.max(0, p.life / p.max);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.012, p.y - p.vy * 0.012);
        ctx.strokeStyle = p.c; ctx.globalAlpha = a; ctx.lineWidth = p.r; ctx.lineCap = "round";
        ctx.stroke(); ctx.globalAlpha = 1;
      }

      // ── back to normal blending: debris is matter, not light, and drawing
      //    it additively would turn every chunk into a glowing blob
      ctx.globalCompositeOperation = "source-over";

      // ── dust: what a foot kicks off the floor. Wide, low, and short-lived.
      for (let i = S.dust.length - 1; i >= 0; i--) {
        const d = S.dust[i]; d.p += dt / d.dur;
        if (d.p >= 1) { S.dust.splice(i, 1); continue; }
        d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 60 * dt; d.vx *= 0.97;
        const r = d.r * (0.4 + d.p * 1.9), a2 = (1 - d.p) * 0.26;
        const g = ctx.createRadialGradient(d.x, d.y, r * 0.1, d.x, d.y, r);
        g.addColorStop(0, `rgba(196,206,228,${a2})`);
        g.addColorStop(1, "rgba(150,162,188,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, 7); ctx.fill();
      }

      // ── debris: chunks with mass and spin that bounce once off the floor
      for (let i = S.debris.length - 1; i >= 0; i--) {
        const d = S.debris[i];
        d.life -= dt;
        if (d.life <= 0) { S.debris.splice(i, 1); continue; }
        d.vy += 900 * dt; d.vx *= 0.995;
        d.x += d.vx * dt; d.y += d.vy * dt; d.rot += d.spin * dt;
        const floor = S.h * 0.94;
        if (d.y > floor && d.vy > 0) { d.y = floor; d.vy *= -0.42; d.vx *= 0.6; d.spin *= 0.5; }
        const a2 = Math.min(1, d.life / 0.45);
        ctx.save();
        ctx.translate(d.x, d.y); ctx.rotate(d.rot);
        ctx.globalAlpha = a2; ctx.fillStyle = d.c;
        ctx.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
        ctx.globalAlpha = a2 * 0.5; ctx.fillStyle = "#ffffff";
        ctx.fillRect(-d.w / 2, -d.h / 2, d.w, Math.max(0.8, d.h * 0.3));
        ctx.restore();
      }
      ctx.globalAlpha = 1;

      if (S.flash) {
        S.flash.p += dt / S.flash.dur;
        if (S.flash.p >= 1) S.flash = null;
        else { ctx.fillStyle = S.flash.c; ctx.globalAlpha = (1 - S.flash.p) * S.flash.a; ctx.fillRect(0, 0, S.w, S.h); ctx.globalAlpha = 1; }
      }
      S.raf = requestAnimationFrame(frame);
    };
    S.raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(S.raf); ro.disconnect(); stateRef.current = null; };
  }, []);

  /* Where a shot comes out of, and where it lands. A hand, a head and a weapon
     sit at different heights on the same body, and a bolt that leaves all three
     from the same pixel is what makes an attack look like a placeholder. */
  const AT_Y = { hand: 0.58, head: 0.34, weapon: 0.55, body: 0.52, foot: 0.78 };
  const at = (side, part = "body") => {
    const S = stateRef.current;
    if (!S) return { x: 0, y: 0 };
    const lead = part === "weapon" ? 0.05 : part === "hand" ? 0.03 : 0;
    const f = (S.pos[side] || 0.5) + (side === "me" ? lead : -lead);
    return { x: S.w * f, y: S.h * (AT_Y[part] || 0.52) - (S.air[side] || 0) * S.h * 0.16 };
  };
  /** Move the canvas to another arena. */
  const setStage = useCallback((next) => {
    const S = stateRef.current; if (!S || !next) return;
    S.stage = next;
  }, []);

  /** Tell the canvas where the fighters are standing and how high they are. */
  const setPos = useCallback((mePos, opPos, meAir, opAir) => {
    const S = stateRef.current; if (!S) return;
    S.pos.me = mePos; S.pos.op = opPos; S.air.me = meAir || 0; S.air.op = opAir || 0;
  }, []);

  const burst = useCallback((side, power = 1, colour = "#ffd23f", part = "body") => {
    const S = stateRef.current; if (!S) return;
    const { x, y } = at(side, part);
    S.rings.push({ x, y, r0: 6, r1: 40 + 44 * power, dur: 0.42, c: colour });
    // a hot flash at the point of contact — a hit should look like it hurt
    S.balls.push({ x, y, r: 15 + 16 * power, p: 0, dur: 0.16 });
    if (power > 1.2) S.shock.push({ x, y, r0: 6, r1: 90 * power, p: 0, dur: 0.26 });
    if (reduced()) return;
    for (let i = 0; i < Math.round(5 * power); i++) {
      const a2 = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 240 * power;
      S.debris.push({ x, y, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp - 150,
        w: 1.6 + Math.random() * 3.4, h: 1.6 + Math.random() * 3,
        rot: Math.random() * 7, spin: (Math.random() - 0.5) * 20,
        life: 0.6 + Math.random() * 0.5, c: ["#3b3f4a", "#5a5f6d"][Math.floor(Math.random() * 2)] });
    }
    const n = Math.min(38, Math.round(16 + 16 * power));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 320 * power;
      S.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        r: 1 + Math.random() * 2, life: 0.35 + Math.random() * 0.5, max: 0.85,
        c: Math.random() < 0.35 ? "#ffffff" : colour,
      });
    }
  }, []);

  /** A travelling bolt — a blaster round. */
  const bolt = useCallback((from, colour = "#7fe8ff", w = 5, part = "hand") => {
    const S = stateRef.current; if (!S) return;
    const a = at(from, part), b = at(from === "me" ? "op" : "me", "body");
    S.beams.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, p: 0, dur: 0.28, c: colour, w });
    muzzle(from, part, colour);
  }, []);

  /** A held beam that connects instantly — a laser, from wherever it is fired. */
  const laser = useCallback((from, colour = "#ff4d6a", w = 4, part = "hand") => {
    const S = stateRef.current; if (!S) return;
    const a = at(from, part), b = at(from === "me" ? "op" : "me", "body");
    S.lasers.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, p: 0, dur: 0.42, c: colour, w });
    muzzle(from, part, colour);
  }, []);

  /** The flash at the barrel. Small, but it is what places the shot on a hand
      or a head rather than in mid-air. */
  const muzzle = useCallback((from, part = "hand", colour = "#7fe8ff") => {
    const S = stateRef.current; if (!S) return;
    const { x, y } = at(from, part);
    S.rings.push({ x, y, r0: 2, r1: 20, dur: 0.2, c: colour });
    // a short hot bloom at the barrel: the flash IS the shot leaving
    S.balls.push({ x, y, r: 17, p: 0, dur: 0.14 });
    S.flares.push({ x, y, r: 54, p: 0, dur: 0.16, c: colour });
    if (reduced()) return;
    for (let i = 0; i < 8; i++) {
      const a = (Math.random() - 0.5) * 1.1 + (from === "me" ? 0 : Math.PI), sp = 120 + Math.random() * 220;
      S.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, r: 1 + Math.random() * 1.6,
        life: 0.16 + Math.random() * 0.14, max: 0.3, c: "#ffffff" });
    }
  }, []);

  /** The big one, staged the way a real detonation actually resolves:
      1. the pressure wave leaves first and outruns everything,
      2. a white core that is gone in a fifth of a second,
      3. the fireball proper, with two late secondary blooms so it billows
         rather than simply expanding,
      4. sparks, then debris with mass, then embers that hang and flicker,
      5. smoke, which is what makes it read as BIG,
      6. a scorch mark on the floor, which is what makes it read as REAL —
         the fight leaves a record of where it has already gone off. */
  const boom = useCallback((side, power = 1.4, colour = "#ff9a3c", part = "body") => {
    const S = stateRef.current; if (!S) return;
    const { x, y } = at(side, part);
    S.shock.push({ x, y, r0: 10, r1: 210 * power, p: 0, dur: 0.34 });
    S.balls.push({ x, y, r: 26 * power, p: 0, dur: 0.22 });     // the hard core, gone first
    S.balls.push({ x, y, r: 62 * power, p: 0, dur: 0.5 });
    S.flares.push({ x, y, r: 168 * power, p: 0, dur: 0.36, c: colour });
    S.balls.push({ x: x - 22 * power, y: y + 14, r: 38 * power, p: -0.18, dur: 0.62 });
    S.balls.push({ x: x + 26 * power, y: y - 16, r: 34 * power, p: -0.3, dur: 0.66 });
    S.balls.push({ x: x + 8 * power, y: y + 22, r: 30 * power, p: -0.44, dur: 0.7 });
    [[0.34, 78], [0.5, 128], [0.72, 190]].forEach(([d, r]) =>
      S.rings.push({ x, y, r0: 8, r1: r * power, dur: d, c: colour }));
    S.scorch.push({ x, y: S.h * 0.9, r: 40 * power, p: 0, dur: 3.4 });
    if (reduced()) return;
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, sp = 140 + Math.random() * 680 * power;
      S.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 130,
        r: 1 + Math.random() * 2.6, life: 0.45 + Math.random() * 0.7, max: 1.15,
        c: [colour, "#ffffff", "#ffd23f"][Math.floor(Math.random() * 3)] });
    }
    for (let i = 0; i < Math.round(14 * power); i++) {
      const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 360 * power;
      S.debris.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 220,
        w: 2 + Math.random() * 5, h: 2 + Math.random() * 4,
        rot: Math.random() * 7, spin: (Math.random() - 0.5) * 22,
        life: 0.9 + Math.random() * 0.8, c: ["#3b3f4a", "#5a5f6d", "#2b2f38"][Math.floor(Math.random() * 3)] });
    }
    for (let i = 0; i < Math.round(18 * power); i++) {
      const a = Math.random() * Math.PI * 2, sp = 30 + Math.random() * 150 * power;
      S.embers.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90,
        r: 0.8 + Math.random() * 1.8, life: 0.9 + Math.random() * 1.3, max: 2.2,
        fl: 18 + Math.random() * 26, ph: Math.random() * 7 });
    }
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      S.smoke.push({ x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 10,
        vx: Math.cos(a) * (26 + Math.random() * 50), vy: -(26 + Math.random() * 46),
        r: 14 + Math.random() * 22, p: 0, dur: 1.0 + Math.random() * 0.8 });
    }
  }, []);

  /** The arc a fist or a foot travels through, drawn from the striker toward
      the target. A punch is a short flat hook at chest height; a kick is a
      long arc swung up from the floor. Without this the two melee moves are
      the same event with different labels. */
  const swipe = useCallback((from, colour = "#ffd6a8", kind = "punch") => {
    const S = stateRef.current; if (!S) return;
    const a = at(from, kind === "kick" ? "foot" : "hand");
    const b = at(from === "me" ? "op" : "me", "body");
    const dir = b.x > a.x ? 1 : -1;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    if (kind === "kick") {
      // swung up from below: start low behind, finish high in front
      S.swipes.push({ x: mid.x, y: mid.y + S.h * 0.06, r: S.w * 0.13, sq: 1.5,
        a0: dir > 0 ? Math.PI * 0.75 : Math.PI * 0.25,
        a1: dir > 0 ? -Math.PI * 0.15 : Math.PI * 1.15,
        p: 0, dur: 0.3, c: colour, w: 11 });
    } else {
      // a flat hook across chest height
      S.swipes.push({ x: mid.x, y: mid.y, r: S.w * 0.1, sq: 0.55,
        a0: dir > 0 ? Math.PI * 1.15 : Math.PI * -0.15,
        a1: dir > 0 ? Math.PI * 0.15 : Math.PI * 0.85,
        p: 0, dur: 0.24, c: colour, w: 9 });
    }
  }, []);

  /** The moment of contact for a melee hit: a spiked flash, a shockwave, a
      CONE of sparks and debris thrown the way the blow was going (a punch
      throws material forward — a sphere of sparks reads as an explosion, not
      as a hit), and dust off the floor when it was a kick. */
  const impact = useCallback((side, power = 1, colour = "#ffd23f", kind = "punch") => {
    const S = stateRef.current; if (!S) return;
    const foe = side === "me" ? "op" : "me";
    const { x, y } = at(foe, kind === "kick" ? "foot" : "body");
    const dir = (S.pos[foe] || .5) > (S.pos[side] || .5) ? 1 : -1;
    /* two stars, counter-rotated and different sizes, so the burst is dense
       rather than a single tidy asterisk */
    S.stars.push({ x, y, r: 84 * power, n: 7, a0: Math.random() * 6.28,
      seed: Math.random() * 100, p: 0, dur: 0.26, c: colour });
    S.stars.push({ x, y, r: 50 * power, n: 9, a0: Math.random() * 6.28,
      seed: Math.random() * 100, p: 0, dur: 0.19, c: "#ffffff" });
    S.lines.push({ x, y, r: 130 * power, n: 14, a0: Math.random() * 6.28,
      seed: Math.random() * 100, p: 0, dur: 0.3, c: colour });
    // two waves at two speeds: the crack, then the pressure behind it
    S.shock.push({ x, y, r0: 5, r1: 118 * power, p: 0, dur: 0.24 });
    S.shock.push({ x, y, r0: 5, r1: 186 * power, p: 0, dur: 0.42 });
    S.balls.push({ x, y, r: 34 * power, p: 0, dur: 0.2 });
    S.balls.push({ x, y, r: 16 * power, p: 0, dur: 0.11 });
    S.flares.push({ x, y, r: 140 * power, p: 0, dur: 0.24, c: colour });
    S.rings.push({ x, y, r0: 5, r1: 62 * power, dur: 0.3, c: colour });
    if (reduced()) return;
    // sparks in a forward cone rather than a sphere
    const base = dir > 0 ? 0 : Math.PI;
    for (let i = 0; i < Math.round(26 * power); i++) {
      const a2 = base + (Math.random() - 0.5) * 1.5, sp = 180 + Math.random() * 520 * power;
      S.parts.push({ x, y, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp - 120,
        r: 1 + Math.random() * 2.2, life: 0.3 + Math.random() * 0.4, max: 0.7,
        c: Math.random() < 0.45 ? "#ffffff" : colour });
    }
    for (let i = 0; i < Math.round(7 * power); i++) {
      const a2 = base + (Math.random() - 0.5) * 1.7, sp = 140 + Math.random() * 340 * power;
      S.debris.push({ x, y, vx: Math.cos(a2) * sp, vy: Math.sin(a2) * sp - 180,
        w: 1.8 + Math.random() * 3.6, h: 1.8 + Math.random() * 3,
        rot: Math.random() * 7, spin: (Math.random() - 0.5) * 24,
        life: 0.55 + Math.random() * 0.5, c: ["#3b3f4a", "#5a5f6d"][Math.floor(Math.random() * 2)] });
    }
    if (kind === "kick") {
      for (let i = 0; i < 8; i++) {
        S.dust.push({ x: x + (Math.random() - .5) * 30, y: S.h * 0.92,
          vx: dir * (40 + Math.random() * 130), vy: -(10 + Math.random() * 40),
          r: 9 + Math.random() * 12, p: 0, dur: 0.55 + Math.random() * 0.4 });
      }
    }
  }, []);

  /** A shell that arcs over and detonates where it lands. */
  const lob = useCallback((from, colour = "#ff9a3c", onLand) => {
    const S = stateRef.current; if (!S) return;
    const a = at(from, "hand"), b = at(from === "me" ? "op" : "me", "body");
    S.lobs.push({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, p: 0, dur: 0.46, arc: S.h * 0.42, c: colour, onLand, trail: 0 });
  }, []);

  const flash = useCallback((colour = "#ffffff", a = 0.5, dur = 0.3) => {
    const S = stateRef.current; if (!S) return;
    S.flash = { c: colour, a, p: 0, dur };
  }, []);

  return { canvasRef, burst, bolt, laser, muzzle, boom, lob, flash, setPos, setStage, swipe, impact, beam: bolt };
}

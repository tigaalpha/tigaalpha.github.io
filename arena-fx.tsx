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
/* ── grooves ──
   A different chord progression over the same beat still reads as the same
   track. The groove IS the pattern set, so a place can be a four-on-the-floor
   drive, a half-time crawl or an almost-empty pulse before a single note
   changes. Each is [calm, fired-up] - the second gear is what a fight
   switches to. */
const GROOVES = {
  drive: {
    kick:  [[0, 6, 8, 14], [0, 3, 6, 8, 11, 14]],
    snare: [[4, 12], [4, 12, 15]],
    hat:   [[0, 2, 4, 6, 8, 10, 12, 14], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]],
    bass:  [[0, 3, 6, 8, 11, 14], [0, 2, 3, 6, 8, 10, 11, 14]],
    arp:   [[0, 2, 4, 6, 8, 10, 12, 14], [0, 2, 4, 6, 8, 10, 12, 14]],
  },
  // heavy and slow: one boot down, a long gap, then the answer
  march: {
    kick:  [[0, 4, 8, 12], [0, 3, 4, 8, 11, 12]],
    snare: [[4, 12], [4, 10, 12, 14]],
    hat:   [[2, 6, 10, 14], [0, 2, 4, 6, 8, 10, 12, 14]],
    bass:  [[0, 4, 8, 10, 12], [0, 2, 4, 8, 10, 12, 14]],
    arp:   [[0, 6, 8, 14], [0, 4, 6, 8, 12, 14]],
  },
  // half time: the backbeat lands once a bar and everything hangs off it
  halftime: {
    kick:  [[0, 10], [0, 6, 10]],
    snare: [[8], [8, 14]],
    hat:   [[0, 4, 8, 12], [0, 2, 4, 6, 8, 10, 12, 14]],
    bass:  [[0, 5, 10], [0, 3, 5, 10, 13]],
    arp:   [[0, 3, 6, 9, 12], [0, 2, 4, 6, 8, 10, 12, 14]],
  },
  // barely there: cold rooms and empty ones
  sparse: {
    kick:  [[0], [0, 8]],
    snare: [[], [12]],
    hat:   [[4, 12], [2, 6, 10, 14]],
    bass:  [[0, 7], [0, 7, 11]],
    arp:   [[0, 4, 8, 12], [0, 2, 6, 10, 14]],
  },
  // an even machine pulse, sixteenths on the offbeat
  pulse: {
    kick:  [[0, 4, 8, 12], [0, 2, 4, 6, 8, 10, 12, 14]],
    snare: [[4, 12], [4, 12, 14]],
    hat:   [[1, 3, 5, 7, 9, 11, 13, 15], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]],
    bass:  [[0, 4, 8, 12], [0, 4, 6, 8, 12, 14]],
    arp:   [[0, 1, 4, 5, 8, 9, 12, 13], [0, 1, 4, 5, 8, 9, 12, 13]],
  },
  // off-kilter, never quite where the foot expects it
  swirl: {
    kick:  [[0, 7], [0, 7, 11]],
    snare: [[8], [4, 8, 12]],
    hat:   [[0, 3, 6, 9, 12, 15], [0, 2, 3, 5, 6, 8, 9, 11, 12, 14]],
    bass:  [[0, 3, 7, 10], [0, 3, 5, 7, 10, 13]],
    arp:   [[0, 2, 3, 5, 7, 9, 11, 13], [0, 2, 3, 5, 7, 9, 11, 13]],
  },
};

/* ── the hook ──
   A motif is one character per sixteenth, four bars of sixteen. '.' is a rest;
   anything else is a semitone offset above that bar's chord root, in base 32,
   so 0-9 then a-v covers two and a half octaves. This is the difference
   between a map that throbs and a map you can hum. */
const motif = (str) => {
  const t = String(str).replace(/[^0-9a-v.]/g, "");
  return t.length === 64 ? t.split("").map(c => (c === "." ? null : parseInt(c, 32))) : null;
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
    neon: ["255,43,214", "63,216,255"], face: "16,22,44",
    bpm: 150, feel: "drive", lead: "square", padOsc: "sawtooth", bright: 1500,
    /* the academy: a bright descending call, answered a step lower */
    hook: motif("c...a...7...5..." + "7...5...3...5..." + "c...e...c...a..." + "7.....5.3......."),
    chords: [
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
    neon: ["255,47,94", "255,170,60"], face: "36,16,14",
    bpm: 162, feel: "march", lead: "sawtooth", padOsc: "square", bright: 1100,
    /* four hundred years of machines keeping time for nobody */
    hook: motif("0...0.3.5...3..." + "0...0.3.7...5..." + "a...7...5...3..." + "0.......0.3.5..."),
    chords: [
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
    neon: ["47,123,255", "77,240,255"], face: "10,32,52",
    bpm: 118, feel: "sparse", lead: "triangle", padOsc: "triangle", bright: 2400,
    /* a world where sound does not carry: single notes, long silences */
    hook: motif("c.......f......." + "e.......c......." + "a.......c......." + "7...........c..."),
    chords: [
      { bass: 40, arp: [64, 68, 71, 76] }, { bass: 35, arp: [59, 63, 66, 71] },
      { bass: 43, arp: [67, 71, 74, 79] }, { bass: 38, arp: [62, 66, 69, 74] },
    ],
  },
  {
    id: "ashfall", th: "ม่านเถ้า", en: "Ashfall", zh: "落灰之地",
    sky: ["#3d0a20", "#22061a", "#0c0210"],
    grid: "rgba(255,90,150,.22)", horizon: "255,90,150",
    spots: [[0.22, "255,120,170"], [0.78, "255,210,63"]],
    mote: "255,170,200", back: "embers",
    neon: ["255,210,63", "255,63,143"], face: "34,8,26",
    bpm: 156, feel: "pulse", lead: "square", padOsc: "sawtooth", bright: 1300,
    /* a machine that will not stop: one figure, hammered */
    hook: motif("0.0.3.0.5.0.3.0." + "0.0.3.0.7.0.5.0." + "a.a.7.a.5.a.3.a." + "0.3.5.7.a.7.5.3."),
    chords: [
      { bass: 32, arp: [56, 59, 63, 68] }, { bass: 39, arp: [63, 66, 70, 75] },
      { bass: 37, arp: [61, 64, 68, 73] }, { bass: 34, arp: [58, 61, 65, 70] },
    ],
  },
  {
    id: "void", th: "ห้วงอวกาศ", en: "Deep Void", zh: "深空",
    sky: ["#2a1b4a", "#170f2e", "#06040f"],
    grid: "rgba(180,140,255,.20)", horizon: "170,130,255",
    spots: [[0.24, "190,150,255"], [0.76, "120,220,255"]],
    mote: "215,190,255", back: "stars",
    neon: ["63,240,208", "176,125,255"], face: "24,14,58",
    bpm: 134, feel: "swirl", lead: "sine", padOsc: "sawtooth", bright: 1900,
    /* the first song, heard from very far away */
    hook: motif("c..a..7..c..e..." + "f..e..c..a..7..." + "c..e..h..e..c..." + "a..7..5..7..a..."),
    chords: [
      { bass: 32, arp: [56, 59, 63, 68] }, { bass: 37, arp: [61, 64, 68, 73] },
      { bass: 39, arp: [63, 67, 70, 75] }, { bass: 34, arp: [58, 61, 65, 70] },
    ],
  },
  {
    id: "bloom", th: "เรือนยอดเรืองแสง", en: "Glow Canopy", zh: "辉光林冠",
    sky: ["#0a2e26", "#06201c", "#020c0a"],
    grid: "rgba(90,255,190,.20)", horizon: "90,255,190",
    spots: [[0.24, "120,255,200"], [0.76, "255,220,120"]],
    mote: "150,255,210", back: "lanterns",
    neon: ["63,255,178", "255,214,102"], face: "8,34,28",
    bpm: 126, feel: "halftime", lead: "triangle", padOsc: "triangle", bright: 2100,
    /* something enormous and green, breathing in its sleep */
    hook: motif("....7.....a....." + "....5.....7....." + "....c.....a....." + "....7.....5....."),
    chords: [
      { bass: 36, arp: [60, 63, 67, 70] }, { bass: 41, arp: [65, 68, 72, 75] },
      { bass: 34, arp: [58, 61, 65, 68] }, { bass: 39, arp: [63, 66, 70, 73] },
    ],
  },
  {
    id: "gilt", th: "ระเบียงทองคำ", en: "The Gilded Tier", zh: "鎏金层",
    sky: ["#2e2208", "#1c1405", "#0a0702"],
    grid: "rgba(255,200,90,.20)", horizon: "255,200,90",
    spots: [[0.24, "255,224,150"], [0.76, "200,150,255"]],
    mote: "255,228,170", back: "lanterns",
    neon: ["255,196,63", "186,125,255"], face: "36,26,8",
    bpm: 108, feel: "swirl", lead: "sawtooth", padOsc: "sawtooth", bright: 2600,
    /* money's own music: ornamented, unhurried, faintly smug */
    hook: motif("c.e.f.e.c.a.7.a." + "e.f.h.f.e.c.a.c." + "f.h.j.h.f.e.c.e." + "c.a.7.5.3.5.7.a."),
    chords: [
      { bass: 41, arp: [65, 69, 72, 76] }, { bass: 36, arp: [60, 64, 67, 71] },
      { bass: 43, arp: [67, 71, 74, 78] }, { bass: 38, arp: [62, 66, 69, 73] },
    ],
  },
  {
    id: "tide", th: "ใต้กระแสน้ำ", en: "The Undertide", zh: "潮下",
    sky: ["#031a2e", "#021221", "#00070f"],
    grid: "rgba(70,190,255,.18)", horizon: "70,190,255",
    spots: [[0.24, "90,210,255"], [0.76, "140,120,255"]],
    mote: "120,215,255", back: "stars",
    neon: ["46,190,255", "126,102,255"], face: "4,22,40",
    bpm: 96, feel: "sparse", lead: "sine", padOsc: "sine", bright: 1700,
    /* very slow, very wide, and nothing in a hurry to answer */
    hook: motif("7..............." + "c..............." + "a.......7......." + "5..............."),
    chords: [
      { bass: 30, arp: [54, 57, 61, 66] }, { bass: 35, arp: [59, 62, 66, 71] },
      { bass: 33, arp: [57, 60, 64, 69] }, { bass: 28, arp: [52, 55, 59, 64] },
    ],
  },
  {
    id: "requiem", th: "บทเพลงอาลัย", en: "Requiem Vault", zh: "安魂殿",
    sky: ["#2a0714", "#18040e", "#080105"],
    grid: "rgba(255,120,140,.20)", horizon: "255,120,140",
    spots: [[0.24, "255,150,160"], [0.76, "230,230,255"]],
    mote: "255,190,200", back: "stars",
    neon: ["255,80,110", "236,236,255"], face: "30,6,16",
    bpm: 144, feel: "pulse", lead: "sawtooth", padOsc: "sawtooth", bright: 2200,
    /* the last one: a choir that never resolves */
    hook: motif("c...c...a...c..." + "f...f...e...f..." + "h...h...f...h..." + "c...a...7...5..."),
    chords: [
      { bass: 33, arp: [57, 60, 64, 67] }, { bass: 40, arp: [64, 67, 71, 74] },
      { bass: 38, arp: [62, 65, 69, 72] }, { bass: 31, arp: [55, 58, 62, 65] },
    ],
  },
  {
    id: "dojo", th: "โดโจกลางคืน", en: "Night Dojo", zh: "夜之道场",
    sky: ["#2f2418", "#1c1610", "#0a0806"],
    grid: "rgba(255,205,140,.18)", horizon: "255,190,120",
    spots: [[0.24, "255,215,160"], [0.76, "255,170,110"]],
    mote: "255,220,170", back: "lanterns",
    neon: ["255,210,63", "255,90,120"], face: "38,26,16",
    bpm: 128, feel: "drive", lead: "triangle", padOsc: "triangle", bright: 1800,
    hook: motif("5...7...a...7..." + "3...5...7...5..." + "a...c...a...7..." + "5...3...5......."),
    chords: [
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
  let P = GROOVES[ST.feel] || GROOVES.drive;
  let M = ST.hook || null;
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
  /* the melody line. It gets its own voice and its own filter sweep, because
     a hook played on the same pluck as the arpeggio just thickens the
     arpeggio - it has to sit on top of the track to be the thing you
     remember about a place. */
  function lead(t, midi, dur) {
    const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
    o.type = ST.lead || "square";
    o.frequency.value = mf(midi);
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(900, t + dur);
    env(g, t, 0.075, 0.01, dur);
    o.connect(lp); lp.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.06);
  }
  function pad(t, midi, dur) {
    for (const d of [-5, 5]) {
      const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
      o.type = ST.padOsc || "sawtooth"; o.frequency.value = mf(midi); o.detune.value = d;
      lp.type = "lowpass"; lp.frequency.value = ST.bright || 1500;
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
      if (P.arp[gear].includes(s)) pluck(nextTime, ch.arp[Math.floor(s / 2) % ch.arp.length]);
      if (M) { const n = M[step % 64]; if (n != null) lead(nextTime, ch.bass + 12 + n, SPB() * 2); }
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
    setStage(next) {
      if (!next) return;
      ST = next; P = GROOVES[ST.feel] || GROOVES.drive; M = ST.hook || null;
      bpm = gear ? Math.round(ST.bpm * 1.09) : ST.bpm;
    },
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
/* ── the city, laid out once ──────────────────────────────────────────
   Three depth planes with genuine atmospheric perspective. The far plane is
   lighter, bluer and lower in contrast than the near one, and a sheet of
   haze is painted BETWEEN the planes rather than over them — that is the
   actual mechanism, and it is what turns a row of rectangles into distance.
   Built once and cached, never rebuilt inside the frame loop. */
function buildCity(w, hz) {
  const rnd = (n) => { const x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const layers = []; let k = 1;
  for (let L = 0; L < 3; L++) {
    const blocks = [], count = 8 + L * 4, maxH = hz * (0.72 - L * 0.15);
    for (let i = 0; i < count; i++) {
      const bw = w * (0.05 + rnd(k++) * 0.08);
      const bx = (i / count) * w - w * 0.04 + rnd(k++) * (w / count) * 0.7;
      const bh = maxH * (0.34 + rnd(k++) * 0.66);
      const cols = Math.max(2, Math.round(bw / 12)), rows = Math.max(3, Math.round(bh / 16));
      const win = [];
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
        if (rnd(k++) > [0.30, 0.42, 0.50][L]) continue;
        win.push({
          x: bx + 3 + c * ((bw - 6) / cols), y: hz - bh + 5 + r * ((bh - 9) / rows),
          w: Math.max(1.2, (bw - 6) / cols - 2.6), h: Math.max(1.2, (bh - 9) / rows - 3.4),
          warm: rnd(k++) > 0.42, fl: rnd(k++) > 0.9 ? 2 + rnd(k++) * 5 : 0,
        });
      }
      const neon = L > 0 && rnd(k++) > 0.55
        ? { x: bx + 2, y: hz - bh + 12 + rnd(k++) * bh * 0.45, w: bw - 4, h: 2.4 + rnd(k++) * 2.6, hue: Math.floor(rnd(k++) * 360) }
        : null;
      const beacon = L === 2 && rnd(k++) > 0.5 ? { x: bx + bw / 2, y: hz - bh - 4 } : null;
      blocks.push({ x: bx, y: hz - bh, w: bw, h: bh, win, neon, beacon });
    }
    layers.push(blocks);
  }
  return { w, hz, layers };
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
function bakeBackdrop(w, h, dpr, SG, hz, key) {
  let cv;
  try {
    cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(w * dpr));
    cv.height = Math.max(1, Math.round(h * dpr));
  } catch (e) { return null; }
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const lit = [], flick = [], beacons = [];

  /* ── the sky ──
     Painted rather than left to the page background, so the frame has a
     horizon to sit under and the top of the picture is not flat black. */
  const sky = ctx.createLinearGradient(0, 0, 0, hz + 30);
  sky.addColorStop(0, SG.sky[2]); sky.addColorStop(0.55, SG.sky[1]); sky.addColorStop(1, SG.sky[0]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, hz + 30);
  // the key light, and the bloom it throws into the air around it
  const mx = w * 0.74, my = hz * 0.24;
  const mg = ctx.createRadialGradient(mx, my, 2, mx, my, w * 0.34);
  mg.addColorStop(0, `rgba(${SG.horizon},.34)`);
  mg.addColorStop(0.35, `rgba(${SG.horizon},.09)`);
  mg.addColorStop(1, `rgba(${SG.horizon},0)`);
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = mg; ctx.fillRect(0, 0, w, hz + 30);
  ctx.fillStyle = `rgba(240,248,255,.5)`;
  ctx.beginPath(); ctx.arc(mx, my, 9, 0, 7); ctx.fill();
  // the anamorphic streak every real lens puts across a light that bright
  const an = ctx.createLinearGradient(mx - w * 0.3, 0, mx + w * 0.3, 0);
  an.addColorStop(0, `rgba(${SG.horizon},0)`);
  an.addColorStop(0.5, `rgba(${SG.horizon},.22)`);
  an.addColorStop(1, `rgba(${SG.horizon},0)`);
  ctx.fillStyle = an; ctx.fillRect(mx - w * 0.3, my - 1.6, w * 0.6, 3.2);
  ctx.globalCompositeOperation = "source-over";

  /* ── the backdrop ── what is BEHIND the horizon. One routine per stage,
     drawn before the floor so the fighters and the grid sit in front of it. */
  ctx.save();
  if (SG.back === "city") {
    const city = buildCity(w, hz);
    for (let L = 0; L < 3; L++) {
      const FC = SG.face || "16,22,44";
      const face = `rgba(${FC},`;
      for (const b of city.layers[L]) {
        const bg2 = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
        /* Nearer planes are DARKER, not lighter: the far ones sit behind
           more air and pick up the horizon, which is what separates them. */
        bg2.addColorStop(0, face + (0.42 + L * 0.2) + ")");
        bg2.addColorStop(1, face + (0.7 + L * 0.1) + ")");
        ctx.fillStyle = bg2;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        /* the roof edge, lit. Once the slabs went near-black the skyline
           dissolved into a field of loose window lights; one bright line
           per roof is what puts the buildings back. */
        const RN = (SG.neon || ["255,43,214", "63,216,255"])[L % 2];
        ctx.fillStyle = `rgba(${RN},${(0.16 + L * 0.2).toFixed(2)})`;
        ctx.fillRect(b.x - 1, b.y - 1.4, b.w + 2, 2.6);
        ctx.fillStyle = `rgba(${SG.horizon},${0.16 + L * 0.14})`;
        ctx.fillRect(b.x, b.y, b.w, 1.2);
        ctx.fillStyle = "rgba(0,4,12,.22)";
        ctx.fillRect(b.x + b.w - 3, b.y, 3, b.h);
        for (const p of b.win) {
          const col = p.warm
            ? "255,206,138"
            : ((SG.neon || ["255,43,214"])[1] || SG.horizon);
          const a = p.warm ? 0.3 + L * 0.24 : 0.26 + L * 0.22;
          /* a flickering window is baked at its DIMMEST and the pulse added
             back additively each frame, so the bake stays valid all match */
          const f0 = p.fl ? 0.35 : 1;
          ctx.fillStyle = `rgba(${col},${a * f0})`;
          ctx.fillRect(p.x, p.y, p.w, p.h);
          if (p.fl) flick.push({ x: p.x, y: p.y, w: p.w, h: p.h, c: col, a, fl: p.fl });
        }
        if (b.neon) {
          /* The old hue maths funnelled every sign to the same blue-violet
             whatever the arena was. The stage picks its own pair now. */
          const NP = SG.neon || ["255,43,214", "63,216,255"];
          const c = NP[b.neon.hue % NP.length];
          ctx.globalCompositeOperation = "lighter";
          const ng = ctx.createLinearGradient(0, b.neon.y - 7, 0, b.neon.y + b.neon.h + 7);
          ng.addColorStop(0, `rgba(${c},0)`); ng.addColorStop(0.5, `rgba(${c},.5)`); ng.addColorStop(1, `rgba(${c},0)`);
          ctx.fillStyle = ng; ctx.fillRect(b.neon.x - 4, b.neon.y - 7, b.neon.w + 8, b.neon.h + 14);
          ctx.fillStyle = `rgba(255,255,255,.75)`;
          ctx.fillRect(b.neon.x, b.neon.y, b.neon.w, b.neon.h);
          ctx.globalCompositeOperation = "source-over";
          if (L === 2) lit.push({ x: b.neon.x + b.neon.w / 2, w: b.neon.w * 0.9, c, a: 0.3 });
        }
        if (b.beacon) beacons.push({ x: b.beacon.x, y: b.beacon.y });
      }
      // haze BETWEEN the planes: the mechanism, not a filter over the top
      ctx.fillStyle = `rgba(${SG.horizon},${[0.055, 0.03, 0.012][L]})`;
      ctx.fillRect(0, 0, w, hz + 4);
    }
    // the buildings dissolve into the street rather than being cut off at it
    const gf = ctx.createLinearGradient(0, hz - 46, 0, hz + 6);
    gf.addColorStop(0, "rgba(168,198,238,0)");
    gf.addColorStop(1, "rgba(168,198,238,.15)");
    ctx.fillStyle = gf; ctx.fillRect(0, hz - 46, w, 52);
    // street level, where all that light pools before it hits the road
    const sl = ctx.createLinearGradient(0, hz - 40, 0, hz + 4);
    sl.addColorStop(0, `rgba(${SG.horizon},0)`); sl.addColorStop(1, `rgba(${SG.horizon},.2)`);
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = sl; ctx.fillRect(0, hz - 40, w, 44);
    ctx.globalCompositeOperation = "source-over";
    for (let i = 0; i < 9; i++) lit.push({ x: w * (0.06 + i * 0.11), w: 17, c: SG.horizon, a: 0.12 });
  } else if (SG.back === "embers") {
    // the seam itself breathes, so it is drawn live; only its road light is fixed
    for (let i = 0; i < 6; i++) lit.push({ x: w * (0.1 + i * 0.16), w: 34, c: "255,140,60", a: 0.24 });
  } else if (SG.back === "shards") {
    // ice columns catching the light
    for (let i = 0; i < 9; i++) {
      const x = (i / 9) * w + ((i * 61) % 23);
      const h2 = hz * (0.3 + ((i * 47) % 15) / 26), w2 = 12 + ((i * 29) % 16);
      const g = ctx.createLinearGradient(x, hz - h2, x, hz);
      g.addColorStop(0, "rgba(190,240,255,.30)");
      g.addColorStop(1, "rgba(120,190,255,.05)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x, hz); ctx.lineTo(x + w2 / 2, hz - h2); ctx.lineTo(x + w2, hz); ctx.closePath(); ctx.fill();
    }
  } else if (SG.back === "stars") {
    // one slow nebula; the stars themselves twinkle, so they are drawn live
    const g = ctx.createRadialGradient(w * .68, hz * .5, 4, w * .68, hz * .5, w * .5);
    g.addColorStop(0, "rgba(150,110,255,.22)");
    g.addColorStop(1, "rgba(150,110,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hz + 20);
  }
  ctx.restore();

  // two overhead spots, coloured by the stage, so the fighters are lit by
  // the arena rather than pasted onto it
  ctx.globalCompositeOperation = "lighter";
  for (const [fx, col] of SG.spots) {
    const g0 = ctx.createRadialGradient(w * fx, h * 0.9, 2, w * fx, h * 0.9, w * 0.26);
    g0.addColorStop(0, `rgba(${col},.30)`); g0.addColorStop(0.5, `rgba(${col},.10)`); g0.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g0; ctx.fillRect(0, hz - 20, w, h - hz + 20);
  }
  // a glow along the horizon line — the light the room is lit by
  const hg = ctx.createLinearGradient(0, hz - 34, 0, hz + 26);
  hg.addColorStop(0, `rgba(${SG.horizon},0)`); hg.addColorStop(0.55, `rgba(${SG.horizon},.22)`); hg.addColorStop(1, `rgba(${SG.horizon},0)`);
  ctx.fillStyle = hg; ctx.fillRect(0, hz - 34, w, 60);
  ctx.globalCompositeOperation = "source-over";
  ctx.strokeStyle = SG.grid; ctx.lineWidth = 1;
  for (let i = 1; i <= 7; i++) {
    const p = i / 7, y = hz + (h - hz) * p * p;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  for (let i = -6; i <= 6; i++) {
    const x = w / 2 + i * (w / 9);
    ctx.beginPath(); ctx.moveTo(w / 2 + i * 8, hz); ctx.lineTo(x, h); ctx.stroke();
  }
  return { cv, key, lit, flick, beacons };
}

/** The handful of backdrop things that actually change from frame to frame,
    drawn over the blitted bake. Everything static was paid for once already. */
function liveBackdrop(ctx, S, SG, hz, B) {
  // flickering windows: the bake holds their dimmest, this adds the pulse
  if (B.flick.length) {
    ctx.globalCompositeOperation = "lighter";
    for (const p of B.flick) {
      const add = p.a * 0.65 * Math.abs(Math.sin(S.t * p.fl));
      if (add < 0.012) continue;
      ctx.fillStyle = `rgba(${p.c},${add.toFixed(3)})`;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
    ctx.globalCompositeOperation = "source-over";
  }
  if (B.beacons.length) {
    ctx.globalCompositeOperation = "lighter";
    for (const bc of B.beacons) {
      const pu = 0.35 + 0.65 * Math.abs(Math.sin(S.t * 2.2 + bc.x));
      const bg = ctx.createRadialGradient(bc.x, bc.y, 0, bc.x, bc.y, 12);
      bg.addColorStop(0, `rgba(255,90,90,${0.85 * pu})`); bg.addColorStop(1, "rgba(255,90,90,0)");
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(bc.x, bc.y, 12, 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  let road = B.lit;
  if (SG.back === "embers") {
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
  } else if (SG.back === "stars") {
    for (let i = 0; i < 60; i++) {
      const x = ((i * 149) % 997) / 997 * S.w, y = ((i * 233) % 811) / 811 * hz;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(S.t * 1.3 + i));
      ctx.fillStyle = `rgba(230,220,255,${0.5 * tw})`;
      ctx.fillRect(x, y, 1.6, 1.6);
    }
  } else if (SG.back === "lanterns") {
    // paper lanterns hanging in the dark, swinging a little
    road = [];
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
      road.push({ x, w: 18, c: "255,190,110", a: 0.26 });
    }
  }

  /* ── the wet road ──
     Each light above the horizon smeared down the tarmac beneath it,
     wobbling a little as if the surface were moving. Nothing else says
     "night exterior" as cheaply as this does. */
  ctx.globalCompositeOperation = "lighter";
  const rl = (S.h - hz) * 0.72;
  for (const q of road) {
    const wob = Math.sin(S.t * 1.5 + q.x * 0.06) * 3;
    const g2 = ctx.createLinearGradient(0, hz, 0, hz + rl);
    /* zero at the waterline: a smear that starts at full strength draws a
       hard rule across the picture exactly where the road begins */
    g2.addColorStop(0, `rgba(${q.c},0)`);
    g2.addColorStop(0.07, `rgba(${q.c},${q.a})`);
    g2.addColorStop(0.38, `rgba(${q.c},${q.a * 0.32})`);
    g2.addColorStop(1, `rgba(${q.c},0)`);
    ctx.fillStyle = g2;
    // and it widens as it comes toward the camera, like everything else
    const half = q.w / 2, far = half * 1.85, dx = q.x + wob, dx2 = q.x + wob * 2.2;
    ctx.beginPath();
    ctx.moveTo(dx - half, hz); ctx.lineTo(dx + half, hz);
    ctx.lineTo(dx2 + far, hz + rl); ctx.lineTo(dx2 - far, hz + rl);
    ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

/** Build the audio graph while the player is still choosing an opponent.
    The master bus carries a generated reverb impulse — a hundred and thirty
    thousand samples — and whoever asks for sound FIRST pays for it. Left
    alone that was the fight itself: the tap that opens a round would build
    the tail before the arena could draw. Called from the lobby, it is paid
    for during a moment when nothing is moving. */
export function warmArenaAudio() {
  try { audioBus(); } catch (e) {}
}

export function useArenaFx(stage) {
  /* TWO canvases, because the arena is drawn on both sides of the fighters.
     The backdrop — sky, city, floor, the wet road — has to be BEHIND them or
     an opaque sky paints straight over their heads. The effects have to be in
     FRONT of them or a fireball goes off behind the man it hit. One canvas
     cannot be both, and the fighters are DOM elements, so no amount of
     compositing inside a single canvas can fake it. */
  const bgRef = useRef(null);
  const canvasRef = useRef(null);
  const stateRef = useRef(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const bg = bgRef.current;
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
      lines: [], rays: [], pools: [],
      // where the two fighters actually are, as fractions of the stage width —
      // once they can walk, a bolt fired from a fixed 24% leaves from thin air
      pos: { me: 0.24, op: 0.76 }, air: { me: 0, op: 0 },
      flash: null, t: 0, raf: 0, w: 0, h: 0, dpr: 1, motes: [], stage: stage || STAGES[0],
    };
    stateRef.current = S;
    const fxctx = cv.getContext("2d");
    const bgctx = bg ? bg.getContext("2d") : null;
    // without a backdrop canvas everything falls back to the single layer
    let ctx = bgctx || fxctx;

    /* The observer hands us the box for free; asking for it again with
       getBoundingClientRect forces a synchronous layout of a page that has
       just had two thousand fresh SVG nodes inserted into it, and the observer
       fires several times while the arena settles. That measured at 216ms —
       17% of the whole tap-to-playable window — for a number we were already
       given. And a size that has not actually changed is a no-op: reassigning
       a canvas's width reallocates its backing store and throws away the
       baked backdrop with it. */
    const fit = (cw, chh) => {
      let w = cw, h = chh;
      if (w == null || h == null) { const r = cv.getBoundingClientRect(); w = r.width; h = r.height; }
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.max(1, w); h = Math.max(1, h);
      if (dpr === S.dpr && Math.abs(w - S.w) < 0.5 && Math.abs(h - S.h) < 0.5) return;
      S.dpr = dpr; S.w = w; S.h = h;
      cv.width = Math.round(S.w * S.dpr); cv.height = Math.round(S.h * S.dpr);
      fxctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      if (bg && bgctx) {
        bg.width = cv.width; bg.height = cv.height;
        bgctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      }
      // ambient dust, so the arena has air in it even between hits
      S.motes = Array.from({ length: soft ? 0 : 22 }, () => ({
        x: Math.random() * S.w, y: Math.random() * S.h,
        r: 0.6 + Math.random() * 1.5, vy: -(4 + Math.random() * 12), a: 0.1 + Math.random() * 0.25,
      }));
    };
    fit();
    const ro = new ResizeObserver((entries) => {
      const cr = entries && entries[0] && entries[0].contentRect;
      fit(cr ? cr.width : null, cr ? cr.height : null);
    });
    ro.observe(cv);

    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      S.t += dt;
      ctx = bgctx || fxctx;           // the backdrop pass
      ctx.clearRect(0, 0, S.w, S.h);
      if (bgctx) fxctx.clearRect(0, 0, S.w, S.h);

      // ── floor: a perspective grid receding to a horizon behind the fighters
      const hz = S.h * 0.52;
      const SG = S.stage || STAGES[0];

      /* ── the backdrop is painted ONCE ──
         Sky, skyline, spotlights and the floor grid are identical from one
         frame to the next, yet they were being redrawn sixty times a second:
         about six hundred window rectangles and forty gradient objects every
         frame, which measured as a QUARTER of all main-thread time during a
         fight. It is baked into an offscreen canvas now and blitted, and only
         the parts that genuinely move — flickering windows, beacons, lanterns,
         embers, stars, the wet-road smears — are drawn live on top. */
      const bkey = (SG.id || "s") + "|" + Math.round(S.w) + "x" + Math.round(S.h) + "@" + S.dpr;
      if (!S.bake || S.bake.key !== bkey) {
        // a null bake still takes the key, so a failed canvas is not retried
        // sixty times a second for the rest of the match
        S.bake = bakeBackdrop(S.w, S.h, S.dpr, SG, hz, bkey)
          || { cv: null, key: bkey, lit: [], flick: [], beacons: [] };
      }
      if (S.bake.cv) ctx.drawImage(S.bake.cv, 0, 0, S.w, S.h);
      ctx.save();
      liveBackdrop(ctx, S, SG, hz, S.bake);
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

      // ── from here on it is drawn IN FRONT of the fighters ──
      ctx = fxctx;

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

      // ── light shafts: long soft wedges thrown out from a big blast. What a
      //    very bright thing does to the air (and to a lens) around it.
      for (let i = S.rays.length - 1; i >= 0; i--) {
        const r = S.rays[i]; r.p += dt / r.dur;
        if (r.p >= 1) { S.rays.splice(i, 1); continue; }
        const e = 1 - Math.pow(1 - r.p, 2), a2 = Math.pow(1 - r.p, 2.2) * 0.55;
        ctx.save(); ctx.globalAlpha = a2;
        for (let n = 0; n < r.n; n++) {
          const ang = r.a0 + (n / r.n) * Math.PI * 2;
          const len = r.r * (0.5 + 0.5 * Math.abs(Math.sin(n * 5.17 + r.seed))) * (0.4 + 0.6 * e);
          const spread = 0.05 + 0.05 * Math.abs(Math.cos(n * 3.1 + r.seed));
          const g = ctx.createLinearGradient(r.x, r.y, r.x + Math.cos(ang) * len, r.y + Math.sin(ang) * len);
          g.addColorStop(0, r.c); g.addColorStop(1, r.c + "00");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(r.x, r.y);
          ctx.lineTo(r.x + Math.cos(ang - spread) * len, r.y + Math.sin(ang - spread) * len);
          ctx.lineTo(r.x + Math.cos(ang + spread) * len, r.y + Math.sin(ang + spread) * len);
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      }

      // ── the pool of light a blast throws onto the floor beneath it. Without
      //    this an explosion floats; with it the arena is lit by the blast.
      for (let i = S.pools.length - 1; i >= 0; i--) {
        const q = S.pools[i]; q.p += dt / q.dur;
        if (q.p >= 1) { S.pools.splice(i, 1); continue; }
        const a2 = Math.pow(1 - q.p, 2) * 0.6, rr2 = q.r * (0.5 + q.p * 0.9);
        ctx.save(); ctx.translate(q.x, S.h * 0.9); ctx.scale(1, 0.26);
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, rr2);
        g.addColorStop(0, `rgba(255,240,210,${a2})`);
        g.addColorStop(0.5, q.c + Math.round(a2 * 160).toString(16).padStart(2, "0"));
        g.addColorStop(1, q.c + "00");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rr2, 0, 7); ctx.fill();
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
    S.rays.push({ x, y, r: 260 * power, n: 9, a0: Math.random() * 6.28, seed: Math.random() * 100, p: 0, dur: 0.4, c: colour });
    S.pools.push({ x, r: 120 * power, p: 0, dur: 0.5, c: colour });
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
    S.rays.push({ x, y, r: 150 * power, n: 6, a0: Math.random() * 6.28, seed: Math.random() * 100, p: 0, dur: 0.28, c: colour });
    S.pools.push({ x, r: 70 * power, p: 0, dur: 0.34, c: colour });
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

  return { canvasRef, bgRef, burst, bolt, laser, muzzle, boom, lob, flash, setPos, setStage, swipe, impact, beam: bolt };
}

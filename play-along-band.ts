/* ── play-along-band.ts ──
   The band that plays along with a Play Along song, arranged like a small
   production: drums the whole way (kick, snare with a clap in Fever, closed
   and open hats, a tom fill at the end of every fourth bar, a crash on the
   big moments), a warm drone under everything, and then the song builds as
   you play — bass once the combo reaches 3, a string section and open hats
   from 8, and in Fever brass stabs, a plucked arpeggio with an echo, sixteenth
   hats and a crash as it starts. The last chord of the song is a finale.
   Play right and the music fills in — drone from the first hit, bass from 3,
   strings from 8, the Fever layers on top; miss and it drops back to the
   drums until the combo builds again — the drums never stop, so the player
   never loses the beat.

   Everything is scheduled on the audio clock a little ahead of time (see
   pump), the same way the metronome clicks are, so a stalled frame never
   makes a late drum: the sound was already booked. The harmony comes from
   songChordBars() — the same chord-per-bar analysis the left-hand part is
   built from — at half-bar grain for 4/4. Nothing is downloaded: every voice
   is synthesised, and the band's own compressor and echo are built the first
   time it makes a sound.

   Two things the mic changes: a pitched band note coming out of the speaker
   can be heard by the mic as a note the player pressed. So while the mic is
   listening, a player on a real piano gets soft drums only (unpitched, which
   the pitch detector rejects), and a player tapping the screen gets the full
   band with every band note's pitch — and its first partials, since the
   string and brass voices are rich in them — blacklisted from detection while
   it sounds (_accMarkSuppress, the mechanism the game's own sounds use).
   In the left-hand and two-hand modes the band plays no bass — that part is
   the player's — and keeps its chords above it.

   All sound goes through the app's sound bus, so the app-wide mute silences
   the band too. ── */
import { audioBus, _accMarkSuppress, _accNoise, _sfxMuted, _micSafe } from "./music-engine";

export const BAND_LEVELS = [0, 0.55, 1];   // off, soft, normal
const LOOKAHEAD = 0.35;                    // seconds booked ahead of the audio clock
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// a chord's notes as MIDI numbers, stacked upward from the root at `oct`:
// root, third, fifth, root an octave up (C3 = 48)
function stack(c, oct) {
  const r = 12 * (oct + 1) + c.root;
  const up = (pc) => r + ((pc - c.root + 12) % 12);
  return [r, up(c.pcs[1]), up(c.pcs[2]), r + 12];
}

/* opts: bars (songChordBars, split), beatsPerBar, pickup, spb (seconds per
   beat at 1×), lead (song time of the first note), endBeat (last beat to
   play, from the first note), hand. */
export function createBand(opts) {
  const { bars, beatsPerBar: bpb, pickup, spb, lead, endBeat, hand } = opts;
  let level = opts.level == null ? 2 : opts.level;
  let chain = null, nextHalf = null;        // the run's audio chain; next half-beat to book
  let wasFever = false, lastTempo = 0;
  const log = [];                           // what was booked on the beat grid (the test hook reads it)
  const state = { combo: 0, fever: false, mega: false, pitched: true, soft: false, micOpen: false };

  function chordAt(beat) {
    let c = bars[0] || null;
    for (const b of bars) { if (b.at <= beat + 1e-6) c = b; else break; }
    return c;
  }
  /* The band's own chain, built the first time it sounds:
       voices → mix → compressor → master → the app's bus
     plus one echo (a dotted eighth, fed back a third of the way, dark) that
     the plucks and the brass are sent into. */
  function node() {
    if (chain) return chain;
    const { ac, bus } = audioBus();
    const mix = ac.createGain();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -22; comp.knee.value = 14; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.16;
    const master = ac.createGain();
    master.gain.value = BAND_LEVELS[level] * 0.8;
    mix.connect(comp); comp.connect(master); master.connect(bus);
    const send = ac.createGain(); send.gain.value = 1;
    const delay = ac.createDelay(1.2); delay.delayTime.value = 0.75 * spb;
    const fb = ac.createGain(); fb.gain.value = 0.32;
    const dark = ac.createBiquadFilter(); dark.type = "lowpass"; dark.frequency.value = 2600;
    send.connect(delay); delay.connect(dark); dark.connect(fb); fb.connect(delay); dark.connect(mix);
    chain = { mix, master, send, delay };
    return chain;
  }
  function suppress(f, when, dur, partials = 1) {
    if (!f || !state.micOpen) return;
    const { ac } = audioBus();
    const until = Date.now() + Math.max(0, (when - ac.currentTime + dur) * 1000) + 150;
    for (let k = 1; k <= partials; k++) { if (f * k > 1800) break; _accMarkSuppress(f * k, 45, until); }
  }

  // ── the drums ──
  function kick(when, v) {
    const { ac } = audioBus(), o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(170, when);
    o.frequency.exponentialRampToValueAtTime(52, when + 0.11);   // starts high enough for a phone speaker to carry it
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.5 * v, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    o.connect(g); g.connect(node().mix); o.start(when); o.stop(when + 0.24);
    const k = ac.createOscillator(), kg = ac.createGain();            // the knock: what a phone speaker actually plays of a kick
    k.type = "triangle";
    k.frequency.setValueAtTime(340, when); k.frequency.exponentialRampToValueAtTime(130, when + 0.045);
    kg.gain.setValueAtTime(0.0001, when);
    kg.gain.exponentialRampToValueAtTime(0.2 * v, when + 0.003);
    kg.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
    k.connect(kg); kg.connect(node().mix); k.start(when); k.stop(when + 0.08);
    noiseHit(when, 0.1 * v, "bandpass", 3200, 1.2, 0.012);          // the beater's click
  }
  function noiseHit(when, v, type, freq, q, dur, loop = false, dest = null) {
    const { ac } = audioBus(), n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    n.buffer = _accNoise(ac); n.loop = loop;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(v, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    n.connect(f); f.connect(g); g.connect(dest || node().mix); n.start(when); n.stop(when + dur + 0.02);
  }
  function snare(when, v) {
    noiseHit(when, 0.26 * v, "bandpass", 1900, 0.8, 0.15);
    noiseHit(when, 0.1 * v, "highpass", 5200, 0.7, 0.07);
    const { ac } = audioBus(), o = ac.createOscillator(), g = ac.createGain();   // the body
    o.type = "triangle";
    o.frequency.setValueAtTime(330, when); o.frequency.exponentialRampToValueAtTime(230, when + 0.06);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.14 * v, when + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
    o.connect(g); g.connect(node().mix); o.start(when); o.stop(when + 0.1);
  }
  function clap(when, v) {                     // three quick bursts, a hand-clap
    for (let k = 0; k < 3; k++) noiseHit(when + k * 0.011, 0.11 * v, "bandpass", 1500, 1.4, 0.05);
  }
  const hat = (when, v, open) => open ? noiseHit(when, 0.07 * v, "highpass", 6500, 0.7, 0.16) : noiseHit(when, 0.08 * v, "highpass", 7000, 0.7, 0.04);
  function crash(when, v) { noiseHit(when, 0.13 * v, "highpass", 4800, 0.6, 1.3, true); }
  function tom(when, f, v) {
    const { ac } = audioBus(), o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(f * 1.35, when); o.frequency.exponentialRampToValueAtTime(f, when + 0.08);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.26 * v, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
    o.connect(g); g.connect(node().mix); o.start(when); o.stop(when + 0.32);
    const h = ac.createOscillator(), hg = ac.createGain();            // its second partial, which a phone can play
    h.type = "triangle"; h.frequency.setValueAtTime(f * 2.7, when); h.frequency.exponentialRampToValueAtTime(f * 2, when + 0.08);
    hg.gain.setValueAtTime(0.0001, when);
    hg.gain.exponentialRampToValueAtTime(0.13 * v, when + 0.004);
    hg.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
    h.connect(hg); hg.connect(node().mix); h.start(when); h.stop(when + 0.22);
  }

  // ── the pitched voices ──
  /* Several notes through ONE filter and ONE envelope (a chord is a section,
     not a handful of separate instruments): each note is `voices` oscillators
     detuned apart, which is what makes a single saw sound like an ensemble.
     o: v (level per oscillator), type, attack, release, cutoff [, cutoff2,
     sweep] (a filter that opens and closes), detune (cents), echo (send level),
     partials (for the mic blacklist) */
  function section(when, midis, dur, o) {
    const { ac } = audioBus(), c = node();
    const g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = "lowpass"; f.Q.value = o.q || 0.6;
    f.frequency.setValueAtTime(o.cutoff, when);
    if (o.cutoff2) f.frequency.exponentialRampToValueAtTime(o.cutoff2, when + (o.sweep || 0.12));
    const a = o.attack || 0.02, r = Math.min(o.release || 0.2, dur * 0.6), end = when + dur;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(1, when + a);
    g.gain.setValueAtTime(1, Math.max(when + a, end - r));
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    f.connect(g); g.connect(c.mix);
    if (o.echo) { const s = ac.createGain(); s.gain.value = o.echo; g.connect(s); s.connect(c.send); }
    const det = o.detune == null ? 7 : o.detune;
    for (const m of midis) {
      const fr = mtof(m);
      for (const d of det ? [-det, det] : [0]) {
        const osc = ac.createOscillator(), vg = ac.createGain();
        osc.type = o.type || "sawtooth"; osc.frequency.value = fr; osc.detune.value = d;
        vg.gain.value = o.v;
        osc.connect(vg); vg.connect(f); osc.start(when); osc.stop(end + 0.05);
      }
      suppress(fr, when, dur, o.partials || 3);
    }
  }
  // one bass note: a saw through a closing filter for the attack, a sine under it
  function bass(when, m, dur, v) {
    const { ac } = audioBus(), fr = mtof(m);
    const g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = "lowpass"; f.Q.value = 1.1;
    f.frequency.setValueAtTime(950, when); f.frequency.exponentialRampToValueAtTime(280, when + Math.min(0.2, dur));
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(v, when + 0.008);
    g.gain.setValueAtTime(v, when + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const a = ac.createOscillator(), b = ac.createOscillator(), bg = ac.createGain();
    a.type = "sawtooth"; a.frequency.value = fr; b.type = "sine"; b.frequency.value = fr; bg.gain.value = 0.9;
    a.connect(f); b.connect(bg); bg.connect(f); f.connect(g); g.connect(node().mix);
    a.start(when); b.start(when); a.stop(when + dur + 0.03); b.stop(when + dur + 0.03);
    suppress(fr, when, dur, 3);
  }
  // a plucked note for the arpeggio: a triangle with a sine an octave up, short, sent to the echo
  function pluck(when, m, dur, v) {
    const { ac } = audioBus(), c = node(), fr = mtof(m);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(v, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const s = ac.createGain(); s.gain.value = 0.42;
    g.connect(c.mix); g.connect(s); s.connect(c.send);
    const a = ac.createOscillator(), b = ac.createOscillator(), bg = ac.createGain();
    a.type = "triangle"; a.frequency.value = fr; b.type = "sine"; b.frequency.value = fr * 2; bg.gain.value = 0.35;
    a.connect(g); b.connect(bg); bg.connect(g);
    a.start(when); b.start(when); a.stop(when + dur + 0.03); b.stop(when + dur + 0.03);
    suppress(fr, when, dur + 0.3, 2);
  }

  /* Book every half-beat from where we are up to LOOKAHEAD ahead.
     songTime = the song clock now; toAudio(t) = the audio time of song
     time t. Beat k (from the first note) is at song time lead + k·spb.
     Nothing before song time minSong plays (a practice pass's count-in). */
  function pump(songTime, toAudio, tempo, minSong = 0) {
    if (!level || _sfxMuted) { nextHalf = null; return; }
    const { ac } = audioBus();
    if (chain && Math.abs(tempo - lastTempo) > 0.005) {        // the echo keeps to the beat when a drill changes the tempo
      lastTempo = tempo;
      chain.delay.delayTime.setTargetAtTime(Math.min(1.1, 0.75 * spb / tempo), ac.currentTime, 0.05);
    }
    // Fever begins: a crash, right now (it is a reaction to a hit, not on the grid)
    const feverNow = !!(state.fever && state.pitched && !state.soft);
    if (feverNow && !wasFever && (songTime - lead) / spb >= 0) crash(ac.currentTime + 0.03, 0.9);
    wasFever = feverNow;
    let h = nextHalf;
    if (h == null) h = Math.ceil(((songTime - lead) / spb) * 2 - 1e-6);
    for (let guard = 0; guard < 32; guard++) {
      const beat = h / 2, st = lead + beat * spb;
      const when = toAudio(st);
      if (when > ac.currentTime + LOOKAHEAD) break;
      if (beat > endBeat + 0.01) { h++; continue; }
      if (beat >= 0 && st >= minSong - 1e-3 && when >= ac.currentTime - 0.02) play(beat, Math.max(when, ac.currentTime), spb / tempo);
      h++;
    }
    nextHalf = h;
  }
  function play(beat, when, beatSec) {
    const pos = ((((beat - pickup) % bpb) + bpb) % bpb);
    const onBeat = Math.abs(pos - Math.round(pos)) < 1e-6;
    const p = Math.round(pos);
    const bar = Math.floor((beat - pickup) / bpb + 1e-6);
    const dv = state.soft ? 0.5 : 1;
    const full = state.pitched && !state.soft;
    const L1 = full && state.combo >= 3, L2 = full && state.combo >= 8;
    const fever = full && state.fever, mega = fever && state.mega;
    // ── drums: kick on 1 (and 3 in 4/4), snare on the backbeats, hats between
    let drum = "hat";
    if (onBeat) {
      if (p === 0 || (bpb === 4 && p === 2)) { kick(when, dv); drum = "kick"; }
      else { snare(when, (bpb === 3 ? 0.6 : 1) * dv); drum = "snare"; if (fever) clap(when, 0.8); }
    }
    hat(when, (onBeat ? 1 : L2 ? 0.75 : 0.7) * dv, !onBeat && L2);          // open hats on the off-beats from combo 8
    if (mega) hat(when + beatSec * 0.25, 0.5, false);                          // sixteenths
    const entry = { beat, when, drum, pos, parts: "", extras: "" };   // parts: the pitched layers; extras: crash and toms
    log.push(entry);
    if (log.length > 400) log.shift();
    if (!full) return;
    const c = chordAt(beat);
    if (!c) return;
    const chordStart = Math.abs(beat - c.at) < 1e-6;
    const last = c === bars[bars.length - 1];
    const finale = chordStart && last && L1 && bars.length > 1;
    // ── the opening: a crash on the first note of the song
    if (beat < 1e-6) { crash(when, 0.55); entry.extras += "o"; }
    // ── the end of every fourth bar: a fill of toms, and a crash on the bar after it
    if (L2 && (bar + 1) % 4 === 0 && Math.abs(pos - (bpb - 0.5)) < 1e-6) {
      tom(when, 200, 0.8); tom(when + beatSec * 0.17, 150, 0.8); tom(when + beatSec * 0.34, 105, 0.9);
      entry.extras += "f";
    }
    if (L2 && bar > 0 && bar % 4 === 0 && p === 0 && onBeat) { crash(when, 0.4); entry.extras += "k"; }
    // ── bass: root, root, fifth, root on the beats (waltz: root, fifth, fifth), and an octave bump
    //    on the off-beats in Fever. Not when the player has the left hand.
    if (L1 && hand === "right" && !finale) {
      const root = 12 * 3 + c.root;                                            // C2 = 36
      const fifth = root + ((c.pcs[2] - c.root + 12) % 12);
      if (onBeat) {
        const long = p === 0 || (bpb === 4 && p === 2);
        const m = bpb === 4 ? (p === 2 ? fifth : root) : (p === 0 ? root : fifth);
        bass(when, m, beatSec * (long ? 0.92 : 0.45), long ? 0.3 : 0.24);
        entry.parts += "b";
      } else if (fever) {
        bass(when, root + 12, beatSec * 0.32, 0.17);
        entry.parts += "b";
      }
    }
    // ── chords, at the start of each: a drone from the beginning, strings once the combo is 8
    if (chordStart) {
      const dur = Math.min(c.len, Math.max(1, endBeat - c.at + 1)) * beatSec;
      const low = hand === "right";
      const notes = stack(c, low ? 3 : 4);
      if (!finale && state.combo >= 1) {                                       // (before a first hit the band cannot know it is not a piano on the mic)
        section(when, [notes[0], notes[2]], dur * 0.98, { v: 0.03, type: "sine", attack: 0.25, release: 0.4, cutoff: 3000, detune: 0, partials: 2 });
        entry.parts += "d";
      }
      if (L2 || finale) {
        section(when, notes, dur * (finale ? 1.6 : 0.98), { v: 0.026, type: "sawtooth", attack: finale ? 0.05 : 0.16, release: finale ? 1.2 : 0.4, cutoff: 1350, q: 0.7, detune: 7, partials: 3 });
        entry.parts += "c";
      }
      if (fever || finale) {                                                   // brass stabs on the chord changes
        const br = stack(c, 4).slice(0, 3);
        section(when, br, beatSec * (finale ? 1.2 : 0.34), { v: 0.05, type: "sawtooth", attack: 0.012, release: 0.14, cutoff: 3600, cutoff2: 950, sweep: 0.13, q: 0.8, detune: 6, echo: 0.3, partials: 3 });
        entry.parts += "x";
      }
      if (finale) {                                                            // the finale: everything at once
        kick(when, 1); crash(when, 1);
        bass(when, 12 * 3 + c.root, beatSec * 2, 0.34);
        tom(when, 90, 0.9);
        entry.parts += "!";
      }
    }
    // ── Fever: an arpeggio of the chord, plucked, up and down, on every half-beat
    if (fever && !finale) {
      const k = Math.round((beat - c.at) * 2), pat = [0, 1, 2, 3, 2, 1], idx = pat[((k % 6) + 6) % 6];
      const off = idx === 3 ? 12 : (c.pcs[idx] - c.root + 12) % 12;            // root, third, fifth, octave
      pluck(when, 12 * 6 + c.root + off + (mega ? 12 : 0), beatSec * 0.42, 0.075);   // C5 = 72
      entry.parts += "a";
    }
  }

  return {
    pump,
    log,
    state,
    chordAt,
    setState(s) { Object.assign(state, s); },
    setLevel(l) { level = l; if (chain) chain.master.gain.value = BAND_LEVELS[level] * 0.8; },
    /* Stop what is booked (pause, a new pass, the end): the master fades and
       is dropped, so notes already booked go silent with it. */
    cut() {
      if (chain) {
        try { const { ac } = audioBus(); const m = chain.master; m.gain.cancelScheduledValues(ac.currentTime); m.gain.setTargetAtTime(0, ac.currentTime, 0.02); setTimeout(() => { try { m.disconnect(); } catch (e) {} }, 300); } catch (e) {}
      }
      chain = null; nextHalf = null; wasFever = false;
    },
    /* The song ended by itself: let the last chord ring out and fade over
       `secs` instead of cutting it. */
    ringOut(secs = 1.8) {
      if (chain) {
        try { const { ac } = audioBus(); const m = chain.master; const t = ac.currentTime; m.gain.cancelScheduledValues(t); m.gain.setValueAtTime(m.gain.value, t); m.gain.linearRampToValueAtTime(0, t + secs); setTimeout(() => { try { m.disconnect(); } catch (e) {} }, secs * 1000 + 200); } catch (e) {}
      }
      chain = null; nextHalf = null; wasFever = false;
    },
    /* The count-in and the drill's pass count-ins: drum sticks. */
    stick(when, accent) {
      if (!level || _sfxMuted) return false;
      noiseHit(when, accent ? 0.34 : 0.22, "bandpass", accent ? 2600 : 2200, 3, 0.05);
      const { ac } = audioBus(), o = ac.createOscillator(), g = ac.createGain();
      o.type = "sine"; o.frequency.value = accent ? 1760 : 1480;
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(accent ? 0.05 : 0.035, when + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
      o.connect(g); g.connect(node().mix); o.start(when); o.stop(when + 0.05);
      suppress(accent ? 1760 : 1480, when, 0.03);
      return true;
    },
  };
}

/* The hit "ding": a short bell on a note of the chord playing right now,
   climbing through the chord's notes as the combo grows — in the song's key,
   unlike the C-major ladder it replaces. An effect, so it obeys the mute. */
export function playChordDing(chord, combo, vol = 1) {
  try {
    if (_sfxMuted || _micSafe) return;      // a bell inside the piano's range is what a microphone hears as the player's next note
    const pcs = chord && chord.pcs && chord.pcs.length ? chord.pcs : [0, 4, 7];
    const i = Math.max(0, combo - 1) % (pcs.length * 2);
    const f = mtof(12 * (i < pcs.length ? 6 : 7) + (pcs[i % pcs.length] % 12));
    if (!f) return;
    const { ac, bus } = audioBus(), t0 = ac.currentTime;
    _accMarkSuppress(f, 50, Date.now() + 380);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.11 * vol, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + 0.25);
  } catch (e) {}
}

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

export const BAND_LEVELS = [0, 0.55, 1, 1.35];   // off, soft, normal, full
const LOOKAHEAD = 0.35;
/* the band's master gain. Owner 2026-10-10: "the backing track is too quiet, ten percent louder" — 0.21 -> 0.231 (+0.83 dB).
   Checked against the three numbers that decide the mix (no clipping, <= 90 % of the energy under 250 Hz, band >= 12 dB under the
   player's note): the quietest margin before the change was the carol style at -13.4 dB, so it lands at about -12.6 dB.
   Owner 2026-10-10, again: "another fifteen percent" -> 0.231 -> 0.2657 (+1.2 dB). That alone would take carol (organ) and the
   classical waltz past the 12 dB gate, so the organ drawbars are trimmed to compensate (see organ below). */
const MASTER = 0.2923;
/* ...and ten percent more again (owner, 2026-10-10). The three numbers that decide the mix have no room left for a plain gain
   increase — the classical waltz and carol sat 0.3 and 0.8 dB above the 12 dB gate — and the voices that decide them are the ones
   that live in the player's octave (the section() voices: pads, strings, organ, celesta, horn, wind, sax, vibes). So this time the
   master goes up and those voices are held where they were (SECT = 1 / (0.2923 / 0.2657)): drums, bass, harpsichord and plucks get
   the full ten percent, the voices that could mask the tune get none. */
const SECT = 0.2657 / 0.2923;                    // seconds booked ahead of the audio clock

/* ── the arrangement per song (owner, 2026-10-03: "the backing track has to be
   beautiful — add whatever sounds suit the piece") ──
   Before this the band played one kit for all 1,067 songs: a Baroque fugue and
   a jazz shuffle got the same rock drums. The song's genre/era was already in
   the data — SONG_GENRES (songs-data.ts), one value per song — but createBand
   never saw it. The caller passes it as `style` and this table turns it into a
   kit, a lead voice and a pad.

   A style this table does not know (a song the player wrote, an id missing from
   SONG_GENRES) falls through to `rock`, which is byte-for-byte what the band
   has always played — nothing changes for a song we cannot place. */
export const BAND_STYLES = {
  baroque:       { drums: "none",    lead: "harpsichord", pad: "continuo", extra: ["flute", "harp"] },
  classical:     { drums: "timpani", lead: "strings",     pad: "strings",   extra: ["oboe", "horn"] },
  romantic:      { drums: "soft",    lead: "strings",     pad: "strings",   extra: ["horn", "harp"] },
  impressionism: { drums: "none",    lead: "celesta",     pad: "softpad",   extra: ["flute", "harp"] },
  kids:          { drums: "clap",    lead: "pluck",       pad: "musicbox",  extra: ["vibes", "flute"] },
  folk:          { drums: "clap",    lead: "pluck",       pad: "pluck",     extra: ["strum", "flute"] },
  cn:            { drums: "soft",    lead: "pluck",       pad: "pluck",     extra: ["flute", "harp"] },
  carol:         { drums: "none",    lead: "organ",       pad: "organ",     extra: ["flute", "horn"] },
  gospel:        { drums: "soft",    lead: "organ",       pad: "strings",   extra: ["horn", "sax"] },
  jazz:          { drums: "ride",    lead: "pluck",       pad: "comping",   extra: ["vibes", "sax"] },
  /* the jazz & blues originals carry their idiom in the index row's `sty` and no genre
     of their own (they are not in SONG_GENRES — they are not even in the bundle), so
     without these three keys a blues would ride the default rock kit: a snare backbeat
     under a shuffle. blues/swing/bossa book the ride cymbal and the comping pad, which
     is what the pieces themselves are written for. */
  blues:         { drums: "ride",    lead: "pluck",       pad: "comping",   extra: ["sax", "vibes"] },
  swing:         { drums: "ride",    lead: "pluck",       pad: "comping",   extra: ["sax", "vibes"] },
  bossa:         { drums: "clap",    lead: "epiano",      pad: "comping",   extra: ["vibes", "strum"] },
  soul:          { drums: "soft",    lead: "epiano",      pad: "strings",   extra: ["sax", "horn"] },
  neosoul:       { drums: "soft",    lead: "epiano",      pad: "pad",       extra: ["vibes", "sax"] },
};
const styleOf = (s) => BAND_STYLES[s] || null;      // null = the default rock band
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
   play, from the first note), hand, bpm (the song's tempo — only the
   density, never the pitch), style (a key of BAND_STYLES). */
export function createBand(opts) {
  const { bars, beatsPerBar: bpb, pickup, spb, lead, endBeat, hand } = opts;
  const kit = styleOf(opts.style);
  /* M4 — the tempo decides how busy the band is, never what it plays. A slow
     ballad at 52 bpm and a shuffle at 180 bpm were given the same sixteenth-note
     hats. Derived from the song's own bpm, so the same song always books the
     same thing. */
  const bpm = opts.bpm || 0;
  const slow = bpm > 0 && bpm < 70, fast = bpm >= 140;
  /* ── M7 · the player's own notes, so the band can leave them room ──
     The caller passes `mel` (the same melody the player is about to play, as
     {beat, dur, midi}). Where a melody note is sounding, the voices that live
     in the melody's octave drop away or move down: the accompaniment's job is
     to sit under the player, not to play the tune over them. Without `mel` —
     a drill, a caller that does not have it — melBusy() is false everywhere
     and the band is exactly what it was. */
  const melList = (opts.mel || []).slice().sort((a, b) => a.beat - b.beat);
  let melAt = 0;
  function melBusy(beat) {
    while (melAt > 0 && melList[melAt - 1] && melList[melAt - 1].beat > beat) melAt--;
    while (melAt < melList.length && melList[melAt].beat + melList[melAt].dur <= beat) melAt++;
    const n = melList[melAt];
    return !!(n && n.beat <= beat && beat < n.beat + n.dur);
  }
  const lastBar = Math.max(0, Math.floor((endBeat - pickup) / bpb + 1e-6));
  /* ── M7 · the shape of the song. A band that plays every bar at the same
     volume is the reason a backing track sounds like a metronome with notes.
     A four-bar phrase: it sits back, rises, lifts on the fourth bar and
     breathes after it; the first two bars of the song start behind the
     player, and the last one leans in. Everything the band plays is scaled by
     it, so the arc is in the drum hit and in the pad alike.
     ── M10 · the phrase has to be the SONG's metre, not 4/4's. Measured on the
     real band, 3/4 came out at 1.5 dB of movement across the whole piece —
     indistinguishable from flat — because a three-beat bar cannot hold a
     four-beat phrase without the peak and the trough landing on the same
     strength. Each metre gets a curve shaped for it: a waltz leans on ONE and
     lifts on TWO, a march pushes every downbeat. */
  const LIFT = bpb === 3 ? [0.34, 1, 0.45]
    : bpb === 2 ? [0.55, 1]
    : bpb === 6 ? [0.45, 0.95, 0.5, 1, 0.6, 0.55]
    : [0.7, 0.86, 0.78, 1];
  function arcAt(bar, p, onBeat) {
    const lift = LIFT[((bar % LIFT.length) + LIFT.length) % LIFT.length];
    const intro = bar < 2 ? 0.72 : 1;
    const coda = bar >= lastBar - 1 ? 1.12 : 1;
    const beat = p === 0 ? 1.18 : (onBeat ? 0.92 : 0.76);
    return lift * intro * coda * beat;
  }
  /* ── ขั้น 0 · the test hook. `solo` names which layers the band is allowed to
     play, so scripts/measure-band-parts.mjs can render one voice at a time and
     measure what each one contributes instead of guessing from the mix. A
     caller that passes nothing plays everything, exactly as before. */
  const SOLO = opts.solo ? new Set([].concat(opts.solo)) : null;
  const on = (k) => !SOLO || SOLO.has(k);
  /* M1 — the drums follow the song's metre. 375 of the 875 classical pieces are
     3/4 and 123 are 2/4, and a waltz played with a rock backbeat is the loudest
     wrong thing this band was doing. */
  const waltz = bpb === 3, march = bpb === 2;
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
    /* M7 · the band's own bus. Measured on the real band, 12 bars, combo 12:
       voices → air (a shelf that puts the hats, the celesta and the harpsichord
       back on top of a mix that had 96 % of its energy under 250 Hz) → a soft
       saturator → the compressor → the master.
       The saturator is there because the band's own sum peaked at +2.2 dBFS
       before any limiting — on a phone every downbeat was hard-clipping, and
       hard clipping is the sound of "cheap". A tanh curve takes those peaks
       down smoothly, so it reads as a bigger band, not a broken one. */
    const air = ac.createBiquadFilter();
    air.type = "highshelf"; air.frequency.value = 4200; air.gain.value = 4.5;
    const sat = ac.createWaveShaper ? ac.createWaveShaper() : null;
    if (sat) {
      /* A ceiling that is transparent below 0.7 and leans on anything above it:
         y = x / (1 + |x|³)^⅓. The gain at small signals is exactly 1 — a tanh
         curve with a make-up gain would quietly add 6 dB to the whole band,
         which is how the first version of this measured louder than the one it
         replaced. */
      const curve = new Float32Array(2049);
      for (let i = 0; i < curve.length; i++) {
        const x = (i / 1024) - 1;
        curve[i] = Math.sign(x) * Math.abs(x) / Math.cbrt(1 + Math.pow(Math.abs(x), 3));
      }
      sat.curve = curve; sat.oversample = "2x";
    }
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.18;
    /* M11 · the band's level is BOUNDED BY THE PLAYER'S OWN NOTE, not by taste.
       The band is the only thing here measured against something outside
       itself: playPianoNote plays the learner's note at a fixed level, so
       turning the band up moves the melody-mask number by exactly the same
       number of decibels. Lifting the master by 1 dB spends 1 dB of the margin
       that keeps the learner able to hear themselves play. That margin is worth
       more than loudness — a backing track the player cannot hear themselves
       over is the exact failure Play Along exists to avoid — so the master sits
       where the mask gate allows, not where the loudness wants it. */
    const master = ac.createGain();
    master.gain.value = BAND_LEVELS[level] * MASTER;
    if (sat) { mix.connect(air); air.connect(sat); sat.connect(comp); }
    else mix.connect(comp);
    comp.connect(master); master.connect(bus);
    const send = ac.createGain(); send.gain.value = 1;
    const delay = ac.createDelay(1.2); delay.delayTime.value = 0.75 * spb;
    const fb = ac.createGain(); fb.gain.value = 0.3;
    const dark = ac.createBiquadFilter(); dark.type = "lowpass"; dark.frequency.value = 2600;
    send.connect(delay); delay.connect(dark); dark.connect(fb); fb.connect(delay); dark.connect(mix);
    chain = { mix, master, send, delay, pans: {}, ac };
    return chain;
  }
  /* ── M8 · where each voice SITS. The band used to arrive as one point in the
     middle of the head: measured on the real code there was no panner anywhere
     in it, so every kick, pad and pluck summed to a single mono channel. Width
     is the cheapest thing there is to fix and it is most of what "the band is
     in the room" is made of. Bass and kick stay centred — a panned bass reads as
     a mistake — and the voices that can carry a place are pushed off it.

     The positions are static per voice, chosen by what the instrument is, never
     random: a real kit puts the toms to the side of the kick and the cymbals
     across the top, and a section divides left and right. Equal-power law is
     the browser's own, so the same positions land the same way on every device.

     Falls back to the plain mix on any browser without StereoPannerNode, so
     this can never be the thing that breaks the band. */
  const PAN = { drums: 0.1, b: 0, n: 0.3, c: -0.4, l: 0.45, x: -0.15, m: 0.35, a: -0.45, w: 0.5, e: -0.35, h: -0.25, v: 0.25 };
  function panTo(kind) {
    const c = node(), p = PAN[kind] || 0;
    if (!p) return c.mix;
    let n = c.pans[kind];
    if (n === undefined) {
      n = c.ac && c.ac.createStereoPanner ? c.ac.createStereoPanner() : null;
      if (n) { try { n.pan.value = p; n.connect(c.mix); } catch (e) { n = null; } }
      c.pans[kind] = n;
    }
    return n || c.mix;
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
    g.gain.exponentialRampToValueAtTime(0.38 * v, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    o.connect(g); g.connect(panTo("drums")); o.start(when); o.stop(when + 0.24);
    const k = ac.createOscillator(), kg = ac.createGain();            // the knock: what a phone speaker actually plays of a kick
    k.type = "triangle";
    k.frequency.setValueAtTime(340, when); k.frequency.exponentialRampToValueAtTime(130, when + 0.045);
    kg.gain.setValueAtTime(0.0001, when);
    kg.gain.exponentialRampToValueAtTime(0.14 * v, when + 0.003);
    kg.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
    k.connect(kg); kg.connect(panTo("drums")); k.start(when); k.stop(when + 0.08);
    noiseHit(when, 0.09 * v, "bandpass", 3200, 1.2, 0.012, false, panTo("drums"));          // the beater's click
  }
  function noiseHit(when, v, type, freq, q, dur, loop = false, dest = null) {
    const { ac } = audioBus(), n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    n.buffer = _accNoise(ac); n.loop = loop;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(v, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    n.connect(f); f.connect(g); g.connect(dest || panTo("drums")); n.start(when); n.stop(when + dur + 0.02);
  }
  function snare(when, v) {
    noiseHit(when, 0.24 * v, "bandpass", 1900, 0.8, 0.15);
    noiseHit(when, 0.11 * v, "highpass", 5200, 0.7, 0.07);
    const { ac } = audioBus(), o = ac.createOscillator(), g = ac.createGain();   // the body
    o.type = "triangle";
    o.frequency.setValueAtTime(330, when); o.frequency.exponentialRampToValueAtTime(230, when + 0.06);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.12 * v, when + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
    o.connect(g); g.connect(panTo("drums")); o.start(when); o.stop(when + 0.1);
  }
  function clap(when, v) {                     // three quick bursts, a hand-clap
    for (let k = 0; k < 3; k++) noiseHit(when + k * 0.011, 0.11 * v, "bandpass", 1500, 1.4, 0.05);
  }
  /* M9 · the cymbals are the one place brightness is FREE: they sit at 5–8 kHz,
     two octaves above anything the pitch detector or the player's note lives
     in, so they can be turned up as far as they like without ever masking the
     tune. They were also doing almost nothing — the whole mix measured 0.0 % of
     its energy above 2.5 kHz, which is what "the hat is there but you cannot
     hear it" looks like on a meter. */
  const hat = (when, v, open) => open ? noiseHit(when, 0.15 * v, "highpass", 6500, 0.7, 0.16) : noiseHit(when, 0.16 * v, "highpass", 7000, 0.7, 0.045);
  // the jazz ride: a ringing ping, not the flat tick of a hat
  const ride = (when, v) => {
    noiseHit(when, 0.15 * v, "bandpass", 6200, 0.9, 0.26);
    noiseHit(when, 0.07 * v, "highpass", 8200, 0.7, 0.11);
  };
  function crash(when, v) { noiseHit(when, 0.2 * v, "highpass", 4800, 0.6, 1.3, true); }
  function tom(when, f, v) {
    const { ac } = audioBus(), o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(f * 1.35, when); o.frequency.exponentialRampToValueAtTime(f, when + 0.08);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.26 * v, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.3);
    o.connect(g); g.connect(panTo("drums")); o.start(when); o.stop(when + 0.32);
    const h = ac.createOscillator(), hg = ac.createGain();            // its second partial, which a phone can play
    h.type = "triangle"; h.frequency.setValueAtTime(f * 2.7, when); h.frequency.exponentialRampToValueAtTime(f * 2, when + 0.08);
    hg.gain.setValueAtTime(0.0001, when);
    hg.gain.exponentialRampToValueAtTime(0.13 * v, when + 0.004);
    hg.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
    h.connect(hg); hg.connect(panTo("drums")); h.start(when); h.stop(when + 0.22);
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
    f.connect(g); g.connect(o.pan ? panTo(o.pan) : c.mix);
    if (o.echo) { const s = ac.createGain(); s.gain.value = o.echo; g.connect(s); s.connect(c.send); }
    const det = o.detune == null ? 7 : o.detune;
    /* a player's vibrato: a slow pitch wobble that arrives a moment after the note starts (a held string, a sax, a flute never
       vibrates from the first instant). One LFO per section, in cents, feeding every oscillator's detune. */
    let vib = null;
    if (o.vib) {
      const lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.type = "sine"; lfo.frequency.value = o.vib.rate || 5.2;
      lg.gain.setValueAtTime(0, when); lg.gain.linearRampToValueAtTime(o.vib.depth || 10, when + (o.vib.delay || 0.25));
      lfo.connect(lg); lfo.start(when); lfo.stop(end + 0.05);
      vib = lg;
    }
    for (const m of midis) {
      const fr = mtof(m);
      for (const d of det ? [-det, det] : [0]) {
        const osc = ac.createOscillator(), vg = ac.createGain();
        osc.type = o.type || "sawtooth"; osc.frequency.value = fr; osc.detune.value = d;
        if (vib) vib.connect(osc.detune);
        vg.gain.value = o.v * SECT;
        osc.connect(vg); vg.connect(f); osc.start(when); osc.stop(end + 0.05);
      }
      /* M9 · the upper partials, as their own layer. Every voice here is one
         oscillator per note through one lowpass, and a sawtooth's harmonics
         fall as 1/n — by the eighth harmonic the amplitude is already a tenth
         of the fundamental's. That is why the whole band measured 0.1 % of its
         energy between 800 and 2500 Hz and 0.0 % above 2500 Hz, and why the
         +4.5 dB shelf at 4.2 kHz had nothing to lift: a real section's upper
         strings are not the low one's harmonics, they are separate players.
         Four and six times the root is where a chord stops sounding like a note
         and starts sounding like a chord, and on a C4 that lands at 1.0 and
         1.6 kHz — ABOVE the octave the player's tune lives in, which is why
         this adds brightness without adding masking. */
      if (o.shimmer) {
        for (const [mul, amp] of o.shimmer) {
          if (fr * mul > 12000) continue;
          const s1 = ac.createOscillator(), s1g = ac.createGain();
          s1.type = o.shimmerType || "sawtooth"; s1.frequency.value = fr * mul;
          s1g.gain.value = o.v * amp * SECT;
          s1.connect(s1g); s1g.connect(f); s1.start(when); s1.stop(end + 0.05);
          if (det) {
            const s2 = ac.createOscillator(), s2g = ac.createGain();
            s2.type = o.shimmerType || "sawtooth"; s2.frequency.value = fr * mul; s2.detune.value = -det;
            s2g.gain.value = o.v * amp * SECT;
            s2.connect(s2g); s2g.connect(f); s2.start(when); s2.stop(end + 0.05);
          }
        }
      }
      suppress(fr, when, dur, o.partials || 3);
    }
  }
  // one bass note: a saw through a closing filter for the attack, a sine under it.
  // sing: the soul voice — no saw edge, more sine under it, a slower filter.
  function bass(when, m, dur, v, sing = false) {
    const { ac } = audioBus(), fr = mtof(m);
    const g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = "lowpass"; f.Q.value = 1.1;
    /* M9 · the bass closed at 280 Hz, which threw away every harmonic above it
       and left the mix with 81–92 % of its energy under 250 Hz. Opened a little
       so the note keeps its growl (harmonics 3–7 of a C2 land in 800–2500 Hz),
       and brought down in level — the bass is the loudest thing in the band and
       it lives entirely below the player's octave, so trimming it buys brightness
       AND melody headroom at the same time. */
    f.frequency.setValueAtTime(sing ? 700 : 1100, when); f.frequency.exponentialRampToValueAtTime(sing ? 260 : 420, when + Math.min(0.2, dur));
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(v, when + 0.008);
    g.gain.setValueAtTime(v, when + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const a = ac.createOscillator(), b = ac.createOscillator(), bg = ac.createGain();
    a.type = sing ? "triangle" : "sawtooth"; a.frequency.value = fr; b.type = "sine"; b.frequency.value = fr; bg.gain.value = sing ? 1.2 : 0.75;
    a.connect(f); b.connect(bg); bg.connect(f); f.connect(g); g.connect(panTo("b"));
    a.start(when); b.start(when); a.stop(when + dur + 0.03); b.stop(when + dur + 0.03);
    suppress(fr, when, dur, 3);
  }
  /* M3 — the four voices the styles asked for, all built from the bus the band
     already has. Every one of them calls suppress() like the rest, so with the
     mic open none of their notes is heard as the player's next note. */
  // harpsichord: a quill on a wire — plucked, bright, gone almost at once
  function harpsichord(when, midis, dur, v) {
    const { ac } = audioBus(), c = node();
    const g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = "lowpass"; f.Q.value = 0.9;
    f.frequency.setValueAtTime(5200, when);
    f.frequency.exponentialRampToValueAtTime(2400, when + Math.min(0.35, dur));
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(v, when + 0.006);
    g.gain.setValueAtTime(v * 0.78, when + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    f.connect(g); g.connect(panTo("l"));
    const s = ac.createGain(); s.gain.value = 0.12; g.connect(s); s.connect(c.send);
    for (const m of midis) {
      const fr = mtof(m);
      for (const d of [-6, 6]) {                       // two strings a hair apart: the quill's chorus
        const o = ac.createOscillator(), og = ac.createGain();
        o.type = "triangle"; o.frequency.value = fr; o.detune.value = d; og.gain.value = 0.55;
        const o2 = ac.createOscillator(), o2g = ac.createGain();
        o2.type = "square"; o2.frequency.value = fr * 2; o2g.gain.value = 0.1;
        o.connect(og); o2.connect(o2g); og.connect(f); o2g.connect(f);
        o.start(when); o.stop(when + dur + 0.02); o2.start(when); o2.stop(when + dur + 0.02);
      }
      suppress(fr, when, dur, 3);
    }
  }
  // organ: drawbars that start together and hold — section() with the right filter
  /* The organ is the one lead that sits exactly where the player's tune lives —
     measured, it pulled the carol style up to −14.2 dB under the player's note,
     inside the masking gate and past it. No shimmer here, and a little quieter:
     drawbars are supposed to be the wall behind the tune, not the tune. */
  const organ = (when, midis, dur, v) =>
    section(when, midis, dur, { v: v * 0.33, type: "square", attack: 0.05, release: 0.22, cutoff: 2400, q: 0.5, detune: 4, partials: 5, pan: "l" });
  // celesta: a struck metal bar — no edge at all, and it rings into the echo
  const celesta = (when, midis, dur, v) =>
    section(when, midis, dur, { v: v * 0.9, type: "sine", attack: 0.004, release: Math.min(0.5, dur * 0.7), cutoff: 7000, q: 0.4, detune: 0, echo: 0.35, partials: 3, pan: "l" });
  // a plucked note for the arpeggio: a triangle with a sine an octave up, short, sent to the echo
  function pluck(when, m, dur, v, pan = "l") {
    const { ac } = audioBus(), c = node(), fr = mtof(m);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(v, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const s = ac.createGain(); s.gain.value = 0.42;
    g.connect(panTo(pan)); g.connect(s); s.connect(c.send);
    const a = ac.createOscillator(), b = ac.createOscillator(), bg = ac.createGain();
    a.type = "triangle"; a.frequency.value = fr; b.type = "sine"; b.frequency.value = fr * 2; bg.gain.value = 0.35;
    a.connect(g); b.connect(bg); bg.connect(g);
    a.start(when); b.start(when); a.stop(when + dur + 0.03); b.stop(when + dur + 0.03);
    suppress(fr, when, dur + 0.3, 2);
  }

  /* ── the orchestra's other instruments (owner, 2026-10-10: "add strings, winds, more variety so the backing is beautiful and
     practising feels real"). All of them are built from the same oscillators and bus as the rest of the band, all of them call
     suppress() so the mic never hears them as the player's note, and each sits in the stereo field by what it is. They only
     play for a style that names them (BAND_STYLES.extra); every other song keeps the band it always had.
     flute / oboe: a breathy sine-and-triangle line with a delayed vibrato and a puff of air at the start
     sax: a reedy saw through a moving filter with a wide vibrato
     horn: a warm, slow-attack brass pad that sits below the tune
     harp: the chord rolled upward, each string a hair after the last
     strum: a guitar strum, the strings struck from the bass up in a few milliseconds
     vibes: a struck metal bar that rings into the echo ── */
  // a hair of human timing on the extra instruments (deterministic per beat, so the same song always plays the same)
  const hum = (beat, k) => { const x = Math.sin(beat * 12.9898 + k * 78.233) * 43758.5453; return ((x - Math.floor(x)) - 0.5) * 0.014; };
  function windLine(when, m, dur, v, kind) {
    const { ac } = audioBus();
    const rich = kind === "oboe" ? 0.55 : 0.3;
    section(when, [m], dur, { v: v * 0.9, type: "triangle", attack: kind === "flute" ? 0.07 : 0.05, release: 0.25, cutoff: kind === "oboe" ? 3200 : 4200, q: 0.5, detune: 0, vib: { rate: 5.4, depth: kind === "flute" ? 14 : 11, delay: 0.3 }, shimmer: [[2, rich]], shimmerType: "sine", partials: 3, echo: 0.2, pan: "w" });
    // the breath: a quick burst of air above the pitch at the start (noise, so the pitch detector rejects it)
    try {
      noiseHit(when, 0.012 * v / 0.05, "bandpass", Math.min(8000, mtof(m) * 3), 1.4, 0.07);
    } catch (e) {}
  }
  function saxLine(when, m, dur, v) {
    section(when, [m], dur, { v: v * 0.8, type: "sawtooth", attack: 0.04, release: 0.2, cutoff: 1800, cutoff2: 2800, sweep: 0.3, q: 1.4, detune: 3, vib: { rate: 5.8, depth: 18, delay: 0.22 }, partials: 4, echo: 0.14, pan: "w" });
  }
  function hornPad(when, midis, dur, v) {
    section(when, midis, dur, { v: v * 0.8, type: "sawtooth", attack: 0.16, release: 0.4, cutoff: 1000, cutoff2: 1500, sweep: 0.5, q: 0.7, detune: 4, partials: 3, echo: 0.12, pan: "e" });
  }
  function harpRoll(when, midis, beatSec, v) {
    midis.forEach((m, k) => pluck(when + k * 0.065, m, beatSec * 1.7, v * (1 - k * 0.06), "h"));
  }
  function strumChord(when, midis, beatSec, v, up = false) {
    const seq = up ? midis.slice().reverse() : midis;
    seq.forEach((m, k) => pluck(when + k * 0.024, m, beatSec * 1.1, v * (up ? 0.8 : 1), "h"));
  }
  function vibesNote(when, m, dur, v) {
    section(when, [m], Math.min(dur, 1.4), { v: v * 1.0, type: "sine", attack: 0.004, release: 0.9, cutoff: 6000, q: 0.4, detune: 0, shimmer: [[4, 0.18]], shimmerType: "sine", echo: 0.4, partials: 3, pan: "v" });
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
    const c = chordAt(beat);
    const kitdrums = kit ? kit.drums : "rock";
    /* M7 · the shape of the song, applied to every voice — and whether the
       player's own note is sounding here, which decides how high the band is
       allowed to reach. */
    const A = arcAt(bar, p, onBeat);
    const melHere = melBusy(beat);
    // ── M1 · M2 · M4 · the drums follow the song's metre and its style.
    //    A waltz has no snare (ONE-two-three is carried by the bass and the
    //    chords), a march is all snare, a kit we do not have keeps a soft tick
    //    so the player never loses the beat, and a slow piece drops the
    //    off-beat hats instead of hurrying them along.
    let drum = "";
    if (on("drums")) if (onBeat) {
      if (kitdrums === "none") { hat(when, 0.34 * dv * A, false); drum = "tick"; }
      else if (waltz) { if (p === 0) { kick(when, 0.85 * dv * A); drum = "kick"; } else { hat(when, 0.3 * dv * A, false); drum = "tick"; } }
      else if (march) { snare(when, (p === 0 ? 1 : 0.62) * dv * A); drum = "snare"; }
      else if (kitdrums === "clap") {
        if (p === 0 || p === 2) { kick(when, dv * A); drum = "kick"; } else { clap(when, 0.9 * dv * A); drum = "clap"; }
      }
      else if (kitdrums === "ride") { ride(when, dv * A * (p === 0 ? 1.1 : 0.8)); drum = "ride"; }
      else if (kitdrums === "timpani") { tom(when, 72, 0.7 * dv * A); drum = "timp"; }
      else if (kitdrums === "soft") {
        if (p === 0) { kick(when, 0.72 * dv * A); drum = "kick"; } else { hat(when, 0.6 * dv * A, false); drum = "hat"; }
      }
      else if (p === 0 || p === 2) { kick(when, dv * A); drum = "kick"; }
      else { snare(when, dv * A); drum = "snare"; if (fever) clap(when, 0.8 * A); }
    }
    if (on("drums")) {
      if (kitdrums !== "none" && !waltz && !march) { hat(when, (onBeat ? 1 : L2 ? 0.75 : 0.7) * dv * A, !onBeat && L2); if (!onBeat) drum = "hat"; }   // open hats on the off-beats from combo 8
      else if (kitdrums === "none" && !onBeat && fast && fever) { hat(when, 0.4 * dv * A, false); drum = "hat"; }
      if (mega) { hat(when + beatSec * 0.25, 0.5 * A, false); if (!drum) drum = "hat"; }      // sixteenths
    }
    const entry = { beat, when, drum, pos, parts: "", extras: "" };   // parts: the pitched layers; extras: crash and toms
    log.push(entry);
    if (log.length > 400) log.shift();
    if (!full || !c) return;
    const chordStart = Math.abs(beat - c.at) < 1e-6;
    const last = c === bars[bars.length - 1];
    const finale = chordStart && last && L1 && bars.length > 1;
    // ── the opening: a crash on the first note of the song
    if (beat < 1e-6 && kitdrums !== "none") { crash(when, 0.55); entry.extras += "o"; }
    // ── the end of every fourth bar: a fill of toms, and a crash on the bar after it
    if (L2 && kitdrums !== "none" && kitdrums !== "ride" && (bar + 1) % 4 === 0 && Math.abs(pos - (bpb - 0.5)) < 1e-6) {
      tom(when, 200, 0.8); tom(when + beatSec * 0.17, 150, 0.8); tom(when + beatSec * 0.34, 105, 0.9);
      entry.extras += "f";
    }
    if (L2 && kitdrums !== "none" && bar > 0 && bar % 4 === 0 && p === 0 && onBeat) { crash(when, 0.4); entry.extras += "k"; }
    // ── bass: root, root, fifth, root on the beats (waltz: root, fifth, fifth), and an octave bump
    //    on the off-beats in Fever. Not when the player has the left hand.
    const sing = kit && (kit.lead === "epiano" || kit.pad === "strings" || kit.pad === "pad");
    if (L1 && hand === "right" && !finale && on("b")) {
      const root = 12 * 3 + c.root;                                            // C2 = 36
      const fifth = root + ((c.pcs[2] - c.root + 12) % 12);
      /* M7 · the last eighth before a chord change steps to the next root
         instead of repeating itself. A bass that only says "root, fifth" is
         what makes a loop sound like a loop — the approach note is the whole
         difference, and it costs one note. */
      const nx = bars.find((b) => b.at > c.at + 1e-6);
      const nxRoot = nx ? 12 * 3 + nx.root : null;
      if (onBeat) {
        const long = p === 0 || (bpb === 4 && p === 2);
        const m = bpb === 4 ? (p === 2 ? fifth : root) : (p === 0 ? root : fifth);
        bass(when, m, beatSec * (long ? 0.92 : 0.45) * (fast ? 0.8 : 1), (long ? 0.13 : 0.11) * (slow ? 0.85 : 1) * A, sing);
        entry.parts += "b";
      } else if (fever) {
        bass(when, root + 12, beatSec * 0.32, 0.095 * A, sing);
        entry.parts += "b";
      } else if (nxRoot != null && Math.abs(pos - (bpb - 0.5)) < 1e-6) {
        bass(when, root + (((nxRoot - root) % 12) + 12) % 12, beatSec * 0.4, 0.1 * A, sing);
        entry.parts += "b";
      }
    }
    // ── chords, at the start of each: a drone from the beginning, strings once the combo is 8
    if (chordStart) {
      const dur = Math.min(c.len, Math.max(1, endBeat - c.at + 1)) * beatSec;
      const low = hand === "right";
      const notes = stack(c, low ? 3 : 4);
      if (!finale && state.combo >= 1 && on("n")) {                             // (before a first hit the band cannot know it is not a piano on the mic)
        section(when, [notes[0], notes[2]], dur * 0.98, { v: 0.03 * A, type: "sine", attack: 0.25, release: 0.4, cutoff: 3000, detune: 0, partials: 2, echo: 0.08, pan: "n" });
        entry.parts += "d";
      }
      if ((L2 || finale) && on("c")) {
        /* ── M9 · the pad is the band's body, and it was the reason the whole mix
           measured 81–92 % of its energy under 250 Hz with almost nothing above
           800 Hz. Two causes, both here: the pad sat at v 0.03–0.042 while the
           bass sat at 0.16–0.20, and its filter closed at 1500–2100 Hz, which
           removed the saw's own harmonics — the part of a chord you actually
           hear as "chord" rather than as "note". Opened up and brought forward;
           the bass came down to match. Every line here is checked against the
           melody-masking gate (M12), because this is the one part of the band
           that lives in the player's octave. */
        /* The filter is opened, the LEVEL IS NOT. Measured: opening the pad to
           3100–3800 Hz moved the mix from 6.4–18.1 % to 9.1–25.1 % of its energy
           into 250–800 Hz and lifted the centroid from 109–164 Hz to 123–189 Hz
           — a real improvement. Raising its level on top of that pushed the band
           up against the player's own note (median went from −17.9 to −15.5 dB,
           and carol's p90 to −12.0 dB), so the level went back to where it was.
           The brightness stays; the loudness does not. */
        const pad = kit && kit.pad === "strings" ? { v: 0.031, cutoff: 3400 }     // a string pad opens up over the same notes (trimmed from 0.035 when the master went to 0.2657: the classical waltz sat at -11.7 dB under the player)
          : kit && kit.pad === "continuo" ? { v: 0.036, cutoff: 3800 }
          : kit && (kit.pad === "softpad" || kit.pad === "pad") ? { v: 0.03, cutoff: 2400 }
          : { v: 0.04, cutoff: 3100 };                                        // the band as it was before M2
        section(when, notes, dur * (finale ? 1.6 : 0.98), { ...pad, v: pad.v * A, type: "sawtooth", attack: finale ? 0.05 : 0.16, release: finale ? 1.2 : 0.4, q: 0.7, detune: 7, partials: 3, echo: finale ? 0.22 : 0.1, pan: "c", shimmer: [[4, 0.13], [6, 0.07]] });
        entry.parts += "c";
      }
      // ── M2 · M3 · the style's own voice on the chord change: harpsichord, organ,
      //    celesta, or a plucked guitar for the folk/kids styles.
      if (kit && kit.lead !== "strings" && kit.lead !== "epiano" && (L1 || finale) && on("l")) {
        /* M7 · when the player's note is sounding, this voice drops an octave
           instead of doubling it an octave up. */
        const led = stack(c, melHere ? 4 : (low ? 5 : 6)).slice(0, 3);
        const ldur = beatSec * (waltz ? 1 : (fever ? 0.9 : 2));
        const lv = 0.05 * A * (melHere ? 0.7 : 1);
        if (kit.lead === "harpsichord") harpsichord(when, led, ldur, lv);
        else if (kit.lead === "organ") organ(when, led, ldur * 1.2, lv);
        else if (kit.lead === "celesta") celesta(when, [led[0] + 12, led[1] + 12], ldur, lv);
        else pluck(when, led[2], ldur * 0.9, lv);                             // folk / kids / cn: a guitar pluck
        entry.parts += "l";
      }
      if ((fever || finale) && on("x")) {                                      // brass stabs on the chord changes
        const br = stack(c, melHere ? 3 : 4).slice(0, 3);
        section(when, br, beatSec * (finale ? 1.2 : 0.34), { v: 0.045 * A, type: "sawtooth", attack: 0.012, release: 0.14, cutoff: 3600, cutoff2: 950, sweep: 0.13, q: 0.8, detune: 6, echo: 0.3, partials: 3, pan: "x" });
        entry.parts += "x";
      }
      /* M7 · the run into the end: the bar before the last chord lifts, so the
         finale arrives instead of simply starting. */
      if (L2 && !finale && bar === lastBar - 1 && kitdrums !== "none") {
        crash(when, 0.5 * A);
        entry.extras += "s";
      }
      if (finale) {                                                            // the finale: everything at once
        kick(when, 1); crash(when, 1);
        bass(when, 12 * 3 + c.root, beatSec * 2, 0.26);
        tom(when, 90, 0.9);
        entry.parts += "!";
      }
    }
    // ── M5 · the strings stop being a pad: a line moves over the chord, a note
    //    or two above it, in the notes of the chord playing now. Only for the
    //    styles that ARE string music — the default band is left as it was.
    if (kit && kit.lead === "strings" && L1 && onBeat && !finale && !melHere && on("m")) {
      /* M7 · the line moves where the player's note is NOT — the gaps are the
         only place a counter-line does not fight the tune. */
      const mel = 12 * 5 + (c.pcs[(bar + p) % c.pcs.length] - c.root + 12) % 12 + (p === 2 ? 12 : 0);
      section(when, [mel], beatSec * (waltz ? 0.8 : 0.9), { v: 0.016 * A, type: "sawtooth", attack: 0.09, release: 0.22, cutoff: 2600, q: 0.6, detune: 9, partials: 3, echo: 0.12, pan: "m" });
      entry.parts += "m";
    }
    /* ── the style's other instruments. The first joins with the combo's first layer (3), the second with the strings (8). They
       leave the player alone the same way the string line does: a line only plays where the player's note is NOT sounding, and a
       voice that lives in the player's octave is only a pad below it. Nothing here runs for a style without `extra`. */
    if (kit && kit.extra && !finale) {
      for (let i = 0; i < 2; i++) {
        const nm = kit.extra[i];
        if (!nm || !(i === 0 ? L1 : L2)) continue;
        const ev = 0.026 * A;
        if (nm === "flute" || nm === "oboe" || nm === "sax") {
          const gap = onBeat && (p === 0 || p === Math.floor(bpb / 2)) && !melHere && !(slow && p !== 0);
          if (gap && on("w")) {
            const idx = (bar * 2 + p + i) % 3;
            const pc = (c.pcs[idx] - c.root + 12) % 12;
            const m = (nm === "flute" ? 12 * 7 : nm === "oboe" ? 12 * 6 : 12 * 5) + c.root % 12 + pc;
            const ld = beatSec * (waltz ? 1.4 : 1.8);
            if (nm === "sax") saxLine(when + hum(beat, i), m, ld, ev); else windLine(when + hum(beat, i), m, ld, ev, nm);
            entry.parts += "w";
          }
        } else if (nm === "horn") {
          if (chordStart && on("e")) { hornPad(when, stack(c, 3).slice(1, 3), Math.min(c.len, Math.max(1, endBeat - c.at + 1)) * beatSec * 0.96, 0.03 * A); entry.parts += "e"; }
        } else if (nm === "harp") {
          if (chordStart && on("h")) { harpRoll(when + hum(beat, i), stack(c, melHere ? 4 : 5), beatSec, 0.04 * A); entry.parts += "h"; }
        } else if (nm === "strum") {
          if ((chordStart || (onBeat && p === Math.floor(bpb / 2) && bpb === 4)) && on("h")) { strumChord(when + hum(beat, i), stack(c, 4), beatSec, 0.04 * A, !chordStart); entry.parts += "h"; }
        } else if (nm === "vibes") {
          if (!melHere && !onBeat && (bar + Math.round(pos * 2)) % 2 === 0 && on("h")) {
            const pc = (c.pcs[(bar + Math.round(pos * 2)) % 3] - c.root + 12) % 12;
            vibesNote(when + hum(beat, i), 12 * 6 + c.root % 12 + pc, beatSec * 1.2, 0.03 * A); entry.parts += "h";
          }
        }
      }
    }
    // ── Fever: an arpeggio of the chord, plucked, up and down, on every half-beat
    if (fever && !finale && !(melHere && !onBeat) && on("a")) {
      const k = Math.round((beat - c.at) * 2), pat = [0, 1, 2, 3, 2, 1], idx = pat[((k % 6) + 6) % 6];
      const off = idx === 3 ? 12 : (c.pcs[idx] - c.root + 12) % 12;            // root, third, fifth, octave
      pluck(when, 12 * (melHere ? 5 : 6) + c.root + off + (mega ? 12 : 0), beatSec * 0.42, 0.06 * A, "a");   // C5 = 72
      entry.parts += "a";
    }
  }

  return {
    pump,
    log,
    state,
    chordAt,
    setState(s) { Object.assign(state, s); },
    setLevel(l) { level = l; if (chain) chain.master.gain.value = BAND_LEVELS[level] * MASTER; },
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

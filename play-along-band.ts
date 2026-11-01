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

   The build is arranged, not switched: a new layer waits for the next bar line
   with a riser and a pickup into it, Fever drops on the bar line, a slip thins
   the band by how the last judgements went instead of emptying it, the song has
   a verse / chorus / break form from its bar numbers, each genre has its own
   fill, the pads are voice-led and keep clear of the tune, and the last chord
   is led into by a roll and a rising run (all in play(); the tests are the
   P02-P17 sections of scripts/smoke-band-style.mjs and scripts/verify-band-notes.mjs).

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
import { audioBus, _accMarkSuppress, _accNoise, _sfxMuted, _micSafe, hfPing, playCrowd } from "./music-engine";

export const BAND_LEVELS = [0, 0.55, 1, 1.35];   // off, soft, normal, full
const LOOKAHEAD = 0.35;
/* the band's master gain. Owner 2026-10-10: "the backing track is too quiet, ten percent louder" — 0.21 -> 0.231 (+0.83 dB).
   Checked against the three numbers that decide the mix (no clipping, <= 90 % of the energy under 250 Hz, band >= 12 dB under the
   player's note): the quietest margin before the change was the carol style at -13.4 dB, so it lands at about -12.6 dB.
   Owner 2026-10-10, again: "another fifteen percent" -> 0.231 -> 0.2657 (+1.2 dB). That alone would take carol (organ) and the
   classical waltz past the 12 dB gate, so the organ drawbars are trimmed to compensate (see organ below). */
const MASTER = 0.2923;
/* mix-and-master constants (see node()): EXC_DRIVE is the gain in front of the exciter's soft clip, EXC_BLEND its level back into
   the mix, BASS_H2/H3 the levels of the bass's own 2nd and 3rd harmonic and BASS_FUND the trim of its fundamental. Set by measurement (scripts/analyze-band-sound.mjs --ab), not by ear. */
const EXC_DRIVE = 200, EXC_BLEND = 0.15, BASS_H2 = 0.1, BASS_H3 = 0.06, BASS_FUND = 0.9;
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
  baroque:       { drums: "none",    lead: "harpsichord", pad: "continuo", extra: ["flute", "harp"], bass: "walk" },
  classical:     { drums: "timpani", lead: "strings",     pad: "strings",   extra: ["oboe", "horn"], fill: "tom", bass: "pedal" },
  romantic:      { drums: "soft",    lead: "strings",     pad: "strings",   extra: ["horn", "harp"], fill: "tom", bass: "pedal" },
  impressionism: { drums: "none",    lead: "celesta",     pad: "softpad",   extra: ["flute", "harp"], bass: "pedal" },
  kids:          { drums: "clap",    lead: "pluck",       pad: "musicbox",  extra: ["vibes", "flute"], fill: "clap", bass: "boom" },
  folk:          { drums: "clap",    lead: "pluck",       pad: "pluck",     extra: ["strum", "flute"], fill: "clap", bass: "boom" },
  cn:            { drums: "soft",    lead: "pluck",       pad: "pluck",     extra: ["flute", "harp"], fill: "tom" },
  carol:         { drums: "none",    lead: "organ",       pad: "organ",     extra: ["flute", "horn"], bass: "pedal" },
  gospel:        { drums: "soft",    lead: "organ",       pad: "strings",   extra: ["horn", "sax"], fill: "flam", bass: "push" },
  jazz:          { drums: "ride",    lead: "pluck",       pad: "comping",   extra: ["vibes", "sax"], fill: "brush", bass: "walk" },
  /* the jazz & blues originals carry their idiom in the index row's `sty` and no genre
     of their own (they are not in SONG_GENRES — they are not even in the bundle), so
     without these three keys a blues would ride the default rock kit: a snare backbeat
     under a shuffle. blues/swing/bossa book the ride cymbal and the comping pad, which
     is what the pieces themselves are written for. */
  blues:         { drums: "ride",    lead: "pluck",       pad: "comping",   extra: ["sax", "vibes"], fill: "brush", bass: "walk" },
  swing:         { drums: "ride",    lead: "pluck",       pad: "comping",   extra: ["sax", "vibes"], fill: "brush", bass: "walk" },
  bossa:         { drums: "clap",    lead: "epiano",      pad: "comping",   extra: ["vibes", "strum"], fill: "rim", bass: "bossa" },
  soul:          { drums: "soft",    lead: "epiano",      pad: "strings",   extra: ["sax", "horn"], fill: "flam", bass: "push" },
  neosoul:       { drums: "soft",    lead: "epiano",      pad: "pad",       extra: ["vibes", "sax"], fill: "flam", bass: "push" },
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
  /* The mix-and-master stage (P05 · P14 · P18). All on; `opts.mix` switches one off, which is how the offline lab
     measures each of them against the band without it (scripts/analyze-band-sound.mjs --ab). The game never passes it. */
  const MX: any = { duck: true, kick: true, exciter: true, bassEnh: true, excDrive: EXC_DRIVE, excBlend: EXC_BLEND, h2: BASS_H2, h3: BASS_H3, fund: BASS_FUND, ...(opts.mix || {}) };
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
    const form = Math.floor(bar / 8) % 2 === 1 ? 1 : 0.95;      // P10 · the chorus (bars 8–15, 24–31 …) is a little fuller than the verse
    return lift * intro * coda * beat * form;
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
  const state = { combo: 0, fever: false, mega: false, pitched: true, soft: false, micOpen: false, recent: null };   // recent: how the last ten judgements went, 0..1 (null = the caller does not say)
  /* the last pump: where the song clock was, when (audio time), and how to turn a song time into an audio time. A stinger asks it
     for the next eighth note of the grid; a miss asks it how long a beat is. `dipUntil`: while a miss has the pitched voices
     dulled, the audio time at which they are open again. */
  let grid = null, dipUntil = 0;

  /* ── the arrangement (plan 25 §D · P02 layers enter on the bar line, P03 a produced intro, P07 a real Fever drop, P08 a band that
     thins out instead of collapsing, P10 a form, P13 a bigger finale, P17 each genre's own fills, and voicings that lead each other).
     Everything here is a function of the bar number and of what the player has done, never of a random number: the same song played
     the same way books the same thing. ── */
  let lvl = -1;                        // the layer level playing now: 0 drums, 1 + bass and chords, 2 + strings (taken from the player on the first beat)
  let pendBar = -1;                    // P02 · the bar line a promotion is waiting for
  let feverOn = false, feverDrop = -1, feverRiser = false;   // P07 · the audio side of Fever starts on a downbeat
  let megaOn = false, megaDrop = -1;
  let introDone = false;               // P03 · the count-in riser is booked once
  const vl = { pad: null, x: null, m: null, w0: null, w1: null, dir: {}, n: {} };   // voice-leading memory: the last notes of each moving voice
  const songPcs = new Set();           // every pitch class any chord of this song uses (the scale the band may pass through)
  for (const b of bars) for (let i = 0; i < Math.min(3, (b.pcs || []).length); i++) songPcs.add(((b.pcs[i] % 12) + 12) % 12);
  const pcOf3 = (c) => [0, 1, 2].map((i) => (((c.pcs[i] == null ? c.root : c.pcs[i]) % 12) + 12) % 12);
  /* a triad voiced to move as little as possible from the last one (inversions instead of root position every time), inside [lo, hi] */
  const melDuring = (c) => melList.filter((n) => n.beat < c.at + c.len - 1e-6 && n.beat + n.dur > c.at + 1e-6).map((n) => n.midi);
  /* `avoid`: the notes the player will play over this chord (melDuring). A voicing with a note within a semitone of one of them costs
     9 more than the same shape one inversion away, so the pad leaves the tune's own pitches free whenever the chord has a way to. */
  function voice(c, key, lo, hi, avoid = null) {
    const pcs = pcOf3(c);
    const at = pcs.map((pc) => { const o = []; for (let m = lo; m <= hi; m++) if (m % 12 === pc) o.push(m); return o; });
    const prev = vl[key], mid = (lo + hi) / 2;
    let best = null, bc = 1e9;
    if (!at.some((o) => !o.length)) for (const a of at[0]) for (const b of at[1]) for (const d of at[2]) {
      const v = [a, b, d].sort((x, y) => x - y);
      if (v[2] - v[0] > 12) continue;
      const pen = avoid && avoid.length ? 9 * v.filter((n) => avoid.some((a) => Math.abs(n - a) <= 1)).length : 0;
      const cost = pen + (prev ? Math.abs(v[0] - prev[0]) + Math.abs(v[1] - prev[1]) + Math.abs(v[2] - prev[2]) : Math.abs((v[0] + v[1] + v[2]) / 3 - mid));
      if (cost < bc - 1e-9) { bc = cost; best = v; }
    }
    if (!best) best = stack(c, 3).slice(0, 3);
    vl[key] = best;
    return best;
  }
  /* a moving line that steps from chord tone to the next chord tone in one direction and turns at the edge of its range (or after
     four steps): the counter-melody follows the harmony instead of hopping to a new register every beat */
  function nearTone(c, key, lo, hi) {
    const pcs = new Set(pcOf3(c));
    const cand = []; for (let m = lo; m <= hi; m++) if (pcs.has(m % 12)) cand.push(m);
    if (!cand.length) return null;
    const prev = vl[key];
    let d = vl.dir[key] || 1, n = (vl.n[key] || 0) + 1, pick;
    if (prev == null) pick = cand[Math.floor(cand.length / 3)];
    else {
      const side = (dd) => (dd > 0 ? cand.filter((m) => m > prev) : cand.filter((m) => m < prev));
      let s = side(d);
      if (!s.length || n > 4) { d = -d; n = 1; s = side(d); }
      pick = s.length ? (d > 0 ? s[0] : s[s.length - 1]) : prev;
    }
    vl[key] = pick; vl.dir[key] = d; vl.n[key] = n;
    return pick;
  }
  const note = (entry, ms, role) => { for (const m of [].concat(ms)) entry.notes.push([m, role]); };
  const resetArr = () => { lvl = -1; pendBar = -1; feverOn = false; feverDrop = -1; feverRiser = false; megaOn = false; megaDrop = -1; vl.pad = vl.x = vl.m = vl.w0 = vl.w1 = null; vl.dir = {}; vl.n = {}; };

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
    /* P06 · the pitched voices (pads, strings, bass, plucks, the style's lead) reach the mix through their own small bus — a low-pass
       and a gain, both wide open until a miss: the drums go straight to the mix and never pass through it, so the beat is never lost. */
    const pit = ac.createBiquadFilter(); pit.type = "lowpass"; pit.frequency.value = 20000; pit.Q.value = 0.5;
    const pitG = ac.createGain(); pitG.gain.value = 1;
    /* arrangement · a second low-pass after it, owned by the arrangement (the intro's opening filter, the Fever pre-drop): a miss
       automates `pit`, the arrangement automates `arr`, so neither cancels the other's ramps. Wide open (20 kHz) until used. */
    const arr = ac.createBiquadFilter(); arr.type = "lowpass"; arr.frequency.value = 20000; arr.Q.value = 0.707;
    /* P05 · two gains on the end of the pitched bus, before it reaches the mix (the drums never pass through them):
       dkH ducks for a REWARD (a Perfect, a stinger, a crowd swell — band.duck()), dkK ducks for the KICK (booked with the kick, on
       the audio clock). Two nodes and not one, because an AudioParam cannot be driven from "now" and from "ahead" at once. */
    const dkH = ac.createGain(), dkK = ac.createGain();
    pit.connect(pitG); pitG.connect(arr); arr.connect(dkH); dkH.connect(dkK); dkK.connect(mix);
    /* P14 · presence without player-octave energy. A parallel exciter: what sounds between 1.3 and 2.6 kHz (the snare and the claps
       above all; in a pitched style the plucks and the brass partials) is driven into a soft clip, and what comes out is
       high-passed at 3 kHz and low-passed at 7 kHz — upper harmonics of content that exists, added ABOVE the melody (the
       player's octave is 262–1047 Hz) and above the pitch detector's own 2.6 kHz low-pass (8th order), so it is neither
       mask nor mis-read. It is blended back into the compressor (past the air shelf, which already has its say up there).
       MEASURED, not assumed: the first design tapped the PITCHED bus only, as the spec said — and found nothing to excite
       (the whole pitched bus holds 0.5 % of its energy between 800 and 2500 Hz, its voices are low-passed under it), so
       the presence band moved from 0.12 % to 0.14 %. The drums are where the mid-highs are, so the tap is the whole mix.
       Pianist mode keeps only soft unpitched drums, so what the exciter makes there is noise-like and above the detector. */
    let ex: any = null;
    if (MX.exciter && ac.createWaveShaper) {
      /* the input band: 1.3–2.6 kHz, steep on the low side (two high-passes) so the kick and the bass cannot leak in and be
         driven into a square wave */
      const exHp = ac.createBiquadFilter(); exHp.type = "highpass"; exHp.frequency.value = 1300; exHp.Q.value = 0.707;
      const exHpB = ac.createBiquadFilter(); exHpB.type = "highpass"; exHpB.frequency.value = 1300; exHpB.Q.value = 0.707;
      const exLp = ac.createBiquadFilter(); exLp.type = "lowpass"; exLp.frequency.value = 2600; exLp.Q.value = 0.707;
      const exIn = ac.createGain(); exIn.gain.value = MX.excDrive;
      const exSat = ac.createWaveShaper();
      const cv = new Float32Array(1025);
      for (let i = 0; i < cv.length; i++) { const x = (i / 512) - 1; cv[i] = Math.tanh(2.2 * x + 0.35) - Math.tanh(0.35); }   // a little asymmetry: the 2nd harmonic as well as the 3rd
      exSat.curve = cv; exSat.oversample = "2x";
      const exHp2 = ac.createBiquadFilter(); exHp2.type = "highpass"; exHp2.frequency.value = 3000; exHp2.Q.value = 0.707;
      const exLp2 = ac.createBiquadFilter(); exLp2.type = "lowpass"; exLp2.frequency.value = 7000; exLp2.Q.value = 0.707;
      const exOut = ac.createGain(); exOut.gain.value = MX.excBlend * 0.2;   // the drums-only level until the first beat says otherwise (exLevel)
      (MX.excTap === "pitch" ? dkK : mix).connect(exHp); exHp.connect(exHpB); exHpB.connect(exLp); exLp.connect(exIn); exIn.connect(exSat);
      exSat.connect(exHp2); exHp2.connect(exLp2); exLp2.connect(exOut); exOut.connect(comp);
      ex = { exOut, f: 0.2 };
    }
    chain = { mix, master, send, delay, pans: {}, ac, pit, pitG, arr, dkH, dkK, ex, lastKick: -1, hit: null };
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
    const c = node(), p = PAN[kind] || 0, dst = kind === "drums" ? c.mix : c.pit;
    if (!p) return dst;
    let n = c.pans[kind];
    if (n === undefined) {
      n = c.ac && c.ac.createStereoPanner ? c.ac.createStereoPanner() : null;
      if (n) { try { n.pan.value = p; n.connect(dst); } catch (e) { n = null; } }
      c.pans[kind] = n;
    }
    return n || dst;
  }
  /* P05 · the sidechain feel: every kick dips the pitched bus about 1.4 dB for 150 ms (6 ms down, then a linear return), so the
     kick's weight lands on top of the pads and the bass instead of under them. Booked with the kick on the audio clock; a kick
     closer than 160 ms to the last one is left alone (the envelopes would run into each other). */
  function kickDuck(when, v) {
    if (!MX.kick || !chain) return;
    if (when < chain.lastKick + 0.16) return;
    chain.lastKick = when;
    const g = chain.dkK.gain, lo = 1 - 0.16 * Math.max(0.4, Math.min(1.1, v));
    g.setValueAtTime(1, when); g.linearRampToValueAtTime(lo, when + 0.006); g.linearRampToValueAtTime(1, when + 0.15);
  }
  /* P05 · the reward duck, called by the game on a Perfect and by stinger(): the pitched bus drops `db` (about 2) in 8 ms and comes
     back over `ms` (90–140), so the player's own note and the reward sound speak over a band that has stepped back for an
     instant. It is a gain automation and adds no sound. Restarting from inside a duck begins at the level the last one had reached; `at` (a
     stinger books itself a few hundred ms ahead) puts the dip under the sound instead of before it. */
  function hitDuck(db = 2, ms = 110, at = 0) {
    if (!MX.duck || !chain || !level) return false;
    const { ac } = audioBus(), t = Math.max(ac.currentTime, at), g = chain.dkH.gain;
    const lo = Math.pow(10, -Math.abs(db) / 20), tau = Math.max(0.02, ms / 1000 / 3);
    let cur = 1;
    const h = chain.hit;
    if (h && t - h.t < 0.09 && lo >= h.lo) return true;                 // a duck that is only just under way already covers this one
    if (h) { const dt = Math.max(0, t - h.t); cur = dt < 0.008 ? 1 + (h.lo - 1) * (dt / 0.008) : 1 + (h.lo - 1) * Math.exp(-(dt - 0.008) / h.tau); }
    chain.hit = { t, lo, tau };   // (dt is clamped at 0 above: an earlier duck booked in the future has not started, so the gain is still 1 — an unclamped negative dt extrapolated the envelope backwards to a gain of 3-7 x)
    g.cancelScheduledValues(t);
    g.setValueAtTime(cur, t); g.linearRampToValueAtTime(lo, t + 0.008); g.setTargetAtTime(1, t + 0.008, tau);
    return true;
  }
  /* P14 · the exciter follows the layers. Its output does not fall with its input (a clipper hands back the same level whatever
     it is fed), so left at one level it was 5 dB louder than the drums on their own and flattened the build the band makes
     (drums → bass and chords → strings → Fever: 5 dB of mid-high level became 2). It is held to a fifth while only the drums play
     (and for a pianist on the mic), 0.3 with the bass and chords, 0.6 with the strings, 1 in Fever — so the build keeps growing
     all the way to the top instead of flattening (scripts/verify-playalong-band-audio.mjs, the mid-spectrum check). */
  function exLevel(when, f) {
    if (!chain || !chain.ex || chain.ex.f === f) return;
    chain.ex.f = f;
    chain.ex.exOut.gain.setTargetAtTime(MX.excBlend * f, when, 0.08);
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
    kickDuck(when, v);
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
  /* ── the arrangement's unpitched tools. A riser is noise through a filter that sweeps while the level climbs and ends ON the beat it
     leads into (P02 a layer's lead-in, P03 the count-in, P07 the Fever drop); a brush swell is the same idea in the band a jazz
     drummer plays. They are noise, so the pitch detector rejects them whatever the mic is doing. ── */
  function sweep(when, dur, v, type, f0, f1) {
    if (!(dur > 0.08)) return;
    const { ac } = audioBus(), n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    n.buffer = _accNoise(ac); n.loop = true;
    f.type = type; f.Q.value = type === "highpass" ? 0.9 : 0.6;
    f.frequency.setValueAtTime(f0, when); f.frequency.exponentialRampToValueAtTime(f1, when + dur);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), when + dur * 0.97);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur + 0.04);
    n.connect(f); f.connect(g); g.connect(panTo("drums")); n.start(when); n.stop(when + dur + 0.06);
  }
  const riser = (when, dur, v) => sweep(when, dur, v, "highpass", 2000, 8000);
  const rim = (when, v) => { noiseHit(when, 0.17 * v, "bandpass", 1900, 5, 0.024); noiseHit(when, 0.06 * v, "highpass", 5200, 0.7, 0.02); };
  /* the 4th bar of a phrase ends in a fill, and each genre has its own (P17). A style the table does not name keeps the toms. */
  function fillAt(kind, pos, when, beatSec, A) {
    const q = Math.round((bpb - pos) * 1e6) / 1e6;   // beats left in the bar: 1 = the last beat, 0.5 = its second half
    if (kind === "brush") {
      if (q === 1) { sweep(when, beatSec * 0.95, 0.07 * A, "bandpass", 3000, 5600); return "g"; }
      if (q === 0.5) { ride(when, 0.95 * A); noiseHit(when, 0.1 * A, "bandpass", 3800, 1, 0.09); return "g"; }
    } else if (kind === "rim") {
      if (q === 1.5 || q === 1 || q === 0.5) { rim(when, (q === 1.5 ? 0.7 : q === 1 ? 0.8 : 1) * A); return "g"; }
    } else if (kind === "clap") {
      if (q === 1) { clap(when, 0.8 * A); clap(when + beatSec * 0.25, 0.7 * A); clap(when + beatSec * 0.5, 0.8 * A); return "g"; }
      if (q === 0.5) { clap(when, 0.9 * A); clap(when + beatSec * 0.25, A); return "g"; }
    } else if (kind === "flam") {
      if (q === 1) { snare(when, 0.28 * A); return "g"; }                                          // the ghost note
      if (q === 0.5) { snare(Math.max(0, when - 0.032), 0.4 * A); snare(when, 0.85 * A); return "g"; }  // the flam
    } else if (kind === "roll") {
      if (q === 1) { for (let k = 0; k < 6; k++) snare(when + k * beatSec / 6, (0.3 + 0.13 * k) * A); return "g"; }
    } else if (kind === "rimtap") {
      if (q === 1) { rim(when, 0.9 * A); return "g"; }
    } else if (q === 0.5) {                                                                        // "tom": what the band has always played
      tom(when, 200, 0.8); tom(when + beatSec * 0.17, 150, 0.8); tom(when + beatSec * 0.34, 105, 0.9);
      return "f";
    }
    return "";
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
    f.connect(g); g.connect(o.pan ? panTo(o.pan) : c.pit);
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
    a.type = sing ? "triangle" : "sawtooth"; a.frequency.value = fr; b.type = "sine"; b.frequency.value = fr; bg.gain.value = (sing ? 1.2 : 0.75) * (MX.bassEnh ? MX.fund : 1);
    a.connect(f); b.connect(bg); bg.connect(f); f.connect(g); g.connect(panTo("b"));
    a.start(when); b.start(when); a.stop(when + dur + 0.03); b.stop(when + dur + 0.03);
    /* P18 · a psychoacoustic bass: the 2nd and 3rd harmonic of the note as sines of their own (past the low-pass, under the note's
       own envelope), with the fundamental trimmed about 0.9 dB to pay for them. A phone speaker that cannot play 60–120 Hz
       still plays 130–400 Hz, and the ear rebuilds the low pitch from them. All under suppress()'s three partials below. */
    if (MX.bassEnh) {
      for (const [k, amp] of [[2, MX.h2], [3, MX.h3]]) {
        const eo = ac.createOscillator(), eg = ac.createGain();
        eo.type = "sine"; eo.frequency.value = fr * k; eg.gain.value = amp;
        eo.connect(eg); eg.connect(g); eo.start(when); eo.stop(when + dur + 0.03);
      }
    }
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
    section(when, midis, dur, { v: v * 0.29, type: "square", attack: 0.05, release: 0.22, cutoff: 2400, q: 0.5, detune: 4, partials: 5, pan: "l" });   // 0.33 -> 0.29: alone it measures -6.7 dB under the player's note, and it decides carol's margin
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
    try { const { ac: gac } = audioBus(); if (!grid) grid = { song: 0, at: 0, toAudio, tempo }; grid.song = songTime; grid.at = gac.currentTime; grid.toAudio = toAudio; grid.tempo = tempo; } catch (e) {}   // one object for the whole run: pump runs every 60 ms and every frame
    if (!level || _sfxMuted) { nextHalf = null; return; }
    const { ac } = audioBus();
    if (chain && Math.abs(tempo - lastTempo) > 0.005) {        // the echo keeps to the beat when a drill changes the tempo
      lastTempo = tempo;
      chain.delay.delayTime.setTargetAtTime(Math.min(1.1, 0.75 * spb / tempo), ac.currentTime, 0.05);
    }
    // Fever begins: the screen reacts at once, the band takes the drop on the next bar line (play(), P07)
    wasFever = !!(state.fever && state.pitched && !state.soft);
    /* P03 · the count-in leads into the song: on its last beat a riser climbs into the first downbeat (and, for a band with a kit,
       a quiet flam), and the pitched voices come in through a filter that opens over the first two bars. The riser is noise and
       is booked for a pianist too, at half the level; the filter and the flam only for a full band. */
    if (!introDone && minSong <= 0 && lead > 0) {
      const tb = toAudio(lead - spb), te = toAudio(lead);
      if (tb - ac.currentTime <= LOOKAHEAD && te - ac.currentTime > 0.06) {
        introDone = true;
        const t0 = Math.max(tb, ac.currentTime);
        riser(t0, te - t0, state.soft ? 0.045 : 0.09);
        if (state.pitched && !state.soft) {
          if (kit && kit.drums === "none") { /* a Baroque or Impressionist piece has no drums to flam */ }
          else if (kit && kit.drums === "timpani") tom(Math.max(t0, te - 0.05), 110, 0.5);
          else snare(Math.max(t0, te - 0.045), 0.3);
          const f = node().arr.frequency;
          f.cancelScheduledValues(te); f.setValueAtTime(1100, te); f.exponentialRampToValueAtTime(20000, te + 2 * bpb * spb / tempo);
        }
      }
    }
    let h = nextHalf;
    if (h == null) h = Math.ceil(((songTime - lead) / spb) * 2 - 1e-6);
    for (let guard = 0; guard < 32; guard++) {
      const beat = h / 2, st = lead + beat * spb;
      const when = toAudio(st);
      if (when > ac.currentTime + LOOKAHEAD) break;
      if (beat > endBeat + 0.01) { h++; continue; }
      if (beat >= 0 && st >= minSong - 1e-3 && when >= ac.currentTime - 0.02) {
        try { play(beat, Math.max(when, ac.currentTime), spb / tempo); } catch (e) { /* one beat that throws is a beat the band skips: it must not stop the pump advancing (nextHalf), or the same beats would be booked again every 60 ms, nor reach the run */ }
      }
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
    const c = chordAt(beat);
    const kitdrums = kit ? kit.drums : "rock";
    /* ── P02 · P08 · which layers play. The combo says which layer the player has earned (3: bass and chords, 8: strings), but the
       band does not switch on in the middle of a bar: a layer waits for the next bar line, and the last two beats before it carry a
       riser and a pickup, so the new layer lands on the downbeat like a produced build. Leaving is the other way round: a miss is
       heard at once. And it is not all-or-nothing — `recent` (how the last ten judgements went, 0..1) decides how far the band
       falls: one slip in a good run only thins it (the strings stay), a second one takes the strings, a run of them leaves the
       drums, and the layers earn their way back by the combo as before. A caller that passes no `recent` gets the plain combo. */
    const first = full && lvl < 0;
    const wantLv = state.combo >= 8 ? 2 : state.combo >= 3 ? 1 : 0;
    let leadIn = false;
    if (full) {
      if (first) lvl = wantLv;                                  // the first beat: whatever the player already has, with no ceremony
      else if (wantLv > lvl) {
        if (pendBar < 0) { pendBar = bar + 1; leadIn = true; }
        if (bar >= pendBar) { lvl = wantLv; pendBar = -1; leadIn = false; }
      } else {
        pendBar = -1;
        if (wantLv < lvl) {
          const r = state.recent, cap = r == null ? -1 : r >= 0.7 ? 2 : r >= 0.45 ? 1 : 0;
          lvl = cap < 0 ? wantLv : Math.max(wantLv, Math.min(lvl, cap));
        }
      }
    }
    const L1 = full && lvl >= 1, L2 = full && lvl >= 2;
    /* ── P07 · Fever on the grid. The screen says FEVER the moment the flag flips, but the band takes the drop on the next bar line:
       a riser and a filter closing over the pitched voices until then, and on the line the filter snaps open, the crash lands and
       the Fever layers (brass, arpeggio, clap, the extra hats) enter together. Mega gets a smaller version: the beat before its bar
       line the kick and the snare drop out. Leaving Fever is immediate. */
    let dropNow = false, preDrop = false, megaNow = false;
    if (full && state.fever) {
      if (!feverOn && feverDrop < 0) { if (first) feverOn = true; else { feverDrop = pickup + (bar + 1) * bpb; preDrop = !feverRiser; feverRiser = true; } }
      if (!feverOn && feverDrop >= 0 && beat >= feverDrop - 1e-6) { feverOn = true; feverDrop = -1; dropNow = true; }
    } else if (feverOn || feverDrop >= 0) {
      feverOn = false; feverDrop = -1; feverRiser = false; megaOn = false; megaDrop = -1;
      if (chain) { const f = chain.arr.frequency; f.cancelScheduledValues(when); f.setValueAtTime(20000, when); }
    }
    exLevel(when, !full ? 0.2 : feverOn ? 1 : lvl >= 2 ? 0.6 : lvl >= 1 ? 0.3 : 0.2);
    if (feverOn && state.mega) {
      if (!megaOn && megaDrop < 0) { if (first) megaOn = true; else megaDrop = pickup + (bar + 1) * bpb; }
      if (!megaOn && megaDrop >= 0 && beat >= megaDrop - 1e-6) { megaOn = true; megaDrop = -1; megaNow = true; }
    } else { megaOn = false; megaDrop = -1; }
    const fever = full && feverOn, mega = fever && megaOn;
    const megaPre = fever && !megaOn && megaDrop >= 0 && beat >= megaDrop - 1 - 1e-6;
    /* ── P10 · the form. Eight bars of verse, eight of chorus (the second voice moves up, the off-beat hats open), and the last bar
       of every sixteen is a break: the kick and the snare leave on its last beat, a riser climbs, the voices other than the
       pad and the first bass note rest, and the next downbeat lands harder. All of it from the bar number. */
    const chorus = Math.floor(bar / 8) % 2 === 1;
    const brk = full && bar % 16 === 15 && bar < lastBar - 1;
    const dropout = megaPre || (brk && pos >= bpb - 1 - 1e-6);
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
    const kickF = dropout ? () => {} : kick, snareF = dropout ? () => {} : snare, clapF = dropout ? () => {} : clap;
    let drum = "";
    if (on("drums")) if (onBeat) {
      if (kitdrums === "none") { hat(when, 0.34 * dv * A, false); drum = "tick"; }
      else if (waltz) { if (p === 0) { kickF(when, 0.85 * dv * A); drum = "kick"; } else { hat(when, 0.3 * dv * A, false); drum = "tick"; } }
      else if (march) { snareF(when, (p === 0 ? 1 : 0.62) * dv * A); drum = "snare"; }
      else if (kitdrums === "clap") {
        if (p === 0 || p === 2) { kickF(when, dv * A); drum = "kick"; } else { clapF(when, 0.9 * dv * A); drum = "clap"; }
      }
      else if (kitdrums === "ride") { ride(when, dv * A * (p === 0 ? 1.1 : 0.8)); drum = "ride"; }
      else if (kitdrums === "timpani") { tom(when, 72, 0.7 * dv * A); drum = "timp"; }
      else if (kitdrums === "soft") {
        if (p === 0) { kickF(when, 0.72 * dv * A); drum = "kick"; } else { hat(when, 0.6 * dv * A, false); drum = "hat"; }
      }
      else if (p === 0 || p === 2) { kickF(when, dv * A); drum = "kick"; }
      else { snareF(when, dv * A); drum = "snare"; if (fever && !dropout) clap(when, 0.8 * A); }
      if (dropout && (drum === "kick" || drum === "snare" || drum === "clap")) drum = "";
    }
    if (on("drums")) {
      if (kitdrums !== "none" && !waltz && !march) { hat(when, (onBeat ? 1 : L2 ? 0.75 : 0.7) * dv * A, !onBeat && L2 && (chorus || fever)); if (!onBeat) drum = "hat"; }   // open hats on the off-beats from combo 8, in the chorus and in Fever
      else if (kitdrums === "none" && !onBeat && fast && fever) { hat(when, 0.4 * dv * A, false); drum = "hat"; }
      if (mega) { hat(when + beatSec * 0.25, 0.5 * A, false); if (!drum) drum = "hat"; }      // sixteenths
    }
    const entry = { beat, when, drum, pos, parts: "", extras: "", notes: [], lvl, bar };   // parts: the pitched layers; extras: crash and toms; notes: [midi, role] of every pitched note
    log.push(entry);
    if (log.length > 400) log.shift();
    if (!full || !c) return;
    const chordStart = Math.abs(beat - c.at) < 1e-6;
    const last = c === bars[bars.length - 1];
    const finale = chordStart && last && L1 && bars.length > 1;
    // ── P02 · a layer about to enter: a riser into the bar line over its last two beats, a pickup on its last half-beat
    if (pendBar >= 0 && bar + 1 === pendBar && kitdrums !== "none") {
      const left = bpb - pos;
      if ((leadIn && left <= 2.01) || (!leadIn && Math.abs(left - 2) < 1e-6)) {
        if (left * beatSec >= 0.25) riser(when, left * beatSec, 0.08);
        entry.extras += "r";
      }
      if (Math.abs(left - 0.5) < 1e-6) {
        if (waltz) rim(when, 0.9 * A);
        else if (kitdrums === "clap") clap(when, A);
        else if (kitdrums === "ride") { ride(when, 0.9 * A); noiseHit(when, 0.1 * A, "bandpass", 3800, 1, 0.09); }
        else if (kitdrums === "timpani") tom(when, 110, 0.7 * A);
        else snare(when, 0.65 * A);
        entry.extras += "u";
      }
    }
    // ── P07 · Fever's pre-drop and its drop
    if (preDrop) {
      const left = (feverDrop - beat) * beatSec;
      if (left >= 0.2) { riser(when, left, 0.1); entry.extras += "r"; }
      const fl = Math.min(beatSec, left * 0.9);
      if (fl > 0.06) { const f = node().arr.frequency; f.cancelScheduledValues(when); f.setValueAtTime(20000, when); f.exponentialRampToValueAtTime(700, when + fl); }
    }
    if (dropNow) {
      const f = node().arr.frequency; f.cancelScheduledValues(when); f.setValueAtTime(20000, when);
      crash(when, 0.9);
      if (drum === "kick") kick(when, 0.4 * A);
      entry.extras += "F";
    }
    if (megaPre && Math.abs(pos - (bpb - 0.5)) < 1e-6 && kitdrums !== "none") tom(when, 130, 0.6 * A);
    if (megaNow) { crash(when, 0.5); entry.extras += "M"; }
    // ── the opening: a crash on the first note of the song
    if (beat < 1e-6 && kitdrums !== "none") { crash(when, 0.55); entry.extras += "o"; }
    // ── P17 · the end of every fourth bar: the genre's own fill (a style the table does not name keeps the toms), then a crash on the bar after it
    if (L2 && kitdrums !== "none" && (bar + 1) % 4 === 0 && !brk) {
      const fk = !kit ? "tom" : march ? "roll" : waltz ? "rimtap" : (kit.fill || "tom");
      const fe = fillAt(fk, pos, when, beatSec, A);
      if (fe && !entry.extras.includes(fe)) entry.extras += fe;
    }
    if (L2 && kitdrums !== "none" && bar > 0 && bar % 4 === 0 && p === 0 && onBeat) { crash(when, bar % 16 === 0 ? 0.6 : 0.4); entry.extras += "k"; }
    // the break: a riser on its last beat, so the next downbeat hits harder
    if (brk && kitdrums !== "none" && Math.abs(pos - (bpb - 1)) < 1e-6) { riser(when, beatSec * 0.95, 0.07 * A); entry.extras += "z"; }
    // ── bass. The default band: root, root, fifth, root on the beats (waltz: root, fifth, fifth), an octave bump on the off-beats in
    //    Fever and a step into the next root before a chord change. A style with a `bass` plays its own line (P17-style arranging):
    //    a walking line (jazz, blues, swing, baroque), boom-chick (folk, kids), a pedal (strings, carol, impressionism), the bossa
    //    pattern and a soul push. Every note is a chord tone, a step of the song's own scale or the next chord's root. Not when the
    //    player has the left hand.
    const sing = kit && (kit.lead === "epiano" || kit.pad === "strings" || kit.pad === "pad");
    if (L1 && hand === "right" && !finale && on("b") && !(brk && !(onBeat && p === 0))) {
      const root = 12 * 3 + c.root;                                            // C2 = 36
      const fifth = root + ((c.pcs[2] - c.root + 12) % 12);
      const third = root + ((c.pcs[1] - c.root + 12) % 12);
      /* M7 · the last eighth before a chord change steps to the next root
         instead of repeating itself. A bass that only says "root, fifth" is
         what makes a loop sound like a loop — the approach note is the whole
         difference, and it costs one note. */
      const nx = bars.find((b) => b.at > c.at + 1e-6);
      const nxRoot = nx ? 12 * 3 + nx.root : null;
      const apr = nxRoot != null ? root + (((nxRoot - root) % 12) + 12) % 12 : null;
      const lastHalf = Math.abs(pos - (bpb - 0.5)) < 1e-6;
      const vb = (slow ? 0.85 : 1) * A;
      let bk = kit && kit.bass ? kit.bass : "";
      if ((bk === "bossa" || bk === "push") && bpb !== 4) bk = bk === "bossa" ? "boom" : "";
      const put = (m, dur, v, role) => { bass(when, m, dur, v, sing); entry.parts += "b"; note(entry, m, role); };
      if (bk === "walk") {
        if (onBeat) {
          let m = root, role = "chord";
          if (p === bpb - 1 && nx && nx.root !== c.root) {
            // a step into the next chord: the tone of the song's scale just under its root, else the fifth below it
            m = nxRoot - 5; role = "next";
            for (let d = 1; d <= 3; d++) { const t = nxRoot - d; if (songPcs.has(t % 12)) { m = t; role = "scale"; break; } }
          } else if (p > 0) { m = (bpb === 2 || (p === bpb - 1 && bpb === 3)) ? fifth : (p % 2 === 1 ? third : fifth); }
          put(m, beatSec * 0.85, 0.098 * vb, role);       // a walking line has a note on every beat, so each is a little shorter and softer than the default band's long notes (energy under 250 Hz)
        }
      } else if (bk === "boom") {
        const hit = bpb === 3 ? p === 0 : (p === 0 || (bpb === 4 && p === 2) || (bpb === 2 && p === 1));
        if (onBeat && hit) put(bpb === 3 ? (bar % 2 === 0 ? root : fifth) : (p === 0 ? root : fifth), beatSec * 0.55, 0.125 * vb, "chord");
        else if (lastHalf && apr != null && bpb === 4) put(apr, beatSec * 0.4, 0.1 * A, "next");
      } else if (bk === "pedal") {
        if (chordStart) put(root, Math.min(c.len, Math.max(1, endBeat - c.at + 1)) * beatSec * 0.85, 0.078 * vb, "chord");      // a held note carries three times the energy of a short one: 0.105 -> 0.078 took the classical waltz from 94 % of its energy under 250 Hz to the old band's level
        else if (c.len >= 3 && Math.abs(beat - c.at - Math.floor(c.len / 2)) < 1e-6) put(fifth, beatSec * 0.9, 0.066 * vb, "chord");
        else if (lastHalf && apr != null) put(apr, beatSec * 0.4, 0.09 * A, "next");
      } else if (bk === "bossa") {
        if (Math.abs(pos) < 1e-6) put(root, beatSec * 1.4, 0.13 * vb, "chord");
        else if (Math.abs(pos - 1.5) < 1e-6) put(fifth, beatSec * 0.45, 0.1 * vb, "chord");
        else if (Math.abs(pos - 2) < 1e-6) put(root, beatSec * 0.9, 0.11 * vb, "chord");
        else if (lastHalf) { if (apr != null) put(apr, beatSec * 0.45, 0.1 * vb, "next"); else put(fifth, beatSec * 0.45, 0.1 * vb, "chord"); }
      } else if (bk === "push") {
        if (Math.abs(pos) < 1e-6) put(root, beatSec * 1.1, 0.115 * vb, "chord");
        else if (Math.abs(pos - 1.5) < 1e-6) put(root, beatSec * 0.3, 0.075 * vb, "chord");   // the ghost note
        else if (Math.abs(pos - 2) < 1e-6) put(fifth, beatSec * 0.8, 0.1 * vb, "chord");
        else if (lastHalf) { if (apr != null) put(apr, beatSec * 0.45, 0.105 * vb, "next"); else put(root, beatSec * 0.45, 0.1 * vb, "chord"); }
      } else if (onBeat) {
        const long = p === 0 || (bpb === 4 && p === 2);
        const m = bpb === 4 ? (p === 2 ? fifth : root) : (p === 0 ? root : fifth);
        put(m, beatSec * (long ? 0.92 : 0.45) * (fast ? 0.8 : 1), (long ? 0.13 : 0.11) * vb, "chord");
      } else if (fever) {
        put(root + 12, beatSec * 0.32, 0.095 * A, "chord");
      } else if (apr != null && lastHalf) {
        put(apr, beatSec * 0.4, 0.1 * A, "next");
      }
    }
    // ── chords, at the start of each: a drone from the beginning, strings once the combo is 8
    if (chordStart) {
      const dur = Math.min(c.len, Math.max(1, endBeat - c.at + 1)) * beatSec;
      const low = hand === "right";
      const notes = stack(c, low ? 3 : 4);
      if (!finale && state.combo >= 1 && on("n")) {                             // (before a first hit the band cannot know it is not a piano on the mic)
        /* P03 · the drone fades in over the first bar instead of arriving at full level on the first hit */
        section(when, [notes[0], notes[2]], dur * 0.98, { v: 0.03 * A, type: "sine", attack: bar === 0 ? Math.min(1.1, dur * 0.45) : 0.25, release: 0.4, cutoff: 3000, detune: 0, partials: 2, echo: 0.08, pan: "n" });
        entry.parts += "d"; note(entry, [notes[0], notes[2]], "chord");
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
        const pad = kit && kit.pad === "strings" ? { v: 0.044, cutoff: 3600 }     // a string pad opens up over the same notes (0.031 while the pad sat in root position inside the tune and the classical waltz measured -11.7 dB under the player; with the voicing leaving the tune's own pitches free it is 0.044 and the worst string style measures -13.3 dB)
          : kit && kit.pad === "continuo" ? { v: 0.036, cutoff: 3800 }
          : kit && (kit.pad === "softpad" || kit.pad === "pad") ? { v: 0.03, cutoff: 2400 }
          : { v: 0.04, cutoff: 3100 };                                        // the band as it was before M2
        if (finale) {
          /* P13 · the hit, then the hall: the full chord strikes and lets go, and the swell blooms in under the echo after it —
             the pad ducks after the hit and breathes back, instead of one flat sustain */
          section(when, notes, beatSec * 0.5, { ...pad, v: pad.v * A, type: "sawtooth", attack: 0.03, release: 0.25, q: 0.7, detune: 7, partials: 3, echo: 0.4, pan: "c", shimmer: [[4, 0.13], [6, 0.07]] });
          section(when + 0.2, notes, Math.max(dur * 1.6, beatSec * 3, 3), { ...pad, v: pad.v * A, type: "sawtooth", attack: 0.6, release: 1.6, q: 0.7, detune: 7, partials: 3, echo: 0.5, pan: "c", shimmer: [[4, 0.13], [6, 0.07]] });
          note(entry, notes, "chord");
        } else {
          const pn = voice(c, "pad", low ? 48 : 60, low ? 65 : 77, melDuring(c));          // the triad voiced to move as little as possible from the last one, and away from the notes the player is about to play (measured: a plain voice-led pad up to F4 sat inside the tune and took the kids style to -11.1 dB under the player's note)
          section(when, pn, dur * 0.98, { ...pad, v: pad.v * A, type: "sawtooth", attack: 0.16, release: 0.4, q: 0.7, detune: 7, partials: 3, echo: 0.1, pan: "c", shimmer: [[2, 0.2], [4, 0.13], [6, 0.07]] });   // [2, .2]: the octave above, the body the voice-led pad lost when it moved down out of the tune's way
          note(entry, pn, "chord");
        }
        entry.parts += "c";
      }
      // ── M2 · M3 · the style's own voice on the chord change: harpsichord, organ,
      //    celesta, or a plucked guitar for the folk/kids styles.
      if (kit && kit.lead !== "strings" && kit.lead !== "epiano" && (L1 || finale) && on("l") && !brk) {
        /* M7 · when the player's note is sounding, this voice drops an octave
           instead of doubling it an octave up. */
        const led = stack(c, melHere ? 4 : (low ? 5 : 6)).slice(0, 3);
        const ldur = beatSec * (waltz ? 1 : (fever ? 0.9 : 2));
        const lv = 0.05 * A * (melHere ? 0.7 : 1);
        if (kit.lead === "harpsichord") harpsichord(when, led, ldur, lv);
        else if (kit.lead === "organ") organ(when, led, ldur * 1.2, lv);
        else if (kit.lead === "celesta") celesta(when, [led[0] + 12, led[1] + 12], ldur, lv);
        else pluck(when, led[2], ldur * 0.9, lv);                             // folk / kids / cn: a guitar pluck
        entry.parts += "l"; note(entry, kit.lead === "celesta" ? [led[0] + 12, led[1] + 12] : kit.lead === "harpsichord" || kit.lead === "organ" ? led : led[2], "chord");
      }
      if ((fever || finale) && on("x") && !brk) {                                      // brass stabs on the chord changes
        const br = voice(c, "x", melHere ? 48 : 57, melHere ? 65 : 74);       // voice-led, so the stabs move by step from chord to chord
        section(when, br, beatSec * (finale ? 1.2 : 0.34), { v: 0.045 * A, type: "sawtooth", attack: 0.012, release: 0.14, cutoff: 3600, cutoff2: 950, sweep: 0.13, q: 0.8, detune: 6, echo: finale ? 0.6 : 0.3, partials: 3, pan: "x" });
        entry.parts += "x"; note(entry, br, "chord");
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
        note(entry, 12 * 3 + c.root, "chord");
        tom(when, 90, 0.9);
        entry.parts += "!";
      }
    }
    // ── P13 · into the finale: a roll on the last beat before it, and over the last half-bar a rising run of the final chord's
    //    notes that ends on its top note (the chord is anticipated, which is what a harp glissando into a last chord does)
    const lastC = bars[bars.length - 1];
    if (L1 && !finale && bars.length > 1 && lastC && c !== lastC) {
      const toGo = lastC.at - beat;
      if (kitdrums !== "none" && Math.abs(toGo - 1) < 1e-6) {
        for (let k = 0; k < 4; k++) {
          const t = when + k * beatSec * 0.25, v = (0.5 + 0.13 * k) * A;
          if (kitdrums === "ride") snare(t, 0.35 * v); else if (kitdrums === "clap") clap(t, v); else tom(t, [200, 170, 140, 110][k], v);
        }
        entry.extras += "R";
      }
      if (on("y") && toGo > 1e-6 && toGo <= bpb / 2 + 1e-6 && Math.abs(toGo * 2 - Math.round(toGo * 2)) < 1e-6) {
        const pcs = pcOf3(lastC), ladder = [];
        for (let m = 60; m <= 90; m++) if (pcs.includes(m % 12)) ladder.push(m);
        const n = bpb * 2, run = ladder.slice(-n), i = Math.round((bpb / 2 - toGo) * 2);
        if (run.length === n && 2 * i + 1 < n) {
          for (let j = 0; j < 2; j++) pluck(when + j * beatSec * 0.25, run[2 * i + j], beatSec * 0.9, 0.04 * A * (melHere ? 0.7 : 1) * (0.75 + 0.25 * (2 * i + j) / (n - 1)), "h");
          note(entry, [run[2 * i], run[2 * i + 1]], "ant");
          entry.parts += "y";
        }
      }
    }
    // ── M5 · the strings stop being a pad: a line moves over the chord, a note
    //    or two above it, in the notes of the chord playing now. Only for the
    //    styles that ARE string music — the default band is left as it was.
    if (kit && kit.lead === "strings" && L1 && onBeat && !finale && !melHere && !brk && on("m")) {
      /* M7 · the line moves where the player's note is NOT — the gaps are the
         only place a counter-line does not fight the tune. It steps from chord tone to chord tone (nearTone), so it follows the
         harmony and the voice leading instead of hopping to a new register every beat. */
      const mel = nearTone(c, "m", 64, 81);
      if (mel != null) {
        section(when, [mel], beatSec * (waltz ? 0.8 : 0.9), { v: 0.016 * A, type: "sawtooth", attack: 0.09, release: 0.22, cutoff: 2600, q: 0.6, detune: 9, partials: 3, echo: 0.12, pan: "m" });
        entry.parts += "m"; note(entry, mel, "chord");
      }
    }
    /* ── the style's other instruments. The first joins with the combo's first layer (3), the second with the strings (8). They
       leave the player alone the same way the string line does: a line only plays where the player's note is NOT sounding, and a
       voice that lives in the player's octave is only a pad below it. Nothing here runs for a style without `extra`. */
    if (kit && kit.extra && !finale && !brk) {
      for (let i = 0; i < 2; i++) {
        const nm = kit.extra[i];
        if (!nm || !(i === 0 ? L1 : L2)) continue;
        const ev = 0.026 * A;
        if (nm === "flute" || nm === "oboe" || nm === "sax") {
          const gap = onBeat && (p === 0 || p === Math.floor(bpb / 2)) && !melHere && !(slow && p !== 0);
          if (gap && on("w")) {
            /* the line steps from chord tone to chord tone (nearTone); in the chorus the second voice moves up an octave */
            const sh = chorus && i === 1 && nm !== "flute" ? 12 : 0;
            const rg = nm === "flute" ? [76, 91] : nm === "oboe" ? [67, 84] : [57, 76];
            const m = nearTone(c, "w" + i, rg[0] + sh, rg[1] + sh);
            const ld = beatSec * (waltz ? 1.4 : 1.8);
            if (m != null) {
              if (nm === "sax") saxLine(when + hum(beat, i), m, ld, ev); else windLine(when + hum(beat, i), m, ld, ev, nm);
              entry.parts += "w"; note(entry, m, "chord");
            }
          }
        } else if (nm === "horn") {
          if (chordStart && on("e")) { const hn = stack(c, 3).slice(1, 3); hornPad(when, hn, Math.min(c.len, Math.max(1, endBeat - c.at + 1)) * beatSec * 0.96, 0.03 * A); entry.parts += "e"; note(entry, hn, "chord"); }
        } else if (nm === "harp") {
          if (chordStart && on("h")) { const hp = stack(c, melHere ? 4 : 5); harpRoll(when + hum(beat, i), hp, beatSec, 0.04 * A); entry.parts += "h"; note(entry, hp, "chord"); }
        } else if (nm === "strum") {
          if ((chordStart || (onBeat && p === Math.floor(bpb / 2) && bpb === 4)) && on("h")) { const sm = stack(c, 4); strumChord(when + hum(beat, i), sm, beatSec, 0.04 * A, !chordStart); entry.parts += "h"; note(entry, sm, "chord"); }
        } else if (nm === "vibes") {
          if (!melHere && !onBeat && (bar + Math.round(pos * 2)) % 2 === 0 && on("h")) {
            const pc = (c.pcs[(bar + Math.round(pos * 2)) % 3] - c.root + 12) % 12;
            const vm = 12 * 6 + c.root % 12 + pc;
            vibesNote(when + hum(beat, i), vm, beatSec * 1.2, 0.03 * A); entry.parts += "h"; note(entry, vm, "chord");
          }
        }
      }
    }
    // ── Fever: an arpeggio of the chord, plucked, up and down, on every half-beat
    if (fever && !finale && !brk && !(melHere && !onBeat) && on("a")) {
      const k = Math.round((beat - c.at) * 2), pat = [0, 1, 2, 3, 2, 1], idx = pat[((k % 6) + 6) % 6];
      const off = idx === 3 ? 12 : (c.pcs[idx] - c.root + 12) % 12;            // root, third, fifth, octave
      const am = 12 * (melHere ? 5 : 6) + c.root + off + (mega ? 12 : 0);
      pluck(when, am, beatSec * 0.42, 0.06 * A, "a");   // C5 = 72
      entry.parts += "a"; note(entry, am, "chord");
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
      chain = null; nextHalf = null; wasFever = false; resetArr(); grid = null; dipUntil = 0;
    },
    /* The song ended by itself: let the last chord ring out and fade over
       `secs` instead of cutting it. */
    ringOut(secs = 1.8) {
      if (chain) {
        try { const { ac } = audioBus(); const m = chain.master; const t = ac.currentTime; m.gain.cancelScheduledValues(t); m.gain.setValueAtTime(m.gain.value, t); m.gain.linearRampToValueAtTime(0, t + secs); setTimeout(() => { try { m.disconnect(); } catch (e) {} }, secs * 1000 + 200); } catch (e) {}
      }
      chain = null; nextHalf = null; wasFever = false; resetArr();
    },
    /* The count-in and the drill's pass count-ins: drum sticks. */
    stick(when, accent, last = false) {
      if (!level || _sfxMuted) return false;
      try {
      /* the LAST count-in beat is the "go": the same sticks, but a double-click (a quick flam just before the beat), louder, a
         higher click and a hat on top, so the downbeat of the song is announced instead of simply arriving. With a mic listening
         for a pianist the pitched click is left out and only the noise is played. */
      if (last) {
        noiseHit(Math.max(when - 0.045, audioBus().ac.currentTime), 0.2, "bandpass", 2400, 3, 0.04);
        hat(when, 0.9, false);
      }
      noiseHit(when, last ? 0.5 : accent ? 0.34 : 0.22, "bandpass", last ? 3000 : accent ? 2600 : 2200, 3, last ? 0.07 : 0.05);
      const f = last ? 2349 : accent ? 1760 : 1480;
      if (!(last && _micSafe)) {
        const { ac } = audioBus(), o = ac.createOscillator(), g = ac.createGain();
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(last ? 0.08 : accent ? 0.05 : 0.035, when + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, last ? 0.05 + when : when + 0.03);
        o.connect(g); g.connect(node().mix); o.start(when); o.stop(when + 0.07);
        suppress(f, when, last ? 0.05 : 0.03);
      }
      return true;
      } catch (e) { return false; }   // a throw here must never reach the run: the caller then plays the plain click
    },
    /* P04 · a milestone sound in the song's key, booked on the next eighth of the band's own grid so it lands with the groove
       (never more than a third of a second late: past that it goes now). kind: fever · mega · mark · mark100 · ten · boss. The
       band's level does not matter — it is an effect, like the hit ding, and obeys only the mute. n: the combo, for "ten". */
    /* P05 · the game calls this on a Perfect (and stinger() calls it itself): the band steps back ~2 dB for ~110 ms. */
    duck(db = 2, ms = 110) { try { return hitDuck(db, ms); } catch (e) { return false; } },
    stinger(kind, n = 0) {
      try {
        if (_sfxMuted) return false;
        const { ac } = audioBus();
        let when = ac.currentTime + 0.02, beat = 0;
        if (grid && ac.currentTime - grid.at < 0.5) {
          const songNow = grid.song + (ac.currentTime - grid.at) * (grid.tempo || 1);
          const h = Math.ceil(((songNow - lead) / spb) * 2 - 1e-6), w = grid.toAudio(lead + (h / 2) * spb);
          beat = Math.max(0, h / 2);
          if (w >= ac.currentTime + 0.012 && w - ac.currentTime <= 0.34) when = w;
        }
        playStinger(kind, chordAt(beat), when, n);
        hitDuck(kind === "ten" ? 1.5 : 2.5, kind === "fever" || kind === "mega" || kind === "boss" ? 140 : 110, when);
        return true;
      } catch (e) { return false; }
    },
    /* P06 · the band notices a miss: the pitched voices close their low-pass to ~1.2 kHz over 80 ms and drop 4 dB, hold for a beat,
       then open again over 0.4 s. The drums are not on that bus, so the beat never goes. Gentle on purpose (no crowd, no boo). */
    miss() {
      try {
        if (!chain || !level || _sfxMuted) return false;
        const { ac } = audioBus(), t = ac.currentTime, f = chain.pit.frequency, g = chain.pitG.gain;
        const closed = t < dipUntil;                                  // a second miss while the first still holds: from where it is
        const beatSec = spb / ((grid && grid.tempo) || 1);
        f.cancelScheduledValues(t); g.cancelScheduledValues(t);
        f.setValueAtTime(closed ? 1200 : 20000, t); f.exponentialRampToValueAtTime(1200, t + 0.08);
        g.setValueAtTime(closed ? 0.63 : 1, t); g.linearRampToValueAtTime(0.63, t + 0.08);
        const hold = t + 0.08 + beatSec;
        f.setValueAtTime(1200, hold); f.exponentialRampToValueAtTime(20000, hold + 0.4);
        g.setValueAtTime(0.63, hold); g.linearRampToValueAtTime(1, hold + 0.4);
        dipUntil = hold + 0.4;
        return true;
      } catch (e) { return false; }
    },
  };
}

/* ── the game's own musical sounds: the hit ding, the milestone stingers, the result jingle ──
   They live here, beside the band, because they are built from the band's chord (chordAt) and use its voices' rules: every
   pitched note is blacklisted from the pitch detector (pitch and first overtone), and the voice for a pianist whose microphone is
   open is noise far above the piano (hfPing) — the detector low-passes at 2.6 kHz before it listens, so nothing up there is read
   as a note. They are effects, not band parts: they obey the mute and ignore the band's own level. */

/* one struck bell: a sine and its octave (the octave quieter and shorter), a fast attack, a decay. Its two pitches go on the
   detector's blacklist for as long as it rings. */
function bell(ac, bus, when, midi, dur, v, ring = 0.4) {
  const f = mtof(midi);
  if (!f || f > 4200) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = "sine"; o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(v, when + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g); g.connect(bus); o.start(when); o.stop(when + dur + 0.03);
  if (ring > 0) {
    const o2 = ac.createOscillator(), g2 = ac.createGain();
    o2.type = "sine"; o2.frequency.value = f * 2;
    g2.gain.setValueAtTime(0.0001, when);
    g2.gain.exponentialRampToValueAtTime(v * ring, when + 0.003);
    g2.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.55);
    o2.connect(g2); g2.connect(bus); o2.start(when); o2.stop(when + dur * 0.55 + 0.03);
  }
  const until = Date.now() + Math.max(0, (when - ac.currentTime) * 1000) + dur * 1000 + 120;
  _accMarkSuppress(f, 50, until);
  if (ring > 0) _accMarkSuppress(f * 2, 50, until);
}
// a rising wash of noise that ends at `end` (the riser into a downbeat); `lo`/`hi` its band
function riser(ac, bus, end, len, v, lo, hi) {
  if (len < 0.05) return;
  const s = end - len;
  const src = ac.createBufferSource(); src.buffer = _accNoise(ac); src.loop = true;
  const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(lo, s); bp.frequency.exponentialRampToValueAtTime(hi, end);
  const g = ac.createGain(); g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(v, end - 0.005); g.gain.exponentialRampToValueAtTime(0.0001, end + 0.04);
  src.connect(bp); bp.connect(g); g.connect(bus); src.start(s); src.stop(end + 0.06);
}
// a cymbal-ish crash: noise above `hp`, a long tail (unpitched)
function crashFx(ac, bus, when, v, hp, tail) {
  const src = ac.createBufferSource(); src.buffer = _accNoise(ac); src.loop = true;
  const f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = hp; f.Q.value = 0.6;
  const g = ac.createGain(); g.gain.value = 0.0001;
  g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(v, when + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, when + tail);
  src.connect(f); f.connect(g); g.connect(bus); src.start(when); src.stop(when + tail + 0.03);
}
// the notes of the chord playing now: root / third / fifth at an octave (C5 = 72)
function chordNotes(chord) {
  const pcs = chord && chord.pcs && chord.pcs.length >= 3 ? chord.pcs : [0, 4, 7];
  const root = chord && chord.root != null ? chord.root : pcs[0];
  const up = (pc) => ((pc - root) % 12 + 12) % 12;
  const R = (oct) => 12 * (oct + 1) + root;
  return { R, T: (oct) => R(oct) + up(pcs[1]), F: (oct) => R(oct) + up(pcs[2]), root };
}

/* The hit "ding": a short bell on a note of the chord playing right now, climbing through the chord's notes as the combo grows —
   in the song's key, unlike the C-major ladder it replaces. An effect, so it obeys the mute.
   P01 · graded: Perfect is the bell plus a sparkle an octave up and a tiny noise "tss"; Great is the bell; Good is softer, shorter,
   one partial. A pianist whose microphone is open gets the same three grades as noise far above the piano (a double ping at
   ~9 kHz, one at ~7 kHz, a single soft one at ~5.3 kHz) — before this a player on a real piano heard nothing for a hit at all. */
export function playChordDing(chord, combo, vol = 1, grade = "great") {
  try {
    if (_sfxMuted) return;
    const gr = grade === "perfect" ? 3 : grade === "good" ? 1 : 2;
    if (_micSafe) {
      const { ac, bus } = audioBus(), t0 = ac.currentTime;
      if (gr === 3) { hfPing(ac, bus, t0, 9000, 0.75 * vol, 0.045); hfPing(ac, bus, t0 + 0.06, 9800, 0.6 * vol, 0.05); }
      else if (gr === 2) hfPing(ac, bus, t0, 7000, 0.62 * vol, 0.045);
      else hfPing(ac, bus, t0, 5300, 0.36 * vol, 0.035);
      return;
    }
    const pcs = chord && chord.pcs && chord.pcs.length ? chord.pcs : [0, 4, 7];
    const i = Math.max(0, combo - 1) % (pcs.length * 2);
    const f = mtof(12 * (i < pcs.length ? 6 : 7) + (pcs[i % pcs.length] % 12));
    if (!f) return;
    const { ac, bus } = audioBus(), t0 = ac.currentTime;
    const until = Date.now() + 380;
    _accMarkSuppress(f, 50, until);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine"; o.frequency.value = f;
    const tail = gr === 1 ? 0.13 : 0.22;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime((gr === 1 ? 0.07 : 0.11) * vol, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + tail);
    o.connect(g); g.connect(bus); o.start(t0); o.stop(t0 + tail + 0.03);
    if (gr === 3 && f * 2 <= 8400) {                 // the sparkle: the octave above, brief, with a puff of noise on top
      _accMarkSuppress(f * 2, 50, until);
      const s = ac.createOscillator(), sg = ac.createGain();
      s.type = "sine"; s.frequency.value = f * 2;
      sg.gain.setValueAtTime(0.0001, t0 + 0.012);
      sg.gain.exponentialRampToValueAtTime(0.05 * vol, t0 + 0.017);
      sg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
      s.connect(sg); sg.connect(bus); s.start(t0 + 0.012); s.stop(t0 + 0.19);
      const n = ac.createBufferSource(); n.buffer = _accNoise(ac); n.loop = true;
      const nf = ac.createBiquadFilter(); nf.type = "highpass"; nf.frequency.value = 7000; nf.Q.value = 0.7;
      const ng = ac.createGain(); ng.gain.value = 0.0001;
      ng.gain.setValueAtTime(0.0001, t0); ng.gain.exponentialRampToValueAtTime(0.03 * vol, t0 + 0.002); ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
      n.connect(nf); nf.connect(ng); ng.connect(bus); n.start(t0); n.stop(t0 + 0.06);
    }
  } catch (e) {}
}

/* P04 · the milestone stingers. Each is built from the chord playing at that moment, so in D minor or F♯ major it is in D minor or
   F♯ major (the fixed C-E-G-C arpeggio it replaces clashed with the band in every key but C):
     fever    a rising chord-tone run into a riser that lands on the grid, then a long top note
     mega     the same run an octave up with a second voice a fifth above it, and a short sub boom
     mark     a two-note bell figure (fifth, then the octave of the root) — a combo mark at 25/50/75 % of the song
     mark100  the figure, a rising third note and a shimmering tail — the 100 % mark
     ten      a small two-note ping every ten notes in a row
     boss     a long run up two octaves of the chord, a held pair and a crash
   `when` is the audio time to land on (band.stinger() hands it the next eighth of the band's grid). A pianist's microphone gets
   noise instead: ping shimmers and an unpitched riser, nothing in the piano's range. Nothing lasts more than about 1.2 s. */
export function playStinger(kind, chord, when, n = 0) {
  try {
    if (_sfxMuted) return;
    const { ac, bus } = audioBus();
    const t0 = Math.max(ac.currentTime + 0.005, when), room = t0 - ac.currentTime;
    const { R, T, F } = chordNotes(chord);
    const tones = [R(5), T(5), F(5)].map((m) => m % 12);
    const nearestTone = (m) => { let best = m, d = 99; for (let x = m - 3; x <= m + 3; x++) if (tones.includes(((x % 12) + 12) % 12) && Math.abs(x - m) < d) { d = Math.abs(x - m); best = x; } return best; };
    const mic = _micSafe;
    const hf = (dt, f, v, tail) => hfPing(ac, bus, t0 + dt, f, v, tail);
    if (kind === "fever" || kind === "mega") {
      const mega = kind === "mega";
      riser(ac, bus, t0, Math.min(room, 0.32), mic ? 0.5 : 0.06, mic ? 5000 : 1500, mic ? 9500 : 6500);
      if (mic) {
        (mega ? [5300, 6300, 7600, 9000, 9800] : [4300, 5300, 6300, 8300]).forEach((f, i) => hf(i * 0.065, f, 0.9, 0.16));
        if (mega) crashFx(ac, bus, t0 + 0.1, 0.07, 6000, 0.5);
      } else {
        const o = mega ? 6 : 5, run = [R(o), T(o), F(o), R(o + 1)];
        run.forEach((m, i) => {
          bell(ac, bus, t0 + i * 0.07, m, 0.34, 0.085);
          if (mega) bell(ac, bus, t0 + i * 0.07 + 0.012, nearestTone(m + 7), 0.3, 0.05);       // the second voice, a fifth above (snapped to the chord: a bare +7 on the third or fifth is a 7th/9th)
        });
        bell(ac, bus, t0 + 0.28, F(o + 1), 0.6, 0.06);
        if (mega) {                                                                 // a short sub boom under the downbeat
          const b = ac.createOscillator(), bg = ac.createGain();
          b.type = "sine"; b.frequency.setValueAtTime(95, t0); b.frequency.exponentialRampToValueAtTime(42, t0 + 0.28);
          bg.gain.setValueAtTime(0.0001, t0); bg.gain.exponentialRampToValueAtTime(0.16, t0 + 0.006); bg.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
          b.connect(bg); bg.connect(bus); b.start(t0); b.stop(t0 + 0.35);
          _accMarkSuppress(65, 1100, Date.now() + Math.max(0, room * 1000) + 420);
        }
      }
    } else if (kind === "mark" || kind === "mark100") {
      const big = kind === "mark100";
      if (mic) {
        hf(0, 6300, 0.9, 0.16); hf(0.11, 9000, 0.9, 0.2);
        if (big) { hf(0.2, 7600, 0.8, 0.25); hf(0.3, 9600, 0.45, 0.6); }
      } else {
        bell(ac, bus, t0, F(5), 0.4, 0.09); bell(ac, bus, t0 + 0.11, R(6), 0.5, 0.09);
        if (big) {
          bell(ac, bus, t0 + 0.22, T(6), 0.5, 0.075);
          bell(ac, bus, t0 + 0.32, R(7), 0.85, 0.05, 0.5);                            // the shimmer tail
          bell(ac, bus, t0 + 0.4, F(6), 0.7, 0.035, 0.6);
        }
      }
    } else if (kind === "ten") {
      if (mic) { hf(0, 6800, 0.6, 0.1); hf(0.09, 8600, 0.55, 0.12); }
      else { bell(ac, bus, t0, R(6), 0.26, 0.06); bell(ac, bus, t0 + 0.09, F(6), 0.34, 0.06); }
      if (n >= 50 && n % 50 === 0) { if (mic) hf(0.18, 9600, 0.5, 0.2); else bell(ac, bus, t0 + 0.18, R(7), 0.5, 0.045); }
    } else if (kind === "boss") {
      riser(ac, bus, t0, Math.min(room, 0.3), mic ? 0.45 : 0.06, mic ? 5000 : 1500, mic ? 9500 : 6500);
      if (mic) {
        [4300, 5000, 5800, 6700, 7800, 9200].forEach((f, i) => hf(i * 0.06, f, 0.85, 0.14));
        crashFx(ac, bus, t0 + 0.38, 0.1, 6000, 0.9);
      } else {
        [R(5), T(5), F(5), R(6), T(6), F(6)].forEach((m, i) => bell(ac, bus, t0 + i * 0.06, m, 0.34, 0.08));
        bell(ac, bus, t0 + 0.36, R(6), 0.8, 0.07); bell(ac, bus, t0 + 0.36, F(6), 0.8, 0.055); bell(ac, bus, t0 + 0.36, R(7), 0.8, 0.04);
        crashFx(ac, bus, t0 + 0.36, 0.12, 4800, 0.9);
      }
    } else return;
  } catch (e) {}
}

/* P12 · the end of a run: a short sequence timed to the result card (its stars appear 0.15 s + 0.28 s each after it mounts, its medal
   slots 0.9 s + 0.35 s each, and its two numbers count up over 0.7-0.9 s — the delays are in SongPlayOverlay).
     a count-up tick under the numbers (noise, rising),
     one ping per star on the chord's root, fifth and octave,
     3 stars: a brass-like swell on the chord and the room clapping (P11, scaled by the stars),
     a bell for each new medal,
     0 stars: only a soft two-chord cadence (the chord a fifth above, then home) — nobody is scolded.
   The microphone is closed by then (finishSong); if one were still open the pitched notes become pings. `chord` is the song's
   last chord. */
export function playResultJingle(stars, chord, opts: any = {}) {
  try {
    if (_sfxMuted) return false;
    const { ac, bus } = audioBus();
    const t0 = ac.currentTime + 0.02 + Math.max(0, opts.delay || 0);
    const s = Math.max(0, Math.min(3, Math.floor(stars || 0)));
    const medals = Math.max(0, Math.min(4, Math.floor(opts.medals || 0)));
    const { R, T, F } = chordNotes(chord);
    const mic = _micSafe;
    // the count-up: twelve ticks along the ease-out the numbers follow, climbing in pitch (noise)
    for (let i = 0; i < 12; i++) hfPing(ac, bus, t0 + 0.9 * (1 - Math.pow(1 - (i + 1) / 12, 1 / 3)), 3200 + i * 260, 0.22, 0.02);
    if (s === 0) {
      if (!mic) {
        const dom = { root: (chordNotes(chord).root + 7) % 12, pcs: [7, 11, 2].map((x) => (x + chordNotes(chord).root) % 12) };
        const D = chordNotes(dom), C = chordNotes(chord);
        [D.R(5), D.T(5), D.F(5)].forEach((m, k) => bell(ac, bus, t0 + 0.2 + k * 0.05, m, 0.7, 0.045));
        [C.R(5), C.T(5), C.F(5), C.R(6)].forEach((m, k) => bell(ac, bus, t0 + 0.75 + k * 0.05, m, 1.0, 0.045));
      }
      return true;
    }
    for (let i = 0; i < s; i++) {
      const at = t0 + 0.15 + i * 0.28;
      if (mic) { hfPing(ac, bus, at, 6000 + i * 1400, 0.85, 0.2); continue; }
      bell(ac, bus, at, i === 0 ? R(6) : i === 1 ? F(6) : R(7), 0.55, 0.1, 0.5);
      hfPing(ac, bus, at, 7600 + i * 900, 0.5, 0.18);
    }
    const lastStar = t0 + 0.15 + (s - 1) * 0.28;
    if (s === 3 && !mic) {                                    // the brass-like swell: three saws on the chord, a filter that opens
      const sw = lastStar - ac.currentTime + 0.02, dur = 1.1;
      const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.8;
      lp.frequency.setValueAtTime(700, lastStar); lp.frequency.exponentialRampToValueAtTime(3000, lastStar + 0.45);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, lastStar); g.gain.exponentialRampToValueAtTime(0.05, lastStar + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, lastStar + dur);
      lp.connect(g); g.connect(bus);
      const until = Date.now() + Math.max(0, sw * 1000) + dur * 1000 + 150;
      for (const m of [R(4), F(4), R(5)]) {
        for (const d of [-7, 7]) {
          const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.value = mtof(m); o.detune.value = d;
          const og = ac.createGain(); og.gain.value = 0.5;
          o.connect(og); og.connect(lp); o.start(lastStar); o.stop(lastStar + dur + 0.03);
        }
        for (let k = 1; k <= 3; k++) _accMarkSuppress(mtof(m) * k, 45, until);
      }
    }
    playCrowd(s, undefined, lastStar - ac.currentTime + 0.1);
    for (let k = 0; k < medals; k++) {
      const at = t0 + 0.9 + k * 0.35;
      if (mic) hfPing(ac, bus, at, 8200, 0.7, 0.3); else bell(ac, bus, at, R(7), 0.7, 0.08, 0.5);
    }
    return true;
  } catch (e) { return false; }
}

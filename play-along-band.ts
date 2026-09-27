/* ── play-along-band.ts ──
   The band that plays along with a Play Along song: drums the whole way,
   bass once the combo reaches 3, chords from 8, and an arpeggio on top in
   Fever. Play right and the music fills in; miss and it drops back to the
   drums until the combo builds again — the drums never stop, so the player
   never loses the beat.

   Everything is scheduled on the audio clock a little ahead of time (see
   pump), the same way the metronome clicks are, so a stalled frame never
   makes a late drum: the sound was already booked. The harmony comes from
   songChordBars() — the same chord-per-bar analysis the left-hand part is
   built from — at half-bar grain for 4/4.

   Two things the mic changes: a pitched band note coming out of the speaker
   can be heard by the mic as a note the player pressed. So while the mic is
   listening, a player on a real piano gets soft drums only (unpitched, which
   the pitch detector rejects), and a player tapping the screen gets the full
   band with every band note's pitch blacklisted from detection while it
   sounds (_accMarkSuppress, the mechanism the game's own sounds use).
   In the left-hand and two-hand modes the band plays no bass — that part is
   the player's.

   All sound goes through the app's sound bus, so the app-wide mute silences
   the band too. ── */
import { audioBus, _accMarkSuppress, _accNoise, NF, _sfxMuted } from "./music-engine";

export const BAND_LEVELS = [0, 0.55, 1];   // off, soft, normal
const LOOKAHEAD = 0.35;                    // seconds booked ahead of the audio clock
const PC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const freqOf = (pc, oct) => NF[PC[((pc % 12) + 12) % 12] + oct];

/* opts: bars (songChordBars, split), beatsPerBar, pickup, spb (seconds per
   beat at 1×), lead (song time of the first note), endBeat (last beat to
   play, from the first note), hand. */
export function createBand(opts) {
  const { bars, beatsPerBar: bpb, pickup, spb, lead, endBeat, hand } = opts;
  let level = opts.level == null ? 2 : opts.level;
  let out = null, nextHalf = null;          // the run's output node; next half-beat to book
  const log = [];                           // what was booked (the test hook reads it)
  const state = { combo: 0, fever: false, pitched: true, soft: false, micOpen: false };

  function chordAt(beat) {
    let c = bars[0] || null;
    for (const b of bars) { if (b.at <= beat + 1e-6) c = b; else break; }
    return c;
  }
  function node() {
    if (out) return out;
    const { ac, bus } = audioBus();
    out = ac.createGain();
    out.gain.value = BAND_LEVELS[level] * 0.8;
    out.connect(bus);
    return out;
  }
  function suppress(f, when, dur) {
    if (!f || !state.micOpen) return;
    const { ac } = audioBus();
    _accMarkSuppress(f, 45, Date.now() + Math.max(0, (when - ac.currentTime + dur) * 1000) + 150);
  }

  // ── the instruments ──
  function kick(when, v) {
    const { ac } = audioBus(), o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(140, when);
    o.frequency.exponentialRampToValueAtTime(42, when + 0.12);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.42 * v, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.2);
    o.connect(g); g.connect(node()); o.start(when); o.stop(when + 0.22);
  }
  function noiseHit(when, v, type, freq, q, dur) {
    const { ac } = audioBus(), n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    n.buffer = _accNoise(ac);
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(v, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    n.connect(f); f.connect(g); g.connect(node()); n.start(when); n.stop(when + dur + 0.02);
  }
  const snare = (when, v) => noiseHit(when, 0.24 * v, "bandpass", 1900, 0.8, 0.14);
  const hat = (when, v) => noiseHit(when, 0.08 * v, "highpass", 7000, 0.7, 0.04);
  function tone(when, f, dur, v, type = "triangle", attack = 0.01) {
    if (!f) return;
    const { ac } = audioBus(), o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(v, when + attack);
    g.gain.setValueAtTime(v, when + Math.max(attack, dur * 0.6));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g); g.connect(node()); o.start(when); o.stop(when + dur + 0.03);
    suppress(f, when, dur);
  }

  /* Book every half-beat from where we are up to LOOKAHEAD ahead.
     songTime = the song clock now; toAudio(t) = the audio time of song
     time t. Beat k (from the first note) is at song time lead + k·spb.
     Nothing before song time minSong plays (a practice pass's count-in). */
  function pump(songTime, toAudio, tempo, minSong = 0) {
    if (!level || _sfxMuted) { nextHalf = null; return; }
    const { ac } = audioBus();
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
    const dv = state.soft ? 0.5 : 1;
    // drums: kick on 1 (and 3 in 4/4), snare on the backbeats, hats between
    let drum = "hat";
    if (onBeat) {
      const p = Math.round(pos);
      if (p === 0 || (bpb === 4 && p === 2)) { kick(when, dv); drum = "kick"; }
      else { snare(when, (bpb === 3 ? 0.6 : 1) * dv); drum = "snare"; }
    }
    hat(when, (onBeat ? 1 : 0.7) * dv);
    const entry = { beat, when, drum, pos, parts: "" };
    log.push(entry);
    if (log.length > 400) log.shift();
    if (!state.pitched) return;
    const c = chordAt(beat);
    if (!c) return;
    const chordStart = Math.abs(beat - c.at) < 1e-6;
    // bass: the chord's root on its first beat, for as long as the chord lasts
    if (chordStart && state.combo >= 3 && hand === "right") {
      tone(when, freqOf(c.root, 2), Math.min(c.len, 2) * beatSec * 0.95, 0.28, "triangle", 0.008);
      entry.parts += "b";
    }
    // chords: a soft pad of the triad under the melody
    if (chordStart && state.combo >= 8) {
      for (const pc of c.pcs) tone(when, freqOf(pc, 3), c.len * beatSec * 0.98, 0.06, "sine", 0.06);
      entry.parts += "c";
    }
    // Fever: an arpeggio of the chord, up an octave, on every half-beat
    if (state.fever) {
      const idx = Math.round(beat * 2) % 4;
      const pc = c.pcs[idx % c.pcs.length];
      tone(when, freqOf(pc, idx === 3 ? 6 : 5), beatSec * 0.45, 0.045, "sine", 0.005);
      entry.parts += "a";
    }
  }

  return {
    pump,
    log,
    state,
    chordAt,
    setState(s) { Object.assign(state, s); },
    setLevel(l) { level = l; if (out) out.gain.value = BAND_LEVELS[level] * 0.8; },
    /* Stop what is booked (pause, a new pass, the end): the output fades
       and is dropped, so notes already booked go silent with it. */
    cut() {
      if (out) {
        try { const { ac } = audioBus(); out.gain.cancelScheduledValues(ac.currentTime); out.gain.setTargetAtTime(0, ac.currentTime, 0.02); const o = out; setTimeout(() => { try { o.disconnect(); } catch (e) {} }, 300); } catch (e) {}
      }
      out = null; nextHalf = null;
    },
    /* The count-in and the drill's pass count-ins: drum sticks. */
    stick(when, accent) {
      if (!level || _sfxMuted) return false;
      noiseHit(when, accent ? 0.34 : 0.22, "bandpass", accent ? 2600 : 2200, 3, 0.05);
      tone(when, accent ? 1760 : 1480, 0.03, accent ? 0.05 : 0.035, "sine", 0.002);
      return true;
    },
  };
}

/* The hit "ding": a short bell on a note of the chord playing right now,
   climbing through the chord's notes as the combo grows — in the song's key,
   unlike the C-major ladder it replaces. An effect, so it obeys the mute. */
export function playChordDing(chord, combo, vol = 1) {
  try {
    if (_sfxMuted) return;
    const pcs = chord && chord.pcs && chord.pcs.length ? chord.pcs : [0, 4, 7];
    const i = Math.max(0, combo - 1) % (pcs.length * 2);
    const f = freqOf(pcs[i % pcs.length], i < pcs.length ? 5 : 6);
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

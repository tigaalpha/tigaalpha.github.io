/* band-samples.ts — a small sampler for the Play Along backing band (owner, 2026-10-31: "the backing track is still not as good as flowkey /
   Simply Piano; at least make it as good, or we cannot compete").

   A band built only from oscillators and noise sounds like a synthesiser, whatever the arrangement. The competitors play recorded or
   sampled instruments. This module plays real instrument samples (the FluidR3_GM soundfont, CC BY 3.0, see public/band-samples/CREDITS.md and
   scripts/build-band-samples.mjs) through the band's own bus: only every third note of each instrument is kept, and the nearest kept note
   is bent by at most one semitone with playbackRate.

   Rules this file obeys:
   - NOTHING is fetched from a third party: the files are the app's own (public/band-samples/), fetched when a song with a backing track is
     opened, never before, and a failure just means the band keeps its synthesised voice (every caller asks `sampleReady()` first).
   - It is an addition: a style, an instrument or a browser that cannot use it plays the old synthesised band exactly.
   - The caller owns mic-safety: a pitched sample is a pitched sound, so the band blacklists its pitch for the mic exactly as it does for the
     synthesised voices (this file only plays what it is told to).
   - Nothing allocates per frame: buffers are decoded once per instrument and shared. */

export const BAND_SAMPLES_CREDIT = "Instrument samples: FluidR3_GM soundfont via gleitz/midi-js-soundfonts, CC BY 3.0";
export type SampleInst = "acoustic_bass" | "electric_bass_finger" | "string_ensemble_1" | "electric_piano_1" | "acoustic_guitar_nylon" | "brass_section" | "flute" | "orchestral_harp" | "pizzicato_strings";

type Inst = { notes: number[]; bufs: Map<number, AudioBuffer> };
const BASE = "band-samples/";
let _manifest: Promise<Record<string, { notes: number[] }> | null> | null = null;
const _insts = new Map<string, Inst>();
const _loading = new Map<string, Promise<boolean>>();

function manifest(): Promise<Record<string, { notes: number[] }> | null> {
  if (!_manifest) {
    _manifest = (typeof fetch === "function" ? fetch(BASE + "manifest.json").then((r) => (r.ok ? r.json() : null)).then((j) => (j && j.instruments) || null) : Promise.resolve(null))
      .catch(() => null);
  }
  return _manifest;
}
/* Fetches and decodes every kept note of the given instruments (about 150-330 KB each). Resolves true when ALL of them are ready; an instrument that fails
   stays unavailable and the rest still load. Safe to call again: a loaded or loading instrument is not fetched twice. */
export function loadBandSamples(ctx: BaseAudioContext, insts: string[]): Promise<boolean> {
  const jobs = insts.map((name) => {
    if (_insts.has(name)) return Promise.resolve(true);
    const run = _loading.get(name);
    if (run) return run;
    const p = (async () => {
      const mf = await manifest();
      const spec = mf && mf[name];
      if (!spec || !spec.notes || !spec.notes.length) return false;
      const bufs = new Map<number, AudioBuffer>();
      for (const n of spec.notes) {
        const res = await fetch(BASE + name + "/" + n + ".mp3");
        if (!res.ok) return false;
        const data = await res.arrayBuffer();
        // callback form too: old Safari has no promise-returning decodeAudioData
        const buf: AudioBuffer = await new Promise((ok, no) => { const r = (ctx as any).decodeAudioData(data, ok, no); if (r && r.then) r.then(ok, no); });
        bufs.set(n, buf);
      }
      _insts.set(name, { notes: [...spec.notes].sort((a, b) => a - b), bufs });
      return true;
    })().catch(() => false).finally(() => { _loading.delete(name); });
    _loading.set(name, p);
    return p;
  });
  return Promise.all(jobs).then((r) => r.every(Boolean));
}
export function sampleReady(name: string): boolean { return _insts.has(name); }
/* The lowest and highest note an instrument can play without bending a sample by more than 1.5 semitones: callers keep their notes inside. */
export function sampleRange(name: string): [number, number] | null { const i = _insts.get(name); return i ? [i.notes[0] - 1, i.notes[i.notes.length - 1] + 1] : null; }
/* For tests: put already decoded buffers in (name -> midi -> buffer) without any fetch. */
export function _setBandSamples(name: string, bufs: Map<number, AudioBuffer>) { _insts.set(name, { notes: [...bufs.keys()].sort((a, b) => a - b), bufs }); }
export function _clearBandSamples() { _insts.clear(); _loading.clear(); _manifest = null; }
/* For tests: forget one instrument, so a run can measure what each one adds. */
export function _unloadBandSample(name: string) { _insts.delete(name); }

/** for the tests: how many notes were played from a sample (and which instrument) */
export const _stats: { played: number; by: Record<string, number> } = { played: 0, by: {} };
export type SampleNote = { stop: (when?: number) => void; nodes: AudioNode[] };
/* One note: `midi` pitch, starting at `when` on the audio clock, held for `dur` seconds, `vel` 0..1 loudness (linear gain), sent to `dest`.
   attack / release in seconds. Returns null when the instrument is not loaded or the pitch is out of reach. */
export function playSample(ctx: BaseAudioContext, dest: AudioNode, name: string, midi: number, when: number, dur: number, vel = 0.8, o: { attack?: number; release?: number } = {}): SampleNote | null {
  const inst = _insts.get(name);
  if (!inst) return null;
  let best = inst.notes[0], d = 1e9;
  for (const n of inst.notes) { const dd = Math.abs(n - midi); if (dd < d) { d = dd; best = n; } }
  if (d > 1.5) return null;
  const buf = inst.bufs.get(best);
  if (!buf) return null;
  _stats.played++; _stats.by[name] = (_stats.by[name] || 0) + 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = Math.pow(2, (midi - best) / 12);
  const g = ctx.createGain();
  const atk = Math.max(0.002, o.attack == null ? 0.006 : o.attack), rel = Math.max(0.02, o.release == null ? 0.12 : o.release);
  const t0 = Math.max(when, ctx.currentTime), hold = Math.max(atk + 0.01, dur);
  const playable = buf.duration / src.playbackRate.value;                       // a sample ends by itself; it is faded out before it runs dry
  const tEnd = Math.min(t0 + hold, t0 + Math.max(atk + 0.05, playable - rel - 0.02));
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(Math.max(0.0001, vel), t0 + atk);
  g.gain.setValueAtTime(Math.max(0.0001, vel), tEnd);
  g.gain.linearRampToValueAtTime(0.0001, tEnd + rel);
  src.connect(g); g.connect(dest);
  src.start(t0);
  try { src.stop(tEnd + rel + 0.05); } catch (_e) { /* already scheduled */ }
  const stop = (at?: number) => {
    const t = Math.max(at == null ? ctx.currentTime : at, ctx.currentTime);
    try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(0.0001, g.gain.value || vel), t); g.gain.linearRampToValueAtTime(0.0001, t + 0.05); src.stop(t + 0.08); } catch (_e) { /* ended */ }
  };
  return { stop, nodes: [src, g] };
}

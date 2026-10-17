/* Microphone detection scored on a synthetic piano (see mic-lab.mjs). Three questions, each with a number:
     MONO   one key at a time, loud / soft / very soft in a noisy room: right note (exact octave), octave error, wrong note, missed, fired twice, delay
     RUN    a fast melody (legato, staccato, repeated notes) heard through the same detector: notes found in order, wrong, extra
     POLY   chords (2, 3, 4 notes) through detectPolyNotes the way the app takes them (two snapshots per strike): exact chord, notes found / invented
   `node scripts/bench-mic-detect.mjs` prints the table; `--json` prints it as JSON (the verify script reads that). */
import { loadEngine, SR, rng, mtof, pianoNote, level, runMono, polySnapshot, nameOf } from "./mic-lab.mjs";
const ME = await loadEngine("bench");
const J = process.argv.includes("--json");
const out = {};
const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : 0;

/* ── MONO: one key alone ── */
const LEVELS = [["loud", 0.05, 0.004], ["soft", 0.016, 0.004], ["very soft", 0.009, 0.004], ["loud, noisy room", 0.05, 0.012]];
out.mono = {};
for (const [name, rms, noise] of LEVELS) {
  let exact = 0, octave = 0, wrong = 0, miss = 0, twice = 0, n = 0; const delays = [];
  for (let m = 48; m <= 84; m++) {
    const sig = new Float32Array(Math.round(1.4 * SR)); pianoNote(sig, mtof(m), 0.2, 0.62, 1, rng(m)); level(sig, 0.2, 300, rms, noise, 500 + m);
    const d = runMono(ME, sig, 1.4).filter(x => x.t >= 0.2); n++;
    if (!d.length) { miss++; continue; }
    if (d.length > 1) twice++;
    const nm = nameOf(m), pcOk = d[0].note.replace(/\d+$/, "") === nm.replace(/\d+$/, "");
    if (d[0].note === nm) { exact++; delays.push((d[0].t - 0.2) * 1000); } else if (pcOk) octave++; else wrong++;
  }
  out.mono[name] = { n, exact, octave, wrong, miss, twice, delayMs: delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null };
}

/* ── RUN: a fast melody ── */
function melody(kind) {
  const base = [60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60, 60, 67, 67, 69, 69, 67];   // a scale up and down, then twinkle
  const step = kind === "fast" ? 0.21 : 0.30, len = kind === "staccato" ? 0.07 : kind === "fast" ? 0.2 : 0.29;
  return base.map((m, i) => ({ m, on: 0.3 + i * step, off: 0.3 + i * step + len }));
}
out.run = {};
for (const kind of ["legato", "fast", "staccato"]) {
  const notes = melody(kind), secs = notes[notes.length - 1].off + 0.8, sig = new Float32Array(Math.round(secs * SR)), r = rng(11);
  for (const n of notes) pianoNote(sig, mtof(n.m), n.on, n.off, 1, r);
  level(sig, 0.3, 300, 0.035, 0.005, 77);
  const d = runMono(ME, sig, secs);
  // match each expected note to the first unused detection of that pitch inside [on, on + 0.18 s]; leftovers are extras, wrong-pitch ones counted apart
  const used = new Set(); let found = 0, late = 0;
  for (const n of notes) { const k = d.findIndex((x, i) => !used.has(i) && x.note === nameOf(n.m) && x.t >= n.on && x.t <= n.on + 0.2); if (k >= 0) { used.add(k); found++; late += (d[k].t - n.on) * 1000; } }
  const extra = d.filter((x, i) => !used.has(i));
  out.run[kind] = { n: notes.length, found, extra: extra.length, wrongPitch: extra.filter(x => !notes.some(n => nameOf(n.m) === x.note)).length, delayMs: found ? Math.round(late / found) : null };
}

/* ── POLY: chords ── */
const CHORDS = [];
for (const root of [48, 53, 55, 57, 60, 62, 64, 67, 69]) {
  CHORDS.push(["2 notes", [root, root + 7]], ["2 notes", [root, root + 4]], ["3 notes", [root, root + 4, root + 7]], ["3 notes", [root, root + 3, root + 7]],
    ["3 notes", [root + 4, root + 7, root + 12]], ["4 notes", [root, root + 4, root + 7, root + 11]], ["4 notes", [root, root + 4, root + 7, root + 12]]);
}
out.poly = {};
for (const [soft, rms] of [["loud", 0.05], ["soft", 0.014]]) {
  const by = {};
  for (const [label, ms] of CHORDS) {
    const b = by[label] || (by[label] = { n: 0, exact: 0, found: 0, want: 0, invented: 0, foreign: 0, chordsWithForeign: 0 });
    const sig = new Float32Array(Math.round(1.2 * SR)), r = rng(ms[0] * 7 + ms.length);
    ms.forEach((m, i) => pianoNote(sig, mtof(m), 0.2 + i * 0.012 * (r() > 0.5 ? 1 : 0), 0.9, 0.7 + 0.3 * r(), r));      // not perfectly together, not equally loud
    level(sig, 0.2, 300, rms, 0.004, 123 + ms[0]);
    const got = new Set(); for (const off of [0.095, 0.23]) polySnapshot(ME, sig, 0.2 + off).forEach(x => got.add(x));
    const want = new Set(ms.map(nameOf)); b.n++; b.want += want.size;
    for (const w of want) if (got.has(w)) b.found++;
    const extra = [...got].filter(x => !want.has(x)), wantPc = new Set([...want].map(x => x.replace(/\d+$/, "")));
    b.invented += extra.length; const foreign = extra.filter(x => !wantPc.has(x.replace(/\d+$/, ""))); b.foreign += foreign.length; if (foreign.length) b.chordsWithForeign++;
    if (got.size === want.size && [...want].every(w => got.has(w))) b.exact++;
  }
  out.poly[soft] = by;
}
// nothing played: noise only
{ let fp = 0, n = 0; for (let s = 0; s < 20; s++) { const sig = new Float32Array(Math.round(1.2 * SR)), r = rng(900 + s); for (let i = 0; i < sig.length; i++) sig[i] = (r() * 2 - 1) * 0.02; const got = new Set(); for (const off of [0.095, 0.23]) polySnapshot(ME, sig, 0.5 + off).forEach(x => got.add(x)); n++; if (got.size) fp++; } out.polyNoise = { n, falseAlarms: fp }; }

if (J) { console.log(JSON.stringify(out)); process.exit(0); }
console.log("MONO — one key alone (37 keys, C3..C6)"); for (const [k, v] of Object.entries(out.mono)) console.log(`  ${k.padEnd(18)} exact ${String(v.exact).padStart(2)}/${v.n}  octave-err ${v.octave}  wrong ${v.wrong}  missed ${v.miss}  fired-twice ${v.twice}  delay ${v.delayMs} ms`);
console.log("RUN — a fast melody (21 notes)"); for (const [k, v] of Object.entries(out.run)) console.log(`  ${k.padEnd(10)} found ${v.found}/${v.n}  extra ${v.extra} (wrong pitch ${v.wrongPitch})  delay ${v.delayMs} ms`);
console.log("POLY — chords through detectPolyNotes"); for (const [soft, by] of Object.entries(out.poly)) for (const [k, v] of Object.entries(by)) console.log(`  ${soft.padEnd(5)} ${k.padEnd(8)} exact chord ${pct(v.exact, v.n)}%  notes found ${pct(v.found, v.want)}%  octave-type extras ${v.invented - v.foreign}, WRONG-pitch-class extras ${v.foreign} (in ${v.chordsWithForeign} of ${v.n} chords)`);
console.log(`  noise only: false alarms ${out.polyNoise.falseAlarms}/${out.polyNoise.n}`);

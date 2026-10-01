/* Builds songs-classical.ts from the checked sources in songs-src/classical/*.json.

     node scripts/build-songs.mjs            # writes songs-classical.ts
     node scripts/build-songs.mjs --check    # builds in memory and fails if songs-classical.ts is out of date

   songs-classical.ts is generated — change a piece in songs-src/classical and run this again. Each piece goes
   through the same checks as scripts/verify-songs.mjs first; the build refuses to write a file with an error in it.

   What it adds to the app (songs-data.ts appends it to the song list):
   - the songs themselves, in the app's own song shape {id, diff, bpm, th, en, zh, seq}; the tune is kept as one
     short text per song ("C4:1 D4:0.5 …") and read into pairs when the module loads — a third of the size of
     written-out pairs, and the song list is parsed once, in about three milliseconds;
   - the era of each (baroque / classical / romantic / impressionism), which is its category on the song list;
   - the time signature of the ones that are not in 4/4.
   Level (diff) is worked out against the songs the app already had (see levelOf): the app's own rule for a tune
   (estimateSongDifficulty: range, average and widest leap) was made for short beginner melodies and would put nine in ten real
   classical melodies at level 3. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkPiece } from "./verify-songs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "songs-src", "classical");
const OUT = path.join(ROOT, "songs-classical.ts");
const PCN = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midiOf = (n) => { const m = /^([A-G])(#?)([0-9])$/.exec(n); return 12 * (+m[3] + 1) + PCN[m[1]] + (m[2] ? 1 : 0); };

// the app's estimateSongDifficulty(songTechniqueProfile(song)), copied number for number from music-engine.tsx
export function estimateDiff(notes) {
  const midis = notes.map(midiOf);
  const range = Math.max(...midis) - Math.min(...midis);
  let leapSum = 0, maxLeap = 0;
  for (let i = 1; i < midis.length; i++) { const d = Math.abs(midis[i] - midis[i - 1]); leapSum += d; if (d > maxLeap) maxLeap = d; }
  const avgLeap = midis.length > 1 ? leapSum / (midis.length - 1) : 0;
  let diff = 1;
  if (range >= 11 || avgLeap >= 2.3 || maxLeap >= 7) diff = 2;
  if (range >= 14 || avgLeap >= 2.7 || maxLeap >= 10) diff = 3;
  return diff;
}
/* Level, by comparison with the songs the app already had. estimateDiff above is the app's rule for an AI-made tune; real classical
   melodies run past it almost every time (a range of 14+ semitones, a leap of 10+), so used alone it rates nine pieces in ten at
   level 3 and the era lists open as walls of locked songs. Instead a piece is held against the profile of the hand-made level-1 and
   level-2 songs (their 75th–90th percentile of range, average leap, notes per second and length): inside the level-1 profile it is
   level 1, inside the level-2 profile level 2, anything beyond level 3 (which opens at player level 4, SONG_REQ). The numbers are fixed,
   not quantiles of the new set, so adding a piece never changes another's level. */
const LEVEL_1 = { range: 12, avgLeap: 2.4, maxLeap: 12, nps: 2.2, notes: 45 };
const LEVEL_2 = { range: 16, avgLeap: 3.1, maxLeap: 14, nps: 3.0, notes: 60 };
export function profileOf(p) {
  const flat = p.bars.join(" ").trim().split(/\s+/).map(t => { const i = t.indexOf(":"); return [t.slice(0, i), +t.slice(i + 1)]; });
  const midis = flat.filter(x => x[0] !== "R").map(x => midiOf(x[0]));
  const sec = flat.reduce((a, x) => a + x[1], 0) * 60 / p.bpm;
  let leapSum = 0, maxLeap = 0;
  for (let i = 1; i < midis.length; i++) { const d = Math.abs(midis[i] - midis[i - 1]); leapSum += d; if (d > maxLeap) maxLeap = d; }
  return { range: Math.max(...midis) - Math.min(...midis), avgLeap: midis.length > 1 ? leapSum / (midis.length - 1) : 0, maxLeap, nps: midis.length / sec, notes: midis.length };
}
const within = (f, L) => f.range <= L.range && f.avgLeap <= L.avgLeap && f.maxLeap <= L.maxLeap && f.nps <= L.nps && f.notes <= L.notes;
export function levelOf(p) {
  const f = profileOf(p);
  return within(f, LEVEL_1) ? 1 : within(f, LEVEL_2) ? 2 : 3;
}

export function loadPieces() {
  const out = [];
  if (!fs.existsSync(SRC)) return out;
  for (const f of fs.readdirSync(SRC).filter(f => f.endsWith(".json")).sort()) {
    const arr = JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8"));
    for (const p of arr) out.push({ p, f });
  }
  return out;
}

export function buildSource() {
  const pieces = loadPieces();
  const ids = new Set(), errors = [];
  for (const { p, f } of pieces) {
    const r = checkPiece(p, {});
    for (const e of r.errs) errors.push(`${f} ${p && p.id}: ${e}`);
    if (ids.has(p.id)) errors.push(`${f}: duplicate id ${p.id}`);
    ids.add(p.id);
  }
  if (errors.length) throw new Error("songs-src/classical has errors:\n  " + errors.join("\n  "));
  const q = JSON.stringify;
  const songLines = pieces.map(({ p }) => {
    const seq = p.bars.join(" ").trim().replace(/\s+/g, " ");
    return `  { id: ${q(p.id)}, diff: ${levelOf(p)}, bpm: ${p.bpm}, th: ${q(p.th)}, en: ${q(p.en)}, zh: ${q(p.zh)},\n    seq: ${q(seq)} },`;
  });
  const eras = pieces.map(({ p }) => `${q(p.id)}:${q(p.era)}`);
  const sigs = pieces.filter(({ p }) => p.meter !== "4/4").map(({ p }) => `${q(p.id)}:${q(p.meter)}`);
  const per = {}; for (const { p } of pieces) per[p.era] = (per[p.era] || 0) + 1;
  return `/* ── songs-classical.ts ──
   GENERATED by scripts/build-songs.mjs from songs-src/classical/*.json — do not edit by hand: change the piece
   there and build again. ${pieces.length} public-domain classical pieces (composer died 1950 or earlier, written
   1929 or earlier), by era: ${Object.entries(per).map(([k, v]) => k + " " + v).join(", ")}.
   songs-data.ts appends them to the song list. The tune of each is kept as one short text ("C4:1 D4:0.5 …",
   note:beats, R = rest) and read into the app's [note, beats] pairs when the module loads. ── */
const RAW = [
${songLines.join("\n")}
];

const pairs = (s: string): Array<[string, number]> => s.split(" ").map(t => { const i = t.indexOf(":"); return [t.slice(0, i), +t.slice(i + 1)] as [string, number]; });

export const CLASSICAL_SONGS = RAW.map(r => ({ id: r.id, diff: r.diff, bpm: r.bpm, th: r.th, en: r.en, zh: r.zh, seq: pairs(r.seq) }));

/** era of each piece: baroque | classical | romantic | impressionism (the category on the song list) */
export const CLASSICAL_ERAS: Record<string, string> = {${eras.join(",")}};

/** time signature of the pieces that are not in 4/4 */
export const CLASSICAL_TIMESIG: Record<string, string> = {${sigs.join(",")}};
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const src = buildSource();
  if (process.argv.includes("--check")) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
    if (cur !== src) { console.error("songs-classical.ts is out of date — run node scripts/build-songs.mjs"); process.exit(1); }
    console.log("songs-classical.ts is up to date");
  } else {
    fs.writeFileSync(OUT, src);
    const lv = { 1: 0, 2: 0, 3: 0 }; for (const { p } of loadPieces()) lv[levelOf(p)]++;
    console.log(`wrote ${path.relative(ROOT, OUT)} · ${(src.length / 1024).toFixed(0)} KB · ${loadPieces().length} pieces · levels 1/2/3: ${lv[1]}/${lv[2]}/${lv[3]}`);
  }
}

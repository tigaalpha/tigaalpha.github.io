/* Checks the authored classical pieces (songs-src/classical/*.json, or any JSON file/dir you name)
   before they are turned into songs (scripts/build-songs.mjs). It checks what a wrong transcription
   most often gets wrong — it cannot hear a melody, so a clean run says the piece is well-formed and
   plausible, not that it is the right tune (that is what the blind cross-check is for).

     node scripts/verify-songs.mjs songs-src/classical            # every *.json in the folder
     node scripts/verify-songs.mjs /path/to/agent-output.json     # one file
     node scripts/verify-songs.mjs file.json --quiet              # errors only

   Exit code 1 when any piece has an error. The rules (see songs-src/README.md for the authoring guide):
   - public domain: the composer died in 1950 or earlier AND the piece was written in 1929 or earlier
     (owner rule 2026-10-01: "older than 75 years"; 1929 is also the US cut-off for published works)
   - the piece is a tune, not a score: one hand, notes C4..B5, sharps only (C#4, never Db4), rests "R"
   - bars add up: every bar string sums to the bar (2/4, 3/4 or 4/4); a held note may run over the
     bar line (the engraver ties it), but the song must end exactly on a bar line and, when it starts
     with a pickup, the total must be the pickup plus whole bars — that is how the engine finds the pickup
   - the tune stays in its key (>= 85% diatonic notes, 60% when the piece names a free scale)
   - titles in three languages that end in the composer's name in brackets
   - no duplicates: ids unique, and no tune twice (nor one of the songs already in the app) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ERAS = ["baroque", "classical", "romantic", "impressionism"];
const MAX_DIED = 1950, MAX_YEAR = 1929;
const METERS = { "2/4": 2, "3/4": 3, "4/4": 4 };
const PCN = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const FREE_SCALES = ["whole-tone", "pentatonic", "modal", "chromatic", "octatonic"];
const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const quiet = process.argv.includes("--quiet");
const noExisting = process.argv.includes("--no-existing");

function midiOf(n) { const m = /^([A-G])(#?)([0-9])$/.exec(n); return m ? 12 * (+m[3] + 1) + PCN[m[1]] + (m[2] ? 1 : 0) : null; }
function keyScale(key, scale) {
  if (scale && FREE_SCALES.includes(scale)) return null;
  const m = /^([A-G])([#b]?)(m?)$/.exec(String(key || ""));
  if (!m) return undefined;
  const tonic = (PCN[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + 12) % 12;
  const degs = m[3] ? [0, 2, 3, 5, 7, 8, 9, 10, 11] : [0, 2, 4, 5, 7, 9, 11];   // minor: natural + both raised sixth/seventh
  return new Set(degs.map(d => (tonic + d) % 12));
}

// the songs already in the app (ids, English names and the opening of each tune), to refuse a second copy — without the classical
// pieces themselves: songs-classical.ts is generated from the very files being checked, so they would only collide with themselves
async function existingSongs() {
  if (noExisting) return [];
  const { build } = await import(pathToFileURL(path.join(ROOT, "node_modules/esbuild/lib/main.js")).href);
  const r = await build({
    stdin: { contents: `import { SONGS } from "./songs-data"; import { CLASSICAL_SONGS } from "./songs-classical";
      const gen = new Set(CLASSICAL_SONGS.map(s => s.id)); export const OLD = SONGS.filter(s => !gen.has(s.id));`, resolveDir: ROOT, loader: "ts" },
    bundle: true, format: "esm", write: false, platform: "node", logLevel: "silent" });
  const tmp = path.join(ROOT, "node_modules/.cache", "songs-data-verify.mjs");
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, r.outputFiles[0].text);
  const { OLD } = await import(pathToFileURL(tmp).href + "?t=" + Date.now());
  return OLD.map(s => ({ id: s.id, en: s.en, open: openingOf(s.seq.filter(x => x[0] !== "R").map(x => x[0])) }));
}
const pcOf = (n) => { const m = midiOf(n); return m == null ? -1 : m % 12; };
function openingOf(notes) { return notes.slice(0, 10).map(pcOf).join(","); }

function listFiles(a) {
  const st = fs.statSync(a);
  return st.isDirectory() ? fs.readdirSync(a).filter(f => f.endsWith(".json")).sort().map(f => path.join(a, f)) : [a];
}

export function checkPiece(p, ctx = {}) {
  const errs = [], warns = [];
  const E = (m) => errs.push(m), W = (m) => warns.push(m);
  const need = (k, t) => { if (typeof p[k] !== t) E(`field "${k}" must be a ${t}`); };
  need("id", "string"); need("era", "string"); need("composer", "string"); need("died", "number"); need("year", "number");
  need("en", "string"); need("th", "string"); need("zh", "string"); need("key", "string"); need("meter", "string"); need("bpm", "number");
  if (!Array.isArray(p.bars)) E('field "bars" must be an array of strings');
  if (errs.length) return { errs, warns, info: null };
  if (!/^[a-z0-9_]{3,40}$/.test(p.id)) E(`id "${p.id}" must be snake_case, 3-40 characters`);
  if (!ERAS.includes(p.era)) E(`era "${p.era}" must be one of ${ERAS.join(", ")}`);
  if (p.died > MAX_DIED) E(`composer died in ${p.died}: not older than 75 years (limit ${MAX_DIED})`);
  if (p.year > MAX_YEAR) E(`written in ${p.year}: later than ${MAX_YEAR}`);
  if (p.year > p.died + 1 && p.died > 0) W(`written in ${p.year}, after the composer's death in ${p.died}?`);
  const bpb = METERS[p.meter];
  if (!bpb) E(`meter "${p.meter}" must be 2/4, 3/4 or 4/4 (compound meters: write 6/8 as 3/4 with eighths = 0.5)`);
  if (!(p.bpm >= 50 && p.bpm <= 140)) E(`bpm ${p.bpm} must be 50-140 (a playable tempo; write fast music in longer note values)`);
  if (!/\(.+\)\s*$/.test(p.en) || p.en.length > 64) E(`en "${p.en}" must end with the composer in brackets and be at most 64 characters`);
  if (!/[฀-๿]/.test(p.th) || !/[)）]\s*$/.test(p.th)) E(`th "${p.th}" must be Thai and end with the composer in brackets`);
  if (!/[一-鿿]/.test(p.zh) || !/[)）]\s*$/.test(p.zh)) E(`zh "${p.zh}" must be Chinese and end with the composer in brackets`);
  const pickup = +p.pickup || 0;
  if (bpb && (pickup < 0 || pickup >= bpb)) E(`pickup ${pickup} must be 0 or less than one bar (${bpb})`);
  if (p.conf !== "high" && p.conf !== "med") E(`conf must be "high" or "med" (the author's honesty about the pitches)`);
  if (!bpb || !Array.isArray(p.bars)) return { errs, warns, info: null };

  // ── the notes, bar by bar ──
  const seq = []; let pos = 0, ok = true;
  const bounds = (i) => pickup > 0 ? pickup + i * bpb : (i + 1) * bpb;
  p.bars.forEach((bar, i) => {
    const toks = String(bar).trim().split(/\s+/).filter(Boolean);
    if (!toks.length) { E(`bar ${i + 1} is empty`); ok = false; return; }
    let lastDur = 0;
    for (const tk of toks) {
      const m = /^([A-G]#?[0-9]|R):([0-9]*\.?[0-9]+)$/.exec(tk);
      if (!m) { E(`bar ${i + 1}: bad token "${tk}" (write NOTE:beats, e.g. C#5:0.5 or R:1)`); ok = false; continue; }
      const d = +m[2];
      if (!(d > 0 && d <= 8) || Math.abs(d * 4 - Math.round(d * 4)) > 1e-9) { E(`bar ${i + 1}: duration ${m[2]} must be a multiple of 0.25 up to 8`); ok = false; continue; }
      if (m[1] !== "R") {
        const mi = midiOf(m[1]);
        if (mi == null) { E(`bar ${i + 1}: unknown note "${m[1]}"`); ok = false; continue; }
        if (mi < 60 || mi > 83) { E(`bar ${i + 1}: ${m[1]} is outside C4..B5`); ok = false; }
      }
      seq.push([m[1], d]); pos += d; lastDur = d;
    }
    const over = +(pos - bounds(i)).toFixed(6);
    const last = i === p.bars.length - 1;
    // after a wrong bar the count starts again from the bar line, so one slip is one error, not one per bar after it
    if (over < -1e-6) { E(`bar ${i + 1} is short by ${-over} beat(s) (meter ${p.meter}${pickup && i === 0 ? ", pickup " + pickup : ""})`); ok = false; pos = bounds(i); }
    else if (over > 1e-6 && (last || over >= lastDur - 1e-6)) { E(`bar ${i + 1} is long by ${over} beat(s)${last ? " — the song must end exactly on a bar line" : " — only the last note of a bar may run over the line"}`); ok = false; pos = bounds(i); }
  });
  const notes = seq.filter(x => x[0] !== "R");
  if (notes.length < 16 || notes.length > 170) E(`${notes.length} notes: a piece needs 16-170`);
  if (!ok) return { errs, warns, info: null };
  const total = seq.reduce((a, x) => a + x[1], 0);
  const len = Math.round(total * 60 / p.bpm);
  if (len < 14 || len > 120) E(`${len} s long: a piece needs 14-120 s at ${p.bpm} bpm`);

  // ── the tune ──
  const midis = notes.map(x => midiOf(x[0]));
  const scale = keyScale(p.key, p.scale);
  if (scale === undefined) E(`key "${p.key}" must look like C, F#, Bb, Am, C#m`);
  else if (scale) {
    const inKey = midis.filter(m => scale.has(m % 12)).length / midis.length;
    const need = 0.85;
    if (inKey < need) E(`only ${(inKey * 100).toFixed(0)}% of the notes are in ${p.key} (need ${need * 100}%): wrong key, or wrong notes`);
    else if (inKey < 0.93) W(`${(inKey * 100).toFixed(0)}% of the notes are in ${p.key}`);
  } else {
    const pcs = new Set(midis.map(m => m % 12));
    if (p.scale === "whole-tone" && pcs.size > 7) W(`a whole-tone piece with ${pcs.size} pitch classes`);
  }
  let maxLeap = 0, bigLeaps = 0, run = 1, maxRun = 1;
  for (let i = 1; i < midis.length; i++) {
    const d = Math.abs(midis[i] - midis[i - 1]); if (d > maxLeap) maxLeap = d; if (d > 12) bigLeaps++;
    run = midis[i] === midis[i - 1] ? run + 1 : 1; if (run > maxRun) maxRun = run;
  }
  if (maxLeap >= 21) E(`a leap of ${maxLeap} semitones: almost certainly a wrong octave`);
  else if (bigLeaps > 2) W(`${bigLeaps} leaps wider than an octave`);
  if (maxRun > 12) W(`${maxRun} equal notes in a row`);
  if (new Set(seq.map(x => x[1])).size === 1 && notes.length > 24) W("every note has the same length");
  const distinct = new Set(midis.map(m => m % 12)).size;
  if (distinct < 3) W(`only ${distinct} different pitch classes`);
  // the engine's own rule for a pickup (pickupBeatsOf): the leftover, if that agrees with the music
  const leftover = +(total % bpb).toFixed(6);
  if (Math.abs(leftover - pickup) > 1e-6) E(`the song is ${total} beats: the engine reads a pickup of ${leftover}, but the piece declares ${pickup} (end on a full bar: ${pickup ? "pickup + whole bars" : "whole bars"})`);
  const first = notes[0][0], lastN = notes[notes.length - 1][0];
  if (scale) {
    const tonic = (PCN[p.key[0]] + (p.key[1] === "#" ? 1 : p.key[1] === "b" ? -1 : 0) + 12) % 12;
    if (pcOf(lastN) !== tonic && pcOf(lastN) !== (tonic + 7) % 12) W(`ends on ${lastN}, not the tonic or dominant of ${p.key}`);
  }
  const info = { len, notes: notes.length, bars: p.bars.length, first, last: lastN, open: openingOf(notes.map(x => x[0])), maxLeap };
  if (ctx.dupes) {
    for (const o of ctx.dupes) if (o.id !== p.id && o.open === info.open) E(`opens exactly like "${o.id}" — the same tune twice?`);
  }
  return { errs, warns, info };
}

async function main() {
  if (!args.length) { console.error("usage: node scripts/verify-songs.mjs <json file or folder> [--quiet] [--no-existing]"); process.exit(2); }
  const existing = await existingSongs();
  const pieces = [];
  for (const a of args) for (const f of listFiles(a)) {
    let arr; try { arr = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { console.log(`FAIL ${f}: not valid JSON — ${e.message}`); process.exitCode = 1; continue; }
    if (!Array.isArray(arr)) { console.log(`FAIL ${f}: the file must hold a JSON array of pieces`); process.exitCode = 1; continue; }
    arr.forEach((p, i) => pieces.push({ p, f: path.basename(f), i }));
  }
  const ids = new Map(existing.map(s => [s.id, "the app"]));
  const dupes = existing.map(s => ({ id: s.id, open: s.open }));
  let bad = 0, warn = 0, okN = 0;
  for (const { p, f, i } of pieces) {
    const r = checkPiece(p, { dupes });
    const errs = r.errs.slice();
    if (p && typeof p.id === "string") { if (ids.has(p.id)) errs.push(`id "${p.id}" is already used by ${ids.get(p.id)}`); ids.set(p.id, f); }
    if (r.info) dupes.push({ id: p.id, open: r.info.open });
    const tag = `${f}#${i + 1} ${p && p.id}`;
    if (errs.length) { bad++; console.log(`FAIL ${tag}`); for (const e of errs) console.log("     ✗ " + e); }
    else okN++;
    if (r.warns.length) { warn++; if (!quiet) { console.log(`${errs.length ? "    " : "WARN "} ${errs.length ? "" : tag}`.trimEnd()); for (const w of r.warns) console.log("     · " + w); } }
  }
  const byEra = {}; for (const { p } of pieces) byEra[p.era] = (byEra[p.era] || 0) + 1;
  console.log(`\n${pieces.length} pieces: ${okN} ok, ${bad} with errors, ${warn} with warnings · by era ${JSON.stringify(byEra)}`);
  if (bad) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

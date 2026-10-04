/* verify-originals.mjs — checks the generated practice pieces in songs-src/originals/*.json.

     node scripts/verify-originals.mjs songs-src/originals

   This file does NOT trust songs-src/tools/gen_originals.mjs. It re-derives everything from
   the written bars: it re-adds every bar, re-measures the range, re-counts the notes, re-fits
   the key, and re-derives the level with the SAME function the classical build uses
   (levelOf from scripts/build-songs.mjs) so a piece cannot claim to be easier than it is.
   The only thing it takes from the generator on faith is the mode, and that is re-checked
   against the notes too.

   It also checks the two things that decide whether this library is worth having at all:
   that no two pieces are the same tune, and that no piece is the same tune as something the
   app already had. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { levelOf } from "./build-songs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MODES = {
  "major": [0, 2, 4, 5, 7, 9, 11],
  "natural minor": [0, 2, 3, 5, 7, 8, 10],
  "harmonic minor": [0, 2, 3, 5, 7, 8, 11],
  "dorian": [0, 2, 3, 5, 7, 9, 10],
  "mixolydian": [0, 2, 4, 5, 7, 9, 10],
  "lydian": [0, 2, 4, 6, 7, 9, 11],
  "phrygian": [0, 1, 3, 5, 7, 8, 10],
};
const PCN = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/* PCN holds the NATURAL letters only; a sharp is that letter plus one. Asking the map for
   "C#" returns nothing, the pitch comes out NaN, and every sharp note then counts as "not in
   the key" — a 12% in-key verdict on a tune that never left the scale. */
const midiOf = (n) => { const m = /^([A-G]#?)([0-9])$/.exec(n); return m ? 12 * (+m[2] + 1) + PCN[m[1][0]] + (m[1].length === 2 ? 1 : 0) : null; };
const METERS = { "2/4": 2, "3/4": 3, "4/4": 4 };

/* one tune's fingerprint: the first notes by name plus the interval between each one and the
   next. Ten notes that use fewer than three pitch classes (a repeated note, a trill) say
   nothing about which tune it is, so those are skipped — the same rule verify-songs.mjs uses. */
function signatureOf(notes) {
  if (new Set(notes.map(n => midiOf(n) % 12)).size < 3) return null;
  const head = notes.slice(0, 12);
  return head.join(" ") + "|" + head.slice(1).map((n, i) => midiOf(n) - midiOf(head[i])).join(",");
}

export function checkOriginal(p) {
  const errs = [], warns = [];
  const E = (m) => errs.push(m), W = (m) => warns.push(m);
  if (!/^og_\d{5}$/.test(p.id || "")) E(`id "${p.id}" must look like og_00001`);
  for (const k of ["en", "th", "zh"]) if (typeof p[k] !== "string" || !p[k].trim()) E(`field "${k}" is missing`);
  if (typeof p.th === "string" && !/[฀-๿]/.test(p.th)) E(`th "${p.th}" has no Thai in it`);
  if (typeof p.zh === "string" && !/[一-鿿]/.test(p.zh)) E(`zh "${p.zh}" has no Chinese in it`);
  if (p.th && p.th.length > 60) W(`th title is ${p.th.length} characters`);
  if (p.en && p.en.length > 64) E(`en "${p.en}" is ${p.en.length} characters (limit 64)`);

  const bpb = METERS[p.meter];
  if (!bpb) return { errs, warns, info: null };
  if (!(p.bpm >= 50 && p.bpm <= 140)) E(`bpm ${p.bpm} must be 50-140`);
  const steps = MODES[p.mode];
  if (!steps) { E(`mode "${p.mode}" is not one this generator knows`); return { errs, warns, info: null }; }
  const km = /^([A-G])([#b]?)$/.exec(p.key || "");
  if (!km) { E(`key "${p.key}" must be a note name like C, F#, Bb`); return { errs, warns, info: null }; }
  const tonicPc = ((PCN[km[1]] + (km[2] === "#" ? 1 : km[2] === "b" ? -1 : 0)) % 12 + 12) % 12;
  const modeSet = new Set(steps.map(s => (tonicPc + s) % 12));

  const pickup = +p.pickup || 0;
  if (!(pickup >= 0 && pickup < bpb)) E(`pickup ${pickup} must be smaller than a bar (${bpb})`);
  const seq = []; let ok = true;
  p.bars.forEach((bar, i) => {
    const toks = String(bar).trim().split(/\s+/).filter(Boolean);
    if (!toks.length) { E(`bar ${i + 1} is empty`); ok = false; return; }
    // a piece that declares a pickup of 1 has a ONE-beat first bar, not a shortened bar —
// that is the reading in verify-songs.mjs (bounds = pickup + i * bpb) and the one the
// engine's pickupBeatsOf applies, so the first bar is checked the same way here
const want = (i === 0 && pickup) ? pickup : bpb;
    let sum = 0;
    for (const tk of toks) {
      const m = /^([A-G]#?[0-9]|R):([0-9]*\.?[0-9]+)$/.exec(tk);
      if (!m) { E(`bar ${i + 1}: bad token "${tk}"`); ok = false; continue; }
      const d = +m[2];
      if (!(d > 0 && d <= 8) || Math.abs(d * 4 - Math.round(d * 4)) > 1e-9) { E(`bar ${i + 1}: duration ${m[2]} must be a positive multiple of 0.25 up to 8`); ok = false; continue; }
      if (m[1] !== "R") {
        const mi = midiOf(m[1]);
        if (mi < 60 || mi > 83) { E(`bar ${i + 1}: ${m[1]} is outside C4..B5`); ok = false; }
      }
      seq.push([m[1], d]); sum += d;
    }
    if (Math.abs(sum - want) > 1e-9) { E(`bar ${i + 1} holds ${sum} beats, not ${want} (${p.meter}${i === 0 && pickup ? ", pickup " + pickup : ""})`); ok = false; }
  });
  if (!ok) return { errs, warns, info: null };

  const notes = seq.filter(x => x[0] !== "R");
  if (notes.length < 16 || notes.length > 170) E(`${notes.length} notes: a piece needs 16-170`);
  const total = seq.reduce((a, x) => a + x[1], 0);
  const leftover = +(total % bpb).toFixed(6);
  if (Math.abs(leftover - pickup) > 1e-6) E(`the piece is ${total} beats, so the engine reads a pickup of ${leftover}, but it declares ${pickup}`);
  const secs = Math.round(total * 60 / p.bpm);
  if (secs < 14 || secs > 120) E(`${secs} s long: a piece needs 14-120 s at ${p.bpm} bpm`);

  const midis = notes.map(x => midiOf(x[0]));
  const inMode = midis.filter(m => modeSet.has(((m % 12) + 12) % 12)).length / midis.length;
  if (inMode < 0.85) E(`only ${(inMode * 100).toFixed(0)}% of the notes belong to ${p.key} ${p.mode} (need 85%)`);
  else if (inMode < 0.95) W(`${(inMode * 100).toFixed(0)}% of the notes are in ${p.key} ${p.mode}`);
  let maxLeap = 0, run = 1, maxRun = 1;
  for (let i = 1; i < midis.length; i++) {
    const d = Math.abs(midis[i] - midis[i - 1]); if (d > maxLeap) maxLeap = d;
    run = midis[i] === midis[i - 1] ? run + 1 : 1; if (run > maxRun) maxRun = run;
  }
  if (maxLeap >= 21) E(`a leap of ${maxLeap} semitones`);
  if (maxRun > 8) W(`${maxRun} equal notes in a row`);
  const lastPc = ((midis[midis.length - 1] % 12) + 12) % 12;
  if (lastPc !== tonicPc && lastPc !== (tonicPc + 7) % 12) W(`ends on pitch class ${lastPc}, not the tonic or dominant of ${p.key}`);

  // the level it claims, re-measured with the rule the classical build uses
  const measured = levelOf({ bars: p.bars, bpm: p.bpm });
  if (p.level !== measured) E(`claims level ${p.level}, measures as level ${measured} under build-songs levelOf()`);

  return { errs, warns, info: { secs, notes: notes.length, bars: p.bars.length, sig: signatureOf(notes.map(x => x[0])), measured } };
}

/* the titles already in the app, so a new title cannot quietly land on an old one */
async function existingTitles() {
  const { build } = await import(pathToFileURL(path.join(ROOT, "node_modules/esbuild/lib/main.js")).href);
  const r = await build({
    stdin: { contents: `import { SONGS } from "./songs-data"; export const OLD = SONGS.map(s => ({ en: s.en, th: s.th, zh: s.zh, id: s.id, seq: s.seq || [] }));`, resolveDir: ROOT, loader: "ts" },
    bundle: true, format: "esm", write: false, platform: "node", logLevel: "silent",
  });
  const tmp = path.join(ROOT, "node_modules/.cache", "originals-verify-songs.mjs");
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, r.outputFiles[0].text);
  const { OLD } = await import(pathToFileURL(tmp).href + "?t=" + Date.now());
  return OLD;
}

async function main() {
  const dir = path.resolve(ROOT, process.argv[2] || "songs-src/originals");
  if (!fs.existsSync(dir)) { console.log(`verify-originals: ${path.relative(ROOT, dir)} does not exist`); process.exit(1); }
  const pieces = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort()) {
    for (const p of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) pieces.push({ p, f });
  }
  const old = await existingTitles();
  const oldEn = new Set(old.map(s => (s.en || "").toLowerCase()));
  const errs = [], warns = [];
  const ids = new Set(), en = new Set(), th = new Set(), zh = new Set(), sigs = new Map(), oldSigs = new Map();
  for (const s of old) {
    if (!Array.isArray(s.seq) || !s.seq.length) continue;
    const sig = signatureOf(s.seq.filter(x => x[0] !== "R").map(x => x[0]));
    if (sig && !oldSigs.has(sig)) oldSigs.set(sig, s.id);
  }
  const levels = { 1: 0, 2: 0, 3: 0 };
  let totalSecs = 0, totalNotes = 0;
  for (const { p, f } of pieces) {
    const r = checkOriginal(p);
    for (const e of r.errs) errs.push(`${f} ${p.id}: ${e}`);
    for (const w of r.warns) warns.push(`${f} ${p.id}: ${w}`);
    if (ids.has(p.id)) errs.push(`${f}: duplicate id ${p.id}`); ids.add(p.id);
    const key = (x) => (x || "").toLowerCase();
    for (const [lang, seen, oldSet] of [["en", en, oldEn], ["th", th, null], ["zh", zh, null]]) {
      if (seen.has(key(p[lang]))) errs.push(`${f} ${p.id}: ${lang} title "${p[lang]}" is used twice`);
      seen.add(key(p[lang]));
      if (oldSet && oldSet.has(key(p[lang]))) errs.push(`${f} ${p.id}: ${lang} title "${p[lang]}" is already in the app (${old.find(s => key(s.en) === key(p[lang])).id})`);
    }
    if (r.info) {
      levels[r.info.measured]++; totalSecs += r.info.secs; totalNotes += r.info.notes;
      if (r.info.sig) {
        if (sigs.has(r.info.sig)) errs.push(`${f} ${p.id}: the same tune as ${sigs.get(r.info.sig)}`);
        else sigs.set(r.info.sig, p.id);
        if (oldSigs.has(r.info.sig)) errs.push(`${f} ${p.id}: the same tune as the app's "${oldSigs.get(r.info.sig)}"`);
      }
    }
  }
  console.log(`verify-originals: ${pieces.length} pieces in ${path.relative(ROOT, dir)} · levels ${levels[1]}/${levels[2]}/${levels[3]} · avg ${Math.round(totalNotes / Math.max(1, pieces.length))} notes, ${Math.round(totalSecs / Math.max(1, pieces.length))} s`);
  console.log(`  ${errs.length} errors, ${warns.length} warnings`);
  for (const e of errs.slice(0, 40)) console.log("  ✗ " + e);
  if (errs.length > 40) console.log(`  … and ${errs.length - 40} more`);
  process.exit(errs.length ? 1 : 0);
}
if (process.argv[1] && process.argv[1].endsWith("verify-originals.mjs")) main();
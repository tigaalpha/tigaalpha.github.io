/* build-originals.mjs — turns songs-src/originals/*.json into the files the app FETCHES.

     node scripts/build-originals.mjs            # writes public/originals/
     node scripts/build-originals.mjs --check    # fails if what is on disk is out of date

   WHY THESE ARE JSON AND NOT ANOTHER TS MODULE
   Ten thousand pieces is about 4.9 MB of music. Folded into the bundle the way
   songs-classical.ts is, every visitor would download all of it before playing anything, and
   the app's own note in AGENTS.md already warns that the song library is read synchronously
   in forty places. So the notes live in files the app fetches WHEN a piece is opened:

     public/originals/index.json      the shelf: id, level, tempo, the three titles, the first
                                      note (for the card's colour) and the length (for its clock)
                                      — everything a list row draws, and no notes at all.
     public/originals/songs-NN.json   one shard of 500 pieces WITH their tunes.

   Nothing is downloaded until the learner opens the Original shelf, and only the shard the
   chosen piece lives in. On GitHub Pages that is the same static host the rest of the site is
   served from, so this needs no database, no migration and no API key. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkOriginal } from "./verify-originals.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "songs-src", "originals");
const OUT = path.join(ROOT, "public", "originals");
const PER_SHARD = 500;
const pairs = (s) => s.split(" ").map(t => { const i = t.indexOf(":"); return [t.slice(0, i), +t.slice(i + 1)]; });
const seqText = (p) => p.bars.join(" ").split(/\s+/).filter(Boolean).join(" ");
const secs = (p) => { const beats = p.bars.reduce((a, bar) => a + bar.split(/\s+/).reduce((x, t) => x + +t.split(":")[1], 0), 0); return Math.round(beats * 60 / p.bpm); };
const firstNote = (p) => { for (const bar of p.bars) for (const t of bar.split(/\s+/)) { const n = t.split(":")[0]; if (n !== "R") return n; } return "C4"; };

function load() {
  if (!fs.existsSync(SRC)) { console.error(`build-originals: ${path.relative(ROOT, SRC)} does not exist — run node songs-src/tools/gen_originals.mjs first`); process.exit(1); }
  /* jazz-*.json first, then orig-*.json in order. The order is the shelf's order, and the
     Original Content page filters only the rows it has loaded: it fetches ONE index page
     (500 rows) and draws the cards from it. Jazz & blues pieces written last would sit on
     the very last page of a 201-page shelf, so the Jazz & Blues family would show nothing
     until a learner scrolled past a hundred thousand cards. First on the shelf means the
     whole family is on page 0, where the filter can actually find it. */
  const files = fs.readdirSync(SRC).filter(f => f.endsWith(".json")).sort();
  files.sort((a, b) => (a.startsWith("jazz-") ? 0 : 1) - (b.startsWith("jazz-") ? 0 : 1) || (a < b ? -1 : 1));
  const out = [];
  for (const f of files) {
    for (const p of JSON.parse(fs.readFileSync(path.join(SRC, f), "utf8"))) out.push(p);
  }
  return out;
}

function build() {
  const pieces = load();
  const errors = [];
  const ids = new Set();
  for (const p of pieces) {
    for (const e of checkOriginal(p).errs) errors.push(`${p.id}: ${e}`);
    if (ids.has(p.id)) errors.push(`duplicate id ${p.id}`);
    ids.add(p.id);
  }
  if (errors.length) {
    console.error(`build-originals: refusing to write — ${errors.length} problems in the sources`);
    for (const e of errors.slice(0, 20)) console.error("  ✗ " + e);
    process.exit(1);
  }

  const shards = Math.ceil(pieces.length / PER_SHARD);
  const files = new Map();

  const index = pieces.map((p, i) => ({
    id: p.id, diff: p.level, bpm: p.bpm, th: p.th, en: p.en, zh: p.zh,
    hn: firstNote(p), len: secs(p), k: Math.floor(i / PER_SHARD),
    /* mode and metre ride in the index, not only in the tune shard: the Original
       Content page divides a hundred thousand pieces into families, and it has to
       be able to file a card by its family before anyone has opened its notes.
       Two short strings cost about four bytes a row and save opening a shard
       per piece just to learn what style it was in. */
    mode: p.mode || "", meter: p.meter || "4/4",
    /* the idiom, for the pieces that have one. Written ONLY when the composer set it: the
       key is absent on every ordinary piece, so the hundred thousand rows that are not
       jazz or blues stay byte-for-byte what they were, and a jazz row carries ~10 bytes.
       The Original Content page files these under its Jazz & Blues family, so without it
       five hundred real blues would sit in the shelf with no way to tell them from the
       rest except by listening to all of it. */
    ...(p.style ? { sty: p.style } : {}),
  }));

  /* The index is SHARDED, and at 100,000 pieces that is the whole point.
     One index.json held 1.5 MB at 10,000 pieces; the row grows linearly, so
     at 100,000 the same file is ~15 MB — downloaded in full, on a phone, the
     moment a learner opened the shelf, to render the first sixty cards. So
     index.json is now a manifest of a few hundred bytes naming the pages, and
     the rows live in index-NN.json. The learner pays for the page they are
     looking at, exactly as they already pay only for the tune they play. */
  const indexShards = Math.ceil(index.length / PER_SHARD);
  files.set("index.json", JSON.stringify({
    v: 3, n: pieces.length, shards, per: PER_SHARD,
    indexShards, indexPer: PER_SHARD,
  }));
  for (let s = 0; s < indexShards; s++) {
    files.set(`index-${String(s).padStart(3, "0")}.json`, JSON.stringify({
      v: 3, page: s, n: index.length,
      songs: index.slice(s * PER_SHARD, (s + 1) * PER_SHARD),
    }));
  }

  for (let s = 0; s < shards; s++) {
    const part = pieces.slice(s * PER_SHARD, (s + 1) * PER_SHARD);
    files.set(`songs-${String(s).padStart(2, "0")}.json`, JSON.stringify({
      v: 1, shard: s,
      songs: part.map(p => ({ id: p.id, seq: seqText(p), key: p.key, mode: p.mode, meter: p.meter, diff: p.level })),
    }));
  }
  return files;
}

const files = build();
if (process.argv.includes("--check")) {
  let stale = 0;
  for (const [name, body] of files) {
    const f = path.join(OUT, name);
    if (!fs.existsSync(f) || fs.readFileSync(f, "utf8") !== body) { console.error(`public/originals/${name} is out of date — run node scripts/build-originals.mjs`); stale++; }
  }
  console.log(stale ? `build-originals: ${stale} file(s) out of date` : `build-originals: public/originals is up to date (${files.size} files)`);
  process.exit(stale ? 1 : 0);
}

fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT).filter(f => f.endsWith(".json"))) fs.unlinkSync(path.join(OUT, f));
let total = 0;
for (const [name, body] of files) { fs.writeFileSync(path.join(OUT, name), body); total += body.length; }
const idx = files.get("index.json").length, shard = files.get("songs-00.json").length;
const page = files.get("index-000.json").length;
console.log(`build-originals: ${files.size - 1} files -> ${path.relative(ROOT, OUT)}`);
console.log(`  index.json ${(idx / 1024).toFixed(1)} KB (manifest only) · one index page ${(page / 1024).toFixed(0)} KB of 500 rows · one tune shard ${(shard / 1024).toFixed(0)} KB of 500 pieces · all ${(total / 1024 / 1024).toFixed(1)} MB, none of it in the bundle`);
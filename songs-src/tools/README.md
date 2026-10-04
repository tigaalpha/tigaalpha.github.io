# The score → tune pipeline

Every classical piece in `songs-src/classical/` was made by these scripts from a **typeset public-domain score**,
not written from memory. They are plain Python 3 (standard library only, apart from LilyPond itself) and are not
part of the app or its build: nothing here runs unless you want more pieces.

```
Mutopia Project (LilyPond sources, header "Public Domain")        OpenScore Lieder (MusicXML, CC0)
   │  inventory.py      read each score's header                     │
   │  compile_all.py    LilyPond → MIDI   (compile_conv.py: old      │  musicxml.py reads the score directly
   │                    sources, via convert-ly + LilyPond 2.24)     │
   └────────────────────────────┬───────────────────────────────────┘
        extract.py / extract_openscore.py   one tune per score: top voice, quantised to sixteenths on the bar grid,
                                            a pickup or not, cut at a cadence, folded into C4–B5, a playable bpm, the key
        assemble.py [--os]        choose which tunes are tune-like and playable, drop copies → pool.json / pool-os.json
                                  (--os also drops a melody the app already has, found by its intervals: dump_app_songs.mjs)
        titles_in.py [--os]       rows to name → titles-in[-os]/batch_K.json   (names: see below)
        finalize.py               pool + names → songs-src/classical/<composer>.json
node scripts/verify-songs.mjs songs-src/classical      # public domain, bars add up, range, key, titles, no copies
node scripts/build-songs.mjs                           # → songs-classical.ts (generated; never edit by hand)
```

## The other folder: `songs-src/originals/` — pieces TiGA composed itself

Ten thousand playable pieces is out of reach by harvesting scores: the public-domain ceiling for this app was measured, not
guessed — 1,185 pieces in the library plus roughly 1,000–1,500 more reachable from Mutopia, so about 2,200–2,700. It IS
reachable by **composing**: a piece written here is ours, so it carries no third-party licence question at all, and producing
it costs nothing.

```
songs-src/tools/gen_originals.mjs --count=10000     # → songs-src/originals/orig-00..19.json  (deterministic; same
                                                    #   command = byte-identical files on any machine)
node scripts/verify-originals.mjs songs-src/originals   # bars, range, key, level, titles, no two tunes alike
node scripts/build-originals.mjs                   # → public/originals/index.json + songs-00..19.json
node scripts/verify-originals-shelf.mjs            # drives the real bundle to the shelf in jsdom
```

`npm run songs:originals` runs all three; `npm run songs:check` is the read-only version (also re-checks the classical side).

**Nothing is copied.** Every note comes from a seeded pseudo-random walk constrained by ordinary tonal rules — the diatonic
scale of the key and mode, chord tones on the strong beats, the leading tone resolving upward at the cadence, mostly stepwise
motion, the tritone never taken as a melodic leap. No motif, phrase or bar of any existing piece is an input. What is taken
from the 1,185 classical pieces is statistical, not musical: how wide a piece of a given level spans, how far it leaps, how
fast its notes move, how long it lasts — all measured by `levelOf`/`profileOf` in `scripts/build-songs.mjs`, which is also what
**measures** a generated piece's level rather than being told one.

**Why it is rule-based and not a model.** A model call per piece would cost money on every regeneration, would not be
reproducible, and could not be checked note by note. The app already trusts this approach: `music-engine.tsx` composes scale,
chord and interval drills by rule (`makeScaleSong` / `makeChordSong` / `makeIntervalSong`) and ships them as real playable
songs. This is that idea at library size.

**Why the titles read as one title in three languages.** `originals-lexicon.mjs` holds every idea as ONE row — Thai, English
and Chinese together — and a title joins rows, so "quiet" is the same word in all three. The three word orders are kept apart
on purpose, because the languages do not share one: English puts the quality first (*Quiet River*), Thai puts the head noun
first (*แม่น้ำเงียบ*), Chinese puts the place first and takes 的 (*黄昏时宁静的河*). The words are enumerated, never sampled —
sampling 4,000 titles out of ~14,400 collides often — and each form keeps its own counter.

**How the app gets them.** Not from the bundle: 4.3 MB of notes would be downloaded before a learner played anything, and the
song library is already read synchronously in forty places. `scripts/build-originals.mjs` writes `public/originals/index.json`
(1.2 MB: the shelf — id, level, tempo, three titles, first note, length; **no notes**) and twenty `songs-NN.json` shards
(158 KB each, 500 pieces with their tunes). `originals-store.ts` fetches the index when the shelf is opened and one shard when
a piece is chosen. On GitHub Pages that is the same static host the rest of the site uses, so there is no database, no
migration and no API key.

## Why scores and not memory

A tune typed from memory is a guess, and a wrong note in a famous theme is worse than no song. A typeset score is the
composer's text; MIDI compiled from it carries every pitch and duration exactly. The pipeline was checked against two
tunes whose notes are known (Beethoven's *Für Elise*, Satie's *Gymnopédie No. 1*) before anything was added, and the
MusicXML reader against Mutopia on songs both carry (Schubert's *Der Musensohn* and *Lachen und Weinen*: every pitch and
duration the same). **Do not add a classical piece to this folder that did not come from a score** (`src` must name it).

## Licence

Only scores whose Mutopia header says `Public Domain` are used (not CC BY / CC BY-SA, which ask for credit or share-alike),
plus OpenScore Lieder (CC0 transcriptions of public-domain editions), and only when the composer died in 1950 or earlier
**and** the piece was written in 1929 or earlier. For OpenScore the rule is stricter: only composers who died in **1929 or earlier**
(`COMPOSERS` in `extract_openscore.py`), so every song of theirs is old enough whatever its date; a composer who died 1930–1950 is left
out because the date of an individual song cannot be checked from the file. Each piece records its source in `src` and `license`. The tune in the app is a
one-note-at-a-time simplification of the score, which is ours; the notes of the work are the composer's.

## Setting up (about 2 GB, a few minutes)

```bash
export SONGS_WORK=/some/scratch/folder            # default: node_modules/.cache/songs-work
mkdir -p "$SONGS_WORK" && cd "$SONGS_WORK"

# 1. the Mutopia scores (only the ftp/ tree, no history)
git clone --depth 1 --filter=blob:none --sparse https://github.com/MutopiaProject/MutopiaProject.git mutopia
git -C mutopia sparse-checkout set --cone ftp

# 2. LilyPond (wheels on PyPI carry the binary); the second one is for scores written for an old LilyPond
python3 -m venv venv  && venv/bin/pip  install lilypond==2.25.12
python3 -m venv v224  && v224/bin/pip  install lilypond==2.24.3

# 3. OpenScore Lieder: every MusicXML file of the corpus (about 1,460 songs, 28 MB). Impressionism lives here (Mutopia has almost none),
#    and so do the song composers of the 19th century
git clone --depth 1 --filter=blob:none --sparse https://github.com/OpenScore/Lieder.git openscore
git -C openscore sparse-checkout set --no-cone '/scores/**/*.mxl'
```

## Running it

From the repo root:

```bash
T=songs-src/tools
# Mutopia
python3 $T/inventory.py                      # → $SONGS_WORK/inventory.json
python3 $T/compile_all.py                    # LilyPond → midi/<id>/ + meta.json (resumable; 4 at a time; ~30 min)
python3 $T/compile_conv.py                   # the ones that failed: convert-ly, then 2.24
python3 $T/extract.py                        # → cands.json and a count of why each piece did or did not make it
python3 $T/assemble.py                       # → pool.json (+ pool.tsv, one readable line per piece)
# OpenScore
python3 $T/extract_openscore.py              # → cands-os.json
node $T/dump_app_songs.mjs                   # → app-songs.json: the tunes of every song in the app now (to find a melody it already has)
python3 $T/assemble.py --os --take=450 --cap=45
                                             # → pool-os.json: what the app does not already hold, best-ranked first; at most 450 pieces
                                             #   that are not named yet and at most 45 per composer (a piece already named always stays)
```

`extract.py ID_REGEX` runs a subset, `compile_all.py PATH_REGEX` compiles a subset, `extract_openscore.py Debussy` one composer.
Everything is deterministic: the same inputs give the same `pool.json`.

### Names

`pool.json` holds the tune and the score's own header (`info`: title, opus, instrument, date). The titles shown on the song card
(English / Thai / Chinese, each ending with the composer in brackets) are written from that header by reading it:

```bash
python3 $T/titles_in.py [--os] [--missing] [N]
                                             # → titles-in[-os]/batch_1..N.json, rows with the header and the composer's Thai/Chinese name
                                             #   (--missing: only the pieces with no name yet → batch_m1..mN)
# write titles-out[-os]/batch_K.json: [{"i", "en", "th", "zh", "work"} ...]  (or {"i", "skip": true})
python3 $T/check_titles.py titles-in/batch_K.json titles-out/batch_K.json     # lists every problem, "OK" when there is none
```

Rules for a name: `en` is the title musicians know, then the composer in brackets exactly as in the row (at most 64 characters, all
different); German/French/Italian titles keep the original with a short English gloss after a dash; `th` and `zh` are the usual
transliteration or translation with the composer's Thai / Chinese name in brackets; `work` is the full catalogue name for the record.
Do not write out lyrics: a song's title is its first line at most.
`existing-ids.json` (a list of the ids already in the app, from `node scripts/list-songs.mjs`) keeps a new id from colliding with an old one;
`exclude-ids.json` lists ids to leave out after naming (a tune found to be a copy).

```bash
python3 $T/titles_merge.py [--os]            # files the checked answers under the key of their score → titles-by-key.json
python3 $T/finalize.py                       # → songs-src/classical/<composer>.json  (replaces the folder's contents; a piece keeps its id)
node scripts/verify-songs.mjs songs-src/classical
node scripts/build-songs.mjs
```

## What the extraction does to a score, and what it never does

- Takes the **top voice** of the keyboard part, the vocal line of a song, or the one melodic instrument, one note at a time; trills and
  grace notes are dropped, an ornament is not played as a run of notes.
- Quantises to sixteenths **on the bar grid** (`\partial`, or the short first measure of a MusicXML score, gives the pickup) and keeps
  the real rhythm of the score.
- Folds into **C4–B5** by octaves; if the tune is still wider it moves the whole piece (at most 5–6 semitones, recorded in `note`),
  because a piece that cannot be played is not a song.
- Picks `bpm` from the MIDI/score tempo, slowed until the shortest common note lasts at least ~0.19 s.
- 6/8 becomes 3/4 with eighths = 0.5, 3/8 is doubled, other meters are skipped (the engine knows 2/4, 3/4, 4/4).
- Finds the key from the key signature and the notes (Krumhansl–Schmuckler), checks the tune stays in it; chromatic or modal writing
  (Debussy, Satie) is marked `"scale": "modal"` so the key check relaxes — the notes are still the score's.
- Never invents, repairs or "improves" a note. A piece it cannot read cleanly is left out, not guessed.

The composers it accepts, with dates and era, are the `COMP` table at the top of `extract.py` (add one there to open a new composer;
an unknown composer is ignored). `COMPOSERS` in `extract_openscore.py` maps OpenScore folders to those codes.

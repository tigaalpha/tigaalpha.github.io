# Classical pieces for Play Along

Owner, 2026-10-01: "find classical pieces older than 75 years and add them, so Play Along has more than 500 songs,
and divide the song list by era: Baroque / Classical / Romantic / Impressionism."

This folder holds the **source** of those pieces: `classical/*.json`, one file per composer, one object per piece.
`scripts/build-songs.mjs` turns it into `songs-classical.ts` (generated, never edited by hand), which `songs-data.ts`
appends to the song list and whose era of each piece becomes its category chip on the song list. Nothing in this folder is
run by the app. `tools/` is the pipeline that made the pieces (see `tools/README.md`).

## Where a tune comes from: a score, never memory

Every piece was **extracted from a typeset public-domain score** — Mutopia Project LilyPond sources whose header says
`Public Domain`, and OpenScore Lieder transcriptions (CC0) of public-domain editions — compiled to MIDI and reduced to a
tune by `tools/extract.py`. The `src` field of each piece names the file. A tune written from memory is a guess, and a wrong
note in a famous theme is worse than no song, so **do not add a classical piece that did not come from a score**. (An early
attempt at authoring from memory produced tunes nobody could vouch for; the pipeline replaced it and was checked against
two tunes whose notes are known, Beethoven's *Für Elise* and Satie's *Gymnopédie No. 1*.)

A piece is a **tune**: the top voice of the work (the right hand of a keyboard piece, the vocal line of a song, the lead
instrument of an ensemble), one note at a time, with the real rhythm. The left hand is not written — the game makes the
accompaniment itself. Trills and grace notes are left out.

## Public domain (hard rule)

The composer died in **1950 or earlier** and the piece was written in **1929 or earlier**. That is stricter than "older
than 75 years" on purpose. So: no Prokofiev, Shostakovich, Stravinsky, Sibelius (d. 1957), Vaughan Williams, Kreisler; no
pop or film versions; and no 20th-century arrangements passed off as old music — e.g. the famous "Albinoni Adagio" is
Giazotto's work from 1958. The source must also be free to use: Mutopia scores under CC BY or CC BY-SA (they ask for credit
or share-alike) and kern/music21 corpora with unclear terms were **not** used.

## File format

```json
[
  {
    "id": "bach_musette_d",
    "era": "baroque",
    "composer": "J.S. Bach",
    "died": 1750,
    "year": 1725,
    "work": "Musette in D major, BWV Anh. 126",
    "en": "Musette in D Major, BWV Anh. 126 (Bach)",
    "th": "มูเซตต์ ใน D เมเจอร์ (บาค)",
    "zh": "D大调缪塞特舞曲（巴赫）",
    "key": "D",
    "meter": "2/4",
    "bpm": 100,
    "pickup": 0,
    "bars": ["A4:0.5 D5:0.5 F#5:0.5 D5:0.5", "..."],
    "conf": "high",
    "src": "mutopia:BachJS/BWV126/...",
    "license": "Public Domain (Mutopia Project header)"
  }
]
```

- `id` — snake_case, unique, `<composer>_<work>`. `node scripts/list-songs.mjs <word>` shows what the app already has.
- `era` — `baroque` (c. 1600–1750), `classical` (c. 1750–1820: Mozart, Haydn, Beethoven, Clementi, Kuhlau …), `romantic`
  (c. 1820–1900 and its late nationalist/opera/waltz repertoire), `impressionism` (Debussy, Satie, Lili Boulanger, Delius …).
  Go by who the composer is, not by the year alone. The table is `COMP` in `tools/extract.py`.
- `composer`, `died`, `year` — the composer's name, the year they died, the year the piece was written (when the score does not
  say, the composer's last year, capped at 1929). The checker refuses `died` > 1950 and `year` > 1929.
- `work` — the full catalogue name, for the record (not shown in the app).
- `en` / `th` / `zh` — the three titles shown on the song card, each **ending with the composer in brackets** (`(…)` or `（…）`).
  English at most 64 characters. German, French and Italian titles keep the original with a short English gloss (` – `), Thai and
  Chinese are the usual transliteration or translation.
- `key` — `C`, `G`, `F#`, `Bb`, `Am`, `F#m` … the key of the tune **as written in the bars**. A piece in a mode or on a free
  scale (much of Debussy) also has `"scale": "modal"` (or `whole-tone`, `pentatonic`, `chromatic`) so the in-key check relaxes.
- `meter` — `2/4`, `3/4` or `4/4` only: 6/8 is written as 3/4 with eighths = 0.5, 2/2 as 4/4, 3/8 in doubled note values; one
  beat is one quarter note. Other meters are left out.
- `bpm` — quarter notes per minute, **50–140**, slowed (never sped up) until the shortest common note lasts at least ~0.19 s.
- `pickup` — beats of the anacrusis (the short first bar), `0` if the tune starts on the bar. With a pickup the song ends on a
  full bar: pickup + whole bars.
- `bars` — one string per bar, notes separated by spaces, `NOTE:beats` (`E5:1`, `C#5:0.5`, `R:1` for a rest). Multiples of 0.25
  only; every bar adds up to the meter; a held note may run over the bar line (the staff draws the tie); the song ends exactly on
  a bar line.
- `conf` — `"high"`: the notes come straight from a score.
- `src`, `license` — the file the notes come from (`mutopia:<path in the Mutopia tree>` or `openscore:scores/<path>`) and its licence.
- `note` — optional: a transposition (`transposed +2 semitone(s) to fit C4-B5`, only when the tune cannot fit the keyboard
  otherwise), where in the piece the excerpt starts, a doubled note value, chromatic writing.

Notes are `C4 … B5`, **sharps only** (`C#4`, never `Db4`): the range of the game's keyboards. A tune is folded by octaves into
that range; if it still does not fit, the whole piece moves by a few semitones and says so in `note`.
Length is about 12–34 bars, 16–170 notes, 14–120 seconds.

## Adding or changing pieces

```
node scripts/verify-songs.mjs songs-src/classical      # the rules above, plus: no tune twice, none the app already has
node scripts/build-songs.mjs                           # → songs-classical.ts   (--check fails when it is out of date)
node scripts/list-songs.mjs bach                       # what the app has
```

`verify-songs.mjs` checks the form (fields, bars adding up, range, sharps only, titles), the key, the public-domain limits and
copies. It cannot hear a melody: a clean run says the piece is well-formed and plausible; that it is the right tune is what the
score-extraction guarantees. To add more pieces from the same sources, follow `tools/README.md`; for a piece from another
public-domain score, add a way to read that score to `tools/` rather than typing notes in.

The level of each piece (`diff`, which decides at which player level it opens) is the app's own estimate for a tune —
range, average and widest leap, plus one step for fast notes — computed by `build-songs.mjs`.

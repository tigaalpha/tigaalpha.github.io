# AGENTS.md

Instructions for AI coding agents (Claude Code, Codebuff, or others) working
in this repository. Read this before making changes — it exists so that
independent agent sessions, run at different times by different tools,
don't conflict with each other or with the human owner's expectations.

**Talk to the owner in Thai.** Every message written to the owner (answers,
progress updates, summaries) is in Thai, including after a context reset.
Code, code comments, commit messages and file contents stay in English as
they are now.

## Delivery — the owner's four steps, every time (owner, 2026-10-04)
Every change ships in the same four steps, with no asking first:

  1. **Push**      2. **Commit**      3. **Deploy**      4. **Vercel**

Committed and pushed without asking, for every task. Anything in this file that
says the Changes panel owns commits and pushes is superseded — the panel is
still useful for review and PRs, but it is no longer the delivery path.

### Vercel is deployed BY the push, not by a separate command
The Vercel project is connected to this GitHub repo and builds `main`
automatically, so **step 1 already performs step 4**. Evidence, not assumption:
the Vercel deployments list shows Production deploys whose commit SHAs are this
repo's own (`be6924390`, `1ab2596b`, `b74baa32b`), one per push. There is no
`vercel deploy` step to run and no Vercel token in this environment — running
one would be guessing at a second, competing path to production. So: push, then
say plainly that the Vercel deploy has been triggered and what its state is.
The owner can read the result at vercel.com/tiga2/tigaa.

The deploy used to fail on every push at roughly one minute, which is where the
SPA bundle step starts; `vercel.json` now sets `NODE_OPTIONS` for the build
after the heap ceiling was measured (OOM at 1,024 MB, passes at 1,400 MB). If
a Vercel build ever fails again with no useful line, that heap ceiling is the
first thing to check.

### What still needs the owner, because no code task implies it
- SQL / migrations against the live database
- `supabase functions deploy <name>` — the Edge Functions are NOT covered by the
  git push, and several changes here are client-side only until the owner runs
  them (`piano-chat`, `piano-tts`, `weekly-report`, `stripe-checkout`)
- anything destructive on a remote (force-push, history rewrite, deleting a tag)

When part of a change needs one of those, finish and ship everything else, then
say plainly what is left. Do not report it as done.

### Android / Play Store
`android/` is a first-class target, not an afterthought: a change to the app
should keep the Capacitor project buildable, and Play Store rules are pinned by
`scripts/smoke-android-play-store.mjs` (`npm run verify:android`). Two of those
checks exist because they were false once — the versionCode formula and the
signing-key ignore rule. Read `PLAY_STORE_GUIDE.md` before touching release
config; it names what is still the owner's to do (the $25 account, the release
keystore, the first upload).

`git push` regularly needs a merge first. The OTA auto-release bot commits to
`main` about every hour, so a push from a long task session is usually rejected
as non-fast-forward. Merge `origin/main`, resolve the bundle filename churn by
rebuilding (`npm run build`) rather than by picking a side, re-run the checks,
then push.

## What this is

TIGA.AI — a live, revenue-generating piano-learning web app (Thai/English/
Chinese), deployed via GitHub Pages from `main`. React 18 + Vite 5, built as
a single-file SPA (`vite-plugin-singlefile`). Also wrapped with Capacitor
for a native Android app (debug APK auto-built by
`.github/workflows/android-debug-build.yml` on every dev-branch push,
published to the `android-debug-latest` GitHub Release) and distributed on
iOS as a PWA. A separate `studio/`/`bos/` Next.js app lives in the same repo
and deploys independently — commits touching `studio/`/`bos/` on `main` are
not part of the piano app and can be treated as unrelated background noise.

**No TypeScript checking anywhere** — no `tsconfig.json`, no `typescript`
devDependency. `.ts`/`.tsx` files exist for editor ergonomics only; esbuild
strips the syntax at build time but never validates types. A clean
`npm run build` proves the bundle compiles, not that the code is correct —
don't treat it as a substitute for actually reading the diff or testing the
behavior.

## Structure

The app was originally one ~15,000-line `App.tsx`; it's now split by
concern into top-level files (plain relative imports, no path aliases, no
barrel files): `supabase-client.ts` (the one `sb` singleton — everything
imports this, nothing else creates a client), `payment.tsx`,
`music-engine.tsx`, `speech.ts`, `hand-pose.ts`, `i18n.ts`,
`ai-backend.ts`/`ai-cache.ts`/`ai-chat-context.ts`/`chat-ui.tsx`,
`shared-infra.ts`, `app-shell.tsx`, plus presentational overlay/page
components (`PricingOverlay.tsx`, `PracticeOverlay.tsx`, `SongPlayOverlay.tsx`,
`SightReadingOverlay.tsx`, `CameraCoachOverlay.tsx`,
`SfxMetronomeSettings.tsx`/`SkinThemeSettings.tsx`/`LanguageSettings.tsx`,
`ProfileDashboardPanel.tsx`, `SenseiView.tsx`, `VoiceTutorOverlay.tsx`) and
`use-*.ts` hooks (`use-payment`, `use-gamification`, `use-keyboard`,
`use-practice-mode`, `use-sight-reading`, `use-camera-coach`,
`use-play-along`, `use-chat`, `use-voice-tutor`). `App.tsx` itself is now
the glue layer (`PianoApp`) that wires these together, plus the page
components that haven't been extracted yet. `pathway-data.ts`/
`songs-data.ts`/`app-styles.ts` are pure data/CSS, split out earliest.
`native-auth.ts`/`native-stt.ts`/`native-updater.ts` are Capacitor-only
concerns. If you need the reasoning behind any particular split, `git log
--oneline --all | grep -i phase` finds the extraction commits — each one
explains what moved and why.

**Play Along** (`use-play-along.ts` + `SongPlayOverlay.tsx`) keeps its rules
in pure modules: `play-along-judge.ts` (timing windows, accuracy, stars,
mashing, input-delay learning, boss numbers) and `play-along-progress.ts`
(earned stars and best accuracy per song, locks, the daily song, what to
play next, medals, the per-day run count); `play-along-band.ts` is the
backing band (drums, bass, strings, brass and the Fever arpeggio, a finale on
the last chord), booked ahead on the audio clock like the metronome and kept out
of the mic's hearing — what plays with a song is the player's choice, the
backing track or a metronome (`songAccomp`, the pair of buttons in the header's
top right corner, also in the pause card). **The band arranges itself for the
piece** (plan 23): `createBand` takes `style` and `bpm`, `use-play-along.ts`
passes `SONG_GENRES[meta.id]` (`songs-data.ts:1416`, which holds a genre or era
for all 1,067 songs), and `BAND_STYLES` in `play-along-band.ts` turns it into a
kit, a lead voice and a pad — a Baroque piece books no drums at all, a jazz one
rides the cymbal, and the drums follow the metre (3/4 is a waltz with no snare,
2/4 a march) instead of a fixed 4/4 rock beat, which 375 of the 875 classical
pieces are not. **A style the table does not know must fall through to the old
band exactly**, since a song the player wrote has no genre; `scripts/smoke-band-style.mjs`
(224 checks, no speakers needed — every style in every metre, plus Fever,
the finale and the left hand) pins that and every kit. The plan and its
results are in `tigamodel/docs/23-plan-band-per-song-instrumentation.md`, next to
`22-plan-play-along-backing-track.md` ("why does it feel like there is no backing
track").

**Sound, measured rather than guessed (plan 23 §11).** `scripts/band-audio-lab.mjs`
is an offline Web Audio engine — AudioParam ramps, PolyBLEP oscillators, RBJ
filters, a delay line, the app's own bus — and `scripts/analyze-band-sound.mjs`
drives the **real** `play-along-band.ts` through it for real songs from
`songs-data.ts` and measures level, clipping, spectral balance, how much the song
moves, and whether the player can hear their own note over the band. Three
numbers decide any change to the mix: **no clipped samples at all**, **no more than
~90 % of the energy below 250 Hz** (measured 80–91 % after the review), and **the
band 12 dB or more below the player's own note** at the melody's pitch
(`renderMelodyRef` plays it exactly as `playPianoNote` does). `createBand` also
takes `mel` now — the player's notes — and keeps its octave-5/6 voices out of the
way where they sound; a caller that passes nothing gets the old booking.
`tigamodel/docs/23b-plan-band-sound-review.md` has the before/after tables.

**The lab has to behave like the browser, or its numbers are fiction.** Two
mistakes here cost real time, and both failed quietly: `ConvolverNode.normalize`
**defaults to `true`**, so a browser rescales every impulse response it is handed
— the lab convolved the raw one and ran ~+17 dB hot, which looked exactly like an
app-wide "drowned in a loud room" bug and was nothing of the kind. And `bandMix()`
rounded both ends of every frequency band to the nearest bin and read the range
inclusively, so each boundary bin was counted twice: a single spike at 60 Hz came
out as **200 %** of the total energy, and the `sub` column inflated to 38 % on
exactly the bass-heavy styles the measurement exists to judge (real value: 8 %).
Both are fixed. `scripts/verify-audio-bus-ir.mjs` (6 checks) measures the bus on
its own — **wet/dry −14.8 dB, peak −7.9 dBFS, zero clipped samples**, the room is
fine, so do not go looking for a bus bug that is not there. Retractions are in
§11.7 of `23b`; the next rounds of work are `24-plan-band-sound-next.md` (the
sound), `25-plan-play-along-juice-and-replay.md` (why a player comes back) and
`26-plan-sensei-page-teaching-loop.md` (the practice page the learner stands on).

**The practice page already has a lesson plan — it is just two taps away.**
Plan 26 · `SenseiView.tsx` is the Teacher tab. `TodayPage` (`App.tsx:1227`)
already builds the real daily plan — warm-up, homework, the SRS due stage
(`getDueReviews`, `App.tsx:5650`), the next thing, a song — and counts
`nDone/steps`; it was reachable only from a card inside Studio and had no tab.
That count is now computed by **`buildTodaySteps()`** (`App.tsx:1159`, extracted
verbatim) and rendered on the Teacher page too, so the two surfaces cannot
disagree — call that function, never re-derive it. The streak/quest/EXP bar
(`chat-ui.tsx:202`) moved from under the chat input to the top of the page and
renders at zero via its `always` prop (line 204's early return is kept for every
other caller). The page also surfaces three things that were already on the
device and read by nothing: the last drill, replayable (`readPracticeBests` +
`replayDrill`), the pitch classes the learner actually misses
(`recordNoteMisses` / the `readNoteMisses` reader added beside it), and, once
the plan is genuinely finished, last session's accuracy against the one before.
All of it moves existing signals — no new numbers, no new economy.
`scripts/smoke-app-boot.mjs` asserts P1/P2/P5/P6/P7 against the real page and
seeds the two stores they read; **P7's positive path is still uncovered** — do
not read that as tested. Two traps cost time here: putting that block above the
`usePracticeMode` destructure throws a TDZ `ReferenceError` on every render, and
the smoke script used to leave `.smoke-*.js` files behind in the tracked
`bundle/` directory on every run.

**A reward loop that pays once is not a loop.** Plan 25 · `play-along-judge.ts`,
`play-along-progress.ts`. `comboMult` used to climb to ×4.9 at combo 300, which the
longest song (48 notes) can never reach — it topped out at **×2.38**, so playing
better barely moved the number; it now passes ×3.0 at combo 48 under a real ×6 cap.
`feverAt`/`megaAt` had floors of 10 and 20, which did not make them *early*, they
made them **impossible** — Mega Fever was unreachable on any song under 20 notes.
Both are now clamped to the song's own length, so every song reaches both. Coins
still stop after the third run of a day (`RUN_COIN_RUNS`) and medals pay once, so
the reward for repetition is `replayExp` — EXP by how many times this player has
played this song (0 on the first run, climbing, capped). **EXP only, never coins:
coins are the paid currency and stay out of reach unasked.** The play counter is
`tg_count_<id>`; a run that was not really played does not move it
(`runPlayed`). Before changing scoring or rewards, run
`scripts/verify-playalong.mjs` — 50 checks — and change the number, never the
feeling. Before believing any number, ask what it passed through, check it against
the API's spec, and check that any percentages which should sum to 100 do.

`play-along-stage.ts` is the
world behind the falling notes (sky, moon, planet, milky way, aurora, four
planes of a city, a mirror floor). The *world* is painted once per canvas size
(`paintWorld`, kept two deep, and what is half painted is kept too) and a song
only adds its lanes and hit-line to a copy of it (`composeStage`, about 3 ms
where the whole backdrop used to be baked at every Start); the ready screen
paints the world in idle time, one slice per `requestIdleCallback`, for the size
the stage had when a run last began on this screen (`tg_pa_stage` — the ready
canvas is taller than the playing one, so its own size is the wrong one), and
`stage-prebaked` in the bot suite checks Start then finds it done. What is
painted stays cheap by area: the sky's soft layers are drawn at a quarter of the
pixels and stretched once, buildings, windows and stars are one path per
colour, and the sprites that are only glows are at half resolution. Its few
moving parts (core flare, turning ring, shock-ring, floor line, Fever beams,
cars, twinkling stars, beacons, the shooting star) are drawn only at the top
graphics level and built to cost almost nothing between beats — anything new
there must stay a cached bitmap or a stroke, never a gradient built per frame,
and must not flash more than about three times a second. The
judge words, score pops and sparks are drawn in the song canvas from cached
bitmaps, not as DOM elements.

**The sheet view (owner, 2026-09-30).** Beside the Backing/Metronome pair in the
header's top right corner, a second pair of buttons chooses how a song is shown
(`songView`, saved as `tg_pa_view`): `fall`, gems falling to the keys, or `sheet`
— no falling notes at all, for a player who can read and play without them.
`.pl-sheet` on the overlay moves the staff (CSS `order`, no remount) from above
the stage to between it and the keyboard, so it sits on the keys, and draws it
larger (134 px, 210 px for a grand staff; `hudTick` shows 3 bars on a phone
instead of 5 so the spacing holds). The stage above it is only the world
(`neb.cv` is `world.cv`: no lanes, hit-line or receptors); the judge words and
flashes still rise from the key that was played. **The keys (owner, 2026-10-01:
"make the keys that teach have a running light, neon blue is fine" — and "in
Metronome mode too, the light must be in every mode on the piano keys").** The next
key is lit in both views — in the sheet view in one neon blue (`--pl-run`,
`.pl-sheet .gpw.lit`), where a falling gem gives each lane its own colour — and a
light runs to it **in every mode**: falling or sheet, backing track or metronome,
practice, drills, every hand. It is one `.gprun` element per lit key along the top
of the keys (`runners` of `GamePiano`, placed by `gpKeyBox` — the same arithmetic
the keys are laid out with, so it lands on the key on all three keyboards: right
hand from C4, left from C2, both from C3; `PaPiano` draws it whatever the view, so a
new mode gets it for free — keep it that way). Its left and right edges are
transitioned separately and the edge facing the way it goes is the quick one, so it
stretches across the keys and settles; it moves only when the next key changes
(about every 120 ms at most, `hudTick`), and reduced motion turns the transition
off. Finger numbers stay out of the sheet view — reading the note is still the
point of it. A note you hit turns green on the
staff and one you missed red (`hit`/`miss` states
of `PlayAlongStaff`) and slides away in that colour. Scoring, the band and the
metronome are the same in both views. The first-song intro teaches the gems, so
it is always shown falling (`sheetOn()`). Anything new that draws falling notes
must stay behind `!sheet` in `songLoop`; the `sheet` bot section covers it, and
`window.__paTest.gems()` counts the gems the last frame drew.

**The microphone and the game's own sounds (owner report 2026-09-30: "I pressed
D and it heard C").** On a phone the speaker is an inch from the mic, so every
sound the game makes reaches the pitch detector. Rules that keep it honest:
`createMonoDetector` (`music-engine.tsx`, the mono mic path) low-passes each
frame at 2.6 kHz (8th order) before it listens — energy above the piano only
lowers the autocorrelation's clarity, and a clean high tone is read as a
"note" far below it — and *holds* a note that has fired: the same pitch class
in the next frames is that note still ringing, not a new press, unless a strike
(the level jumps 6 dB in a clear tone) says otherwise; without it anything that
drowned the note for a moment made it fire twice, and a second C while the D is
due reads as "you pressed C". While a mic listens and no key has been tapped,
the player is taken for a pianist (`bandPump`): the band plays soft drums only
and `setMicSafe(true)` switches the game's sounds to their mic-safe voice — the
hit ding is dropped and the whoosh, boom crackle, level-up chime, miss sound and
metronome click become noise far above the piano (`hfPing`), never a tone
inside it. A player who taps gets the full band and their mic is put aside:
`handleSongInput` lets a mic reading through only when it lands on a note the
music asks for now. **Any new sound played during a run must be noise, far above
the piano, or blacklisted (`_accMarkSuppress`), and have a mic-safe voice.** `usePlayAlong` runs inside `PianoApp`, so a React state update
there re-renders the whole app — the running game's fast-changing state
(HUD, lit keys, staff, effects) lives in `play-along-store.ts` instead, read
by small subscriber components in the overlay; keep new per-frame or
per-note state there, not in `useState`. Its neon theme is
`play-along-styles.ts`, with `pl-` class names: a top-level `.pa-*`/`.ca-*`
rule is fingerprinted by the sprite bake and would mark every sprite stale.
**The neon is the game itself, not the whole overlay (owner rule,
2026-09-30):** while a song waits to start (the ready screen) the overlay
drops `.playal` and wears `.pl-themed` — the app's own theme, white in light
mode and dark in dark mode, from the `--bg`/`--card`/`--text`/`--clay` tokens —
and the neon starts with the song. Keep new ready-screen pieces on those tokens,
not on neon colours. Its settings panel (speed, hands, kind mode, loop, online
duel) is always open and first on the screen — never fold it behind a link, a
player who cannot see a setting does not know it exists — and Start stays
pinned to the bottom edge.

**Getting into Play Along (owner, 2026-10-01: "this is the star feature — people
should see it first").** A Pathway group shows its lessons and its Play Along
doors as one list, in the order `groupCells()` (App.tsx) returns: lessons, then
doors, unless `PATHWAY_ORDER` (pathway-data.ts) names another order — Foundation
puts "Practise real songs" second, beside the first lesson. Card numbers come
from that position, so moving or adding a card renumbers what follows (nothing
keys off them). The song list (`SongListPage`) goes straight to the songs: no
title block, no Daily Song Quest card, no Concert Mode card, no search box. Today's
song is still picked once a day by that page's effect (`dailySong`) and surfaces
through "Up next" and the ready screen's "Today's song" line; Concert Mode's
engine (`startSetlist`, the chaining in `finishSong`) is kept with no button, and
the bots start a concert through `__paTest.setlist`. The ready screen has no cover
image above the song title.

**The song catalogue (owner, 2026-10-01: "find classical pieces older than 75 years — Play Along should
have more than 500 songs — and divide the song list by era: Baroque / Classical / Romantic / Impressionism"; later the same
day: "add more until the app has 1,000 songs, only older than 75 years, and say on the landing page, in all three languages,
that the app has more than 1,000 songs").**
`songs-data.ts` holds the hand-made songs (pop, folk, kids, carols and the first classical set) and appends
`CLASSICAL_SONGS` from `songs-classical.ts`, which is **generated** — never edit it: the source is
`songs-src/classical/*.json` (one object per piece), checked by `node scripts/verify-songs.mjs songs-src/classical`
and written by `node scripts/build-songs.mjs` (`--check` fails when the module is stale). **A classical tune is never
written from memory:** each one is extracted from a typeset public-domain score — Mutopia Project sources whose header says
`Public Domain` (not the CC BY / BY-SA ones) and OpenScore Lieder (CC0: the vocal line of an art song, which is where most of the
Romantic and all of the Impressionist songs come from) — and its `src` field names the file;
`songs-src/tools/` is the pipeline (LilyPond → MIDI → top voice → quantised bars; MusicXML read directly for OpenScore; `README.md`
there), so more pieces are added the same way, and `songs-src/README.md` is the file format. The public-domain rule is the
composer's death in 1950 or earlier **and** the piece written in 1929 or earlier; for OpenScore only composers who died in 1929 or
earlier are used (`COMPOSERS` in `extract_openscore.py`), because a song's own date is not in its file. The library stands at 11,377
songs: 1,377 from a real score (1,185 classical pieces plus the 192 originals in `songs-data.ts`) plus the 10,000 we wrote ourselves;
**the landing page's proof strip (`landing/LandingPage1.tsx` heading the `proof1` copy) and the free-plan bullet
(`prFree1` in i18n.ts) say "10,000+"** — that claim must stay true, so a change that takes the library below 10,000 must change that
copy in the same release (`eras-1000` in the bot suite fails below it). The number lives in TWO places and they must agree: the `<b>`
above `proof1` in `landing/LandingPage1.tsx` carries the digits, `proof1` itself only carries the words.

**Jazz & blues on the same shelf (2026-10-04).** 500 pieces written by a SECOND composer,
`songs-src/tools/gen_originals_jazz.mjs` (`npm run songs:jazz`), because the rules the general generator follows — a diatonic
walk, a chord tone on every strong beat — are the wrong rules for this music. `songs-src/originals/jazz-000.json`, ids
`og_100501`…`og_101000`, three idioms: **blues** on a 12-bar form (head alternating with walking-bass bars), **swing** on a
ii–V–I with bebop approaches, **bossa** in two-beat bars. Shuffle eighths are written long-short (`0.75` + `0.25`), never
`0.5` + `0.5`. Blue notes (b5, #4) are outside the declared mode, and `verify-originals.mjs` still demands 85% in mode, so a
piece may spend at most `BLUE_BUDGET` = 12% of its notes outside it and the composer counts them as it writes — measured on the
shelf as shipped, 5.4% (blues) and 6.4% (swing) of notes are outside the mode. Two things make them findable: `build-originals.mjs`
reads `jazz-*.json` FIRST (the page filters only the index page it loaded — 500 rows — so pieces written last would sit on page
201 of 201 and their family would show nothing), and their `style` rides into the index row as `sty`, which `OriginalContentPage`
files under **Jazz & Blues**; the card mark is 🎷 there and ✨ elsewhere. `sty` is written only on those rows, so the other
hundred thousand index rows stay byte-for-byte identical. `gen_originals.mjs` now deletes only `orig-*.json` when it rewrites —
it used to delete every json in the folder, which would have quietly destroyed the jazz shelf on the next `npm run songs:originals`.

**Ten thousand more, written by us (owner, 2026-10-04).** The public-domain ceiling was measured, not guessed — 1,185 pieces plus
roughly 1,000–1,500 more reachable from Mutopia, so about 2,200–2,700 — so ten thousand playable pieces is out of reach by
harvesting scores at all. It is reachable by **composing**, and a piece we wrote carries no third-party licence question.
`songs-src/tools/gen_originals.mjs` writes `songs-src/originals/orig-00..19.json` (10,000 pieces), `node
scripts/verify-originals.mjs songs-src/originals` re-derives everything from the written bars and refuses to pass unless every bar
adds up, every note is inside C4..B5, ≥85% of the notes are in the declared mode, no two pieces are the same tune, no title repeats
in any of the three languages and none of them lands on a title the app already had, and `node scripts/build-originals.mjs` turns
them into what the app fetches. **The piece is a pure function of its index** — the same command writes byte-identical files on
any machine — and its level is *measured* by the app's own `levelOf`, never asserted. Nothing is copied: no motif, phrase or bar of
any existing piece is an input; what is taken from the classical library is statistical (range, leap, density, length), and the app
already trusts rule-composed music — `music-engine.tsx` ships scale/chord/interval drills built the same way. `npm run
songs:originals` regenerates and checks; `npm run songs:check` is the read-only version.
**They are NOT in the bundle** (`songs-classical.ts` stays at the classical 1,185): `build-originals.mjs` writes
`public/originals/index.json` (1.2 MB — the shelf: id, level, tempo, three titles, first note, length, **no notes**) and twenty
`songs-NN.json` shards (158 KB each, 500 pieces with their tunes), and `originals-store.ts` fetches the index when the shelf opens
and one shard when a piece is chosen. Same static host as the rest of the site, so no database and no migration. The shelf is a
chip of its own (`ORIGINAL_SHELF` in `originals-store.ts`), a section of its own (`SONG_SECTIONS`), every card carries a
`.songcard-og` badge, and **`songLockInfo` returns unlocked for them** — they are exercises, not repertoire behind a gate, so a
level-1 guest can open any of the ten thousand. A row without notes reads its colour and clock from the index (`hn`, `len`);
`beatsPerBarOf` reads a generated piece's own `meter`, because some are 3/4 and 2/4. `node scripts/verify-originals-shelf.mjs`
drives the real bundle in jsdom through the whole flow (17 checks); Playwright is not installed in every container, so that file —
not a browser pass — is the evidence the shelf works. A piece **keeps its id** when the library is generated again
(`finalize.py` reads the files it replaces; players' stars are filed under the id), and a new piece is checked against every song
the app has by the *shape of its melody* (`dump_app_songs.mjs` + `assemble.py --os`: a copy in another key or from another edition is
found, not only the same notes). The song list's category chips are the eras in `SONG_ERAS` (`songs-data.ts`:
baroque, classical, romantic, impressionism): `SONG_GENRES[id]` holds an id's era (or kids/folk/gospel/jazz/soul/neosoul/
carol/cn), `GENRE_CHIPS` in App.tsx lists the chips and `eraInfo` is the one-line note under a chosen era; the song grid
uses `content-visibility:auto` so 1,000+ cards cost nothing off screen. **The grid is cut into sections with an orange heading
each (owner, 2026-10-02, with a screenshot: "put the era's name, in orange, at the spot marked in red" — the start of the grid,
under Continue / Up next).** `SONG_SECTIONS` (App.tsx, above `SongListPage`) is their order: the player's own AI songs (`mine`), the
favourites (`fav`, a section of its own only while the whole library is shown and the Favorites filter is off — in a chip they stay
inside their category, as they always floated to the top), then Kids, Folk, Carols, Gospel, Chinese, the four eras in the order of
time, Jazz, Soul, Neo-Soul and `other`. The everyday songs come first on purpose: a new player's list still opens on the songs they
know, and the era chips stay the way into the classical repertoire; putting the eras first is one array. The heading is
`h3.songsec` (`.songsec-nm` in `--clay` orange `#d97757`, `.songsec-sub` the era's years and how many songs the section holds under
the filters now on); a chosen chip shows its one heading. The headings ride the sliced rendering (a section's heading is drawn with
its first card), so counting cards in a bot is still `.songgrid .songcard`. The `headings` bot section checks the order, the counts,
th/en/zh, favourites and the player's own songs. A piece's level (`diff`) is worked out by
`levelOf` in `build-songs.mjs` against the profile of the hand-made level-1 and level-2 songs (range, leaps, notes per second,
length): the app's own `estimateSongDifficulty` was made for short beginner tunes and rates nine real classical melodies in ten
level 3, so it is not used there; the level lock (`SONG_REQ`) then needs no per-song work. The random pickers that make a song
quiz or a quick session (`melody` in the ear quiz, `quickSongs`) skip `CLASSICAL_IDS` — obscure titles are no quiz — while the
daily song and "next song" draw from every open song. Several older hand-made classical songs are approximations of the real
tune rather than the score (Gymnopédie No. 1, Für Elise, the Raindrop Prelude, Air on the G String and others); they are kept
(players have stars on them), their score versions were left out so no work shows twice, and replacing one in place is the
owner's call.

**TIGA CHAT** (`use-chat.ts`, `chat-ui.tsx`, `chat-starters.ts`, the `.mov`
full-screen chat in `PianoApp`, `SenseiView.tsx`).

**TIGA CHAT that does something (owner, 2026-10-02: "ให้ใช้แล้วสนุกกว่านี้… มีความรู้สึกของเกมมากขึ้น" — plan 19).**
Three pieces, and the rule each one obeys: **`chat-coach.ts` (new) derives both the question and the action
from the answer text, with no extra model call** — a quiz that needed a second round-trip would make the
app slower and dearer for the one feature meant to make it better. `smoke-chat-coach.mjs` (46 checks) pins
it. **Docs:** plan + measured results are `tigamodel/docs/19-plan-chat-fun-and-teaching.md` (7 of its 8 phases are
shipped; phase 3, the hot-path switch, is **not** on — see below); `node scripts/measure-chat-cost.mjs`
re-measures what one question costs, and `eval-kb-capped-vs-legacy.mjs` must be **exit 0** before anyone
turns the hot-path switch on. The next round of this feature is
`tigamodel/docs/20-plan-chat-fun-megaton.md` (the chat as a *game*): five leaks measured from the shipped
code — **`chatProg.streak` is `profile.streak`, the app-wide PRACTICE streak, shown as if it were the
chat's own** (so a learner who asks for 10 days and never plays sees `🔥 0`), and `tg_chat_stats` stores only
`{d, asked, exp}` — no streak, no right-answer count, so there is nothing to build a game on yet;
answering an `AskRow` correctly calls `recordMemory()` and **nothing appears on screen**; `withAiCache`
is still never called from `use-chat.ts`; and the fixed prompt is **8,480 chars** per question against a
49,248 median and a 1,392,371 worst case. Read §6 of that doc before adding anything to the chat — it
lists the ten rules that plan must not break. **`21-plan-chat-teach-retrieval-speed.md` is the current round** — it answers
the owner's three questions (does chat actually use what TIGA Model learned? is it fast? does it teach?). The
measured answers: chat **does** pull the knowledge in — `hub.getFullKBContext()` /
`getStudentContextBlock()` / `getCoachContextBlock()` at `use-chat.ts:358-364` — but **only 3 of 4 layers**.
Layer 2 (owner-taught, `getLearnedKBContext`) returns `""` while `s.enabled` is false, and layer 4 is
discarded outright by `.filter(e => !e.strategy)` at `self-learner.js:182`. It is slow because retrieval
picks the **wrong** thing, not because it sends too much: `grep -cE "embedding|vector|cosine|similarity"`
over `web.js` + `use-chat.ts` returns **0** — there is no semantic search anywhere, matching is keyword-only
(`kbKeywordHit`), so one question draws **1,383,891 chars** and the next draws **1,427** — a ~990x spread on
one function. And the teaching loop **does not close**: `markUnderstood` records into memory and `.actbtn`
sends the learner off to practise, but nothing ever measures whether it worked
(`grep -c "accAfter|retest|verify_learned"` = 0), and `learnerSignal` has never entered the chat prompt at
all. Read §6 of that doc before adding anything to the chat — it lists the ten rules that plan must not break.
`askQuestionOf()` reads the tutor's own `[? question | wrong | wrong | ✓ right]` closing line, or builds
the check from octave-qualified note names **the tutor just wrote** (so the answer is a fact). **A check
that cannot be answered correctly is worse than no check**, so: fewer than 3 distinct `C4`-style notes → no
question; a bare `C` is ambiguous across octaves → never used; a repeated note is one note; a MALFORMED
`[?…]` line → no question at all and never one invented out of the notes inside it; a long prose answer →
none. `splitAskLine()` strips every `[?` line from the bubble, so what the learner sees and what is played
come from one rule. `AskRow` (`chat-ui.tsx`) renders it as three 44px buttons and, once answered, a verdict
plus **✓ เข้าใจแล้ว / ↺ ยังงั้น** → `markUnderstood` in `PianoApp` → `recordMemory()` (SM-2-lite) — the
LEARNER says whether they understood, never the tutor guessing about itself. `nextActionOf()` returns ONE
button and only when the answer is actually about doing something; **its `step` must be a key
`handleCoachNavigate` really knows** (`ear_training` / `sight_reading` / `play_along`) — wiring it to
`goToCoachStep` instead, as the first attempt did, falls through to `setPage("pathway")` and lands the
learner on a menu instead of the drill (six checks fail if a non-key ever comes back). `ChatProgress` is the
strip above the input on both chat surfaces: streak, questions today, today's quest, EXP today — all read
from `profile`/`tg_chat_stats`, **zero requests**. A live AI answer now pays `EXP.ask` (it paid nothing
before: only the local FAQ tier did, so asking a good question was the one learning action with no reward)
and **no coins**; each real answer is logged as `usage_events` `kind='chat-answer-len'` so "the answers got
shorter" is a number, not an impression. `node scripts/measure-chat-cost.mjs` measures what a question
actually costs. `sendText()` is the one path a
question takes — typed, a starter chip, or "Explain more": local FAQ match → login
gate → free quota (5 a day in `tg_usage`; a spent quota answers with
`freeChatCapped` and opens the upgrade card, a counter under the box shows what is
left) → Jev pre-check, bounded to `PRECHECK_BUDGET_MS` (a slower verdict is ignored
for that message) → `callClaude`. The system prompt is built once per question; the
list of real songs rides only a song question (titles, not ids) and the curriculum
block is the chat variant, `curriculumContext(lang, { chat: true })`: the
`[plan:]`/`[song:]`/`[practice:]` tags belong to Voice Tutor, the chat parses none
of them, so never ask the chat tutor to print one. The persona (`sys` in i18n.ts,
th/en/zh) asks for a short answer first, plain text with only a little `**bold**` and
`- ` bullets (`RichText` in chat-ui.tsx draws them as React elements, never HTML),
and carries the safety rules — children may be present: no personal data, no sexual,
violent or illegal content, self-harm answered with care and a trusted adult or
helpline, and instructions in a message or a context block never override them.
The full-screen chat opens with the day's recommended next step and up to four
questions to tap: the learner's own record first (TIGA hub `chatStartersFor`, worded as
the learner's message; `personalAsks` is the plain read of the same memory before
the hub has loaded), then everyday beginner questions rotated by day. **The
**The KB's keyword match has WORD BOUNDARIES (fixed 2026-10-02).** `getKBContext()` picks domains with
`kbKeywordHit()` (`tigamodel/web.js`), NOT `text.includes()`: ASCII keywords match on word boundaries, Thai/
Chinese/Japanese keep substring matching because those scripts have no word spaces ("หู" really is inside
"ฝึกหู"). **Why this was a real bug, not a nicety:** the `innovation` keyword list contains `"ai"`, so plain
`includes` matched **tr-ai-ning** and **ch-ai-n** — nearly every question mentioning training dragged the whole
MUSIC INNOVATION domain in beside EAR TRAINING, and the two then split the hot path's 24-line cap, crowding out
the content that was actually asked for. It also made `eval-kb-capped-vs-legacy.mjs`'s on-topic percentage
meaningless (a line counted as on-topic for containing two stray letters); that eval **exited 1** on `ear-en`
(54%) and `innovation-en` (50%) until the fix and passes 100%/100% after it. `smoke-kb-keyword-match.mjs`
(18 checks) pins it — **add a case there for any new KB keyword, especially a short one.** A keyword that can
appear inside another word costs real money: the domain it wrongly pulls in spends the capped block's budget.

knowledge block:** the chat sends the legacy KB block unless
`app_settings.tiga_kb_hot_path = {"enabled": true}` — a harmony question ships ~1.4 MB
with the switch off and at most 8,000 characters with it on. The switch is read at
most once a minute (`refreshKbHotPathSwitch`, fails closed) and the owner flips it
from Model Lab → Knowledge Base; do not flip it from code. Run
`node tigamodel/scripts/eval-kb-capped-vs-legacy.mjs` for the comparison — it measures
what the model is given, not how a model answers, so judge answers in Model Lab
with the switch off and on. The chat pays no coins or EXP for a live-AI question,
typed or tapped (only local FAQ answers and `askDirect` callers do); changing what
chat pays is an owner decision (see "Where Coins/Gems may come from").

**The chat's read-aloud button (owner, 2026-10-01: a speaker at the end of every bubble, "a soft, natural male voice, Thai,
English and Mandarin, Max and Max Family only, find the best voice at a low cost"). SUSPENDED — see the kill switch below.**

**Chat T2S kill switch (owner, 2026-10-02: "ปิดระบบ t2s ในฟีเจอร์ tiga chat ทั้งหมด ซ่อนไว้ก่อน เทคโนโลยียังไม่พร้อม").**
`CHAT_TTS_ENABLED = false` in `chat-ui.tsx` is the one switch; three read points obey it: `Msg`'s `canSpeak` (no `BubbleSpeak`
renders in any chat, so no speaker appears whatever the plan), `PianoApp`'s `speakMode` in App.tsx (returns `"off"`), and
`PricingOverlay`'s `prMaxSpk` bullet on the Max and Max Family cards (a plan must never advertise a switched-off feature).
`i18n.ts` keeps the `spk*`/`prMaxSpk` strings and `.bspk*` CSS in `app-styles.ts` stays — one `true` brings it all back.
The speech engine, the clip cache, the day's cloud allowance and the `piano-tts` edge function are untouched, and **Voice
Tutor (`use-voice-tutor.ts`, its own `TTS_RATE`) is a different feature and is not affected by this switch.** `BubbleSpeak` (`chat-ui.tsx`) sits at the
bottom-right end of every bubble, the learner's and the tutor's (`Msg` → `canSpeak`; not on a waiting or failed answer), on the
full-screen chat and the Sensei page alike. `speakMode` is worked out in `PianoApp`: `"on"` for Max, Max Family and the owner's
admin account, `"locked"` for everyone else — the button shows a small lock and a tap opens the plans (`prMaxSpk` is a bullet
of both Max cards). It speaks in the language the message is written in (`detectSpeechLang`: Thai wins over a few English
terms), through `speakCloud` → `piano-tts` with `src:"chat"` and the Voice Tutor's male voices (`VM_VOICES`, default Algieba).
**Speed and reading all of it (owner, 2026-10-02: "it reads slowly and doesn't finish the whole chat", then, from a phone
screenshot: "อ่านไปประมาณสองบรรทัดแล้วหยุด" — and "กดปุ๊บแล้วมาเลย").** A long tutor answer is cut into chunks by
`ttsChunks` (`speech.ts`) and fetched one at a time. **Short sentences are PACKED into one chunk** (`TTS_CHUNK_CHARS` = 700),
not one request each — that used to turn a ten-sentence answer into ten synthesised clips with the global 1.2s request gap
between them, which is what made a tap feel slow and is also what ran into the provider's rate limit part-way through a
message. The measured effect on the answer in that screenshot (575 chars): **6 requests → 2**; on a twice-longer one
(1,151 chars): **12 → 3**. The **first** chunk is the exception and stays a single sentence (`TTS_FIRST_CHUNK_CHARS` = 240
is its ceiling), because that is the clip the learner waits for and the shortest real one is the fastest. Each later chunk is
prefetched while the previous plays. The chat speaks at `CHAT_TTS_RATE` = 1.15 (Voice Tutor keeps `TTS_RATE`), which is
also what `BubbleSpeak` plays at. **The day's allowance is charged once for the whole message, not per chunk**
(`speakCloud`'s `msgOpts.charged`): if the whole message will not fit, nothing cloud-based starts and the device's own voice
reads the entire message — the old code ran out mid-answer and stopped.

**Nothing in that loop may wait forever.** Two silent stalls used to end a reading two lines in, with no error on screen:
`await`ing a chunk promise with no ceiling (a hung fetch, or an IndexedDB read that never answers), and waiting only on
`onended`, which a phone never fires when it takes audio focus and suspends the AudioContext. Both now have a watchdog
(`withTimeout` / `TTS_CHUNK_WAIT_MS`, and a per-clip watchdog sized off the decoded buffer's real duration). **And a chunk
that fails mid-message no longer `break`s** — it hands the unread remainder to the caller as `error.rest`, and
`BubbleSpeak` reads exactly that with the device voice, so the message always finishes and nothing already read is read
twice. A message is therefore always read to the end, by the cloud or by the phone. On the server the two `await`s in
`piano-tts` (`chatVoiceAllowed` and `resolveTtsConfig`) became one `Promise.all`, saving a round trip — that file is
still **not deployed**, so production still pays it. What keeps it cheap: a clip heard before comes from the local cache and costs nothing; each device has a day's allowance of
cloud speech (`TTS_DAILY_SECONDS` = 5 minutes, `ttsBudgetSpend` / `ttsBudgetRefund`, counted in estimated seconds, key
`tg_tts_day`); past it, or when the cloud fails, the device's own voice reads the message — a tap is never silent — and a short
note says why. `speakCloud` numbers its calls (`_ttsRun`) so an older call that is still fetching can never play over a newer
one: `node scripts/verify-speech.mjs` runs the real `speech.ts` against a fake audio context and a fake `piano-tts` to prove it,
and `ONLY=speak node scripts/verify-chat.mjs` covers the button in a browser (locked / unlocked, one at a time, stop, cache,
allowance, fallback). The engine and model are the admin's choice (AI Models → voice-tts; Gemini speech models have their own
shelf, `GEMINI_TTS_MODELS`, never the chat models). The server half of the rule — `piano-tts` checking the caller's plan for
`src:"chat"` and using full BCP-47 language tags — is written in `supabase/functions/piano-tts/index.ts` but **not deployed**
(hard rules: a function deploy needs the owner's approval); until then the lock in the client is the only gate, as it is for the
Voice Tutor.

**Growth, measurement and the first minutes (owner, 2026-10-02: "fix every problem in the users report").** What is
in the code, and what it replaced:

- **Where a visit came from.** `local-identity.ts` (imports nothing, shared by the landing and the app) writes ONE
  `usage_events` row per device, kind `attr`, `item_id` `first;s=fb;c=<utm_campaign>;t=<utm_term, the ad set>;k=<utm_content,
  the creative>;v=<variant>;lg=th;tz=Asia/Bangkok;nl=th-TH;oua=<in-app browser it escaped from>` (`attributionEvent`), and a
  `touch;…` row when a later visit carries different tags. Click ids (`fbclid`…) are kept as presence only. No column was added:
  the table has none and a column needs a migration. The ad-link recipe is in the admin card (Meta: `utm_source=fb&utm_medium=paid&
  utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}`, plus `&v=b` for the landing variant).
- **The escape from an in-app browser carries the person.** 79% of visitors open the page inside Facebook's/Instagram's own
  browser and sign up at 0.12% against 2.2% elsewhere; the "open in your browser" jump used to lose them (new storage = a
  stranger with source "direct"). `handoffUrl()` adds `hid` (anon id), `hat` (minute), `hsrc`, `hua` (browser kind) — and `hlg`,
  `hvia=mail` for a magic-link e-mail, which is opened later and usually in the mail app's own browser; `adoptHandoff()` runs in
  `landing-main.tsx` and `main.tsx` BEFORE anything reads the anon id, adopts it only when the browser has none and the link is
  fresh (30 min; 24 h for mail), stamps the landing language for a mail link, and strips the fields from the address bar. The
  landing logs `escape:arrived[-known]:<browser>`; the app logs the real provider (`signup:google` / `signup:email-link`, it was
  hard-coded `signup:google` for every landing sign-up).
- **Admin funnel by campaign / ad set / creative / browser / variant / language / region / escape:** `AdminCampaignFunnel.tsx`
  (loads on request, pages `usage_events` by id, no RPC) over the pure `campaign-funnel.ts`. A visitor's browser is the one on
  their FIRST row. `node scripts/verify-campaign-funnel.mjs` tests the real maths and the real handoff code;
  `node scripts/verify-landing-attribution.mjs` drives the built landing in Chromium (tags, variant, escape link, mail link).
- **Landing fixes that were bugs, not opinions.** The full-screen "open Chrome" overlay inside a webview could never be closed
  (`escapeFull` was set and never read) and the sign-up card behind it opened on the LONGEST form: 53 in-app visitors reached it in
  30 days and none tried the e-mail form. The overlay is now gated by `escapeFull`, the card opens on the one-field e-mail link
  everywhere, and inside a webview its Google button is the honest "needs your real browser" way out (Google answers a webview
  with `disallowed_useragent`; 32 visitors a month tapped it). The trial promise now says SEVEN DAYS (`TRIAL_DAYS_STANDARD` is 7 for
  everyone; the page had said 7 with "first 100 only", then 30 for everyone, and is now 7 again with the cap raised to 10,000). `?v=b` serves ONE alternative first screen (outcome headline, keys lighting by
  themselves until the first touch, a "play your first song" button into `/?song=twinkle`); `?v=c` is the same without the new
  words; no tag is the page as it was. The variant sticks to the device (`landingVariant`) and rides the `attr` row.
- **First minutes in the app.** `?song=<id>` opens that song's ready screen (`PianoApp`; unknown or still-locked ids land on the
  list); the song pages below link to it. Until a first Play Along star exists the Pathway page shows ONE inline "play your first
  song" offer — never a popup (the owner shut the first-run welcome card: two popups before the first key were a churn risk);
  its taps are `nav` rows `pathway-firstsong[:shown|:closed]`. The guest gate (`app-shell.tsx`) has the one-field "e-mail me a
  link" form at its top (`MagicLinkForm`) above the long forms. The result of a song may offer "remind me tomorrow" (push, reusing
  `joinNotifEvent` and its one-time reward, signed-in players only) and, when `LINE_OA_URL` in `shared-infra.ts` is filled in, an
  "add us on LINE" link — it is EMPTY because the LINE channel does not exist yet. Settings has an unticked, optional "e-mail me
  news and the daily song" switch writing `profiles.marketing_consent` + `_at`.
- **Promotion: the first 10,000 signups get 7 days of MAX (owner, 2026-10-04).** A growth play, not a pricing change: Max is the
  uncapped-AI tier and the most expensive thing to give away (voice teacher, Priority AI, exclusive pieces, Daily Mentor, 4 Streak
  Freezes a month), so it goes to the first 10,000 accounts to put the 11,000-song library in front of as many people as possible
  and let word of mouth carry the rest. Everyone AFTER the cap gets the same seven days at ⭐Premium.
  The LENGTH is one number (`TRIAL_DAYS_FOUNDING` = `TRIAL_DAYS_STANDARD` = 7); the TIER is the split. There are now two trial plan
  strings, not a flag on one: `"trial"` (Premium) and `TRIAL_MAX` = `"trialmax"` (the promotion cohort), chosen by the single function
  `promoTrialPlan(p)` — the only line that decides who gets Max. `isMaxPlan()` accepts `TRIAL_MAX` and deliberately NOT plain
  `"trial"`; collapsing them would hand Max to every signup forever. **Anything asking "are they inside a trial?" must use
  `isTrialPlan(plan)`**, true for both — the old inline `plan === "trial"` was replaced across `App.tsx`, `PricingOverlay.tsx` and
  `use-conversion.ts`, because a leftover would have silently skipped the whole sales funnel for the first 10,000 (Max access, no
  pitch). The cohort is `profiles.founding_member`, a plain boolean set ONCE at signup by the `handle_new_user()` trigger — a FIXED
  set of accounts, not computed on read, so deleting a row can never re-open the promotion. `PROMO_MAX_USERS` in `payment.tsx` and the
  `< 10000` count inside the trigger are THE SAME NUMBER IN TWO PLACES; change both in one release.
  `scripts/verify-promo-max.mjs` (28 assertions; `npm run verify:promo`) drives the real `payment.tsx` and asserts the two cohorts
  have genuinely different entitlements — that failure mode is silent in both directions, so it is checked directly.
- **The conversion ladder was re-cut to a week (owner, 2026-10-04).** Welcome d1–3, first-week proof d5–6, last-day closing **on d7
  itself** (it fired the day *before* under the 30-day ladder, which on a 7-day trial was already d6), then win-back once expired.
  The closing copy is the owner's wording and quotes the real Max price — it used to say 1,490฿, which is the ⭐Premium price, so the
  funnel was offering a cheaper upgrade than the Max it was giving away. `scripts/verify-conversion.mjs` asserts all of this and reads
  the trial length out of `payment.tsx` itself.
- **Landing copy deliberately names NO tier (owner decision, 2026-10-04).** `landing/landing-copy.ts` (`sticky`, `trialLine`) says
  only "free trial 7 days" and never says Max, never says Premium, and never mentions the 10,000 cap. That is deliberate and it is the
  only wording that stays TRUE on both sides of the cap — an earlier draft said "Max free 7 days", which was accurate at ~70 signups
  and would have started lying at signup 10,001. **Do not add a "first 10,000 only!" scarcity line** — the owner was asked and chose
  not to advertise the cap. The tier IS named where it is verifiably true: inside the app, where `convCopyFor(lang, plan)` reads the
  member's actual plan.
- **Funnel copy is generated from the tier, from PLAN_PRICE (owner decision, 2026-10-04).** `use-conversion.ts` has ONE copy builder
  (`copyTable`) instantiated twice — `CONV_COPY` (promo cohort: Max, ฿3,999) and `STANDARD_COPY` (post-cap: Premium, ฿1,490). Every
  price is interpolated from `PLAN_PRICE`, the object checkout charges from; no price is typed as a literal anywhere. That is the fix
  for a real bug: the previous build hard-coded 3,999฿ in eight places and quoted 1,490฿ elsewhere in the same funnel, so the
  messages and the checkout disagreed about what was being sold. `convCheckoutTier(plan)` picks the tier the closing CTA opens —
  hardcoding "max" would send a post-cap member to a plan page for something they never had. `personalizedBody(..., plan)` takes the
  same plan and prices its personal stats with it. `verify-conversion.mjs` asserts, per language and per tier, that each table names
  its own tier, quotes its own price, and NEVER contains the other tier's price.
- **Three migrations are written and NONE IS APPLIED — the owner must run them, in the Supabase SQL editor, after review.**
  (1) `supabase-promo-max-10000-migration.sql` — raises the trigger cap 100 → 10,000 and marks every current signup as a promotion
  member (the ~70 existing members count as part of the 10,000, per the owner). Read its STEP 0 first: it grants to every eligible
  row, so confirm the count before running STEP 1. (2) `supabase-grant-max-one-year-migration.sql` — gives those same members Max for
  a YEAR, stored in `profiles.plan` / `plan_until`; skips admins (they already resolve to maxfamily, so writing `max` would
  downgrade them), skips banned, skips anyone with a live subscription, and is re-runnable (second run = `UPDATE 0`). They compose
  cleanly — `effectivePlan()` tests a live paid plan BEFORE the trial — so approving one alone is still correct, it just gives less
  than the owner asked for. The trial alone could do neither job: trial length is measured from `profiles.created_at`, so every
  pre-existing account is past day 7 the moment the new rule lands.
  (3) `supabase-grant-pro-7-days-migration.sql` — owner 2026-10-05: Pro for 7 DAYS to everyone in the app who does not already
  have it, where Pro is the existing Premium plan. It writes `plan='premium'` (the canonical string, never a legacy `max`/`family`)
  plus `plan_until = now() + interval '7 days'`. Its WHERE clause is a deliberate mirror of `effectivePlan()` rather than a second
  set of rules: skips admins (both `is_admin` and `admin_tier > 0`, because the admin console derives admin from the tier and an
  `admin_tier`-only admin must not be handed an expiring row), skips banned, skips every ACTIVE paid row including the legacy
  strings ("คนที่ได้อยู่แล้วไม่ต้องไปทำอะไร"), and skips members still inside their trial — the owner ruled "ไม่นับ ให้ทดลอง 7 วัน
  ตามเดิม", which also keeps `isTrialPlan()` true so their countdown UI survives. Lapsed subscribers ARE included: `effectivePlan()`
  already calls them free. If (2) was already run, its rows read as active paid and (3) skips every one of them. `npm run
  verify:progrant` (`scripts/smoke-pro-grant.mjs`) is the guard: it loads the REAL `payment.tsx`, runs the real `effectivePlan()`
  over a fixture of admins/banned/active-legacy/lapsed/in-trial profiles, and fails if the SQL's WHERE clause disagrees about who
  already has Pro — plus it pins the 7 days to `TRIAL_DAYS_STANDARD` so the grant and the trial cannot drift apart. Its checks read
  the SQL with comments stripped and only up to the statement's first `;`, because a text match over the whole file is satisfiable by
  the migration's own prose and by its verification queries. None of these files is applied automatically:
  `scripts/apply-migrations.mjs` runs three NAMED migrations, never a glob.
- **Not applied / not deployed (hard rules).** `supabase/functions/return-reminders/index.ts` and
  `supabase-return-reminders-migration.sql`: day 1/3/7 push nudges to people with a push subscription who have not been back,
  off by default (`app_settings.return_reminders.enabled`), cron block commented. LINE and e-mail are not wired (no channel token,
  no e-mail provider). The weekly parent e-mail report needs an e-mail provider first.
- **Song pages for search.** `node scripts/build-song-pages.mjs` (run by `npm run build`) writes one static page per song in th/en/zh
  (`songs/<lang>/<id>.html`, no JavaScript, hreflang, a link into `/?song=<id>`), a song index per language, `sitemap.xml` and
  `robots.txt` (there were none). A page's file name is the song's id with accents folded away (`gymnopedié` → `gymnopedie.html`,
  `slugOf`: a sitemap wants plain ASCII); `?song=<id>` keeps the real id. Classical pages leave the note names off: the app plays a piece in its own, often transposed,
  key. Every page names `og-card.png` as its share image, and `npm run build` now copies `public/og-card.png` to the site root — it
  never was, so the landing pages' link preview (the og:image they have named since the card was made) was a 404 on the live site. `SITE_URL=… node scripts/build-song-pages.mjs` re-points everything the day the site moves to its own domain.
- **Daily Mentor's recommendations open with a violet tab (owner, 2026-10-02: "they take it for plain text, though it comes from
  advanced AI — make it a prominent tab, like the purple button: Generate โดย AI เพื่อคุณโดยเฉพาะ").** `.mentai` / `.mentai-tab`
  (`CoachPage` in App.tsx, styles in app-styles.ts): the gradient of the "Go to Challenging" button, a sparkle, "Generated by AI, just
  for you" over "Recommendations from TIGA AI" (th/en/zh), an "AI" chip, a slow sheen that reduced motion switches off. A label, not a
  button. For the record, the list under it is computed on the device from the practice log (`computeCoachStats` → `weakest`, miss rate
  per topic); what a model writes on that page is the weekly report and the 7-day plan further down — if the wording is ever
  challenged, that is the line to look at. The `mentor` bot section covers the tab (three languages, narrow phones, dark theme,
  reduced motion).
- **The song list is drawn in slices** (60 cards, 120 more when its end comes near; `.songmore` is the sentinel) so a chip switch
  does not build 1,067 cards. Bots that count or look for a card past the first screen call `expandList()` first. The classical
  library is NOT lazy-loaded: 40+ places read `SONGS` synchronously (the daily song would re-pick if its saved id were not there
  yet), so that is a careful change of its own, not a quick win.

Robot and pet **thumbnails are pre-rendered images**, not live SVG:
`scripts/bake-sprites.mjs` (`npm run sprites`) draws every robot head
(`CyberAvatar headOnly`) and every level-1 pet (`PetArt`) from the real
components in headless Chromium and writes content-hashed WebPs to
`public/sprites/` plus the generated `sprites-manifest.ts`. `sprite.tsx`
(`<Sprite>`, and the `HeadThumb`/`PetThumb` wrappers exported from
`cyber-avatar.tsx`/`pet-lab.tsx`) shows them and falls back to the live
drawing when an image is missing. **After changing robot or pet artwork —
the drawing code or its `.ca-*`/`.pa-*` CSS — run `npm run sprites` and
commit `public/sprites/` + `sprites-manifest.ts` with it**, or thumbnails
keep showing the old drawing (`npm run build` prints a warning listing any
stale sprite; it never fails the build). Baking needs Playwright + Chromium,
which the cloud containers have preinstalled; it is not a dependency of the
app. Big live figures (character page, arena, pet room) stay live SVG.
The bake also gives each still a finishing pass the live SVG cannot afford
(rim light, under-shading, bloom — `FX` in the script).
`node scripts/bake-sprites.mjs --out=DIR` draws a preview into DIR without
touching the shipped sprites (`--raw` leaves the finishing pass out).
In a fight on a touch device ("lite"), the fighters and the pet are shown as
pictures too, but these are made **on the device** (`figure-cache.tsx`): each
pose is rendered once from the live component, rasterised, kept in Cache
Storage and swapped in by `<FigurePic>`, with the live SVG as the fallback.
The lobby makes the player's poses, the fight only the opponent's, and never
while a round is live (`pauseFigures`). Stored pictures are keyed by `__ART__`,
a build-time fingerprint of the art files (vite.config.ts), so art changes
invalidate them automatically — no manual step, unlike the sprites.

Backend: Supabase (Postgres + Auth + Storage + RLS), project id
`gsaqgbracxnucdmtmcxz`. Schema/RPC changes live as `supabase-*.sql` files
at the repo root, one file per feature (e.g.
`supabase-currency-purchase-migration.sql`) — write additive, re-runnable
SQL (`if not exists`/`or replace`) matching the style of the existing files,
and see "Hard rules" above before applying any of it.

## Hard rules

- **Never apply a SQL migration or deploy an edge function to the live
  Supabase project without the human owner's explicit, per-migration
  approval in the current conversation.** Write the migration as a
  `supabase-*.sql` file, explain what it does and why, and wait to be told
  to run it. This holds even under broad "just get it all done"-style
  instructions — schema/RPC changes to a database with real users and real
  payment records are exactly the class of hard-to-reverse, shared-system
  action that stays a human decision. (Applying is fine once the owner has
  actually said so for that specific migration — this isn't a ban on ever
  touching the database, just on doing it unprompted.)
- **Never commit real Stripe keys, service-role keys, or other secrets.**
  None currently live in this repo; keep it that way.
- Don't invent a payment/checkout mechanism from scratch if an equivalent
  one already exists — `CheckoutModal`/`SchoolCheckoutModal` in
  `payment.tsx` are one PromptPay/Alipay/WeChat slip-upload pattern reused
  twice; a new payment surface should reuse it, not reinvent it.
- **Never sell in-game currency.** The owner removed every Coins/Gems
  top-up on 2026-09-25 for legal reasons: `BuyCurrencyModal`, the shop and
  profile buy buttons, the "top up gems" popup action, the parent PIN /
  spend cap that only guarded those purchases, and the `?coins_paid=`
  return handler are all gone, and `supabase-close-currency-topup-migration.sql`
  closes the server side. Don't add any way to buy Coins, Gems or any other
  in-game currency with real money unless the owner explicitly asks for it
  in the current conversation. Premium/School plan payments are unaffected.
- **Where Coins/Gems may come from (owner rule, 2026-09-25):** only from
  playing or learning (practice, songs, lessons, quizzes, PvP, Prestige…),
  from an admin granting them (admin tools, admin-run events), and the one
  exception, the one-time notification-opt-in reward. Nothing else: no
  paid-plan multipliers (the Max plan's ×2 coins was removed for this), and
  no rewards for merely opening the app. The daily gift chest therefore
  unlocks only after a practice session has been finished that day
  (`chestAvailable()` in `App.tsx`). The Max plan's 4 free Streak Freezes a
  month are an item, not currency, and the owner chose to keep them
  (2026-09-25) — leave them in.
- Client-writable absolute values for `exp`/`coins`/`gems`/`admin_tier`/
  `plan` are a known-bad pattern this codebase has explicitly hardened
  against (delta-clamp + column-protection triggers on `profiles`). Any new
  RPC that credits currency must be additive (`coins = coins + amount`) and
  gated server-side, never trust a client-supplied final value.

## Git workflow

Two long-lived integration points: the dev branch in use for a given work
session, and `main` (auto-deployed to production via GitHub Pages on every
push). The pattern used throughout this project's history: commit to your
dev branch → push → `git checkout main` → fast-forward from
`origin/main` → `git merge --no-ff <dev-branch>` → `npm run build` to
confirm a clean, zero-drift merge → push `main` → return to the dev branch.
`main` also receives unrelated commits from the separate `studio/`/`bos/`
deploy process — those show up as pre-merge fast-forwards and are expected,
not a conflict.

**Handoff between agents (e.g. Codebuff picking up when a Claude Code
session runs out of usage) is sequential, not concurrent** — one agent
stops, another continues the same work, normally on the *same* dev branch
rather than starting a fresh one. There's no live channel between sessions
(no shared chat, no lock file), so before continuing:
- `git branch -a` and `git log --oneline -30` on the most recently active
  non-`main` branch — that's almost certainly the one to keep working on.
  Commit messages in this project describe intent, not just the diff, so
  read a few back to understand what's actually in progress.
- `git status` — check for uncommitted changes the previous session left
  mid-task. Investigate unfamiliar state before touching it; don't discard
  it (no `git checkout -- .`/`git reset --hard`/etc. without first
  understanding what would be lost).
- Finish whatever was in flight before starting something new, using the
  same commit → push → merge-to-`main` → build-verify → push pattern
  described above.

The only scenario needing a *separate* branch is genuinely simultaneous
work by two agents at the same time — rare, but if it happens, don't push
directly to a branch the other session is actively using, and don't merge
to `main` while the other agent's work is uncommitted elsewhere.

### Hook order is checked by the build, not by reading
`npm run build` runs `scripts/check-hook-order.mjs` (`npm run verify:hooks`) before
vite, and fails on any hook called conditionally or after a return. This is not
theoretical: two such bugs shipped to `tigaalpha.github.io` on 2026-10-05 and
crashed the whole app with `Error: Minified React error #310` — "Rendered more
hooks than during the previous render". The ErrorBoundary showed the user only
three frames, all inside react-dom (`updateWorkInProgressHook` → `useReducer` →
`useState`), so the stack never named the component and the production bundle
could not be searched for it.

The two that were real: `AdminStudents` in `App.tsx` had `useState`/`useEffect`
inside `if (sel) { … }`, so opening a student in the admin screen took the hook
count from 0 to 2; `Outline` in `tigamodel-lab-graph.tsx` had
`if (!S) return null` *above* two `useMemo` calls. Fixing either means moving
the hooks above the guard or splitting the guarded half into its own component —
never deleting the effect.

So: every hook runs on every render. Guard the *rendering* (`if (sel) return …`),
not the hook. A hook behind `&&`, `?:`, a loop, a switch case, or after any
`return` in the same function is a production crash waiting for the account
state that reaches it — the crash test (`smoke-app-boot.mjs`) cannot see it,
because it never signs in as an admin.

## Testing

No committed unit-test suite and no CI test job. Verification for this
project has meant: `npm run build` (necessary, not sufficient — see the
TypeScript note above), then a real browser pass — Playwright driving a
local static server against `dist/`, clicking through the actual affected
flow. For shared logic that's hard to exercise through the UI (timeout
behavior, cache logic, class lifecycle methods), transpiling the real
source file with esbuild's JS API and `import()`-ing the actual exported
function/class (rather than a hand-mirrored copy) gives much higher
confidence than unit-testing a reimplementation. Native-only features
(Voice Tutor's speech recognition, MIDI/mic pitch detection, camera hand-
tracking) are structurally unreachable in a headless/web context — a green
build there proves the rest of the app still works, nothing about the
native behavior itself; those need a human on a real device.

For Play Along: `node scripts/verify-playalong.mjs` checks the scoring and
daily-quest rules from the real modules (needs jsdom, see the script), and
`npm run build && node scripts/verify-playalong-bots.mjs` plays real songs
in `dist/` with bots — mashing, clean and early runs, the practice loop,
the daily song, concerts, pause, the first-time intro, the song list, the
sliding staff, medals and the run-coin limit, practice mode, the band and
the backing-track / metronome choice, the ready screen's theme and settings, the
stage, the sheet view (no falling notes, the staff on the keys, the neon-blue lit key
and the light that runs to it on all three keyboards), the running light in every mode
(`light`: falling/sheet × backing/metronome × each hand × practice) (`ONLY=name,…` runs a subset). `node scripts/verify-playalong-band-audio.mjs`
renders the band offline (Chromium's OfflineAudioContext, no speakers needed) and
checks its levels, layering, finale and mic blacklist.
`node scripts/verify-playalong-mic-band.mjs` runs the real band, the real sound
functions and the real detector on such a context with a phone speaker in front
of a microphone that also hears a synthetic piano, and checks that no wrong key
is ever read (pianist with the band or the metronome, tapper with the full band)
and that a drowned note is not fired twice — the test to run after touching any
game sound, the band's drums, or `createMonoDetector`. The app exposes
`window.__paTest` for it only when `localStorage.tg_pa_testhook` is "1".

For the learning-data wire (what turns a practice session into the rows
`learning_*`, `learner_skill_state` and the honest dashboard numbers read):
`node scripts/check-learning-wire.mjs` queries the LIVE DB read-only and says
whether anything lands and whether the 8 client RPCs still exist with the
argument names the client sends — it **skips (🟡, exit 0) rather than fails when the DB or the
Supabase CLI is not reachable**, because plan-check turns a non-zero exit into a red milestone and a
machine that cannot reach the DB has not proven anything is broken; `node tigamodel/scripts/smoke-learning-wire.mjs`
covers the gate itself. Both are wired into `plan-check` / `npm run verify:tiga`.
The gate lives in `learning-session-gate.ts` because it has to be testable
without a network: "unknown auth state → attempt the write and let RLS decide,
known signed-out → don't write and drop the queue". An earlier version asked
`sb.auth._sessionReady()`, which does not exist in supabase-js 2.x, so every
gated write returned early and the tables stayed at 0 rows for a month without
an error — never write a probe against an API that isn't there.

**One mentor loop (docs/18).** `learner-signal.ts` is the single decision
unit: Daily Mentor's top card and the Auto Teaching popup both read
`learnerSignal()` for "what to practise now", so they cannot answer differently.
It is pure (no localStorage, no network) so `tigamodel/scripts/smoke-learner-signal.mjs`
can pin the honesty rules with fixtures (39 checks): no data → `nextAction: null`,
fewer than 8 attempts → skill score `null` (never 0), fewer than 4 attempts → not
a weak spot, `confidence < 0.5` never moves a drill level, input order irrelevant.
The card shows one answer with real numbers and one button (`goToCoachStep` →
`resolveCoachStep`); everything else on that page lives under a "see more"
`<details>` — don't add boxes above the fold, and never render an object's
`{th,en,zh}` raw into JSX (React #31: use `tr()`).
The popup carries the same decision (`obj.decisionId`) and won't repeat it
inside 24h. It also never appears on top of a game in progress (owner
2026-10-02: it interrupted Play Along and PvP): `atipDelivery()` in
learner-signal.ts returns `defer` while a song is open or the learner is on
the arena/games page, the pending tip is remembered, and it fires once ~0.9 s
after the activity ends (not over the result screen); the free allowance is 2 tips/day (owner's decision 2026-10-02),
after which it shows one line pointing at the plan. Before/after is measured
per intervention id (`learning_intervene` returns the uuid → `openAdvice` stores
it → `recordFollowUpPractice`), and the proof line only renders when there is a
real measured delta. Separately, `activity-trace.ts` decides which act-log rows
from ear/reading/drills become real traces (≥5 attempts, one skill per day, ≤8
a day — 21 checks) behind the owner switch `tiga_activity_trace`, default OFF.
Never turn that switch on from code.

For the Mentor card (docs/18 §P2): `npm run build && node scripts/verify-mentor-card.mjs`
drives the real `dist/` in headless Chromium — the card says what/how long/why,
one tap lands in the thing it names, no data gives an honest "not enough yet"
card, all three languages render, the old cards are still there under "See more",
and React #31 is asserted absent. It exits 1 with "this check did NOT run" when
Playwright/Chromium are missing (as they are in some containers) — that is not a
pass, so never report the browser pass from there. `ONLY=card,nodevice` runs a
subset.

For the chat: `npm run build && node scripts/verify-chat.mjs` drives the real `dist/`
in headless Chromium with every Supabase call stubbed (nothing is written, no model
is called) and checks the screens (counter, capped message and upgrade card,
starters, bold/bullets, Explain more, th/en/zh), the exact request sent to
`piano-chat` (what is in the system prompt and how big it is, how long a slow Jev
holds the answer back) and the paths that must not move (local answers, chapters,
errors with a retry button); `ONLY=quota,starters` runs a subset. It cannot say how
a real model answers. `node tigamodel/scripts/smoke-kb-hot-path-switch.mjs` covers
the knowledge-block switch (it temporarily stubs `supabase-client.ts` and restores
it — check `git diff supabase-client.ts` is empty if a run was killed).
`node scripts/verify-speech.mjs` checks the speech engine under the chat's read-aloud (see above) with no browser —
41 checks, including the chunk packing and sizes, the single charge per message, the rate actually played, a chunk failing
mid-message (the rest is handed on, nothing is read twice) and a clip whose `onended` never arrives.

For the growth instrumentation: `node scripts/verify-campaign-funnel.mjs` (no browser) and, after `npm run build`,
`node scripts/verify-landing-attribution.mjs` (Chromium, every Supabase call stubbed).

For the song catalogue: `npm run songs:check` runs the whole read-only side — `verify-songs.mjs` on the classical pieces (form, key, range, public-domain limits, no tune
twice or already in the app), `verify-originals.mjs songs-src/originals` on our own ten thousand (bars, range, key, measured level, titles, no two tunes alike) and both
`--check` builders. Individually: `node scripts/verify-songs.mjs songs-src/classical` (form, key, range, public-domain limits, no tune
twice or already in the app) and `node scripts/build-songs.mjs --check` (the generated `songs-classical.ts` matches its source),
then the `list`, `eras` (more than 1,000 songs, the four era chips and their notes) and `classical` (real scores played to 3 stars:
a slow 3/4, a pickup, fast sixteenths, a song, three art songs from the OpenScore Lieder) sections of
`scripts/verify-playalong-bots.mjs` for the song list in a browser (add `headings` for the orange section headings and `mentor` for the
Daily Mentor tab). The song list is drawn in slices (see "Growth, measurement and the first minutes"): drawing every one of the 1,067 cards
used to cost a chip switch 20–120 ms on a desktop and up to ~0.5 s with the CPU slowed 4–6×, so keep a card cheap (`content-visibility:auto`
does the rest) and keep new per-card work out of the first slice.

## Where to look for current state

`git log --oneline -30` on the dev branch you're using is the most
reliable record of what's recently changed and why (commit messages in
this project describe intent, not just the diff). `MOBILE_BUILD.md` covers
the Android/iOS native build and release process in detail.

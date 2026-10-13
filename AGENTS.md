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
- **Promotion cap: APPLIED 2026-10-13, in a corrected form.** The live `handle_new_user()` trigger now has the cap `< 10000` and keeps the PDPA / marketing-consent columns (checked read-only). Do NOT re-run `supabase-promo-max-10000-migration.sql` as written: its function body predates the consent columns and would drop them. The other two migrations below are still not applied (live: 49 `premium` rows already expired, 17 active `max`).
- **Two of the three migrations below are still not applied — the owner must run them, in the Supabase SQL editor, after review (the promo-cap one above is done).**
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
- **Ads: on hold (owner, 2026-10-02: "don't do anything about ads yet, park it").** A Google AdSense plan exists as a document (where
  banners could go, what they would cost in returning players, the gates to pass first); the owner asked for the plan only and then put
  it aside. There is no ad script, ad slot, ad consent banner or AdSense account wiring in the repo, and none is to be added until the
  owner says so in the current conversation.
- **TIGA CHAT's knowledge block has a ceiling even with the switch off (2026-10-09, "it does not answer or answers badly").** The
  legacy block put every teaching line of up to four matched domains into the system prompt: a chord, scale or key question
  shipped 50 kB–1.4 MB, far past the context window of the free models the chat runs on (`app_settings.ai_models.chat` is
  `nvidia/nemotron-3-super-120b-a12b:free`; there is no Anthropic key on the project), so every rung of `piano-chat`'s ladder failed
  and the learner got the error bubble. `getKBContext` (`tigamodel/web.js`) now cuts any block above 24 lines / 8,000 characters to
  the lines sharing the most words with the question, in their original order; a block that already fits is untouched. The hot-path
  switch still chooses the smarter selector — flipping it stays the owner's call. Server-side, the free ladder in
  `supabase/functions/piano-chat` still lists `nex-agi/nex-n2.5-pro:free`, which OpenRouter retired (404 in the `landing-chat` logs):
  harmless (the chain hops) but one wasted round trip per reply; fixing it is a function deploy, so it waits for approval.
- **Coaching tips never land mid-game (owner, 2026-10-09: "Auto Teaching popup must not interrupt Play Along or PvP — show it when
  the activity ends").** `fetchAutoTeachTip` (App.tsx) keeps a tip it generates while a Play Along song is open and not yet at its
  result screen, or a PvP fight is live (`PvpPage` announces it with the `tiga:pvp-fight` window event), in `pendingTipRef`; when the
  activity ends the tip is shown ~1.8 s later through `showAutoTeachTip` (which also does the logging, so a held tip is counted once,
  when it is seen).
- **Premium interface ("AX" series, `ux2.ts`, `ux2-styles.ts`, `tab-bar.tsx`, `ux-icons.tsx`).** Everything is under the class `ux2`
  on the app root and ships behind one switch: on for the admin account, `/?ux=2` turns it on for a device, `/?ux=0` off. Making it
  the default for everyone is the last line of `uxEnabled`, an owner decision. It adds a bottom tab bar (Learn / Practice / Teacher /
  Arena / Me; the ☰ drawer stays), Lucide line icons in place of chrome emoji (`<Ico>`, `<Chev>`), motion and touch rules (page
  rise, card stagger, press spring, sheet slide, no sticky hover on touch, reduced motion honoured), large left-aligned titles and a
  segmented language control.
- **Automatic model switching in `piano-chat` (owner, 2026-10-09: "when Nemotron hits its limit, switch to Gemini 2.5 Flash by itself, and
  come back when it recovers; keep the manual switch in Admin").** `providerChain` (supabase/functions/piano-chat/index.ts): a FREE
  OpenRouter primary is followed by Gemini 2.5 Flash first, then the rest of the free ladder; the paid rung stays out. A route that
  answers 429 (or 404 = retired) goes on a cooldown in the isolate's memory (90 s for a free rung, 10 min for Gemini whose free tier is
  capped per day, 1 h for a retired route) and is left out of the chain until it ends — that is both the switch and the swing back, with no
  state to reset. `ai_models[feature].autoSwitch === false` turns it off; the AI Models page has a checkbox for it on free OpenRouter
  cards, and picking any provider/model as primary there is the manual switch, unchanged. `node scripts/smoke-piano-chat-switch.mjs` runs
  the real function with a fake fetch. **The function is NOT deployed** — until the owner runs `supabase functions deploy piano-chat`
  the live one keeps walking the free ladder only.
- **What the chat prints and what the keys play are ONE thing (owner, 2026-10-09: the chat taught C natural minor, the play chip under it
  said C MAJOR SCALE and played C D E F G A B C).** Two causes, both fixed: `extractNotes` (`music-engine.tsx`) only knew the English
  word "minor", so Thai "ไมเนอร์" / Chinese "小调" lessons were read as major (`hasMinorWord`), and the chip re-read the *words* of a
  lesson instead of using what the lesson built. Now (1) a lesson message carries its own `seq` (`learnTopic` passes the demo it built;
  `use-chat.ts` stamps it on live-AI answers while `topicHint` is `LESSON_MODE`; `Msg` in `chat-ui.tsx` uses `m.seq` first, `m.noSeq`
  hides the chip on the four-scales comparison card), (2) a header line "… สเกล · C" decides root and quality (natural / harmonic /
  melodic / major, `scaleLesson`), and (3) a printed run of eight note names that climbs from a root back to it is played as printed
  (`scaleFromNoteRun`). `node scripts/smoke-extract-notes.mjs` (11 checks, the real `extractNotes`) pins it. Chords with a qualifier the
  KNOWN table does not hold (dim, sus, 7ths, extended) still have no chip unless the lesson's own `seq` supplies one — never guess a sound.
- **The two practice pages, plan 27 (`tigamodel/docs/27-plan-practice-pages.md`).** Shipped: (P0) in Practice Mode a microphone reading that does not match
  the target is shown as an ear 👂 and is a MISS only when the same wrong pitch class repeats within 2.5 s (`micDoubt`, `use-practice-mode.ts`); taps and MIDI are
  judged at once; the mic is shut for 450 ms after the app plays the learner's note (1.1–1.8 s while it plays help); the weak-notes log is also kept by day
  (`tg_note_miss_d`, `readRecentNoteMisses`) and the Teacher page says "this week". (P1) the note path is dots with the sung name (โด เร มี / Do Re Mi) under the
  letter, a hand drawing points at the finger (`FingerHand`), accuracy is hidden until three attempts, stars on the result, the "next step" card is
  not truncated and the practice button names what it practises. **Kid mode** (`kidModeOn`, `shared-infra.ts`; Settings 🧒): `tg_kid` "1"/"0", absent = follow the profile
  (`age` ≤ 9 or `ageBand` "child"); today it only shortens the practice screen. (P2) a note missed twice is played to the learner (level 2), missed three times the
  note before it and then it (level 3) — no extra penalty (`practiceHelp`); the result says in one sentence how this round compares with the last. NOT done: P1-1's
  solo big key, P2-2's automatic difficulty step. (P2-3's separate rhythm star shipped 2026-10-10: a second row of stars on the practice result; P2-5's before/after measurement shipped as plan 28 D5.)
  `node scripts/smoke-practice-mic-doubt.mjs` (17 checks) runs the REAL hook in jsdom.
- **Jev stays in the chat's path (owner, 2026-10-09: "call Jev to check too — it is free").** `jevPrecheck` runs before every live-AI question; do not skip it to
  save cost.
- **More instruments in the Play Along band (owner, 2026-10-10: "add strings and winds, make the backing beautiful so practice feels real").** `BAND_STYLES` entries carry `extra: [voiceAtCombo3, voiceAtCombo8]` drawn from flute, oboe, sax (lines in the gaps of the player's melody, parts letter `w`), horn (a warm pad below the tune, `e`) and harp / strum / vibes (rolled or struck chord tones, `h`); `section()` gained an optional delayed `vib` vibrato. A style the table does not know has no `extra` and plays exactly the old band. Measured with the real code: `analyze-band-sound.mjs` shows zero clipped samples, 76–87 % of energy under 250 Hz (limit 90 %) and the band 13–23 dB under the player's note at p90 (limit 12 dB); `verify-playalong-mic-band.mjs` 11/11 (no wrong key read with the new voices, all of them blacklisted while the mic is open); `smoke-band-style.mjs` 282/282 (M13 pins which style books which instrument). `verify-playalong-band-audio.mjs` has 2 FAILs (phone-speaker audibility, finale ring) with IDENTICAL numbers on the commit before this change, so they are older than it. The band audio lab ignores LFO-to-AudioParam connections (vibrato changes neither level nor balance). Not judged by ear: nobody has listened to it yet.
- **Adventure Mode, phase 1 (owner, 2026-10-12).** `adventure.tsx` (its own lazy chunk, ~28 kB, opened from the "Adventure" button on the Arena hero in `pvp-arena.tsx`): a side-scrolling run where the robot (and its pet, which only follows for now) fights alien monsters on a planet. Drawn entirely in code, nothing downloaded; two graphics modes on one engine, **standard** (dpr 1, 30 fps, few particles) and **high** (dpr up to 2, 60 fps, fog/glow/vignette, hit-stop, screen shake), default chosen from `isLowEnd()`/`spaceTier()`, stored in `tg_adv_gfx`. EXP and skill SP use the SAME stores as PvP (`pvp-rpg.ts` robot level + stats, `addSkillSp` skill rank): a kill pays EXP and SP only, **never coins, and nothing here sells or touches the shop**. Five planets are on the menu, only Luma is playable; three monsters (Glowbug, Thornback, Sporecaster), no boss, no drops yet. Honest ceiling: this is a good-looking code-drawn 2D game, not ROV-class 3D. `scripts/smoke-adventure.mjs` opens the menu, runs both modes and kills a monster; `window.__advTest` is its hook.
- **Adventure Mode, phase 2 (2026-10-11).** An end-of-map boss (`drawBoss`, `boss` in `Run`: walks to the player, cycles ground shockwave / 3-spore volley / charge, each telegraphed; the way back shuts while it lives; HP bar on the canvas), kill drops (heal orb, energy crystal `◆` saved in `tg_adv_crystals`, shown on the HUD and the menu), the skill's extra effect by class (engineer heals, ghost brief invulnerability, herald wider radius), and **Ferro** playable (`P.req = "luma"`: opens when `tg_adv_done` holds `luma`; `P.hard` 1.7 scales monster HP/damage/EXP; same three monsters recoloured through `TINT`, boss reskinned as the Iron Warden). Rewards stay EXP/SP only, no coins. `scripts/smoke-adventure-boss.mjs` covers wake-up, arena lock, kill, drops, pickup, the Ferro unlock. NOT done: Ferro-specific monsters, planets 3-5, pet attacks, online maps (server + owner approval), nobody has played it on a real phone.
- **Adventure improvement plan (2026-10-11).** `tigamodel/docs/30-plan-adventure-fun.md`: draft, two critique rounds and a phased final (measure first, then feel of the hit, then reasons to return, then content, then piano-as-magic; online maps wait for the owner). The pet now fires bolts in Adventure (`petBolt`); there is no test with a real pet yet. Crystals have NO sink yet and must never be sold.
- **Adventure plan 30, phases 3.0 + 3.1 (2026-10-11).** 3.0: `logUsage("adv", …)` rows in `usage_events` (no migration): `start:<planet>:<hd|sd>`, `end:<planet>:<secs>s:k<kills>:x<where>`, `perf:<planet>:<hd|sd>:<fps>fps`, `die:<planet>:x<where>[:boss]`, `boss-wake`, `boss-win`, `quiz:<planet>:<right>of<n>`. 3.1: dash (`L`/Shift/`»` button, 0.18 s, invulnerable 0.3 s, 1.2 s cooldown), a 3-hit combo whose third strike is ×1.7 with more knock-back, and every monster attack announced by a red `!` for 0.3 s (`m.tele`). `scripts/smoke-adventure-feel.mjs` pins all of it (the dash, the finisher, warning gap >= 0.25 s, the usage rows). Phone pad checked at 568x320: six buttons, no overlap. Not done: real-phone fps (the `perf` rows will say), 3.2 onwards.
- **Adventure plan 30, phase 3.2 (2026-10-11).** Local-first, no SQL. Workshop on the Adventure menu: three upgrade lines (attack / health / skill speed), 5 levels each at +5 % (fixed ceiling +25 %), cost `upCost(lv)` = 12 x 2^lv crystals, stored in `tg_adv_up`; crystals (`tg_adv_crystals`) come only from playing and are never sold. Three daily quests (collect 15 crystals, answer 5 quiz questions right, beat a boss; `tg_adv_q`, reset by `dayKey()`), each pays EXP once a day through `addRpgExp` — never coins. Difficulty Normal / Hard (monsters x1.5, rewards x1.4, 2 crystals a pickup) / Nightmare (x2.2, x2, 3 crystals), `tg_adv_diff`. `scripts/smoke-adventure-up.mjs` (12 checks). NOT done: the 3-day-to-max-a-line balance script the plan asks for (costs are set by formula, no one has measured how fast real players earn crystals; the `adv` usage rows will tell), and quests are not shown outside the Adventure menu.
- **Adventure plan 30, phase 3.3 (2026-10-11).** Planets now carry `mons` (the monster pool), `hard`, `req`, and optionally `survival`. Ferro has its own Rustcrawler and Magnet Pylon; **Jovia** (gas giant, `survival: true`, opens after Ferro) is the energy-harvest stage: no boss, no beacons, a wave of monsters every 6 s, hold out 90 s while the energy bar fills, dying restarts the timer, clearing pays EXP + `15 x CV` crystals and records `jovia`; **Kryo** (opens after Ferro) has Shardlings, Frostcasters and the Frost Warden boss. Pyra and Nexa are still locked. The scenery is the same jungle drawing recoloured per planet (new terrain shapes are NOT done), and Kryo/Jovia/Ferro monsters reuse the same AI. `scripts/smoke-adventure-worlds.mjs` (15 checks) covers unlock order, monster pools, the survival waves and completion, and Kryo's boss.
- **Adventure full screen + PvP pad (owner, 2026-10-11).** Tapping a planet calls PvP's `enterFs()` (full screen + landscape; both helpers are now exported from `pvp-arena.tsx`) and leaving the run calls `exitFsAndUnlock()`. The pad is PvP's own: `.pvpdir` ◀ ▶ and dash on the left, `.pvpact` fire / jump / punch / kick / skill on the right. Punch = the 3-hit combo, fire = a bolt (0.8x, flies ahead), kick = a short wide sweep (1.2x, hard knock-back), skill = the class skill. Keys: J punch, K skill, I fire, U kick, L dash. `scripts/smoke-adventure-pad.mjs` (8 checks). Real-phone landscape behaviour is unverified.
- **Adventure plan 30, phase 3.4 + music + one question at a time (owner, 2026-10-11).** (1) **ONE question per beacon, never more** (owner: a string of questions kills the fun); the three beacons climb a level each; `scripts/smoke-adventure-quiz.mjs` asserts `qs.length === 1`. (2) **Chord spell:** a gauge (+5 per hit on an enemy or the boss) fills; at 100 the 🎹 button opens ONE question from `nextSpell` (`quiz-quest.ts`: a triad if the learner has studied chords, else an interval, else a scale degree, else a basic note — always played on the on-screen piano, never the microphone); right = a big blast (4.5x, radius ~360, +25 % HP, brief invulnerability), wrong = the lesson shows and half the gauge stays. (3) **Music per map** (`adventure-music.ts`, owner: "a fun song for every map, a different mood each"): ORIGINAL tunes generated from numbers (tempo, scale, chord loop, bass/arp/lead/drum patterns) and played by a look-ahead scheduler on the audio clock — Luma 112 bpm major pentatonic, Ferro 126 bpm phrygian, Jovia 142 bpm minor, Kryo 84 bpm lydian; a boss fight swaps to a denser arrangement; ducks while a question is open; ♪ button mutes (`tg_adv_music`). No third-party recordings are used or fetched. `scripts/smoke-adventure-magic.mjs` renders every mood offline (no clipping, audible) and covers the spell. NOT done: nobody has listened to it yet on a phone speaker, and the tunes are simple loops, not full songs.
- **Hold to fire / sprint, and every robot and pet with its own sound and special effect (owner, 2026-10-11).** (1) Hold the fire button = rapid fire in PvP (`holdFire`: a 70 ms timer calling the latest `attack("fire")` through `attackRef`, so the weapon's own cooldown still rules) and in Adventure (cooldown 0.22 s); hold ◀ ▶ for 0.35 s = a sprint (x1.8 in PvP via `dirSince`, x1.7 in Adventure via `pl.holdT`). (2) `fx-voice.ts`: a robot's **voice** is `voiceOf(model, classKey)` — the class decides the signature timbre (striker thud, bulwark clang, ghost air, tactician scan, engineer ping, herald chime, virtuoso arpeggio) and the id decides the pitch — layered on the weapon's own sound by `playSig` through `arena-fx` `sfx(kind, voice)`; a pet's voice is its ELEMENT (zap / crackle / icy / pluck / clang / shimmer) plus what its weapon adds (bite snaps, claw rasps, spit bubbles, roar growls). The visual **flourish** is `robotFx` (8 recipes picked from the id, bigger on an ultimate, in the class colour and the robot's own skin glow) or `petFx` (element x move = 24 looks), called from `strike()` at every impact and from `sendPet()`. In Adventure the robot's bolt (4 shapes), skill/spell nova (5 shapes) and the pet's bolt (one look per element) come from the same ids; `adventure-sfx.ts` plays the base sounds with the voice on top, and the ♪ button mutes music and effects together. Pure functions of the id: nothing is stored. `scripts/smoke-fx-voice.mjs` (every robot has a voice, 8 flourishes in use, 24 pet looks, 52 offline renders without clipping) and `scripts/smoke-hold.mjs` (sprint, rapid fire, PvP hold). NOT verified: nobody has listened to these on a phone speaker or watched the PvP flourishes on a real device; PvP sprint is by code only (the Adventure sprint is tested); an opponent's pet and a robot's weapon art (sword vs cannon) do not change the sound beyond the existing weapon sounds.
- **Adventure: Pyra and Nexa (2026-10-11).** All five planets are playable now: `req` chain luma -> ferro -> (jovia, kryo) -> **pyra** (needs kryo; `hard` 3.0; lava pools `P.hazard = "lava"` at three fixed x ranges, Magmaling / Flarecaster monsters, the Core Warden) -> **nexa** (needs pyra; `hard` 3.8; shock plates `"shock"` that pulse on for 1.2 s of every 3 s with a yellow warning flicker, Wreck Drone / Scrap Golem monsters, and the Nexa Overseer, which **enrages below half health**: faster attack cycle, five-shot volleys). A hazard only hurts a robot standing on the ground (`pl.y < 14`), so jumping over it is the answer; 4.5 x `HM` damage every 0.6 s. New tunes for both (`pyra` 136 bpm, `nexa` 100 bpm). `scripts/smoke-adventure-final.mjs` (14 checks). The scenery is still the same drawing recoloured; hovering monsters share the `TALL` set. NOT done: terrain shapes per planet, online maps (phase 3.5: needs a table design + SQL the owner must approve), anyone playing the late planets on a real phone (the difficulty numbers `hard` 3.0 / 3.8 are guesses, the `die:` usage rows will show where players fall).
- **Adventure: weapons loadout, missions and the colony story (owner, 2026-10-11).** Loadout chosen on the menu (`tg_adv_load`, `GUNS` / `ROCKETS` with `req` = the planet that unlocks each): guns **pulse** (single bolt, rapid), **scatter** (3-way, short), **lance** (piercing beam), **arc** (instant chain lightning to 3 foes); rockets **homing** (steers, 3.2x blast), **cluster** (bursts into 5 bomblets), **napalm** (a burning patch for 3.5 s); the pad has a 🚀 button (key `Y`, cooldown 3.4 s). Missions (`P.mission`): **mine** (Cobalt Belt: break ore nodes with punch/kick, cargo cap 18, a capsule launches from the far-right pad at >= 10 ore and adds to `tg_earth_ore`, shown on the menu as the colony stage Outpost/Camp/Town/City), **capture** (Helios: hold three collector stations 10 s each while waves arrive; stations are placed away from the quiz beacons on purpose — a beacon opens a question and pauses the sim), **strike** (Ashfall: `StrikePhase`, six bases, three warheads, a base inside the blast has no defenders in the assault, then the commander boss). `BRIEF[id]` is a one-line briefing shown as a banner when a map opens. No coins anywhere; the ore is a story counter, not a currency. `scripts/smoke-adventure-arms.mjs` (weapons) and `scripts/smoke-adventure-missions.mjs` (missions). NOT done: the spaceship dogfight mode, a second gas giant from another universe, terrain per planet — see `tigamodel/docs/31-adventure-colony-story-and-missions.md`.
- **Adventure music v2 and the map-clear card (owner, 2026-10-11: "more fun, more exciting, more dopamine" and "after each map, go straight on to the next").** `adventure-music.ts` now plays a 16-bar form (sections A, A', B, C): B lifts the chords two degrees and the lead answers a step higher; C is the payoff, **a key change up two semitones**, lead in octaves with a third above it. The game feeds an INTENSITY (1 calm, 2 enemies within 480 px, 3 boss / combo >= 2 / spell ready / low health with enemies near — `mus.setIntensity`, evaluated every 0.25 s) and the energy E = section + intensity - 1 (max 3, +1 in a boss fight) gates the layers: E2 adds sixteenth hats, octave sparkle, snare ghosts and a fill every four bars; E3 adds the harmony third, a kick on every beat, open hats, a crash on every section start and a fill every two bars. Always on: a snare roll in every bar 4, a rising noise riser into B and C, bass octave jumps, the arpeggio alternating left/right, and every kick ducks the melody bus (a sidechain pump). `renderPreview(id, bars, boss, intensity, startBar)` also returns `events` (note-ons booked), which `scripts/smoke-adventure-magic.mjs` uses: the peak arrangement must play >= 15 % more notes than the calm one, the last chorus more than the opening, nothing clipping, for all six tunes (plus boss). **Map clear:** when a map's goal is done (boss down, harvest done, capsule launched, sun captured) a card offers "Next map: <name>" (the first later map that is open), counting down 9 s to start it by itself, with Stay here / Map menu; `KEEP_FS` keeps the full screen across the switch. Tested in `smoke-adventure-missions.mjs`. NOT done: nobody has listened to the new arrangement on a phone speaker (the tests prove it is louder-in-content, not that it is nice); the tunes are still generated loops, not recorded songs.
- **Adventure cinematics (owner, 2026-10-11: a film before every map, beautiful CG, the story and the mission, with music and sound effects).** `adventure-cine.tsx` (lazy chunk ~23 kB, loaded when a map is picked): drawn live on a canvas from code, no downloads. Shots: Earth in 2100 > the factory that builds the pioneer robots (their eyes light one by one) > the fleet launching > the approach to the planet (planet shaded in its own palette, orbit line, scan) > the surface in its own look per world (jungle, desert, gas giant, ice, lava, wreck city, asteroid belt, a sun with collector pylons, an orbital strike with falling warheads) > the guardian (alarm, pulsing eye) when the map has one > an objective card with the PLAYER'S OWN ROBOT and three goals. Letterbox, vignette, film grain, slow push-in, fades; subtitles in th/en/zh (**no voice-over** — there is no voice engine for it); a tap = next shot, Skip = into the map. The score is `scheduleCineScore` in `adventure-music.ts` (drone, pads, a riser, a heartbeat, an accelerating arpeggio, a timpani hit and reverse swell at every cut, per-shot effects: radio blips, servos and sparks, engines, sonar, alarm, a whistle then the blast, a brass-like swell on the objective). Menu tick box 'Skip the film before each map' (`tg_adv_nocine`); every Adventure smoke test sets it, only `scripts/smoke-adventure-cine.mjs` plays the film (shots in order per map type, each frame painted, subtitles per language, objective card, Skip, tap-to-advance, the tick box, and offline renders of all nine scores). Story text lives in the `COMMON` / `INTRO` / `STORY` / `GOAL` tables at the top of the file. NOT done: nobody has watched it on a phone; it is code-drawn CG, not rendered or recorded film.
- **Adventure rockets look like missiles (owner, 2026-10-11, with a screenshot circling the right end of the button row).** The 🚀 button sits at the right end of the first row (shoot, jump, punch, rocket; PvP's global `.pvppad-r .pvpact.rocket{grid-column:span 2}` is overridden inside `.adv-pad`). A rocket is drawn as a real missile — metal body with a gradient, a coloured band by type (red homing, yellow cluster, orange napalm), fins, a nose cone with a red tip, a hot teardrop exhaust and glow — with a smoke trail (`smoke` particles, capped 70 / 220), a muzzle flash and backblast at launch, and a fireball + shockwave ring + smoke at the blast (`blasts`). Tested in `smoke-adventure-arms.mjs` (muzzle flash, backblast, trail, button order).
- **Adventure loot, warp and the opening film (owner, 2026-10-11).** (1) Monsters drop four loot kinds (`LOOT` in `adventure.tsx`: scrap, ore, gold, core, each with a value); what is collected is sold when the map is cleared (full price) or the run is left early (40 %), through PvP's `onReward(0, coins, {adventure:true})` so the App's server-side limits still apply; a client-side cap of `ADV_COIN_DAY_CAP` coins a day (`tg_adv_coin_day`) bounds it. The owner explicitly allowed Adventure loot to pay coins that work in the shop; nothing is for sale, and `window.__advRewardLog` records each sale for tests. (2) Reaching the warp gate after the boss moves to the next open map by itself (~1.1 s banner, `onNext`), else shows the clear card. (3) The opening film (`PROLOGUE`: earth > factory > launch) plays once before the map menu (`tg_adv_prologue` = "1" after it; absent = show; "skip" = tests, no prologue and long map films); after that each map's film is the short cut (approach > surface > boss > objective) with a chapter number. `scripts/smoke-adventure-loot.mjs`, `smoke-adventure-cine.mjs`. NOT verified: coin ceiling balance, any of it on a real phone.
- **Adventure rocket sizes, salvo and landscape films (owner, 2026-10-11).** `ROCKETS` now has Mini (open from the start, small, 0.9 s reload), Homing, Cluster, Napalm, **Big** (opens with Kryo, r170 x7, 5 s) and **Nuclear** (opens with Nexa, r460 x16, 14 s, white flash and heavy shake, one at a time). A fourth workshop line `rkt` (crystals, like the others) gives a salvo: 2 missiles at Lv2, 3 at Lv4 (Big/Nuke always fire one), and 6 % faster reload per level; holding the 🚀 button keeps launching at the reload rate. Every film (the opening one and each map's) calls `enterFs()` (full screen + landscape lock); the opening film leaves full screen when it ends; if the phone refuses to rotate, the film turns itself 90 degrees (`.adv-cine.rot`). `scripts/smoke-adventure-salvo.mjs`. NOT verified on a real phone: the orientation lock and the turned-film fallback (headless Chromium cannot do either).
- **Adventure films, round 2 (owner, 2026-10-11: longer, subtitles in the middle, more epic score, Dune / Star Wars / Star Trek look).** `cinePlan` stretches every shot except the objective card by 1.6x; the subtitle (`.ac-cap`) sits in the middle of the screen on a dark band, larger; `epicLook` in `adventure-cine.tsx` adds a warm/cold grade, drifting dust, an anamorphic streak, a capital ship gliding past in the space shots, holo corner brackets and a stardate readout, and the letterbox is deeper. The score gained a brass theme, a choir-like pad, timpani rolls, a low brass hit on every cut and a stacked closing crescendo (`scheduleCineScore`); the cine smoke test still renders all nine scores without clipping. NOT verified: nobody has watched or listened to it on a phone.
- **Adventure starship dogfight, "Void Gate" (owner, 2026-10-11: "drive a spaceship and shoot the aliens").** `adventure-ship.tsx` (lazy chunk): a side-scrolling shooter, the robot as pilot. Opens after Kryo (`P.mission = "dogfight"`, handled in `AdventurePage`, not in `Run`); 55 s of drone / fighter / bomber waves, then a mothership with fan volleys and an enrage under half health; arrows or the on-screen pad to move, hold FIRE, MISSILE (homing, salvo from the `rkt` workshop line). Crystals and loot are picked up; on a win `settleShip` marks the map done, adds crystals, sells loot under the same daily coin cap and `onReward` path as ground runs, and a card offers the next map. Losing shows Retry. `scripts/smoke-adventure-ship.mjs`. NOT verified on a real phone (touch pad feel, fps, the numbers). The follow-up plan for the whole space-journey act (leaving Earth film, asteroid mining, gas-giant skim, star harvest, music quests at every station) is `tigamodel/docs/32-plan-adventure-space-journey.md`: a plan only, waiting for the owner.
- **Skill careers for robots and pets (owner, 2026-10-11: each robot class a career with 10+ skills, pets too, upgradable, each skill with its own effect and sound).** `skill-tree.ts` (pure data): 7 robot classes x 10 skills and 6 pet elements x 10 (130 in all), each a row `[archetype, power, range/count, cooldown, th, en, zh]`. Archetypes: volley, nova, dash, shield, heal, haste, slow, stun, chain, drain, meteor, turret, execute (actives) and p_atk / p_hp / p_crit / p_regen / p_cdr / p_speed / p_steal / p_guard / p_loot / p_xp (passives, capped in `passiveSum`). Robot skill n opens at class rank n (the existing Skill EXP), pet skill n at pet level n; levels 1-5 cost crystals (`skillCost`, never sold); equip up to 3 robot actives (pad buttons ✦1 ✦2 ✦3, keys K H G) and 2 pet actives (the pet casts them itself when foes are near); passives are always on. **A skill's look and sound are derived from its id** (`skillLook`: one of 5 particle patterns, hue, count; `skillSound`: pitch, wave, brightness; the archetype sets the shape of the sound in `adventure-sfx.ts` `cast`), and `smoke-skill-tree.mjs` asserts all 130 combinations are distinct. The old single class skill is gone from Adventure (its role is skill 1). In a run, `castSkill` in `adventure.tsx` does the effect (slow/stun use `m.slowT`/`m.slowF` in the monster loop; haste, shield, turret and delayed meteors live in the run's state); `SkillBook` on the menu is the UI. PvP is untouched (it still uses `MODEL_SKILLS`). Honest limits: the 130 effects are 13 archetypes with different numbers, names and looks, not 130 hand-built mechanics; balance numbers are guesses; no one has tried it on a phone. `scripts/smoke-skill-tree.mjs`, `scripts/smoke-adventure-skills.mjs` (casts all 130).
- **Dig button and the Dyson Forge (owner, 2026-10-11).** A ⛏ button (key V) shows on the resource maps (`mine` and `dyson`): it swings a pickaxe at ore rocks (power 3, reach 160, 0.38 s) and, beside a Dyson frame, bolts a panel on instead. **Dyson Forge** (`P.mission = "dyson"`, opens after Helios, no boss): dig 8 ore rocks for ore (cap 20), bolt 4 panels (5 ore each) onto the frames, then reach the far-right relay to beam the energy to Earth (`tg_earth_dyson` += 4, shown on the menu; map done, crystals + EXP, the usual clear card); a solar flare every 14 s (warning at 12 s) hurts anyone on the ground, so jump. Film, music and brief are in. `scripts/smoke-adventure-dig.mjs`. Not verified on a phone; numbers are guesses.
- **Adventure Online, phase O1 (owner, 2026-10-11: online multiplayer — fight together, do the missions together).** A "Adventure Online" button sits above the Adventure button in the PvP lobby (the spot the owner circled in red on a screenshot). `adv-online.ts`: a room is a Supabase Realtime broadcast + presence channel `advo:<CODE>` (same pattern as `pvp-online.ts`; no table, RPC or edge function, nothing to deploy), up to 4 pilots, the host picks the map for everyone, positions are drawn as ghosts, damage on a numbered monster (or the boss) is sent so the fixed-spawn monsters die for everyone (the killer keeps the loot, teammates get half the EXP), ore/panel events and emotes show. **Trust model: every client runs its own game and self-reports, no server authority** — so nothing of value may depend on it (rewards are the same local EXP/crystals and the daily-capped loot coins). Random wave monsters (Jovia, Helios) are not numbered and are not shared. `scripts/smoke-adv-online.mjs` tests the room logic against an in-memory fake channel (the container cannot reach Supabase); `scripts/smoke-adventure-online.mjs` checks the button and lobby. NOT tested against real Realtime or with two real phones. The plan, limits and next phases (team missions, team-vs-team war, public matchmaking that needs SQL the owner must approve) are in `tigamodel/docs/33-plan-adventure-online.md`.
- **Warp on every map, all maps open, a new cast in the films and the ship (owner, 2026-10-11).** (1) **Every map is open from the start, in any order** (`open(P)` is just `P.ok`; weapons still unlock by maps cleared; `P.req` is kept as data only). `nextOf` = the next map you have not cleared, wrapping round. (2) **Walking into the glowing WARP gate at the end of any map, once its goal is done** (boss down, or `finished` on the mission maps), goes straight to the next map: its film plays, then the map; no card to press (the card's countdown is 6 s as a fallback; in an online room the host picks maps, so there is no auto-next). Tested in `smoke-adventure-dig.mjs`. (3) `scripts/smoke-cine-subtitles.mjs` checks every caption, goal, map title and boss name exists in Thai, English and Chinese in the right script. (4) Films: `robot()` is a detailed armoured pioneer (rim light, glowing core, visor, forearm cannon), `capital()` a flagship, `ship()` a swept fighter, `alien()` six body plans (crab, wasp, worm, brute, floating eye, hydra) mixed per world in the surface scene and one as the guardian in the boss shot. The starship map got a detailed player fighter, five enemy types (scarab drone, raider, wasp, bio-bomb kamikaze, dreadnought carrier) and a Hive Mothership. Code-drawn, judged only from screenshots, not on a phone. In-game ground monsters still use the older drawings.
- **Ground monsters redrawn and eight new ones (owner, 2026-10-11: "make the monsters beautiful and varied").** `adventure-monsters.ts` paints every ground monster (`paintMonster`: shadow, gradient body, rim light, glowing eyes) and the end-of-map guardian (`paintBoss`: armoured horror with horns, a lit core and dorsal spines in the planet's colours); `drawMonster`/`drawBoss` in `adventure.tsx` call it, and the AI, stats and hit boxes stay in `MON`. New types: Shadow Hound (fast), Blade Mantis, Warbrute (heavy), Burrower, Swarmer, Wraith and Watcher (hovering shooters, in `TALL`) and Acid Spitter (ground shooter); every map's `mons` pool now mixes in two or three of them. Judged from a contact sheet and in-game screenshots, not on a phone; the new types reuse the existing melee / ranged AI (a Burrower is a stationary biter), so they look different but behave like their category.
- **Space journey, phase S1 + S3 (plan 32): Departure and the Asteroid Field (owner, 2026-10-11).** The starship engine (`adventure-ship.tsx`) now has three modes picked by `P.mission`: `dogfight` (Void Gate), **`launch`** (Departure: 38 s of debris and rocks from the sky into orbit, shoot or dodge, reach orbit to win) and **`belt`** (Asteroid Field: rocks split large > medium > small and a small one breaks into ore, collect 16 mined ore to win; ore goes to Earth through `addOre`, pirates appear after 14 s). Both are open from the start like every map. Departure's film is the send-off: `pad` (countdown with the rocket on the pad and floodlights), `liftoff` (the climb through clouds into space), `earthfade` (Earth shrinking behind a flagship and fighters), each with its caption in th/en/zh (`DEPART`, checked by `smoke-cine-subtitles.mjs`) and its own cue in `scheduleCineScore`. `scripts/smoke-adventure-space.mjs`. Not built from plan 32 yet: gas-giant skim, star harvest in the ship, music questions at the stations, the space-map menu, ship upgrades. Not verified on a phone.
- **Space journey, next phase: music relays and the Gas Giant Skim (owner, 2026-10-11).** Every ship map (Void Gate, Departure, Asteroid Field, Gas Giant Skim) sends a **music relay** (glowing ♪ ring) across the screen every ~26 s: flying into it pauses the ship and opens ONE question, the same `QuizCard` and `nextSpell` as the ground beacons (handled in `AdventurePage` through `shipCtl`; EXP/skill points as usual, never coins); a right answer repairs 30 HP, shields the ship 3 s and adds 3 crystals, a wrong one shows the lesson and the flight resumes. **Gas Giant Skim** (`P.mission = "skim"`, ship mode `skim`): a glowing energy layer drifts up and down the screen; stay inside it to fill the tank (about 9 s of staying in it), lightning columns are warned for 1 s then strike (14 damage), crystals drift along the layer; a full tank wins the map. Film, captions in th/en/zh, music and brief are in. `scripts/smoke-adventure-space.mjs` (relay pause/resume/repair, skim fill and win). Still not built from plan 32: star harvest by ship, the space-map menu, ship upgrades. Not verified on a phone.
- **Round pad buttons (owner, 2026-10-11).** Every control-pad button is a circle, never a rounded square: `.pvpdir` / `.pvpact` (PvP fight pad, Adventure, Adventure Online, survival and the ship maps all reuse these classes) get `border-radius:50%` and equal width and height from the override blocks at the end of `app-styles.ts` and of the Adventure `CSS` string (they must stay LAST: an earlier copy of the override lost to the older `.adv .pvpact{width:68px;height:56px}` rule). `scripts/smoke-round-pad.mjs` measures the real buttons. The big Fight button and the entry cards keep their shapes.
- **Round everything in PvP and Adventure (owner, 2026-10-11, repeated).** On top of the circular pad buttons: wide buttons (Fight, tabs, ghosts, friend, practice, quiz options, `adv-btn go`) are pills, icon buttons (back, music, graphics) are circles, and the multi-line cards (tiers, the two entry cards, map cards, workshop upgrades) have 34 px corners; the rules are the last block of `app-styles.ts` and of the Adventure `CSS` string.
- **Star Harvest by ship, and the pad layout the owner drew (2026-10-11).** (1) **Foreign Star** (`P.mission = "harvest"`, ship mode `harvest`, open from the start): three collector stations in turn, each a ring the ship must stay inside for 7 s (progress decays at 0.4x outside it) while raiders attack and a solar flare sweeps a horizontal band every 5 s (warned 1 s, 12 damage); all three win the map. In this mode the ship may fly to the far right (`W - 90`, other modes stop at `W * 0.62`). A `hurtShip` call before its `const` declaration had been a latent TDZ crash in the skim mode; it is now a hoisted function. (2) On the owner's screenshot (red lines from FIRE, JUMP and PUNCH to the upper right) the Adventure pad is a 3-row grid: FIRE, JUMP, PUNCH on the top row at the right; the three skills, ROCKET and KICK in the middle row; DIG and the spell on the bottom row (rules at the end of the Adventure `CSS`). `scripts/smoke-adventure-space.mjs` covers the harvest map.
- **Lightning button and rapid rockets (owner, 2026-10-11, red circle on a screenshot).** A ⚡ BOLT button (`.pvpact.zap`, key B, grid cell 3/3 left of FIRE) shoots chain lightning to up to 4 foes (0.75x, cooldown 0.24 s, rapid when held). Rockets: every press fires 2 missiles (3 at workshop Lv2, 4 at Lv4; Big and Nuclear still 1), and reloads are short: mini 0.16 s, homing 0.26, cluster 0.4, napalm 0.45, big 1.1, nuke 3 (were 0.9-14 s); holding the button keeps launching. Tested in `smoke-adventure-salvo.mjs` / `smoke-adventure-arms.mjs`. Balance (rapid rockets are strong) and phone feel are unverified.
- **Starship engine upgrade (plan 32 item 5, 2026-10-11).** A fifth workshop line `shp` (crystals, never sold): +6 % ship speed and +20 px pickup pull per level, ship maps only (`adventure-ship.tsx`). Still not built: the space-map menu, online team missions (O2). Not verified on a phone.
- **Space-map menu (plan 32 item 6, 2026-10-11).** The Adventure map list is two tabs, Sector 1 Surface and Sector 2 Deep space (`isSpace`: the ship missions), each with a cleared count; the choice is saved in `tg_adv_sector`. Every map is still open. Smoke tests that open a ship map set `tg_adv_sector=space` first. Not done: online team missions (O2). Not seen on a phone.
- **Online team goal (plan 33 O2, 2026-10-11).** In a room, `kills` already counts every numbered monster that dies for the whole room, so the team goal is 10 kills per pilot (`teamGoal`, HUD `🤝 n/goal`); reaching it once pays each pilot `min(12, 4 x pilots)` crystals (never coins) and logs `team-goal`. No new network messages. Only the solo path was run by tests (no Realtime in the container), so the room path is unverified, as are revive and team-vs-team (O3).
- **Online revive (plan 33 O2, 2026-10-11).** In a room a downed pilot waits 8 s (solo still 2.2 s and respawns at the start); a teammate who stays within 90 px of them for 1.5 s sends `ev` `revive:<id>` and they stand up on the spot with half health and 2 s of invulnerability. Peers show hp 0 through the existing `pos` messages, no new message type. Only the solo path ran in tests (no Realtime in the container); the revive itself is unverified, and so is team-vs-team (O3).
- **Online team war (plan 33 O3, 2026-10-11).** The host ticks "Team war" in the room lobby before picking a map (`warOpt`; the start message carries `war`, both nets set `net.war`). Teams are the pilots sorted by id and alternated (`warTeamOf`, no extra message), ghosts are tagged 🔴/🔵, and punch / kick / bolt / lightning aimed at an enemy-team ghost send `ev war:<victim id>` with the damage, which the victim applies to itself (`hurtPlayer`); the killed pilot sends `wdown:` so every client counts the score, first team to 10 downs gets a winner banner. Only allies can revive in war, the team goal is off, and nothing is paid (no EXP, crystals or coins). Trust model as everywhere in Adventure Online: each client reports its own hits, so cheating is possible between friends; real matchmaking needs server authority and the owner's approval. Only the room logic (flag, team split) ran in tests against the fake channel; the fight itself has never been run between two real clients.
- **Public room list (plan 33 O4, SQL applied by the owner 2026-10-12 — the owner said they ran `supabase-adv-public-rooms-migration.sql`; not re-verified against the live DB).** Table `adv_public_rooms` (a room advert only: code, host name, map, war flag, pilot count; hidden after 90 s, deleted after 10 min) with RLS and four RPCs (`adv_room_open/ping/close/list`, signed-in only, one room per host). The lobby of Adventure Online now has an unticked-by-default "List my room publicly" box (`data-pub`) and a "Public rooms" list with a Join button per row (`listPublicRooms`, `publicRoomOpen/Ping/Close` at the end of `adv-online.ts`). A listed host pings every 30 s and when the pilot count or war flag changes; leaving or closing the page calls `adv_room_close`. **Every call fails soft** (a missing RPC, a signed-out player or a network error just means an empty list). The advert always carries an empty map id (the lobby shows no map until a start). Gameplay still runs on `advo:<CODE>` and pays nothing through the table. `scripts/smoke-adventure-publicrooms.mjs` (6 checks, RPCs stubbed, fake channel) covers list, join row, default-off, open and close; a real two-account run against the live DB has NOT been done.
- **Per-planet skylines (2026-10-11).** The middle scenery layer is chosen by `MID_STYLE` in `adventure.tsx`: Luma keeps the glowing mushrooms, Ferro and Cobalt get banded mesas, Jovia gas pillars, Kryo ice spires, Pyra and Helios lava volcanoes, Nexa, Dyson and Ashfall ruined towers with lit windows (same palette tokens per planet, same baked layer so no per-frame cost). Checked from screenshots of Kryo, Pyra and Nexa at 844x390, not on a phone; the foreground ferns and the ground are still shared.
- **Per-planet foregrounds (2026-10-11).** `NEAR_STYLE` beside `MID_STYLE`: Ferro and Cobalt get pipes with valves, Jovia thin glowing tendrils, Kryo frost shards, Pyra and Helios dark rock spikes with an ember, Nexa, Dyson and Ashfall cable-and-conduit stumps; Luma keeps the ferns. Same baked layer, no per-frame cost. Checked from screenshots of Ferro, Pyra and Jovia, not on a phone; the ground strip itself is still shared.
- **Adventure performance, measured (2026-10-12).** Profiled with CDP at 4x CPU slowdown: the canvas draw costs only 2-3 ms a frame (`__advTest.drawAvg()`), but the live SVG robot and pet re-rasterised every frame and held the page at 24-34 fps. They are now stored pictures from `figure-cache.tsx` (`FigurePic`, `warmAdvFigures`, keys `advme`/`advpet`), queued when the Adventure menu opens; with the pictures ready the same test gives 59-61 fps on Luma, Jovia and Pyra in both graphics modes. While the pictures are still being made (about the first seconds after the menu opens on a slow CPU) the live drawing is shown and fps stays near 27-30. The numbers come from headless Chromium with software rendering and a CPU throttle, not a phone; the `perf:` usage rows will give real ones.
- **Two-page room test (2026-10-12).** `adv-online.ts` takes its channel from `window.__advChannelFactory` when a test defines one (production never does and always uses Supabase Realtime). `scripts/smoke-adventure-room.mjs` defines an in-browser channel over `BroadcastChannel` and drives TWO real game pages in one browser through the whole flow: create room, join by code, host starts a map and the guest follows, a downed pilot is revived by a teammate standing close (stands up where they fell, half health), then team war on a second map (different teams on the two sides, a punch from one hurts the other on their own screen); 12 checks pass. What it still does not cover: real Supabase Realtime latency and message loss, more than two pilots, the war score and winner banner, the team kill goal, and real phones. `__advTest` gained `killMe`, `warInfo`, `face`.
- **New story: the Harvesters, the Kindred and TIGA's hunger (owner, 2026-10-12).** Canon in `tigamodel/docs/29-adventure-story-canon.md`: colonies lead to contact with the Harvesters (an ancient, far more advanced civilization that reaps stars; humans cannot fight them, so the aim is not to be noticed and to find friends), the Kindred (friendly aliens ahead of us in some sciences but not enough to threaten anyone; we learn by trade), and TIGA, the AI that grows so fast one star cannot feed it, which pushes humanity to fusion/fission and dark matter. In the films: the opening film gained `contact` and `mind` shots, and every map's film has a `lore` shot before the boss/objective (`LORE_THEME` picks harvest / ai / friend / reactor / dark, `LORE` holds the th/en/zh caption, `THEME_TAG` the label chip), each with its own code-drawn scene (`sceneHarvest`, `sceneAI`, `sceneFriend`, `sceneReactor`, `sceneDark`) and its own score cue in `scheduleCineScore`. `smoke-cine-subtitles.mjs` checks the new text in three languages; `smoke-adventure-cine.mjs` the new shot order. Judged from screenshots only. NOT done: playable Kindred or dark-matter missions (the story is in the films and captions), Harvesters as in-game enemies (by design they are avoided, not fought).
- **Act 2: the sequel in Adventure and Adventure Online (owner, 2026-10-12: "or make it a sequel").** A third menu tab "Act 2 · The Harvesters" (`ACT2`, `sectorOf`; saved in `tg_adv_sector`) with three playable maps, all open from the start and all selectable by the host in an online room like every other map: **Kindred Haven** (`mission: "mine"`: dig ore, launch the trade capsule to the friendly aliens), **Dark Forge** (`mission: "dyson"`: dig, assemble four dark-matter vessels, solar-flare-style hazards) and **Under the Harvesters' Eye** (new ship mode `evade` in `adventure-ship.tsx`: the ship may NOT shoot, red warning bands then bright scan beams sweep across and down, hit = 15 x sqrt(hard) damage, survive 50 s; `EVADE_T`). Each has a film (INTRO/STORY/GOAL/LORE, theme friend / dark / harvest), a BRIEF, a mood in `adventure-music.ts` and its own colours. When all three are cleared the menu plays a one-time epilogue (`FINALE`, `tg_adv_finale`: friend > dark matter > the Harvesters > TIGA; skipped when `tg_adv_nocine` is set). `scripts/smoke-adventure-act2.mjs` (17 checks) covers the tab, both resource maps and the evade ship (no shooting, beams, win recorded); `smoke-adventure-cine.mjs` the epilogue. Not done: a playable Harvester chase (by design they are avoided), real Kindred characters on the ground maps (their monsters are the existing types), balance (hard 2.4 / 2.6 / 3.6 are guesses), phones. 
- **Kindred elders (Act 2, 2026-10-12).** On Kindred Haven the three knowledge beacons are drawn as Kindred elders (`paintKindred` in `adventure-monsters.ts`: slender teal and gold, a halo ring, drifting glyphs, dimmed once asked) and greet a pilot who comes within 300 px with a line in the player's language; the question they ask is the same single beacon question as everywhere. `smoke-adventure-act2.mjs` (19 checks) covers the three elders and the greeting. Seen in a screenshot only, not on a phone.
- **Map locks, one step at a time (owner, 2026-10-12, replacing "every map is open").** Inside each menu sector (Surface / Deep space / Act 2) step n opens when step n-1 is cleared (`prevOf`/`stepOf`/`open` in `adventure.tsx`; `nextOf` and the warp gate only pick open maps). A tier-3 admin (`profile.admin_tier >= 3`, threaded App -> `PvpArenaMount` -> `PvpPage` -> `AdventurePage` as `adminTier`) is never locked, to inspect the game. `localStorage.tg_adv_unlockall = "1"` is the same switch for the bots (every Adventure smoke test sets it); progress is local (`tg_adv_done`), so this is a pacing rule, not a security one. `scripts/smoke-adventure-locks.mjs` pins it. Online: only the host needs the map open; guests follow. NOT verified on a phone.
- **BOLT lightning, HANDS OFF before every question, energy taps, ship look and touch stick (owner, 2026-10-12).** (1) The BOLT button draws a real bolt (`drawLightning`: jagged midpoint-displaced path redrawn each frame, side branches, blue glow + cyan body + white core, a flare at every target) and plays `zap` in `adventure-sfx.ts` (crack, descending buzz, thunder rumble); it adds screen shake and sparks. (2) Every Adventure question (beacon, spell, ship relay) opens behind a `QuizGate` card, the same HANDS OFF idea as the PvP knowledge break: its button is dead for 900 ms, then the learner presses ready; `localStorage.tg_adv_nogate = "1"` lets the older bots skip it. (3) On the gas-giant harvest map (Jovia) three beacons are energy taps (+20 % of the harvest per right answer) and on Helios a right answer adds 4 s to the station being held (`tapFire`); mining maps show a ringed pick over every rock still to break. The mining/harvest mechanics themselves are the ones already there. (4) Ship maps: the player's ship is drawn as a Starship-style stainless hull (flaps, heat-shield belly, Raptor bells, long exhaust); the left half of the screen is a touch stick (drag anywhere, `keys.ax/ay` analog) and the four arrow buttons are replaced by ONE big round joystick (`.adv-joy`, fixed centre, same handlers). `scripts/smoke-adventure-handsoff.mjs` covers the gate, the bolt call, the three taps and the stick (CDP touch). NOT verified: how the bolt and the thunder look and sound on a phone, the stick feel on a real thumb, balance of the tap rewards. The enemy ships and the mothership were not redrawn.
- **Space backdrop and drifting asteroids on the ship maps (owner, 2026-10-12).** `planetSprite` / `BACKDROPS` in `adventure-ship.tsx`: each ship map has its own far planets (gas giant with rings, ice, lava, violet giant, moons) painted ONCE into small canvases and drawn with `drawImage` at a slow parallax, plus two extra nebula glows, a far layer of dark drifting asteroids and the odd meteor streak, all harmless scenery (Departure keeps its sky and has no planets). Void Gate, Foreign Star and Gas Giant Skim also send a drifting asteroid (small or medium, damage on contact, can be shot) every 2.6-5.6 s, on top of the alien ships; Departure and the Asteroid Field already had rocks. Judged from screenshots of Void Gate and the Asteroid Field, not on a phone; the cost per frame was not measured.
- **One gear button in every Adventure run (owner, 2026-10-12).** `adventure-settings.tsx` (`GearButton`, `SettingsPopup`) is shared by the ground runs and the ship maps: one ⚙ at the top right replaces the separate music and HD/SD buttons, and opens a pop-up (`[data-pause]`) with Resume, Graphics Standard/High, Sound on/off and Back to the map. Opening it pauses this player's run (`pausedRef`; Esc or P toggles it on the ground maps); in an online room only the local game stops and the card says so. Changing graphics no longer restarts the map: `Run` is keyed by the planet only and reads `highRef` live (`HI()`), the ship refits its canvas (`fitRef`; High = device pixel ratio up to 2, Standard = 1). The ship maps share `tg_adv_gfx` and `tg_adv_music`. `scripts/smoke-adventure-pause.mjs` covers a ground run and a ship map (pause really stops movement, graphics saved, resume). NOT verified on a phone; a ship map has no particle/effect reduction in Standard, only the lower resolution.
- **Deep-space ship missions (owner, 2026-10-12: solar charging, fuel stops, Dyson docks, warp, black holes).** Five new Sector 2 maps in `adventure-ship.tsx`, each with a film, captions in th/en/zh, a brief and a mood: **Solar Array** (`solar`: the battery drains 1.7 %/s, collect 8 drifting solar panels, each +16 %; at 0 % the ship halves its speed and takes damage), **Dyson Dock** (`harvest` with `P.sky = "dyson"`: the existing station-holding engine against a drawn Dyson-sphere lattice) and **Gas Pump** (`harvest` with `P.sky = "gas"`: same engine against a big gas giant, pump rings), **Warp Gates** (`warp`: speed streaks, three gates that come round again if missed, then a growing portal to dive into = another galaxy) and **Black Hole** (`blackhole`: gravity that grows with time, touching the horizon before 34 s throws you back and hurts, after 34 s the door lights up and diving in wins = another universe). Rewards are the usual crystals and loot, never coins beyond the daily cap path. `scripts/smoke-adventure-deepspace.mjs` (14 checks) drives all five through test hooks on `__advShip`; the music is a re-tune of existing moods, and the gravity, drain and gate numbers are guesses. Seen in screenshots, not on a phone. Not done: carrying energy between maps, a real galaxy map, the Harvesters appearing in these maps.
- **Light-speed button and film voice-over (owner, 2026-10-12).** (1) Ship maps: a ⚡ LIGHT SPEED button in the right pad (`[data-light]`, latched through `keys.lsReq`). **Pressing it runs a 3, 2, 1 countdown (0.6 s a number, big number on the canvas, a rising beep each, `S.lsPre`) and then boosts (2026-10-13, owner: "faster, cooler, with a boost sound and a countdown"):** for 2.6 s the stars, far planets and far rocks rush past much faster (`S.ls` eases to 1, `S.vt` runs 13x), the ship is 60 % faster, rocks come 80 % faster, 90 long speed lines draw, there is a white flash and a hard shake at the launch, and `lsboost` plays two rising "zoom, zoom" sweeps with an air rush and an engine rumble (`adventure-sfx.ts`; `lscount` is the beep); then a 7 s recharge shown as a bar on the button. Heard by no human, seen only in headless tests. It gives NO invulnerability and no shooting change, so it cannot be used to skip a timed map. (2) Every Adventure film (opening, each map, epilogue) is narrated: `adventure-cine.tsx` speaks each shot's caption (the objective card reads the mission and its goals) through `speakDeviceOrNative` (`speech.ts`: the device's own voice, the Capacitor TTS plugin in the Android app; free, no server) in the voice language, with a rate fitted to the shot's length (`CPS`). Two buttons top-left: 🎙 voice (TH/EN/ZH/off) and CC subtitles (TH/EN/ZH/off), both defaulting to the player's language and remembered in `tg_adv_vo` / `tg_adv_sub`; subtitles off hides the caption, titles and goals follow the subtitle language. NOT verified: the Thai and Chinese voices exist only if the phone has them installed (on a phone without one the film is silent in that language), the first line may be blocked by a browser that wants a tap first (the voice button works as that tap), and nobody has listened to it on a phone. `scripts/smoke-adventure-voice.mjs` records `speechSynthesis.speak` calls and checks the buttons, the languages and the light-speed button.
- **Sector 4: the Solar System campaign (owner, 2026-10-12: Moon He-3 mining and base, Mars, Mercury, a Venus cloud colony, Jupiter gas, Saturn rings, Titan, and a generation-ship Ark that moves people to another star).** A fourth menu tab (`SOLAR` in `adventure.tsx`, saved as `tg_adv_sector = solar`), eleven maps in this order, locked one step at a time like every sector: **Moon · mine Helium-3** (ground `mine`), **Lunar Base** (ground `dyson`: assemble habitat modules), **Mars** (ground `survival`: hold the colony dome 90 s), **Mercury** (ground `capture`: take three collector stations), **Venus cloud colony** (ship `harvest`, `sky: venus`: dock at floating platforms), **Jupiter gas** (ship `skim`, `sky: jupiter`), **Saturn rings** (ship `belt`, `sky: saturn`: mine ice), **Titan assault** (ground boss map, the Titan Guardian), **Titan colony** (ground `dyson`), **Shipyard: build the Ark** (ground `dyson`: four sections) and **Exodus** (ship `warp`, `sky: ark`: the player flies the Ark, a town-sized generation ship with a spinning gravity ring, green farm domes and animal decks, through three warp gates to a new star). Each has a film, th/en/zh captions and goals, a brief and a mood. **Honest limit: these maps REUSE the existing mission engines with new skins, scenery and texts (mine, dyson, survival, capture, harvest, skim, belt, warp); none has a bespoke mechanic of its own, the Ark has no farm or gravity gameplay (it is a drawing), and the numbers (`hard` 1.6 to 3.6) are guesses.** `scripts/smoke-adventure-solar.mjs` (16 checks) opens all eleven and checks the order and the locks. Judged from screenshots, not on a phone.
- **Ark Bay: outfitting the Ark (2026-10-12, follow-up to Sector 4).** `adventure-ark.ts` (pure): five lines bought with crystals only (`tg_ark`, levels 0-5, cost 30/60/90/120/150): **gravity ring** (0.4 g to 1.0 g; people need about 0.8 g to arrive healthy), **farm decks** and **livestock decks** (food days against a 600-day trip), **habitat** (8,000 to 128,000 passengers) and **hull and shields** (+12 % hull points per level in the Exodus run). The panel (`[data-ark]`, five `[data-ark-line]` rows and a stats line) shows on the Solar System tab; the Ark in Exodus is drawn from the same levels (more green farm domes, a bigger gravity ring, more lit windows, livestock lights), `HP` follows the shields, and the result card says how many people reached the new star (passengers x (0.6 + 0.4 x remaining hull)) and whether the food lasts. Never sold, no coins. `scripts/smoke-adventure-ark.mjs` (9 checks). It is still outfitting numbers around the existing warp run, NOT a farm or gravity simulation; the formulas are mine, not the owner's.
- **High-end graphics on the ship maps (owner, 2026-10-12: prettier for strong devices).** When Graphics is High (gear pop-up) `adventure-ship.tsx` adds, through `HI()`: layered drifting nebula clouds (`nebSprite`, three tints, parallax), glowing twinkling stars, a heat trail behind the ship, lit and cratered rocks, soft glows on shots, drifting foreground dust, 1.8x the explosion sparks, a bloom pass (the frame shrunk twice and stretched back at alpha 0.3) and a colour vignette. All sprites are painted once. **A frame-time watchdog (`hiOk`) turns the extras off for good for that run if the average frame stays over 30 ms for about 60 frames**, so a weak device quietly falls back to the Standard look: measured with the CPU slowed 4x in headless Chromium, High settles at 27 fps, the same as Standard (before the watchdog it sat at 14 fps). Standard is unchanged. Judged from screenshots (Void Gate, Asteroid Field); nobody has looked at it on a phone, and the cost on a real GPU was not measured.
- **The Ark's farm decks: two management maps (owner, 2026-10-12: grow food with advanced technology and raise gene-edited animals to feed the settlers).** `adventure-farm.tsx` (own lazy chunk, DOM only, `P.mission = "farm"`, `P.kind = plants | herd`): **Ark Hydroponic Farm** and **Ark Livestock Farm**, placed after the Ark shipyard and before Exodus in Sector 4 (13 maps now). Six beds or pens, three resources that drain while things grow (water, LED light, nutrients; or feed, water, vaccine) and refill by a tap with a 1.1 s cooldown, five crops or animals each with its own grow time and yield (algae to low-water rice; crickets to fish, chickens, pigs and cows), outbreaks that must be treated within 8 s or the bed is lost, three technologies bought with the food already made (plant-spectrum LEDs, high-yield gene-edited crops, aeroponic mist; or gene-edit fast growth, gene-edit disease resistance, a feed-saving microbiome), a 150 s clock and a target (600 + 60 x the Ark's habitat level; calibrated by `scripts/sim-farm-balance.mjs`, which re-implements the rules: a careful player makes about 850 in 150 s on the plants farm and 750-960 on the herd, a lazy one about 450, a player who ignores the resources about 16, so the first target was far too easy and was raised) — tie-in with the Ark Bay: farm decks (plants) or livestock decks (herd) add 8 % yield per level. Rotating fact lines (hydroponics, LEDs, algae, gene editing, vaccines) teach as you play. Win = crystals (12 to 20) + EXP and the usual clear card with the harvest and stars; time up shows Retry (`onRetry` bumps `farmKey`). It has the gear pop-up. `scripts/smoke-adventure-farm.mjs` (19 checks) drives it through `window.__advFarm`. **The target is now measured against a simulated player, not against a human: nobody has played it, and the gene-editing is a game idea, not a claim about real farming; the facts shown are general statements, not measurements.**
- **Longer, varied films with their own mood (owner, 2026-10-12: 5-10 shots a map, more detail, mood, music, and no aliens in a shot about gathering resources).** `basePlan` in `adventure-cine.tsx` now builds a sequence by `catOf(P)`: **fight** (approach, descent, landing, crew, the map, warning, lore, boss), **work** for mine / dyson / farm / capture / survival (approach, survey, descent, landing, the harvest itself, storm, a message home, lore, dawn; the farm maps skip descent and landing) and **ship** (approach, survey, cockpit crew, the sector, radar warning, a message home, lore). New code-drawn scenes: `sceneSurvey` (scan grid, markers, readout bars), `sceneDescent` (re-entry plasma, cloud decks, shake), `sceneLanding` (touchdown dust, robots step out), `sceneCrew` (close-up of the pioneer against a viewport), `sceneWork` (a drilling rig and ore belt, Dyson frames filling, hydroponic rows, a beam pylon), `sceneStorm`, `sceneSignal` (a dish talking to Earth, the reply), `sceneWarning` (radar sweep, hazard stripes, a silhouette) and `sceneDawn`; `sceneSurface` got a `quiet` flag that leaves the horde and the lone robot out. Captions for the new shots are templates (`NEWCAP`, `{n}` map name, `{r}` the map's resource from `RES`) in th/en/zh. The score (`scheduleCineScore`) gained one cue per new kind and a soft **piano** (`pn`) that carries the calm shots (crew, signal, survey, landing: no brass theme, timpani roll, heartbeat or cut-hit there). A film is now 8 to 13 shots and about 55 to 80 s with the 1.6x stretch; Skip and tap-to-advance are unchanged. `scripts/smoke-adventure-films.mjs` pins the sequences, the subtitles in th/en/zh and zero page errors; `smoke-adventure-cine.mjs` has the new shot lists. `__advCine.jump` now clamps its index (an out-of-range jump set the film clock to NaN and every frame threw). **Not verified: nobody has watched or heard these on a phone; the music is generated, not composed by a person; the owner's report of an error when entering Act 2 map 3 (Under the Harvesters' Eye) could NOT be reproduced (locked and unlocked, th/en, portrait and landscape, Standard and High, with and without the film, arriving by the warp gate, playing the full 50 s): it may need the phone's own error text.**
- **The chat chip plays any key, in any spelling, and three more kinds of answer (owner, 2026-10-12: "Ab Major Scale won't play; some answers have no play button, I want everything playable on the piano").** `extractNotes` (`music-engine.tsx`) used to look keys up in `KNOWN`, 12 sharps-only keys read as lower-case English words, so "A♭ major scale", "A-flat", "เอแฟลต", "降A" and every key the table lacks (C♯ major, E♭ minor, G♭ major…) got no chip, and "C# major scale" / "Db minor scale" were answered with the OTHER quality of the same root. Now `normMusic` folds the spellings (♭ ♯, "A flat/sharp", Thai letter names + แฟลต/ชาร์ป, Chinese 降/升) and `keyedFromText` finds the first "root + quality" (also "major scale of Ab", `Cmaj7`/`Dm7`/`G7`/`Csus4` next to the word chord, diminished, augmented) and `keyedBuild` BUILDS it from `SCALE_DEF` / `CHORD_DEF`, so every key plays; `KNOWN` stays as the fingering source and the fallback. The lesson picker's `forceKey` path builds the same way. Three more readers run last: an interval ("a perfect fifth above C", "E to G is a minor third"), a Roman-numeral progression ("I – V – vi – IV in G", mode `prog`), a bare run of note names ("C E G B") and "middle C", each only when the text clearly says it. A label now shows ♭/♯. `scripts/smoke-extract-notes.mjs` has 34 checks (the A♭ spellings in th/en/zh, the two wrong-quality bugs, chords, intervals, progressions, and that ordinary prose still gets no chip). NOT done: melodies of real songs, rhythm patterns, and ear-training answers still have no chip; an answer in Thai or Chinese that names a key only by solfège or "the 4th key" is not read.
- **Film narration is a narrator, not a read-out, and the opening film has its own score (owner, 2026-10-12: "the opening film has no music or voice; the English voice-over is not natural, find a better voice, in Thai and Chinese too").** A web page cannot ship a studio voice for free (cloud TTS through `piano-tts` costs money per player and is gated to paid plans, so it was NOT used for films), so `speech.ts` now picks the best voice the device HAS and speaks the way a narrator does: `narratorVoice(locale)` ranks installed voices (neural / online / natural / Enhanced / Premium / Siri first, known narrator voices per language ahead of the rest, deep male voices preferred, compact / eSpeak / novelty voices last), `narrationText` rewrites what engines read badly (dashes, middle dots, "%", "TIGA" as Teega / ทีก้า / 提加, "AI" as A I, helium-3), and `speakNarration` reads one sentence at a time with a 170 ms breath, a lower pitch and a slower pace (the same path inside the Android app through the Capacitor plugin). `adventure-cine.tsx` uses it for every film. The opening film (`P.id === "prologue"`) and the epilogue (`"finale"`) have their own moods in `adventure-music.ts` (they fell through to Luma's). **A phone may start Web Audio and speech muted until the first touch**: `createCineAudio` now returns `resume()` / `running()`, a "Tap to turn the sound on" chip (`.ac-snd`) shows when the context is suspended or the engine reports it was blocked, and any tap on the film resumes the audio and re-reads the current line. `scripts/smoke-adventure-voice.mjs` also opens the opening film in en / th / zh and checks the score starts and the line is narrated in that language. NOT verified: how any of it sounds on a phone, which voices a given phone has (a phone with only a compact Thai or Chinese voice will still sound robotic, and the fix for that is installing a better voice in the phone's text-to-speech settings), and whether the tap chip is what the owner was missing; the cause of "no music in the opening film" was not reproduced in headless Chromium (there the audio context also starts suspended, which is the case the chip now handles).
- **First-person view and the Adventure 3D system were REMOVED from Adventure and Adventure Online (owner, 2026-10-12: "cut first person view everywhere", then clarified: Adventure and Adventure Online only, back to the old 2D).** `adventure-3d*.ts(x)`, `adventure-deck-hook.ts` and their tests are gone and the Adventure screens are back to their pre-FPV / pre-3D code (gear pop-up: Standard / High; `tg_adv_gfx` is `standard` | `high`, a stale "3d" is ignored). **PvP keeps its first-person button** (`fpv.tsx`, restored; only `pvp-arena.tsx` uses it now). The `three` dependency stays for the older PvP/pet 3D scenes. Do not rebuild either in Adventure unless the owner asks again.
- **A more natural walk (owner, 2026-10-12: "the robot's walk looks very funny, make it natural").** The hero stills are drawn from a more side-on angle (`yaw` 52, was 26: from the front a leg swing is foreshortened and the robot looked like a stiff mannequin), and the walk/run cycles bend the knee of the leg that swings forward and the elbows (`kneeL/kneeR`, `elbowL/elbowR` in a pose object, read by `cyber-avatar.tsx`; other poses leave them out and are unchanged). Judged from headless screenshots of the walk frames; a first run cycle had both legs thrown back like a jump and was reduced. Not seen on a phone.
- **More weapons found per map, prettier gun art, smaller lightning, a faster minigun and a flamethrower (owner, 2026-10-12).** (1) New drop guns `flame` (flamethrower: a stream of piercing fire puffs, 0.04 s, short range, drawn as growing radial fire), `plasma` (slow glowing orb that explodes on hit or at the end of its range, r78) and `frost` (ice shards that slow what they hit for 2.2 s); all three are `drop: true` in `GUNS`, so they appear in the Loadout once found. (2) `PLANET_WPN` gives each planet 2-3 signature weapons that are added to the drop pool twice (`rollWeapon(..., planetId)`): Luma shotgun/minigun, Ferro flame/sword, Jovia plasma/laser rifle, Kryo frost/railgun, Pyra flame/RPG/plasma, Nexa big beam/railgun/frost, and the later maps their own. (3) `WPN_SVG` was redrawn for every gun with metal gradients, highlights, glowing emitters and per-weapon accents (the weapon is still an overlay at a fixed spot over the hero's chest, not attached to the hand). (4) The BOLT lightning is about half as thick (glow passes 16/9/3.6/1.6 instead of 34/20/7.5/3, smaller target flares and sky-strike flashes). (5) The minigun fires every 0.032 s (was 0.07) at 0.15x per bolt (was 0.28x), so DPS is a little higher, with a wider spread, and plays its sound every third shot. Balance numbers are guesses; seen in headless screenshots only (the flame in-game), not on a phone. `smoke-adventure-weapons.mjs` covers the three new guns firing and the flame burning a monster.
- **The held gun sits at the hand (2026-10-12).** `.adv-wpn` moved from chest height to the hand/hip (`left:46%; top:43%` of the hero box) so a gun reads as held beside the body in the side-on stills. It is still an overlay at a fixed spot, not tied to the arm joint, so during strikes it does not follow the arm. Seen in headless screenshots only.
- **Backlog round (owner, 2026-10-12: "do everything that is still pending, do not keep asking").** (1) **`AdvGuard`** (`adventure-settings.tsx`) wraps every map render (film, ship, farm, yard, ground run): a render crash shows "This map ran into a problem" WITH the error text, writes `adv` `err:<map>:<message>` to `usage_events`, and offers Try again / Back to the map; it exists because the owner's "map 3 of the Harvester act errors" could not be reproduced and a screenshot of that text will name it (an error thrown inside a requestAnimationFrame callback is NOT a render error, so those are still not caught here). `tg_adv_crash=1` is its test switch (`scripts/smoke-adventure-guard.mjs`). (2) **Enemy ships and the Hive Mothership** got a finishing pass, `enemyFX` / `bossFX` in `adventure-ship.tsx` (exhaust plume, travelling glint, lit rim, running lights; the mothership adds a big plume, lit window rows, lights circling the armour, glowing cracks in the rage phase and a shield shimmer). (3) **A Harvester seen from far away** (`drawHarvesterFar`: a dark ring-and-spoke machine round a dim star with a slow red scan) on Warp Gates, Black Hole, Solar Array and Dyson Dock: scenery only, they are still never fought. (4) **The Ark shipyard is its own game** (`adventure-yard.tsx`, `P.mission = "yard"`, Sector 4 map `arkbuild`; it used to be the Dyson digging map with new words): eight modules on a spine of eight slots, nine live rules each with an engineering reason (bridge at the bow, engines at the stern, the reactor touching the engines, the shield behind the bridge, the gravity ring in the middle, the habitat beside the ring, the farm touching the livestock deck, farms away from reactor heat, centre of mass in the middle), solved when all hold, stars by number of moves, clear card and crystals like the farms. `scripts/smoke-adventure-yard.mjs`. (5) **Random waves are shared a little more in a room**: Jovia's waves already carry ids (`1000 + wave * 10 + n`), and they now gather round the TEAM's mean x (`teamX`) instead of each pilot's own x, so the same id stands in about the same place on every screen; wave TIMING is still each client's own clock, so this is better, not solved. (6) **Best times** (plan 33 O5): `RUN_T0` starts when a map starts (after its film), `markDone` records the time in `tg_adv_best` and calls `submitAdvTime`; a "Best times" button on the menu opens `RankPanel` (your best + the top ten from the board). **`supabase-adv-ranking-migration.sql` is APPLIED (checked read-only on the live DB 2026-10-13: table `adv_best_times` and the three functions exist).** It is the part of "server authority" that needs no game server: the server refuses a time under the map's floor (`adv_min_secs`), flooding (5 s), a bad name, and pays nothing, so a cheater can at worst put a false time on a board. Real server-side combat authority (damage, hits, rewards in a room) is NOT built: it needs a game server or a Realtime-authoritative edge function, and the owner's approval to deploy it. NOT done: carrying energy between maps, a galaxy map, Kindred characters on the ground maps, the Ark gravity/farm as live gameplay inside Exodus, real-phone and real-Realtime testing of any of it.
- **Energy carried between maps (2026-10-12).** `tg_adv_energy` (0-100, local): the first clear of a harvest, skim, solar, capture, survival or dyson map adds 20 (`markDone`); the menu shows it (`[data-energy]`); a map that starts with 50+ spends 50 and gives +25 % crystals on that map (`ENERGY_BOOST` in `gainCry` and `settleShip`). Crystals only, never coins. Not tested in a browser beyond the build; not seen on a phone.
- **Galaxy map (2026-10-12).** A "Galaxy map" button beside Best times opens `[data-galaxy]`: four sector nodes (progress ring, cleared n/N, the next uncleared map) joined by a dashed route; tapping a node opens that sector (`[data-gnode]`, same as the tabs). Display only, no new state. Covered by `smoke-adventure-energy.mjs`; not seen on a phone.
- **Kindred elders also on Dark Forge (2026-10-12).** The beacons of the Dark Forge are drawn as Kindred elders too (`paintKindred`) and greet with their own line ("we will help you steady the dark matter"); every other ground map still has the usual beacons. `smoke-adventure-act2.mjs` checks both maps. Seen in no screenshot yet; not on a phone.
- **Exodus shows the Ark live (2026-10-12).** On the Exodus run (`SKY === "ark"`) a canvas readout bottom-left shows the trip (day n/600, advancing with the warp gates passed), the food left in the holds against that day count (`ARKST.foodDays`, red when it runs out) and the ring's gravity (amber below 0.8 g). It is a display of the numbers the Ark Bay already sets; it does not change the run or the result, and there is still no farm or gravity gameplay inside Exodus (the farm decks are their own maps). Covered only by the existing `smoke-adventure-ark.mjs` (no page errors); not seen in a screenshot or on a phone.
- **The hero walks, runs and strikes with real frames; the dash button is gone (owner, 2026-10-12: "remove the crossed-out button, walking looks funny, punches and kicks are not realistic").** The robot used to be ONE picture that never turned round (it walked left facing right) and swapped between three poses. Now `heroPoseOf` (`adventure.tsx`) builds 8-frame walk and run cycles from joint angles (the rig in `cyber-avatar.tsx` takes a pose object), plus a jump tuck and a real move per strike (jab / hook / uppercut cycle on punch, front / roundhouse / sweep on kick, shoot, beam, throw); all of them are stored pictures (`HERO_FRAMES`, queued by `warmAdvFigures` when the menu opens, 28 stills) and the draw loop swaps the picture by `figureOf(key)` with no React render. The walk frame is chosen by the DISTANCE walked (`heroDist / STRIDE_PX`), so the feet do not slide; a small step bob follows it; the figure is mirrored with `scaleX(pl.face)`. Until the stills exist the old single-pose picture shows (live SVG as before). The ⟫ dash BUTTON was removed from the pad (the Shift / L key still dashes). `smoke-adventure-pad.mjs` checks the button is gone. Judged from screenshots in headless Chromium only (a walk frame, a kick, the left-facing mirror); not on a phone. NOT done from the same request: weapons that drop and change the hero's weapon (sword, shotgun, laser, minigun, RPG, railgun, grenades), a machine gun, grander lightning and rockets.
- **Weapon drops, six new guns, RPG and grenades, grander lightning and rockets (owner, 2026-10-12).** (1) **Drops:** a monster has a 4.5 % chance to drop a weapon crate (a glowing ★ box), a boss always does (`rollWeapon`, pools by the map's `hard`: easy maps minigun / shotgun / laser sword, mid maps add laser rifle / RPG / frag grenade, hard maps add railgun / big beam laser; a weapon you already own only drops again from a boss). Walking over it EQUIPS it at once (`equipWeapon`, "NEW WEAPON: name") and keeps it: `tg_adv_found` lists what was found, the Loadout menu shows a found weapon from then on (`GUNS`/`ROCKETS` entries with `drop: true` are hidden until found), and `readLoad` refuses a drop weapon that was never found. (2) **New guns** in `fireBolt`: **minigun** (0.07 s, spread, casings), **shotgun** (7 pellets, short range), **laser rifle** (instant hitscan, first foe), **railgun** (instant, pierces everything on the line, 2.4x), **big beam** (a wide instant beam through everything, 3x) and **laser sword** (FIRE becomes a 190 px melee arc, 1.7x); `hitscan` damages along the line and `beams` draws it. Rockets slot gained **RPG** (fast straight rocket, r125 4.6x) and **frag grenade** (lobbed, r115 3.4x). (3) **Grander effects:** every explosion has a white-hot core flash, big ones (r >= 90) a second shock ring, debris and shake scaled to the radius; the rocket launch sprays sparks and a bigger muzzle flash; lightning is thicker (four passes) and every foe it reaches is also struck from the SKY by a second bolt with a flash and sparks. (4) **The weapon in hand** is a small SVG (`WPN_SVG`, one per gun) over the hero's chest, raised while firing, swung for the sword. Honest limits: the weapon is an overlay at a fixed spot, not attached to the robot's hand joint (the poses move the arm independently), the drop chance and the weapon numbers are guesses, grenades other than frag (sticky, EMP) and a per-map weapon upgrade level are NOT built, and none of it was seen on a phone. `scripts/smoke-adventure-weapons.mjs` (15 checks: pick-up equips and persists, RPG slot, every gun fires, sword and rifle damage, no page errors).
- **Payment alert for the top-tier admin (owner, 2026-10-12: "when someone pays for Premium, notify the top admin so I can confirm the transfer").** `admin-pay-alert.tsx` (lazy, rendered in `PianoApp` only when `adminTier >= 3`): a customer's payment is a `payments` row with `status = "pending"` (slip uploaded in `CheckoutModal`, confirmed by hand in `AdminPayments`); the component reads pending rows (RLS already lets an admin read them), through a Realtime subscription (instant, only if the table is in the Realtime publication) AND a 25 s poll plus a check on focus (always works). A pending payment not yet announced (`tg_admin_pay_seen` holds the ids already announced) gives a pop-up card (customer, plan, amount), a three-note chime, a vibration and, once the admin has granted it, a system notification; a "💰 n to confirm" chip stays top right while any are pending. "Review slip" sets `#admin-payments` and opens the admin page (the console's lock code still applies; an already-open console switches tab through a `hashchange` listener beside `adminTab`). No database change. **Limits: it only works while the app is open in a browser or the installed app; a closed app needs web push through a server function (not built, would need the owner's approval to deploy); school payments (`school_payment_requests`) are not watched; a payment made by Stripe (not a slip) never appears as pending.** `scripts/smoke-admin-pay-alert.mjs` (stubbed table: chip, card, seen list, jump, a lower tier sees nothing, nothing pending shows nothing). Not tried with a real payment.
- **Weapon levels and two more grenades (2026-10-12, the leftovers of the weapon request).** (1) **Levels:** picking up a weapon you already own levels it up (`levelUpWeapon`, `tg_adv_wlv`, Lv 1-5, +12 % damage per level, "WEAPON LEVEL UP" pop-up, "Lv n" beside its name in the Loadout); `rollWeapon` therefore also drops owned weapons, at 60 % of the normal chance, and the pools gained frag (easy maps), sticky (mid), sticky and stun (hard). The boost is applied with `wpnBoost` around the shot being made (`fireBolt`, `hitscan`, and a rocket's explosion through `r.wm`, which bomblets inherit); punch, kick, skills and bolts are NOT boosted. (2) **Sticky grenade** (`sticky`): lobbed, lies where it lands or sticks to the first monster it touches and follows it, explodes when the 1.3 s fuse ends (r135, 4.4x). **Stun grenade** (`emp`): r175 blast (1.2x) that freezes every monster in range for 2.5 s (`slowT`/`slowF = 0`, the same state the stun skills use) with three sky arcs. Honest limits: the boosts and radii are guesses, the stun does nothing to a boss, and a level shows only as text. `__advTest.rocketsLive()` counts rockets in flight (the older `rocketsN` counts rockets FIRED: a name clash cost a debugging round). `scripts/smoke-adventure-weapons.mjs` covers levels (+1 each, stops at 5), the sticky fuse and the stun grenade.
- **Adventure menu and Online lobby follow the app theme (owner, 2026-10-13).** The map menu (`.adv-menu`) and the Online lobby inside it use the app tokens (`--bg --card --card2 --text --text2 --muted --bd* --clay`) through the last CSS block of `adventure.tsx`, so light and dark both work; a map card tints itself from the planet colour (`--c0`) over `--card`. The long story paragraphs are folded under "About this mode", the ore / Dyson / crystal counts are chips, and the sector tabs scroll sideways in one row. The runs, films and ship maps stay dark on purpose (they are the game). Selectors the smoke tests use are unchanged. Seen in headless screenshots (light and dark, 450 px), not on a phone.
- **Adventure menu for ages 8+ and adults (owner, 2026-10-13: "easy for an 8-year-old, still fun for adults, not childish").** One big "Start here / Continue" button (`[data-continue]`) opens the next open, uncleared map of the current sector; the first visit shows a three-line how-to-play under "About this mode" (`tg_adv_seen`); Upgrades & gear (skills, Ark Bay, workshop, loadout), Today's quests and Settings are three folded groups (`details.adv-grp`, `data-grp`), open by default only for admins and the bots (`tg_adv_unlockall`) so existing tests still reach `[data-up]` / `[data-w]`. Wording stays plain and adult-neutral. Seen in headless screenshots only; no real child or phone tested.
- **First-run tip inside a map (2026-10-13).** The first map a player ever starts shows one banner after the briefing (`tg_adv_tip`): arrows to move, shoot, jump, grab ◆, reach the gate, in th/en/zh. Shown once per device, skipped by the bots (`tg_adv_nogate`). Not seen on a phone.
- **The menu has no explanation text; the film teaches (owner, 2026-10-13).** The "About this mode" block is gone from the Adventure menu. The opening film ends with a `howto` shot (`COMMON.howto` th/en/zh, hero close-up with four pulsing control icons, `drawHowto`); a player who already saw the opening film gets that shot once in their next map's film (`tg_adv_howto`, set inside `cinePlan`, skipped when `tg_adv_prologue` is `skip` so the bots' shot lists stay unchanged). Every cut now has a short flash, light ring and speed lines (`hypeCut`, 0.45 s, under about three flashes a second). Nobody has watched it on a phone; no claim is made about real hormone effects, it is pacing and light only.
- **Octave range on the Teacher page (owner, 2026-10-13).** A "Range" drop-down (1 to 4 octaves) sits to the right of the Record button on the Teacher page and is never disabled (owner: it could not be pressed while no demo was loaded); with no demo on the keys it uses a C major scale. 1 keeps the usual portrait view; 2-4 open `OctaveStage.tsx`, a full-screen landscape view (fullscreen + orientation lock when the phone allows it, otherwise the screen turns itself 90 degrees): the top half of the screen holds BOTH hands (the chosen one shows the finger, tap a hand to switch) and the bottom half the keyboard over the whole range (rendered in a portal on `document.body`, otherwise the app header covered it), with an orange running light (`.ost-run`) gliding to the key being taught and the taught keys tinted orange, the note names on top, finger numbers on every taught key (big on the lit one, `fmap`), the two hand cards small and flush with the left corner, and two staff cards (`StaffCard`, five lines with a hand-drawn treble clef, or a bass clef when the left hand is chosen: the left hand then also starts an octave lower, C3, on the keys and the staff, each card two bars of four quarter notes, always the lesson going UP then coming back DOWN, built from the same pattern as the keys (`staffSeq`), the taught note orange, paging every 16 notes; one octave fills the two cards exactly, longer ranges page through, and a card whose notes run far above or below the staff stretches its view box and scales down so nothing is cut off) beside them, a Play button that plays the pattern, tap-to-play keys, left/right hand switch. The pattern is the one-octave demo repeated one octave higher (`extendPattern`), the junction note takes finger 1 like a real scale. A chord or arpeggio demo (shorter than an octave) repeats every note in each octave and ends on the root one octave above, with the demo's own fingers repeated; this is a simple repeat, not a teacher-checked fingering. Unless the demo is playing, the orange light waits on the key the learner must press next ("your turn"): the right key moves it on (and wraps at the end), a wrong key flashes red and the light stays; a full round shows a short praise line with the honest count of slips and the hint line counts finished rounds (no EXP or coins attached); `scripts/smoke-octave-stage.mjs` covers it. A ↑ / ↑↓ button chooses going up only or up and back down (the top note is not repeated).  Only the build was run; nobody has seen it on a phone.
- **Simple pad for a brand-new player (2026-10-13).** Until a player has cleared one map, the control pad hides rocket, bolt, kick, the skill buttons and the spell button (`.adv-pad.simple`, `simplePad` in `Run`), leaving move, fire, jump, punch (and dig on resource maps); they all appear after the first clear and the keyboard keys work from the start. The bots set `tg_adv_unlockall`, so they see the full pad. Not seen on a phone.
- **Plainer HUD bars (2026-10-13).** In a ground run the top-left bars read "❤ HEALTH" and "★ LEVEL" (Thai and Chinese too) instead of "HP" and "EXP", and are taller with larger text. The skill bar keeps its label. Not seen on a phone.
- **Clearer map-clear card (2026-10-13).** The ground-run clear card shows three labelled stat tiles (monsters beaten, crystals earned, time) and pops in with a short scale animation (off under reduced motion). The ship clear card has the same tiles for enemies (only when some were beaten, so the farm, yard and no-shooting maps do not show a zero) and crystals, with its mode-specific line (ore, fuel, stations, battery, farm…) kept under them; the farm and yard cards are unchanged. Not seen on a phone.
- **Warmer film score (owner, 2026-10-13: "warmer and more energetic").** `scheduleCineScore` (`adventure-music.ts`) gained a recurring hope theme on the soft piano (12 notes rising by step, every 8 s, fuller in the calm shots, quieter in the tense ones so alarms and blasts still lead), a slow string line that follows the chords, and a small bright bell at every cut. The cine smoke test still renders every score offline with no clipping (peaks 0.46-0.50). The in-run music also has a warm pad now: one soft held triangle chord per bar in `scheduleStep` (left out in boss fights), `smoke-adventure-magic.mjs` passes with it. Generated music, judged by numbers only: nobody has listened to it, and whether it feels warm is the owner's ear to judge.
- **Refuel pods on every ship map (owner, 2026-10-13: "give the ship recharge points — solar cells, nuclear or hydrogen — that raise its health").** `adventure-ship.tsx`: every 7-10 s a pod drifts in from the right (`cell` solar +12, `nuke` nuclear core +22, `h2` hydrogen tank +16 ship health, capped at max); flying into one heals with a green glow and a "+n" tag over the ship; Solar Array's existing panels also heal 5. Health only, no coins. `smoke-adventure-space.mjs` covers all three pods (`__advShip.givePod`). Heal amounts and spawn rate are guesses; not seen on a phone.
- **Adventure story canon (owner, 2026-10-11).** Year 2100, humanity is very advanced and goes out to find alien resources, settle other worlds, harvest energy from stars and gas giants, and fight aliens. Full note and how it maps to planets: `tigamodel/docs/29-adventure-story-canon.md`. Use it for any future Adventure text, planet or quest; nothing is built from it yet.
- **Plan 28 phase A (2026-10-09).** Left/Right hand is ONE toggle button (`.handtoggle`, Teacher page and Practice). The challenge nudge ("Ready to test yourself?") waits while a practice is open or an EXP toast shows and hides itself after 4.5 s. Practice fits one screen down to 320x568 (`@media (max-height:640px/600px)` blocks in `app-styles.ts`). `node scripts/smoke-layout-a.mjs` (Playwright, `dist/` built first, ~4 min; `SIZES=320x568 LANGS=en` for a subset) checks 4 sizes x th/en/zh x kid/adult: one hand button, no horizontal scroll, the "n / N" row above the footer, no primary button covered. NOT done: a full `OverlayQueue` (only the nudge is queued; the EXP toast stays top-fixed and the auto-teach popup keeps `atipDelivery`).
- **Plan 28 phase B (2026-10-09), Teacher page.** One `.nowcard` (under the piano and the hand toggle, above the chat, owner 2026-10-10) answers "what now": with a demo on the keys it is that demo's practice run (name, note count, about minutes, one big Start button, a "listen first" link); without one it is `recommendNext()`, the same source as Daily Mentor. The bottom Practice button was removed (it was a second primary). Record/playback sit under a folded "More" (`.sv-more`). The finger table is the `FingerHand` drawing (exported from `PracticeOverlay.tsx`), lit for the finger of the note on the keys. The piano label is short ("Tap to play"). The English tab is called "AI Teacher" (owner). The page body scrolls in `.sensei-scroll`, so the tab bar stays at the bottom. Header: under ux2 the PvP and profile header shortcuts are hidden (the Arena and Me tabs replace them).
- **Plan 28 phase C (2026-10-10).** C1: a "Detailed mode" switch in Settings (`tg_detail`, root class `detail`, `readDetailPref`/`writeDetailPref` in `shared-infra.ts`); kid mode always wins and stays simple. Today it adds the miss count to the practice stats row (accuracy % was already shown to adults). C2: the sung note name (Do Re Mi / โด เร มี) already shows under the letter for everyone, so nothing changed. C3: a light `haptic(6)` when the right key lands in Practice, nothing on a miss, no new sound (mic-safe rule untouched). C4: practice/teacher buttons are at least 44px tall (kid mode 54px). The owner's open questions (switch vs button, Thai solfege default) were answered by taking the plan's recommended defaults; change them if the owner says otherwise.
- **Plan 28 phase D (2026-10-10), what is and is not in.** D3: on the practice result, two clean rounds in a row (accuracy >= 90 and the previous best >= 90) show ONE button, "Try the other hand" (it flips `hand` and restarts; the finger recompute effect in `use-practice-mode.ts` already follows a hand change); nothing is offered from thin data. D1/D2/D4 already existed (the confidence rules in `learner-signal.ts`, the Spot Drill launcher on the result, one-sentence summary + one button). NOT done: D3's "slower-to-faster" / "new key" options and the two-rounds-in-a-row memory (it uses `prevBest`, the best so far, not the previous round), and, shipped after the owner's go-ahead on 2026-10-10, D5: the level-2/3 help is recorded as a `learning_intervene` row (`practice-help-L2/L3`, skill `practice-note`) and the learner's very next try at that note as a `learning_practice` row linked to it (`openHelpLoop`/`closeHelpLoop` in `use-practice-mode.ts`). It goes through `learning-data.ts`'s own gate (signed-out learners write nothing; a failed write only queues). UNVERIFIED against the live DB: `check-learning-wire.mjs` could not reach it from this container, and the practice smoke only proves the round is unchanged, not that rows land.
- `node scripts/smoke-ux2.mjs` drives the built app for the premium interface (off by default, `?ux=2`/`?ux=0`, five tabs, 320 px, and NO large Pathway title — the owner struck it out on 2026-10-09; do not bring it back).
  `verify-chat.mjs` was brought back in line with what ships (2 free / 10 Premium questions a day, the persona's current wording, the KB ceiling, the
  suspended speaker via `SPEAK=1`).
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

### A finished song must not depend on the frame loop to reach its result
Reported 2026-10-05: after a song ends in Play Along it does not go to the
assessment page. The result screen was never the problem — it renders
correctly for a finished run, and `scripts/verify-playalong-end.mjs` proves
that against the real component. What could strand a run was the ending,
which lived entirely inside the `requestAnimationFrame` chain in
`use-play-along.ts`: one frame that threw, or a chain the browser dropped, and
`songFinishedRef`/`songRunRef` stayed true, the stage froze on its last picture
and `setSongPhase("done")` never ran — the only way to the score was to back
out and start again. Two rules came out of it:

- the end of a run is `songRunEnded(songTime)`, one function, asked by the
  frame loop **and** by `hudTick`'s own 120 ms interval. The drawing may die;
  the ending may not.
- `songLoop` wraps `songFrame()` in try/catch and reschedules. An exception
  inside a rAF callback kills the chain and nothing ever schedules the next
  frame, so an unguarded frame is a silent permanent freeze.

Same shape as the hook-order bug: a green build and `smoke-app-boot.mjs` prove
the app *starts*, not that a run ends. And `x > NaN` is false for every `x`,
so one non-finite note time in `expandSong`'s `lastT` reduce hangs a run
exactly as silently — hence the finite guard there, and the check that runs the
real `expandSong` over all 1,377 shipped songs and parses all 100,500
originals' beat strings.

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

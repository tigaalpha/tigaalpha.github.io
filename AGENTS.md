# AGENTS.md

Instructions for AI coding agents (Claude Code, Codebuff, or others) working
in this repository. Read this before making changes — it exists so that
independent agent sessions, run at different times by different tools,
don't conflict with each other or with the human owner's expectations.

**Talk to the owner in Thai.** Every message written to the owner (answers,
progress updates, summaries) is in Thai, including after a context reset.
Code, code comments, commit messages and file contents stay in English as
they are now.

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
top right corner, also in the pause card); `play-along-stage.ts` is the
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

**TIGA CHAT** (`use-chat.ts`, `chat-ui.tsx`, `chat-starters.ts`, the `.mov`
full-screen chat in `PianoApp`, `SenseiView.tsx`). `sendText()` is the one path a
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

## Where to look for current state

`git log --oneline -30` on the dev branch you're using is the most
reliable record of what's recently changed and why (commit messages in
this project describe intent, not just the diff). `MOBILE_BUILD.md` covers
the Android/iOS native build and release process in detail.

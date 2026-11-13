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


## Where the details are

`docs/agents-history.md` holds the long feature notes ("Structure" of each feature) and the dated log of what shipped, with the honest limits of each item. Search it before you touch a feature: `grep -n -i "play along\|adventure\|blog\|alien hunt" docs/agents-history.md`. Add new dated notes there (at the end), keep AGENTS.md for rules.


## Standing rules (condensed from the history; the full text is in docs/agents-history.md)

These came from owner decisions and from outages. They apply to every change.

- **Owner's main Adventure UI is not to be changed** (2026-10-17: "add if you like, but do not change the main UI I edited"). The map page, the pad, the HUD bars, pop-ups and settings layout stay; new things are additions (small pills, lines, effects).
- **Believable timeline for the story** (2026-10-16): every Adventure episode follows a plausible order in time and solves the problem the previous one left (orbit, then fuel and air, then food, then the colony). New episodes go into `CAMPAIGN` and `SECT_OF` after their prerequisites.
- **Releasing to main** (outages on 2026-10-16 and 2026-10-28): after EVERY merge into main (a) `grep -rn '^<<<<<<< '` over `*.ts *.tsx *.mjs *.html *.json` must be empty, (b) run `npm run build` in the release worktree and commit its output with the merge, (c) open the built app as a fresh player (no test switches) and demand zero page errors, (d) never `rm -rf bundle` before building (the build keeps the last 8 builds' hashed files so stale tabs still find their chunks); on a bundle conflict run `git checkout origin/main -- bundle index.html sw.js` and rebuild. Blog pages in conflict: take main's version, then re-patch with `BLOG_OFFLINE=1 BLOG_OUT=$PWD/blog node scripts/build-blog-pages.mjs`.
- **Append CSS inside the template string** of `app-styles.ts` (a rule after the closing backtick broke the build), and read the `npm run build` output BEFORE pushing main.
- **Test the default path.** A test switch (`tg_adv_unlockall`, `tg_test_hook`, ...) that changes which branch runs hides exactly the bugs real players hit (a TDZ crash shipped that way twice). Declare a name before any dependency array or `const` that reads it.
- **Cloud sync registry**: every `tg_` / `tiga_` localStorage key needs a decision in `cloud-sync.ts`; `npm run verify:cloudsync` fails on a key without one.
- **Languages**: user-visible strings use the idioms (`T(th, en, zh)`, `pickT`, `xl`, `by(map, lang)`), never `map[lang]` (undefined for the extra languages); extra languages come from `i18n-src/catalog.json` through `scripts/build-i18n-catalogs.mjs`. Arabic is right-to-left: pianos, staffs, game screens and canvases stay `direction:ltr`.
- **Things the owner said no to**: no play-time / rest reminders, no Skip button on music questions, no "first 10,000 only" scarcity line, no ads until the owner says so, the music college's name never appears in the app, game creatures and vehicles are own drawings (never a studio's name or design), coins and gems are never sold.
- **Honesty**: say what was NOT seen on a phone and what only a bot or a simulation checked; do not report SQL or edge-function deploys as done before the owner approves them.
- **Cost of agent work**: a default workflow subagent loads this whole file; for translation, review and read-mostly jobs use `agentType: 'Explore'` (it skips AGENTS.md, ~4x cheaper; it has Bash but no Write/Edit tool, so it writes files with `python3` / `printf` through Bash).


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

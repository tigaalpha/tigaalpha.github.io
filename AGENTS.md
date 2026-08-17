# AGENTS.md

Instructions for AI coding agents (Claude Code, Codebuff, or others) working
in this repository. Read this before making changes — it exists so that
independent agent sessions, run at different times by different tools,
don't conflict with each other or with the human owner's expectations.

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
  one already exists — `CheckoutModal`/`SchoolCheckoutModal`/
  `BuyCurrencyModal` in `payment.tsx` are all one PromptPay/Alipay/WeChat
  slip-upload pattern reused three times; a fourth payment surface should
  reuse it again, not reinvent it.
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

## Where to look for current state

`git log --oneline -30` on the dev branch you're using is the most
reliable record of what's recently changed and why (commit messages in
this project describe intent, not just the diff). `MOBILE_BUILD.md` covers
the Android/iOS native build and release process in detail.

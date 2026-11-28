# Blog translation progress (EN -> other languages)

Updated 2026-11-28 (owner order 16:37 of 27 Nov, done).

## 1. Old host in English articles - DONE
- 10 English articles written after the old-domain SQL held `https://tigaalpha.github.io/landing-en/`. Backed up in `public.blog_posts_backup_old_domain_2` (10 rows), updated in ONE transaction to `https://www.tigaalpha.com/landing-en/?utm_source=blog&utm_medium=seo&utm_campaign=<slug>`, read back: 10 fixed, none of the 10 still has the old host.
- 90 rows of the whole table still hold the old host (other languages / older rows; only the 10 were approved). Not touched.
- The writer is NOT in this repo (no file, edge function or workflow writes it). Guard at the database: `supabase-blog-host-guard.sql` (trigger, NOT applied, waits for approval).

## 2. One slug for every language - PLAN ONLY (skipped as risky)
- New translations use the English slug in every language ((lang, slug) is unique, so it is allowed); the Thai pilot already does.
- Existing queue translations are `<slug>-<lang>` and are live: they are NOT renamed (links would break without redirects).
- hreflang is built from equal slugs (build-blog-pages.mjs `set`). Proposal (not done): teach that builder that `<slug>-<lang>` is the translation of `<slug>`, so old and new translations link to the English page without any rename. Needs a code change + a build check, and the live (database) page path was not verified.
- The queue's own slug functions (blog_target_slug, blog_target_slug2) are left as they are; the new path does not use them.

## 3. Thai translations
- 20 pilot files in `data/blog-translation/th/`, promo block replaced by the stored `blog_translation_cta` text (`cta.json`), all pass `scripts/blog-translation-check.mjs th`.
- INSERT IS BLOCKED: anon cannot write `blog_posts`, the sandbox cannot reach Supabase, the Supabase MCP takes SQL text only (a 20-article batch is ~400 KB of Thai: not practical in a chat call) and neither the `http` nor the `pg_net` extension exists. Built instead: `.github/workflows/blog-translation-insert.yml` + `scripts/blog-translation-insert.mjs` (<= 25 rows per run, only checked files, ON CONFLICT DO NOTHING). It needs the GitHub secret `SUPABASE_SERVICE_ROLE_KEY`.
- Inserted so far: 0. Remaining Thai: 755 + the 20 pilot files waiting for insert.
- Pipeline per wave: 4 agents x 5 articles -> `blog-translation-finalize.mjs th` -> `blog-translation-check.mjs th` -> commit.


## Update 2026-11-28 (owner order 16:37)
- Host guard APPLIED (owner-approved): `trg_blog_host_guard` + `blog_host_guard()`; probe-tested (old links rewritten, rolled back, 0 probe rows left).
- The 90 old-host rows (10 each in ar es fr hi ja ko ru th zh) fixed in 4 transactions (25+25+25+15), originals in `public.blog_posts_backup_old_domain_3`; remaining old-host rows: 0.
- hreflang: `<slug>-<lang>` is now the translation of `<slug>` (`baseSlug` / `groupSlugs` / `sameGroup` in `scripts/blog-paths.mjs`; used by `build-blog-pages.mjs` and the live renderer `blog-live.mjs`). Every alternate points at its own slug, x-default is the English page, no URL changed. The live page still costs one slug query (it now asks for the whole group with `slug=in.(...)`). Checked with a 5-language fixture (fr / th / de pages all list en th fr de zh-Hans + x-default, reciprocal) and the existing blog smokes.
- Insert workflow: ran once (commit 130cce16): the 20 Thai pilot articles are inserted (`inserted-th.json`). Fixed in this round: non-th languages are stored as `<slug>-<lang>` (the queue rule), a missing English snapshot row is a clear error, the inputs go through env (no shell injection), lang / limit are validated.
- Remaining Thai: 755. Next: waves of 4 agents x 5 articles, finalize, check, commit, then the Action (lang=th, limit=25).

## Thai rounds (owner 2026-11-28: translate the rest, owner runs the insert workflow)
- Tooling: `scripts/blog-translation-batch.mjs th 25 <dir>` picks the next articles from the repo snapshot; agents translate (Sonnet, low); then `blog-translation-finalize.mjs th` and `blog-translation-check.mjs th --ok`.
- Round 1: 25 translated, 24 pass and wait for insert (`blog-translation-insert` th/25), 1 held (`adult-piano-restart-paths`: English promo is inline links, no bullet block; file in `held/th/`, listed in `skip-th.json`).
- Totals: translated 45 (20 inserted + 24 waiting + 1 held). Remaining untranslated: 730 (incl. the held one: 729 + 1).
- Round 2: 25 translated, 25 pass (all waiting for insert, together with round 1: 49 pending in the workflow queue). Translated 70 in total (20 inserted, 49 waiting, 1 held). Remaining untranslated: 705.
- Round 3: 25 translated, 25 pass. Rounds 1-2 are inserted by the owner (inserted-th.json = 69). Waiting for insert: 25 (round 3). Translated 95 in total (69 inserted, 25 waiting, 1 held). Remaining untranslated: 680.
- Round 4: 25 translated, 25 pass. Inserted by the owner so far: 94 (rounds 1-3). Waiting for insert: 25 (round 4). Translated 120 in total (94 inserted, 25 waiting, 1 held). Remaining untranslated: 655.
- Round 5: 25 translated, 25 pass. Inserted by the owner so far: 94. Waiting for insert: 50 (rounds 4 and 5). Translated 145 in total (94 inserted, 50 waiting, 1 held). Remaining untranslated: 630.

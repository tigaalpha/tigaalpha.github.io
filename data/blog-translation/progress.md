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
- Round 6: 25 translated, 25 pass. Waiting for insert: 75 (rounds 4-6). Translated 170 in total (94 inserted, 75 waiting, 1 held). Remaining untranslated: 605.
- Round 7: 25 translated, 25 pass. Inserted by the owner so far: 169 (rounds 1-6 of the first batch of insert runs). Waiting for insert: 25 (round 7). Translated 195 in total (169 inserted, 25 waiting, 1 held). Remaining untranslated: 580.
- Round 8: 25 translated, 25 pass. Waiting for insert: 25 (round 8) on top of 25 from round 7 if not yet run. Translated 220 in total (1 held). Remaining untranslated: 555.

## Owner target 2026-11-28 15:56 - every language has every topic
- `scripts/blog-topic-map.mjs` groups the snapshot into topics (same stem, or same cover_url) and writes `topics-summary.json` (counts; full lists with `TOPIC_LIST=<file>`). Source language: en, else zh, else th. Target slug: stem for th/en, `<stem>-<lang>` otherwise.
- 3,693 topics. Missing per language: th 2225, en 2281, zh 2302, es 2919, hi 2955, de 3087, ar 3136, fr 3138, ru 3386, ja 3387, ko 3392 = 32,208 translations in all.
- Thai alone: 606 from an English source (the queue I was already working on: 555 not translated + 50 waiting for insert + 1 held), 1,619 from zh/ja/ko/ru/hi/es/fr/ar sources whose body is NOT in the snapshot (only English bodies are): the snapshot Action needs a body-fetch list for them (one controlled read, not repeated).
- At 25 articles per round (about 4 minutes), 32,208 articles = about 1,290 rounds: this is a multi-week job at the current pace; order as the owner set: th, en, zh, es, hi, de, ar, fr, ru, ja, ko.
- The insert script and workflow take any `lang`; `cta.json` only has a Thai entry so far, so other languages need their stored CTA row (public.blog_translation_cta) copied into cta.json before finalize works.
- Round 9 (first round under the owner rule "translate faithfully, no rewriting"): 25 translated, 25 pass. Inserted so far: 219. Waiting for insert: 25 (round 9). Thai translated from English sources: 245 (219 inserted, 25 waiting, 1 held). Remaining Thai from English sources: 530.
- Round 10: 25 translated, 25 pass. Inserted so far: 244. Waiting for insert: 25 (round 10). Thai from English sources: 270 (244 inserted, 25 waiting, 1 held). Remaining Thai from English sources: 505.
- Round 11: 25 translated, 25 pass. Inserted so far: 269. Waiting for insert: 25 (round 11). Thai from English sources: 295 (269 inserted, 25 waiting, 1 held). Remaining Thai from English sources: 480.
- Round 12: 25 translated, 24 pass, 1 held (`kids-piano-practice-parent-guide`: no promo block the finalize script can recognise; file in `held/th/`, listed in `skip-th.json`). Inserted so far: 294. Waiting for insert: 24 (round 12). Thai from English sources: 320 (294 inserted, 24 waiting, 2 held). Remaining Thai from English sources: 455.
- Round 13: 25 translated, 25 pass (the agents now always end the body with a promo paragraph + 3-link bullet list, so none was held). Inserted so far: 318. Waiting for insert: 25 (round 13). Thai from English sources: 345 (318 inserted, 25 waiting, 2 held). Remaining Thai from English sources: 430.

## Owner approvals 2026-11-28 19:09
- (1) Source bodies for non-English sources: `scripts/blog-source-bodies.mjs <lang> [limit]` + workflow `blog-source-bodies` (read-only, public anon key, <=300 bodies per run, never fetches a body twice, writes `data/blog-snapshot/src-bodies/<srclang>.json`). Thai needs 1,619 such bodies.
- (2) `cta.json` now has all stored languages: ar de en es fr hi ja ko ru th (copied read-only from `public.blog_translation_cta`, links unchanged). NO zh row exists in that table, so zh cannot be finalized until the owner supplies / approves a zh CTA row. de's stored paragraph says "11 Sprachen" (as stored).
- (3) More parallel translators are allowed, but Claude Max quota comes first: reduce the number of agents if it runs low.
- Round 14: 25 translated, 25 pass. Inserted so far: 343. Waiting for insert: 25 (round 14). Thai from English sources: 370 (343 inserted, 25 waiting, 2 held). Remaining Thai from English sources: 405.
- Source-bodies Action, first run (2026-11-28 19:18): the fetch worked (300 zh bodies, anon key, read-only) but the commit step failed (a stray tracked-file change blocked `git pull --rebase`). Fixed (no summary write from the fetch script, `--autostash`); the run has to be repeated, nothing was lost in the database.
- Round 15 (first round translated from a NON-English source: zh, `SRC=nonen node scripts/blog-translation-batch.mjs th 25 <dir>`; each file carries source_lang / source_slug; the checker reads the source from `data/blog-snapshot/src-bodies/<lang>.json`, length band 0.6-8 for those): 25 translated, 25 pass. Waiting for insert: 50 (rounds 14 and 15). The insert script now takes category / cover / date from the source row (index.json) for non-English sources. Thai from English sources left: 405; Thai from non-English sources: 25 done, 1,294 still to fetch (source bodies) and translate.
- Round 16 (English sources): 25 translated, 25 pass. Inserted so far: 393. Waiting for insert: 25 (round 16). Thai from English sources left: 380. zh source bodies fetched: 300 (275 not yet used).
- Round 17 (English sources): 25 translated, 25 pass. Inserted so far: 418. Waiting for insert: 25 (round 17). Thai from English sources left: 355.
- Round 18 (English sources): 25 translated, 25 pass. Inserted so far: 443. Waiting for insert: 25 (round 18). Thai from English sources left: 330.
- Round 19 (English sources): 25 translated, 25 pass. Inserted so far: 468. Waiting for insert: 25 (round 19). Thai from English sources left: 305.
- Round 20 (English sources): 25 translated, 25 pass. Inserted so far: 493. Waiting for insert: 25 (round 20). Thai from English sources left: 280.
- Round 21 (English sources): 25 translated, 25 pass. Inserted so far: 518. Waiting for insert: 25 (round 21). Thai from English sources left: 255.
- Round 22 (English sources): 25 translated, 25 pass. Inserted so far: 543. Waiting for insert: 25 (round 22). Thai from English sources left: 230.

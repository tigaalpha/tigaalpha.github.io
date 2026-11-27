# Blog translation progress (EN -> other languages)

Updated 2026-11-27 (owner order 14:32).

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

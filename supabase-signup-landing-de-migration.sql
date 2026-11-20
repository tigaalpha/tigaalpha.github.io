-- profiles.signup_landing for German (owner request, 2026-11-20: the app, the blog and a new landing page /landing-de/ also speak German; code "de", placed after ar).
-- WRITTEN, NOT APPLIED: needs the owner's approval. Run it in the Supabase SQL editor or through the connector. Additive and re-runnable (drop-if-exists, then add); it touches one check constraint and nothing else.
--
-- WHY. supabase-signup-landing-langs-migration.sql widened
--     check (signup_landing is null or signup_landing in ('th', 'en', 'zh', 'ja', 'ko', 'ru', 'hi', 'es', 'fr', 'ar'))
-- and the app (App.tsx, loadProfile) writes the landing stamp once, at the first login of a landing sign-up. From /landing-de/ that stamp is 'de'. The write is fire-and-forget
-- (its error is swallowed on purpose), so with the ten-language check Postgres refuses the WHOLE update (error 23514) and the account keeps signup_landing = NULL. Nothing visible breaks and no
-- sign-up is lost, only the attribution: the admin "signup languages" split and the flag next to a user in the activity list would count every German sign-up as "unknown".
-- (The usage_events row "signed_up_landing:<lang>" is written independently and is not affected.)
--
-- ORDER. Run supabase-signup-landing-langs-migration.sql first if it has not run yet (this file replaces its constraint with the eleven-language one, so the order between the two
-- does not matter for the result, but running the older file AFTER this one would take German out again). Never run supabase-signup-landing-migration.sql again: its last step puts the
-- three-language check back. admin_signup_languages() and admin_activity_users() group and print whatever value the column holds, so they need no change.

-- 1 ── the column (a no-op when it exists) ──────────────────────────────────────────────────────────
alter table public.profiles add column if not exists signup_landing text;

-- 2 ── the check: the eleven languages (th en zh ja ko ru hi es fr ar de), or NULL ──────────────────
-- No existing row can violate it: it only adds a value to the list the previous check accepted.
alter table public.profiles drop constraint if exists profiles_signup_landing_check;
alter table public.profiles add constraint profiles_signup_landing_check
  check (signup_landing is null or signup_landing in ('th', 'en', 'zh', 'ja', 'ko', 'ru', 'hi', 'es', 'fr', 'ar', 'de'));

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION (read-only), before and after applying:
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.profiles'::regclass and conname = 'profiles_signup_landing_check';
-- -- before: ... signup_landing IN ('th', 'en', 'zh', 'ja', 'ko', 'ru', 'hi', 'es', 'fr', 'ar') ...   (this is the case this file fixes)
-- -- after:  ... signup_landing IN ('th', 'en', 'zh', 'ja', 'ko', 'ru', 'hi', 'es', 'fr', 'ar', 'de') ...
--
-- select signup_landing, count(*) from public.profiles group by 1 order by 2 desc;
-- -- afterwards 'de' starts to appear as German landing sign-ups arrive
--
-- UNDO (back to ten languages; fails while a row holds 'de', which is the point):
-- alter table public.profiles drop constraint if exists profiles_signup_landing_check;
-- alter table public.profiles add constraint profiles_signup_landing_check check (signup_landing is null or signup_landing in ('th', 'en', 'zh', 'ja', 'ko', 'ru', 'hi', 'es', 'fr', 'ar'));
-- ═══════════════════════════════════════════════════════════════════════════

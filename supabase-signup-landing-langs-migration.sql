-- profiles.signup_landing for ALL TEN app languages (owner, 2026-11-13: the app, blog and landing pages also speak Hindi, Spanish, French and Arabic; Japanese, Korean and Russian joined on 2026-11-11).
-- WRITTEN, NOT APPLIED: needs the owner's approval. Run it in the Supabase SQL editor or through the connector. Additive and re-runnable; it touches one check constraint and nothing else.
--
-- WHY. supabase-signup-landing-migration.sql made the column honest with
--     check (signup_landing is null or signup_landing in ('th', 'en', 'zh'))
-- and the app (App.tsx, loadProfile) writes the landing stamp once, at the first login of a landing sign-up: since 2026-11-11 that stamp can be ja / ko / ru, and from the new landing pages
-- hi / es / fr / ar. That write is fire-and-forget (its error is swallowed on purpose), so with the three-language check Postgres refuses the WHOLE update (error 23514) and the account keeps
-- signup_landing = NULL. Nothing visible breaks and no sign-up is lost, only the attribution: the admin "signup languages" split and the flag next to a user in the activity list
-- would count every ja / ko / ru / hi / es / fr / ar sign-up as "unknown". (The usage_events row "signed_up_landing:<lang>" is written independently and is not affected.)
-- I could not read the live database from the session this file was written in, so whether the three-language check is live is NOT verified: the VERIFICATION query below says.
--
-- ORDER. Never run supabase-signup-landing-migration.sql AGAIN after this file: its last step puts the three-language check back, and it would stop on the first ja / ko / ru / hi / es / fr / ar row.
-- (It also re-creates two admin functions from an older definition: another reason to leave it alone once it has run.) admin_signup_languages() and admin_activity_users() group and print whatever
-- value the column holds, so they need no change; the activity dashboard shows a flag for th / en / zh and a "?" for the others (cosmetic, admin only).

-- 1 ── the column (a no-op when it exists) ──────────────────────────────────────────────────────────
alter table public.profiles add column if not exists signup_landing text;

-- 2 ── the check: the ten languages of lang-extra.ts ALL_LANGS, or NULL ───────────────────────────────
-- No existing row can violate it: the app only writes a stamp that passes LAND_LANGS in local-identity.ts (the same ten), and under the old check the column held NULL, th, en or zh.
alter table public.profiles drop constraint if exists profiles_signup_landing_check;
alter table public.profiles add constraint profiles_signup_landing_check
  check (signup_landing is null or signup_landing in ('th', 'en', 'zh', 'ja', 'ko', 'ru', 'hi', 'es', 'fr', 'ar'));

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION (read-only), before and after applying:
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.profiles'::regclass and conname = 'profiles_signup_landing_check';
-- -- before: ... signup_landing IN ('th', 'en', 'zh') ...   (this is the case this file fixes)
-- -- after:  ... signup_landing IN ('th', 'en', 'zh', 'ja', 'ko', 'ru', 'hi', 'es', 'fr', 'ar') ...
--
-- select signup_landing, count(*) from public.profiles group by 1 order by 2 desc;
-- -- afterwards ja / ko / ru / hi / es / fr / ar start to appear as landing sign-ups arrive
--
-- UNDO (back to three languages; fails while a row holds one of the new languages, which is the point):
-- alter table public.profiles drop constraint if exists profiles_signup_landing_check;
-- alter table public.profiles add constraint profiles_signup_landing_check check (signup_landing is null or signup_landing in ('th', 'en', 'zh'));
-- ═══════════════════════════════════════════════════════════════════════════

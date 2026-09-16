-- Per-user language preference: adds profiles.lang (nullable text: "th" |
-- "en" | "zh"). NULL means "hasn't chosen yet" — App() reads that as the
-- signal to show the one-time language picker on first login, right after
-- ProfileForm and before PianoApp ever mounts. Once chosen, every future
-- login on any device reads it back instead of resetting to English.
--
-- Purely additive: one new nullable column, no default, no trigger changes,
-- no existing row touched, no existing code path reads or writes it before
-- this session's own new code does. Safe to re-run (if-not-exists).

alter table public.profiles add column if not exists lang text;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION after applying:
-- select column_name, data_type, is_nullable from information_schema.columns
--   where table_schema='public' and table_name='profiles' and column_name='lang';
-- -- expect: lang | text | YES

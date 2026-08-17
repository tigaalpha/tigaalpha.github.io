-- Pin search_path on the 4 functions the Supabase security linter flagged as
-- "role mutable search_path" (function_search_path_mutable). Purely additive
-- hardening — does NOT redefine any function body or change behavior, just
-- pins search_path resolution for these functions so it can't be influenced
-- by whatever search_path the calling session happens to have. Safe to re-run.
--
-- Run in Supabase SQL Editor (project gsaqgbracxnucdmtmcxz) AFTER human review.

alter function public._league_tier(p_exp integer) set search_path = public;
alter function public._prestige_tier(p_exp integer) set search_path = public;
alter function public.get_video_like_counts(ids text[]) set search_path = public;
alter function public.is_piano_admin() set search_path = public;

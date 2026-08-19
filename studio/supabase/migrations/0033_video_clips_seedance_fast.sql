-- "Seedance 2.5" turned out not to be a live fal.ai model yet (only
-- announced) — swap it for the confirmed, actually cheaper "fast" tier of
-- Seedance 2.0 instead of a slug that 404s.
alter table video_clips drop constraint video_clips_provider_check;
alter table video_clips add constraint video_clips_provider_check
  check (provider in ('veo', 'seedance-2', 'seedance-2-fast'));

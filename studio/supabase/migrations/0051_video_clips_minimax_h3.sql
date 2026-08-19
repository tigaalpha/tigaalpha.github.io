-- Adds MiniMax H3 (aka Hailuo 3.0 -- the owner's literal request, MiniMax's
-- newest flagship model: native 2K + audio, up to 15s) as an additional
-- video-generation provider, hosted on fal.ai (reuses FAL_API_KEY).
alter table video_clips drop constraint video_clips_provider_check;
alter table video_clips add constraint video_clips_provider_check
  check (provider in ('veo', 'seedance-2', 'seedance-2-fast', 'luma-ray-2', 'runway-gen4-turbo', 'hailuo-2.3-fast', 'minimax-h3'));

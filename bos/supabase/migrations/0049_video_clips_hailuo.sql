-- Adds MiniMax Hailuo 2.3 Fast (hosted on fal.ai, reuses FAL_API_KEY) as a
-- lower-cost video-generation provider option.
alter table video_clips drop constraint video_clips_provider_check;
alter table video_clips add constraint video_clips_provider_check
  check (provider in ('veo', 'seedance-2', 'seedance-2-fast', 'luma-ray-2', 'runway-gen4-turbo', 'hailuo-2.3-fast'));

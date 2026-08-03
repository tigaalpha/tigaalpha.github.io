-- Adds Luma Ray-2 (hosted on fal.ai, reuses FAL_API_KEY) and Runway
-- Gen-4 Turbo (own RUNWAY_API_KEY) as additional video-generation providers.
alter table video_clips drop constraint video_clips_provider_check;
alter table video_clips add constraint video_clips_provider_check
  check (provider in ('veo', 'seedance-2', 'seedance-2-fast', 'luma-ray-2', 'runway-gen4-turbo'));

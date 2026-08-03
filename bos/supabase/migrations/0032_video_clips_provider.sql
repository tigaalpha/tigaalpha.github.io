-- Which video-generation backend produced a clip — Veo (Google, existing
-- Gemini API key) or Seedance via fal.ai (separate FAL_API_KEY, generally
-- cheaper). Both write into the same video_clips table; only how
-- operation_name is interpreted while polling differs by provider.
alter table video_clips add column provider text not null default 'veo'
  check (provider in ('veo', 'seedance-2', 'seedance-2-5'));

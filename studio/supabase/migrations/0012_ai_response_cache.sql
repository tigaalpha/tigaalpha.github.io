-- AI cost optimization (PRD priority #2 "Cache" / #7 "Reuse Answers"):
-- caches the reply to a customer's opening message (before any conversation
-- history exists) so identical FAQ-style questions ("how much for 20
-- hours?") from different customers don't each cost a Gemini call. Only
-- ever written by chat-core.ts, only for plain informational replies (no
-- tool calls involved, since those are personalized/dynamic).

create table ai_response_cache (
  id uuid primary key default uuid_generate_v4(),
  question_hash text not null unique,
  question_text text not null,
  reply text not null,
  hits int not null default 1,
  created_at timestamptz not null default now()
);

alter table ai_response_cache enable row level security;
create policy "ai_response_cache: staff read" on ai_response_cache for select using (is_staff());

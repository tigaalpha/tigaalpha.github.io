-- Chatbot sales optimization: staged re-engagement for a conversation that
-- goes quiet, instead of a single fixed 48h nudge. follow_up_count tracks
-- how many nudges have been sent so follow-up-conversations can pick the
-- right interval/tone for the next one and stop after a bounded sequence.
alter table conversations add column follow_up_count int not null default 0;

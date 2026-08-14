-- Chatbot sales optimization: cheap, real signal for "where do customers
-- drop off in the conversation" -- tagged after every AI turn from data
-- already computed in chat-core.ts (no extra AI call, no guessing).
alter table conversations add column last_stage text;

-- Floating AI Assistant (owner-facing, every page) writes to its own
-- conversation channel so it never mixes into the customer-facing Inbox.
alter type conversation_channel add value 'internal';

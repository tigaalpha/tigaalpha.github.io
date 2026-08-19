-- PRD "AI Training": the owner should be able to add sales scripts,
-- objection-handling notes, rules, examples, and corrections to past AI
-- replies — not just upload reference documents. These all reuse the
-- existing knowledge_documents/RAG pipeline, just as new source types.

alter type knowledge_source_type add value if not exists 'sales_script';
alter type knowledge_source_type add value if not exists 'objection_handling';
alter type knowledge_source_type add value if not exists 'rule';
alter type knowledge_source_type add value if not exists 'example';
alter type knowledge_source_type add value if not exists 'correction';

-- Knowledge base (RAG). Documents are chunked and embedded for semantic search.
-- Embedding dimension matches Gemini text-embedding-004 (768).

create type knowledge_source_type as enum (
  'pricing', 'promotion', 'teachers', 'policies', 'faq', 'school_info', 'holiday', 'internal_sop'
);

create table knowledge_documents (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  source_type knowledge_source_type not null,
  file_path text,
  raw_text text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table knowledge_chunks (
  id uuid primary key default uuid_generate_v4(),
  document_id uuid not null references knowledge_documents (id) on delete cascade,
  content text not null,
  embedding vector(768),
  created_at timestamptz not null default now()
);

create index knowledge_chunks_document_idx on knowledge_chunks (document_id);
create index knowledge_chunks_embedding_idx on knowledge_chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create or replace function match_knowledge_chunks(
  query_embedding vector(768),
  match_count int default 6,
  min_similarity float default 0.65
) returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
) language sql stable as $$
  select
    kc.id,
    kc.document_id,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  where kc.embedding is not null
    and 1 - (kc.embedding <=> query_embedding) >= min_similarity
  order by kc.embedding <=> query_embedding
  limit match_count;
$$;

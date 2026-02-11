-- Update the match_document_chunks function to support filtering by document_id
create or replace function match_document_chunks (
  query_embedding vector(1536),
  match_user_id uuid,
  match_count int DEFAULT 10,
  similarity_threshold float DEFAULT 0.5,
  filter_document_id uuid DEFAULT NULL
) returns table (
  id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.chunk_index,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where document_chunks.user_id = match_user_id
  and 1 - (document_chunks.embedding <=> query_embedding) > similarity_threshold
  and (filter_document_id is null or document_chunks.document_id = filter_document_id)
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;

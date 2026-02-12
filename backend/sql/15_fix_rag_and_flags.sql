-- Fix RAG function signature and logic
-- This update allows filtering by specific document_id while keeping vector search capability

CREATE OR REPLACE FUNCTION match_document_chunks(
    query_embedding VECTOR(384),
    match_user_id UUID,
    match_count INT DEFAULT 8,
    similarity_threshold FLOAT DEFAULT 0.5,
    filter_document_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    document_id UUID,
    chunk_index INT,
    content TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.document_id,
        dc.chunk_index,
        dc.content,
        1 - (dc.embedding <=> query_embedding) AS similarity
    FROM document_chunks dc
    WHERE dc.user_id = match_user_id
        AND (filter_document_id IS NULL OR dc.document_id = filter_document_id)
        AND 1 - (dc.embedding <=> query_embedding) > similarity_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

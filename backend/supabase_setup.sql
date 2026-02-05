-- Additional SQL to run in Supabase SQL Editor
-- This creates the similarity search function for the RAG pipeline

-- Create the vector similarity search function
CREATE OR REPLACE FUNCTION match_document_chunks(
    query_embedding VECTOR(384),
    match_user_id UUID,
    match_count INT DEFAULT 8,
    similarity_threshold FLOAT DEFAULT 0.5
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
        AND 1 - (dc.embedding <=> query_embedding) > similarity_threshold
    ORDER BY dc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Create storage bucket for prescriptions (run this if not already created via UI)
-- Note: Storage buckets are typically created via Supabase Dashboard
-- Go to Storage > New Bucket > Name: "prescriptions" > Make it public or configure RLS

-- Optional: Enable Row Level Security on tables
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Optional: Create policies for user access
CREATE POLICY "Users can view own documents" ON documents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own documents" ON documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own documents" ON documents
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own chunks" ON document_chunks
    FOR SELECT USING (auth.uid() = user_id);

-- For development without auth, allow service role full access
-- The backend uses service_role key which bypasses RLS

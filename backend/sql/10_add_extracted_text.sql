-- Add extracted_text column to documents table for AI analysis
-- This stores the full OCR/parsed text for document analysis

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- Add index for faster queries (optional)
CREATE INDEX IF NOT EXISTS idx_documents_extracted_text_not_null 
ON documents (id) 
WHERE extracted_text IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN documents.extracted_text IS 'Full extracted text from the document for AI analysis';

-- Migration: Add validation and category columns to documents table

-- 1. Add validation status to track if document is medically valid
-- Values: 'pending', 'verified', 'rejected', 'skipped'
alter table documents 
add column if not exists validation_status text default 'pending';

-- 2. Add document category to classify type
-- Values: 'prescription', 'lab_report', 'discharge_summary', 'invoice', 'other'
alter table documents 
add column if not exists doc_category text;

-- 3. Add parsing method to distinguish between standard OCR and LlamaParse
-- Values: 'standard', 'llama_parse'
alter table documents 
add column if not exists parsing_method text default 'standard';

-- 4. Add confidence score for validation (optional but good for analytics)
alter table documents
add column if not exists validation_confidence float;

-- 5. Add reason for rejection if any
alter table documents
add column if not exists rejection_reason text;

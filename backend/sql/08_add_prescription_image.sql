-- Add prescription_image column to medications table
-- This stores the base64 encoded image of the scanned prescription

ALTER TABLE medications 
ADD COLUMN IF NOT EXISTS prescription_image TEXT;

-- Add index for faster queries (optional, commented out as images can be large)
-- CREATE INDEX IF NOT EXISTS idx_medications_has_image ON medications ((prescription_image IS NOT NULL));

COMMENT ON COLUMN medications.prescription_image IS 'Base64 encoded prescription image for reference';

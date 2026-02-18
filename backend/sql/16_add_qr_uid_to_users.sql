-- 16: Add qr_uid column to users table
-- This column stores the unique identifier for generating the patient's QR code.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS qr_uid TEXT UNIQUE;

-- Optional: Add a comment to the column
COMMENT ON COLUMN public.users.qr_uid IS 'Unique identifier used for generating a patient QR code';

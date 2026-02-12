-- Add new fields to the 'users' table for extended onboarding info
ALTER TABLE users ADD COLUMN IF NOT EXISTS abha_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS aadhar_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Optional: Add comments or verify
COMMENT ON COLUMN users.abha_number IS 'ABHA (Ayushman Bharat Health Account) Number';
COMMENT ON COLUMN users.aadhar_number IS 'Aadhar Card Number';
COMMENT ON COLUMN users.onboarding_completed IS 'Flag to track if user has completed the post-signup walkthrough';

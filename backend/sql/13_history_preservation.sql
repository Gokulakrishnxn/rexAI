-- 13_history_preservation.sql
-- Decouple medication_intakes from schedules to allow history preservation after deletion

BEGIN;

-- 1. Add descriptive columns to medication_intakes to store snapshot of the medication
ALTER TABLE public.medication_intakes
ADD COLUMN IF NOT EXISTS drug_name text,
ADD COLUMN IF NOT EXISTS dosage text,
ADD COLUMN IF NOT EXISTS form text,
ADD COLUMN IF NOT EXISTS frequency_text text;

-- 2. Modify schedule_id to be NULLABLE
ALTER TABLE public.medication_intakes
ALTER COLUMN schedule_id DROP NOT NULL;

-- 3. Drop existing strict foreign key constraint
ALTER TABLE public.medication_intakes
DROP CONSTRAINT IF EXISTS medication_intakes_schedule_id_fkey;

-- 4. Add new foreign key constraint with ON DELETE SET NULL
-- This ensures that when a schedule is deleted, the intake record remains (with schedule_id = NULL)
ALTER TABLE public.medication_intakes
ADD CONSTRAINT medication_intakes_schedule_id_fkey
FOREIGN KEY (schedule_id)
REFERENCES public.medication_schedules(id)
ON DELETE SET NULL;

COMMIT;

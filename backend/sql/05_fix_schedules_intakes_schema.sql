-- FIX Script for Medication Schedules & Intakes Foreign Keys
-- Fixes "violates foreign key constraint medication_schedules_user_id_fkey" and similar for intakes.

BEGIN;

-- 1. Medication Schedules
ALTER TABLE public.medication_schedules DROP CONSTRAINT IF EXISTS medication_schedules_user_id_fkey;
ALTER TABLE public.medication_schedules 
    ADD CONSTRAINT medication_schedules_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.users(id) 
    ON DELETE CASCADE;

-- 2. Medication Intakes
ALTER TABLE public.medication_intakes DROP CONSTRAINT IF EXISTS medication_intakes_user_id_fkey;
ALTER TABLE public.medication_intakes 
    ADD CONSTRAINT medication_intakes_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.users(id) 
    ON DELETE CASCADE;

-- 3. Update RLS Policies to be robust (Check public.users mapping)
-- (Optional but recommended for consistency)

DROP POLICY IF EXISTS "Users can CRUD their own schedules" ON public.medication_schedules;
CREATE POLICY "Users can CRUD their own schedules" ON public.medication_schedules 
FOR ALL USING (
    user_id IN (
        SELECT id FROM public.users 
        WHERE auth_uid = auth.uid() OR firebase_uid = (select current_setting('request.jwt.claims', true)::json->>'sub')
    )
);

DROP POLICY IF EXISTS "Users can CRUD their own intakes" ON public.medication_intakes;
CREATE POLICY "Users can CRUD their own intakes" ON public.medication_intakes 
FOR ALL USING (
    user_id IN (
        SELECT id FROM public.users 
        WHERE auth_uid = auth.uid() OR firebase_uid = (select current_setting('request.jwt.claims', true)::json->>'sub')
    )
);

COMMIT;

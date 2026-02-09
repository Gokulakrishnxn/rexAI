-- FIX Script for Medications Table Foreign Key
-- Previous script incorrectly linked user_id to auth.users (Supabase Auth)
-- It should link to public.users (Our Custom Identity Layer which supports Firebase)

BEGIN;

-- 1. Drop the incorrect foreign key
ALTER TABLE public.medications DROP CONSTRAINT IF EXISTS medications_user_id_fkey;

-- 2. Add the correct foreign key pointing to public.users
ALTER TABLE public.medications 
    ADD CONSTRAINT medications_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.users(id) 
    ON DELETE CASCADE;

-- 3. Ensure RLS Policies use the correct mapping (just in case)
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own medications" ON public.medications;

CREATE POLICY "Users can manage their own medications" ON public.medications 
FOR ALL USING (
    user_id IN (
        SELECT id FROM public.users 
        WHERE auth_uid = auth.uid() OR firebase_uid = (select current_setting('request.jwt.claims', true)::json->>'sub')
    )
);

COMMIT;

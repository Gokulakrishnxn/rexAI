-- Allow public access to 'prescriptions' storage bucket
-- (Run this in Supabase SQL Editor)

-- 1. Insert bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('prescriptions', 'prescriptions', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public insert" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete" ON storage.objects;

-- 3. Create permissive policies for the 'prescriptions' bucket
CREATE POLICY "Allow public insert" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'prescriptions');

CREATE POLICY "Allow public select" ON storage.objects
FOR SELECT USING (bucket_id = 'prescriptions');

CREATE POLICY "Allow public update" ON storage.objects
FOR UPDATE USING (bucket_id = 'prescriptions');

CREATE POLICY "Allow public delete" ON storage.objects
FOR DELETE USING (bucket_id = 'prescriptions');

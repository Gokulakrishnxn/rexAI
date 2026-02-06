-- REX AI SUPABASE AUTH & IDENTITY SETUP (VERSION 2)
-- Run this in the Supabase SQL Editor

-- 1. Create Roles Enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('patient', 'doctor', 'admin');
    END IF;
END $$;

-- 2. Create Users Table if not exists
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT,
    phone TEXT,
    age INTEGER,
    gender TEXT,
    blood_group TEXT,
    emergency_contact TEXT,
    role user_role DEFAULT 'patient',
    onboarding_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.1 Ensure all columns exist (for existing tables)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_uid UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS blood_group TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'patient';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS firebase_uid TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2.2 Fix ID column to ensure it auto-generates UUIDs (Crucial fix for existing tables)
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Devices Table (Device Limits)
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    device_fingerprint TEXT NOT NULL,
    platform TEXT DEFAULT 'android',
    last_active TIMESTAMPTZ DEFAULT now(),
    revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, device_fingerprint)
);

-- 4. Sessions Table (App-Level Sessions)
CREATE TABLE IF NOT EXISTS public.sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE,
    supabase_session_id TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Linking Existing Tables to Identity Layer
-- Update documents and chats to point to public.users(id)
-- This ensures that when you login via Supabase Auth, we can find your specific medical data.

DO $$ 
BEGIN
    -- Linking Documents
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='user_id') THEN
            ALTER TABLE public.documents ADD COLUMN user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
        END IF;
    END IF;

    -- Linking Chat Sessions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_sessions') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_sessions' AND column_name='user_id') THEN
            ALTER TABLE public.chat_sessions ADD COLUMN user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;

-- 5.1 Medications Table
CREATE TABLE IF NOT EXISTS public.medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    dosage TEXT,
    frequency TEXT,
    time_of_day TEXT, -- 'Morning', 'Afternoon', 'Evening', 'Night'
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5.2 Activity Logs Table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    activity_type TEXT, -- 'medication', 'report', 'chat', 'onboarding'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
-- Users: only access own profile (either via Supabase Auth or service role identity)
DROP POLICY IF EXISTS "Users can only view their own profile" ON public.users;
CREATE POLICY "Users can only view their own profile" ON public.users 
FOR SELECT USING (
    auth.uid() = auth_uid OR 
    (select current_setting('request.jwt.claims', true)::json->>'sub') = firebase_uid
);

DROP POLICY IF EXISTS "Users can only update their own profile" ON public.users;
CREATE POLICY "Users can only update their own profile" ON public.users 
FOR UPDATE USING (
    auth.uid() = auth_uid OR 
    (select current_setting('request.jwt.claims', true)::json->>'sub') = firebase_uid
);

-- Documents: link to user identity
DROP POLICY IF EXISTS "Users can manage their own documents" ON public.documents;
CREATE POLICY "Users can manage their own documents" ON public.documents 
FOR ALL USING (
    user_id IN (
        SELECT id FROM public.users 
        WHERE auth_uid = auth.uid() OR firebase_uid = (select current_setting('request.jwt.claims', true)::json->>'sub')
    )
);

-- Chats: link to user identity
DROP POLICY IF EXISTS "Users can manage their own chat sessions" ON public.chat_sessions;
CREATE POLICY "Users can manage their own chat sessions" ON public.chat_sessions 
FOR ALL USING (
    user_id IN (
        SELECT id FROM public.users 
        WHERE auth_uid = auth.uid() OR firebase_uid = (select current_setting('request.jwt.claims', true)::json->>'sub')
    )
);

DROP POLICY IF EXISTS "Users can view messages of their sessions" ON public.chat_messages;
CREATE POLICY "Users can view messages of their sessions" ON public.chat_messages 
FOR ALL USING (
    session_id IN (
        SELECT id FROM public.chat_sessions 
        WHERE user_id IN (
            SELECT id FROM public.users 
            WHERE auth_uid = auth.uid() OR firebase_uid = (select current_setting('request.jwt.claims', true)::json->>'sub')
        )
    )
);

-- Medications: link to user identity
DROP POLICY IF EXISTS "Users can manage their own medications" ON public.medications;
CREATE POLICY "Users can manage their own medications" ON public.medications 
FOR ALL USING (
    user_id IN (
        SELECT id FROM public.users 
        WHERE auth_uid = auth.uid() OR firebase_uid = (select current_setting('request.jwt.claims', true)::json->>'sub')
    )
);

-- Activity Logs: link to user identity
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
CREATE POLICY "Users can view their own activity logs" ON public.activity_logs 
FOR SELECT USING (
    user_id IN (
        SELECT id FROM public.users 
        WHERE auth_uid = auth.uid() OR firebase_uid = (select current_setting('request.jwt.claims', true)::json->>'sub')
    )
);

-- 8. Triggers for Update Timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

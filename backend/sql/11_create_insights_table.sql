-- Create insights table for caching AI analysis results
-- This stores the full analysis output so it doesn't need to be regenerated

CREATE TABLE IF NOT EXISTS insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    insight_type TEXT NOT NULL DEFAULT 'full_analysis',
    title TEXT,
    ai_summary TEXT,
    doctor_assessment TEXT,  -- Dynamic doctor's perspective advice
    sections JSONB DEFAULT '[]'::jsonb,
    action_list JSONB DEFAULT '[]'::jsonb,
    chart_data JSONB DEFAULT '{}'::jsonb,
    food_nutrition JSONB DEFAULT '[]'::jsonb,  -- Food recommendations with nutrition data
    safety_qa JSONB DEFAULT '[]'::jsonb,  -- Safety Q&A responses
    medication_explanations JSONB DEFAULT '[]'::jsonb,  -- Why meds prescribed + treatment goals
    diagnosed_conditions JSONB DEFAULT '[]'::jsonb,  -- Conditions inferred from medications
    full_analysis JSONB,  -- Complete analysis result for cache retrieval
    model_used TEXT DEFAULT 'gemini-2.0-flash',
    is_current BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns if table already exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'insights' AND column_name = 'full_analysis') THEN
        ALTER TABLE insights ADD COLUMN full_analysis JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'insights' AND column_name = 'doctor_assessment') THEN
        ALTER TABLE insights ADD COLUMN doctor_assessment TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'insights' AND column_name = 'food_nutrition') THEN
        ALTER TABLE insights ADD COLUMN food_nutrition JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'insights' AND column_name = 'safety_qa') THEN
        ALTER TABLE insights ADD COLUMN safety_qa JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'insights' AND column_name = 'medication_explanations') THEN
        ALTER TABLE insights ADD COLUMN medication_explanations JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'insights' AND column_name = 'diagnosed_conditions') THEN
        ALTER TABLE insights ADD COLUMN diagnosed_conditions JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'insights' AND column_name = 'updated_at') THEN
        ALTER TABLE insights ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Drop existing unique constraint if it exists and recreate
DROP INDEX IF EXISTS idx_insights_document_unique;

-- Add unique constraint on document_id for upsert
ALTER TABLE insights DROP CONSTRAINT IF EXISTS insights_document_id_key;
ALTER TABLE insights ADD CONSTRAINT insights_document_id_unique UNIQUE (document_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_insights_user_id ON insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_current ON insights(is_current) WHERE is_current = true;

-- Enable RLS
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own insights" ON insights;
DROP POLICY IF EXISTS "Users can insert own insights" ON insights;
DROP POLICY IF EXISTS "Users can update own insights" ON insights;
DROP POLICY IF EXISTS "Users can delete own insights" ON insights;

-- RLS policies
CREATE POLICY "Users can view own insights" ON insights
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own insights" ON insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own insights" ON insights
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own insights" ON insights
    FOR DELETE USING (auth.uid() = user_id);

-- Comment
COMMENT ON TABLE insights IS 'Cached AI analysis results for medical documents';

-- =============================================
-- 12: Fix Insights, Nutrition & Conditions Schema
-- RexAI: Complete restructure for proper data storage
-- =============================================

-- =============================================
-- 1. DROP AND RECREATE INSIGHTS TABLE
-- =============================================

-- Drop existing insights table and recreate with proper schema
DROP TABLE IF EXISTS insights CASCADE;

CREATE TABLE insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core relationships
    document_id UUID UNIQUE REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Analysis type (expanded to include full_analysis)
    insight_type TEXT NOT NULL DEFAULT 'full_analysis'
        CHECK (insight_type IN ('summary', 'risk', 'recommendation', 'alert', 'analysis', 'full_analysis')),
    
    -- Basic info
    title TEXT,
    document_type TEXT,  -- 'prescription', 'diagnosis', 'lab_report', 'medical_document'
    
    -- Section 1: AI Summary (Clinical factual tone)
    ai_summary TEXT,
    
    -- Section 2: Doctor's Assessment (Conversational)
    doctor_assessment JSONB,  -- {greeting, diagnosis, treatmentPlan, advice[], warnings[], followUp}
    
    -- Section 3: Key Findings
    key_findings JSONB DEFAULT '[]'::jsonb,  -- [{category, finding, status, value, reference}]
    
    -- Section 4: Conditions (extracted + inferred)
    conditions JSONB DEFAULT '[]'::jsonb,  -- [{name, severity, notes}]
    diagnosed_conditions JSONB DEFAULT '[]'::jsonb,  -- [{condition, description, confidence, inferredFrom[]}]
    
    -- Section 5: Medications
    medications JSONB DEFAULT '[]'::jsonb,  -- [{name, dosage, frequency, purpose}]
    medication_insights JSONB DEFAULT '[]'::jsonb,  -- [{medication, whyPrescribed, treatmentGoal, sideEffects[]}]
    drug_interactions JSONB DEFAULT '[]'::jsonb,  -- [{drug1, drug2, severity, description, recommendation}]
    
    -- Section 6: Food & Nutrition Recommendations
    food_recommendations JSONB DEFAULT '[]'::jsonb,  -- [{category, benefit, foods[], score, nutrition{}}]
    
    -- Section 7: Safety Q&A
    safety_qa JSONB DEFAULT '[]'::jsonb,  -- [{question, answer, riskLevel}]
    
    -- Section 8: Charts & Vitals
    charts JSONB DEFAULT '{}'::jsonb,  -- {vitals[], trends[]}
    
    -- Section 9: Follow-up Actions
    follow_up_actions JSONB DEFAULT '[]'::jsonb,  -- [{action, priority, dueDate}]
    
    -- Full analysis cache (complete result object for quick retrieval)
    full_analysis JSONB,
    
    -- Metadata
    model_used TEXT DEFAULT 'gemini-2.0-flash',
    processing_time_ms INTEGER,
    is_current BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for insights
CREATE INDEX idx_insights_user_id ON insights(user_id);
CREATE INDEX idx_insights_document_id ON insights(document_id);
CREATE INDEX idx_insights_type ON insights(insight_type);
CREATE INDEX idx_insights_current ON insights(is_current) WHERE is_current = true;
CREATE INDEX idx_insights_created ON insights(created_at DESC);

-- RLS for insights
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insights_select" ON insights;
DROP POLICY IF EXISTS "insights_insert" ON insights;
DROP POLICY IF EXISTS "insights_update" ON insights;
DROP POLICY IF EXISTS "insights_delete" ON insights;
DROP POLICY IF EXISTS "insights_crud" ON insights;

CREATE POLICY "insights_crud" ON insights FOR ALL USING (
    user_id IN (
        SELECT id FROM public.users 
        WHERE auth_uid = auth.uid() OR firebase_uid = (select current_setting('request.jwt.claims', true)::json->>'sub')
    )
);

COMMENT ON TABLE insights IS 'Cached AI analysis results for medical documents - prevents re-processing';


-- =============================================
-- 2. UPDATE FOOD_NUTRITION TABLE
-- Add document_id to link recommendations to prescriptions
-- =============================================

-- Add document_id column if not exists
ALTER TABLE food_nutrition ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE SET NULL;

-- Add recommendation source
ALTER TABLE food_nutrition ADD COLUMN IF NOT EXISTS recommendation_source TEXT DEFAULT 'manual'
    CHECK (recommendation_source IN ('manual', 'ai_generated', 'prescription'));

-- Add recommendation reason
ALTER TABLE food_nutrition ADD COLUMN IF NOT EXISTS recommendation_reason TEXT;

-- Add target conditions (which conditions this food helps)
ALTER TABLE food_nutrition ADD COLUMN IF NOT EXISTS target_conditions JSONB DEFAULT '[]'::jsonb;

-- Add score (how beneficial for user's conditions)
ALTER TABLE food_nutrition ADD COLUMN IF NOT EXISTS benefit_score INTEGER DEFAULT 0;

-- Create index for document lookups
CREATE INDEX IF NOT EXISTS idx_food_nutrition_document ON food_nutrition(document_id);


-- =============================================
-- 3. UPDATE DAILY_NUTRITION_SUMMARY TABLE
-- Add document_id for tracking prescription-linked nutrition
-- =============================================

-- Add document_id column
ALTER TABLE daily_nutrition_summary ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE SET NULL;

-- Add recommendations count
ALTER TABLE daily_nutrition_summary ADD COLUMN IF NOT EXISTS recommendations_followed INTEGER DEFAULT 0;

-- Add target conditions being addressed
ALTER TABLE daily_nutrition_summary ADD COLUMN IF NOT EXISTS conditions_addressed JSONB DEFAULT '[]'::jsonb;

-- Create index
CREATE INDEX IF NOT EXISTS idx_daily_nutrition_document ON daily_nutrition_summary(document_id);


-- =============================================
-- 4. CREATE/FIX USER_CONDITIONS TABLE
-- This stores conditions linked to users (the code references user_conditions) 
-- =============================================

-- Drop and recreate to ensure clean schema
DROP TABLE IF EXISTS user_conditions CASCADE;

CREATE TABLE user_conditions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    
    -- Condition details
    condition TEXT NOT NULL,
    icd_code TEXT,
    description TEXT,
    
    -- Severity and status
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'chronic', 'monitoring')),
    
    -- Source of diagnosis
    source TEXT DEFAULT 'document' CHECK (source IN ('document', 'ai_inferred', 'user_reported', 'medication_inferred')),
    confidence FLOAT DEFAULT 1.0,
    
    -- Related data
    medications_linked JSONB DEFAULT '[]'::jsonb,  -- Medications treating this condition
    food_recommendations JSONB DEFAULT '[]'::jsonb,  -- Foods that help
    
    -- Timestamps
    diagnosed_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user_conditions
CREATE INDEX IF NOT EXISTS idx_user_conditions_user ON user_conditions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_conditions_document ON user_conditions(document_id);
CREATE INDEX IF NOT EXISTS idx_user_conditions_status ON user_conditions(status);

-- RLS for user_conditions
ALTER TABLE user_conditions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_conditions_crud" ON user_conditions;
CREATE POLICY "user_conditions_crud" ON user_conditions FOR ALL USING (
    user_id IN (
        SELECT id FROM public.users 
        WHERE auth_uid = auth.uid() OR firebase_uid = (select current_setting('request.jwt.claims', true)::json->>'sub')
    )
);

COMMENT ON TABLE user_conditions IS 'User health conditions extracted from documents or inferred from medications';


-- =============================================
-- 5. CREATE PRESCRIPTION_NUTRITION TABLE
-- Links specific nutritional recommendations to prescriptions
-- =============================================

DROP TABLE IF EXISTS prescription_nutrition CASCADE;

CREATE TABLE prescription_nutrition (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Links
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Food category and recommendations
    category TEXT NOT NULL,  -- 'Leafy Greens', 'Lean Proteins', etc.
    benefit TEXT,  -- Why this food helps
    foods JSONB DEFAULT '[]'::jsonb,  -- Array of specific food names
    
    -- Nutrition info (per serving)
    nutrition JSONB DEFAULT '{}'::jsonb,  -- {protein, fiber, calories, vitamins, etc.}
    
    -- Scoring
    benefit_score INTEGER DEFAULT 0,  -- 0-100
    
    -- Target conditions this addresses
    target_conditions JSONB DEFAULT '[]'::jsonb,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prescription_nutrition_document ON prescription_nutrition(document_id);
CREATE INDEX IF NOT EXISTS idx_prescription_nutrition_user ON prescription_nutrition(user_id);

-- RLS
ALTER TABLE prescription_nutrition ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prescription_nutrition_crud" ON prescription_nutrition;
CREATE POLICY "prescription_nutrition_crud" ON prescription_nutrition FOR ALL USING (
    user_id IN (
        SELECT id FROM public.users 
        WHERE auth_uid = auth.uid() OR firebase_uid = (select current_setting('request.jwt.claims', true)::json->>'sub')
    )
);

COMMENT ON TABLE prescription_nutrition IS 'AI-generated food recommendations linked to specific prescriptions/documents';


-- =============================================
-- 6. CREATE VIEW FOR HOME PAGE NUTRITION REMINDERS
-- =============================================

CREATE OR REPLACE VIEW user_nutrition_reminders AS
SELECT 
    pn.id,
    pn.user_id,
    pn.document_id,
    d.file_name as document_title,
    pn.category,
    pn.benefit,
    pn.foods,
    pn.nutrition,
    pn.benefit_score,
    pn.target_conditions,
    pn.created_at
FROM prescription_nutrition pn
JOIN documents d ON d.id = pn.document_id
WHERE pn.is_active = true
ORDER BY pn.benefit_score DESC, pn.created_at DESC;


-- =============================================
-- 7. FUNCTION TO UPSERT INSIGHTS
-- =============================================

CREATE OR REPLACE FUNCTION upsert_insight(
    p_document_id UUID,
    p_user_id UUID,
    p_insight_type TEXT,
    p_title TEXT,
    p_document_type TEXT,
    p_ai_summary TEXT,
    p_doctor_assessment JSONB,
    p_key_findings JSONB,
    p_conditions JSONB,
    p_diagnosed_conditions JSONB,
    p_medications JSONB,
    p_medication_insights JSONB,
    p_drug_interactions JSONB,
    p_food_recommendations JSONB,
    p_safety_qa JSONB,
    p_charts JSONB,
    p_follow_up_actions JSONB,
    p_full_analysis JSONB,
    p_model_used TEXT
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO insights (
        document_id, user_id, insight_type, title, document_type,
        ai_summary, doctor_assessment, key_findings, conditions,
        diagnosed_conditions, medications, medication_insights,
        drug_interactions, food_recommendations, safety_qa,
        charts, follow_up_actions, full_analysis, model_used,
        updated_at
    ) VALUES (
        p_document_id, p_user_id, p_insight_type, p_title, p_document_type,
        p_ai_summary, p_doctor_assessment, p_key_findings, p_conditions,
        p_diagnosed_conditions, p_medications, p_medication_insights,
        p_drug_interactions, p_food_recommendations, p_safety_qa,
        p_charts, p_follow_up_actions, p_full_analysis, p_model_used,
        NOW()
    )
    ON CONFLICT (document_id) DO UPDATE SET
        insight_type = EXCLUDED.insight_type,
        title = EXCLUDED.title,
        document_type = EXCLUDED.document_type,
        ai_summary = EXCLUDED.ai_summary,
        doctor_assessment = EXCLUDED.doctor_assessment,
        key_findings = EXCLUDED.key_findings,
        conditions = EXCLUDED.conditions,
        diagnosed_conditions = EXCLUDED.diagnosed_conditions,
        medications = EXCLUDED.medications,
        medication_insights = EXCLUDED.medication_insights,
        drug_interactions = EXCLUDED.drug_interactions,
        food_recommendations = EXCLUDED.food_recommendations,
        safety_qa = EXCLUDED.safety_qa,
        charts = EXCLUDED.charts,
        follow_up_actions = EXCLUDED.follow_up_actions,
        full_analysis = EXCLUDED.full_analysis,
        model_used = EXCLUDED.model_used,
        is_current = true,
        updated_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION upsert_insight IS 'Insert or update insight for a document - used for caching analysis results';


-- =============================================
-- SUMMARY OF TABLES
-- =============================================
-- insights: Full cached AI analysis per document (1:1 with documents)
-- user_conditions: Health conditions per user (can have multiple for same user)
-- food_nutrition: General food tracking/logging by user
-- prescription_nutrition: AI-recommended foods linked to prescriptions
-- daily_nutrition_summary: Daily aggregated nutrition stats


-- =============================================
-- 09: Extended AI Features Schema
-- RexAI: Conditions, Food/Nutrition, Insights
-- =============================================

-- 1. Medical Conditions (Extracted from documents)
CREATE TABLE IF NOT EXISTS conditions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    
    condition TEXT NOT NULL,                -- "Type 2 Diabetes", "Hypertension"
    icd_code TEXT,                          -- ICD-10 code if identifiable
    explanation TEXT,                       -- AI-generated explanation
    
    severity TEXT DEFAULT 'unknown'         -- 'low', 'medium', 'high', 'unknown'
        CHECK (severity IN ('low', 'medium', 'high', 'unknown')),
    
    status TEXT DEFAULT 'active'            -- 'active', 'resolved', 'chronic'
        CHECK (status IN ('active', 'resolved', 'chronic', 'monitoring')),
    
    diagnosed_date DATE,
    suggested_actions JSONB DEFAULT '[]'::jsonb,    -- Array of recommendations
    related_medications UUID[],                      -- References to medications table
    
    confidence FLOAT DEFAULT 0.0,           -- AI confidence score 0.0-1.0
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Food/Nutrition Tracking
CREATE TABLE IF NOT EXISTS food_nutrition (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    food_name TEXT NOT NULL,
    fdc_id TEXT,                            -- USDA FoodData Central ID
    
    serving_size TEXT,                      -- "1 cup", "100g", etc.
    quantity FLOAT DEFAULT 1.0,             -- Number of servings
    
    -- Macronutrients (per serving)
    calories FLOAT DEFAULT 0,
    protein_g FLOAT DEFAULT 0,
    carbs_g FLOAT DEFAULT 0,
    fat_g FLOAT DEFAULT 0,
    fiber_g FLOAT DEFAULT 0,
    sugar_g FLOAT DEFAULT 0,
    sodium_mg FLOAT DEFAULT 0,
    
    -- Additional nutrients stored as JSON for flexibility
    vitamins JSONB DEFAULT '{}'::jsonb,     -- {"vitaminA": 100, "vitaminC": 45}
    minerals JSONB DEFAULT '{}'::jsonb,     -- {"calcium": 200, "iron": 5}
    
    -- Meal context
    meal_type TEXT DEFAULT 'other'          -- 'breakfast', 'lunch', 'dinner', 'snack', 'other'
        CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'other')),
    
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. AI-Generated Insights
CREATE TABLE IF NOT EXISTS insights (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    
    insight_type TEXT NOT NULL              -- 'summary', 'risk', 'recommendation', 'alert'
        CHECK (insight_type IN ('summary', 'risk', 'recommendation', 'alert', 'analysis')),
    
    title TEXT,                             -- "Blood Test Analysis"
    ai_summary TEXT,                        -- Main text content
    
    -- Structured data for UI rendering
    sections JSONB DEFAULT '[]'::jsonb,     -- [{header: "Findings", content: "..."}]
    action_list JSONB DEFAULT '[]'::jsonb,  -- [{priority: "high", action: "..."}]
    chart_data JSONB DEFAULT '{}'::jsonb,   -- For frontend visualization
    
    -- Source tracking
    model_used TEXT,                        -- 'gpt-4', 'gemini-pro'
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    
    -- Validity
    is_current BOOLEAN DEFAULT true,        -- Latest insight for this document
    expires_at TIMESTAMP WITH TIME ZONE,    -- Optional expiry for time-sensitive insights
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Daily Nutrition Summary (Aggregated)
CREATE TABLE IF NOT EXISTS daily_nutrition_summary (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    
    total_calories FLOAT DEFAULT 0,
    total_protein_g FLOAT DEFAULT 0,
    total_carbs_g FLOAT DEFAULT 0,
    total_fat_g FLOAT DEFAULT 0,
    total_fiber_g FLOAT DEFAULT 0,
    total_sodium_mg FLOAT DEFAULT 0,
    
    meal_count INTEGER DEFAULT 0,
    goal_met BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    UNIQUE(user_id, date)
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_conditions_user ON conditions(user_id);
CREATE INDEX IF NOT EXISTS idx_conditions_document ON conditions(document_id);
CREATE INDEX IF NOT EXISTS idx_conditions_status ON conditions(status);

CREATE INDEX IF NOT EXISTS idx_food_nutrition_user ON food_nutrition(user_id);
CREATE INDEX IF NOT EXISTS idx_food_nutrition_logged ON food_nutrition(logged_at);
CREATE INDEX IF NOT EXISTS idx_food_nutrition_fdc ON food_nutrition(fdc_id);

CREATE INDEX IF NOT EXISTS idx_insights_user ON insights(user_id);
CREATE INDEX IF NOT EXISTS idx_insights_document ON insights(document_id);
CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_current ON insights(is_current) WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_daily_nutrition_user_date ON daily_nutrition_summary(user_id, date);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_nutrition ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_nutrition_summary ENABLE ROW LEVEL SECURITY;

-- Conditions policies
DROP POLICY IF EXISTS "Users can CRUD their own conditions" ON conditions;
CREATE POLICY "Users can CRUD their own conditions"
    ON conditions FOR ALL
    USING (auth.uid() = user_id);

-- Food nutrition policies
DROP POLICY IF EXISTS "Users can CRUD their own food logs" ON food_nutrition;
CREATE POLICY "Users can CRUD their own food logs"
    ON food_nutrition FOR ALL
    USING (auth.uid() = user_id);

-- Insights policies
DROP POLICY IF EXISTS "Users can read their own insights" ON insights;
CREATE POLICY "Users can read their own insights"
    ON insights FOR ALL
    USING (auth.uid() = user_id);

-- Daily summary policies
DROP POLICY IF EXISTS "Users can CRUD their own daily summaries" ON daily_nutrition_summary;
CREATE POLICY "Users can CRUD their own daily summaries"
    ON daily_nutrition_summary FOR ALL
    USING (auth.uid() = user_id);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to update daily nutrition summary when food is logged
CREATE OR REPLACE FUNCTION update_daily_nutrition_summary()
RETURNS TRIGGER AS $$
DECLARE
    log_date DATE;
BEGIN
    log_date := DATE(NEW.logged_at);
    
    INSERT INTO daily_nutrition_summary (user_id, date, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, total_sodium_mg, meal_count)
    VALUES (NEW.user_id, log_date, NEW.calories * NEW.quantity, NEW.protein_g * NEW.quantity, NEW.carbs_g * NEW.quantity, NEW.fat_g * NEW.quantity, NEW.fiber_g * NEW.quantity, NEW.sodium_mg * NEW.quantity, 1)
    ON CONFLICT (user_id, date) 
    DO UPDATE SET
        total_calories = daily_nutrition_summary.total_calories + (NEW.calories * NEW.quantity),
        total_protein_g = daily_nutrition_summary.total_protein_g + (NEW.protein_g * NEW.quantity),
        total_carbs_g = daily_nutrition_summary.total_carbs_g + (NEW.carbs_g * NEW.quantity),
        total_fat_g = daily_nutrition_summary.total_fat_g + (NEW.fat_g * NEW.quantity),
        total_fiber_g = daily_nutrition_summary.total_fiber_g + (NEW.fiber_g * NEW.quantity),
        total_sodium_mg = daily_nutrition_summary.total_sodium_mg + (NEW.sodium_mg * NEW.quantity),
        meal_count = daily_nutrition_summary.meal_count + 1,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating daily summary
DROP TRIGGER IF EXISTS trigger_update_daily_nutrition ON food_nutrition;
CREATE TRIGGER trigger_update_daily_nutrition
    AFTER INSERT ON food_nutrition
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_nutrition_summary();

-- =============================================
-- SAMPLE QUERIES
-- =============================================

-- Get all active conditions for a user
-- SELECT * FROM conditions WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC;

-- Get today's nutrition summary
-- SELECT * FROM daily_nutrition_summary WHERE user_id = $1 AND date = CURRENT_DATE;

-- Get recent food logs
-- SELECT * FROM food_nutrition WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 10;

-- Get insights for a document
-- SELECT * FROM insights WHERE document_id = $1 AND is_current = true ORDER BY created_at DESC;

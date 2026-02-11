# RexAI Complete System Flow Documentation

This document explains the complete end-to-end AI processing flows for the RexAI health application - covering document ingestion, OCR, medical analysis, medication decoding, nutrition tracking, and AI insights.

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              REXAI SYSTEM ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐           │
│  │  React Native │    │   Express    │    │   Supabase   │    │  External    │           │
│  │   Frontend    │◄──►│   Backend    │◄──►│   Database   │    │    APIs      │           │
│  └──────────────┘    └──────┬───────┘    └──────────────┘    └──────┬───────┘           │
│                              │                                       │                   │
│                              ▼                                       │                   │
│                    ┌─────────────────────────────────────────────────┘                   │
│                    │                                                                     │
│         ┌──────────┼──────────┬──────────┬──────────┬──────────┐                        │
│         ▼          ▼          ▼          ▼          ▼          ▼                        │
│    ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│    │LlamaParse│ │ OpenAI  │ │ Gemini  │ │ RxNorm  │ │  USDA   │ │Tesseract│              │
│    │   OCR   │ │GPT-3.5/4│ │Fallback │ │  API    │ │   API   │ │Fallback │              │
│    └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘              │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔁 Complete AI Processing Flows

---

## Flow 1: Document Ingestion

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                       🧾 DOCUMENT INGESTION FLOW                                │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────┐                                                        │
│  │ 1. User uploads     │  PDF, Image, or Photo                                  │
│  │    prescription/    │  via DocumentPicker                                    │
│  │    report           │                                                        │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ 2. Upload to        │  Path: medical-records/{user_id}/{timestamp}_{file}    │
│  │    Supabase Storage │  Returns: public URL                                   │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ 3. POST /api/ingest │  Body: { fileUrl, fileName, fileType }                 │
│  │    (Backend)        │  Starts processing job                                 │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│       [ Continue to OCR & Validation Flow ]                                     │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Key Files:**
| Component | Path |
|-----------|------|
| Upload Service | `src/services/supabase.ts` → `uploadToStorage()` |
| API Client | `src/services/api/backendApi.ts` → `triggerIngestion()` |
| Processing Screen | `src/screens/Records/DocumentProcessingScreen.tsx` |

---

## Flow 2: OCR & Validation

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                       🧠 OCR & VALIDATION FLOW                                  │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────┐                                                        │
│  │ 4. LlamaParse OCR   │  PRIMARY: Cloud API for high-quality parsing           │
│  │    (Primary)        │  Extracts text/markdown from PDF/images                │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ├─── SUCCESS ─────────────────────────────────────┐                  │
│            │                                                 │                  │
│            ▼ (FAILURE)                                       │                  │
│  ┌─────────────────────┐                                     │                  │
│  │ 5. Tesseract.js     │  FALLBACK: Local OCR engine         │                  │
│  │    (Fallback)       │  Node.js native OCR                 │                  │
│  └─────────┬───────────┘                                     │                  │
│            │                                                 │                  │
│            ▼◄────────────────────────────────────────────────┘                  │
│  ┌─────────────────────┐                                                        │
│  │ 6. Medical          │  Prompt: "Is this a medical document?"                 │
│  │    Validation       │  Model: GPT-3.5-turbo (OpenAI)                         │
│  │    (AI Guardrail)   │                                                        │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ├─── is_medical: false ──► REJECT (400 Error)                        │
│            │    reason: "Not a valid medical document"                          │
│            │                                                                    │
│            ▼ (is_medical: true)                                                 │
│  ┌─────────────────────┐                                                        │
│  │ Document Tagged     │  category: 'prescription' | 'lab' | 'imaging'          │
│  │ with Type           │  confidence: 0.0 - 1.0                                 │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│       [ Continue to Medical Analysis Pipeline ]                                 │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Validation Response Structure:**
```typescript
{
  is_medical: boolean;
  category: 'prescription' | 'lab_report' | 'imaging' | 'discharge_summary' | 'other';
  confidence: number;  // 0.0 - 1.0
  reason: string;      // Explanation for the decision
}
```

**Key Files:**
| Component | Path |
|-----------|------|
| LlamaParse Service | `backend/src/services/llamaParse.ts` |
| Tesseract Fallback | `backend/src/services/ocr.ts` |
| Validation AI | `backend/src/services/validationAI.ts` |
| Ingest Route | `backend/src/routes/ingestAdvanced.ts` |

---

## Flow 3: Medical Analysis Pipeline

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                       🧬 MEDICAL ANALYSIS PIPELINE                              │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────┐                                                        │
│  │ 7. Text Chunking    │  Strategy: 256 tokens per chunk                        │
│  │                     │  Overlap: 50 tokens (for context continuity)           │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ 8. Generate         │  Model: OpenAI text-embedding-ada-002                  │
│  │    Embeddings       │  OR: Xenova/all-MiniLM-L6-v2 (local)                   │
│  │                     │  Output: 1536-dim vectors                              │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ 9. Store Chunks     │  Table: document_chunks                                │
│  │    with Embeddings  │  Enables semantic search via pgvector                  │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ 10. Medical Entity  │  Optional: BioGPT / PubMedBERT                         │
│  │     Extraction      │  Extract: conditions, symptoms, diagnoses              │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ 11. Generate        │  Model: GPT-4 / Gemini                                 │
│  │     AI Summary      │  Output: Structured medical summary                    │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ 12. Store Insights  │  Tables: documents.summary, conditions                 │
│  │     in Database     │  Fields: condition, explanation, suggested_actions     │
│  └─────────────────────┘                                                        │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Chunking Configuration:**
```typescript
const CHUNK_CONFIG = {
  maxTokens: 256,
  overlapTokens: 50,
  separator: '\n\n'
};
```

**Key Files:**
| Component | Path |
|-----------|------|
| Chunker Service | `backend/src/services/chunker.ts` |
| Embeddings Service | `backend/src/services/embeddings.ts` |
| Vector Store | `backend/src/services/vectorStore.ts` |
| ChatGPT Service | `backend/src/services/chatgpt.ts` |

---

## Flow 4: Medication Decoding (RxNorm)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                       💊 MEDICATION DECODING FLOW                               │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────┐                                                        │
│  │ 12. Detect Medicine │  Methods:                                              │
│  │     Names           │  - Regex patterns (mg, ml, tablet, capsule)            │
│  │                     │  - NER extraction via LLM                              │
│  │                     │  - AI prompt: "List all medications mentioned"         │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ 13. Query RxNorm    │  API: https://rxnav.nlm.nih.gov/REST/                  │
│  │     API             │                                                        │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            │  Endpoints Used:                                                   │
│            │  ┌───────────────────────────────────────────────────────┐         │
│            │  │ /drugs.json?name={drugName}                           │         │
│            │  │   → Get rxcui, brand names, generics                  │         │
│            │  │                                                       │         │
│            │  │ /rxcui/{rxcui}/allrelated.json                        │         │
│            │  │   → Get ingredients, dosage forms, interactions       │         │
│            │  │                                                       │         │
│            │  │ /interaction/list.json?rxcuis={rxcui1}+{rxcui2}       │         │
│            │  │   → Check drug-drug interactions                      │         │
│            │  └───────────────────────────────────────────────────────┘         │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ 14. Store in        │  Table: medications                                    │
│  │     Supabase        │  Fields: drug_name, rxcui, purpose, side_effects       │
│  └─────────────────────┘                                                        │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

**RxNorm Response Example:**
```json
{
  "drugGroup": {
    "name": "amoxicillin",
    "conceptGroup": [{
      "tty": "SBD",
      "conceptProperties": [{
        "rxcui": "308182",
        "name": "Amoxicillin 500 MG Oral Capsule",
        "synonym": "Amoxil"
      }]
    }]
  }
}
```

**Key Files:**
| Component | Path |
|-----------|------|
| Medication AI | `backend/src/services/medicationAI.ts` |
| Medication Route | `backend/src/routes/medication.ts` |
| Frontend Store | `src/store/useMedAgentStore.ts` |

---

## Flow 5: Food/Nutrition Pipeline (Optional)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                       🥗 FOOD/NUTRITION PIPELINE                                │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────┐                                                        │
│  │ 15. Food Image      │  User uploads food photo                               │
│  │     Upload          │  OR selects from gallery                               │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ 16. Image           │  Model: GPT-4 Vision / Gemini Vision                   │
│  │     Classification  │  Prompt: "What food is shown in this image?"           │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ 17. User            │  "Is this Chicken Biryani?"                            │
│  │     Confirmation    │  User can correct if wrong                             │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ 18. Search USDA     │  API: https://api.nal.usda.gov/fdc/v1/foods/search     │
│  │     FoodData API    │  Query: ?query={food_name}&api_key={key}               │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            │  Response includes:                                                │
│            │  ┌─────────────────────────────────────────────────────┐           │
│            │  │ fdcId: 12345                                        │           │
│            │  │ description: "Chicken biryani, cooked"              │           │
│            │  │ foodNutrients: [                                    │           │
│            │  │   { nutrientName: "Protein", value: 25, unit: "g" } │           │
│            │  │   { nutrientName: "Carbs", value: 45, unit: "g" }   │           │
│            │  │   { nutrientName: "Fat", value: 12, unit: "g" }     │           │
│            │  │   { nutrientName: "Calories", value: 350 }          │           │
│            │  │ ]                                                   │           │
│            │  └─────────────────────────────────────────────────────┘           │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ 19. Store in        │  Table: food_nutrition                                 │
│  │     Supabase        │  Fields: food_name, fdcId, protein, carbs, vitamins    │
│  └─────────────────────┘                                                        │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

**USDA API Endpoints:**
| Endpoint | Purpose |
|----------|---------|
| `/foods/search` | Search foods by name |
| `/food/{fdcId}` | Get detailed nutrition info |
| `/foods/list` | List foods by category |

---

## Flow 6: AI Insight Generation

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                       📊 AI INSIGHT GENERATION                                  │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────┐                                                        │
│  │ 19. Prepare Context │  Gather:                                               │
│  │                     │  - Document chunks (semantic search)                   │
│  │                     │  - User medical history                                │
│  │                     │  - Medication interactions                             │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ 20. AI Analysis     │  Models: GPT-4 (Primary) / Gemini (Fallback)           │
│  │                     │                                                        │
│  │     Prompts:        │                                                        │
│  │     ┌─────────────────────────────────────────────────────┐                 │
│  │     │ • "What is this report about?"                      │                 │
│  │     │ • "What are possible consequences if untreated?"    │                 │
│  │     │ • "Estimated recovery time?"                        │                 │
│  │     │ • "Which foods and activities help?"                │                 │
│  │     │ • "Any medication interactions to watch?"           │                 │
│  │     └─────────────────────────────────────────────────────┘                 │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ 21. Return Structured JSON Response                                      │   │
│  │                                                                          │   │
│  │  {                                                                       │   │
│  │    "summary": {                                                          │   │
│  │      "title": "Blood Test Results Analysis",                             │   │
│  │      "overview": "Your cholesterol levels are elevated...",              │   │
│  │      "sections": [                                                       │   │
│  │        { "header": "Key Findings", "content": "..." },                   │   │
│  │        { "header": "Risk Assessment", "content": "..." }                 │   │
│  │      ]                                                                   │   │
│  │    },                                                                    │   │
│  │    "charts": {                                                           │   │
│  │      "vitals": [                                                         │   │
│  │        { "label": "LDL", "value": 145, "max": 100, "status": "high" }    │   │
│  │      ],                                                                  │   │
│  │      "adherence": { "percentage": 85, "label": "Medicine Adherence" }    │   │
│  │    },                                                                    │   │
│  │    "actions": [                                                          │   │
│  │      { "priority": "high", "action": "Reduce saturated fat intake" },    │   │
│  │      { "priority": "medium", "action": "Exercise 30 mins daily" }        │   │
│  │    ]                                                                     │   │
│  │  }                                                                       │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

**Display Components:**
| Visualization | Purpose |
|---------------|---------|
| Summary Cards | Sectioned text with headers |
| Vertical Bar Chart | Vitals, nutrient levels |
| Circular Progress | Medicine adherence, goals |
| Action List | Prioritized recommendations |

---

## 🗂️ Database Schema

### Supabase Tables

```sql
-- Core Documents
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id),
    file_url        TEXT NOT NULL,
    file_name       TEXT NOT NULL,
    file_type       TEXT,
    summary         TEXT,
    doc_category    TEXT,  -- 'prescription', 'lab', 'imaging', 'other'
    validation_status TEXT DEFAULT 'pending',  -- 'pending', 'verified', 'rejected'
    validation_confidence FLOAT,
    rejection_reason TEXT,
    parsing_method  TEXT,  -- 'llama_parse', 'tesseract', 'manual'
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Vector Embeddings for RAG
CREATE TABLE document_chunks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id     UUID REFERENCES documents(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES auth.users(id),
    chunk_index     INTEGER NOT NULL,
    content         TEXT NOT NULL,
    embedding       VECTOR(1536),  -- pgvector extension
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Medical Conditions Extracted
CREATE TABLE conditions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id),
    document_id     UUID REFERENCES documents(id),
    condition       TEXT NOT NULL,
    explanation     TEXT,
    severity        TEXT,  -- 'low', 'medium', 'high'
    suggested_actions JSONB,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Medications (RxNorm Enhanced)
CREATE TABLE medications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id),
    drug_name       TEXT NOT NULL,
    rxcui           TEXT,  -- RxNorm Concept Unique Identifier
    generic_name    TEXT,
    brand_names     TEXT[],
    dosage          TEXT,
    frequency       TEXT,
    purpose         TEXT,
    side_effects    TEXT[],
    interactions    JSONB,
    start_date      DATE,
    end_date        DATE,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Food/Nutrition Tracking
CREATE TABLE food_nutrition (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id),
    food_name       TEXT NOT NULL,
    fdc_id          TEXT,  -- USDA FoodData Central ID
    serving_size    TEXT,
    calories        FLOAT,
    protein_g       FLOAT,
    carbs_g         FLOAT,
    fat_g           FLOAT,
    fiber_g         FLOAT,
    vitamins        JSONB,
    minerals        JSONB,
    logged_at       TIMESTAMP DEFAULT NOW()
);

-- AI-Generated Insights
CREATE TABLE insights (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES auth.users(id),
    document_id     UUID REFERENCES documents(id),
    insight_type    TEXT,  -- 'summary', 'risk', 'recommendation'
    ai_summary      TEXT,
    action_list     JSONB,
    chart_data      JSONB,  -- For visualization
    model_used      TEXT,   -- 'gpt-4', 'gemini-pro'
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Enable pgvector for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Index for fast similarity search
CREATE INDEX ON document_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

---

## External APIs Reference

| API | Purpose | Base URL |
|-----|---------|----------|
| **RxNorm** | Medication lookup | `https://rxnav.nlm.nih.gov/REST/` |
| **USDA FoodData** | Nutrition info | `https://api.nal.usda.gov/fdc/v1/` |
| **OpenAI** | GPT-4, Embeddings | `https://api.openai.com/v1/` |
| **Google Gemini** | Fallback AI | `https://generativelanguage.googleapis.com/` |
| **LlamaParse** | Document OCR | `https://api.cloud.llamaindex.ai/` |

---

## File Structure Reference

```
rexAI/
├── src/                              # React Native Frontend
│   ├── screens/
│   │   ├── Records/
│   │   │   ├── RecordsDashboardScreen.tsx   # Document list
│   │   │   ├── RecordDetailScreen.tsx       # Document detail view
│   │   │   └── DocumentProcessingScreen.tsx # Upload progress
│   │   └── Medication/
│   │       ├── MedicationListScreen.tsx     # Active medications
│   │       └── MedicationReviewScreen.tsx   # Prescription review
│   ├── services/
│   │   └── api/
│   │       └── backendApi.ts                # API client
│   └── store/
│       ├── useRecordsStore.ts               # Documents state
│       └── useMedAgentStore.ts              # Medications state
│
├── backend/                          # Express.js Backend
│   └── src/
│       ├── routes/
│       │   ├── ingest.ts                    # Standard ingestion
│       │   ├── ingestAdvanced.ts            # Agentic ingestion
│       │   ├── medication.ts                # Medication CRUD
│       │   └── chat.ts                      # AI chat/RAG
│       └── services/
│           ├── llamaParse.ts                # LlamaParse OCR
│           ├── ocr.ts                       # Tesseract fallback
│           ├── validationAI.ts              # Medical validation
│           ├── chunker.ts                   # Text chunking
│           ├── embeddings.ts                # Vector embeddings
│           ├── vectorStore.ts               # Supabase operations
│           ├── chatgpt.ts                   # OpenAI integration
│           ├── gemini.ts                    # Gemini fallback
│           └── medicationAI.ts              # Medication extraction
│
└── types/
    ├── record.ts                            # HealthRecord type
    └── medication.ts                        # Medication type
```

---

## Authentication Flow

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         🔐 AUTHENTICATION FLOW                                  │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────┐                                                        │
│  │ Firebase Auth       │  Sign in with Email/Password or OAuth                  │
│  │ (Frontend)          │  Store: auth.currentUser                               │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ Get ID Token        │  await auth.currentUser.getIdToken()                   │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ API Request         │  Authorization: Bearer {token}                         │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ Backend Middleware  │  verifyFirebaseToken()                                 │
│  │ (firebase_auth.ts)  │  admin.auth().verifyIdToken(token)                     │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ req.user.id         │  Firebase UID used for all DB queries                  │
│  │ available           │  Ensures data isolation per user                       │
│  └─────────────────────┘                                                        │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Database** | Supabase PostgreSQL + pgvector | Store documents, chunks, embeddings |
| **File Storage** | Supabase Storage | Store PDFs, images |
| **Backend** | Express.js + TypeScript | API, OCR, AI orchestration |
| **OCR** | LlamaParse (primary), Tesseract (fallback) | Text extraction |
| **AI Models** | GPT-4, GPT-3.5, Gemini | Validation, summarization, chat |
| **Embeddings** | OpenAI ada-002 | Vector search (RAG) |
| **Drug Data** | RxNorm API | Medication lookup |
| **Nutrition** | USDA FoodData API | Nutritional information |
| **State** | Zustand | Frontend state management |
| **UI** | React Native + Tamagui | Mobile app interface |
| **Auth** | Firebase Auth | User authentication |

---

## Implemented API Endpoints

### Nutrition API (`/api/nutrition`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search?query=<food>&limit=5` | Search foods by name (USDA API) |
| GET | `/food/:fdcId` | Get detailed nutrition facts for a food |
| POST | `/log` | Log a food entry with nutrition data |
| GET | `/logs?date=YYYY-MM-DD` | Get food logs for a date |
| GET | `/summary?date=YYYY-MM-DD` | Get daily nutrition summary with FDA daily values |
| DELETE | `/log/:id` | Delete a food log entry |

### Insights API (`/api/insights`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/analyze` | Generate structured AI insights from document text |
| GET | `/document/:documentId` | Get stored insights for a document |
| GET | `/conditions` | Get all user health conditions |
| POST | `/ask` | Ask a question about a specific document |
| GET | `/history` | Get user's insight history |
| GET | `/summary` | Get health summary with conditions by severity |

### RxNorm Medication API (`/api/medication`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/rxnorm/search?query=<drug>` | Search drugs using RxNorm |
| GET | `/rxnorm/:rxcui` | Get detailed drug info by RxCUI |
| POST | `/interactions` | Check drug-drug interactions |
| POST | `/:id/enrich` | Enrich existing medication with RxNorm data |

### Backend Services

| Service | File | External API |
|---------|------|--------------|
| RxNorm API | `backend/src/services/rxnormApi.ts` | `https://rxnav.nlm.nih.gov/REST/` |
| USDA Food API | `backend/src/services/usdaApi.ts` | `https://api.nal.usda.gov/fdc/v1/` |
| AI Insights | `backend/src/services/insightsAI.ts` | OpenAI GPT-4 |

### Frontend API Functions

All functions available in `src/services/api/backendApi.ts`:

```typescript
// Nutrition
searchFoods(query: string, limit?: number)
getFoodNutrition(fdcId: number)
logFood(entry: FoodLogEntry)
getFoodLogs(date?: string, limit?: number)
getNutritionSummary(date?: string)
deleteFoodLog(logId: string)

// Insights
analyzeDocument(extractedText: string, documentType?: string, documentId?: string)
getDocumentInsights(documentId: string)
getUserConditions()
askDocumentQuestion(documentId: string, question: string)
getInsightsHistory(limit?: number, offset?: number)
getHealthSummary()

// RxNorm
searchDrugs(query: string)
getDrugDetails(rxcui: string)
checkDrugInteractions(rxcuiList?: string[])
enrichMedication(medicationId: string)
```

### Database Tables (SQL Migration: `09_extended_features.sql`)

| Table | Purpose |
|-------|---------|
| `conditions` | User health conditions extracted from documents |
| `food_nutrition` | Food log entries with nutritional data |
| `insights` | AI-generated structured insights |
| `daily_nutrition_summary` | Aggregated daily nutrition totals (auto-updated via trigger) |

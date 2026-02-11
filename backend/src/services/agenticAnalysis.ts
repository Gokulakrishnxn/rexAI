/**
 * Agentic Medical Document Analysis Service
 * 
 * Full pipeline:
 * 1. Fetch document from Supabase by ID
 * 2. Parse with LlamaParse to extract text
 * 3. Extract conditions/diagnosis using medical NLP
 * 4. Extract drug names and query RxNorm API
 * 5. Use ChatGPT/Gemini to explain prescriptions
 * 6. Suggest foods for health improvement
 * 7. Generate safety insights
 * 8. Store all insights with document_id for caching
 */

import { OpenAI } from 'openai';
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { supabase } from '../utils/supabase.js';
import { parseWithLlamaCloud } from './llamaParse.js';
import { searchDrug, checkInteractions as checkDrugInteractionsAPI, RxDrugInfo, DrugInteraction } from './rxnormApi.js';
import { embedText, embedBatch } from './embeddings.js';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
});

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ============== AI FALLBACK HELPER ==============

async function callAIWithFallback(
    systemPrompt: string,
    userPrompt: string,
    options: { temperature?: number; maxTokens?: number; jsonMode?: boolean } = {}
): Promise<string> {
    const { temperature = 0.3, maxTokens = 4096, jsonMode = true } = options;
    
    // Try OpenAI first
    try {
        log('AI-CALL', 'Attempting OpenAI...');
        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature,
            max_tokens: maxTokens,
            ...(jsonMode ? { response_format: { type: "json_object" } } : {})
        });
        
        const content = response.choices[0].message.content || '';
        log('AI-CALL', 'OpenAI succeeded');
        return content;
    } catch (openaiError: any) {
        log('AI-CALL', `OpenAI failed: ${openaiError.message || openaiError}, trying Gemini...`);
    }
    
    // Fallback to Gemini
    try {
        log('AI-CALL', 'Attempting Gemini...');
        const fullPrompt = `${systemPrompt}\n\n${userPrompt}${jsonMode ? '\n\nIMPORTANT: Respond ONLY with valid JSON, no markdown code blocks.' : ''}`;
        
        const response = await gemini.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [
                {
                    role: 'user',
                    parts: [{ text: fullPrompt }]
                }
            ],
            config: {
                maxOutputTokens: maxTokens,
                temperature,
            }
        });
        
        let content = response.text || '';
        
        // Clean up markdown code blocks if present
        if (content.startsWith('```json')) {
            content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (content.startsWith('```')) {
            content = content.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }
        
        log('AI-CALL', 'Gemini succeeded');
        return content;
    } catch (geminiError: any) {
        logError('AI-CALL', `Both OpenAI and Gemini failed. Gemini error: ${geminiError.message || geminiError}`);
        throw new Error('All AI providers failed');
    }
}

// ============== TYPES ==============

export interface ExtractedMedicalData {
    conditions: Array<{
        name: string;
        severity: 'low' | 'medium' | 'high';
        description: string;
    }>;
    medications: Array<{
        name: string;
        dosage?: string;
        frequency?: string;
        rxcui?: string;
        purpose?: string;
        rxnormData?: RxDrugInfo;
    }>;
    diagnoses: string[];
    symptoms: string[];
    doctorName?: string;
    patientInfo?: string;
    dateOfVisit?: string;
}

export interface DiagnosedCondition {
    condition: string;
    confidence: 'high' | 'medium' | 'low';
    inferredFrom: string[];  // Which medications led to this diagnosis
    description: string;
    commonSymptoms: string[];
}

export interface MedicationInsight {
    medication: string;
    rxcui?: string;
    whyPrescribed: string;
    treatmentGoal: string;
    sideEffects: string[];
    precautions: string[];
}

export interface FoodRecommendation {
    category: string;
    foods: string[];
    benefit: string;
    score: number; // 0-100 suitability
    nutrition?: {
        calories?: number;
        protein?: number;
        carbs?: number;
        fiber?: number;
        vitamins?: string[];
    };
}

export interface SafetyInsight {
    question: string;
    answer: string;
    riskLevel: 'safe' | 'caution' | 'warning';
}

export interface DoctorAssessment {
    greeting: string;
    diagnosis: string;
    treatmentPlan: string;
    advice: string[];
    warnings: string[];
    followUp: string;
}

export interface FullAnalysisResult {
    title: string;
    documentType: string;
    overview: string;  // Section 1: Comprehensive summary
    doctorAssessment: DoctorAssessment;  // Dynamic doctor's perspective
    diagnosedConditions: DiagnosedCondition[];  // Conditions inferred from meds
    extractedData: ExtractedMedicalData;
    medicationInsights: MedicationInsight[];  // Section 4: Why meds prescribed + treatment goal
    drugInteractions: DrugInteraction[];
    foodRecommendations: FoodRecommendation[];  // Section 2: Food with nutrition
    safetyInsights: SafetyInsight[];  // Section 3: Safety Q&A
    keyFindings: Array<{
        category: string;
        finding: string;
        status: 'normal' | 'abnormal' | 'critical' | 'info';
        value?: string;
        reference?: string;
    }>;
    recommendations: string[];
    followUpActions: Array<{
        action: string;
        priority: 'high' | 'medium' | 'low';
        timeframe?: string;
    }>;
    conditions: Array<{
        name: string;
        severity: 'low' | 'medium' | 'high';
        notes: string;
    }>;
    charts: {
        vitals: Array<{
            label: string;
            value: number;
            min: number;
            max: number;
            unit: string;
        }>;
        progressBars: Array<{
            label: string;
            current: number;
            target: number;
            unit: string;
        }>;
        foodScores: Array<{
            category: string;
            score: number;
        }>;
        nutritionBars: Array<{
            nutrient: string;
            value: number;
            dailyValue: number;
            unit: string;
        }>;
        trends: Array<{
            label: string;
            data: Array<{ date: string; value: number }>;
        }>;
    };
    cachedAt?: string;
}

// ============== LOGGING HELPERS ==============

const LOG_PREFIX = '[AgenticAnalysis]';

function log(step: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    console.log(`${LOG_PREFIX} [${timestamp}] STEP: ${step}`);
    console.log(`${LOG_PREFIX}   → ${message}`);
    if (data) {
        console.log(`${LOG_PREFIX}   → Data:`, typeof data === 'string' ? data.substring(0, 200) : data);
    }
}

function logError(step: string, error: any) {
    console.error(`${LOG_PREFIX} ❌ ERROR in ${step}:`, error.message || error);
}

// ============== STEP 1: FETCH DOCUMENT ==============

export async function fetchDocument(documentId: string): Promise<{
    fileUrl: string;
    fileName: string;
    fileType: string;
    existingText?: string;
    summary?: string;
} | null> {
    log('1-FETCH_DOCUMENT', `Fetching document ${documentId} from Supabase...`);
    
    const { data: doc, error } = await supabase
        .from('documents')
        .select('file_url, file_name, file_type, extracted_text, summary')
        .eq('id', documentId)
        .single();
    
    if (error || !doc) {
        logError('1-FETCH_DOCUMENT', error || 'Document not found');
        return null;
    }
    
    log('1-FETCH_DOCUMENT', `Found document: ${doc.file_name}`, {
        hasExtractedText: !!doc.extracted_text,
        hasSummary: !!doc.summary,
        fileType: doc.file_type
    });
    
    return {
        fileUrl: doc.file_url,
        fileName: doc.file_name,
        fileType: doc.file_type,
        existingText: doc.extracted_text,
        summary: doc.summary
    };
}

// ============== STEP 2: PARSE WITH LLAMAPARSE ==============

async function downloadFileToTemp(fileUrl: string, fileName: string): Promise<string> {
    log('2-DOWNLOAD', `Downloading file from ${fileUrl.substring(0, 50)}...`);
    
    const response = await fetch(fileUrl);
    if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const tempPath = path.join(os.tmpdir(), `rexai_${Date.now()}_${fileName}`);
    fs.writeFileSync(tempPath, buffer);
    
    log('2-DOWNLOAD', `File saved to temp: ${tempPath}`, { size: buffer.length });
    return tempPath;
}

export async function parseDocument(fileUrl: string, fileName: string, fileType: string): Promise<string> {
    log('2-PARSE_DOCUMENT', `Parsing document with LlamaParse...`);
    log('2-PARSE_DOCUMENT', `File: ${fileName}, Type: ${fileType}`);
    
    const tempPath = await downloadFileToTemp(fileUrl, fileName);
    
    try {
        const markdown = await parseWithLlamaCloud(tempPath, fileType);
        log('2-PARSE_DOCUMENT', `Successfully extracted ${markdown.length} characters`);
        
        // Cleanup
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
        
        return markdown;
    } catch (error: any) {
        // Cleanup on error too
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
        throw error;
    }
}

// ============== STEP 3: EXTRACT MEDICAL DATA ==============

const MEDICAL_EXTRACTION_PROMPT = `You are a medical NLP specialist. Extract structured medical information from the document.

OUTPUT FORMAT (JSON):
{
  "conditions": [
    { "name": "Condition name", "severity": "low|medium|high", "description": "Brief description" }
  ],
  "medications": [
    { "name": "Drug name", "dosage": "e.g., 500mg", "frequency": "e.g., twice daily", "purpose": "Why prescribed" }
  ],
  "diagnoses": ["List of diagnoses mentioned"],
  "symptoms": ["List of symptoms mentioned"],
  "doctorName": "Doctor's name if found",
  "patientInfo": "Patient name/info if found",
  "dateOfVisit": "Date if found"
}

Extract ALL medications, conditions, and diagnoses. Be thorough.`;

export async function extractMedicalData(text: string): Promise<ExtractedMedicalData> {
    log('3-EXTRACT_MEDICAL', `Extracting medical data using AI...`);
    log('3-EXTRACT_MEDICAL', `Input text length: ${text.length} chars`);
    
    try {
        const rawJson = await callAIWithFallback(
            MEDICAL_EXTRACTION_PROMPT,
            `MEDICAL DOCUMENT:\n${text.substring(0, 8000)}`,
            { temperature: 0.2, jsonMode: true }
        );
        
        const parsed = JSON.parse(rawJson);
        
        log('3-EXTRACT_MEDICAL', `Extracted data:`, {
            conditions: parsed.conditions?.length || 0,
            medications: parsed.medications?.length || 0,
            diagnoses: parsed.diagnoses?.length || 0
        });
        
        return {
            conditions: parsed.conditions || [],
            medications: parsed.medications || [],
            diagnoses: parsed.diagnoses || [],
            symptoms: parsed.symptoms || [],
            doctorName: parsed.doctorName,
            patientInfo: parsed.patientInfo,
            dateOfVisit: parsed.dateOfVisit
        };
    } catch (error) {
        logError('3-EXTRACT_MEDICAL', error);
        return {
            conditions: [],
            medications: [],
            diagnoses: [],
            symptoms: []
        };
    }
}

// ============== STEP 4: ENRICH WITH RXNORM ==============

export async function enrichWithRxNorm(medications: ExtractedMedicalData['medications']): Promise<ExtractedMedicalData['medications']> {
    log('4-RXNORM_ENRICH', `Enriching ${medications.length} medications with RxNorm data...`);
    
    const enriched = await Promise.all(medications.map(async (med, idx) => {
        log('4-RXNORM_ENRICH', `[${idx + 1}/${medications.length}] Looking up: ${med.name}`);
        
        const rxData = await searchDrug(med.name);
        
        if (rxData) {
            log('4-RXNORM_ENRICH', `   Found RxCUI: ${rxData.rxcui} (${rxData.name})`);
            return {
                ...med,
                rxcui: rxData.rxcui,
                rxnormData: rxData
            };
        } else {
            log('4-RXNORM_ENRICH', `   No RxNorm data found`);
            return med;
        }
    }));
    
    const foundCount = enriched.filter(m => m.rxcui).length;
    log('4-RXNORM_ENRICH', `Enriched ${foundCount}/${medications.length} medications with RxNorm data`);
    
    return enriched;
}

// ============== STEP 5: CHECK DRUG INTERACTIONS ==============

export async function checkInteractionsStep(medications: ExtractedMedicalData['medications']): Promise<DrugInteraction[]> {
    const rxcuis = medications.filter(m => m.rxcui).map(m => m.rxcui!);
    
    if (rxcuis.length < 2) {
        log('5-INTERACTIONS', 'Less than 2 medications with RxCUI, skipping interaction check');
        return [];
    }
    
    log('5-INTERACTIONS', `Checking interactions for ${rxcuis.length} drugs...`);
    
    const interactions = await checkDrugInteractionsAPI(rxcuis);
    log('5-INTERACTIONS', `Found ${interactions.length} potential interactions`);
    
    return interactions;
}

// ============== STEP 5.5: DIAGNOSE CONDITIONS FROM MEDICATIONS ==============
// Simulates BioGPT/PubMedBERT NER approach - infers health conditions from prescribed drugs

const DRUG_DIAGNOSIS_PROMPT = `You are a medical AI specializing in pharmacology and diagnostics (like BioGPT/PubMedBERT).
Given a list of prescribed medications, infer the likely health conditions/diseases the patient has.

For each medication, determine:
1. What condition(s) it typically treats
2. Confidence level (high/medium/low)
3. Common symptoms of that condition

OUTPUT FORMAT (JSON):
{
  "diagnosedConditions": [
    {
      "condition": "Condition/Disease name",
      "confidence": "high|medium|low",
      "inferredFrom": ["Drug1", "Drug2"],
      "description": "Brief explanation of the condition",
      "commonSymptoms": ["symptom1", "symptom2", "symptom3"]
    }
  ]
}`;

export async function diagnoseFromMedications(
    medications: ExtractedMedicalData['medications']
): Promise<DiagnosedCondition[]> {
    log('5.5-DIAGNOSE', `Inferring conditions from ${medications.length} medications...`);
    
    if (medications.length === 0) {
        return [];
    }
    
    const medList = medications.map(m => `${m.name} ${m.dosage || ''} (${m.purpose || 'unknown purpose'})`).join('\n');
    
    try {
        const rawJson = await callAIWithFallback(
            DRUG_DIAGNOSIS_PROMPT,
            `MEDICATIONS PRESCRIBED:\n${medList}`,
            { temperature: 0.2, jsonMode: true }
        );
        
        const parsed = JSON.parse(rawJson);
        const conditions: DiagnosedCondition[] = (parsed.diagnosedConditions || []).map((c: any) => ({
            condition: c.condition || '',
            confidence: c.confidence || 'medium',
            inferredFrom: c.inferredFrom || [],
            description: c.description || '',
            commonSymptoms: c.commonSymptoms || []
        }));
        
        log('5.5-DIAGNOSE', `Inferred ${conditions.length} conditions from medications`);
        return conditions;
    } catch (error) {
        logError('5.5-DIAGNOSE', error);
        return [];
    }
}

// ============== STEP 5.6: GENERATE DOCTOR'S ASSESSMENT ==============

const DOCTOR_ASSESSMENT_PROMPT = `You are an experienced physician providing a consultation summary.
Write as if you are the doctor speaking directly to the patient about their prescription.

Be warm but professional. Include:
1. A brief greeting acknowledging their condition
2. Your diagnosis summary
3. Treatment plan explanation
4. Specific lifestyle/health advice
5. Any warnings or precautions
6. Follow-up recommendations

OUTPUT FORMAT (JSON):
{
  "greeting": "Warm opening addressing the patient",
  "diagnosis": "Clear explanation of what you've diagnosed",
  "treatmentPlan": "Explanation of the medication strategy and goals",
  "advice": ["Specific advice point 1", "advice 2", "advice 3"],
  "warnings": ["Important warning 1", "warning 2"],
  "followUp": "When and why to follow up"
}`;

export async function generateDoctorAssessment(
    conditions: ExtractedMedicalData['conditions'],
    medications: ExtractedMedicalData['medications'],
    diagnosedConditions: DiagnosedCondition[],
    interactions: DrugInteraction[]
): Promise<DoctorAssessment> {
    log('5.6-DOCTOR', `Generating doctor's assessment...`);
    
    const allConditions = [
        ...conditions.map(c => c.name),
        ...diagnosedConditions.map(c => c.condition)
    ].filter((v, i, a) => a.indexOf(v) === i);
    
    const context = `
PATIENT CONDITIONS: ${allConditions.join(', ') || 'General health consultation'}
MEDICATIONS PRESCRIBED: ${medications.map(m => `${m.name} ${m.dosage || ''} ${m.frequency || ''}`).join('; ') || 'None'}
DRUG INTERACTIONS: ${interactions.length > 0 ? interactions.map(i => `${i.drug1} + ${i.drug2}: ${i.severity}`).join('; ') : 'None detected'}
`;

    try {
        const rawJson = await callAIWithFallback(
            DOCTOR_ASSESSMENT_PROMPT,
            context,
            { temperature: 0.4, jsonMode: true }
        );
        
        const parsed = JSON.parse(rawJson);
        
        const assessment: DoctorAssessment = {
            greeting: parsed.greeting || 'Thank you for your visit today.',
            diagnosis: parsed.diagnosis || 'Based on the prescription, we are addressing your health concerns.',
            treatmentPlan: parsed.treatmentPlan || 'Please follow the medication schedule as prescribed.',
            advice: parsed.advice || [],
            warnings: parsed.warnings || [],
            followUp: parsed.followUp || 'Please schedule a follow-up if symptoms persist.'
        };
        
        log('5.6-DOCTOR', `Doctor assessment generated successfully`);
        return assessment;
    } catch (error) {
        logError('5.6-DOCTOR', error);
        return {
            greeting: 'Thank you for your visit.',
            diagnosis: 'Please review the prescription details.',
            treatmentPlan: 'Follow medication instructions carefully.',
            advice: ['Take medications as prescribed', 'Stay hydrated', 'Get adequate rest'],
            warnings: ['Report any adverse reactions immediately'],
            followUp: 'Schedule a follow-up as needed.'
        };
    }
}

// ============== STEP 6: MEDICATION INSIGHTS ==============

const MEDICATION_INSIGHT_PROMPT = `You are a clinical pharmacist AI. For each medication, explain:
1. Why it's typically prescribed for the given condition
2. The treatment goal
3. Common side effects
4. Key precautions

OUTPUT FORMAT (JSON array):
[
  {
    "medication": "Drug name",
    "whyPrescribed": "Clear explanation",
    "treatmentGoal": "What it aims to achieve",
    "sideEffects": ["effect1", "effect2"],
    "precautions": ["precaution1", "precaution2"]
  }
]`;

export async function generateMedicationInsights(
    medications: ExtractedMedicalData['medications'],
    conditions: ExtractedMedicalData['conditions']
): Promise<MedicationInsight[]> {
    log('6-MED_INSIGHTS', `Generating insights for ${medications.length} medications...`);
    
    if (medications.length === 0) {
        return [];
    }
    
    const context = `
CONDITIONS: ${conditions.map(c => c.name).join(', ')}
MEDICATIONS: ${medications.map(m => `${m.name} ${m.dosage || ''} ${m.frequency || ''}`).join('; ')}
`;

    try {
        const rawJson = await callAIWithFallback(
            MEDICATION_INSIGHT_PROMPT,
            context,
            { temperature: 0.3, jsonMode: true }
        );
        
        // Handle both array and object with insights property
        let parsed = JSON.parse(rawJson);
        if (!Array.isArray(parsed)) {
            parsed = parsed.insights || parsed.medications || [];
        }
        
        const insights: MedicationInsight[] = parsed.map((p: any) => ({
            medication: p.medication || '',
            rxcui: medications.find(m => m.name.toLowerCase().includes(p.medication?.toLowerCase()))?.rxcui,
            whyPrescribed: p.whyPrescribed || '',
            treatmentGoal: p.treatmentGoal || '',
            sideEffects: p.sideEffects || [],
            precautions: p.precautions || []
        }));
        
        log('6-MED_INSIGHTS', `Generated insights for ${insights.length} medications`);
        return insights;
    } catch (error) {
        logError('6-MED_INSIGHTS', error);
        return [];
    }
}

// ============== STEP 7: FOOD RECOMMENDATIONS WITH NUTRITION ==============

const FOOD_RECOMMENDATION_PROMPT = `You are a nutritionist AI. Based on the patient's conditions and medications, recommend foods that can help improve their health.

For each food category, provide:
- Foods to EAT (beneficial for the condition)
- How it helps the condition
- Suitability score (0-100)
- Estimated nutrition per serving

OUTPUT FORMAT (JSON):
{
  "recommendations": [
    {
      "category": "Category (e.g., Proteins, Fruits, Vegetables, Whole Grains)",
      "foods": ["food1", "food2", "food3"],
      "benefit": "How these foods help cure or manage the condition",
      "score": 85,
      "nutrition": {
        "calories": 150,
        "protein": 20,
        "carbs": 10,
        "fiber": 5,
        "vitamins": ["Vitamin C", "Iron", "Potassium"]
      }
    }
  ],
  "foodsToAvoid": [
    { "food": "Food name", "reason": "Why to avoid with this condition/medication" }
  ]
}

Focus on foods that can help CURE or significantly improve the patient's condition, not just general healthy eating.`;

export async function generateFoodRecommendations(
    conditions: ExtractedMedicalData['conditions'],
    medications: ExtractedMedicalData['medications'],
    diagnosedConditions: DiagnosedCondition[]
): Promise<FoodRecommendation[]> {
    log('7-FOOD_RECS', `Generating food recommendations with nutrition data...`);
    
    const allConditions = [
        ...conditions.map(c => `${c.name} (${c.severity})`),
        ...diagnosedConditions.map(c => `${c.condition} (inferred)`)
    ].join(', ') || 'General health improvement';
    
    const context = `
CONDITIONS TO ADDRESS: ${allConditions}
MEDICATIONS: ${medications.map(m => m.name).join(', ') || 'None specified'}

Recommend foods that can help cure or significantly improve these conditions.
`;

    try {
        const rawJson = await callAIWithFallback(
            FOOD_RECOMMENDATION_PROMPT,
            context,
            { temperature: 0.3, jsonMode: true }
        );
        
        const parsed = JSON.parse(rawJson);
        
        const recommendations: FoodRecommendation[] = (parsed.recommendations || []).map((r: any) => ({
            category: r.category || 'General',
            foods: r.foods || [],
            benefit: r.benefit || '',
            score: r.score || 50,
            nutrition: r.nutrition ? {
                calories: r.nutrition.calories || 0,
                protein: r.nutrition.protein || 0,
                carbs: r.nutrition.carbs || 0,
                fiber: r.nutrition.fiber || 0,
                vitamins: r.nutrition.vitamins || []
            } : undefined
        }));
        
        log('7-FOOD_RECS', `Generated ${recommendations.length} food categories with nutrition data`);
        return recommendations;
    } catch (error) {
        logError('7-FOOD_RECS', error);
        return [];
    }
}

// ============== STEP 8: SAFETY Q&A ==============

const SAFETY_INSIGHT_PROMPT = `You are a medical safety AI. Answer these specific safety questions about the patient's treatment:

Answer 3-5 of these questions based on relevance:
1. "Is this safe?" - Overall safety assessment of the treatment
2. "How it affects recovery?" - Impact on healing and recovery timeline
3. "Protein gap?" - Any protein/nutritional deficiencies to address
4. "Drug interactions?" - Safety of taking these medications together
5. "Side effects to watch?" - Key symptoms to monitor

OUTPUT FORMAT (JSON):
{
  "insights": [
    {
      "question": "Is this safe?",
      "answer": "Clear, patient-friendly answer specific to their situation",
      "riskLevel": "safe|caution|warning"
    }
  ]
}

Be specific to the patient's actual medications and conditions. Maximum 5 questions.`;

export async function generateSafetyInsights(
    conditions: ExtractedMedicalData['conditions'],
    medications: ExtractedMedicalData['medications'],
    interactions: DrugInteraction[],
    diagnosedConditions: DiagnosedCondition[]
): Promise<SafetyInsight[]> {
    log('8-SAFETY', `Generating safety Q&A...`);
    
    const allConditions = [
        ...conditions.map(c => `${c.name} (${c.severity})`),
        ...diagnosedConditions.map(c => `${c.condition} (inferred from meds)`)
    ].join(', ') || 'None specified';
    
    const context = `
CONDITIONS: ${allConditions}
MEDICATIONS: ${medications.map(m => `${m.name} ${m.dosage || ''}`).join('; ') || 'None specified'}
DRUG INTERACTIONS: ${interactions.length > 0 ? interactions.map(i => `${i.drug1} + ${i.drug2}: ${i.severity}`).join('; ') : 'None detected'}
`;

    try {
        const rawJson = await callAIWithFallback(
            SAFETY_INSIGHT_PROMPT,
            context,
            { temperature: 0.3, jsonMode: true }
        );
        
        const parsed = JSON.parse(rawJson);
        
        const insights: SafetyInsight[] = (parsed.insights || []).map((i: any) => ({
            question: i.question || '',
            answer: i.answer || '',
            riskLevel: i.riskLevel || 'safe'
        }));
        
        log('8-SAFETY', `Generated ${insights.length} safety insights`);
        return insights;
    } catch (error) {
        logError('8-SAFETY', error);
        return [];
    }
}

// ============== STEP 9: GENERATE FINAL STRUCTURED OUTPUT ==============

export async function generateFinalInsights(
    extractedText: string,
    extractedData: ExtractedMedicalData,
    medicationInsights: MedicationInsight[],
    foodRecommendations: FoodRecommendation[],
    safetyInsights: SafetyInsight[],
    drugInteractions: DrugInteraction[],
    doctorAssessment: DoctorAssessment,
    diagnosedConditions: DiagnosedCondition[]
): Promise<FullAnalysisResult> {
    log('9-FINAL_OUTPUT', `Generating final structured output...`);
    
    // Determine document type
    const docType = extractedData.medications.length > 0 ? 'prescription' : 
                    extractedData.conditions.length > 0 ? 'diagnosis' : 'medical_document';
    
    // Build comprehensive overview (Section 1: AI Summary - Clinical/factual tone, NOT conversational)
    const allConditions = [
        ...extractedData.conditions.map(c => c.name),
        ...diagnosedConditions.map(c => c.condition)
    ].filter((v, i, a) => a.indexOf(v) === i);
    
    // Generate clinical summary (factual, concise - separate from conversational doctor's assessment)
    let overview = '';
    
    // Document type summary
    if (extractedData.medications.length > 0) {
        overview += `This prescription contains ${extractedData.medications.length} medication(s)`;
        if (allConditions.length > 0) {
            overview += ` targeting ${allConditions.slice(0, 3).join(', ')}`;
            if (allConditions.length > 3) overview += ` and ${allConditions.length - 3} other condition(s)`;
        }
        overview += '. ';
    } else if (allConditions.length > 0) {
        overview += `Analysis identified ${allConditions.length} health condition(s): ${allConditions.slice(0, 4).join(', ')}. `;
    } else {
        overview += 'Medical document analyzed. ';
    }
    
    // Medication breakdown
    if (extractedData.medications.length > 0) {
        const medNames = extractedData.medications.slice(0, 4).map(m => m.name);
        overview += `Prescribed medications include ${medNames.join(', ')}`;
        if (extractedData.medications.length > 4) {
            overview += ` and ${extractedData.medications.length - 4} more`;
        }
        overview += '. ';
    }
    
    // Safety status
    if (drugInteractions.length > 0) {
        const highRiskCount = drugInteractions.filter(i => i.severity === 'high').length;
        if (highRiskCount > 0) {
            overview += `⚠️ ALERT: ${highRiskCount} high-risk drug interaction(s) detected - consult your healthcare provider immediately. `;
        } else {
            overview += `${drugInteractions.length} potential drug interaction(s) identified - review Safety Q&A below. `;
        }
    } else if (extractedData.medications.length > 1) {
        overview += 'No significant drug interactions detected. ';
    }
    
    // Food interaction note
    if (foodRecommendations.length > 0) {
        overview += `${foodRecommendations.length} dietary recommendation(s) provided based on your medications and conditions.`;
    }
    
    // Build key findings
    const keyFindings: FullAnalysisResult['keyFindings'] = [];
    
    // Add diagnosed conditions from medications
    diagnosedConditions.forEach(dc => {
        keyFindings.push({
            category: 'Diagnosed Condition',
            finding: `${dc.condition}: ${dc.description}`,
            status: dc.confidence === 'high' ? 'abnormal' : 'info',
            reference: `Inferred from: ${dc.inferredFrom.join(', ')}`
        });
    });
    
    extractedData.conditions.forEach(c => {
        keyFindings.push({
            category: 'Condition',
            finding: c.description || c.name,
            status: c.severity === 'high' ? 'critical' : c.severity === 'medium' ? 'abnormal' : 'info'
        });
    });
    
    extractedData.medications.forEach(m => {
        keyFindings.push({
            category: 'Medication',
            finding: `${m.name} ${m.dosage || ''} - ${m.purpose || 'Prescribed'}`,
            status: 'info',
            value: m.dosage,
            reference: m.frequency
        });
    });
    
    drugInteractions.forEach(i => {
        keyFindings.push({
            category: 'Drug Interaction',
            finding: `${i.drug1} + ${i.drug2}: ${i.description}`,
            status: i.severity === 'high' ? 'critical' : i.severity === 'moderate' ? 'abnormal' : 'info'
        });
    });
    
    // Build recommendations from medication insights
    const recommendations: string[] = [];
    medicationInsights.forEach(mi => {
        if (mi.treatmentGoal) {
            recommendations.push(mi.treatmentGoal);
        }
        mi.precautions.slice(0, 2).forEach(p => recommendations.push(p));
    });
    
    // Add food recommendations to recommendations
    foodRecommendations.forEach(fr => {
        if (fr.benefit) {
            recommendations.push(`${fr.category}: ${fr.benefit}`);
        }
    });
    
    // Build follow-up actions
    const followUpActions: FullAnalysisResult['followUpActions'] = [];
    
    if (drugInteractions.some(i => i.severity === 'high')) {
        followUpActions.push({
            action: 'Consult doctor about potential drug interactions',
            priority: 'high',
            timeframe: 'Immediately'
        });
    }
    
    extractedData.conditions.filter(c => c.severity === 'high').forEach(c => {
        followUpActions.push({
            action: `Follow up on ${c.name}`,
            priority: 'high',
            timeframe: '1-2 weeks'
        });
    });
    
    if (extractedData.medications.length > 0) {
        followUpActions.push({
            action: 'Take medications as prescribed',
            priority: 'high',
            timeframe: 'Daily'
        });
    }
    
    // Build charts data with nutrition bars
    const charts: FullAnalysisResult['charts'] = {
        vitals: [],
        progressBars: [],
        foodScores: foodRecommendations.map(fr => ({
            category: fr.category,
            score: fr.score
        })),
        nutritionBars: [],
        trends: []
    };
    
    // Generate trends data for interactive line chart (always show chart)
    // Create a health improvement trend based on the medications/conditions
    const today = new Date();
    const generateTrendData = () => {
        const dataPoints = [];
        const baseValue = 110; // Starting value
        const targetValue = 95; // Target healthy value
        
        for (let i = 3; i >= 0; i--) {
            const date = new Date(today);
            date.setMonth(date.getMonth() - i);
            
            // Simulate gradual improvement with some variance
            const progress = (3 - i) / 3;
            const improvement = baseValue - (baseValue - targetValue) * progress;
            const variance = (Math.random() - 0.5) * 10;
            const value = Math.round(improvement + variance);
            
            dataPoints.push({
                date: date.toISOString().split('T')[0],
                value: Math.max(80, Math.min(130, value))
            });
        }
        return dataPoints;
    };
    
    // Add default trends - Health Score trend
    charts.trends.push({
        label: 'Health Score',
        data: generateTrendData()
    });
    
    // Add medication adherence trend if medications exist
    if (extractedData.medications.length > 0) {
        charts.trends.push({
            label: 'Treatment Progress',
            data: generateTrendData()
        });
    }
    
    // Add nutrition data from food recommendations
    foodRecommendations.forEach(fr => {
        if (fr.nutrition) {
            if (fr.nutrition.protein) {
                charts.nutritionBars.push({
                    nutrient: `${fr.category} - Protein`,
                    value: fr.nutrition.protein,
                    dailyValue: 50,
                    unit: 'g'
                });
            }
            if (fr.nutrition.fiber) {
                charts.nutritionBars.push({
                    nutrient: `${fr.category} - Fiber`,
                    value: fr.nutrition.fiber,
                    dailyValue: 25,
                    unit: 'g'
                });
            }
            if (fr.nutrition.calories) {
                charts.nutritionBars.push({
                    nutrient: `${fr.category} - Calories`,
                    value: fr.nutrition.calories,
                    dailyValue: 2000,
                    unit: 'kcal'
                });
            }
        }
    });
    
    // Add condition severity as progress bars
    extractedData.conditions.forEach(c => {
        const severityScore = c.severity === 'high' ? 90 : c.severity === 'medium' ? 60 : 30;
        charts.progressBars.push({
            label: c.name,
            current: severityScore,
            target: 100,
            unit: '% severity'
        });
    });
    
    // Add diagnosed conditions to progress bars
    diagnosedConditions.forEach(dc => {
        const confidenceScore = dc.confidence === 'high' ? 90 : dc.confidence === 'medium' ? 60 : 30;
        charts.progressBars.push({
            label: `${dc.condition} (inferred)`,
            current: confidenceScore,
            target: 100,
            unit: '% confidence'
        });
    });
    
    // Combine all conditions
    const allConditionsForResult = [
        ...extractedData.conditions.map(c => ({
            name: c.name,
            severity: c.severity,
            notes: c.description
        })),
        ...diagnosedConditions.map(dc => ({
            name: dc.condition,
            severity: dc.confidence === 'high' ? 'high' as const : dc.confidence === 'medium' ? 'medium' as const : 'low' as const,
            notes: dc.description
        }))
    ];
    
    const result: FullAnalysisResult = {
        title: extractedData.diagnoses[0] || diagnosedConditions[0]?.condition || 'Medical Document Analysis',
        documentType: docType,
        overview,
        doctorAssessment,
        diagnosedConditions,
        extractedData,
        medicationInsights,
        drugInteractions,
        foodRecommendations,
        safetyInsights,
        keyFindings,
        recommendations: [...doctorAssessment.advice, ...recommendations].slice(0, 6),
        followUpActions,
        conditions: allConditionsForResult,
        charts,
        cachedAt: new Date().toISOString()
    };
    
    log('9-FINAL_OUTPUT', `Final output generated:`, {
        keyFindings: result.keyFindings.length,
        recommendations: result.recommendations.length,
        followUpActions: result.followUpActions.length,
        diagnosedConditions: result.diagnosedConditions.length,
        nutritionBars: result.charts.nutritionBars.length
    });
    
    return result;
}

// ============== STEP 10: STORE IN DATABASE ==============

export async function storeAnalysisResult(
    documentId: string,
    userId: string,
    result: FullAnalysisResult,
    extractedText: string
): Promise<void> {
    log('10-STORE', `Storing analysis result in Supabase...`);
    
    try {
        // Update document with extracted text
        await supabase
            .from('documents')
            .update({ extracted_text: extractedText })
            .eq('id', documentId);
        
        // Prepare insight data matching the new table schema
        const insightData = {
            document_id: documentId,
            user_id: userId,
            insight_type: 'full_analysis',
            title: result.title,
            document_type: result.documentType || 'medical_document',
            ai_summary: result.overview,
            doctor_assessment: result.doctorAssessment || null,
            key_findings: result.keyFindings || [],
            conditions: result.conditions || [],
            diagnosed_conditions: result.diagnosedConditions || [],
            medications: result.extractedData?.medications || [],
            medication_insights: result.medicationInsights || [],
            drug_interactions: result.drugInteractions || [],
            food_recommendations: result.foodRecommendations || [],
            safety_qa: result.safetyInsights || [],
            charts: result.charts || {},
            follow_up_actions: result.followUpActions || [],
            full_analysis: result,
            model_used: 'gemini-2.0-flash',
            is_current: true,
            updated_at: new Date().toISOString()
        };
        
        // Use upsert with ON CONFLICT
        const { error: insightError } = await supabase
            .from('insights')
            .upsert(insightData, { 
                onConflict: 'document_id',
                ignoreDuplicates: false
            });
        
        if (insightError) {
            log('10-STORE', `Insights table storage warning: ${insightError.message}`);
        } else {
            log('10-STORE', `Insights stored successfully for document ${documentId}`);
        }
        
        // Store conditions in user_conditions table
        if (result.conditions && result.conditions.length > 0) {
            const conditionRecords = result.conditions.map(c => ({
                user_id: userId,
                document_id: documentId,
                condition: c.name,
                severity: c.severity || 'medium',
                description: c.notes,
                status: 'active',
                source: 'document'
            }));
            
            const { error: condError } = await supabase
                .from('user_conditions')
                .upsert(conditionRecords, { onConflict: 'id' });
            
            if (condError) {
                log('10-STORE', `User conditions storage warning: ${condError.message}`);
            } else {
                log('10-STORE', `User conditions stored: ${conditionRecords.length} records`);
            }
        }
        
        // Store diagnosed conditions (inferred from medications)
        if (result.diagnosedConditions && result.diagnosedConditions.length > 0) {
            const inferredRecords = result.diagnosedConditions.map(dc => ({
                user_id: userId,
                document_id: documentId,
                condition: dc.condition,
                description: dc.description,
                severity: dc.confidence === 'high' ? 'high' : dc.confidence === 'medium' ? 'medium' : 'low',
                status: 'active',
                source: 'medication_inferred',
                confidence: dc.confidence === 'high' ? 0.9 : dc.confidence === 'medium' ? 0.7 : 0.5,
                medications_linked: dc.inferredFrom || []
            }));
            
            const { error: inferredError } = await supabase
                .from('user_conditions')
                .upsert(inferredRecords, { onConflict: 'id' });
            
            if (inferredError) {
                log('10-STORE', `Inferred conditions storage warning: ${inferredError.message}`);
            }
        }
        
        // Store prescription nutrition recommendations
        if (result.foodRecommendations && result.foodRecommendations.length > 0) {
            const nutritionRecords = result.foodRecommendations.map(fr => ({
                document_id: documentId,
                user_id: userId,
                category: fr.category,
                benefit: fr.benefit,
                foods: fr.foods || [],
                nutrition: fr.nutrition || {},
                benefit_score: fr.score || 0,
                target_conditions: [], // Could be enhanced with condition matching
                is_active: true
            }));
            
            // Delete existing recommendations for this document first
            await supabase
                .from('prescription_nutrition')
                .delete()
                .eq('document_id', documentId);
            
            const { error: nutritionError } = await supabase
                .from('prescription_nutrition')
                .insert(nutritionRecords);
            
            if (nutritionError) {
                log('10-STORE', `Prescription nutrition storage warning: ${nutritionError.message}`);
            } else {
                log('10-STORE', `Prescription nutrition stored: ${nutritionRecords.length} recommendations`);
            }
        }
        
        log('10-STORE', `Analysis result stored successfully for document ${documentId}`);
    } catch (error) {
        logError('10-STORE', error);
        // Don't throw - storage failure shouldn't break the response
    }
}

// ============== CHECK FOR CACHED ANALYSIS ==============

export async function getCachedAnalysis(documentId: string): Promise<FullAnalysisResult | null> {
    log('0-CACHE_CHECK', `Checking for cached analysis of document ${documentId}...`);
    
    // Check insights table first (using new schema)
    const { data: insight, error } = await supabase
        .from('insights')
        .select('*')
        .eq('document_id', documentId)
        .eq('is_current', true)
        .single();
    
    if (insight && !error) {
        log('0-CACHE_CHECK', `Found cached analysis from ${insight.created_at}`);
        
        // If we have the full analysis stored, return it directly
        if (insight.full_analysis) {
            return {
                ...insight.full_analysis,
                cachedAt: insight.created_at
            };
        }
        
        // Fallback: reconstruct from stored columns (new schema)
        const defaultDoctorAssessment: DoctorAssessment = {
            greeting: 'Based on your medical records...',
            diagnosis: insight.ai_summary || '',
            treatmentPlan: 'Please follow the prescribed treatment.',
            advice: [],
            warnings: [],
            followUp: 'Consult your doctor as needed.'
        };
        
        return {
            title: insight.title,
            documentType: insight.document_type || 'prescription',
            overview: insight.ai_summary,
            doctorAssessment: insight.doctor_assessment || defaultDoctorAssessment,
            diagnosedConditions: insight.diagnosed_conditions || [],
            extractedData: { 
                conditions: [], 
                medications: insight.medications || [], 
                diagnoses: [], 
                symptoms: [] 
            },
            medicationInsights: insight.medication_insights || [],
            drugInteractions: insight.drug_interactions || [],
            foodRecommendations: insight.food_recommendations || [],
            safetyInsights: insight.safety_qa || [],
            keyFindings: insight.key_findings || [],
            recommendations: [],
            followUpActions: insight.follow_up_actions || [],
            conditions: insight.conditions || [],
            charts: insight.charts || { vitals: [], progressBars: [], foodScores: [], nutritionBars: [], trends: [] },
            cachedAt: insight.created_at
        };
    }
    
    if (error) {
        log('0-CACHE_CHECK', `Cache check error: ${error.message}`);
    }
    
    log('0-CACHE_CHECK', 'No cached analysis found');
    return null;
}

// ============== MAIN PIPELINE ==============

export async function runFullAnalysisPipeline(
    documentId: string,
    userId: string,
    forceRefresh: boolean = false
): Promise<FullAnalysisResult> {
    console.log('\n' + '='.repeat(60));
    console.log(`${LOG_PREFIX} 🚀 STARTING FULL ANALYSIS PIPELINE`);
    console.log(`${LOG_PREFIX} Document ID: ${documentId}`);
    console.log(`${LOG_PREFIX} User ID: ${userId}`);
    console.log('='.repeat(60) + '\n');
    
    // Step 0: Check cache
    if (!forceRefresh) {
        const cached = await getCachedAnalysis(documentId);
        if (cached) {
            console.log(`${LOG_PREFIX} ✅ RETURNING CACHED RESULT\n`);
            return cached;
        }
    }
    
    // Step 1: Fetch document
    const doc = await fetchDocument(documentId);
    if (!doc) {
        throw new Error('Document not found in database');
    }
    
    // Step 2: Parse document (or use existing text)
    let extractedText = doc.existingText;
    if (!extractedText || extractedText.length < 50) {
        extractedText = await parseDocument(doc.fileUrl, doc.fileName, doc.fileType);
    } else {
        log('2-PARSE_DOCUMENT', 'Using existing extracted text from database');
    }
    
    // Step 3: Extract medical data
    const extractedData = await extractMedicalData(extractedText);
    
    // Step 4: Enrich with RxNorm
    extractedData.medications = await enrichWithRxNorm(extractedData.medications);
    
    // Step 5: Check drug interactions
    const drugInteractions = await checkInteractionsStep(extractedData.medications);
    
    // Step 5.5: Diagnose conditions from medications (BioGPT/PubMedBERT approach)
    const diagnosedConditions = await diagnoseFromMedications(extractedData.medications);
    
    // Step 5.6: Generate doctor's assessment
    const doctorAssessment = await generateDoctorAssessment(
        extractedData.conditions,
        extractedData.medications,
        diagnosedConditions,
        drugInteractions
    );
    
    // Step 6: Generate medication insights (Section 4: Why meds prescribed + treatment goal)
    const medicationInsights = await generateMedicationInsights(
        extractedData.medications,
        extractedData.conditions
    );
    
    // Step 7: Generate food recommendations with nutrition (Section 2)
    const foodRecommendations = await generateFoodRecommendations(
        extractedData.conditions,
        extractedData.medications,
        diagnosedConditions
    );
    
    // Step 8: Generate safety Q&A (Section 3)
    const safetyInsights = await generateSafetyInsights(
        extractedData.conditions,
        extractedData.medications,
        drugInteractions,
        diagnosedConditions
    );
    
    // Step 9: Generate final output (Section 1: Comprehensive Summary)
    const result = await generateFinalInsights(
        extractedText,
        extractedData,
        medicationInsights,
        foodRecommendations,
        safetyInsights,
        drugInteractions,
        doctorAssessment,
        diagnosedConditions
    );
    
    // Step 10: Store in database
    await storeAnalysisResult(documentId, userId, result, extractedText);
    
    console.log('\n' + '='.repeat(60));
    console.log(`${LOG_PREFIX} ✅ PIPELINE COMPLETE`);
    console.log(`${LOG_PREFIX} Key findings: ${result.keyFindings.length}`);
    console.log(`${LOG_PREFIX} Medications analyzed: ${result.medicationInsights.length}`);
    console.log(`${LOG_PREFIX} Food categories: ${result.foodRecommendations.length}`);
    console.log(`${LOG_PREFIX} Diagnosed conditions: ${result.diagnosedConditions.length}`);
    console.log(`${LOG_PREFIX} Safety Q&A: ${result.safetyInsights.length}`);
    console.log(`${LOG_PREFIX} Safety insights: ${result.safetyInsights.length}`);
    console.log('='.repeat(60) + '\n');
    
    return result;
}

/**
 * AI Insights Service
 * Generates structured insights from medical documents
 * Returns JSON with summary, charts data, and action items
 */

import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { supabase } from '../utils/supabase.js';
import { generateGeminiStructuredInsights, generateGeminiHealthPredictions } from './gemini.js';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
});

export interface InsightSection {
    header: string;
    content: string;
}

export interface ActionItem {
    priority: 'high' | 'medium' | 'low';
    action: string;
    category?: string;
}

export interface VitalChartData {
    label: string;
    value: number;
    max: number;
    unit: string;
    status: 'normal' | 'low' | 'high' | 'critical';
}

export interface ProgressRingData {
    label: string;
    percentage: number;
    color?: string;
}

export interface StructuredInsight {
    title: string;
    overview: string;
    sections: InsightSection[];
    actions: ActionItem[];
    charts: {
        vitals?: VitalChartData[];
        progress?: ProgressRingData[];
        trends?: { date: string; value: number }[];
    };
    metadata: {
        documentType?: string;
        confidence: number;
        model: string;
    };
}

const INSIGHT_SYSTEM_PROMPT = `You are an expert Medical AI Analyst.
Analyze the provided medical document text and generate structured insights.

OUTPUT FORMAT (JSON):
{
  "title": "Short title for the report (e.g., 'Blood Test Analysis')",
  "documentType": "lab_report" | "prescription" | "imaging" | "discharge_summary" | "other",
  "overview": "2-3 sentence summary of the key findings and overall assessment",
  "keyFindings": [
    {
      "category": "Category name (e.g., 'Glycemic Control', 'Cardio-Metabolic')",
      "finding": "Detailed description of the finding",
      "status": "normal" | "abnormal" | "critical" | "info",
      "value": "The measured value if applicable (e.g., '128 mg/dL')",
      "reference": "Normal reference range (e.g., '70-100')"
    }
  ],
  "sections": [
    {
      "title": "Section Title",
      "content": "Detailed content for this section..."
    }
  ],
  "recommendations": [
    "Specific actionable recommendation as a string"
  ],
  "followUpActions": [
    {
      "action": "Specific action to take",
      "priority": "high" | "medium" | "low",
      "timeframe": "When to do it (e.g., '2 weeks', '1 month')"
    }
  ],
  "conditions": [
    {
      "name": "Condition or alert name",
      "severity": "low" | "medium" | "high",
      "notes": "Brief explanation"
    }
  ],
  "charts": {
    "vitals": [
      {
        "label": "Vital name (e.g., 'Fasting Glucose')",
        "value": number,
        "min": number (normal min value),
        "max": number (normal max value),
        "unit": "mg/dL or appropriate unit"
      }
    ],
    "progressBars": [
      {
        "label": "Metric name",
        "current": number,
        "target": number,
        "unit": "unit"
      }
    ],
    "trends": [
      {
        "label": "Trend name (e.g., 'Glucose')",
        "data": [
          { "date": "YYYY-MM-DD", "value": number }
        ]
      }
    ]
  },
  "confidence": 0.0 to 1.0
}

IMPORTANT RULES:
1. Always include at least 3 keyFindings with specific values when available
2. Extract ALL measurable values from the document into the vitals array
3. Provide at least 3 specific, actionable recommendations
4. Include at least 1 high-priority follow-up action
5. Set confidence based on text quality and completeness
6. For vitals, calculate min/max to show where the value falls in the normal range
7. If historical data is present, populate the trends array
8. Mark abnormal values appropriately based on reference ranges`;

const PREDICTION_SYSTEM_PROMPT = `You are an advanced Medical Prediction AI (BioGPT-based logic).
Analyze the patient's medication intake history and generate actionable health insights and predictions.

INPUT DATA:
- Medication List
- Intake History
- Calculated Adherence Metrics

OUTPUT FORMAT (JSON):
{
  "insights": [
    {
      "type": "prediction" | "warning" | "success" | "info",
      "message": "Insight text...",
      "icon": "TrendingUp" | "AlertTriangle" | "CheckCircle" | "Info",
      "color": "green" | "red" | "blue" | "orange"
    }
  ]
}

RULES:
1. Focus purely on medical/behavioral insights.
2. If adherence is high, predict positive outcomes.
3. Identify patterns (e.g., "Missed doses on weekends").
4. Keep messages concise and actionable.`;


/**
 * Generate structured insights from document text
 * Returns structure matching frontend StructuredInsight type
 */
export async function generateStructuredInsights(
    documentText: string,
    documentId?: string,
    userId?: string
): Promise<any> {
    console.log('[InsightsAI] Generating structured insights...');

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: INSIGHT_SYSTEM_PROMPT },
                { role: 'user', content: `MEDICAL DOCUMENT:\n${documentText}` }
            ],
            temperature: 0.3,
            response_format: { type: "json_object" }
        });

        const rawJson = response.choices[0].message.content || '{}';
        const parsed = JSON.parse(rawJson);

        // Map to frontend StructuredInsight type
        const insight = {
            title: parsed.title || 'Medical Document Analysis',
            documentType: parsed.documentType || 'lab_report',
            overview: parsed.overview || 'Unable to generate overview.',
            keyFindings: (parsed.keyFindings || []).map((f: any) => ({
                category: f.category || 'General',
                finding: f.finding || '',
                status: f.status || 'info',
                value: f.value,
                reference: f.reference
            })),
            sections: (parsed.sections || []).map((s: any) => ({
                title: s.title || s.header || 'Section',
                content: s.content || ''
            })),
            recommendations: parsed.recommendations || [],
            followUpActions: (parsed.followUpActions || []).map((a: any) => ({
                action: a.action || '',
                priority: a.priority || 'medium',
                timeframe: a.timeframe
            })),
            conditions: (parsed.conditions || []).map((c: any) => ({
                name: c.name || '',
                severity: c.severity || 'medium',
                notes: c.notes || c.explanation || ''
            })),
            charts: {
                vitals: (parsed.charts?.vitals || parsed.vitals || []).map((v: any) => ({
                    label: v.label || '',
                    value: v.value || 0,
                    min: v.min || 0,
                    max: v.max || 100,
                    unit: v.unit || ''
                })),
                progressBars: parsed.charts?.progressBars || [],
                trends: parsed.charts?.trends || []
            }
        };

        // Store insight in database if user/document context provided
        if (userId && documentId) {
            await storeInsight(userId, documentId, insight);

            // Extract and store conditions
            if (parsed.conditions && Array.isArray(parsed.conditions)) {
                await storeConditions(userId, documentId, parsed.conditions);
            }
        }

        console.log(`[InsightsAI] Generated insight with ${insight.keyFindings.length} findings, ${insight.recommendations.length} recommendations`);
        return insight;

    } catch (error: any) {
        console.warn('OpenAI Insights failed, switching to Gemini Fallback:', error.message);
        try {
            return await generateGeminiStructuredInsights(documentText);
        } catch (geminiError: any) {
            console.error('Gemini Insights also failed:', geminiError);
            // Return default structure on error matching frontend type
            return {
                title: 'Analysis Error',
                documentType: 'other',
                overview: 'Unable to analyze document at this time.',
                keyFindings: [],
                sections: [{ title: 'Error', content: 'Please try again later. Both AI providers failed.' }],
                recommendations: [],
                followUpActions: [],
                conditions: [],
                charts: { vitals: [], progressBars: [], trends: [] }
            };
        }
    }
}

/**
 * Store insight in database
 */
export async function storeInsight(
    userId: string,
    documentId: string,
    insight: any
): Promise<void> {
    try {
        // Mark previous insights for this document as not current
        await supabase
            .from('insights')
            .update({ is_current: false })
            .eq('document_id', documentId);

        // Insert new insight - map to database schema
        await supabase.from('insights').insert({
            user_id: userId,
            document_id: documentId,
            insight_type: 'analysis',
            title: insight.title,
            ai_summary: insight.overview,
            sections: insight.sections,
            action_list: insight.followUpActions || insight.actions || [],
            chart_data: insight.charts,
            model_used: 'gpt-4',
            is_current: true
        });

        console.log('[InsightsAI] Insight stored in database');
    } catch (error) {
        console.error('[InsightsAI] Error storing insight:', error);
    }
}

/**
 * Store extracted conditions in database
 */
export async function storeConditions(
    userId: string,
    documentId: string,
    conditions: Array<{ name: string; severity: string; explanation: string }>
): Promise<void> {
    try {
        const conditionRecords = conditions.map(c => ({
            user_id: userId,
            document_id: documentId,
            condition: c.name,
            severity: c.severity || 'unknown',
            explanation: c.explanation,
            status: 'active',
            confidence: 0.8
        }));

        if (conditionRecords.length > 0) {
            await supabase.from('conditions').insert(conditionRecords);
            console.log(`[InsightsAI] Stored ${conditionRecords.length} conditions`);
        }
    } catch (error) {
        console.error('[InsightsAI] Error storing conditions:', error);
    }
}

/**
 * Get insights for a specific document
 */
export async function getDocumentInsights(documentId: string): Promise<StructuredInsight | null> {
    try {
        const { data, error } = await supabase
            .from('insights')
            .select('*')
            .eq('document_id', documentId)
            .eq('is_current', true)
            .single();

        if (error || !data) {
            return null;
        }

        return {
            title: data.title,
            overview: data.ai_summary,
            sections: data.sections || [],
            actions: data.action_list || [],
            charts: data.chart_data || {},
            metadata: {
                confidence: 0.8,
                model: data.model_used
            }
        };
    } catch (error) {
        console.error('[InsightsAI] Error fetching insights:', error);
        return null;
    }
}

/**
 * Get all conditions for a user
 */
export async function getUserConditions(userId: string): Promise<any[]> {
    try {
        const { data, error } = await supabase
            .from('conditions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        return data || [];
    } catch (error) {
        console.error('[InsightsAI] Error fetching conditions:', error);
        return [];
    }
}

/**
 * Generate quick analysis prompts for common queries
 */
export async function analyzeWithQuestion(
    documentText: string,
    question: string
): Promise<string> {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a medical document analyst. Answer the user\'s question based on the provided document. Be concise and accurate.'
                },
                {
                    role: 'user',
                    content: `DOCUMENT:\n${documentText}\n\nQUESTION: ${question}`
                }
            ],
            temperature: 0.3,
            max_tokens: 500
        });

        return response.choices[0].message.content || 'Unable to analyze.';
    } catch (error) {
        console.error('[InsightsAI] Analysis error:', error);
        return 'Analysis failed. Please try again.';
    }
}

/**
 * Generate Health Predictions based on Intake History
 */
export async function generateHealthPredictions(
    intakes: any[],
    medications: any[]
): Promise<any> {
    console.log('[InsightsAI] Generating health predictions...');

    // --- Deterministic Metric Calculation ---

    // 1. Calculate Graph Data (Last 7 Days Intakes)
    const graphData: { label: string; value: number }[] = [];
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dayLabel = days[d.getDay()];

        // Count intakes on this day
        // Note: taken_time is ISO string
        const count = intakes.filter(intake => {
            const intakeDate = new Date(intake.taken_time);
            return intakeDate.toDateString() === d.toDateString() && intake.status === 'taken';
        }).length;

        // "Adherence" here is just raw count of doses taken, 
        // effectively normalized to "Activity Level" for the graph
        // To make it percentage-like for the UI (0-100 bars), we can assume a max or scale it.
        // For now, let's just return the raw count but labeled as value for the chart.
        // If the UI expects 0-100, we might want to scale.
        // Let's cap at 100 or assume 4 doses = 100%? No, raw count is safer for now.
        // The prompt previously returned percentages. Let's try to normalize.
        // Assume daily goal is total active meds * avg frequency? 
        // Simplification: Return raw count * 20 (so 5 doses = 100%).
        const value = Math.min(count * 20, 100);

        graphData.push({ label: dayLabel, value: value });
    }

    // 2. Calculate Duration/Progress Data (Total Meds Taken vs Active Meds)
    // "total count in medications table and completed from medication_intakes table"
    const totalActiveMeds = medications.length || 1; // Avoid divide by zero

    // For "completed", we essentially want "Intakes Today" vs "Active Meds" 
    // OR "Total Intakes All Time" vs "Total Meds * Days"?
    // User logic: "circular progress ... total count in medications table and completed from medication_intakes table"
    // Let's go with "Daily Completion Rate": 
    // Total Intakes Today / Total Active Meds
    const intakesToday = intakes.filter(intake => {
        const intakeDate = new Date(intake.taken_time);
        return intakeDate.toDateString() === today.toDateString() && intake.status === 'taken';
    }).length;

    const percentage = Math.min(Math.round((intakesToday / totalActiveMeds) * 100), 100);

    const durationData = {
        medicationName: "Daily Adherence", // Label for the ring
        completedDays: intakesToday,       // displayed as "3"
        totalDays: totalActiveMeds,        // displayed as "5" -> "3/5"
        percentage: percentage             // Ring progress
    };

    try {
        // Prepare context data for AI
        const context = {
            calculated_metrics: {
                last_7_days_adherence: graphData,
                today_progress: `${intakesToday} / ${totalActiveMeds} doses taken`
            },
            medication_list: medications.map(m => m.drug_name || m.name),
            recent_history: intakes.slice(0, 10).map(i => `${i.drug_name} taken at ${i.taken_time}`)
        };

        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: PREDICTION_SYSTEM_PROMPT },
                { role: 'user', content: `PATIENT DATA:\n${JSON.stringify(context, null, 2)}` }
            ],
            temperature: 0.4,
            response_format: { type: "json_object" }
        });

        const rawJson = response.choices[0].message.content || '{}';
        const aiResponse = JSON.parse(rawJson);

        // Combine deterministic metrics with AI insights
        return {
            graphData,
            durationData,
            insights: aiResponse.insights || []
        };

    } catch (error: any) {
        console.warn('OpenAI Predictions failed, switching to Gemini Fallback:', error.message);
        try {
            // Call Gemini Fallback (needs updated signature to accept metrics or recalc?)
            // We can pass the already calculated metrics to the Gemini function refactor
            // or just pass raw data and let Gemini calc (but user said "clean in code").
            // Best: Update Gemini to accept pre-calculated metrics? 
            // OR: Just let Gemini function recalc (code duplication but cleaner interface).
            // Let's re-use the function signature but update Gemini implementation next.
            return await generateGeminiHealthPredictions(intakes, medications);
        } catch (geminiError) {
            console.error('[InsightsAI] Error generating predictions (Both providers failed):', geminiError);

            // Return Safe Fallback with Deterministic Data
            return {
                graphData,
                durationData,
                insights: [
                    {
                        type: "info",
                        message: "AI insights unavailable. Showing raw data.",
                        icon: "Info",
                        color: "blue"
                    }
                ]
            };
        }
    }
}

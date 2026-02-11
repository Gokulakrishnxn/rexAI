/**
 * Insights API Routes
 * Handles AI document analysis and structured insights
 */

import { Response, Router } from 'express';
import { verifyFirebaseToken, FirebaseRequest } from '../middleware/firebase_auth.js';
import {
    generateStructuredInsights,
    getDocumentInsights,
    getUserConditions,
    analyzeWithQuestion,
    generateHealthPredictions
} from '../services/insightsAI.js';
import { supabase } from '../utils/supabase.js';

const router = Router();

/**
 * POST /api/insights/analyze
 * Generate structured insights from a document
 */
router.post('/analyze', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { documentId, extractedText, documentType = 'lab_report' } = req.body;

        if (!extractedText) {
            return res.status(400).json({
                success: false,
                error: 'Extracted text required'
            });
        }

        // Generate structured insights (also stores if documentId provided)
        const insight = await generateStructuredInsights(extractedText, documentId, userId);

        if (!insight) {
            return res.status(500).json({
                success: false,
                error: 'Failed to generate insights'
            });
        }

        res.json({
            success: true,
            insight
        });

    } catch (error) {
        console.error('Generate insights error:', error);
        res.status(500).json({ success: false, error: 'Failed to analyze document' });
    }
});

/**
 * GET /api/insights/document/:documentId
 * Get insights for a specific document
 */
router.get('/document/:documentId', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const { documentId } = req.params;

        const insights = await getDocumentInsights(documentId);

        res.json({
            success: true,
            insights
        });

    } catch (error) {
        console.error('Get document insights error:', error);
        res.status(500).json({ success: false, error: 'Failed to get insights' });
    }
});

/**
 * GET /api/insights/conditions
 * Get all user conditions
 */
router.get('/conditions', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        const conditions = await getUserConditions(userId);

        res.json({
            success: true,
            conditions
        });

    } catch (error) {
        console.error('Get conditions error:', error);
        res.status(500).json({ success: false, error: 'Failed to get conditions' });
    }
});

/**
 * POST /api/insights/ask
 * Ask a question about a document
 */
router.post('/ask', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { documentId, question } = req.body;

        if (!documentId || !question) {
            return res.status(400).json({
                success: false,
                error: 'Document ID and question required'
            });
        }

        // Get document text
        const { data: doc, error: docError } = await supabase
            .from('documents')
            .select('extracted_text')
            .eq('id', documentId)
            .eq('user_id', userId)
            .single();

        if (docError || !doc?.extracted_text) {
            return res.status(404).json({
                success: false,
                error: 'Document not found'
            });
        }

        const result = await analyzeWithQuestion(doc.extracted_text, question);

        res.json({
            success: true,
            result
        });

    } catch (error) {
        console.error('Ask question error:', error);
        res.status(500).json({ success: false, error: 'Failed to analyze question' });
    }
});

/**
 * GET /api/insights/history
 * Get user's insight history
 */
router.get('/history', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { limit = '20', offset = '0' } = req.query;

        const { data, error } = await supabase
            .from('insights')
            .select(`
                id,
                document_id,
                insight_type,
                title,
                created_at,
                documents:document_id (
                    file_name,
                    document_type
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

        if (error) {
            throw error;
        }

        res.json({
            success: true,
            insights: data
        });

    } catch (error) {
        console.error('Get insights history error:', error);
        res.status(500).json({ success: false, error: 'Failed to get history' });
    }
});

/**
 * GET /api/insights/summary
 * Get health summary with all conditions and recent insights
 */
router.get('/summary', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // Get active conditions
        const { data: conditions, error: condError } = await supabase
            .from('conditions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('diagnosed_date', { ascending: false });

        if (condError) {
            throw condError;
        }

        // Get recent insights
        const { data: insights, error: insError } = await supabase
            .from('insights')
            .select('id, title, insight_type, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        if (insError) {
            throw insError;
        }

        // Get document count
        const { count: docCount, error: countError } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        // Categorize conditions by severity
        const conditionsBySeverity = {
            high: conditions?.filter(c => c.severity === 'high') || [],
            medium: conditions?.filter(c => c.severity === 'medium') || [],
            low: conditions?.filter(c => c.severity === 'low') || []
        };

        res.json({
            success: true,
            summary: {
                totalConditions: conditions?.length || 0,
                totalDocuments: docCount || 0,
                conditionsBySeverity,
                conditions: conditions || [],
                recentInsights: insights || []
            }
        });

    } catch (error) {
        console.error('Get health summary error:', error);
        res.status(500).json({ success: false, error: 'Failed to get summary' });
    }
});

/**
 * POST /api/insights/analyze-full
 * Run the full agentic analysis pipeline on a document
 * This fetches the document, parses it, extracts medical data,
 * queries RxNorm, generates insights, and caches the result
 */
router.post('/analyze-full', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { documentId, forceRefresh = false } = req.body;

        if (!documentId) {
            return res.status(400).json({
                success: false,
                error: 'Document ID is required'
            });
        }

        console.log(`[Insights] Starting full analysis for document ${documentId}`);

        // Import the agentic analysis pipeline
        const { runFullAnalysisPipeline } = await import('../services/agenticAnalysis.js');

        // Run the full pipeline
        const result = await runFullAnalysisPipeline(documentId, userId, forceRefresh);

        // Map to frontend StructuredInsight format
        const insight = {
            title: result.title,
            documentType: result.documentType,
            overview: result.overview,
            keyFindings: result.keyFindings,
            sections: [
                {
                    title: 'Medication Insights',
                    content: result.medicationInsights.map(m =>
                        `**${m.medication}**: ${m.whyPrescribed}`
                    ).join('\n\n')
                },
                {
                    title: 'Food Recommendations',
                    content: result.foodRecommendations.map(f =>
                        `**${f.category}** (Score: ${f.score}/100): ${f.foods.slice(0, 3).join(', ')}. ${f.benefit}`
                    ).join('\n\n')
                },
                {
                    title: 'Safety Information',
                    content: result.safetyInsights.map(s =>
                        `**${s.question}**\n${s.answer}`
                    ).join('\n\n')
                }
            ],
            recommendations: result.recommendations,
            followUpActions: result.followUpActions,
            conditions: result.conditions,
            charts: {
                vitals: result.charts.vitals,
                progressBars: result.charts.progressBars,
                trends: result.charts.trends
            },
            // Additional data for rich UI
            medicationInsights: result.medicationInsights,
            foodRecommendations: result.foodRecommendations,
            safetyInsights: result.safetyInsights,
            drugInteractions: result.drugInteractions,
            cachedAt: result.cachedAt
        };

        res.json({
            success: true,
            insight,
            cached: !!result.cachedAt
        });

    } catch (error: any) {
        console.error('[Insights] Full analysis error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to analyze document'
        });
    }
});

/**
 * POST /api/insights/predict
 * Generate health predictions based on intake history
 */
router.post('/predict', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const userId = req.user!.id;

        // 1. Fetch Medications (Active & Inactive to get names)
        const { data: medications, error: medError } = await supabase
            .from('medications')
            .select('*')
            .eq('user_id', userId);

        if (medError) throw medError;

        // 2. Fetch Intake History
        const { data: intakes, error: intakeError } = await supabase
            .from('medication_intakes')
            .select('*')
            .eq('user_id', userId)
            .order('taken_time', { ascending: false })
            .limit(50); // Analyze last 50 intakes

        if (intakeError) throw intakeError;

        // 3. Generate Predictions
        const predictions = await generateHealthPredictions(intakes || [], medications || []);

        res.json({
            success: true,
            data: predictions
        });

    } catch (error) {
        console.error('Generate predictions error:', error);
        res.status(500).json({ success: false, error: 'Failed to generate predictions' });
    }
});

export default router;

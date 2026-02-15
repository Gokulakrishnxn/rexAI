/**
 * Backend API Service
 * Handles communication with the Node.js backend for ingestion and chat
 */
import Constants from 'expo-constants';
import { useAuthStore } from '../../store/useAuthStore';

import { Platform } from 'react-native';

const getBackendUrl = (): string => {
    // 1. Check environment variable (Priority)
    // If set, ALWAYS use this (Production/Vercel)
    if (process.env.EXPO_PUBLIC_BACKEND_URL) {
        console.log('[BackendApi] Using Configured URL:', process.env.EXPO_PUBLIC_BACKEND_URL);
        return process.env.EXPO_PUBLIC_BACKEND_URL;
    }

    // 2. Dynamic Host URI (Critical for physical devices in DEV mode only)
    if (Constants.expoConfig?.hostUri) {
        const host = Constants.expoConfig.hostUri.split(':')[0];
        const url = `http://${host}:3001`;
        console.log('[BackendApi] Dynamic URL (Dev):', url);
        return url;
    }

    // 3. Fallback for local development
    if (Platform.OS === 'android') {
        return 'http://10.0.2.2:3001';
    }

    console.log('[BackendApi] Defaulting to localhost');
    return 'http://localhost:3001';
};

/**
 * Helper to get headers with Auth
 */
const getHeaders = async (contentType = 'application/json', authToken?: string | null) => {
    let token = authToken;

    // If no explicit token provided, try getting from store
    if (!token) {
        const firebaseUser = useAuthStore.getState().firebaseUser;
        token = firebaseUser ? await firebaseUser.getIdToken() : null;
    }

    return {
        'Content-Type': contentType,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
};

export type IngestRequest = {
    fileUrl: string;
    fileName: string;
    fileType: string;
    documentId?: string;
};

export type IngestResponse = {
    success: boolean;
    documentId: string;
    summary?: string;
    chunkCount: number;
    error?: string;
    reason?: string;
};

export type ChatRequest = {
    question: string;
    sessionId?: string;
    documentId?: string;
    skipRag?: boolean;
};

export type ChatSession = {
    id: string;
    user_id: string;
    title: string;
    created_at: string;
};

export type ChatMessage = {
    id: string;
    session_id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
};

export type ChatResponse = {
    success: boolean;
    answer: string;
    sources?: Array<{
        documentId: string;
        chunkIndex: number;
        preview: string;
    }>;
    error?: string;
    noRagMatch?: boolean;
};

/**
 * Trigger ingestion of an uploaded file
 */
export const triggerIngestion = async (request: IngestRequest, mode: 'standard' | 'agentic' = 'agentic'): Promise<IngestResponse> => {
    try {
        const url = `${getBackendUrl()}/api/ingest${mode === 'agentic' ? '/agentic' : ''}`;
        console.log(`[BackendApi] Triggering ingestion at: ${url}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: await getHeaders(),
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Ingestion error:', error);
        return { success: false, documentId: '', chunkCount: 0, error: 'Ingestion failed' };
    }
};

/**
 * Send a chat message and get AI response
 */
export const sendChatMessage = async (request: ChatRequest): Promise<ChatResponse> => {
    try {
        const response = await fetch(`${getBackendUrl()}/api/chat`, {
            method: 'POST',
            headers: await getHeaders(),
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Chat error:', error);
        return { success: false, answer: '', error: 'Chat request failed' };
    }
};

export type VoiceResponse = {
    success: boolean;
    transcript: string;
    voice_summary: string;
    structured_data: any;
    audio_base64: string;
    error?: string;
};

/**
 * Send voice audio/text to backend
 */
export const sendVoiceMessage = async (userId: string, content: string, sessionId?: string, isText: boolean = false): Promise<VoiceResponse> => {
    try {
        const url = `${getBackendUrl()}/api/voice`;
        const headers = await getHeaders();

        if (isText) {
            console.log(`[BackendApi] Sending voice TEXT: "${content}"`);
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    userId,
                    text: content,
                    sessionId
                }),
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            return await response.json();
        }

        // Audio File Flow
        const formData = new FormData();
        formData.append('userId', userId);
        if (sessionId) formData.append('sessionId', sessionId);

        const filename = content.split('/').pop() || 'recording.m4a';
        const fileType = filename.split('.').pop() === 'android' ? 'audio/m4a' : 'audio/m4a';

        // @ts-ignore
        formData.append('audio', {
            uri: content,
            name: filename,
            type: fileType,
        });

        // FormData usually requires letting fetch set the Content-Type header with boundary
        // But getHeaders() sets Content-Type to application/json by default.
        // We need to override it or use a separate header generation.
        // Let's manually handle headers for FormData.

        // Get token only
        const firebaseUser = useAuthStore.getState().firebaseUser;
        const token = firebaseUser ? await firebaseUser.getIdToken() : null;

        const formHeaders: any = {};
        if (token) formHeaders['Authorization'] = `Bearer ${token}`;
        // Do NOT set Content-Type for FormData, fetch does it.

        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            headers: formHeaders,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Voice message error:', error);
        return {
            success: false,
            transcript: '',
            voice_summary: '',
            structured_data: {},
            audio_base64: '',
            error: error instanceof Error ? error.message : 'Voice request failed',
        };
    }
};

/**
 * Stream chat response
 */
export const streamChatMessage = async (
    request: ChatRequest,
    onChunk: (text: string) => void,
    onComplete: (response: ChatResponse) => void,
    onError: (error: string) => void
): Promise<void> => {
    try {
        const response = await fetch(`${getBackendUrl()}/api/chat/stream`, {
            method: 'POST',
            headers: await getHeaders(),
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = '';

        if (!reader) {
            throw new Error('Stream not available');
        }

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;
            onChunk(chunk);
        }

        onComplete({
            success: true,
            answer: fullText,
        });
    } catch (error) {
        console.error('Stream error:', error);
        onError('Stream failed');
    }
};

/**
 * List all chat sessions for a user
 */
export const fetchSessions = async (): Promise<ChatSession[]> => {
    try {
        const response = await fetch(`${getBackendUrl()}/api/sessions`, {
            headers: await getHeaders(),
        });
        const data = await response.json();
        return data.success ? data.sessions : [];
    } catch (error) {
        console.error('Fetch sessions error:', error);
        return [];
    }
};

/**
 * Create a new chat session
 */
export const createSession = async (title?: string): Promise<ChatSession | null> => {
    try {
        const response = await fetch(`${getBackendUrl()}/api/sessions`, {
            method: 'POST',
            headers: await getHeaders(),
            body: JSON.stringify({ title }),
        });
        const data = await response.json();
        return data.success ? data.session : null;
    } catch (error) {
        console.error('Create session error:', error);
        return null;
    }
};

/**
 * Delete a chat session
 */
export const deleteSession = async (sessionId: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const response = await fetch(`${getBackendUrl()}/api/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: await getHeaders(),
        });
        const data = await response.json();
        return data;
    } catch (error: any) {
        console.error('Delete session error:', error);
        return { success: false, error: 'Failed to delete session' };
    }
};

/**
 * Rename a chat session
 */
export const renameSession = async (sessionId: string, title: string): Promise<{ success: boolean; session?: any; error?: string }> => {
    try {
        const response = await fetch(`${getBackendUrl()}/api/sessions/${sessionId}`, {
            method: 'PATCH',
            headers: await getHeaders(),
            body: JSON.stringify({ title }),
        });
        const data = await response.json();
        return data;
    } catch (error: any) {
        console.error('Rename session error:', error);
        return { success: false, error: 'Failed to rename session' };
    }
};

/**
 * Get messages for a session
 */
export const fetchSessionMessages = async (sessionId: string): Promise<ChatMessage[]> => {
    try {
        const response = await fetch(`${getBackendUrl()}/api/sessions/messages/${sessionId}`, {
            headers: await getHeaders(),
        });
        const data = await response.json();
        return data.success ? data.messages : [];
    } catch (error) {
        console.error('Fetch messages error:', error);
        return [];
    }
};
/**
 * List all documents for a user
 */
export const fetchUserDocuments = async (): Promise<any[]> => {
    try {
        const response = await fetch(`${getBackendUrl()}/api/ingest`, {
            headers: await getHeaders(),
        });
        const data = await response.json();
        return data.success ? data.documents : [];
    } catch (error) {
        console.error('Fetch user documents error:', error);
        return [];
    }
};
/**
 * Delete a user document (and chunks)
 */
export const deleteDocument = async (documentId: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const response = await fetch(`${getBackendUrl()}/api/ingest/${documentId}`, {
            method: 'DELETE',
            headers: await getHeaders(),
        });
        const data = await response.json();
        return data;
    } catch (error: any) {
        console.error('Delete document error:', error);
        return { success: false, error: 'Failed to delete document' };
    }
};

/**
 * Onboard a new user (Create/Sync profile in Supabase via Backend)
 */
export const onboardUser = async (profileData: {
    name: string;
    age?: string;
    gender?: string;
    blood_group?: string;
    emergency_contact?: string;
    abha_number?: string;
    aadhar_number?: string;
    role?: string;
}, token?: string): Promise<{ success: boolean; profile?: any; error?: string }> => {
    try {
        const headers = await getHeaders('application/json', token);
        const response = await fetch(`${getBackendUrl()}/api/profile/onboard`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(profileData),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Onboarding error:', error);
        return { success: false, error: error.message || 'Onboarding request failed' };
    }
};

/**
 * Fetch User Profile (Bypasses RLS by using Backend)
 */
export const fetchUserProfile = async (token?: string): Promise<{ success: boolean; profile?: any; error?: string }> => {
    try {
        console.log('[BackendApi] fetchUserProfile called. Explicit token?', !!token);
        const headers = await getHeaders('application/json', token);
        const url = `${getBackendUrl()}/api/profile`;
        console.log(`[BackendApi] Fetching profile from: ${url}`);

        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
        });

        console.log(`[BackendApi] Profile Response Status: ${response.status}`);

        if (!response.ok) {
            const text = await response.text();
            console.error(`[BackendApi] Profile Fetch Failed: ${text}`);
            return { success: false, error: 'Failed to fetch profile' };
        }

        const data = await response.json();
        console.log('[BackendApi] Profile Data:', data);
        return data;
    } catch (error: any) {
        console.error('Fetch profile error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Update User Profile
 */
export const updateUserProfile = async (updates: any): Promise<{ success: boolean; profile?: any; error?: string }> => {
    try {
        const headers = await getHeaders();
        const url = `${getBackendUrl()}/api/profile`;

        const response = await fetch(url, {
            method: 'PATCH',
            headers: headers,
            body: JSON.stringify(updates),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Update Profile Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Analyze Document/Text for Medication (Medication Intelligence)
 */
export const analyzeMedication = async (payload: { text?: string; imageBase64?: string }): Promise<{ success: boolean; drafts?: any[]; error?: string }> => {
    try {
        const url = `${getBackendUrl()}/api/medication/analyze`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Medication Analysis Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Confirm and Save Medication Plan
 */
export const confirmMedicationPlan = async (medications: any[]): Promise<{ success: boolean; count?: number; error?: string }> => {
    try {
        const url = `${getBackendUrl()}/api/medication/confirm`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ medications }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Medication Confirmation Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Mark Medication as Taken
 */
export const markMedicationTaken = async (medId: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const url = `${getBackendUrl()}/api/medication/${medId}/take`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Mark Taken Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Delete a medication from DB
 */
export const deleteMedication = async (medicationId: string): Promise<{ success: boolean; error?: string }> => {
    try {
        const url = `${getBackendUrl()}/api/medication/${medicationId}`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'DELETE',
            headers: headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return { success: true };
    } catch (error: any) {
        console.error('Delete Medication Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Fetch Medications List (Proxy)
 */
export const fetchMedicationsList = async (): Promise<{ success: boolean; medications?: any[]; error?: string }> => {
    try {
        const url = `${getBackendUrl()}/api/medication/list`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Fetch Medications Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Fetch Activity Logs (Proxy)
 */
export const fetchActivitiesList = async (): Promise<{ success: boolean; activities?: any[]; error?: string }> => {
    try {
        const url = `${getBackendUrl()}/api/profile/activities`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
        });

        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}` };
        }

        return await response.json();
    } catch (error: any) {
        console.error('Fetch Activities Error:', error);
        return { success: false, error: error.message };
    }
};

// =============================================================================
// NUTRITION API
// =============================================================================

export type NutritionFood = {
    fdcId: number;
    name: string;
    brand?: string;
    dataType: string;
    servingSize?: number;
    servingSizeUnit?: string;
};

export type NutritionFacts = {
    calories: number;
    protein: number;
    carbohydrates: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
    vitamins: Record<string, number>;
    minerals: Record<string, number>;
};

export type FoodLogEntry = {
    foodName: string;
    fdcId?: number;
    servingSize?: string;
    quantity?: number;
    mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
};

/**
 * Search for foods by name
 */
export const searchFoods = async (query: string, limit = 5): Promise<{
    success: boolean;
    foods?: NutritionFood[];
    error?: string
}> => {
    try {
        const url = `${getBackendUrl()}/api/nutrition/search?query=${encodeURIComponent(query)}&limit=${limit}`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Search Foods Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get detailed nutrition facts for a food
 */
export const getFoodNutrition = async (fdcId: number): Promise<{
    success: boolean;
    food?: NutritionFacts;
    dailyValues?: Record<string, number>;
    error?: string
}> => {
    try {
        const url = `${getBackendUrl()}/api/nutrition/food/${fdcId}`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Get Food Nutrition Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Log a food entry
 */
export const logFood = async (entry: FoodLogEntry): Promise<{
    success: boolean;
    entry?: any;
    message?: string;
    error?: string
}> => {
    try {
        const url = `${getBackendUrl()}/api/nutrition/log`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(entry),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Log Food Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get food logs for a date
 */
export const getFoodLogs = async (date?: string, limit = 50): Promise<{
    success: boolean;
    logs?: any[];
    error?: string
}> => {
    try {
        let url = `${getBackendUrl()}/api/nutrition/logs?limit=${limit}`;
        if (date) {
            url += `&date=${date}`;
        }
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Get Food Logs Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get daily nutrition summary
 */
export const getNutritionSummary = async (date?: string): Promise<{
    success: boolean;
    date?: string;
    summary?: {
        total_calories: number;
        total_protein_g: number;
        total_carbs_g: number;
        total_fat_g: number;
        total_fiber_g: number;
        total_sodium_mg: number;
        meal_count: number;
        dailyValues: Record<string, { current: number; target: number; percentage: number }>;
    };
    error?: string
}> => {
    try {
        let url = `${getBackendUrl()}/api/nutrition/summary`;
        if (date) {
            url += `?date=${date}`;
        }
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Get Nutrition Summary Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Delete a food log entry
 */
export const deleteFoodLog = async (logId: string): Promise<{
    success: boolean;
    message?: string;
    error?: string
}> => {
    try {
        const url = `${getBackendUrl()}/api/nutrition/log/${logId}`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'DELETE',
            headers: headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Delete Food Log Error:', error);
        return { success: false, error: error.message };
    }
};

// =============================================================================
// INSIGHTS API
// =============================================================================

export type MedicationInsight = {
    medication: string;
    rxcui?: string;
    whyPrescribed: string;
    treatmentGoal: string;
    sideEffects: string[];
    precautions: string[];
};

export type FoodRecommendation = {
    category: string;
    foods: string[];
    benefit: string;
    score: number;
    nutrition?: {
        calories?: number;
        protein?: number;
        carbs?: number;
        fiber?: number;
        vitamins?: string[];
    };
};

export type SafetyInsight = {
    question: string;
    answer: string;
    riskLevel: 'safe' | 'caution' | 'warning';
};

export type DrugInteraction = {
    severity: 'high' | 'moderate' | 'low';
    description: string;
    drug1: string;
    drug2: string;
};

export type DiagnosedCondition = {
    condition: string;
    confidence: 'high' | 'medium' | 'low';
    inferredFrom: string[];
    description: string;
    commonSymptoms: string[];
};

export type DoctorAssessment = {
    greeting: string;
    diagnosis: string;
    treatmentPlan: string;
    advice: string[];
    warnings: string[];
    followUp: string;
};

export type StructuredInsight = {
    title: string;
    documentType: string;
    overview: string;  // Section 1: Comprehensive AI Summary
    doctorAssessment?: DoctorAssessment;  // Dynamic doctor's perspective
    diagnosedConditions?: DiagnosedCondition[];  // Conditions inferred from medications
    keyFindings: Array<{
        category: string;
        finding: string;
        status: 'normal' | 'abnormal' | 'critical' | 'info';
        value?: string;
        reference?: string;
    }>;
    sections: Array<{
        title: string;
        content: string;
        items?: Array<{ label: string; value: string; status?: string }>;
    }>;
    recommendations: string[];
    followUpActions: Array<{
        action: string;
        priority: 'high' | 'medium' | 'low';
        timeframe?: string;
    }>;
    conditions?: Array<{
        name: string;
        severity: 'low' | 'medium' | 'high';
        notes?: string;
    }>;
    charts?: {
        vitals?: Array<{ label: string; value: number; min: number; max: number; unit: string }>;
        progressBars?: Array<{ label: string; current: number; target: number; unit: string }>;
        foodScores?: Array<{ category: string; score: number }>;
        nutritionBars?: Array<{ nutrient: string; value: number; dailyValue: number; unit: string }>;
        trends?: Array<{ label: string; data: Array<{ date: string; value: number }> }>;
    };
    // Extended fields from agentic analysis
    medicationInsights?: MedicationInsight[];  // Section 4: Why meds prescribed + treatment goal
    foodRecommendations?: FoodRecommendation[];  // Section 2: Food recommendations with nutrition
    safetyInsights?: SafetyInsight[];  // Section 3: Safety Q&A
    drugInteractions?: DrugInteraction[];
    cachedAt?: string;
};

/**
 * Run full agentic analysis pipeline on a document
 * This is the main function to analyze medical documents
 */
export const analyzeDocumentFull = async (
    documentId: string,
    forceRefresh: boolean = false
): Promise<{
    success: boolean;
    insight?: StructuredInsight;
    cached?: boolean;
    error?: string
}> => {
    try {
        console.log('[API] Starting full analysis for document:', documentId);

        const url = `${getBackendUrl()}/api/insights/analyze-full`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ documentId, forceRefresh }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('[API] Full analysis complete, cached:', data.cached);

        return data;
    } catch (error: any) {
        console.error('[API] Full Analysis Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Generate structured insights from a document (legacy)
 */
export const analyzeDocument = async (
    extractedText: string,
    documentType?: string,
    documentId?: string
): Promise<{
    success: boolean;
    insight?: StructuredInsight;
    error?: string
}> => {
    try {
        const url = `${getBackendUrl()}/api/insights/analyze`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                extractedText,
                documentType: documentType || 'lab_report',
                documentId
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Analyze Document Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get insights for a specific document
 */
export const getDocumentInsights = async (documentId: string): Promise<{
    success: boolean;
    insights?: any[];
    error?: string
}> => {
    try {
        const url = `${getBackendUrl()}/api/insights/document/${documentId}`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Get Document Insights Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get all user conditions
 */
export const getUserConditions = async (): Promise<{
    success: boolean;
    conditions?: Array<{
        id: string;
        name: string;
        severity: string;
        status: string;
        diagnosed_date?: string;
        notes?: string;
    }>;
    error?: string
}> => {
    try {
        const url = `${getBackendUrl()}/api/insights/conditions`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Get User Conditions Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Ask a question about a document
 */
export const askDocumentQuestion = async (documentId: string, question: string): Promise<{
    success: boolean;
    result?: {
        answer: string;
        confidence: number;
        relatedFindings?: string[];
    };
    error?: string
}> => {
    try {
        const url = `${getBackendUrl()}/api/insights/ask`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ documentId, question }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Ask Document Question Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get user's insight history
 */
export const getInsightsHistory = async (limit = 20, offset = 0): Promise<{
    success: boolean;
    insights?: Array<{
        id: string;
        document_id: string;
        insight_type: string;
        title: string;
        ai_summary?: string;
        document_type?: string;
        created_at: string;
        documents?: { file_name: string; file_type: string };
    }>;
    error?: string
}> => {
    try {
        const url = `${getBackendUrl()}/api/insights/history?limit=${limit}&offset=${offset}`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Get Insights History Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get health summary with conditions and recent insights
 */
export const getHealthSummary = async (): Promise<{
    success: boolean;
    summary?: {
        totalConditions: number;
        totalDocuments: number;
        conditionsBySeverity: {
            high: any[];
            medium: any[];
            low: any[];
        };
        conditions: any[];
        recentInsights: any[];
    };
    error?: string
}> => {
    try {
        const url = `${getBackendUrl()}/api/insights/summary`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Get Health Summary Error:', error);
        return { success: false, error: error.message };
    }
};

// =============================================================================
// RXNORM API
// =============================================================================

/**
 * Search for drugs using RxNorm
 */
export const searchDrugs = async (query: string): Promise<{
    success: boolean;
    drugs?: Array<{
        rxcui: string;
        name: string;
        synonym?: string;
    }>;
    error?: string
}> => {
    try {
        const url = `${getBackendUrl()}/api/medication/rxnorm/search?query=${encodeURIComponent(query)}`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Search Drugs Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get RxNorm drug details
 */
export const getDrugDetails = async (rxcui: string): Promise<{
    success: boolean;
    drug?: {
        rxcui: string;
        genericName: string;
        brandNames: string[];
        ingredients: string[];
        dosageForms: string[];
    };
    error?: string
}> => {
    try {
        const url = `${getBackendUrl()}/api/medication/rxnorm/${rxcui}`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Get Drug Details Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Check drug interactions
 */
export const checkDrugInteractions = async (rxcuiList?: string[]): Promise<{
    success: boolean;
    interactions?: Array<{
        severity: string;
        description: string;
        drugPair: string[];
    }>;
    checkedMedications?: number;
    message?: string;
    error?: string
}> => {
    try {
        const url = `${getBackendUrl()}/api/medication/interactions`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ rxcuiList }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Enrich Medication Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Fetch Health Predictions & Insights
 */
export const fetchHealthPredictions = async (): Promise<{
    success: boolean;
    data?: {
        graphData: Array<{ label: string; value: number }>;
        durationData: {
            medicationName: string;
            completedDays: number;
            totalDays: number;
            percentage: number;
        };
        insights: Array<{
            type: string;
            message: string;
            icon: string;
            color: string;
        }>;
    };
    error?: string
}> => {
    try {
        const url = `${getBackendUrl()}/api/insights/predict`;
        const headers = await getHeaders();

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error: any) {
        console.error('Fetch Health Predictions Error:', error);
        return { success: false, error: error.message };
    }
};
/**
 * Backend API Service
 * Handles communication with the Node.js backend for ingestion and chat
 */
import Constants from 'expo-constants';
import { useAuthStore } from '../../store/useAuthStore';

import { Platform } from 'react-native';

const getBackendUrl = (): string => {
    // 1. Check environment variable
    if (process.env.EXPO_PUBLIC_BACKEND_URL) {
        return process.env.EXPO_PUBLIC_BACKEND_URL;
    }

    // 2. Dynamic Host URI (Critical for physical devices)
    if (Constants.expoConfig?.hostUri) {
        const host = Constants.expoConfig.hostUri.split(':')[0];
        const url = `http://${host}:3001`;
        console.log('[BackendApi] Dynamic URL:', url);
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
};

export type ChatRequest = {
    question: string;
    sessionId?: string;
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
};

/**
 * Trigger ingestion of an uploaded file
 */
export const triggerIngestion = async (request: IngestRequest): Promise<IngestResponse> => {
    try {
        const url = `${getBackendUrl()}/api/ingest`;
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
 * Onboard a new user (Create/Sync profile in Supabase via Backend)
 */
export const onboardUser = async (profileData: {
    name: string;
    age?: string;
    gender?: string;
    blood_group?: string;
    emergency_contact?: string;
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

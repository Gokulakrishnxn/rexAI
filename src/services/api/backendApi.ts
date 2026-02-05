/**
 * Backend API Service
 * Handles communication with the Node.js backend for ingestion and chat
 */
import Constants from 'expo-constants';

const getBackendUrl = (): string => {
    return process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';
};

export type IngestRequest = {
    userId: string;
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
    userId: string;
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
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Ingestion error:', error);
        return {
            success: false,
            documentId: '',
            chunkCount: 0,
            error: error instanceof Error ? error.message : 'Ingestion failed',
        };
    }
};

/**
 * Send a chat message and get AI response
 */
export const sendChatMessage = async (request: ChatRequest): Promise<ChatResponse> => {
    try {
        const response = await fetch(`${getBackendUrl()}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Chat error:', error);
        return {
            success: false,
            answer: '',
            error: error instanceof Error ? error.message : 'Chat request failed',
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
            headers: {
                'Content-Type': 'application/json',
            },
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
        onError(error instanceof Error ? error.message : 'Stream failed');
    }
};

/**
 * List all chat sessions for a user
 */
export const fetchSessions = async (userId: string): Promise<ChatSession[]> => {
    try {
        const response = await fetch(`${getBackendUrl()}/api/sessions/${userId}`);
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
export const createSession = async (userId: string, title?: string): Promise<ChatSession | null> => {
    try {
        const response = await fetch(`${getBackendUrl()}/api/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, title }),
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
        const response = await fetch(`${getBackendUrl()}/api/sessions/messages/${sessionId}`);
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
export const fetchUserDocuments = async (userId: string): Promise<any[]> => {
    try {
        const response = await fetch(`${getBackendUrl()}/api/ingest/${userId}`);
        const data = await response.json();
        return data.success ? data.documents : [];
    } catch (error) {
        console.error('Fetch user documents error:', error);
        return [];
    }
};

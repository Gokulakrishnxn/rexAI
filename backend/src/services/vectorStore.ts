/**
 * Vector Store Service
 * Handles pgvector operations for storing and retrieving embeddings
 */

import { supabase } from '../utils/supabase.js';

export interface DocumentRecord {
    id: string;
    user_id: string;
    file_url: string;
    file_name: string;
    file_type: string | null;
    summary: string | null;
    created_at: string;
}

export interface ChunkRecord {
    id: string;
    document_id: string;
    user_id: string;
    chunk_index: number;
    content: string;
    embedding: number[];
    created_at: string;
}

export interface SimilarChunk {
    id: string;
    document_id: string;
    chunk_index: number;
    content: string;
    similarity: number;
}

/**
 * Create a new document record
 */
export async function createDocument(
    userId: string,
    fileUrl: string,
    fileName: string,
    fileType: string
): Promise<DocumentRecord> {
    const { data, error } = await supabase
        .from('documents')
        .insert({
            user_id: userId,
            file_url: fileUrl,
            file_name: fileName,
            file_type: fileType,
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to create document: ${error.message}`);
    }

    return data;
}

/**
 * Update document summary
 */
export async function updateDocumentSummary(
    documentId: string,
    summary: string
): Promise<void> {
    const { error } = await supabase
        .from('documents')
        .update({ summary })
        .eq('id', documentId);

    if (error) {
        throw new Error(`Failed to update summary: ${error.message}`);
    }
}

/**
 * Store document chunks with embeddings
 */
export async function storeChunks(
    documentId: string,
    userId: string,
    chunks: Array<{ index: number; content: string; embedding: number[] }>
): Promise<void> {
    const records = chunks.map(chunk => ({
        document_id: documentId,
        user_id: userId,
        chunk_index: chunk.index,
        content: chunk.content,
        embedding: `[${chunk.embedding.join(',')}]`, // pgvector format
    }));

    // Insert in batches of 100
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { error } = await supabase
            .from('document_chunks')
            .insert(batch);

        if (error) {
            throw new Error(`Failed to store chunks: ${error.message}`);
        }
    }
}

/**
 * Search for similar chunks using vector similarity
 */
export async function searchSimilarChunks(
    userId: string,
    queryEmbedding: number[],
    topK: number = 8,
    similarityThreshold: number = 0.5,
    filterDocumentId: string | null = null
): Promise<SimilarChunk[]> {
    // Use Supabase RPC for vector similarity search
    const { data, error } = await supabase.rpc('match_document_chunks', {
        query_embedding: queryEmbedding,
        match_user_id: userId,
        match_count: topK,
        similarity_threshold: similarityThreshold,
        filter_document_id: filterDocumentId,
    });

    if (error) {
        // If the RPC doesn't exist, fall back to manual query
        console.warn('RPC not available, using fallback query:', error.message);
        return fallbackSimilaritySearch(userId, queryEmbedding, topK, filterDocumentId);
    }

    return data || [];
}

/**
 * Fallback similarity search using raw SQL
 */
async function fallbackSimilaritySearch(
    userId: string,
    queryEmbedding: number[],
    topK: number,
    filterDocumentId: string | null
): Promise<SimilarChunk[]> {
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    let query = supabase
        .from('document_chunks')
        .select('id, document_id, chunk_index, content')
        .eq('user_id', userId);

    if (filterDocumentId) {
        query = query.eq('document_id', filterDocumentId);
    }

    const { data, error } = await query.limit(topK * 2); // Get more and filter client-side

    if (error) {
        throw new Error(`Similarity search failed: ${error.message}`);
    }

    // Note: This is a fallback - actual similarity should be computed
    // For production, ensure the RPC function is created
    return (data || []).slice(0, topK).map((chunk, i) => ({
        ...chunk,
        similarity: 1 - (i * 0.1), // Placeholder similarity
    }));
}

/**
 * Get document by ID
 */
export async function getDocument(documentId: string): Promise<DocumentRecord | null> {
    const { data, error } = await supabase
        .from('documents')
        .select()
        .eq('id', documentId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new Error(`Failed to get document: ${error.message}`);
    }

    return data;
}

/**
 * Get all documents for a user
 */
export async function getUserDocuments(userId: string): Promise<DocumentRecord[]> {
    const { data, error } = await supabase
        .from('documents')
        .select()
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(`Failed to get documents: ${error.message}`);
    }

    return data || [];
}

/**
 * Delete a document and its chunks
 */
export async function deleteDocument(documentId: string): Promise<void> {
    // Chunks are deleted automatically via CASCADE
    const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

    if (error) {
        throw new Error(`Failed to delete document: ${error.message}`);
    }
}

/**
 * Get chunk count for a document
 */
export async function getChunkCount(documentId: string): Promise<number> {
    const { count, error } = await supabase
        .from('document_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', documentId);

    if (error) {
        throw new Error(`Failed to get chunk count: ${error.message}`);
    }

    return count || 0;
}
/**
 * Get chunks for a specific document (Targeted Retrieval)
 * Bypasses vector search to ensure context is loaded for @filename queries
 */
export async function getChunksByDocumentId(
    documentId: string,
    limit: number = 20
): Promise<SimilarChunk[]> {
    const { data, error } = await supabase
        .from('document_chunks')
        .select('id, document_id, chunk_index, content')
        .eq('document_id', documentId)
        .order('chunk_index', { ascending: true }) // meaningful order
        .limit(limit);

    if (error) {
        throw new Error(`Failed to get chunks for document ${documentId}: ${error.message}`);
    }

    // Map to SimilarChunk format with a "perfect" similarity score since they are explicitly requested
    return (data || []).map(chunk => ({
        ...chunk,
        similarity: 1.0,
    }));
}

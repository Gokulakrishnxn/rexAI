import { Response, Router } from 'express';
import { generateSummary } from '../services/chatgpt.js';
import { chunkText } from '../services/chunker.js';
import { embedBatch } from '../services/embeddings.js';
import { downloadFile, extractTextFromImage, extractTextFromPdf, isImageFile, isPdfFile } from '../services/ocr.js';
import { createDocument, getChunkCount, getUserDocuments, storeChunks, updateDocumentSummary } from '../services/vectorStore.js';
import { verifyFirebaseToken, FirebaseRequest } from '../middleware/firebase_auth.js';

const router = Router();

interface IngestRequest {
    fileUrl: string;
    fileName: string;
    fileType: string;
}

/**
 * POST /api/ingest
 * Ingest a file: OCR → Chunk → Embed → Store
 */
router.post('/', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const { fileUrl, fileName, fileType } = req.body as IngestRequest;
        const userId = req.user!.id;

        // Validate input
        if (!fileUrl || !fileName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: fileUrl, fileName',
            });
        }

        console.log(`Starting ingestion for ${fileName} by ${userId}`);

        // Step 1: Create document record
        const document = await createDocument(userId, fileUrl, fileName, fileType);

        // Download and Extract
        const buffer = await downloadFile(fileUrl);
        let text = '';
        if (isPdfFile(fileType)) {
            text = await extractTextFromPdf(buffer).catch(() => 'PDF parsing failed');
        } else {
            text = await extractTextFromImage(buffer);
        }

        if (!text || text.trim().length === 0) text = "[EMPTY DOCUMENT]";

        // Store extracted text for AI analysis
        const { supabase } = await import('../utils/supabase.js');
        await supabase
            .from('documents')
            .update({ extracted_text: text })
            .eq('id', document.id);

        // Chunk, Embed, Store
        const chunks = chunkText(text, { maxTokens: 256, overlapTokens: 50 });
        const embeddings = await embedBatch(chunks.map(c => c.content));

        const chunksWithEmbeddings = chunks.map((chunk, i) => ({
            index: chunk.index,
            content: chunk.content,
            embedding: embeddings[i],
        }));

        await storeChunks(document.id, userId, chunksWithEmbeddings);

        // Async Summary
        generateSummary(text).then(summary => updateDocumentSummary(document.id, summary));

        const chunkCount = await getChunkCount(document.id);

        res.json({
            success: true,
            documentId: document.id,
            chunkCount,
            message: 'File ingested successfully',
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Ingestion failed' });
    }
});

/**
 * GET /api/ingest
 * List all documents for the authenticated user
 */
router.get('/', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const documents = await getUserDocuments(userId);
        res.json({ success: true, documents });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to fetch' });
    }
});

/**
 * GET /api/ingest/status/:documentId
 */
router.get('/status/:documentId', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const { documentId } = req.params;
        const chunkCount = await getChunkCount(documentId);
        res.json({ status: chunkCount > 0 ? 'complete' : 'processing', chunkCount });
    } catch (error) {
        res.status(500).json({ status: 'error' });
    }
});

/**
 * DELETE /api/ingest/:documentId
 * Deletes a document and its chunks
 */
router.delete('/:documentId', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const { documentId } = req.params;
        const userId = req.user!.id;

        console.log(`[Ingest] Deleting document ${documentId} for user ${userId}`);

        // 1. Delete Document (Supabase Cascade should handle chunks, but we manually verify)
        // Check local imports for delete helper or use Supabase directly
        const { supabase } = await import('../utils/supabase.js');

        // Delete from storage (chunks are related by document_id usually)
        await supabase.from('document_chunks').delete().eq('document_id', documentId);

        // Delete document metadata
        const { error } = await supabase.from('documents')
            .delete()
            .eq('id', documentId)
            .eq('user_id', userId); // Ensure ownership

        if (error) {
            throw error;
        }

        res.json({ success: true, message: 'Document deleted' });
    } catch (error: any) {
        console.error('Delete failed:', error);
        res.status(500).json({ success: false, error: 'Delete failed' });
    }
});

export default router;

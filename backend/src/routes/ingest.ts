/**
 * Ingestion Route
 * Handles file ingestion: OCR → Chunk → Embed → Store
 */

import { Request, Response, Router } from 'express';
import { generateSummary } from '../services/chatgpt.js';
import { chunkText } from '../services/chunker.js';
import { embedBatch } from '../services/embeddings.js';
import { downloadFile, extractTextFromImage, extractTextFromPdf, isImageFile, isPdfFile } from '../services/ocr.js';
import { createDocument, getChunkCount, getUserDocuments, storeChunks, updateDocumentSummary } from '../services/vectorStore.js';

const router = Router();

interface IngestRequest {
    userId: string;
    fileUrl: string;
    fileName: string;
    fileType: string;
}

/**
 * POST /api/ingest
 * Ingest a file: OCR → Chunk → Embed → Store
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const { userId, fileUrl, fileName, fileType } = req.body as IngestRequest;

        // Validate input
        if (!userId || !fileUrl || !fileName) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: userId, fileUrl, fileName',
            });
        }

        console.log(`Starting ingestion for ${fileName} (${fileType})`);

        // Step 1: Create document record
        const document = await createDocument(userId, fileUrl, fileName, fileType);
        console.log(`Created document: ${document.id}`);

        // Step 2: Download file and extract text
        let text = '';

        if (isImageFile(fileType)) {
            console.log('Processing as image...');
            const buffer = await downloadFile(fileUrl);
            text = await extractTextFromImage(buffer);
        } else if (isPdfFile(fileType)) {
            console.log('Processing as PDF...');
            const buffer = await downloadFile(fileUrl);
            try {
                text = await extractTextFromPdf(buffer);

                // If text is extremely short, it's likely a scanned PDF
                if (text.length < 100) {
                    console.warn('PDF text density very low. Marking as scanned document.');
                    text = `[SCANNED DOCUMENT DETECTED]\nThis PDF document "${fileName}" appears to be a scanned image or photo containing no selectable text. 
Please note: The system currently cannot read handwritten or image-only PDFs accurately. 
Total extracted characters: ${text.length}
Raw content preview: ${text.substring(0, 50)}`;
                }
            } catch (e) {
                console.warn('PDF parsing failed', e);
                text = `PDF document: ${fileName}. Extraction failed technical parsing.`;
            }
        } else {
            console.log('Unknown file type, attempting OCR...');
            const buffer = await downloadFile(fileUrl);
            text = await extractTextFromImage(buffer);
        }

        // Even if extraction is poor, we proceed so the document record exists,
        // but we ensure the user knows why the summary might be bad.
        if (!text || text.trim().length === 0) {
            text = "[EMPTY DOCUMENT] No text could be extracted from this file.";
        }

        console.log(`Extracted ${text.length} characters`);

        // Step 3: Chunk text
        const chunks = chunkText(text, {
            maxTokens: 256,
            overlapTokens: 50,
        });
        console.log(`Created ${chunks.length} chunks`);

        // Step 4: Generate embeddings
        const chunkTexts = chunks.map(c => c.content);
        const embeddings = await embedBatch(chunkTexts);
        console.log(`Generated ${embeddings.length} embeddings`);

        // Step 5: Store chunks with embeddings
        const chunksWithEmbeddings = chunks.map((chunk, i) => ({
            index: chunk.index,
            content: chunk.content,
            embedding: embeddings[i],
        }));
        await storeChunks(document.id, userId, chunksWithEmbeddings);
        console.log('Stored chunks in database');

        // Step 6: Generate summary (async, don't block response)
        generateSummary(text)
            .then(summary => {
                updateDocumentSummary(document.id, summary);
                console.log('Summary generated and stored via ChatGPT');
            })
            .catch(async err => {
                console.error('ChatGPT summary generation failed, trying Gemini:', err);
                try {
                    const { generateGeminiSummary } = await import('../services/gemini.js');
                    const summary = await generateGeminiSummary(text);
                    await updateDocumentSummary(document.id, summary);
                    console.log('Summary generated and stored via Gemini (Fallback)');
                } catch (geminiErr) {
                    console.error('Gemini summary generation also failed:', geminiErr);
                }
            });

        // Get chunk count for response
        const chunkCount = await getChunkCount(document.id);

        res.json({
            success: true,
            documentId: document.id,
            chunkCount,
            message: 'File ingested successfully',
        });

    } catch (error) {
        console.error('Ingestion error:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Ingestion failed',
        });
    }
});

/**
 * GET /api/ingest/status/:documentId
 * Check ingestion status
 */
router.get('/status/:documentId', async (req: Request, res: Response) => {
    try {
        const { documentId } = req.params;
        const chunkCount = await getChunkCount(documentId);

        res.json({
            status: chunkCount > 0 ? 'complete' : 'processing',
            chunkCount,
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Status check failed',
        });
    }
});

/**
 * GET /api/ingest/:userId
 * List all documents for a user
 */
router.get('/:userId', async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const documents = await getUserDocuments(userId);

        res.json({
            success: true,
            documents,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch documents',
        });
    }
});

export default router;

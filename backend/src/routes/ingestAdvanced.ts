import { Response, Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { verifyFirebaseToken, FirebaseRequest } from '../middleware/firebase_auth.js';
import { downloadFile } from '../services/ocr.js';
import { validateMedicalDocument } from '../services/validationAI.js';
import { parseWithLlamaCloud } from '../services/llamaParse.js';
import { chunkText } from '../services/chunker.js';
import { embedBatch } from '../services/embeddings.js';
import { createDocument, storeChunks, updateDocumentSummary, getChunkCount } from '../services/vectorStore.js';
import { generateSummary } from '../services/chatgpt.js';

const router = Router();

interface IngestRequest {
    fileUrl: string;
    fileName: string;
    fileType: string;
}

/**
 * POST /api/ingest/agentic
 * Advanced Pipeline: LlamaParse -> Medical Validation -> Chunk/Embed
 */
router.post('/agentic', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    let tempFilePath: string | null = null;
    const logPrefix = `[🔒 Agentic Flow]`;

    try {
        const { fileUrl, fileName, fileType } = req.body as IngestRequest;
        const userId = req.user!.id;

        if (!fileUrl || !fileName) {
            return res.status(400).json({ success: false, error: 'Missing fileUrl or fileName' });
        }

        console.log(`${logPrefix} 🚀 STARTING PIPELINE for file: "${fileName}"`);
        console.log(`${logPrefix} 👤 User ID: ${userId}`);

        // 1. Download File to Temp
        console.log(`${logPrefix} ⬇️  Step 1: Downloading file from Supabase Storage...`);
        const fileBuffer = await downloadFile(fileUrl);
        const tempDir = os.tmpdir();
        const tempName = `upload-${uuidv4()}-${fileName}`;
        tempFilePath = path.join(tempDir, tempName);
        fs.writeFileSync(tempFilePath, fileBuffer);
        console.log(`${logPrefix} ✅ File downloaded to temporary path: ${tempFilePath}`);

        // 2. LlamaParse (High-Fidelity OCR)
        console.log(`${logPrefix} 🧠 Step 2: OCR Extraction`);
        console.log(`${logPrefix} 🛠️  Tool: LlamaParse (LlamaIndex Cloud)`);
        console.log(`${logPrefix} ℹ️  Model: GPT-4o optimized parsing (via LlamaCloud)`);

        const markdown = await parseWithLlamaCloud(tempFilePath, fileType);

        if (!markdown || markdown.trim().length === 0) {
            throw new Error("LlamaParse returned empty text");
        }
        console.log(`${logPrefix} ✅ OCR Complete. Extracted ${markdown.length} characters.`);

        // 3. Medical Validation (Guardrail)
        console.log(`${logPrefix} 🛡️  Step 3: Medical Validation`);
        console.log(`${logPrefix} 🤖 AI Model: GPT-3.5-turbo (OpenAI)`);
        console.log(`${logPrefix} ❓ Converting text to JSON for validation...`);
        const validation = await validateMedicalDocument(markdown);

        if (!validation.is_medical) {
            console.warn(`${logPrefix} ❌ Validation FAILED: Document is NOT medical.`);
            console.warn(`${logPrefix} 📝 Reason: ${validation.reason}`);
            // Cleanup and reject
            if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

            return res.status(400).json({
                success: false,
                error: 'Document rejected: Not a valid medical record.',
                reason: validation.reason,
                details: validation
            });
        }

        console.log(`${logPrefix} ✅ Validation PASSED!`);
        console.log(`${logPrefix} 🏷️  Category: ${validation.category}`);
        console.log(`${logPrefix} 🎯 Confidence: ${validation.confidence}`);

        // 4. Create Document Record (with new metadata)
        console.log(`${logPrefix} 💾 Step 4: Creating Database Entry...`);
        const document = await createDocument(userId, fileUrl, fileName, fileType);

        // Update with validation info and extracted text
        const { supabase } = await import('../utils/supabase.js');
        await supabase
            .from('documents')
            .update({
                validation_status: 'verified',
                doc_category: validation.category,
                parsing_method: 'llama_parse',
                validation_confidence: validation.confidence,
                rejection_reason: null,
                extracted_text: markdown // Store the full extracted text for AI analysis
            })
            .eq('id', document.id);
        console.log(`${logPrefix} ✅ Database Record Created (ID: ${document.id})`);

        // 5. Chunk, Embed, Store
        console.log(`${logPrefix} 🧩 Step 5: Chunking & Embedding`);
        console.log(`${logPrefix} ✂️  Chunk Strategy: Markdown Splitter (512 tokens)`);
        console.log(`${logPrefix} 🧠 Embedding Model: text-embedding-3-small (OpenAI)`);

        const chunks = chunkText(markdown, { maxTokens: 512, overlapTokens: 50 });
        const embeddings = await embedBatch(chunks.map(c => c.content));

        const chunksWithEmbeddings = chunks.map((chunk, i) => ({
            index: chunk.index,
            content: chunk.content,
            embedding: embeddings[i],
        }));

        await storeChunks(document.id, userId, chunksWithEmbeddings);
        console.log(`${logPrefix} ✅ Stored ${chunks.length} vectorized chunks in Supabase.`);

        // 6. Async Summary
        console.log(`${logPrefix} 📝 Step 6: Generating Summary...`);
        console.log(`${logPrefix} 🤖 AI Model: GPT-3.5-turbo`);
        generateSummary(markdown).then(summary => {
            updateDocumentSummary(document.id, summary);
            console.log(`${logPrefix} ✅ Summary generated and saved.`);
        });

        const chunkCount = await getChunkCount(document.id);

        // Cleanup
        if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        console.log(`${logPrefix} 🧹 Temporary files cleaned up.`);
        console.log(`${logPrefix} 🎉 PIPELINE COMPLETE.`);

        res.json({
            success: true,
            documentId: document.id,
            chunkCount,
            validation,
            message: 'Medical document ingested successfully'
        });

    } catch (error: any) {
        console.error(`${logPrefix} 💥 PIPELINE FAILED:`, error.message);

        // Cleanup
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            try { fs.unlinkSync(tempFilePath); } catch (e) { }
        }

        if (!res.headersSent) {
            res.status(500).json({ success: false, error: error.message || 'Ingestion failed' });
        }
    }
});

export default router;

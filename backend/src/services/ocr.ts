/**
 * OCR Service — LlamaParse (primary) → Tesseract.js (fallback)
 * Extracts text from images and PDFs.
 * LlamaParse uses LlamaIndex Cloud for high-quality agentic extraction.
 * Tesseract.js is kept as a local fallback if LlamaParse fails.
 */

import { parseBufferWithLlamaCloud } from './llamaParse.js';
import { extractTextFromPdfWithGemini, extractTextFromImageWithGemini } from './gemini.js';

async function getPDFParse(): Promise<any> {
    const m = await import('pdf-parse');
    return (m as any).PDFParse ?? (m as any).default?.PDFParse;
}

async function getTesseract(): Promise<typeof import('tesseract.js')> {
    return (await import('tesseract.js')).default;
}

/**
 * Extract text from a PDF buffer.
 * Pipeline: LlamaParse → pdf-parse → Gemini OCR
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
    console.log('[OCR] Starting PDF text extraction...');

    // 1. Try LlamaParse first (best quality)
    try {
        console.log('[OCR] Attempting LlamaParse (LlamaIndex Cloud)...');
        const llamaText = await parseBufferWithLlamaCloud(pdfBuffer, 'application/pdf', 'document.pdf');
        if (llamaText && llamaText.trim().length > 20) {
            console.log(`[OCR] ✅ LlamaParse succeeded: ${llamaText.length} chars`);
            return normalizeText(llamaText);
        }
        console.warn('[OCR] LlamaParse returned insufficient text, falling back...');
    } catch (llamaErr: any) {
        console.warn(`[OCR] LlamaParse failed: ${llamaErr.message}. Falling back to Tesseract/pdf-parse...`);
    }

    // 2. Fallback: Standard pdf-parse
    let text = '';
    try {
        const PDFParse = await getPDFParse();
        const parser = new PDFParse({ data: pdfBuffer });
        const data = await parser.getText();
        text = normalizeText(data.text);
        console.log(`[OCR] pdf-parse extracted ${text.length} chars`);
    } catch (e) {
        console.warn('[OCR] Standard PDF parsing also failed.');
    }

    // 3. Quality check — if poor, try Gemini OCR
    const cleanChars = text.replace(/[^a-zA-Z0-9\s]/g, '').length;
    const totalChars = text.length;
    const isQualityPoor = totalChars < 50 || (cleanChars / totalChars < 0.5);

    if (isQualityPoor) {
        console.log('[OCR] PDF text quality is poor (likely scanned). Trying Gemini OCR...');
        try {
            const ocrText = await extractTextFromPdfWithGemini(pdfBuffer);
            if (ocrText && ocrText.length > text.length) {
                return normalizeText(ocrText);
            }
        } catch (geminiError: any) {
            console.error('[OCR] Gemini PDF fallback also failed:', geminiError.message);
        }
    }

    return text;
}

/**
 * Extract text from an image URL or buffer.
 * Pipeline: LlamaParse → Tesseract.js → Gemini Vision
 */
export async function extractTextFromImage(
    imageSource: string | Buffer,
    mimeType: string = 'image/png'
): Promise<string> {
    // 1. Try LlamaParse first (best quality for medical docs, handwriting, etc.)
    try {
        let buffer: Buffer;
        if (Buffer.isBuffer(imageSource)) {
            buffer = imageSource;
        } else if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
            buffer = await downloadFile(imageSource);
        } else {
            throw new Error('Cannot convert image source to buffer for LlamaParse');
        }

        console.log('[OCR] Attempting LlamaParse for image...');
        const llamaText = await parseBufferWithLlamaCloud(buffer, mimeType, 'image.png');
        if (llamaText && llamaText.trim().length > 10) {
            console.log(`[OCR] ✅ LlamaParse image extraction succeeded: ${llamaText.length} chars`);
            return normalizeText(llamaText);
        }
        console.warn('[OCR] LlamaParse returned insufficient text for image, falling back...');
    } catch (llamaErr: any) {
        console.warn(`[OCR] LlamaParse image failed: ${llamaErr.message}. Falling back to Tesseract...`);
    }

    // 2. Fallback: Tesseract.js
    console.log('[OCR] Attempting Tesseract.js...');
    const Tesseract = await getTesseract();

    try {
        const result = await Tesseract.recognize(
            imageSource,
            'eng',
            {
                logger: (m) => {
                    if (m.status === 'recognizing text' && Math.round(m.progress * 100) % 20 === 0) {
                        console.log(`[Tesseract] Progress: ${Math.round(m.progress * 100)}%`);
                    }
                },
            }
        );

        const text = result.data.text;
        console.log(`[Tesseract] extracted ${text.length} characters`);

        if (!text || text.length < 10) {
            throw new Error('Tesseract returned empty/low quality text.');
        }

        return normalizeText(text);
    } catch (error: any) {
        console.warn(`[Tesseract] Failed: ${error.message}. Trying Gemini Vision...`);

        // 3. Final fallback: Gemini Vision
        try {
            let buffer: Buffer;
            if (Buffer.isBuffer(imageSource)) {
                buffer = imageSource;
            } else if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
                buffer = await downloadFile(imageSource);
            } else {
                throw new Error('Gemini fallback requires a Buffer or HTTP URL.');
            }

            return await extractTextFromImageWithGemini(buffer, mimeType);
        } catch (geminiError: any) {
            console.error('[OCR] All methods failed:', geminiError.message);
            throw new Error('OCR Failed (LlamaParse, Tesseract & Gemini)');
        }
    }
}

/**
 * Normalize extracted text
 * - Remove excessive whitespace
 * - Fix common OCR artifacts
 * - Clean up line breaks
 */
export function normalizeText(text: string): string {
    return text
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+/g, ' ')
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        .trim();
}

/**
 * Check if a file is an image based on MIME type
 */
export function isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
}

/**
 * Check if a file is a PDF
 */
export function isPdfFile(mimeType: string): boolean {
    return mimeType === 'application/pdf';
}

/**
 * Download file from URL and return as buffer
 */
export async function downloadFile(url: string): Promise<Buffer> {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to download file: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

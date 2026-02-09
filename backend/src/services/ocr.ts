/**
 * OCR Service using Tesseract.js
 * Extracts text from images and PDFs
 */

import Tesseract from 'tesseract.js';
const { PDFParse } = require('pdf-parse');

/**
 * Extract text from a dictionary-based PDF buffer
 */
// Import Gemini OCR helper
import { extractTextFromPdfWithGemini, extractTextFromImageWithGemini } from './gemini.js';

/**
 * Extract text from a dictionary-based PDF buffer
 * Fallback to Gemini OCR for scanned documents
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
    console.log('Starting PDF text extraction...');
    let text = '';

    // 1. Try standard extraction first (fast)
    try {
        const parser = new PDFParse({ data: pdfBuffer });
        const data = await parser.getText();
        text = normalizeText(data.text);

        console.log(`PDF Extraction Raw Text Length: ${data.text.length}`);
    } catch (e) {
        console.warn('Standard PDF parsing failed, proceeding to Gemini Fallback.');
    }

    // 2. heuristic Quality Check: Is it likely garbage/scanned?
    const cleanChars = text.replace(/[^a-zA-Z0-9\s]/g, '').length;
    const totalChars = text.length;
    const isQualityPoor = totalChars < 50 || (cleanChars / totalChars < 0.5) || text.includes('AHEEE') || text.includes('');

    if (isQualityPoor) {
        console.log('[OCR] Standard PDF text quality is poor (likely scanned). Switching to Gemini OCR (Fallback)...');
        try {
            // Note: Tesseract doesn't strictly support PDF buffers without conversion.
            // Converting PDF -> Image requires extra heavy deps (canvas/sharp/poppler).
            // So for PDFs, we default to Gemini Vision as the "OCR Engine" fallback.
            const ocrText = await extractTextFromPdfWithGemini(pdfBuffer);
            if (ocrText && ocrText.length > text.length) {
                return normalizeText(ocrText);
            }
        } catch (geminiError: any) {
            console.error('Gemini PDF OCR Fallback failed:', geminiError.message);
        }
    }

    return text;
}

/**
 * Extract text from an image URL or buffer
 */
export async function extractTextFromImage(
    imageSource: string | Buffer,
    mimeType: string = 'image/png'
): Promise<string> {
    console.log('Starting OCR extraction (Tesseract)...');

    try {
        const result = await Tesseract.recognize(
            imageSource,
            'eng', // English language
            {
                logger: (m) => {
                    // Only log every 20-30% to avoid spamming terminal
                    if (m.status === 'recognizing text' && Math.round(m.progress * 100) % 20 === 0) {
                        console.log(`[Tesseract] Progress: ${Math.round(m.progress * 100)}%`);
                    }
                },
            }
        );

        const text = result.data.text;
        console.log(`[Tesseract] extracted ${text.length} characters`);

        // Check if Tesseract failed to read anything meaningful
        if (!text || text.length < 10) {
            throw new Error('Tesseract returned empty/low quality text.');
        }

        return normalizeText(text);
    } catch (error: any) {
        console.warn(`[Tesseract] Failed: ${error.message}. Switching to Gemini Fallback...`);
        try {
            // Handle Buffer vs String URL
            let buffer: Buffer;
            if (Buffer.isBuffer(imageSource)) {
                buffer = imageSource;
            } else {
                // If it's a URL/Path, download/read it (simplified for now assuming Buffer mostly)
                // For now, if string, we try to download if it's http
                if (typeof imageSource === 'string' && imageSource.startsWith('http')) {
                    buffer = await downloadFile(imageSource);
                } else {
                    throw new Error('Gemini fallback requires a Buffer or HTTP URL.');
                }
            }

            return await extractTextFromImageWithGemini(buffer, mimeType);
        } catch (geminiError: any) {
            console.error('[OCR] All methods failed:', geminiError.message);
            throw new Error('OCR Failed (Tesseract & Gemini)');
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
        // Remove null bytes and dangerous control characters, but keep common symbols
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        // Normalize line endings
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Remove excessive line breaks (more than 2)
        .replace(/\n{3,}/g, '\n\n')
        // Remove excessive spaces
        .replace(/[ \t]+/g, ' ')
        // Remove leading/trailing whitespace from each line
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        // Remove empty lines at start/end
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

/**
 * OCR Service using Tesseract.js
 * Extracts text from images and PDFs
 */

import Tesseract from 'tesseract.js';
const { PDFParse } = require('pdf-parse');

/**
 * Extract text from a dictionary-based PDF buffer
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
    console.log('Starting PDF text extraction...');

    try {
        const parser = new PDFParse({ data: pdfBuffer });
        const data = await parser.getText();

        console.log(`PDF Extraction Raw Text Length: ${data.text.length}`);
        console.log(`PDF Extraction Raw Text Sample: "${data.text.substring(0, 500).replace(/\n/g, '\\n')}"`);

        const normalized = normalizeText(data.text);
        const pageCount = data.numpages || 0;

        console.log(`PDF Extraction: ${pageCount} pages, ${normalized.length} normalized characters`);

        return normalized;
    } catch (error) {
        console.error('PDF extraction failed:', error);
        throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Extract text from an image URL or buffer
 */
export async function extractTextFromImage(
    imageSource: string | Buffer
): Promise<string> {
    console.log('Starting OCR extraction...');

    try {
        const result = await Tesseract.recognize(
            imageSource,
            'eng', // English language
            {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        console.log(`OCR progress: ${Math.round(m.progress * 100)}%`);
                    }
                },
            }
        );

        const text = result.data.text;
        console.log(`OCR extracted ${text.length} characters`);

        return normalizeText(text);
    } catch (error) {
        console.error('OCR extraction failed:', error);
        throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

import { LlamaParse } from "llama-parse";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

// Ensure API key is present
if (!process.env.LLAMA_CLOUD_API_KEY) {
    console.warn("LLAMA_CLOUD_API_KEY is missing. LlamaParse will fail.");
}

/**
 * Parses a file using LlamaParse (LlamaIndex Cloud) to extract high-quality markdown.
 * Perfect for tables, handwriting, and complex layouts.
 * 
 * @param filePath Absolute path to the file on disk
 * @param mimeType Mime type of the file (optional)
 */
export async function parseWithLlamaCloud(filePath: string, mimeType?: string): Promise<string> {
    console.log(`[LlamaParse] Starting parse for ${filePath} (${mimeType})`);

    try {
        const parser = new LlamaParse({
            apiKey: process.env.LLAMA_CLOUD_API_KEY || ''
        });

        const buffer = fs.readFileSync(filePath);
        // Create a Blob-like object or use global Blob if available (Node 18+)
        const blob = new Blob([buffer], { type: mimeType || 'application/pdf' });

        const result = await parser.parseFile(blob as any);

        console.log(`[LlamaParse] Successfully extracted ${result.markdown.length} characters.`);
        return result.markdown;

    } catch (error: any) {
        console.error("[LlamaParse] Parsing failed:", error);
        throw new Error(`LlamaParse failed: ${error.message}`);
    }
}

/**
 * Parses a Buffer using LlamaParse (LlamaIndex Cloud).
 * Writes to a temp file, parses, then cleans up.
 * 
 * @param buffer The file buffer
 * @param mimeType Mime type of the file
 * @param fileName Optional original filename (used for extension detection)
 */
export async function parseBufferWithLlamaCloud(
    buffer: Buffer,
    mimeType: string = 'application/pdf',
    fileName?: string
): Promise<string> {
    const ext = fileName
        ? path.extname(fileName)
        : mimeType.includes('pdf') ? '.pdf' : mimeType.includes('image') ? '.png' : '.bin';

    const tempPath = path.join(os.tmpdir(), `llama-${uuidv4()}${ext}`);

    try {
        // Write buffer to temp file
        fs.writeFileSync(tempPath, buffer);
        console.log(`[LlamaParse] Wrote ${buffer.length} bytes to temp: ${tempPath}`);

        // Parse with the file-based method
        const result = await parseWithLlamaCloud(tempPath, mimeType);
        return result;

    } finally {
        // Always cleanup
        if (fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath); } catch (e) { /* ignore */ }
        }
    }
}

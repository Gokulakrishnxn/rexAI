import { LlamaParse } from "llama-parse";
import dotenv from 'dotenv';
import fs from 'fs';

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

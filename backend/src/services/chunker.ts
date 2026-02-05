/**
 * Token-aware Text Chunking
 * Splits text into overlapping chunks suitable for embeddings
 */

import { encoding_for_model } from 'tiktoken';

// Get tokenizer for GPT models
const encoder = encoding_for_model('gpt-3.5-turbo');

export interface Chunk {
    index: number;
    content: string;
    tokenCount: number;
}

export interface ChunkOptions {
    maxTokens?: number;      // Max tokens per chunk (default: 256)
    overlapTokens?: number;  // Overlap between chunks (default: 50)
    minTokens?: number;      // Minimum tokens for a valid chunk (default: 20)
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
    maxTokens: 256,
    overlapTokens: 50,
    minTokens: 20,
};

/**
 * Count tokens in a string
 */
export function countTokens(text: string): number {
    return encoder.encode(text).length;
}

/**
 * Split text into sentences (preserving boundaries)
 */
function splitIntoSentences(text: string): string[] {
    // Split on sentence-ending punctuation followed by space or newline
    const sentencePattern = /(?<=[.!?])\s+(?=[A-Z])|(?<=\n)/g;
    const sentences = text.split(sentencePattern).filter(s => s.trim());
    return sentences;
}

/**
 * Chunk text into overlapping segments
 */
export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const sentences = splitIntoSentences(text);
    const chunks: Chunk[] = [];

    let currentChunk: string[] = [];
    let currentTokens = 0;
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const sentenceTokens = countTokens(sentence);

        // If single sentence exceeds max, split it further
        if (sentenceTokens > opts.maxTokens) {
            // Flush current chunk if any
            if (currentChunk.length > 0) {
                const content = currentChunk.join(' ').trim();
                if (countTokens(content) >= opts.minTokens) {
                    chunks.push({
                        index: chunkIndex++,
                        content,
                        tokenCount: countTokens(content),
                    });
                }
                currentChunk = [];
                currentTokens = 0;
            }

            // Split long sentence by words
            const words = sentence.split(/\s+/);
            let wordChunk: string[] = [];
            let wordTokens = 0;

            for (const word of words) {
                const wt = countTokens(word + ' ');
                if (wordTokens + wt > opts.maxTokens && wordChunk.length > 0) {
                    const content = wordChunk.join(' ').trim();
                    chunks.push({
                        index: chunkIndex++,
                        content,
                        tokenCount: countTokens(content),
                    });

                    // Keep overlap
                    const overlapStart = Math.max(0, wordChunk.length - Math.ceil(opts.overlapTokens / 4));
                    wordChunk = wordChunk.slice(overlapStart);
                    wordTokens = countTokens(wordChunk.join(' '));
                }
                wordChunk.push(word);
                wordTokens += wt;
            }

            // Add remaining words to current chunk
            currentChunk = wordChunk;
            currentTokens = wordTokens;
            continue;
        }

        // Check if adding sentence exceeds limit
        if (currentTokens + sentenceTokens > opts.maxTokens && currentChunk.length > 0) {
            // Save current chunk
            const content = currentChunk.join(' ').trim();
            if (countTokens(content) >= opts.minTokens) {
                chunks.push({
                    index: chunkIndex++,
                    content,
                    tokenCount: countTokens(content),
                });
            }

            // Calculate overlap - take last N tokens worth of sentences
            let overlapTokens = 0;
            let overlapStart = currentChunk.length;

            for (let j = currentChunk.length - 1; j >= 0; j--) {
                const st = countTokens(currentChunk[j]);
                if (overlapTokens + st > opts.overlapTokens) break;
                overlapTokens += st;
                overlapStart = j;
            }

            currentChunk = currentChunk.slice(overlapStart);
            currentTokens = overlapTokens;
        }

        currentChunk.push(sentence);
        currentTokens += sentenceTokens;
    }

    // Add final chunk
    if (currentChunk.length > 0) {
        const content = currentChunk.join(' ').trim();
        if (countTokens(content) >= opts.minTokens) {
            chunks.push({
                index: chunkIndex++,
                content,
                tokenCount: countTokens(content),
            });
        }
    }

    return chunks;
}

/**
 * Free the tokenizer resources (call on shutdown)
 */
export function freeTokenizer(): void {
    encoder.free();
}

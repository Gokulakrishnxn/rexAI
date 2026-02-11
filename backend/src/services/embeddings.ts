/**
 * Embeddings Service using Transformer.js
 * Uses all-MiniLM-L6-v2 model (384 dimensions)
 * Lazy-loads @xenova/transformers so serverless (e.g. Vercel) can start without loading the model at cold start.
 */

let embeddingPipeline: any = null;
let isLoading = false;

async function loadPipeline(): Promise<any> {
    const { pipeline } = await import('@xenova/transformers');
    return await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { quantized: true }
    );
}

/**
 * Initialize the embedding model (call once at startup)
 */
export async function initEmbeddings(): Promise<void> {
    if (embeddingPipeline || isLoading) return;

    isLoading = true;
    console.log('Loading embedding model...');

    try {
        embeddingPipeline = await loadPipeline();
        console.log('Embedding model loaded successfully');
    } catch (error) {
        console.error('Failed to load embedding model:', error);
        throw error;
    } finally {
        isLoading = false;
    }
}

/**
 * Generate embedding for a single text
 */
export async function embedText(text: string): Promise<number[]> {
    if (!embeddingPipeline) {
        await initEmbeddings();
    }

    if (!embeddingPipeline) {
        throw new Error('Embedding pipeline not initialized');
    }

    const result = await embeddingPipeline(text, {
        pooling: 'mean',
        normalize: true,
    });

    // Convert to regular array
    return Array.from(result.data as Float32Array);
}

/**
 * Generate embeddings for multiple texts (batch processing)
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
    if (!embeddingPipeline) {
        await initEmbeddings();
    }

    if (!embeddingPipeline) {
        throw new Error('Embedding pipeline not initialized');
    }

    const embeddings: number[][] = [];

    // Process in batches of 8 for memory efficiency
    const batchSize = 8;
    for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchEmbeddings = await Promise.all(
            batch.map(text => embedText(text))
        );
        embeddings.push(...batchEmbeddings);
    }

    return embeddings;
}

/**
 * Get embedding dimension (384 for MiniLM)
 */
export function getEmbeddingDimension(): number {
    return 384;
}

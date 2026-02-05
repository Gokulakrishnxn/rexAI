/**
 * Rex Healthify Backend Server
 * RAG-powered medical assistant API
 */

import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import chatRouter from './routes/chat.js';
import ingestRouter from './routes/ingest.js';
import sessionsRouter from './routes/sessions.js';
import { initEmbeddings } from './services/embeddings.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/ingest', ingestRouter);
app.use('/api/chat', chatRouter);
app.use('/api/sessions', sessionsRouter);

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
async function start() {
    console.log('Initializing embedding model...');

    try {
        await initEmbeddings();
        console.log('Embedding model ready');
    } catch (error) {
        console.error('Failed to initialize embeddings:', error);
        console.log('Server will continue, embeddings will load on first use');
    }

    app.listen(PORT, () => {
        console.log(`🚀 Rex Healthify Backend running on http://localhost:${PORT}`);
        console.log(`   (For Android Emulator use: http://10.0.2.2:${PORT})`);
        console.log(`   Health: http://localhost:${PORT}/health`);
        console.log(`   Ingest:   POST http://localhost:${PORT}/api/ingest`);
        console.log(`   Chat:     POST http://localhost:${PORT}/api/chat`);
        console.log(`   Sessions: GET  http://localhost:${PORT}/api/sessions/:userId`);
    });
}

start();

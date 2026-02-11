/**
 * Rex Healthify Backend Server
 * RAG-powered medical assistant API
 */

import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import chatRouter from './routes/chat.js';
import ingestRouter from './routes/ingest.js';
import medicationRoutes from './routes/medication.js'; // [NEW]
import sessionsRouter from './routes/sessions.js';
import profileRouter from './routes/profile.js';
import nutritionRouter from './routes/nutrition.js';
import insightsRouter from './routes/insights.js';
import { initEmbeddings } from './services/embeddings.js';
import { startMedicationScheduler } from './services/medicationScheduler.js';

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
app.use('/api/medication', medicationRoutes); // [NEW]
app.use('/api/chat', chatRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/nutrition', nutritionRouter);
app.use('/api/insights', insightsRouter);

// Advanced Ingestion (Hybrid)
import ingestAdvancedRouter from './routes/ingestAdvanced.js';
app.use('/api/ingest', ingestAdvancedRouter); // Mounts at /api/ingest/agentic via router definition? No, wait.
// If ingestAdvancedRouter is router.post('/agentic', ...), then mounting at /api/ingest makes it /api/ingest/agentic. Correct.

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

    // Start Medication Notification Scheduler
    await startMedicationScheduler();

    app.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`🚀 Rex Healthify Backend running on port ${PORT}`);
        console.log(`   Local:   http://localhost:${PORT}`);

        // Log LAN IP for physical device connection
        const { networkInterfaces } = require('os');
        const nets = networkInterfaces();
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    console.log(`   Network: http://${net.address}:${PORT} (Use this for physical device)`);
                }
            }
        }

        console.log(`   Health:  http://localhost:${PORT}/health`);
        console.log(`   Profile: POST http://localhost:${PORT}/api/profile/onboard`);
    });
}

start();

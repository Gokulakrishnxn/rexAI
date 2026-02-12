/**
 * Minimal Vercel entrypoint: only loads express/cors/dotenv and /health at cold start.
 * Full app (routes, Firebase, Supabase, etc.) is lazy-loaded on first non-health request.
 * This prevents FUNCTION_INVOCATION_FAILED from heavy or failing top-level imports.
 */
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Request, Response, NextFunction } from 'express';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Root route – simple JSON entry point
app.get('/', (_req: Request, res: Response) => {
    res.json({
        name: 'Rex Healthify Backend API',
        status: 'ok',
        health: '/health',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

let fullApp: express.Express | null = null;

app.use(async (req: Request, res: Response, next: NextFunction) => {
    if (!fullApp) {
        try {
            const mod = await import('./index.js');
            fullApp = mod.default as unknown as express.Express;
        } catch (err) {
            console.error('Failed to load full app:', err);
            return res.status(503).json({ error: 'Service loading', message: (err as Error).message });
        }
    }
    fullApp!(req, res, next);
});

export default app;

import { Router, Request, Response } from 'express';
import * as openai from '../services/openaiService';

export const extractRouter = Router();

/**
 * POST /api/extract
 * Body: { image: string } (base64)
 * Returns: Record<string, unknown> — extracted structured data
 */
extractRouter.post('/', async (req: Request, res: Response) => {
  try {
    const imageBase64 = req.body?.image ?? '';
    if (typeof imageBase64 !== 'string' || !imageBase64) {
      res.status(400).json({ error: 'image (base64) is required' });
      return;
    }

    if (!openai.isOpenAIAvailable()) {
      res.status(503).json({ error: 'Extraction unavailable', rawText: '' });
      return;
    }

    const data = await openai.extractFromImage(imageBase64);
    res.json(data);
  } catch (e) {
    console.error('Extract error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

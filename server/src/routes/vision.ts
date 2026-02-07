import { Router, Request, Response } from 'express';
import * as openai from '../services/openaiService';
import * as gemini from '../services/geminiService';

export const visionRouter = Router();

visionRouter.post('/plate', async (req: Request, res: Response) => {
  try {
    const imageBase64 = req.body?.image ?? req.body?.imageBase64 ?? '';
    if (typeof imageBase64 !== 'string' || !imageBase64) {
      res.status(400).json({ error: 'image (base64) is required' });
      return;
    }

    try {
      const result = await openai.analyzePlateImage(imageBase64);
      res.json(result);
      return;
    } catch {
      // fallback
    }

    if (gemini.isGeminiAvailable()) {
      try {
        const result = await gemini.analyzePlateImage(imageBase64);
        res.json(result);
        return;
      } catch (e) {
        console.error('Gemini vision fallback failed:', e);
      }
    }

    res.status(503).json({
      foodItems: [],
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      recommendation: 'Analysis unavailable. Please try again.',
    });
  } catch (e) {
    console.error('Vision plate error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

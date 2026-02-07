import { Router, Request, Response } from 'express';
import * as openai from '../services/openaiService';
import * as gemini from '../services/geminiService';

export const soapRouter = Router();

soapRouter.post('/generate', async (req: Request, res: Response) => {
  try {
    const transcript = typeof req.body?.transcript === 'string' ? req.body.transcript : '';
    if (!transcript.trim()) {
      res.status(400).json({ error: 'transcript is required' });
      return;
    }

    try {
      const note = await openai.generateSoapFromTranscript(transcript);
      res.json({
        id: `soap_${Date.now()}`,
        createdAt: new Date().toISOString(),
        source: 'chat',
        ...note,
      });
      return;
    } catch {
      // fallback
    }

    if (gemini.isGeminiAvailable()) {
      try {
        const note = await gemini.generateSoapFromTranscript(transcript);
        res.json({
          id: `soap_${Date.now()}`,
          createdAt: new Date().toISOString(),
          source: 'chat',
          ...note,
        });
        return;
      } catch (e) {
        console.error('Gemini SOAP fallback failed:', e);
      }
    }

    res.status(503).json({
      error: 'SOAP generation unavailable',
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
    });
  } catch (e) {
    console.error('SOAP error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

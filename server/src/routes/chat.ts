import { Router, Request, Response } from 'express';
import * as openai from '../services/openaiService';
import * as gemini from '../services/geminiService';

export const chatRouter = Router();

interface ChatBody {
  message?: string;
  context?: { role: 'user' | 'assistant'; content: string }[];
  extra?: string;
}

chatRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { message = '', context = [], extra = '' } = req.body as ChatBody;
    if (typeof message !== 'string') {
      res.status(400).json({ error: 'message must be a string' });
      return;
    }

    try {
      const reply = await openai.chatCompletion(message, context, extra);
      res.json({ reply });
      return;
    } catch {
      // fallback to Gemini
    }

    if (gemini.isGeminiAvailable()) {
      try {
        const reply = await gemini.chatCompletion(message, context, extra);
        res.json({ reply });
        return;
      } catch (e) {
        console.error('Gemini fallback failed:', e);
      }
    }

    res.status(503).json({
      error: 'AI unavailable',
      reply: "I'm Rex. I couldn't reach the AI right now. Please try again.",
    });
  } catch (e) {
    console.error('Chat error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

import { Router, Request, Response } from 'express';
import { AccessToken } from 'livekit-server-sdk';
import { config } from '../config';
import * as openai from '../services/openaiService';
import * as gemini from '../services/geminiService';

export const voiceRouter = Router();

/**
 * POST /api/voice/token
 * Body: { roomName: string, identity?: string }
 * Returns: { token: string }
 */
voiceRouter.post('/token', async (req: Request, res: Response) => {
  try {
    const { apiKey, apiSecret, url } = config.livekit;
    if (!apiKey || !apiSecret) {
      res.status(503).json({
        error: 'LiveKit not configured',
        token: null,
      });
      return;
    }

    const roomName = typeof req.body?.roomName === 'string' ? req.body.roomName : `rex-voice-${Date.now()}`;
    const identity = typeof req.body?.identity === 'string' ? req.body.identity : `user-${Date.now()}`;

    const at = new AccessToken(apiKey, apiSecret, { identity, name: identity });
    at.addGrant({ roomJoin: true, room: roomName });

    const token = await at.toJwt();
    res.json({ token });
  } catch (e) {
    console.error('LiveKit token error:', e);
    res.status(500).json({ error: 'Failed to create token' });
  }
});

/**
 * POST /api/voice/realtime
 * Body: { transcript: string, model?: string }
 * Returns: { text: string, audio?: string } — MVP: text only, no audio
 */
voiceRouter.post('/realtime', async (req: Request, res: Response) => {
  try {
    const transcript = typeof req.body?.transcript === 'string' ? req.body.transcript : '';
    if (!transcript.trim()) {
      res.status(400).json({ error: 'transcript is required', text: '' });
      return;
    }

    try {
      const text = await openai.getTextReplyFromTranscript(transcript);
      res.json({ text });
      return;
    } catch {
      // fallback
    }

    if (gemini.isGeminiAvailable()) {
      try {
        const text = await gemini.getTextReplyFromTranscript(transcript);
        res.json({ text });
        return;
      } catch (e) {
        console.error('Gemini voice fallback failed:', e);
      }
    }

    res.status(503).json({
      text: "I'm Rex. I couldn't reach the AI right now. Try again or use chat.",
    });
  } catch (e) {
    console.error('Voice realtime error:', e);
    res.status(500).json({ error: 'Internal server error', text: '' });
  }
});

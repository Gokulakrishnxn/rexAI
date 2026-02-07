import { Router, Request, Response } from 'express';

export const syncRouter = Router();

syncRouter.post('/records', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

syncRouter.post('/profile', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

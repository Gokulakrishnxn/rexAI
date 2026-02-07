import express from 'express';
import cors from 'cors';
import { config } from './config';
import { chatRouter } from './routes/chat';
import { soapRouter } from './routes/soap';
import { visionRouter } from './routes/vision';
import { voiceRouter } from './routes/voice';
import { extractRouter } from './routes/extract';
import { syncRouter } from './routes/sync';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/chat', chatRouter);
app.use('/api/soap', soapRouter);
app.use('/api/vision', visionRouter);
app.use('/api/voice', voiceRouter);
app.use('/api/extract', extractRouter);
app.use('/api/sync', syncRouter);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'rex-healthify-server' });
});

const port = config.port;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

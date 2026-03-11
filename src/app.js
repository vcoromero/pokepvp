import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    optionsSuccessStatus: 200,
  }));
  app.use(express.json({ limit: '10kb' }));
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }));

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use((err, req, res, next) => {
    console.error(err);
    const status = err.status ?? 500;
    res.status(status).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

import express from 'express';
import cors from 'cors';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/api', publicRouter);
  app.use('/api/admin', adminRouter);

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

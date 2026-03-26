import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import projectsRouter from './routes/projects.js';

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: allow frontend and Supabase domain
app.use(
  cors({
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      process.env.SUPABASE_URL,
    ].filter(Boolean),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount projects router
app.use('/api/projects', projectsRouter);

app.listen(PORT, () => {
  console.log(`GUPPI Pipeline Tracker API running on port ${PORT}`);
});

export default app;

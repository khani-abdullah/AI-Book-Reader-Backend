import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB } from './src/config/db.js';
import uploadRouter from './src/routes/upload.js';
import chatRouter from './src/routes/chat.js';
import documentsRouter from './src/routes/documents.js';
import authRouter from './src/routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const defaultClientOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://ai-book-reader-frontend-chi.vercel.app',
];
const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...defaultClientOrigins, ...configuredOrigins])];

app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header include local health checks and server-to-server calls.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
}));
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.use('/upload', uploadRouter);
app.use('/chat', chatRouter);
app.use('/documents', documentsRouter);
app.use('/auth', authRouter);

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `PDF exceeds the ${process.env.MAX_PDF_SIZE_MB || 20} MB limit.`
        : err.message;
    return res.status(400).json({ success: false, error: message });
  }
  if (err) {
    console.error('[error handler]', err);
    return res.status(400).json({ success: false, error: err.message });
  }
});

await connectDB();

app.listen(PORT, () => {
  console.log(`BookMind AI backend running on http://localhost:${PORT}`);
});

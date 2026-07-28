import mongoose from 'mongoose';
import { Router } from 'express';
import { isDBReady } from '../config/db.js';
import { answerQuestion } from '../services/rag.js';
import { getAIResponse } from '../services/gemini.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const { message, documentId } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'A non-empty "message" string is required.',
      });
    }

    const trimmed = message.trim();

    if (documentId) {
      if (!isDBReady()) {
        return res.status(503).json({
          success: false,
          error: 'Database is not connected. Configure MONGODB_URI in .env.',
        });
      }

      if (!mongoose.Types.ObjectId.isValid(documentId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid document ID format provided.',
        });
      }

      const result = await answerQuestion(documentId, trimmed, req.userId);
      return res.json({
        success: true,
        reply: result.reply,
        sources: result.sources,
      });
    }

    const reply = await getAIResponse(trimmed);
    return res.json({ success: true, reply });
  } catch (err) {
    console.error('[/chat] error:', err);
    const message =
      err instanceof Error ? err.message : 'The AI service is unavailable.';
    return res.status(502).json({ success: false, error: message });
  }
});

export default router;

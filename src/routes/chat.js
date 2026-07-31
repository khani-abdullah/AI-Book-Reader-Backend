import mongoose from 'mongoose';
import { Router } from 'express';
import { isDBReady } from '../config/db.js';
import { answerQuestion } from '../services/rag.js';
import { getAIResponse } from '../services/gemini.js';
import { requireAuth } from '../middleware/auth.js';
import { Document } from '../models/Document.js';

const router = Router();

const MAX_HISTORY_MESSAGES = 10;
const MAX_HISTORY_MESSAGE_LENGTH = 2_000;

function sanitizeHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      (turn) =>
        turn &&
        (turn.role === 'user' || turn.role === 'assistant') &&
        typeof turn.content === 'string' &&
        turn.content.trim(),
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((turn) => ({
      role: turn.role,
      content: turn.content.trim().slice(0, MAX_HISTORY_MESSAGE_LENGTH),
    }));
}

router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      message,
      documentId,
      documentIds,
      history,
    } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'A non-empty "message" string is required.',
      });
    }

    if (!isDBReady()) {
      return res.status(503).json({
        success: false,
        error: 'Database is not connected. Configure MONGODB_URI in .env.',
      });
    }

    const trimmed = message.trim();
    const conversationHistory = sanitizeHistory(history);

    // Support both documentId and documentIds
    let selectedDocumentIds = Array.isArray(documentIds)
      ? documentIds
      : documentId
        ? [documentId]
        : [];

    // If nothing is selected, search all user's documents
    if (selectedDocumentIds.length === 0) {
      const documents = await Document.find(
        { userId: req.userId },
        { _id: 1 }
      ).lean();

      selectedDocumentIds = documents.map((doc) => doc._id.toString());

      console.log(
        `[chat] No document selected. Searching ${selectedDocumentIds.length} document(s).`
      );
    }

    // If we have documents, use RAG
    if (selectedDocumentIds.length > 0) {
      const invalidDocument = selectedDocumentIds.some(
        (id) => !mongoose.Types.ObjectId.isValid(id)
      );

      if (invalidDocument) {
        return res.status(400).json({
          success: false,
          error: 'One or more document IDs are invalid.',
        });
      }

      const result = await answerQuestion({
        documentIds: selectedDocumentIds,
        question: trimmed,
        userId: req.userId,
        history: conversationHistory,
      });

      return res.json({
        success: true,
        reply: result.reply,
        sources: result.sources,
        usedDocumentKnowledge: result.usedDocumentKnowledge,
      });
    }

    // User has no uploaded documents -> normal Gemini chat
    const reply = await getAIResponse(trimmed, conversationHistory);

    return res.json({
      success: true,
      reply,
    });

  } catch (err) {
    console.error('[/chat] error:', err);

    const errorMessage =
      err instanceof Error
        ? err.message
        : 'The AI service is unavailable.';

    return res.status(502).json({
      success: false,
      error: errorMessage,
    });
  }
});

export default router;

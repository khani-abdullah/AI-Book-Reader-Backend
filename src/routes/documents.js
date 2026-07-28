import mongoose from 'mongoose';
import { Router } from 'express';
import { Document } from '../models/Document.js';
import { isDBReady } from '../config/db.js';
import { removeDocument } from '../services/rag.js';
import { deletePdfFromCloudinary } from '../services/cloudinaryService.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/:id', requireAuth, async (req, res) => {
  try {
    if (!isDBReady()) {
      return res.status(503).json({
        success: false,
        error: 'Database is not connected.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid document ID format.' });
    }

    const doc = await Document.findOne({ _id: req.params.id, userId: req.userId }).lean();
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    return res.json({
      success: true,
      document: {
        id: doc._id.toString(),
        name: doc.name,
        size: doc.size,
        cloudinaryUrl: doc.cloudinaryUrl,
        pageCount: doc.pageCount,
        chunkCount: doc.chunkCount,
        status: doc.status,
        errorMessage: doc.errorMessage,
        createdAt: doc.createdAt,
      },
    });
  } catch (err) {
    console.error('[GET /documents/:id] error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch document.' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    if (!isDBReady()) {
      return res.status(503).json({
        success: false,
        error: 'Database is not connected.',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'Invalid document ID format.' });
    }

    const doc = await removeDocument(req.params.id, req.userId);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    if (doc.cloudinaryPublicId) {
      await deletePdfFromCloudinary(doc.cloudinaryPublicId).catch((err) => {
        console.warn('[delete] Cloudinary cleanup failed:', err.message);
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /documents/:id] error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete document.' });
  }
});

export default router;

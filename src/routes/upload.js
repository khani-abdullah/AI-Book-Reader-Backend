import { Router } from 'express';
import { upload } from '../middleware/upload.js';
import { isDBReady } from '../config/db.js';
import { ingestDocument } from '../services/rag.js';
import { requireAuth } from '../middleware/auth.js';


const router = Router();


router.post(
  '/',
  requireAuth,
  upload.single('pdf'),
  async (req, res) => {

    try {

      if (!isDBReady()) {
        return res.status(503).json({
          success: false,
          error:
            'Database is not connected. Configure MONGODB_URI in .env.',
        });
      }


      if (!req.file) {
        return res.status(400).json({
          success: false,
          error:
            'A PDF file is required (field name: "pdf").',
        });
      }


      const isPdf =
        req.file.mimetype === 'application/pdf' &&
        req.file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';


      if (!isPdf) {
        return res.status(400).json({
          success: false,
          error:
            'Only PDF files are allowed.',
        });
      }


      const result = await ingestDocument(
        req.file.buffer,
        req.file.originalname,
        req.file.size,
        req.userId,
      );


      return res.status(201).json({
        success: true,
        document: result,
      });


    } catch (err) {

      console.error('[/upload] error:', err);


      const message =
        err instanceof Error
          ? err.message
          : 'Upload failed.';


      return res.status(500).json({
        success: false,
        error: message,
      });
    }
  },
);


export default router;

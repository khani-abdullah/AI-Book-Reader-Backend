import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    size: { type: Number, required: true },
    cloudinaryUrl: { type: String, default: '' },
    cloudinaryPublicId: { type: String, default: '' },
    mimeType: { type: String, default: 'application/pdf' },
    pageCount: { type: Number, default: 0 },
    chunkCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['processing', 'ready', 'error'],
      default: 'processing',
    },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true },
);

export const Document = mongoose.model('Document', documentSchema);

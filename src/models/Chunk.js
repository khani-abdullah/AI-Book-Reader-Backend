import mongoose from 'mongoose';

const chunkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },

    text: {
      type: String,
      required: true,
    },

    embedding: {
      type: [Number],
      required: true,
      validate: {
        validator: (value) => value.length > 0,
        message: 'Embedding vector cannot be empty.',
      },
    },

    chunkIndex: {
      type: Number,
      required: true,
    },

    metadata: {
      startChar: { type: Number },
      endChar: { type: Number },
    },
  },
  { timestamps: true },
);


chunkSchema.index({
  documentId: 1,
  chunkIndex: 1,
});


export const Chunk = mongoose.model('Chunk', chunkSchema);
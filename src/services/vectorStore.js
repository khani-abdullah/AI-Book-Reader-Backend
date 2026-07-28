import { Chunk } from '../models/Chunk.js';

const DEFAULT_TOP_K = Number(process.env.RAG_TOP_K) || 5;

/**
 * Cosine similarity between two equal-length vectors.
 */
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Store chunk records with their embeddings in MongoDB.
 */
export async function storeChunks(documentId, chunksWithEmbeddings) {
  const docs = chunksWithEmbeddings.map(({ text, embedding, chunkIndex, metadata }) => ({
    documentId,
    text,
    embedding,
    chunkIndex,
    metadata,
  }));

  const inserted = await Chunk.insertMany(docs);
  return inserted.map((doc) => doc._id);
}

/**
 * Similarity search scoped to a single document.
 * Returns the top-k most relevant chunks sorted by score descending.
 */
export async function searchSimilarChunks(documentId, queryEmbedding, topK = DEFAULT_TOP_K) {
  const chunks = await Chunk.find({ documentId }).lean();

  if (chunks.length === 0) return [];

  const scored = chunks.map((chunk) => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK);
}

/**
 * Remove all chunks belonging to a document.
 */
export async function deleteChunksByDocument(documentId) {
  await Chunk.deleteMany({ documentId });
}

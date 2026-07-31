import { Chunk } from '../models/Chunk.js';

const DEFAULT_TOP_K = Number(process.env.RAG_TOP_K) || 8;

const DEFAULT_PER_DOCUMENT_K =
  Number(process.env.RAG_PER_DOCUMENT_K) || 2;

const DEFAULT_RELEVANCE_THRESHOLD =
  Number(process.env.RAG_RELEVANCE_THRESHOLD) || 0.45;

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
export async function searchSimilarChunks(
  documentIds,
  queryEmbedding,
  topK = DEFAULT_TOP_K,
) {
  const ids = Array.isArray(documentIds)
    ? documentIds
    : [documentIds];

  const chunks = await Chunk.find({
    documentId: { $in: ids },
  }).lean();

  if (!chunks.length) {
    return [];
  }

  // Calculate cosine similarity for every chunk
  const scored = chunks.map((chunk) => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  // Highest similarity first
  scored.sort((a, b) => b.score - a.score);

  // -----------------------------
  // Diversify retrieval
  // -----------------------------

  const grouped = new Map();

  for (const chunk of scored) {
    const docId = chunk.documentId.toString();

    if (!grouped.has(docId)) {
      grouped.set(docId, []);
    }

    const documentChunks = grouped.get(docId);

    if (documentChunks.length < DEFAULT_PER_DOCUMENT_K) {
      documentChunks.push(chunk);
    }
  }

  // Merge all selected chunks
  const diversified = [...grouped.values()].flat();

  // Sort again globally
  diversified.sort((a, b) => b.score - a.score);

  // Return the overall best results
  return diversified.slice(0, topK);
}

export function filterRelevantChunks(chunks, threshold = DEFAULT_RELEVANCE_THRESHOLD) {
  return chunks.filter((chunk) => chunk.score >= threshold);
}
/**
 * Remove all chunks belonging to a document.
 */
export async function deleteChunksByDocument(documentId) {
  await Chunk.deleteMany({ documentId });
}

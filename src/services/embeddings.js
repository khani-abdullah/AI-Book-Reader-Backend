import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const embeddingModelName =
  process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';

/** Batch size for embedding requests to avoid rate limits */
const BATCH_SIZE = 20;

function getEmbeddingModel() {
  if (!genAI) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add it to backend/.env',
    );
  }
  return genAI.getGenerativeModel({ model: embeddingModelName });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a single embedding vector for the given text with retry backoff.
 */
export async function embedText(text, retries = 3) {
  const model = getEmbeddingModel();
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (err) {
      const isRateLimit =
        err?.status === 429 ||
        (err?.message && (err.message.includes('429') || err.message.includes('Quota')));

      if (isRateLimit && attempt < retries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`[embeddings] Rate limited. Retrying in ${waitTime}ms...`);
        await delay(waitTime);
      } else {
        throw err;
      }
    }
  }
}

/**
 * Generate embeddings for multiple text chunks in small batches with pacing.
 */
export async function embedTexts(texts) {
  const embeddings = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = await Promise.all(
      batch.map((text) => embedText(text)),
    );
    embeddings.push(...batchEmbeddings);

    if (i + BATCH_SIZE < texts.length) {
      await delay(200);
    }
  }

  return embeddings;
}

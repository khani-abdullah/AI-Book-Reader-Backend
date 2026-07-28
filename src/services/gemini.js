import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
const embeddingModelName =
  process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';

function getChatModel() {
  if (!genAI) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add it to backend/.env',
    );
  }
  return genAI.getGenerativeModel({ model: modelName });
}

export { embedText } from './embeddings.js';

const RAG_SYSTEM_INSTRUCTION = `You are a helpful assistant that answers questions strictly based on the provided document excerpts.
Rules:
- Answer ONLY using information from the excerpts below.
- If the excerpts do not contain enough information, say so clearly — do not guess or use outside knowledge.
- Be concise and accurate. Quote or paraphrase the source when helpful.
- Do not mention "excerpts" or "context" — speak naturally as if you read the book.`;

/**
 * Generate an answer grounded in retrieved document chunks.
 */
export async function getRAGResponse(question, context, documentName) {
  const model = getChatModel();

  const prompt = `${RAG_SYSTEM_INSTRUCTION}

Document: "${documentName}"

--- RETRIEVED CONTENT ---
${context}
--- END RETRIEVED CONTENT ---

User question: ${question}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  if (!text) {
    throw new Error('The model returned an empty response.');
  }

  return text;
}

/**
 * Plain chat without RAG (fallback when no document is selected).
 */
export async function getAIResponse(message) {
  const model = getChatModel();

  try {
    const result = await model.generateContent(message);
    const response = await result.response;
    const text = response.text();
    if (!text) throw new Error('The model returned an empty response.');
    return text;
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown Gemini error.';
    throw new Error(`Gemini request failed: ${detail}`);
  }
}

import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const modelName =
  process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';


function getChatModel() {
  if (!genAI) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add it to backend/.env',
    );
  }

  return genAI.getGenerativeModel({
    model: modelName,
  });
}


async function generateResponse(prompt) {
  try {
    const model = getChatModel();

    const result = await model.generateContent(prompt);
    const response = await result.response;

    const text = response.text();

    if (!text) {
      throw new Error('The model returned an empty response.');
    }

    return text;

  } catch (err) {
    const detail =
      err instanceof Error
        ? err.message
        : 'Unknown Gemini error.';

    throw new Error(
      `Gemini request failed: ${detail}`,
    );
  }
}


export { embedText } from './embeddings.js';


const RAG_SYSTEM_INSTRUCTION = `
You are a helpful AI assistant that answers questions about uploaded documents.

Rules:
- Use only the provided document content to answer.
- Do not use outside knowledge or make assumptions.
- If the answer is not present in the document, clearly say that the document does not contain that information.
- Keep answers accurate, clear, and concise.
- Do not mention retrieval, context, or excerpts.
- Answer naturally as if you have read the document.
`;


/**
 * Generate an answer grounded in retrieved document chunks.
 */
export async function getRAGResponse(
  question,
  context,
  documentName,
) {

  const prompt = `${RAG_SYSTEM_INSTRUCTION}

Documents:
"${documentName}"

--- DOCUMENT CONTENT ---
${context}
--- END DOCUMENT CONTENT ---

Question:
${question}`;


  return await generateResponse(prompt);
}


/**
 * Plain chat without RAG.
 */
export async function getAIResponse(message) {
  return await generateResponse(message);
}
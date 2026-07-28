import { Document } from '../models/Document.js';
import { uploadPdfToCloudinary } from './cloudinaryService.js';
import { extractTextFromPdf } from './pdfExtractor.js';
import { chunkText } from './chunker.js';
import { embedTexts } from './embeddings.js';
import {
  storeChunks,
  deleteChunksByDocument,
  searchSimilarChunks,
} from './vectorStore.js';
import { embedText, getRAGResponse } from './gemini.js';

/**
 * Full ingestion pipeline:
 * Cloudinary upload → text extraction → chunking → embeddings → vector store
 */
export async function ingestDocument(buffer, filename, size, userId) {
  const doc = await Document.create({
    userId,
    name: filename,
    size,
    cloudinaryUrl: '',
    cloudinaryPublicId: '',
    status: 'processing',
  });

  try {
    const cloudinaryResult = await uploadPdfToCloudinary(buffer, filename);

    doc.cloudinaryUrl = cloudinaryResult.url;
    doc.cloudinaryPublicId = cloudinaryResult.publicId;
    await doc.save();

    const { text, pageCount } = await extractTextFromPdf(buffer);
    doc.pageCount = pageCount;
    await doc.save();

    const chunks = chunkText(text);
    const texts = chunks.map((c) => c.text);
    const embeddings = await embedTexts(texts);

    const chunksWithEmbeddings = chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i],
    }));

    const chunkIds = await storeChunks(doc._id, chunksWithEmbeddings);

    doc.chunkCount = chunkIds.length;
    doc.status = 'ready';
    await doc.save();

    return {
      documentId: doc._id.toString(),
      name: doc.name,
      cloudinaryUrl: doc.cloudinaryUrl,
      pageCount: doc.pageCount,
      chunkCount: doc.chunkCount,
      status: doc.status,
    };
  } catch (err) {
    doc.status = 'error';
    doc.errorMessage = err instanceof Error ? err.message : 'Ingestion failed';
    await doc.save();
    throw err;
  }
}

/**
 * RAG query pipeline:
 * embed query → similarity search → LLM with retrieved context only
 */
export async function answerQuestion(documentId, question, userId) {
  const doc = await Document.findOne({ _id: documentId, userId });
  if (!doc) {
    throw new Error('Document not found.');
  }
  if (doc.status !== 'ready') {
    throw new Error(
      doc.status === 'processing'
        ? 'Document is still being processed. Please wait.'
        : doc.errorMessage || 'Document is not ready for questions.',
    );
  }

  const queryEmbedding = await embedText(question);
  const relevantChunks = await searchSimilarChunks(documentId, queryEmbedding);

  if (relevantChunks.length === 0) {
    throw new Error('No relevant content found in this document.');
  }

  const context = relevantChunks
    .map((chunk, i) => `[Excerpt ${i + 1}]\n${chunk.text}`)
    .join('\n\n');

  const reply = await getRAGResponse(question, context, doc.name);

  return {
    reply,
    sources: relevantChunks.map((c) => ({
      chunkIndex: c.chunkIndex,
      score: c.score,
      preview: c.text.slice(0, 120) + (c.text.length > 120 ? '…' : ''),
    })),
  };
}

export async function removeDocument(documentId, userId) {
  const doc = await Document.findOneAndDelete({ _id: documentId, userId });
  if (doc) await deleteChunksByDocument(documentId);
  return doc;
}

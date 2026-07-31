import { Document } from '../models/Document.js';
import { deletePdfFromCloudinary, uploadPdfToCloudinary } from './cloudinaryService.js';
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

    const chunkIds = await storeChunks(
      doc._id,
      chunksWithEmbeddings,
    );

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
    await deleteChunksByDocument(doc._id).catch((cleanupError) => {
      console.warn('[ingest] Failed to remove partial chunks:', cleanupError.message);
    });
    if (doc.cloudinaryPublicId) {
      await deletePdfFromCloudinary(doc.cloudinaryPublicId).catch((cleanupError) => {
        console.warn('[ingest] Failed to remove uploaded PDF:', cleanupError.message);
      });
      doc.cloudinaryUrl = '';
      doc.cloudinaryPublicId = '';
    }
    doc.status = 'error';
    doc.errorMessage =
      err instanceof Error ? err.message : 'Ingestion failed';

    await doc.save();
    throw err;
  }
}


/**
 * RAG query pipeline:
 * embed query → similarity search → LLM with retrieved context only
 */
export async function answerQuestion({
  documentIds,
  question,
  userId,
}) {

  const documents = await Document.find({
    _id: { $in: documentIds },
    userId,
  });

  if (!documents.length) {
    throw new Error('No documents found.');
  }

  const notReadyDocument = documents.find(
    (doc) => doc.status !== 'ready'
  );

  if (notReadyDocument) {
    throw new Error(
      notReadyDocument.status === 'processing'
        ? 'Document is still being processed. Please wait.'
        : notReadyDocument.errorMessage ||
          'Document is not ready for questions.',
    );
  }


  const queryEmbedding = await embedText(question);

  const relevantChunks = await searchSimilarChunks(
    documentIds,
    queryEmbedding,
  );


  if (relevantChunks.length === 0) {
    throw new Error(
      'No relevant content found in these documents.',
    );
  }


 // Create a lookup table: documentId -> document name
const documentMap = new Map(
  documents.map((doc) => [
    doc._id.toString(),
    doc.name,
  ])
);

// Group retrieved chunks by document
const groupedChunks = new Map();

for (const chunk of relevantChunks) {
  const documentId = chunk.documentId.toString();

  if (!groupedChunks.has(documentId)) {
    groupedChunks.set(documentId, []);
  }

  groupedChunks.get(documentId).push(chunk);
}

// Build structured context
const context = [...groupedChunks.entries()]
  .map(([documentId, chunks]) => {
    const documentName =
      documentMap.get(documentId) || 'Unknown Document';

    const excerpts = chunks
      .map(
        (chunk, index) =>
          `[Excerpt ${index + 1}]\n${chunk.text}`
      )
      .join('\n\n');

    return `Document: ${documentName}\n\n${excerpts}`;
  })
  .join('\n\n----------------------------------------\n\n');

const documentNames = documents
  .map((doc) => doc.name)
  .join(', ');


  const reply = await getRAGResponse(
    question,
    context,
    documentNames,
  );


  return {
    reply,

    sources: relevantChunks.map((chunk) => ({
      chunkIndex: chunk.chunkIndex,
      score: chunk.score,
      preview:
        chunk.text.slice(0, 120) +
        (chunk.text.length > 120 ? '…' : ''),
    })),
  };
}


export async function removeDocument(documentId, userId) {
  const doc = await Document.findOneAndDelete({
    _id: documentId,
    userId,
  });

  if (doc) {
    await deleteChunksByDocument(documentId);
  }

  return doc;
}

import { PDFParse } from 'pdf-parse';

/**
 * Extract plain text from a PDF buffer.
 * Returns the full text and page count.
 */
export async function extractTextFromPdf(buffer) {

  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Invalid PDF buffer provided.');
  }


  // Validate PDF file signature
  const pdfHeader = buffer
    .subarray(0, 5)
    .toString('utf8');


  if (pdfHeader !== '%PDF-') {
    throw new Error(
      'Uploaded file is not a valid PDF.',
    );
  }


  const uint8Array = new Uint8Array(buffer);

  const parser = new PDFParse(uint8Array);


  try {

    const textResult = await parser.getText();


    const rawText =
      textResult?.text || '';


    const pageCount =
      textResult?.total || 0;


    const text = rawText
      .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, '')
      .replace(/\s+/g, ' ')
      .trim();


    if (!text) {
      throw new Error(
        'No extractable text found in the PDF. It may be scanned/image-only.',
      );
    }


    return {
      text,
      pageCount,
    };


  } finally {

    if (parser.destroy) {
      await parser.destroy();
    }

  }
}
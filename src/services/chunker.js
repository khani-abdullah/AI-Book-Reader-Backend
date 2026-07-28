const DEFAULT_CHUNK_SIZE = Number(process.env.RAG_CHUNK_SIZE) || 1000;
const DEFAULT_CHUNK_OVERLAP = Number(process.env.RAG_CHUNK_OVERLAP) || 200;

const SEPARATORS = ['\n\n', '\n', '. ', ' '];

/**
 * Split text into overlapping chunks, preferring paragraph and sentence boundaries.
 */
export function chunkText(text, options = {}) {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_CHUNK_OVERLAP;

  if (text.length <= chunkSize) {
    return [{ text, chunkIndex: 0, metadata: { startChar: 0, endChar: text.length } }];
  }

  const chunks = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    if (end < text.length) {
      const slice = text.slice(start, end);
      let splitAt = -1;

      for (const sep of SEPARATORS) {
        const idx = slice.lastIndexOf(sep);
        if (idx > chunkSize * 0.5) {
          splitAt = idx + sep.length;
          break;
        }
      }

      if (splitAt > 0) {
        end = start + splitAt;
      }
    }

    const chunkTextSlice = text.slice(start, end).trim();
    if (chunkTextSlice) {
      chunks.push({
        text: chunkTextSlice,
        chunkIndex,
        metadata: { startChar: start, endChar: end },
      });
      chunkIndex += 1;
    }

    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

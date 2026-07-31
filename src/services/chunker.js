const DEFAULT_CHUNK_SIZE =
  Number(process.env.RAG_CHUNK_SIZE) || 1000;

const DEFAULT_CHUNK_OVERLAP =
  Number(process.env.RAG_CHUNK_OVERLAP) || 200;


const SEPARATORS = [
  '\n\n',
  '\n',
  '. ',
  ' ',
];


/**
 * Split text into overlapping chunks,
 * preferring paragraph and sentence boundaries.
 */
export function chunkText(text, options = {}) {

  if (!text || typeof text !== 'string') {
    throw new Error(
      'Cannot chunk empty or invalid text.',
    );
  }


  const chunkSize =
    options.chunkSize ?? DEFAULT_CHUNK_SIZE;

  const overlap =
    options.overlap ?? DEFAULT_CHUNK_OVERLAP;


  if (chunkSize <= 0) {
    throw new Error(
      'Chunk size must be greater than zero.',
    );
  }


  if (overlap >= chunkSize) {
    throw new Error(
      'Chunk overlap must be smaller than chunk size.',
    );
  }


  if (text.length <= chunkSize) {

    return [
      {
        text: text.trim(),
        chunkIndex: 0,
        metadata: {
          startChar: 0,
          endChar: text.length,
        },
      },
    ];
  }


  const chunks = [];

  let start = 0;
  let chunkIndex = 0;


  while (start < text.length) {

    let end = Math.min(
      start + chunkSize,
      text.length,
    );


    if (end < text.length) {

      const slice = text.slice(
        start,
        end,
      );


      let splitAt = -1;


      for (const separator of SEPARATORS) {

        const index =
          slice.lastIndexOf(separator);


        if (index > chunkSize * 0.5) {

          splitAt =
            index + separator.length;

          break;
        }
      }


      if (splitAt > 0) {
        end = start + splitAt;
      }
    }


    const currentChunk =
      text.slice(start, end).trim();


    if (currentChunk) {

      chunks.push({
        text: currentChunk,
        chunkIndex,
        metadata: {
          startChar: start,
          endChar: end,
        },
      });


      chunkIndex++;
    }


    if (end >= text.length) {
      break;
    }


    start = Math.max(
      end - overlap,
      start + 1,
    );
  }


  return chunks;
}
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

/** Splits raw text into overlapping chunks suitable for embedding. */
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length <= CHUNK_SIZE) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    chunks.push(normalized.slice(start, end).trim());
    if (end === normalized.length) break;
    start = end - CHUNK_OVERLAP;
  }

  return chunks.filter(Boolean);
}

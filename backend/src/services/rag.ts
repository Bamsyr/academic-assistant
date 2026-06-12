import { embed, embedBatch } from "./llm";

interface Chunk {
  id: string;
  text: string;
  embedding: number[];
  group: string;
  type: "announcement" | "document";
  sourceId: number;
  metadata: Record<string, string>;
}

const store: Chunk[] = [];

function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function splitIntoChunks(text: string, maxLen = 400, overlap = 50): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxLen, text.length);
    chunks.push(text.slice(start, end).trim());
    start += maxLen - overlap;
  }
  return chunks.filter((c) => c.length > 0);
}

export async function indexDocument(params: {
  sourceId: number;
  text: string;
  group: string;
  type: "announcement" | "document";
  metadata?: Record<string, string>;
}): Promise<void> {
  const { sourceId, text, group, type, metadata = {} } = params;
  const chunks = splitIntoChunks(text);
  const embeddings = await embedBatch(chunks);
  for (let i = 0; i < chunks.length; i++) {
    store.push({
      id: `${type}:${sourceId}:chunk:${i}`,
      text: chunks[i],
      embedding: embeddings[i],
      group,
      type,
      sourceId,
      metadata,
    });
  }
}

export async function query(question: string, studentGroup: string): Promise<string> {
  if (store.length === 0) return "";
  const qEmbed = await embed(question);
  const results = store
    .filter(
      (c) =>
        c.group === studentGroup ||
        c.group === "all"
    )
    .map((c) => ({ chunk: c, score: cosine(qEmbed, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  return results.map((r) => r.chunk.text).join("\n\n---\n\n");
}

export function getStoreSize(): number {
  return store.length;
}

export function clearStore(): void {
  store.length = 0;
}

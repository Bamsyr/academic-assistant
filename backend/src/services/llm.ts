import { Mistral } from "@mistralai/mistralai";
import { config } from "../config";

const client = new Mistral({ apiKey: config.MISTRAL_API_KEY });

// Free-tier Mistral allows ~1 request/second; retry 429s with backoff.
async function withRateLimitRetry<T>(fn: () => Promise<T>, retries = 4): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const message = (err as Error).message ?? "";
      const status = (err as { statusCode?: number }).statusCode;
      const isRateLimit = status === 429 || message.includes("429") || message.includes("rate_limited");
      if (!isRateLimit || attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
}

// Keep each request well under the embeddings token limit; chunks are ~400 chars.
const EMBED_BATCH_SIZE = 50;

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const res = await withRateLimitRetry(() =>
      client.embeddings.create({ model: "mistral-embed", inputs: batch })
    );
    const data = res.data ?? [];
    if (data.length !== batch.length || data.some((d) => !d.embedding)) {
      throw new Error("Mistral returned incomplete embeddings");
    }
    embeddings.push(...data.map((d) => d.embedding as number[]));
  }
  return embeddings;
}

export async function embed(text: string): Promise<number[]> {
  const [embedding] = await embedBatch([text]);
  return embedding;
}

export async function chat(
  systemPrompt: string,
  context: string,
  question: string
): Promise<string> {
  const res = await client.chat.complete({
    model: "mistral-small-latest",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: context
          ? `Relevant context:\n${context}\n\nQuestion: ${question}`
          : question,
      },
    ],
  });
  return extractText(res.choices?.[0]?.message?.content);
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c) => (c as { type?: string }).type === "text")
      .map((c) => (c as { text: string }).text)
      .join("");
  }
  return "No response generated.";
}

export interface AnnouncementAnalysis {
  isAnnouncement: boolean;
  category: string;
  targetGroup: string;
  content: string;
}

/**
 * Voice flow: decide whether a transcript is a course announcement and, if so,
 * normalise it into the fields the AnnouncementLog contract expects. Returns
 * structured JSON; falls back to "not an announcement" if the model misbehaves.
 */
export async function analyzeForAnnouncement(
  transcript: string
): Promise<AnnouncementAnalysis> {
  const res = await client.chat.complete({
    model: "mistral-small-latest",
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: [
          "You classify a professor's spoken message for a university course assistant.",
          "Decide if it is an ANNOUNCEMENT meant to be published to students",
          "(e.g. exam dates, schedule changes, deadlines, room changes, instructions).",
          "Casual chatter, questions, or tests are NOT announcements.",
          'Respond ONLY with JSON: {"isAnnouncement": boolean, "category": string, "targetGroup": string, "content": string}.',
          'category is one of: "exam", "schedule", "deadline", "general".',
          'targetGroup is a group code if the professor names one, otherwise "all".',
          "content is the cleaned-up announcement text (fix transcription errors, keep it faithful).",
        ].join(" "),
      },
      { role: "user", content: transcript },
    ],
  });

  const raw = extractText(res.choices?.[0]?.message?.content);
  try {
    const parsed = JSON.parse(raw) as Partial<AnnouncementAnalysis>;
    return {
      isAnnouncement: Boolean(parsed.isAnnouncement),
      category: parsed.category?.trim() || "general",
      targetGroup: parsed.targetGroup?.trim() || "all",
      content: parsed.content?.trim() || transcript,
    };
  } catch {
    return { isAnnouncement: false, category: "general", targetGroup: "all", content: transcript };
  }
}

// Shared RAG + LLM question-answering, reused by the REST /api/chat route and
// the Telegram bot so both interfaces behave identically.
import { getRoleOf, getGroup } from "./blockchain";
import { query as ragQuery } from "./rag";
import { chat } from "./llm";

export interface AssistantReply {
  answer: string;
  contextUsed: boolean;
  role: string;
  group: string;
}

export class NotRegisteredError extends Error {
  constructor() {
    super("Wallet not registered in the system");
    this.name = "NotRegisteredError";
  }
}

export async function answerQuestion(
  question: string,
  callerAddress: `0x${string}`
): Promise<AssistantReply> {
  const [role, group] = await Promise.all([
    getRoleOf(callerAddress),
    getGroup(callerAddress),
  ]);

  if (role === "NONE") throw new NotRegisteredError();

  const context = await ragQuery(question, group || "all");

  const systemPrompt = [
    "You are an academic assistant for a university course.",
    `You are speaking with a ${role} whose wallet is ${callerAddress}.`,
    group ? `They belong to group: ${group}.` : "",
    "Answer only based on the provided context. If the context does not contain the answer, say so clearly.",
    "Be concise and helpful. Do not make up dates or deadlines.",
  ]
    .filter(Boolean)
    .join(" ");

  const answer = await chat(systemPrompt, context, question);
  return { answer, contextUsed: context.length > 0, role, group };
}

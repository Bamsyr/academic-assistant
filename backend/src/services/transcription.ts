// Voice Message Support — speech-to-text via the OpenAI Whisper API, with
// automatic fallback to Mistral Voxtral (same key as the rest of the app) when
// OpenAI is unavailable (e.g. quota exhausted or network error).
import OpenAI, { toFile } from "openai";
import { Mistral } from "@mistralai/mistralai";
import { config } from "../config";

const VOXTRAL_MODEL = "voxtral-mini-latest";

let openaiClient: OpenAI | null = null;
let mistralClient: Mistral | null = null;

function getOpenAI(): OpenAI {
  openaiClient ??= new OpenAI({ apiKey: config.OPENAI_API_KEY });
  return openaiClient;
}

function getMistral(): Mistral {
  mistralClient ??= new Mistral({ apiKey: config.MISTRAL_API_KEY });
  return mistralClient;
}

export function transcriptionEnabled(): boolean {
  return Boolean(config.OPENAI_API_KEY || config.MISTRAL_API_KEY);
}

async function transcribeWithWhisper(buffer: Buffer, fileName: string): Promise<string> {
  const file = await toFile(buffer, fileName);
  const res = await getOpenAI().audio.transcriptions.create({
    file,
    model: config.WHISPER_MODEL,
  });
  return res.text.trim();
}

async function transcribeWithVoxtral(buffer: Buffer, fileName: string): Promise<string> {
  const res = await getMistral().audio.transcriptions.complete({
    model: VOXTRAL_MODEL,
    file: { fileName, content: new Uint8Array(buffer) },
  });
  return res.text.trim();
}

/**
 * Transcribes an audio buffer (e.g. a Telegram .oga/.ogg voice note) to text.
 * @param fileName  Used only so the model can infer the container/codec.
 */
export async function transcribeAudio(
  buffer: Buffer,
  fileName = "voice.ogg"
): Promise<string> {
  if (!transcriptionEnabled()) {
    throw new Error("Voice transcription is disabled — set OPENAI_API_KEY or MISTRAL_API_KEY.");
  }

  if (config.OPENAI_API_KEY) {
    try {
      return await transcribeWithWhisper(buffer, fileName);
    } catch (e) {
      if (!config.MISTRAL_API_KEY) throw e;
      console.warn(`Whisper transcription failed (${(e as Error).message}); falling back to Voxtral.`);
    }
  }
  return transcribeWithVoxtral(buffer, fileName);
}

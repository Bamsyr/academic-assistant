import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  PORT:                      parseInt(process.env.PORT ?? "3001"),
  CORS_ORIGIN:               process.env.CORS_ORIGIN ?? "http://127.0.0.1:5500",
  HARDHAT_RPC_URL:           process.env.HARDHAT_RPC_URL ?? "http://127.0.0.1:8545",
  BACKEND_PRIVATE_KEY:       required("BACKEND_PRIVATE_KEY") as `0x${string}`,
  MISTRAL_API_KEY:           required("MISTRAL_API_KEY"),

  // Optional integrations — features stay disabled when their key is absent.
  OPENAI_API_KEY:            process.env.OPENAI_API_KEY ?? "",        // Whisper transcription
  WHISPER_MODEL:             process.env.WHISPER_MODEL ?? "whisper-1",
  TELEGRAM_BOT_TOKEN:        process.env.TELEGRAM_BOT_TOKEN ?? "",    // Telegram bot interface

  ROLE_MANAGER_ADDRESS:      required("ROLE_MANAGER_ADDRESS") as `0x${string}`,
  ANNOUNCEMENT_LOG_ADDRESS:  required("ANNOUNCEMENT_LOG_ADDRESS") as `0x${string}`,
  DOCUMENT_REGISTRY_ADDRESS: required("DOCUMENT_REGISTRY_ADDRESS") as `0x${string}`,
  ACKNOWLEDGMENT_LOG_ADDRESS:required("ACKNOWLEDGMENT_LOG_ADDRESS") as `0x${string}`,
};

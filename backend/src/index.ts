import express from "express";
import cors from "cors";
import { config } from "./config";
import { startTelegramBot, stopTelegramBot, telegramEnabled } from "./services/telegram";
import { transcriptionEnabled } from "./services/transcription";

import rolesRouter        from "./routes/roles";
import announcementsRouter from "./routes/announcements";
import documentsRouter    from "./routes/documents";
import chatRouter         from "./routes/chat";
import acknowledgeRouter  from "./routes/acknowledge";

const app = express();

// Contract reads (viem) return uint256 fields as BigInt, which JSON.stringify
// rejects — serialize them as strings in every res.json() response.
app.set("json replacer", (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value
);

// Accept the configured origin plus its localhost/127.0.0.1 twin, so the
// frontend works regardless of which hostname it was opened from.
const corsOrigins = [
  ...new Set(
    config.CORS_ORIGIN.split(",")
      .map((o) => o.trim())
      .filter(Boolean)
      .flatMap((o) => [
        o,
        o.replace("127.0.0.1", "localhost"),
        o.replace("localhost", "127.0.0.1"),
      ])
  ),
];
app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("/api", (_req, res) =>
  res.json({
    status: "ok",
    endpoints: ["/api/roles", "/api/announcements", "/api/documents", "/api/chat", "/api/acknowledge"],
  })
);

app.use("/api/roles",         rolesRouter);
app.use("/api/announcements", announcementsRouter);
app.use("/api/documents",     documentsRouter);
app.use("/api/chat",          chatRouter);
app.use("/api/acknowledge",   acknowledgeRouter);

const server = app.listen(config.PORT, () => {
  console.log(`Backend running on http://localhost:${config.PORT}`);
  console.log(`  RoleManager:       ${config.ROLE_MANAGER_ADDRESS}`);
  console.log(`  AnnouncementLog:   ${config.ANNOUNCEMENT_LOG_ADDRESS}`);
  console.log(`  DocumentRegistry:  ${config.DOCUMENT_REGISTRY_ADDRESS}`);
  console.log(`  AcknowledgmentLog: ${config.ACKNOWLEDGMENT_LOG_ADDRESS}`);
  console.log(`  Voice:             ${transcriptionEnabled() ? "enabled (Whisper → Voxtral fallback)" : "disabled (set OPENAI_API_KEY or MISTRAL_API_KEY)"}`);
  if (!telegramEnabled()) console.log("  Telegram bot:      disabled (set TELEGRAM_BOT_TOKEN)");

  // Telegram bot shares this process; only launches if a token is configured.
  void startTelegramBot();
});

// Graceful shutdown so the Telegram long-poll connection closes cleanly.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    stopTelegramBot(signal);
    server.close(() => process.exit(0));
  });
}

export default app;

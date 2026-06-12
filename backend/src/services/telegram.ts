// Telegram Bot Interface — an alternative front-end to the web app, backed by
// the exact same services (blockchain, RAG, LLM). Students query the assistant
// in natural language; professors can fire off voice-note announcements.
import { Telegraf, Context } from "telegraf";
import { message } from "telegraf/filters";
import { keccak256, toHex } from "viem";
import { config } from "../config";
import {
  getRoleOf,
  getGroup,
  publishAnnouncement,
  holdsProfessorRole,
  relayerAddress,
} from "./blockchain";
import { indexDocument } from "./rag";
import { answerQuestion, NotRegisteredError } from "./assistant";
import { transcribeAudio, transcriptionEnabled } from "./transcription";
import { analyzeForAnnouncement } from "./llm";
import { linkWallet, getLinkedWallet, unlinkWallet, isValidAddress } from "./links";

let bot: Telegraf | null = null;

const HELP = [
  "🤖 *Academic Assistant Bot*",
  "",
  "1. `/link 0xYourWallet` — connect your registered wallet",
  "2. Just type a question — I answer from on-chain announcements & documents",
  "",
  "*Professors:* send a 🎙️ voice message. I transcribe it (Whisper), and if it's",
  "an announcement I publish it on-chain automatically.",
  "",
  "Other commands: `/whoami`, `/unlink`, `/help`",
].join("\n");

export function telegramEnabled(): boolean {
  return Boolean(config.TELEGRAM_BOT_TOKEN);
}

async function requireLink(ctx: Context): Promise<ReturnType<typeof getLinkedWallet>> {
  const linked = getLinkedWallet(ctx.from!.id);
  if (!linked) {
    await ctx.reply("You're not linked yet. Send `/link 0xYourWallet` first.", {
      parse_mode: "Markdown",
    });
  }
  return linked;
}

async function downloadVoice(ctx: Context, fileId: string): Promise<Buffer> {
  const link = await ctx.telegram.getFileLink(fileId);
  const res = await fetch(link.href);
  if (!res.ok) throw new Error(`Failed to download voice file (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

function registerHandlers(b: Telegraf): void {
  b.start((ctx) => ctx.reply(HELP, { parse_mode: "Markdown" }));
  b.help((ctx) => ctx.reply(HELP, { parse_mode: "Markdown" }));

  // /link <wallet> — verify the wallet has a role on-chain, then remember it.
  b.command("link", async (ctx) => {
    const arg = ctx.message.text.split(/\s+/)[1]?.trim();
    if (!arg || !isValidAddress(arg)) {
      await ctx.reply("Usage: `/link 0xYourWalletAddress`", { parse_mode: "Markdown" });
      return;
    }
    try {
      const [role, group] = await Promise.all([getRoleOf(arg), getGroup(arg)]);
      if (role === "NONE") {
        await ctx.reply("That wallet has no role yet. Ask an admin to register it first.");
        return;
      }
      linkWallet(ctx.from.id, { address: arg, role, group });
      await ctx.reply(`✅ Linked ${arg}\nRole: *${role}*${group ? `\nGroup: *${group}*` : ""}`, {
        parse_mode: "Markdown",
      });
    } catch (e) {
      await ctx.reply(`Could not verify wallet: ${(e as Error).message}`);
    }
  });

  b.command("whoami", async (ctx) => {
    const linked = getLinkedWallet(ctx.from.id);
    if (!linked) {
      await ctx.reply("Not linked. Send `/link 0xYourWallet`.", { parse_mode: "Markdown" });
      return;
    }
    await ctx.reply(
      `Wallet: ${linked.address}\nRole: ${linked.role}${linked.group ? `\nGroup: ${linked.group}` : ""}`
    );
  });

  b.command("unlink", async (ctx) => {
    unlinkWallet(ctx.from.id);
    await ctx.reply("Unlinked. Send `/link` to reconnect.", { parse_mode: "Markdown" });
  });

  // Plain text → assistant question.
  b.on(message("text"), async (ctx) => {
    if (ctx.message.text.startsWith("/")) return; // unknown command
    const linked = await requireLink(ctx);
    if (!linked) return;
    await ctx.sendChatAction("typing");
    try {
      const { answer, contextUsed } = await answerQuestion(ctx.message.text, linked.address);
      await ctx.reply(contextUsed ? answer : `${answer}\n\n_(no matching course context found)_`, {
        parse_mode: "Markdown",
      });
    } catch (e) {
      await ctx.reply(
        e instanceof NotRegisteredError ? "Your linked wallet is no longer registered." : `Error: ${(e as Error).message}`
      );
    }
  });

  // Voice note → transcribe, then route by role.
  b.on(message("voice"), async (ctx) => {
    const linked = await requireLink(ctx);
    if (!linked) return;
    if (!transcriptionEnabled()) {
      await ctx.reply("Voice transcription is disabled (set OPENAI_API_KEY or MISTRAL_API_KEY).");
      return;
    }

    await ctx.sendChatAction("typing");
    let transcript: string;
    try {
      const audio = await downloadVoice(ctx, ctx.message.voice.file_id);
      transcript = await transcribeAudio(audio, "voice.oga");
    } catch (e) {
      await ctx.reply(`Transcription failed: ${(e as Error).message}`);
      return;
    }
    await ctx.reply(`📝 _Transcript:_\n${transcript}`, { parse_mode: "Markdown" });

    const isProfessor = linked.role === "PROFESSOR" || linked.role === "ADMIN";
    if (!isProfessor) {
      // Students: treat the voice note as a spoken question.
      try {
        const { answer } = await answerQuestion(transcript, linked.address);
        await ctx.reply(answer, { parse_mode: "Markdown" });
      } catch (e) {
        await ctx.reply(`Error: ${(e as Error).message}`);
      }
      return;
    }

    // Professors: detect & publish an announcement on-chain.
    await handleProfessorVoice(ctx, transcript);
  });

  b.catch((err, ctx) => {
    console.error(`Telegram handler error for ${ctx.updateType}:`, err);
  });
}

async function handleProfessorVoice(ctx: Context, transcript: string): Promise<void> {
  const analysis = await analyzeForAnnouncement(transcript);
  if (!analysis.isAnnouncement) {
    await ctx.reply("ℹ️ That didn't look like an announcement, so I didn't publish anything.");
    return;
  }

  if (!(await holdsProfessorRole(relayerAddress))) {
    await ctx.reply(
      `⚠️ Detected an announcement but the backend relayer (${relayerAddress}) lacks PROFESSOR_ROLE, so it can't publish.\nGrant it once via /api/roles/assign, then resend.`
    );
    return;
  }

  await ctx.sendChatAction("typing");
  try {
    const contentHash = keccak256(toHex(analysis.content));
    const id = await publishAnnouncement({
      contentHash,
      category: analysis.category,
      targetGroup: analysis.targetGroup,
      content: analysis.content,
    });
    await indexDocument({
      sourceId: Number(id),
      text: `[${analysis.category}] ${analysis.content}`,
      group: analysis.targetGroup,
      type: "announcement",
      metadata: { category: analysis.category, targetGroup: analysis.targetGroup, source: "telegram-voice" },
    });
    await ctx.reply(
      `📢 *Published on-chain!*\nID: ${id}\nCategory: ${analysis.category}\nGroup: ${analysis.targetGroup}\n\n${analysis.content}`,
      { parse_mode: "Markdown" }
    );
  } catch (e) {
    await ctx.reply(`Failed to publish on-chain: ${(e as Error).message}`);
  }
}

export async function startTelegramBot(): Promise<void> {
  if (!config.TELEGRAM_BOT_TOKEN) return;
  bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);
  registerHandlers(bot);
  // launch() resolves only when the bot stops, so we don't await it here.
  bot.launch().catch((err) => console.error("Telegram bot crashed:", err));
  console.log("  Telegram bot:      enabled (long polling)");
}

export function stopTelegramBot(signal?: string): void {
  bot?.stop(signal);
}

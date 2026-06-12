// Maps a Telegram user id to the on-chain wallet they've linked, so the bot can
// resolve each Telegram user's role/group. In-memory for this local-dev project;
// swap for a small KV/SQLite store if you need persistence across restarts.
import { isAddress } from "viem";

interface LinkedWallet {
  address: `0x${string}`;
  role: string;
  group: string;
}

const byTelegramId = new Map<number, LinkedWallet>();

export function linkWallet(telegramId: number, wallet: LinkedWallet): void {
  byTelegramId.set(telegramId, wallet);
}

export function getLinkedWallet(telegramId: number): LinkedWallet | undefined {
  return byTelegramId.get(telegramId);
}

export function unlinkWallet(telegramId: number): boolean {
  return byTelegramId.delete(telegramId);
}

export function isValidAddress(value: string): value is `0x${string}` {
  return isAddress(value);
}

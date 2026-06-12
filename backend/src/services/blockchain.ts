import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  parseAbiItem,
  decodeEventLog,
  type Log,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toHex } from "viem";
import { config } from "../config";

const PROFESSOR_ROLE = keccak256(toHex("PROFESSOR_ROLE"));

import RoleManagerABI from "../abis/RoleManager.json";
import AnnouncementLogABI from "../abis/AnnouncementLog.json";
import DocumentRegistryABI from "../abis/DocumentRegistry.json";
import AcknowledgmentLogABI from "../abis/AcknowledgmentLog.json";

const hardhatLocal = defineChain({
  id: 31337,
  name: "Hardhat Local",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [config.HARDHAT_RPC_URL] } },
});

export const publicClient = createPublicClient({
  chain: hardhatLocal,
  transport: http(config.HARDHAT_RPC_URL),
});

const account = privateKeyToAccount(config.BACKEND_PRIVATE_KEY);

export const walletClient = createWalletClient({
  account,
  chain: hardhatLocal,
  transport: http(config.HARDHAT_RPC_URL),
});

// ── RoleManager ──────────────────────────────────────────────────────────────

export async function getRoleOf(address: `0x${string}`): Promise<string> {
  return publicClient.readContract({
    address: config.ROLE_MANAGER_ADDRESS,
    abi: RoleManagerABI,
    functionName: "getRoleOf",
    args: [address],
  }) as Promise<string>;
}

export async function getGroup(address: `0x${string}`): Promise<string> {
  return publicClient.readContract({
    address: config.ROLE_MANAGER_ADDRESS,
    abi: RoleManagerABI,
    functionName: "getGroup",
    args: [address],
  }) as Promise<string>;
}

// True only if `account` literally holds PROFESSOR_ROLE (getRoleOf would mask
// this with "ADMIN" for the deployer wallet, so we read hasRole directly).
export async function holdsProfessorRole(address: `0x${string}`): Promise<boolean> {
  return publicClient.readContract({
    address: config.ROLE_MANAGER_ADDRESS,
    abi: RoleManagerABI,
    functionName: "hasRole",
    args: [PROFESSOR_ROLE, address],
  }) as Promise<boolean>;
}

export async function assignRole(
  targetAddress: `0x${string}`,
  roleHex: `0x${string}`
): Promise<void> {
  const hash = await walletClient.writeContract({
    address: config.ROLE_MANAGER_ADDRESS,
    abi: RoleManagerABI,
    functionName: "assignRole",
    args: [targetAddress, roleHex],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

export async function assignGroup(
  targetAddress: `0x${string}`,
  group: string
): Promise<void> {
  const hash = await walletClient.writeContract({
    address: config.ROLE_MANAGER_ADDRESS,
    abi: RoleManagerABI,
    functionName: "assignGroup",
    args: [targetAddress, group],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

// ── AnnouncementLog ───────────────────────────────────────────────────────────

export async function getAnnouncements(group: string): Promise<unknown[]> {
  return publicClient.readContract({
    address: config.ANNOUNCEMENT_LOG_ADDRESS,
    abi: AnnouncementLogABI,
    functionName: "getAnnouncements",
    args: [group],
  }) as Promise<unknown[]>;
}

export async function verifyAnnouncement(
  id: bigint,
  contentHash: `0x${string}`
): Promise<boolean> {
  return publicClient.readContract({
    address: config.ANNOUNCEMENT_LOG_ADDRESS,
    abi: AnnouncementLogABI,
    functionName: "verify",
    args: [id, contentHash],
  }) as Promise<boolean>;
}

const ANNOUNCEMENT_PUBLISHED_EVENT = parseAbiItem(
  "event AnnouncementPublished(uint256 indexed id, address indexed publisher, bytes32 contentHash, string category, string targetGroup, uint256 timestamp)"
);

function extractAnnouncementId(logs: Log[]): bigint {
  for (const log of logs) {
    try {
      const { args } = decodeEventLog({
        abi: [ANNOUNCEMENT_PUBLISHED_EVENT],
        topics: log.topics,
        data: log.data,
      });
      if (args && "id" in args) return args.id as bigint;
    } catch {}
  }
  throw new Error("AnnouncementPublished event not found in receipt");
}

// Waits for a professor's MetaMask TX and parses the AnnouncementPublished event
export async function waitForAnnouncementId(txHash: `0x${string}`): Promise<bigint> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  return extractAnnouncementId(receipt.logs);
}

// Relayer publish: the backend wallet signs the `publish` TX directly (no MetaMask).
// Used by interfaces that have no browser wallet — e.g. the Telegram voice flow.
// The relayer wallet MUST hold PROFESSOR_ROLE (see README: grant it once after deploy).
export async function publishAnnouncement(params: {
  contentHash: `0x${string}`;
  category: string;
  targetGroup: string;
  content: string;
}): Promise<bigint> {
  const { contentHash, category, targetGroup, content } = params;
  const hash = await walletClient.writeContract({
    address: config.ANNOUNCEMENT_LOG_ADDRESS,
    abi: AnnouncementLogABI,
    functionName: "publish",
    args: [contentHash, category, targetGroup, content],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return extractAnnouncementId(receipt.logs as never);
}

// Exposes the relayer's own address so callers can verify it holds PROFESSOR_ROLE.
export const relayerAddress = account.address;

// ── DocumentRegistry ──────────────────────────────────────────────────────────

export async function getDocuments(group: string): Promise<unknown[]> {
  return publicClient.readContract({
    address: config.DOCUMENT_REGISTRY_ADDRESS,
    abi: DocumentRegistryABI,
    functionName: "getDocuments",
    args: [group],
  }) as Promise<unknown[]>;
}

export async function verifyDocumentOnChain(
  id: bigint,
  fileHash: `0x${string}`
): Promise<boolean> {
  return publicClient.readContract({
    address: config.DOCUMENT_REGISTRY_ADDRESS,
    abi: DocumentRegistryABI,
    functionName: "verifyDocument",
    args: [id, fileHash],
  }) as Promise<boolean>;
}

const DOCUMENT_REGISTERED_EVENT = parseAbiItem(
  "event DocumentRegistered(uint256 indexed id, address indexed publisher, bytes32 fileHash, string fileName, string targetGroup, uint256 timestamp)"
);

export async function waitForDocumentId(txHash: `0x${string}`): Promise<bigint> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  for (const log of receipt.logs) {
    try {
      const { args } = decodeEventLog({
        abi: [DOCUMENT_REGISTERED_EVENT],
        topics: log.topics,
        data: log.data,
      });
      if (args && "id" in args) return args.id as bigint;
    } catch {}
  }
  throw new Error("DocumentRegistered event not found in receipt");
}

// ── AcknowledgmentLog ─────────────────────────────────────────────────────────

export async function getAcknowledgments(announcementId: bigint): Promise<string[]> {
  return publicClient.readContract({
    address: config.ACKNOWLEDGMENT_LOG_ADDRESS,
    abi: AcknowledgmentLogABI,
    functionName: "getAcknowledgments",
    args: [announcementId],
  }) as Promise<string[]>;
}

export async function hasAcknowledged(
  announcementId: bigint,
  student: `0x${string}`
): Promise<boolean> {
  return publicClient.readContract({
    address: config.ACKNOWLEDGMENT_LOG_ADDRESS,
    abi: AcknowledgmentLogABI,
    functionName: "hasAcknowledged",
    args: [announcementId, student],
  }) as Promise<boolean>;
}

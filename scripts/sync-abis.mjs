// Copies the compiled ABI arrays from Hardhat artifacts into backend/src/abis.
// Cross-platform replacement for the old PowerShell snippet. Run after `npm run compile`.
//   node scripts/sync-abis.mjs   (or: npm run sync-abis)
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contracts = ["RoleManager", "AnnouncementLog", "DocumentRegistry", "AcknowledgmentLog"];
const abiDir = resolve(root, "backend/src/abis");

await mkdir(abiDir, { recursive: true });

for (const name of contracts) {
  const src = resolve(root, `artifacts/contracts/${name}.sol/${name}.json`);
  const dest = resolve(abiDir, `${name}.json`);
  const artifact = JSON.parse(await readFile(src, "utf8"));
  await writeFile(dest, JSON.stringify(artifact.abi, null, 2) + "\n", "utf8");
  console.log(`✓ Synced ABI for ${name}`);
}

console.log("ABIs synced into backend/src/abis/");

# Decentralized Academic Assistant

A blockchain-backed academic communication platform combining 4 Solidity smart contracts, a Node.js/Express REST API with RAG-powered AI (Mistral), a MetaMask-enabled HTML/JS frontend, and an optional Telegram bot interface.

> Runs on **Node.js 24.16.0** (native global `fetch`, `node:test`, modern ESM). The backend dev server uses **tsx** (no more `ts-node-dev`), and uploads use **multer 2.x**.

## Architecture

```
frontend (HTML/JS + MetaMask)        Telegram bot  ◀── students & professors
        │                                  │
        └──────────────┬───────────────────┘
                       ▼
backend (Node.js 24 / Express)
   ├── services/blockchain.ts     ← viem → Hardhat local chain (+ relayer publish)
   ├── services/rag.ts            ← in-memory vector store
   ├── services/llm.ts            ← Mistral AI (embed + chat + announcement analysis)
   ├── services/assistant.ts      ← shared RAG+LLM Q&A (web + Telegram)
   ├── services/pdf.ts            ← PDF text extraction (Automatic PDF Analysis)
   ├── services/transcription.ts  ← Whisper API, Voxtral fallback (Voice Message Support)
   └── services/telegram.ts       ← Telegram Bot Interface (telegraf)
        │
        ▼
Hardhat local node (chainId 31337)
   ├── RoleManager.sol         ← roles + groups
   ├── AnnouncementLog.sol     ← publish + verify
   ├── DocumentRegistry.sol    ← file hash registry
   └── AcknowledgmentLog.sol   ← signed read receipts
```

## Extensions

| Feature | What it does | Enable by setting |
|---|---|---|
| 🤖 **Telegram Bot Interface** | Alternative front-end to the web app. Students `/link` their wallet and ask questions in natural language — same backend, same RAG context. | `TELEGRAM_BOT_TOKEN` |
| 🎙️ **Voice Message Support** | A professor sends a Telegram voice note → Whisper transcribes it (falls back to Mistral Voxtral if OpenAI is unavailable) → the LLM decides if it's an announcement → if so it's **published on-chain automatically** via the backend relayer wallet. | `TELEGRAM_BOT_TOKEN` (Whisper used when `OPENAI_API_KEY` is set, otherwise Voxtral via `MISTRAL_API_KEY`) |
| 📄 **Automatic PDF Analysis** | When a professor registers a PDF, the backend extracts the text, chunks it, and indexes it in the RAG store — so students can ask about the document's **contents**, not just its name. | _(always on; no key needed)_ |

Each integration is optional and self-disables when its key is missing — the core app runs unchanged.

## Prerequisites

1. **Node.js 24.16.0** — [nodejs.org](https://nodejs.org)
2. **MetaMask** browser extension — [metamask.io](https://metamask.io)
3. **VS Code Live Server** extension (to serve the frontend)
4. A **Mistral AI API key** — [console.mistral.ai](https://console.mistral.ai)
5. _(optional)_ An **OpenAI API key** for voice transcription — [platform.openai.com](https://platform.openai.com)
6. _(optional)_ A **Telegram bot token** from [@BotFather](https://t.me/BotFather)

---

## Setup & Run

### 1. Install root dependencies (Hardhat workspace)

```powershell
cd academic-assistant
npm install
```

### 2. Compile contracts

```powershell
npx hardhat compile
```

### 3. Copy the real ABIs into the backend

After compilation, sync the ABI arrays from the generated artifacts into the backend (cross-platform, replaces the old PowerShell snippet):

```powershell
npm run sync-abis
```

### 4. Run tests

```powershell
npx hardhat test
```

All 4 test suites must pass (role access, publish/verify, document hashing, acknowledgment).

### 5. Start the local Hardhat node

Open **Terminal A** and keep it running:

```powershell
npx hardhat node
```

Copy the private key of **Account #0** (admin) and **Account #1** (professor) and **Account #2** (student) from the output.

### 6. Deploy contracts

Open **Terminal B**:

```powershell
npx hardhat ignition deploy ignition/modules/AcademicSystem.ts --network localhost
```

Output:

```
Deployed Addresses
AcademicSystemModule#RoleManager       - 0x5FbDB2...
AcademicSystemModule#AnnouncementLog   - 0xe7f1c0...
AcademicSystemModule#DocumentRegistry  - 0x9fE46...
AcademicSystemModule#AcknowledgmentLog - 0xCf7Ed3...
```

### 7. Configure the backend

```powershell
cd backend
copy .env.example .env
```

Edit `backend/.env`:
- Paste the four contract addresses from step 6
- Set `MISTRAL_API_KEY=your_key`
- Leave `BACKEND_PRIVATE_KEY` as the Hardhat account #0 key shown below
- _(optional)_ Set `OPENAI_API_KEY` to enable voice transcription
- _(optional)_ Set `TELEGRAM_BOT_TOKEN` to enable the Telegram bot

Hardhat account #0 (safe for local dev only):
```
Private key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
Address:     0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

### 8. Configure the frontend

Edit `frontend/js/contracts.js` and paste the deployed addresses:

```javascript
const CONTRACTS = {
  ANNOUNCEMENT_LOG:   "0xe7f1c0...",
  ACKNOWLEDGMENT_LOG: "0xCf7Ed3...",
  DOCUMENT_REGISTRY:  "0x9fE46...",
  ROLE_MANAGER:       "0x5FbDB2...",
};
```

### 9. Start the backend

In **Terminal B**:

```powershell
npm install
npm run dev
```

Server starts at `http://localhost:3001`.

### 10. Add Hardhat network to MetaMask

1. Open MetaMask → Settings → Networks → Add network manually
2. **Network name**: Hardhat Local
3. **RPC URL**: `http://127.0.0.1:8545`
4. **Chain ID**: `31337`
5. **Currency symbol**: ETH

Import test accounts:
- Account #0 (admin):    key `0xac0974...`
- Account #1 (professor): key `0x59c6...` _(shown in `npx hardhat node` output)_
- Account #2 (student):   key `0x5de4...` _(shown in `npx hardhat node` output)_

### 11. Assign roles

```powershell
# Assign professor role to Account #1
curl -X POST http://localhost:3001/api/roles/assign `
  -H "Content-Type: application/json" `
  -d '{"address":"0x70997970C51812dc3A010C7d01b50e0d17dc79C8","role":"PROFESSOR_ROLE"}'

# Assign student role + group to Account #2
curl -X POST http://localhost:3001/api/roles/assign `
  -H "Content-Type: application/json" `
  -d '{"address":"0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC","role":"STUDENT_ROLE","group":"MF1"}'
```

### 12. Open the frontend

Open **Terminal C** and use VS Code Live Server (or `npx serve frontend`) on port 5500:

- **Professor**: `http://127.0.0.1:5500/professor.html`
- **Student**:   `http://127.0.0.1:5500/student.html`

---

## Enabling the Extensions

### 📄 Automatic PDF Analysis
Always on. Register a PDF the usual way (professor UI → "Register Document"). The backend extracts and indexes the full text, so students can then ask the assistant questions about the document's contents. The response from `POST /api/documents` includes `{ pages, contentIndexed }`.

### 🎙️ Voice Message Support + 🤖 Telegram Bot
1. Add `OPENAI_API_KEY` and `TELEGRAM_BOT_TOKEN` to `backend/.env`, then restart `npm run dev`. Startup logs show which integrations are enabled.
2. **Grant the relayer wallet `PROFESSOR_ROLE`** so it can publish announcements transcribed from voice. The relayer is the `BACKEND_PRIVATE_KEY` wallet (Hardhat account #0 by default):
   ```powershell
   curl -X POST http://localhost:3001/api/roles/assign `
     -H "Content-Type: application/json" `
     -d '{"address":"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266","role":"PROFESSOR_ROLE"}'
   ```
   (Skip this if you only want student Q&A over Telegram, not voice publishing.)
3. In Telegram, open your bot and:
   - `/link 0xYourWallet` — connects a wallet that already has a role on-chain
   - send a text question → RAG-grounded answer
   - **professors:** send a 🎙️ voice note → transcribed → if it's an announcement, published on-chain and indexed automatically
   - `/whoami`, `/unlink`, `/help`

> Telegram runs in the same process as the API via long polling and shuts down cleanly on Ctrl+C. The chat-id → wallet mapping is in-memory (resets on restart) — swap `services/links.ts` for a small store if you need persistence.

---

## End-to-End Test Checklist

- [ ] Professor connects wallet → publishes announcement → MetaMask confirms TX
- [ ] Student connects wallet → sees announcement in feed
- [ ] Student asks "when is the exam?" in chat → Mistral answers from RAG context
- [ ] Student clicks "I've read this" → MetaMask signs acknowledgment TX
- [ ] Professor checks acknowledgment tracker → student address appears
- [ ] Professor uploads PDF → hash registered on-chain
- [ ] Student drags same PDF into verifier → VERIFIED ✓
- [ ] Student drags modified PDF → TAMPERED ✗
- [ ] Professor registers a text PDF → student asks about its contents → assistant answers from the indexed text
- [ ] Student `/link`s wallet in Telegram → asks a question → gets the same RAG answer as the web chat
- [ ] Professor sends a voice-note announcement in Telegram → it appears on-chain in the feed
- [ ] `npx hardhat test` → all tests pass

---

## Smart Contracts Summary

| Contract | Purpose | Key Functions |
|---|---|---|
| `RoleManager` | On-chain role & group registry | `assignRole`, `assignGroup`, `getRoleOf`, `getGroup` |
| `AnnouncementLog` | Immutable announcement log | `publish`, `verify`, `getAnnouncements` |
| `DocumentRegistry` | File SHA-256 hash registry | `register`, `verifyDocument`, `getDocuments` |
| `AcknowledgmentLog` | Signed read receipts | `acknowledge`, `hasAcknowledged`, `getAcknowledgments` |

All consumer contracts use `IAccessControl` from OpenZeppelin v5 to delegate role checks to `RoleManager` — no duplicated state.

---

## API Reference

| Method | Endpoint | Actor | Description |
|---|---|---|---|
| POST | `/api/roles/assign` | Admin | Assign role + group to a wallet |
| GET  | `/api/roles/:address` | All | Get role + group for a wallet |
| POST | `/api/announcements` | Professor | Index announcement after on-chain TX |
| GET  | `/api/announcements` | All | List announcements filtered by group |
| GET  | `/api/announcements/verify/:id` | All | Verify announcement hash |
| POST | `/api/documents` | Professor | Index document after on-chain TX |
| GET  | `/api/documents` | All | List documents filtered by group |
| POST | `/api/documents/verify-hash` | All | Verify uploaded file against on-chain hash |
| POST | `/api/chat` | Student | RAG + Mistral chat, group-filtered |
| POST | `/api/acknowledge/:id` | Student | Confirm acknowledgment TX landed |
| GET  | `/api/acknowledge/:id` | Professor | List all acknowledgers |

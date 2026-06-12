// Contract addresses — fill after deployment
const CONTRACTS = {
  ANNOUNCEMENT_LOG:  "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",  // set after deploy
  ACKNOWLEDGMENT_LOG: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", // set after deploy
  DOCUMENT_REGISTRY: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",  // set after deploy
  ROLE_MANAGER:      "0x5FbDB2315678afecb367f032d93F642f64180aa3",  // set after deploy
};

const ABIS = {
  ANNOUNCEMENT_LOG: [
    { type: "function", name: "publish", inputs: [
        { name: "contentHash", type: "bytes32" },
        { name: "category",    type: "string" },
        { name: "targetGroup", type: "string" },
        { name: "content",     type: "string" },
      ], outputs: [{ type: "uint256" }], stateMutability: "nonpayable",
    },
  ],
  ACKNOWLEDGMENT_LOG: [
    { type: "function", name: "acknowledge", inputs: [
        { name: "announcementId", type: "uint256" },
      ], outputs: [], stateMutability: "nonpayable",
    },
  ],
  DOCUMENT_REGISTRY: [
    { type: "function", name: "register", inputs: [
        { name: "fileHash",    type: "bytes32" },
        { name: "fileName",    type: "string" },
        { name: "targetGroup", type: "string" },
      ], outputs: [{ type: "uint256" }], stateMutability: "nonpayable",
    },
  ],
};

// Compute keccak256 of a string using viem (loaded via CDN)
function hashContent(text) {
  return window.viem.keccak256(window.viem.toHex(text));
}

// Compute SHA-256 of a File using browser WebCrypto API
async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
